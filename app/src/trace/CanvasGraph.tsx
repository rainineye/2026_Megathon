import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAT_COLOR,
  CH,
  CW,
  GRID,
  K,
  PROTOCOL_H,
  PROTOCOL_W,
  PROTOTYPE_H,
  PROTOTYPE_W,
  VBH,
  VBW,
  curve,
  nodeSize,
  snap,
  type CanvasEdge,
  type CanvasFactor,
  type FactorGroup,
  type PersonalNode
} from "./model";

const PW = 146;
const PH = 54;

// Area bands mirror the horizontal module coordinates in model.ts.
const GROUPS: Array<{ id: FactorGroup; title: string; sub: string; x: number; y: number; w: number; h: number; color: string }> = [
  { id: "affordability", title: "FINANCING / DEMAND", sub: "subdrivers → financing pressure", x: 52, y: 52, w: 546, h: 900, color: K.secondary },
  { id: "macro_demand", title: "MACRO ECONOMY", sub: "population / labour / liquidity → demand", x: 650, y: 52, w: 546, h: 900, color: K.secondarySoft },
  { id: "supply_side", title: "SUPPLY SIDE", sub: "grid / nitrogen blockers → pipeline → shortage", x: 1248, y: 52, w: 546, h: 900, color: K.meta },
  { id: "policy_supply", title: "POLICY SUPPLY", sub: "Box 3 + rental policy → investor supply", x: 1846, y: 52, w: 546, h: 900, color: K.warn },
  { id: "regional", title: "REGIONAL / LOCAL", sub: "local tightness → regional divergence", x: 2444, y: 52, w: 546, h: 900, color: "#6D7162" },
  { id: "personal", title: "PERSONAL VARIABLES", sub: "private fit layer; conditions the read", x: 3042, y: 52, w: 546, h: 900, color: K.good },
];

interface Cam {
  x: number;
  y: number;
  k: number;
}

interface Props {
  factors: CanvasFactor[];
  edges: CanvasEdge[];
  weights: Record<string, number>;
  personal?: { nodes: PersonalNode[]; edges: CanvasEdge[] };
  lead?: string;   // id of the leading read/conclusion node → rust emphasis
  sel: string | null;
  hover: string | null;
  groupFocus?: FactorGroup | null;            // a focused lane (clicking its band) → all its nodes readable
  onSelectGroup?: (g: FactorGroup) => void;   // click a lane background to focus the whole group
  cam: Cam;
  setCam: (updater: (c: Cam) => Cam) => void;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onClearFocus?: () => void;
  onMove: (id: string, x: number, y: number) => void;
  onDragNode?: (id: string | null) => void;   // reports the node being dragged (for drag-to-inspect)
}

function wrapLabel(label: string, limit = 20) {
  const words = label.split(/\s+/);
  const lines = [""];
  for (const word of words) {
    const current = lines[lines.length - 1];
    const next = current ? `${current} ${word}` : word;
    if (next.length > limit && lines.length < 2) lines.push(word);
    else lines[lines.length - 1] = next;
  }
  return lines.map((line) => (line.length > limit + 2 ? `${line.slice(0, limit)}...` : line));
}

function displayRole(node: CanvasFactor) {
  if (node.role === "driver") return `${node.category} driver`;
  if (node.role === "subfactor") return `${node.category} input`;
  if (node.role === "root") return "market state";
  if (node.role === "outcome") return "market read";
  if (node.role === "protocol") return "Pearl's causal framework";
  return node.category;
}

function edgeLabel(edge: CanvasEdge, from: CanvasFactor, to: CanvasFactor) {
  const relation = edge.relation ?? (edge.sign === 0 ? "contested" : "causal");
  const readId = to.id.startsWith("read_") ? to.id.slice(5) : "";
  if (readId) {
    const support = from.support?.[readId];
    return support ? `supports read · s ${support.toFixed(2)}` : "supports read";
  }
  if (relation === "contains") return "";
  if (relation === "conditioning") return "conditions";
  if (relation === "confounder") return "confounds";
  if (relation === "feedback") return "feedback loop";
  if (relation === "contested" || edge.sign === 0) return "not settled";
  return "";
}

