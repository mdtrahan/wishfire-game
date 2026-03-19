id: ORKA-u4h
title: [DEVTOOL] Idle autoplay prioritizes frame-6 energy gems
priority: P1
status: done

## Objective
Make dev idle autoplay take the free frame-6 energy gem before any normal triplet because it grants energy without spending the hero turn, and make the fallback triplet picker follow the approved color priority instead of random color choice.

## Scope
- Detect frame-6 gems during the dev idle autoplay hero window.
- Click that gem before the normal random triplet picker.
- Replace random triplet color choice with the approved idle priority order: PURPLE, HEAL, GREEN/RED equal, YELLOW, BLUE.
- Keep all priority rules inside idle autoplay only.

## Non-Goals
- No change to normal manual gameplay.
- No retuning of frame-6 rewards.
- No change to actual gem effects or turn rules outside idle autoplay.

## Acceptance
- During dev idle autoplay, a frame-6 energy gem is clicked before any normal triplet.
- When no frame-6 gem is available, idle autoplay prefers PURPLE, then HEAL, then GREEN/RED equally, then YELLOW, and BLUE last.
- Manual gameplay selection rules remain unchanged.

## Testing
- Deterministic owner-seam contract coverage for idle autoplay priority order and the existing selection-bypass guard.

## Validation
- `npm test -- tests/idleAutoplaySelectionBypassContract.test.js tests/idleAutoplayPriorityGemContract.test.js` (6/6 pass)
- `runDevAutoplayUntilDepleted()` now checks `findIdleAutoplayPrioritySinglePick()` before `pickIdleAutoplayTriplet()`.
- Idle triplet color priority is now `PURPLE -> HEAL -> GREEN/RED -> YELLOW -> BLUE`, while frame-6 still overrides all of them as the free energy pickup.
- Dev-tool autoplay launch now restores the modal pause snapshot before running idle mode, so forced gem-color setups no longer start from a frozen `CanPickGems=0 / IsPlayerBusy=1` state.
