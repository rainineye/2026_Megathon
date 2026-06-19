# Security Rules

This repository is a shared memory vault. Treat local agent settings and API
credentials as machine-local state, never as project content.

## Never commit

- API keys, tokens, passwords, cookies, or bearer credentials.
- `.env` files or environment dumps.
- `.claude/settings.local.json` or other local permission files.
- Raw API response scratch files that may include request metadata.

## Before pushing

Run these checks from the repository root:

```powershell
git status --short --ignored
rg -n --hidden --glob '!.git/**' --glob '!SECURITY.md' "clsk_|X-API-KEY|API[_-]?KEY|Bearer |password|secret|token"
```

The secret scan must return no committed files containing real credentials.
