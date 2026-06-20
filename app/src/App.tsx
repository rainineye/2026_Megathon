import { useEffect, useMemo, useState } from "react";
import { engineBaseUrl, runPersonalAdvice } from "./api";

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

const marketForces = [
  {
    name: "Demand pressure",
    signal: "rising",
    confidence: "medium",
    density: 78,
    recency: "fresh",
    driver: "Income growth and competition in high-demand cities keep buyer pressure visible."
  },
  {
    name: "Supply tightness",
    signal: "tight",
    confidence: "high",
    density: 86,
    recency: "fresh",
    driver: "Shortage and construction bottlenecks remain the strongest structural story."
  },
  {
    name: "Financing conditions",
    signal: "mixed",
    confidence: "medium",
    density: 64,
    recency: "fresh",
    driver: "Rates soften some pressure but monthly affordability still gates this user."
  },
  {
    name: "Construction pipeline",
    signal: "blocked",
    confidence: "medium",
    density: 58,
    recency: "recent",
    driver: "Grid congestion and permit delays make future supply less reliable."
  },
  {
    name: "Policy pressure",
    signal: "mixed",
    confidence: "low",
    density: 46,
    recency: "review",
    driver: "Rental regulation may push investors to sell, but absorption is disputed."
  },
  {
    name: "Regional divergence",
    signal: "rising",
    confidence: "medium",
    density: 52,
    recency: "recent",
    driver: "National averages hide city and segment-level competition."
  }
];

const evidenceRows = [
  {
    source: "ABN AMRO",
    claim: "Price growth remains resilient despite global uncertainty.",
    type: "Fact",
    impact: "Supports buy selectively",
    confidence: "medium"
  },
  {
    source: "DNB / AFM",
    claim: "Mortgage debt and affordability sensitivity remain elevated.",
    type: "Signal",
    impact: "Supports budget caution",
    confidence: "medium"
  },
  {
    source: "OpenRaad / municipalities",
    claim: "Grid congestion can delay housing construction in major cities.",
    type: "Causal type",
    impact: "Supports shortage story",
    confidence: "medium"
  },
  {
    source: "Rabobank",
    claim: "Regional house price differences are widening.",
    type: "Claim",
    impact: "Supports region compare",
    confidence: "medium"
  },
  {
    source: "Expert note",
    claim: "Investor sell-off may be absorbed quickly by latent demand.",
    type: "Assumption",
    impact: "Disputes buying window",
    confidence: "low"
  }
];

const personalVariables = [
  { label: "Target region", value: "Randstad flexible", tone: "personal" },
  { label: "Purchase budget", value: "EUR 520k", tone: "personal" },
  { label: "Down payment", value: "EUR 95k", tone: "personal" },
  { label: "Monthly ceiling", value: "EUR 2,450", tone: "risk" },
  { label: "Move urgency", value: "Medium", tone: "watch" },
  { label: "Risk tolerance", value: "Moderate", tone: "personal" }
];

function percent(value = 0) {
  return `${Math.round(value * 100)}%`;
}

function supportWidth(value = 0) {
  return `${Math.max(4, Math.round(value * 100))}%`;
}

