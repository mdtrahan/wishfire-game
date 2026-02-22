# TASK-019 Execution Plan

## Objective
Fix the rare party-wide power-amp expiry leak so every affected hero loses power amp on that hero's immediate next turn/action.

## Scope Boundaries
- In scope only:
  - power-amp lifecycle consume/expire logic
  - per-recipient turn/action tracking for party-wide grants
  - deterministic validation artifacts
- Out of scope:
  - no initiative text lifecycle edits (closed under TASK-020)
  - no story-card/yellow-match feature edits
  - no unrelated combat/turn-order refactors

## Phase 1
- Reproduce party-wide power-amp leak with deterministic/skewed validation run.
- Trace per-recipient states: granted -> acted -> consumed/expired.

## Phase 2
- Apply minimal lifecycle correction:
  - each recipient expires on immediate next turn/action regardless of action type
  - no recipient carries amp into a second turn
  - preserve overwrite-on-stack behavior

## Phase 3
- Publish deterministic evidence proving no per-recipient carry-over and no stomp regressions.

## Required Validation Artifacts
- `task019-poweramp-recipient-turn-trace.json`
- `task019-poweramp-next-turn-only-assertions.json`
- `task019-poweramp-partywide-expiry-assertions.json`
- `task019-no-carryover-assertions.json`
- `task019-partywide-skew-trace.json`
- `task019-partywide-leak-stomp-assertions.json`
- `task019-text-print-regression-guard.json`
- `task019-closure-recommendation.json` (PASS/FAIL)

## Verifiable Success Criteria
- Every party-wide power-amp recipient loses amp on immediate next turn/action.
- No hero retains amp into a second turn.
- Stack overwrite behavior remains correct.
