# Tech Debt Tracker Report

Generated: 2026-06-08T00:03:13Z
Repo: /Users/Mace/Codex-Orka
Automation: tech-debt-tracker

## Current State

- Live checkout is a valid Git repository at `/Users/Mace/Codex-Orka`.
- Branch state: `main` is ahead of `origin/main` by 35 commits.
- Working tree state before this report: untracked `docs/superpowers/` and `game-design-research/`; no tracked dirty files reported by `git status --short --branch`.
- Repo-local handoff files were missing at startup: `reports/debt-report.md` and `reports/debt-actions.json`.
- Active Beads lane count is within policy: 4 total worktrees, including 3 under `.worktrees/`.
- Current `bd list` shows one in-progress bead: `ORKA-zy2o` remove green gems and green super gems safely.

## Validation Signal

`node --test --test-reporter=tap | rg '^(not ok|# tests|# pass|# fail|# duration_ms)'`

- Tests: 574
- Passing: 548
- Failing: 26
- Duration: 3337.133667 ms

Failure clusters:

- Damage/heal presentation: damage vector proof fields, heal bloom, regen shimmer.
- Enemy combat rendering/targeting: HP bar pixel/smoothing contracts and shared targeting policy delegation.
- Hero attack and layout controls: red single-target default behavior, skill control hit zones, party-slot formation writes.
- Runtime routing and shell: idle farm routing shell and Vault/chests retention routing.
- Delayed hit and yellow sequence: queued final damage resolution, yellow merge target/scale/settle cadence.
- Core preload: visual asset loading batch and startup loading frame.

The suite improved from the prior automation memory baseline of 36 failures to 26 failures, but it remains red. Stabilization work should stay ahead of broad cleanup or architecture refactors.

## Hotspot Inventory

Largest active files checked without full-file reads:

| File | Lines | Debt signal |
| --- | ---: | --- |
| `web-runner/modules/functionBank.js` | 8,882 | Runtime mirror bloat; split-brain parity risk with `Scripts/functionBank.js`. |
| `Scripts/functionBank.js` | 8,863 | Legacy/runtime mirror bloat; large blast radius for combat behavior edits. |
| `web-runner/app.js` | 8,305 | Still too large for orchestration-only policy; imports and state seams make assertions noisy. |
| `rust/simulation_core/src/lib.rs` | 4,523 | Rust ownership surface remains broad and coupled to JS fixture contracts. |
| `web-runner/systems/simulationCoreShadow.js` | 4,040 | Shadow ownership wiring remains a large cross-runtime parity surface. |

Other inventory:

- `web-runner/assets`: 100 files.
- `Scripts/legacy but partially working`: 14 files.
- `.worktrees`: 128M, with active bead worktrees.
- `rust/simulation_core/target`: 40M generated build output.
- `node_modules`: 14M local dependencies.

## Trend Since Last Tracker Run

- Main advanced substantially: current `HEAD` is `740037a`, tagged with `rollback/ORKA-zy2o-before-green-removal-20260607-143516`.
- Recent work concentrated in card draw, skill draught, pending supergem handoff, green/supergem removal, turn-gate state, runtime mirror updates, and new contract tests.
- Diff from `origin/main..HEAD`: 52 files, 3,078 insertions, 788 deletions.
- `web-runner/app.js` grew from the prior memory baseline of 8,218 lines to 8,305 lines.
- Both function-bank mirrors grew from roughly 8.5k lines to roughly 8.9k lines.
- `governance/product/abilities.html` is no longer present in the live checkout; current product skill docs include `hero-and-party-skills.md`, `hero-and-party-skill-pseudocode.md`, `player-living-guide.md`, `skill-bead-map.md`, `skill-proc-qa-guide.md`, `skill-harness-log.md`, and `skill-harness-notes.md`.

## Priority Remediation Plan

1. Stabilize the 26 failing contracts before opening broad runtime cleanup.
   - Highest return: attack the failure clusters that touch both function-bank mirrors and `web-runner/app.js`, because these failures also prove the hot files remain hard to change safely.

2. Keep `ORKA-zy2o` isolated until the green/supergem removal lane is validated.
   - It is the only in-progress bead in live Beads state and has a dedicated worktree.
   - Do not mix tech-debt cleanup into that lane unless the bead scope is explicitly expanded.

3. Create or select a dedicated stabilization bead for the current red suite if none already owns these failures.
   - Suggested scope: "restore 26 red contract tests after skill/supergem/turn-gate merges."
   - Stop condition: focused TAP summary reaches 574 tests / 574 pass, or remaining failures are explicitly moved to separate beads.

4. After the suite is green, resume narrow extraction from `web-runner/app.js`.
   - Keep `app.js` orchestration-only.
   - Move reusable state transitions and rendering contracts into `web-runner/src/core/` or dedicated `web-runner/systems/` modules.

5. Treat function-bank mirror reduction as a separate high-risk merge/refactor lane.
   - Current mirrors are too large and too behavior-critical for opportunistic cleanup.
   - Any merge/refactor needs fixture-backed parity checks and a rollback tag.

## Retrieval Receipt

- Tool used first for code-location/ownership/dependency orientation: `jcodemunch-mcp`.
- Repo/query: `local/Codex-Orka`, `get_repo_health`.
- Result: unavailable for this repo because no index exists and no `index_folder` tool is exposed in the current tool surface.
- Fallback used: bounded shell scans (`git status`, `bd ready`, `bd list`, `git diff --stat`, `wc -l`, `find`, `rg`, and filtered TAP test output).
- Files/symbols retrieved: no full hot-file reads; only line counts, path lists, diff stats, and failing test names were used for hot runtime files.
