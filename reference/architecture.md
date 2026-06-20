---
type: reference
---
# Architecture

> Stable facts about how the system is built: components, data flow, where things live.
> Where secrets/keys are stored (NOT the values — never commit those).

---

## Current build map (2026-06-20 · orientation for whoever picks this up)

**Product** = a decision cockpit (PRD §22 V2): a CANVAS where the causal graph is the
surface, the Trace engine runs in the background, and product surfaces are call-out panels.
Demo domain = NL housing (decomposition topology). See `brain/decisions.md` (append-only)
for the full decision trail; the PRD detail lives in `work/` which is going LOCAL-ONLY
(IP), so the decision log is the shared source of truth.

**Where things live**
- `app/` — the MVP. `app/src` React/TS cockpit; `app/engine/server.py` FastAPI on :8000
  exposing `/api/health · factor-tree · personal-profiles · run-default-tier ·
  run-structured-tier · run-bridge · run-personal-advice`. Frontend Vite on :5173.
- `app/engine/` — Trace engine (`trace_engine/structured/bridge.py` are PROPRIETARY,
  gitignored, LOCAL ONLY — never commit), plus `schema_adapter`, `run_demo`,
  `fixtures_loader`, `personal_fit` (deterministic personal-exposure layer).
- `app/fixtures/nl_housing/` — candidates · evidence · support_groups · structures ·
  personal_profiles · market_anchors, seeded from canonical data by `app/build_fixtures.py`.
- `Trace_Core/data/` (SEPARATE repo) — the Cala pipeline: evidence → timeseries →
  canonical claims/sources/entities/hypotheses/asserted_dependencies. `build_fixtures.py`
  reads `Trace_Core/data/canonical/`.

**Hard rules (brain/constraints.md FORBID)**
- Real-data-only: every user-facing number comes from canonical fixtures via the engine,
  NEVER run_demo placeholders. server.py refuses (raises) if fixtures are missing.
- Secrets / engine protocol / local agent state never committed.

**Run**: `pip install -r app/requirements.txt`; `python -m uvicorn server:app --app-dir
app/engine --port 8000`; `cd app && npm install && npm run dev`. (On Windows, start node
servers from a terminal, not preview_start — see gotchas.)

**UI direction**: factor = a CARD (category accent · name · Pearl-weight `w%` · latest
value+trend · evidence/credibility/contested · weight bar); nested drill-down = claims +
sources + timeseries + per-scenario support. Canvas = pan/zoom + dot-grid snap + draggable
cards + bezier no-arrow edges (thickness=support, contested=dashed). Weight is
Pearl-conditioned: w(f)=Σ_c r(c|user)·s(f→c). Prototypes are visualize widgets in chat;
the real one is a React canvas calling :8000 for live weights.
