id: ORKA-ju42
title: [DEVTOOL] Idle mode bypasses manual enemy selection
priority: P1
status: done

## Objective
Keep dev-panel idle mode actually idle by auto-resolving manual enemy selection seams instead of requiring QA clicks.

## Scope
- When dev idle mode is active, pending manual enemy selection should auto-pick a valid target and continue.
- Keep idleFarmLayout safe; no selection bypass should leak into normal player-controlled combat.

## Non-Goals
- No change to normal manual selection in standard gameplay.
- No retuning of hero skills.

## Acceptance
- Dev idle mode no longer stalls on pending enemy selection.
- Normal non-dev gameplay still requires manual enemy selection where designed.

## Testing
- Deterministic idle-mode guard coverage plus live dev idle smoke test.

## Validation
- `npm test -- tests/idleAutoplaySelectionBypassContract.test.js` (1/1 pass)
- Dev idle mode now auto-resolves pending manual target selection through `autoResolvePendingSelectionForDevIdle()` instead of stalling the run.
