# TASK-005 Execution Plan

## Objective
Remove speed buff from the Blue Gem buff system while preserving all non-speed buff behavior and avoiding unrelated runtime changes.

Observed validation failure to clear in this plan:
- Post-transition Layout 1 still shows a 5th buff visual slot (grey backer + shield icon) before any blue-buff trigger.
- New FAIL (Layout 1): blue-trigger path still yields SPD behavior (wings icon + `BUFF SPD=2/20` + turn-order `(+2)`), proving residual SPD execution path remains active.
- Current residual FAIL (Layout 1): buff behavior checks out, but an orphan empty 5th backer placeholder still renders after the four legal buff slots.

## Scope Boundaries
- In scope (only):
  - Remove orphan empty 5th buff backer placeholder from Layout 1 UI output.
  - Keep exactly four legal buff slots/backers (`ATK/DEF/MAG/RES`) and no trailing empty backer.
- Acceptance-validation scope is Layout 1 only.
- Explicit exclusions:
  - no other gameplay logic changes
  - no unrelated visual redesign
  - no transition-flow edits
  - no layout registration or transition-contract edits
  - no TASK-005 failure triage on Layout 0/2

## Phase 1
- Identify the specific Layout 1 render/object path that draws the trailing empty backer.
- Remove that path while preserving the four legal slot backers.

## Phase 2
- Verify four legal buff slots still render correctly with their backers and icons.
- Ensure no post-fourth-slot empty backer remains in Layout 1.

## Phase 3
- Validate deterministic acceptance:
  - Layout 1 renders exactly 4 buff backers and 4 legal buff icons.
  - No trailing empty 5th backer placeholder is visible.
- Required artifacts:
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task005-closeout/layout1-final.png` showing final buff row state (four legal slots only, no empty fifth backer).
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task005-closeout/runtime-trace.json` confirming buff-backer render count is 4.
- Capture validation artifacts for closure review.

## Execution Packet (Current Dispatch)
- Packet Step 1:
  - Remove the orphan 5th backer render/object path on Layout 1.
- Packet Step 2:
  - Preserve the four legal buff slots/backers and ensure no trailing empty placeholder backer is rendered.
- Packet Step 3:
  - Run deterministic Layout 1 validation and record required closeout artifacts.
- Dispatch mode:
  - Execute all three packet steps without interruption; escalate only on scope-boundary or blocker conditions.

## Verifiable Success Criteria
- Layout 1 shows exactly 4 legal buff slots/backers (`ATK/DEF/MAG/RES`) and no trailing empty 5th backer.
- No unrelated gameplay, visual, or transition-flow behavior is modified.

## Lead Closeout Protocol
- Lead reviews required artifacts and issues verdict: PASS / PARTIAL PASS / FAIL.
- PASS handling:
  - Mark TASK-005 complete in execution artifacts.
  - Advance ACTIVE intake to TASK-006 staging packet.
  - PM owns sprint-board completion marking.
