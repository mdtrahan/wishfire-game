# TASK-004 Execution Plan

## Objective
Define and validate deterministic suspend/resume turn-state behavior across layout transitions while tick timers are active.

## Scope Boundaries
- In scope (only):
  - Turn-state authority definition used as the single validation source.
  - Snapshot schema definition (required payload fields and invariants).
  - Deterministic checkpoint definitions at pre-suspend, snapshot emit, and post-resume.
  - Instrumentation required to emit deterministic validation outcomes.
- Unauthorized code-edit disposition for this task:
  - KEEP current contents of `Scripts/functionBank.js`, `Scripts/state.js`, and `web-runner/app.js` unchanged within TASK-004 execution.
  - Revert discussion is deferred outside TASK-004 to avoid scope expansion (Lead sync: 2026-02-19).
- Explicit exclusions:
  - no transition contract enforcement
  - no layout registration policy changes
  - no atomic transition queue refactors
  - no remediation scope changes

## Phase 1
- Establish one authoritative turn-state contract for validation.
- Define snapshot schema fields required for resume integrity checks.
- Define explicit checkpoint predicates and deterministic failure IDs.

## Phase 2
- Implement instrumentation at suspend/resume boundaries only.
- Ensure post-resume checkpoint validation completes before next turn advancement.
- Emit deterministic outcomes through existing observability paths.

## Phase 3
- Validate deterministic checkpoint output for:
  - Normal suspend/resume pass path.
  - Invariant violation classification path.
  - Tick continuity with no turn-order corruption after resume.

## Execution Packet (Current Dispatch)
- Packet Step 1:
  - Implement Phase 2 boundary instrumentation at suspend/resume checkpoints with pre-turn-advance validation ordering.
- Packet Step 2:
  - Emit deterministic pass/fail outputs via existing observability paths without modifying transition contracts, layout policy, or queue architecture.
- Packet Step 3:
  - Run deterministic validation for pass path + invariant-violation path and capture artifacts for Lead closure review.

## Verifiable Success Criteria
- Turn-state authority and snapshot schema are explicitly defined and used by validation.
- Deterministic checkpoint instrumentation reports repeatable pass/fail outcomes.
- Turn order and current actor remain consistent after resume.
- Pointer and tick loop continuity remains active across transitions.
- No changes made outside TASK-004 boundaries.
