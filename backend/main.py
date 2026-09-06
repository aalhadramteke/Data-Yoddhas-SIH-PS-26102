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
    "host": "localhost",
    "database": "mplad_db",
    "user": "mplad_admin",
    "password": "mplad_password",
    "port": "5433"
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

@app.get("/api/stats")
async def get_stats():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)
    cur.execute("SELECT SUM(sanction_amount) as total_funds FROM projects")
    total_funds = cur.fetchone()['total_funds'] or 0
    cur.execute("SELECT COUNT(*) as risk_count FROM anomaly_flags WHERE risk_score > 70")
    risk_count = cur.fetchone()['risk_count']
    cur.execute("SELECT sc_st_category, COUNT(*) as count FROM projects GROUP BY sc_st_category")
    distribution = cur.fetchall()
    cur.close()
    conn.close()
    return {"total_funds": float(total_funds), "risk_count": risk_count, "category_distribution": distribution}

@app.get("/api/projects")
async def get_projects():
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
    """
    cur.execute(query)
    projects = cur.fetchall()
    cur.close()
    conn.close()
    for p in projects:
        p['sanction_amount'] = float(p['sanction_amount'])
        if p['risk_score']: p['risk_score'] = float(p['risk_score'])
    return projects

@app.post("/api/analyze")
async def run_anomaly_detection():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)
    cur.execute("SELECT project_id, sanction_amount FROM projects")
    data = cur.fetchall()
    df = pd.DataFrame(data)
    if not df.empty:
        model = IsolationForest(contamination=0.05, random_state=42)
        df['anomaly'] = model.fit_predict(df[['sanction_amount']])
        anomalies = df[df['anomaly'] == -1]
        for _, row in anomalies.iterrows():
            cur.execute("INSERT INTO anomaly_flags (project_id, risk_score, anomaly_type, reasoning) VALUES (%s, 85, 'FUND_SPIKE', 'Unusual sanction amount detected') ON CONFLICT (flag_id) DO NOTHING;", (int(row['project_id']),))
    cur.execute("INSERT INTO anomaly_flags (project_id, risk_score, anomaly_type, reasoning) SELECT a1.project_id, 95, 'SPATIAL_OVERLAP', 'Asset within 50m of Project #' || a2.project_id FROM assets a1 JOIN assets a2 ON ST_DWithin(a1.location, a2.location, 50) WHERE a1.project_id <> a2.project_id;")
    cur.execute("SELECT asset_id, project_id, perceptual_hash FROM assets")
    assets = cur.fetchall()
    hashes = {}
    for a in assets:
        h = a['perceptual_hash']
        if h in hashes:
            cur.execute("INSERT INTO anomaly_flags (project_id, risk_score, anomaly_type, reasoning) VALUES (%s, 90, 'PHOTO_DUPLICATION', 'Photo matches Project #' || %s)", (a['project_id'], hashes[h]))
        else:
            hashes[h] = a['project_id']
    conn.commit()
    cur.close()
    conn.close()
    return {"status": "Analysis complete."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
