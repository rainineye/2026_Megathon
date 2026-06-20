"""
build_fixtures.py — seed the PRD's static NL-housing fixtures from the real
canonical Trace data (Trace_Core/data/canonical/).

Emits app/fixtures/nl_housing/:
  candidates.json        market-state candidates (PRD §15) + user-constraint
  evidence.json          Evidence+Inference shaped for trace_engine
  support_groups.json    §2.8 topology groups per candidate
  structures.json        competing DAGs for the rates->price structured claim
  personal_profiles.json representative personas (PRD §11)

Run once:  python app/build_fixtures.py
The fixtures are self-contained static JSON; the app reads them at runtime via
engine/fixtures_loader.py. Re-run to refresh after the canonical data changes.
"""
from __future__ import annotations
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
CANON = r"C:\Users\eau12\Trace_Core\data\canonical"
OUT = os.path.join(HERE, "fixtures", "nl_housing")
os.makedirs(OUT, exist_ok=True)

claims = json.load(open(os.path.join(CANON, "claims.json"), encoding="utf-8"))

# ---- PRD market-state candidates, mapped from our hypotheses H1-H5 ----------
CANDIDATES = [
    ("shortage_dominates", "Structural shortage keeps upward pressure", ["H2", "H3"]),
    ("financing_pressure", "Financing pressure cools demand", ["H1"]),
    ("investor_window", "Investor sell-off creates a temporary buyer window", ["H4"]),
    ("regional_divergence", "Regional divergence dominates the national trend", []),
    ("user_constraint", "User constraints dominate market timing", ["H5"]),
]
H2C = {}
for cid, _lbl, hyps in CANDIDATES:
    for h in hyps:
        H2C[h] = cid
REGION_KW = ["region", "regional", "dispersion", "city", "municipal", "amsterdam", "rotterdam"]

MS = {"DIRECTLY_TESTS": 0.70, "PARTIALLY_INFORMS": 0.50, "ANALOGOUS": 0.32, "BACKGROUND": 0.18}
QF = {"high": 1.0, "medium": 0.82, "low": 0.62}
RANK = {"high": 0, "medium": 1, "low": 2, "unknown": 3}
PER_CANDIDATE = 5


def target_for(c):
    bo = c.get("bears_on") or {}
    h = bo.get("hypothesis_id")
    if h in H2C:
        return H2C[h]
    t = c["canonical_text"].lower()
    if any(k in t for k in REGION_KW):
        return "regional_divergence"
    return None


def inference_for(c, target):
    bo = c.get("bears_on") or {}
    direction = bo.get("evidence_direction", "supports")
    ms = bo.get("mapping_strength", "BACKGROUND")
    qf = QF.get(c.get("quality_level"), 0.7)
    s = round(min(MS.get(ms, 0.18) * qf, 0.75), 3)
    pt = c.get("predicate_type")
    if direction == "qualifies":
        label, s = "breaks_a_story", round(min(s, 0.28), 3)
    elif pt in ("Normative", "Decisional"):
        label = "reveals_a_preference"
    else:
        label = "forces_a_mechanism"
    return {
        "label": label, "target": target, "s": s,
        "text": c["canonical_text"][:200],
        "necessity": False,                                   # PN gating deferred to human review
        "uncontrolled": c.get("evidence", {}).get("primary_or_secondary") != "primary",
    }


