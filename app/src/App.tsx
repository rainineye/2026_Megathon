import { useEffect, useMemo, useState } from "react";
import {
  engineBaseUrl,
  fetchFactorTree,
  fetchPersonalProfiles,
  runPersonalAdvice,
  type FactorNode,
  type FactorResearch,
  type FactorSource,
  type PersonalProfile,
  type PersonalVariables
} from "./api";

type View = "brief" | "market" | "evidence" | "personal" | "action" | "audit";
type InspectorKind = "recommendation" | "market" | "evidence" | "personal" | "audit";

type CandidateSummary = {
  id: string;
  label: string;
  support: number;
  coverage: number;
  credibility: string;
  status: string;
};

type InspectorSelection = {
  kind: InspectorKind;
  title: string;
  meta: string;
  body: string;
  sources?: FactorSource[];
};

const navItems: Array<{ id: View; label: string; meta: string }> = [
  { id: "brief", label: "Decision Brief", meta: "answer" },
  { id: "market", label: "Market Map", meta: "forces" },
  { id: "evidence", label: "Evidence Board", meta: "claims" },
  { id: "personal", label: "Personal Fit", meta: "variables" },
  { id: "action", label: "Action Plan", meta: "next steps" },
  { id: "audit", label: "Audit", meta: "engine" }
];

const horizonOptions = ["3M", "6M", "12M", "24M"];

function percent(value = 0) {
  return `${Math.round(value * 100)}%`;
}

function supportWidth(value = 0) {
  return `${Math.max(4, Math.round(value * 100))}%`;
}

