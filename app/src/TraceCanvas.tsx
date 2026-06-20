// ============================================================================
// TraceCanvas.tsx — the decision-exhibit canvas (PRD §22).
//
// A pannable / zoomable causal canvas: factor CARDS snap to a dot grid, edges are
// thin bezier inference lines, and each card shows its PRECISE Pearl-conditioned
// weight `w%` (the protocol's exact computed value) + a weight bar. Personal
// variables CONDITION the structure (PRD §15: they re-weight, never touch evidence).
//
// Data: tries the engine API (fetchFactorTree + runDefaultTier); falls back to the
// inline FALLBACK_* dataset so it renders offline. The "engine" chip shows which.
//
// COLOR = ONE MEANING: accent bar = factor category · grey = weight · ochre =
// contested · category color on edges · (price = rust outcome).
//
// EXTEND markers below flag the obvious next features (real per-factor weights from
// the engine, reverse-trace, timeline, evidence inspector wired to factor.sources).
// ============================================================================
import { useEffect, useRef, useState, useCallback } from "react";
import { fetchFactorTree, type FactorResearch } from "./api";

// ---- Trace paper palette (matches the case-file design system) --------------
const K = {
  paper: "#FAF8F3", paperDeep: "#F2EEE4", ink: "#1A1A1A", inkSoft: "#4A4A4A",
  inkMute: "#8A8A8A", rule: "#D9D4C7", ruleSoft: "#E8E4D8", primary: "#A03A2C",
  secondary: "#1C3A5E", secondarySoft: "#6B8AAE", warn: "#B8902E", meta: "#7A6A54",
  good: "#5A6E48",
};
const CAT_COLOR: Record<string, string> = {
  financing: K.secondary, demand: K.secondarySoft, supply: K.meta, outcome: K.primary,
};
const GRID = 26, CW = 156, CH = 78, VBW = 940, VBH = 600;
const snap = (v: number) => Math.round(v / GRID) * GRID;

// ---- model -----------------------------------------------------------------
type Category = "financing" | "demand" | "supply" | "outcome";
export interface CanvasFactor {
  id: string; label: string; category: Category;
  value: string; trend: "↑" | "↓" | "→"; evidenceCount: number;
  credibility: "primary" | "mixed"; contested: boolean;
  support: Record<string, number>;     // factor -> candidate support  s(f→c)
  x: number; y: number;
  evidence?: { claim: string; source: string; url: string } | null;
}
interface CanvasEdge { from: string; to: string; strength: number; sign: 1 | -1 | 0; }
const SCENARIOS = [
  ["shortage_dominates", "Structural shortage"],
  ["financing_pressure", "Financing pressure"],
  ["investor_window", "Investor window"],
  ["regional_divergence", "Regional divergence"],
  ["user_constraint", "Your constraints"],
] as const;

