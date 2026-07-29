# ORKA-eht Manual Selector Drift Audit

Audit date: 2026-07-28

Disposition: confirmed inherited bug; implementation planned but not started

Audit bases: `main` at `29c8b397238a539c5403cdcf10622a6e4ef21a10`; ORKA-vb7 at `e7a3e82cc1ef7ea80dc46113d41c38b744eb4383`

## Verdict

The selector bug is native to current `main`, not caused by the left-wise/right-wise combat work.

The smallest explanation is: the UI and the attack executor choose their no-click default target separately. The UI highlights the first living enemy. The executor uses runtime randomness. If randomness chooses another enemy, the attack contradicts the visible selector.

## Multipass Results

| Base | Input | Visible selector | Queued/damaged target | Result |
| --- | --- | --- | --- | --- |
| ORKA-vb7 right-wise | explicit top click | top | top | aligned |
| ORKA-vb7 right-wise | explicit middle click | middle | middle | aligned |
| ORKA-vb7 right-wise | explicit bottom click | bottom | bottom | aligned |
| `main` left-wise | explicit top click | top | top | aligned |
| `main` left-wise | explicit middle click | middle | middle | aligned |
| `main` left-wise | explicit bottom click | bottom | bottom | aligned |
| ORKA-vb7 right-wise | no explicit click | Gobloc UID 6 | Orc UID 7 | drift |
| `main` left-wise, RNG forced to `0.99` | no explicit click | Gobloc UID 6 | Skeleton UID 8 | drift |

On the ORKA-vb7 explicit Orc pass, the click produced `SelectedEnemyUID = 7`, `SelectedEnemyUIDOwner = 2`, and `PendingActor = 2`. ATTACK queued three hits against UID 7 for 7, 6, and 6 damage; Orc HP changed from 60 to 41 and every combat-log line named Orc. This confirms hit testing and owner stamping are correct after orientation projection.

## Code-Path Evidence

1. Manual target execution in both `web-runner/modules/functionBank.js` and `Scripts/functionBank.js` accepts `SelectedEnemyUID` only when `PendingSkillID` is `HERO_SINGLE`, `PendingActor` matches the acting hero, and `SelectedEnemyUIDOwner` matches that hero. Otherwise it calls `randomPick(ctx, enemies)`.
2. The renderer in `web-runner/systems/renderRuntime.js` prefers an owner-matched selected UID, then a queued hit UID. When neither exists, it renders `aliveEnemies.slice(0, 1)`.
3. Explicit pointer selection stamps both `SelectedEnemyUID` and `SelectedEnemyUIDOwner`, so the renderer and executor share the same target after a click.
4. ORKA-vb7 uses the same orientation-aware projection for enemy rendering and pointer hit testing. Its explicit top/middle/bottom results eliminate mirrored hit geometry as the source of drift.

## Inheritance Evidence

- The same no-click drift reproduces on `main` without the orientation changes.
- ORKA-vb7 explicit clicks align across all tested slots; only the pre-existing fallback split drifts.
- ORKA-d1k previously restored owner-scoped target guards and was merged into the audited `main` base. ORKA-eht is discovered from ORKA-d1k because the remaining bug is narrower: renderer default selection and unowned execution fallback are not one transaction.
- The registered `bead/ORKA-nnsg-enemy-selector-sync` worktree has no corresponding live Bead and predates the current main repair. It is evidence only, not an implementation source.

## Evaluator Blind Spot

`npm run eval:target-selector-sync` passes despite the live defect. In `tools/eval_target_selector_sync.mjs`, the pass labeled `no selected target, queued fallback kept` can produce visual UID 203 and queued UID 201. The evaluator derives the expected queued UID from starting `selectedUID = 0`, then skips the queued comparison when that expected value is falsy. It therefore records no queued drift.

The repaired evaluator must compare the displayed selector UID directly with the primary queued target UID for manual pending attacks, including a zero starting selection.

## Confirmed Versus Unknown

Confirmed:

- Explicit click targeting is correct on both audited bases.
- The no-click mismatch is reproducible on both audited bases.
- The orientation branch did not introduce the mismatch.
- The existing evaluator does not detect this exact case.

Not yet confirmed because implementation is intentionally deferred:

- The narrowest safe owner for assigning the default UID.
- Whether target arming requires any `web-runner/app.js` change.
- Full-suite and live-browser behavior after the future repair.

## Stored Follow-Up

Bead `ORKA-eht` owns the repair. Its goal document defines scope, non-goals, validation, and rollback. No runtime files were changed during this audit checkpoint.
