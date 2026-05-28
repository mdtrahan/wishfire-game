# SimulationCore Rust/JS Contract

## Purpose
Define the first safe boundary for a hybrid Rust/JS migration. Rust becomes the deterministic combat simulation core. JavaScript remains the browser shell, presentation layer, input layer, save/load wrapper, and Netlify deployment surface.

This document is a design contract only. It does not authorize Rust implementation, toolchain changes, adapter code, or ownership flips.

## Baseline
- Initial parity baseline: `main@5364ede23e3160fadb1a6ac9bf940c57bdd15f87`.
- Active WIP lanes `ORKA-crwd` and `ORKA-jecl` are preserved by the rollback package but excluded from initial parity fixtures.
- Those lanes may enter the migration baseline only after they are merged/closed or explicitly promoted by a new Beads decision.

## Ownership Boundary
Rust owns deterministic simulation:
- `GameState`
- turn resolution
- combat formulas
- status effect application, ticking, and expiry
- RNG seed/state logic
- win/loss checks

JavaScript owns browser integration:
- Canvas/Pixi/rendering
- input and targeting UI
- menus and overlays
- audio
- save/load wrapper
- Netlify deployment
- presentation timing and animation playback

Once a rule family is owned by Rust, JavaScript must stop recomputing that rule's outcome. It may only render Rust's returned event log and keep browser-local presentation state.

Rust must not depend on DOM, Canvas, Pixi, audio, storage APIs, Netlify, or browser globals.

## First Adapter Seam
Use `CombatRuntimeGateway` as the first migration seam because it already owns suspend/resume and authoritative turn-state handoff.

The initial adapter should sit between JS browser runtime code and deterministic combat resolution:
- JS gathers a normalized simulation request from current runtime state.
- Rust resolves exactly one deterministic simulation step or turn action.
- JS applies the returned next state and plays the ordered presentation events.

The gateway remains responsible for blocking browser input during atomic transitions.

## Contract Shape
`SimulationCoreRequest`:
- `contractVersion`: integer, starts at `1`
- `baselineId`: `main@5364ede23e3160fadb1a6ac9bf940c57bdd15f87`
- `gameState`: normalized combat state snapshot
- `action`: player, enemy, or system action request
- `rngState`: deterministic seed/state before resolution
- `context`: combat flags needed for resolution, excluding browser/presentation data

`SimulationCoreResponse`:
- `contractVersion`: integer
- `nextGameState`: normalized combat state after resolution
- `events`: ordered presentation event log for JS rendering/audio
- `rngState`: deterministic seed/state after resolution
- `result`: `continue`, `win`, or `loss`
- `diagnostics`: non-authoritative trace data for tests and debug panels

The event log is presentation-facing but not presentation-timed. JS owns timing, easing, sprites, sounds, and UI layout.

## Initial Golden Fixture Set
Start fixtures from current mirrored high-risk JS behavior in:
- `Scripts/functionBank.js`
- `web-runner/modules/functionBank.js`

Initial fixture targets:
- `CalculateDamage`
- `ResolveGemAction`
- `ExecuteEnemyJobSkill`
- `StartEnemyAction`
- `EnemyTurn`
- `HeroTurn`
- `PickEnemySkill`
- `computeCombatPowerFromStats`
- RNG helper behavior around `RuntimeRandom`, `random01`, and `Math.random` fallbacks

Existing parity tests such as `tests/functionBankParityContract.test.js` are evidence sources, not the final migration harness. New parity fixtures should record inputs, seed state, expected state delta, expected event log, and final RNG state.

## Fixture Rules
- Fixtures must be deterministic and seed-driven.
- Fixtures must not depend on animation timing, DOM state, canvas state, or local storage.
- If current JS behavior uses unseeded `Math.random`, first capture the behavior as a known nondeterministic seam, then create a separate implementation bead to route that rule through deterministic RNG.
- A fixture that depends on active WIP from `ORKA-crwd` or `ORKA-jecl` is invalid until that lane is promoted into the baseline.

## Migration Bead Split
Use separate Beads after this design bead:
- Rust toolchain scaffold.
- JS adapter shell behind a feature flag.
- Golden fixture extraction.
- JS-vs-Rust parity harness.
- Damage/formula rule-family ownership flip.
- Turn scheduling rule-family ownership flip.
- Status effect rule-family ownership flip.
- RNG normalization ownership flip.
- Win/loss ownership flip.
- Save/load compatibility wrapper update.

Each ownership flip must pass its parity fixtures before JS stops owning that rule family.

## Stop Conditions
Stop and create a new Beads decision if:
- baseline changes from `main@5364ede23e3160fadb1a6ac9bf940c57bdd15f87`
- `ORKA-crwd` or `ORKA-jecl` behavior is needed before merge/close
- Rust needs browser APIs to resolve a rule
- JS needs to recompute a Rust-owned outcome
- RNG behavior cannot be reproduced from seed/state
- a fixture cannot separate deterministic state changes from presentation effects
