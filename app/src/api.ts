const API_BASE_URL = import.meta.env.VITE_TRACE_API_URL ?? "http://127.0.0.1:8000";

type PersonalAdviceResponse = {
  advice: TraceDemoOutput;
  context: unknown;
};

export async function runPersonalAdvice(): Promise<TraceDemoOutput> {
  const response = await fetch(`${API_BASE_URL}/api/run-personal-advice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      case: "nl_housing",
      personal_variables: {
        target_region: "Randstad flexible",
        budget_eur: 520000,
        down_payment_eur: 95000,
        monthly_ceiling_eur: 2450,
        move_urgency: "medium",
        risk_tolerance: "moderate"
      },
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
