# deploy.ps1 — native PowerShell deploy for the Megathon cockpit.
# Run from PowerShell, from anywhere in the repo:
#     .\deploy\deploy.ps1
#
# Uses ONLY native Windows tools (npm, tar.exe/bsdtar, ssh.exe, scp.exe) so it
# does NOT depend on Git Bash or WSL. (Running `bash deploy/deploy.sh` from
# PowerShell invokes WSL's Linux bash, which can't use the Windows-installed
# node_modules — that's the rollup-linux error. This script avoids all that.)
#
# Target: Hetzner nbg1, 178.104.155.160 -> https://megathon.traceintelligence.io
# Override the host with:  $env:SSH_HOST="root@1.2.3.4"; .\deploy\deploy.ps1

$ErrorActionPreference = "Stop"

$SSH_HOST = if ($env:SSH_HOST) { $env:SSH_HOST } else { "root@178.104.155.160" }
$REMOTE   = "/srv/megathon"
$repo     = Split-Path -Parent $PSScriptRoot   # repo root (deploy/ is under it)
$app      = Join-Path $repo "app"
$tgzName  = "megathon-deploy.tgz"
$tgz      = Join-Path $env:TEMP $tgzName
$SSHOPT   = @("-o","StrictHostKeyChecking=accept-new","-o","ConnectTimeout=20")

Write-Host "==> Building frontend (same-origin)"
# Do NOT set VITE_TRACE_API_URL: api.ts defaults to same-origin ("") in a prod
# build, and the endpoint paths already include /api. Setting it to "/api" here
# caused doubled /api/api/* 404s. Clear any stray value from the shell.
Remove-Item Env:VITE_TRACE_API_URL -ErrorAction SilentlyContinue
Push-Location $app
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm build failed" }

    Write-Host "==> Packing dist + engine + fixtures + requirements.txt"
    # bsdtar; --exclude before the paths. Sources are relative to app/.
    tar --exclude="engine/__pycache__" -czf $tgz dist engine fixtures requirements.txt
    if ($LASTEXITCODE -ne 0) { throw "tar failed" }
} finally {
    Pop-Location
}

Write-Host "==> Uploading to $SSH_HOST"
# scp from inside TEMP with a bare filename: avoids scp parsing "C:" as a host.
Push-Location $env:TEMP
try {
    scp @SSHOPT $tgzName "${SSH_HOST}:/tmp/$tgzName"
    if ($LASTEXITCODE -ne 0) { throw "scp failed" }
} finally {
    Pop-Location
}

Write-Host "==> Extracting + installing deps + restarting API"
# rm dist first so old hashed bundles don't pile up (a stale one once baked the
# wrong API URL and clients cached it -> offline fallback).
$remote = "mkdir -p $REMOTE && rm -rf $REMOTE/dist && tar xzf /tmp/$tgzName -C $REMOTE && rm -f /tmp/$tgzName && cd $REMOTE && ([ -d venv ] || python3 -m venv venv) && ./venv/bin/pip install -q -r requirements.txt && systemctl restart trace-api && sleep 2 && systemctl is-active trace-api && curl -s http://127.0.0.1:8000/api/health"
ssh @SSHOPT $SSH_HOST $remote
if ($LASTEXITCODE -ne 0) { throw "remote deploy failed" }

Remove-Item $tgz -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "==> Done. https://megathon.traceintelligence.io"
