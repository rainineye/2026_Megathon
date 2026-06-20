from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "work" / "nl_housing_factor_research"
CALA_SOURCE = WORK / "factor_tree.json"
APP_TARGET = ROOT / "app" / "fixtures" / "nl_housing" / "factor_research.json"
MIXED_TARGET = WORK / "mixed_factor_tree_v2.json"
WEB_SOURCES_TARGET = WORK / "web_sources_v2.json"
SUMMARY_TARGET = WORK / "mixed_factor_tree_v2_summary.md"


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


EVIDENCE_STATUS_TAXONOMY: dict[str, dict[str, Any]] = {
    "observed_fact": {
        "label": "Observed fact",
        "is_already_real": True,
        "description": "A reported measurement or event that has already happened.",
    },
    "policy_in_force": {
        "label": "Policy in force",
        "is_already_real": True,
        "description": "A law, rule, or institutional arrangement that is already active.",
    },
    "methodology_or_definition": {
        "label": "Methodology or definition",
        "is_already_real": True,
        "description": "A source/method/definition used to measure the market.",
    },
    "model_estimate": {
        "label": "Model estimate",
        "is_already_real": False,
        "description": "A current-state estimate or modelled indicator, not a direct observed count.",
    },
    "policy_target_or_proposal": {
        "label": "Policy target or proposal",
        "is_already_real": False,
        "description": "A government/institutional target, plan, proposal, or intended future rule.",
    },
    "forecast_or_expectation": {
        "label": "Forecast or expectation",
        "is_already_real": False,
        "description": "A forecast, projection, expected outcome, or conditional future path.",
    },
    "risk_warning_or_scenario": {
        "label": "Risk warning or scenario",
        "is_already_real": False,
        "description": "A warning, at-risk number, scenario, or possible bottleneck outcome.",
    },
    "analysis_or_news_claim": {
        "label": "Analysis or news claim",
        "is_already_real": False,
        "description": "A news/analyst interpretation or causal explanation that is not itself an observed outcome.",
    },
    "rumor_or_unverified": {
        "label": "Rumor or unverified",
        "is_already_real": False,
        "description": "A rumor, unconfirmed report, or explicitly unverified claim.",
    },
    "review_needed": {
        "label": "Review needed",
        "is_already_real": False,
        "description": "The heuristic tagger could not confidently classify this line.",
    },
}


PROBABILITY_SCORING: dict[str, dict[str, Any]] = {
    "observed_fact": {
        "base_pct": 100,
        "label": "100%",
        "description": "Recorded measurement/event, so the UI treats it as already happened.",
    },
    "policy_in_force": {
        "base_pct": 100,
        "label": "100%",
        "description": "Policy/rule is already in force or approved.",
    },
    "methodology_or_definition": {
        "base_pct": 100,
        "label": "100%",
        "description": "Current method/source definition rather than a future event.",
    },
    "model_estimate": {
        "base_pct": 80,
        "label": "80%",
        "description": "Current-state estimate from a model or statistical method, not a direct count.",
    },
    "analysis_or_news_claim": {
        "base_pct": 60,
        "label": "60%",
        "description": "Plausible source/analyst claim, but not directly observed as an outcome.",
    },
    "forecast_or_expectation": {
        "base_pct": 55,
        "label": "55%",
        "description": "Forecast/expectation: meaningful signal, not yet realized.",
    },
    "policy_target_or_proposal": {
        "base_pct": 50,
        "label": "50%",
        "description": "Target, programme, or proposed policy: possible, not guaranteed.",
    },
    "risk_warning_or_scenario": {
        "base_pct": 35,
        "label": "35%",
        "description": "Risk or scenario language: possible adverse path, not baseline fact.",
    },
    "rumor_or_unverified": {
        "base_pct": 15,
        "label": "15%",
        "description": "Explicitly unverified or rumor-like claim.",
    },
    "review_needed": {
        "base_pct": 50,
        "label": "50%",
        "description": "Unknown until manually reviewed.",
    },
}


STATUS_PRIORITY = [
    "rumor_or_unverified",
    "risk_warning_or_scenario",
    "forecast_or_expectation",
    "policy_target_or_proposal",
    "policy_in_force",
    "model_estimate",
    "observed_fact",
    "methodology_or_definition",
    "analysis_or_news_claim",
    "review_needed",
]


def has_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def looks_like_observed_numeric_row(lower_text: str) -> bool:
    if not re.search(r"\d", lower_text):
        return False
    if has_any(
        lower_text,
        [
            "forecast",
            "verwacht",
            "expected",
            "projected",
            "projection",
            "scenario",
            "risk",
            "target",
            "ambition",
            "aims to",
            "expects to",
            "may ",
            "could ",
            "might ",
            "kan ",
            "zal naar verwachting",
        ],
    ):
        return False
    has_year = bool(re.search(r"\b20\d{2}\b|\bq[1-4]\s+20\d{2}\b", lower_text))
    observed_terms = [
        "sold",
        "sales",
        "transactions",
        "applications",
        "index",
        "price",
        "prices",
        "asking",
        "above asking",
        "overbidding",
        "paid on average",
        "mortgage debt",
        "household debt",
        "value",
        "income",
        "growth",
        "population",
        "reached",
        "increased by",
        "average wait",
        "waiting list",
        "average rent",
        "standing empty",
        "homes",
        "housing stock",
        "rented homes",
        "woningen",
        "koopwoningen",
        "woningvoorraad",
        "huurwoningen",
        "schuld",
        "transacties",
        "verkocht",
        "aanvragen",
        "prijs",
        "prijzen",
    ]
    has_observed_term = has_any(lower_text, observed_terms)
    if "|" in lower_text and (has_year or has_observed_term):
        return True
    if has_year and has_observed_term:
        return True
    return has_observed_term and has_any(
        lower_text,
        [
            "paid on average",
            "sold above asking",
            "growth of",
            "population reached",
            "average wait",
            "average rent",
            "standing empty",
        ],
    )


def score_evidence_probability(status: str, lower_text: str, provider: str) -> dict[str, Any]:
    scoring = PROBABILITY_SCORING[status]
    pct = int(scoring["base_pct"])
    adjustments: list[str] = []

    if pct == 100:
        return {
            "probability_pct": 100,
            "probability_label": "100%",
            "probability_rationale": scoring["description"],
        }

    official_terms = [
        "cbs",
        "kadaster",
        "dnb",
        "rijksoverheid",
        "volkshuisvesting",
        "nibud",
        "nhg",
        "bij12",
        "netbeheer",
        "eurostat",
        "imf",
        "ecb",
        "government",
        "ministry",
    ]
    weak_terms = ["blog", "opinion", "commentary", "yahoo", "news", "article", "reported"]
    uncertainty_terms = ["could", "may", "might", "kan ", "zou ", "scenario", "at risk", "dreigt", "risico"]

    source_text = f"{provider} {lower_text}"
    if status in {"model_estimate", "forecast_or_expectation", "policy_target_or_proposal", "analysis_or_news_claim"}:
        if has_any(source_text, official_terms):
            pct += 5
            adjustments.append("+5 official/statistical source")
        if has_any(source_text, weak_terms):
            pct -= 5
            adjustments.append("-5 news/opinion framing")
    if status in {"forecast_or_expectation", "policy_target_or_proposal", "analysis_or_news_claim"} and has_any(
        lower_text, uncertainty_terms
    ):
        pct -= 5
        adjustments.append("-5 conditional language")

    pct = max(5, min(95, pct))
    rationale = scoring["description"]
    if adjustments:
        rationale = f"{rationale} Adjustments: {', '.join(adjustments)}."
    return {
        "probability_pct": pct,
        "probability_label": f"{pct}%",
        "probability_rationale": rationale,
    }


