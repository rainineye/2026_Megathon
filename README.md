# Trace Personal — a decision-intelligence cockpit

> An instrument for navigating through uncertainty and complexity.

A desktop/web **decision cockpit** for high-stakes personal market decisions. It fuses
three things in one workspace — **public facts/evidence**, **expert judgment**, and the
user's **personal variables** — and runs them through the deterministic **Trace engine**
to show *which market states are plausible*, *how strong the evidence is*, *what is still
unsettled*, and *what this specific user should do about it*.

It is **not** a black box that predicts prices. It is an evidence-first workspace that
shows the distribution of market states, the causal chains behind them, the points of
dispute, the user's personal exposure, and an actionable, traceable recommendation.

**Demo case — Netherlands housing:** *Should I buy a home in the Netherlands in the next
6 months, wait 6–12 months, or keep renting while watching specific signals?*

---

## Why it's different

- **Distribution over single answer** — competing market states (structural shortage,
  financing pressure, investor sell-off window, regional divergence, user-constraint), not
  one forecast.
- **Three axes never collapsed** — *support* (relative), *coverage* (absolute strength),
  and *credibility* (controlled / uncontrolled source position) are shown separately. A
  thing isn't "true" just because there's lots of evidence.
- **Causal honesty** — causal claims return `graph_not_settled` + the test that would
  settle them, instead of pretending a correlation is a cause.
- **Personalization without pretending certainty** — the user's target price, deposit,
  monthly ceiling, quoted mortgage rate, holding horizon and region-flexibility drive a
  transparent exposure layer; they re-condition the read and the recommendation, never the
  evidence.
- **Real-data-only** — every number shown to the user traces to real data (sourced Cala
  evidence → canonical fixtures → the engine) or to an explicit deterministic derivation.
  Hand-typed placeholders are forbidden.

---

## The cockpit (canvas)

The primary interface is a single **causal-reasoning canvas** (`app/src/TraceWorkspace.tsx`,
served at `/canvas.html`). Everything lives in one continuous, pannable/zoomable workspace:

- **Causal graph (the canvas)** — factors laid out on a dot grid by causal depth: group
  lanes (financing/demand · macro · supply · policy · regional · personal) whose sub-factors
  roll up into one aligned row of **drivers**, which converge on the bottom-centered **Trace
  Core Protocol** node. The canvas is causal-only. Click a lane's background (or a legend
  item) to focus a whole group; click a node to inspect it; `Esc` / *Esc · graph* returns to
  the overview (the default all-lanes home view).
- **Right panel** — *Inputs* (add private variables · run protocol) on top; *Inspector*
  (factor / read / personal detail) below.
- **Bottom dock** — switchable between **Outcome · your decision** and **Indicators to
  watch**, collapsible, and auto-opened to the Outcome after a run. *Outcome* shows the
  shared **current understanding** (the engine scenario read) on the left and the private
  **buy / wait / rent** call (relative *fit %*, re-conditioned on your variables) on the
  right. *Indicators* shows the watchlist as distance-to-trigger gauges plus a **force
  balance** derived from the engine scenario distribution (up- vs down-price pressure).

`app/src/App.tsx` (served at `/`) is an earlier "Decision Brief / Market Map / Evidence
Board / Personal Fit" surface prototype, kept for reference; the canvas cockpit is the
current product.

---

## Architecture

```
 Evidence assembly            Deterministic engine (Trace)        Product
 ─────────────────            ────────────────────────────        ───────
 Cala sourced facts     ┐     trace_engine.py   (default tier)    Causal graph + lanes
 canonical claims       ├──►  trace_structured.py(structured)  ─► Ranked scenario read
 expert assumptions     │     trace_bridge.py    (bridge)          Inspector / evidence
 personal variables     ┘     + personal_fit.py  (exposure)        Personal fit · indicators
        static fixtures              HTTP API (FastAPI :8000)       React canvas cockpit (Vite :5173)
```

- **Frontend** — Vite + React + TypeScript. The canvas cockpit (`TraceWorkspace` +
  `trace/CanvasGraph.tsx` + `trace/model.ts`) calls the engine over HTTP and falls back to
  seeded fixtures when offline.
