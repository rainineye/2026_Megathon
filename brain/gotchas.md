---
type: gotchas
---
# Gotchas (append-only)

> Traps we hit, so neither we nor the agents hit them twice. Format:
> - [date · who] SYMPTOM → CAUSE → FIX.

- [2026-06-19 · Claude Code] Cala `knowledge/search` returns `{"content":"This question is too complex... break it into smaller questions","explainability":[],"context":[]}` (tiny ~168B response, HTTP 200) → CAUSE: query bundled too many sub-topics in one call → FIX: one focused single-topic question per call; multi-topic prompts silently yield empty evidence.
- [2026-06-19 · Claude Code] Some Cala searches return nothing / time out → CAUSE: broad queries can run up to the 180s server limit; at `-m 175` curl they occasionally drop with no file written → FIX: keep per-call timeout ≥175s, retry the dropped one alone, and verify each output file exists before parsing.
- [2026-06-19 · Claude Code] Cala `origins[]` carry `source.name`/`source.url` + `document.name`/`url` but NO date field → CAUSE: provenance has no freshness timestamp → FIX: per-evidence dates must be extracted from claim text or a different source; do not expect Cala to supply published_at (this is the Trace time-semantics gap, PRD §20.3).
- [2026-06-19 · Claude Code] Cala `source.name` is sometimes a MISMATCHED document title (e.g. an IMF Article-IV claim labeled "EU Commission launches OceanEye"; OECD claims labeled "IamExpat") → CAUSE: the origin's source/document fields occasionally point at the wrong record → FIX: trust `source_url` over `source.name`; verify the domain matches the claimed institution before using source_name for the credibility axis. Affects ~a handful of the 179 NL-housing evidence items.