// ---- fallback dataset (renders with no engine) -----------------------------
const FALLBACK_FACTORS: CanvasFactor[] = [
  { id: "mortgage_rate", label: "Mortgage rate", category: "financing", value: "ECB 2.25%", trend: "↓", evidenceCount: 26, credibility: "primary", contested: true, support: { financing_pressure: 0.9, user_constraint: 0.5 }, x: 52, y: 52, evidence: { claim: "ECB kept its deposit rate ~2.25%, so Dutch mortgage rates fell through 2025.", source: "De Nederlandsche Bank", url: "https://www.dnb.nl/en/current-economic-issues/housing-market" } },
  { id: "household_income", label: "Household income", category: "financing", value: "real +0.8%", trend: "→", evidenceCount: 15, credibility: "mixed", contested: false, support: { financing_pressure: 0.5, user_constraint: 0.5 }, x: 52, y: 156, evidence: { claim: "Real income growth across Europe in 2025 was modest (~0.8% OECD avg).", source: "finance.yahoo.com", url: "https://finance.yahoo.com/economy/articles/real-income-growth-europe-2025-053547830.html" } },
  { id: "migration_demand", label: "Migration demand", category: "demand", value: "+103k pop ’24", trend: "↓", evidenceCount: 34, credibility: "primary", contested: false, support: { shortage_dominates: 0.5, regional_divergence: 0.6 }, x: 52, y: 286, evidence: { claim: "2024 population grew 103,000 — entirely from migration.", source: "CBS", url: "https://www.cbs.nl/en-gb/news/2025/05/lower-population-growth-in-2024" } },
  { id: "grid_congestion", label: "Grid congestion", category: "supply", value: "160k at risk", trend: "↑", evidenceCount: 8, credibility: "primary", contested: false, support: { shortage_dominates: 0.85 }, x: 52, y: 390, evidence: { claim: "Grid congestion named the biggest obstacle to residential construction.", source: "DutchNews.nl", url: "https://www.dutchnews.nl/2026/04/lack-of-electricity-grid-space-threatens-thousands-of-new-homes" } },
  { id: "landlord_exit", label: "Landlord exit", category: "supply", value: "sold 16.4k Q2", trend: "↑", evidenceCount: 5, credibility: "mixed", contested: false, support: { investor_window: 0.85 }, x: 52, y: 494, evidence: { claim: "Q2 2025: investors bought ~7,800 homes but sold 16,400.", source: "ewmagazine.nl", url: "https://www.ewmagazine.nl/politiek/news/2025/08/wet-betaalbare-huur-een-foute-wet-1496451" } },
  { id: "borrowing_capacity", label: "Borrowing capacity", category: "financing", value: "+€17k singles", trend: "↑", evidenceCount: 14, credibility: "primary", contested: false, support: { financing_pressure: 0.85, user_constraint: 0.8 }, x: 338, y: 104, evidence: { claim: "DNB: prices are more closely linked to borrowing capacity than to the supply shortage.", source: "De Nederlandsche Bank", url: "https://www.dnb.nl/en/current-economic-issues/housing-market" } },
  { id: "new_construction", label: "New construction", category: "supply", value: "permits 24.2k/q", trend: "↓", evidenceCount: 33, credibility: "mixed", contested: false, support: { shortage_dominates: 0.8 }, x: 338, y: 442, evidence: { claim: "Permits fell 22% in Q1 2025 to 12,500 homes.", source: "NL Times", url: "https://nltimes.nl/2025/05/15/sharp-drop-permits-issued-housing-construction" } },
  { id: "housing_shortage", label: "Housing shortage", category: "supply", value: "401k→453k ’27", trend: "↑", evidenceCount: 9, credibility: "primary", contested: false, support: { shortage_dominates: 0.9 }, x: 598, y: 312, evidence: { claim: "Shortage ~401,000 homes (2024), projected 453,000 by 2027.", source: "NL Times", url: "https://nltimes.nl/2025/04/22/housing-shortage-netherlands-reach-453000-2027-experts-warn" } },
  { id: "house_price", label: "HOUSE PRICE", category: "outcome", value: "+8.57% YoY", trend: "↑", evidenceCount: 28, credibility: "primary", contested: true, support: {}, x: 806, y: 260, evidence: { claim: "House Price Index rose 8.57% YoY in 2025.", source: "Global Property Guide", url: "https://www.globalpropertyguide.com/europe/netherlands/price-history" } },
];
const FALLBACK_EDGES: CanvasEdge[] = [
  { from: "mortgage_rate", to: "borrowing_capacity", strength: 0.7, sign: -1 },
  { from: "household_income", to: "borrowing_capacity", strength: 0.6, sign: 1 },
  { from: "borrowing_capacity", to: "house_price", strength: 0.8, sign: 1 },
  { from: "migration_demand", to: "house_price", strength: 0.6, sign: 1 },
  { from: "migration_demand", to: "housing_shortage", strength: 0.5, sign: 1 },
  { from: "grid_congestion", to: "new_construction", strength: 0.7, sign: -1 },
  { from: "new_construction", to: "housing_shortage", strength: 0.6, sign: -1 },
  { from: "housing_shortage", to: "house_price", strength: 0.8, sign: 1 },
  { from: "landlord_exit", to: "housing_shortage", strength: 0.5, sign: -1 },
  { from: "mortgage_rate", to: "house_price", strength: 0.6, sign: 0 }, // contested (graph_not_settled)
];