- **Engine API** — FastAPI + uvicorn warm server (`app/engine/server.py`) exposing
  `/api/run-default-tier · run-structured-tier · run-bridge · run-personal-advice`.
- **Engine** — the Trace core engine computes distribution / coverage / credibility /
  claim_resolution / gap diagnostics. *(Proprietary — the engine implementation is **not
  included** in this repository; it is loaded locally.)*
- **Fixtures** — `app/fixtures/nl_housing/*` seeded from canonical, Cala-derived data so
  the demo runs offline with no live feeds.
- Desktop shell (Electron/Tauri) is an optional later wrapper; the cockpit demos in a browser.

---

## Quickstart

Requirements: Python ≥ 3.10, Node ≥ 18.

```bash
# 1. engine API (warm, deterministic)
pip install -r app/requirements.txt
python -m uvicorn server:app --app-dir app/engine --host 127.0.0.1 --port 8000
#   → http://127.0.0.1:8000/docs   (interactive API)  ·  /api/health

# 2. cockpit UI — in a second terminal
cd app && npm install && npm run dev
#   → http://127.0.0.1:5173/canvas.html   (the canvas cockpit — the actual demo)
#   → http://127.0.0.1:5173/              (earlier Decision-Brief surface prototype)
```

`:8000` is the engine API (no UI of its own). The cockpit runs fully offline against the
seeded fixtures if the engine isn't up.

> On Windows with a space in the project path, the bundled `.claude/launch.json`
> preview launcher may fail to start node servers — run the commands above in a terminal
> instead. See `brain/gotchas.md`.

---

## Deploy

A minimal single-host deploy lives in `deploy/` — `deploy.sh` / `deploy.ps1` (build the
UI + run the engine), a `Caddyfile` (static UI + reverse-proxy to the API), and a
`trace-api.service` systemd unit. See `deploy/README.md`.

---

## Repo layout

```
app/                 the MVP application
  src/
    TraceWorkspace.tsx   the canvas cockpit (primary UI)
    trace/               CanvasGraph.tsx (render) + model.ts (data, layout, engine mirror)
    App.tsx              earlier Decision-Brief surface prototype
  engine/            Trace engine + server.py (FastAPI) + fixtures_loader + personal_fit
  fixtures/nl_housing/  candidates · evidence · support_groups · structures ·
                        personal_profiles · market_anchors  (canonical, Cala-derived)
deploy/              single-host deploy (Caddyfile · deploy.sh/.ps1 · systemd unit)
brain/               shared-memory vault (see below): north-star · decisions · constraints · gotchas
work/                PRD, design/research notes, factor research
reference/           stable architecture facts
SECURITY.md          what must never be committed (keys, local agent state)
```

The deterministic engine and the full Cala data pipeline (evidence → timeseries →
canonical) live in a **separate `Trace_Core` repository**; `app/fixtures/` holds the
seeded snapshot this app reads.

---

## Shared-memory vault (`brain/`)

This repo is also a "memory-hardness" setup: two people + two agents (Claude Code + Codex)
share **one brain**, so nobody re-litigates a settled decision. Markdown-in-git is the
single source of truth.

- `brain/north-star.md` — what we're building, the deadline, non-goals (read first).
- `brain/decisions.md` — **append-only** decision log (never rewrite a past line).
- `brain/constraints.md` — hard rules; `FORBID:` lines are absolute.
- `brain/gotchas.md` — traps, recorded so they're hit at most once.

The contract for agents lives in `CLAUDE.md` / `AGENTS.md`. Append-only logs almost never
merge-conflict between collaborators — that's what keeps the shared memory durable.

---

## Security

API keys, `.env`, and local agent state (`.claude/settings.local.json`) are **never**
committed — see `SECURITY.md` and `.gitignore`. Run the documented secret scan before
pushing. The Trace engine is fully local; the demo needs no API key to run.

---

## Status

Hackathon MVP. The canvas cockpit renders the deterministic engine read (scenario
distribution → on-canvas conclusions) and a personal-fit recommendation that re-conditions
on the user's private variables; the indicators dock and force balance are wired to the
distribution. Some surfaces are still being tightened — tracked in `brain/gotchas.md`.
**Not for production financial/legal/tax advice.**
