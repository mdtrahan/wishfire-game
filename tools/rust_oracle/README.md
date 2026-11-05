# Rust oracle fixtures

`write_fixtures.mjs` ran the real JavaScript rule modules and wrote `tests/fixtures/rust-oracle/*.json`;
the Rust crates (`rust/wf_meta`, `rust/wf_host`) assert against those files. The JS game code was removed in
the Rust cutover (ORKA-63bf.11), so the script's imports no longer resolve on `main`.

The fixtures are the frozen specification. To regenerate one, check out the last commit that still carried the
JS modules (`03fb30e9`, the ORKA-63bf.10 commit), run `node tools/rust_oracle/write_fixtures.mjs` there, and
copy the JSON back. Change a fixture only when the owner changes the rule it records, never to make Rust pass.

`stage_trace.json` is the exception: it records combat outcomes, and combat is Rust-only. After an owner combat rule
change it is re-recorded from the Rust host with `WF_RECORD_STAGE_TRACE=1 cargo test -p wf_host --test trace`
(see `rust/wf_host/AGENTS.md`).
