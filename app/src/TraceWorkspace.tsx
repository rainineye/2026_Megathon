// ============================================================================
// TraceWorkspace.tsx — the full decision-exhibit WORKSPACE shell (per the
// wireframe). Composes: Header · LeftRail(legend+nav) · CanvasGraph(left) ·
// draggable Splitter · RightColumn(CTA add-vars · condition · node investigation
// · scenario distribution · evidence) · BottomDock(indicators to watch).
//
// ROUGH DEFAULT — structure + interactions wired to existing data; each region is
// a small component below so we can iterate on them one at a time.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { fetchFactorTree, runDefaultTier } from "./api";
import CanvasGraph from "./trace/CanvasGraph";
import {
  K, CAT_COLOR, SCENARIOS, INDICATORS, NET_READ, FALLBACK_FACTORS, FALLBACK_EDGES,
  conditionDistribution, factorWeights, adaptFactorTree, personalLayer, personalAdvice, fmtVar, PERSONAL_VARS,
  CW, CH, VBW, VBH, nodeSize,
  type CanvasFactor, type CanvasEdge, type Vars, type Category, type VarKey, type PersonalVarDef, type FactorGroup,
} from "./trace/model";

const mono = "'JetBrains Mono', monospace", sans = "'Instrument Sans', sans-serif", serif = "'Fraunces', serif";
const editorial = "'Newsreader', 'Fraunces', serif";
const SCEN_LABEL = Object.fromEntries(SCENARIOS.map(([id, l]) => [id, l]));

type ProtocolRun = {
  support?: Record<string, number>;
  distribution?: Record<string, number>;
  candidate_support?: Record<string, number>;
  scenario_distribution?: Record<string, number>;
  factor_weights?: Record<string, number>;
  factor_support?: Record<string, Record<string, number>>;
};

