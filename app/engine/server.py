"""
server.py — warm local FastAPI boundary for the Trace deterministic engine.

Exposes the HTTP API the PRD (§15) specifies, importing the engine ONCE and
reusing Codex's run_demo assembly functions. Run from the engine dir so the bare
`trace_engine` / `trace_structured` / `trace_bridge` imports resolve:

    pip install -r app/requirements.txt
    uvicorn server:app --app-dir app/engine --port 8000 --reload

Then the React cockpit (any Vite port) calls http://127.0.0.1:8000/api/... .
Deterministic: same inputs -> same numbers; no model in the loop.

NOTE (collaboration): additive only. Does not modify Codex's main.cjs/App.tsx/
package.json. The Electron shell can stay as an optional wrapper that loads the
web app + (optionally) spawns this server.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from trace_engine import aggregate
from trace_structured import adjudicate  # noqa: F401  (kept for direct structured calls)
from trace_bridge import merge_default_and_structured
from schema_adapter import adapt_default_output
from run_demo import recommendation_from   # reads engine output only (no placeholder numbers)
import fixtures_loader
import personal_fit


# Real-data-only (FORBID in brain/constraints.md): user-facing numbers must come
# from the canonical fixtures via the engine — NEVER run_demo's hand-typed
# build_default_case()/build_structured_case() placeholders. So we refuse rather
# than fall back to placeholders.
def _require_fixtures():
    if not fixtures_loader.available():
        raise RuntimeError(
            "NL housing fixtures missing — run `python app/build_fixtures.py`. "
            "run_demo placeholders are FORBIDDEN for user-facing numbers (constraints.md)."
        )


def build_default_case():
    _require_fixtures()
    return fixtures_loader.build_default_case_from_fixtures()


def build_structured_case():
    _require_fixtures()
    return fixtures_loader.build_structured_case_from_fixtures()


def case_source() -> str:
    return "fixtures" if fixtures_loader.available() else "missing"

app = FastAPI(title="Trace Personal — engine API", version="0.0.1")

# dev: let the Vite cockpit on any localhost port reach the engine
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def jsonable(obj: Any) -> Any:
    """Coerce engine output (sets/tuples) to plain JSON, like run_demo's default=str."""
    return json.loads(json.dumps(obj, default=str))


# ---- request bodies -------------------------------------------------------
# Personal variables / expert notes are accepted now so the contract is stable.
# Per PRD they must NOT secretly change evidence — they change which candidates/
# actions are compared and the personal exposure/thresholds. Wiring that is the
# next step; for now they are echoed back under `context`.
class RunRequest(BaseModel):
    case: str = "nl_housing"
    personal_variables: Optional[dict] = None
    expert_notes: Optional[list] = None


# ---- endpoints ------------------------------------------------------------
@app.get("/")
def index() -> dict:
    return {
        "service": "Trace Personal — engine API",
        "note": "This is the engine API, not the UI. The cockpit UI runs on the Vite frontend (:5173).",
        "interactive_docs": "/docs",
        "endpoints": ["/api/health", "/api/factor-tree", "/api/personal-profiles",
                      "/api/run-default-tier", "/api/run-structured-tier",
                      "/api/run-bridge", "/api/run-personal-advice"],
        "input_source": case_source(),
    }


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "engine": "trace", "case": "nl_housing",
            "deterministic": True, "input_source": case_source()}


@app.get("/api/factor-tree")
def factor_tree() -> dict:
    return jsonable(fixtures_loader.factor_research())


@app.get("/api/personal-profiles")
def personal_profiles() -> dict:
    return {"case": "nl_housing", "profiles": jsonable(fixtures_loader.personal_profiles())}


@app.post("/api/run-default-tier")
def run_default_tier(req: RunRequest) -> dict:
    candidates, evidence, groups = build_default_case()
    default_out = adapt_default_output(aggregate(candidates, evidence, groups))
    return {"default": jsonable(default_out), "context": req.model_dump()}


@app.post("/api/run-structured-tier")
def run_structured_tier(req: RunRequest) -> dict:
    return {"structured": jsonable(build_structured_case()), "context": req.model_dump()}


