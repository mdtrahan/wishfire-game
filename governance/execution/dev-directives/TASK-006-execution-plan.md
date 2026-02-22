# TASK-006 Execution Plan (Staging)

## Objective
Stage deterministic transition validation for the required flow `0 -> 1 -> 2 -> 1`, including suspend/resume assertions at layout boundaries.

## Scope Boundaries (Staging Only)
- In scope:
  - Define deterministic validation matrix for `0 -> 1 -> 2 -> 1`.
  - Define suspend/resume assertion points and expected state invariants.
  - Define artifact contract (screenshots/traces/json) needed for future PASS review.
- Out of scope:
  - No gameplay logic changes.
  - No layout registration or transition-contract edits during staging.
  - No sprint-board edits (PM authority).

## Staging Phases
### Phase 1: Scenario Matrix
- Enumerate exact transition steps and entry/exit conditions for each hop.
- Define deterministic preconditions for repeatable runs.

#### Deterministic Preconditions
- Initial URL: `http://127.0.0.1:8000/web-runner/index.html`
- Fresh session (new browser profile/session name).
- Start at Layout `0` entry view (Story Mock screen).
- No overlays open.
- No active gem selection.
- No pending target selection (`PendingSkillID` unset/empty).

#### Transition Scenario Matrix (`0 -> 1 -> 2 -> 1`)
1. `STEP-0-1`:
   - From: Layout `0`
   - Action: click Story Mock takeover target
   - To: Layout `1`
   - Entry condition: `activeLayoutId === "0"` and controller idle
   - Exit condition: `activeLayoutId === "1"` and transition complete
2. `STEP-1-2`:
   - From: Layout `1`
   - Action: click `Astral Flow` nav action
   - To: Layout `2`
   - Entry condition: `activeLayoutId === "1"` and no disallowed selection lock
   - Exit condition: `activeLayoutId === "2"` and transition complete
3. `STEP-2-1`:
   - From: Layout `2`
   - Action: click return/back action
   - To: Layout `1`
   - Entry condition: `activeLayoutId === "2"`
   - Exit condition: `activeLayoutId === "1"` and transition complete

### Phase 2: Assertion Contract
- Specify suspend/resume checkpoints across the transition chain.
- Specify expected invariants for active layout id, transition completion, and turn-state continuity.

#### Checkpoint Assertions
1. `CHK-0-PRE`:
   - `activeLayoutId === "0"`
   - `isTransitioning === false`
2. `CHK-1-POST-ENTER` (after `STEP-0-1`):
   - `activeLayoutId === "1"`
   - `isTransitioning === false`
   - combat container visible
3. `CHK-1-2-SUSPEND` (boundary during `STEP-1-2`):
   - prior layout suspend hook emitted once
   - input routing switched to transition guard
4. `CHK-2-POST-ENTER`:
   - `activeLayoutId === "2"`
   - `isTransitioning === false`
   - Layout 1 interaction surface not active
5. `CHK-2-1-RESUME` (boundary during `STEP-2-1`):
   - Layout 2 exit hook emitted once
   - Layout 1 resume/enter hooks emitted in expected order
6. `CHK-1-FINAL`:
   - `activeLayoutId === "1"`
   - `isTransitioning === false`
   - combat turn continuity preserved (no reset/corruption side effects)

#### Invariants (All Steps)
- Only one active layout at any time.
- No nested transition start while `isTransitioning === true`.
- Transition start/end events are pairwise balanced.
- No unexpected mutation of combat turn owner/index during non-combat layout active window.

### Phase 3: Artifact Contract
- Define required artifact paths for execution:
  - transition trace json
  - checkpoint assertion json
  - layout screenshots for each hop

#### Required Artifact Paths (Execution Packet)
- Transition trace:
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task006/transition-trace.json`
- Assertion report:
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task006/assertions.json`
- Screenshots:
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task006/step-0-layout0.png`
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task006/step-1-layout1.png`
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task006/step-2-layout2.png`
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task006/step-3-layout1-return.png`

#### Minimum Trace Fields
- `timestamp`
- `stepId`
- `fromLayout`
- `toLayout`
- `activeLayoutId`
- `isTransitioning`
- `hookEvents` (ordered list)
- `turnStateSnapshot` (`currentTurnUID`, `currentTurnType`, `turnPhase`)

## Verifiable Staging Exit
- TASK-006 execution packet can be issued from ACTIVE without ambiguity.
- Deterministic assertions and artifact outputs are defined clearly enough for Dev implementation without scope expansion.