// Demo presets: input sets that drive DRASTICALLY different advice. Verified against
// conditionDistribution + personalAdvice (financing-led vs shortage-led leading scenario).
const DEMO_PRESETS: Array<{ id: string; label: string; sub: string; advice: string; vars: Partial<Vars>; active: VarKey[] }> = [
  { id: "stretched", label: "Stretched first-timer", sub: "EUR 480k - 40k down - 5.5% - EUR 2,000/mo - 5 yr", advice: "Fix financing first",
    vars: { price: 480000, deposit: 40000, rate: 5.5, ceil: 2000, hor: 5, flex: false }, active: ["price", "deposit", "rate", "ceil", "hor"] },
  { id: "patient", label: "Patient long-term holder", sub: "EUR 400k - 120k down - 3.4% - EUR 3,000/mo - 15 yr", advice: "Lean buy - time on your side",
    vars: { price: 400000, deposit: 120000, rate: 3.4, ceil: 3000, hor: 15, flex: false }, active: ["price", "deposit", "rate", "ceil", "hor"] },
  { id: "cautious", label: "Short-horizon buyer", sub: "EUR 380k - 110k down - 3.6% - EUR 2,800/mo - 6 yr", advice: "Buy only if you can hold",
    vars: { price: 380000, deposit: 110000, rate: 3.6, ceil: 2800, hor: 6, flex: false }, active: ["price", "deposit", "rate", "ceil", "hor"] },
];
export default function TraceWorkspace() {
  const [factors, setFactors] = useState<CanvasFactor[]>(FALLBACK_FACTORS);
  const [edges, setEdges] = useState<CanvasEdge[]>(FALLBACK_EDGES);
  const [source, setSource] = useState<"loading" | "engine" | "offline">("loading");
  const [vars, setVars] = useState<Vars>({ price: 425000, deposit: 60000, ceil: 2450, rate: 4.0, hor: 10, flex: true });
  const [applied, setApplied] = useState<Vars>({ price: 425000, deposit: 60000, ceil: 2450, rate: 4.0, hor: 10, flex: true });
  const [activeVars, setActiveVars] = useState<VarKey[]>([]);        // added private variables
  const [appliedActive, setAppliedActive] = useState<VarKey[]>([]);  // committed by last Run
  const [picker, setPicker] = useState(false);
  const [running, setRunning] = useState(false);
  const [rightOn, setRightOn] = useState(true);   // floating right panel (info display)
  const [dockOn, setDockOn] = useState(true);     // floating bottom dock (indicators)
  const [isFs, setIsFs] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [groupFocus, setGroupFocus] = useState<FactorGroup | null>(null);   // a focused lane (click its background)
  const [cam, setCam] = useState({ x: 40, y: 20, k: 0.46 });   // default fits the taller gridded graph
  const [protocolRun, setProtocolRun] = useState<ProtocolRun | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const prevActive = useRef(0);

  useEffect(() => {
    let alive = true;
    fetchFactorTree()
      .then((res) => { const a = adaptFactorTree(res); if (alive && a) { setFactors(a.factors); setEdges(a.edges); setSource("engine"); } else if (alive) setSource("offline"); })
      .catch(() => alive && setSource("offline"));
    runDefaultTier()
      .then((res) => {
        if (alive) setProtocolRun(res as ProtocolRun);
      })
      .catch(() => { if (alive) setProtocolRun(null); });
    return () => { alive = false; };
  }, []);

  // keyboard / pinch zoom should affect the CANVAS, not the whole page.
  useEffect(() => {
    const applyZoom = (f: number) => setCam((c) => { const p = { x: 470, y: 300 }; const nk = Math.max(0.45, Math.min(2.6, c.k * f)); const wx = (p.x - c.x) / c.k, wy = (p.y - c.y) / c.k; return { x: p.x - wx * nk, y: p.y - wy * nk, k: nk }; });
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "=" || e.key === "+") { e.preventDefault(); applyZoom(1.2); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); applyZoom(1 / 1.2); }
      else if (e.key === "0") { e.preventDefault(); setCam({ x: 0, y: 0, k: 1 }); }
    };
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); }; // stop trackpad pinch page-zoom
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("wheel", onWheel); };
  }, []);

  // outputs read the LAST-RUN snapshot; the graph's private nodes track the live edits.
  const protocolDist = protocolRun?.scenario_distribution ?? protocolRun?.support ?? protocolRun?.distribution ?? protocolRun?.candidate_support ?? null;
  // Condition ON TOP of the engine's distribution: the engine gives the public prior,
  // the private variables shift it. This is what makes the demo presets change the advice
  // (run-default-tier itself does not re-weight by personal_variables). No vars active ->
  // neutral conditioning -> dist == engine base.
  const dist = conditionDistribution(applied, appliedActive, protocolDist ?? null);
  const weights = protocolRun?.factor_weights ?? (protocolDist ? factorWeights(factors, dist.w) : {});
  const protocolSupport = protocolRun?.factor_support;
  const factorsWithProtocolSupport = protocolSupport
    ? factors.map((f) => protocolSupport[f.id] ? { ...f, support: protocolSupport[f.id], weightReady: Object.keys(protocolSupport[f.id]).length > 0 } : f)
    : factors;
  const displayFactors = protocolDist ? factorsWithProtocolSupport : factors.map((f) => ({ ...f, weightReady: false }));
  const personal = personalLayer(activeVars, vars);
  const advice = personalAdvice(applied, appliedActive, dist.w);

  // The scenario READ (conclusions) renders as ON-CANVAS cards — same component as
  // the causal factor cards — in a conclusions column to the right of the measured
  // price outcome. NOT a separate side panel. Grounded in the engine distribution.
  const scenCat: Record<string, Category> = { shortage_dominates: "supply", financing_pressure: "financing", investor_window: "policy", regional_divergence: "regional", user_constraint: "personal" };
  const outcomeF = factors.find((f) => f.role === "outcome" || f.category === "outcome");
  const ranked = SCENARIOS.map(([id, label]) => ({ id, label, w: dist.w[id] ?? 0 })).sort((a, b) => b.w - a.w);
  const CONC_X = 2288;   // conclusions column = OUT(2002) + one column pitch (286)
  const conclNodes: CanvasFactor[] = ranked.map((s, i) => ({
    id: `read_${s.id}`, label: s.label, category: scenCat[s.id] ?? "outcome", role: "outcome",
    value: `${Math.round(s.w * 100)}% likely`, trend: SCEN_META[s.id]?.dir === "up" ? "↑" : SCEN_META[s.id]?.dir === "down" ? "↓" : "→",
    evidenceCount: displayFactors.filter((f) => (f.support?.[s.id] ?? 0) > 0).length,
    credibility: "primary", contested: false, weightReady: true, mechanism: SCEN_META[s.id]?.note,
    support: { [s.id]: 1 }, x: CONC_X, y: 838 + i * 130,
  }));
  const conclEdges: CanvasEdge[] = outcomeF
    ? ranked.map((s) => ({ from: outcomeF.id, to: `read_${s.id}`, strength: 0.35 + s.w * 0.55, sign: 1 as const, relation: "causal" as const }))
    : [];
  const leadReadId = ranked.length ? `read_${ranked[0].id}` : undefined;
  const allFactors = [...displayFactors, ...conclNodes];
  const allEdges = [...edges, ...conclEdges];
  const allWeights = { ...weights, ...Object.fromEntries(ranked.map((s) => [`read_${s.id}`, s.w])) };
  const panelsOn = rightOn || dockOn;
  const togglePanels = () => { const v = !(rightOn || dockOn); setRightOn(v); setDockOn(v); };
  const selFactor = sel ? allFactors.find((f) => f.id === sel) || null : null;
  const selPersonal = sel?.startsWith("pv_") ? PERSONAL_VARS.find((d) => `pv_${d.id}` === sel) || null : null;
  const dirty = JSON.stringify(activeVars.slice().sort()) !== JSON.stringify(appliedActive.slice().sort())
    || activeVars.some((k) => vars[k] !== applied[k]);
  const moveFactor = (id: string, x: number, y: number) => setFactors((fs) => fs.map((f) => f.id === id ? { ...f, x, y } : f));
  const zoom = (f: number) => setCam((c) => { const p = { x: 470, y: 300 }; const nk = Math.max(0.45, Math.min(2.6, c.k * f)); const wx = (p.x - c.x) / c.k, wy = (p.y - c.y) / c.k; return { x: p.x - wx * nk, y: p.y - wy * nk, k: nk }; });
  const fitView = () => {
    const boxes = [
      ...allFactors.map((f) => ({ x: f.x, y: f.y, ...nodeSize(f) })),
      ...personal.nodes.map((n) => ({ x: n.x, y: n.y, w: 120, h: 46 })),
    ];
    if (!boxes.length) return;
    const minX = Math.min(...boxes.map((b) => b.x)), minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w)), maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const pad = 48, cw = Math.max(1, maxX - minX), ch = Math.max(1, maxY - minY);
    const k = Math.max(0.45, Math.min(2.6, Math.min((VBW - 2 * pad) / cw, (VBH - 2 * pad) / ch)));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    setCam({ x: VBW / 2 - cx * k, y: VBH / 2 - cy * k, k });
  };
  // frame an arbitrary world rect into the visible area LEFT of the inspector panel.
  const frameRect = (minX: number, minY: number, maxX: number, maxY: number, maxK: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const panelPx = rightOn ? 360 : 0;
    const visW = rect ? ((rect.width - panelPx) / rect.width) * VBW : VBW * 0.6;
    const pad = 80, cw = Math.max(1, maxX - minX), ch = Math.max(1, maxY - minY);
    const k = Math.max(0.4, Math.min(maxK, Math.min((visW - 2 * pad) / cw, (VBH - 2 * pad) / ch)));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    setCam({ x: visW / 2 - cx * k, y: VBH / 2 - cy * k, k });
  };
  // After plugging variables in: light up the WHOLE personal-variable area (the value
  // cards + the personal-decision driver they feed) and frame the camera on it. Selecting
  // the area's anchor keeps this group + its connected pv nodes bright and dims the rest,
  // so the freshly-plugged inputs read clearly at once.
  const focusPersonalFor = (active: VarKey[]) => {
    const ns = personalLayer(active, vars).nodes;
    if (!ns.length) return;
    const driver = allFactors.find((f) => f.id === "personal_decision_subdrivers");
    const xs = [...ns.map((n) => n.x), ...(driver ? [driver.x] : [])];
    const ys = [...ns.map((n) => n.y), ...(driver ? [driver.y] : [])];
    const xe = [...ns.map((n) => n.x + 180), ...(driver ? [driver.x + CW] : [])];
    const ye = [...ns.map((n) => n.y + 90), ...(driver ? [driver.y + CH] : [])];
    setSel("personal_decision_subdrivers");   // light up the personal area, dim the rest
    setHover(null);
    frameRect(Math.min(...xs) - 40, Math.min(...ys) - 50, Math.max(...xe) + 40, Math.max(...ye) + 50, 1.15);
  };
  // jump to the OUTCOME read column (the ranked reads + your-call advice).
  const focusOutcome = () => frameRect(2002, 760, 2760, 1500, 1.0);
  // DEFAULT view: keep node text at its most-legible size (font-size baseline), centered
  // on the graph; edges may overflow - pan to browse. This is the home view.
  const defaultView = () => {
    const ns = factors.length ? factors : allFactors;
    if (!ns.length) return;
    const minX = Math.min(...ns.map((f) => f.x)), minY = Math.min(...ns.map((f) => f.y));
    const maxX = Math.max(...ns.map((f) => f.x + CW)), maxY = Math.max(...ns.map((f) => f.y + CH));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const rect = canvasRef.current?.getBoundingClientRect();
    const fitScale = rect ? Math.min(rect.width / VBW, rect.height / VBH) : 1;
    const k = Math.max(0.6, Math.min(1.8, 14.5 / (13 * fitScale)));
    setCam({ x: VBW / 2 - cx * k, y: VBH / 2 - cy * k, k });
  };
  const focusComponent = (id: string) => {
    const factor = allFactors.find((f) => f.id === id) || null;
    const privateNode = personal.nodes.find((n) => n.id === id) || null;
    const node = factor ?? privateNode;
    setSel(id);
    setGroupFocus(null);   // focusing a single node clears any whole-lane focus
    setHover(null);
    setRightOn(true);
    if (!node) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    const panelPx = 360;
    const viewCenterX = rect
      ? ((Math.max(rect.width - panelPx, rect.width * 0.52) * 0.5) / rect.width) * VBW
      : VBW * 0.38;
    const viewCenterY = VBH * 0.48;
    const size = factor ? nodeSize(factor) : null;
    const w = privateNode ? 120 : size?.w ?? CW;
    const h = privateNode ? 46 : size?.h ?? CH;
    const k = privateNode ? 1.72 : 1.42;
    setCam({
      x: viewCenterX - (node.x + w / 2) * k,
      y: viewCenterY - (node.y + h / 2) * k,
      k
    });
  };
  const exitFocus = () => {
    setSel(null);
    setGroupFocus(null);
    setHover(null);
    defaultView();
  };
  // click a lane background → focus the whole group (toggle); clears any node selection.
  const focusGroup = (g: FactorGroup) => { setGroupFocus((prev) => (prev === g ? null : g)); setSel(null); setHover(null); };

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || (!sel && !groupFocus)) return;
      event.preventDefault();
      exitFocus();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  });

  // settle to the default home view once the graph data loads.
  useEffect(() => { defaultView(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [source]);

  // run the core protocol over the edited variables → commit the conditioned snapshot.
  const runProtocol = async () => {
    if (running) return;
    setRunning(true);
    try {
      const res = await runDefaultTier({ personal_variables: { ...vars } });
      setProtocolRun(res as ProtocolRun);
      setApplied(vars);
      setAppliedActive(activeVars);
      focusOutcome();   // demo: jump to the outcome read so the advice is front-and-center
    } finally {
      setRunning(false);
    }
  };
  const toggleFullscreen = () => {
    const el = rootRef.current; if (!el) return;   // full-screen the WHOLE workspace (for presenting)
    if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.();
  };
  useEffect(() => {
    // Entering full screen clears both panels for a clean presentation canvas; a
    // later click on a component re-calls the inspector (focusComponent), never the
    // indicators dock. Exiting restores both.
    const fn = () => {
      const fs = !!document.fullscreenElement;
      setIsFs(fs);
      setRightOn(!fs);
      setDockOn(!fs);
    };
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);
  // settle to the default home view once the factor tree first arrives.
  useEffect(() => {
    if (factors.length && !prevActive.current) { defaultView(); prevActive.current = 1; }
  }, [factors.length]);

  return (
    <div ref={rootRef} style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: K.paper, color: K.ink, fontFamily: sans, overflow: "hidden" }}>
      <style>{`.trace-range{-webkit-appearance:none;appearance:none;height:5px;border-radius:999px;outline:none;cursor:pointer}.trace-range::-webkit-slider-runnable-track{height:5px;border-radius:999px;background:transparent}.trace-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:15px;height:15px;border-radius:50%;background:${K.good};border:2px solid ${K.paper};box-shadow:0 1px 4px rgba(0,0,0,.28);margin-top:-5px;cursor:pointer}.trace-range::-moz-range-track{height:5px;border-radius:999px;background:transparent}.trace-range::-moz-range-thumb{width:15px;height:15px;border-radius:50%;background:${K.good};border:2px solid ${K.paper};box-shadow:0 1px 4px rgba(0,0,0,.28);cursor:pointer}`}</style>
      <Header source={source} onRun={runProtocol} running={running} dirty={dirty}
        onFullscreen={toggleFullscreen} isFs={isFs} onTogglePanels={togglePanels} panelsOn={panelsOn} />
      <div ref={bodyRef} style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {/* ---- canvas - FULL viewport width ---- */}
        <div ref={canvasRef} style={{ position: "absolute", inset: 0, overflow: "hidden", background: K.paper }}>
          <CanvasGraph factors={allFactors} edges={allEdges} weights={allWeights} lead={leadReadId} personal={personal} sel={sel} hover={hover}
            groupFocus={groupFocus} onSelectGroup={focusGroup}
            cam={cam} setCam={setCam} onHover={setHover} onSelect={focusComponent} onMove={moveFactor} />
          <NavRail onZoom={zoom} onFit={fitView} k={cam.k} />
          <LegendBar />
        </div>
        {/* ---- Inputs & inspector - right panel over the canvas, closable ---- */}
        {rightOn ? (
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 360, background: K.paper, borderLeft: `1px solid ${K.rule}`, display: "flex", flexDirection: "column", zIndex: 8 }}>
            <style>{`.trace-scroll{scrollbar-width:thin;scrollbar-color:rgba(122,106,84,.22) transparent}.trace-scroll::-webkit-scrollbar{width:5px;height:5px}.trace-scroll::-webkit-scrollbar-track{background:transparent;border:none}.trace-scroll::-webkit-scrollbar-button{display:none;width:0;height:0}.trace-scroll::-webkit-scrollbar-thumb{background:rgba(122,106,84,.2);border-radius:99px}.trace-scroll:hover::-webkit-scrollbar-thumb{background:rgba(122,106,84,.4)}.trace-scroll::-webkit-scrollbar-corner{background:transparent}`}</style>
            {/* INPUTS — primary controls, on top (its own light label; the padded section) */}
            <div className="trace-scroll" style={{ flexShrink: 0, padding: "16px 12px 13px", display: "flex", flexDirection: "column", gap: 10, maxHeight: "56%", overflowY: "auto" }}>
              <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: K.meta }}>Inputs</span>
              <AddVariablesCTA onPick={() => setPicker(true)} />
              {activeVars.length > 0 && (
                <YourVariables active={activeVars} vars={vars} setVars={setVars} onManage={() => setPicker(true)}
                  onRemove={(k) => setActiveVars((a) => a.filter((x) => x !== k))} dirty={dirty} running={running} onRun={runProtocol} />
              )}
            </div>
            {/* INSPECTOR — light section header (matches the other labels) + detail, BELOW the inputs */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexShrink: 0, padding: "9px 12px 8px", borderTop: `1px solid ${K.rule}`, borderBottom: `1px solid ${K.ruleSoft}` }}>
              <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: K.meta, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selPersonal ? `Inspector · ${selPersonal.label}` : selFactor ? `Inspector · ${selFactor.label}` : "Inspector"}</span>
              {sel && <button onClick={exitFocus} title="Exit focused component (Esc)" style={{ flexShrink: 0, border: `1px solid ${K.rule}`, background: K.paperDeep, color: K.inkSoft, cursor: "pointer", fontFamily: mono, fontSize: 8, letterSpacing: 0.8, textTransform: "uppercase", padding: "2px 6px", borderRadius: 2 }}>Esc · graph</button>}
            </div>
            <div className="trace-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", padding: "4px 12px 14px" }}>
              {selPersonal ? <PersonalDetail d={selPersonal} vars={vars} active={activeVars.includes(selPersonal.id)} onAdd={() => setActiveVars((a) => a.includes(selPersonal.id) ? a : [...a, selPersonal.id])} />
                : selFactor ? (
                  selFactor.id === "trace_core_protocol"
                    ? <ProtocolDetail />
                    : <NodeInvestigation f={selFactor} weight={allWeights[selFactor.id] ?? 0} />
                )
                : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 28px" }}><Empty text="Click a factor (or one of your private variables) on the canvas to inspect it." /></div>}
            </div>
          </div>
        ) : (
          <button onClick={() => setRightOn(true)} title="Show inputs & inspector"
            style={{ position: "absolute", top: 10, right: 10, zIndex: 8, ...iconBtn(false) }}>◧</button>
        )}
      </div>
      {dockOn ? (
        <BottomDock dist={dist} />
      ) : (
        <button onClick={() => setDockOn(true)} title="Show indicators to watch"
          style={{ flexShrink: 0, height: 20, borderTop: `1px solid ${K.rule}`, background: K.paperDeep, cursor: "pointer", fontFamily: mono, fontSize: 8.5, letterSpacing: 1.5, textTransform: "uppercase", color: K.inkSoft }}>＋ Indicators to watch</button>
      )}
      {picker && <VariablePicker initial={activeVars} vars={vars} setVars={setVars} onClose={() => setPicker(false)}
        onConfirm={(keys) => { setActiveVars(keys); setPicker(false); focusPersonalFor(keys); }} />}
    </div>
  );
}

