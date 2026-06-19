# AGENTS.md — memory rules for Codex (mirror of CLAUDE.md)

This vault is the shared brain for our hackathon project. Two humans, two agents,
one memory. The full contract is in `CLAUDE.md`; the operative rules for you:

1. READ BEFORE ACTING. Before deciding anything non-trivial, recall prior context:
   `qmd query "<what we might have already decided about X>"`
   (or the `mcp__qmd__query` tool if registered). Pull only what's relevant — do
   not read the whole vault.
2. OBEY CONSTRAINTS. Every line in `brain/constraints.md` beginning with `FORBID:`
   is absolute. If a task would violate one, stop and surface it.
3. WRITE AFTER DECIDING. When a decision is made, APPEND one bullet to
   `brain/decisions.md` (timestamp + who/which agent + the decision + why).
   If it's a hard rule, also append a line to `brain/constraints.md`.
4. APPEND-ONLY. Never rewrite or delete past entries in `brain/` — append. This is
   what keeps two collaborators' git histories from colliding.
5. The qmd index is per-machine and rebuilt from the shared markdown. The markdown
   in git is the source of truth, not your context window.
