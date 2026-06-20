"""
fixtures_loader.py — load the static NL-housing fixtures into engine objects.

Reads app/fixtures/nl_housing/*.json (seeded by app/build_fixtures.py from the
real canonical Trace data) and constructs the dataclasses trace_engine /
trace_structured expect. Drop-in replacement for run_demo's hardcoded demo, so
server.py can serve REAL canonical-derived inputs while keeping Codex's run_demo
untouched as a fallback.
"""
from __future__ import annotations
import json, os

import trace_structured as ts
from trace_engine import Candidate, Evidence, Inference, SupportGroup

FIX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fixtures", "nl_housing")


def available() -> bool:
    return all(os.path.exists(os.path.join(FIX, f)) for f in
               ("candidates.json", "evidence.json", "support_groups.json"))


def _load(name):
    return json.load(open(os.path.join(FIX, name), encoding="utf-8"))


def build_default_case_from_fixtures():
    candidates = [Candidate(c["id"], c["label"]) for c in _load("candidates.json")]
    evidence = []
    for e in _load("evidence.json"):
        infs = [Inference(i["label"], i["target"], i["s"], i.get("text", ""),
                          necessity=i.get("necessity", False),
                          uncontrolled=i.get("uncontrolled", False))
                for i in e.get("inferences", [])]
        evidence.append(Evidence(e["id"], e["source_conf"], e["cala_fact_id"], infs))
    groups = [SupportGroup(g["target"], g["topology"], g["members"],
                           independence_factor=g.get("independence_factor", 1.0),
                           chain_order=g.get("chain_order", []))
              for g in _load("support_groups.json")]
    return candidates, evidence, groups


def build_structured_case_from_fixtures():
    spec = _load("structures.json")
    structures = [ts.Structure(s["id"], s["author"],
                               directed=[tuple(d) for d in s.get("directed", [])],
                               bidirected=[tuple(b) for b in s.get("bidirected", [])],
                               undirected=[tuple(u) for u in s.get("undirected", [])])
                  for s in spec["structures"]]
    asserted = [(a[0], a[1], a[2], set(a[3])) for a in spec.get("asserted", [])]
    return ts.adjudicate(structures, tuple(spec["claim"]), asserted,
                         observed=spec.get("observed", []),
                         unobserved=spec.get("unobserved", []))


def personal_profiles():
    try:
        return _load("personal_profiles.json")
    except FileNotFoundError:
        return []


def factor_research():
    try:
        return _load("factor_research.json")
    except FileNotFoundError:
        return {
            "case": "nl_housing",
            "coverage_status": "missing",
            "factors": [],
            "edges": [],
            "rollups": {},
        }
