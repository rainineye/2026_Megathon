from __future__ import annotations

import json
import os
import re
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "work" / "nl_housing_factor_research"
RAW = OUT / "raw"
CALA_URL = "https://api.cala.ai/v1/knowledge/search"

QUERIES: list[dict[str, Any]] = [
    ["l1_market_forces", 1, None, "market_state", "For the Netherlands housing market in 2025-2026, identify the major forces determining buy now, wait, or resize: financing pressure, structural shortage, investor sell-off, regional tightness, macro demand, policy/tax, and personal affordability. Return concrete indicators and current figures where available."],
    ["l2_prices_transactions", 2, "market_state", "price_transaction_outcome", "What are the current official 2025-2026 indicators for Netherlands existing owner-occupied home prices and transactions? Focus on CBS and Kadaster price index, month-on-month change, transaction count, average transaction price, regional data, and release cadence."],
    ["l2_financing_pressure", 2, "market_state", "financing_pressure", "What current 2025-2026 data tracks Dutch mortgage rates, borrowing capacity, mortgage applications, mortgage volume, LTV, LTI, household mortgage debt, and affordability? Focus on DNB, AFM, ECB, HDN, Kadaster, DMFCO, and mortgage market reports."],
    ["l2_structural_shortage", 2, "market_state", "structural_shortage", "What current 2025-2026 data describes the Dutch housing shortage and supply pipeline? Focus on ABF Research Primos shortage figures, CBS building permits, newly built dwellings, completions, construction costs, and government housing targets."],
    ["l2_grid_congestion", 2, "structural_shortage", "grid_congestion", "What 2025-2026 evidence shows Dutch grid congestion delaying housing construction? Include cities, municipalities, connection waiting lists, homes at risk, grid operators, and source URLs."],
    ["l2_investor_selloff", 2, "market_state", "investor_selloff_rental_policy", "What current 2025-2026 data tracks Dutch rental investor sell-offs, buy-to-let exits, affordable rent regulation effects, landlords selling homes, and rental homes entering owner-occupied supply? Include counts, periods, and sources."],
    ["l2_regional_tightness", 2, "market_state", "regional_tightness", "What current 2025-2026 Netherlands data tracks regional housing pressure, overbidding, asking versus selling price, days on market, active listings, NVM market tightness, and city-level supply-demand? Include recent figures."],
    ["l2_macro_demand", 2, "market_state", "macro_demand", "What current 2025-2026 macro and demographic indicators drive Netherlands housing demand and house prices? Include wage growth, household income, unemployment, consumer confidence, inflation, GDP, migration, population growth, and household formation with CBS, DNB, Eurostat, OECD, or IMF sources."],
    ["l3_borrowing_capacity", 3, "financing_pressure", "borrowing_capacity_subdrivers", "Break down Dutch home-buyer borrowing capacity in 2025-2026 into subdrivers: mortgage rate, income, Nibud lending standards, LTI, LTV, energy label, student debt, partner income, and tax rules. Include measurable indicators and any 2026 changes with sources."],
    ["l3_supply_pipeline", 3, "structural_shortage", "supply_pipeline_subdrivers", "Break down Netherlands housing supply pipeline constraints in 2025-2026: building permits, completions, nitrogen rules, grid congestion, construction costs, land availability, municipal planning, affordable housing quotas, and developer feasibility. Include measurable indicators and current figures."],
    ["l3_local_market", 3, "regional_tightness", "local_market_subdrivers", "Break down local Netherlands housing market tightness into measurable subdrivers: active listings, months of supply, NVM tightness indicator, viewings, bids per property, overbidding share, sale-to-asking ratio, days on market, and price band liquidity. Include current 2025-2026 figures."],
    ["l3_policy_tax", 3, "market_state", "policy_tax_subdrivers", "What Dutch housing policy and tax variables in 2025-2026 affect buyer demand, investor supply, and affordability? Include transfer tax exemption thresholds, mortgage interest deduction, affordable rent act, box 3, social rent freeze, NHG limit, and municipal rules with current figures."],
    ["l3_personal_decision", 3, "personal_affordability", "personal_decision_subdrivers", "For an individual home buyer in the Netherlands in 2025-2026, what personal variables should be measured to decide buy now versus wait? Include budget, down payment, monthly ceiling, mortgage quote, income stability, holding period, rent level, region flexibility, renovation tolerance, and tax status. Map each variable to public market indicators where possible."],
    ["l3_rate_price_test", 3, "financing_pressure", "rate_price_splitting_test", "For the causal question whether Dutch mortgage rates affect house prices through borrowing capacity, what data would test mortgage_rate independent of house_price conditional on borrowing_capacity? Identify observable datasets, controls, frequency, and limitations for 2025-2026 Netherlands."],
    ["l3b_market_forces_simple", 3, "market_state", "market_force_taxonomy", "List the main categories of measurable indicators for the Netherlands housing market in 2025-2026. Do not explain broadly; return a concise taxonomy of factor -> measurable indicators."],
    ["l3b_policy_transfer_nhg", 3, "policy_tax_subdrivers", "transfer_tax_nhg", "What are the 2026 Netherlands first-time buyer transfer tax exemption threshold, standard transfer tax rates, and NHG mortgage limit? Include current figures and sources."],
    ["l3b_policy_rental_box3", 3, "policy_tax_subdrivers", "rental_regulation_box3", "What 2025-2026 Dutch rental regulation and Box 3 tax changes affect buy-to-let investors selling homes? Include Wet betaalbare huur, rent control, Box 3, landlord sell-off evidence, and sources."],
    ["l4_nibud_lending_2026", 4, "borrowing_capacity_subdrivers", "nibud_lending_standards_2026", "What changed in Dutch mortgage borrowing capacity or Nibud lending standards for 2026? Include effects on max mortgage for households, income assumptions, energy label, student debt, and source links."],
    ["l4_energy_label_mortgage", 4, "borrowing_capacity_subdrivers", "energy_label_mortgage_capacity", "How do Dutch home energy labels affect mortgage borrowing capacity, mortgage discounts, renovation loans, or buyer demand in 2025-2026? Include measurable rules and sources."],
    ["l4_nitrogen_construction", 4, "supply_pipeline_subdrivers", "nitrogen_construction_constraint", "What 2025-2026 evidence shows nitrogen rules delaying Dutch housing construction? Include homes at risk, regions, permitting constraints, and sources."],
    ["l4_construction_costs", 4, "supply_pipeline_subdrivers", "construction_costs", "What current 2025-2026 data tracks Dutch residential construction costs, building material costs, labor costs, developer feasibility, and stalled projects? Include CBS indices or market reports."],
    ["l4_city_overbidding", 4, "local_market_subdrivers", "city_overbidding", "What 2025-2026 data is available for overbidding, sale-to-asking ratio, NVM tightness, days on market, and listings in Amsterdam, Utrecht, Rotterdam, The Hague, and Eindhoven? Include figures and sources."],
    ["l4_migration_households", 4, "macro_demand", "migration_household_formation", "What 2025-2026 Netherlands data tracks migration, population growth, household formation, household size, and housing demand? Include CBS figures and forecasts."],
    ["l4_rental_market_pressure", 4, "investor_selloff_rental_policy", "rental_market_pressure", "What 2025-2026 Netherlands data tracks rental market pressure: rent inflation, private rental supply, rental vacancy, social rental waiting lists, rent regulation, and rental affordability? Include current figures and sources."],
    ["l4_credit_risk_arrears", 4, "financing_pressure", "credit_risk_arrears", "What 2025-2026 Netherlands data tracks mortgage arrears, payment stress, household debt risk, defaults, underwater mortgages, or financial stability risks for homeowners? Include DNB, AFM, ECB, BKR, or banking sources."],
    ["l4_buyer_sentiment", 4, "macro_demand", "buyer_sentiment_confidence", "What 2025-2026 Netherlands data tracks consumer confidence, housing market confidence, willingness to buy a house, viewings, bids, or buyer sentiment? Include CBS, VEH, NVM, HDN, or market report figures."],
    ["l4_listing_portal_signals", 4, "local_market_subdrivers", "listing_portal_signals", "What 2025-2026 Netherlands data is available from listing portals or market reports for active listings, asking price reductions, time on market, search demand, and price band liquidity? Include Funda, NVM, Huispedia, or regional reports."],
    ["l4_municipal_land_policy", 4, "supply_pipeline_subdrivers", "municipal_land_policy", "What 2025-2026 Netherlands municipal or land-policy factors affect housing construction: land availability, zoning, municipal planning delays, affordable housing quotas, permitting capacity, and regional housing deals? Include figures and sources."],
]
QUERIES = [
    {"id": q[0], "level": q[1], "parent": q[2], "factor": q[3], "prompt": q[4]}
    for q in QUERIES
]


