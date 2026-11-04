# Rust app DOX (wf_app)

## Purpose
- The browser game as one Rust binary: macroquad client (ported from the slice `wf_client` at 9c142b5f) over `simulation_core::combat_abi::World`, the typed combat host.

## Contracts
- The sim is authoritative. `game.rs` owns one `wf_host::Session` (30 Hz pacing, stage director, rewards, save) and the client reads `Snapshot` + typed `Event`s; it never writes sim state.
- `platform.rs` is the browser seam: `wf_storage_*` (localStorage), `wf_session_*` (sessionStorage), `wf_random_u32` (crypto) imports from the miniquad plugin in `web/index.html` (files under `.wf-save/` natively), `now_ms` (pacing) and `epoch_ms` (`Date.now` stamps in saves). Save keys `orka.hero_progress.v2` and `wishfire.equipment-economy.v5`, shared with the JS game.
- `game.rs` also owns the lamp economy (`wf_host::equipment::EquipmentStorage`): synced at boot and whenever Bag receipts or gold change; every tick feeds the 15 s Bag clock. `ui/lamp.rs` is the strip (conveyor lane from off-screen left to the bag, bag count, level disc + progress), the equipment cache / review / disposal windows and the Bag upgrade window, placed by the JS CSS numbers; a lamp window pauses combat and blocks Bag progress like the JS modal gate.
- `ui/` is the combat chrome and the meta screens in the JS 360x640 layout: arena band 42..430 (`camera::BAND_*` = COMBAT_VIEW), progress HUD and Summon Boss (renderCombatBossControl), boss HUD + stats panel (renderBossBattleHud), party buff row and eight hero clocks with buff badges (heroCooldownStrip + buffSignalRules), lamp strip placeholder (bead .8), nav bar (renderExistingNavigation). `ui::model::CombatModel` is the per-frame read model; `ui::chrome` draws and records hit zones; `ui::screens` holds placeholder Hero/Vault/Power Up/Quests pages until beads .9/.10. Leaving combat or opening a panel pauses the session like the JS departure/modal paths. Chrome art is `assets::UI_ART` under `web/art/ui` (nav, boss HUD, hero portraits, buff sheet, gear atlas, bag, essence orb, medallion).
- QA: `?qa&seed=N` fixes the seed; keys 1/2/4 speed, P pause, R restart, B summons an available boss (same as the Summon Boss button). `wasm_exports.wf_app_probe(i)`: 0 step, 1 wave, 2 combat time, 3 hash low bits, 4 live enemies, 5 fps, 6 boss state (0 locked, 1 available, 2 armed, 3 active), 7 boss seconds left, 8 cleared bosses.
- Art comes from `gen/` (packed by `rust/wf_pack` from `web-runner/assets/puppets` + chapter arenas) and `web-runner/assets/rust-combat/manifest.json` (effects, decals, font). `build.rs` fingerprints both; a stale atlas fails loading with a visible message.
- Build and stage with `tools/build_wf_app.sh`; review at `tools/serve_wf_app.sh` on 127.0.0.1:8807. `gen/`, `web/gen`, `web/art`, `web/*.wasm` stay untracked.
- Tests: `cargo test -p wf_app` (needs `gen/` packed). Ten tests are `#[ignore]`d with reasons: slice-director scenarios to re-enable on the WFM host loop (ORKA-63bf.6) and Mirewing art outside the live roster.

## Child DOX Index
- None.
