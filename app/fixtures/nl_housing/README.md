# NL Housing Fixtures

Static MVP fixtures for the NL housing case. These are the app-facing inputs
used by the FastAPI engine boundary and React cockpit.

Files:

- `candidates.json`
- `evidence.json`
- `support_groups.json`
- `structures.json`
- `personal_profiles.json`
- `market_anchors.json`
- `factor_research.json`

`factor_research.json` is generated from `work/nl_housing_factor_research/factor_tree.json`
by `scripts/build_nl_housing_app_research_fixture.py`. It is a compact UI fixture:
factor tree nodes, candidate metric lines, source links, and rollups. It contains no API key.

`personal_profiles.json` contains demo user-input profiles. `quoted_mortgage_rate_pct`
is a user/bank-quote input for Personal Fit; it is not market evidence.
