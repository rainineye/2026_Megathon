// ============================================================================
// trace/model.ts — shared model, data, and pure helpers for the Trace workspace.
// Consumed by CanvasGraph.tsx + TraceWorkspace.tsx. Keep ALL data/algorithm here
// so components stay presentational and swappable. (EXTEND markers = next wiring.)
// ============================================================================
import type { FactorResearch } from "../api";

export const K = {
  paper: "#FAF8F3", paperDeep: "#F2EEE4", ink: "#1A1A1A", inkSoft: "#4A4A4A",
  inkMute: "#8A8A8A", rule: "#D9D4C7", ruleSoft: "#E8E4D8", primary: "#A03A2C",
  secondary: "#1C3A5E", secondarySoft: "#6B8AAE", warn: "#B8902E", meta: "#7A6A54",
  good: "#5A6E48",
};
export type Category = "financing" | "demand" | "supply" | "policy" | "regional" | "personal" | "outcome";
export type FactorGroup = "affordability" | "supply_side" | "policy_supply" | "macro_demand" | "regional" | "personal" | "outcome";
export const CAT_COLOR: Record<Category, string> = {
  financing: K.secondary,
  demand: K.secondarySoft,
  supply: K.meta,
  policy: K.warn,
  regional: "#6D7162",
  personal: K.good,
  outcome: K.primary,
};
export const GRID = 26, CW = 198, CH = 88, VBW = 2200, VBH = 1040;
export const PROTOTYPE_W = 238, PROTOTYPE_H = 118;
export const PROTOCOL_W = 220, PROTOCOL_H = 78;
export const snap = (v: number) => Math.round(v / GRID) * GRID;

export interface CanvasFactor {
  id: string; label: string; category: Category;
  value: string; trend: "↑" | "↓" | "→"; evidenceCount: number;
  credibility: "primary" | "mixed"; contested: boolean;
  level?: number;
  parent?: string | null;
  role?: "root" | "driver" | "subfactor" | "outcome" | "protocol";
  group?: FactorGroup;
  weightReady?: boolean;
  mechanism?: string;
  support: Record<string, number>;        // s(f → candidate)
  x: number; y: number;
  evidence?: { claim: string; source: string; url: string } | null;
  // --- rich inspector data (carried straight from the factor_research node) ---
  summary?: string;
  directionOnPrices?: string;
  metrics?: string[];                      // top_metrics: "name | value | detail" lines
  sources?: Array<{ label: string; url: string; domain: string; origin: string }>;
  evidenceStatus?: Record<string, number>; // evidence_status_rollup: type → count
  avgConfidence?: number | null;           // average_probability_pct
  dominantStatus?: string;
  metricCount?: number;
  sourceCount?: number;
}
export interface CanvasEdge {
  from: string; to: string; strength: number; sign: 1 | -1 | 0;
  relation?: "contains" | "causal" | "contested" | "conditioning" | "confounder" | "feedback";
  mechanism?: string;
}
export function nodeSize(node: Pick<CanvasFactor, "id" | "role">) {
  if (node.role === "protocol") return { w: PROTOCOL_W, h: PROTOCOL_H };
  return { w: PROTOTYPE_W, h: PROTOTYPE_H };
}
export interface Vars { price: number; deposit: number; ceil: number; rate: number; hor: number; flex: boolean; }
export type VarKey = "price" | "deposit" | "ceil" | "rate" | "hor" | "flex";

// ---- personal (private) conditioning variables -----------------------------
// The Add-variable (private) flow offers these. `recommended` = pre-checked
// because it's the strongest lever for THIS decision. `impact` (0..1) is how much
// moving this variable swings the conditioned distribution — surfaced in the UI so
// the user spends effort on the inputs that actually move the read. When active, a
// variable is plugged into the graph (a private node wired into `conditions`) and
// gates its own contribution to conditionDistribution; inactive → held at NEUTRAL.
// At NEUTRAL, price − deposit = €355k loan — the value the engine used before these
// two levers existed, so the baseline read is unchanged.
export const NEUTRAL: Vars = { price: 395000, deposit: 40000, ceil: 2450, rate: 4.0, hor: 7, flex: false };
export type VarUnit = "eur" | "pct" | "yr" | "bool";
export interface PersonalVarDef {
  id: VarKey; label: string; short: string; kind: "slider" | "toggle"; unit: VarUnit;
  min?: number; max?: number; step?: number;
  recommended: boolean; impact: number;   // impact: 0..1, how much it moves the read
  hint: string;                            // one-line plain-language caption
  rationale: string;                       // longer "why" (tooltip / detail panel)
  conditions: string[];   // factor ids this private variable plugs into
  ny: number;             // vertical slot in the left private gutter
}
// Ordered by impact (strongest lever first) — also the picker display order.
export const PERSONAL_VARS: PersonalVarDef[] = [
  { id: "price", label: "Target home price", short: "Your price", kind: "slider", unit: "eur", min: 250000, max: 750000, step: 5000,
    recommended: true, impact: 0.95, hint: "Sets your loan — the biggest driver of the payment.",
    rationale: "The price you actually target (minus your deposit) sets the loan, and the loan is the single largest driver of your monthly payment and of whether financing binds.",
    conditions: ["borrowing_capacity_subdrivers", "price_transaction_outcome"], ny: 52 },
  { id: "ceil", label: "Monthly payment ceiling", short: "Your ceiling", kind: "slider", unit: "eur", min: 1500, max: 3500, step: 50,
    recommended: true, impact: 0.9, hint: "What you can pay each month, comfortably.",
    rationale: "What you can actually pay each month is the strongest personal lever on whether financing pressure binds for you.",
    conditions: ["borrowing_capacity_subdrivers", "price_transaction_outcome"], ny: 156 },
  { id: "rate", label: "Quoted mortgage rate", short: "Your rate", kind: "slider", unit: "pct", min: 3, max: 6, step: 0.1,
    recommended: true, impact: 0.8, hint: "Your actual quote, not the market average.",
    rationale: "Your actual quote — not the market average — sets your real borrowing capacity. DNB finds prices track borrowing capacity more than the shortage.",
    conditions: ["borrow_interest_credit_channel", "borrowing_capacity_subdrivers"], ny: 260 },
  { id: "deposit", label: "Savings / down payment", short: "Your deposit", kind: "slider", unit: "eur", min: 0, max: 200000, step: 5000,
    recommended: false, impact: 0.6, hint: "Cash down shrinks the loan and the payment.",
    rationale: "Cash down shrinks the loan directly — every €10k of deposit eases the monthly payment and the financing pressure.",
    conditions: ["borrowing_capacity_subdrivers"], ny: 364 },
  { id: "hor", label: "Holding horizon", short: "Your horizon", kind: "slider", unit: "yr", min: 1, max: 15, step: 1,
    recommended: false, impact: 0.5, hint: "How long you'd hold before selling.",
    rationale: "A longer horizon lets the structural shortage outweigh short-term financing swings, shifting which scenario dominates.",
    conditions: ["price_transaction_outcome", "structural_shortage"], ny: 468 },
  { id: "flex", label: "Region-flexible", short: "Region-flex", kind: "toggle", unit: "bool",
    recommended: false, impact: 0.25, hint: "Open to moving to a cheaper region?",
    rationale: "If you can move regions, regional divergence turns from a risk into an opportunity you can exploit.",
    conditions: ["regional_tightness"], ny: 572 },
];
export const fmtVar = (d: PersonalVarDef, v: Vars): string => {
  if (d.unit === "bool") return v[d.id] ? "yes" : "no";
  const n = v[d.id] as number;
  if (d.unit === "pct") return `${n.toFixed(1)}%`;
  if (d.unit === "yr") return `${n} yr`;
  return `€${n.toLocaleString("en-US")}`;
};

