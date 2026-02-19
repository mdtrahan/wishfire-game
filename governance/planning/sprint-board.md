# Sprint X

## Primary Sprint Goal
- Layout 0 startup is the sprint anchor.
- Explicit required flow: `0 -> 1 -> 2 -> 1`.

## Feature Allocation (70%)
- TASK-005 Remove speed buff from Blue Gem buff system.
  - Scope:
    - Remove Blue-gem speed buff outcome from buff roulette logic.
    - Remove speed buff icon usage.
    - Collapse buff slots from 5 to 4 (`ATK`, `DEF`, `MAG`, `RES` only).
  - Constraints:
    - No other gameplay logic changes.
    - No unrelated visual redesign.
    - No transition-flow edits.
  - Acceptance:
    - Blue gem no longer produces SPD buff.
    - No SPD buff icon appears.
    - Buff display/slot system shows exactly 4 party buff slots (`ATK/DEF/MAG/RES`).

## PM Throughput Directive (Urgency)
- Lead must dispatch work in bundled packets, not micro-steps.
- For each active TASK, `ACTIVE.md` must publish one execution packet with:
  - `Packet Step 1` (current implementation action)
  - `Packet Step 2` (immediate follow-up action)
  - `Packet Step 3` (validation/closeout action)
- Dev executes packet steps sequentially without waiting for intermediate resync unless:
  - A BLOCKER/CRITICAL escalation is triggered, or
  - Scope boundary is hit.
- While Dev executes current packet, Lead must pre-stage next TASK intake artifacts so sprint transition is immediate at completion.

## Completed Feature Tasks
- TASK-003 COMPLETE (Lead PASS recorded 2026-02-18)
  - Validated flow: `0 -> 1 -> 2 -> 1`.
  - Resolved milestone-linked findings: `ADV-2026-005`, `ADV-2026-006`, `ADV-2026-007`, `ADV-2026-008`, `ADV-2026-009`.
- TASK-004 COMPLETE (Lead PASS recorded 2026-02-19)
  - Validation artifact: `test-results/task004-phase3/validation.json`.
  - Closure basis: checkpoint instrumentation + deterministic pass path + expected violation classification.

## QA Governance Note
- Runtime feature drift: CLEARED for primary flow `0 -> 1 -> 2 -> 1`.
- Governance/documentation drift: CLEARED for TASK-003 and TASK-004 closure artifacts.
- Lead sync required: ACTIVE Dev Next Action must be advanced from TASK-004 closeout to TASK-005 intake.

## PM Correction Directive
- PM role correction applied: PM will not perform code edits; execution continues through Lead -> Dev chain only.
- Lead continuation order for active sprint work:
  - Continue active sprint task without scope expansion.
  - Keep task scope constrained to defined sprint criteria.
  - Pre-stage next task so intake is immediate after completion gate.

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
