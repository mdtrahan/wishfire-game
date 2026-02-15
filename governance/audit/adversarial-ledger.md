
## ID: ADV-2026-001
Status: OPEN
Severity: Critical
Subsystem: LayoutState stability / Combat initialization
Root Cause Theme: Harness initialization exits before runtime loop and input bindings are installed, making combat-layout integration scenario non-executable.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1129
- function: main
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1212
- function: main
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:3985
- function: pointerdown handler registration
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:4450
- function: tick
Risk: Harness-mode sessions cannot execute the intended click-driven combat transition flow end-to-end; milestone validation can pass by assumption while runtime path is inactive.
Reproduction Logic: Launch with `?harness=true`; control enters harness branch in `main`, activates `storyMock`, returns at line 1212 before pointer handler registration and `tick()` start, preventing live interaction progression.
Linked Milestone Criteria: Unspecified/blocked (source file `/Users/Mace/Wishfire/Codex-Orka/governance/planning/milestone-definition.md` is empty).
First Logged: 2026-02-15
Last Reviewed: 2026-02-15

## ID: ADV-2026-002
Status: OPEN
Severity: High
Subsystem: State transition correctness / LayoutState stability
Root Cause Theme: AstralFlow transition path targets an unregistered/forbidden layout in normal combat config, creating deterministic no-op/failure behavior for a nav-critical action.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1486
- function: nav:clicked event handler
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1408
- function: registerCoreLayouts (combat allowedTransitions)
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:164
- function: createHarnessLayoutState.requestLayoutChange
Risk: In combat, clicking Astral Flow routes into a transition target that is not present/allowed in the normal layout registration path, producing deterministic transition rejection and user-facing state inconsistency.
Reproduction Logic: Start normal mode (no harness query), enter combat, click nav `AstralFlow`; handler calls `requestLayoutChange('astralOverlay')`, but combat allowedTransitions excludes `astralOverlay` and no normal registration for that layout exists in this path.
Linked Milestone Criteria: Unspecified/blocked (source file `/Users/Mace/Wishfire/Codex-Orka/governance/planning/milestone-definition.md` is empty).
First Logged: 2026-02-15
Last Reviewed: 2026-02-15

## ID: ADV-2026-003
Status: OPEN
Severity: High
Subsystem: Turn order integrity / State transition correctness
Root Cause Theme: Suspend/resume snapshot persists a different turn-order model than the active combat authority, risking post-resume drift in actor sequencing.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/src/core/combatRuntimeGateway.js:80
- function: takeSnapshot
- file: /Users/Mace/Wishfire/Codex-Orka/src/core/combatRuntimeGateway.js:108
- function: resume
- file: /Users/Mace/Wishfire/Codex-Orka/Scripts/functionBank.js:1727
- function: BuildRoundGroups
- file: /Users/Mace/Wishfire/Codex-Orka/Scripts/functionBank.js:682
- function: GetCurrentTurn
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:4457
- function: window.render_game_to_text
Risk: Layout suspension/restoration may restore `combatState.turnQueue/currentActorIndex` while authoritative turn flow runs off `state.globals.TurnOrderArray/CurrentTurnIndex`, producing mismatched current actor or turn preview after resume.
Reproduction Logic: Build round order via `StartRound` (writes `TurnOrderArray`), trigger suspend/resume boundary; gateway snapshot only serializes `combatState` queue/index fields, not global round/order structures used by `GetCurrentTurn` and HUD/debug turn output.
Linked Milestone Criteria: Unspecified/blocked (source file `/Users/Mace/Wishfire/Codex-Orka/governance/planning/milestone-definition.md` is empty).
First Logged: 2026-02-15
Last Reviewed: 2026-02-15

## ID: ADV-2026-004
Status: OPEN
Severity: Medium
Subsystem: Combat initialization / Gem resolution determinism / Enemy wave behavior
Root Cause Theme: Core combat bootstrap uses unseeded randomness in enemy selection, battle start mode, and gem generation, preventing deterministic milestone validation.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:431
- function: initEntities
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:448
- function: initEntities
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:532
- function: randomGemFrame
- file: /Users/Mace/Wishfire/Codex-Orka/Scripts/functionBank.js:1687
- function: BuildRoundGroups
Risk: Repeated runs from identical inputs can yield different enemy composition, opener mode (`ambush` vs `initiative`), initial gem states, and initiative ordering; this undermines reproducibility of integration checkpoints.
Reproduction Logic: Restart combat multiple times without code changes and compare initial enemy picks, start-mode text, opening turn structure, and first gemboard composition; values vary due to `Math.random()` use at bootstrap-critical points.
Linked Milestone Criteria: Unspecified/blocked (source file `/Users/Mace/Wishfire/Codex-Orka/governance/planning/milestone-definition.md` is empty).
First Logged: 2026-02-15
Last Reviewed: 2026-02-15
