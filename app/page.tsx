"use client";
import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, DollarSign, Users, Clock, MapPin, ShieldAlert, Filter, Download, Zap, Globe, Lock, UserCircle, CheckCircle, LayoutDashboard, Bell } from 'lucide-react';
import { User, ProjectStats, MPLADProject, LocationOptions } from '../types/domain';
import StatGrid from '../components/dashboard/StatGrid';
import FilterPanel from '../components/dashboard/FilterPanel';
import ProjectDrawer from '../components/dashboard/ProjectDrawer';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { StatCardSkeleton } from '../components/common/Skeleton';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

export default function Dashboard() {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [projects, setProjects] = useState<MPLADProject[]>([]);
  const [mapProjects, setMapProjects] = useState<MPLADProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<MPLADProject | null>(null);

  const [filters, setFilters] = useState({
    riskFilter: 0,
    riskMax: null as number | null,
    categoryFilter: 'all',
    fundingFilter: 'all',
    stateFilter: 'all',
    districtFilter: 'all',
    searchQuery: '',
  });

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loginRole, setLoginRole] = useState<'admin' | 'viewer'>('admin');
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin123' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [locationOptions, setLocationOptions] = useState<LocationOptions>({ states: [], districts: {}, categories: [] });
  const projectsRequestId = useRef(0);

  const stateOptions = ['all', ...locationOptions.states];
  const districtOptions = ['all', ...(locationOptions.districts[filters.stateFilter] || [])];

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesRisk = (filters.riskMax === 49) ? (Number(p.risk_score || 0) < 50) :
                          (filters.riskFilter === 0) ? true :
                          (filters.riskFilter === 50) ? (Number(p.risk_score || 0) >= 50 && Number(p.risk_score || 0) < 70) :
                          (Number(p.risk_score || 0) >= 70);
      const matchesState = filters.stateFilter === 'all' || p.state_ut === filters.stateFilter;
      const matchesDistrict = filters.districtFilter === 'all' || p.district === filters.districtFilter;
      const matchesFunding = filters.fundingFilter === 'all' || p.funding_status === filters.fundingFilter;
      const matchesSearch = filters.searchQuery === '' ||
                             p.project_name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
                             String(p.project_id).includes(filters.searchQuery);
      return matchesRisk && matchesState && matchesDistrict && matchesFunding && matchesSearch;
    });
  }, [projects, filters]);

  const flaggedProjects = useMemo(() => filteredProjects.filter((p) => Number(p.risk_score || 0) > 70), [filteredProjects]);

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
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    try {
      const response = await fetch(`${apiBase}/api/auth/login`, {
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
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const params = new URLSearchParams({
      risk_min: String(filters.riskFilter),
      ...(filters.riskMax !== null ? { risk_max: String(filters.riskMax) } : {}),
      ...(filters.categoryFilter !== 'all' ? { category: filters.categoryFilter } : {}),
      ...(filters.stateFilter !== 'all' ? { state_ut: filters.stateFilter } : {}),
      ...(filters.districtFilter !== 'all' ? { district: filters.districtFilter } : {}),
      ...(filters.searchQuery ? { search: filters.searchQuery } : {}),
      ...(filters.fundingFilter !== 'all' ? { funding_status: filters.fundingFilter } : {}),
    });
    const res = await fetch(`${apiBase}/api/stats?${params.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const data = await res.json();
    setStats(data);
  };

  const fetchProjects = async () => {
    const requestId = ++projectsRequestId.current;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const params = new URLSearchParams({
      risk_min: String(filters.riskFilter),
      ...(filters.riskMax !== null ? { risk_max: String(filters.riskMax) } : {}),
      ...(filters.categoryFilter !== 'all' ? { category: filters.categoryFilter } : {}),
      ...(filters.stateFilter !== 'all' ? { state_ut: filters.stateFilter } : {}),
      ...(filters.districtFilter !== 'all' ? { district: filters.districtFilter } : {}),
      ...(filters.searchQuery ? { search: filters.searchQuery } : {}),
      ...(filters.fundingFilter !== 'all' ? { funding_status: filters.fundingFilter } : {}),
      limit: '1500',
    });
    const res = await fetch(`${apiBase}/api/projects?${params.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const data = (await res.json()) as MPLADProject[];
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
  }, [filters]);

  const handleExportReport = () => window.open(`http://localhost:8000/api/export/anomalies`, '_blank');

  const handleReviewAnomaly = async (id: string | number, status: string) => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${apiBase}/api/projects/${id}/review`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: status }),
      });
      if (!res.ok) throw new Error('Review update failed');
      await fetchStats(); await fetchProjects();
    } catch (err) {
      console.error(err);
    }
  };

  if (!token) {
    const loginTheme = loginRole === 'admin' ? {
      shell: 'from-slate-900 via-indigo-950 to-slate-900',
      accent: 'text-indigo-400',
      btn: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200',
      ring: 'focus:ring-indigo-500/20',
      title: 'MPLAD Monitoring Intelligence Portal',
      subtitle: 'The sovereign oversight platform for detecting fund anomalies and physical project fraud across India.',
      feature: 'Sovereign Oversight',
    } : {
      shell: 'from-emerald-900 via-teal-900 to-emerald-900',
      accent: 'text-emerald-400',
      btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200',
      ring: 'focus:ring-emerald-500/20',
      title: 'MPLAD Public Transparency Portal',
      subtitle: 'The open accountability platform providing citizens direct access to project monitoring and fund usage.',
      feature: 'Public Accountability',
    };

    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center font-sans selection:bg-indigo-100">
        <div className="w-full max-w-6xl overflow-hidden rounded-[40px] border border-slate-200 bg-white shadow-2xl grid md:grid-cols-2 transition-all duration-500">
          <div className={`bg-gradient-to-br ${loginTheme.shell} p-12 text-white flex flex-col justify-center relative overflow-hidden transition-all duration-700`}>
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -ml-32 -mb-32" />
            <div className="relative z-10">
              <div className="mb-10 flex justify-center md:justify-start">
                <img src="/images/government-of-india.webp" alt="Govt of India" className="h-28 w-auto object-contain drop-shadow-2xl" />
              </div>
              <h1 className="text-5xl font-black mb-6 leading-tight tracking-tight">
                {loginTheme.title.split(' ').slice(0, 3).join(' ')} <br/>
                <span className={loginTheme.accent}>{loginTheme.title.split(' ').slice(3).join(' ')}</span>
              </h1>
              <p className="text-slate-300 text-lg mb-10 leading-relaxed max-w-md">
                {loginTheme.subtitle}
              </p>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center gap-3 text-sm text-slate-300 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <CheckCircle size={18} className={loginTheme.accent} /> AI-Driven Fraud Detection
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-300 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <CheckCircle size={18} className={loginTheme.accent} /> PostGIS Spatial Analysis
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-300 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <CheckCircle size={18} className={loginTheme.accent} /> {loginTheme.feature} Dashboard
                </div>
              </div>
            </div>
          </div>
          <div className="p-12 bg-white flex flex-col justify-center">
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-3xl font-black text-slate-900 mb-2">Secure Access</h2>
              <p className="text-slate-500">Enter your official credentials to continue</p>
            </div>

            <div className="mb-8 p-1 bg-slate-100 rounded-2xl flex relative w-full max-w-sm mx-auto md:mx-0">
              <div
                className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 ease-out ${loginTheme.btn} shadow-sm`}
                style={{ transform: loginRole === 'admin' ? 'translateX(0)' : 'translateX(100%)' }}
              />
              <button
                onClick={() => setLoginRole('admin')}
                className={`relative z-10 flex-1 py-2.5 text-xs font-bold transition-colors duration-300 ${loginRole === 'admin' ? 'text-white' : 'text-slate-500'}`}
              >
                Govt Auditor
              </button>
              <button
                onClick={() => setLoginRole('viewer')}
                className={`relative z-10 flex-1 py-2.5 text-xs font-bold transition-colors duration-300 ${loginRole === 'viewer' ? 'text-white' : 'text-slate-500'}`}
              >
                Citizen Access
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase ml-1">
                  <UserCircle size={14} /> Username
                </label>
                <input
                  value={loginForm.username}
                  onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                  className={`w-full rounded-2xl border border-slate-200 p-4 outline-none transition-all duration-200 ${loginTheme.ring}`}
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase ml-1">
                  <Lock size={14} /> Password
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                  className={`w-full rounded-2xl border border-slate-200 p-4 outline-none transition-all duration-200 ${loginTheme.ring}`}
                />
              </div>
              {authError && <div className="p-4 rounded-2xl bg-red-50 text-red-600 text-sm font-medium border border-red-100 animate-shake">{authError}</div>}
              <button disabled={authLoading} className={`w-full ${loginTheme.btn} text-white py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-lg ${loginTheme.btn.split(' ')[2]} disabled:opacity-50`}>
                {authLoading ? 'Authenticating...' : 'Authorized Access'}
              </button>
            </form>
            <div className="mt-10 text-center">
              <p className="text-xs text-slate-400 font-medium">Authorized Access Only. All activities are monitored by MoSPI.</p>
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

      <div className="flex h-[calc(100vh-72px)] overflow-hidden">
        <FilterPanel filters={filters} setFilters={setFilters} locationOptions={locationOptions} />

        <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
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

          <StatGrid stats={stats} />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            <div className="xl:col-span-12 flex flex-col">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col h-full">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <MapPin size={16} className="text-indigo-600" />
                    Geospatial Risk Analysis
                  </h3>
                  <div className="flex items-center gap-3">
                     <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold uppercase">
                       <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Low
                     </span>
                     <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold uppercase">
                       <span className="w-2 h-2 rounded-full bg-amber-500"></span> Mid
                     </span>
                     <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold uppercase">
                       <span className="w-2 h-2 rounded-full bg-red-500"></span> High
                     </span>
                  </div>
                </div>
                <div className="flex-1 relative h-full w-full overflow-hidden">
                  <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400">Initializing Intelligence Map...</div>}>
                    <ErrorBoundary>
                      <MapView projects={mapProjects} stateFilter={filters.stateFilter} districtFilter={filters.districtFilter} onProjectSelect={setSelectedProject} />
                    </ErrorBoundary>
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <ProjectDrawer
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        isGovtAuditor={isGovtAuditor}
        onReviewAnomaly={(id, status) => handleReviewAnomaly(id, status)}
      />
    </div>
  );
}