export interface PersonalNode { id: string; key: VarKey; label: string; value: string; x: number; y: number; }
// Private value cards sit inside the horizontal Personal Variables area.
export const PV_X = 3068;
/** Build the private-variable node + edge layer for the active variables. */
export function personalLayer(active: VarKey[], vars: Vars): { nodes: PersonalNode[]; edges: CanvasEdge[] } {
  const defs = PERSONAL_VARS.filter((d) => active.includes(d.id));
  const nodes: PersonalNode[] = defs.map((d, index) => ({
    id: `pv_${d.id}`,
    key: d.id,
    label: d.short,
    value: fmtVar(d, vars),
    x: PV_X + (index % 2) * 200,
    y: 160 + Math.floor(index / 2) * 82,
  }));
  // Each private value plugs into the personal-decision driver node (same lane) — not
  // out to the conditioned factors / the read. The actual conditioning math still uses
  // each var's `conditions`; this is just the on-canvas wiring.
  const edges: CanvasEdge[] = defs.map((d) => ({ from: `pv_${d.id}`, to: "personal_decision_subdrivers", strength: 0.5, sign: 1 as const, relation: "conditioning" as const }));
  return { nodes, edges };
}

export const SCENARIOS: ReadonlyArray<readonly [string, string]> = [
  ["shortage_dominates", "Structural shortage"],
  ["financing_pressure", "Financing pressure"],
  ["investor_window", "Investor window"],
  ["regional_divergence", "Regional divergence"],
  ["user_constraint", "Your constraints"],
];

