# Rust DOX

## Purpose
- Own the Rust SimulationCore deterministic simulation source and WASM export boundary.

## Ownership
- `rust/simulation_core/src/lib.rs` owns Rust implementations of deterministic rule families and `extern "C"` shadow exports.
- `rust/simulation_core/tests/` owns Rust-side contract tests.
- `web-runner/assets/simulation_core.wasm` is the generated browser artifact, but the source owner is this Rust crate.

## Local Contracts
- `describe.special_clocks` exports the four Hero stock-refill constants from wf_combat tuning for generated display content. This additive description field leaves request, snapshot and event schemas unchanged.
- Combat ABI advertises `ack_events_v1`: `ack {world, encounter_id, sequence}` validates the absolute cursor and prunes only its acknowledged prefix. `inspect.events_after` must lie between the acknowledged and last cursors. Sequence generation remains monotonic after pruning; acknowledgement changes no gameplay hash. Retained-event backpressure rejects before stepping and resumes after ack. `died` includes combat reason, team and optional original host spawn identity; teardown emits only despawn/ended facts.
- Combat ABI 1.0 snapshots additionally expose host identities, pose/facing, ward, clocks, full hazard presentation fields, projectiles and camera focus. Actor effect observations include shield, poison, encasement, Elevate and cast state. Read-only hit-stop, spotlight and Phoenix channel/cooldown fields supply presentation clocks and revival observations. These are observations of the existing sim; preserve mechanics and snapshot/event order. Combat scalars are retired; CP and meta RNG scalars remain. Regenerate and validate local artifact/provenance after boundary changes.
- Rust owns deterministic simulation slices named in `governance/planning/simulation-core-rust-final-audit.md`.
- Rust must not depend on DOM, Canvas, audio, storage APIs, Netlify, browser globals, or presentation timing.
- Supported scalar exports are CP and meta RNG only; combat runs through the world ABI. The required-export gate rejects missing supported exports.
- The realtime combat ABI excludes turn, hero/enemy turn flow, round-pointer, and gem-action shadow exports; keep the required-export gate aligned with the rebuilt WASM.
- Fixture-driven behavior must match `tests/fixtures/*.csv` and JS packet expectations.
- Do not flip ownership of a new rule family without updating Rust, JS packet routing, shadow markers, WASM, fixtures, and tests together.

- `simulation_core/src/combat_abi.rs` owns the headless `wf_combat_call` JSON bridge and independent input/response/world registries. Its `World` and encounter inputs are public: native hosts (`wf_app`) call `create`/`step_now`/`spawn_batch`/`wave_chest`/`ordinary_clear`/`ack` directly and read the typed snapshot; the JSON transport wraps the same methods, and `typed_world_matches_json_transport` pins their equality. Its `describe.content_version` identifies the content definitions and must match the WFM host and generated manifest before startup. Its additive `spawn` operation atomically validates enemy batches, retains host identities and permits the host's next wave after an empty field. Only CP/meta RNG scalars remain; all combat uses this ABI.

## Work Guidance
- CP durability uses `wf_combat::formulas::mitigation_multiplier`, matching the browser CP helper's 100-point armor scale.
- Keep Rust functions small and numeric/JSON-compatible at the WASM boundary.
- Preserve JS rounding/normalization semantics when tests encode them.
- Rebuild WASM after Rust changes that affect browser behavior.
- SimulationCore release builds optimize WASM size with `opt-level = "z"`, LTO, one codegen unit, stripped symbols and aborting panics; preserve floating-point results and every supported export when changing build settings.

## Verification
- `cargo test --manifest-path rust/simulation_core/Cargo.toml`
- `npm run rust:build-wasm`
- Focused Node ownership/fixture tests for the changed rule family.
- `node --test tests/finalRustOwnershipBoundaryContract.test.js` for boundary/export changes.

