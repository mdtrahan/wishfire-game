# Rust app DOX (wf_app)

## Purpose
- The browser game as one Rust binary: macroquad client (ported from the slice `wf_client` at 9c142b5f) over `simulation_core::combat_abi::World`, the typed combat host.

## Contracts
- The sim is authoritative. `World` steps exactly 30 Hz (`host.rs` accumulates like the JS authority driver); the client reads `Snapshot` + typed `Event`s and never writes sim state.
- Art comes from `gen/` (packed by `rust/wf_pack` from `web-runner/assets/puppets` + chapter arenas) and `web-runner/assets/rust-combat/manifest.json` (effects, decals, font). `build.rs` fingerprints both; a stale atlas fails loading with a visible message.
- Build and stage with `tools/build_wf_app.sh`; review at `tools/serve_wf_app.sh` on 127.0.0.1:8807. `gen/`, `web/gen`, `web/art`, `web/*.wasm` stay untracked.
- Tests: `cargo test -p wf_app` (needs `gen/` packed). Ten tests are `#[ignore]`d with reasons: slice-director scenarios to re-enable on the WFM host loop (ORKA-63bf.6) and Mirewing art outside the live roster.

## Child DOX Index
- None.
