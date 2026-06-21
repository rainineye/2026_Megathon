import { useCallback, useEffect, useRef } from "react";
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
  snap,
  type CanvasEdge,
  type CanvasFactor,
  type FactorGroup,
  type PersonalNode
} from "./model";

const PW = 120;
const PH = 46;

// Lane bands wrap each group's gridded nodes (cause → effect, left → right; drivers
// align in one column that fans into the outcome). Coords mirror the layout map in
// model.ts — keep them in sync if nodes move. Lanes stack with a uniform 24px gap.
const GROUPS: Array<{ id: FactorGroup; title: string; sub: string; x: number; y: number; w: number; h: number; color: string }> = [
  { id: "affordability", title: "FINANCING / DEMAND", sub: "subdrivers → financing pressure", x: 538, y: -56, w: 838, h: 434, color: K.secondary },
  { id: "macro_demand", title: "MACRO ECONOMY", sub: "population / labour / liquidity → demand", x: 824, y: 402, w: 552, h: 434, color: K.secondarySoft },
  { id: "supply_side", title: "SUPPLY SIDE", sub: "grid / nitrogen blockers → pipeline → shortage", x: 538, y: 860, w: 838, h: 564, color: K.meta },
  { id: "policy_supply", title: "POLICY SUPPLY", sub: "tax / rental policy → investor supply", x: 538, y: 1448, w: 838, h: 304, color: K.warn },
  { id: "regional", title: "REGIONAL / LOCAL", sub: "local tightness → regional divergence", x: 824, y: 1776, w: 552, h: 304, color: "#6D7162" },
  { id: "personal", title: "PERSONAL VARIABLES", sub: "private fit layer; conditions the read", x: 538, y: 2104, w: 838, h: 312, color: K.good },
  { id: "outcome", title: "OUTCOME · CONCLUSIONS", sub: "market state → measured price → ranked read distribution", x: 1682, y: 782, w: 838, h: 694, color: K.primary },
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
  cam: Cam;
  setCam: (updater: (c: Cam) => Cam) => void;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
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

const prototypeIds = new Set(["structural_shortage", "housing_shortage"]);

function displayRole(node: CanvasFactor) {
  if (node.role === "driver") return `${node.category} driver`;
  if (node.role === "subfactor") return `${node.category} input`;
  if (node.role === "root") return "market state";
  if (node.role === "outcome") return "market read";
  if (node.role === "protocol") return "Pearl's causal framework";
  return node.category;
}

function shortCopy(text: string | undefined, max = 42) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
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

function edgeLabelWidth(label: string) {
  return Math.max(58, Math.min(150, label.length * 6.2 + 12));
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
  onMove,
  onDragNode
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; ox: number; oy: number; moved: boolean } | null>(null);
  const pan = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const focus = sel || hover;

  const byId = (id: string) => factors.find((factor) => factor.id === id);
  const incidentEdges = (id: string) => edges.filter((edge) => edge.from === id || edge.to === id);

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
        setCam((c) => ({
          ...c,
          x: pan.current!.cx + ((event.clientX - pan.current!.sx) / rect.width) * VBW,
          y: pan.current!.cy + ((event.clientY - pan.current!.sy) / rect.height) * VBH
        }));
      }
    };
    const up = () => {
      if (drag.current && !drag.current.moved) onSelect(drag.current.id);
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
        pan.current = { sx: event.clientX, sy: event.clientY, cx: cam.x, cy: cam.y };
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
        <rect x={-500} y={-700} width={3200} height={3600} fill="url(#tw-dots)" />

        {GROUPS.map((group) => (
          <g key={group.id} opacity={focus ? (factors.some((factor) => factor.group === group.id && factor.id === focus) ? 1 : 0.45) : 1}>
            <rect
              x={group.x}
              y={group.y}
              width={group.w}
              height={group.h}
              rx={8}
              fill={group.color}
              opacity={0.055}
            />
            <text x={group.x + 14} y={group.y + 22} fontFamily="'JetBrains Mono', monospace" fontSize={9.5} letterSpacing={1.1} fill={group.color}>
              {group.title}
            </text>
            <text x={group.x + 14} y={group.y + 40} fontFamily="'Instrument Sans', sans-serif" fontSize={12} fill={K.inkMute}>
              {group.sub}
            </text>
          </g>
        ))}

        {edges.map((edge, index) => {
          const from = byId(edge.from);
          const to = byId(edge.to);
          if (!from || !to) return null;
          const isIncident = !!focus && (edge.from === focus || edge.to === focus);
          const style = edgeStyle(edge, from, !!focus, isIncident);
          const path = curve(from, to);
          return (
            <path
              key={`${edge.from}-${edge.to}-${index}`}
              d={path.d}
              fill="none"
              stroke={style.color}
              strokeWidth={style.width}
              strokeDasharray={style.dash}
              opacity={style.opacity}
              markerEnd={edge.relation === "contains" ? "url(#tw-arrow)" : undefined}
              style={{ transition: "opacity .2s, stroke-width .15s" }}
            />
          );
        })}

        {factors.map((node) => {
          const wt = weights[node.id] ?? 0;
          const isOutcome = node.category === "outcome";
          const hasWeight = node.weightReady !== false && Object.keys(node.support).length > 0;
          const related =
            !focus || focus === node.id || incidentEdges(focus).some((edge) => edge.from === node.id || edge.to === node.id);
          const opacity = focus ? (related ? 1 : 0.22) : 1;
          const active = sel === node.id || hover === node.id;
          const isLead = node.id === lead;
          const color = isLead ? K.primary : CAT_COLOR[node.category];
          const lineLimit = node.role === "root" || node.role === "outcome" ? 16 : 24;
          const lines = wrapLabel(node.label.toUpperCase(), lineLimit);
          const roleLabel =
            node.role === "root" ? "ROOT" : node.role === "outcome" ? "OUTCOME" : node.level ? `L${node.level}` : "NODE";
          const usePrototype = prototypeIds.has(node.id);

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

                <text x={node.x + 16} y={node.y + 77} fontFamily="'Fraunces', serif" fontStyle="italic" fontSize={15} fill={node.trend === "↑" ? K.primary : node.trend === "↓" ? K.secondary : K.inkSoft}>
                  {node.trend} {shortCopy(node.value, 28)}
                </text>

                <rect x={node.x + 16} y={node.y + 87} width={w - 32} height={1} fill={K.ruleSoft} />
                <text x={node.x + 16} y={node.y + 103} fontFamily="'JetBrains Mono', monospace" fontSize={8.5} fill={K.inkSoft}>
                  {node.evidenceCount} sources · {node.credibility} evidence
                </text>

                {node.contested && (
                  <g>
                    <circle cx={node.x + w - 12} cy={node.y + 59} r={3} fill={K.warn} />
                    <text x={node.x + w - 20} y={node.y + 62} textAnchor="end" fontFamily="'JetBrains Mono', monospace" fontSize={8} fill={K.warn}>contested</text>
                  </g>
                )}

                <rect x={node.x + 16} y={node.y + h - 7} width={w - 32} height={3} rx={1.5} fill={K.paperDeep} />
                {hasWeight && <rect x={node.x + 16} y={node.y + h - 7} width={(w - 32) * wt} height={3} rx={1.5} fill={color} />}
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
                    {node.evidenceCount} src · {node.credibility}
                  </text>
                  <rect x={node.x + 13} y={node.y + CH - 11} width={CW - 26} height={4} rx={2} fill={K.paperDeep} />
                  {hasWeight && <rect x={node.x + 13} y={node.y + CH - 11} width={(CW - 26) * wt} height={4} rx={2} fill={K.inkSoft} />}
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
          const by = to.y + CH / 2;
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
          const opacity = focus ? (focus === node.id || connected ? 1 : 0.28) : 1;
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
              <rect x={node.x} y={node.y} width={PW} height={PH} rx={3} fill="#F0F3EC" stroke={K.good} strokeWidth={active ? 2 : 1.3} strokeDasharray="4 3" />
              <text x={node.x + 11} y={node.y + 17} fontFamily="'JetBrains Mono', monospace" fontSize={8} letterSpacing={0.5} fill={K.good}>
                PRIVATE
              </text>
              <text x={node.x + 11} y={node.y + 32} fontFamily="'Instrument Sans', sans-serif" fontSize={10.5} fontWeight={500} fill={K.ink}>
                {node.label}
              </text>
              <text x={node.x + PW - 11} y={node.y + 32} textAnchor="end" fontFamily="'Fraunces', serif" fontStyle="italic" fontSize={13} fill={K.good}>
                {node.value}
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
