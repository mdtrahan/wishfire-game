id: ORKA-qr88
title: [DEVTOOL] Hero/enemy duplicate slot loadouts apply again
priority: P1
status: done

## Objective
Restore dev-panel hero/enemy slot editing so duplicate heroes and enemies can be set again and the selected loadout actually applies to the current combat or idle session.

## Scope
- Keep duplicate hero slots valid.
- Keep duplicate enemy slots valid.
- Apply loadout edits through a sensible session rebuild for the active layout instead of leaving them as inert staged values.
- Ensure idle combat respects dev-tool hero/enemy slot overrides instead of hardcoded layout defaults.

## Non-Goals
- No turn advancement from the dev panel.
- No unrelated combat reset when the user changes non-loadout controls.
- No manual gameplay changes.

## Acceptance
- QA can set duplicate heroes in the same group from the dev panel.
- QA can set duplicate enemies in the same group from the dev panel.
- Applying slot changes actually updates the active combat or idle layout.
- Idle layout no longer ignores dev-tool loadout overrides.

## Testing
- Deterministic contract coverage for dev-tool loadout application and idle layout override seams.

## Validation
- `npm test -- tests/devToolingModalContract.test.js tests/devToolingLoadoutContract.test.js tests/idleAutoplaySelectionBypassContract.test.js tests/idleAutoplayPriorityGemContract.test.js tests/idleFarmLayoutScaffoldContract.test.js` (10/10 pass)
- `applyDevToolingConfig(...)` now treats hero/enemy slot edits as sensible session-affecting changes: combat refreshes through the existing dev-tool refresh seam, idle layout restarts its session, and idle farm config now consumes dev-tool hero/enemy overrides including duplicates.
