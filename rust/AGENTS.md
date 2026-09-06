# Rust DOX

## Purpose
- Own the Rust SimulationCore deterministic simulation source and WASM export boundary.

## Ownership
- `rust/simulation_core/src/lib.rs` owns Rust implementations of deterministic rule families and `extern "C"` shadow exports.
- `rust/simulation_core/tests/` owns Rust-side contract tests.
- `web-runner/assets/simulation_core.wasm` is the generated browser artifact, but the source owner is this Rust crate.

## Local Contracts
- Rust owns deterministic simulation slices named in `governance/planning/simulation-core-rust-final-audit.md`.
- Rust must not depend on DOM, Canvas, audio, storage APIs, Netlify, browser globals, or presentation timing.
- Public shadow export names are part of the JS/WASM contract and are asserted by tests.
- Fixture-driven behavior must match `tests/fixtures/*.csv` and JS packet expectations.
- Do not flip ownership of a new rule family without updating Rust, JS packet routing, shadow markers, WASM, fixtures, and tests together.

## Work Guidance
- Keep Rust functions small and numeric/JSON-compatible at the WASM boundary.
- Preserve JS rounding/normalization semantics when tests encode them.
- Rebuild WASM after Rust changes that affect browser behavior.

## Verification
- `cargo test --manifest-path rust/simulation_core/Cargo.toml`
- `npm run rust:build-wasm`
- Focused Node ownership/fixture tests for the changed rule family.
- `node --test tests/finalRustOwnershipBoundaryContract.test.js` for boundary/export changes.

## Child DOX Index
- None.

- Energy is a macro balance: quest entry spends it, combat actions do not. Purple recovery remains active. Combat defeat depends on party HP/living heroes; Continue preserves energy.
