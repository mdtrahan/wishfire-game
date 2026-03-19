id: ORKA-i8n2
title: [REFACTOR] Isolate red cluster burst into explicit Incinerate harness
priority: P1
status: done

## Objective
Remove the default red multi-hit burst from the normal hero single-target attack path and preserve that presentation only behind an explicit harness called `Incinerate`.

## Scope
- Restore the default red gem attack to a single direct strike.
- Keep the old 4-hit clustered burst available only through an explicit `Incinerate` skill harness seam.
- Preserve current Double Attack follow-up behavior while making its second attack easier to read visually.

## Owner Seam
- `web-runner/modules/functionBank.js`
- `Scripts/functionBank.js`
- `tests/heroRedAttackPresentationContract.test.js`

## Non-Goals
- No dev-panel UI for Incinerate yet.
- No green/aoe attack changes.
- No Double Attack proc/chance logic changes.

## Acceptance
- Default red hero attacks land as one strike again.
- The old cluster burst is no longer unconditional in `HeroAttackSingle`.
- The cluster burst remains available behind an explicit `Incinerate` harness seam.

## Testing
- `npm test -- tests/heroRedAttackPresentationContract.test.js tests/extraTurnHarnessContract.test.js tests/functionBankParityContract.test.js tests/doubleAttackRadiatorContract.test.js tests/devToolingModalContract.test.js`

## Validation
- `npm test -- tests/heroRedAttackPresentationContract.test.js tests/extraTurnHarnessContract.test.js tests/functionBankParityContract.test.js tests/doubleAttackRadiatorContract.test.js tests/devToolingModalContract.test.js` (9/9 pass)
- QA PASS: default red hero attacks are single-hit again and Double Attack readability improved as intended.
