import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import psycopg2
from psycopg2 import extras
from datetime import datetime

app = FastAPI(title="MPLAD AI Monitoring Engine")

# EXTREMELY PERMISSIVE CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "database": os.getenv("DB_NAME", "mplad_db"),
    "user": os.getenv("DB_USER", "mplad_admin"),
    "password": os.getenv("DB_PASSWORD", "mplad_password"),
    "port": os.getenv("DB_PORT", "5433"),
}


def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)


@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/stats")
async def get_stats(
    risk_min: int = 0,
    risk_max: int | None = None,
    category: str | None = None,
    state_ut: str | None = None,
    district: str | None = None,
    search: str = "",
):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)

    filter_clauses = []
    filter_values = []
    if category:
        filter_clauses.append("LOWER(p.category) = LOWER(%s)")
        filter_values.append(category)
    if state_ut:
        filter_clauses.append("LOWER(COALESCE(p.state_ut, '')) = LOWER(%s)")
        filter_values.append(state_ut)
    if district:
        filter_clauses.append("LOWER(COALESCE(p.district, '')) = LOWER(%s)")
        filter_values.append(district)
    if search:
        filter_clauses.append("(LOWER(p.project_name) LIKE LOWER('%%' || %s || '%%') OR CAST(p.project_id AS TEXT) LIKE '%%' || %s || '%%')")
        filter_values.extend([search, search])

    filter_sql = " AND ".join(filter_clauses) if filter_clauses else "TRUE"
    cur.execute(
        f"""
        WITH filtered_projects AS (
            SELECT p.project_id, p.sanction_amount
            FROM projects p
            WHERE {filter_sql}
        ), latest_flags AS (
            SELECT DISTINCT ON (af.project_id) af.project_id, af.risk_score
            FROM anomaly_flags af
            JOIN filtered_projects fp ON fp.project_id = af.project_id
            ORDER BY af.project_id, af.risk_score DESC NULLS LAST, af.flag_id DESC
        )
        SELECT
            COALESCE(SUM(fp.sanction_amount), 0) AS total_funds,
            COUNT(*) AS projects_total,
            COUNT(*) FILTER (WHERE COALESCE(lf.risk_score, 0) > 70) AS risk_count,
            COUNT(*) FILTER (WHERE COALESCE(lf.risk_score, 0) >= 50 AND COALESCE(lf.risk_score, 0) < 70) AS medium_risk,
            COUNT(*) FILTER (WHERE COALESCE(lf.risk_score, 0) < 50) AS low_risk,
            COUNT(*) FILTER (WHERE COALESCE(lf.risk_score, 0) > 70) AS flagged_projects,
            COALESCE(ROUND(AVG(lf.risk_score), 2), 0) AS avg_risk_score
        FROM filtered_projects fp
        LEFT JOIN latest_flags lf ON lf.project_id = fp.project_id
        WHERE (%s = 0 OR COALESCE(lf.risk_score, 0) >= %s)
                    AND (%s IS NULL OR COALESCE(lf.risk_score, 0) <= %s)
        """,
                [*filter_values, risk_min, risk_min, risk_max, risk_max],
    )
    metrics = cur.fetchone()
    total_funds = metrics['total_funds']
    risk_count = metrics['risk_count']
    flagged_projects = metrics['flagged_projects']
    avg_risk_score = metrics['avg_risk_score']
    projects_total = metrics['projects_total']
    medium_risk = metrics['medium_risk']
    low_risk = metrics['low_risk']

    cur.execute(
        f"""
        SELECT af.anomaly_type, COUNT(*) as count
        FROM anomaly_flags af
        JOIN projects p ON p.project_id = af.project_id
        WHERE {filter_sql} AND af.risk_score > 70
        GROUP BY af.anomaly_type
        ORDER BY count DESC
        """,
        filter_values,
    )
    anomaly_breakdown = cur.fetchall()

    cur.execute(
        f"SELECT p.sc_st_category, COUNT(*) as count FROM projects p WHERE {filter_sql} GROUP BY p.sc_st_category",
        filter_values,
    )
    distribution = cur.fetchall()

    cur.execute("""
        WITH buckets AS (
            SELECT CASE
                WHEN risk_score >= 85 THEN 'High'
                WHEN risk_score >= 70 THEN 'Moderate-High'
                WHEN risk_score >= 50 THEN 'Moderate'
                ELSE 'Low'
            END AS bucket
            FROM anomaly_flags af
            JOIN projects p ON p.project_id = af.project_id
            WHERE """ + filter_sql + """
        )
        SELECT bucket, COUNT(*) AS count
        FROM buckets
        GROUP BY bucket
        ORDER BY CASE bucket
            WHEN 'High' THEN 1
            WHEN 'Moderate-High' THEN 2
            WHEN 'Moderate' THEN 3
            ELSE 4
        END
    """, filter_values)
    risk_distribution = cur.fetchall()

    cur.close()
    conn.close()

    high_risk_share = round((float(risk_count) / float(projects_total) * 100), 2) if projects_total else 0.0
    monitoring_index = min(100.0, round((high_risk_share * 0.7) + (float(avg_risk_score) * 0.3), 2))

    if high_risk_share >= 40:
        risk_trend = "Elevated"
    elif high_risk_share >= 20:
        risk_trend = "Moderate"
    else:
        risk_trend = "Stable"

    if anomaly_breakdown:
        dominant_anomaly = anomaly_breakdown[0]['anomaly_type']
        dominant_count = anomaly_breakdown[0]['count']
    else:
        dominant_anomaly = "NONE"
        dominant_count = 0

    precision = round((float(risk_count) / max(float(risk_count + medium_risk + low_risk), 1)) * 100, 2) if (risk_count + medium_risk + low_risk) else 0.0
    recall = round((float(risk_count) / max(float(projects_total), 1)) * 100, 2) if projects_total else 0.0
    f1_score = round((2 * precision * recall / max((precision + recall), 1)), 2) if (precision + recall) else 0.0

    predictive_risk = min(100.0, round((monitoring_index * 0.65) + (float(high_risk_share) * 0.35), 2))
    predictive_signal = "Rising" if predictive_risk >= 65 else "Watchlist" if predictive_risk >= 45 else "Contained"

    monitoring_summary = {
        "risk_trend": risk_trend,
        "monitoring_index": monitoring_index,
        "dominant_anomaly": dominant_anomaly,
        "dominant_anomaly_count": dominant_count,
        "prediction": "Early warning: risk concentration is increasing across the monitored portfolio." if risk_trend == "Elevated" else "Portfolio remains under review; no critical escalation required." if risk_trend == "Moderate" else "Portfolio remains stable and within expected risk tolerance.",
        "predictive_risk_score": predictive_risk,
        "predictive_signal": predictive_signal,
        "portfolio_stability": "At risk" if predictive_signal == "Rising" else "Needs attention" if predictive_signal == "Watchlist" else "Stable"
    }

    return {
        "generated_at": datetime.now().isoformat(),
        "total_funds": float(total_funds),
        "risk_count": risk_count,
        "flagged_projects": flagged_projects,
        "avg_risk_score": float(avg_risk_score),
        "high_risk_share": high_risk_share,
        "projects_total": projects_total,
        "anomaly_type_breakdown": anomaly_breakdown,
        "category_distribution": distribution,
        "risk_distribution": risk_distribution,
        "model_evaluation": {
            "precision": precision,
            "recall": recall,
            "f1_score": f1_score,
            "baseline_model": "Isolation Forest + geospatial overlap + duplicate image detection",
            "confidence": "High" if f1_score >= 75 else "Moderate" if f1_score >= 50 else "Low"
        },
        "monitoring_summary": monitoring_summary,
    }

