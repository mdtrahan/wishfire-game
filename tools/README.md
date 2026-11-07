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

## Rust handoff verifier

`node tools/verify_rust_handoff.mjs --base origin/main --head HEAD --out /tmp/wf-verdict`

Both refs are pinned to commits and checked in disposable local clones. The verifier packs art, builds the native workspace, runs workspace and frozen-slice tests, and invokes each revision's `test:merge` route. Tests run even when another group fails. New failure names fail; inherited names and fixes appear in `verdict.json`. Build errors, timeouts and commands that fail without named tests always fail. Logs remain with the receipt; temporary clones are deleted.

Three seeded production `wf_host::Session` replays use shipped enemy data: Chapter 1 wave clear (seed 1, level 1), Chapter 1 boss clear (seed 7, level 25), and pause/resume before wave clear (seed 42, level 1). Scripts call existing player-host inputs. The ordered serialized event log has a length-prefixed FNV-1a-64 digest; a changed digest is reported for review. The measurement is native host tick time, including simulation, events and stage work, in microseconds (p50/p95); timing differences have no automatic threshold. Each replay must reach its declared outcome within 900 sim seconds and must show movement, HP changes or host progress within 180 seconds. Time/hash churn alone cannot keep it alive. The frozen slice fixtures remain untouched.

`--quick` reuses the base SHA's result only when verifier/replay source, Rust/Node versions and platform match and all cached log hashes match. Head always runs. Cache defaults to the system temporary directory's `wishfire-rust-verifier-cache`; `--cache <dir>` chooses another location. Each snapshot gets its own temporary Cargo target: fixture paths embedded at compile time must never point to another or deleted checkout. Cargo registry downloads remain warm; snapshot build products are deleted with the clones. A warm default run targets under ten minutes. `--timeout <seconds>` bounds each command (default 240); a timeout kills its process group and fails the verdict. Output defaults to a uniquely named temporary directory; `--out <dir>` makes it predictable. Receipts and the reusable cache are retained intentionally; delete their directories when finished.

`--gif` also builds/serves the head's real `wf_app`, loads each replay's initial hero save and seed into a fresh browser context, and applies the existing B/P/1/S player controls. Browser RAF and time advance at 30 fps, with speed 1x and Spotlight Off to match native replays. It captures through the expected outcome and checks the live renderer probe. GIFs are 720x1280 at DPR 1; the browser remains headless. Optional prerequisites: `npm ci`, `npx playwright install chromium`, and `ffmpeg` on PATH. Default verification does not import Playwright or build WASM. Full GIFs cost substantially more than native replays.

For a local negative control, `--worktree --head HEAD` applies the tracked local diff only to the disposable head clone and records its patch hash. Base uses the committed replay driver. This receipt describes the dirty patch and cannot certify the clean commit. Untracked files are excluded. Ordinary runs always use committed snapshots.