@app.post("/api/run-bridge")
def run_bridge(req: RunRequest) -> dict:
    candidates, evidence, groups = build_default_case()
    default_out = adapt_default_output(aggregate(candidates, evidence, groups))
    merged = merge_default_and_structured(
        default_out,
        build_structured_case(),
        claim_label="Do mortgage rates causally affect Netherlands housing price pressure?",
    )
    merged["labels"] = default_out["labels"]
    merged["trace_log"] = default_out["trace_log"]
    return {"merged": jsonable(merged), "context": req.model_dump()}


_REQUIRED_PV = ("budget_eur", "down_payment_eur", "monthly_ceiling_eur", "quoted_mortgage_rate_pct")


def _profile_from(pv: Optional[dict]):
    """Map the request's personal_variables onto Codex's personal_fit.Profile.
    quoted_mortgage_rate_pct has NO default — it is the user's bank quote, not in
    the market data, so we refuse rather than fabricate it (real-data FORBID)."""
    pv = pv or {}
    vals = {
        "budget_eur": pv.get("budget_eur"),
        "down_payment_eur": pv.get("down_payment_eur"),
        "monthly_ceiling_eur": pv.get("monthly_ceiling_eur", pv.get("monthly_max_eur")),
        "quoted_mortgage_rate_pct": pv.get("quoted_mortgage_rate_pct", pv.get("quoted_rate_pct")),
    }
    missing = [k for k in _REQUIRED_PV if vals[k] is None]
    if missing:
        return None, missing
    prof = personal_fit.Profile(
        budget_eur=float(vals["budget_eur"]),
        down_payment_eur=float(vals["down_payment_eur"]),
        monthly_ceiling_eur=float(vals["monthly_ceiling_eur"]),
        quoted_mortgage_rate_pct=float(vals["quoted_mortgage_rate_pct"]),
        household_income_eur_yr=pv.get("household_income_eur_yr") or pv.get("income_eur"),
        income_stability=pv.get("income_stability", "medium"),
        move_deadline_months=int(pv.get("move_deadline_months", 12) or 12),
        region_flexible=bool(pv.get("region_flexible", False)),
        first_time_buyer=bool(pv.get("first_time_buyer", True)),
        risk_tolerance=pv.get("risk_tolerance", "moderate"),
        holding_period_years=int(pv.get("holding_period_years", pv.get("horizon_years", 10)) or 10),
    )
    return prof, []


def _personal_posture(pf: dict, resolution: str) -> dict:
    """Deterministic personalized posture — changes with the user's buffer, never
    touches market support (PRD §15). Confidence capped by the engine's resolution."""
    status = pf["affordability_buffer"]["status"]
    capped = "low" if resolution in ("polluted", "insufficient") else "medium"  # graph_not_settled -> medium max
    if status == "negative":
        text = "Wait or resize — at your quoted rate the monthly payment exceeds your ceiling."
    elif status == "tight":
        text = "Buy only selectively, with a hard bid ceiling — your buffer is thin and the market is " + resolution + "."
    else:
        text = "Buy selectively — your buffer is comfortable; set a max bid and watch the triggers."
    return {"posture": text, "confidence": capped, "driven_by": "affordability_buffer." + status,
            "capped_by": "claim_resolution=" + resolution}


@app.post("/api/run-personal-advice")
def run_personal_advice(req: RunRequest) -> dict:
    candidates, evidence, groups = build_default_case()
    default_out = adapt_default_output(aggregate(candidates, evidence, groups))
    merged = merge_default_and_structured(
        default_out,
        build_structured_case(),
        claim_label="Do mortgage rates causally affect Netherlands housing price pressure?",
    )
    merged["labels"] = default_out["labels"]
    merged["trace_log"] = default_out["trace_log"]
    merged["recommendation"] = recommendation_from(merged)

    # PRD §15: personal variables DO NOT change evidence/support — they drive a
    # separate deterministic exposure layer (Codex's personal_fit) + a personalized posture.
    prof, missing = _profile_from(req.personal_variables)
    if prof is not None:
        pf = personal_fit.compute(prof, candidate_support=merged["candidate_support"])
        merged["personal_fit"] = pf
        merged["personal_posture"] = _personal_posture(pf, merged["claim_resolution"]["state"])
    else:
        merged["personal_fit"] = {
            "status": "needs_user_input", "missing": missing,
            "note": ("Provide budget_eur, down_payment_eur, monthly_ceiling_eur and "
                     "quoted_mortgage_rate_pct (your bank's quote — not fabricated)."),
        }

    return {"advice": jsonable(merged), "context": req.model_dump()}
