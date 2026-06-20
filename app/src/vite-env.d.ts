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
};

interface Window {
  trace?: {
    runDemo: () => Promise<TraceDemoOutput>;
  };
}