// ---- conditioning + weights (mirror of the engine; EXTEND: replace with API) -
function annuity(loan: number, ratePct: number, years: number) {
  const r = ratePct / 100 / 12, n = years * 12;
  return r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
}
interface Vars { ceil: number; rate: number; hor: number; flex: boolean; }
function conditionDistribution(v: Vars) {
  const loan = 355000, m = annuity(loan, v.rate, 30), buf = v.ceil - m, br = buf / v.ceil;
  const pres = Math.max(0, Math.min(1, 0.55 - br)), hor = v.hor / 15;
  const w: Record<string, number> = { shortage_dominates: 0.26, financing_pressure: 0.28, investor_window: 0.07, regional_divergence: 0.06, user_constraint: 0.32 };
  w.financing_pressure += pres * 0.28; w.user_constraint += pres * 0.2;
  w.shortage_dominates += hor * 0.2 - pres * 0.05; w.investor_window += 0.03;
  w.regional_divergence += v.flex ? 0.09 : 0;
  let t = 0; for (const k in w) { w[k] = Math.max(0.01, w[k]); t += w[k]; }
  for (const k in w) w[k] /= t;
  return { w, buf: Math.round(buf), br };
}
// Pearl-conditioned factor weight: w(f) = Σ_c r(c|user) · s(f→c), normalized to max.
function factorWeights(factors: CanvasFactor[], dist: Record<string, number>) {
  const raw: Record<string, number> = {}; let mx = 0;
  for (const f of factors) {
    let a = 0; for (const c in f.support) a += (dist[c] || 0) * f.support[c];
    raw[f.id] = a; if (f.category !== "outcome") mx = Math.max(mx, a);
  }
  const out: Record<string, number> = {};
  for (const f of factors) out[f.id] = f.category === "outcome" ? 1 : (mx ? raw[f.id] / mx : 0);
  return out;
}

// ---- adapt the engine's factor-tree into the canvas model (best-effort) -----
// EXTEND: enrich with real per-factor → candidate support once the engine exposes it.
function adaptFactorTree(res: FactorResearch): { factors: CanvasFactor[]; edges: CanvasEdge[] } | null {
  if (!res?.factors?.length) return null;
  const catOf = (f: { id: string; label: string }): Category => {
    const s = (f.id + " " + f.label).toLowerCase();
    if (/price/.test(s)) return "outcome";
    if (/rate|mortgage|income|credit|borrow|ltv|financ/.test(s)) return "financing";
    if (/migrat|demand|popul|household/.test(s)) return "demand";
    return "supply";
  };
  const byLevel: Record<number, number> = {};
  const factors: CanvasFactor[] = res.factors.slice(0, 16).map((f) => {
    const col = (f.level ?? 1); const row = (byLevel[col] = (byLevel[col] || 0) + 1);
    const dir = (f.direction_on_prices || "").toLowerCase();
    return {
      id: f.id, label: f.label, category: catOf(f),
      value: f.top_metrics?.[0]?.slice(0, 22) || f.summary?.slice(0, 22) || "—",
      trend: dir.includes("up") || dir.includes("rais") ? "↑" : dir.includes("down") || dir.includes("lower") ? "↓" : "→",
      evidenceCount: f.source_count ?? 0, credibility: (f.dominant_evidence_status ? "primary" : "mixed"),
      contested: /not_settled|contested|disput/.test((f.dominant_evidence_status || "")),
      support: {}, // EXTEND: fill from engine support
      x: snap(40 + col * 260), y: snap(40 + row * 110),
      evidence: f.sources?.[0] ? { claim: f.summary || f.label, source: f.sources[0].label, url: f.sources[0].url || "" } : null,
    };
  });
  const ids = new Set(factors.map((f) => f.id));
  const edges: CanvasEdge[] = (res.edges || [])
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e) => ({ from: e.source, to: e.target, strength: 0.6, sign: 1 }));
  return { factors, edges };
}

