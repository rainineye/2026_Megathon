---
type: constraints
---
# Constraints

> Hard rules the agents must obey. A line starting with `FORBID:` is absolute —
> the hardened loop's validator (and the session contract) will refuse any action
> whose target/args match the text after `FORBID:`. Keep the payload specific.

## Invariants (always true)
- The markdown in git is the source of truth, not any single machine's index or context.
- Every decision lands in decisions.md before code depends on it.

## Forbidden
- FORBID: .env
- FORBID: secrets
- FORBID: force-push
- FORBID: hardcoded/placeholder evidence in any number shown to the user — every figure must trace to real data (Cala output / `fixtures/nl_housing/*` / a tool-fetched source with url). `run_demo.py`'s `build_default_case()` + `build_structured_case()` are hand-typed placeholders and must NOT be used to produce user-facing numbers.
- FORBID: assigning `source_origin: "cala"` or `source:cala` UI tags to data that was not directly read from raw Cala responses; web/browser/manual/tool-fetched sources and analyst-derived artifacts must use their own provenance or `derived-from:cala`, never direct Cala labels.
- FORBID: rendering the outcome conclusions (ranked scenario reads / net read) as a separate right-hand side panel (the old OutputPanel). Conclusions MUST be on-canvas factor cards using the same CanvasGraph card component as the causal factors, in the conclusions column right of the price outcome. See decisions.md 2026-06-21 (FINAL).
- [2026-06-21] REVERSES the earlier FORBID on a conclusions side-panel: per the user, the OUTCOME (read + buy/wait/rent decision) now lives in the BOTTOM DOCK (switchable with indicators, collapsible, auto-opens after a run), NOT on the canvas. The canvas is causal-structure-only. The old "conclusions must be on-canvas factor cards" rule no longer applies.
