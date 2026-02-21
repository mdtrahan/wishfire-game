
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

## ID: ADV-2026-005
Status: OPEN
Severity: UNASSIGNED
Subsystem: Layout transition integrity / Combat bootstrap rendering
Root Cause Theme: Entering combat from Layout 0 can present an uninitialized render state (0 loaded objects), producing malformed/unplayable Layout 1 despite successful transition trigger.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1547
- function: main
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1431
- function: registerCoreLayouts -> combat.onEnter
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1436
- function: registerCoreLayouts -> combat.onEnter
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1810
- function: main
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:4034
- function: pointerdown handler
Risk: Sprint flow `0 -> 1` can land in a partially initialized combat container where required combat assets/UI/nav/debug surfaces are absent, resulting in non-functional gameplay state.
Reproduction Logic: Start game, click viewport to trigger `layout:storyMock:click` and transition to combat; observe HUD text indicating `0 total objects loaded` and missing combat/nav/UI elements in Layout 1.
Linked Milestone Criteria: Pointer + tick loop remain active across transitions; Snapshot/resume integrity verified; Layout transition does not corrupt turn order.
First Logged: 2026-02-15
Last Reviewed: 2026-02-15

## ID: ADV-2026-005
Status: REOPENED
Severity: CRITICAL
Rationale: QA reproduced malformed Layout 1 after `0 -> 1` entry and acceptance flow remains non-conformant. Observable impact includes oversized selector/attack affordances that obstruct combat interaction visibility.
Subsystem: Layout transition integrity / Combat bootstrap rendering
Root Cause Theme: Entering combat from Layout 0 can present malformed Layout 1 presentation/interaction state despite successful transition trigger.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:3650
- function: drawFrame
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:3675
- function: drawFrame
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1737
- function: getAttackButtonBounds
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:3693
- function: drawFrame
Risk: Layout 1 can become visually obstructive and functionally degraded after `0 -> 1`, preventing reliable combat targeting and violating transition-integrity acceptance.
Reproduction Logic: Start game on Layout 0, click to transition to Layout 1, observe oversized selector triangles and attack button obscuring combat field and degrading enemy/action selection.
Linked Milestone Criteria: Layout transition does not corrupt turn order; Pointer + tick loop remain active across transitions.
First Logged: 2026-02-15
Last Reviewed: 2026-02-15

## ID: ADV-2026-006
Status: OPEN
Severity: MAJOR
Rationale: Layout 0 interaction path exists, but required full-screen blue visual contract is absent in normal runtime. This creates a spec-visible mismatch while transition click may still function.
Subsystem: Layout registration correctness / Layout rendering contract
Root Cause Theme: Layout 0 (`storyMock`) is registered without a normal-runtime visual renderer, so the required blue full-viewport click surface is not guaranteed visible.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1492
- function: registerCoreLayouts
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1826
- function: drawHarnessLayoutTakeover
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1835
- function: drawFrame
Risk: Startup can present a non-blue or invisible Layout 0 surface, violating declared startup contract and reducing deterministic operator validation of the `0 -> 1` step.
Reproduction Logic: Launch normal runtime (without harness query), observe initial screen before click; Layout 0 click handling exists, but blue full-screen takeover renderer is gated behind harness-only condition branch.
Linked Milestone Criteria: Pointer + tick loop remain active across transitions.
First Logged: 2026-02-15
Last Reviewed: 2026-02-15

## ID: ADV-2026-007
Status: OPEN
Severity: CRITICAL
Rationale: Required `1 -> 2` pathway is blocked whenever nav click gate conditions fail (`selectedGems`, `selectionLocked`, or `CanPickGems === false`). QA reports inability to reach Layout 2 through Astral Flow.
Subsystem: requestLayoutChange determinism / Transition pathway integrity
Root Cause Theme: Astral Flow transition depends on pre-nav input gate state, causing deterministic pathway denial to Layout 2 during common combat states.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:4097
- function: pointerdown handler
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:4115
- function: pointerdown handler
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1530
- function: nav:clicked handler
Risk: Milestone flow `0 -> 1 -> 2 -> 1` becomes non-reliable because `1 -> 2` cannot be consistently initiated from combat when nav event emission is gated out.
Reproduction Logic: Enter Layout 1 and attempt Astral Flow click while combat is in a state where `CanPickGems === false` or selection flags are active; nav event does not emit, so transition request never executes.
Linked Milestone Criteria: No silent layout-change failures; Transition atomicity preserved.
First Logged: 2026-02-15
Last Reviewed: 2026-02-15