// ---- indicators to watch (bottom dock) — real timeseries + delta + price read
// Values/deltas are from nl_housing_timeseries.json (Cala-derived). priceSignal is
// the directional read (reasoning, not computed). EXTEND: derive triggers from the
// structured-tier splitting tests; pull live values from the engine.
// Each indicator is a "distance-to-trigger" gauge: nowVal = current reading,
// lineVal = the threshold that would flip the read, lo/hi = the track domain used
// to place the marker (now) and the tick (line). priceSignal/priceStrength = the
// quantified up/down pressure on price (drives the card meter + force balance).
// viaCala = sourced through the Cala knowledge API (shows a small cala badge).
export interface Indicator {
  id: string; label: string;
  nowVal: number; lineVal: number; lo: number; hi: number; unit: string;
  delta: string; deltaDir: "up" | "down" | "flat";   // recent change in this reading
  priceSignal: "up" | "down" | "neutral"; priceStrength: number;
  state: "ok" | "watch" | "breach"; source: string; viaCala: boolean; note: string;
}
export const INDICATORS: Indicator[] = [
  { id: "rate", label: "Mortgage rate", nowVal: 3.6, lineVal: 4.5, lo: 3, hi: 5.5, unit: "%", delta: "0.4pp", deltaDir: "down", priceSignal: "up", priceStrength: 0.8, state: "ok", source: "ECB · DNB", viaCala: true, note: "Quoted rate; above 4.5% affordability breaks and bids soften." },
  { id: "price", label: "Price momentum", nowVal: 8.6, lineVal: 3.0, lo: 0, hi: 10, unit: "%", delta: "2.0pp", deltaDir: "down", priceSignal: "up", priceStrength: 0.65, state: "watch", source: "CBS · Kadaster", viaCala: true, note: "YoY HPI growth; below +3% momentum is turning." },
  { id: "shortage", label: "Housing shortage", nowVal: 401, lineVal: 350, lo: 300, hi: 470, unit: "k", delta: "9k", deltaDir: "up", priceSignal: "up", priceStrength: 0.9, state: "watch", source: "ABF Research", viaCala: true, note: "Dwelling deficit; falling below ~350k eases price pressure." },
  { id: "demography", label: "Net migration", nowVal: 87, lineVal: 0, lo: 0, hi: 120, unit: "k", delta: "16k", deltaDir: "down", priceSignal: "up", priceStrength: 0.5, state: "watch", source: "CBS", viaCala: true, note: "Population growth is all migration; natural change already negative." },
  { id: "permits", label: "Building permits", nowVal: 24.2, lineVal: 25, lo: 20, hi: 30, unit: "k/q", delta: "1.5k", deltaDir: "up", priceSignal: "down", priceStrength: 0.45, state: "watch", source: "CBS", viaCala: true, note: "Future supply; sustained >25k/q starts to close the gap." },
  { id: "investor", label: "Investor net flow", nowVal: -8.6, lineVal: 0, lo: -18, hi: 6, unit: "k", delta: "1.2k", deltaDir: "down", priceSignal: "down", priceStrength: 0.4, state: "ok", source: "Kadaster", viaCala: true, note: "Net buy−sell; crossing back above 0 closes the supply window." },
  { id: "forecast", label: "Bank forecast ’26", nowVal: 4.0, lineVal: 0, lo: -2, hi: 8, unit: "%", delta: "3.5pp", deltaDir: "down", priceSignal: "up", priceStrength: 0.5, state: "ok", source: "ABN · Rabobank · ING · DNB", viaCala: false, note: "Banks' consensus house-price growth forecast for 2026; turning negative flips the read to caution." },
];
// overall price conclusion synthesized from the indicators above
export const NET_READ = {
  dir: "up" as "up" | "down" | "neutral",
  value: "Upward, decelerating",
  note: "Shortage + low rates lift prices; momentum is cooling and a brief investor-supply window is open.",
};

// ---- fallback dataset (renders with no engine) -----------------------------
export const FALLBACK_FACTORS: CanvasFactor[] = [
  { id: "mortgage_rate", label: "Mortgage rate", category: "financing", value: "ECB 2.25%", trend: "↓", evidenceCount: 26, credibility: "primary", contested: true, mechanism: "rate ↓ → borrowing capacity ↑ → demand ↑", support: { financing_pressure: 0.9, user_constraint: 0.5 }, x: 52, y: 52, evidence: { claim: "ECB kept its deposit rate ~2.25%, so Dutch mortgage rates fell through 2025.", source: "De Nederlandsche Bank", url: "https://www.dnb.nl/en/current-economic-issues/housing-market" } },
  { id: "household_income", label: "Household income", category: "financing", value: "real +0.8%", trend: "→", evidenceCount: 15, credibility: "mixed", contested: false, support: { financing_pressure: 0.5, user_constraint: 0.5 }, x: 52, y: 156, evidence: { claim: "Real income growth across Europe in 2025 was modest (~0.8% OECD avg).", source: "finance.yahoo.com", url: "https://finance.yahoo.com/economy/articles/real-income-growth-europe-2025-053547830.html" } },
  { id: "migration_demand", label: "Migration demand", category: "demand", value: "+103k pop ’24", trend: "↓", evidenceCount: 34, credibility: "primary", contested: false, support: { shortage_dominates: 0.5, regional_divergence: 0.6 }, x: 52, y: 286, evidence: { claim: "2024 population grew 103,000 — entirely from migration.", source: "CBS", url: "https://www.cbs.nl/en-gb/news/2025/05/lower-population-growth-in-2024" } },
  { id: "grid_congestion", label: "Grid congestion", category: "supply", value: "160k at risk", trend: "↑", evidenceCount: 8, credibility: "primary", contested: false, support: { shortage_dominates: 0.85 }, x: 52, y: 390, evidence: { claim: "Grid congestion named the biggest obstacle to residential construction.", source: "DutchNews.nl", url: "https://www.dutchnews.nl/2026/04/lack-of-electricity-grid-space-threatens-thousands-of-new-homes" } },
  { id: "landlord_exit", label: "Landlord exit", category: "supply", value: "sold 16.4k Q2", trend: "↑", evidenceCount: 5, credibility: "mixed", contested: false, support: { investor_window: 0.85 }, x: 52, y: 494, evidence: { claim: "Q2 2025: investors bought ~7,800 homes but sold 16,400.", source: "ewmagazine.nl", url: "https://www.ewmagazine.nl/politiek/news/2025/08/wet-betaalbare-huur-een-foute-wet-1496451" } },
  { id: "borrowing_capacity", label: "Borrowing capacity", category: "financing", value: "+€17k singles", trend: "↑", evidenceCount: 14, credibility: "primary", contested: false, support: { financing_pressure: 0.85, user_constraint: 0.8 }, x: 338, y: 104, evidence: { claim: "DNB: prices are more closely linked to borrowing capacity than to the supply shortage.", source: "De Nederlandsche Bank", url: "https://www.dnb.nl/en/current-economic-issues/housing-market" } },
  { id: "new_construction", label: "New construction", category: "supply", value: "permits 24.2k/q", trend: "↓", evidenceCount: 33, credibility: "mixed", contested: false, support: { shortage_dominates: 0.8 }, x: 338, y: 442, evidence: { claim: "Permits fell 22% in Q1 2025 to 12,500 homes.", source: "NL Times", url: "https://nltimes.nl/2025/05/15/sharp-drop-permits-issued-housing-construction" } },
  { id: "housing_shortage", label: "Housing shortage", category: "supply", value: "401k→453k ’27", trend: "↑", evidenceCount: 9, credibility: "primary", contested: false, support: { shortage_dominates: 0.9 }, x: 598, y: 312, evidence: { claim: "Shortage ~401,000 homes (2024), projected 453,000 by 2027.", source: "NL Times", url: "https://nltimes.nl/2025/04/22/housing-shortage-netherlands-reach-453000-2027-experts-warn" } },
  { id: "house_price", label: "HOUSE PRICE", category: "outcome", value: "+8.57% YoY", trend: "↑", evidenceCount: 28, credibility: "primary", contested: true, support: {}, x: 806, y: 260, evidence: { claim: "House Price Index rose 8.57% YoY in 2025.", source: "Global Property Guide", url: "https://www.globalpropertyguide.com/europe/netherlands/price-history" } },
];
export const FALLBACK_EDGES: CanvasEdge[] = [
  { from: "mortgage_rate", to: "borrowing_capacity", strength: 0.7, sign: -1 },
  { from: "household_income", to: "borrowing_capacity", strength: 0.6, sign: 1 },
  { from: "borrowing_capacity", to: "house_price", strength: 0.8, sign: 1 },
  { from: "migration_demand", to: "house_price", strength: 0.6, sign: 1 },
  { from: "migration_demand", to: "housing_shortage", strength: 0.5, sign: 1 },
  { from: "grid_congestion", to: "new_construction", strength: 0.7, sign: -1 },
  { from: "new_construction", to: "housing_shortage", strength: 0.6, sign: -1 },
  { from: "housing_shortage", to: "house_price", strength: 0.8, sign: 1 },
  { from: "landlord_exit", to: "housing_shortage", strength: 0.5, sign: -1 },
  { from: "mortgage_rate", to: "house_price", strength: 0.6, sign: 0 }, // contested
];

