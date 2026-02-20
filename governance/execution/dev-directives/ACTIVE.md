# ACTIVE Dev Directive

## Current Sprint
Sprint X

## Active TASK-###
- TASK-005
  - Plan: `/Users/Mace/Wishfire/Codex-Orka/governance/execution/dev-directives/TASK-005-execution-plan.md`

## Dev Next Action
- Packet Step 1: Remove the orphan 5th buff-slot backer visual object/path on Layout 1 so only four buff backers remain.
- Packet Step 2: Preserve the four legal buff icons/backers (`ATK/DEF/MAG/RES`) and ensure no empty placeholder backer is rendered after them.
- Packet Step 3: Validate with Layout 1 artifact evidence: exactly four buff backers with matching four buff icons, and no trailing empty backer slot.
- Execution mode: complete Step 1 -> Step 2 -> Step 3 in one uninterrupted packet (no intermediate resync).
- Required closure artifacts:
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task005-closeout/layout1-final.png`
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task005-closeout/runtime-trace.json` (must show buff-backer render count = 4)
- Constraints: no other gameplay logic changes, no unrelated visual redesign, no transition-flow edits.
- Layout containment guard: do not spend validation cycles on Layout 0/2 for this task; acceptance scope is Layout 1 combat container only.

## Lead Verdict Gate (Post-Artifacts)
- Lead must issue: PASS / PARTIAL PASS / FAIL after artifact review.
- If PASS:
  - Mark TASK-005 complete in execution artifacts.
  - Advance intake by updating ACTIVE directive to TASK-006 staging packet.
  - Leave sprint-board completion marking to PM authority.
