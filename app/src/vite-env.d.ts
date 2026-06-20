/// <reference types="vite/client" />

type TraceDemoOutput = {
  claim: string;
  candidate_support: Record<string, number>;
  candidate_coverage: Record<string, number>;
  candidate_credibility: Record<string, string>;
  candidate_status: Record<string, string>;
  claim_resolution: {
    state: string;
    basis: string;
    note?: string;
    scope?: string;
    gap_diagnostic?: unknown;
  };
  labels: Record<string, string>;
  trace_log: string[];
  recommendation: {
    posture: string;
    confidence: string;
    reasons: string[];
    actions: string[];
    triggers: string[];
  };
  personal_fit?: {
    status?: string;
    missing?: string[];
    note?: string;
    inputs?: {
      loan_eur?: number;
      monthly_payment_eur?: number;
      quoted_rate_pct?: number;
      term_years?: number;
    };
    affordability_buffer?: {
      eur_per_month?: number;
      pct_of_ceiling?: number;
      status?: string;
    };
    rate_exposure?: {
      per_plus_100bps_eur?: number;
      buffer_eaten_pct?: number | null;
    };
    policy_anchors?: Record<string, unknown>;
    opportunity_cost_of_waiting?: {
      weighted_eur?: number;
      low_eur?: number;
      high_eur?: number;
      window_months?: number;
      basis?: string;
    };
    fragility?: {
      rate_rise_bps_to_break_buffer?: number | null;
      note?: string;
    };
    flexibility?: {
      lever_buffer_gain_eur?: Record<string, number>;
      best_lever?: string | null;
    };
    provenance?: Record<string, unknown>;
  };
  personal_posture?: {
    posture: string;
    confidence: string;
    driven_by: string;
    capped_by: string;
  };
};

interface Window {
  trace?: {
    runDemo: () => Promise<TraceDemoOutput>;
  };
}