// ---- conditioning + weights (mirror of the engine; EXTEND: swap for API) ----
function annuity(loan: number, ratePct: number, years: number) {
  const r = ratePct / 100 / 12, n = years * 12;
  return r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
}
export function conditionDistribution(vIn: Vars, active?: VarKey[], base?: Record<string, number> | null) {
  // Only ACTIVE (added) variables condition the graph; others held at NEUTRAL.
  const on = active ? new Set(active) : new Set<VarKey>(["price", "deposit", "ceil", "rate", "hor", "flex"]);
  const v: Vars = {
    price: on.has("price") ? vIn.price : NEUTRAL.price,
    deposit: on.has("deposit") ? vIn.deposit : NEUTRAL.deposit,
    ceil: on.has("ceil") ? vIn.ceil : NEUTRAL.ceil,
    rate: on.has("rate") ? vIn.rate : NEUTRAL.rate,
    hor: on.has("hor") ? vIn.hor : NEUTRAL.hor,
    flex: on.has("flex") ? vIn.flex : NEUTRAL.flex,
  };
  const loan = Math.max(50000, v.price - v.deposit), m = annuity(loan, v.rate, 30), buf = v.ceil - m, br = buf / v.ceil;
  const pres = Math.max(0, Math.min(1, 0.55 - br)), hor = v.hor / 15;
  const w: Record<string, number> = {
    shortage_dominates: base?.shortage_dominates ?? 0.26,
    financing_pressure: base?.financing_pressure ?? 0.28,
    investor_window: base?.investor_window ?? 0.07,
    regional_divergence: base?.regional_divergence ?? 0.06,
    user_constraint: base?.user_constraint ?? 0.32,
  };
  w.financing_pressure += pres * 0.28; w.user_constraint += pres * 0.2;
  w.shortage_dominates += hor * 0.2 - pres * 0.05; w.investor_window += 0.03;
  w.regional_divergence += v.flex ? 0.09 : 0;
  let t = 0; for (const k in w) { w[k] = Math.max(0.01, w[k]); t += w[k]; }
  for (const k in w) w[k] /= t;
  return { w, buf: Math.round(buf), br };
}
/** Pearl-conditioned factor weight: w(f) = Σ_c r(c|user)·s(f→c), normalized to max. */
export function factorWeights(factors: CanvasFactor[], dist: Record<string, number>) {
  const raw: Record<string, number> = {}; let mx = 0;
  for (const f of factors) {
    let a = 0; for (const c in f.support) a += (dist[c] || 0) * f.support[c];
    raw[f.id] = a; if (f.category !== "outcome") mx = Math.max(mx, a);
  }
  const out: Record<string, number> = {};
  for (const f of factors) out[f.id] = f.category === "outcome" ? 1 : (mx ? raw[f.id] / mx : 0);
  return out;
}

// ---- personal decision advice (private; generated after a protocol run) -----
// Deterministic synthesis from the conditioned distribution + the user's active
// variables. EXTEND: replace with the real personal_fit layer output.
export function personalAdvice(v: Vars, active: VarKey[], dist: Record<string, number>): { headline: string; body: string } | null {
  if (active.length === 0) return null;
  const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0][0];
  const pct = Math.round((dist[top] || 0) * 100);
  const has = (k: VarKey) => active.includes(k);
  const { rate, ceil, hor } = v;
  switch (top) {
    case "shortage_dominates":
      return {
        headline: has("hor") && hor >= 8 ? "Lean buy — time is on your side" : "Buy only if you can hold",
        body: `Structural shortage leads (${pct}%)${has("hor") ? ` — your ${hor}-yr horizon rides out the cooling` : ""}; buy to hold once financing fits.`,
      };
    case "financing_pressure":
    case "user_constraint":
      return {
        headline: "Fix financing before you commit",
        body: `Budget is the binding constraint (${pct}%) — shop a sharper rate than ${rate.toFixed(1)}%; it moves your outcome more than waiting.`,
      };
    case "investor_window":
      return {
        headline: "A short entry window is open",
        body: `Supply window open (${pct}%) — if financing's ready${has("ceil") ? ` within €${ceil}/mo` : ""}, it's a better-than-average entry.`,
      };
    case "regional_divergence":
      return {
        headline: has("flex") ? "Use your flexibility as leverage" : "Pick the region before the timing",
        body: has("flex")
          ? `Regional divergence leads (${pct}%) — use your mobility: widen to cooler provincial markets.`
          : `Markets are diverging (${pct}%) — pick the region before the moment; the national read hides local gaps.`,
      };
    default:
      return { headline: "Mixed signals — keep conditioning", body: `No single force dominates (lead ${pct}%) — sharpen your variables and re-run.` };
  }
}

