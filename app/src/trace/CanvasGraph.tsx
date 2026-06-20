import { useCallback, useEffect, useRef } from "react";
import {
  CAT_COLOR,
  CH,
  CW,
  GRID,
  K,
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

const GROUPS: Array<{ id: FactorGroup; title: string; sub: string; x: number; y: number; w: number; h: number; color: string }> = [
  { id: "affordability", title: "DEMAND SIDE", sub: "subdrivers roll up into financing pressure", x: 50, y: 16, w: 742, h: 332, color: K.secondary },
  { id: "macro_demand", title: "MACRO ECONOMY", sub: "population / labour / liquidity roll up into demand", x: 822, y: 16, w: 520, h: 332, color: K.secondarySoft },
  { id: "supply_side", title: "SUPPLY SIDE", sub: "permits pipeline + grid/nitrogen blockers roll up into shortage", x: 50, y: 342, w: 1462, h: 324, color: K.meta },
  { id: "policy_supply", title: "POLICY SUPPLY", sub: "tax/rental policy rolls up into investor supply", x: 50, y: 690, w: 1204, h: 186, color: K.warn },
  { id: "regional", title: "REGIONAL / LOCAL", sub: "local tightness rolls up into regional divergence", x: 1262, y: 674, w: 486, h: 232, color: "#6D7162" },
  { id: "personal", title: "PERSONAL VARIABLES", sub: "private fit layer; conditions the read", x: 300, y: 900, w: 700, h: 120, color: K.good },
  { id: "outcome", title: "OUTCOME CONCLUSIONS", sub: "all market conclusions live on the right", x: 1504, y: 360, w: 654, h: 264, color: K.primary },
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
  sel: string | null;
  hover: string | null;
  cam: Cam;
  setCam: (updater: (c: Cam) => Cam) => void;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
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

function edgeStyle(edge: CanvasEdge, from: CanvasFactor, focused: boolean, incident: boolean) {
  const relation = edge.relation ?? (edge.sign === 0 ? "contested" : "causal");
  if (relation === "contains") {
    return {
      color: K.rule,
      width: incident ? 1.6 : 1.15,
      opacity: focused ? (incident ? 0.94 : 0.12) : 0.56,
      dash: "3 4"
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
  sel,
  hover,
  cam,
  setCam,
  onHover,
  onSelect,
  onMove
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; ox: number; oy: number; moved: boolean } | null>(null);
  const pan = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const focus = hover || sel;

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
      </defs>
      <g transform={`translate(${cam.x},${cam.y}) scale(${cam.k})`}>
        <rect x={-500} y={-500} width={3200} height={2100} fill="url(#tw-dots)" />

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
          const color = CAT_COLOR[node.category];
          const lines = wrapLabel(node.label.toUpperCase(), isOutcome ? 22 : 24);
          const roleLabel =
            node.role === "root" ? "ROOT" : node.role === "outcome" ? "OUTCOME" : node.level ? `L${node.level}` : "NODE";

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
              }}
            >
              <rect
                x={node.x}
                y={node.y}
                width={CW}
                height={CH}
                rx={3}
                fill={isOutcome ? "#F4E4E0" : node.role === "root" ? K.paperDeep : K.paper}
                stroke={isOutcome ? K.primary : active ? K.secondary : K.rule}
                strokeWidth={isOutcome ? 2 : active ? 2 : 1.15}
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
                  <text x={node.x + CW - 12} y={node.y + 22} textAnchor="end" fontFamily="'Fraunces', serif" fontStyle="italic" fontSize={16} fill={K.ink}>
                    {hasWeight ? `${Math.round(wt * 100)}%` : "w —"}
                  </text>
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
              const label =
                relation === "contains"
                  ? "contains"
                  : relation === "contested" || edge.sign === 0
                    ? "graph_not_settled"
                    : edge.sign > 0
                      ? "raises / supports"
                      : "lowers / relieves";
              const width = relation === "contested" ? 92 : relation === "contains" ? 58 : 96;
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
