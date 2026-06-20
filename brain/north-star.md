---
type: north-star
updated: 2026-06-19
---
# North Star

> The one note every session reads first. Keep it short. If something here changes,
> it is a DECISION — log it in decisions.md, don't just silently edit.

## Project
A desktop **decision-intelligence cockpit** that fuses public facts/evidence, expert
judgment, and a user's personal variables, then uses the deterministic **Trace engine**
to show market-state distributions, evidence chains, and auditable, personalized advice —
demo case: should an individual buy / wait / keep renting in the **Netherlands housing market**.

## Hackathon
- Event: Megathon 2026  *(confirm exact name)*
- Deadline: TBD — confirm demo time *(blocking unknown: set this)*
- Team: mian, collaborator (+ agents: Claude Code, Codex)

## What "done" means (demo-able)
- [ ] Desktop/web cockpit shell: left nav · top state bar · main canvas · right inspector
- [ ] NL housing case loaded from static **canonical** evidence (no live data)
- [ ] Decision Brief: recommendation + scenario distribution + trigger watchlist
- [ ] Personal Fit: editable variables that visibly change the advice
- [ ] Every number traces back to deterministic engine output (distribution / coverage /
      credibility / claim_resolution) — support never shown as causal certainty

## Non-goals (explicitly out of scope for the hackathon)
- Live data ingestion / real-time feeds
- Professional-grade mortgage/tax calculation; legal or tax advice
- Fully automated causal inference or token actual-cause attribution
- Calibrated real-world forecast probabilities (distribution ≠ "true probability")
- Mobile UI · multi-user collaboration
