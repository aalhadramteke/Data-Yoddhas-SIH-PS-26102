"use client";
import React from 'react';
import { Filter } from 'lucide-react';
import { LocationOptions } from '@/types/domain';

interface FilterPanelProps {
  filters: {
    riskFilter: number;
    riskMax: number | null;
    stateFilter: string;
    districtFilter: string;
    fundingFilter: string;
    searchQuery: string;
  };
  setFilters: React.Dispatch<React.SetStateAction<any>>;
  locationOptions: LocationOptions;
}

export default function FilterPanel({ filters, setFilters, locationOptions }: FilterPanelProps) {
  const { riskFilter, riskMax, stateFilter, districtFilter, fundingFilter, searchQuery } = filters;
  const { states, districts } = locationOptions;

  const districtOptions = districts[stateFilter] || [];

  return (
    <div className="w-full lg:w-80 bg-white border-r border-slate-200 h-full flex flex-col shadow-sm">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2 text-slate-900">
          <Filter size={18} className="text-indigo-600" />
          <h3 className="font-bold uppercase tracking-wider text-xs">Intelligence Filters</h3>
        </div>
        <button
          onClick={() => setFilters({
            riskFilter: 0,
            riskMax: null,
            categoryFilter: 'all',
            fundingFilter: 'all',
            stateFilter: 'all',
            districtFilter: 'all',
            searchQuery: '',
          })}
          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition uppercase tracking-tight"
        >
          Reset
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-slate-400">Risk Level</label>
          <select
            value={riskMax === 49 ? 'normal' : String(riskFilter)}
            onChange={e => {
              if (e.target.value === 'normal') { setFilters(prev => ({ ...prev, riskFilter: 0, riskMax: 49 })); }
              else {
                const val = Number(e.target.value);
                setFilters(prev => ({ ...prev, riskFilter: val, riskMax: val === 50 ? 69 : null }));
              }
            }}
            className="w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:ring-2 ring-indigo-500/20"
          >
            <option value="0">All Levels</option>
            <option value="normal">Normal (&lt;50%)</option>
            <option value="50">Moderate (50-69%)</option>
            <option value="70">High (70%+)</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-slate-400">State</label>
          <select
            value={stateFilter}
            onChange={e => setFilters(prev => ({ ...prev, stateFilter: e.target.value, districtFilter: 'all' }))}
            className="w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:ring-2 ring-indigo-500/20"
          >
            <option value="all">All States</option>
            {states.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-slate-400">District</label>
          <select
            value={districtFilter}
            onChange={e => setFilters(prev => ({ ...prev, districtFilter: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:ring-2 ring-indigo-500/20"
          >
            <option value="all">All Districts</option>
            {districtOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-slate-400">Funds Status</label>
          <select
            value={fundingFilter}
            onChange={e => setFilters(prev => ({ ...prev, fundingFilter: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:ring-2 ring-indigo-500/20"
          >
            <option value="all">All Statuses</option>
            <option value="released">Released</option>
            <option value="partial">Partial</option>
            <option value="unreleased">Unreleased</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-slate-400">Project Search</label>
          <input
            value={searchQuery}
            onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            placeholder="ID or Name..."
            className="w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:ring-2 ring-indigo-500/20"
          />
        </div>
      </div>
    </div>
  );
}
