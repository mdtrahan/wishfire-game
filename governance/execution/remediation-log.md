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

## Closure Rule
A finding may be marked CLOSED only if:
- Linked REM item exists
- Root cause addressed
- Regression guard defined

## Current Sprint Allocation Check
- Remediation allocation: 25% (1 remediation item out of 4 open findings)
- Cap status: Within 30% cap
- Override status: No Critical override applied
