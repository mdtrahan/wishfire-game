# PROJECT INDEX — Codex-Orka

Purpose:
Provide a compact retrieval map of canonical runtime behavior.
Always consult this file before broad repo search.

---

## Canonical Runtime

Authoritative gameplay behavior lives in:

- Scripts/
- web-runner/

Anything outside these folders is non-canonical unless explicitly stated.

---

## Core Behavior Domains

### Combat / Turn System
Primary logic lives in:
- Scripts/ (search for: turn, speed, initiative, combat, resolve)
- web-runner/ (runtime integration layer)

Rules reference:
- SPD-sorted turn order
- Speed spike rule
- Shared HP pool
- Purple gem = party attack amplification

---

### Gem / Action Flow
Search in:
- Scripts/ (search for: gem, selection, target, refill)

States:
- gem selection
- target selection
- nav menu
- refill

---

### UI / Modal Layering
Search in:
- Scripts/ (search for: nav, overlay, dark field, modal)

Rules:
- Nav above dark field
- Dark field blocks gameplay only
- Gemboard must not shift

---

### Deployment Runtime
- web-runner/ contains build entry
- Netlify deploy tracks main branch

---

## Memory System

Operational files:
- ai-memory/context.md
- ai-memory/todo.md
- ai-memory/insights.md

---

## Archive (Read-only)

- project_C3_conversion/

Never infer runtime behavior from C3 JSON.

---

## Retrieval Rule

Before editing:
1) Identify domain from this file.
2) Read relevant Scripts/ or web-runner/ fi

## Retrieval Map (Read before grepping)
Before searching the repo broadly, search `ai-memory/PROJECT.md`.
If information is missing, record an "Index gap" note in `ai-memory/insights.md`.