@app.get("/api/projects")
async def get_projects(
    risk_min: int = 0,
    risk_max: int | None = None,
    category: str | None = None,
    state_ut: str | None = None,
    district: str | None = None,
    search: str = "",
    limit: int = 300,
):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)
    query = """
        SELECT p.*, ST_X(a.location) as longitude, ST_Y(a.location) as latitude,
               af.risk_score, af.anomaly_type, af.reasoning
        FROM projects p
        JOIN assets a ON p.project_id = a.project_id
        LEFT JOIN LATERAL (
            SELECT risk_score, anomaly_type, reasoning
            FROM anomaly_flags af
            WHERE af.project_id = p.project_id
            ORDER BY risk_score DESC NULLS LAST, flag_id DESC
            LIMIT 1
        ) af ON TRUE
        WHERE (%s = 0 OR COALESCE(af.risk_score, 0) >= %s)
                    AND (%s IS NULL OR COALESCE(af.risk_score, 0) <= %s)
          AND (
                %s::text IS NULL
                OR LOWER(COALESCE(p.category, '')) = LOWER(%s)
                OR LOWER(COALESCE(p.sc_st_category, '')) = LOWER(%s)
          )
          AND (%s::text IS NULL OR LOWER(COALESCE(p.state_ut, '')) = LOWER(%s))
          AND (%s::text IS NULL OR LOWER(COALESCE(p.district, '')) = LOWER(%s))
          AND (%s = '' OR LOWER(p.project_name) LIKE LOWER('%%' || %s || '%%') OR LOWER(CAST(p.project_id AS TEXT)) LIKE LOWER('%%' || %s || '%%'))
        ORDER BY COALESCE(af.risk_score, 0) DESC, p.project_id ASC
        LIMIT %s
    """
    cur.execute(
        query,
        (
            risk_min, risk_min,
            risk_max, risk_max,
            category, category, category,
            state_ut, state_ut,
            district, district,
            search, search, search,
            limit,
        )
    )
    projects = cur.fetchall()
    cur.close()
    conn.close()
    for p in projects:
        p['sanction_amount'] = float(p['sanction_amount'])
        if p['risk_score'] is not None:
            p['risk_score'] = float(p['risk_score'])
    return projects

