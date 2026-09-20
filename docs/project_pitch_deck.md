# MPLAD AI Monitoring Platform

## Project Submission and Viva Pitch

### 1. Opening Pitch

Public development funds are intended to create visible, measurable benefits for communities. However, monitoring hundreds of projects across different locations through manual reports makes it difficult to identify unusual spending, duplicate assets, or misleading progress evidence in time.

The **MPLAD AI Monitoring Platform** is an intelligent decision-support system that helps administrators discover high-risk public infrastructure projects earlier. It combines machine learning, geospatial analysis, and image-reuse detection in one dashboard so that limited audit resources can be focused on the projects that need attention most.

### 2. Problem

Traditional monitoring is largely manual and report-driven. This creates four practical challenges:

- Unusual sanction amounts can remain hidden in a large project portfolio.
- Multiple projects may be recorded at the same or nearly the same location.
- The same progress photograph may be reused for different projects.
- Decision-makers may receive data without a clear explanation of which cases deserve investigation.

These gaps can delay intervention, increase administrative effort, and reduce transparency in public fund utilization.

### 3. Proposed Solution

The platform receives official MPLADS financial records and, when available, project and asset evidence. It analyzes the available signals and assigns transparent monitoring risk information. The results are presented through an interactive monitoring dashboard with:

- portfolio-level funding and risk metrics;
- filters for three risk levels, release coverage, state, district, category, and search;
- a geospatial coverage map with normal, moderate, and high risk markers;
- an MP-level prediction outlook ranked by release gap; and
- explainable reasoning that distinguishes financial coverage signals from verified anomaly evidence.

The system is designed to support human review, not replace auditors. A risk flag is an early-warning signal that helps an authorized stakeholder decide where verification or field inspection is required.

### 4. How the Detection Works

#### Funding anomaly detection

An **Isolation Forest** model examines sanctioned amounts and identifies projects that behave differently from the normal funding pattern. These cases are treated as potential expenditure spikes and assigned a risk score.

#### Geospatial overlap detection

PostGIS spatial queries compare asset coordinates. Projects with assets within a 50-metre radius of assets belonging to other projects are flagged for possible duplication, overlap, or incorrect reporting.

#### Photo duplication & AI photo detection

Perceptual hashes are compared across uploaded asset photographs. Matching hashes indicate that a photograph may have been reused for multiple project records, creating a signal for further verification.

#### Explainable risk presentation

Each flagged case includes an anomaly type, risk score, and plain-language reasoning such as an unusual sanction amount, a nearby asset cluster, or a matching project photograph. This makes the output easier to understand during audit review and viva demonstration.

### 5. User Journey

1. The administrator opens the monitoring dashboard and reviews the current portfolio summary.
2. The administrator runs the AI analysis on the available project and asset data.
3. The system recalculates anomaly flags using funding, spatial, and photo evidence.
4. High-risk projects appear on the map and in the prioritized case panel.
5. The administrator filters or searches the portfolio and opens a case to inspect its risk explanation.
6. The flagged project can then be selected for document verification, field inspection, or formal audit action.

### 6. Key Innovation

The core contribution is the integration of **official financial coverage analysis, statistical anomaly detection, geospatial reasoning, and duplicate-image evidence** in a single explainable monitoring workflow. A conventional dashboard reports what has been recorded; this platform adds an analytical layer that helps identify what may require investigation and why.

### 7. Technology and Architecture

- **Frontend:** Next.js, TypeScript, Tailwind CSS, and Leaflet for the interactive dashboard and map.
- **Backend:** FastAPI and Python for API services and analysis orchestration.
- **Machine learning:** Scikit-learn Isolation Forest for unsupervised anomaly detection.
- **Database:** PostgreSQL with PostGIS for structured project data and spatial queries.
- **Evidence processing:** Perceptual-hash comparison for detecting reused images.
- **Deployment:** Docker Compose for the database environment and a decoupled frontend-backend architecture.

The prototype imports an official MP-level MPLADS financial dataset and preserves the generated-data fallback for demonstrating spatial and photo evidence workflows when project-level assets are available.

### 8. Expected Impact

The platform can help public-sector monitoring teams:

- reduce the time spent manually screening large project lists;
- prioritize high-risk cases using consistent signals;
- improve visibility into the geographic distribution of projects;
- strengthen evidence-based audit planning; and
- improve accountability in public infrastructure spending.

### 9. Scope and Limitations

This project is a prototype decision-support system. The current official dataset reports entitlement, GOI release, and unreleased balances at MP level; it does not prove expenditure, fraud, project completion, exact coordinates, or image reuse. Financial risk is therefore a transparent release-gap proxy, while ML, spatial, and photo findings require project-level evidence and domain validation before operational use.

### 10. Future Scope

Future versions can add real project datasets, authenticated role-based access, richer project detail views, downloadable audit reports, additional model comparisons, image-content analysis, temporal progress monitoring, and feedback loops that allow investigators to validate or dismiss alerts.

### 11. One-Minute Viva Answer

“Our project is the MPLAD AI Monitoring Platform, a decision-support system for detecting fraud and inefficiency indicators in public development projects. Manual monitoring becomes difficult when hundreds of projects involve different funding amounts, locations, and progress records. Our solution analyzes three signals: unusual sanctioned amounts using Isolation Forest, nearby or overlapping assets using PostGIS spatial queries, and reused progress photographs using perceptual hashing. The results are exposed through a Next.js dashboard with portfolio metrics, filters, an interactive risk map, prioritized high-risk cases, and explainable AI reasoning. The system does not declare a project fraudulent; it helps administrators prioritize cases for verification and audit. Our main contribution is combining machine learning, geospatial intelligence, and explainable evidence in one practical monitoring workflow.”

### 12. Suggested Closing Line

**The goal is simple: make public project monitoring faster, more evidence-based, and easier to act on.**