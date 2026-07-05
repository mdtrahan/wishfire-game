# Combat Initiative Paths

This document labels current initiative paths so future work can tell product intent, live runtime behavior, compatibility code, shadow owners, experiments, and fixtures apart. It does not authorize changing initiative behavior.

## Current Product Contract

`governance/planning/turn-state-invariants.md` records the intended product contract: normal combat should use speed-based interleaved initiative, and team size should not force strict `Heroes -> Enemies -> Heroes` blocks.

That product contract remains the target, but current implementation work must also account for the live runtime status below.

## Current Live Browser Runtime Path

`web-runner/modules/functionBank.js` and its `Scripts/functionBank.js` mirror currently define `isTimeInitiative(ctx)` as a hard `return false`.

Operational consequence:

- `BuildTurnOrder` falls through to `BuildRoundGroups`.
- `GetCurrentTurn`, `GetCurrentType`, `ProcessCurrentTurn`, `AdvanceTurn`, and `ProcessTurn` use the round/group path unless another bead changes the guard.
- Round/group projection still reads effective `SPD` through `GetEffectiveStat`, but the path is not the full time-initiative scheduler.
- This is current implementation reality, not a product decision to reintroduce strict team phases.

Do not flip this guard as cleanup. Authority changes belong to a separate initiative implementation bead.

## Dormant Time-Initiative Branch

The runtime mirrors contain a time-initiative branch behind `isTimeInitiative(ctx)`, including:

- `getInitiativeRoster`
- `syncInitiativeSessionState`
- `refreshInitiativePreview`
- `selectNextInitiativeActor`
- `AdvanceTurn` time-mode handling
- `ProcessCurrentTurn` time-mode phase assignment

This branch is useful for understanding intended future/runtime direction, but it is not the live browser branch while `isTimeInitiative(ctx)` returns false.

## Shared Scheduler Rules

`src/core/schedulerRules.mjs` and `web-runner/src/core/schedulerRules.mjs` own shared deterministic scheduler helpers such as:

- `compareSchedulerSlots`
- `buildFixedCycleSlots`
- `isAbleToActSlot`
- `buildTeamPhaseSlots`

These helpers are real contracts and tests should keep them deterministic. They do not prove that the browser runtime is currently using time initiative.

## Shadow And SimulationCore Ownership

SimulationCore and shadow adapters own deterministic projections for selected rule families. For initiative-adjacent behavior, important surfaces include:

- turn-order group projection
- turn phase assignment
- turn actor eligibility
- effective stat projection
- repeat/queue guard helpers

JavaScript may coordinate browser state and presentation, but Rust-owned outcomes should not be recomputed in new JavaScript paths once a rule family is owned.

## Experiment And Follow-Up Lanes

Active related lanes must be checked before initiative behavior changes:

| Bead | Role |
| --- | --- |
| `ORKA-9c7u` | Dynamic-speed turn-system checkpoint. |
| `ORKA-sdi7` | Dynamic-initiative runtime shadow adapter. |
| `ORKA-n765` | Dynamic-initiative live authority experiment. |
| `ORKA-k34f` | Human gameplay validation for dynamic initiative. |
| `ORKA-w4ct` | Default-speed-based initiative follow-up, currently blocked by `ORKA-n765`. |

If those lanes disagree with this document, inspect live Beads state and the active worktrees before editing.

## Test Fixture Paths

| Test/file | What it proves | What it does not prove |
| --- | --- | --- |
| `tests/speedInitiativeSchedulerContract.test.js` | Shared speed scheduler helpers sort and anchor correctly; docs match current live path labeling. | Browser runtime has not necessarily flipped to time initiative. |
| `tests/turnOrderGroupFixtureContract.test.js` | JS/Rust turn-order group projection fixtures match. | Full time-initiative authority is live. |
| `tests/turnSchedulerRepeatGuardContract.test.js` | Repeat guard behavior for time-mode queue shapes. | Time mode is enabled in browser runtime. |
| `tests/effectiveStatOwnershipContract.test.js` | Effective stat projection ownership and parity. | Initiative path selection. |

## Stop Conditions

Stop before implementation if:

- a change would flip `isTimeInitiative(ctx)` or `InitiativeMode` authority;
- a test update changes product intent instead of documenting current/live path status;
- an active dynamic-initiative worktree owns the same runtime surface;
- runtime code would be changed without an explicit implementation bead and focused validation plan.
