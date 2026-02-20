# TASK-011 Execution Plan

## Objective
Eliminate non-destructive refill assignment failures where gems refill then immediately swap/toggle state, and ensure refill sequencing remains deterministic without leaking into enemy turns.

## Scope Boundaries
- In scope (only):
  - Refill writes only to validated empty slots.
  - One slot assignment per refill step (no bulk overwrite side effects).
  - Remove non-yellow refill frame toggling/animation-like swap behavior.
  - Preserve yellow match unique animation exception only.
  - Validate startup/Layout1/refill windows for immediate post-fill swap defects.
- Explicit exclusions:
  - no unrelated gameplay logic changes
  - no transition-flow edits
  - no UI redesign outside refill safety scope

## Phase 1
- Identify refill assignment points where occupied slots can be mutated or post-fill swaps can occur.
- Apply minimal guardrails to enforce empty-slot-only writes and single-step slot assignment.

## Phase 2
- Remove/tighten refill path behavior that causes immediate unsolicited second write/swap after fill.
- Ensure yellow match animation exception is isolated to yellow-specific path and not reused by normal refill.

## Phase 3
- Deterministic validation required:
  - first stable Layout 1 frame after load
  - first refill-assignment frame
  - immediate post-refill frame(s)
  - no occupied-slot overwrite
  - no immediate post-fill swap/toggle
  - no refill leak into next enemy turn for same hero action cycle
- Required artifacts:
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011/refill-slot-integrity-trace.json`
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011/refill-assertions.json`
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011/frame-0-layout1.png`
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011/frame-1-refill-start.png`
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task011/frame-2-refill-post.png`

## Verifiable Success Criteria
- Refill mutates only validated empty slots.
- Each refill assignment step performs one stable slot write with no immediate unsolicited swap.
- Non-yellow refill paths show no animation/toggle side effects.
- Enemy turns do not begin with pending refill from prior hero action cycle.
- Behavior is deterministic across repeated runs.

## Lead Closure Gate (2026-02-20)
- Verdict: PASS
- Basis:
  - MVP manual deterministic QA PASS has been declared for TASK-011 behavior.
  - Required artifact set is present under `/Users/Mace/Wishfire/Codex-Orka/test-results/task011/`.
  - No new BLOCKER/CRITICAL evidence was logged against TASK-011 since the prior PARTIAL PASS gate.
- Closure note:
  - Under MVP Closure Anti-Loop Rule, closure is issued at this sync.