function eur(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "needs input";
  return new Intl.NumberFormat("en-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

function profileNumber(vars: PersonalVariables, key: string) {
  const value = vars[key];
  return typeof value === "number" ? value : undefined;
}

function normalizeProfileVariables(vars: PersonalVariables): PersonalVariables {
  return {
    ...vars,
    monthly_ceiling_eur: vars.monthly_ceiling_eur ?? vars.monthly_max_eur
  };
}

function factorCoverageWidth(factor: FactorNode) {
  const derived = factor.source_count * 5 + factor.metric_count;
  return `${Math.max(6, Math.min(100, derived))}%`;
}

function App() {
  const [view, setView] = useState<View>("brief");
  const [horizon, setHorizon] = useState("6M");
  const [output, setOutput] = useState<TraceDemoOutput | null>(null);
  const [factorResearch, setFactorResearch] = useState<FactorResearch | null>(null);
  const [profiles, setProfiles] = useState<PersonalProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [personalVariables, setPersonalVariables] = useState<PersonalVariables>({});
  const [selection, setSelection] = useState<InspectorSelection>({
    kind: "recommendation",
    title: "Recommendation logic",
    meta: "Decision Brief",
    body: "Click a scenario, force, claim, or personal variable to inspect why it matters."
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runEngine(vars = personalVariables) {
    setLoading(true);
    setError(null);
    try {
      const result = await runPersonalAdvice(vars);
      setOutput(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);
      setError(null);
      let vars: PersonalVariables = {};

      try {
        const [profileResult, factorResult] = await Promise.allSettled([
          fetchPersonalProfiles(),
          fetchFactorTree()
        ]);

        if (cancelled) return;

        if (factorResult.status === "fulfilled") {
          setFactorResearch(factorResult.value);
        } else {
          setError(factorResult.reason instanceof Error ? factorResult.reason.message : String(factorResult.reason));
        }

        if (profileResult.status === "fulfilled") {
          setProfiles(profileResult.value);
          const first = profileResult.value[0];
          if (first) {
            vars = normalizeProfileVariables(first.variables);
            setPersonalVariables(vars);
            setActiveProfileId(first.id);
          }
        } else {
          setError(profileResult.reason instanceof Error ? profileResult.reason.message : String(profileResult.reason));
        }

        const result = await runPersonalAdvice(vars);
        if (!cancelled) setOutput(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const candidates = useMemo<CandidateSummary[]>(() => {
    if (!output) return [];
    return Object.entries(output.candidate_support)
      .map(([id, support]) => ({
        id,
        support: Number(support),
        label: output.labels[id] ?? id,
        coverage: Number(output.candidate_coverage[id] ?? 0),
        credibility: output.candidate_credibility[id] ?? "unknown",
        status: output.candidate_status[id] ?? "unknown"
      }))
      .sort((a, b) => b.support - a.support);
  }, [output]);

  const topCandidate = candidates[0];
  const freshness = output ? "fixture fresh" : loading ? "loading" : "offline";
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? null;
  const factorCount = factorResearch?.rollups.factor_count ?? 0;
  const sourceCount = factorResearch?.rollups.source_link_count ?? 0;

  function selectProfile(profile: PersonalProfile) {
    const vars = normalizeProfileVariables(profile.variables);
    setActiveProfileId(profile.id);
    setPersonalVariables(vars);
    runEngine(vars);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">T</span>
          <div>
            <strong>Trace Personal</strong>
            <span>Decision intelligence cockpit</span>
          </div>
        </div>

        <div className="case-card">
          <span className="eyebrow">Active case</span>
          <strong>Netherlands housing</strong>
          <p>Buy in 6 months, wait, or keep renting?</p>
        </div>

        <nav aria-label="Primary views">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => setView(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.meta}</small>
            </button>
          ))}
        </nav>

        <div className="snapshot-list">
          <span className="eyebrow">Saved scenarios</span>
          {(profiles.length ? profiles : [{ id: "loading", label: "Loading profiles", variables: {} }]).map(
            (profile) => (
              <button
                key={profile.id}
                className={profile.id === activeProfileId ? "active" : ""}
                onClick={() => selectProfile(profile)}
                disabled={profile.id === "loading"}
              >
                {profile.label}
              </button>
            )
          )}
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="question-block">
            <span className="eyebrow">Decision question</span>
            <h1>Should I buy an owner-occupied home in the Netherlands?</h1>
          </div>

          <div className="topbar-actions">
            <div className="segmented" aria-label="Time horizon">
              {horizonOptions.map((option) => (
                <button
                  key={option}
                  className={horizon === option ? "selected" : ""}
                  onClick={() => setHorizon(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <StatusPill label={freshness} tone={output ? "good" : "watch"} />
            <StatusPill label={output?.claim_resolution.state ?? "engine pending"} tone="watch" />
            <button className="primary-action" onClick={() => runEngine()} disabled={loading}>
              {loading ? "Running" : "Refresh"}
            </button>
          </div>
        </header>

        {error && (
          <div className="error">
            Trace API is unavailable at {engineBaseUrl}: {error}. Start the local API to populate
            engine values and Cala-backed factor research.
          </div>
        )}

        <section className="status-strip" aria-label="Cockpit summary">
          <MetricCard label="Recommended posture" value={output?.recommendation.posture ?? "Pending"} />
          <MetricCard label="Confidence" value={output?.recommendation.confidence ?? "Unknown"} />
          <MetricCard label="Top market state" value={topCandidate?.label ?? "Waiting for engine"} />
          <MetricCard
            label="Research coverage"
            value={factorCount ? `${factorCount} factors · ${sourceCount} links` : "--"}
          />
        </section>

        <section className="content-grid">
          <div className="main-panel">
            {view === "brief" && (
              <DecisionBrief output={output} candidates={candidates} onSelect={setSelection} />
            )}
            {view === "market" && <MarketMap factorResearch={factorResearch} onSelect={setSelection} />}
            {view === "evidence" && (
              <EvidenceBoard factorResearch={factorResearch} onSelect={setSelection} />
            )}
            {view === "personal" && (
              <PersonalFit
                output={output}
                profile={activeProfile}
                variables={personalVariables}
                onSelect={setSelection}
              />
            )}
            {view === "action" && <ActionPlan output={output} onSelect={setSelection} />}
            {view === "audit" && <Audit output={output} onSelect={setSelection} />}
          </div>
          <Inspector output={output} selection={selection} />
        </section>
      </main>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "good" | "watch" | "risk" }) {
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function DecisionBrief({
  output,
  candidates,
  onSelect
}: {
  output: TraceDemoOutput | null;
  candidates: CandidateSummary[];
  onSelect: (selection: InspectorSelection) => void;
}) {
  return (
    <div className="stack">
      <section className="brief-layout">
        <article className="recommendation-panel">
          <span className="eyebrow">Recommended posture</span>
          <h2>{output?.recommendation.posture ?? "Wait for deterministic engine output"}</h2>
          <p>
            Confidence is <strong>{output?.recommendation.confidence ?? "unknown"}</strong>. This
            should read as decision posture, not a price forecast.
          </p>
          <div className="reason-list">
            {(output?.recommendation.reasons ?? [
              "Evidence support, coverage, and credibility will populate after the API returns.",
              "The UI keeps causal resolution separate from scenario support.",
              "Personal variables change action fit, not market truth."
            ]).map((reason) => (
              <button
                key={reason}
                onClick={() =>
                  onSelect({
                    kind: "recommendation",
                    title: "Why this advice",
                    meta: "Evidence-backed reason",
                    body: reason
                  })
                }
              >
                {reason}
              </button>
            ))}
          </div>
        </article>

        <article className="impact-panel">
          <span className="eyebrow">Personal impact</span>
          <div className="impact-grid">
            <ImpactMetric
              label="Monthly buffer"
              value={eur(output?.personal_fit?.affordability_buffer?.eur_per_month)}
              detail={output?.personal_fit?.affordability_buffer?.status ?? "needs profile"}
              tone={output?.personal_fit?.affordability_buffer?.status === "negative" ? "risk" : "personal"}
              barValue={
                typeof output?.personal_fit?.affordability_buffer?.pct_of_ceiling === "number"
                  ? Math.max(
                      0,
                      Math.min(100, output.personal_fit.affordability_buffer.pct_of_ceiling)
                    )
                  : undefined
              }
            />
            <ImpactMetric
              label="Payment at quoted rate"
              value={eur(output?.personal_fit?.inputs?.monthly_payment_eur)}
              detail={
                output?.personal_fit?.inputs?.quoted_rate_pct
                  ? `${output.personal_fit.inputs.quoted_rate_pct}% user quote`
                  : "quote missing"
              }
              tone="watch"
            />
            <ImpactMetric
              label="+100bps exposure"
              value={`${eur(output?.personal_fit?.rate_exposure?.per_plus_100bps_eur)}/mo`}
              detail="standard annuity sensitivity"
              tone="risk"
            />
            <ImpactMetric
              label="Wait-cost range"
              value={`${eur(output?.personal_fit?.opportunity_cost_of_waiting?.low_eur)} to ${eur(
                output?.personal_fit?.opportunity_cost_of_waiting?.high_eur
              )}`}
              detail={`${output?.personal_fit?.opportunity_cost_of_waiting?.window_months ?? "--"} month window`}
              tone="personal"
            />
          </div>
        </article>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Scenario distribution</span>
            <h2>Relative support, coverage, and credibility stay separate</h2>
          </div>
        </div>
        <div className="candidate-list">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              className="candidate-row"
              onClick={() =>
                onSelect({
                  kind: "market",
                  title: candidate.label,
                  meta: `${candidate.status} · ${candidate.credibility}`,
                  body: `Relative support ${percent(candidate.support)} with ${percent(
                    candidate.coverage
                  )} absolute evidence coverage.`
                })
              }
            >
              <div>
                <strong>{candidate.label}</strong>
                <span>
                  {candidate.status} · credibility {candidate.credibility}
                </span>
              </div>
              <div className="bar-wrap">
                <span className="bar support" style={{ width: supportWidth(candidate.support) }} />
              </div>
              <strong>{percent(candidate.support)}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="split">
        <Watchlist title="Trigger watchlist" items={output?.recommendation.triggers ?? []} />
        <Watchlist title="What would change the answer" items={["Mortgage rate threshold breaks monthly ceiling", "Target-region inventory rises without faster absorption", "Expert resolves disputed investor-selloff assumption"]} />
      </section>
    </div>
  );
}

function ImpactMetric({
  label,
  value,
  detail,
  tone,
  barValue
}: {
  label: string;
  value: string;
  detail: string;
  tone: "risk" | "watch" | "personal";
  barValue?: number;
}) {
  return (
    <div className="impact-meter">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <small>{detail}</small>
      {typeof barValue === "number" && (
        <div className="bar-wrap">
          <span className={`bar ${tone}`} style={{ width: `${Math.max(4, barValue)}%` }} />
        </div>
      )}
    </div>
  );
}

function Watchlist({ title, items }: { title: string; items: string[] }) {
  const displayItems = items.length
    ? items
    : ["Start local engine to populate deterministic trigger output."];
  return (
    <div>
      <h3>{title}</h3>
      <ul className="compact-list">
        {displayItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function MarketMap({
  factorResearch,
  onSelect
}: {
  factorResearch: FactorResearch | null;
  onSelect: (selection: InspectorSelection) => void;
}) {
  const factors = (factorResearch?.factors ?? []).filter((factor) => factor.level === 2);
  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Market Map</span>
          <h2>Cala-backed factors pulling the decision in different directions</h2>
        </div>
        <StatusPill label={factorResearch?.coverage_status ?? "loading research"} tone="watch" />
      </div>
      <div className="force-grid">
        {factors.map((factor) => (
          <button
            key={factor.id}
            className="force-tile"
            onClick={() =>
              onSelect({
                kind: "market",
                title: factor.label,
                meta: `L${factor.level} · ${factor.metric_count} metric lines · ${factor.source_count} sources`,
                body: factor.summary,
                sources: factor.sources
              })
            }
          >
            <div className="force-header">
              <strong>{factor.label}</strong>
              <span>L{factor.level}</span>
            </div>
            <p>{factor.summary}</p>
            <div className="force-meta">
              <small>{factor.metric_count} metric lines</small>
              <small>{factor.source_count} sources</small>
            </div>
            <div className="bar-wrap">
              <span className="bar support" style={{ width: factorCoverageWidth(factor) }} />
            </div>
          </button>
        ))}
      </div>
      {!factors.length && <p>Start the local API to load the factor tree fixture.</p>}
    </div>
  );
}

function EvidenceBoard({
  factorResearch,
  onSelect
}: {
  factorResearch: FactorResearch | null;
  onSelect: (selection: InspectorSelection) => void;
}) {
  const rows = (factorResearch?.factors ?? [])
    .flatMap((factor) =>
      factor.top_metrics.slice(0, 3).map((metric) => ({
        factor,
        metric,
        source: factor.sources[0]
      }))
    )
    .slice(0, 22);

  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Evidence Board</span>
          <h2>Metric lines, source links, and provenance</h2>
        </div>
        <div className="filter-row">
          <button className="selected">By factor</button>
          <button>By source</button>
          <button>Disputed</button>
        </div>
      </div>

      <div className="evidence-table">
        <div className="table-head">
          <span>Factor</span>
          <span>Current data line</span>
          <span>Level</span>
          <span>Primary source</span>
          <span>Links</span>
        </div>
        {rows.map((row) => (
          <button
            key={`${row.factor.id}-${row.metric}`}
            className="evidence-row"
            onClick={() =>
              onSelect({
                kind: "evidence",
                title: row.factor.label,
                meta: `L${row.factor.level} · ${row.factor.provenance?.source_origin ?? "source"} · ${row.factor.query_id}`,
                body: row.metric,
                sources: row.factor.sources
              })
            }
          >
            <span>{row.factor.label}</span>
            <strong>{row.metric}</strong>
            <span>L{row.factor.level}</span>
            <span>{row.source?.domain ?? row.source?.label ?? "Inspect raw"}</span>
            <span>{row.factor.source_count}</span>
          </button>
        ))}
      </div>
      {!rows.length && <p>Start the local API to load Cala-backed metric lines.</p>}
    </div>
  );
}

function PersonalFit({
  output,
  profile,
  variables,
  onSelect
}: {
  output: TraceDemoOutput | null;
  profile: PersonalProfile | null;
  variables: PersonalVariables;
  onSelect: (selection: InspectorSelection) => void;
}) {
  const fit = output?.personal_fit;
  const inputRows = [
    { label: "Profile", value: profile?.label ?? "No profile fixture" },
    { label: "Purchase budget", value: eur(profileNumber(variables, "budget_eur")) },
    { label: "Down payment", value: eur(profileNumber(variables, "down_payment_eur")) },
    { label: "Monthly ceiling", value: eur(profileNumber(variables, "monthly_ceiling_eur")) },
    {
      label: "Quoted mortgage rate",
      value:
        typeof variables.quoted_mortgage_rate_pct === "number"
          ? `${variables.quoted_mortgage_rate_pct}%`
          : "needs input"
    },
    {
      label: "Move deadline",
      value:
        typeof variables.move_deadline_months === "number"
          ? `${variables.move_deadline_months} months`
          : "not set"
    }
  ];

  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Personal Fit</span>
          <h2>Same market, different decision pressure</h2>
        </div>
      </div>

      <section className="personal-layout">
        <div className="form-grid">
          {inputRows.map((variable) => (
            <button
              key={variable.label}
              className="variable-field"
              onClick={() =>
                onSelect({
                  kind: "personal",
                  title: variable.label,
                  meta: "Profile fixture / user input",
                  body: `${variable.value} changes action fit and thresholds, but does not mutate public evidence.`
                })
              }
            >
              <span>{variable.label}</span>
              <strong>{variable.value}</strong>
            </button>
          ))}
        </div>

        <div className="scenario-compare">
          <h3>Deterministic fit</h3>
          {fit?.status === "needs_user_input" ? (
            <p>{fit.note}</p>
          ) : (
            <>
              <ComparisonRow
                label="Monthly payment"
                value={eur(fit?.inputs?.monthly_payment_eur)}
                tone="watch"
              />
              <ComparisonRow
                label="Affordability buffer"
                value={`${eur(fit?.affordability_buffer?.eur_per_month)}/mo`}
                tone={fit?.affordability_buffer?.status === "negative" ? "risk" : "good"}
              />
              <ComparisonRow
                label="+100bps rate shock"
                value={`${eur(fit?.rate_exposure?.per_plus_100bps_eur)}/mo`}
                tone="watch"
              />
              <ComparisonRow
                label="Wait-cost range"
                value={`${eur(fit?.opportunity_cost_of_waiting?.low_eur)} to ${eur(
                  fit?.opportunity_cost_of_waiting?.high_eur
                )}`}
                tone="personal"
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ComparisonRow({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "good" | "watch" | "personal" | "risk";
}) {
  return (
    <div className="comparison-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionPlan({
  output,
  onSelect
}: {
  output: TraceDemoOutput | null;
  onSelect: (selection: InspectorSelection) => void;
}) {
  const actions = output?.recommendation.actions ?? [
    "Start the local engine to populate deterministic action output."
  ];
  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Action Plan</span>
          <h2>Operational next steps for the current posture</h2>
        </div>
      </div>
      <section className="action-layout">
        <div>
          <h3>Do now</h3>
          <ol className="action-list">
            {actions.map((action) => (
              <li key={action}>
                <button
                  onClick={() =>
                    onSelect({
                      kind: "recommendation",
                      title: "Action rationale",
                      meta: "Generated from current scenario",
                      body: action
                    })
                  }
                >
                  {action}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3>Ask an expert</h3>
          <ul className="compact-list">
            <li>Which neighborhoods have hidden supply constraints?</li>
            <li>Is this price band more competitive than the national average?</li>
            <li>What transaction friction should be expected before bidding?</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function Audit({
  output,
  onSelect
}: {
  output: TraceDemoOutput | null;
  onSelect: (selection: InspectorSelection) => void;
}) {
  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Audit</span>
          <h2>Raw deterministic output</h2>
        </div>
        <button
          onClick={() =>
            onSelect({
              kind: "audit",
              title: "Audit mode",
              meta: "Distribution, coverage, credibility",
              body: "This view is intentionally raw so the demo can prove the recommendation is downstream of deterministic engine output."
            })
          }
        >
          Inspect audit rules
        </button>
      </div>
      <pre>{JSON.stringify(output, null, 2)}</pre>
    </div>
  );
}

function Inspector({
  output,
  selection
}: {
  output: TraceDemoOutput | null;
  selection: InspectorSelection;
}) {
  const resolution = output?.claim_resolution;
  return (
    <aside className="inspector">
      <span className="eyebrow">Right inspector</span>
      <h2>{selection.title}</h2>
      <p className="inspector-meta">{selection.meta}</p>
      <p>{selection.body}</p>

      {selection.sources?.length ? (
        <div className="inspector-section">
          <h3>Sources</h3>
          <ul className="source-list">
            {selection.sources.slice(0, 5).map((source) => (
              <li key={`${source.context_id ?? source.url ?? source.label}`}>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.domain ?? source.label}
                  </a>
                ) : (
                  <span>{source.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="inspector-section">
        <h3>Claim resolution</h3>
        <dl>
          <div>
            <dt>State</dt>
            <dd>{resolution?.state ?? "unknown"}</dd>
          </div>
          <div>
            <dt>Basis</dt>
            <dd>{resolution?.basis ?? "unknown"}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>{resolution?.scope ?? "not set"}</dd>
          </div>
        </dl>
      </div>

      <div className="inspector-section">
        <h3>Trace log</h3>
        <ul className="compact-list">
          {(output?.trace_log.length ? output.trace_log : ["No engine trace available yet."]).map(
            (line) => (
              <li key={line}>{line}</li>
            )
          )}
        </ul>
      </div>
    </aside>
  );
}

export default App;