## ID: ADV-2026-008
Status: OPEN
Severity: High
Subsystem: Layout transition integrity / Combat presentation consistency
Root Cause Theme: `0 -> 1` transition can enter a partially composed combat render state where required Layout 1 UI surfaces are missing, leaving sprint-loop validation incomplete.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/test-results/.last-run.json
- function: n/a
- file: /Users/Mace/Wishfire/Codex-Orka/test-results/task003-phase2/shot-0.png
- function: n/a
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1826
- function: rebuildRenderedCache
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:1850
- function: drawFrame
Risk: Task-003 acceptance cannot be verified end-to-end because Layout 1 can render without full combat UI composition, causing transition-flow and interaction criteria to remain non-conformant.
Reproduction Logic: Start runtime at Layout 0, click to enter Layout 1; observe test artifact `shot-0.png` showing incomplete combat composition while `.last-run.json` records failed run, preventing deterministic acceptance of full `0 -> 1 -> 2 -> 1` loop.
Linked Milestone Criteria: No silent layout-change failures; Pointer + tick loop remain active across transitions; Combat state deterministic/resumable across transitions.
First Logged: 2026-02-15
Last Reviewed: 2026-02-15

## ID: ADV-2026-009
Status: OPEN
Severity: CRITICAL
Rationale: Active TASK-003 UI-slice acceptance requires radiators to clear the central combat viewport/offscreen intent. Current runtime draws tracker/intent surfaces inside the combat canvas and obstructs playfield readability.
Subsystem: Layout 1 UI containerization / radiator relocation
Root Cause Theme: Radiator relocation anchors were implemented as in-canvas panels instead of offscreen/side-window isolation, leaving combat-log and intent text intruding into Layout 1 playfield.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:2721
- function: drawFrame (radiatorPanels definition)
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:2735
- function: drawFrame (drawRadiatorPanel on-canvas)
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:3048
- function: drawFrame (CombatAction* rendered at combatAnchor in playfield)
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:3039
- function: drawFrame (ActorIntent forced +120y offset into active field)
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:3067
- function: drawFrame (Text_Gold still rendered in top panel region)
Risk: Layout 1 remains visually contaminated by diagnostic/info windows, causing UI overlap with heroes and reducing interaction clarity; sprint conformance for containerized/offscreen info windows is not met.
Reproduction Logic: Start game, enter Layout 1 combat, observe `What happened?` combat log beneath hero area, ActorIntent/header text not offscreen, and an additional top textbox/panel (`Gold: 0`) occupying viewport.
Linked Milestone Criteria: No silent layout-change failures; Pointer + tick loop remain active across transitions; Combat state deterministic/resumable across transitions.
First Logged: 2026-02-18
Last Reviewed: 2026-02-18

### Evidence Addendum (2026-02-18)
ID: ADV-2026-009
Status: REOPENED
Rationale: QA screenshot confirms intended offscreen windows are not receiving combat-log and turn-order payloads; both radiators remain over the combat viewport and obscure actor space.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:2713
- function: drawFrame (combatAnchor remains in visible playfield)
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:2717
- function: drawFrame (trackAnchor remains in visible playfield)
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:3048
- function: drawFrame (CombatAction* text drawn at combatAnchor)
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:3111
- function: drawFrame (turn-order text drawn at trackAnchor)
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:3067
- function: drawFrame (Text_Gold panel still occupies top viewport band)
Reproduction Logic: Enter Layout 1 and observe combat-log + turn-order text over active board/actors instead of isolated offscreen windows; screenshot evidence shows overlap obscuring play area.
Last Reviewed: 2026-02-18

### Placement Clarification Addendum (2026-02-18)
ID: ADV-2026-009
Status: REOPENED
Severity: CRITICAL
Rationale: QA provided explicit target homes for offscreen relocation; current in-viewport placement still violates the accepted UI containment requirement.
Expected Placement Mapping (deterministic for remediation validation):
- Group A (combat logging): `What happened?` header + `CombatAction/CombatAction1/CombatAction2/CombatAction3` + `ActorIntent` must render in side debug column slot #1 (green-arrow home), fully outside active combat field.
- Group B (turn order): `track_next` + `track_nextplus1..5` must render in side debug column slot #2 (purple-arrow home), fully outside active combat field.
- Constraint: Translation-only UI relocation; no gameplay flow, transition routing, combat math, or state logic mutation.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:2713
- function: drawFrame (combatAnchor currently inside playfield)
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:2717
- function: drawFrame (trackAnchor currently inside playfield)
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:3048
- function: drawFrame (combat log lines drawn at in-field anchor)
- file: /Users/Mace/Wishfire/Codex-Orka/web-runner/app.js:3111
- function: drawFrame (turn-order lines drawn at in-field anchor)
Reproduction Logic: Enter Layout 1; observe both debug textbox groups overlap actor/board region instead of rendering in right-side offscreen debug windows indicated by QA arrows.
Last Reviewed: 2026-02-18

