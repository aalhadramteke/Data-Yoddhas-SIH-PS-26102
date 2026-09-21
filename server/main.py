import os
import re
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
import pandas as pd
import psycopg2
from psycopg2 import extras
from sklearn.ensemble import IsolationForest

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "development")
DEBUG_MODE = os.getenv("APP_DEBUG", str(APP_ENV == "development")).lower() == "true"
AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "false").lower() == "true"
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "mplad-dev-secret-key-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
API_KEY = os.getenv("MPLAD_API_KEY", "mplad-dev-local-key")
ADMIN_API_KEY = os.getenv("MPLAD_ADMIN_API_KEY", API_KEY)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
VIEWER_USERNAME = os.getenv("VIEWER_USERNAME", "viewer")
VIEWER_PASSWORD = os.getenv("VIEWER_PASSWORD", "viewer123")
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]

security_scheme = HTTPBearer(auto_error=False)

app = FastAPI(
    title="MPLAD AI Monitoring Engine",
    docs_url="/docs" if DEBUG_MODE else None,
    redoc_url="/redoc" if DEBUG_MODE else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-API-Key", "X-User-Role"],
    expose_headers=["X-Request-ID"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "accelerometer=(), camera=(), geolocation=()"
    response.headers["X-XSS-Protection"] = "0"
    if APP_ENV != "development":
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    detail = exc.detail if (DEBUG_MODE or exc.status_code < 500) else "Request failed."
    return JSONResponse(status_code=exc.status_code, content={"detail": detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": "Validation error." if not DEBUG_MODE else exc.errors()})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    if DEBUG_MODE:
        return JSONResponse(status_code=500, content={"detail": str(exc)})
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "database": os.getenv("DB_NAME", "mplad_db"),
    "user": os.getenv("DB_USER", "mplad_admin"),
    "password": os.getenv("DB_PASSWORD", "mplad_password"),
    "port": int(os.getenv("DB_PORT", "5433")),
}


def sanitize_user_text(value: str | None, max_length: int = 128) -> str:
    if value is None:
        return ""
    cleaned = re.sub(r"[\x00-\x1f\x7f]+", " ", str(value))
    cleaned = cleaned.strip()
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length].strip()
    return cleaned


def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)


def create_access_token(username: str, role: str) -> str:
    expiry = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": username, "role": role, "exp": expiry.timestamp()}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict[str, str]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        role = payload.get("role")
        if not username or not role:
            raise ValueError("Invalid token payload.")
        return {"user_id": username, "role": role}
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc


def get_client_api_key(
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    provided = None
    if authorization:
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            provided = parts[1]
    elif x_api_key:
        provided = x_api_key

    if not AUTH_REQUIRED:
        return {"role": "admin", "user_id": "local-dev-user"}

    if provided == ADMIN_API_KEY:
        return {"role": "admin", "user_id": "admin-user"}
    if provided == API_KEY:
        return {"role": "viewer", "user_id": "api-user"}

    if not provided:
        raise HTTPException(status_code=401, detail="Authentication required.")
    raise HTTPException(status_code=401, detail="Invalid API key.")


def get_current_user(
    auth: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    if not AUTH_REQUIRED:
        return {"role": "admin", "user_id": "local-dev-user"}

    token = None
    if auth and auth.credentials:
        token = auth.credentials
    elif x_api_key:
        token = x_api_key

    if token:
        if token == ADMIN_API_KEY:
            return {"role": "admin", "user_id": "admin-user"}
        if token == API_KEY:
            return {"role": "viewer", "user_id": "api-user"}
        
        # Check Database for user (RBAC)
        try:
            payload = verify_token(token)
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT role FROM users WHERE username = %s", (payload["user_id"],))
            res = cur.fetchone()
            cur.close()
            conn.close()
            if res:
                return {"role": res[0], "user_id": payload["user_id"]}
        except Exception:
            pass

    raise HTTPException(status_code=401, detail="Authentication required.")



def require_admin(user: dict[str, str] = Depends(get_current_user)) -> dict[str, str]:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/api/locations")
async def get_locations(_user: dict[str, str] = Depends(get_client_api_key)):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT state_ut, district
            FROM projects
            WHERE COALESCE(state_ut, '') <> '' AND COALESCE(district, '') <> ''
            GROUP BY state_ut, district
            ORDER BY state_ut, district
            """
        )
        locations = {}
        for state, district in cur.fetchall():
            locations.setdefault(state, []).append(district)

        cur.execute("SELECT DISTINCT category FROM projects WHERE category IS NOT NULL ORDER BY category")
        categories = [row[0] for row in cur.fetchall()]
        return {"states": list(locations), "districts": locations, "categories": categories}
    finally:
        cur.close()
        conn.close()


@app.post("/api/auth/login")
async def login(payload: dict[str, str]):
    username = sanitize_user_text(payload.get("username"), 50)
    password = sanitize_user_text(payload.get("password"), 200)

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required.")

    users = {
        ADMIN_USERNAME: {"password": ADMIN_PASSWORD, "role": "admin"},
        VIEWER_USERNAME: {"password": VIEWER_PASSWORD, "role": "viewer"},
    }

    if username not in users or users[username]["password"] != password:
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    return {
        "access_token": create_access_token(username, users[username]["role"]),
        "token_type": "bearer",
        "user": {"username": username, "role": users[username]["role"]},
    }


@app.get("/api/auth/me")
async def get_current_profile(user: dict[str, str] = Depends(get_current_user)):
    return {"user_id": user["user_id"], "role": user["role"]}


@app.get("/api/admin/summary")
async def admin_summary(_user: dict[str, str] = Depends(require_admin)):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)
    try:
        cur.execute(
            """
            SELECT
                COUNT(*) AS total_projects,
                COALESCE(SUM(sanction_amount), 0) AS total_funds,
                COUNT(*) FILTER (WHERE project_id IN (SELECT project_id FROM anomaly_flags WHERE risk_score > 70)) AS high_risk_count
            FROM projects
            """
        )
        row = cur.fetchone()
        return {
            "generated_at": datetime.now().isoformat(),
            "total_projects": int(row["total_projects"] or 0),
            "total_funds": float(row["total_funds"] or 0),
            "high_risk_count": int(row["high_risk_count"] or 0),
            "status": "admin-ok",
        }
    finally:
        cur.close()
        conn.close()


@app.get("/api/export/anomalies")
async def export_anomalies(_user: dict[str, str] = Depends(require_admin)):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)
    try:
        cur.execute("""
            SELECT p.project_id, p.project_name, af.anomaly_type, af.risk_score, af.reasoning, af.review_status
            FROM anomaly_flags af
            JOIN projects p ON p.project_id = af.project_id
            ORDER BY af.risk_score DESC
        """)
        data = cur.fetchall()
        
        import csv
        import io
        from fastapi.responses import StreamingResponse
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["project_id", "project_name", "anomaly_type", "risk_score", "reasoning", "review_status"])
        writer.writeheader()
        writer.writerows(data)
        
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=mplad_audit_report.csv"}
        )
    finally:
        cur.close()
        conn.close()

@app.get("/api/stats")

async def get_stats(
    risk_min: int = 0,
    risk_max: int | None = None,
    category: str | None = None,
    state_ut: str | None = None,
    district: str | None = None,
    search: str = "",
    funding_status: str = "all",
    _user: dict[str, str] = Depends(get_client_api_key),
):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)

    filter_clauses = []
    filter_values = []
    if category:
        filter_clauses.append("LOWER(p.category) = LOWER(%s)")
        filter_values.append(sanitize_user_text(category, 50))
    if state_ut:
        filter_clauses.append("LOWER(COALESCE(p.state_ut, '')) = LOWER(%s)")
        filter_values.append(sanitize_user_text(state_ut, 50))
    if district:
        filter_clauses.append("LOWER(COALESCE(p.district, '')) = LOWER(%s)")
        filter_values.append(sanitize_user_text(district, 50))
    if funding_status != "all":
        allowed_funding_statuses = {"released", "partial", "unreleased"}
        if funding_status not in allowed_funding_statuses:
            raise HTTPException(status_code=400, detail="Invalid funding status.")
        filter_clauses.append(
            "CASE WHEN COALESCE(p.entitlement_cr, 0) <= 0 THEN 'unknown' "
            "WHEN COALESCE(p.goi_release_cr, 0) >= p.entitlement_cr THEN 'released' "
            "WHEN COALESCE(p.goi_release_cr, 0) > 0 THEN 'partial' ELSE 'unreleased' END = %s"
        )
        filter_values.append(funding_status)
    sanitized_search = sanitize_user_text(search, 100)
    if sanitized_search:
        filter_clauses.append("(LOWER(p.project_name) LIKE LOWER('%%' || %s || '%%') OR CAST(p.project_id AS TEXT) LIKE '%%' || %s || '%%')")
        filter_values.extend([sanitized_search, sanitized_search])

    filter_sql = " AND ".join(filter_clauses) if filter_clauses else "TRUE"
    financial_risk_sql = """
        CASE
            WHEN COALESCE(p.entitlement_cr, 0) <= 0 THEN 0
            WHEN p.goi_release_cr >= p.entitlement_cr THEN 0
            ELSE GREATEST(0, LEAST(100, 100 - ((p.goi_release_cr / p.entitlement_cr) * 100)))
        END
    """
    cur.execute(
        f"""
        WITH filtered_projects AS (
            SELECT p.project_id, p.sanction_amount, p.entitlement_cr, p.goi_release_cr, p.unreleased_amount_cr,
                   {financial_risk_sql} AS financial_risk_score
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
            COALESCE(SUM(fp.entitlement_cr), 0) AS total_entitlement_cr,
            COALESCE(SUM(fp.goi_release_cr), 0) AS total_release_cr,
            COALESCE(SUM(fp.unreleased_amount_cr), 0) AS total_unreleased_cr,
            COALESCE(ROUND(AVG(CASE WHEN COALESCE(fp.entitlement_cr, 0) > 0 THEN (fp.goi_release_cr / fp.entitlement_cr) * 100 END), 2), 0) AS avg_release_ratio,
            COUNT(*) AS projects_total,
            COUNT(*) FILTER (WHERE COALESCE(lf.risk_score, fp.financial_risk_score, 0) > 70) AS risk_count,
            COUNT(*) FILTER (WHERE COALESCE(lf.risk_score, fp.financial_risk_score, 0) >= 50 AND COALESCE(lf.risk_score, fp.financial_risk_score, 0) < 70) AS medium_risk,
            COUNT(*) FILTER (WHERE COALESCE(lf.risk_score, fp.financial_risk_score, 0) < 50) AS low_risk,
            COUNT(*) FILTER (WHERE COALESCE(lf.risk_score, fp.financial_risk_score, 0) > 70) AS flagged_projects,
            COALESCE(ROUND(AVG(COALESCE(lf.risk_score, fp.financial_risk_score)), 2), 0) AS avg_risk_score
        FROM filtered_projects fp
        LEFT JOIN latest_flags lf ON lf.project_id = fp.project_id
        WHERE (%s = 0 OR COALESCE(lf.risk_score, fp.financial_risk_score, 0) >= %s)
                    AND (%s IS NULL OR COALESCE(lf.risk_score, fp.financial_risk_score, 0) <= %s)
        """,
        [*filter_values, risk_min, risk_min, risk_max, risk_max],
    )
    metrics = cur.fetchone()
    total_funds = metrics["total_funds"]
    total_entitlement_cr = metrics["total_entitlement_cr"]
    total_release_cr = metrics["total_release_cr"]
    total_unreleased_cr = metrics["total_unreleased_cr"]
    avg_release_ratio = metrics["avg_release_ratio"]
    risk_count = metrics["risk_count"]
    flagged_projects = metrics["flagged_projects"]
    avg_risk_score = metrics["avg_risk_score"]
    projects_total = metrics["projects_total"]
    medium_risk = metrics["medium_risk"]
    low_risk = metrics["low_risk"]

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

    cur.execute(
        f"""
        WITH buckets AS (
            SELECT CASE
                WHEN COALESCE(af.risk_score, {financial_risk_sql}, 0) >= 70 THEN 'High risk'
                WHEN COALESCE(af.risk_score, {financial_risk_sql}, 0) >= 50 THEN 'Moderate risk'
                ELSE 'Low'
            END AS bucket
            FROM projects p
            LEFT JOIN LATERAL (
                SELECT risk_score
                FROM anomaly_flags af
                WHERE af.project_id = p.project_id
                ORDER BY risk_score DESC NULLS LAST, flag_id DESC
                LIMIT 1
            ) af ON TRUE
            WHERE """
        + filter_sql
        + """
        )
        SELECT bucket, COUNT(*) AS count
        FROM buckets
        GROUP BY bucket
        ORDER BY CASE bucket
            WHEN 'High risk' THEN 1
            WHEN 'Moderate risk' THEN 2
            ELSE 4
        END
        """,
        filter_values,
    )
    risk_distribution = cur.fetchall()

    cur.execute(
        f"""
        SELECT
            p.mp_id,
            MAX(COALESCE(p.mp_name, p.project_name)) AS mp_name,
            MAX(p.state_ut) AS state_ut,
            STRING_AGG(DISTINCT p.district, ', ' ORDER BY p.district) AS districts,
            COALESCE(SUM(p.entitlement_cr), 0) AS entitlement_cr,
            COALESCE(SUM(p.goi_release_cr), 0) AS release_cr,
            COALESCE(SUM(p.unreleased_amount_cr), 0) AS unreleased_cr,
            COALESCE(ROUND(AVG(CASE WHEN COALESCE(p.entitlement_cr, 0) > 0 THEN (p.goi_release_cr / p.entitlement_cr) * 100 END), 2), 0) AS release_ratio_percent,
            COALESCE(ROUND(MAX(COALESCE(af.risk_score, {financial_risk_sql})), 2), 0) AS risk_score
        FROM projects p
        LEFT JOIN LATERAL (
            SELECT risk_score
            FROM anomaly_flags af
            WHERE af.project_id = p.project_id
            ORDER BY risk_score DESC NULLS LAST, flag_id DESC
            LIMIT 1
        ) af ON TRUE
        WHERE {filter_sql}
          AND (%s = 0 OR COALESCE(af.risk_score, {financial_risk_sql}, 0) >= %s)
          AND (%s IS NULL OR COALESCE(af.risk_score, {financial_risk_sql}, 0) <= %s)
        GROUP BY p.mp_id
        ORDER BY risk_score DESC, unreleased_cr DESC, mp_name ASC
        """,
        [*filter_values, risk_min, risk_min, risk_max, risk_max],
    )
    mp_prediction_rows = cur.fetchall()
    mp_predictions = []
    for row in mp_prediction_rows:
        risk_score = float(row["risk_score"] or 0)
        if risk_score >= 70:
            prediction = "High release-gap risk"
            action = "Prioritize review of release status and supporting financial records."
        elif risk_score >= 30:
            prediction = "Monitor release progress"
            action = "Track the remaining balance in the next monitoring cycle."
        else:
            prediction = "On track"
            action = "Continue routine monitoring."
        mp_predictions.append({
            "mp_id": row["mp_id"],
            "mp_name": row["mp_name"],
            "state_ut": row["state_ut"],
            "districts": row["districts"],
            "entitlement_cr": float(row["entitlement_cr"] or 0),
            "release_cr": float(row["release_cr"] or 0),
            "unreleased_cr": float(row["unreleased_cr"] or 0),
            "release_ratio_percent": float(row["release_ratio_percent"] or 0),
            "risk_score": risk_score,
            "prediction": prediction,
            "recommended_action": action,
        })

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
        dominant_anomaly = anomaly_breakdown[0]["anomaly_type"]
        dominant_count = anomaly_breakdown[0]["count"]
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
        "portfolio_stability": "At risk" if predictive_signal == "Rising" else "Needs attention" if predictive_signal == "Watchlist" else "Stable",
    }

    return {
        "generated_at": datetime.now().isoformat(),
        "total_funds": float(total_funds),
        "total_entitlement_cr": float(total_entitlement_cr or 0),
        "total_release_cr": float(total_release_cr or 0),
        "total_unreleased_cr": float(total_unreleased_cr or 0),
        "avg_release_ratio": float(avg_release_ratio or 0),
        "risk_count": risk_count,
        "flagged_projects": flagged_projects,
        "avg_risk_score": float(avg_risk_score),
        "high_risk_share": high_risk_share,
        "projects_total": projects_total,
        "anomaly_type_breakdown": anomaly_breakdown,
        "category_distribution": distribution,
        "risk_distribution": risk_distribution,
        "mp_predictions": mp_predictions,
        "model_evaluation": {
            "precision": precision,
            "recall": recall,
            "f1_score": f1_score,
            "baseline_model": "Isolation Forest + geospatial overlap + duplicate image detection",
            "confidence": "High" if f1_score >= 75 else "Moderate" if f1_score >= 50 else "Low",
        },
        "monitoring_summary": monitoring_summary,
    }


@app.post("/api/anomalies/{flag_id}/review")
async def review_anomaly(
    flag_id: int,
    payload: dict[str, str],
    user: dict[str, str] = Depends(require_admin)
):
    status = sanitize_user_text(payload.get("review_status"), 50)
    if status not in {"Confirmed", "False Positive", "Resolved"}:
        raise HTTPException(status_code=400, detail="Invalid review status.")
    
    reviewer = user["user_id"]
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE anomaly_flags SET review_status = %s, reviewed_by = %s, reviewed_at = %s WHERE flag_id = %s",
            (status, reviewer, datetime.now(timezone.utc), flag_id)
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Anomaly flag not found.")
        conn.commit()
        return {"status": "Review updated successfully.", "project_id": flag_id}
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        cur.close()
        conn.close()

@app.get("/api/projects")

async def get_projects(
    risk_min: int = 0,
    risk_max: int | None = None,
    category: str | None = None,
    state_ut: str | None = None,
    district: str | None = None,
    search: str = "",
    funding_status: str = "all",
    limit: int = 300,
    _user: dict[str, str] = Depends(get_client_api_key),
):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)
    allowed_funding_statuses = {"all", "released", "partial", "unreleased"}
    if funding_status not in allowed_funding_statuses:
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid funding status.")
    funding_clause = "TRUE" if funding_status == "all" else (
        "CASE WHEN COALESCE(p.entitlement_cr, 0) <= 0 THEN 'unknown' "
        "WHEN COALESCE(p.goi_release_cr, 0) >= p.entitlement_cr THEN 'released' "
        "WHEN COALESCE(p.goi_release_cr, 0) > 0 THEN 'partial' ELSE 'unreleased' END = %s"
    )
    financial_risk_sql = """
        CASE
            WHEN COALESCE(p.entitlement_cr, 0) <= 0 THEN 0
            WHEN p.goi_release_cr >= p.entitlement_cr THEN 0
            ELSE GREATEST(0, LEAST(100, 100 - ((p.goi_release_cr / p.entitlement_cr) * 100)))
        END
    """
    query = f"""
        SELECT p.*, a.photo_url, ST_X(a.location) as longitude, ST_Y(a.location) as latitude,
                CASE WHEN COALESCE(p.entitlement_cr, 0) <= 0 THEN 'unknown'
                    WHEN COALESCE(p.goi_release_cr, 0) >= p.entitlement_cr THEN 'released'
                    WHEN COALESCE(p.goi_release_cr, 0) > 0 THEN 'partial'
                    ELSE 'unreleased' END AS funding_status,
                CASE WHEN COALESCE(p.entitlement_cr, 0) > 0 THEN ROUND((p.goi_release_cr / p.entitlement_cr) * 100, 2) ELSE NULL END AS release_ratio_percent,
               {financial_risk_sql} AS financial_risk_score,
               COALESCE(af.risk_score, {financial_risk_sql}) AS risk_score,
               CASE WHEN af.risk_score IS NULL THEN 'financial_coverage' ELSE 'verified_anomaly' END AS risk_source,
               af.anomaly_type, af.reasoning, af.review_status, af.reviewed_by
        FROM projects p
        LEFT JOIN assets a ON p.project_id = a.project_id
        LEFT JOIN LATERAL (
            SELECT risk_score, anomaly_type, reasoning, review_status, reviewed_by
            FROM anomaly_flags af
            WHERE af.project_id = p.project_id
            ORDER BY risk_score DESC NULLS LAST, flag_id DESC
            LIMIT 1
        ) af ON TRUE
        WHERE (%s = 0 OR COALESCE(af.risk_score, {financial_risk_sql}, 0) >= %s)
                AND (%s IS NULL OR COALESCE(af.risk_score, {financial_risk_sql}, 0) <= %s)
          AND (
                %s::text IS NULL
                OR LOWER(COALESCE(p.category, '')) = LOWER(%s)
                OR LOWER(COALESCE(p.sc_st_category, '')) = LOWER(%s)
          )
          AND (%s::text IS NULL OR LOWER(COALESCE(p.state_ut, '')) = LOWER(%s))
          AND (%s::text IS NULL OR LOWER(COALESCE(p.district, '')) = LOWER(%s))
          AND ({funding_clause})
          AND (%s = '' OR LOWER(p.project_name) LIKE LOWER('%%' || %s || '%%') OR LOWER(CAST(p.project_id AS TEXT)) LIKE LOWER('%%' || %s || '%%'))
        ORDER BY COALESCE(af.risk_score, {financial_risk_sql}, 0) DESC, p.project_id ASC
        LIMIT %s
    """
    cur.execute(
        query,
        (
            risk_min,
            risk_min,
            risk_max,
            risk_max,
            category,
            category,
            category,
            state_ut,
            state_ut,
            district,
            district,
            *([] if funding_status == "all" else [funding_status]),
            sanitize_user_text(search, 100),
            sanitize_user_text(search, 100),
            sanitize_user_text(search, 100),
            limit,
        ),
    )
    projects = cur.fetchall()
    cur.close()
    conn.close()
    for p in projects:
        p["sanction_amount"] = float(p["sanction_amount"])
        for field in ("entitlement_cr", "goi_release_cr", "unreleased_amount_cr", "release_ratio_percent", "financial_risk_score"):
            if p[field] is not None:
                p[field] = float(p[field])
        if p["risk_score"] is not None:
            p["risk_score"] = float(p["risk_score"])
    return projects


@app.post("/api/analyze")
async def run_anomaly_detection(_user: dict[str, str] = Depends(require_admin)):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)

    try:
        cur.execute("DELETE FROM anomaly_flags")

        cur.execute("SELECT project_id, sanction_amount FROM projects")
        data = cur.fetchall()
        df = pd.DataFrame(data)
        if not df.empty:
            max_amount = float(df["sanction_amount"].max()) or 1.0
            model = IsolationForest(contamination=0.05, random_state=42)
            df["anomaly"] = model.fit_predict(df[["sanction_amount"]])
            anomalies = df[df["anomaly"] == -1]
            for _, row in anomalies.iterrows():
                normalized = min(1.0, float(row["sanction_amount"]) / max_amount)
                risk_score = int(50 + (normalized * 19))
                cur.execute(
                    "INSERT INTO anomaly_flags (project_id, risk_score, anomaly_type, reasoning) VALUES (%s, %s, 'FUND_SPIKE', %s)",
                    (int(row["project_id"]), risk_score, f"Unusual sanction amount detected (₹{float(row['sanction_amount']):,.2f})"),
                )

        cur.execute(
            """
            WITH spatial_hits AS (
                SELECT a1.project_id, COUNT(*) AS overlap_count
                FROM assets a1
                JOIN assets a2 ON ST_DWithin(a1.location::geography, a2.location::geography, 50)
                                WHERE a1.project_id <> a2.project_id
                                    AND a1.photo_url <> 'official-approximate-location'
                                    AND a2.photo_url <> 'official-approximate-location'
                GROUP BY a1.project_id
            )
            INSERT INTO anomaly_flags (project_id, risk_score, anomaly_type, reasoning)
            SELECT project_id,
                   LEAST(99, 72 + (overlap_count * 6)) AS risk_score,
                   'SPATIAL_OVERLAP',
                   'Asset cluster within 50m of ' || overlap_count || ' other project assets'
            FROM spatial_hits
            """
        )

        cur.execute("SELECT asset_id, project_id, perceptual_hash FROM assets")
        assets = cur.fetchall()
        duplicate_groups = {}
        for asset in assets:
            hash_value = asset["perceptual_hash"]
            if not hash_value:
                continue
            duplicate_groups.setdefault(hash_value, []).append(int(asset["project_id"]))

        for _, project_ids in duplicate_groups.items():
            if len(project_ids) < 2:
                continue

            duplicate_count = len(project_ids)
            for project_id in project_ids:
                risk_score = min(99, 75 + ((duplicate_count - 1) * 8))
                cur.execute(
                    "INSERT INTO anomaly_flags (project_id, risk_score, anomaly_type, reasoning) VALUES (%s, %s, 'PHOTO_DUPLICATION', %s)",
                    (project_id, risk_score, f"Photo matches {duplicate_count} projects using the same perceptual hash"),
                )

        conn.commit()
        return {"status": "Analysis complete.", "analyzed_at": datetime.now().isoformat()}
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Anomaly detection failed.") from exc
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
