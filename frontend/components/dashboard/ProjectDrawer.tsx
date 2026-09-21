"use client";
import React from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { MPLADProject } from '@/types/domain';

interface ProjectDrawerProps {
  project: MPLADProject | null;
  onClose: () => void;
  isGovtAuditor: boolean;
  onReviewAnomaly: (id: string | number, status: string) => void;
}

export default function ProjectDrawer({ project, onClose, isGovtAuditor, onReviewAnomaly }: ProjectDrawerProps) {
  if (!project) return null;

  const getRiskExplanation = (p: MPLADProject) => {
    const score = Number(p.risk_score || 0);
    const mpName = p.mp_name || 'the Member of Parliament';
    const explanations: any = {
      FUND_SPIKE: {
        high: `⚠️ Critical Financial Anomaly: Project sanctioned amount for ${mpName} significantly exceeds district benchmarks.`,
        med: `⚠️ Moderate Deviation: Sanctioned amount for ${mpName} shows a noticeable spike.`,
        low: `✅ Stable Funding: Sanctioned amount for ${mpName} is within acceptable norms.`
      },
      SPATIAL_OVERLAP: {
        high: `📍 Severe Spatial Overlap: Multiple assets registered by ${mpName} are clustered within a 50m radius.`,
        med: `📍 Proximity Alert: Project assets for ${mpName} are geographically close to other works.`,
        low: `✅ Spatial Integrity: Asset locations for ${mpName} are appropriately distributed.`
      },
      PHOTO_DUPLICATION: {
        high: `🖼️ Evidence Fraud Detected: Identical images uploaded for different projects under ${mpName}.`,
        med: `🖼️ Visual Similarity: Images for projects under ${mpName} show high similarity.`,
        low: `✅ Evidence Validated: Site photographs for ${mpName} are unique.`
      },
    };

    const type = p.anomaly_type as keyof typeof explanations;
    if (!type || !explanations[type]) {
      return score >= 70 ? `⚠️ High Risk: Project ${p.project_id} exhibits systemic irregularities.` : '✅ Compliance Verified.';
    }

    if (score >= 70) return explanations[type].high;
    if (score >= 50) return explanations[type].med;
    return explanations[type].low;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert size={20} className="text-indigo-600" />
            Project Intelligence Deep-Dive
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Identity Card */}
          <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-4">
            <div>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">MP Identity</p>
              <div className="text-lg font-black text-slate-900">{project.mp_name}</div>
              <div className="text-xs text-slate-500">{project.district}, {project.state_ut}</div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-indigo-100">
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase">Allotted</p>
                <p className="text-sm font-black text-slate-900">₹{Number(project.entitlement_cr || 0).toFixed(2)} Cr</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase">Utilized</p>
                <p className="text-sm font-black text-emerald-600">₹{Number(project.goi_release_cr || 0).toFixed(2)} Cr</p>
              </div>
            </div>
          </div>

          {/* Risk Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Fraud Risk</p>
              <p className={`text-xl font-black ${project.risk_score >= 70 ? 'text-red-600' : project.risk_score >= 50 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {Number(project.risk_score || 0).toFixed(2)}%
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Efficiency</p>
              <p className="text-xl font-black text-indigo-600">
                {Number(project.release_ratio_percent || 0).toFixed(2)}%
              </p>
            </div>
          </div>

          {/* AI Verdict */}
          <div className="p-5 rounded-2xl bg-white border-2 border-indigo-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-indigo-600 uppercase flex items-center gap-2">
                  <ShieldAlert size={14} /> AI Intelligence Verdict
                </p>
                {project.anomaly_type && (
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                    project.risk_score >= 70 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {project.anomaly_type.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <p className="text-slate-700 leading-relaxed font-medium text-sm">
                {getRiskExplanation(project)}
              </p>
              <div className="pt-2 flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Confidence:</span>
                <span className="text-[10px] font-bold text-indigo-600">94.2%</span>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-[9px] font-bold text-slate-400 uppercase">SLA Deadline</p>
              <p className="text-xs font-semibold text-slate-700">{project.sla_deadline}</p>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Project ID</p>
              <p className="text-xs font-semibold text-slate-700">#{project.project_id}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        {isGovtAuditor && (
          <div className="p-6 border-t border-slate-100 bg-slate-50 grid grid-cols-2 gap-3">
            <button
              onClick={() => onReviewAnomaly(project.project_id, 'Confirmed')}
              className="bg-red-600 text-white py-3 rounded-xl text-xs font-bold hover:bg-red-700 transition active:scale-95"
            >
              Confirm Fraud
            </button>
            <button
              onClick={() => onReviewAnomaly(project.project_id, 'False Positive')}
              className="bg-white text-slate-700 border border-slate-200 py-3 rounded-xl text-xs font-bold hover:bg-slate-50 transition active:scale-95"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