def classify_evidence_text(text: str, source_provider: str | None = None) -> dict[str, Any]:
    raw = (text or "").strip()
    lower = raw.lower()
    provider = (source_provider or "").lower()
    status = "review_needed"
    rationale = "No strong status keyword matched."

    if raw.startswith("#") or (
        raw.startswith("**")
        and len(raw) < 180
        and not has_any(lower, ["|", ":", ";"])
        and lower.count("**") <= 2
    ):
        status = "methodology_or_definition"
        rationale = "Text is a heading/grouping label rather than a standalone market event."
    elif has_any(lower, ["rumor", "rumour", "gerucht", "unconfirmed", "ongeverifieerd", "unverified"]):
        status = "rumor_or_unverified"
        rationale = "Text explicitly signals rumor/unverified status."
    elif has_any(lower, ["discrepancy", "several sources", "other sources", "conflicting", "inconsistent"]):
        status = "analysis_or_news_claim"
        rationale = "Text flags cross-source comparison or inconsistency rather than a settled data point."
    elif has_any(
        lower,
        [
            "not quantified",
            "not found",
            "does not provide",
            "no exact",
            "no quantified",
            "geen exact",
            "niet gevonden",
        ],
    ):
        status = "methodology_or_definition"
        rationale = "Text records data coverage or methodology limits, not a realized market change."
    elif has_any(
        lower,
        [
            "took effect",
            "entered into force",
            "effective 1 july 2024",
            "effective 1 july 2025",
            "effective 1 january 2025",
            "is op 1 juli 2024 ingegaan",
            "is op 1 januari 2025 ingegaan",
            "sinds 2021",
            "since 2021",
            "since 1 july 2025",
            "sinds 1 juli 2025",
            "geldt voor",
            "applies to",
            "approved",
            "aangenomen",
            "nhg limit",
            "nhg-grens",
            "transfer tax",
            "overdrachtsbelasting",
            "tax exemption",
            "vrijstelling",
            "conditions for exemption",
            "since 2024",
            "standard transfer tax rates",
            "limit rises",
            "maximum ltv",
            "maximum mortgage is set",
            "maximum rent levels",
            "annual rent increase caps",
            "as of 1 july 2024",
            "as of 1 january 2025",
            "must reduce",
            "must attach",
            "tenant can seek",
            "huurcommissie",
        ],
    ):
        status = "policy_in_force"
        rationale = "Text describes a policy/rule already in force or approved."
    elif has_any(
        lower,
        [
            "at risk",
            "warn",
            "warning",
            "risk",
            "risico",
            "vrezen",
            "dreigt",
            "threat",
            "could stall",
            "kan stilvallen",
            "scenario",
            "would respond",
            "if adverse",
            "without clear",
            "zonder duidelijke",
        ],
    ):
        status = "risk_warning_or_scenario"
        rationale = "Text describes a risk, warning, or conditional scenario."
    elif has_any(
        lower,
        [
            "expects",
            "expected",
            "forecast",
            "projected",
            "projection",
            "projects",
            "set to",
            "is set to",
            "will",
            "would",
            "could",
            "may",
            "verwacht",
            "verwachting",
            "kan ",
            "kunnen ",
            "zou ",
            "zullen ",
            "naar verwachting",
            "coming years",
            "over the coming",
        ],
    ):
        status = "forecast_or_expectation"
        rationale = "Text is framed as forecast, expectation, or future conditional outcome."
    elif has_any(
        lower,
        [
            "target",
            "aim",
            "aims",
            "plan",
            "planned",
            "proposal",
            "proposed",
            "intended",
            "beoogd",
            "wil ",
            "streeft",
            "mikt op",
            "programma",
            "through 2030",
            "tot en met 2030",
            "per year target",
            "per jaar",
            "wetsvoorstel",
            "intends",
            "wants to",
            "effective 1 july 2026",
            "as of 1 july 2026",
            "from 1 july 2026",
            "prioritisation framework",
            "minimum of",
            "must be social rental",
        ],
    ):
        status = "policy_target_or_proposal"
        rationale = "Text is a target, programme, proposal, or intended future policy."
    elif has_any(
        lower,
        [
            "shortage",
            "woningtekort",
            "estimate",
            "estimated",
            "model",
            "modelled",
            "indicator",
            "raming",
            "tekort",
            "primos",
            "abf",
        ],
    ):
        status = "model_estimate"
        rationale = "Text is a current-state estimate/modelled indicator rather than a direct event."
    elif looks_like_observed_numeric_row(lower):
        status = "observed_fact"
        rationale = "Text is a dated numeric observation or table row without expectation language."
    elif has_any(
        lower,
        [
            "measures",
            "tracks",
            "publishes",
            "published",
            "publiceert",
            "definieert",
            "definition",
            "tabeltoelichting",
            "uses",
            "maakt gebruik",
            "dashboard",
            "kaart",
            "legend",
            "method",
            "methodology",
            "source:",
        ],
    ):
        status = "methodology_or_definition"
        rationale = "Text describes source methodology, definitions, or publication scope."
    elif has_any(
        lower,
        [
            "rose",
            "grew",
            "was ",
            "were ",
            "stood at",
            "registered",
            "reports",
            "reported",
            "meldt",
            "waren",
            "stegen",
            "groeide",
            "bedroeg",
            "in maart",
            "in q1",
            "on 17 june 2026",
            "2026 q1",
            "full-year",
            "year-on-year",
            "jaar eerder",
        ],
    ):
        status = "observed_fact"
        rationale = "Text reports an observed measurement or past/current event."
    elif has_any(
        lower,
        [
            "says",
            "identifies",
            "links",
            "attributed",
            "analysis",
            "commentary",
            "notes",
            "coverage",
            "near-comprehensive",
            "breakdown",
            "based on the provided context",
            "interpretation",
            "lists",
        ],
    ) or has_any(provider, ["bank", "web_open", "news"]):
        status = "analysis_or_news_claim"
        rationale = "Text is a source/analyst/news interpretation rather than a direct observation."
    elif lower:
        status = "analysis_or_news_claim"
        rationale = "No stronger fact/policy/forecast signal matched; conservatively treated as a source claim."

    taxonomy = EVIDENCE_STATUS_TAXONOMY[status]
    return {
        "status": status,
        "label": taxonomy["label"],
        "is_already_real": taxonomy["is_already_real"],
        "rationale": rationale,
        **score_evidence_probability(status, lower, provider),
    }


def tagged_text_item(text: str, source_provider: str | None = None) -> dict[str, Any]:
    return {"text": text, **classify_evidence_text(text, source_provider)}