// ---- Header ----------------------------------------------------------------
// Prior / candidate contested topics surfaced in the topic-field focus dropdown.
const TOPIC_SUGGESTIONS: Array<{ topic: string; cat: string; people: number }> = [
  { topic: "Who attacked the Nord Stream pipelines on 26 September 2022?", cat: "Geopolitics", people: 31 },
  { topic: "What's moving the Dutch housing market?", cat: "Housing", people: 12 },
  { topic: "Will the ECB cut rates again in 2026?", cat: "Macro", people: 24 },
  { topic: "Is nuclear the cheapest path to net zero?", cat: "Energy", people: 47 },
  { topic: "Did the COVID-19 lab-leak hypothesis hold up?", cat: "Science", people: 58 },
];

// Contributors = people whose added public source SUSTAINED (un-challenged) into
// the graph. Profile / DM links are fake doors for now. (Current topic's panel.)
interface Contributor { name: string; init: string; color: string; verified: boolean; field: string; cred: number; sources: number; graphs: number; endorsements: number }
const CONTRIBUTORS: Contributor[] = [
  { name: "Dr. Marieke Visser", init: "MV", color: "#1C3A5E", verified: true, field: "Housing economics · DNB", cred: 0.94, sources: 42, graphs: 11, endorsements: 37 },
  { name: "Liang Wei", init: "LW", color: "#5A6E48", verified: true, field: "Demography & migration", cred: 0.89, sources: 28, graphs: 7, endorsements: 24 },
  { name: "Tomás Oliveira", init: "TO", color: "#7A6A54", verified: true, field: "Urban planning · TU Delft", cred: 0.83, sources: 19, graphs: 5, endorsements: 16 },
  { name: "Sanne de Boer", init: "SB", color: "#A03A2C", verified: false, field: "Independent mortgage analyst", cred: 0.71, sources: 12, graphs: 3, endorsements: 8 },
];
// The collaborative graph's current shared read — a one-line conclusion + the
// insights from the graph that sustain it. (Editorial; mirrors NET_READ.)
const GRAPH_READ = {
  dirChip: "↑ rising",
  title: "House prices still rising — but growth is decelerating",
  insights: [
    { text: "Structural shortage, still widening toward 2027", val: "~401k", dir: "up" },
    { text: "Mortgage rates keep borrowing capacity high", val: "3.6%", dir: "down" },
    { text: "Price momentum cooling from its peak", val: "+8.6% YoY", dir: "down" },
    { text: "Investor sell-off opened a brief supply window", val: "-8.6k Q2", dir: "down" },
  ] as Array<{ text: string; val: string; dir: "up" | "down" | "flat" }>,
};
const fakeDoor = (what: string) => alert(`${what} — coming soon`);
function Avatar({ init, color, size = 28 }: { init: string; color: string; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: color, color: K.paper, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: sans, fontWeight: 600, fontSize: Math.round(size * 0.36), flexShrink: 0 }}>{init}</span>;
}
function VerifiedMark() {
  return <span title="Verified contributor" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 13, height: 13, borderRadius: "50%", background: K.warn, color: K.paper, boxShadow: `0 0 0 1.5px ${K.paper}`, fontSize: 8.5, lineHeight: 1, flexShrink: 0 }}>✓</span>;
}
// Fake contributor profile page — the DM / Follow buttons are fake doors.
function ContributorProfile({ c, onClose }: { c: Contributor; onClose: () => void }) {
  const stat = (label: string, val: string | number) => (
    <span key={label} style={{ flex: 1, background: K.paperDeep, borderRadius: 4, padding: "7px 9px", textAlign: "center" }}>
      <span style={{ display: "block", fontFamily: serif, fontSize: 17, color: K.ink, lineHeight: 1 }}>{val}</span>
      <span style={{ display: "block", fontFamily: mono, fontSize: 7.5, letterSpacing: 0.4, textTransform: "uppercase", color: K.meta, marginTop: 3 }}>{label}</span>
    </span>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,18,14,.32)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 352, maxWidth: "92vw", background: K.paper, border: `1px solid ${K.rule}`, borderRadius: 4, boxShadow: "0 14px 44px rgba(0,0,0,.24)", overflow: "hidden" }}>
        <div style={{ height: 50, background: K.meta, position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 8, right: 9, border: "none", background: "rgba(255,255,255,.2)", color: K.paper, width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 12, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: "0 18px 16px" }}>
          <span style={{ position: "relative", zIndex: 1, display: "inline-block", borderRadius: "50%", boxShadow: `0 0 0 3px ${K.paper}, 0 1px 5px rgba(0,0,0,.2)`, marginTop: -26 }}><Avatar init={c.init} color={c.color} size={52} /></span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}><b style={{ fontSize: 16 }}>{c.name}</b>{c.verified && <VerifiedMark />}</div>
          <div style={{ fontFamily: mono, fontSize: 9, color: K.inkMute, marginTop: 2 }}>{c.field}</div>
          <div style={{ margin: "12px 0 11px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 8, letterSpacing: 0.4, textTransform: "uppercase", color: K.meta, marginBottom: 3 }}><span>Contribution credibility</span><span style={{ color: c.cred >= 0.85 ? K.good : K.meta }}>{Math.round(c.cred * 100)}%</span></div>
            <div style={{ height: 5, background: K.paperDeep, border: `1px solid ${K.rule}`, borderRadius: 3, overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${c.cred * 100}%`, background: c.cred >= 0.85 ? K.good : K.meta }} /></div>
          </div>
          <div style={{ display: "flex", gap: 7, marginBottom: 13 }}>
            {stat("sources sustained", c.sources)}
            {stat("graphs", c.graphs)}
            {stat("endorsements", c.endorsements)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => fakeDoor(`Message ${c.name}`)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", border: "none", borderRadius: 3, padding: "9px", cursor: "pointer", color: K.paper, background: K.secondary }}>✉ Message</button>
            <button onClick={() => fakeDoor(`Follow ${c.name}`)} style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", border: `1px solid ${K.rule}`, borderRadius: 3, padding: "9px 14px", cursor: "pointer", color: K.inkSoft, background: K.paper }}>＋ Follow</button>
          </div>
          <div style={{ fontFamily: mono, fontSize: 7.5, color: K.inkMute, textAlign: "center", marginTop: 9 }}>Profile & messaging are demo placeholders</div>
        </div>
      </div>
    </div>
  );
}
function Header({ source, onRun, running, dirty, onFullscreen, isFs, onTogglePanels, panelsOn }: { source: string; onRun: () => void; running: boolean; dirty: boolean; onFullscreen: () => void; isFs: boolean; onTogglePanels: () => void; panelsOn: boolean }) {
  const live = source === "engine" ? "engine live" : source === "offline" ? "offline · fallback" : "loading…";
  const liveCol = source === "engine" ? K.good : source === "offline" ? K.warn : K.inkMute;
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [profile, setProfile] = useState<Contributor | null>(null);
  const topic = "What's moving the Dutch housing market?";
  // topic field has three variants: rest → hover (stretch + lift) → focused (active input + ring + dropdown)
  const expanded = hovered || editing;
  // rest = #EBE4D2 (lighter warm sand); hover lifts a touch lighter;
  // typing clears to white paper for a clean input surface.
  const fieldBg = editing ? K.paper : hovered ? "#F2ECDE" : "#EBE4D2";
  const fieldBorder = editing ? K.secondary : hovered ? K.meta : K.rule;
  const fieldShadow = editing ? "0 0 0 3px rgba(28,58,94,.13)" : hovered ? "0 1px 8px rgba(0,0,0,.07)" : "none";
  const iconColor = editing ? K.secondary : hovered ? K.inkSoft : K.inkMute;
  return (
    <div style={{ height: 58, flexShrink: 0, borderBottom: `1px solid ${K.rule}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 18 }}>
      {/* brand + tagline (visual hierarchy: name → product line → what it is) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          <span style={{ fontFamily: serif, fontSize: 18, letterSpacing: -0.3 }}>Trace</span>
          <span style={{ fontFamily: mono, fontStyle: "italic", fontSize: 9.5, color: K.meta }}>Personal</span>
        </div>
        <div style={{ fontFamily: mono, fontSize: 7.5, letterSpacing: 0.5, textTransform: "uppercase", color: K.inkMute, marginTop: 2 }}>a decision-intelligence cockpit</div>
      </div>
      {/* divider */}
      <div style={{ width: 1, height: 32, background: K.rule, flexShrink: 0 }} />
      {/* topic — input-style field; focus stretches it edge-to-edge + suggests other contested topics */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0, position: "relative" }}>
        <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={() => setEditing(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", maxWidth: expanded ? 9999 : 720, height: 34, background: fieldBg, border: `1px solid ${fieldBorder}`, boxShadow: fieldShadow, borderRadius: 4, padding: "0 6px 0 14px", cursor: "text", transition: "max-width .28s cubic-bezier(.4,0,.2,1), background .2s ease, border-color .2s ease, box-shadow .22s ease" }}>
          {editing ? (
            <input autoFocus defaultValue={topic} placeholder="Search a contested topic to model…"
              onBlur={() => setEditing(false)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.currentTarget as HTMLInputElement).blur(); }}
              style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontFamily: editorial, fontStyle: "italic", fontWeight: 500, fontSize: 16, color: K.ink, outline: "none" }} />
          ) : (
            <span style={{ flex: 1, minWidth: 0, fontFamily: editorial, fontStyle: "italic", fontWeight: 500, fontSize: 16, color: K.ink, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{topic}</span>
          )}
          <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); setEditing((v) => !v); }} title="Change topic — search or re-enter"
            style={{ width: 26, height: 26, flexShrink: 0, border: "none", background: "none", color: iconColor, opacity: expanded ? 1 : 0.7, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "color .2s ease, opacity .2s ease" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="7" /><line x1="15.8" y1="15.8" x2="21" y2="21" /></svg>
          </button>
        </div>
        {editing && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: K.paper, border: `1px solid ${K.rule}`, borderRadius: 4, boxShadow: "0 14px 32px rgba(0,0,0,.18)", padding: "5px 0", zIndex: 50, maxHeight: 420, overflowY: "auto" }}>
            {/* ── current shared understanding of THIS graph + who built it ── */}
            <div style={{ margin: "3px 8px 6px", padding: "10px 12px", background: K.paperDeep, borderRadius: 5 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 7.5, letterSpacing: 1, textTransform: "uppercase", color: K.meta }}>Current understanding · this graph</span>
                {/* overlapping contributor avatars → fake profile pages */}
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "flex" }}>
                    {CONTRIBUTORS.map((c, i) => (
                      <button key={c.name} title={`${c.name} · open profile`} onMouseDown={(e) => e.preventDefault()} onClick={() => setProfile(c)}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.zIndex = "2"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.zIndex = "1"; }}
                        style={{ marginLeft: i ? -6 : 0, padding: 0, border: "none", background: "none", cursor: "pointer", borderRadius: "50%", boxShadow: `0 0 0 1.5px ${K.paperDeep}`, position: "relative", zIndex: 1, transition: "transform .12s" }}>
                        <Avatar init={c.init} color={c.color} size={17} />
                      </button>
                    ))}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 7.5, color: K.inkMute }}>{CONTRIBUTORS.length} contributors</span>
                </span>
              </div>
              {/* core conclusion — direction chip + the read, highlighted as ONE region
                  (warm rust tint + rust rail) to raise contrast while staying in tone.
                  Chip reverted to its outline state. */}
              <div style={{ background: "rgba(90,110,72,.13)", borderRadius: 4, padding: "8px 8px 10px", marginBottom: 10 }}>
                <span style={{ display: "inline-block", fontFamily: mono, fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase", color: K.good, border: `1px solid ${K.good}`, borderRadius: 3, padding: "1px 6px", marginBottom: 6 }}>{GRAPH_READ.dirChip}</span>
                <div style={{ fontFamily: editorial, fontStyle: "italic", fontWeight: 600, fontSize: 16.5, color: K.ink, lineHeight: 1.25 }}>{GRAPH_READ.title}</div>
              </div>
              {/* insights — larger, each with its data/direction justified to the right */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {GRAPH_READ.insights.map((ins) => (
                  <div key={ins.text} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ display: "flex", gap: 7, fontSize: 13.5, color: K.inkSoft, lineHeight: 1.3, minWidth: 0 }}>
                      <span style={{ flexShrink: 0, marginTop: 6, width: 4, height: 4, borderRadius: 2, background: K.good }} />
                      <span>{ins.text}</span>
                    </span>
                    <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: ins.dir === "up" ? K.good : ins.dir === "down" ? K.primary : K.meta, whiteSpace: "nowrap", flexShrink: 0 }}>{ins.dir === "up" ? "\u2191" : ins.dir === "down" ? "\u2193" : ""} {ins.val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ height: 1, background: K.ruleSoft, margin: "0 14px 4px" }} />
            {/* ── other contested topics (with their contributor count) ── */}
            <div style={{ fontFamily: mono, fontSize: 7.5, letterSpacing: 1, textTransform: "uppercase", color: K.meta, padding: "4px 14px 6px" }}>Other contested topics</div>
            {TOPIC_SUGGESTIONS.map((s) => (
              <button key={s.topic} onMouseDown={(e) => e.preventDefault()} onClick={() => setEditing(false)}
                onMouseEnter={(e) => (e.currentTarget.style.background = K.paperDeep)} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", border: "none", background: "none", cursor: "pointer", padding: "8px 14px", textAlign: "left", transition: "background .12s" }}>
                <span style={{ fontFamily: editorial, fontStyle: "italic", fontSize: 14, color: K.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{s.topic}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span title={`${s.people} contributors`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ display: "flex" }}>{["#1C3A5E", "#7A6A54", "#5A6E48"].map((col, i) => <span key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: col, border: `1.5px solid ${K.paper}`, marginLeft: i ? -5 : 0 }} />)}</span>
                    <span style={{ fontFamily: mono, fontSize: 8, color: K.inkMute }}>{s.people}</span>
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 7.5, letterSpacing: 0.5, textTransform: "uppercase", color: K.meta, border: `1px solid ${K.rule}`, borderRadius: 3, padding: "2px 6px", whiteSpace: "nowrap" }}>{s.cat}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* divider — symmetric to the logo divider */}
      <div style={{ width: 1, height: 32, background: K.rule, flexShrink: 0 }} />
      {/* engine · view toggles · run (far right) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span title="Engine status" style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: mono, fontSize: 8.5, letterSpacing: 0.5, textTransform: "uppercase", color: K.inkSoft, whiteSpace: "nowrap", marginRight: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: 6, background: liveCol }} />{live}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onTogglePanels} title={panelsOn ? "Hide side panels" : "Show side panels"} style={iconBtn(!panelsOn)}>{panelsOn ? "◨" : "▭"}</button>
          <button onClick={onFullscreen} title={isFs ? "Exit full screen" : "Full-screen the graph"} style={iconBtn(isFs)}>{isFs ? "⤡" : "⛶"}</button>
        </div>
        <button onClick={onRun} disabled={running} title="Run the Trace core protocol over your edited variables"
          style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", border: "none", borderRadius: 2, padding: "8px 15px", cursor: running ? "default" : "pointer", color: K.paper, background: running ? K.meta : dirty ? K.primary : K.secondary, transition: "background .2s", position: "relative", whiteSpace: "nowrap" }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: running ? 8 : 0, background: K.paper, clipPath: running ? undefined : "polygon(0 0, 100% 50%, 0 100%)", animation: running ? "tracePulse 0.8s infinite" : undefined }} />
          {running ? "Running…" : "Run protocol"}
          {dirty && !running && <span style={{ position: "absolute", top: -3, right: -3, width: 7, height: 7, borderRadius: 7, background: K.warn, border: `1.5px solid ${K.paper}` }} />}
        </button>
      </div>
      <style>{`@keyframes tracePulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
      {profile && <ContributorProfile c={profile} onClose={() => setProfile(null)} />}
    </div>
  );
}
const iconBtn = (on: boolean): React.CSSProperties => ({ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${on ? K.secondary : K.rule}`, background: on ? K.secondary : K.paper, color: on ? K.paper : K.inkSoft, borderRadius: 2, cursor: "pointer", fontFamily: mono, fontSize: 14 });

// ---- NavRail (top-right; collapsed by default, expands on hover) -----------
// ---- TopicBand (full-width band stuck to the top of the canvas: the question) --
function NavRail({ onZoom, onFit, k }: { onZoom: (f: number) => void; onFit: () => void; k: number }) {
  const [open, setOpen] = useState(false);
  const btn = (t: string, fn: () => void, title: string): React.ReactNode =>
    <button key={title} onClick={fn} title={title} style={{ width: 26, height: 24, border: `1px solid ${K.rule}`, background: K.paper, color: K.inkSoft, borderRadius: 2, cursor: "pointer", fontFamily: mono, fontSize: 12 }}>{t}</button>;
  return (
    <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      style={{ position: "absolute", top: 12, left: 12, background: "rgba(250,248,243,.92)", border: `1px solid ${K.rule}`, borderRadius: 3, zIndex: 6, padding: open ? "8px 10px" : "5px 7px", transition: "padding .15s" }}>
      {!open ? (
        <div title="Navigate" style={{ fontFamily: mono, fontSize: 12, color: K.inkSoft, lineHeight: 1, cursor: "default" }}>⤢</div>
      ) : (
        <>
          <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: K.meta, marginBottom: 6 }}>Navigate</div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {btn("−", () => onZoom(1 / 1.2), "Zoom out")}
            <span style={{ width: 34, textAlign: "center", fontFamily: mono, fontSize: 9.5, color: K.inkSoft }}>{Math.round(k * 100)}%</span>
            {btn("+", () => onZoom(1.2), "Zoom in")}
            <button onClick={onFit} title="Fit graph to view" style={{ height: 24, padding: "0 9px", border: `1px solid ${K.rule}`, background: K.paper, color: K.inkSoft, borderRadius: 2, cursor: "pointer", fontFamily: mono, fontSize: 9, letterSpacing: 0.8 }}>FIT</button>
          </div>
          <div style={{ fontFamily: mono, fontSize: 8, color: K.inkMute, marginTop: 6 }}>drag = pan · ⌘±/wheel = zoom</div>
        </>
      )}
    </div>
  );
}

// ---- LegendBar (left of canvas, vertical; order mirrors the lane stack top→bottom) --
function LegendBar() {
  const items: Array<[string, string]> = [["financing", K.secondary], ["demand", K.secondarySoft], ["supply", K.meta], ["policy", K.warn], ["regional", "#6D7162"], ["private", K.good], ["outcome", K.primary]];
  return (
    <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 9, background: "rgba(250,248,243,.5)", borderRadius: 3, padding: "11px 13px", zIndex: 5 }}>
      {items.map(([l, c]) => <span key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: 9.5, color: K.inkSoft }}><span style={{ width: 9, height: 9, borderRadius: 1, background: c, flexShrink: 0 }} />{l}</span>)}
    </div>
  );
}

// ---- right-column pieces ----------------------------------------------------
function AddVariablesCTA({ onPick }: { onPick: () => void }) {
  return (
    <div style={{ border: `1px dashed ${K.secondary}`, borderRadius: 3, padding: "9px 10px", background: "rgba(28,58,94,.04)" }}>
      <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: K.meta, marginBottom: 7 }}>＋ Add a variable</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button style={ctaBtn}>＋ Source <span style={{ color: K.inkMute }}>public</span></button>
        <button onClick={onPick} style={{ ...ctaBtn, borderColor: K.good, color: K.good }}>＋ Personal Variables</button>
      </div>
    </div>
  );
}
const ctaBtn: React.CSSProperties = { flex: 1, fontFamily: mono, fontSize: 9.5, padding: "6px 7px", border: `1px solid ${K.rule}`, borderRadius: 2, background: K.paper, color: K.inkSoft, cursor: "pointer", textAlign: "left" };

// ---- Your variables (control panel for the active private variables) -------
function YourVariables({ active, vars, setVars, onManage, onRemove, dirty, running, onRun }: { active: VarKey[]; vars: Vars; setVars: React.Dispatch<React.SetStateAction<Vars>>; onManage: () => void; onRemove: (k: VarKey) => void; dirty: boolean; running: boolean; onRun: () => void }) {
  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: K.meta, marginBottom: 7 }}>Your variables · private</div>
      {active.map((k) => {
        const d = PERSONAL_VARS.find((x) => x.id === k)!;
        return (
          <div key={k} style={{ borderBottom: `1px solid ${K.ruleSoft}`, padding: "3px 0 7px", marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: "#F0F3EC", border: `1.3px dashed ${K.good}` }} /><b style={{ fontSize: 11.5 }}>{d.label}</b></span>
              <button onClick={() => onRemove(k)} title="Unplug" style={{ border: "none", background: "none", color: K.inkMute, cursor: "pointer", fontSize: 12, lineHeight: 1 }}>✕</button>
            </div>
            {d.kind === "slider"
              ? <Slider label="" val={fmtVar(d, vars)} min={d.min!} max={d.max!} step={d.step!} value={vars[k] as number} onChange={(v) => setVars((s) => ({ ...s, [k]: v } as Vars))} />
              : <label style={{ fontFamily: mono, fontSize: 8.5, color: K.meta, display: "flex", justifyContent: "space-between", marginTop: 6 }}><span>{fmtVar(d, vars).toUpperCase()}</span><input type="checkbox" checked={vars.flex} onChange={(e) => setVars((s) => ({ ...s, flex: e.target.checked }))} style={{ accentColor: K.good }} /></label>}
          </div>
        );
      })}
      <button onClick={onManage} style={{ ...ctaBtn, textAlign: "center", color: K.good, borderColor: K.good }}>＋ Manage private variables</button>
      <button onClick={onRun} disabled={running || !dirty} style={{ width: "100%", marginTop: 7, fontFamily: mono, fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", border: "none", borderRadius: 2, padding: "8px", cursor: dirty && !running ? "pointer" : "default", color: K.paper, background: running ? K.meta : dirty ? K.primary : K.rule, transition: "background .2s" }}>{running ? "Running protocol…" : dirty ? "▶ Run protocol to update" : "✓ Output up to date"}</button>
    </div>
  );
}

// ---- Private variable detail (when a private node is selected) -------------
function PersonalDetail({ d, vars, active, onAdd }: { d: PersonalVarDef; vars: Vars; active: boolean; onAdd: () => void }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 7, height: 14, background: "#F0F3EC", border: `1.3px dashed ${K.good}`, borderRadius: 1 }} /><b style={{ fontSize: 13 }}>{d.label}</b></span>
        <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 18, color: K.good }}>{fmtVar(d, vars)}</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: K.good }}>Private · never leaves device</div>
      <div style={{ fontSize: 11, color: K.inkSoft, lineHeight: 1.45, margin: "7px 0" }}>{d.rationale}</div>
      <div style={{ fontFamily: mono, fontSize: 8.5, color: K.meta, textTransform: "uppercase", margin: "8px 0 3px" }}>Plugged into</div>
      {d.conditions.map((c) => <div key={c} style={{ fontSize: 11, padding: "2px 0", color: K.inkSoft }}>→ {c.replace(/_/g, " ")}</div>)}
      {!active && <button onClick={onAdd} style={{ ...ctaBtn, textAlign: "center", marginTop: 8, color: K.good, borderColor: K.good }}>＋ Add to my variables</button>}
    </div>
  );
}

// ---- Variable picker modal (the Add private-variable flow) -----------------
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Small unit-type glyph so the user reads the input kind at a glance (€ / % / time / region).
function UnitIcon({ unit, id, color }: { unit: string; id: VarKey; color: string }) {
  const p = { width: 13, height: 13, viewBox: "0 0 16 16", fill: "none", stroke: color, strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icon = id === "flex" ? (
    <svg {...p}><path d="M8 14.5s4.5-4.2 4.5-7.5a4.5 4.5 0 1 0-9 0c0 3.3 4.5 7.5 4.5 7.5Z" /><circle cx="8" cy="7" r="1.5" /></svg>
  ) : unit === "pct" ? (
    <svg {...p}><path d="M3.5 12.5 12.5 3.5" /><circle cx="5" cy="5" r="1.5" /><circle cx="11" cy="11" r="1.5" /></svg>
  ) : unit === "yr" ? (
    <svg {...p}><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.3" /></svg>
  ) : (
    <svg {...p}><path d="M10.5 4.5a3.2 3.2 0 0 0-3-1.5c-1.8 0-2.8 1-2.8 2.2 0 2.8 6 1.4 6 4.4 0 1.3-1.1 2.4-3 2.4a3.4 3.4 0 0 1-3.2-1.7" /><path d="M7.5 1.6v12.8" /></svg>
  );
  return <span style={{ display: "inline-flex", width: 24, height: 24, borderRadius: 5, background: K.paperDeep, border: `1px solid ${K.rule}`, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</span>;
}

// Five-dot impact meter — shows how much a variable moves the read, so the user
// spends effort on the inputs that count.
function ImpactMeter({ impact }: { impact: number }) {
  const n = Math.round(impact * 5);
  return (
    <span title={`Impact on the read: ${n}/5`} style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ width: 5, height: 5, borderRadius: 1, background: i < n ? K.secondary : K.ruleSoft }} />)}
    </span>
  );
}

// Typeable number field with an in-field unit affordance (€ prefix / % · yr suffix).
function NumberField({ d, value, onCommit }: { d: PersonalVarDef; value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = parseFloat(draft.replace(/[^0-9.]/g, ""));
    if (!isNaN(n)) onCommit(clamp(d.step && d.step >= 1 ? Math.round(n / d.step) * d.step : n, d.min!, d.max!));
    else setDraft(String(value));
  };
  const suffix = d.unit === "pct" ? "%" : d.unit === "yr" ? "yr" : "";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, border: `1px solid ${K.rule}`, borderRadius: 3, background: K.paper, padding: "3px 6px", width: 96 }}>
      {d.unit === "eur" && <span style={{ fontFamily: mono, fontSize: 10, color: K.meta }}>€</span>}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        inputMode="decimal" style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: mono, fontSize: 11, color: K.ink, textAlign: d.unit === "eur" ? "left" : "right", padding: 0 }} />
      {suffix && <span style={{ fontFamily: mono, fontSize: 10, color: K.meta }}>{suffix}</span>}
    </span>
  );
}

function VariablePicker({ initial, vars, setVars, onClose, onConfirm }: { initial: VarKey[]; vars: Vars; setVars: React.Dispatch<React.SetStateAction<Vars>>; onClose: () => void; onConfirm: (keys: VarKey[]) => void }) {
  const start = initial.length ? initial : PERSONAL_VARS.filter((d) => d.recommended).map((d) => d.id);
  const [sel, setSel] = useState<VarKey[]>(start);
  const [hov, setHov] = useState<VarKey | null>(null);  // faint hover wash (K.good, desaturated)
  const include = (k: VarKey) => setSel((s) => s.includes(k) ? s : [...s, k]);
  const toggle = (k: VarKey) => setSel((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]);
  const setVal = (k: VarKey, v: number | boolean) => { setVars((s) => ({ ...s, [k]: v } as Vars)); include(k); };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,18,14,.32)", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "92vw", maxHeight: "86vh", overflowY: "auto", background: K.paper, border: `1px solid ${K.rule}`, borderRadius: 4, boxShadow: "0 14px 44px rgba(0,0,0,.24)" }}>
        <div style={{ padding: "13px 16px 11px", borderBottom: `1px solid ${K.rule}`, position: "sticky", top: 0, background: K.paper, zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: serif, fontSize: 16 }}>Your private variables</span>
            <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 16, color: K.inkMute, cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: 0.6, textTransform: "uppercase", color: K.good, marginTop: 4 }}>● Private · never leaves your device · ordered by impact</div>
        </div>
        {/* preset roles — one click fills all private variables for that persona, then tweak below */}
        <div style={{ padding: "11px 16px", borderBottom: `1px solid ${K.rule}` }}>
          <div style={{ fontFamily: mono, fontSize: 7.5, letterSpacing: 0.8, textTransform: "uppercase", color: K.inkMute, marginBottom: 6 }}>Start from a profile</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {DEMO_PRESETS.map((preset) => (
              <button key={preset.id} onClick={() => { setVars((s) => ({ ...s, ...preset.vars } as Vars)); setSel(preset.active); }} title={`Apply ${preset.label}`}
                onMouseEnter={(e) => (e.currentTarget.style.background = K.paperDeep)} onMouseLeave={(e) => (e.currentTarget.style.background = K.paper)}
                style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, width: "100%", border: `1px solid ${K.rule}`, borderRadius: 3, background: K.paper, cursor: "pointer", padding: "6px 9px", textAlign: "left", transition: "background .12s" }}>
                <span style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "baseline", gap: 8 }}>
                  <b style={{ fontSize: 11.5 }}>{preset.label}</b>
                  <span style={{ fontFamily: mono, fontSize: 8, color: K.secondary, whiteSpace: "nowrap", flexShrink: 0 }}>{preset.advice}</span>
                </span>
                <span style={{ fontFamily: mono, fontSize: 8, color: K.inkMute }}>{preset.sub}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: "4px 16px 2px" }}>
          {PERSONAL_VARS.map((d) => {
            const on = sel.includes(d.id);
            return (
              <div key={d.id} onMouseEnter={() => setHov(d.id)} onMouseLeave={() => setHov(null)}
                style={{ margin: "0 -16px", padding: "11px 16px", borderBottom: `1px solid ${K.ruleSoft}`, opacity: on ? 1 : 0.62, background: hov === d.id ? "rgba(90,110,72,0.07)" : "transparent", transition: "opacity .15s, background .12s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(d.id)} title={on ? "Unplug from graph" : "Plug into graph"} style={{ accentColor: K.good, width: 14, height: 14, flexShrink: 0 }} />
                  <UnitIcon unit={d.unit} id={d.id} color={K.secondary} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <b style={{ fontSize: 12.5 }} title={d.rationale}>{d.label}</b>
                      {d.recommended && <span style={{ fontFamily: mono, fontSize: 7, letterSpacing: 0.4, textTransform: "uppercase", color: K.good, border: `1px solid ${K.good}`, borderRadius: 2, padding: "0 3px" }}>rec</span>}
                    </span>
                    <span style={{ display: "block", fontSize: 10, color: K.inkMute, lineHeight: 1.35, marginTop: 1 }}>{d.hint}</span>
                  </span>
                  <ImpactMeter impact={d.impact} />
                </div>
                {/* direct-manipulation control row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, paddingLeft: 33 }}>
                  {d.kind === "slider" ? (
                    <>
                      <span style={{ flex: 1, display: "flex", alignItems: "center" }}>
                        <RangeInput min={d.min!} max={d.max!} step={d.step!} value={vars[d.id] as number} onChange={(v) => setVal(d.id, v)} />
                      </span>
                      <NumberField d={d} value={vars[d.id] as number} onCommit={(v) => setVal(d.id, v)} />
                    </>
                  ) : (
                    <button onClick={() => setVal(d.id, !vars.flex)} role="switch" aria-checked={vars.flex}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "none", background: "none", cursor: "pointer", padding: 0, fontFamily: mono, fontSize: 10.5, color: K.inkSoft }}>
                      <span style={{ width: 34, height: 18, borderRadius: 9, background: vars.flex ? K.good : K.rule, position: "relative", transition: "background .15s" }}>
                        <span style={{ position: "absolute", top: 2, left: vars.flex ? 18 : 2, width: 14, height: 14, borderRadius: "50%", background: K.paper, transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
                      </span>
                      <span>{vars.flex ? "Yes — open to moving" : "No — fixed region"}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${K.rule}`, position: "sticky", bottom: 0, background: K.paper }}>
          <span style={{ fontFamily: mono, fontSize: 9.5, color: K.inkMute }}>{sel.length} plugged into graph</span>
          <span style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ fontFamily: mono, fontSize: 11, padding: "7px 14px", border: `1px solid ${K.rule}`, borderRadius: 2, background: K.paper, color: K.inkSoft, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => onConfirm(sel)} style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, padding: "7px 16px", border: "none", borderRadius: 2, background: K.good, color: K.paper, cursor: "pointer" }}>Plug into graph</button>
          </span>
        </div>
      </div>
    </div>
  );
}

function ScenarioBars({ dist }: { dist: { w: Record<string, number> } }) {
  const arr = SCENARIOS.map(([id]) => [id, dist.w[id]] as [string, number]).sort((a, b) => b[1] - a[1]);
  return (<>
    {arr.map(([id, v], i) => (
      <div key={id} style={{ marginBottom: 5 }}>
        <div style={{ height: 13, background: K.paperDeep, border: `1px solid ${K.rule}`, borderRadius: 2, position: "relative" }}>
          <span style={{ position: "absolute", inset: "0 auto 0 0", width: `${v * 100}%`, background: i === 0 ? K.primary : K.secondary }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 3, color: i === 0 ? K.primary : K.inkSoft, fontWeight: i === 0 ? 600 : 400 }}><span>{SCEN_LABEL[id]}</span><span>{(v * 100).toFixed(0)}%</span></div>
      </div>
    ))}
  </>);
}

function WorkPanel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", left: 12, top: 12, width: 300, maxHeight: "calc(100% - 76px)", overflowY: "auto", background: "rgba(250,248,243,.94)", border: `1px solid ${K.rule}`, borderRadius: 4, boxShadow: "0 8px 24px rgba(0,0,0,.10)", padding: 10, zIndex: 6, display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: K.meta }}>Facts · evidence · variables</div>
      {children}
    </div>
  );
}

function OutputColumn({ dist, dirty, advice, hasVars, factors, weights }: { dist: { w: Record<string, number> }; dirty: boolean; advice: { headline: string; body: string } | null; hasVars: boolean; factors: CanvasFactor[]; weights: Record<string, number> }) {
  const tiny = { fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase" as const, color: K.meta };
  const topScenario = Object.entries(dist.w).sort((a, b) => b[1] - a[1])[0];
  const topDrivers = factors
    .filter((f) => f.category !== "outcome" && f.weightReady !== false && (weights[f.id] ?? 0) > 0)
    .sort((a, b) => (weights[b.id] ?? 0) - (weights[a.id] ?? 0))
    .slice(0, 4);
  const adviceText = advice
    ? advice.body
    : hasVars
      ? "Run the protocol to turn the current variables into a private recommendation."
      : "Add private variables to convert the public market read into a personal decision.";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <section style={{ border: `1px solid ${K.rule}`, borderRadius: 4, padding: 12, background: K.paper }}>
        <div style={{ ...tiny, display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span>Market read</span>{dirty && <span style={{ color: K.warn }}>stale · run</span>}</div>
        <div style={{ display: "inline-block", background: PRICE_COLOR[NET_READ.dir], color: K.paper, fontFamily: sans, fontWeight: 650, fontSize: 15, padding: "5px 12px", borderRadius: 2, opacity: dirty ? 0.55 : 1 }}>{ARROW[NET_READ.dir]} {NET_READ.value}</div>
        <div style={{ fontFamily: sans, fontSize: 11.5, color: K.inkSoft, lineHeight: 1.42, marginTop: 8 }}>{NET_READ.note}</div>
      </section>
      <section style={{ border: `1px solid ${K.rule}`, borderRadius: 4, padding: 12, background: K.paper }}>
        <div style={{ ...tiny, marginBottom: 8 }}>Possibility distribution</div>
        <ScenarioBars dist={dist} />
        {topScenario && <div style={{ marginTop: 8, fontFamily: sans, fontSize: 11.5, color: K.inkSoft }}>Current lead: <b style={{ color: K.ink }}>{SCEN_LABEL[topScenario[0]]}</b> at {(topScenario[1] * 100).toFixed(0)}%.</div>}
      </section>
      <section style={{ border: `1px solid ${K.rule}`, borderRadius: 4, padding: 12, background: K.paper }}>
        <div style={{ ...tiny, marginBottom: 8 }}>Drivers behind the read</div>
        {topDrivers.map((f) => (
          <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${K.ruleSoft}` }}>
            <span style={{ fontFamily: sans, fontSize: 11.5, color: K.ink }}>{f.label}</span>
            <span style={{ fontFamily: serif, fontStyle: "italic", color: CAT_COLOR[f.category], fontSize: 15 }}>{Math.round((weights[f.id] ?? 0) * 100)}%</span>
          </div>
        ))}
      </section>
      <section style={{ border: `1px solid ${advice ? K.good : K.rule}`, borderRadius: 4, padding: 12, background: advice ? "#F0F3EC" : K.paper }}>
        <div style={{ ...tiny, color: advice ? K.good : K.meta, marginBottom: 8 }}>Actionable advice</div>
        <div style={{ fontFamily: editorial, fontStyle: "italic", fontSize: 16, color: K.ink, lineHeight: 1.2, marginBottom: 6 }}>{advice?.headline ?? "Personal call pending"}</div>
        <div style={{ fontFamily: sans, fontSize: 11.5, color: K.inkSoft, lineHeight: 1.45 }}>{adviceText}</div>
      </section>
    </div>
  );
}

// ---- on-canvas Output: the conclusions, drawn in the same card language as the
// graph factors, grouped by level: L0 public read · L1 ranked hypotheses · L2 your call.
const SCEN_META: Record<string, { color: string; note: string; dir: "up" | "down" | "flat" }> = {
  shortage_dominates: { color: K.meta, note: "Structural shortage keeps lifting prices.", dir: "up" },
  financing_pressure: { color: K.secondary, note: "Rates & borrowing capacity set the pace.", dir: "up" },
  investor_window: { color: K.warn, note: "Investor sell-offs open a brief entry window.", dir: "down" },
  regional_divergence: { color: "#6D7162", note: "The national read hides big local gaps.", dir: "flat" },
  user_constraint: { color: K.good, note: "Your own budget is the binding factor.", dir: "flat" },
};
// Indicators worth watching for each read — they'd move this hypothesis if they cross.
const SCEN_IND: Record<string, string[]> = {
  shortage_dominates: ["shortage", "permits"],
  financing_pressure: ["rate", "price", "forecast"],
  investor_window: ["investor"],
  regional_divergence: ["demography"],
  user_constraint: ["rate", "price"],
};
// A conclusion card — mirrors the graph factor card: accent rail · mono label · serif
// figure · bold name · note · weight bar.
function OutcomeCard({ accent, label, name, value, pct, bar, note, hi, apex }: { accent: string; label?: string; name?: string; value?: string; pct?: number; bar?: number; note?: string; hi?: boolean; apex?: boolean }) {
  return (
    <div style={{ position: "relative", background: apex ? "#F4E4E0" : hi ? "rgba(160,58,44,.05)" : K.paper, border: `1px solid ${apex || hi ? K.primary : K.rule}`, borderRadius: 2, padding: "7px 10px 8px 14px", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: accent }} />
      {(label || pct != null) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
          {label && <span style={{ fontFamily: mono, fontSize: 7.5, letterSpacing: 0.6, textTransform: "uppercase", color: K.inkMute }}>{label}</span>}
          {pct != null && <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 14, color: hi ? K.primary : K.ink }}>{pct}%</span>}
        </div>
      )}
      {value && <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 18, lineHeight: 1.1, color: K.primary, margin: "3px 0 2px" }}>{value}</div>}
      {name && <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 12, color: K.ink, marginTop: 1 }}>{name}</div>}
      {note && <div style={{ fontFamily: sans, fontSize: 9.5, color: K.inkSoft, lineHeight: 1.35, marginTop: 2 }}>{note}</div>}
      {bar != null && (
        <div style={{ height: 4, background: K.paperDeep, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
          <div style={{ width: `${Math.max(0, Math.min(100, Math.round(bar)))}%`, height: "100%", background: hi ? K.primary : accent, transition: "width .3s" }} />
        </div>
      )}
    </div>
  );
}
// NOTE: conclusions render as ON-CANVAS factor cards (see conclNodes in TraceWorkspace),
// NOT as a separate side panel. The old OutputPanel side-panel was removed by decision
// 2026-06-21 — do not reintroduce it.

// ---- Read detail (when a conclusion/read node is selected): probability + meaning
//      + the real factors that drive it (grounded in f.support). -----------------
function ReadDetail({ scen, factors }: { scen: { id: string; label: string; w: number }; factors: CanvasFactor[] }) {
  const drivers = factors.filter((f) => (f.support?.[scen.id] ?? 0) > 0).sort((a, b) => (b.support[scen.id] ?? 0) - (a.support[scen.id] ?? 0)).slice(0, 6);
  const watch = INDICATORS.filter((i) => SCEN_IND[scen.id]?.includes(i.id));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 4, height: 15, background: K.primary, borderRadius: 1 }} /><b style={{ fontSize: 13.5 }}>{scen.label}</b></span>
        <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 21, color: K.primary }}>{Math.round(scen.w * 100)}%</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: K.meta }}>Hypothesis · relative support</div>
      <div style={{ fontSize: 11.5, color: K.inkSoft, lineHeight: 1.45, margin: "7px 0 11px" }}>{SCEN_META[scen.id]?.note}</div>
      <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: K.meta, marginBottom: 4 }}>Driven by ({drivers.length})</div>
      {drivers.length ? drivers.map((f) => (
        <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11, padding: "3px 0", borderBottom: `1px solid ${K.ruleSoft}` }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: CAT_COLOR[f.category], flexShrink: 0 }} /><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.label}</span></span>
          <span style={{ fontFamily: mono, fontSize: 9, color: K.inkMute, flexShrink: 0 }}>s {(f.support[scen.id] ?? 0).toFixed(2)}</span>
        </div>
      )) : <Empty text="No mapped supporting factors yet." />}
      {watch.length > 0 && (<>
        <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: K.meta, margin: "10px 0 4px" }}>Watch to flip</div>
        {watch.map((i) => <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, padding: "2px 0", color: K.inkSoft }}><span>{i.label}</span><span style={{ fontFamily: mono, fontSize: 9, color: K.warn }}>{i.nowVal}{i.unit} → {i.lineVal}{i.unit}</span></div>)}
      </>)}
    </div>
  );
}
// ---- Your-call detail (the personal decision node) -------------------------
function CallDetail({ advice, active }: { advice: { headline: string; body: string }; active: VarKey[] }) {
  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: K.good, display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: "#F0F3EC", border: `1.3px dashed ${K.good}` }} />Your call · private</div>
      <div style={{ fontFamily: editorial, fontStyle: "italic", fontWeight: 500, fontSize: 16.5, color: K.ink, lineHeight: 1.2, marginBottom: 7 }}>{advice.headline}</div>
      <div style={{ fontSize: 11.5, color: K.inkSoft, lineHeight: 1.5 }}>{advice.body}</div>
      <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: K.meta, margin: "11px 0 4px" }}>Conditioned on</div>
      {active.length ? active.map((k) => { const d = PERSONAL_VARS.find((x) => x.id === k); return <div key={k} style={{ fontSize: 11, padding: "2px 0", color: K.inkSoft }}>→ {d?.label ?? k}</div>; }) : <div style={{ fontSize: 10.5, color: K.inkMute, lineHeight: 1.4 }}>No private variables added yet — add some to personalise this call.</div>}
    </div>
  );
}
// Evidence-type taxonomy → short human labels (mirrors the engine's classification).
const STATUS_LABEL: Record<string, string> = {
  methodology_or_definition: "definition",
  model_estimate: "model estimate",
  forecast_or_expectation: "forecast",
  policy_target_or_proposal: "policy target",
  analysis_or_news_claim: "news / analysis",
  risk_warning_or_scenario: "risk / scenario",
  review_needed: "unclassified",
};
// top_metrics lines are "**name** | value | detail" (or a "## heading" to skip).
function parseMetric(line: string): { name: string; value: string; detail?: string } | null {
  const t = (line || "").trim();
  if (!t || t.startsWith("#")) return null;
  const parts = t.split("|").map((s) => s.replace(/\*\*/g, "").trim());
  if (parts.length === 1) return parts[0] ? { name: parts[0], value: "" } : null;
  return { name: parts[0], value: parts[1], detail: parts.slice(2).join(" · ") || undefined };
}
function MetaChip({ text, color }: { text: string; color?: string }) {
  return <span style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: 0.3, color: color ?? K.inkSoft, background: color ? `${color}1A` : K.paperDeep, border: `1px solid ${color ? `${color}55` : K.rule}`, borderRadius: 7, padding: "1px 7px", whiteSpace: "nowrap" }}>{text}</span>;
}
function priceDirOf(dir?: string): { a: string; t: string; c: string } {
  const d = (dir || "").toLowerCase();
  if (/support|up|rais|raise|widen/.test(d)) return { a: "↑", t: "lifts price", c: K.good };
  if (/down|lower|eas|cool|shrink/.test(d)) return { a: "↓", t: "eases price", c: K.primary };
  if (/confound/.test(d)) return { a: "↮", t: "confounds the read", c: K.meta };
  if (/amplif|both|reflex/.test(d)) return { a: "↕", t: "amplifies both ways", c: K.meta };
  if (/conditioning/.test(d)) return { a: "→", t: "conditions the read", c: K.good };
  if (/contested|band|not_settled/.test(d)) return { a: "?", t: "direction contested", c: K.warn };
  return { a: "→", t: "direction not classified", c: K.inkMute };
}
// Bespoke inspector for the Trace Core Protocol node — explains the engine at the
// product-narrative level only. Deliberately conceptual: it describes the SHAPE of
// what the engine does, never the scoring method / internals (proprietary).
function ProtocolDetail() {
  const sec = { fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase" as const, color: K.meta, margin: "13px 0 6px" };
  const steps: Array<[string, string]> = [
    ["Ground", "Facts, sources and claims enter as typed, provenance-bearing evidence — every number traces back to where it came from."],
    ["Frame", "Candidate market-states and optional expert structure set the question up as competing explanations, not one answer."],
    ["Weigh", "The engine scores how strongly each factor backs each scenario and forms a distribution across them — the same inputs always give the same result."],
    ["Adjudicate", "Claims resolve as settled or contested; coverage gaps and the next decisive test are surfaced rather than hidden."],
    ["Condition", "Your private variables re-weight the shared structure for you — changing the read, never the underlying evidence."],
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><span style={{ width: 4, height: 15, background: K.secondary, borderRadius: 1, flexShrink: 0 }} /><b style={{ fontSize: 13.5, lineHeight: 1.2 }}>Trace Core Protocol</b></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}><span style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: `6px solid ${K.secondary}` }} /><span style={{ fontFamily: mono, fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase", color: K.secondary }}>engine</span></span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        <MetaChip text="deterministic" color={K.good} />
        <MetaChip text="auditable" />
        <MetaChip text="provenance-bearing" />
      </div>
      <div style={{ fontSize: 11.5, color: K.inkSoft, lineHeight: 1.45, margin: "9px 0 0" }}>
        The causal-reasoning layer behind every read on this canvas. It turns sourced evidence and expert structure into an auditable, repeatable distribution — a read you can trace, not a narrative that was generated. The same inputs always produce the same answer.
      </div>
      <div style={sec}>How it works</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map(([t, d], i) => (
          <div key={t} style={{ display: "flex", gap: 8 }}>
            <span style={{ flexShrink: 0, fontFamily: mono, fontSize: 9, fontWeight: 600, color: K.secondary, width: 13 }}>{i + 1}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: mono, fontSize: 9, letterSpacing: 0.4, textTransform: "uppercase", color: K.ink }}>{t}</span>
              <span style={{ display: "block", fontSize: 11.5, color: K.inkSoft, lineHeight: 1.4, marginTop: 1 }}>{d}</span>
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 13, padding: "8px 10px", background: K.paperDeep, borderRadius: 4, fontFamily: mono, fontSize: 9, color: K.inkMute, lineHeight: 1.5 }}>
        The scoring method itself is proprietary. The cockpit shows the read, its evidence, and the trace that produced it — never the internals.
      </div>
    </div>
  );
}
function NodeInvestigation({ f, weight }: { f: CanvasFactor; weight: number }) {
  const catName: Record<Category, string> = { financing: "Financing", demand: "Demand", supply: "Supply", policy: "Policy", regional: "Regional", personal: "Personal", outcome: "Outcome" };
  const hasWeight = f.weightReady !== false && Object.keys(f.support).length > 0;
  const pd = priceDirOf(f.directionOnPrices);
  const metrics = (f.metrics || []).map(parseMetric).filter((m): m is { name: string; value: string; detail?: string } => !!m);
  const shownMetrics = metrics.slice(0, 5);
  const moreMetrics = Math.max(0, (f.metricCount ?? metrics.length) - shownMetrics.length);
  const statusEntries = Object.entries(f.evidenceStatus || {}).sort((a, b) => b[1] - a[1]);
  const sources = f.sources || [];
  const sec = { fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase" as const, color: K.meta, margin: "12px 0 6px" };
  return (
    <div>
      {/* header: category rail · name · Pearl weight */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><span style={{ width: 4, height: 15, background: CAT_COLOR[f.category], borderRadius: 1, flexShrink: 0 }} /><b style={{ fontSize: 13.5, lineHeight: 1.2 }}>{f.label}</b></span>
        <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 18, flexShrink: 0 }} title="Pearl-conditioned weight">{hasWeight ? `${Math.round(weight * 100)}%` : "w —"}</span>
      </div>
      {/* read-at-a-glance chips: category · price direction · settled/contested */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        <MetaChip text={catName[f.category]} />
        <MetaChip text={`${pd.a} ${pd.t}`} color={pd.c} />
        <MetaChip text={f.contested ? "contested" : "settled"} color={f.contested ? K.warn : K.good} />
      </div>
      {(f.mechanism || f.summary) && <div style={{ fontSize: 11.5, color: K.inkSoft, lineHeight: 1.4, margin: "8px 0 0" }}>{f.mechanism || f.summary}</div>}

      {/* WHAT THE DATA SAYS — the extracted metric data-points */}
      {shownMetrics.length > 0 && (<>
        <div style={sec}>What the data says</div>
        {shownMetrics.map((m, i) => (
          <div key={i} title={m.detail} style={{ padding: "4px 0", borderBottom: `1px solid ${K.ruleSoft}` }}>
            <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: 0.3, textTransform: "uppercase", color: K.inkMute }}>{m.name}</div>
            {m.value && <div style={{ fontSize: 12.5, color: K.ink, lineHeight: 1.3, marginTop: 1 }}>{m.value}</div>}
          </div>
        ))}
        {moreMetrics > 0 && <div style={{ fontFamily: mono, fontSize: 8.5, color: K.inkMute, marginTop: 5 }}>+{moreMetrics} more data points</div>}
      </>)}

      {/* CONFIDENCE & EVIDENCE — how solid, and of what kind */}
      <div style={sec}>Confidence &amp; evidence</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 6 }}>
        {f.avgConfidence != null && <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 17, color: K.ink, lineHeight: 1 }}>{f.avgConfidence}%</span>}
        <span style={{ fontFamily: mono, fontSize: 8.5, color: K.inkMute, letterSpacing: 0.2 }}>{f.avgConfidence != null ? "avg confidence · " : ""}{f.metricCount ?? metrics.length} data points · {f.sourceCount ?? sources.length} sources</span>
      </div>
      {statusEntries.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {statusEntries.map(([s, n]) => <MetaChip key={s} text={`${STATUS_LABEL[s] || s} · ${n}`} />)}
        </div>
      )}

      {/* SOURCES — the actual documents (provenance-tagged) */}
      {sources.length > 0 && (<>
        <div style={sec}>Sources</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {sources.slice(0, 4).map((s, i) => (
            <a key={i} href={s.url || undefined} target="_blank" rel="noopener" style={{ display: "block", textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 1 }}>
                <span style={{ fontFamily: mono, fontSize: 7.5, color: K.inkMute }}>{s.domain}</span>
                {s.origin === "cala" && <span style={{ fontFamily: serif, fontSize: 7.5, lineHeight: 1, color: K.meta, background: "rgba(184,144,46,.18)", border: "1px solid rgba(184,144,46,.5)", borderRadius: 6, padding: "0 5px" }}>cala</span>}
              </div>
              <div style={{ fontSize: 11, color: K.secondary, lineHeight: 1.3 }}>{s.label} ↗</div>
            </a>
          ))}
          {sources.length > 4 && <div style={{ fontFamily: mono, fontSize: 8.5, color: K.inkMute }}>+{sources.length - 4} more sources</div>}
        </div>
      </>)}

      {/* SUPPORTS SCENARIOS — the engine's support distribution */}
      {Object.keys(f.support).length > 0 && (<>
        <div style={sec}>Supports scenarios</div>
        {Object.entries(f.support).sort((a, b) => b[1] - a[1]).map(([c, s]) => (
          <div key={c} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span>{SCEN_LABEL[c] || c}</span><span style={{ fontFamily: mono, color: K.inkMute }}>s {s.toFixed(2)}</span></div>
        ))}
      </>)}
    </div>
  );
}

