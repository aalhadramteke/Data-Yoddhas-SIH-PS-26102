export type RiskLevel = 'Low' | 'Moderate' | 'High';

export interface User {
  username: string;
  role: 'admin' | 'viewer';
}

export interface LocationOptions {
  states: string[];
  districts: Record<string, string[]>;
  categories: string[];
}

export interface ProjectStats {
  total_funds: number;
  projects_total: number;
  risk_count: number;
  flagged_projects: number;
  avg_release_ratio: number;
  total_unreleased_cr: number;
}

export interface MPLADProject {
  project_id: string | number;
  project_name: string;
  state_ut: string;
  district: string;
  funding_status: 'released' | 'partial' | 'unreleased';
  risk_score: number;
  financial_risk_score: number;
  anomaly_type: string | null;
  reasoning: string;
  latitude: number;
  longitude: number;
  mp_name: string;
  mp_id: string;
  entitlement_cr: number;
  goi_release_cr: number;
  release_ratio_percent: number;
  sla_deadline: string;
  review_status: string | null;
}
