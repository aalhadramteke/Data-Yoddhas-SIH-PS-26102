"use client";
import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, CheckCircle2, DollarSign, Users, Clock, MapPin, SearchX, ShieldAlert, FileText, CheckCircle, Filter, Download, Zap, Globe, Lock, UserCircle, X, Info, ChevronRight, LayoutDashboard, Database, ShieldCheck, Bell } from 'lucide-react';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

function StatCard({ icon, label, value, detail, colorClass }: any) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-md p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
      <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 transition-colors group-hover:bg-indigo-50/50" />
      <div className="relative z-10">
        <div className={`mb-4 inline-flex rounded-xl p-3 transition-colors ${colorClass}`}>
          {icon}
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</div>
        <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
        <div className="mt-2 text-xs text-slate-500 font-medium leading-relaxed">{detail}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [mapProjects, setMapProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [riskFilter, setRiskFilter] = useState(0);
  const [riskMax, setRiskMax] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [fundingFilter, setFundingFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin123' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [locationOptions, setLocationOptions] = useState<{
    states: string[];
    districts: Record<string, string[]>;
    categories: string[];
  }>({ states: [], districts: {}, categories: [] });
  const projectsRequestId = useRef(0);

  const categoryOptions = ['all', ...(locationOptions.categories.length ? locationOptions.categories : ['Official MP financial release'])];
  const stateOptions = ['all', ...locationOptions.states];
  const districtOptions = ['all', ...(locationOptions.districts[stateFilter] || [])];

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesRisk = (riskMax === 49) ? (Number(p.risk_score || 0) < 50) : 
                          (riskFilter === 0) ? true : 
                          (riskFilter === 50) ? (Number(p.risk_score || 0) >= 50 && Number(p.risk_score || 0) < 70) :
                          (Number(p.risk_score || 0) >= 70);
      const matchesState = stateFilter === 'all' || p.state_ut === stateFilter;
      const matchesDistrict = districtFilter === 'all' || p.district === districtFilter;
      const matchesFunding = fundingFilter === 'all' || p.funding_status === fundingFilter;
      const matchesSearch = searchQuery === '' || 
                             p.project_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             String(p.project_id).includes(searchQuery);
      return matchesRisk && matchesState && matchesDistrict && matchesFunding && matchesSearch;
    });
  }, [projects, riskFilter, riskMax, stateFilter, districtFilter, fundingFilter, searchQuery]);

  const flaggedProjects = useMemo(() => filteredProjects.filter((p) => Number(p.risk_score || 0) > 70), [filteredProjects]);

  const selectedLocationLabel = districtFilter !== 'all' ? `${districtFilter}, ${stateFilter}` : stateFilter !== 'all' ? stateFilter : 'all monitored locations';
  const riskLabel = riskMax === 49 ? 'Normal' : riskFilter === 50 ? 'Moderate (50-69%)' : riskFilter === 70 ? 'High risk (70%+)' : 'All risk levels';
  const fundingLabel = fundingFilter === 'released' ? 'Fully released' : fundingFilter === 'partial' ? 'Partially released' : fundingFilter === 'unreleased' ? 'Not released' : 'All release statuses';
  const activeFilterSummary = [selectedLocationLabel, fundingLabel, riskLabel].join(' / ');

  const hasActiveFilters = riskFilter !== 0 || riskMax !== null || stateFilter !== 'all' || districtFilter !== 'all' || fundingFilter !== 'all' || searchQuery !== '';

  const clearFilters = () => {
    setRiskFilter(0);
    setRiskMax(null);
    setStateFilter('all');
    setDistrictFilter('all');
    setFundingFilter('all');
    setSearchQuery('');
  };

  const isGovtAuditor = user?.role === 'admin';
  const isCitizen = user?.role === 'viewer';
  const activeRoleLabel = isGovtAuditor ? 'Government Auditor' : isCitizen ? 'Citizen Access' : 'Guest';

  const roleTheme = isGovtAuditor ? {
    shell: 'from-slate-900 via-indigo-950 to-slate-900',
    accent: 'text-indigo-700',
    accentBg: 'bg-indigo-600',
    accentSoft: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    primary: 'bg-indigo-600 hover:bg-indigo-700',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    border: 'border-indigo-200',
    button: 'bg-indigo-600 text-white',
    secondary: 'bg-white text-indigo-700 border-indigo-200',
  } : {
    shell: 'from-emerald-900 via-teal-900 to-emerald-900',
    accent: 'text-emerald-700',
    accentBg: 'bg-emerald-600',
    accentSoft: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    primary: 'bg-emerald-600 hover:bg-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    border: 'border-emerald-200',
    button: 'bg-emerald-600 text-white',
    secondary: 'bg-white text-emerald-700 border-emerald-200',
  };

  const getAuthHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Login failed');
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('mplad_token', data.access_token);
      localStorage.setItem('mplad_user', JSON.stringify(data.user));
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null); setUser(null);
    localStorage.removeItem('mplad_token'); localStorage.removeItem('mplad_user');
  };

  const fetchStats = async () => {
    const params = new URLSearchParams({
      risk_min: String(riskFilter),
      ...(riskMax !== null ? { risk_max: String(riskMax) } : {}),
      ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
      ...(stateFilter !== 'all' ? { state_ut: stateFilter } : {}),
      ...(districtFilter !== 'all' ? { district: districtFilter } : {}),
      ...(searchQuery ? { search: searchQuery } : {}),
      ...(fundingFilter !== 'all' ? { funding_status: fundingFilter } : {}),
    });
    const res = await fetch(`http://127.0.0.1:8000/api/stats?${params.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const data = await res.json();
    setStats(data);
  };

  const fetchProjects = async () => {
    const requestId = ++projectsRequestId.current;
    const params = new URLSearchParams({
      risk_min: String(riskFilter),
      ...(riskMax !== null ? { risk_max: String(riskMax) } : {}),
      ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
      ...(stateFilter !== 'all' ? { state_ut: stateFilter } : {}),
      ...(districtFilter !== 'all' ? { district: districtFilter } : {}),
      ...(searchQuery ? { search: searchQuery } : {}),
      ...(fundingFilter !== 'all' ? { funding_status: fundingFilter } : {}),
      limit: '1500',
    });
    const res = await fetch(`http://127.0.0.1:8000/api/projects?${params.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const data = await res.json();
    if (requestId !== projectsRequestId.current) return;
    setMapProjects(data);
    setProjects(Array.from(new Map(data.map((p: any) => [p.project_id, p])).values()));
  };

  useEffect(() => {
    async function init() {
      try {
        const locRes = await fetch('http://127.0.0.1:8000/api/locations', { headers: getAuthHeaders() });
        setLocationOptions(await locRes.json());
        await fetchStats();
        await fetchProjects();
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Backend unreachable");
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    fetchStats();
    fetchProjects();
  }, [riskFilter, riskMax, categoryFilter, fundingFilter, stateFilter, districtFilter, searchQuery]);

  const handleExportReport = () => window.open(`http://localhost:8000/api/export/anomalies`, '_blank');

  const handleReviewAnomaly = async (projectId: any, status: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/anomalies/${projectId}/review`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ review_status: status }),
      });
      if (res.ok) {
        setSelectedProject((prev: any) => prev ? { ...prev, review_status: status } : null);
        fetchProjects();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center font-sans">
        <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl grid md:grid-cols-2">
          <div className="bg-slate-900 p-12 text-white flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -ml-32 -mb-32" />
            <div className="relative z-10">
              <div className="mb-8 flex justify-center md:justify-start">
                <img src="/images/government-of-india.webp" alt="Govt of India" className="h-24 w-auto object-contain drop-shadow-2xl" />
              </div>
              <h1 className="text-4xl font-extrabold mb-6 leading-tight">MPLAD Monitoring <br/><span className="text-indigo-400">Intelligence Portal</span></h1>
              <p className="text-slate-400 text-lg mb-8 leading-relaxed">The sovereign oversight platform for detecting fund anomalies and physical project fraud across India.</p>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center gap-3 text-sm text-slate-300 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50"><CheckCircle2 size={18} className="text-indigo-400" /> AI-Driven Fraud Detection</div>
                <div className="flex items-center gap-3 text-sm text-slate-300 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50"><CheckCircle2 size={18} className="text-indigo-400" /> PostGIS Spatial Analysis</div>
                <div className="flex items-center gap-3 text-sm text-slate-300 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50"><CheckCircle2 size={18} className="text-indigo-400" /> Sovereign Oversight Dashboard</div>
              </div>
            </div>
          </div>
          <div className="p-12 bg-white flex flex-col justify-center">
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Secure Access</h2>
              <p className="text-slate-500">Enter your official credentials to continue</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase ml-1">
                  <UserCircle size={14} /> Username
                </label>
                <input value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 ring-indigo-500/20 transition" />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase ml-1">
                  <Lock size={14} /> Password
                </label>
                <input type="password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 ring-indigo-500/20 transition" />
              </div>
              {authError && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium border border-red-100">{authError}</div>}
              <button disabled={authLoading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 disabled:opacity-50">
                {authLoading ? 'Authenticating...' : 'Authorized Access'}
              </button>
            </form>
            <div className="mt-8 text-center">
              <p className="text-xs text-slate-400">Authorized Access Only. All activities are monitored by MoSPI.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500 font-medium space-y-4">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="animate-pulse">Establishing Secure Link to AI Engine...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      <header className={`bg-gradient-to-r ${roleTheme.shell} text-white px-6 py-4 flex items-center justify-between shadow-lg border-b border-white/10`}>
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-lg shadow-sm">
            <img src="/images/government-of-india.webp" alt="Govt of India" className="h-10 w-auto object-contain" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-extrabold leading-tight tracking-tight">MPLAD Intelligence <span className="text-indigo-300">Oversight</span></h1>
            <div className="flex items-center gap-2">
               <p className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold">Ministry of Statistics & Programme Implementation</p>
               <span className="h-1 w-1 rounded-full bg-slate-500" />
               <span className="text-[10px] text-slate-400 font-medium">Govt of India</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${roleTheme.accentSoft} border`}>
            {activeRoleLabel}
          </div>
          <button onClick={handleLogout} className="text-xs font-bold hover:text-indigo-300 transition flex items-center gap-1">
            Logout <CheckCircle size={12} />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
               <Globe size={16} />
               <span className="text-[10px] font-black uppercase tracking-tighter">National Monitoring Portal</span>
            </div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Portfolio Risk Dashboard</h2>
            <p className="text-slate-500 text-sm mt-1">Integrated Geospatial AI for fraud detection and fund oversight.</p>
          </div>
          <div className="flex items-center gap-3">
            {isGovtAuditor && (
              <button onClick={handleExportReport} className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm">
                <Download size={16} /> Export Audit Report
              </button>
            )}
            <button 
              onClick={async () => {
                setAnalyzing(true);
                try {
                  await fetch('http://127.0.0.1:8000/api/analyze', { method: 'POST', headers: getAuthHeaders() });
                  await fetchStats(); await fetchProjects();
                } finally { setAnalyzing(false); }
              }}
              disabled={analyzing}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition shadow-md ${roleTheme.primary} disabled:opacity-50`}
            >
              <Zap size={16} /> {analyzing ? 'Analyzing...' : 'Re-run AI Detection'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard icon={<DollarSign className="text-emerald-600" />} label="Total Sanctioned" value={`₹${stats?.total_funds?.toLocaleString() || '0'}`} detail={`${stats?.projects_total || 0} verified records`} colorClass="bg-emerald-50 text-emerald-600" />
          <StatCard icon={<ShieldAlert className="text-red-600" />} label="High Risk Alert" value={stats?.risk_count || 0} detail="Immediate action required" colorClass="bg-red-50 text-red-600" />
          <StatCard icon={<Users className="text-blue-600" />} label="AI Anomalies" value={stats?.flagged_projects || 0} detail="Deviation from statistical norm" colorClass="bg-blue-50 text-blue-600" />
          <StatCard icon={<Clock className="text-amber-600" />} label="Release Gap" value={`${(stats?.avg_release_ratio || 0).toFixed(1)}%`} detail={`₹${(stats?.total_unreleased_cr || 0).toLocaleString()} Cr pending`} colorClass="bg-amber-50 text-amber-600" />
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-slate-900">
              <Filter size={18} className="text-indigo-600" />
              <h3 className="font-bold uppercase tracking-wider text-xs">Advanced Intelligence Filters</h3>
              {hasActiveFilters && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
                  Active
                </span>
              )}
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-all"
              >
                <X size={12} />
                Clear Filters
              </button>
            )}
          </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-400">Risk Level</label>
                <select value={riskMax === 49 ? 'normal' : String(riskFilter)} onChange={e => {
                  if (e.target.value === 'normal') { setRiskFilter(0); setRiskMax(49); }
                  else { const val = Number(e.target.value); setRiskFilter(val); setRiskMax(val === 50 ? 69 : null); }
                }} className="w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:ring-2 ring-indigo-500/20">
                  <option value="0">All Levels</option>
                  <option value="normal">Normal (&lt;50%)</option>
                  <option value="50">Moderate (50-69%)</option>
                  <option value="70">High (70%+)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-400">State</label>
                <select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setDistrictFilter('all'); }} className="w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:ring-2 ring-indigo-500/20">
                  {stateOptions.map(o => <option key={o} value={o}>{o === 'all' ? 'All States' : o}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-400">District</label>
                <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:ring-2 ring-indigo-500/20">
                  {districtOptions.map(o => <option key={o} value={o}>{o === 'all' ? 'All Districts' : o}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-400">Funds</label>
                <select value={fundingFilter} onChange={e => setFundingFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:ring-2 ring-indigo-500/20">
                  <option value="all">All Statuses</option>
                  <option value="released">Released</option>
                  <option value="partial">Partial</option>
                  <option value="unreleased">Unreleased</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-400">Project Search</label>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="ID or Name..." className="w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:ring-2 ring-indigo-500/20" />
              </div>
            </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><MapPin size={18} className="text-indigo-600" /> Geospatial Risk Map</h3>
                <span className="text-[10px] font-bold uppercase text-slate-400">{activeFilterSummary}</span>
              </div>
              <div className="h-[600px] w-full relative">
                <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400">Initializing Map...</div>}>
                  <MapView projects={mapProjects} stateFilter={stateFilter} districtFilter={districtFilter} onProjectSelect={setSelectedProject} />
                </Suspense>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[657px]">

              {/* Header */}
              <div className="px-6 pt-5 pb-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-white/10">
                      <AlertTriangle size={16} className="text-red-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm leading-tight">Monitoring Queue</h3>
                      <p className="text-[10px] text-slate-400 font-medium">{filteredProjects.length} projects under surveillance</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                    flaggedProjects.length > 0 ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {flaggedProjects.length > 0 ? `${flaggedProjects.length} Critical` : 'All Clear'}
                  </span>
                </div>
                {/* Risk breakdown pills */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-lg font-black text-red-400">{filteredProjects.filter(p => Number(p.risk_score||0) >= 70).length}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">High Risk</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-lg font-black text-amber-400">{filteredProjects.filter(p => Number(p.risk_score||0) >= 50 && Number(p.risk_score||0) < 70).length}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Moderate</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-lg font-black text-emerald-400">{filteredProjects.filter(p => Number(p.risk_score||0) < 50).length}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Normal</div>
                  </div>
                </div>
              </div>

              {/* Project list */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {filteredProjects.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <ShieldCheck size={22} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-400">No projects match</p>
                    <p className="text-xs text-slate-300 mt-1">Try adjusting your filters</p>
                  </div>
                ) : (
                  filteredProjects.map((p) => {
                    const score = Number(p.risk_score || 0);
                    const isHigh = score >= 70;
                    const isMed = score >= 50 && score < 70;
                    const isSelected = selectedProject?.project_id === p.project_id;
                    const barColor = isHigh ? 'bg-red-500' : isMed ? 'bg-amber-400' : 'bg-emerald-500';
                    const badgeBg = isHigh ? 'bg-red-50 text-red-700 border border-red-100' : isMed ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                    return (
                      <div
                        key={p.project_id}
                        onClick={() => setSelectedProject(p)}
                        className={`group relative px-5 py-4 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
                            : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'
                        }`}
                      >
                        {/* Top row: name + score badge */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-sm font-bold text-slate-800 line-clamp-1 leading-snug flex-1">{p.project_name}</span>
                          <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black tabular-nums ${badgeBg}`}>
                            {p.risk_score ? `${Number(p.risk_score).toFixed(2)}%` : 'OK'}
                          </span>
                        </div>

                        {/* Risk bar */}
                        <div className="h-1 w-full bg-slate-100 rounded-full mb-2.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${Math.min(score, 100)}%` }}
                          />
                        </div>

                        {/* Reasoning */}
                        <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed mb-2.5">
                          {p.anomaly_type ? p.reasoning : 'Compliant with disbursement guidelines'}
                        </p>

                        {/* Bottom row: location + category + review status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                            <MapPin size={9} /> {p.district || p.state_ut || '—'}
                          </span>
                          {p.category && (
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-wide line-clamp-1 max-w-[120px]">
                              {p.category}
                            </span>
                          )}
                          {p.review_status && (
                            <span className={`ml-auto px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                              p.review_status === 'Confirmed' ? 'bg-red-100 text-red-700' :
                              p.review_status === 'False Positive' ? 'bg-slate-100 text-slate-500' :
                              'bg-indigo-100 text-indigo-600'
                            }`}>{p.review_status}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Analysis Insights - Full Width Panel */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Panel Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                <Zap size={16} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  AI Analysis Insights
                  {selectedProject && (
                    <span className="text-xs font-semibold text-slate-400">
                      — Project #{selectedProject.project_id}
                    </span>
                  )}
                </h3>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Deep-Dive Intelligence & Risk Forensics</p>
              </div>
            </div>
            {selectedProject && (
              <div className="flex items-center gap-2">
                {selectedProject.review_status && (
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    selectedProject.review_status === 'Confirmed' ? 'bg-red-100 text-red-700' :
                    selectedProject.review_status === 'False Positive' ? 'bg-slate-200 text-slate-600' :
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                    {selectedProject.review_status}
                  </span>
                )}
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                  title="Close insights"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {selectedProject ? (() => {
            const score = Number(selectedProject.risk_score || 0);
            const isHigh = score >= 70;
            const isMed = score >= 50 && score < 70;
            const riskColor = isHigh ? 'from-red-600 to-red-500' : isMed ? 'from-amber-500 to-amber-400' : 'from-emerald-500 to-emerald-400';
            const riskBg = isHigh ? 'bg-red-50 border-red-100' : isMed ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100';
            const riskText = isHigh ? 'text-red-700' : isMed ? 'text-amber-700' : 'text-emerald-700';
            const riskLabel = isHigh ? 'HIGH RISK' : isMed ? 'MODERATE' : 'NORMAL';
            return (
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Risk Score Hero & Auditor Actions */}
                  <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
                    <div className={`rounded-2xl border p-5 ${riskBg} flex-1 flex flex-col justify-between`}>
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">AI Risk Score</p>
                            <p className="text-4xl font-black tabular-nums text-slate-900 leading-none">
                              {score.toFixed(2)}<span className="text-xl font-bold text-slate-400">%</span>
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${riskBg} ${riskText}`}>
                              {riskLabel}
                            </span>
                            {selectedProject.anomaly_type && (
                              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wider">
                                {selectedProject.anomaly_type.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Animated risk bar */}
                        <div className="h-2.5 w-full bg-white/70 rounded-full overflow-hidden shadow-inner mt-4">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${riskColor} transition-all duration-700`}
                            style={{ width: `${Math.min(score, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>0% Safe</span><span>50% Moderate</span><span>100% Critical</span>
                        </div>
                      </div>

                      {/* Auditor Actions */}
                      {isGovtAuditor && (
                        <div className="mt-5 pt-4 border-t border-slate-200/60">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5">Auditor Actions</p>
                          <div className="flex gap-2.5">
                            <button
                              onClick={() => handleReviewAnomaly(selectedProject.project_id, 'Confirmed')}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-red-700 active:scale-95 transition-all shadow-sm shadow-red-200"
                            >
                              <ShieldAlert size={14} /> Confirm Fraud
                            </button>
                            <button
                              onClick={() => handleReviewAnomaly(selectedProject.project_id, 'False Positive')}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-white text-slate-700 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-100 active:scale-95 transition-all border border-slate-200 shadow-sm"
                            >
                              <CheckCircle size={14} /> Dismiss
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle Column: Project Intelligence Grid */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Project Name & Location</p>
                      <p className="text-sm font-bold text-slate-900 leading-snug">{selectedProject.project_name}</p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin size={11} className="text-indigo-500 shrink-0" />
                        {selectedProject.district}, {selectedProject.state_ut}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Category</p>
                        <p className="text-xs font-bold text-slate-800 truncate" title={selectedProject.category}>{selectedProject.category || '—'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">MP Name</p>
                        <p className="text-xs font-bold text-slate-800 truncate" title={selectedProject.mp_name}>{selectedProject.mp_name || '—'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">SLA Deadline</p>
                        <p className="text-xs font-bold text-slate-800 truncate">{selectedProject.sla_deadline || '—'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Fund Release</p>
                        <p className="text-xs font-bold text-slate-800 capitalize">{selectedProject.funding_status || '—'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Release Ratio</p>
                        <p className="text-xs font-bold text-slate-800">{selectedProject.release_ratio_percent?.toFixed(2) ?? '—'}%</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Sanctioned</p>
                        <p className="text-xs font-bold text-slate-800">₹{selectedProject.sanction_amount != null ? Number(selectedProject.sanction_amount).toFixed(2) : '—'} Cr</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Released</p>
                        <p className="text-xs font-bold text-emerald-700">₹{selectedProject.goi_release_cr != null ? Number(selectedProject.goi_release_cr).toFixed(2) : '—'} Cr</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Unreleased</p>
                        <p className="text-xs font-bold text-red-600">₹{selectedProject.unreleased_amount_cr != null ? Number(selectedProject.unreleased_amount_cr).toFixed(2) : '—'} Cr</p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: AI Verdict & Raw Reasoning */}
                  <div className="lg:col-span-3 space-y-3 flex flex-col">
                    <div className={`rounded-2xl border p-4 flex-1 ${selectedProject.anomaly_type ? 'bg-red-50/50 border-red-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 text-slate-600">
                        <ShieldAlert size={13} className={selectedProject.anomaly_type ? 'text-red-500' : 'text-emerald-500'} />
                        AI Verdict
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">
                        {selectedProject.anomaly_type
                          ? getRiskExplanation(selectedProject)
                          : '✅ Project follows standard disbursement patterns. No significant anomalies detected in funding or asset spatiality.'}
                      </p>
                    </div>

                    {selectedProject.reasoning && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Raw AI Reasoning</p>
                        <p className="text-xs text-slate-600 leading-relaxed italic">"{selectedProject.reasoning}"</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="py-14 flex flex-col items-center justify-center text-center px-8">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Database size={26} className="text-slate-400" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-sm">
                  <Zap size={12} />
                </div>
              </div>
              <p className="text-sm font-bold text-slate-700">No Project Selected for Deep Dive</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed">
                Click any project on the Geospatial Risk Map or select an item from the Monitoring Queue to view its full AI risk analysis, metadata, and audit tools.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function getRiskExplanation(project: any) {
  const explanations = {
    FUND_SPIKE: '⚠️ Outlier Detected: This project shows a sanction amount that significantly deviates from the local district average. This often indicates budget inflation or fund-splitting.',
    SPATIAL_OVERLAP: '📍 Spatial Anomaly: Multiple project assets detected within 50m. High probability of "Ghost Assets" where one site is registered as multiple projects.',
    PHOTO_DUPLICATION: '🖼️ Evidence Fraud: Perceptual hashing identified identical photos uploaded for different projects. This is a critical indicator of fraudulent reporting.',
  };
  return explanations[project.anomaly_type as keyof typeof explanations] || 'Risk flagged by AI for review.';
}

function GovLogoMark() {
  return (
    <svg width="60" height="60" viewBox="0 0 100 100" className="filter drop-shadow-sm">
      <circle cx="50" cy="50" r="45" fill="#0f172a" />
      <path d="M30 70 L50 30 L70 70 Z" fill="#fbbf24" />
      <circle cx="50" cy="45" r="5" fill="#fff" />
      <path d="M20 75 Q50 85 80 75" stroke="#fff" strokeWidth="3" fill="none" />
    </svg>
  );
}
