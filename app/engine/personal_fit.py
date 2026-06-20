"""
personal_fit.py — DETERMINISTIC personal-exposure layer (PRD §11).

Real-data-only (brain/constraints.md): this module produces NO market-truth
numbers. Every output is a transparent function of:
  (1) the USER'S OWN inputs (budget, down payment, monthly ceiling, quoted rate, ...)
  (2) standard annuity math (no fabricated constants beyond a labeled mortgage term)
  (3) real market ANCHORS read from fixtures/nl_housing/market_anchors.json
      (Cala-derived timeseries; each anchor carries evidence_id + source)
  (4) the engine's real candidate_support distribution (for the waiting-cost range)

It does NOT mutate evidence or candidate support (PRD §15). It only computes the
user's exposure and action fit. Same inputs -> same numbers.
"""
from __future__ import annotations
import json, os
from dataclasses import dataclass, field

FIX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "fixtures", "nl_housing")

MORTGAGE_TERM_YEARS = 30   # labeled assumption (standard NL annuity term); overridable per profile


def load_anchors() -> dict:
    with open(os.path.join(FIX, "market_anchors.json"), encoding="utf-8") as f:
        return json.load(f)


@dataclass
class Profile:
    """User inputs. Defaults are None where a real value MUST be supplied by the user."""
    budget_eur: float
    down_payment_eur: float
    monthly_ceiling_eur: float
    quoted_mortgage_rate_pct: float          # USER INPUT — not in market data; user's bank quote
    household_income_eur_yr: float | None = None
    income_stability: str = "medium"         # low | medium | high
    move_deadline_months: int = 12
    region_flexible: bool = False
    first_time_buyer: bool = True
    risk_tolerance: str = "moderate"          # low | moderate | high
    holding_period_years: int = 10
    term_years: int = MORTGAGE_TERM_YEARS


def _monthly_payment(loan: float, annual_rate_pct: float, term_years: int) -> float:
    """Standard fixed-rate annuity payment."""
    if loan <= 0:
        return 0.0
    r = (annual_rate_pct / 100.0) / 12.0
    n = term_years * 12
    if r == 0:
        return loan / n
    return loan * r / (1 - (1 + r) ** (-n))


