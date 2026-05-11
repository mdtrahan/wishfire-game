# Skill Proc QA Guide

Use this guide when adding or testing combat-session skills that roll a chance-based effect.

## Core Rule

A proc is not activation.

Activation equips or enables a session skill. It must not increment proc counters, heal, damage, buff, or otherwise execute the skill payload unless the skill definition explicitly says activation has an immediate effect.

For attack-triggered skills, the roll must happen only after the combat event that owns the trigger occurs. For Destiny, that means a hero must hit an enemy for positive applied damage before the skill can check or proc.

## Required QA Shape

Every proc skill should expose a small debug surface with at least:

- `Checks`: eligible roll attempts only
- `Procs`: successful rolls only
- `Misses`: eligible failed rolls only
- `Heals` / `Damage` / other payload-specific result counter when useful
- `Last`: the latest proc-state reason

Do not count locked, inactive, missing, activation-only, no-damage, or wrong-target cases as `Checks`.

## Browser Verification

Use Browser / live game QA as the final proof for proc behavior.

Recommended flow:

1. Reload to a fresh game.
2. Enter combat.
3. Activate the skill through the dev panel or draught modal.
4. Confirm side-panel counters remain zero immediately after activation.
5. Use AutoPlay when hand-clicking valid combat moves is ambiguous.
6. Sample the side panel over time until checks, misses, or procs appear.
7. Record the final side-panel line in the QA note.

For low-rate skills, no proc after a few checks is not a failure. The important early proof is that `Checks` stays at zero before any valid trigger, then increases only as valid combat events occur.

## Console Instrumentation

When a proc path is under active QA, add temporary or retained debug logs at the owner seams:

- activation seam
- combat-event hook seam
- roll-resolution seam

Use a stable prefix such as `[DESTINY_QA]` and include:

- event name
- source actor UID
- target actor UID
- applied damage or other trigger value
- current checks/procs/misses/heals
- roll chance
- roll value
- reason

This prevents false conclusions from visual-only testing. If the side panel does not change, the console should show whether the trigger never fired, the event was rejected, or the roll missed.

## Destiny Baseline

Destiny is the first reference implementation for this pattern.

Expected activation state:

- `Checks:0`
- `Procs:0`
- `Heals:0`
- `Misses:0`
- `Last:activated`

Expected AutoPlay proof after real combat actions:

- `Checks` increases only after hero-on-enemy hit events.
- `Misses` increase on failed eligible rolls.
- `Procs` increases on successful rolls.
- `Heals` increases only when a successful proc restores HP.

The heal visual presentation is still a polish item. Counter correctness and trigger ownership are the current behavioral acceptance proof.

## Common Failure Modes

- Dev trigger forces the proc instead of only activating the skill.
- Activation log text is mistaken for payload execution.
- `Checks` increments before eligibility is known.
- Tests call the proc helper directly and pass while the browser combat path never reaches the hook.
- Manual gem clicks do not actually produce a player attack, especially when target selection, pending skills, supergems, or board-state timing are involved.
- Supergem behavior can introduce unrelated ambiguity; do not use a buggy supergem route as proc proof.

## Implementation Notes

Keep feature payload logic in the runtime owner files, not in `app.js`.

For mirrored runtime rules, update both:

- `web-runner/modules/functionBank.js`
- `Scripts/functionBank.js`

Keep `app.js` limited to orchestration and dev-panel calls.
