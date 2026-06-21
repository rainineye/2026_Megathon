#!/usr/bin/env bash
# deploy.sh — push the built cockpit + engine to the VPS.
# Run from Git Bash on the Windows dev machine, from the repo root:
#     SSH_HOST=root@178.104.155.160 bash deploy/deploy.sh
#
# Target VPS: Hetzner nbg1 (Nuremberg), Ubuntu 24.04, 178.104.155.160.
# Live at https://megathon.traceintelligence.io (Caddy auto-TLS, same-origin).
#
# Layout on the VPS (matches fixtures_loader's dirname(dirname(__file__))
# resolution: engine/ and fixtures/ must be siblings under /srv/megathon):
#
#   /srv/megathon/
#     engine/            <- app/engine/*.py  (incl. the 3 gitignored proprietary files)
#     fixtures/          <- app/fixtures/*   (prebuilt JSON; build_fixtures.py is NOT run on the VPS)
#     dist/              <- app/dist/*       (Vite static build)
#     requirements.txt
#     venv/              <- created once; reused after
#
# Upload uses tar-over-ssh (NOT rsync): the Windows Git Bash client has no rsync,
# and streaming a tarball through ssh avoids writing a temp file on the (often
# tight) local disk. tar copies physical files and ignores .gitignore, so the
# proprietary trace_engine/trace_structured/trace_bridge .py ship correctly even
# though they're gitignored. They never go through git — that's intentional.
set -euo pipefail

# ---- configure --------------------------------------------------------------
SSH_HOST="${SSH_HOST:-root@178.104.155.160}"
REMOTE="/srv/megathon"
SSHOPT="-o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
# -----------------------------------------------------------------------------

cd "$(dirname "$0")/.."   # repo root

echo "==> Building frontend (same-origin)"
# Call npm directly (Git Bash resolves the `npm` shim). Do NOT route through
# `cmd //c` — `cmd` isn't on PATH when bash is launched from PowerShell.
# Do NOT set VITE_TRACE_API_URL: api.ts defaults to same-origin ("") in a prod
# build and the endpoint paths already include /api (setting "/api" doubled it).
( cd app && unset VITE_TRACE_API_URL && npm run build )

echo "==> Streaming dist + engine + fixtures + requirements.txt to $SSH_HOST:$REMOTE"
# rm dist first so old hashed bundles don't pile up (a stale one once baked the
# wrong API URL and clients cached it -> offline fallback).
( cd app && tar czf - --exclude='engine/__pycache__' dist engine fixtures requirements.txt ) \
  | ssh $SSHOPT "$SSH_HOST" "mkdir -p $REMOTE && rm -rf $REMOTE/dist && tar xzf - -C $REMOTE"

echo "==> Installing deps + restarting API"
ssh $SSHOPT "$SSH_HOST" "cd $REMOTE && [ -d venv ] || python3 -m venv venv; ./venv/bin/pip install -q -r requirements.txt && systemctl restart trace-api && sleep 2 && systemctl is-active trace-api && curl -s http://127.0.0.1:8000/api/health"

echo
echo "==> Done. https://megathon.traceintelligence.io"
