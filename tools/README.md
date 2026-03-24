Legacy C3 conversion tooling retired.

Construct 3 JSON artifacts and converter script were removed from the repository on 2026-02-24.
Runtime authority is the current hand-authored code in `Scripts/` and `web-runner/`.

## Significant-Diff Commit Compliance

The repo now treats a staged diff as significant if any of these are true:

- at least one staged hot-file edit
- 3 or more staged files
- 80 or more staged changed lines

Before committing a significant staged diff:

1. ensure the correct bead is the single active `in_progress` issue
2. run `tools/prepare_commit_check.sh <bd-id>`
3. commit only after the helper succeeds

The helper writes `.beads/commit-check/<bd-id>.json` with:

- changed files
- changed functions or `__MODULE__` markers for the staged diff
- staged blob ids so stale prep is rejected
- hot-file touch classification

Hot-file edits still require the existing hot-file scope lock. `tools/prepare_commit_check.sh` delegates to `tools/prepare_hot_file_commit.sh` automatically when staged hot files are present.

## Tracked Git Hooks

This repo already points Git at the tracked hooks in `.beads/hooks`.

They enforce:

- commit message includes `bd-<id>`
- exactly one active in-progress bead exists
- significant staged diffs have fresh commit-check metadata
- staged hot-file edits still pass the hot-file scope lock
