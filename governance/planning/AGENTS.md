# Governance Planning DOX

## Purpose
- Own architecture contracts, turn-state invariants, roadmaps, migration plans, and process planning.

## Ownership
- SimulationCore Rust/JS boundary docs.
- Turn-state invariants and layout/automation/backend contracts.
- Roadmaps, backlog exports, consolidation plans, and process debt documents.

## Local Contracts
- Planning contracts describe intended boundaries and stop conditions; they do not authorize implementation unless the active bead scope does.
- SimulationCore planning establishes Rust as deterministic simulation owner and JavaScript as browser integration owner.
- Turn-state invariants establish speed-based interleaved initiative for normal combat.
- If a planning doc lists stop conditions, honor them before writing code.
- Keep reports/evidence separate from new implementation instructions unless a doc is explicitly a plan.

## Work Guidance
- When changing architecture docs, include the operational consequence: owner, forbidden owner, validation, and stop condition.
- Do not rewrite historical audits as current truth without checking current code and tests.
- Preserve rollback/checkpoint guidance for risky migrations and cleanup work.

## Verification
- `git diff --check` for markdown-only planning changes.
- Focused contract tests when planning changes are accompanied by code changes.
- For SimulationCore boundary changes, run Rust/WASM and focused ownership tests named in the relevant plan.

## Child DOX Index
- None.