def cala(prompt: str, key: str) -> dict[str, Any]:
    req = urllib.request.Request(
        CALA_URL,
        data=json.dumps({"input": prompt, "explainability": True, "return_entities": False}).encode(),
        headers={"X-API-KEY": key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=175) as resp:
        return json.loads(resp.read().decode("utf-8"))


def src(ctx: dict[str, Any]) -> dict[str, Any]:
    origin = (ctx.get("origins") or [{}])[0]
    return {
        "context_id": ctx.get("id"),
        "source_name": (origin.get("source") or {}).get("name"),
        "document_url": (origin.get("document") or {}).get("url"),
        "document_name": (origin.get("document") or {}).get("name"),
        "snippet": (ctx.get("content") or "")[:500],
    }


def metrics(text: str) -> list[dict[str, str]]:
    pat = re.compile(r"(\d[\d,.]*\s?(%|percent|homes|dwellings|applications|transactions|days|months|EUR|million|billion|bn|k)|Q[1-4]\s+20\d{2}|20\d{2})", re.I)
    out = []
    for line in text.splitlines():
        clean = line.strip(" -|\t")
        if clean and pat.search(clean):
            out.append({"raw_text": clean[:500], "status": "needs_human_normalization"})
    return out[:40]


def node(q: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    content = data.get("content") or ""
    return {
        "id": q["factor"],
        "query_id": q["id"],
        "level": q["level"],
        "parent": q["parent"],
        "prompt": q["prompt"],
        "content_summary": content[:4000],
        "candidate_metrics": metrics(content),
        "sources": [src(c) for c in (data.get("context") or [])[:12]],
        "raw_file": f"raw/{q['id']}.json",
        "source_origin": "cala",
    }


def write_summary(tree: dict[str, Any]) -> None:
    lines = [
        "---",
        "type: research",
        "status: in-progress",
        f"updated: {tree['retrieved_at']}",
        "---",
        "# NL Housing Factor Research",
        "",
        "Generated from Cala responses. The API key is not stored.",
        "",
        f"Exhaustion status: {tree['exhaustion_status']}",
        "",
    ]
    for item in tree["factors"]:
        lines += [f"## L{item['level']} {item['id']}", "", f"Parent: `{item['parent']}`", "", "### Candidate Metrics", ""]
        sample = item["candidate_metrics"][:12] or [{"raw_text": "No numeric lines extracted; inspect raw response."}]
        lines += [f"- {m['raw_text']}" for m in sample]
        lines += ["", "### Sources", ""]
        for s in item["sources"][:6]:
            label = s.get("document_name") or s.get("source_name") or "source"
            url = s.get("document_url")
            lines.append(f"- [{label}]({url})" if url else f"- {label}")
        lines.append("")
    (OUT / "factor_tree_summary.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    key = os.environ.get("CALA_API_KEY")
    if not key:
        raise SystemExit("CALA_API_KEY required; it is not written to disk.")
    RAW.mkdir(parents=True, exist_ok=True)
    factors, failures = [], []
    for q in QUERIES:
        path = RAW / f"{q['id']}.json"
        try:
            if path.exists():
                data = json.loads(path.read_text(encoding="utf-8"))
            else:
                print(f"fetch {q['id']}", flush=True)
                data = cala(q["prompt"], key)
                path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
                time.sleep(1)
            factors.append(node(q, data))
        except Exception as exc:
            failures.append({"query_id": q["id"], "error": repr(exc)})
    tree = {
        "case": "nl_housing",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "exhaustion_status": "not_exhausted; continue until two consecutive passes add no new indicators, source families, or factor leaves.",
        "factors": factors,
        "failures": failures,
        "security": {"api_key_stored": False},
    }
    (OUT / "factor_tree.json").write_text(json.dumps(tree, indent=2, ensure_ascii=False), encoding="utf-8")
    write_summary(tree)
    print(json.dumps({"factors": len(factors), "failures": failures}, indent=2))


if __name__ == "__main__":
    main()
