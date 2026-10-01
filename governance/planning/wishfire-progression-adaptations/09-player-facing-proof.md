# 09 — Player-facing proof contract

**Goal:** Every implemented adaptation has video evidence from the player-facing build before handoff.

## Procedure

Identify checkout, served URL, viewport, save state and tuning values. Open the actual player entry in the in-app browser. For progression timing, start a continuous recording at the first permitted input and stop when all four heroes visibly reach Lv5 and the lamp's Auto control unlocks while OFF. Use normal inputs, with no acceleration, injected EXP or seeded gear in the timed run.

Log successful draws, levels, review pauses and resource conversions with timestamps. Review the video itself. Annotate the reference and delivered frame at equal viewport size, comparing x/y placement and dimensions where a visual specification exists. Repeat a failed seam after correction, then operate the complete flow once.

## Required visual criteria

- Fresh Lv1 party, empty cache and no unattended draw.
- Two EXP rollovers, numeric remainder and a distinguishable lamp tier.
- Skill acquisition and slot behavior only after reference research and a new owner-approved story; no assumed free Unlock action.
- Puff before gear; exact cache count and simultaneous sorted inventory.
- Actual CP floats, stationary portraits and responsive consecutive selections.
- Final modal closure waits for CP completion; no float escapes into combat.
- Dismantle conversion clears arrivals, awards no EXP and shows the essence asset and amount in a three-second banner.
- Auto's gate, player enabling action, shared cooldown and full-cache stop.

- Lamp preview, exact essence deduction, applied rarity/capacity benefits and unchanged hero EXP; an income ledger supports pricing.

## Handoff

Provide the continuous video, event/timing log and acceptance matrix with timestamps. Mark any criterion unverified or failed. Keep UI snapshots and focused deterministic tests as supporting evidence. Label staged rare-state fixtures, exclude them from timing and do not substitute silent tests for the player-facing proof.

## Dependencies and approval

Attach this contract to every approved implementation goal. Exact level costs, gates and timing targets come from that goal's approved spec, rather than being silently changed during recording.
