# TraceCanvas — handoff notes

The decision-exhibit canvas (PRD §22) as a real, iterable React/TS component. It was
ported from the chat prototypes; this is the version to build on.

## See it
```bash
cd app && npm install && npm run dev        # frontend on :5173
python -m uvicorn server:app --app-dir app/engine --port 8000   # engine (optional)
```
Open **http://127.0.0.1:5173/canvas.html** — an isolated dev surface (does not touch
`App.tsx`). The "engine" chip shows `live` if it reached `/api/factor-tree`, else
`offline (fallback)` — it renders either way from the inline `FALLBACK_*` dataset.

## Ship it inside the cockpit
```tsx
import TraceCanvas from "./TraceCanvas";
// ...somewhere in App.tsx's main canvas area:
<TraceCanvas />
```

## How it works
- **Data**: on mount it calls `fetchFactorTree()` (api.ts) and adapts the engine's
  `FactorResearch` into the canvas model (`adaptFactorTree`). Falls back to
  `FALLBACK_FACTORS` / `FALLBACK_EDGES` so it always renders.
- **Weights**: `factorWeights()` = the Pearl-conditioned weight `w(f)=Σ_c r(c|user)·s(f→c)`,
  shown as the precise `%` (fixed size) + a grey bar per card. `conditionDistribution()`
  mirrors the engine so the sliders feel instant.
- **Canvas**: pan (drag background) · zoom (wheel + buttons) · dot-grid + snap · draggable
  cards · thin bezier edges that highlight + annotate (polarity ▲/▼ · strength `s`) on hover.
- **Color = one meaning**: accent bar = category · grey = weight · ochre = contested ·
  rust = price (outcome). See the legend.

## EXTEND (next features — grep `EXTEND` in TraceCanvas.tsx)
1. **Real per-factor weights** — replace the local `conditionDistribution` + the empty
   `support: {}` from `adaptFactorTree` with engine output: call `runDefaultTier()` /
   `runBridge()` for the scenario distribution and a real factor→candidate support map.
2. **Personal layer** — on slider change, debounce-call `runPersonalAdvice(vars)` and show
   the returned `personal_fit` + posture instead of the local mirror.
3. **Reverse-trace** — hover a scenario in the distribution panel → highlight the factors
   that support it (invert `support`).
4. **Evidence inspector** — wire the click-panel to `factor.sources` (the factor-tree
   already carries claims, URLs, evidence-status); show per-scenario support breakdown.
5. **Timeline / turning points** — add a time scrubber (see the case-file pattern).
6. **Topology** — generalize the layered layout to transmission / convergence chains.

## Notes
- Self-contained styles (inline + the Trace palette `K`); no dependency on `styles.css`.
- `VITE_TRACE_API_URL` overrides the engine base URL.
