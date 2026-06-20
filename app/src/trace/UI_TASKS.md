# Trace Workspace — UI/UX component & task list

Tracks every region/component of the decision-exhibit workspace. Each has a rough
default in place; iterate one at a time. Status: ☑ rough default · ◔ partial · ☐ todo.
Files: `TraceWorkspace.tsx` (shell), `trace/CanvasGraph.tsx` (graph), `trace/model.ts`
(data+algorithms). Data is the existing fixtures (`fetchFactorTree`) + offline fallback.

---

## 1 · Header  ☑  (`TraceWorkspace.tsx` → `Header`)
Logo `Trace` + `Personal` version · centered topic title + subtitle (engine live/offline)
· "search another contested topic" input + 2 square buttons.
- [ ] 1a. Topic switcher — make search functional (list/switch domains; one domain = one model).
- [ ] 1b. Title source — pull the real decision question per domain (not hard-coded).
- [ ] 1c. Top-right state bar — add time horizon · evidence freshness · confidence chip (PRD §6).
- [ ] 1d. Logo/brand treatment + the 2 buttons' real actions (enter vs add-topic).

## 2 · LeftRail — legend + navigation  ☑  (`TraceWorkspace.tsx` → `LeftRail`)
Color legend + zoom `+ / − / ⤢` (drive cam) + pan/zoom hints. Floats top-left.
- [ ] 2a. Foldable / collapsible? minimap?
- [ ] 2b. Legend: is "color = category" the final encoding, or add shape/icon per category?
- [ ] 2c. Add "fit to view" + zoom-% readout.

## 3 · CanvasGraph — the causal graph  ◔  (`trace/CanvasGraph.tsx`)
### 3a. Factor card  ☑
accent(category) · name · precise `w%` (fixed Fraunces) · value+trend · ev/credibility ·
contested dot · weight bar.
- [ ] info hierarchy review · what's surfaced vs nested · card size/density · selected state.
### 3b. Edges + annotations  ☑
thin bezier, no arrowheads, category color, contested=ochre dashed; hover → highlight +
polarity ▲/▼ + strength `s`.
- [ ] should edges always show direction (subtle arrow/taper)? annotation richness?
### 3c. Canvas interactions  ☑
pan (drag bg) · zoom (wheel + rail) · drag cards (snap) · hover focus + dim · click select.
- [ ] click-empty to deselect · multi-select? · keyboard nav · momentum/inertia.
### 3d. Layout / auto-arrange  ☐
currently hand-placed columns by causal depth.
- [ ] auto-layout (layered DAG) so adding factors re-flows · topology variants (transmission/convergence).

## 4 · Splitter — adjustable divider  ☑  (`TraceWorkspace.tsx`)
1px subtle line, hover reveals, drag resizes canvas vs right column (32–82%).
- [ ] 4a. Feel: handle hit-area, snap points, double-click to reset, persistence.
- [ ] 4b. Should the RIGHT space also be a canvas region ("possibilities distributed", likely
      highlighted) vs only panels? (per wireframe the right is partly canvas) — decide.

## 5 · Right column — container  ☑  (`TraceWorkspace.tsx`)
Scrollable stack of foldable sections; folds stick header to top.
- [ ] 5a. Fold persistence + which sections open by default · ordering · width range.
- [ ] 5b. "Foldable, sticks to top without info display" — refine the folded affordance.

## 6 · Add-variables CTA  ☑  (`AddVariablesCTA`)
`＋ Source (communal)` / `＋ Personal (private)` buttons (stub).
- [ ] 6a. Source flow: add a new source/evidence to the communal graph (with provenance).
- [ ] 6b. Personal-variable flow: add a private variable that conditions the graph.
- [ ] 6c. Distinguish communal (shared) vs private (never leaves device) visually + in data.

## 7 · Condition · personal inputs  ☑  (`FoldSection` + `Slider`)
Monthly ceiling · quoted rate · holding horizon · region-flexible → re-weight whole graph.
- [ ] 7a. Which variables (PRD §11 has ~14) · grouping · units · validation.
- [ ] 7b. Quoted rate is a required user input (no market default) — surface that.
- [ ] 7c. Debounced call to `runPersonalAdvice` for the real personal_fit layer.

## 8 · Scenario distribution — "possibilities"  ◔  (`ScenarioBars`)
Bars, leader highlighted. Currently a right-column panel.
- [ ] 8a. Decide: panel bars vs an on-canvas right-space visual (per wireframe).
- [ ] 8b. Reverse-trace: hover a scenario → highlight the factors that support it.
- [ ] 8c. Confidence/credibility band, not just a point % · honest "relative support" label.

## 9 · Node investigation  ☑  (`NodeInvestigation`)
On select: category · current · evidence · status · mechanism · supports-scenarios (s).
- [ ] 9a. Visual hierarchy review — what's the key info, contrast, ordering.
- [ ] 9b. Full data structure: timeseries sparkline · per-source list · claim_kind · scope.
- [ ] 9c. Edit/annotate from here (expert path)?

## 10 · Evidence  ☑  (inline FoldSection)
Selected node's claim + source link.
- [ ] 10a. List ALL evidence for the node (not just one) · credibility per source · dates.
- [ ] 10b. Per-scenario support breakdown · contested/settled rationale.

## 11 · Bottom dock — indicators to watch  ☑  (`BottomDock`)
Leading **Net Price Read** card = the dynamic strongest hypothesis (top scenario name +
% from the live distribution) + price-direction read + synthesis note. Then 6 indicator
cards, each stacked (no overlap): label · value (Fraunces) · `Δ` delta+direction · `price`
signal (↑rust/↓navy) + note · `watch` trigger. Data from `nl_housing_timeseries.json`.
- [x] 11c. Card layout — stacked fields, net-read leader, delta + price signal added.
- [ ] 11a. Indicators should be DERIVED (scenario-flip thresholds / splitting tests), not hand-picked.
- [ ] 11b. Live values + deltas from the engine · alerting when crossed · link to the factor it watches.
- [ ] 11d. priceSignal is currently reasoning, not computed — wire to engine direction once available.

## 12 · Cross-cutting  ◔
- [ ] 12a. Color system finalize (one color = one meaning) + dark mode?
- [ ] 12b. Loading / empty / error / offline states (engine down).
- [ ] 12c. Real weights from engine (`runDefaultTier`/`runBridge`) replacing the local mirror.
- [ ] 12d. Responsive / min sizes · accessibility (focus, keyboard, aria).
- [ ] 12e. Persist workspace (split, folds, card positions, conditioned snapshot).
