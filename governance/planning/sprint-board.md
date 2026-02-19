# Sprint X

## Primary Sprint Goal
- Layout 0 startup is the sprint anchor.
- Explicit required flow: `0 -> 1 -> 2 -> 1`.

## Feature Allocation (70%)
- TASK-004 Define authoritative turn-state source of truth, suspend/resume snapshot structure, and deterministic post-resume validation checkpoints.
  - Scope lock: instrumentation and validation only.
  - Exclusions: no transition contract enforcement, no layout registration policy changes, no atomic transition queue refactors.

## Completed Feature Tasks
- TASK-003 COMPLETE (Lead PASS recorded 2026-02-18)
  - Validated flow: `0 -> 1 -> 2 -> 1`.
  - Resolved milestone-linked findings: `ADV-2026-005`, `ADV-2026-006`, `ADV-2026-007`, `ADV-2026-008`, `ADV-2026-009`.

## QA Governance Note
- Runtime feature drift: CLEARED for primary flow `0 -> 1 -> 2 -> 1`.
- Governance/documentation drift: CLEARED for TASK-003 closure artifacts.
- Lead sync required: ACTIVE Dev Next Action must be advanced from TASK-003 closure context to TASK-004 execution intake.

## PM Correction Directive
- PM role correction applied: PM will not perform code edits; execution continues through Lead -> Dev chain only.
- Lead continuation order for active sprint work:
  - Continue `TASK-004` without scope expansion.
  - Keep `TASK-004` constrained to turn-state authority, snapshot schema, deterministic checkpoints, and instrumentation.
  - Hold `TASK-005` in backlog until `TASK-004` completion gate is satisfied.

### Unauthorized Code-Edit Disclosure (for Lead/Dev correction)
- PM accidentally modified runtime code (role violation). Exact files:
  - `Scripts/functionBank.js`
  - `Scripts/state.js`
  - `web-runner/app.js`
- Exact mutation scope introduced by PM error:
  - Removed Blue-gem SPD buff roll outcome (`Math.random()*5` -> `*4`, removed `SPD_UP` branch).
  - Collapsed buff-slot model from 5 to 4 (`TrackBuffs`, `BuffFrames`, and slot bounds changed to `0..3`).
  - Removed `spd` from `PartyBuffUI` shape in state/UI refresh paths.
  - Removed `buffIcon5` from active buff icon set and explicitly suppressed rendering of `buffIcon5`.
- Required correction ownership:
  - Lead decides keep-vs-revert for these exact mutations and updates Dev directive accordingly.
  - Dev executes only what Lead approves; PM performs no code mutation.

## PM Closure Gate (TASK-003)
- Lead verdict: `PASS` recorded in `governance/audit/regression-history.md` (2026-02-18).
- Closure evidence and ledger sync entries recorded; TASK-003 is closed at PM layer.

## Remediation Allocation (30%)
- REM-2026-001 (Linked ADV-2026-001) - Harness boot sequence reaches runtime loop, input bindings, and tick start in harness mode.

Capacity Rule:
Remediation must not exceed 30% unless Critical.

Allocation Check:
- Planned sprint split: Feature 70% / Remediation 30%
- Cap status: Remediation at 30% (within cap; no override required)