### Resolution Addendum (2026-02-18)
ID: ADV-2026-009
Status: RESOLVED
Rationale: QA confirmed both textbox groups were moved to the designated offscreen side homes and no longer overlap the combat viewport.
Validation Signal:
- Manual deterministic runtime QA: PASS for textbox-group placement containment.
Resolved At: 2026-02-18
Last Reviewed: 2026-02-18

## Closure Sync: TASK-003 (2026-02-18)
Authority: Lead Agent (Review Function)
Scope: ADV-2026-005, ADV-2026-006, ADV-2026-007, ADV-2026-008

### Resolution Entry
ID: ADV-2026-005
Status: RESOLVED
Severity: CRITICAL
Rationale: Deterministic QA and runtime validation artifacts confirm `0 -> 1` no longer enters malformed Layout 1 bootstrap state; combat presentation and interaction are restored.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/test-results/task003-mvp-validation/mvp-validation.json
- function: n/a
- file: /Users/Mace/Wishfire/Codex-Orka/test-results/task003-ui-relocation/validation.json
- function: n/a
- file: /Users/Mace/Wishfire/Codex-Orka/test-results/task003-adv2026-009/validation.json
- function: n/a
Resolved At: 2026-02-18
Last Reviewed: 2026-02-18

### Severity Hygiene Supersession
ID: ADV-2026-005
Canonical Severity: CRITICAL
Hygiene Action: Legacy duplicate block with `Severity: UNASSIGNED` is superseded by this canonical severity/status record for closure governance.
Last Reviewed: 2026-02-18

### Resolution Entry
ID: ADV-2026-007
Status: RESOLVED
Severity: CRITICAL
Rationale: Validation markers show deterministic `1 -> 2` reachability via Astral Flow and successful loop completion with suspend/resume integrity.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/test-results/task003-mvp-validation/mvp-validation.json
- function: n/a
- file: /Users/Mace/Wishfire/Codex-Orka/test-results/task003-ui-relocation/validation.json
- function: n/a
Resolved At: 2026-02-18
Last Reviewed: 2026-02-18

### Resolution Entry
ID: ADV-2026-006
Status: RESOLVED
Severity: MAJOR
Rationale: MVP validation artifact confirms Layout 0 full-screen blue takeover is visible before `0 -> 1`, satisfying the visual registration contract.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/test-results/task003-mvp-validation/mvp-validation.json
- function: n/a
- file: /Users/Mace/Wishfire/Codex-Orka/test-results/task003-mvp-validation/startup-layout0.png
- function: n/a
Resolved At: 2026-02-18
Last Reviewed: 2026-02-18

### Resolution Entry
ID: ADV-2026-008
Status: RESOLVED
Severity: MAJOR
Rationale: Runtime composition integrity is validated on first `0 -> 1` entry with full heroes/enemies/gems and stable loop continuity.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/test-results/task003-mvp-validation/mvp-validation.json
- function: n/a
- file: /Users/Mace/Wishfire/Codex-Orka/test-results/task003-adv2026-009/validation.json
- function: n/a
Resolved At: 2026-02-18
Last Reviewed: 2026-02-18

### TASK-003 Critical Sync Note
ID: ADV-2026-009
Status: RESOLVED
Severity: CRITICAL
Rationale: QA-confirmed relocation and deterministic validation confirm radiator payloads are container-scoped to side windows with no combat-field contamination.
Evidence:
- file: /Users/Mace/Wishfire/Codex-Orka/test-results/task003-adv2026-009/validation.json
- function: n/a
- file: /Users/Mace/Wishfire/Codex-Orka/test-results/qa-radiator-relocate/shot-0.png
- function: n/a
Resolved At: 2026-02-18
Last Reviewed: 2026-02-18
