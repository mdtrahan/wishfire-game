id: ORKA-daa4
title: [DEVTOOL] Double Attack immediate follow-up toggle + side panel monitor
priority: P1
status: done

## Objective
Give QA a dev-panel control to turn `Double Attack` on or off for a chosen hero, where the proc creates an immediate free second strike instead of a queued extra turn, and show the live holder/proc count in the side panel.

## Scope
- Add a staged dev-panel control for choosing the Double Attack holder or turning it off.
- Apply/remove the Double Attack harness without refreshing combat, changing turns, or resetting actor state.
- Make Double Attack duplicate a single-target hero attack immediately as a free second strike.
- If the first target dies before the second strike lands, retarget the second strike to another living enemy.
- Surface holder, chance, and proc count in the side panel/radiator.

## Non-Goals
- No balance UI for editing the proc rate.
- No automatic combat restart.
- No extra gem selection.
- No queued extra-turn scheduler behavior for Double Attack.
- No turn advancement or hidden side effects from toggling the harness.

## Acceptance
- QA can set Double Attack to Off/Falie/Huun/Runa/Kojonn from the dev panel.
- Applying the change does not advance turns or refresh combat.
- When Double Attack procs, the hero immediately performs the same single-target attack a second time for free.
- If the first target is already dead before the second strike lands, the free second strike retargets to another living enemy.
- Side panel shows who currently holds Double Attack and the live proc count.
- When off, the harness is absent.

## Testing
- Deterministic contract coverage for dev config, immediate follow-up attack semantics, and side-panel rendering seam.
- Live browser verification that apply toggles the holder without changing current turn and that the second strike is visually observable.

## Validation
- `npm test -- tests/extraTurnHarnessContract.test.js tests/doubleAttackRadiatorContract.test.js tests/devToolingModalContract.test.js tests/functionBankParityContract.test.js` (8/8 pass)
- Dev tooling still stages `Double Attack` as Off/Falie/Huun/Runa/Kojonn without turn mutation.
- The runtime harness now converts `DOUBLE_ATTACK` from a queued extra-turn insert into an immediate free second `HERO_SINGLE` strike with retarget-on-death semantics for the follow-up packet.
- `web-runner/index.html` mounts `gem-counter-output`, so the radiator is visible in the live layout.
