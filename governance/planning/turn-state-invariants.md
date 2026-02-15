# Turn-State Invariants (Pre-Execution Spec for TASK-004)

Scope: deterministic turn-state and suspend/resume validation only.
Out of scope: transition contract enforcement, layout registration policy changes, atomic transition queue refactors.

## Canonical Data Model

- `TurnState` (authoritative source of truth):
  - `version` (integer, monotonic per committed state change)
  - `queue` (ordered array of unique actor IDs)
  - `currentActorIndex` (integer)
  - `round` (integer, >= 1)
  - `epoch` (integer, increments on full queue rebuild)
  - `lastMutationTick` (integer, tick number at last committed mutation)

- `SuspendSnapshot`:
  - `snapshotVersion` (integer)
  - `capturedAtTick` (integer)
  - `turnState` (full structural copy of authoritative `TurnState`)
  - `resumeToken` (string, non-empty, unique per snapshot)

## Invariant Set

### I-001 Single Authoritative Queue Structure
Rule:
- Exactly one authoritative queue exists at runtime: `TurnState.queue`.
- Any secondary queue representation must equal `TurnState.queue` byte-for-byte if present.

Machine-verifiable checks:
- `Array.isArray(TurnState.queue) == true`
- `new Set(TurnState.queue).size == TurnState.queue.length`
- `TurnState.queue.length >= 1`
- `TurnState.queue.every(id => typeof id === 'string' && id.length > 0)`

Failure condition:
- Multiple divergent queue sources or non-unique/invalid actor IDs.

### I-002 Current Actor Index Constraints
Rule:
- `TurnState.currentActorIndex` always points to a valid entry in `TurnState.queue`.

Machine-verifiable checks:
- `Number.isInteger(TurnState.currentActorIndex) == true`
- `TurnState.currentActorIndex >= 0`
- `TurnState.currentActorIndex < TurnState.queue.length`

Failure condition:
- Negative, fractional, or out-of-bounds current index.

### I-003 Valid State Before Suspend
Rule:
- Suspend is permitted only from a committed, non-transient turn state.

Machine-verifiable checks:
- I-001 and I-002 pass.
- `Number.isInteger(TurnState.version) && TurnState.version >= 1`
- `Number.isInteger(TurnState.epoch) && TurnState.epoch >= 0`
- `Number.isInteger(TurnState.lastMutationTick) && TurnState.lastMutationTick >= 0`
- No pending turn mutation flag is active at suspend boundary.

Failure condition:
- Snapshot attempted during partial update or with invalid canonical state.

### I-004 Required State After Resume
Rule:
- Resume must restore `TurnState` exactly from `SuspendSnapshot.turnState` before next actor advance.

Machine-verifiable checks:
- `TurnState.version == SuspendSnapshot.turnState.version`
- `TurnState.epoch == SuspendSnapshot.turnState.epoch`
- `TurnState.round == SuspendSnapshot.turnState.round`
- `TurnState.currentActorIndex == SuspendSnapshot.turnState.currentActorIndex`
- `JSON.stringify(TurnState.queue) == JSON.stringify(SuspendSnapshot.turnState.queue)`
- Resume consumes exactly one valid `resumeToken`.

Failure condition:
- Any structural drift, index mismatch, or token reuse/invalid token.

### I-005 Forbidden Intermediate States
Rule:
- The system must never expose partially-mutated turn state to gameplay or UI observers.

Forbidden states:
- Queue updated without synchronized `currentActorIndex` validation.
- `currentActorIndex` references actor not present in queue.
- `version` increments without corresponding committed queue/index state.
- Empty queue with active combat turn execution.

Machine-verifiable checks:
- Observer-visible state transitions occur only after full invariant pass of I-001 and I-002.

Failure condition:
- Any read path can observe half-applied turn mutation.

### I-006 Tick Timer Interaction Contract
Rule:
- Tick processing may continue during layout transitions, but turn-state mutation commit points remain deterministic and ordered.

Machine-verifiable checks:
- At most one committed turn-state mutation per tick number.
- `TurnState.lastMutationTick` is monotonic non-decreasing.
- Resume apply step is atomic within a single commit boundary before next turn advancement.
- If tick progresses during suspend window, no turn advancement occurs until successful resume restore + invariant validation.

Failure condition:
- Tick-driven advancement races snapshot/resume restore or causes non-deterministic actor progression.

## Deterministic Validation Sequence

1. Pre-suspend gate: enforce I-001, I-002, I-003.
2. Snapshot creation: materialize `SuspendSnapshot` with full `turnState` copy.
3. Resume apply: restore authoritative `TurnState` from snapshot.
4. Post-resume gate: enforce I-001, I-002, I-004, I-005, I-006.
5. Only after all checks pass: allow next actor advancement.

## Acceptance Condition for TASK-004 Spec Stage

- All invariants I-001 through I-006 are represented as explicit pass/fail predicates.
- Any violation yields deterministic failure classification with invariant ID.
- No invariant depends on transition routing policy or layout registration mutation.
