# Fixtures DOX
- `rust-oracle/` is owned by the Rust translation: each JSON file was written by `tools/rust_oracle/write_fixtures.mjs` from the real JavaScript modules at commit `03fb30e9` and is asserted exactly by `rust/wf_meta` and `rust/wf_host` tests. Treat them as the frozen rule specification. Exception: `stage_trace.json` records combat outcomes, which are Rust-only rules now; after an owner combat change it is re-recorded from the Rust host (`rust/wf_host/AGENTS.md`, last 2026-11-05 for ORKA-63bf.29).
- `lamp-auto-earned-69.json` is the real 69-item lamp save the lamp fixture replays.
- The CSV fixtures of the retired JavaScript rule families left with the JS runtime (ORKA-63bf.11).
