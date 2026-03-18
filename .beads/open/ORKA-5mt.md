id: ORKA-5mt
title: [UI] Align idle combat hit flash with runtime black flash
priority: P2
status: done

## Objective
Make idle-combat damage flashes match the approved full-combat black flash presentation.

## Scope
- Update idle-combat hit-flash rendering only.
- Match the black flash look used in full combat.
- Keep idle combat timing, reward cadence, and attack logic unchanged.

## Non-Goals
- No combat formula changes.
- No idle emission/reward changes.
- No full-combat flash retune.

## Acceptance
- Idle combat damage flashes render black, not the old mismatch.
- Idle combat flash behavior visually matches the approved full-combat black flash style.
- No regressions to idle combat loop timing or reward flow.