// ---- BottomDock (indicators to watch) --------------------------------------
const ARROW = { up: "↑", down: "↓", flat: "→", neutral: "→" } as const;
const PRICE_COLOR = { up: K.good, down: K.primary, neutral: K.meta } as const;   // rising = green, falling = red

// cala wordmark — served from app/public/cala_logo.png.
function CalaMark({ height = 15 }: { height?: number }) {
  return <img src="/cala_logo.png" alt="cala" style={{ height, width: "auto", display: "block" }} />;
}

function BottomDock({ dist }: { dist: { w: Record<string, number> } }) {
  const [hoverInd, setHoverInd] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const dot = { ok: K.good, watch: K.warn, breach: K.primary } as const;
  const priceColor = PRICE_COLOR;
  const tiny = { fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase" as const, color: K.meta };
  const sorted = [...INDICATORS].sort((a, b) => b.priceStrength - a.priceStrength);
  // Force balance is derived from the ENGINE scenario distribution (dist.w) by each
  // scenario's price direction — NOT the hand-set indicator strengths. Flat scenarios
  // (no clear up/down push) are excluded from the up-vs-down balance.
  const fb = SCENARIOS.map(([id, label]) => ({ id, label, w: dist.w[id] ?? 0, dir: SCEN_META[id]?.dir }))
    .filter((s) => s.dir === "up" || s.dir === "down");
  const upScens = fb.filter((s) => s.dir === "up"), downScens = fb.filter((s) => s.dir === "down");
  const upSum = upScens.reduce((a, s) => a + s.w, 0), downSum = downScens.reduce((a, s) => a + s.w, 0);
  const fbTotal = upSum + downSum || 1, upPct = Math.round((upSum / fbTotal) * 100);
  // hovering an indicator highlights the scenario segments it feeds (SCEN_IND reverse lookup).
  const fbSeg = (s: { id: string; label: string; w: number }, color: string) => {
    const related = !hoverInd || (SCEN_IND[s.id]?.includes(hoverInd) ?? false);
    return <div key={s.id} title={`${s.label}: ${Math.round((s.w / fbTotal) * 100)}% of the up/down read`} style={{ width: `${(s.w / fbTotal) * 100}%`, background: color, opacity: related ? 1 : 0.28, borderRight: `1px solid ${K.paper}`, transition: "opacity .15s" }} />;
  };
  return (
    <div style={{ flexShrink: 0, borderTop: `1px solid ${K.rule}`, padding: "7px 16px 8px", background: K.paper }}>
      {/* ── header: indicators to watch · force balance (merged one line) ── */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <span style={tiny}>Indicators to watch</span>
        <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={tiny} title="Share of the conditioned market read pushing price up vs down — from the engine scenario distribution">Force balance</span>
            <span style={{ display: "inline-flex", width: 120, height: 5, borderRadius: 3, overflow: "hidden", border: `1px solid ${K.rule}`, alignSelf: "center" }}>
              {upScens.map((s) => fbSeg(s, K.good))}{downScens.map((s) => fbSeg(s, K.primary))}
            </span>
            <span style={{ fontFamily: mono, fontSize: 9, whiteSpace: "nowrap" }}><span style={{ color: K.good }}>↑ {upPct}%</span> <span style={{ color: K.inkMute }}>vs</span> <span style={{ color: K.primary }}>↓ {100 - upPct}%</span></span>
          </span>
          <button title="Track a variable of your own" onClick={() => alert("Add your own indicator to track — coming soon")}
            style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: mono, fontSize: 8.5, letterSpacing: 0.5, textTransform: "uppercase", color: K.secondary, background: "rgba(28,58,94,.04)", border: `1px dashed ${K.secondary}`, borderRadius: 2, padding: "3px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 12, lineHeight: 1 }}>＋</span> Add indicator
          </button>
        </span>
      </div>
      {/* ── indicators as distance-to-trigger gauges: now-marker(○) · trigger-tick(│) · gap=how far ── */}
      <style>{`.trace-indrow{scrollbar-width:none;-ms-overflow-style:none}.trace-indrow::-webkit-scrollbar{display:none;height:0}`}</style>
      <div ref={rowRef} className="trace-indrow"
        onPointerDown={(e) => { if (rowRef.current) drag.current = { x: e.clientX, left: rowRef.current.scrollLeft }; }}
        onPointerMove={(e) => { if (drag.current && rowRef.current) rowRef.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x); }}
        onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}
        style={{ display: "flex", gap: 8, overflowX: "auto", cursor: "grab", userSelect: "none" }}>
        {sorted.map((ind) => {
          const hot = hoverInd === ind.id;
          const clamp = (x: number) => Math.max(0, Math.min(1, x));
          const mk = clamp((ind.nowVal - ind.lo) / (ind.hi - ind.lo)), tk = clamp((ind.lineVal - ind.lo) / (ind.hi - ind.lo));
          const fmt = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}${ind.unit}`;
          const unitFull = ind.unit === "k/q" ? "thousand per quarter" : ind.unit === "k" ? "thousand" : ind.unit === "%" ? "percent" : ind.unit === "pp" ? "percentage points" : ind.unit;
          const toLine = Math.abs(ind.nowVal - ind.lineVal), gapL = Math.min(mk, tk), gapW = Math.abs(mk - tk);
          const psc = priceColor[ind.priceSignal], fill = Math.round(ind.priceStrength * 3);
          const ddc = ind.deltaDir === "up" ? K.good : ind.deltaDir === "down" ? K.primary : K.inkMute;
          return (
            <div key={ind.id} title={ind.note} onMouseEnter={() => setHoverInd(ind.id)} onMouseLeave={() => setHoverInd(null)}
              style={{ flex: "1 1 0", minWidth: 158, border: `1px solid ${hot ? K.secondary : K.rule}`, borderRadius: 2, padding: "9px 11px 10px", background: hot ? "rgba(28,58,94,.035)" : K.paper, display: "flex", flexDirection: "column", gap: 7, transition: "border-color .15s, background .15s" }}>
              {/* name · effect on PRICE — labelled, derived from the LEVEL (not the change) */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 6, background: dot[ind.state], flexShrink: 0 }} />
                  <b style={{ fontSize: 11.5, lineHeight: 1.15 }}>{ind.label}</b>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} title={`its level pushes price ${ind.priceSignal} · strength ${Math.round(ind.priceStrength * 100)}%`}>
                  <span style={{ fontFamily: mono, fontSize: 7, letterSpacing: 0.5, textTransform: "uppercase", color: K.inkMute }}>price</span>
                  <span style={{ fontFamily: mono, fontSize: 12, color: psc, lineHeight: 1 }}>{ARROW[ind.priceSignal]}</span>
                  <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, height: 11 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 3, height: 3 + i * 3.5, borderRadius: 0.5, background: i < fill ? psc : K.ruleSoft }} />)}</span>
                </span>
              </div>
              {/* the metric reading: current VALUE + its recent CHANGE (delta) — distinct from
                  the price effect above. A high level can still push price up while the value
                  is falling (e.g. net migration 87k, ↓16k = cooling but still adding demand). */}
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <b title={`${ind.nowVal} ${unitFull}`} style={{ fontFamily: mono, fontSize: 15, color: K.ink, lineHeight: 1 }}>{fmt(ind.nowVal)}</b>
                <span title="change vs prior period" style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: K.paper, background: ddc, borderRadius: 8, padding: "2px 6px", whiteSpace: "nowrap", lineHeight: 1 }}>Δ {ind.delta} {ARROW[ind.deltaDir]}</span>
              </div>
              {/* gauge cluster — labels live on separate rows (above / below the track) so they
                  can never overlap: delta-to-go ABOVE, centred in the gap; trigger value BELOW,
                  under its tick and emphasized as the anchor. Positions clamp off the edges. */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ position: "relative", height: 11, fontFamily: mono, fontSize: 7.5 }}>
                  <span style={{ position: "absolute", left: `${Math.max(15, Math.min(85, (gapL + gapW / 2) * 100))}%`, transform: "translateX(-50%)", color: K.warn, fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(toLine)} to trigger</span>
                </div>
                <div style={{ position: "relative", height: 14, display: "flex", alignItems: "center" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2, background: K.paperDeep }} />
                  <div style={{ position: "absolute", left: `${gapL * 100}%`, width: `${gapW * 100}%`, height: 4, borderRadius: 2, background: "rgba(184,144,46,.32)" }} />
                  <div style={{ position: "absolute", left: `${tk * 100}%`, transform: "translateX(-50%)", width: 2, height: 13, borderRadius: 1, background: K.ink }} />
                  <div style={{ position: "absolute", left: `${mk * 100}%`, transform: "translateX(-50%)", width: 10, height: 10, borderRadius: 10, background: K.paper, border: `2px solid ${psc}` }} />
                </div>
                <div style={{ position: "relative", height: 13, fontFamily: mono, fontSize: 9 }}>
                  <span style={{ position: "absolute", left: `${Math.max(8, Math.min(92, tk * 100))}%`, transform: "translateX(-50%)", whiteSpace: "nowrap" }}><span style={{ color: K.inkMute, fontSize: 7 }}>trigger </span><b style={{ color: K.ink }}>{fmt(ind.lineVal)}</b></span>
                </div>
              </div>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5, fontFamily: mono, fontSize: 7.5, color: K.inkMute, letterSpacing: 0.2 }}>
                <span>src · {ind.source}</span>
                {ind.viaCala && <span style={{ fontFamily: serif, fontSize: 8, lineHeight: 1, color: K.meta, background: "rgba(184,144,46,.18)", border: `1px solid rgba(184,144,46,.5)`, borderRadius: 7, padding: "1px 6px" }}>cala</span>}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 7, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, flexWrap: "wrap", fontFamily: mono, fontSize: 9, color: K.inkMute, letterSpacing: 0.2 }}>
        <span>Values from the</span>
        <span style={{ display: "inline-flex", alignItems: "center" }}><CalaMark height={12} />-derived</span>
        <span>timeseries knowledge graph · 2026 June</span>
      </div>
    </div>
  );
}

// ---- shared small components -----------------------------------------------
function FoldSection({ title, defaultOpen, children, tone }: { title: string; defaultOpen?: boolean; children: React.ReactNode; tone?: string }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ border: `1px solid ${K.rule}`, borderRadius: 2, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 9px", background: tone ?? K.secondary, color: K.paper, border: "none", cursor: "pointer", fontFamily: mono, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>
        <span>{title}</span><span>{open ? "▾" : "▸"}</span>
      </button>
      {open && <div style={{ padding: "10px 11px" }}>{children}</div>}
    </div>
  );
}
// Custom range slider — green (personal) theme; filled track via an inline gradient,
// thumb/track shape via the .trace-range style at the root. Reused everywhere.
function RangeInput({ min, max, step, value, onChange }: { min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
  return (
    <input type="range" className="trace-range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ width: "100%", background: `linear-gradient(to right, ${K.good} 0%, ${K.good} ${pct}%, ${K.ruleSoft} ${pct}%, ${K.ruleSoft} 100%)` }} />
  );
}
function Slider({ label, val, min, max, step, value, onChange }: { label: string; val: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (<>
    <label style={{ fontFamily: mono, fontSize: 8.5, color: K.meta, textTransform: "uppercase", display: "flex", justifyContent: "space-between", margin: "7px 0 2px" }}><span>{label}</span><span>{val}</span></label>
    <RangeInput min={min} max={max} step={step} value={value} onChange={onChange} />
  </>);
}
function Empty({ text }: { text: string }) { return <div style={{ fontFamily: mono, fontSize: 10, color: K.inkMute, lineHeight: 1.5 }}>{text}</div>; }
