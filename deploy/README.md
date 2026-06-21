# Deploy → megathon.traceintelligence.io

Single VPS, same-origin. Caddy serves the static React build and reverse-proxies
`/api/*` to a warm uvicorn process. Caddy handles HTTPS automatically.

```
Browser ──HTTPS──> Caddy (:443) ──┬── /          -> /srv/megathon/dist  (static)
                                  └── /api/*      -> 127.0.0.1:8000 (uvicorn)
```

Why same-origin: no CORS to manage, one TLS cert, one box. The frontend is built
with `VITE_TRACE_API_URL=/api` so it calls its own origin.

## ⚠️ Proprietary engine files

`app/engine/trace_engine.py`, `trace_structured.py`, `trace_bridge.py` are
gitignored (local-only IP). **They are NOT in the repo** — `deploy.sh` ships them
via rsync directly from disk. Never `git push` them; never deploy by `git clone`
on the VPS, or the API won't import.

`build_fixtures.py` reads `C:\Users\eau12\Trace_Core\data\canonical` (this Windows
machine only), so it does **not** run on the VPS. The prebuilt
`app/fixtures/nl_housing/*.json` are shipped as-is.

---

## One-time VPS setup

1. **DNS** — add an `A` record in your traceintelligence.io console:
   `megathon` → `<VPS public IP>`. Open firewall ports **80 and 443**.

2. **Install Caddy + Python** (Debian/Ubuntu):
   ```bash
   sudo apt update && sudo apt install -y python3 python3-venv rsync
   # Caddy:
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install -y caddy
   ```

3. **Caddyfile** — copy `deploy/Caddyfile` to the VPS:
   ```bash
   sudo cp Caddyfile /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

4. **systemd unit** for the API:
   ```bash
   sudo cp trace-api.service /etc/systemd/system/trace-api.service
   sudo systemctl daemon-reload
   sudo systemctl enable trace-api
   ```
   (It will start cleanly after the first `deploy.sh` puts the files in place.)

## Every deploy (from the Windows dev machine, Git Bash)

```bash
SSH_HOST=deploy@<VPS-IP> bash deploy/deploy.sh
```

That builds the frontend, rsyncs `dist/ engine/ fixtures/ requirements.txt`,
installs Python deps into the VPS venv, and restarts `trace-api`.

## Verify

```bash
curl -s https://megathon.traceintelligence.io/api/health   # engine up, source=fixtures
```
Then open https://megathon.traceintelligence.io in a browser.

## Notes

- **CORS**: `server.py` currently has `allow_origins=["*"]`. With same-origin
  serving that's harmless, but tightening it to the real domain is a cheap
  hardening win before demo day.
- **No secrets** anywhere in this stack — deterministic engine, static fixtures.
- To roll back, keep the previous `dist/`+`engine/` tarball; rsync is `--delete`.
