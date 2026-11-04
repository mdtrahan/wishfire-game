# Tools DOX

## Purpose
- Own repo automation: the Rust app build, local serving and hosted release, the test tiers, storage hygiene, and Beads/Git support. The JavaScript harnesses (balance harness, UI lock, Playwright helpers, SimulationCore wasm builder, offline bundle) left with the JS runtime in the Rust cutover (ORKA-63bf.11).

## Ownership
- `build_wf_app.sh` packs puppets/arenas (`rust/wf_pack`), builds `wf_app` for wasm32 and stages `rust/wf_app/web/` (gen, art, data, wasm). `serve_wf_app.sh [port]` serves that directory statically (owner review on 8807). `build_runtime_release.mjs` runs the build and publishes `rust/wf_app/web` as `dist/web-runner/` (Netlify `publish = dist`, `/` redirects to `/web-runner/`), preserving the previous release on failure; `--no-build` republishes the staged page.
- `run_commit_tests.mjs` is the pre-commit fast tier: `git diff --check`, syntax of staged JS, retained Node contracts affected by the diff (import and path-string edges), `cargo test` for touched crates (every crate when shared Rust files change). `run_merge_tests.sh` is the PR tier: `npm test` plus every Rust crate after packing the atlas. `run_test_suite.mjs` is `npm test`.
- `rust_oracle/write_fixtures.mjs` produced `tests/fixtures/rust-oracle/*.json` from the JS modules at commit `03fb30e9`; see `rust_oracle/README.md`.
- `storage_hygiene.mjs`, `enforce_storage_budget.mjs`, `link_beads_worktree.mjs`, `prepare_commit_check.sh`, `commit_compliance.py`, `hot_file_scope.py` and the Beads visibility scripts support the repo workflow; `export_actor_puppets.mjs`, `pad_actor_motion_clips.py`, `complete_missing_actor_clips.py` and `analyze_duplicate_assets.js` are asset tools.

## Local Contracts
- `storage_hygiene.mjs footprint:start|check|peak|close` keeps run records in `~/.cache/task-footprint/`; reporting never authorizes cleanup.
- `enforce_storage_budget.mjs` rejects staged recovery/evidence output, files over 20 MiB, indexed trees over 384 MiB and runtime source/assets over 200 MiB. `enforce_commit_check.sh` runs it before compliance.
- `link_beads_worktree.mjs` adds only the ignored native `.beads/redirect` in a Codex-created worktree and refuses lane-local Dolt state or a conflicting redirect.
- `storage_hygiene.mjs clean` defaults to dry-run and fails closed on unreadable Beads state, dirty, unmerged, OPEN/unknown, missing, main, or protected ignored files; historical and superseded-ancestor retirement are explicit opt-ins with ancestry guards.
- Hot files: none are declared; `HOT_FILE_SCOPE_HOT_FILES` names new ones. The compliance record (`.beads/commit-check/<bead>.json`) stays required for significant diffs.
- Build products (`rust/wf_app/gen`, `rust/wf_app/web/{gen,art,data,*.wasm}`, `dist/`) stay untracked.

## Child DOX Index
- None.
