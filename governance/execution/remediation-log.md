# Remediation Log

## Open REM Items
- REM-2026-001
  - Linked Finding: ADV-2026-001
  - Severity: Critical
  - Root Cause Theme: Harness lifecycle gating before runtime activation
  - Selection Rationale: Highest severity and direct blocker for executable layout/combat conformance validation.
  - Scope: Ensure harness initialization completes required runtime install path (input handlers + tick) before returning control.
  - Regression Guard:
    - Add/maintain harness conformance check that verifies pointer handler registration and active tick progression under `?harness=true`.
    - Verify click-driven combat transition flow executes end-to-end in harness mode.
  - Closure Conditions:
    - Root cause addressed in runtime init path.
    - Regression guard defined and runnable.
    - Linked ADV item re-validated.

## Deferred / Backlog Candidates
- ADV-2026-002 (deferred to backlog: 30% cap; High severity, not selected over Critical)
- ADV-2026-003 (deferred to backlog: 30% cap; High severity, not selected over Critical)
- ADV-2026-004 (deferred to backlog: 30% cap; Medium severity)

## Critical-to-Task Mapping (Current Sprint)
- ADV-2026-005 -> TASK-003 sprint-blocking acceptance criterion (`0 -> 1` bootstrap integrity); status: RESOLVED (closure sync 2026-02-18).
- ADV-2026-007 -> TASK-003 sprint-blocking acceptance criterion (`1 -> 2` pathway reachability); status: RESOLVED (closure sync 2026-02-18).

## Re-scope Note (Post-QA)
- No new REM item opened for ADV-2026-005 or ADV-2026-007 because both were handled as TASK-003 acceptance criteria and validated in QA.
- Closure sync complete: Lead review status and evidence are recorded in adversarial-ledger and regression-history.

## PM Forward-Drive Directive (Lead Review Output Required)
- TASK-003 closure gate is satisfied and closed at PM layer.
- Next governance action: keep REM-2026-001 active and transition feature execution focus to TASK-004.

## Closure Rule
A finding may be marked CLOSED only if:
- Linked REM item exists
- Root cause addressed
- Regression guard defined

## Current Sprint Allocation Check
- Planned allocation: Feature 70% / Remediation 30%
- Active remediation items: 1 (`REM-2026-001`)
- Cap status: Within 30% cap
- Override status: No BLOCKER override applied
