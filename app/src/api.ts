const API_BASE_URL = import.meta.env.VITE_TRACE_API_URL ?? "http://127.0.0.1:8000";

type PersonalAdviceResponse = {
  advice: TraceDemoOutput;
  context: unknown;
};

export type PersonalVariables = Record<string, unknown>;

export type PersonalProfile = {
  id: string;
  label: string;
  variables: PersonalVariables;
  relevant_candidates?: string[];
  relevant_actions?: string[];
};

export type FactorSource = {
  label: string;
  url?: string | null;
  domain?: string | null;
  context_id?: string | null;
};

export type FactorNode = {
  id: string;
  label: string;
  level: number;
  parent?: string | null;
  query_id?: string | null;
  summary: string;
  metric_count: number;
  source_count: number;
  top_metrics: string[];
  sources: FactorSource[];
  raw_file?: string | null;
  provenance?: {
    source_origin?: string;
    raw_response?: string;
    status?: string;
  };
};

export type FactorResearch = {
  case: string;
  retrieved_at?: string;
  generated_from?: string;
  coverage_status: string;
  coverage_note?: string;
  rollups: {
    factor_count?: number;
    level_counts?: Record<string, number>;
    raw_response_count?: number;
    metric_line_count?: number;
    source_link_count?: number;
  };
  edges: Array<{ source: string; target: string }>;
  factors: FactorNode[];
};

export async function runPersonalAdvice(
  personalVariables: PersonalVariables | null = null
): Promise<TraceDemoOutput> {
  const response = await fetch(`${API_BASE_URL}/api/run-personal-advice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      case: "nl_housing",
      personal_variables: personalVariables ?? {},
      expert_notes: []
    })
  });

  if (!response.ok) {
    throw new Error(`Trace API returned ${response.status}`);
  }

  const payload = (await response.json()) as PersonalAdviceResponse;
  return payload.advice;
}

// ---- additional engine endpoints (PRD §15 API boundary) -------------------
// Engine output is open-shaped while protocol names settle.
export type EngineOutput = Record<string, any>;

export type RunRequest = {
  case?: string;
  personal_variables?: Record<string, unknown> | null;
  expert_notes?: unknown[] | null;
};

async function postRun(path: string, body: RunRequest = {}): Promise<EngineOutput> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case: "nl_housing", ...body })
  });
  if (!response.ok) {
    throw new Error(`Trace API ${path} returned ${response.status}`);
  }
  return (await response.json()) as EngineOutput;
}

/** Health + which input source the engine is using (fixtures vs run_demo). */
export async function health(): Promise<EngineOutput> {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  if (!response.ok) throw new Error(`Trace API health returned ${response.status}`);
  return (await response.json()) as EngineOutput;
}

export async function fetchFactorTree(): Promise<FactorResearch> {
  const response = await fetch(`${API_BASE_URL}/api/factor-tree`);
  if (!response.ok) throw new Error(`Trace API factor-tree returned ${response.status}`);
  return (await response.json()) as FactorResearch;
}

export async function fetchPersonalProfiles(): Promise<PersonalProfile[]> {
  const response = await fetch(`${API_BASE_URL}/api/personal-profiles`);
  if (!response.ok) throw new Error(`Trace API personal-profiles returned ${response.status}`);
  const payload = (await response.json()) as { profiles: PersonalProfile[] };
  return payload.profiles;
}

/** Default tier: distribution / coverage / credibility / candidate_status. */
export async function runDefaultTier(body?: RunRequest): Promise<EngineOutput> {
  return (await postRun("/api/run-default-tier", body)).default;
}

/** Structured tier: structurally_established | refuted | graph_not_settled + gap. */
export async function runStructuredTier(body?: RunRequest): Promise<EngineOutput> {
  return (await postRun("/api/run-structured-tier", body)).structured;
}

/** Bridge: integrated claim_resolution (keeps support and causal resolution apart). */
export async function runBridge(body?: RunRequest): Promise<EngineOutput> {
  return (await postRun("/api/run-bridge", body)).merged;
}

export const engineBaseUrl = API_BASE_URL;
