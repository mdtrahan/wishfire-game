# Tests DOX

## Purpose
- `tests/` holds the retained Node contracts for repo tooling and the frozen JS oracle fixtures the Rust crates assert against. Game behavior is proven by the Rust crate tests (`cargo test` per crate under `rust/`), not here; the JavaScript game contracts left with the JS runtime in the Rust cutover (ORKA-63bf.11).

## Retained Node contracts
- `preCommitRouting.test.mjs` (+ `preCommitRouting.mjs`): the pre-commit hook routes every staged change to `tools/run_commit_tests.mjs`; the merge tier (`tools/run_merge_tests.sh`) runs `npm test` and every Rust crate and blocks on failure.
- `storageBudgetContract.test.mjs` proves oversized payload/tree/runtime rejection and staged generated-output refusal.
- `storageHygieneContract.test.mjs` covers audit, dry-run cleanup, detached/unmerged refusal, the opt-in historical path and superseded-ancestor refusal.
- `taskFootprintContract.test.mjs` covers footprint baseline/resume, shallow checks, retained peaks and warn-only commit preparation.
- `linkBeadsWorktreeContract.test.mjs` verifies a fresh checkout points at the root Beads database and refuses lane-local Dolt state.
- `gitDiffParsingContract.test.js` covers the hot-file scope parser used by commit compliance.

## Fixtures
- `fixtures/rust-oracle/*.json` are the JS oracle outputs (`tools/rust_oracle/README.md`): stage traces, hero progression, lamp economy, combat progression, narrative playback and the smaller rule tables. `fixtures/lamp-auto-earned-69.json` is the real save the lamp fixture captured.
- Regenerate a fixture only when the owner changes the rule it records; see `tools/rust_oracle/README.md` for the frozen source commit.

## Running
- `npm test` runs the retained suite. `cargo test --manifest-path rust/<crate>/Cargo.toml` runs a crate; `rust/wf_app` needs `rust/wf_app/gen` packed first (`tools/build_wf_app.sh` or `cargo run -p wf_pack`).

## Child DOX Index
- `fixtures/AGENTS.md` - fixture ownership.