// ---- decision layer: market read + personal exposure → action fit ------------
// The 3 actions of the demo question. Their % is a RELATIVE FIT (how well each
// action suits this user given the conditioned read), NOT a probability that the
// action is "correct" — labeled "fit" in the UI per the honesty guardrail.
export const ACTIONS: ReadonlyArray<readonly [string, string]> = [
  ["buy", "Buy in the next 6 months"],
  ["wait", "Wait 6–12 months · monitor"],
  ["rent", "Keep renting for now"],
];
// Transparent payoff: how well each action fits each market scenario (0..1).
const ACTION_PAYOFF: Record<string, { buy: number; wait: number; rent: number }> = {
  shortage_dominates:  { buy: 1.0,  wait: 0.35, rent: 0.2 },   // prices keep rising → get in / hold
  financing_pressure:  { buy: 0.3,  wait: 0.85, rent: 0.6 },   // cooling, capacity binds → wait
  investor_window:     { buy: 0.95, wait: 0.4,  rent: 0.2 },   // short supply window → enter now
  regional_divergence: { buy: 0.45, wait: 0.8,  rent: 0.5 },   // pick the region first → wait
  user_constraint:     { buy: 0.2,  wait: 0.55, rent: 0.85 },  // budget binds → rent / resize
};
export interface DecisionRead {
  actions: Array<{ id: string; label: string; fit: number }>;   // fit = relative %, sums to 1, sorted desc
  top: string; topLabel: string; confidence: "low" | "medium" | "high"; margin: number;
}
/** Map the conditioned scenario read + personal exposure → a buy/wait/rent fit. */
export function decisionDistribution(v: Vars, active: VarKey[], dist: Record<string, number>, br: number): DecisionRead | null {
  if (active.length === 0) return null;
  const s: Record<string, number> = { buy: 0, wait: 0, rent: 0 };
  for (const scen in ACTION_PAYOFF) {
    const w = dist[scen] ?? 0, p = ACTION_PAYOFF[scen];
    s.buy += w * p.buy; s.wait += w * p.wait; s.rent += w * p.rent;
  }
  const has = (k: VarKey) => active.includes(k);
  // personal exposure tilt — only where the relevant variable is in play.
  if (has("ceil")) {
    if (br < 0) { s.buy *= 0.45; s.rent += 0.22; s.wait += 0.1; }   // can't afford the payment → rent / wait
    else if (br > 0.3) s.buy += 0.15;                                // comfortable buffer → buying is viable
  }
  if (has("hor")) {
    if (v.hor >= 8) s.buy += 0.12;                                   // long horizon rides out swings → buy
    else if (v.hor <= 3) { s.rent += 0.15; s.buy -= 0.08; }          // short horizon → renting is safer
  }
  if (has("flex") && v.flex) s.wait += 0.06;                         // region-flex → waiting to choose pays
  let t = 0; for (const k in s) { s[k] = Math.max(0.01, s[k]); t += s[k]; }
  const actions = ACTIONS.map(([id, label]) => ({ id, label, fit: s[id] / t })).sort((a, b) => b.fit - a.fit);
  const margin = actions[0].fit - actions[1].fit;
  const confidence = margin > 0.18 ? "high" : margin > 0.08 ? "medium" : "low";
  return { actions, top: actions[0].id, topLabel: actions[0].label, confidence, margin };
}

