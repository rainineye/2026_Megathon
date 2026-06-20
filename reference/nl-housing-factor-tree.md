---
type: reference
case: Netherlands housing — buy vs wait vs rent
updated: 2026-06-20
status: CANONICAL factor + edge spec for the UI causal graph
consumes: app/fixtures/nl_housing/factor_research.json — RECONCILED 2026-06-20 to this spec (47 nodes, 75 edges: 46 contains / 21 causal / 2 confounder / 2 feedback / 4 conditioning)
shared: lives in reference/ (syncs via git) so BOTH Claude Code + Codex refer to it
---
# NL Housing Factor + Causal-Edge Tree (canonical)

> This is the authoritative node + edge spec the cockpit canvas graph is drawn from.
> The user's 10-section tree, **completed** (added nodes marked `[+]`), with the logical
> gap-scan applied, cross-cutting causal nodes added, and the **edges** that make it a causal
> graph (not just a taxonomy) specified in §B. Maps onto the engine's 5 candidate market-states
> (§C) and the contested rate→price claim + splitting test (§B).
>
> **Provenance legend** (per constraints.md — never cross-label):
> `[Cala]` direct Cala source · `[Web]` EN web · `[Web-NL]` Dutch official/web · `[Mixed]`
> both · `[derived]` analyst/engine artifact · `[+]` node added by the 06-20 gap-scan.
> Latest real values + sources in §E.

---

## §A. Factor node tree (L1 market-state → drivers)

### 1. Price & Transaction Outcome  *(the OUTCOME node)* [Mixed: Cala + Web-NL]
- CBS/Kadaster PBK price index
- transaction count / liquidity
- average transaction price (not quality-adjusted)
- regional & dwelling-type breakdown
- listing / overbidding / days-on-market signals [Cala]
- `[+]` price-to-income & overvaluation index (DNB/IMF flagged overvaluation) [Web]
- `[+]` price momentum: YoY vs MoM (the cooling turn — +8.6% YoY but decelerating) [Mixed]
- `[+]` new-build vs existing-home price split [Web-NL]
- `[+]` **forecast dispersion** = the contested expectation range ( ING ~1.5% / ABN 3% / Rabobank 3.1% for 2026) [Web] — this node IS the visible "contested" band