def build():
    # candidates
    candidates = [{"id": cid, "label": lbl} for cid, lbl, _ in CANDIDATES]

    # bucket claims by candidate, rank, cap
    buckets = {cid: [] for cid, _, _ in CANDIDATES}
    for c in claims:
        t = target_for(c)
        if t:
            buckets[t].append(c)

    def rank(c):
        prim = 0 if c.get("evidence", {}).get("primary_or_secondary") == "primary" else 1
        rec = RANK.get(c.get("evidence", {}).get("recency"), 3)
        ql = RANK.get(c.get("quality_level"), 3)
        return (prim, rec, ql)

    evidence, groups = [], []
    for cid in buckets:
        picked = sorted(buckets[cid], key=rank)[:PER_CANDIDATE]
        members = []
        for c in picked:
            sp = c.get("source_provenance", {})
            eid = "ev_" + (c.get("stage1_evidence_id") or c["claim_id"]).replace("ev_", "")
            evidence.append({
                "id": eid,
                "source_conf": 0.85 if c.get("evidence", {}).get("primary_or_secondary") == "primary" else 0.6,
                "cala_fact_id": sp.get("cala_context_id") or c["claim_id"],
                "source_name": sp.get("source_name", ""),
                "source_url": sp.get("source_url", ""),
                "claim_kind": c.get("claim_kind"),
                "inferences": [inference_for(c, cid)],
            })
            members.append(eid)
        if members:
            groups.append({
                "target": cid,
                "topology": "Convergence" if len(members) >= 2 else "Corroboration",
                "members": members,
                "independence_factor": 0.85,
                "chain_order": [],
            })

    # structured-tier competing DAGs for rates -> price (general-rule grounded)
    structures = {
        "claim": ["mortgage_rate", "house_price"],
        "asserted": [["dep", "mortgage_rate", "house_price", []]],
        "observed": ["mortgage_rate", "borrowing_capacity", "house_price", "housing_shortage"],
        "unobserved": ["growth"],
        "structures": [
            {"id": "S1_demand_channel", "author": "general-rule:OFR",
             "directed": [["mortgage_rate", "borrowing_capacity"], ["borrowing_capacity", "house_price"]],
             "bidirected": [], "undirected": []},
            {"id": "S2_growth_confounder", "author": "general-rule:VisualCapitalist",
             "directed": [["growth", "mortgage_rate"], ["growth", "house_price"]],
             "bidirected": [], "undirected": []},
            {"id": "S3_supply_amplified", "author": "general-rule:EconomicsHelp",
             "directed": [["mortgage_rate", "borrowing_capacity"], ["borrowing_capacity", "house_price"],
                          ["housing_shortage", "house_price"]],
             "bidirected": [], "undirected": []},
        ],
    }

    personal_profiles = [
        {"id": "tight_buffer_flexible", "label": "Tight monthly buffer, region-flexible",
         "variables": {"budget_eur": 420000, "down_payment_eur": 45000, "monthly_max_eur": 1850,
                        "quoted_mortgage_rate_pct": 4.0,
                        "income_stability": "medium", "horizon_years": 7, "region_flexible": True,
                        "rate_sensitivity": "high", "risk_tolerance": "low", "move_deadline_months": 12},
         "relevant_candidates": ["financing_pressure", "user_constraint", "regional_divergence"],
         "relevant_actions": ["wait_or_resize", "rent_for_now"]},
        {"id": "strong_deposit_long_horizon", "label": "Strong deposit, long holding period",
         "variables": {"budget_eur": 600000, "down_payment_eur": 180000, "monthly_max_eur": 3000,
                        "quoted_mortgage_rate_pct": 4.0,
                        "income_stability": "high", "horizon_years": 12, "region_flexible": False,
                        "rate_sensitivity": "low", "risk_tolerance": "medium", "move_deadline_months": 6},
         "relevant_candidates": ["shortage_dominates", "investor_window"],
         "relevant_actions": ["buy_selectively", "seek_expert_review"]},
        {"id": "urgent_mover", "label": "Must move soon, limited flexibility",
         "variables": {"budget_eur": 500000, "down_payment_eur": 70000, "monthly_max_eur": 2300,
                        "quoted_mortgage_rate_pct": 4.0,
                        "income_stability": "high", "horizon_years": 9, "region_flexible": False,
                        "rate_sensitivity": "medium", "risk_tolerance": "medium", "move_deadline_months": 3},
         "relevant_candidates": ["user_constraint", "shortage_dominates"],
         "relevant_actions": ["buy_selectively", "expand_region"]},
    ]

    out = {
        "candidates.json": candidates,
        "evidence.json": evidence,
        "support_groups.json": groups,
        "structures.json": structures,
        "personal_profiles.json": personal_profiles,
    }
    for name, data in out.items():
        json.dump(data, open(os.path.join(OUT, name), "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"candidates : {len(candidates)}")
    print(f"evidence   : {len(evidence)}")
    print(f"groups     : {len(groups)}  -> " + ", ".join(f"{g['target']}({len(g['members'])})" for g in groups))
    print(f"structures : {len(structures['structures'])}")
    print(f"profiles   : {len(personal_profiles)}")
    print("wrote ->", OUT)


if __name__ == "__main__":
    build()
