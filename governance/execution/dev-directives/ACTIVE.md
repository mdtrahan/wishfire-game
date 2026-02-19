# ACTIVE Dev Directive

## Current Sprint
Sprint X

## Active TASK-###
- TASK-005
  - Plan: `/Users/Mace/Wishfire/Codex-Orka/governance/execution/dev-directives/TASK-005-execution-plan.md`

## Dev Next Action
- Packet Step 1: Build icon-label parity map for Layout 1 buff UI (icon asset/frame -> stat label) and attach evidence so visual identity confusion is eliminated before remediation.
- Packet Step 2: Remove `SPD_UP` blue-buff routing and execution paths in both runtime sources (`Scripts/` and `web-runner/modules/`) so blue buff can only apply `ATK/DEF/MAG/RES` on Layout 1.
- Packet Step 3: Remove remaining SPD buff visual/text outputs tied to blue buffs on Layout 1 (`BUFF SPD=*`, speed-wing icon, turn-order +SPD delta caused by party speed buff); keep four-slot visuals only and revalidate.
- Constraints: no other gameplay logic changes, no unrelated visual redesign, no transition-flow edits.
- Layout containment guard: do not spend validation cycles on Layout 0/2 for this task; acceptance scope is Layout 1 combat container only.