export function curve(a: CanvasFactor, b: CanvasFactor) {
  const aSize = nodeSize(a), bSize = nodeSize(b);
  const acx = a.x + aSize.w / 2, bcx = b.x + bSize.w / 2;
  const below = b.y > a.y + aSize.h + 18;
  if (below) {
    const ax = acx, ay = a.y + aSize.h, bx = bcx, by = b.y, dy = by - ay;
    return { d: `M ${ax} ${ay} C ${ax} ${ay + dy * 0.45}, ${bx} ${by - dy * 0.45}, ${bx} ${by}`, mx: (ax + bx) / 2, my: (ay + by) / 2 };
  }
  if (b.x >= a.x + aSize.w - 8) {
    const ax = a.x + aSize.w, ay = a.y + aSize.h / 2, bx = b.x, by = b.y + bSize.h / 2, dx = bx - ax;
    return { d: `M ${ax} ${ay} C ${ax + dx * 0.4} ${ay}, ${bx - dx * 0.4} ${by}, ${bx} ${by}`, mx: (ax + bx) / 2, my: (ay + by) / 2 };
  }
  const ax = acx, ay = a.y + aSize.h, bx = bcx, by = b.y, dy = by - ay || 1;
  return { d: `M ${ax} ${ay} C ${ax} ${ay + dy * 0.45}, ${bx} ${by - dy * 0.45}, ${bx} ${by}`, mx: (ax + bx) / 2, my: (ay + by) / 2 };
}
// EXTEND: enrich with real per-factor → candidate support once the engine exposes it.
export function adaptFactorTree(res: FactorResearch): { factors: CanvasFactor[]; edges: CanvasEdge[] } | null {
  if (!res?.factors?.length) return null;
  const cleanText = (text: string) =>
    text.replace(/[#*_`|]/g, " ").replace(/\s+/g, " ").replace(/^[-–—]\s*/, "").trim();
  const signalOf = (f: { id: string; label: string }) => {
    const compact: Record<string, string> = {
      mortgage_lending_standards_outlook: "lending standards",
      income_borrowing_capacity: "income capacity",
      rate_price_splitting_test: "rate-price split",
      borrow_interest_credit_channel: "mortgage-rate channel",
      borrowing_capacity_subdrivers: "loan capacity levers",
      financing_pressure: "credit affordability",
      demographics_migration_household_formation: "population formation",
      macro_labor_confidence_policy: "GDP / jobs / confidence",
      equity_wealth_liquidity_channel: "wealth liquidity",
      macro_demand: "demand baseline",
      nitrogen_construction_constraint: "nitrogen permits",
      grid_congestion: "grid capacity",
      construction_costs: "build-cost viability",
      municipal_land_policy: "land + local planning",
      supply_pipeline_subdrivers: "permits + completions",
      structural_shortage: "housing deficit",
      box3_private_rental_tax_channel: "Box 3 tax pressure",
      affordable_rent_landlord_exit: "rent caps / exits",
      investor_selloff_rental_policy: "landlord net selling",
      local_market_subdrivers: "local liquidity",
      city_overbidding: "overbidding pressure",
      regional_tightness: "city-level tightness",
      personal_decision_subdrivers: "personal constraints",
    };
    if (compact[f.id]) return compact[f.id];
    return cleanText(f.label).slice(0, 24).toLowerCase();
  };
  const displayMetric = (f: { id: string; label: string; top_metrics?: string[]; summary?: string }) => {
    const signal = signalOf(f);
    if (signal) return signal;
    const metric = (f.top_metrics || []).find((m) => {
      const s = cleanText(m);
      return s && /\d/.test(s) && !/^below is\b/i.test(s) && !/^(netherlands|latest|dutch)\b/i.test(s);
    });
    const text = metric || f.summary || "see evidence";
    return cleanText(text).slice(0, 34);
  };
  const catOf = (f: { id: string; label: string }): Category => {
    const s = (f.id + " " + f.label).toLowerCase();
    if (/macro_labor_confidence_policy|equity_wealth_liquidity_channel/.test(s)) return "demand";
    if (/municipal_land_policy/.test(s)) return "supply";
    if (/market_state/.test(s)) return "outcome";
    if (/official_price_transaction_measurement|price_transaction_outcome/.test(s)) return "outcome";
    if (/rate_price_splitting_test/.test(s)) return "financing";
    if (/price/.test(s)) return "outcome";
    if (/rate|mortgage|income|credit|borrow|ltv|financ/.test(s)) return "financing";
    if (/policy|tax|box|rent|rental|landlord|investor|nhg/.test(s)) return "policy";
    if (/region|local|city|listing|overbid/.test(s)) return "regional";
    if (/personal|budget|affordability/.test(s)) return "personal";
    if (/migrat|demand|popul|household/.test(s)) return "demand";
    return "supply";
  };
  const labelOf = (f: { id: string; label: string }) =>
    f.id === "supply_pipeline_subdrivers" ? "Housing permits / pipeline" : f.label;
  // ── Horizontal overview layout: each causal area is one module in a row. The
  // top component in each module points down into the centered Trace Core Protocol.
  const AREA_W = 546, AREA_GAP = 52, AREA0 = 52;
  const AX = {
    affordability: AREA0,
    macro_demand: AREA0 + (AREA_W + AREA_GAP),
    supply_side: AREA0 + (AREA_W + AREA_GAP) * 2,
    policy_supply: AREA0 + (AREA_W + AREA_GAP) * 3,
    regional: AREA0 + (AREA_W + AREA_GAP) * 4,
    personal: AREA0 + (AREA_W + AREA_GAP) * 5,
  };
  const LEFT = 26, RIGHT = 282, CENTER = 154;
  const ROW = { one: 130, two: 300, three: 470, four: 640, midOne: 230, midTwo: 400, driver: 790, protocol: 1040 };
  const PROTOCOL_X = AREA0 + ((AREA_W + AREA_GAP) * 5 + AREA_W) / 2 - PROTOCOL_W / 2;
  const layout: Record<string, { x: number; y: number; role?: CanvasFactor["role"]; group?: FactorGroup }> = {
    mortgage_lending_standards_outlook: { x: AX.affordability + LEFT, y: ROW.one, role: "subfactor", group: "affordability" },
    income_borrowing_capacity: { x: AX.affordability + LEFT, y: ROW.two, role: "subfactor", group: "affordability" },
    rate_price_splitting_test: { x: AX.affordability + LEFT, y: ROW.three, role: "subfactor", group: "affordability" },
    borrow_interest_credit_channel: { x: AX.affordability + RIGHT, y: ROW.midOne, role: "subfactor", group: "affordability" },
    borrowing_capacity_subdrivers: { x: AX.affordability + RIGHT, y: ROW.midTwo, role: "subfactor", group: "affordability" },
    financing_pressure: { x: AX.affordability + CENTER, y: ROW.driver, role: "driver", group: "affordability" },

    demographics_migration_household_formation: { x: AX.macro_demand + CENTER, y: ROW.one, role: "subfactor", group: "macro_demand" },
    macro_labor_confidence_policy: { x: AX.macro_demand + CENTER, y: ROW.two, role: "subfactor", group: "macro_demand" },
    equity_wealth_liquidity_channel: { x: AX.macro_demand + CENTER, y: ROW.three, role: "subfactor", group: "macro_demand" },
    macro_demand: { x: AX.macro_demand + CENTER, y: ROW.driver, role: "driver", group: "macro_demand" },

    nitrogen_construction_constraint: { x: AX.supply_side + LEFT, y: ROW.one, role: "subfactor", group: "supply_side" },
    grid_congestion: { x: AX.supply_side + LEFT, y: ROW.two, role: "subfactor", group: "supply_side" },
    construction_costs: { x: AX.supply_side + LEFT, y: ROW.three, role: "subfactor", group: "supply_side" },
    municipal_land_policy: { x: AX.supply_side + LEFT, y: ROW.four, role: "subfactor", group: "supply_side" },
    supply_pipeline_subdrivers: { x: AX.supply_side + RIGHT, y: ROW.midTwo, role: "subfactor", group: "supply_side" },
    structural_shortage: { x: AX.supply_side + CENTER, y: ROW.driver, role: "driver", group: "supply_side" },

    box3_private_rental_tax_channel: { x: AX.policy_supply + LEFT, y: ROW.midTwo, role: "subfactor", group: "policy_supply" },
    affordable_rent_landlord_exit: { x: AX.policy_supply + RIGHT, y: ROW.midTwo, role: "subfactor", group: "policy_supply" },
    investor_selloff_rental_policy: { x: AX.policy_supply + CENTER, y: ROW.driver, role: "driver", group: "policy_supply" },

    local_market_subdrivers: { x: AX.regional + CENTER, y: ROW.midOne, role: "subfactor", group: "regional" },
    city_overbidding: { x: AX.regional + CENTER, y: ROW.midTwo, role: "subfactor", group: "regional" },
    regional_tightness: { x: AX.regional + CENTER, y: ROW.driver, role: "driver", group: "regional" },

    personal_decision_subdrivers: { x: AX.personal + CENTER, y: ROW.driver, role: "driver", group: "personal" },

    // (outcome nodes — market_state / measured price — removed from the canvas; the
    //  outcome read + decision now live in the bottom dock. Drivers converge on the
    //  Trace Core Protocol engine node, which bridges to that dock.)
  };
  const visibleIds = new Set(Object.keys(layout));
  const visible = res.factors.filter((f) => visibleIds.has(f.id));
  const byFactorId = new Map(res.factors.map((f) => [f.id, f]));
  const explicitSupport: Record<string, Record<string, number>> = {
    borrow_interest_credit_channel: { financing_pressure: 0.92, user_constraint: 0.45 },
    mortgage_lending_standards_outlook: { financing_pressure: 0.82, user_constraint: 0.48 },
    income_borrowing_capacity: { financing_pressure: 0.74, user_constraint: 0.52 },
    rate_price_splitting_test: { financing_pressure: 0.62 },
    supply_bottleneck_breakdown: { shortage_dominates: 0.9 },
    nitrogen_permitting_outlook: { shortage_dominates: 0.78 },
    grid_capacity_outlook: { shortage_dominates: 0.78 },
    development_viability_execution: { shortage_dominates: 0.72 },
    equity_wealth_liquidity_channel: { shortage_dominates: 0.48, regional_divergence: 0.25 },
    box3_private_rental_tax_channel: { investor_window: 0.86 },
    affordable_rent_landlord_exit: { investor_window: 0.8 },
    demographics_migration_household_formation: { shortage_dominates: 0.7, regional_divergence: 0.36 },
    macro_labor_confidence_policy: { shortage_dominates: 0.5, financing_pressure: 0.32 },
  };
  const rootScenario = (id: string): Record<string, number> => {
    if (explicitSupport[id]) return explicitSupport[id];
    const seen = new Set<string>();
    let current = id;
    while (current && !seen.has(current)) {
      seen.add(current);
      if (current === "financing_pressure") return { financing_pressure: 1, user_constraint: 0.58 };
      if (current === "structural_shortage") return { shortage_dominates: 1 };
      if (current === "investor_selloff_rental_policy") return { investor_window: 1 };
      if (current === "policy_tax_subdrivers") return { investor_window: 0.88 };
      if (current === "regional_tightness") return { regional_divergence: 1 };
      if (current === "macro_demand") return { shortage_dominates: 0.72, regional_divergence: 0.38 };
      if (current === "personal_decision_subdrivers") return { user_constraint: 1 };
      if (current === "price_transaction_outcome" || current === "official_price_transaction_measurement" || current === "market_state") return {};
      current = byFactorId.get(current)?.parent ?? "";
    }
    return {};
  };
  const depthAttenuation = (f: { level?: number; id: string }) => {
    if (f.id === "personal_decision_subdrivers") return 1;
    const level = f.level ?? 2;
    return Math.max(0.58, 1 - Math.max(0, level - 2) * 0.12);
  };
  const credibilityOf = (f: { evidence_status_rollup?: Record<string, number>; dominant_evidence_status?: string }) => {
    const entries = Object.entries(f.evidence_status_rollup || {}).filter(([, value]) => value > 0);
    if (!entries.length) return "mixed" as const;
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    const [topStatus, topCount] = entries.sort((a, b) => b[1] - a[1])[0];
    const factual = /^(observed_fact|policy_in_force|methodology_or_definition)$/.test(topStatus);
    return factual && topCount / total >= 0.72 ? "primary" as const : "mixed" as const;
  };
  const mappedFactors: CanvasFactor[] = visible.map((f) => {
    const dir = (f.direction_on_prices || "").toLowerCase();
    const p = layout[f.id];
    const attenuation = depthAttenuation(f);
    const support = Object.fromEntries(Object.entries(rootScenario(f.id)).map(([k, v]) => [k, v * attenuation]));
    return {
      id: f.id, label: labelOf(f), category: catOf(f),
      value: displayMetric(f),
      trend: dir.includes("up") || dir.includes("rais") ? "↑" : dir.includes("down") || dir.includes("lower") ? "↓" : "→",
      evidenceCount: f.source_count ?? 0, credibility: credibilityOf(f),
      contested: /not_settled|contested|disput|split/.test(`${f.id} ${f.dominant_evidence_status || ""}`),
      level: f.level,
      parent: f.id === "affordable_rent_landlord_exit" ? "investor_selloff_rental_policy" : f.parent ?? null,
      role: p.role,
      group: p.group,
      weightReady: Object.keys(support).length > 0,
      mechanism: f.mechanism || undefined,
      support,
      x: snap(p.x), y: snap(p.y),
      evidence: f.sources?.[0] ? { claim: f.summary || f.label, source: f.sources[0].label, url: f.sources[0].url || "" } : null,
      summary: f.summary || undefined,
      directionOnPrices: f.direction_on_prices || undefined,
      metrics: f.top_metrics || [],
      sources: (f.sources || []).map((s) => ({ label: s.label, url: s.url || "", domain: s.domain || "", origin: s.source_origin || "web" })),
      evidenceStatus: f.evidence_status_rollup || undefined,
      avgConfidence: f.average_probability_pct ?? null,
      dominantStatus: f.dominant_evidence_status || undefined,
      metricCount: f.metric_count ?? (f.top_metrics?.length ?? 0),
      sourceCount: f.source_count ?? (f.sources?.length ?? 0),
    };
  });
  const protocolNode: CanvasFactor = {
    id: "trace_core_protocol",
    label: "Trace Core Protocol",
    category: "outcome",
    value: "Pearl's Causal Framework",
    trend: "→",
    evidenceCount: 0,
    credibility: "primary",
    contested: false,
    role: "protocol",
    group: "outcome",
    weightReady: false,
    mechanism: "Pearl's Causal Framework",
    support: {},
    x: snap(PROTOCOL_X),
    y: snap(ROW.protocol),
    evidence: null,
  };
  const factors: CanvasFactor[] = [...mappedFactors, protocolNode];
  const ids = new Set(factors.map((f) => f.id));
  const protocolDriverIds = new Set([
    "financing_pressure",
    "macro_demand",
    "structural_shortage",
    "investor_selloff_rental_policy",
    "regional_tightness",
    "personal_decision_subdrivers",
  ]);
  // containment edges: child -> parent (drawn as the tree skeleton)
  const contains: CanvasEdge[] = (res.edges || [])
    .filter((e) => (e.relation ?? "contains") === "contains" && ids.has(e.source) && ids.has(e.target))
    .filter((e) => !(e.source === "market_state" && protocolDriverIds.has(e.target)))
    // grid_congestion's data-parent is structural_shortage; re-route it to the
    // permits/pipeline node (see addContains below) so it doesn't bypass it.
    .filter((e) => !(e.source === "structural_shortage" && e.target === "grid_congestion"))
    // These fixture containment edges are valid research ancestry but too ambiguous
    // for the visual hierarchy: each child gets a clearer manual parent below.
    .filter((e) => !(e.source === "borrow_interest_credit_channel" && ["mortgage_lending_standards_outlook", "income_borrowing_capacity"].includes(e.target)))
    .filter((e) => !(
      ["box3_private_rental_tax_channel", "affordable_rent_landlord_exit"].includes(e.source) &&
      ["box3_private_rental_tax_channel", "affordable_rent_landlord_exit"].includes(e.target)
    ))
    .map((e) => ({ from: e.target, to: e.source, strength: 0.35, sign: 1 as const, relation: "contains" as const }));
  const addContains = (from: string, to: string) => {
    if (!ids.has(from) || !ids.has(to)) return;
    if (contains.some((e) => e.from === from && e.to === to)) return;
    contains.push({ from, to, strength: 0.35, sign: 1, relation: "contains" });
  };
  addContains("mortgage_lending_standards_outlook", "borrowing_capacity_subdrivers");
  addContains("income_borrowing_capacity", "borrowing_capacity_subdrivers");
  addContains("rate_price_splitting_test", "financing_pressure");
  addContains("borrow_interest_credit_channel", "financing_pressure");
  addContains("demographics_migration_household_formation", "macro_demand");
  addContains("macro_labor_confidence_policy", "macro_demand");
  addContains("equity_wealth_liquidity_channel", "macro_demand");
  // the supply bottleneck components feed the permits / pipeline node directly
  addContains("nitrogen_construction_constraint", "supply_pipeline_subdrivers");
  addContains("grid_congestion", "supply_pipeline_subdrivers");
  addContains("construction_costs", "supply_pipeline_subdrivers");
  addContains("municipal_land_policy", "supply_pipeline_subdrivers");
  addContains("box3_private_rental_tax_channel", "investor_selloff_rental_policy");
  addContains("affordable_rent_landlord_exit", "investor_selloff_rental_policy");
  addContains("local_market_subdrivers", "regional_tightness");
  protocolDriverIds.forEach((id) => addContains(id, "trace_core_protocol"));
  addContains("trace_core_protocol", "market_state");
  const edges: CanvasEdge[] = contains;
  return { factors, edges };
}