function App() {
  const [view, setView] = useState<View>("brief");
  const [horizon, setHorizon] = useState("6M");
  const [output, setOutput] = useState<TraceDemoOutput | null>(null);
  const [selection, setSelection] = useState<InspectorSelection>({
    kind: "recommendation",
    title: "Recommendation logic",
    meta: "Decision Brief",
    body: "Click a scenario, force, claim, or personal variable to inspect why it matters."
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runEngine() {
    setLoading(true);
    setError(null);
    try {
      const result = await runPersonalAdvice();
      setOutput(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runEngine();
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
          <button>Baseline renter</button>
          <button>Higher down payment</button>
          <button>Alternate city</button>
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
            <button className="primary-action" onClick={runEngine} disabled={loading}>
              {loading ? "Running" : "Refresh"}
            </button>
          </div>
        </header>

        {error && (
          <div className="error">
            Trace API is unavailable at {engineBaseUrl}. The wireframe still renders with static UI
            scaffolding; start the local API to populate engine values.
          </div>
        )}

        <section className="status-strip" aria-label="Cockpit summary">
          <MetricCard label="Recommended posture" value={output?.recommendation.posture ?? "Pending"} />
          <MetricCard label="Confidence" value={output?.recommendation.confidence ?? "Unknown"} />
          <MetricCard label="Top market state" value={topCandidate?.label ?? "Waiting for engine"} />
          <MetricCard label="Relative support" value={topCandidate ? percent(topCandidate.support) : "--"} />
        </section>

        <section className="content-grid">
          <div className="main-panel">
            {view === "brief" && (
              <DecisionBrief output={output} candidates={candidates} onSelect={setSelection} />
            )}
            {view === "market" && <MarketMap onSelect={setSelection} />}
            {view === "evidence" && <EvidenceBoard onSelect={setSelection} />}
            {view === "personal" && <PersonalFit onSelect={setSelection} />}
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
            <ImpactMeter label="Affordability pressure" value={72} tone="risk" />
            <ImpactMeter label="Budget resilience" value={54} tone="watch" />
            <ImpactMeter label="Timing risk" value={66} tone="watch" />
            <ImpactMeter label="Rate exposure" value={61} tone="personal" />
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

function ImpactMeter({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "risk" | "watch" | "personal";
}) {
  return (
    <div className="impact-meter">
      <div>
        <span>{label}</span>
        <strong>{value}/100</strong>
      </div>
      <div className="bar-wrap">
        <span className={`bar ${tone}`} style={{ width: `${value}%` }} />
      </div>
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

function MarketMap({ onSelect }: { onSelect: (selection: InspectorSelection) => void }) {
  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Market Map</span>
          <h2>Forces pulling the decision in different directions</h2>
        </div>
        <StatusPill label="expert overlay off" tone="watch" />
      </div>
      <div className="force-grid">
        {marketForces.map((force) => (
          <button
            key={force.name}
            className="force-tile"
            onClick={() =>
              onSelect({
                kind: "market",
                title: force.name,
                meta: `${force.signal} · ${force.confidence} confidence`,
                body: force.driver
              })
            }
          >
            <div className="force-header">
              <strong>{force.name}</strong>
              <span>{force.signal}</span>
            </div>
            <p>{force.driver}</p>
            <div className="force-meta">
              <small>{force.confidence} confidence</small>
              <small>{force.recency}</small>
            </div>
            <div className="bar-wrap">
              <span className="bar support" style={{ width: `${force.density}%` }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function EvidenceBoard({ onSelect }: { onSelect: (selection: InspectorSelection) => void }) {
  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Evidence Board</span>
          <h2>Claims, sources, dates, and decision impact</h2>
        </div>
        <div className="filter-row">
          <button className="selected">By factor</button>
          <button>By source</button>
          <button>Disputed</button>
        </div>
      </div>

      <div className="evidence-table">
        <div className="table-head">
          <span>Source</span>
          <span>Claim</span>
          <span>Type</span>
          <span>Impact</span>
          <span>Confidence</span>
        </div>
        {evidenceRows.map((row) => (
          <button
            key={`${row.source}-${row.claim}`}
            className="evidence-row"
            onClick={() =>
              onSelect({
                kind: "evidence",
                title: row.claim,
                meta: `${row.source} · ${row.type}`,
                body: `${row.impact}. Date and quote fields should remain explicit; unknown dates must stay labeled instead of inferred.`
              })
            }
          >
            <span>{row.source}</span>
            <strong>{row.claim}</strong>
            <span>{row.type}</span>
            <span>{row.impact}</span>
            <span>{row.confidence}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PersonalFit({ onSelect }: { onSelect: (selection: InspectorSelection) => void }) {
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
          {personalVariables.map((variable) => (
            <button
              key={variable.label}
              className="variable-field"
              onClick={() =>
                onSelect({
                  kind: "personal",
                  title: variable.label,
                  meta: "User input",
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
          <h3>Scenario compare</h3>
          <ComparisonRow label="Buy selectively now" value={68} tone="good" />
          <ComparisonRow label="Wait 6-12 months" value={59} tone="watch" />
          <ComparisonRow label="Expand region" value={74} tone="personal" />
          <ComparisonRow label="Keep renting" value={51} tone="watch" />
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
  value: number;
  tone: "good" | "watch" | "personal";
}) {
  return (
    <div className="comparison-row">
      <span>{label}</span>
      <div className="bar-wrap">
        <span className={`bar ${tone}`} style={{ width: `${value}%` }} />
      </div>
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
