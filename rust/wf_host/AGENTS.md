# Rust host DOX (wf_host)

## Purpose
- Translation of the JS combat host loop: `rustCombatRuntime.mjs` + `combatAuthorityDriver.mjs` + `questCombatSession.mjs` + the continuous stage runtime, as one `Session` over `simulation_core::combat_abi::World` and the `wf_meta` rules.

## Contracts
- `Session::new(seed, rows, progress, party, combat_session_id, next_uid, persist, quest)` spawns the opening wave; `tick(now_ms)` paces fixed 30 Hz steps from wall time scaled by `dev_speed`; `pause()` drops the debt; `dispose()` ends the world.
- Encounter ids are `rust:<checkpoint id>:<combat_session_id>:<n>`. The session id must be unique per boot (the app salts it with boot time); the reward outbox rejects a reused id, which is what JS avoided with `crypto.randomUUID()`.
- `progress.rs` is the `orka.hero_progress.v2` save envelope (camelCase serde, unknown keys dropped on write). `rewards.rs` is the combat reward outbox: kill rows stay pending until the next attempt settles them into `bagRewards`.
- Boss flow is the JS one: final wave clear arms the boss automatically; a timeout or party wipe sets `bossSummonRequired`, ordinary waves resume, and `summon_boss(now_ms)` re-arms it.
- Parity proof: `tests/trace.rs` replays `tests/fixtures/rust-oracle/stage_trace.json` (seed 7 and seed 42 at level 7, short runs plus 17500-tick runs through all ten Chapter 1 waves: the level-1 party times out on the boss and recovers, the level-7 party clears it into stage 2) and requires identical gameplay hashes, op sequence, transitions, spawn log, boss timeout record and checkpoint.
- Wall-clock gates (`Date.now()` in JS: boss entry wipe, boss-clear tail) read the frame clock passed to `tick`; the JS harness pins `Date.now` to the same clock so the trace is deterministic.
- Regenerate fixtures with `node tools/rust_oracle/write_fixtures.mjs`; run `cargo test -p wf_host`.

## Child DOX Index
- None.
