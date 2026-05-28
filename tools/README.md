Legacy C3 conversion tooling retired.

Construct 3 JSON artifacts and converter script were removed from the repository on 2026-02-24.
Runtime authority is the current hand-authored code in `Scripts/` and `web-runner/`.

## Canonical Playwright Pipeline

Game automation in this repo has one canonical execution path:

1. `npm run balance-harness`
2. Optional browser mode switch via `BALANCE_CDP_URL` / `--cdpUrl`

Everything else in this folder is support tooling around that harness, not a second test pipeline.

### Supporting tools only

- `npm run playwright:doctor`
  Use to classify whether the next blocker is browser startup or CDP attach.
- `npm run playwright:launch-matrix`
  Use only when investigating why direct launch regressed under Codex.
- `npm run chrome:cdp`
  Use only to bootstrap an external Chrome session for the existing CDP attach mode.

The Codex Playwright skill and Playwright MCP are also support tools. They are useful for interactive browser debugging and spot checks, but they do not replace the repo-owned balance harness as the batch game-test path.

## Playwright Preflight

Use the external-Chrome CDP path before any in-Codex game harness run:

1. In normal Terminal, start a fresh debug Chrome:
   - `npm run chrome:cdp -- --port 9222`
2. From Codex, prove attach/control before touching the game:
   - `npm run playwright:doctor -- --only cdp --cdpUrl http://127.0.0.1:9222`
3. Only after that passes, run the bounded game harness:
   - `BALANCE_CDP_URL=http://127.0.0.1:9222 npm run balance-harness -- --sessions 1 --maxWaves 1`

If `npm run playwright:doctor` reports `sandbox_browser_startup_denied` for direct launch, treat that as a browser-start failure in Codex, not as proof that macOS Automation or Accessibility is required for the CDP attach path.

For direct-launch regression work, run the launch matrix:

- `npm run playwright:launch-matrix`

This compares Playwright-owned browser launch to a plain Codex-owned Chrome child-process launch so the failure can be pinned to either Playwright startup mode or any Codex-owned Chrome startup.

## Hot-File Commit Prep

Use the repo-owned helper before committing staged edits in hot files:

1. Stage the intended hot-file diff.
2. Run `tools/prepare_hot_file_commit.sh <bd-id>`.
3. If live `bd` state is not aligned to that lane, rerun with `--align-active`.
4. Commit only after prepare succeeds.

The helper now generates `.beads/hot-file-lock/<bd-id>.scope` automatically from staged diffs, writes prepared metadata for enforcement, and prints restore commands when it had to realign the active Beads lane for commit.

Generated scope lines may include `__MODULE__` for reviewed top-level edits such as imports, module constants, or top-level state-shape wiring in hot files. That token is explicit by design: module-scope edits stay declared and reviewable instead of being blocked as impossible to commit.

Do not hand-author `.scope` files unless you are debugging the tooling itself.
