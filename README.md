# 🛡️ MPLAD AI Monitoring Platform
**Enterprise-Grade Anomaly, Fraud, and Inefficiency Detection System**

This platform is developed as a solution for **SIH Problem Statement 102**. It leverages Machine Learning and Geospatial Analysis to monitor the implementation of the Member of Parliament Local Area Development (MPLAD) scheme, ensuring that public funds are utilized efficiently and without fraud.

---

## 🚀 Core Features

### 1. 🤖 AI Anomaly Detection Engine
The system employs a multi-layered AI approach to detect irregularities:
- **Fund-Splitting Detection**: Uses an **Isolation Forest (Unsupervised ML)** model to identify "expenditure spikes" or unusual sanction amounts that deviate from the statistical norm.
- **Ghost Asset Detection**: Utilizes **PostGIS Spatial Proximity Analysis** (`ST_DWithin`) to flag multiple physical assets registered within a 50-meter radius, identifying "duplicate" or "ghost" projects.
- **Photo Fraud Detection**: Implements **Perceptual Hashing (pHash)** to detect recycled or duplicate progress photos uploaded for different project sites.

### 2. 🗺️ Geospatial Intelligence Dashboard
- **Interactive Risk Map**: A Leaflet-powered GIS map that color-codes projects:
    - 🟢 **Green**: Normal/Compliant.
    - 🔴 **Red**: High-Risk/Anomaly Flagged.
- **Real-time Metrics**: Tracking of total sanctioned funds, high-risk counts, and SLA breach alerts.
- **Statutory Quota Monitoring**: Tracking of SC/ST allocation targets (15% SC, 7.5% ST) to ensure social equity compliance.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS | High-performance, type-safe UI/UX |
| **Backend** | FastAPI (Python 3.13), Uvicorn | Asynchronous, high-throughput AI API |
| **Database** | PostgreSQL + PostGIS | Relational data with Spatial extension |
| **ML Engine** | Scikit-Learn (Isolation Forest), Pandas, GeoPandas | Anomaly detection and data manipulation |
| **Infrastructure**| Docker Compose | Containerized database deployment |

---

## 📦 Installation & Setup

### Prerequisites
- Docker Desktop
- Node.js v18+
- Python 3.13+

### Step 1: Database Setup
```powershell
cd C:\PS
docker-compose up -d
```
*This spins up the PostGIS container and initializes the spatial schema.*

### Step 2: Backend Configuration
```powershell
cd C:\PS\backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### Step 3: Seed Mock Data
```powershell
# Generate 500+ records with injected anomalies
python generate_mock_data.py
```

### Step 4: Run the System
**Start Backend:**
```powershell
python main.py
```
**Start Frontend:**
```powershell
cd C:\PS\frontend
npm install
npm run dev
```
**Access Dashboard:** `http://localhost:3000`

---

## 📈 Workflow for Evaluation
1. **Initial View**: Open the dashboard to see current sanctioned funds and a map of projects.
2. **Trigger AI**: Click **"Run AI, Analysis"**. The backend will execute the Isolation Forest and Spatial proximity checks.
3. **Analyze Results**: 
    - Observe the **Red markers** appearing on the map.
    - Click a marker to see the **AI Reasoning** (e.g., *"Duplicate asset photo hash matches Project #1042"*).
    - Review the **High-Risk Case** sidebar for a summarized audit trail.

