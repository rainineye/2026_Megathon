---
type: decision-log
---
# Decisions (append-only)

> One bullet per decision. Newest at the bottom. Never edit or delete past lines —
> if a decision is reversed, append a new line that says so and links the old one.
> Format:  - [YYYY-MM-DD · who] DECISION — why. (supersedes: <prev> if any)

- [2026-06-15 · mian] Use a git-shared Obsidian vault as the single source of truth for project memory — because two people + two agents need one brain, and markdown-in-git merges cleanly when entries are append-only.
- [2026-06-19 · mian + Claude Code] Installed the `cala` skill (`npx skills add cala-ai/cala-skill`) into `.agents/skills/cala` (symlinked to Claude Code) — to query structured, sourced facts about real-world entities (companies, people, funding, investors) instead of web-scraping; ~9pp more accurate and ~8× more token-efficient than web search for entity facts. NOT YET FUNCTIONAL: needs a Cala API key (console.cala.ai/api-keys) and the Cala MCP server (`https://api.cala.ai/mcp/`) added to `.mcp.json`; until then any call halts rather than falling back to web search.
- [2026-06-19 · mian + Claude Code] Built the NL-housing POC data pipeline for the Trace decision graph, living in `Trace_Core/data/` (NOT this vault; Trace_Core is a separate repo). Chain: Cala `knowledge/search` (REST, key used in-request only — never written to disk per FORBID:secrets) → `nl_housing_evidence.json` (101 evidence items, 11 factor themes incl. grid-congestion/netcongestie, every item source+url+quote) → `nl_housing_timeseries.json` (48 reversible temporal StateEvents / 19 metrics) → Stage-2 `canonical/` (101 canonical Claims w/ claim_kind+predicate_type+scope+direction+mapping_strength, 71 Sources, 67 recovered Entities, 5 contested hypotheses H1-H5). Why: gives Trace a typed, provenance-bearing evidence base. Modeling choice: causal_token hypotheses correctly route to `requires_token_cause_module`, causal_type to `structured_tier_required` — no hypothesis can reach `resolved` (no DIRECTLY_TESTS yet). Deferred to human-in-the-loop: conditional_scope, mapping_strength scope-match, necessity/PN gating, competing-DAG authoring, ReviewerActions.
- [2026-06-19 · Codex] Before publishing this vault to GitHub, keep local agent permission files and transient Cala responses out of git via .gitignore, and add SECURITY.md push checks — because .claude/settings.local.json can contain machine-local API credentials and must never be committed under FORBID: secrets.
