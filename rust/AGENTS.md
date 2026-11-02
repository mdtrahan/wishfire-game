# Rust DOX

## Purpose
- Own the Rust SimulationCore deterministic simulation source and WASM export boundary.

## Ownership
- `rust/simulation_core/src/lib.rs` owns Rust implementations of deterministic rule families and `extern "C"` shadow exports.
- `rust/simulation_core/tests/` owns Rust-side contract tests.
- `web-runner/assets/simulation_core.wasm` is the generated browser artifact, but the source owner is this Rust crate.

## Local Contracts
- Combat ABI advertises `ack_events_v1`: `ack {world, encounter_id, sequence}` validates the absolute cursor and prunes only its acknowledged prefix. `inspect.events_after` must lie between the acknowledged and last cursors. Sequence generation remains monotonic after pruning; acknowledgement changes no gameplay hash. Retained-event backpressure rejects before stepping and resumes after ack. `died` includes combat reason, team and optional original host spawn identity; teardown emits only despawn/ended facts.
- Combat ABI 1.0 snapshots additionally expose host identities, pose/facing, ward, clocks, full hazard presentation fields, projectiles and camera focus. Actor effect observations include shield, poison, encasement, Elevate and cast state. Read-only hit-stop, spotlight and Phoenix channel/cooldown fields supply presentation clocks and revival observations. These are observations of the existing sim; preserve scalar exports, mechanics and snapshot/event order. Rebuild the shipped artifact and provenance after boundary changes.
- Rust owns deterministic simulation slices named in `governance/planning/simulation-core-rust-final-audit.md`.
- Rust must not depend on DOM, Canvas, audio, storage APIs, Netlify, browser globals, or presentation timing.
- Public shadow export names are part of the JS/WASM contract and are asserted by tests.
- The realtime combat ABI excludes turn, hero/enemy turn flow, round-pointer, and gem-action shadow exports; keep the required-export gate aligned with the rebuilt WASM.
- Fixture-driven behavior must match `tests/fixtures/*.csv` and JS packet expectations.
- Do not flip ownership of a new rule family without updating Rust, JS packet routing, shadow markers, WASM, fixtures, and tests together.

- `simulation_core/src/combat_abi.rs` owns the headless `wf_combat_call` JSON bridge and independent input/response/world registries. Its additive `spawn` operation atomically validates enemy batches, retains host identities and permits the host's next wave after an empty field. Existing scalar exports and production routing stay unchanged.

## Work Guidance
- Keep Rust functions small and numeric/JSON-compatible at the WASM boundary.
- Preserve JS rounding/normalization semantics when tests encode them.
- Rebuild WASM after Rust changes that affect browser behavior.
- SimulationCore release builds optimize WASM size with `opt-level = "z"`, LTO, one codegen unit, stripped symbols and aborting panics; preserve floating-point results and every supported export when changing build settings.
- `single_hit_damage_shadow` takes attack percentage, matching resistance, and general resistance after its existing eight arguments. Keep zero-floor damage and modifier order aligned with both JavaScript rule copies and rebuild the checked-in WASM after edits.

## Verification
- `cargo test --manifest-path rust/simulation_core/Cargo.toml`
- `npm run rust:build-wasm`
- Focused Node ownership/fixture tests for the changed rule family.
- `node --test tests/finalRustOwnershipBoundaryContract.test.js` for boundary/export changes.

## Child DOX Index
- `wf_combat/AGENTS.md` - extracted combat mechanics and explicit host inputs; independent of production in step 1.
- `wf_slice_harness/AGENTS.md` - frozen slice director, rewards, fixtures and equivalence proof.

- Energy is a macro balance: quest entry spends it, combat actions do not. Purple recovery remains active. Combat defeat depends on living heroes; Continue preserves energy.

- Combat outcome uses living hero count and turn eligibility uses individual actor HP. Enemy-target shadow exports accept six fixed hero records; update every JS caller and regenerate WASM with ABI changes.

- Party-damage total-HP export accepts six hero HP values plus actual member count and damage. The shared barrier still absorbs once per party-wide damage event.

- Continuous combat worlds retain actor clocks/wards across ordinary spawn batches. The fixed `ordinary_clear` respite validates an empty field and deduplicates a host transition ID; round 15% in host max-HP units before projection. EndEncounter emits despawn/ended facts without combat updates or kills. Continuous worlds select autonomous Phoenix by creation slot order and retain its selected recipient.

- Combat admits at most four heroes with party-order slots 0..3. Phoenix selects the lowest downed party slot; saved formation cells never enter the Rust host adapter. `geometry.contain_bodies` reserves source body bounds inside the host viewport without changing collision radii or reach.

- Combat ABI `wave_chest` requires an empty continuous field and returns chest state with empty rewards. Spawn rejects an unfinished chest pause. Opt-in `spawn_markers` reserves exact host enemy profiles through the slice countdown and emergence clip; pending entries count toward limits, live-enemy observations and gameplay hashes. Snapshots expose Groove and meter without recomputing them in JS.

- Combat schema 1.1 adds `replace_permanent_inputs_v1` negotiation and ordered `ReplacePermanentInputs` step commands. Validate the entire batch before mutation, acknowledge applied revisions in the ordered event stream, and retain host max-HP units for ordinary-clear rounding. Raw ABI layout remains 1.0; schema 1.0 requests remain supported.

- Combat actors carry independent ATK/DEF/MAG/RES through creation, marker/spawn profiles and permanent revisions. ABI gameplay hashes include host HP maxima, command sequence and idempotency receipts; these inputs affect future commands even when current HP matches.

- TDD-A A6/§3.3 captures permanent progression stats, maxima and definition/modifier parameters at commitment, including Phoenix/revival recipient maxima. Transient Elevate remains live at impact under slice semantics in every action, regardless of revisions. Frozen slice fixtures stay unchanged.
