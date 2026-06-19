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