### 2. Supply / Structural Shortage [Mixed: Cala + Web-NL + Web]
- national housing shortage level [Cala] — absolute count · % of stock · projected peak/improvement timing
- national build target & ambition [Web-NL] — 900k homes through 2030 · 100k/yr target · ≥2/3 affordable
- supply pipeline [Cala] — permits · completions · starts · municipal/land-policy constraints
  - `[+]` conversions / transformation (office→resi; ~11k of 2025's ~80k completions) [Web-NL]
  - `[+]` demolition / stock loss (net additions ≠ gross) [Web-NL]
- binding bottlenecks [Mixed]
  - nitrogen permitting / stikstof [Mixed] — Natura-2000 proximity · passende beoordeling / salderen / vergunningverlening · blocked permits · policy-change watch (rules, salderen, court rulings)
  - electricity grid / netcongestie [Mixed] — transport capacity · waiting/connection queues · housing+facility connection risk · policy watch (ACM prioritisation, grid expansion)
  - project viability [Mixed] — unprofitable top per home · construction costs · developer feasibility · subsidy/land-price sensitivity
    - `[+]` construction labor & material availability/cost (distinct from € cost) [Web-NL]
  - execution capacity [Mixed] — municipal staffing/expertise · housing-corporation investment capacity · regional coordination / flexpools

### 3. Borrow Interest / Mortgage Credit Channel [Mixed: Cala + Web-NL + Web]
- ECB policy rates [Web]
- `[+]` bond / swap (long) yields — the real driver of 10y+ fixed rates beyond ECB policy [Web]
- mortgage-rate transmission [Cala + Web]
  - `[+]` rate-by-fixation curve (variable vs 10y vs 20/30y; 10y = the "sweet spot") [Web]
- household mortgage debt / leverage [Web]
- borrowing capacity [Mixed] — income-based lending standards · Nibud hypotheeknormen 2026 [Web-NL] · expected wage growth/loonstijging [Web-NL] · energy-label mortgage capacity [Cala]
  - `[+]` LTV cap (100%) & LTI/Nibud limits (distinct from income standard) [Web-NL]
  - `[+]` **mortgage interest deduction (hypotheekrenteaftrek)** — lowers effective rate; major NL-specific subsidy, was missing entirely [Web-NL]
  - `[+]` interest-only loan share / amortisation rules [Web]
- NHG / guarantee channel [Cala + Web-NL] — lower-rate benefit · affordability/risk buffer · NHG threshold policy watch (€450k 2025)
- credit-risk / arrears [Cala] — defaults/arrears · financial-stability constraints

### 4. Income / Labor / Macro Demand [Mixed]
- wage growth & real income [Mixed]
- employment / unemployment [Cala]
- GDP growth / inflation [Web]
- consumer confidence [Cala]
- rate-policy feedback from inflation [Web]
- `[+]` **macro regime / risk-off shock** [Web] — eurozone GDP downgrade (0.8%), energy-price/geopolitical shock (Strait of Hormuz). *This is the observable face of the latent confounder in §B (X1).*

### 5. Demographics / Household Formation [Mixed: Cala + Web]
- population growth · immigration/emigration/net migration · household formation · household size/composition · student/expat/urban demand
- `[+]` aging / 55+ headship rise (20%→30%; raises per-person demand) [Cala]
- `[+]` divorce/separation → household splitting [Web]
- `[+]` internal/regional migration (Randstad ↔ periphery) [Web-NL]

### 6. Equity Market / Wealth / Liquidity Effect [Web]
- household savings/deposits · financial assets · equity proxy (AEX) · family loans/gifted down payments · down-payment capacity · confidence effect
- `[+]` jubelton abolition (tax-free gift scheme ended 2024) — policy watch [Web-NL]
- `[+]` inheritance & pension wealth [Web]
- *Note: wealth/liquidity channel, NOT a quantified causal price elasticity.*

### 7. Box 3 / Tax / Private-Rental Investor Channel [Mixed: Cala + Web-NL + Web]
- Box 3 bridge rules / actual-return direction [Web-NL + Web]
- tax burden on second homes / rental real estate [Mixed]
- landlord sell-off / buy-to-let exit [Cala]
- private rental stock shrinkage [Cala]
- `[+]` **transfer tax (overdrachtsbelasting) differential** — owner-occupier 2% / FTB exempt ≤€555k vs investor 10.4%; steers buy-to-let exit & FTB advantage [Web-NL]
- `[+]` opkoopbescherming (buy-to-let ban / self-occupancy requirement in designated areas) [Web-NL]
- policy-change watch — actual-return Box 3 intended 2028 · counter-evidence/refund since 2025 · investor after-tax-yield sensitivity

### 8. Rent Regulation / Affordable Rent Act [Mixed: Cala + Web-NL + Web]
- Wet betaalbare huur effective 1 Jul 2024 · WWS modernisation up to 186 points · municipal enforcement from 2025 · expected rent reduction ~300k homes · landlord exit pressure
- two-sided effect — more homes for sale short-term **vs** less private rental supply / higher rental scarcity
- `[+]` **rent-control reversal watch** — cabinet now plans to EASE rent controls; could reverse the for-sale supply boost [Cala + Web-NL]
- `[+]` rent indexation cap (annual increase limit) [Web-NL]
- `[+]` temporary-contract ban (Wet vaste huurcontracten 2024) → tenant security, affects rent-vs-buy [Web-NL]

### 9. Regional Tightness / Local Market Liquidity [Cala]
- city/region price divergence · Amsterdam/Utrecht/Rotterdam/Den Haag differences · overbidding intensity · listings & absorption · property-type tightness · local supply bottlenecks
- `[+]` commute / job-centre proximity / infrastructure [Web-NL]
- `[+]` regional energy-label distribution (ties to §3 capacity & §1 dispersion) [Web-NL]

### 10. Personal Decision Layer [Cala-derived fixtures + USER INPUT]
- budget · down payment · monthly ceiling · quoted mortgage rate · move deadline · rent alternative · personal rate-shock / wait-cost sensitivity
- `[+]` household income & income stability (drives borrowing capacity) [user]
- `[+]` holding period / horizon [user]
- `[+]` risk tolerance [user]
- `[+]` first-time-buyer status → NHG / FTB transfer-tax eligibility [user]
- `[+]` region flexibility & household constraints (commute/school/visa) [user]
- *PRD §15: personal vars NEVER change market truth — they only condition which candidate
  states matter (see §B conditioning edges) and feed `personal_fit.py`.*

---

## §B. Causal edges (what makes it a GRAPH, not a taxonomy)

> The UI canvas draws these as bezier edges (thickness = support strength, color = source
> category, **contested = dashed + `graph_not_settled` tag**). The taxonomy above is the node
> set; these are the edges.

Demand / financing channel (engine candidate `financing_pressure`):
- ECB policy rate + bond/swap yields → mortgage rate (3)
- mortgage rate (3) → borrowing capacity (3) → **price (1)**
- income/macro (4) → borrowing capacity (3) & demand → price (1)

Supply channel (engine candidate `shortage_dominates`):
- bottlenecks (2: nitrogen, grid, viability, execution) → supply pipeline (2) → shortage (2) → **price (1)**

Investor / policy supply channel (engine candidate `investor_window`):
- Box 3 + transfer-tax + opkoopbescherming (7) → landlord exit (7) → for-sale supply (2) ↑ → price (1) ↓
- rent regulation (8) → landlord exit → **two-sided**: for-sale supply ↑ **and** rental scarcity ↑ → rent alternative (10) ↑

Demand fundamentals:
- demographics (5) → household formation → demand (4) → price (1)
- wealth/equity (6) → down-payment capacity (10) → demand (1) [weak/unquantified — dashed thin]

Regional modulation (engine candidate `regional_divergence`):
- regional tightness (9) modulates price (1) locally

**X1 — THE CONTESTED EDGE / latent confounder** *(the reason rate→price is `graph_not_settled`)*:
- `mortgage_rate (3) ──?──> house_price (1)`  ← **contested, dashed**
- competing structure S1/S3 (demand channel): edge is REAL, flows via borrowing capacity
- competing structure S2 (confounder): **macro regime / risk-off (4, latent) ──> {mortgage_rate (3), house_price (1)}** — rates & prices merely co-move; no direct edge
- **Splitting test (testable now):** `mortgage_rate ⟂ house_price | borrowing_capacity` → independent ⇒ S1/S3 (channel real); still dependent ⇒ S2 (regime confounds). Deeper split needs a measured `regime` proxy.

`[+]` **Reflexivity / expectations loop** (feedback edge):
- price momentum (1) → buyer/seller expectations → demand (4) → price (1). Forecast dispersion (1) feeds expectations. (FOMO / fear-of-further-rises; self-fulfilling.)

Conditioning edges (NOT causal — engine candidate `user_constraint`):
- personal layer (10) ──conditions──> which candidate states weigh for this user (Pearl weight `w(f)=Σ_c r(c|user)·s(f→c)`); never mutates market support.

---

## §C. Mapping to the engine's 5 candidate market-states
| candidate (engine id) | driven by sections |
|---|---|
| `shortage_dominates` | 2 (+1 outcome) |
| `financing_pressure` | 3 + 4 |
| `investor_window` | 7 + 8 (supply from landlord exit) |
| `regional_divergence` | 9 |
| `user_constraint` | 10 (conditioning) |

Contested causal claim surfaced on canvas: **rate→price = `graph_not_settled`** with the §B
splitting test as the "key indicator" / next-measurement.

---

## §D. Gap-scan summary (what was logically missing → now added `[+]`)
1. **Mortgage interest deduction (hypotheekrenteaftrek)** — absent entirely; major NL effective-rate factor. (§3)
2. **Transfer tax differential + opkoopbescherming** — investor vs owner-occupier asymmetry was implicit only. (§7)
3. **The latent macro-regime confounder as an explicit node + edge** — the very thing that makes rate→price contested; was buried in "macro demand". (§4, §B-X1)
4. **Reflexivity / expectations feedback loop** — no feedback edge existed; momentum→expectations→demand→price. (§B)
5. **Forecast-dispersion node** — the contested 1.5–3.1% band needs to be a visible node, not just text. (§1)
6. **Bond/swap yields + rate-by-fixation curve** — long-rate driver upstream of ECB. (§3)
7. **Supply net-vs-gross** (conversions, demolition) and **labor/material availability**. (§2)
8. **LTV cap / interest-only share**, **jubelton abolition**, **rent indexation cap / temp-contract ban**, **aging headship / internal migration**, **commute proximity** — secondary but real. (§3,6,8,5,9)
9. **Personal layer completeness** — income/stability, horizon, risk, FTB status, region flexibility (needed by `personal_fit`). (§10)

## §E. Latest real values (freshness, June 2026 — merge into node metric lines)
| node | value | provenance |
|---|---|---|
| mortgage rate 10y fixed | 3.6–4.3% (NHG vs non), DNB Mar'26; ECB 2.25% Jun'26 | [Cala rate_level + Web: dnb.nl, ohao.nl] |
| 2026 price forecast (dispersion) | ING ~1.5% / ABN 3% / Rabobank 3.1% (cut from 4.8%) | [Web: abnamro.com, rabobank.com] |
| overbidding (cooling) | Q2'25 +5.6% → Q4 +5.2% → Q1'26 +4.7% | [Cala transaction_dynamics → nltimes, iamexpat] |
| construction vs target | ~80k built 2025 (69k new + 11k conv) vs 100k target; shortage ~453k by 2027 | [Cala gov_policy → dutchnews] |
| Nibud 2026 wage assumption | +4.1% → borrowing capacity ↑ | [Cala borrowing_rules → dutchreview] |
| affordability | avg house needs ~€95k income vs €39.1k median (hardest in 40y) | [Cala first_time_buyer → iamexpat] |
| political regime | Schoof I collapsed 3 Jun 2025; snap election 29 Oct 2025; 2026 budget Dec–Mar | [Web: iamexpat, wikipedia] |
| rent regulation | Wet betaalbare huur live 1 Jul 2024 (WWS→186pts); cabinet now plans to EASE | [Cala rent_vs_buy → dutchbrief] |
| Box 3 | 2025 parliament blocked €2.55bn hike; rental stock shrinking; actual-return regime 2028 | [Cala investor_selloff → nltimes, dutchnews] |

## §G. Edge classes & the acyclicity discipline (IMPORTANT for the engine)
The fixture `app/fixtures/nl_housing/factor_research.json` now carries this as data:
**47 factor nodes, 75 edges** — each edge tagged `relation`. Four classes, handled differently:
- `contains` (46) — taxonomy/hierarchy. NOT causal. UI draws as the tree skeleton.
- `causal` (21) — directed, each with `sign` (+/−/?) + `strength`. This is the layer the
  structured tier may reason over. **Must stay acyclic (a DAG).**
- `confounder` (2) — latent common cause `macro_regime_confounder → {rate channel, price}`;
  `contested:true`. Maps to structured-tier S2.
- `feedback` (2) — the reflexivity loop `price ↔ expectations`. **This is an intentional CYCLE
  → UI/explanatory ONLY. Do NOT feed feedback edges into the structured-tier admissible DAGs**
  (Pearl SCMs are acyclic). Render it but exclude it from adjudication.
- `conditioning` (4) — `personal_affordability → candidate states`. NON-causal; re-weights
  scenarios for the user (PRD §15). **Never ingest as a causal edge.**

The contested `borrow_interest_credit_channel → price_transaction_outcome` edge carries
`claim_state: graph_not_settled` + `splitting_test: mortgage_rate _||_ house_price |
borrowing_capacity` + `engine_node: rate_price_splitting_test` — the canvas draws it dashed.

## §F. The real next frontier (per nl_housing_factor_research/coverage_report)
National factor breadth is at the practical frontier. Next useful expansion is **DEPTH**:
one target region (e.g. a Randstad city) + one profile → city-level indicators (city price
index, inventory, city overbidding %, time-on-market, local rent level, NHG share).
