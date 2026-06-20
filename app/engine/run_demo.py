"""Run the NL housing MVP demo through the deterministic Trace engine."""

from __future__ import annotations

import json

import trace_structured as ts
from schema_adapter import adapt_default_output
from trace_bridge import merge_default_and_structured
from trace_engine import Candidate, Evidence, Inference, SupportGroup, aggregate
import fixtures_loader


# WARNING (brain/constraints.md FORBID: hardcoded/placeholder evidence): the
# build_default_case()/build_structured_case() bodies below are HAND-TYPED
# PLACEHOLDERS. They must never be the source of a user-facing number when the
# real Cala-derived fixtures (app/fixtures/nl_housing/*) exist. main() and
# server.py both prefer fixtures_loader and only fall back here if fixtures are
# missing.
def build_default_case():
    candidates = [
        Candidate("shortage_dominates", "Structural shortage keeps upward pressure"),
        Candidate("financing_pressure", "Financing pressure cools demand"),
        Candidate("investor_window", "Investor sell-off creates temporary buyer window"),
        Candidate("regional_divergence", "Regional divergence dominates national trend"),
        Candidate("user_constraint", "User constraints dominate market timing"),
    ]

    evidence = [
        Evidence(
            "e_cbs_price",
            0.88,
            "cbs-price-index",
            [
                Inference(
                    "forces_a_mechanism",
                    "shortage_dominates",
                    0.64,
                    "CBS/Kadaster price index shows owner-occupied prices still rising.",
                ),
                Inference(
                    "reveals_a_preference",
                    "regional_divergence",
                    0.22,
                    "National price index may hide local price dispersion.",
                ),
            ],
        ),
        Evidence(
            "e_rates",
            0.82,
            "dnb-mortgage-rates",
            [
                Inference(
                    "forces_a_mechanism",
                    "financing_pressure",
                    0.58,
                    "Mortgage rates constrain borrowing capacity and bid ceilings.",
                )
            ],
        ),
        Evidence(
            "e_shortage",
            0.76,
            "abf-primos-shortage",
            [
                Inference(
                    "forces_a_mechanism",
                    "shortage_dominates",
                    0.61,
                    "Structural housing shortage keeps supply tight.",
                    uncontrolled=True,
                )
            ],
        ),
        Evidence(
            "e_investor_sales",
            0.72,
            "rabobank-investor-sales",
            [
                Inference(
                    "forces_a_mechanism",
                    "investor_window",
                    0.54,
                    "Rental investor sell-off can increase owner-occupied supply temporarily.",
                    uncontrolled=True,
                )
            ],
        ),
        Evidence(
            "e_local_fit",
            0.92,
            "personal-profile",
            [
                Inference(
                    "forces_a_mechanism",
                    "user_constraint",
                    0.68,
                    "Tight monthly buffer makes rate changes personally material.",
                ),
                Inference(
                    "reveals_a_preference",
                    "regional_divergence",
                    0.42,
                    "User is flexible on region, making local divergence action-relevant.",
                ),
            ],
        ),
        Evidence(
            "e_no_token_claim",
            0.74,
            "expert-note",
            [
                Inference(
                    "breaks_a_story",
                    "investor_window",
                    0.20,
                    "Expert warns investor supply may be absorbed quickly in tight segments.",
                )
            ],
        ),
    ]

    groups = [
        SupportGroup(
            "shortage_dominates",
            "Convergence",
            ["e_cbs_price", "e_shortage"],
        ),
        SupportGroup(
            "financing_pressure",
            "Corroboration",
            ["e_rates"],
            independence_factor=0.9,
        ),
        SupportGroup(
            "investor_window",
            "Corroboration",
            ["e_investor_sales", "e_no_token_claim"],
            independence_factor=0.8,
        ),
        SupportGroup(
            "regional_divergence",
            "Convergence",
            ["e_cbs_price", "e_local_fit"],
        ),
        SupportGroup(
            "user_constraint",
            "Corroboration",
            ["e_local_fit"],
            independence_factor=1.0,
        ),
    ]

    return candidates, evidence, groups


