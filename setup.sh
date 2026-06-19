#!/usr/bin/env bash
# setup.sh — memory layer setup for a shared hackathon vault.
#
# Run ONCE PER MACHINE (you and your collaborator each run it in your clone).
# Safe to re-run: it re-indexes; it never touches your markdown.
#
# What it does:
#   1. ensures a JS runtime (node>=22 or bun)
#   2. installs qmd if missing
#   3. registers THIS vault as a qmd collection (md files only)
#   4. builds the BM25 index + vector embeddings (first run downloads ~2GB of
#      local GGUF models — embedding, reranker, query-expansion — no API key)
#   5. prints the one-time MCP registration step
#
# NOTE: qmd moves fast. If a command's flags differ, run `qmd --help` /
# `qmd collection --help` and adjust — the names below match the documented CLI.
set -euo pipefail

COLLECTION="${1:-hackmem}"   # keep this name IDENTICAL across collaborators
VAULT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "==> vault: $VAULT_DIR"
echo "==> collection: $COLLECTION"

# 1. runtime ----------------------------------------------------------------
if ! command -v bun >/dev/null 2>&1 && ! command -v node >/dev/null 2>&1; then
  echo "==> no node/bun found; installing bun"
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# 2. install qmd ------------------------------------------------------------
if ! command -v qmd >/dev/null 2>&1; then
  echo "==> installing qmd"
  if command -v bun >/dev/null 2>&1; then
    bun install -g github.com/tobi/qmd
  else
    npm install -g github.com/tobi/qmd
  fi
fi
qmd --version || true

# 3. register the vault as a collection (idempotent) ------------------------
echo "==> adding collection (markdown only)"
qmd collection add "$COLLECTION" "$VAULT_DIR" --pattern '**/*.md' 2>/dev/null \
  || echo "   (collection may already exist — continuing)"

# 4. index + embed (first run pulls ~2GB of models) -------------------------
echo "==> indexing (BM25) ..."
qmd update || true
echo "==> embedding (semantic) — first run downloads models, be patient ..."
qmd embed || true

# 5. verify -----------------------------------------------------------------
echo "==> status"
qmd status || true

cat <<'NEXT'

==> indexing done.

One-time, per machine — register the MCP server so agents get qmd as a tool:

  Claude Code:
    This repo already ships ./.mcp.json, which Claude Code loads automatically
    when you run `claude` in this directory. Nothing else to do.
    (Plugin alternative:  claude marketplace add tobi/qmd && claude plugin add qmd@qmd)

  Codex:
    See AGENTS.md. Codex reads it natively; it will call `qmd query` for recall.

Quick smoke test:
    qmd query "what did we decide about project memory"

From now on, in any session the agents have: mcp__qmd__query / __get / __status.
Re-run this script (or `qmd update`) whenever you add a lot of notes.
NEXT
