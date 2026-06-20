# Trace Personal — a decision-intelligence cockpit

> It looks like a market dashboard, but behaves like an auditable argument.

A desktop/web **decision cockpit** for high-stakes personal market decisions. It fuses
three things in one workspace — **public facts/evidence**, **expert judgment**, and the
user's **personal variables** — and runs them through the deterministic **Trace engine**
to show *which market states are plausible*, *how strong the evidence is*, *what is still
unsettled*, and *what this specific user should do about it*.

It is **not** a black box that predicts prices. It is an evidence-first workspace that
shows the distribution of market states, the chains behind them, the points of dispute,
the user's personal exposure, and an actionable, traceable recommendation.

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
- **Personalization without pretending certainty** — the user's budget, deposit, monthly
  ceiling and quoted mortgage rate drive a transparent exposure layer; they change the
  *advice*, never the *evidence*.
- **Real-data-only** — every number shown to the user traces to real data (sourced Cala
  evidence → canonical fixtures → the engine). Hand-typed placeholders are forbidden.

---

## Architecture

```
 Evidence assembly            Deterministic engine (Trace)        Product
 ─────────────────            ────────────────────────────        ───────
 Cala sourced facts     ┐     trace_engine.py   (default tier)    Decision Brief
 canonical claims       ├──►  trace_structured.py(structured)  ─► Market Map
 expert assumptions     │     trace_bridge.py    (bridge)          Evidence Board
 personal variables     ┘     + personal_fit.py  (exposure)        Personal Fit · Action Plan
        static fixtures              HTTP API (FastAPI :8000)       React cockpit (Vite :5173)
```

- **Frontend** — Vite + React + TypeScript cockpit (`app/src`), calls the engine over HTTP.
- **Engine API** — FastAPI + uvicorn warm server (`app/engine/server.py`) exposing
  `/api/run-default-tier · run-structured-tier · run-bridge · run-personal-advice`.
- **Engine** — the Trace core protocol (`trace_engine / trace_structured / trace_bridge`)
  computes distribution / coverage / credibility / claim_resolution / gap diagnostics.
- **Fixtures** — `app/fixtures/nl_housing/*` seeded from canonical, Cala-derived data so
  the demo runs offline with no live feeds.
- Desktop shell (Electron/Tauri) is an optional later wrapper; the cockpit demos in a browser.

---

## Quickstart

Requirements: Python ≥ 3.10, Node ≥ 18.

```bash
# 1. engine API (warm, deterministic) — from app/
pip install -r app/requirements.txt
python -m uvicorn server:app --app-dir app/engine --host 127.0.0.1 --port 8000
#   → http://127.0.0.1:8000/docs   (interactive API)  ·  /api/health

# 2. cockpit UI — in a second terminal
cd app && npm install && npm run dev
#   → http://127.0.0.1:5173        (the actual interface)
```

`:8000` is the engine API (no UI of its own). `:5173` is the cockpit.

> On Windows with a space in the project path, the bundled `.claude/launch.json`
> preview launcher may fail to start node servers — run the commands above in a terminal
> instead. See `brain/gotchas.md`.

---

## Repo layout

```
app/                 the MVP application
  src/               React + TS cockpit (Decision Brief, Market Map, …)
  engine/            Trace engine + server.py (FastAPI) + fixtures_loader + personal_fit
  fixtures/nl_housing/  candidates · evidence · support_groups · structures ·
                        personal_profiles · market_anchors  (canonical, Cala-derived)
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

Hackathon MVP. The Decision Brief renders live deterministic engine output; some cockpit
surfaces (Market Map, Evidence Board, parts of Personal Fit) are still wireframe placeholders
pending wiring — tracked in `brain/gotchas.md`. **Not for production financial/legal/tax advice.**