def status_counts(items: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        status = item.get("status") or item.get("evidence_status")
        if status:
            counts[status] = counts.get(status, 0) + 1
    return counts


def probability_values(items: list[dict[str, Any]]) -> list[int]:
    values: list[int] = []
    for item in items:
        pct = item.get("probability_pct")
        if isinstance(pct, int | float):
            values.append(int(pct))
    return values


def average_probability_pct(items: list[dict[str, Any]]) -> int | None:
    values = probability_values(items)
    if not values:
        return None
    return round(sum(values) / len(values))


def probability_bucket_counts(items: list[dict[str, Any]]) -> dict[str, int]:
    buckets = {
        "100": 0,
        "75_99": 0,
        "50_74": 0,
        "25_49": 0,
        "0_24": 0,
    }
    for pct in probability_values(items):
        if pct == 100:
            buckets["100"] += 1
        elif pct >= 75:
            buckets["75_99"] += 1
        elif pct >= 50:
            buckets["50_74"] += 1
        elif pct >= 25:
            buckets["25_49"] += 1
        else:
            buckets["0_24"] += 1
    return {bucket: count for bucket, count in buckets.items() if count}


def dominant_status(items: list[dict[str, Any]]) -> str:
    counts = status_counts(items)
    if not counts:
        return "review_needed"
    return sorted(counts, key=lambda status: (-counts[status], STATUS_PRIORITY.index(status)))[0]


def tag_policy_changes(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tagged: list[dict[str, Any]] = []
    for item in items:
        text = " ".join(str(item.get(key, "")) for key in ("date", "title", "expected_effect"))
        tagged.append({**item, "evidence_status": classify_evidence_text(text)})
    return tagged


def tag_bottleneck_outlook(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tagged: list[dict[str, Any]] = []
    for item in items:
        text = " ".join(str(item.get(key, "")) for key in ("period", "expected_change", "rationale"))
        tagged.append({**item, "evidence_status": classify_evidence_text(text)})
    return tagged


WEB_SOURCES: list[dict[str, Any]] = [
    {
        "id": "cbs_pbk_method",
        "label": "CBS - Price index existing own homes method",
        "url": "https://www.cbs.nl/en-gb/our-services/methods/surveys/brief-survey-description/price-index-existing-own-homes",
        "source_provider": "web_open",
        "published_at": None,
        "evidence_notes": [
            "CBS/Kadaster PBK measures existing owner-occupied home prices from Land Registry transactions and WOZ values.",
            "CBS publishes monthly national data and regional/type tables; average selling price is not the preferred price-development indicator.",
        ],
    },
    {
        "id": "cbs_nl_prices_march_2026",
        "label": "CBS NL - Koopwoningen in maart 5 procent duurder dan jaar eerder",
        "url": "https://www.cbs.nl/nl-nl/nieuws/2026/17/koopwoningen-in-maart-5-procent-duurder-dan-jaar-eerder",
        "source_provider": "web_open_nl",
        "published_at": "2026",
        "language": "nl",
        "evidence_notes": [
            "CBS/Kadaster melden dat bestaande koopwoningen in maart 2026 gemiddeld 5,0% duurder waren dan een jaar eerder.",
            "De prijzen stegen in maart 2026 gemiddeld 0,3% ten opzichte van februari 2026.",
            "Er waren bijna 13% meer woningtransacties in maart dan een jaar eerder.",
        ],
    },
    {
        "id": "cbs_nl_statline_85773ned",
        "label": "CBS StatLine NL - Bestaande koopwoningen; verkoopprijzen prijsindex 2020=100",
        "url": "https://www.cbs.nl/nl-nl/cijfers/detail/85773NED",
        "source_provider": "web_open_nl",
        "published_at": None,
        "language": "nl",
        "evidence_notes": [
            "CBS StatLine publiceert de PBK-prijsindex, transacties, gemiddelde verkoopprijs en totale verkoopwaarde voor bestaande koopwoningen.",
            "De tabeltoelichting zegt dat de PBK de prijsontwikkeling van verkochte bestaande koopwoningen weergeeft.",
        ],
    },
    {
        "id": "kadaster_nl_vastgoeddashboard",
        "label": "Kadaster NL - Vastgoeddashboard",
        "url": "https://www.kadaster.nl/zakelijk/vastgoedinformatie/vastgoedcijfers/vastgoeddashboard",
        "source_provider": "web_open_nl",
        "published_at": None,
        "language": "nl",
        "evidence_notes": [
            "Kadaster biedt direct inzicht in het aantal verkochte woningen per provincie, gemiddelde koopsom en meer.",
            "Kadaster definieert verkochte woningen als bestaande woningen aan particulieren die het Kadaster in een periode heeft geregistreerd.",
            "Kadaster publiceert samen met CBS de aantallen woningtransacties.",
        ],
    },
    {
        "id": "cbs_population_q1_2026",
        "label": "CBS - Population growth slows due to lower immigration",
        "url": "https://www.cbs.nl/en-gb/news/2026/18/population-growth-slows-due-to-lower-immigration",
        "source_provider": "web_open",
        "published_at": "2026-04-30",
        "evidence_notes": [
            "Netherlands population grew by 9.6k in Q1 2026, the lowest first-quarter growth since 2015.",
            "Q1 2026 immigration was 66.3k and emigration 48.4k, so net migration was 17.8k versus 30.6k in Q1 2025.",
        ],
    },
    {
        "id": "dnb_housing_market",
        "label": "DNB - Housing market",
        "url": "https://www.dnb.nl/en/current-economic-issues/housing-market",
        "source_provider": "web_open",
        "published_at": None,
        "evidence_notes": [
            "DNB links the 2022-2023 price fall to rising mortgage rates, and the later rebound to rates stabilising plus income growth.",
            "DNB expects owner-occupied house prices to rise 7.5% in 2025 and 4% in 2026 after 8.7% in 2024.",
            "DNB identifies supply constraints including higher interest rates, material costs, staff shortages and tightened nitrogen procedures.",
            "DNB defines financing capacity as maximum borrowing capacity plus average net assets, including savings and financial assets.",
        ],
    },
    {
        "id": "dnb_spring_2026_key_figures",
        "label": "DNB - Five key figures on the Dutch economy",
        "url": "https://www.dnb.nl/en/general-news/background-2026/the-five-key-figures-on-the-dutch-economy/",
        "source_provider": "web_open",
        "published_at": "2026-06-12",
        "evidence_notes": [
            "DNB says owner-occupied home prices are set to rise 3%-4% annually over the coming years.",
            "Higher mortgage rates and lower consumer confidence hold back price growth, while wages still support borrowing capacity.",
        ],
    },
    {
        "id": "dnb_spring_2026_macro",
        "label": "DNB - Spring projections press release",
        "url": "https://www.dnb.nl/en/general-news/press-release-2026/war-in-the-middle-east-is-holding-back-economic-growth-and-driving-up-inflation/",
        "source_provider": "web_open",
        "published_at": "2026-06-12",
        "evidence_notes": [
            "DNB projects Dutch GDP growth of 0.8% in 2026 after 1.8% in 2025, then 1.2% in 2027 and 1.3% in 2028.",
            "DNB projects inflation at 2.7% in 2026 versus 3.0% in 2025.",
            "DNB says the ECB would respond with higher rates if adverse energy-price scenarios lifted inflation materially.",
        ],
    },
    {
        "id": "dnb_residential_mortgages",
        "label": "DNB - Residential mortgages dashboard",
        "url": "https://www.dnb.nl/en/statistics/dashboards/residential-mortgages/",
        "source_provider": "web_open",
        "published_at": None,
        "evidence_notes": [
            "DNB states Dutch households have more than EUR800bn in mortgage debt, nearly 77% of GDP.",
            "The dashboard covers mortgage-market size, bank mortgage lending rates and bank lending survey supply/demand standards.",
            "DNB notes average bank lending rates on new mortgage loans have been trending down in recent years.",
        ],
    },
    {
        "id": "dnb_household_savings",
        "label": "DNB - Household savings dashboard",
        "url": "https://www.dnb.nl/en/statistics/dashboards/household-savings/",
        "source_provider": "web_open",
        "published_at": None,
        "evidence_notes": [
            "The dashboard tracks Dutch household savings at banks, withdrawals, deposits and credited interest.",
            "These savings and overnight deposits are liquid balance-sheet channels relevant to down payments and family loans.",
        ],
    },
    {
        "id": "nibud_nl_hypotheeknormen_2026_report",
        "label": "Nibud NL - Rapport Advies hypotheeknormen 2026",
        "url": "https://www.nibud.nl/onderzoeksrapporten/rapport-advies-hypotheeknormen-2026-2025/",
        "source_provider": "web_open_nl",
        "published_at": "2025",
        "language": "nl",
        "evidence_notes": [
            "Nibud schrijft dat voor 2026 alle huishoudens die de verwachte gemiddelde loonstijging krijgen een hogere hypotheek kunnen krijgen.",
            "Voor 2026 wordt een loonstijging van 4,1% verwacht door het Centraal Planbureau.",
            "Zonder loonstijging daalt de leencapaciteit voor alle inkomens; inclusief loonstijging stijgt de leencapaciteit.",
        ],
    },
    {
        "id": "nibud_nl_hogere_hypotheek_2026",
        "label": "Nibud NL - Hogere hypotheek in 2026 door loonstijging",
        "url": "https://www.nibud.nl/nieuws/hogere-hypotheek-in-2026-door-loonstijging/",
        "source_provider": "web_open_nl",
        "published_at": "2025",
        "language": "nl",
        "evidence_notes": [
            "Nibud meldt dat de gemiddelde loonstijging van 4,1% die het CPB verwacht meer hypotheekruimte geeft.",
            "Een huishouden met bruto jaarinkomen van EUR70k kan in 2026 ongeveer EUR6k meer lenen dan nu.",
            "Voor zeer energiezuinige woningen wordt het extra hypotheekbedrag verlaagd omdat veel zonnepanelen minder rendabel zijn geworden.",
        ],
    },
    {
        "id": "nhg_nl_hypotheek_met_nhg",
        "label": "NHG NL - Een hypotheek met NHG",
        "url": "https://www.nhg.nl/het-product-nhg/een-hypotheek-met-nhg/",
        "source_provider": "web_open_nl",
        "published_at": None,
        "language": "nl",
        "evidence_notes": [
            "NHG zegt dat een hypotheek met NHG past bij het inkomen en extra zekerheid biedt als de hypotheek niet meer betaalbaar is.",
            "NHG meldt dat geldverstrekkers die extra zekerheid belonen met een lagere hypotheekrente.",
        ],
    },
    {
        "id": "dnb_afm_mortgage_monitor_2026",
        "label": "DNB/AFM - Monitor on mortgage lending standards and financial stability 2026",
        "url": "https://www.dnb.nl/media/cvfhqws0/86281_2600115_dnb_brochure-fs-monitor_engels_web.pdf",
        "source_provider": "web_open_pdf",
        "published_at": "2026",
        "evidence_notes": [
            "DNB/AFM says household vulnerabilities declined, but LTV and LTI ratios have risen since 2022.",
            "The monitor notes house prices rose 21% while incomes rose 14% since mid-2023.",
            "It reports about 75% of homes sold above asking price in 2025 and mortgage debt grew more than 5% YoY in Q2 2025.",
        ],
    },
    {
        "id": "openrijk_nh_bottlenecks",
        "label": "Openrijk / Province North Holland - nitrogen and grid bottlenecks",
        "url": "https://openrijk.nl/en/provincies/provincie-noord-holland/artikel/Stikstof_en_netcongestie_grootste_knelpunten_woningbouw/nitrogen-and-grid-congestion-biggest-bottlenecks-in-housing-construction",
        "source_provider": "web_open",
        "published_at": "2025-10-23",
        "evidence_notes": [
            "North Holland says nitrogen and grid congestion are the biggest housing-construction bottlenecks.",
            "99.5% of North Holland housing projects deal with nitrogen and more than 41% of planned homes are within 5km of nitrogen-sensitive nature.",
            "Grid congestion causes delays in almost every project; unprofitable peaks of EUR10k-EUR35k per home affect more than half of homes.",
        ],
    },
    {
        "id": "bij12_nl_stikstof",
        "label": "BIJ12 NL - Stikstof",
        "url": "https://www.bij12.nl/onderwerp/stikstof/",
        "source_provider": "web_open_nl",
        "published_at": None,
        "language": "nl",
        "evidence_notes": [
            "BIJ12 verzamelt actuele informatie over het stikstofdossier, vergunningverlening en natuurmonitoring.",
            "De pagina routeert naar passende beoordeling, intern/extern salderen, additionaliteit, stikstofbanken en natuurvergunning aanvragen.",
        ],
    },
    {
        "id": "openrijk_g4_grid_acm",
        "label": "Openrijk / Municipality Utrecht - G4 grid-congestion warning",
        "url": "https://openrijk.nl/en/gemeenten/gemeente-utrecht/artikel/grote-steden-vrezen-voor-stilstand-woningbouw-door-netcongestie/major-cities-fear-stagnation-in-housing-construction-due-to-grid-congestion",
        "source_provider": "web_open",
        "published_at": "2025-10-02",
        "evidence_notes": [
            "The G4 cities warn that without clear agreements and national coordination, more than 160k homes plus social facilities are at risk.",
            "A new ACM prioritisation framework is expected from 1 January 2026, with transition guarantees and practical agreements requested.",
        ],
    },
    {
        "id": "netbeheer_nl_capaciteitskaart",
        "label": "Netbeheer Nederland NL - Capaciteitskaart elektriciteitsnet",
        "url": "https://capaciteitskaart.netbeheernederland.nl/",
        "source_provider": "web_open_nl",
        "published_at": None,
        "language": "nl",
        "evidence_notes": [
            "Netbeheer Nederland publiceert een capaciteitskaart elektriciteitsnet voor afname, teruglevering en totaal.",
            "De legenda onderscheidt onder meer transportcapaciteit beschikbaar, beperkt beschikbaar, gebied in onderzoek met wachtrij en tekort aan transportcapaciteit met wachtrij.",
        ],
    },
    {
        "id": "ecb_key_rates",
        "label": "ECB - Key ECB interest rates",
        "url": "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html",
        "source_provider": "web_open",
        "published_at": None,
        "evidence_notes": [
            "On 17 June 2026 the ECB deposit facility, main refinancing and marginal lending rates were 2.25%, 2.40% and 2.65%.",
            "The deposit rate was 2.00% on 11 June 2025, 3.00% in December 2024 and 4.00% in September 2023.",
        ],
    },
    {
        "id": "abn_housing_forecast_april_2025",
        "label": "ABN AMRO - Rise in house prices to continue in 2025 and 2026",
        "url": "https://www.abnamro.com/en/news/rise-in-house-prices-to-continue-in-2025-and-2026-despite-uncertainties",
        "source_provider": "web_open",
        "published_at": "2025-04",
        "evidence_notes": [
            "ABN AMRO forecast house prices up 7% in 2025 and 3% in 2026, driven by lower mortgage rates, shortage and higher household incomes.",
            "ABN AMRO notes 2024 house prices rose 8.7%.",
        ],
    },
    {
        "id": "abn_housing_update_july_2025",
        "label": "ABN AMRO - Dutch housing market resilience update",
        "url": "https://www.abnamro.com/en/news/the-dutch-housing-market-shows-resilience-in-the-face-of-global-uncertainty",
        "source_provider": "web_open",
        "published_at": "2025-07",
        "evidence_notes": [
            "ABN AMRO revised 2025 house-price growth to 8% and transactions to 12.5%.",
            "ABN AMRO says investor rental sales boost transactions until early 2026 and the 100k homes target is missed, so the shortage grows.",
            "ABN AMRO links household saving/investment buffers to possible housing purchases or family loans.",
        ],
    },
    {
        "id": "rijk_box3",
        "label": "Rijksoverheid - Box 3",
        "url": "https://www.rijksoverheid.nl/themas/werk/inkomstenbelasting/box-3",
        "source_provider": "web_open",
        "published_at": None,
        "evidence_notes": [
            "Box 3 uses bridge rules and actual-return refunds since 2021.",
            "For investments, the forfaitary return was 6.17% in 2023 and 6.04% in 2024; actual share returns shown were 15.04% and 8.43%.",
            "A new actual-return Box 3 system is intended to start on 1 January 2028 if enacted.",
        ],
    },
    {
        "id": "rijk_box3_nl",
        "label": "Rijksoverheid NL - Box 3 rechtsherstel en overbruggingswetgeving",
        "url": "https://www.rijksoverheid.nl/onderwerpen/inkomstenbelasting/box-3",
        "source_provider": "web_open_nl",
        "published_at": None,
        "language": "nl",
        "evidence_notes": [
            "Rijksoverheid zegt dat de Belastingdienst sinds 2021 rekent met rendement dat dichter ligt bij werkelijk rendement.",
            "Sinds 1 juli 2025 kunnen belastingplichtigen die te veel box-3-belasting betaalden geld terugvragen via de tegenbewijsregeling.",
            "Tot er een nieuw box-3-stelsel is, rekent de Belastingdienst met een rendement dat dicht bij de werkelijkheid ligt.",
        ],
    },
    {
        "id": "volkshuisvesting_affordable_rent",
        "label": "Volkshuisvesting Nederland - Affordable Rent Act",
        "url": "https://www.volkshuisvestingnederland.nl/onderwerpen/huren-en-wonen/wet-betaalbare-huur",
        "source_provider": "web_open",
        "published_at": None,
        "evidence_notes": [
            "The Affordable Rent Act took effect on 1 July 2024.",
            "The modernised WWS applies to mid-rent up to 186 points; municipalities can intervene from 1 January 2025.",
            "The government expects rent reductions for 300k homes by an average EUR190.",
        ],
    },
    {
        "id": "volkshuisvesting_nl_wet_betaalbare_huur",
        "label": "Volkshuisvesting Nederland NL - Wet betaalbare huur",
        "url": "https://www.volkshuisvestingnederland.nl/onderwerpen/huren-en-wonen/wet-betaalbare-huur",
        "source_provider": "web_open_nl",
        "published_at": None,
        "language": "nl",
        "evidence_notes": [
            "De Wet betaalbare huur is op 1 juli 2024 ingegaan.",
            "Het gemoderniseerde WWS geldt voor middenhuurwoningen tot en met 186 punten.",
            "Door de wet gaat de huur van 300k woningen op termijn met gemiddeld EUR190 omlaag.",
        ],
    },
    {
        "id": "rijk_nl_nieuwe_woningen",
        "label": "Rijksoverheid NL - 900.000 nieuwe woningen",
        "url": "https://www.rijksoverheid.nl/onderwerpen/volkshuisvesting/nieuwe-woningen",
        "source_provider": "web_open_nl",
        "published_at": None,
        "language": "nl",
        "evidence_notes": [
            "Rijksoverheid zegt dat Nederland een groot tekort aan woningen heeft.",
            "De Rijksoverheid wil dat er 900k woningen gebouwd worden tot en met 2030.",
            "Het woningtekort steeg in 2021 tot 279k en zou naar verwachting oplopen tot 317k woningen in 2024 volgens de Nationale Woon- en Bouwagenda.",
        ],
    },
    {
        "id": "volkshuisvesting_nl_programma_woningbouw",
        "label": "Volkshuisvesting Nederland NL - Programma Woningbouw",
        "url": "https://www.volkshuisvestingnederland.nl/onderwerpen/programma-woningbouw",
        "source_provider": "web_open_nl",
        "published_at": "2025-10-22",
        "language": "nl",
        "evidence_notes": [
            "Het Programma Woningbouw zet in op 900k woningen tot en met 2030.",
            "Het programma mikt op groei van de bouwproductie naar 100k woningen per jaar in deze kabinetsperiode.",
            "Het streven is dat ten minste twee derde van nieuwbouwwoningen betaalbare huur- en koopwoningen zijn.",
        ],
    },
    {
        "id": "euronext_aex_quote",
        "label": "Euronext - AEX official quote page",
        "url": "https://live.euronext.com/en/product/indices/NL0000000107-XAMS",
        "source_provider": "web_open",
        "published_at": None,
        "evidence_notes": [
            "Euronext operates the official AEX index quote page for NL0000000107 on Euronext Amsterdam.",
            "AEX is the Dutch large-cap equity benchmark used here as a proxy source for the stock-market wealth/liquidity channel, not as Cala data.",
        ],
    },
]


WEB_FACTORS: list[dict[str, Any]] = [
    {
        "id": "supply_bottleneck_breakdown",
        "label": "Supply bottleneck breakdown",
        "level": 2,
        "parent": "market_state",
        "summary": (
            "Supply remains the main upside-price constraint: the existing Cala tree captures the national shortage and project pipeline, "
            "while web evidence shows the operative bottlenecks are grid capacity, nitrogen permitting, project viability and execution capacity."
        ),
        "mechanism": "If completions stay below household formation and demand, the shortage persists and prices/rents remain supported.",
        "direction_on_prices": "up",
        "top_metrics": [
            "DNB says owner-occupied prices are set to rise 3%-4% annually over the coming years despite slower growth.",
            "G4 cities warn that more than 160k homes plus social facilities are at risk without grid-prioritisation agreements.",
            "North Holland reports nitrogen and grid congestion as the biggest housing-construction bottlenecks.",
        ],
        "source_ids": [
            "dnb_spring_2026_key_figures",
            "dnb_housing_market",
            "openrijk_g4_grid_acm",
            "openrijk_nh_bottlenecks",
            "rijk_nl_nieuwe_woningen",
            "volkshuisvesting_nl_programma_woningbouw",
        ],
        "cala_factor_ids": ["structural_shortage", "supply_pipeline_subdrivers"],
        "policy_changes": [
            {
                "date": "2026-01-01",
                "title": "ACM grid prioritisation framework expected",
                "expected_effect": "Could reduce connection uncertainty for public-priority projects if transition rules and local agreements are workable.",
                "source_ids": ["openrijk_g4_grid_acm"],
            }
        ],
        "bottleneck_outlook": [
            {
                "period": "2026-2028",
                "expected_change": "Supply bottlenecks ease only slowly unless grid capacity, nitrogen procedures and municipal/corporation execution improve together.",
                "confidence": "medium",
                "rationale": "Multiple independent sources point to binding non-price constraints rather than only developer appetite.",
                "source_ids": ["dnb_housing_market", "openrijk_nh_bottlenecks", "openrijk_g4_grid_acm"],
            }
        ],
    },
    {
        "id": "nitrogen_permitting_outlook",
        "label": "Nitrogen permitting outlook",
        "level": 3,
        "parent": "supply_bottleneck_breakdown",
        "summary": (
            "Nitrogen is a direct permitting risk for housing projects near sensitive nature areas. It slows or blocks supply even when demand and prices support building."
        ),
        "mechanism": "Permitting uncertainty raises delay risk and feasibility costs; fewer timely completions keep market tight.",
        "direction_on_prices": "up",
        "top_metrics": [
            "North Holland says 99.5% of housing projects deal with nitrogen.",
            "More than 41% of planned North Holland homes are within 5km of nitrogen-sensitive nature.",
            "DNB lists tightened nitrogen procedures as a constraint on new housing supply.",
        ],
        "source_ids": ["openrijk_nh_bottlenecks", "dnb_housing_market", "bij12_nl_stikstof"],
        "cala_factor_ids": ["nitrogen_construction_constraint"],
        "policy_changes": [],
        "bottleneck_outlook": [
            {
                "period": "2026-2030",
                "expected_change": "Risk stays high until permitting rules, project-level mitigation and ecological/legal capacity become more predictable.",
                "confidence": "medium",
                "rationale": "The bottleneck is legal/ecological and location-specific, so capacity additions alone do not solve it.",
                "source_ids": ["openrijk_nh_bottlenecks", "dnb_housing_market", "bij12_nl_stikstof"],
            }
        ],
    },
    {
        "id": "grid_capacity_outlook",
        "label": "Grid capacity outlook",
        "level": 3,
        "parent": "supply_bottleneck_breakdown",
        "summary": (
            "Electricity-grid capacity is now a housing-delivery constraint, especially where new homes, amenities and heat/electrification loads need connections."
        ),
        "mechanism": "Grid delays push completions out in time; delayed supply supports prices in tight regions.",
        "direction_on_prices": "up",
        "top_metrics": [
            "G4 cities warn more than 160k homes plus social facilities are at risk without national coordination.",
            "North Holland says grid congestion causes delays in almost every project.",
            "ACM's new prioritisation framework is expected from 1 January 2026.",
        ],
        "source_ids": ["openrijk_g4_grid_acm", "openrijk_nh_bottlenecks", "netbeheer_nl_capaciteitskaart"],
        "cala_factor_ids": ["grid_congestion"],
        "policy_changes": [
            {
                "date": "2026-01-01",
                "title": "ACM prioritisation framework for grid connections",
                "expected_effect": "May help allocate scarce capacity to public-priority housing and facilities, but does not itself create physical grid capacity.",
                "source_ids": ["openrijk_g4_grid_acm"],
            }
        ],
        "bottleneck_outlook": [
            {
                "period": "2026-2035",
                "expected_change": "Administrative prioritisation can reduce queue risk; physical grid expansion likely remains a multi-year bottleneck.",
                "confidence": "medium",
                "rationale": "The data show immediate project risk and long infrastructure lead times.",
                "source_ids": ["openrijk_g4_grid_acm", "openrijk_nh_bottlenecks", "netbeheer_nl_capaciteitskaart"],
            }
        ],
    },
    {
        "id": "development_viability_execution",
        "label": "Development viability and execution capacity",
        "level": 3,
        "parent": "supply_bottleneck_breakdown",
        "summary": (
            "Even when projects can be permitted and connected, unprofitable peaks, corporation balance-sheet limits and municipal staffing can constrain delivery."
        ),
        "mechanism": "Higher per-home feasibility gaps and staffing bottlenecks reduce starts or require subsidies, slowing supply response.",
        "direction_on_prices": "up",
        "top_metrics": [
            "North Holland reports unprofitable peaks of EUR10k-EUR35k per home.",
            "Those unprofitable peaks affect more than half of homes in the North Holland project sample.",
            "The same source flags housing-corporation investment capacity and municipal manpower/expertise as bottlenecks.",
        ],
        "source_ids": ["openrijk_nh_bottlenecks", "dnb_housing_market"],
        "cala_factor_ids": ["construction_costs", "municipal_land_policy"],
        "policy_changes": [],
        "bottleneck_outlook": [
            {
                "period": "2026-2028",
                "expected_change": "Viability improves if subsidies, land policy, rates or construction costs move favourably; otherwise starts stay vulnerable.",
                "confidence": "medium",
                "rationale": "The gap is partly financial and partly public-sector execution capacity.",
                "source_ids": ["openrijk_nh_bottlenecks", "dnb_housing_market"],
            }
        ],
    },
    {
        "id": "borrow_interest_credit_channel",
        "label": "Borrow interest and credit channel",
        "level": 2,
        "parent": "market_state",
        "summary": (
            "Mortgage affordability remains a direct demand constraint. Rates below the 2023 peak helped prices recover, but 2026 DNB guidance says higher rates still cap borrowing-capacity growth."
        ),
        "mechanism": "Lower mortgage rates raise bid capacity; higher rates or tighter standards reduce maximum loans and dampen price growth.",
        "direction_on_prices": "mixed",
        "top_metrics": [
            "ECB rates on 17 June 2026: deposit 2.25%, main refinancing 2.40%, marginal lending 2.65%.",
            "DNB says Dutch households have more than EUR800bn in mortgage debt, nearly 77% of GDP.",
            "DNB/AFM says house prices rose 21% while incomes rose 14% since mid-2023.",
            "DNB says higher mortgage rates hold back 3%-4% annual price growth, while wage growth still supports borrowing capacity.",
        ],
        "source_ids": [
            "ecb_key_rates",
            "dnb_residential_mortgages",
            "dnb_afm_mortgage_monitor_2026",
            "dnb_spring_2026_key_figures",
            "nibud_nl_hypotheeknormen_2026_report",
            "nibud_nl_hogere_hypotheek_2026",
            "nhg_nl_hypotheek_met_nhg",
        ],
        "cala_factor_ids": ["financing_pressure", "borrowing_capacity_subdrivers", "nibud_lending_standards_2026"],
        "policy_changes": [
            {
                "date": "2026-06-17",
                "title": "ECB key rates at 2.25%/2.40%/2.65%",
                "expected_effect": "Policy rates anchor funding conditions; mortgage rates and swaps transmit with bank margins and fixed-rate demand.",
                "source_ids": ["ecb_key_rates"],
            }
        ],
        "bottleneck_outlook": [
            {
                "period": "2026-2028",
                "expected_change": "Credit remains supportive only if wages keep rising faster than rate/payment pressure.",
                "confidence": "medium",
                "rationale": "DNB explicitly offsets rate drag against wage-supported borrowing capacity.",
                "source_ids": ["dnb_spring_2026_key_figures", "dnb_afm_mortgage_monitor_2026"],
            }
        ],
    },
    {
        "id": "mortgage_lending_standards_outlook",
        "label": "Mortgage lending standards outlook",
        "level": 3,
        "parent": "borrow_interest_credit_channel",
        "summary": (
            "Dutch households remain highly leveraged by European standards. Lending standards, LTV/LTI usage and NHG/Nibud rules determine how much demand converts into bids."
        ),
        "mechanism": "If standards tighten, demand is capped; if standards or guarantees become more generous, more capacity may feed into prices.",
        "direction_on_prices": "mixed",
        "top_metrics": [
            "DNB/AFM says LTV and LTI ratios have risen since 2022.",
            "DNB/AFM reports about 75% of homes sold above asking price in 2025.",
            "DNB recommends reducing tax incentives and increasing supply to reduce mortgage-market risks.",
        ],
        "source_ids": [
            "dnb_afm_mortgage_monitor_2026",
            "dnb_residential_mortgages",
            "dnb_housing_market",
            "nibud_nl_hypotheeknormen_2026_report",
            "nhg_nl_hypotheek_met_nhg",
        ],
        "cala_factor_ids": ["nibud_lending_standards_2026", "transfer_tax_nhg"],
        "policy_changes": [],
        "bottleneck_outlook": [],
    },
    {
        "id": "income_borrowing_capacity",
        "label": "Income and borrowing capacity",
        "level": 3,
        "parent": "borrow_interest_credit_channel",
        "summary": (
            "Income growth offsets some rate drag. This keeps bid capacity from falling even when mortgage rates do not return to the ultra-low 2021 regime."
        ),
        "mechanism": "Higher wages raise maximum mortgage capacity under income-based lending rules.",
        "direction_on_prices": "up",
        "top_metrics": [
            "DNB says wages are rising more slowly than during the 2022 energy shock, but still support borrowing-capacity growth.",
            "ABN AMRO identifies higher household incomes as a driver of 2025-2026 price growth.",
        ],
        "source_ids": [
            "dnb_spring_2026_key_figures",
            "abn_housing_forecast_april_2025",
            "nibud_nl_hogere_hypotheek_2026",
            "nibud_nl_hypotheeknormen_2026_report",
        ],
        "cala_factor_ids": ["macro_demand", "borrowing_capacity_subdrivers"],
        "policy_changes": [],
        "bottleneck_outlook": [],
    },
    {
        "id": "equity_wealth_liquidity_channel",
        "label": "Equity market wealth and liquidity channel",
        "level": 2,
        "parent": "market_state",
        "summary": (
            "Equity-market and savings wealth matter through down payments, family loans and confidence, but the evidence here is a demand-liquidity channel, not a direct house-price equation."
        ),
        "mechanism": "Higher liquid wealth can raise effective purchasing power beyond mortgage income tests; losses can reduce confidence and down-payment capacity.",
        "direction_on_prices": "mixed",
        "top_metrics": [
            "DNB defines financing capacity as borrowing capacity plus net assets including savings and financial assets.",
            "DNB household-savings dashboard tracks Dutch household bank savings, deposits and credited interest.",
            "Rijksoverheid Box 3 table shows actual share returns of 15.04% in 2023 and 8.43% in 2024 for tax comparison.",
            "Euronext's AEX page is the official source for the Dutch large-cap equity benchmark used as a market proxy.",
        ],
        "source_ids": ["dnb_housing_market", "dnb_household_savings", "rijk_box3", "euronext_aex_quote", "abn_housing_update_july_2025"],
        "cala_factor_ids": [],
        "policy_changes": [
            {
                "date": "2028-01-01",
                "title": "Box 3 actual-return system intended start",
                "expected_effect": "Could change after-tax attractiveness of investments, savings and second/rental homes; direct housing effect is investor-profile specific.",
                "source_ids": ["rijk_box3"],
            }
        ],
        "bottleneck_outlook": [
            {
                "period": "2026-2028",
                "expected_change": "Wealth channel stays relevant if savings/investment buffers are converted into down payments or family loans.",
                "confidence": "low",
                "rationale": "Sources establish the channel and related balances, but not a direct quantified price elasticity.",
                "source_ids": ["dnb_housing_market", "dnb_household_savings", "abn_housing_update_july_2025"],
            }
        ],
    },
    {
        "id": "box3_private_rental_tax_channel",
        "label": "Box 3 and private rental tax channel",
        "level": 2,
        "parent": "market_state",
        "summary": (
            "Box 3 taxation and rent regulation affect whether small landlords hold, sell or buy rental homes. Sales can add transaction supply for owner-occupiers while reducing rental supply."
        ),
        "mechanism": "If after-tax rental returns worsen, landlords sell; owner-occupied supply rises temporarily but rental scarcity can worsen.",
        "direction_on_prices": "mixed",
        "top_metrics": [
            "Rijksoverheid says a new actual-return Box 3 system is intended to start on 1 January 2028 if enacted.",
            "Volkshuisvesting says the Affordable Rent Act took effect on 1 July 2024 and applies WWS to mid-rent homes up to 186 points.",
            "The government expects rent reductions for 300k homes by an average EUR190.",
            "ABN AMRO says investor rental sales boost transactions until early 2026.",
        ],
        "source_ids": [
            "rijk_box3",
            "rijk_box3_nl",
            "volkshuisvesting_affordable_rent",
            "volkshuisvesting_nl_wet_betaalbare_huur",
            "abn_housing_update_july_2025",
        ],
        "cala_factor_ids": ["investor_selloff_rental_policy", "rental_regulation_box3", "rental_market_pressure"],
        "policy_changes": [
            {
                "date": "2024-07-01",
                "title": "Affordable Rent Act took effect",
                "expected_effect": "Caps more mid-rent rents, lowering landlord yield and supporting landlord-exit pressure.",
                "source_ids": ["volkshuisvesting_affordable_rent", "volkshuisvesting_nl_wet_betaalbare_huur"],
            },
            {
                "date": "2028-01-01",
                "title": "Box 3 actual-return regime intended start",
                "expected_effect": "May change taxation of second homes/rental real estate and investment returns if enacted.",
                "source_ids": ["rijk_box3", "rijk_box3_nl"],
            },
        ],
        "bottleneck_outlook": [
            {
                "period": "2025-2026",
                "expected_change": "Landlord sales can keep boosting transactions into early 2026, but may reduce rental availability.",
                "confidence": "medium",
                "rationale": "ABN AMRO explicitly links investor sales to transaction growth; policy sources explain yield pressure.",
                "source_ids": [
                    "abn_housing_update_july_2025",
                    "volkshuisvesting_affordable_rent",
                    "volkshuisvesting_nl_wet_betaalbare_huur",
                    "rijk_box3",
                    "rijk_box3_nl",
                ],
            }
        ],
    },
    {
        "id": "affordable_rent_landlord_exit",
        "label": "Affordable rent and landlord exit",
        "level": 3,
        "parent": "box3_private_rental_tax_channel",
        "summary": (
            "Rent caps and fiscal pressure change the investor-owner calculus. The immediate owner-occupier effect can be more listings; the rental effect can be tighter supply."
        ),
        "mechanism": "Policy-driven investor sales shift tenure and can temporarily lift for-sale transactions without solving the structural shortage.",
        "direction_on_prices": "mixed",
        "top_metrics": [
            "Affordable Rent Act: effective 1 July 2024.",
            "WWS modernisation applies to mid-rent homes up to 186 points.",
            "Municipalities can intervene from 1 January 2025.",
        ],
        "source_ids": [
            "volkshuisvesting_affordable_rent",
            "volkshuisvesting_nl_wet_betaalbare_huur",
            "abn_housing_update_july_2025",
        ],
        "cala_factor_ids": ["rental_regulation_box3", "rental_market_pressure"],
        "policy_changes": [],
        "bottleneck_outlook": [],
    },
    {
        "id": "demographics_migration_household_formation",
        "label": "Demographics, migration and household formation",
        "level": 2,
        "parent": "market_state",
        "summary": (
            "Population and household formation set the demand baseline. Slower immigration reduces incremental demand pressure, but total population still grew in Q1 2026."
        ),
        "mechanism": "More households increase required housing stock; lower net migration can reduce the pace of demand growth.",
        "direction_on_prices": "mixed",
        "top_metrics": [
            "CBS reports population grew by 9.6k in Q1 2026.",
            "CBS reports Q1 2026 net migration of 17.8k versus 30.6k in Q1 2025.",
            "CBS says end-March 2026 population was 18.14m.",
        ],
        "source_ids": ["cbs_population_q1_2026"],
        "cala_factor_ids": ["migration_household_formation", "macro_demand"],
        "policy_changes": [],
        "bottleneck_outlook": [],
    },
    {
        "id": "official_price_transaction_measurement",
        "label": "Official price and transaction measurement",
        "level": 2,
        "parent": "market_state",
        "summary": (
            "CBS/Kadaster PBK is the official recurring measurement anchor for existing owner-occupied prices and transactions; average sales price is not quality-adjusted."
        ),
        "mechanism": "Price index and transaction volume establish whether scenarios are actually materialising.",
        "direction_on_prices": "measurement",
        "top_metrics": [
            "CBS/Kadaster PBK uses Land Registry transactions and WOZ values.",
            "Monthly national data and quarterly regional/type data support monitoring of price and liquidity turns.",
            "CBS cautions that average transaction price is not the preferred indicator for price development.",
        ],
        "source_ids": [
            "cbs_pbk_method",
            "cbs_nl_prices_march_2026",
            "cbs_nl_statline_85773ned",
            "kadaster_nl_vastgoeddashboard",
        ],
        "cala_factor_ids": ["price_transaction_outcome"],
        "policy_changes": [],
        "bottleneck_outlook": [],
    },
    {
        "id": "macro_labor_confidence_policy",
        "label": "Macro, labor and confidence",
        "level": 2,
        "parent": "market_state",
        "summary": (
            "Macro conditions influence housing through employment, wages, confidence, inflation and rate expectations. DNB's 2026 update is softer growth with still-positive wage support."
        ),
        "mechanism": "A weaker economy can reduce confidence and hiring, while wages and inflation shape nominal borrowing capacity and policy rates.",
        "direction_on_prices": "mixed",
        "top_metrics": [
            "DNB projects Dutch GDP growth of 0.8% in 2026 after 1.8% in 2025.",
            "DNB projects growth of 1.2% in 2027 and 1.3% in 2028.",
            "DNB projects inflation of 2.7% in 2026 versus 3.0% in 2025.",
        ],
        "source_ids": ["dnb_spring_2026_macro", "dnb_spring_2026_key_figures"],
        "cala_factor_ids": ["macro_demand", "buyer_sentiment_confidence"],
        "policy_changes": [],
        "bottleneck_outlook": [],
    },
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean_text(value: str | None, limit: int = 520) -> str:
    text = re.sub(r"\s+", " ", value or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "..."


def label_for(factor_id: str) -> str:
    return LABEL_OVERRIDES.get(factor_id, factor_id.replace("_", " ").title())


def domain_for(url: str | None) -> str | None:
    if not url:
        return None
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def first_summary(summary: str) -> str:
    if "too complex" in (summary or "").lower():
        return "Broad query was intentionally superseded by narrower child nodes."
    for raw in (summary or "").splitlines():
        line = raw.strip(" #-|\t")
        if not line or line.startswith("Table") or line.startswith("---"):
            continue
        if len(line) < 12:
            continue
        return clean_text(line)
    return "No narrative summary extracted; inspect linked raw Cala response."


def source_label(source: dict[str, Any]) -> str:
    return source.get("document_name") or source.get("source_name") or source.get("document_url") or "Source"


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


def cala_source(source: dict[str, Any], retrieved_at: str | None) -> dict[str, Any]:
    url = source.get("document_url")
    evidence_note = clean_text(source.get("snippet"), 260)
    source_context = f"cala_knowledge_search {source_label(source)} {domain_for(url)}"
    tagged_note = tagged_text_item(evidence_note, source_context) if evidence_note else None
    return {
        "id": source.get("context_id") or url or source_label(source),
        "label": clean_text(source_label(source), 180),
        "url": url,
        "domain": domain_for(url),
        "context_id": source.get("context_id"),
        "source_origin": "cala",
        "source_provider": "cala_knowledge_search",
        "ui_highlight_tags": ["source:cala", "provenance:cala"],
        "retrieved_at": retrieved_at,
        "evidence_note": evidence_note,
        "evidence_note_status": tagged_note,
        "dominant_evidence_status": tagged_note["status"] if tagged_note else "review_needed",
        "average_probability_pct": tagged_note["probability_pct"] if tagged_note else None,
    }


def web_source(source: dict[str, Any], retrieved_at: str) -> dict[str, Any]:
    url = source.get("url")
    source_context = f"{source.get('source_provider')} {source.get('label')} {url or ''}"
    tagged_notes = [tagged_text_item(note, source_context) for note in source.get("evidence_notes", [])]
    dominant = dominant_status(tagged_notes)
    return {
        "id": source["id"],
        "label": source["label"],
        "url": url,
        "domain": domain_for(url),
        "context_id": None,
        "source_origin": "web",
        "source_provider": source["source_provider"],
        "ui_highlight_tags": ["source:web", "provenance:web"],
        "retrieved_at": retrieved_at,
        "published_at": source.get("published_at"),
        "language": source.get("language"),
        "evidence_note": clean_text("; ".join(source.get("evidence_notes", [])[:2]), 360),
        "tagged_evidence_notes": tagged_notes,
        "evidence_status_rollup": status_counts(tagged_notes),
        "probability_bucket_counts": probability_bucket_counts(tagged_notes),
        "average_probability_pct": average_probability_pct(tagged_notes),
        "dominant_evidence_status": dominant,
    }


def derived_tags(origins: list[str]) -> list[str]:
    return [f"derived-from:{origin}" for origin in origins]


def unique_sources(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for source in sources:
        key = source.get("id") or source.get("url") or source.get("label")
        if key in seen:
            continue
        seen.add(str(key))
        out.append(source)
    return out


def build_cala_factors(tree: dict[str, Any], retrieved_at: str) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    factors: list[dict[str, Any]] = []
    by_id: dict[str, dict[str, Any]] = {}
    for item in tree.get("factors", []):
        sources = [cala_source(source, tree.get("retrieved_at")) for source in item.get("sources", [])]
        metrics = metric_lines(item)
        tagged_metrics = [tagged_text_item(metric, "cala_knowledge_search") for metric in metrics]
        source_status_items = [
            source["evidence_note_status"]
            for source in sources
            if source.get("evidence_note_status")
        ]
        factor_status_items = tagged_metrics + source_status_items
        factor = {
            "id": item["id"],
            "label": label_for(item["id"]),
            "level": item["level"],
            "parent": item.get("parent"),
            "query_id": item.get("query_id"),
            "summary": first_summary(item.get("content_summary", "")),
            "mechanism": None,
            "direction_on_prices": "unknown",
            "metric_count": len(item.get("candidate_metrics", [])),
            "source_count": len(sources),
            "top_metrics": metrics,
            "tagged_metrics": tagged_metrics,
            "sources": sources,
            "raw_file": item.get("raw_file"),
            "policy_changes": [],
            "bottleneck_outlook": [],
            "evidence_status_rollup": status_counts(factor_status_items),
            "probability_bucket_counts": probability_bucket_counts(factor_status_items),
            "average_probability_pct": average_probability_pct(factor_status_items),
            "dominant_evidence_status": dominant_status(factor_status_items),
            "provenance": {
                "derived_from_source_origins": ["cala"],
                "ui_highlight_tags": ["derived-from:cala"],
                "raw_response": f"work/nl_housing_factor_research/{item.get('raw_file')}",
                "status": "superseded_broad_query" if not metrics and not sources else "derived_from_cala_response",
                "note": "Factor summary is derived from Cala output; only nested sources carry direct source:cala tags.",
                "generated_at": retrieved_at,
            },
        }
        factors.append(factor)
        by_id[item["id"]] = factor
    return factors, by_id


def cala_sources_for(by_id: dict[str, dict[str, Any]], factor_ids: list[str], limit: int = 4) -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    for factor_id in factor_ids:
        factor = by_id.get(factor_id)
        if factor:
            sources.extend(factor.get("sources", [])[:2])
    return unique_sources(sources)[:limit]


def build_web_factors(
    web_by_id: dict[str, dict[str, Any]],
    cala_by_id: dict[str, dict[str, Any]],
    retrieved_at: str,
) -> list[dict[str, Any]]:
    factors: list[dict[str, Any]] = []
    for item in WEB_FACTORS:
        source_ids = item.get("source_ids", [])
        web_sources = [web_by_id[source_id] for source_id in source_ids if source_id in web_by_id]
        cala_sources = cala_sources_for(cala_by_id, item.get("cala_factor_ids", []))
        sources = unique_sources(web_sources + cala_sources)
        origins = sorted({source["source_origin"] for source in sources})
        if not origins:
            origins = ["web"]
        metrics = item.get("top_metrics", [])
        tagged_metrics = [tagged_text_item(metric, "mixed_factor") for metric in metrics]
        policy_changes = tag_policy_changes(item.get("policy_changes", []))
        bottleneck_outlook = tag_bottleneck_outlook(item.get("bottleneck_outlook", []))
        source_status_items = []
        for source in sources:
            source_status_items.extend(source.get("tagged_evidence_notes", []))
            if source.get("evidence_note_status"):
                source_status_items.append(source["evidence_note_status"])
        policy_status_items = [
            change["evidence_status"] for change in policy_changes if change.get("evidence_status")
        ]
        outlook_status_items = [
            outlook["evidence_status"] for outlook in bottleneck_outlook if outlook.get("evidence_status")
        ]
        factor_status_items = tagged_metrics + source_status_items + policy_status_items + outlook_status_items
        factor = {
            "id": item["id"],
            "label": item["label"],
            "level": item["level"],
            "parent": item.get("parent"),
            "query_id": None,
            "summary": item["summary"],
            "mechanism": item.get("mechanism"),
            "direction_on_prices": item.get("direction_on_prices", "unknown"),
            "metric_count": len(metrics),
            "source_count": len(sources),
            "top_metrics": metrics,
            "tagged_metrics": tagged_metrics,
            "sources": sources,
            "raw_file": None,
            "policy_changes": policy_changes,
            "bottleneck_outlook": bottleneck_outlook,
            "evidence_status_rollup": status_counts(factor_status_items),
            "probability_bucket_counts": probability_bucket_counts(factor_status_items),
            "average_probability_pct": average_probability_pct(factor_status_items),
            "dominant_evidence_status": dominant_status(factor_status_items),
            "provenance": {
                "derived_from_source_origins": origins,
                "ui_highlight_tags": derived_tags(origins),
                "raw_response": None,
                "status": "derived_from_mixed_sources" if len(origins) > 1 else f"derived_from_{origins[0]}",
                "note": "Direct Cala tags are present only on nested source objects that were read from raw Cala responses.",
                "generated_at": retrieved_at,
            },
        }
        factors.append(factor)
    return factors


def build_web_registry(retrieved_at: str) -> list[dict[str, Any]]:
    return [
        {
            **web_source(source, retrieved_at),
            "evidence_notes": source.get("evidence_notes", []),
        }
        for source in WEB_SOURCES
    ]


def build_summary(fixture: dict[str, Any]) -> str:
    rollups = fixture["rollups"]
    lines = [
        "# NL housing mixed-source factor tree v2",
        "",
        f"Generated at: {fixture['retrieved_at']}",
        "",
        "This file combines existing raw Cala research with tool-fetched web sources. UI should highlight only nested source objects tagged `source:cala`; factor-level provenance uses `derived-from:*` tags.",
        "",
        "## Rollups",
        "",
        f"- Factors: {rollups['factor_count']}",
        f"- Direct Cala source links: {rollups['direct_cala_source_link_count']}",
        f"- Web source links: {rollups['web_source_link_count']}",
        f"- Dutch-language web registry sources: {rollups['web_nl_registry_source_count']}",
        f"- Metric lines: {rollups['metric_line_count']}",
        f"- Evidence status counts: {json.dumps(rollups['evidence_status_counts'], ensure_ascii=False, sort_keys=True)}",
        f"- Probability bucket counts: {json.dumps(rollups['probability_bucket_counts'], ensure_ascii=False, sort_keys=True)}",
        f"- Average probability: {rollups['average_probability_pct']}%",
        "",
        "## Added web/mixed breakdown nodes",
        "",
    ]
    for factor in fixture["factors"]:
        if factor["id"] in {item["id"] for item in WEB_FACTORS}:
            origins = ", ".join(factor["provenance"]["derived_from_source_origins"])
            lines.append(f"- L{factor['level']} `{factor['id']}` - {factor['label']} ({origins})")
    lines.extend(
        [
            "",
            "## Source-origin rule",
            "",
            "- `source:cala` means the source object was extracted from raw Cala response data.",
            "- `source:web` means the source object came from browser/web tool research in this session.",
            "- Factor nodes never claim direct `source_origin: cala`; they expose `derived_from_source_origins` instead.",
            "",
        ]
    )
    return "\n".join(lines)


def build() -> dict[str, Any]:
    retrieved_at = utc_now()
    tree = json.loads(CALA_SOURCE.read_text(encoding="utf-8"))
    web_registry = build_web_registry(retrieved_at)
    web_by_id = {source["id"]: source for source in web_registry}
    cala_factors, cala_by_id = build_cala_factors(tree, retrieved_at)
    web_factors = build_web_factors(web_by_id, cala_by_id, retrieved_at)
    factors = cala_factors + web_factors

    # --- additive analyst overlay: integrate the gap-scan nodes + annotated causal/
    # confounder/feedback/conditioning edges with the generated Cala/web tree (union,
    # not either-or). Canonical def: reference/nl-housing-factor-tree.md. ---
    overlay_path = APP_TARGET.parent / "factor_overlay.json"
    overlay = json.loads(overlay_path.read_text(encoding="utf-8")) if overlay_path.exists() else {"nodes": [], "edges": []}
    existing_ids = {f["id"] for f in factors}
    overlay_nodes = [n for n in overlay.get("nodes", []) if n["id"] not in existing_ids]
    factors = factors + overlay_nodes

    level_counts: dict[str, int] = {}
    direct_cala_sources = 0
    web_sources = 0
    metric_status_items: list[dict[str, Any]] = []
    source_status_items: list[dict[str, Any]] = []
    policy_status_items: list[dict[str, Any]] = []
    outlook_status_items: list[dict[str, Any]] = []
    for factor in factors:
        key = str(factor["level"])
        level_counts[key] = level_counts.get(key, 0) + 1
        metric_status_items.extend(factor.get("tagged_metrics", []))
        policy_status_items.extend(
            change["evidence_status"]
            for change in factor.get("policy_changes", [])
            if change.get("evidence_status")
        )
        outlook_status_items.extend(
            outlook["evidence_status"]
            for outlook in factor.get("bottleneck_outlook", [])
            if outlook.get("evidence_status")
        )
        for source in factor.get("sources", []):
            if source.get("source_origin") == "cala":
                direct_cala_sources += 1
            elif source.get("source_origin") == "web":
                web_sources += 1
            source_status_items.extend(source.get("tagged_evidence_notes", []))
            if source.get("evidence_note_status"):
                source_status_items.append(source["evidence_note_status"])
    all_status_items = metric_status_items + source_status_items + policy_status_items + outlook_status_items

    # containment edges (tagged) auto-built from every factor's parent (incl. overlay
    # nodes), then the overlay's annotated non-containment edges appended.
    all_ids = {f["id"] for f in factors}
    edges = [
        {"source": f["parent"], "target": f["id"], "relation": "contains"}
        for f in factors
        if f.get("parent")
    ]
    edges += [
        e for e in overlay.get("edges", [])
        if e.get("source") in all_ids and e.get("target") in all_ids
    ]
    edge_relation_counts: dict[str, int] = {}
    for e in edges:
        rel = e.get("relation", "contains")
        edge_relation_counts[rel] = edge_relation_counts.get(rel, 0) + 1

    fixture = {
        "case": tree.get("case", "nl_housing"),
        "retrieved_at": retrieved_at,
        "generated_from": [
            "work/nl_housing_factor_research/factor_tree.json",
            "tool-fetched web sources captured in work/nl_housing_factor_research/web_sources_v2.json",
        ],
        "coverage_status": "mixed_source_practical_frontier_reached",
        "coverage_note": (
            "This is a broad L1-L4+ driver map for the national NL housing decision. It covers prices/transactions, "
            "supply, grid, nitrogen, financing, mortgage standards, wealth/liquidity, Box 3/rental policy, demographics, "
            "macro/labour, regional and personal-fit channels. It is not an infinite-web exhaustive crawl; further work should branch by city, price band, property type and buyer profile."
        ),
        "provenance_policy": {
            "direct_cala_tag_rule": "Only nested source objects extracted from raw Cala responses may carry source_origin=cala or source:cala.",
            "factor_tag_rule": "Factor nodes carry derived_from_source_origins and derived-from:* UI tags, never direct Cala source tags.",
        },
        "evidence_status_taxonomy": EVIDENCE_STATUS_TAXONOMY,
        "probability_scoring": PROBABILITY_SCORING,
        "rollups": {
            "factor_count": len(factors),
            "level_counts": level_counts,
            "raw_response_count": len(list((CALA_SOURCE.parent / "raw").glob("*.json"))),
            "metric_line_count": sum(f["metric_count"] for f in factors),
            "source_link_count": sum(len(f.get("sources", [])) for f in factors),
            "direct_cala_source_link_count": direct_cala_sources,
            "web_source_link_count": web_sources,
            "web_registry_source_count": len(web_registry),
            "web_nl_registry_source_count": sum(1 for source in web_registry if source.get("language") == "nl"),
            "evidence_status_counts": status_counts(all_status_items),
            "probability_bucket_counts": probability_bucket_counts(all_status_items),
            "average_probability_pct": average_probability_pct(all_status_items),
            "metric_evidence_status_counts": status_counts(metric_status_items),
            "source_evidence_status_counts": status_counts(source_status_items),
            "policy_evidence_status_counts": status_counts(policy_status_items),
            "outlook_evidence_status_counts": status_counts(outlook_status_items),
            "edge_count": len(edges),
            "edge_relation_counts": edge_relation_counts,
            "overlay_node_count": len(overlay_nodes),
        },
        "augmentation": {
            "source": "app/fixtures/nl_housing/factor_overlay.json",
            "note": "Analyst gap-scan nodes + annotated causal/confounder/feedback/conditioning edges merged additively. Canonical def: reference/nl-housing-factor-tree.md.",
            "overlay_nodes": [n["id"] for n in overlay_nodes],
        },
        "edges": edges,
        "factors": factors,
        "web_sources": web_registry,
        "security": {"api_key_stored": False},
    }
    return fixture


def main() -> None:
    fixture = build()
    WORK.mkdir(parents=True, exist_ok=True)
    APP_TARGET.parent.mkdir(parents=True, exist_ok=True)

    payload = json.dumps(fixture, indent=2, ensure_ascii=False)
    MIXED_TARGET.write_text(payload, encoding="utf-8")
    APP_TARGET.write_text(payload, encoding="utf-8")
    WEB_SOURCES_TARGET.write_text(
        json.dumps(fixture["web_sources"], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    SUMMARY_TARGET.write_text(build_summary(fixture), encoding="utf-8")

    print(
        json.dumps(
            {
                "wrote": [
                    str(APP_TARGET.relative_to(ROOT)),
                    str(MIXED_TARGET.relative_to(ROOT)),
                    str(WEB_SOURCES_TARGET.relative_to(ROOT)),
                    str(SUMMARY_TARGET.relative_to(ROOT)),
                ],
                "factors": fixture["rollups"]["factor_count"],
                "metric_lines": fixture["rollups"]["metric_line_count"],
                "source_links": fixture["rollups"]["source_link_count"],
                "direct_cala_source_links": fixture["rollups"]["direct_cala_source_link_count"],
                "web_source_links": fixture["rollups"]["web_source_link_count"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
