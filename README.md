# Shared memory layer (hackathon vault)

A "memory hardness" setup for a project two people build together with two agents
(Claude Code + Codex). The goal: neither a human nor an agent re-litigates a settled
decision, and the memory survives crashes, new sessions, and the other person's machine.

## The model (one diagram in words)

```
        shared markdown (git)            <-- single source of truth
        brain/ work/ reference/
                |
       git push / pull (you <-> friend)
                |
   per-machine qmd index (~/.cache/qmd)  <-- disposable, rebuilt from markdown
                |
   mcp__qmd__query in every session
                |
   Claude Code (CLAUDE.md) + Codex (AGENTS.md)
```

Three properties make it "hard":

1. **Source of truth is git-tracked markdown**, not anyone's context window or local
   index. Crash, new session, or new laptop — the memory is still there on pull.
2. **Read-before-act / write-after-decide** is written into `CLAUDE.md` + `AGENTS.md`,
   so both agents query prior decisions before acting and persist new ones after.
3. **Append-only decision log** in `brain/decisions.md` — two people committing to an
   append-only log almost never merge-conflict. Rewrites do. So we never rewrite.

## Install (each person, once)

```bash
# drop these files into your vault root, then:
chmod +x setup.sh
./setup.sh                 # installs qmd, indexes the vault, downloads ~2GB models
qmd query "what did we decide about project memory"   # smoke test
```

Requirements: Node ≥ 22 **or** Bun ≥ 1.0 (setup.sh installs Bun if neither exists),
~2GB disk for local models. No API key — qmd runs entirely on your machine.

MCP is already wired for Claude Code via `./.mcp.json` (loaded automatically when you
run `claude` here). Codex reads `AGENTS.md`.

## What's in here

| Path | Role |
| --- | --- |
| `setup.sh` | per-machine install + index (re-runnable) |
| `.mcp.json` | registers the qmd MCP server for Claude Code |
| `CLAUDE.md` | the session memory contract (read/write/forbid rules) |
| `AGENTS.md` | mirror of the rules for Codex |
| `.claude/settings.json` | SessionStart hook: injects the vault map each session |
| `brain/north-star.md` | scope, deadline, non-goals — read first every session |
| `brain/decisions.md` | append-only decision log (the shared memory) |
| `brain/constraints.md` | hard rules; `FORBID:` lines gate agent actions |
| `brain/gotchas.md` | traps, so they're hit at most once |
| `.gitignore` | commits markdown + config; never the local index or `.env` |

## Notes

- This is the **session-level** memory layer. It's the foundation the hardened agentic
  loop (`hard_loop.py`) sits on: that loop's `memory_search()` calls the same `qmd`,
  so once this is indexed, the loop does real semantic recall instead of grep fallback.
- Prefer a **project-local** collection config if you'd rather keep it in git: qmd
  supports `.qmd/index.yaml` in addition to the global `~/.config/qmd/index.yml`.
  Confirm the schema against qmd's `example-index.yml` before relying on it.
- First fill in `brain/north-star.md`. An empty north star means the agents have
  nothing to anchor to and will drift.