def build_structured_case():
    shortage_first = ts.Structure(
        "S1",
        "shortage-first expert",
        directed=[
            ("housing_shortage", "price_pressure"),
            ("mortgage_rates", "buying_capacity"),
            ("buying_capacity", "demand_pressure"),
            ("demand_pressure", "price_pressure"),
        ],
    )
    rates_first = ts.Structure(
        "S2",
        "financing-first expert",
        directed=[
            ("mortgage_rates", "buying_capacity"),
            ("buying_capacity", "demand_pressure"),
            ("demand_pressure", "price_pressure"),
        ],
        bidirected=[("housing_shortage", "demand_pressure")],
    )

    structured_out = ts.adjudicate(
        [shortage_first, rates_first],
        ("mortgage_rates", "price_pressure"),
        asserted=[("dep", "mortgage_rates", "price_pressure", set())],
        observed=[
            "mortgage_rates",
            "buying_capacity",
            "demand_pressure",
            "housing_shortage",
            "price_pressure",
        ],
        unobserved=["latent_affordability_regime"],
    )
    return structured_out


def recommendation_from(merged):
    support = merged["candidate_support"]
    top_id = max(support, key=support.get)
    top_label = merged["labels"][top_id]
    cr = merged["claim_resolution"]
    resolution = cr["state"]

    reasons = [
        f"Highest relative support currently sits with: {top_label}.",
        "Coverage and credibility remain separate; support is not treated as causal resolution.",
        f"The structured claim state is {resolution}, so advice stays conditional.",
    ]
    # Surface the decisive insight when the causal claim is contested: the one
    # conditional-independence test that would split the admissible structures.
    gap = cr.get("gap_diagnostic") or {}
    split = gap.get("identification_paths") if isinstance(gap, dict) else None
    if resolution == "graph_not_settled" and isinstance(split, dict):
        reasons.append(
            f"What would settle the rates->price dispute: test {split['test']} "
            f"(requires measuring: {split['requires_measuring']})."
        )

    return {
        "posture": "Buy selectively, but keep a hard affordability ceiling",
        "confidence": "medium" if resolution != "polluted" else "low",
        "reasons": reasons,
        "actions": [
            "Get mortgage pre-approval before bidding.",
            "Set a maximum monthly payment and do not exceed it in over-asking rounds.",
            "Compare at least one alternate region before committing to a target city.",
            "Ask an expert to review whether the target segment is supply-constrained.",
        ],
        "triggers": [
            "Mortgage rates move enough to change monthly payment buffer.",
            "Target-region inventory rises for four consecutive weeks.",
            "Investor sell-off supply fades or is absorbed faster than expected.",
        ],
    }


def main():
    # Real-data-only (brain/constraints.md): prefer the Cala-derived canonical
    # fixtures. The hardcoded build_*_case() are placeholders and only used if
    # the fixtures are missing.
    if fixtures_loader.available():
        candidates, evidence, groups = fixtures_loader.build_default_case_from_fixtures()
        structured_out = fixtures_loader.build_structured_case_from_fixtures()
        source = "fixtures (real Cala-derived canonical data)"
    else:
        candidates, evidence, groups = build_default_case()
        structured_out = build_structured_case()
        source = "HARDCODED PLACEHOLDER — fixtures unavailable; do NOT trust these numbers"

    default_out = adapt_default_output(aggregate(candidates, evidence, groups))
    merged = merge_default_and_structured(
        default_out,
        structured_out,
        claim_label="Do mortgage rates causally affect Netherlands housing price pressure?",
    )
    merged["labels"] = default_out["labels"]
    merged["trace_log"] = default_out["trace_log"]
    merged["recommendation"] = recommendation_from(merged)
    merged["input_source"] = source

    print(f"// input_source: {source}")
    print(json.dumps(merged, indent=2, sort_keys=True, default=str))


if __name__ == "__main__":
    main()
