# MPLAD AI Monitoring Platform 🚀

Enterprise-grade AI system for detecting anomalies, fraud, and inefficiencies in the MPLAD Scheme implementation.

## 🏗 Architecture
- **Database**: PostgreSQL + PostGIS (Docker)
- **Backend**: FastAPI + Scikit-Learn (Isolation Forest) + Geopandas
- **Frontend**: Next.js 14 + Tailwind CSS + Leaflet GIS

## 🚀 Quick Start (PowerShell)

### 1. Database Setup
```powershell
# Spin up PostGIS container
docker-compose up -d
```
*Wait about 10 seconds for PostGIS to initialize the schema from `postgres_init/init.sql`.*

### 2. Backend Setup
```powershell
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Seed the database with mock anomalies
python generate_mock_data.py

# Start the server
python main.py
```

### 3. Frontend Setup
```powershell
# Open a new PowerShell window
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🛠 AI Engine Details
- **Fund-Splitting Detector**: Uses **Isolation Forest** to flag projects with sanction amounts that deviate statistically from the average.
- **Ghost Asset Detector**: Uses PostGIS `ST_DWithin` to flag physical assets within 50m of other project sites.
- **Photo Fraud Detector**: Implements **Perceptual Hashing** to identify duplicate images uploaded as "progress photos" for different projects.

## 📊 Access
- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **Database**: `localhost:5432` (mplad_admin / mplad_password)