function edgeKey(edge: CanvasEdge, index: number) {
  return `${edge.from}->${edge.to}:${index}`;
}

function edgeHoverLabel(edge: CanvasEdge, from: CanvasFactor, to: CanvasFactor) {
  const base = edgeLabel(edge, from, to);
  if (base) return base;
  const relation = edge.relation ?? (edge.sign === 0 ? "contested" : "causal");
  if (relation === "contains") {
    if (to.role === "protocol") return "enters protocol";
    if (to.id === "borrowing_capacity_subdrivers") return "feeds capacity";
    if (to.id === "supply_pipeline_subdrivers") return "feeds pipeline";
    if (to.id === "local_market_subdrivers") return "feeds local market";
    if (to.id === "macro_demand") return "feeds demand";
    if (to.id === "investor_selloff_rental_policy") return "policy pressure → sell-off";
    if (to.role === "driver") return "rolls up to driver";
    return "rolls up";
  }
  return "";
}

function edgeLabelWidth(label: string) {
  return Math.max(58, Math.min(150, label.length * 6.2 + 12));
}

const EVIDENCE_STATUS_LABEL: Record<string, string> = {
  observed_fact: "fact",
  policy_in_force: "policy live",
  methodology_or_definition: "method",
  model_estimate: "estimate",
  policy_target_or_proposal: "policy target",
  forecast_or_expectation: "forecast",
  risk_warning_or_scenario: "risk",
  analysis_or_news_claim: "analysis",
  rumor_or_unverified: "unverified",
  analyst_structural: "structure",
  review_needed: "review"
};

function sourceFooter(node: CanvasFactor) {
  const count = node.sourceCount ?? node.evidenceCount;
  const statusEntries = Object.entries(node.evidenceStatus || {})
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!statusEntries.length) return `${count} sources`;

  const total = statusEntries.reduce((sum, [, value]) => sum + value, 0);
  const [topStatus, topCount] = statusEntries[0];
  const topLabel = EVIDENCE_STATUS_LABEL[topStatus] ?? topStatus.replace(/_/g, " ");
  if (statusEntries.length === 1 || topCount / total >= 0.72) return `${count} sources · ${topLabel}`;

  const secondLabel = EVIDENCE_STATUS_LABEL[statusEntries[1]?.[0] || ""] ?? "";
  return secondLabel ? `${count} sources · ${topLabel}/${secondLabel} mix` : `${count} sources · mixed`;
}

const PRICE_SCENARIO_SIGN: Record<string, 1 | -1 | 0> = {
  shortage_dominates: 1,
  financing_pressure: 1,
  investor_window: -1,
  regional_divergence: 0,
  user_constraint: 0
};

function clampSignal(score: number) {
  return Math.max(-1, Math.min(1, score));
}

function priceSignal(node: CanvasFactor) {
  let up = 0;
  let down = 0;
  let flat = 0;
  Object.entries(node.support || {}).forEach(([scenario, strength]) => {
    const sign = PRICE_SCENARIO_SIGN[scenario] ?? 0;
    if (sign > 0) up += strength;
    else if (sign < 0) down += strength;
    else flat += strength;
  });
  const total = up + down + flat;
  if (total > 0) {
    const score = clampSignal((up - down) / total);
    const label = score > 0.15
      ? "upward price pressure"
      : score < -0.15
        ? "downward price pressure"
        : flat > 0
          ? "conditional price signal"
          : "mixed price signal";
    return { score, label };
  }

  const dir = (node.directionOnPrices || "").toLowerCase();
  if (node.trend === "↑" || /support|up|rais|raise|widen|lift/.test(dir)) {
    return { score: 0.75, label: "upward price pressure" };
  }
  if (node.trend === "↓" || /down|lower|eas|cool|shrink|reliev/.test(dir)) {
    return { score: -0.75, label: "downward price pressure" };
  }
  if (/contested|band|not_settled|split/.test(dir) || node.contested) {
    return { score: 0, label: "contested price signal" };
  }
  if (/conditioning|personal/.test(dir) || node.category === "personal") {
    return { score: 0, label: "conditional price signal" };
  }
  return { score: 0, label: "mixed price signal" };
}

