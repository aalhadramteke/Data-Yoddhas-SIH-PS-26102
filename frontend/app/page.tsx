"use client";
import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, CheckCircle2, DollarSign, Users, Clock, MapPin, SearchX, ShieldAlert } from 'lucide-react';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [mapProjects, setMapProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedProject, setSelectedProject] = useState(null);
  const [riskFilter, setRiskFilter] = useState(0);
  const [riskMax, setRiskMax] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(null);
  const projectsRequestId = useRef(0);

  const categoryOptions = ['all', 'Roads', 'Water', 'Education', 'Health', 'Community Center'];
  const stateOptions = ['all', 'Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'West Bengal', 'Gujarat', 'Bihar'];
  const districtMap = {
    all: ['all'],
    Delhi: ['all', 'New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
    Maharashtra: ['all', 'Mumbai', 'Pune', 'Nagpur', 'Nashik'],
    Karnataka: ['all', 'Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru'],
    'Tamil Nadu': ['all', 'Chennai', 'Coimbatore', 'Madurai', 'Salem'],
    'Uttar Pradesh': ['all', 'Lucknow', 'Kanpur', 'Varanasi', 'Agra'],
    'West Bengal': ['all', 'Kolkata', 'Durgapur', 'Asansol', 'Howrah'],
    Gujarat: ['all', 'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
    Bihar: ['all', 'Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur'],
  };
  const districtOptions = districtMap[stateFilter] || ['all'];
  const flaggedProjects = useMemo(
    () => projects.filter((p) => Number(p.risk_score || 0) > 70),
    [projects]
  );
  const normalProjects = useMemo(
    () => projects.filter((p) => Number(p.risk_score || 0) < 50),
    [projects]
  );
  const isNormalView = riskMax === 49;
  const isSpecificRiskView = riskFilter > 0;
  const categoryScopedProjects = useMemo(
    () => categoryFilter === 'all' ? projects : projects.filter((p) => p.category === categoryFilter),
    [projects, categoryFilter]
  );
  const categoryScopedFlaggedProjects = useMemo(
    () => categoryFilter === 'all' ? flaggedProjects : flaggedProjects.filter((p) => p.category === categoryFilter),
    [flaggedProjects, categoryFilter]
  );
  const categoryScopedNormalProjects = useMemo(
    () => categoryFilter === 'all' ? normalProjects : normalProjects.filter((p) => p.category === categoryFilter),
    [normalProjects, categoryFilter]
  );
  const panelProjects = isNormalView ? categoryScopedNormalProjects : isSpecificRiskView ? categoryScopedProjects : categoryScopedFlaggedProjects;
  const selectedLocationLabel = districtFilter !== 'all'
    ? `${districtFilter}, ${stateFilter}`
    : stateFilter !== 'all'
      ? stateFilter
      : 'all monitored locations';
  const riskLabel = isNormalView
    ? 'Normal'
    : riskFilter === 50
      ? 'Moderate (50-69%)'
      : riskFilter === 70
        ? 'High (70-84%)'
        : riskFilter === 85
          ? 'Critical (85%+)'
          : 'All risk levels';
  const activeFilterSummary = [selectedLocationLabel, categoryFilter === 'all' ? 'All categories' : categoryFilter, riskLabel].join(' / ');

  const fetchStats = async (
    currentRiskFilter = riskFilter,
    currentRiskMax = riskMax,
    currentCategory = categoryFilter,
    currentState = stateFilter,
    currentDistrict = districtFilter,
    currentSearch = searchQuery
  ) => {
    const API_URL = 'http://127.0.0.1:8000';
    const params = new URLSearchParams({
      risk_min: String(currentRiskFilter),
      ...(currentRiskMax !== null ? { risk_max: String(currentRiskMax) } : {}),
      ...(currentCategory !== 'all' ? { category: currentCategory } : {}),
      ...(currentState !== 'all' ? { state_ut: currentState } : {}),
      ...(currentDistrict !== 'all' ? { district: currentDistrict } : {}),
      ...(currentSearch ? { search: currentSearch } : {}),
    });
    const statsRes = await fetch(`${API_URL}/api/stats?${params.toString()}`);
    if (!statsRes.ok) throw new Error(`Status: ${statsRes.status}`);
    const statsData = await statsRes.json();
    setStats(statsData);
    setLastAnalyzedAt((current) => current || statsData.generated_at || null);
  };

  const fetchProjects = async (
    currentRiskFilter = riskFilter,
    currentRiskMax = riskMax,
    currentCategory = categoryFilter,
    currentState = stateFilter,
    currentDistrict = districtFilter,
    currentSearch = searchQuery
  ) => {
    const requestId = ++projectsRequestId.current;
    const API_URL = 'http://127.0.0.1:8000';
    const params = new URLSearchParams({
      risk_min: String(currentRiskFilter),
      ...(currentRiskMax !== null ? { risk_max: String(currentRiskMax) } : {}),
      ...(currentCategory !== 'all' ? { category: currentCategory } : {}),
      ...(currentState !== 'all' ? { state_ut: currentState } : {}),
      ...(currentDistrict !== 'all' ? { district: currentDistrict } : {}),
      ...(currentSearch ? { search: currentSearch } : {}),
      limit: '1500',
    });

    const projRes = await fetch(`${API_URL}/api/projects?${params.toString()}`);
    if (!projRes.ok) throw new Error(`Status: ${projRes.status}`);
    const projData = await projRes.json();
    if (requestId !== projectsRequestId.current) return;
    setMapProjects(projData);
    setProjects(Array.from(new Map(projData.map((project) => [project.project_id, project])).values()));
  };

  useEffect(() => {
    async function fetchData() {
      try {
        await fetchStats();
        await fetchProjects();

        setError(null);
        setLoading(false);
      } catch (err) {
        console.error("Attempt failed:", err);
        if (retryCount < 3) {
          setRetryCount(prev => prev + 1);
          setTimeout(fetchData, 2000); // Try again after 2 seconds
        } else {
          setError(err instanceof Error ? err.message : "Backend unreachable");
          setLoading(false);
        }
      }
    }
    fetchData();
  }, [retryCount]);

  useEffect(() => {
    if (!loading && !error) {
      fetchStats();
      fetchProjects();
    }
  }, [riskFilter, riskMax, categoryFilter, stateFilter, districtFilter, searchQuery]);

  useEffect(() => {
    if (!panelProjects.length) {
      setSelectedProject(null);
      return;
    }

    if (!selectedProject || !panelProjects.some((p) => p.project_id === selectedProject.project_id)) {
      setSelectedProject(panelProjects[0]);
    }
  }, [panelProjects, selectedProject]);

  if (loading) return (
    <div className="flex h-screen flex-col items-center justify-center text-xl gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      <p className="text-slate-600">Establishing Secure Link to AI Engine... <span className="text-sm font-mono">Attempt {retryCount + 1}/4</span></p>
    </div>
  );

  if (error) return (
    <div className="flex h-screen flex-col items-center justify-center text-center p-6">
      <ShieldAlert size={48} className="text-red-500 mb-4" />
      <h1 className="text-2xl font-bold text-slate-900 mb-2">System Offline</h1>
      <p className="text-slate-600 mb-6">The AI Backend is not responding. Please ensure 'python main.py' is running.</p>
      <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-6 py-2 rounded-lg">Retry Connection</button>
    </div>
  );

  return (
    <div className="dashboard-shell min-h-screen p-6 flex flex-col">
      <header className="dashboard-header mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 mb-2">Government of India | MPLAD oversight</p>
          <h1 className="text-3xl font-bold text-slate-900">MPLAD AI Monitoring Platform</h1>
          <p className="text-slate-500">State and district project-risk monitoring</p>
          <p className="text-xs text-slate-400 mt-2">Last AI analysis: {lastAnalyzedAt ? new Date(lastAnalyzedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Awaiting analysis'}</p>
        </div>
        <button 
          onClick={async () => {
            try {
              setAnalyzing(true);
              const analyzeRes = await fetch('http://127.0.0.1:8000/api/analyze', { method: 'POST' });
              if (!analyzeRes.ok) {
                throw new Error(`Analysis failed: ${analyzeRes.status}`);
              }
              const analysisData = await analyzeRes.json();
              setLastAnalyzedAt(analysisData.analyzed_at || new Date().toISOString());
              await fetchStats();
              await fetchProjects();
              setError(null);
            } catch (e) {
              console.error('Analysis failed:', e);
              setError(e instanceof Error ? e.message : 'Analysis failed');
            } finally {
              setAnalyzing(false);
            }
          }}
          className="primary-action text-white px-4 py-2 rounded-lg transition font-medium disabled:opacity-70"
          disabled={analyzing}
        >
          {analyzing ? 'Re-running risk detection...' : 'Re-run risk detection'}
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <StatCard icon={<DollarSign className="text-green-700" />} label="Total Sanctioned" value={`₹${stats?.total_funds?.toLocaleString() || '0'}`} detail={`${stats?.projects_total || 0} projects in current view`} />
        <StatCard icon={<ShieldAlert className="text-red-600" />} label="High Risk Cases" value={stats?.risk_count || 0} detail="Above 70% in current view" />
        <StatCard icon={<Users className="text-blue-600" />} label="Flagged Projects" value={stats?.flagged_projects || 0} detail="Priority cases under review" />
        <StatCard icon={<Clock className="text-amber-600" />} label="Avg Risk Score" value={`${(stats?.avg_risk_score || 0).toFixed(1)}%`} detail="Across the active filter" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-8">
        <div className="filter-card p-4 rounded-xl border shadow-sm">
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-2">Risk Threshold</label>
          <select
            value={riskMax === 49 ? 'normal' : String(riskFilter)}
            onChange={(e) => {
              if (e.target.value === 'normal') {
                setRiskFilter(0);
                setRiskMax(49);
              } else {
                const selectedRisk = Number(e.target.value);
                setRiskFilter(selectedRisk);
                setRiskMax(selectedRisk === 50 ? 69 : selectedRisk === 70 ? 84 : null);
              }
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="0">All risk levels</option>
            <option value="normal">Normal: fair and in progress</option>
            <option value="50">50–69% moderate</option>
            <option value="70">70–84% high risk</option>
            <option value="85">85%+ critical</option>
          </select>
        </div>

        <div className="filter-card p-4 rounded-xl border shadow-sm">
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-2">State / UT</label>
          <select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setDistrictFilter('all'); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            {stateOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All states / UTs' : option}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-card p-4 rounded-xl border shadow-sm">
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-2">District</label>
          <select value={districtOptions.includes(districtFilter) ? districtFilter : 'all'} onChange={(e) => setDistrictFilter(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            {districtOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All districts' : option}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-card p-4 rounded-xl border shadow-sm">
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-2">Category</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All categories' : option}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-card p-4 rounded-xl border shadow-sm">
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-2">Project Search</label>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project name or ID"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>
      </div>

      <div className="filter-summary mb-8">
        <MapPin size={16} />
        <span><strong>Current monitoring view:</strong> {activeFilterSummary}</span>
      </div>

      <section className="ai-priority-card mb-6 p-6 rounded-xl shadow-sm border">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="ai-priority-icon"><ShieldAlert size={20} /></div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-900">AI Assessment</h2>
                <span className="priority-badge">HIGH PRIORITY</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Primary intelligence for the current monitoring view</p>
            </div>
          </div>
          {selectedProject && <span className={`text-xs font-bold px-3 py-1 rounded-full ${isNormalView ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{isNormalView ? 'ON TRACK' : `RISK ${selectedProject.risk_score}%`}</span>}
        </div>
        {selectedProject ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm text-slate-700">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4"><span className="font-medium">Project</span><span className="font-semibold text-right">{selectedProject.project_name}</span></div>
              <div className="flex items-center justify-between gap-4"><span className="font-medium">Risk Score</span><span className={`font-bold ${isNormalView ? 'text-emerald-600' : 'text-red-600'}`}>{selectedProject.risk_score || 0}%</span></div>
              <div className="flex items-center justify-between gap-4"><span className="font-medium">Signal</span><span className="text-right">{selectedProject.anomaly_type || 'MULTI_FACTOR'}</span></div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4"><span className="font-medium">Category</span><span>{selectedProject.category}</span></div>
              <div className="flex items-center justify-between gap-4"><span className="font-medium">Location</span><span className="text-right">{selectedProject.district}, {selectedProject.state_ut}</span></div>
              <div className="flex items-center justify-between gap-4"><span className="font-medium">SLA Deadline</span><span>{selectedProject.sla_deadline || 'Not recorded'}</span></div>
            </div>
            <div className="ai-assessment-copy lg:col-span-3">
              <p className="ai-assessment-label">AI conclusion</p>
              <div className="ai-assessment-text">{isNormalView ? 'Project is within the normal risk range and is currently being worked on.' : getRiskExplanation(selectedProject)}</div>
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Select a project from the current view to inspect the AI assessment.</p>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[600px]">
        <div className="workspace-card xl:col-span-2 p-4 rounded-xl shadow-sm border overflow-hidden relative">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20} /> Geospatial Risk Heatmap
          </h2>
          <div className="h-[500px] w-full">
            <Suspense fallback={<div className="flex items-center justify-center h-full">Loading Map...</div>}>
              <MapView projects={mapProjects} stateFilter={stateFilter} districtFilter={districtFilter} />
            </Suspense>
            <div className="map-legend" aria-label="Risk level legend">
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#16805b' }} /> Normal</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#d97706' }} /> Moderate</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#dc2626' }} /> High</span>
              <span className="map-legend-item"><span className="map-legend-dot" style={{ background: '#991b1b' }} /> Critical</span>
            </div>
          </div>
        </div>
        <div className="workspace-card p-4 rounded-xl shadow-sm border overflow-y-auto">
          <h2 className="text-lg font-semibold mb-2">{isNormalView ? 'Normal Project Updates' : 'High Risk Cases'}</h2>
          <div className={`mb-4 flex items-start gap-2 rounded-lg border p-3 text-xs ${isNormalView ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            {isNormalView ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <MapPin size={16} className="mt-0.5 shrink-0 text-slate-500" />}
            <span>
              {isNormalView
                ? `${normalProjects.length} fair project${normalProjects.length === 1 ? '' : 's'} currently being worked on in ${selectedLocationLabel}.`
                : isSpecificRiskView
                  ? `Showing only ${riskFilter}% risk-band projects for ${selectedLocationLabel}.`
                  : `Showing high-risk cases for ${selectedLocationLabel}.`}
            </span>
          </div>
          <div className="space-y-4">
            {panelProjects.map((p) => (
              <div
                key={p.project_id}
                onClick={() => setSelectedProject(p)}
                className={`p-3 border-l-4 rounded-r-lg cursor-pointer transition ${isNormalView ? (selectedProject?.project_id === p.project_id ? 'border-emerald-600 bg-emerald-100' : 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100') : (selectedProject?.project_id === p.project_id ? 'border-red-600 bg-red-100' : 'border-red-500 bg-red-50 hover:bg-red-100')}`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm">{p.project_name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isNormalView ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>
                    {isNormalView ? 'ON TRACK' : `RISK ${p.risk_score}%`}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{isNormalView ? 'Fair progress recorded; project is being worked on.' : p.reasoning}</p>
              </div>
            ))}
            {panelProjects.length === 0 && (
              <div className="empty-state text-slate-400">
                <SearchX size={30} className="text-slate-300" />
                <p>{isNormalView ? `No normal projects found in ${selectedLocationLabel}.` : isSpecificRiskView ? `No projects found in the ${riskFilter}% risk band for ${selectedLocationLabel}.` : `No high-risk cases found in ${selectedLocationLabel}.`}</p>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}

function getRiskExplanation(project) {
  const riskScore = Number(project.risk_score || 0);
  const location = `${project.district || 'the selected district'}, ${project.state_ut || 'the selected state / UT'}`;
  const signalExplanations = {
    FUND_SPIKE: {
      finding: 'The sanctioned amount is unusually high compared with similar projects in the monitored portfolio.',
      action: 'Review the estimate, approval trail, and expenditure documents before the next disbursement.',
    },
    SPATIAL_OVERLAP: {
      finding: 'Project assets are geographically clustered within the configured proximity threshold of another project.',
      action: 'Verify the worksite coordinates, physical progress, and whether the nearby projects represent separate sanctioned works.',
    },
    PHOTO_DUPLICATION: {
      finding: 'The submitted project image matches evidence associated with another project.',
      action: 'Request fresh site photographs and confirm the image date, location, and beneficiary work before approval.',
    },
  };
  const signal = signalExplanations[project.anomaly_type] || {
    finding: 'The model combined multiple project signals and assigned an elevated risk classification.',
    action: 'Review the project record, supporting documents, and latest field evidence.',
  };
  const recordedReason = project.reasoning ? ` Recorded evidence: ${project.reasoning}` : '';
  const interpretation = riskScore >= 85
    ? 'The score places this project in the critical band and warrants immediate review.'
    : riskScore >= 70
      ? 'The score places this project in the high-risk band and warrants priority review.'
      : 'The score supports routine monitoring with no immediate escalation.';

  return (
    <div className="space-y-2">
      <div><strong>Assessment:</strong> {riskScore}% risk for {project.category || 'the selected category'} work in {location}.</div>
      <div><strong>Finding:</strong> {signal.finding}{recordedReason}</div>
      <div><strong>Decision:</strong> {interpretation}</div>
      <div><strong>Recommended action:</strong> {signal.action}</div>
    </div>
  );
}

function StatCard({ icon, label, value, detail }) {
  return (
    <div className="stat-card p-6 rounded-xl shadow-sm border flex items-center gap-4">
      <div className="p-3 bg-slate-50 rounded-lg">{icon}</div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-[11px] text-slate-400 mt-1">{detail}</p>
      </div>
    </div>
  );
}
