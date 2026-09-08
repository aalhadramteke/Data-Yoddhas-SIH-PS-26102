-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    project_id SERIAL PRIMARY KEY,
    mp_id VARCHAR(50) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    sanction_amount DECIMAL(15, 2) NOT NULL,
    category VARCHAR(100),
    state_ut VARCHAR(100),
    district VARCHAR(100),
    sla_deadline DATE NOT NULL,
    sc_st_category VARCHAR(50), -- 'SC', 'ST', 'General'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Assets Table (Physical verifications)
CREATE TABLE IF NOT EXISTS assets (
    asset_id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
    location GEOMETRY(Point, 4326) NOT NULL,
    photo_url TEXT,
    perceptual_hash TEXT,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Anomaly Flags Table
CREATE TABLE IF NOT EXISTS anomaly_flags (
    flag_id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
    risk_score DECIMAL(5, 2),
    anomaly_type VARCHAR(100), -- 'FUND_SPLITTING', 'SPATIAL_OVERLAP', 'PHOTO_DUPLICATION', 'SLA_BREACH'
    reasoning TEXT,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX idx_assets_location ON assets USING GIST (location);
CREATE INDEX idx_projects_mp_id ON projects (mp_id);
CREATE INDEX idx_anomaly_project ON anomaly_flags (project_id);
CREATE INDEX idx_anomaly_project_risk ON anomaly_flags (project_id, risk_score DESC, flag_id DESC);