function edgeStyle(edge: CanvasEdge, from: CanvasFactor, focused: boolean, incident: boolean) {
  const relation = edge.relation ?? (edge.sign === 0 ? "contested" : "causal");
  if (relation === "contains") {
    return {
      color: K.inkMute,
      width: incident ? 2.1 : 1.5,
      opacity: focused ? (incident ? 0.95 : 0.12) : 0.66,
      dash: "4 4"
    };
  }
  if (relation === "contested" || edge.sign === 0) {
    return {
      color: K.warn,
      width: incident ? 2.4 : 1.55,
      opacity: focused ? (incident ? 0.95 : 0.1) : 0.68,
      dash: "6 4"
    };
  }
  if (relation === "confounder") {
    return {
      color: K.meta,
      width: incident ? 2.0 : 1.4,
      opacity: focused ? (incident ? 0.92 : 0.1) : 0.5,
      dash: "2 4"
    };
  }
  if (relation === "conditioning") {
    return {
      color: K.good,
      width: incident ? 1.8 : 1.2,
      opacity: focused ? (incident ? 0.9 : 0.1) : 0.4,
      dash: "1 5"
    };
  }
  if (relation === "feedback") {
    return {
      color: K.secondary,
      width: incident ? 2.2 : 1.5,
      opacity: focused ? (incident ? 0.92 : 0.1) : 0.45,
      dash: "5 3"
    };
  }
  return {
    color: edge.sign < 0 ? K.secondarySoft : CAT_COLOR[from.category],
    width: incident ? 2.7 : 1.8,
    opacity: focused ? (incident ? 0.95 : 0.1) : 0.42,
    dash: undefined
  };
}

