# TASK-019 Implementation Spec: Power Amp Next-Own-Turn Expiry (Authoritative)

## Summary
Implement purple Power Amp as a per-hero, one-turn armed state with strict next-own-turn expiry.

This spec replaces timing-fragile behavior with deterministic per-hero lifecycle logic:
- Purple match arms actor for next own turn only.
- Amp can apply only if actor attacks on that armed turn.
- Armed state expires at end of that armed turn regardless of action chosen.
- Party-wide arming applies the same rule independently per hero.

## Scope
### In scope
- Power Amp lifecycle logic only.
- Per-hero state and turn-end expiry wiring.
- Solo and party-wide arm paths.
- Deterministic validation artifacts.

### Out of scope
- Initiative text lifecycle.
- Story-card/yellow text behavior.
- Combat balance/chance tuning.
- Blue buff behavior.
- Any global "wait until attack" persistence model.

## Target Files
- `/Users/Mace/Wishfire/Codex-Orka/web-runner/modules/functionBank.js` (runtime authority)
- `/Users/Mace/Wishfire/Codex-Orka/Scripts/functionBank.js` (parity mirror)
- Optional trace-only outputs under `/Users/Mace/Wishfire/Codex-Orka/test-results/task019/`

## Required Data Model
Per hero entry in `PowerAmpByUID[heroUID]` must represent:
- `mult` (number)
- `armedForTurn` (boolean) or equivalent lifecycle enum
- `origin` metadata optional (for telemetry only)

Recommended lifecycle enum:
- `pending_next_own_turn`
- `active_this_turn`

No state that implies "persist until attack".

## Authoritative Rules (must implement exactly)
1. Arming
- Purple match on hero H arms H for H's next own turn only.
- Current turn does not benefit from purple.

2. Usage
- On H's armed turn:
  - If attack action: amp applies.
  - If non-attack: no amp benefit.

3. Expiry
- End of H's armed turn always clears H's armed state, regardless of action type.

4. Party-wide
- Each hero gets independent armed state.
- Expiry evaluated per hero at that hero's own turn end.
- A clearing must not clear other heroes' armed states.

5. Stacking
- Re-arming overwrites existing per-hero entry (no duration extension math).

## Implementation Mapping
### 1) Arm path
In purple resolution / power amp activation logic:
- Set `PowerAmpByUID[targetUID] = { mult, state: "pending_next_own_turn" }`
- For party-wide, repeat per living hero independently.

### 2) Turn start path
In hero turn-start handling:
- If hero has `pending_next_own_turn`, transition to `active_this_turn`.

### 3) Damage/attack multiplier path
In attack multiplier lookup:
- Apply multiplier only when hero state is `active_this_turn`.
- Do not clear here (turn-end is sole expiry trigger).

### 4) Turn-end path (expiry authority)
In turn-advance/end-of-turn for current actor:
- If current actor is hero and has any power-amp state (`pending_next_own_turn` or `active_this_turn` for this armed turn semantics), clear it at actor turn end.
- Ensure this executes for attack and non-attack turns.

## Invariants
- No hero can remain armed after finishing their next own turn.
- No hero can consume amp on turn after armed turn.
- Party-wide entries do not leak between heroes.
- No "arm until attack happens".

## Test Scenarios (must pass)
1. Solo attack use
- H matches purple.
- Next H turn attack gets amp.
- End of that turn clears state.

2. Solo non-attack expiry
- H matches purple.
- Next H turn heal/buff/other uses no amp.
- End of that turn clears state.

3. Party-wide staggered turns
- Party-wide arm event.
- Heroes A/B/C/D clear only on each own next turn end.
- No hero remains armed into second own turn.

4. Overwrite behavior
- Re-arm same hero before armed turn ends.
- Latest arm overwrites prior state; still expires at end of next own turn.

5. Leak regression
- Repeated skewed party-wide runs produce zero second-turn retention cases.

## Artifact Contract
Write under `/Users/Mace/Wishfire/Codex-Orka/test-results/task019/`:
- `task019-poweramp-recipient-turn-trace.json`
- `task019-poweramp-next-turn-only-assertions.json`
- `task019-poweramp-partywide-expiry-assertions.json`
- `task019-no-carryover-assertions.json`
- `task019-partywide-skew-trace.json`
- `task019-partywide-leak-stomp-assertions.json`
- `task019-text-print-regression-guard.json`
- `task019-closure-recommendation.json` (`PASS`/`FAIL`)

## Acceptance Criteria
- All rules above are met with deterministic artifact proof.
- No regressions in unrelated text/initiative systems.
- Runtime/source parity preserved between `web-runner/modules/functionBank.js` and `Scripts/functionBank.js`.

## Assumptions / Defaults
- Turn end means the actor's own turn completion point immediately before `AdvanceTurn` resolves next actor.
- Attack action means paths that call hero damage application for single/aoe attacks.
- If action type is ambiguous, default to non-attack (i.e., amp does not apply, but still expires at turn end).