## Child DOX Index
- `wf_combat/AGENTS.md` - extracted combat mechanics and explicit host inputs; independent of production in step 1.
- `wf_slice_harness/AGENTS.md` - frozen slice director, rewards, fixtures and equivalence proof.
- `wf_app/AGENTS.md` - Rust app: macroquad client over the typed combat host (ORKA-63bf).
- `wf_pack/` - build-time atlas packer for `web-runner/assets/puppets` and chapter arenas; output `rust/wf_app/gen/` stays untracked.

- Energy is a macro balance: quest entry spends it, combat actions do not. Purple recovery remains active. Rust decides combat defeat; recovery never spends combat energy.

- Combat outcome uses living hero count and turn eligibility uses individual actor HP. Enemy-target shadow exports accept six fixed hero records; update every JS caller and regenerate WASM with ABI changes.

- Party-damage total-HP export accepts six hero HP values plus actual member count and damage. The shared barrier still absorbs once per party-wide damage event.

- Continuous combat worlds retain actor clocks/wards across ordinary spawn batches. The fixed `ordinary_clear` respite validates an empty field and deduplicates a host transition ID; round 15% in host max-HP units before projection. EndEncounter emits despawn/ended facts without combat updates or kills. Continuous worlds select autonomous Phoenix by creation slot order and retain its selected recipient.

- Combat admits at most four heroes with party-order slots 0..3. Phoenix selects the lowest downed party slot; saved formation cells never enter the Rust host adapter. `geometry.contain_bodies` reserves source body bounds inside the host viewport without changing collision radii or reach.

- Combat ABI `wave_chest` requires an empty continuous field and returns chest state with empty rewards. Spawn rejects an unfinished chest pause. Opt-in `spawn_markers` reserves exact host enemy profiles through the slice countdown and emergence clip; pending entries count toward limits, live-enemy observations and gameplay hashes. Snapshots expose Groove and meter without recomputing them in JS.

- Combat schema 1.1 adds `replace_permanent_inputs_v1` negotiation and ordered `ReplacePermanentInputs` step commands. Validate the entire batch before mutation, acknowledge applied revisions in the ordered event stream, and retain host max-HP units for ordinary-clear rounding. Raw ABI layout remains 1.0; schema 1.0 requests remain supported.

- Combat actors carry independent ATK/DEF/MAG/RES through creation, marker/spawn profiles and permanent revisions. ABI gameplay hashes include host HP maxima, command sequence and idempotency receipts; these inputs affect future commands even when current HP matches.

- TDD-A A6/§3.3 captures permanent progression stats, maxima and definition/modifier parameters at commitment, including Phoenix/revival recipient maxima. Transient Elevate remains live at impact under slice semantics in every action, regardless of revisions. Frozen slice fixtures stay unchanged.

- Damage events carry per-hit `hp_loss` from the Rust damage operation, excluding ward absorption. Event sidecars never alter the frozen public slice Event, RNG consumption, gameplay hashes or trace rows. Preserve ward-only and multiple-hit/heal coverage when changing telemetry.

- Combat ABI taunt observations use the validated forced target, rather than the raw actor view. `taunted_by` and `taunt_age` become null on expiry or source loss; age derives from Rust's existing taunt countdown without adding simulation state.

- Retained meta RNG keeps the native `mirrors_current_seeded_rng_cases` fixture alongside shipped-WASM parity checks when combat scalar exports retire.

- WASM, manifest, Special clock content and provenance are ignored build products. Server/test/release entry points rebuild missing or stale products; never stage generated products after Rust edits. Rebuild with the same Rust version and flags for byte reproduction.

- SimulationCore and wf_combat share `rust/Cargo.toml` and `rust/Cargo.lock` so Cargo crate identities stay relative across checkouts. The reference harness retains its separate lock/workspace. Release profile settings live at the workspace root.
- WFM keeps the Rust spotlight scheduler OFF. Attack framing observes existing cast events and snapshot attack lifetimes in JS; camera presentation must preserve gameplay hashes, damage and deaths.
