# TASK-007 Execution Plan

## Objective
Ensure gem refill executes immediately at hero turn end after player gem use, with no refill leakage into subsequent enemy turns.

## Scope Boundaries
- In scope (only):
  - Correct refill trigger timing relative to hero turn completion.
  - Correct refill/turn-advance sequencing to prevent incomplete gemboard display during enemy turns.
  - Add deterministic validation for refill timing and turn progression behavior.
- Explicit exclusions:
  - no unrelated gameplay logic changes
  - no transition-flow edits
  - no visual redesign work unrelated to refill timing

## Phase 1
- Identify the exact refill trigger and turn-advance ordering path currently allowing refill to slip into enemy turns.
- Implement minimal timing fix so refill runs at end of hero action cycle.

## Phase 2
- Enforce sequencing invariants:
  - one action cycle -> one refill cycle
  - refill resolves (or deterministically skips when no valid empty slots) before next enemy turn presentation
- Ensure enemy turns do not render with transient incomplete board state caused by pending refill.

## Phase 3
- Deterministic validation required:
  - Player uses gems on hero turn.
  - Refill resolves before next enemy turn begins.
  - No delayed refill fires after enemy turn end for that same hero action.
  - No incomplete gemboard appears during enemy turns due to pending refill.
- Capture artifacts:
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task007/refill-turn-trace.json`
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task007/refill-sequencing-assertions.json`
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task007/layout1-refill-check.png`

## Verifiable Success Criteria
- Refill occurs at hero turn end immediately after player gem action.
- Refill never leaks into next enemy-turn end for the same action cycle.
- Enemy turns do not show incomplete gemboard state due to pending refill.
- Behavior is deterministic across repeated runs.
