# Rust host DOX (wf_host)

## Purpose
- Translation of the JS combat host loop: `rustCombatRuntime.mjs` + `combatAuthorityDriver.mjs` + `questCombatSession.mjs` + the continuous stage runtime, as one `Session` over `simulation_core::combat_abi::World` and the `wf_meta` rules.

## Contracts
- `Session::new(seed, rows, progress, party, combat_session_id, next_uid, persist, quest)` spawns the opening wave; `tick(now_ms)` paces fixed 30 Hz steps from wall time scaled by `dev_speed`; `pause()` drops the debt; `dispose()` ends the world.
- Encounter ids are `rust:<checkpoint id>:<combat_session_id>:<n>`. The session id must be unique per boot (the app salts it with boot time); the reward outbox rejects a reused id, which is what JS avoided with `crypto.randomUUID()`.
- `progress.rs` is the `orka.hero_progress.v2` save envelope. `HeroProgressStore::from_snapshot` is `createHeroProgressStore`: every save (JS or Rust) loads through it, unknown keys and heroes drop, a corrupt checkpoint or outbox is an error with the JS message. `HeroProgress::award_exp` is `awardHeroEXP`. Hero records come in three JS shapes (fresh, normalized, `saveHeroProgress`); the oracle compares JSON values, not key order.
- `Session::new` is also `restoreHeroProgressFromStorage`: restored receipts settle before the party attaches, then a saved boss attempt is dropped, pending gold and battle rewards recover, and the configured stage checkpoint persists. `rewards.rs` is the combat reward outbox: kill rows stay pending until the next attempt settles them into `bagRewards`.
- Oracle: `tests/progress.rs` against `tests/fixtures/rust-oracle/hero_progress.json` (EXP awards, store normalization incl. legacy topology and error cases, level presets, restores of hand-made and real trace saves).
- `equipment.rs` is `equipmentStorage.mjs`: one `EquipmentStorage` over a `Storage` (localStorage) plus an optional checkpoint store (sessionStorage conveyor clock), driven through the `LampHost` trait (the session implements it: progress, gold, pending gold, live hero keys, `revise_hero`). `transact` is the JS read-modify-write: roster guard, paid-stage import, pending gold receipts, pending Bag kill receipts, conveyor clock, classify/change/classify, validate, save, `apply` (equipment stats and lamp EXP into hero records; live heroes get a permanent-input revision). No Web Lock: the Rust app is one writer. `advance_bag_clock` is combatHostClock's 15 s tick receipt.
- Live revisions (#229): `Session::queue_permanent_inputs` rebuilds a hero's permanent inputs from its saved record and submits a `replace_permanent_inputs` command with the next step; the `permanent_inputs_applied` ack (under `body.data`) must arrive in that step or the session fails like the JS driver. `tests/revision.rs` proves two successive equips reach the world.
- Oracle: `tests/lamp_storage.rs` replays the scripted equipmentStorage transaction sequence in `tests/fixtures/rust-oracle/lamp.json` (saves, hero records, gold, receipts after every step).
- Boss flow is the JS one: final wave clear arms the boss automatically; a timeout or party wipe sets `bossSummonRequired`, ordinary waves resume, and `summon_boss(now_ms)` re-arms it.
- Parity proof: `tests/trace.rs` replays `tests/fixtures/rust-oracle/stage_trace.json` (seed 7 and seed 42 at level 7, short runs plus 17500-tick runs through all ten Chapter 1 waves: the level-1 party times out on the boss and recovers, the level-7 party clears it into stage 2) and requires identical gameplay hashes, op sequence, transitions, spawn log, boss timeout record and checkpoint.
- Wall-clock gates (`Date.now()` in JS: boss entry wipe, boss-clear tail) read the frame clock passed to `tick`; the JS harness pins `Date.now` to the same clock so the trace is deterministic.
- Regenerate fixtures with `node tools/rust_oracle/write_fixtures.mjs`; run `cargo test -p wf_host`.

## Child DOX Index
- None.
