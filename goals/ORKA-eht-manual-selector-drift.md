# ORKA-eht Manual Selector Drift Goal

Status: audit and fix plan checkpoint only. Runtime implementation, merge, and push are not authorized by this document.

## Goal

Make manual `HERO_SINGLE` targeting use one authoritative enemy UID from selector display through queued hit, damage, and combat log. Preserve explicit clicks, automatic/unowned random targeting, combat orientation geometry, and all combat rules.

## Confirmed Diagnosis

When no actor-owned `SelectedEnemyUID` exists, the renderer displays the first living enemy while `ExecuteSkill` random-picks a living enemy. The two independently valid fallbacks can disagree. Explicit clicks correctly stamp the selected UID and owner and do not drift.

The defect is inherited from `main` at `29c8b397238a539c5403cdcf10622a6e4ef21a10`; it is not introduced by the ORKA-vb7 orientation checkpoint `e7a3e82cc1ef7ea80dc46113d41c38b744eb4383`.

## Fix Plan

1. When a manual `HERO_SINGLE` action becomes pending, establish the visible default living enemy as `SelectedEnemyUID` and stamp `SelectedEnemyUIDOwner = PendingActor` in one transition.
2. Keep the owner guard in both function-bank mirrors. The executor consumes the owned UID; random fallback remains only for automatic or unowned execution.
3. Make the renderer consume the same owned UID before queueing and the queued primary hit UID after queueing. Do not invent another fallback target.
4. Preserve death/refill handling: clear or replace an invalid owned UID; never retarget a surviving enemy merely because another slot emptied.
5. Repair `tools/eval_target_selector_sync.mjs` so a visible selector UID versus queued primary target UID mismatch fails even when the starting selected UID is zero.
6. Add focused contracts for no-click manual targeting across top, middle, and bottom enemy slots and both combat orientations.

## Expected Runtime Scope

- `web-runner/modules/functionBank.js`
- `Scripts/functionBank.js`
- `web-runner/systems/renderRuntime.js`
- Targeting/evaluator contracts under `tests/` and `tools/eval_target_selector_sync.mjs`
- `web-runner/app.js` only if the target-arming transition cannot be owned at a narrower existing seam

The two function-bank files must remain mirrored. Hot-file ownership must be rechecked before implementation.

## Non-Goals

- Combat orientation geometry, actor positions, facing, hit regions, or animation anchors
- Damage, initiative, skill, randomization, or enemy-refill rule changes
- Keyboard target cycling
- Reusing or merging the stale `bead/ORKA-nnsg-enemy-selector-sync` lane
- Closing or rewriting historical ORKA-d1k records

## Validation Gate

- `npm run eval:target-selector-sync`
- Focused target randomization, selector sync, supergem handoff, supergem app, and combat orientation contracts
- `npm run test:appjs-boundary`
- `npm run test:hot-file-gate`
- Function-bank parity and `git diff --check`
- In-app Browser multipass proof for left-wise and right-wise: no-click default plus explicit top, middle, and bottom targets; compare selector UID, selected owner, queued target, damaged UID, and log target

Implementation is complete only if every layer reports the same manual target and automatic/unowned random targeting remains demonstrably random.

## Rollback

This checkpoint adds documentation only. Reverting its commit removes the audit/plan record without changing runtime behavior. The ORKA-vb7 orientation checkpoint remains the separate rollback point for directional combat presentation.
