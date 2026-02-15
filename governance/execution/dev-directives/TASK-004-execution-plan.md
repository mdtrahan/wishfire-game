# TASK-004 Execution Plan

## Objective
Define and validate deterministic suspend/resume turn-state behavior across layout transitions while tick timers are active.

## Scope Boundaries
- In scope:
  - Authoritative turn-state source definition for suspend/resume validation.
  - Deterministic validation checkpoints at pre-suspend, snapshot creation, and post-resume.
  - Verifiable pass/fail outcomes mapped to milestone DoD items.
- Out of scope:
  - Transition contract enforcement changes.
  - Layout registration policy changes.
  - Atomic transition queue refactors.
  - Remediation scope changes.

## Phase 1
- Establish one authoritative turn-state contract for validation.
- Define explicit invariant predicates and deterministic failure IDs.
- Specify snapshot payload fields required for resume integrity checks.

## Phase 2
- Instrument validation checkpoints at suspend/resume boundaries only.
- Ensure post-resume validation completes before next turn advancement.
- Emit deterministic validation outcomes through existing observability paths.

## Phase 3
- Add/extend deterministic tests covering:
  - Normal suspend/resume pass path.
  - Invariant violation classification path.
  - Tick continuity with no turn-order corruption after resume.

## Verifiable Success Criteria
- Snapshot/resume integrity checks are deterministic and repeatable.
- Turn order and current actor remain consistent after resume.
- Pointer and tick loop continuity remains active across transitions.
- No changes made outside TASK-004 boundaries.
