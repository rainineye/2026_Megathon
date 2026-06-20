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
  CW, CH, VBW, VBH,
  type CanvasFactor, type CanvasEdge, type Vars, type Category, type VarKey, type PersonalVarDef,
} from "./trace/model";

const mono = "'JetBrains Mono', monospace", sans = "'Instrument Sans', sans-serif", serif = "'Fraunces', serif";
const editorial = "'Newsreader', 'Fraunces', serif";
const SCEN_LABEL = Object.fromEntries(SCENARIOS.map(([id, l]) => [id, l]));

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
  const [cam, setCam] = useState({ x: 0, y: 0, k: 1 });
  const [engineDist, setEngineDist] = useState<Record<string, number> | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const splitDrag = useRef<{ sx: number; cx: number } | null>(null);
  const prevActive = useRef(0);

  useEffect(() => {
    let alive = true;
    fetchFactorTree()
      .then((res) => { const a = adaptFactorTree(res); if (alive && a) { setFactors(a.factors); setEdges(a.edges); setSource("engine"); } else if (alive) setSource("offline"); })
      .catch(() => alive && setSource("offline"));
    runDefaultTier()
      .then((res) => {
        const support = (res.support ?? res.distribution ?? res.candidate_support) as Record<string, number> | undefined;
        if (alive && support) setEngineDist(support);
      })
      .catch(() => { if (alive) setEngineDist(null); });
    return () => { alive = false; };
  }, []);

  // focus divider drag — PANS the one canvas horizontally (reveals more input vs
  // outcome); nothing reflows, the divider is just a locator.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!splitDrag.current || !bodyRef.current) return;
      const w = bodyRef.current.getBoundingClientRect().width || 1;
      const nx = splitDrag.current.cx + ((e.clientX - splitDrag.current.sx) / w) * VBW;
      setCam((c) => ({ ...c, x: nx }));
    };
    const up = () => { splitDrag.current = null; };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
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
  const dist = conditionDistribution(applied, appliedActive, engineDist);
  const weights = engineDist ? factorWeights(factors, dist.w) : {};
  const displayFactors = engineDist ? factors : factors.map((f) => ({ ...f, weightReady: false }));
  const personal = personalLayer(activeVars, vars);
  const advice = personalAdvice(applied, appliedActive, dist.w);
  const panelsOn = rightOn || dockOn;
  const togglePanels = () => { const v = !(rightOn || dockOn); setRightOn(v); setDockOn(v); };
  const selFactor = sel ? factors.find((f) => f.id === sel) || null : null;
  const selPersonal = sel?.startsWith("pv_") ? PERSONAL_VARS.find((d) => `pv_${d.id}` === sel) || null : null;
  const dirty = JSON.stringify(activeVars.slice().sort()) !== JSON.stringify(appliedActive.slice().sort())
    || activeVars.some((k) => vars[k] !== applied[k]);
  const moveFactor = (id: string, x: number, y: number) => setFactors((fs) => fs.map((f) => f.id === id ? { ...f, x, y } : f));
  const zoom = (f: number) => setCam((c) => { const p = { x: 470, y: 300 }; const nk = Math.max(0.45, Math.min(2.6, c.k * f)); const wx = (p.x - c.x) / c.k, wy = (p.y - c.y) / c.k; return { x: p.x - wx * nk, y: p.y - wy * nk, k: nk }; });
  const fitView = () => {
    const boxes = [
      ...factors.map((f) => ({ x: f.x, y: f.y, w: CW, h: CH })),
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

  // run the core protocol over the edited variables → commit the conditioned snapshot.
  const runProtocol = async () => {
    if (running) return;
    setRunning(true);
    try {
      const res = await runDefaultTier({ personal_variables: { ...vars } });
      const support = (res.support ?? res.distribution ?? res.candidate_support) as Record<string, number> | undefined;
      if (support) setEngineDist(support);
      setApplied(vars);
      setAppliedActive(activeVars);
    } finally {
      setRunning(false);
    }
  };
  const toggleFullscreen = () => {
    const el = rootRef.current; if (!el) return;   // full-screen the WHOLE workspace (for presenting)
    if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.();
  };
  useEffect(() => {
    const fn = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);
  // reveal the left private gutter the moment the first variable is plugged in.
  useEffect(() => {
    if (activeVars.length > 0 && prevActive.current === 0) setCam({ x: 196, y: 8, k: 0.84 });
    if (activeVars.length === 0 && prevActive.current > 0) setCam({ x: 0, y: 0, k: 1 });
    prevActive.current = activeVars.length;
  }, [activeVars.length]);

  return (
    <div ref={rootRef} style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: K.paper, color: K.ink, fontFamily: sans, overflow: "hidden" }}>
      <Header source={source} onRun={runProtocol} running={running} dirty={dirty}
        onFullscreen={toggleFullscreen} isFs={isFs} onTogglePanels={togglePanels} panelsOn={panelsOn} />
      <div ref={bodyRef} style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {/* ---- canvas — FULL viewport width; an internal divider splits graph | outcome ---- */}
        <div ref={canvasRef} style={{ position: "absolute", inset: 0, overflow: "hidden", background: K.paper }}>
          <CanvasGraph factors={displayFactors} edges={edges} weights={weights} personal={personal} sel={sel} hover={hover}
            cam={cam} setCam={setCam} onHover={setHover} onSelect={setSel} onMove={moveFactor} />
          <NavRail onZoom={zoom} onFit={fitView} k={cam.k} />
          <LegendBar />
        </div>
        {/* focus divider — a locator; drag to PAN the one canvas: reveal more input (←) or outcome (→). Nothing reflows. */}
        <div onPointerDown={(e) => { splitDrag.current = { sx: e.clientX, cx: cam.x }; }} title="Drag to reveal more input (←) or outcome (→)"
          style={{ position: "absolute", top: 0, bottom: 0, right: "34%", width: 11, cursor: "col-resize", zIndex: 7, display: "flex", justifyContent: "center" }}
          onMouseEnter={(e) => ((e.currentTarget.firstElementChild as HTMLElement).style.background = K.inkMute)}
          onMouseLeave={(e) => ((e.currentTarget.firstElementChild as HTMLElement).style.background = K.rule)}>
          <div style={{ width: 1, height: "100%", background: K.rule, transition: "background .15s" }} />
        </div>
        {/* ---- Inputs & inspector — right panel over the canvas (same fill, no shadow), closable ---- */}
        {rightOn ? (
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 360, background: K.paper, borderLeft: `1px solid ${K.rule}`, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10, zIndex: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: K.meta }}>Inputs</span>
              <button onClick={() => setRightOn(false)} title="Hide panel" style={{ border: "none", background: "none", color: K.inkMute, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 2 }}>✕</button>
            </div>
            <AddVariablesCTA onPick={() => setPicker(true)} />
            {activeVars.length > 0 && (
              <YourVariables active={activeVars} vars={vars} setVars={setVars} onManage={() => setPicker(true)}
                onRemove={(k) => setActiveVars((a) => a.filter((x) => x !== k))} dirty={dirty} running={running} onRun={runProtocol} />
            )}
            <FoldSection title={selPersonal ? `Inspector · ${selPersonal.label}` : selFactor ? `Inspector · ${selFactor.label}` : "Inspector"} defaultOpen>
              {selPersonal ? <PersonalDetail d={selPersonal} vars={vars} active={activeVars.includes(selPersonal.id)} onAdd={() => setActiveVars((a) => a.includes(selPersonal.id) ? a : [...a, selPersonal.id])} />
                : selFactor ? <NodeInvestigation f={selFactor} weight={weights[selFactor.id] ?? 0} />
                : <Empty text="Click a factor (or one of your private variables) on the canvas to inspect it." />}
            </FoldSection>
            {!selPersonal && selFactor?.evidence && (
              <FoldSection title="Evidence" defaultOpen>
                <div style={{ fontSize: 12, lineHeight: 1.45 }}>{selFactor.evidence.claim}</div>
                {selFactor.evidence.url && <a href={selFactor.evidence.url} target="_blank" rel="noopener" style={{ display: "inline-block", marginTop: 7, color: K.secondary, fontSize: 10, fontFamily: mono }}>{selFactor.evidence.source} ↗</a>}
              </FoldSection>
            )}
          </div>
        ) : (
          <button onClick={() => setRightOn(true)} title="Show inputs & inspector"
            style={{ position: "absolute", top: 10, right: 10, zIndex: 8, ...iconBtn(false) }}>◧</button>
        )}
      </div>
      {dockOn ? (
        <BottomDock onClose={() => setDockOn(false)} />
      ) : (
        <button onClick={() => setDockOn(true)} title="Show indicators to watch"
          style={{ flexShrink: 0, height: 20, borderTop: `1px solid ${K.rule}`, background: K.paperDeep, cursor: "pointer", fontFamily: mono, fontSize: 8.5, letterSpacing: 1.5, textTransform: "uppercase", color: K.inkSoft }}>＋ Indicators to watch</button>
      )}
      {picker && <VariablePicker initial={activeVars} vars={vars} setVars={setVars} onClose={() => setPicker(false)}
        onConfirm={(keys) => { setActiveVars(keys); setPicker(false); }} />}
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
interface Contributor { name: string; init: string; color: string; verified: boolean; field: string; cred: number; sources: number; graphs: number }
const CONTRIBUTORS: Contributor[] = [
  { name: "Dr. Marieke Visser", init: "MV", color: "#1C3A5E", verified: true, field: "Housing economics · DNB", cred: 0.94, sources: 42, graphs: 11 },
  { name: "Liang Wei", init: "LW", color: "#5A6E48", verified: true, field: "Demography & migration", cred: 0.89, sources: 28, graphs: 7 },
  { name: "Tomás Oliveira", init: "TO", color: "#7A6A54", verified: true, field: "Urban planning · TU Delft", cred: 0.83, sources: 19, graphs: 5 },
  { name: "Sanne de Boer", init: "SB", color: "#A03A2C", verified: false, field: "Independent mortgage analyst", cred: 0.71, sources: 12, graphs: 3 },
];
// The collaborative graph's current shared read — a one-line conclusion + the
// insights from the graph that sustain it. (Editorial; mirrors NET_READ.)
const GRAPH_READ = {
  dirChip: "↑ rising",
  title: "House prices still rising — but growth is decelerating",
  insights: [
    "Structural shortage ~401k homes, still widening toward 2027",
    "Mortgage rates near 3.6% keep borrowing capacity high",
    "Price momentum +8.6% YoY, but cooling from the peak",
    "Investor sell-off has opened a brief supply window",
  ],
};
const fakeDoor = (what: string) => alert(`${what} — coming soon`);
function Avatar({ init, color, size = 28 }: { init: string; color: string; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: color, color: K.paper, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: sans, fontWeight: 600, fontSize: Math.round(size * 0.36), flexShrink: 0 }}>{init}</span>;
}
function VerifiedMark() {
  return <span title="Verified contributor" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 12, height: 12, borderRadius: "50%", background: K.secondary, color: K.paper, fontSize: 8, lineHeight: 1, flexShrink: 0 }}>✓</span>;
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
        <div style={{ height: 50, background: c.color, position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 8, right: 9, border: "none", background: "rgba(255,255,255,.2)", color: K.paper, width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 12, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: "0 18px 16px" }}>
          <span style={{ display: "inline-block", borderRadius: "50%", boxShadow: `0 0 0 3px ${K.paper}`, marginTop: -26 }}><Avatar init={c.init} color={c.color} size={52} /></span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}><b style={{ fontSize: 16 }}>{c.name}</b>{c.verified && <VerifiedMark />}</div>
          <div style={{ fontFamily: mono, fontSize: 9, color: K.inkMute, marginTop: 2 }}>{c.field}</div>
          <div style={{ margin: "12px 0 11px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 8, letterSpacing: 0.4, textTransform: "uppercase", color: K.meta, marginBottom: 3 }}><span>Contribution credibility</span><span style={{ color: c.cred >= 0.85 ? K.good : K.meta }}>{Math.round(c.cred * 100)}%</span></div>
            <div style={{ height: 5, background: K.paperDeep, border: `1px solid ${K.rule}`, borderRadius: 3, overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${c.cred * 100}%`, background: c.cred >= 0.85 ? K.good : K.meta }} /></div>
          </div>
          <div style={{ display: "flex", gap: 7, marginBottom: 13 }}>
            {stat("sources sustained", c.sources)}
            {stat("graphs", c.graphs)}
            {stat("verified", c.verified ? "yes" : "—")}
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
  const fieldBg = editing ? K.paper : hovered ? K.paper : "#EFE9DB";
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
            <div style={{ padding: "6px 14px 9px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontFamily: mono, fontSize: 7.5, letterSpacing: 1, textTransform: "uppercase", color: K.meta }}>Current understanding · this graph</span>
                {/* overlapping contributor avatars → fake profile pages (count after) */}
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "flex" }}>
                    {CONTRIBUTORS.map((c, i) => (
                      <button key={c.name} title={`${c.name} · open profile`} onMouseDown={(e) => e.preventDefault()} onClick={() => setProfile(c)}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.zIndex = "2"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.zIndex = "1"; }}
                        style={{ marginLeft: i ? -8 : 0, padding: 0, border: "none", background: "none", cursor: "pointer", borderRadius: "50%", boxShadow: `0 0 0 1.5px ${K.paper}`, position: "relative", zIndex: 1, transition: "transform .12s" }}>
                        <Avatar init={c.init} color={c.color} size={22} />
                      </button>
                    ))}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 7.5, color: K.inkMute }}>{CONTRIBUTORS.length} people</span>
                </span>
              </div>
              <div style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 7 }}>
                <span style={{ marginTop: 2, fontFamily: mono, fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase", color: K.primary, border: `1px solid ${K.primary}`, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap", flexShrink: 0 }}>{GRAPH_READ.dirChip}</span>
                <span style={{ fontFamily: editorial, fontStyle: "italic", fontSize: 15, color: K.ink, lineHeight: 1.25 }}>{GRAPH_READ.title}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {GRAPH_READ.insights.map((t) => (
                  <span key={t} style={{ display: "flex", gap: 7, fontSize: 10.5, color: K.inkSoft, lineHeight: 1.35 }}>
                    <span style={{ flexShrink: 0, marginTop: 5, width: 4, height: 4, borderRadius: 2, background: K.good }} />
                    <span>{t}</span>
                  </span>
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

// ---- LegendBar (bottom of canvas, spread horizontally) --------------------
function LegendBar() {
  const items: Array<[string, string]> = [["financing", K.secondary], ["demand", K.secondarySoft], ["supply", K.meta], ["policy", K.warn], ["regional", "#6D7162"], ["price", K.primary], ["private", K.good]];
  return (
    <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexWrap: "wrap", background: "rgba(250,248,243,.45)", borderRadius: 3, padding: "6px 14px", zIndex: 5 }}>
      {items.map(([l, c]) => <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: mono, fontSize: 9.5, color: K.inkSoft }}><span style={{ width: 9, height: 9, borderRadius: 1, background: c }} />{l}</span>)}
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
    <FoldSection title="Your variables · private" defaultOpen>
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
    </FoldSection>
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
      {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ width: 5, height: 5, borderRadius: 1, background: i < n ? K.primary : K.ruleSoft }} />)}
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
                      <input type="range" min={d.min} max={d.max} step={d.step} value={vars[d.id] as number}
                        onChange={(e) => setVal(d.id, parseFloat(e.target.value))}
                        style={{ flex: 1, accentColor: on ? K.primary : K.inkMute }} />
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
const SCEN_META: Record<string, { color: string; note: string }> = {
  shortage_dominates: { color: K.meta, note: "Structural shortage keeps lifting prices." },
  financing_pressure: { color: K.secondary, note: "Rates & borrowing capacity set the pace." },
  investor_window: { color: K.warn, note: "Investor sell-offs open a brief entry window." },
  regional_divergence: { color: "#6D7162", note: "The national read hides big local gaps." },
  user_constraint: { color: K.good, note: "Your own budget is the binding factor." },
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
function OutputPanel({ dist, dirty, advice, hasVars, width = 300, rightOffset = 0 }: { dist: { w: Record<string, number> }; dirty: boolean; advice: { headline: string; body: string } | null; hasVars: boolean; width?: number; rightOffset?: number }) {
  const tiny = { fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase" as const, color: K.meta };
  const scen = SCENARIOS.map(([id, label]) => ({ id, label, w: dist.w[id] ?? 0 })).sort((a, b) => b.w - a.w);
  return (
    <div style={{ position: "absolute", top: 0, right: rightOffset, bottom: 0, width, overflowY: "auto", background: K.paper, backgroundImage: "radial-gradient(rgba(207,200,182,.5) 0.9px, transparent 1px)", backgroundSize: "26px 26px", backgroundPosition: "13px 13px", padding: "12px 14px", zIndex: 3, transition: "right .12s", display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ ...tiny, display: "flex", justifyContent: "space-between" }}><span>Outcome conclusions</span>{dirty && <span style={{ color: K.warn }}>stale · run</span>}</div>

      {/* L0 — the headline read (public) */}
      <div style={{ ...tiny, color: K.primary }}>The read · public</div>
      <OutcomeCard apex accent={K.primary} label="Net price read" value={`${ARROW[NET_READ.dir]} ${NET_READ.value}`} note={NET_READ.note} />

      {/* L1 — competing hypotheses, ranked by support */}
      <div style={{ ...tiny, marginTop: 3 }}>All possibilities · ranked</div>
      {scen.map((s, i) => (
        <OutcomeCard key={s.id} accent={SCEN_META[s.id]?.color ?? K.secondary}
          label={i === 0 ? "Leading hypothesis" : `Hypothesis ${i + 1}`} name={s.label}
          pct={Math.round(s.w * 100)} bar={s.w * 100} note={SCEN_META[s.id]?.note} hi={i === 0} />
      ))}

      {/* L2 — the personal call (private) */}
      <div style={{ ...tiny, color: K.good, marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: "#F0F3EC", border: `1.3px dashed ${K.good}` }} />Your call · private</div>
      {advice ? (
        <div style={{ position: "relative", background: "rgba(90,110,72,.06)", border: `1px solid ${K.good}`, borderRadius: 2, padding: "7px 10px 8px 14px", overflow: "hidden", opacity: dirty ? 0.55 : 1 }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: K.good }} />
          <div style={{ fontFamily: mono, fontSize: 7.5, letterSpacing: 0.6, textTransform: "uppercase", color: K.good, marginBottom: 2 }}>Your decision</div>
          <div style={{ fontFamily: editorial, fontStyle: "italic", fontWeight: 500, fontSize: 14, color: K.ink, lineHeight: 1.2, marginBottom: 3 }}>{advice.headline}</div>
          <div style={{ fontFamily: sans, fontSize: 10, color: K.inkSoft, lineHeight: 1.4 }}>{advice.body}</div>
        </div>
      ) : (
        <div style={{ border: `1px dashed ${K.good}`, borderRadius: 2, background: "rgba(90,110,72,.05)", padding: "8px 10px", fontFamily: sans, fontSize: 10, color: K.inkSoft, lineHeight: 1.4 }}>{hasVars ? "Run the protocol to generate your personal decision." : "Add your private variables, then run — to turn this read into a decision for you."}</div>
      )}
    </div>
  );
}

function NodeInvestigation({ f, weight }: { f: CanvasFactor; weight: number }) {
  const catName: Record<Category, string> = { financing: "Financing", demand: "Demand", supply: "Supply", policy: "Policy", regional: "Regional", personal: "Personal", outcome: "Outcome" };
  const hasWeight = f.weightReady !== false && Object.keys(f.support).length > 0;
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "3px 0", borderBottom: `1px solid ${K.ruleSoft}` }}><span style={{ color: K.inkMute, fontFamily: mono, fontSize: 9 }}>{k}</span><span style={{ color: K.ink }}>{v}</span></div>;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 4, height: 14, background: CAT_COLOR[f.category], borderRadius: 1 }} /><b style={{ fontSize: 13 }}>{f.label}</b></span>
        <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 18 }}>{hasWeight ? `${Math.round(weight * 100)}%` : "w —"}</span>
      </div>
      <Row k="category" v={catName[f.category]} />
      <Row k="current" v={<>{f.value} {f.trend}</>} />
      <Row k="evidence" v={`${f.evidenceCount} items · ${f.credibility}`} />
      <Row k="status" v={<span style={{ color: f.contested ? K.warn : K.good }}>{f.contested ? "contested" : "settled"}</span>} />
      {f.mechanism && <div style={{ fontSize: 11, color: K.inkSoft, margin: "7px 0", lineHeight: 1.4 }}>{f.mechanism}</div>}
      {Object.keys(f.support).length > 0 && (<>
        <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: K.meta, margin: "8px 0 4px" }}>Supports scenarios</div>
        {Object.entries(f.support).sort((a, b) => b[1] - a[1]).map(([c, s]) => (
          <div key={c} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span>{SCEN_LABEL[c] || c}</span><span style={{ fontFamily: mono, color: K.inkMute }}>s {s.toFixed(2)}</span></div>
        ))}
      </>)}
    </div>
  );
}

// ---- BottomDock (indicators to watch) --------------------------------------
const ARROW = { up: "↑", down: "↓", flat: "→", neutral: "→" } as const;
const PRICE_COLOR = { up: K.primary, down: K.secondary, neutral: K.meta } as const;

// cala wordmark — served from app/public/cala_logo.png.
function CalaMark({ height = 15 }: { height?: number }) {
  return <img src="/cala_logo.png" alt="cala" style={{ height, width: "auto", display: "block" }} />;
}

function BottomDock({ onClose }: { onClose: () => void }) {
  const [hoverInd, setHoverInd] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const dot = { ok: K.good, watch: K.warn, breach: K.primary } as const;
  const priceColor = PRICE_COLOR;
  const tiny = { fontFamily: mono, fontSize: 8, letterSpacing: 1, textTransform: "uppercase" as const, color: K.meta };
  const sorted = [...INDICATORS].sort((a, b) => b.priceStrength - a.priceStrength);
  const ups = sorted.filter((i) => i.priceSignal === "up"), downs = sorted.filter((i) => i.priceSignal === "down");
  const upSum = ups.reduce((s, i) => s + i.priceStrength, 0), downSum = downs.reduce((s, i) => s + i.priceStrength, 0);
  const total = upSum + downSum || 1, upPct = Math.round((upSum / total) * 100);
  const seg = (i: typeof INDICATORS[number], color: string) => {
    const hot = hoverInd === i.id;
    return <div key={i.id} title={`${i.label}: pushes price ${i.priceSignal} · strength ${Math.round(i.priceStrength * 100)}%`}
      onMouseEnter={() => setHoverInd(i.id)} onMouseLeave={() => setHoverInd(null)}
      style={{ width: `${(i.priceStrength / total) * 100}%`, background: color, opacity: hoverInd && !hot ? 0.35 : 1, borderRight: `1px solid ${K.paper}`, cursor: "default", transition: "opacity .15s" }} />;
  };
  return (
    <div style={{ flexShrink: 0, borderTop: `1px solid ${K.rule}`, padding: "7px 16px 8px", background: K.paper }}>
      {/* ── header: indicators to watch · force balance (merged one line) ── */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <span style={tiny}>Indicators to watch</span>
        <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={tiny}>Force balance</span>
            <span style={{ display: "inline-flex", width: 120, height: 5, borderRadius: 3, overflow: "hidden", border: `1px solid ${K.rule}`, alignSelf: "center" }}>
              {ups.map((i) => seg(i, K.primary))}{downs.map((i) => seg(i, K.secondary))}
            </span>
            <span style={{ fontFamily: mono, fontSize: 9, whiteSpace: "nowrap" }}><span style={{ color: K.primary }}>↑ {upPct}%</span> <span style={{ color: K.inkMute }}>vs</span> <span style={{ color: K.secondary }}>↓ {100 - upPct}%</span></span>
          </span>
          <button title="Track a variable of your own" onClick={() => alert("Add your own indicator to track — coming soon")}
            style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: mono, fontSize: 8.5, letterSpacing: 0.5, textTransform: "uppercase", color: K.secondary, background: "rgba(28,58,94,.04)", border: `1px dashed ${K.secondary}`, borderRadius: 2, padding: "3px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 12, lineHeight: 1 }}>＋</span> Add indicator
          </button>
          <button onClick={onClose} title="Close indicators" style={{ border: "none", background: "none", color: K.inkMute, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "0 2px" }}>✕</button>
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
          const dist = Math.abs(ind.nowVal - ind.lineVal), gapL = Math.min(mk, tk), gapW = Math.abs(mk - tk);
          const psc = priceColor[ind.priceSignal], fill = Math.round(ind.priceStrength * 3);
          const ddc = ind.deltaDir === "up" ? K.primary : ind.deltaDir === "down" ? K.secondary : K.inkMute;
          return (
            <div key={ind.id} title={ind.note} onMouseEnter={() => setHoverInd(ind.id)} onMouseLeave={() => setHoverInd(null)}
              style={{ flex: "1 1 0", minWidth: 158, border: `1px solid ${hot ? K.secondary : K.rule}`, borderRadius: 2, padding: "9px 11px 10px", background: hot ? "rgba(28,58,94,.035)" : K.paper, display: "flex", flexDirection: "column", gap: 7, transition: "border-color .15s, background .15s" }}>
              {/* name · price direction + quantified strength */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 6, background: dot[ind.state], flexShrink: 0 }} />
                  <b style={{ fontSize: 11.5, lineHeight: 1.15 }}>{ind.label}</b>
                  <span title="change vs prior period" style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, color: ddc, whiteSpace: "nowrap", flexShrink: 0 }}>{ARROW[ind.deltaDir]} {ind.delta}</span>
                </span>
                <span style={{ display: "flex", alignItems: "flex-end", gap: 3, flexShrink: 0 }} title={`pushes price ${ind.priceSignal} · strength ${Math.round(ind.priceStrength * 100)}%`}>
                  <span style={{ fontFamily: mono, fontSize: 12, color: psc, lineHeight: 1 }}>{ARROW[ind.priceSignal]}</span>
                  <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, height: 11 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 3, height: 3 + i * 3.5, borderRadius: 0.5, background: i < fill ? psc : K.ruleSoft }} />)}</span>
                </span>
              </div>
              {/* gauge: now-marker(○) · trigger-tick(│) · gap = how far to the line */}
              <div style={{ position: "relative", height: 14, display: "flex", alignItems: "center" }}>
                <div style={{ position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2, background: K.paperDeep }} />
                <div style={{ position: "absolute", left: `${gapL * 100}%`, width: `${gapW * 100}%`, height: 4, borderRadius: 2, background: "rgba(184,144,46,.32)" }} />
                <div style={{ position: "absolute", left: `${tk * 100}%`, transform: "translateX(-50%)", width: 2, height: 13, borderRadius: 1, background: K.ink }} />
                <div style={{ position: "absolute", left: `${mk * 100}%`, transform: "translateX(-50%)", width: 10, height: 10, borderRadius: 10, background: K.paper, border: `2px solid ${psc}` }} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 4, fontFamily: mono, fontSize: 8 }}>
                <span style={{ color: K.inkSoft }}>now <b style={{ color: K.ink }}>{fmt(ind.nowVal)}</b></span>
                <span style={{ color: K.warn, fontWeight: 600 }}>{fmt(dist)} to line</span>
                <span style={{ color: K.inkMute }}>line {fmt(ind.lineVal)}</span>
              </div>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5, fontFamily: mono, fontSize: 7.5, color: K.inkMute, letterSpacing: 0.2 }}>
                <span>src · {ind.source}</span>
                {ind.viaCala && <span style={{ fontFamily: serif, fontSize: 8, lineHeight: 1, color: K.meta, background: "rgba(184,144,46,.18)", border: `1px solid rgba(184,144,46,.5)`, borderRadius: 7, padding: "1px 6px" }}>cala</span>}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 7, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, flexWrap: "wrap", fontFamily: mono, fontSize: 9, color: K.inkSoft, letterSpacing: 0.2 }}>
        <span>Values from the</span>
        <span style={{ display: "inline-flex", alignItems: "center" }}><CalaMark height={12} />-derived</span>
        <span>timeseries knowledge graph · 2026 June</span>
      </div>
    </div>
  );
}

// ---- shared small components -----------------------------------------------
function FoldSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ border: `1px solid ${K.rule}`, borderRadius: 2, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 9px", background: K.secondary, color: K.paper, border: "none", cursor: "pointer", fontFamily: mono, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>
        <span>{title}</span><span>{open ? "▾" : "▸"}</span>
      </button>
      {open && <div style={{ padding: "10px 11px" }}>{children}</div>}
    </div>
  );
}
function Slider({ label, val, min, max, step, value, onChange }: { label: string; val: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (<>
    <label style={{ fontFamily: mono, fontSize: 8.5, color: K.meta, textTransform: "uppercase", display: "flex", justifyContent: "space-between", margin: "7px 0 2px" }}><span>{label}</span><span>{val}</span></label>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: "100%", accentColor: K.secondary }} />
  </>);
}
function Empty({ text }: { text: string }) { return <div style={{ fontFamily: mono, fontSize: 10, color: K.inkMute, lineHeight: 1.5 }}>{text}</div>; }