export default function CanvasGraph({
  factors,
  edges,
  weights,
  personal,
  lead,
  sel,
  hover,
  cam,
  setCam,
  onHover,
  onSelect,
  onClearFocus,
  onMove,
  onDragNode,
  groupFocus,
  onSelectGroup
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; ox: number; oy: number; moved: boolean } | null>(null);
  const pan = useRef<{ sx: number; sy: number; cx: number; cy: number; moved: boolean; clearOnClick: boolean } | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const focus = sel || hover;
  // node-focus (sel/hover) takes precedence; otherwise a clicked lane focuses its whole group.
  const groupOn = !focus && !!groupFocus;

  const byId = (id: string) => factors.find((factor) => factor.id === id);
  const incidentEdges = (id: string) => edges.filter((edge) => edge.from === id || edge.to === id);
  const insideAreaBand = (point: { x: number; y: number }) => {
    const world = { x: (point.x - cam.x) / cam.k, y: (point.y - cam.y) / cam.k };
    return GROUPS.some((group) =>
      world.x >= group.x &&
      world.x <= group.x + group.w &&
      world.y >= group.y &&
      world.y <= group.y + group.h
    );
  };

  const vb = useCallback((event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * VBW,
      y: ((event.clientY - rect.top) / rect.height) * VBH
    };
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (drag.current) {
        const point = vb(event);
        const nx = snap(point.x - drag.current.ox);
        const ny = snap(point.y - drag.current.oy);
        const factor = byId(drag.current.id);
        if (factor && (nx !== factor.x || ny !== factor.y)) {
          drag.current.moved = true;
          onMove(drag.current.id, nx, ny);
        }
      } else if (pan.current) {
        const rect = svgRef.current!.getBoundingClientRect();
        if (Math.abs(event.clientX - pan.current.sx) > 3 || Math.abs(event.clientY - pan.current.sy) > 3) {
          pan.current.moved = true;
        }
        setCam((c) => ({
          ...c,
          x: pan.current!.cx + ((event.clientX - pan.current!.sx) / rect.width) * VBW,
          y: pan.current!.cy + ((event.clientY - pan.current!.sy) / rect.height) * VBH
        }));
      }
    };
    const up = () => {
      if (drag.current && !drag.current.moved) onSelect(drag.current.id);
      if (pan.current && !pan.current.moved && pan.current.clearOnClick && (sel || groupFocus)) {
        onClearFocus?.();
      }
      if (drag.current) onDragNode?.(null);
      drag.current = null;
      pan.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  });

  const onWheel = (event: React.WheelEvent) => {
    const point = vb(event);
    setCam((c) => {
      const nextK = Math.max(0.45, Math.min(2.6, c.k * (1 - event.deltaY * 0.0012)));
      const wx = (point.x - c.x) / c.k;
      const wy = (point.y - c.y) / c.k;
      return { x: point.x - wx * nextK, y: point.y - wy * nextK, k: nextK };
    });
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VBW} ${VBH}`}
      preserveAspectRatio="xMinYMin meet"
      style={{ width: "100%", height: "100%", display: "block", cursor: pan.current ? "grabbing" : "grab", touchAction: "none" }}
      onPointerDown={(event) => {
        const point = vb(event);
        pan.current = {
          sx: event.clientX,
          sy: event.clientY,
          cx: cam.x,
          cy: cam.y,
          moved: false,
          clearOnClick: !insideAreaBand(point)
        };
      }}
      onWheel={onWheel}
    >
      <defs>
        <pattern id="tw-dots" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
          <circle cx={GRID / 2} cy={GRID / 2} r={1} fill="#CFC8B6" opacity={0.45} />
        </pattern>
        <marker id="tw-arrow" markerWidth={9} markerHeight={9} refX={7} refY={4} orient="auto" markerUnits="strokeWidth">
          <path d="M 1 1 L 7 4 L 1 7" fill="none" stroke={K.inkMute} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>
      <g transform={`translate(${cam.x},${cam.y}) scale(${cam.k})`}>
        <rect x={-500} y={-700} width={4700} height={2400} fill="url(#tw-dots)" />

        {GROUPS.map((group) => {
          const isGroupSel = groupFocus === group.id;
          const gOpacity = groupOn
            ? (isGroupSel ? 1 : 0.3)
            : focus
              ? (factors.some((factor) => factor.group === group.id && factor.id === focus) ? 1 : 0.45)
              : 1;
          return (
          <g key={group.id} opacity={gOpacity} onClick={() => onSelectGroup?.(group.id)} style={{ cursor: "pointer" }}>
            <rect
              x={group.x}
              y={group.y}
              width={group.w}
              height={group.h}
              rx={8}
              fill={group.color}
              opacity={isGroupSel ? 0.13 : 0.055}
              stroke={group.color}
              strokeOpacity={isGroupSel ? 0.6 : 0}
              strokeWidth={1.5}
            />
            <text x={group.x + 16} y={group.y + 28} fontFamily="'JetBrains Mono', monospace" fontSize={14} fontWeight={700} letterSpacing={1.6} fill={group.color}>
              {group.title}
            </text>
            <text x={group.x + 16} y={group.y + 48} fontFamily="'Instrument Sans', sans-serif" fontSize={12.5} fill={K.inkSoft}>
              {group.sub}
            </text>
          </g>
          );
        })}

        {edges.map((edge, index) => {
          const from = byId(edge.from);
          const to = byId(edge.to);
          if (!from || !to) return null;
          const key = edgeKey(edge, index);
          const isEdgeHover = hoverEdge === key;
          const isIncident = !!focus && (edge.from === focus || edge.to === focus);
          const style = edgeStyle(edge, from, !!focus, isIncident);
          const eo = groupOn
            ? ((from.group === groupFocus && to.group === groupFocus) || (from.group === groupFocus && to.role === "protocol") ? 0.9 : 0.07)
            : style.opacity;
          const path = curve(from, to);
          const hoverLabel = edgeHoverLabel(edge, from, to);
          return (
            <g key={key}>
              <path
                d={path.d}
                fill="none"
                stroke={style.color}
                strokeWidth={isEdgeHover ? style.width + 1 : style.width}
                strokeDasharray={style.dash}
                opacity={isEdgeHover ? Math.max(eo, 0.95) : eo}
                markerEnd={edge.relation === "contains" ? "url(#tw-arrow)" : undefined}
                style={{ transition: "opacity .2s, stroke-width .15s" }}
              />
              <path
                d={path.d}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(13, style.width + 10)}
                opacity={0}
                onPointerEnter={() => setHoverEdge(key)}
                onPointerMove={() => setHoverEdge(key)}
                onPointerLeave={() => setHoverEdge(null)}
                onMouseEnter={() => setHoverEdge(key)}
                onMouseMove={() => setHoverEdge(key)}
                onMouseLeave={() => setHoverEdge(null)}
                style={{ cursor: hoverLabel ? "help" : "default", pointerEvents: "stroke" }}
              >
                {hoverLabel && <title>{hoverLabel}</title>}
              </path>
            </g>
          );
        })}

        {factors.map((node) => {
          const wt = weights[node.id] ?? 0;
          const isOutcome = node.category === "outcome";
          const hasWeight = node.weightReady !== false && Object.keys(node.support).length > 0;
          const related =
            !focus || focus === node.id || incidentEdges(focus).some((edge) => edge.from === node.id || edge.to === node.id);
          const opacity = groupOn
            ? (node.group === groupFocus ? 1 : 0.16)
            : focus ? (related ? 1 : 0.22) : 1;
          const active = sel === node.id || hover === node.id;
          const isLead = node.id === lead;
          const color = isLead ? K.primary : CAT_COLOR[node.category];
          const lineLimit = node.role === "root" || node.role === "outcome" ? 16 : 24;
          const lines = wrapLabel(node.label.toUpperCase(), lineLimit);
          const roleLabel =
            node.role === "root" ? "ROOT" : node.role === "outcome" ? "OUTCOME" : node.level ? `L${node.level}` : "NODE";
          const usePrototype = node.role !== "protocol";

          if (node.role === "protocol") {
            return (
              <g
                key={node.id}
                opacity={opacity}
                style={{ cursor: "grab", transition: "opacity .2s" }}
                onMouseEnter={() => !drag.current && onHover(node.id)}
                onMouseLeave={() => !drag.current && onHover(null)}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  const point = vb(event);
                  drag.current = { id: node.id, ox: point.x - node.x, oy: point.y - node.y, moved: false };
                  onDragNode?.(node.id);
                }}
              >
                {/* styled to MATCH the RUN PROTOCOL CTA (navy fill · white mono-uppercase ·
                    ▶ glyph) so the node and the button read as the same action. */}
                <rect
                  x={node.x}
                  y={node.y}
                  width={PROTOCOL_W}
                  height={PROTOCOL_H}
                  rx={3}
                  fill={K.secondary}
                  stroke={active ? K.warn : K.secondary}
                  strokeWidth={active ? 2 : 1.2}
                />
                <text
                  x={node.x + PROTOCOL_W / 2}
                  y={node.y + 37}
                  textAnchor="middle"
                  fontFamily="'JetBrains Mono', monospace"
                  fontSize={13}
                  fontWeight={600}
                  letterSpacing={0.5}
                  fill={K.paper}
                >
                  TRACE CORE PROTOCOL
                </text>
                <text
                  x={node.x + PROTOCOL_W / 2}
                  y={node.y + 55}
                  textAnchor="middle"
                  fontFamily="'JetBrains Mono', monospace"
                  fontSize={8.5}
                  letterSpacing={1}
                  fill={K.paper}
                  opacity={0.72}
                >
                  Pearl's Causal Framework
                </text>
              </g>
            );
          }

          if (usePrototype) {
            const w = PROTOTYPE_W;
            const h = PROTOTYPE_H;
            const titleLines = wrapLabel(node.label, 22);
            const marketWeight = hasWeight ? `${Math.round(wt * 100)}%` : "—";
            const signal = priceSignal(node);
            const signalBarX = node.x + 36;
            const signalBarY = node.y + 73;
            const signalBarW = 150;
            const signalBarH = 7;
            const signalMarkerX = signalBarX + ((signal.score + 1) / 2) * signalBarW;
            const signalMarkerColor = signal.score > 0.12 ? K.good : signal.score < -0.12 ? K.primary : K.meta;
            return (
              <g
                key={node.id}
                opacity={opacity}
                style={{ cursor: "grab", transition: "opacity .2s" }}
                onMouseEnter={() => !drag.current && onHover(node.id)}
                onMouseLeave={() => !drag.current && onHover(null)}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  const point = vb(event);
                  drag.current = { id: node.id, ox: point.x - node.x, oy: point.y - node.y, moved: false };
                  onDragNode?.(node.id);
                }}
              >
                <rect x={node.x} y={node.y} width={w} height={h} rx={4} fill={K.paper} stroke={active ? K.secondary : K.rule} strokeWidth={active ? 2 : 1.1} />
                <rect x={node.x} y={node.y} width={w} height={h} rx={4} fill={color} opacity={0.055} />
                <rect x={node.x} y={node.y} width={5} height={h} rx={2} fill={color} />

                <text x={node.x + 16} y={node.y + 18} fontFamily="'JetBrains Mono', monospace" fontSize={8.5} letterSpacing={1} fill={color}>
                  {displayRole(node).toUpperCase()}
                </text>
                <text x={node.x + w - 14} y={node.y + 20} textAnchor="end" fontFamily="'JetBrains Mono', monospace" fontSize={8.5} letterSpacing={0.4} fill={K.inkMute}>
                  market weight
                </text>
                <text x={node.x + w - 14} y={node.y + 43} textAnchor="end" fontFamily="'Fraunces', serif" fontStyle="italic" fontSize={24} fill={color}>
                  {marketWeight}
                </text>

                <text x={node.x + 16} y={node.y + 42} fontFamily="'Instrument Sans', sans-serif" fontSize={15} fontWeight={700} fill={K.ink}>
                  {titleLines[0]}
                </text>
                {titleLines[1] && (
                  <text x={node.x + 16} y={node.y + 59} fontFamily="'Instrument Sans', sans-serif" fontSize={15} fontWeight={700} fill={K.ink}>
                    {titleLines[1]}
                  </text>
                )}

                <g data-price-signal={signal.label} data-price-score={signal.score.toFixed(2)}>
                  <title>{`Price signal: ${signal.label} (${signal.score.toFixed(2)})`}</title>
                  <text x={node.x + 17} y={node.y + 81} fontFamily="'JetBrains Mono', monospace" fontSize={12} fontWeight={700} fill={K.primary}>
                    ↓
                  </text>
                  <rect x={signalBarX} y={signalBarY} width={signalBarW} height={signalBarH} rx={signalBarH / 2} fill={K.paperDeep} stroke={K.rule} strokeWidth={0.7} />
                  <rect x={signalBarX} y={signalBarY} width={signalBarW / 2} height={signalBarH} rx={signalBarH / 2} fill={K.primary} opacity={0.18} />
                  <rect x={signalBarX + signalBarW / 2} y={signalBarY} width={signalBarW / 2} height={signalBarH} rx={signalBarH / 2} fill={K.good} opacity={0.22} />
                  <line x1={signalBarX + signalBarW / 2} y1={signalBarY - 2} x2={signalBarX + signalBarW / 2} y2={signalBarY + signalBarH + 2} stroke={K.inkMute} strokeWidth={0.8} opacity={0.55} />
                  <circle cx={signalMarkerX} cy={signalBarY + signalBarH / 2} r={5.2} fill={signalMarkerColor} stroke={K.paper} strokeWidth={1.6} />
                  <circle cx={signalMarkerX} cy={signalBarY + signalBarH / 2} r={6.2} fill="none" stroke={signalMarkerColor} strokeOpacity={0.36} strokeWidth={1} />
                  <text x={node.x + w - 31} y={node.y + 81} fontFamily="'JetBrains Mono', monospace" fontSize={12} fontWeight={700} fill={K.good}>
                    ↑
                  </text>
                </g>

                <rect x={node.x + 16} y={node.y + 87} width={w - 32} height={1} fill={K.ruleSoft} />
                <text x={node.x + 16} y={node.y + 103} fontFamily="'JetBrains Mono', monospace" fontSize={8.5} fill={K.inkSoft}>
                  {sourceFooter(node)}
                </text>

                {node.contested && (
                  <g>
                    <circle cx={node.x + w - 12} cy={node.y + 59} r={3} fill={K.warn} />
                    <text x={node.x + w - 20} y={node.y + 62} textAnchor="end" fontFamily="'JetBrains Mono', monospace" fontSize={8} fill={K.warn}>contested</text>
                  </g>
                )}

              </g>
            );
          }

          return (
            <g
              key={node.id}
              opacity={opacity}
              style={{ cursor: "grab", transition: "opacity .2s" }}
              onMouseEnter={() => !drag.current && onHover(node.id)}
              onMouseLeave={() => !drag.current && onHover(null)}
              onPointerDown={(event) => {
                event.stopPropagation();
                const point = vb(event);
                drag.current = { id: node.id, ox: point.x - node.x, oy: point.y - node.y, moved: false };
                onDragNode?.(node.id);
              }}
            >
              <rect
                x={node.x}
                y={node.y}
                width={CW}
                height={CH}
                rx={3}
                fill={isLead || isOutcome ? "#F4E4E0" : node.role === "root" ? K.paperDeep : K.paper}
                stroke={isLead || isOutcome ? K.primary : active ? K.secondary : K.rule}
                strokeWidth={isLead ? 2.6 : isOutcome ? 2 : active ? 2 : 1.15}
              />
              <rect x={node.x} y={node.y} width={4} height={CH} rx={1} fill={color} />
              <text x={node.x + 14} y={node.y + 18} fontFamily="'JetBrains Mono', monospace" fontSize={9} letterSpacing={0.5} fill={K.inkMute}>
                {roleLabel} · {node.category.toUpperCase()}
              </text>
              <text x={node.x + 14} y={node.y + 39} fontFamily="'Instrument Sans', sans-serif" fontSize={13} fontWeight={650} fill={K.ink}>
                {lines[0]}
              </text>
              {lines[1] && (
                <text x={node.x + 14} y={node.y + 55} fontFamily="'Instrument Sans', sans-serif" fontSize={13} fontWeight={650} fill={K.ink}>
                  {lines[1]}
                </text>
              )}
              {node.contested && <circle cx={node.x + CW - 10} cy={node.y + 10} r={2.5} fill={K.warn} />}

              {isOutcome ? (
                <text x={node.x + 14} y={node.y + 73} fontFamily="'JetBrains Mono', monospace" fontSize={9} letterSpacing={0.3} fill={K.inkMute}>
                  {node.evidenceCount} sources · click for data
                </text>
              ) : (
                <>
                  <text x={node.x + CW - 12} y={node.y + 22} textAnchor="end" fontFamily="'Fraunces', serif" fontStyle="italic" fontSize={16} fill={isLead ? K.primary : K.ink}>
                    {hasWeight ? `${Math.round(wt * 100)}%` : node.role === "outcome" ? "" : "w —"}
                  </text>
                  {node.role === "outcome" && node.trend !== "→" && (
                    <text x={node.x + CW - 44} y={node.y + 22} textAnchor="end" fontFamily="'JetBrains Mono', monospace" fontSize={13} fill={node.trend === "↑" ? K.primary : K.secondary}>{node.trend}</text>
                  )}
                  <text x={node.x + 14} y={node.y + 73} fontFamily="'JetBrains Mono', monospace" fontSize={9} letterSpacing={0.3} fill={K.inkMute}>
                    {sourceFooter(node)}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {personal?.edges.map((edge, index) => {
          const from = personal.nodes.find((node) => node.id === edge.from);
          const to = byId(edge.to);
          if (!from || !to) return null;
          const ax = from.x + PW;
          const ay = from.y + PH / 2;
          const bx = to.x;
          const by = to.y + nodeSize(to).h / 2;
          const dx = bx - ax;
          const lit = !focus || edge.to === focus || from.key === focus;
          return (
            <path
              key={`pe-${index}`}
              d={`M ${ax} ${ay} C ${ax + dx * 0.45} ${ay}, ${bx - dx * 0.45} ${by}, ${bx} ${by}`}
              fill="none"
              stroke={K.good}
              strokeWidth={1.4}
              strokeDasharray="2 3"
              opacity={focus ? (lit ? 0.85 : 0.1) : 0.5}
              style={{ transition: "opacity .2s" }}
            />
          );
        })}

        {personal?.nodes.map((node) => {
          const connected = personal.edges.some((edge) => edge.from === node.id && edge.to === focus);
          const opacity = groupOn
            ? (groupFocus === "personal" ? 1 : 0.16)
            : focus ? (focus === node.id || connected ? 1 : 0.28) : 1;
          const active = sel === node.id || hover === node.id;
          return (
            <g
              key={node.id}
              opacity={opacity}
              style={{ cursor: "pointer", transition: "opacity .2s" }}
              onMouseEnter={() => onHover(node.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(node.id)}
            >
              {/* private VALUE component — the user's input, value-forward. Name on top
                  (small, green = private), value below (the hero). Green dashed border +
                  the corner dot signal "private · never leaves device". */}
              <rect x={node.x} y={node.y} width={PW} height={PH} rx={4} fill="#F0F3EC" stroke={K.good} strokeWidth={active ? 2 : 1.3} strokeDasharray="4 3" />
              <circle cx={node.x + PW - 9} cy={node.y + 9} r={2.4} fill={K.good} />
              <text x={node.x + 12} y={node.y + 20} fontFamily="'JetBrains Mono', monospace" fontSize={8.5} letterSpacing={0.4} fill={K.good}>
                {node.label}
              </text>
              <text x={node.x + 12} y={node.y + 41} fontFamily="'Fraunces', serif" fontStyle="italic" fontSize={17} fill={K.ink}>
                {node.value}
              </text>
            </g>
          );
        })}

        {hoverEdge &&
          edges.map((edge, index) => {
            const key = edgeKey(edge, index);
            if (key !== hoverEdge) return null;
            const from = byId(edge.from);
            const to = byId(edge.to);
            if (!from || !to) return null;
            const path = curve(from, to);
            const relation = edge.relation ?? (edge.sign === 0 ? "contested" : "causal");
            const label = edgeHoverLabel(edge, from, to);
            if (!label) return null;
            const width = edgeLabelWidth(label);
            return (
              <g key={`eh-${key}`} pointerEvents="none">
                <rect x={path.mx - width / 2} y={path.my - 10} width={width} height={18} rx={2} fill={K.paper} stroke={K.rule} opacity={0.98} />
                <text x={path.mx - width / 2 + 6} y={path.my + 3.5} fontFamily="'JetBrains Mono', monospace" fontSize={8.5} fill={relation === "contested" ? K.warn : K.inkSoft}>
                  {label}
                </text>
              </g>
            );
          })}

        {focus &&
          edges
            .filter((edge) => edge.from === focus || edge.to === focus)
            .map((edge, index) => {
              const from = byId(edge.from);
              const to = byId(edge.to);
              if (!from || !to) return null;
              const path = curve(from, to);
              const relation = edge.relation ?? (edge.sign === 0 ? "contested" : "causal");
              const label = edgeLabel(edge, from, to);
              if (!label) return null;
              const width = edgeLabelWidth(label);
              return (
                <g key={`an-${index}`}>
                  <rect x={path.mx - width / 2} y={path.my - 9} width={width} height={17} rx={2} fill={K.paper} stroke={K.rule} opacity={0.96} />
                  <text x={path.mx - width / 2 + 6} y={path.my + 3.5} fontFamily="'JetBrains Mono', monospace" fontSize={8.5} fill={relation === "contested" ? K.warn : K.inkSoft}>
                    {label}
                  </text>
                </g>
              );
            })}
      </g>
    </svg>
  );
}
