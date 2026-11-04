# Meta rules DOX (wf_meta)

## Purpose
- Rust translation of the JS meta rules (`web-runner/src/core`, `src/core`, `web-runner/systems/wfmCombatConfig.mjs`). The JS is the spec; each module header names its source file.

## Contracts
- Numbers follow JavaScript: f64 everywhere, `jsnum::{imul,to_uint32,round,hypot}` reproduce `Math.imul`, `>>> 0`, `Math.round` and V8's `Math.hypot`; `jsnum::{number,number_or,is_safe_integer}` are `Number(v)`, `Number(v)||d` and `Number.isSafeInteger` over JSON values for save sanitizing. Cast to f32 only where the combat ABI does (through JSON) or where the JS does (`hero::hero_special_cooldown` uses `Math.fround`).
- `tests/oracle.rs` asserts every case in `tests/fixtures/rust-oracle/*.json` (written by `tools/rust_oracle/write_fixtures.mjs` from the real JS modules) exactly. Regenerate fixtures only when the JS spec changes, never to make Rust pass; `serde_json` keeps `float_roundtrip` so parsed fixtures are exact.
- `stage.rs` owns the continuous stage state, templates, transitions, seeded spawn plan and enemy activation; `wfm_config.rs` builds the encounter JSON the host sends to Rust combat (`to_json()` deserializes into `simulation_core::combat_abi::EncounterConfig`).

## Child DOX Index
- None.
