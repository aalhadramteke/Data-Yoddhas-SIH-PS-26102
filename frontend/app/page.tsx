"use client";
import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, DollarSign, Users, Clock, ShieldAlert } from 'lucide-react';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        // We use a very specific IP and port to ensure Windows doesn't route to IPv6
        const API_URL = 'http://127.0.0.1:8000';
        
        const statsRes = await fetch(`${API_URL}/api/stats`);
        if (!statsRes.ok) throw new Error(`Status: ${statsRes.status}`);
        const statsData = await statsRes.json();
        setStats(statsData);

        const projRes = await fetch(`${API_URL}/api/projects`);
        if (!projRes.ok) throw new Error(`Status: ${projRes.status}`);
        const projData = await projRes.json();
        setProjects(projData);

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
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">MPLAD AI Monitoring Platform</h1>
          <p className="text-slate-500">Enterprise Fraud Detection & Geospatial Analysis</p>
        </div>
        <button 
          onClick={async () => {
            try {
              await fetch('http://127.0.0.1:8000/api/analyze', { method: 'POST' });
              window.location.reload();
            } catch (e) {
              alert("Analysis failed: Backend not reachable");
            }
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-medium"
        >
          Run AI Analysis
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={<DollarSign className="text-green-600" />} label="Total Sanctioned" value={`₹${stats?.total_funds?.toLocaleString() || '0'}`} />
        <StatCard icon={<ShieldAlert className="text-red-600" />} label="High Risk Projects" value={stats?.risk_count || 0} />
        <StatCard icon={<Users className="text-blue-600" />} label="Quota Compliance" value="Checking..." />
        <StatCard icon={<Clock className="text-amber-600" />} label="SLA Breaches" value={`${projects.filter(p => p.risk_score > 70).length}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[600px]">
        <div className="xl:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20} /> Geospatial Risk Heatmap
          </h2>
          <div className="h-[500px] w-full">
            <Suspense fallback={<div className="flex items-center justify-center h-full">Loading Map...</div>}>
              <MapView projects={projects} />
            </Suspense>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">High Risk Cases</h2>
          <div className="space-y-4">
            {projects.filter(p => p.risk_score > 70).map(p => (
              <div key={p.project_id} className="p-3 border-l-4 border-red-500 bg-red-50 rounded-r-lg">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm">{p.project_name}</span>
                  <span className="text-[10px] bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold">RISK {p.risk_score}%</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{p.reasoning}</p>
              </div>
            ))}
            {projects.filter(p => p.risk_score > 70).length === 0 && (
              <p className="text-slate-400 text-center py-10">No anomalies detected. Run AI analysis to begin.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
      <div className="p-3 bg-slate-50 rounded-lg">{icon}</div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
