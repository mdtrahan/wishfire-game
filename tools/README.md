# Tools

The game is the Rust app in `rust/wf_app`. Day to day:

- `npm run build` (`tools/build_wf_app.sh`): pack art, build for wasm32, stage `rust/wf_app/web/`.
- `npm run serve` (`tools/serve_wf_app.sh 8807`): serve the staged app at `http://127.0.0.1:8807/`.
- `npm run build:release` (`tools/build_runtime_release.mjs`): hosted release in `dist/` (Netlify publishes it; `/` redirects to `/web-runner/`).
- `npm test`: retained Node tooling contracts. `npm run test:merge -- --base <ref>`: the PR tier (Node suite + every Rust crate).

## Storage hygiene

- `npm run storage:audit` reads Git worktrees, Bead status, and directory sizes without modifying data.
- `npm run storage:clean -- --worktree /absolute/registered/path` validates one lane and prints a dry run; add `--apply` to remove that worktree through Git. Historical (`--historical`) and superseded-ancestor (`--superseded-by`) retirement are explicit opt-ins with ancestry and local-file guards.
- A unique `.beads/commit-check/<bd-id>.json` stays protected until archived as a Git note on the merged commit in `refs/notes/orka-commit-check`.

The tracked hook is active when `git config --get core.hooksPath` prints `.beads/hooks`.

## Rust oracle

`tools/rust_oracle/` holds the script that produced the frozen JS oracle fixtures (`tests/fixtures/rust-oracle/`); see its README for the source commit.
