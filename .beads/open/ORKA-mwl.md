id: ORKA-mwl
title: [FEAT] Extra-turn chance harness (not deterministic from speed alone)
priority: P0
status: done

## Objective
Replace deterministic back-to-back turns from raw speed advantage with an explicit extra-turn chance harness that can be used by hero skills or future mechanics.

## Scope
- Remove or fence any runtime path where speed alone creates unintended repeated hero turns.
- Define the extra-turn harness as an explicit mechanic seam, not an implicit scheduler side effect.
- Keep current turn-order scheduling stable unless an explicit extra-turn chance triggers.

## Owner Seam
- Primary: initiative / turn-order scheduling
- Expected files:
  - `web-runner/src/core/initiativeGuards.mjs`
  - mirrored turn-order owner seams in `web-runner/modules/functionBank.js` and `Scripts/functionBank.js`

## Non-Goals
- No hero-specific balance tuning yet.
- No UI for showing extra-turn chance yet.
- No new trait/class design in this bead.
- No deterministic speed-to-repeat-turn conversion.

## Acceptance
- Speed alone does not grant back-to-back turns.
- The codebase has an explicit extra-turn chance/provenance harness for future skill-driven use.
- Scheduler/queue sanitation still prevents accidental duplicate hero turns.
- Existing non-extra turn order remains stable when no explicit extra-turn trigger is present.

## Testing
- Add deterministic contract coverage for:
  - no repeated hero turns from speed alone
  - explicit extra-turn provenance is required for repeated turns
  - queue sanitation preserves legitimate explicit extra-turn entries while removing accidental duplicates

## Validation
- `npm test -- tests/extraTurnHarnessContract.test.js tests/functionBankParityContract.test.js tests/traitHookFrameworkContract.test.js` (6/6 pass)
- Live runtime/browser proof on `http://127.0.0.1:8095/web-runner/index.html`
  - `200` no-config calls to `TryGrantSpeedExtraTurn(Falie)` -> `0` grants
  - `200` live Falie runs at `5%` -> `6` grants
  - removed Falie skill, moved the same `5%` harness to Huun, `200` live Huun runs -> `3` grants
  - larger calibration run: `1000` live Falie runs -> `49` grants, `1000` live Huun runs -> `48` grants
  - conclusion: no speed-only repeats, harness is movable between heroes, and the long-run proc rate centers on `5%`

## Notes
- This is a behavior-model change from “bug fix only” to “explicit mechanic harness.”
- The harness should be generic enough for future hero skills, not locked to one hero.
