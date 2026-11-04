# Rust app DOX (wf_app)

## Purpose
- The browser game as one Rust binary: macroquad client (ported from the slice `wf_client` at 9c142b5f) over `simulation_core::combat_abi::World`, the typed combat host.

## Contracts
- The sim is authoritative. `game.rs` owns one `wf_host::Session` (30 Hz pacing, stage director, rewards, save) and the client reads `Snapshot` + typed `Event`s; it never writes sim state.
- `platform.rs` is the browser seam: `wf_storage_get/set/remove` imports (localStorage via the miniquad plugin in `web/index.html`; files under `.wf-save/` natively) and `now_ms`. Save key `orka.hero_progress.v2`, shared with the JS game.
- QA: `?qa&seed=N` fixes the seed; keys 1/2/4 speed, P pause, R restart, B summons an available boss (placeholder for the boss control HUD, ORKA-63bf.7). `wasm_exports.wf_app_probe(i)`: 0 step, 1 wave, 2 combat time, 3 hash low bits, 4 live enemies, 5 fps, 6 boss state (0 locked, 1 available, 2 armed, 3 active), 7 boss seconds left, 8 cleared bosses.
- Art comes from `gen/` (packed by `rust/wf_pack` from `web-runner/assets/puppets` + chapter arenas) and `web-runner/assets/rust-combat/manifest.json` (effects, decals, font). `build.rs` fingerprints both; a stale atlas fails loading with a visible message.
- Build and stage with `tools/build_wf_app.sh`; review at `tools/serve_wf_app.sh` on 127.0.0.1:8807. `gen/`, `web/gen`, `web/art`, `web/*.wasm` stay untracked.
- Tests: `cargo test -p wf_app` (needs `gen/` packed). Ten tests are `#[ignore]`d with reasons: slice-director scenarios to re-enable on the WFM host loop (ORKA-63bf.6) and Mirewing art outside the live roster.

## Child DOX Index
- None.
