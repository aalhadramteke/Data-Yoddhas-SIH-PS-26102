"use client";
import React from 'react';
import { DollarSign, ShieldAlert, Users, Clock } from 'lucide-react';
import { ProjectStats } from '../../types/domain';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
  colorClass: string;
}

function StatCard({ icon, label, value, detail, colorClass }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
      <div className="relative z-10">
        <div className={`mb-4 inline-flex rounded-xl p-3 transition-colors ${colorClass}`}>
          {icon}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</div>
        <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight break-words whitespace-normal leading-tight">
          {value}
        </div>
        <div className="mt-2 text-xs text-slate-500 font-medium leading-relaxed">{detail}</div>
      </div>
    </div>
  );
}

export default function StatGrid({ stats }: { stats: ProjectStats | null }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        icon={<DollarSign className="text-emerald-600" />}
        label="Total Sanctioned"
        value={`₹${stats.total_funds?.toLocaleString() || '0'}`}
        detail={`${stats.projects_total || 0} verified records`}
        colorClass="bg-emerald-50 text-emerald-600"
      />
      <StatCard
        icon={<ShieldAlert className="text-red-600" />}
        label="High Risk Alert"
        value={stats.risk_count || 0}
        detail="Immediate action required"
        colorClass="bg-red-50 text-red-600"
      />
      <StatCard
        icon={<Users className="text-blue-600" />}
        label="AI Anomalies"
        value={stats.flagged_projects || 0}
        detail="Deviation from statistical norm"
        colorClass="bg-blue-50 text-blue-600"
      />
      <StatCard
        icon={<Clock className="text-amber-600" />}
        label="Release Gap"
        value={`${(stats.avg_release_ratio || 0).toFixed(1)}%`}
        detail={`₹${(stats.total_unreleased_cr || 0).toLocaleString()} Cr pending`}
        colorClass="bg-amber-50 text-emerald-600"
      />
    </div>
  );
}
