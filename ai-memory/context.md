# Project Context

Codex-Orka is an HTML5 game. Current `main`, the applicable `AGENTS.md` chain, current product docs, and live Beads state define the working context. Select an active worktree explicitly when working in a lane.

Historical plans, archived instructions, generated reports, and recovery bundles are outside ordinary development retrieval. Do not use an old local index without checking its source path and commit.

## Rust cutover (2026-11-04, ORKA-63bf.11)
- The game is the Rust app `rust/wf_app` over `wf_host`/`wf_meta`/`wf_combat`; the JavaScript runtime (`web-runner/app.js`, `modules/`, `systems/`, `src/`, `state/`, `Scripts/`, root `src/`) and its tests/harnesses were removed. Last JS commit: `03fb30e9`. Build `tools/build_wf_app.sh`, serve `tools/serve_wf_app.sh 8807`, release `tools/build_runtime_release.mjs` (dist/web-runner). JS oracle fixtures in `tests/fixtures/rust-oracle/` are the frozen spec.
