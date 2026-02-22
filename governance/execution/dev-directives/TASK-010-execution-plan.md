# TASK-010 Execution Plan

## Objective
Implement the tower war-beacon loop with deterministic capture progress, interruption battle trigger, reward payout path, and weekly reset handling.

## Scope Boundaries
- In scope (only):
  - Tower beacon capture loop state progression.
  - Interruption battle trigger during contested capture windows.
  - Reward resolution for successful capture outcomes.
  - Weekly reset behavior for beacon state.
- Explicit exclusions:
  - no map-layout routing refactor (TASK-009 scope)
  - no unrelated combat-system redesign
  - no monetization/live-ops rule expansion beyond loop requirements

## Phase 1
- Define and implement deterministic beacon state model (idle, contested, captured, reset-ready).
- Wire tower interaction path from existing map layer state to beacon loop entry.

## Phase 2
- Implement interruption battle trigger and return path with preserved loop state.
- Implement reward payout path for capture success and loss/interrupt outcomes.

## Phase 3
- Implement weekly reset operation and deterministic validation captures:
  - pre-capture state
  - contested/interruption state
  - post-capture reward state
  - weekly reset state
- Publish artifacts under:
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task010/`

## Verifiable Success Criteria
- Beacon loop transitions deterministically across idle/contested/captured/reset states.
- Interruption battle trigger is reliable and state-consistent.
- Reward payout executes only on valid capture completion.
- Weekly reset returns beacon loop to expected baseline state.
