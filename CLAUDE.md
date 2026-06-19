# CLAUDE.md — memory contract for this vault

This Obsidian vault is the **shared brain** for our hackathon project. Two humans
(mian + collaborator) and two agents (Claude Code + Codex) all read and write the
same files. Markdown-in-git is the source of truth — not your context window, not
anyone's local qmd index. This file is loaded automatically every session.

## The loop you run every session

**Start**
1. Read `brain/north-star.md` — what we're building, the deadline, the non-goals.
2. Recall before you reason: query semantic memory for anything touching the task,
   e.g. `mcp__qmd__query` (or `qmd query "..."`) with "what did we decide about X".
   Pull only the relevant snippets; do not load the whole vault into context.
3. Read `brain/constraints.md`. Treat every `FORBID:` line as absolute.

**While working**
- READ BEFORE ACTING. Before any non-trivial decision, run a qmd query for prior
  decisions/gotchas on that topic. If the answer already exists, follow it — do not
  re-litigate a settled decision.
- WRITE AFTER DECIDING. The moment a decision is made, APPEND one bullet to
  `brain/decisions.md`:  `- [YYYY-MM-DD · who] DECISION — why.`
  If it's a hard rule, also append a line to `brain/constraints.md` (use `FORBID:`
  for prohibitions). A decision that isn't written down did not happen — the next
  session and the other agent can't see your context, only the vault.
- Record traps in `brain/gotchas.md` as you hit them.

**End**
- Make sure every decision and gotcha from this session is written back.
- Stage and commit the markdown so your collaborator's next pull (and their next
  agent session) sees it.

## Collaboration rules (these are what make the memory "hard")

- APPEND-ONLY in `brain/`. Never edit or delete a past decision; if one is reversed,
  append a new line that says so and references the old one. Append-only logs almost
  never produce git merge conflicts between two people — rewrites do.
- The qmd index is per-machine and disposable. It's rebuilt from the shared markdown
  by `setup.sh`. If recall feels stale, run `qmd update`, don't hand-edit the index.
- Never write secrets or `.env` contents into notes. `reference/architecture.md`
  may say *where* keys live, never the values.

## Search modes (when to use which)
- `qmd query` — hybrid (expansion + rerank), best quality. Default for "did we
  decide / discuss X" recall before acting.
- `qmd vsearch` — semantic, fast. Good for "find notes similar to this idea".
- `qmd search` — BM25 keyword, instant. Good for an exact term or filename.

## Folder map
- `brain/` — north-star, decisions (append-only), constraints (FORBID), gotchas
- `work/`  — active work notes, linked back to the decisions they came from
- `reference/` — stable architecture facts, where things live
- `thinking/` — scratchpad; promote anything durable into `brain/` or `work/`
