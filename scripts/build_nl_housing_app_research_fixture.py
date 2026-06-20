from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "work" / "nl_housing_factor_research" / "factor_tree.json"
TARGET = ROOT / "app" / "fixtures" / "nl_housing" / "factor_research.json"


LABEL_OVERRIDES = {
    "market_state": "Market state taxonomy",
    "price_transaction_outcome": "Prices and transactions",
    "financing_pressure": "Financing pressure",
    "structural_shortage": "Structural shortage",
    "grid_congestion": "Grid congestion",
    "investor_selloff_rental_policy": "Investor sell-off and rental policy",
    "regional_tightness": "Regional tightness",
    "macro_demand": "Macro demand",
    "borrowing_capacity_subdrivers": "Borrowing capacity",
    "supply_pipeline_subdrivers": "Supply pipeline",
    "local_market_subdrivers": "Local market liquidity",
    "policy_tax_subdrivers": "Policy and tax",
    "personal_decision_subdrivers": "Personal decision variables",
    "rate_price_splitting_test": "Rate-price split test",
    "market_force_taxonomy": "Market force taxonomy",
    "transfer_tax_nhg": "Transfer tax and NHG",
    "rental_regulation_box3": "Rental regulation and Box 3",
    "nibud_lending_standards_2026": "Nibud lending standards 2026",
    "energy_label_mortgage_capacity": "Energy label mortgage capacity",
    "nitrogen_construction_constraint": "Nitrogen construction constraint",
    "construction_costs": "Construction costs",
    "city_overbidding": "City overbidding",
    "migration_household_formation": "Migration and household formation",
    "rental_market_pressure": "Rental market pressure",
    "credit_risk_arrears": "Credit risk and arrears",
    "buyer_sentiment_confidence": "Buyer sentiment",
    "listing_portal_signals": "Listing portal signals",
    "municipal_land_policy": "Municipal and land policy",
}


NUMERIC_LINE = re.compile(
    r"(\d[\d,.]*\s?(%|percent|homes|dwellings|applications|transactions|days|months|EUR|euro|million|billion|bn|k)|Q[1-4]\s+20\d{2}|20\d{2})",
    re.IGNORECASE,
)


def clean_text(value: str, limit: int = 520) -> str:
    text = re.sub(r"\s+", " ", value or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "..."


def label_for(factor_id: str) -> str:
    return LABEL_OVERRIDES.get(factor_id, factor_id.replace("_", " ").title())


def first_summary(summary: str) -> str:
    if "too complex" in (summary or "").lower():
        return "Broad query was intentionally superseded by narrower child nodes."
    for raw in (summary or "").splitlines():
        line = raw.strip(" #-|\t")
        if not line:
            continue
        if line.startswith("Table") or line.startswith("---"):
            continue
        if len(line) < 12:
            continue
        return clean_text(line)
    return "No narrative summary extracted; inspect linked raw Cala response."


def source_label(source: dict[str, Any]) -> str:
    return (
        source.get("document_name")
        or source.get("source_name")
        or source.get("document_url")
        or "Source"
    )


def source_domain(url: str | None) -> str | None:
    if not url:
        return None
    match = re.search(r"https?://([^/]+)", url)
    return match.group(1).replace("www.", "") if match else None


def metric_lines(item: dict[str, Any]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for metric in item.get("candidate_metrics", []):
        raw = clean_text(metric.get("raw_text", ""), 260)
        if not raw or raw in seen:
            continue
        if NUMERIC_LINE.search(raw):
            out.append(raw)
            seen.add(raw)
        if len(out) >= 8:
            break
    return out


def build() -> dict[str, Any]:
    tree = json.loads(SOURCE.read_text(encoding="utf-8"))
    factors = []
    for item in tree.get("factors", []):
        sources = [
            {
                "label": clean_text(source_label(source), 180),
                "url": source.get("document_url"),
                "domain": source_domain(source.get("document_url")),
                "context_id": source.get("context_id"),
            }
            for source in item.get("sources", [])
        ]
        metrics = metric_lines(item)
        factors.append(
            {
                "id": item["id"],
                "label": label_for(item["id"]),
                "level": item["level"],
                "parent": item.get("parent"),
                "query_id": item.get("query_id"),
                "summary": first_summary(item.get("content_summary", "")),
                "metric_count": len(item.get("candidate_metrics", [])),
                "source_count": len(item.get("sources", [])),
                "top_metrics": metrics,
                "sources": sources[:6],
                "raw_file": item.get("raw_file"),
                "provenance": {
                    "source_origin": item.get("source_origin", "cala"),
                    "raw_response": f"work/nl_housing_factor_research/{item.get('raw_file')}",
                    "status": "superseded_broad_query" if not metrics and not sources else "cala_backed",
                },
            }
        )

    level_counts: dict[str, int] = {}
    for factor in factors:
        key = str(factor["level"])
        level_counts[key] = level_counts.get(key, 0) + 1

    return {
        "case": tree.get("case", "nl_housing"),
        "retrieved_at": tree.get("retrieved_at"),
        "generated_from": "work/nl_housing_factor_research/factor_tree.json",
        "coverage_status": "practical_frontier_reached",
        "coverage_note": (
            "The national/general-market tree is exhausted for MVP purposes. "
            "Further expansion should branch by city, price band, property type, buyer profile, policy regime, or causal hypothesis."
        ),
        "rollups": {
            "factor_count": len(factors),
            "level_counts": level_counts,
            "raw_response_count": len(list((SOURCE.parent / "raw").glob("*.json"))),
            "metric_line_count": sum(f["metric_count"] for f in factors),
            "source_link_count": sum(f["source_count"] for f in factors),
        },
        "edges": [
            {"source": factor["parent"], "target": factor["id"]}
            for factor in factors
            if factor.get("parent")
        ],
        "factors": factors,
        "security": {"api_key_stored": False},
    }


def main() -> None:
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    fixture = build()
    TARGET.write_text(json.dumps(fixture, indent=2, ensure_ascii=False), encoding="utf-8")
    print(
        json.dumps(
            {
                "wrote": str(TARGET.relative_to(ROOT)),
                "factors": fixture["rollups"]["factor_count"],
                "metric_lines": fixture["rollups"]["metric_line_count"],
                "source_links": fixture["rollups"]["source_link_count"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