// ---- geometry --------------------------------------------------------------
function curve(a: CanvasFactor, b: CanvasFactor) {
  const ax = a.x + CW, ay = a.y + CH / 2, bx = b.x, by = b.y + CH / 2, dx = bx - ax;
  return { d: `M ${ax} ${ay} C ${ax + dx * 0.4} ${ay}, ${bx - dx * 0.4} ${by}, ${bx} ${by}`, mx: (ax + bx) / 2, my: (ay + by) / 2 };
}

// ============================================================================
// `height` defaults to "100%" so it fills its container like a workspace; the
// standalone canvas.html gives #root 100vh. Embedders can pass a number/string.
export default function TraceCanvas({ height = "100%" }: { height?: number | string } = {}) {
  const [factors, setFactors] = useState<CanvasFactor[]>(FALLBACK_FACTORS);
  const [edges, setEdges] = useState<CanvasEdge[]>(FALLBACK_EDGES);
  const [source, setSource] = useState<"loading" | "engine" | "offline">("loading");
  const [cam, setCam] = useState({ x: 0, y: 0, k: 1 });
  const [vars, setVars] = useState<Vars>({ ceil: 2450, rate: 4.0, hor: 10, flex: true });
  const [hover, setHover] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id?: string; ox: number; oy: number; moved: boolean } | null>(null);
  const pan = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);

  // fetch real data on mount (graceful fallback) -----------------------------
  useEffect(() => {
    let alive = true;
    fetchFactorTree()
      .then((res) => { const a = adaptFactorTree(res); if (alive && a) { setFactors(a.factors); setEdges(a.edges); setSource("engine"); } else if (alive) setSource("offline"); })
      .catch(() => alive && setSource("offline"));
    // EXTEND: also runDefaultTier() to seed the base scenario distribution.
    return () => { alive = false; };
  }, []);

  const dist = conditionDistribution(vars);
  const W = factorWeights(factors, dist.w);
  const factorById = (id: string) => factors.find((f) => f.id === id);
  const incident = (id: string) => edges.filter((e) => e.from === id || e.to === id);

  // pointer coord in viewBox units
  const vb = useCallback((e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * VBW, y: ((e.clientY - r.top) / r.height) * VBH };
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (drag.current) {
        const p = vb(e); const nx = snap(p.x - drag.current.ox), ny = snap(p.y - drag.current.oy);
        setFactors((fs) => fs.map((f) => f.id === drag.current!.id ? (nx !== f.x || ny !== f.y ? (drag.current!.moved = true, { ...f, x: nx, y: ny }) : f) : f));
      } else if (pan.current) {
        const r = svgRef.current!.getBoundingClientRect();
        setCam((c) => ({ ...c, x: pan.current!.cx + ((e.clientX - pan.current!.sx) / r.width) * VBW, y: pan.current!.cy + ((e.clientY - pan.current!.sy) / r.height) * VBH }));
      }
    };
    const up = () => {
      if (drag.current && !drag.current.moved && drag.current.id) setSel(drag.current.id);
      drag.current = null; pan.current = null;
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [vb]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault(); const p = vb(e);
    setCam((c) => { const nk = Math.max(0.45, Math.min(2.6, c.k * (1 - e.deltaY * 0.0012))); const wx = (p.x - c.x) / c.k, wy = (p.y - c.y) / c.k; return { x: p.x - wx * nk, y: p.y - wy * nk, k: nk }; });
  };
  const zoom = (f: number) => setCam((c) => { const p = { x: 470, y: 300 }; const nk = Math.max(0.45, Math.min(2.6, c.k * f)); const wx = (p.x - c.x) / c.k, wy = (p.y - c.y) / c.k; return { x: p.x - wx * nk, y: p.y - wy * nk, k: nk }; });

  const foc = hover || sel;
  const selFactor = sel ? factorById(sel) : null;

  // ---- render --------------------------------------------------------------
  return (
    <div style={{ position: "relative", height, width: "100%", overflow: "hidden", background: K.paper, fontFamily: "'Instrument Sans', sans-serif", color: K.ink }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 44, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: "rgba(250,248,243,.82)", borderBottom: `1px solid ${K.rule}`, backdropFilter: "blur(3px)" }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: K.meta }}>Trace · decision exhibit · NL housing</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15 }}>Conditioned causal canvas</div>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, border: `1px solid ${K.rule}`, borderRadius: 2, padding: "4px 8px", color: K.meta, background: K.paper }}>
          ● engine · <b style={{ color: source === "engine" ? K.good : source === "offline" ? K.warn : K.meta }}>{source === "engine" ? "live" : source === "offline" ? "offline (fallback)" : "…"}</b>
        </div>
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${VBW} ${VBH}`} preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: "44px 0 0 0", width: "100%", height: "calc(100% - 44px)", cursor: pan.current ? "grabbing" : "grab", touchAction: "none" }}
        onPointerDown={(e) => { pan.current = { sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y }; }} onWheel={onWheel}>
        <defs><pattern id="tc-dots" width={GRID} height={GRID} patternUnits="userSpaceOnUse"><circle cx={GRID / 2} cy={GRID / 2} r={1} fill="#CFC8B6" opacity={0.45} /></pattern></defs>
        <g transform={`translate(${cam.x},${cam.y}) scale(${cam.k})`}>
          <rect x={-260} y={-260} width={1500} height={1100} fill="url(#tc-dots)" />
          {/* edges */}
          {edges.map((e, i) => {
            const a = factorById(e.from), b = factorById(e.to); if (!a || !b) return null;
            const cu = curve(a, b), con = e.sign === 0, col = con ? K.warn : CAT_COLOR[a.category];
            const inc = !!foc && (e.from === foc || e.to === foc);
            const sw = inc ? 1.6 + e.strength * 2.2 : con ? 1.1 : 1;
            const op = foc ? (inc ? 0.95 : 0.12) : con ? 0.55 : 0.32;
            return <path key={i} d={cu.d} fill="none" stroke={col} strokeWidth={sw} strokeDasharray={con ? "5 4" : undefined} opacity={op} style={{ transition: "opacity .2s, stroke-width .15s" }} />;
          })}
          {/* cards */}
          {factors.map((n) => {
            const wt = W[n.id], apex = n.category === "outcome", col = CAT_COLOR[n.category];
            const on = !foc || foc === n.id || incident(foc).some((e) => e.from === n.id || e.to === n.id);
            const op = foc ? (on ? 1 : 0.24) : 1, act = sel === n.id || hover === n.id;
            const nm = (n.label.length > 15 ? n.label.slice(0, 14) + "…" : n.label).toUpperCase();
            return (
              <g key={n.id} opacity={op} style={{ cursor: "grab", transition: "opacity .2s" }}
                onMouseEnter={() => !drag.current && setHover(n.id)} onMouseLeave={() => !drag.current && setHover(null)}
                onPointerDown={(e) => { e.stopPropagation(); const p = vb(e); drag.current = { id: n.id, ox: p.x - n.x, oy: p.y - n.y, moved: false }; }}>
                <rect x={n.x} y={n.y} width={CW} height={CH} rx={2} fill={apex ? "#F4E4E0" : K.paper} stroke={apex ? K.primary : act ? K.secondary : K.rule} strokeWidth={apex ? 2 : act ? 2 : 1.2} />
                <rect x={n.x} y={n.y} width={4} height={CH} rx={1} fill={col} />
                <text x={n.x + 15} y={n.y + 20} fontFamily="'JetBrains Mono', monospace" fontSize={9} letterSpacing={0.6} fill={K.inkSoft}>{nm}</text>
                {n.contested && <circle cx={n.x + CW - 9} cy={n.y + 9} r={2.3} fill={K.warn} />}
                {apex ? (
                  <>
                    <text x={n.x + 15} y={n.y + 45} fontFamily="'Fraunces', serif" fontStyle="italic" fontSize={21} fill={K.primary}>{n.value}</text>
                    <text x={n.x + 15} y={n.y + 63} fontFamily="'JetBrains Mono', monospace" fontSize={8} letterSpacing={0.3} fill={K.inkMute}>outcome · {n.evidenceCount} ev · feeds distribution →</text>
                  </>
                ) : (
                  <>
                    {/* precise weight — FIXED size on every card */}
                    <text x={n.x + CW - 12} y={n.y + 24} textAnchor="end" fontFamily="'Fraunces', serif" fontStyle="italic" fontSize={17} fill={K.ink}>{Math.round(wt * 100)}%</text>
                    <text x={n.x + 15} y={n.y + 42} fontFamily="'Instrument Sans', sans-serif" fontSize={13} fontWeight={500} fill={K.ink}>{n.value} <tspan fill={K.inkMute}>{n.trend}</tspan></text>
                    <text x={n.x + 15} y={n.y + 57} fontFamily="'JetBrains Mono', monospace" fontSize={8} letterSpacing={0.3} fill={K.inkMute}>{n.evidenceCount} ev · {n.credibility}</text>
                    <rect x={n.x + 13} y={n.y + CH - 11} width={CW - 26} height={4} rx={2} fill={K.paperDeep} />
                    <rect x={n.x + 13} y={n.y + CH - 11} width={(CW - 26) * wt} height={4} rx={2} fill={K.inkSoft} />
                  </>
                )}
              </g>
            );
          })}
          {/* edge annotations on hover (polarity + strength) */}
          {foc && edges.filter((e) => e.from === foc || e.to === foc).map((e, i) => {
            const a = factorById(e.from), b = factorById(e.to); if (!a || !b) return null;
            const cu = curve(a, b), con = e.sign === 0;
            const txt = con ? "unsettled" : `${e.sign > 0 ? "▲ raises" : "▼ lowers"} · s${e.strength.toFixed(2)}`, w = con ? 52 : 84;
            return (<g key={"an" + i}><rect x={cu.mx - w / 2} y={cu.my - 9} width={w} height={17} rx={2} fill={K.paper} stroke={K.rule} opacity={0.96} /><text x={cu.mx - w / 2 + 6} y={cu.my + 3.5} fontFamily="'JetBrains Mono', monospace" fontSize={8.5} fill={con ? K.warn : K.inkSoft}>{txt}</text></g>);
          })}
        </g>
      </svg>

      {/* zoom */}
      <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 5, zIndex: 25 }}>
        {[["+", () => zoom(1.2)], ["−", () => zoom(1 / 1.2)], ["reset", () => setCam({ x: 0, y: 0, k: 1 })]].map(([t, fn], i) => (
          <button key={i} onClick={fn as () => void} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: t === "reset" ? 9 : 13, height: 28, width: t === "reset" ? "auto" : 28, padding: t === "reset" ? "0 8px" : 0, border: `1px solid ${K.rule}`, background: K.paper, color: K.inkSoft, borderRadius: 2, cursor: "pointer" }}>{t as string}</button>
        ))}
      </div>

      {/* legend */}
      <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", zIndex: 25, display: "flex", gap: 12, alignItems: "center", background: "rgba(250,248,243,.9)", border: `1px solid ${K.rule}`, borderRadius: 3, padding: "5px 11px", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: K.inkSoft }}>
        {[["financing", K.secondary], ["demand", K.secondarySoft], ["supply", K.meta], ["price", K.primary], ["contested", K.warn], ["weight", K.inkSoft]].map(([l, c]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 1, background: c as string }} />{l}</span>
        ))}
      </div>

      {/* condition panel */}
      <Panel top={54} title="Condition · private">
        <Slider label="Monthly ceiling" val={`€${vars.ceil}`} min={1500} max={3500} step={50} value={vars.ceil} onChange={(v) => setVars((s) => ({ ...s, ceil: v }))} />
        <Slider label="Quoted rate" val={`${vars.rate.toFixed(1)}%`} min={3} max={6} step={0.1} value={vars.rate} onChange={(v) => setVars((s) => ({ ...s, rate: v }))} />
        <Slider label="Holding horizon" val={`${vars.hor} yr`} min={1} max={15} step={1} value={vars.hor} onChange={(v) => setVars((s) => ({ ...s, hor: v }))} />
        <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: K.meta, display: "flex", justifyContent: "space-between", marginTop: 8 }}><span>Region-flexible</span><input type="checkbox" checked={vars.flex} onChange={(e) => setVars((s) => ({ ...s, flex: e.target.checked }))} style={{ accentColor: K.secondary }} /></label>
      </Panel>

      <Panel top={268} title="Scenario distribution">
        {[...SCENARIOS].sort((a, b) => dist.w[b[0]] - dist.w[a[0]]).map(([id, lbl], i) => (
          <div key={id} style={{ marginBottom: 2 }}>
            <div style={{ height: 13, background: K.paperDeep, border: `1px solid ${K.rule}`, borderRadius: 2, position: "relative", marginTop: 3 }}>
              <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${dist.w[id] * 100}%`, background: i === 0 ? K.primary : K.secondary }} />
            </div>
            <div style={{ fontSize: 10, display: "flex", justifyContent: "space-between", marginTop: 4, color: i === 0 ? K.primary : K.inkSoft, fontWeight: i === 0 ? 600 : 400 }}><span>{lbl}</span><span>{(dist.w[id] * 100).toFixed(0)}%</span></div>
          </div>
        ))}
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: dist.buf < 0 ? K.warn : dist.br < 0.13 ? K.primary : K.good, borderTop: `1px solid ${K.rule}`, marginTop: 8, paddingTop: 7 }}>▸ {dist.buf < 0 ? "Wait / resize" : dist.br < 0.13 ? "Buy selectively · hard ceiling" : "Buy selectively"} · buffer €{dist.buf}/mo</div>
      </Panel>

      {selFactor && (
        <div style={{ position: "absolute", bottom: 50, right: 10, width: 232, background: K.paper, border: `1px solid ${K.secondary}`, borderRadius: 2, boxShadow: "0 6px 22px rgba(26,26,26,.12)", zIndex: 28 }}>
          <h5 style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: K.paper, background: K.secondary, padding: "6px 9px", display: "flex", justifyContent: "space-between" }}>Evidence · {selFactor.label}<span style={{ cursor: "pointer" }} onClick={() => setSel(null)}>✕</span></h5>
          <div style={{ padding: "10px 11px", fontSize: 12 }}>
            {selFactor.evidence ? (<><div style={{ lineHeight: 1.45 }}>{selFactor.evidence.claim}</div>{selFactor.evidence.url && <div style={{ marginTop: 7 }}><a href={selFactor.evidence.url} target="_blank" rel="noopener" style={{ color: K.secondary, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>{selFactor.evidence.source} ↗</a></div>}<div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: K.inkMute, marginTop: 8 }}>inspector · {selFactor.evidenceCount} evidence items · per-scenario support nested {/* EXTEND */}</div></>) : <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: K.inkMute }}>no evidence wired</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- small panel + slider helpers ------------------------------------------
function Panel({ top, title, children }: { top: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", top, right: 10, width: 220, background: K.paper, border: `1px solid ${K.secondary}`, borderRadius: 2, boxShadow: "0 6px 22px rgba(26,26,26,.12)", zIndex: 28 }}>
      <h5 style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: K.paper, background: K.secondary, padding: "6px 9px" }}>{title}</h5>
      <div style={{ padding: "10px 11px", fontSize: 12 }}>{children}</div>
    </div>
  );
}
function Slider({ label, val, min, max, step, value, onChange }: { label: string; val: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (<>
    <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: K.meta, textTransform: "uppercase", display: "flex", justifyContent: "space-between", margin: "7px 0 2px" }}><span>{label}</span><span>{val}</span></label>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: "100%", accentColor: K.secondary }} />
  </>);
}