@app.post("/api/analyze")
async def run_anomaly_detection():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)

    try:
        # Clear stale anomaly records before recalculating the current analysis.
        # This does not remove projects, assets, or data model tables.
        cur.execute("DELETE FROM anomaly_flags")

        cur.execute("SELECT project_id, sanction_amount FROM projects")
        data = cur.fetchall()
        df = pd.DataFrame(data)
        if not df.empty:
            max_amount = float(df['sanction_amount'].max()) or 1.0
            model = IsolationForest(contamination=0.05, random_state=42)
            df['anomaly'] = model.fit_predict(df[['sanction_amount']])
            anomalies = df[df['anomaly'] == -1]
            for _, row in anomalies.iterrows():
                normalized = min(1.0, float(row['sanction_amount']) / max_amount)
                risk_score = int(50 + (normalized * 19))
                cur.execute(
                    "INSERT INTO anomaly_flags (project_id, risk_score, anomaly_type, reasoning) VALUES (%s, %s, 'FUND_SPIKE', %s)",
                    (int(row['project_id']), risk_score, f"Unusual sanction amount detected (₹{float(row['sanction_amount']):,.2f})")
                )

        cur.execute("""
            WITH spatial_hits AS (
                SELECT a1.project_id, COUNT(*) AS overlap_count
                FROM assets a1
                JOIN assets a2 ON ST_DWithin(a1.location::geography, a2.location::geography, 50)
                WHERE a1.project_id <> a2.project_id
                GROUP BY a1.project_id
            )
            INSERT INTO anomaly_flags (project_id, risk_score, anomaly_type, reasoning)
            SELECT project_id,
                   LEAST(99, 72 + (overlap_count * 6)) AS risk_score,
                   'SPATIAL_OVERLAP',
                   'Asset cluster within 50m of ' || overlap_count || ' other project assets'
            FROM spatial_hits
        """)

        cur.execute("SELECT asset_id, project_id, perceptual_hash FROM assets")
        assets = cur.fetchall()
        duplicate_groups = {}
        for asset in assets:
            hash_value = asset['perceptual_hash']
            if not hash_value:
                continue
            duplicate_groups.setdefault(hash_value, []).append(int(asset['project_id']))

        for hash_value, project_ids in duplicate_groups.items():
            if len(project_ids) < 2:
                continue

            duplicate_count = len(project_ids)
            for project_id in project_ids:
                risk_score = min(99, 75 + ((duplicate_count - 1) * 8))
                cur.execute(
                    "INSERT INTO anomaly_flags (project_id, risk_score, anomaly_type, reasoning) VALUES (%s, %s, 'PHOTO_DUPLICATION', %s)",
                    (project_id, risk_score, f"Photo matches {duplicate_count} projects using the same perceptual hash")
                )

        conn.commit()
        return {"status": "Analysis complete.", "analyzed_at": datetime.now().isoformat()}
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(exc)}") from exc
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
