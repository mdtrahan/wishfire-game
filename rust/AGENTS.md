# Rust DOX

## Purpose
- Own the Rust SimulationCore deterministic simulation source and WASM export boundary.

## Ownership
- `rust/simulation_core/src/lib.rs` owns Rust implementations of deterministic rule families and `extern "C"` shadow exports.
- `rust/simulation_core/tests/` owns Rust-side contract tests.
- `web-runner/assets/simulation_core.wasm` is the generated browser artifact, but the source owner is this Rust crate.

## Local Contracts
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