def compute(profile: Profile, candidate_support: dict | None = None, anchors: dict | None = None) -> dict:
    a = (anchors or load_anchors())
    anc = a["anchors"]
    drift = a["price_drift_scenarios_pct"]

    loan = max(0.0, profile.budget_eur - profile.down_payment_eur)
    monthly = _monthly_payment(loan, profile.quoted_mortgage_rate_pct, profile.term_years)
    monthly_plus_1pp = _monthly_payment(loan, profile.quoted_mortgage_rate_pct + 1.0, profile.term_years)

    # 1. affordability buffer (€ and % of the user's own ceiling)
    buffer_eur = profile.monthly_ceiling_eur - monthly
    buffer_pct = (buffer_eur / profile.monthly_ceiling_eur * 100.0) if profile.monthly_ceiling_eur else 0.0

    # 2. rate exposure: € added to the monthly payment per +100bps, and how much buffer it eats
    rate_shock_eur = monthly_plus_1pp - monthly
    buffer_eaten_pct = (rate_shock_eur / buffer_eur * 100.0) if buffer_eur > 0 else float("inf")

    # 3. real policy anchors -> eligibility (pure threshold comparisons against real values)
    nhg = anc["nhg_limit_eur"]["value"]
    ftb_ceiling = anc["transfer_tax_ftb_ceiling_eur"]["value"]
    nhg_eligible = profile.budget_eur <= nhg
    ftb_exempt = profile.first_time_buyer and profile.budget_eur <= ftb_ceiling

    # 4. opportunity cost of waiting: price drift over the wait window, as a RANGE across the
    #    real engine distribution (weighted) + min/max scenario. Ties personal output to the
    #    contested market truth instead of a single fabricated number.
    months = profile.move_deadline_months
    def drift_cost(annual_pct):
        return profile.budget_eur * (annual_pct / 100.0) * (months / 12.0)
    scen = {k: drift_cost(v["value"]) for k, v in drift.items() if not k.startswith("_")}
    if candidate_support:
        w = {k: candidate_support.get(k, 0.0) for k in drift}
        tot = sum(w.values()) or 1.0
        weighted = sum(scen[k] * w[k] for k in scen) / tot
    else:
        weighted = sum(scen.values()) / len(scen)
    wait_cost = {
        "weighted_eur": round(weighted),
        "low_eur": round(min(scen.values())),
        "high_eur": round(max(scen.values())),
        "window_months": months,
        "basis": "budget x annualized real price-drift forecasts, weighted by engine candidate_support",
    }

    # 5. fragility: smallest adverse rate move that drives the buffer to zero (sensitivity scan)
    rate_to_break = None
    if buffer_eur > 0:
        bps = 0
        while bps <= 600:
            bps += 25
            m = _monthly_payment(loan, profile.quoted_mortgage_rate_pct + bps / 100.0, profile.term_years)
            if profile.monthly_ceiling_eur - m <= 0:
                rate_to_break = bps
                break

    # 6. flexibility: best single-lever improvement to the buffer (recompute deterministically)
    levers = {}
    lower_budget = _monthly_payment(max(0.0, profile.budget_eur * 0.9 - profile.down_payment_eur),
                                    profile.quoted_mortgage_rate_pct, profile.term_years)
    levers["budget_minus_10pct"] = round((profile.monthly_ceiling_eur - lower_budget) - buffer_eur)
    longer_term = _monthly_payment(loan, profile.quoted_mortgage_rate_pct, profile.term_years + 5)
    levers["term_plus_5yr"] = round((profile.monthly_ceiling_eur - longer_term) - buffer_eur)
    best_lever = max(levers, key=levers.get) if levers else None

    return {
        "inputs": {"loan_eur": round(loan), "monthly_payment_eur": round(monthly),
                   "quoted_rate_pct": profile.quoted_mortgage_rate_pct, "term_years": profile.term_years},
        "affordability_buffer": {"eur_per_month": round(buffer_eur), "pct_of_ceiling": round(buffer_pct, 1),
                                 "status": "negative" if buffer_eur < 0 else "tight" if buffer_pct < 15 else "comfortable"},
        "rate_exposure": {"per_plus_100bps_eur": round(rate_shock_eur),
                          "buffer_eaten_pct": (round(buffer_eaten_pct, 1) if buffer_eur > 0 else None)},
        "policy_anchors": {
            "nhg_eligible": nhg_eligible, "nhg_limit_eur": nhg, "nhg_evidence": anc["nhg_limit_eur"]["evidence_id"],
            "ftb_transfer_tax_exempt": ftb_exempt, "ftb_ceiling_eur": ftb_ceiling,
            "ftb_evidence": anc["transfer_tax_ftb_ceiling_eur"]["evidence_id"]},
        "opportunity_cost_of_waiting": wait_cost,
        "fragility": {"rate_rise_bps_to_break_buffer": rate_to_break,
                      "note": "smallest rate rise that pushes the monthly payment past your ceiling"},
        "flexibility": {"lever_buffer_gain_eur": levers, "best_lever": best_lever},
        "provenance": {"anchors_source": "fixtures/nl_housing/market_anchors.json (Cala-derived)",
                       "quoted_rate_origin": "USER INPUT (bank quote; no rate level in market data)"},
    }


# ---- DEMO: run on the static personal_profiles fixture + the real engine distribution ----
if __name__ == "__main__":
    import fixtures_loader
    from trace_engine import aggregate

    # real engine distribution (drives the waiting-cost weighting)
    c, ev, g = fixtures_loader.build_default_case_from_fixtures()
    support = aggregate(c, ev, g)["support"]

    # example user (Personal Fit form inputs). quoted_mortgage_rate is the user's bank quote.
    p = Profile(budget_eur=520000, down_payment_eur=95000, monthly_ceiling_eur=2450,
                quoted_mortgage_rate_pct=4.0, household_income_eur_yr=110000,
                move_deadline_months=6, region_flexible=True, first_time_buyer=True,
                risk_tolerance="moderate", holding_period_years=10)
    out = compute(p, candidate_support=support)
    print(json.dumps(out, indent=2, ensure_ascii=False))
