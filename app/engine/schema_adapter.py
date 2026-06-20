"""Schema adapters between current Trace engine scripts and app-facing API.

The downloaded reference files are intentionally small and protocol-oriented.
This adapter keeps product code stable while the core protocol names settle.
"""

from __future__ import annotations


STATUS_MAP = {
    "established": "well_supported",
    "supported": "supported",
    "plausible": "plausible",
    "insufficient": "insufficient",
    "excluded": "excluded",
}


def adapt_default_output(default_out: dict) -> dict:
    """Return the default-tier shape expected by trace_bridge.py and the UI."""
    out = dict(default_out)

    verdict = out.get("verdict", {})
    out["candidate_status"] = {
        candidate_id: STATUS_MAP.get(status, status)
        for candidate_id, status in verdict.items()
    }

    statuses = out["candidate_status"]
    live_supported = [
        cid
        for cid, status in statuses.items()
        if status in {"supported", "well_supported"}
    ]

    if out.get("adversarially_polluted"):
        state = "polluted"
    elif not live_supported:
        state = "insufficient"
    elif len(live_supported) > 1:
        state = "contested"
    else:
        state = "provisionally_resolved"

    out["claim_resolution"] = {
        "state": state,
        "basis": "default_tier",
        "note": (
            "Default tier ranks evidential support only; causal claims require "
            "structured-tier certification."
        ),
    }

    out.setdefault("support", out.get("distribution", {}))
    return out
