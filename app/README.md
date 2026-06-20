# Trace Personal App

Desktop MVP scaffold for the personal market decision cockpit.

## Stack

- Vite + React + TypeScript for the UI.
- FastAPI + uvicorn for the warm local Trace engine API.
- Python for the deterministic Trace engine layer.
- Desktop shell is deferred; Electron/Tauri can wrap the web app later.

This is intentionally web-first. It avoids blocking the MVP on Rust/Tauri or Electron packaging
while preserving a future migration path to a desktop wrapper.

## Commands

Run from `app/`:

```powershell
pip install -r requirements.txt
cmd /c npm install
cmd /c npm run api:dev
cmd /c npm run dev
```

In another terminal:

```powershell
cmd /c npm install
cmd /c npm run engine:demo
cmd /c npm run build
```

PowerShell may block `npm.ps1` on this machine, so prefer `cmd /c npm ...`.

Current machine note: the earlier Electron dependency install failed with `ENOSPC: no space left on
device`. Electron is no longer a default dependency, so the npm install should be much smaller. The
Python engine demo does not depend on npm and already runs.

## Engine Boundary

The UI does not invent quantitative outputs. It calls:

```text
POST http://127.0.0.1:8000/api/run-personal-advice
```

The FastAPI server imports:

- `engine/trace_engine.py`
- `engine/trace_structured.py`
- `engine/trace_bridge.py`
- `engine/schema_adapter.py`
- `engine/run_demo.py`

The app-facing contract keeps these axes separate:

- `candidate_support`
- `candidate_coverage`
- `candidate_credibility`
- `candidate_status`
- `claim_resolution`
- `trace_log`

Do not collapse them into a single trust score.

## Next Build Step

Replace the hardcoded demo case in `engine/run_demo.py` with JSON fixtures under:

```text
fixtures/nl_housing/
```

Then add a second runner that accepts a personal profile payload and recomputes action advice.
