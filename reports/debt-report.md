# Technical Debt Tracker Report

Run: 2026-06-01T00:03:25Z
Repository: /Users/Mace/Codex-Orka
Automation: tech-debt-tracker

## Scope

Read-only debt scan plus repo-local handoff refresh. No runtime code was changed.

## Current Health

- `bd ready` reports 10 ready issues.
- `bd list --status in_progress --limit 0` reports one active tracker-side implementation bead: `ORKA-9fig` for Faze green gem separation.
- `git worktree list --porcelain` shows the main checkout plus five auxiliary worktrees:
  - active-looking bead lanes: `wt-ORKA-9fig-faze-green-separation`, `wt-ORKA-v4mh-simulation-core-contract`, `wt-ORKA-idfa-app-shell-extraction-wip-needs-qa`
  - preserved archive lanes: `wt-ORKA-crwd-crimson-ward`, `wt-ORKA-jecl-supergem-lock-plan`
- Git status was already dirty before this report:
  - Modified: `AGENTS.md`, `ai-memory/project.md`, `governance/product/hero-and-party-skill-pseudocode.md`, `tests/kojonnAmpAoeContract.test.js`, `tests/kojonnRoleCorrectionContract.test.js`, `tests/lungeMotionContract.test.js`
  - Untracked: `.beads/dolt-config.log`, `.beads/dolt-server.lock`, `.beads/dolt-server.log`, `docs/clawpatch-guide.md`, `governance/product/abilities-method.md`, `governance/product/abilities.html`, `reports/`, `tests/fazeGreenSuperGemSeparationContract.test.js`, `tests/fazeSkillDraughtContract.test.js`
- Since the prior tracker run baseline (`9b15338`), `main` has a migration-heavy delta: 207 files changed, 33,435 insertions, and 1,293 deletions.
- Compared with `origin/main`, local `main` is ahead by two Crimson Ward fixes (`bd-ORKA-azwx`) with 8 files changed, 285 insertions, and 261 deletions.
- `npm test` is red: 550 tests, 514 passing, 36 failing.

## Top Debt Items

### P0: Test Suite Is Still Red

Severity: critical  
Interest: high

The full suite still fails. The current failure count is 36. Failures cluster around chests/Vault routing, damage text vector proof fields, enemy HP bar rendering, enemy targeting policy delegation, Kojonn/Faze split, heal bloom and party regen presentation, hero red single-target behavior, hero skill controls, idle farm routing, delayed-hit damage, green AOE/lunge contracts, dev panel seams, visual loading, retention gallery routing, and yellow sequence cadence.

Recommendation: keep the next remediation as a dedicated stabilization bead, not opportunistic fixes inside feature beads. Start by splitting failures into ownership groups: routing/layout, function-bank parity, hero/party skill behavior, visual contract assertions, and yellow sequence timing.

### P1: Migration Added a New Shadow Runtime Hotspot

Severity: high  
Interest: high

`web-runner/systems/simulationCoreShadow.js` is now 4,040 lines. The Rust migration created useful deterministic ownership seams, but the JS shadow layer has become a large second runtime surface that can accumulate logic, parity assertions, and startup coupling.

Recommendation: treat `simulationCoreShadow.js` as a temporary migration coordination layer. Future work should move packet-specific adapters into smaller modules once each owner boundary stabilizes.

### P1: `web-runner/app.js` Remains the Central Bottleneck

Severity: high  
Interest: high

`web-runner/app.js` is now 8,218 lines. It grew from the previous 7,852-line report despite extraction work, and several red tests still assert against app-source strings. This keeps unrelated routing, rendering, turn gating, dev tooling, and animation contracts coupled to one hot file.

Recommendation: continue `ORKA-idfa` style extraction, but only by bead-owned seams. Prioritize route helpers, visual loader helpers, and yellow sequence orchestration before deeper combat behavior.

### P1: Function Bank Mirrors Grew and Remain Split-Brain Risk

Severity: high  
Interest: high

The mirrored function banks grew substantially:

- `Scripts/functionBank.js`: 8,459 lines
- `web-runner/modules/functionBank.js`: 8,478 lines

Current failing tests include mirror/parity expectations for enemy targeting, Kojonn green AOE, Faze skill-card behavior, and hero red single-target behavior.

Recommendation: avoid direct mirror edits unless the bead explicitly owns parity. Move deterministic decisions into shared `src/core/` or `web-runner/src/core/` modules, then make both mirrors thin callers.

### P1: Rust Simulation Core Needs Decomposition After Boundary Proof

Severity: high  
Interest: medium-high

`rust/simulation_core/src/lib.rs` is 4,527 lines. The migration landed a broad deterministic owner boundary, many packet fixtures, and a WASM artifact. That is good directionally, but the single Rust library file now concentrates many rule families in one place.

Recommendation: once the current red suite is stabilized, split Rust owner groups by domain: RNG, turn state, status effects, damage, targeting, and packet envelope.

### P2: Worktree and Report Surfaces Need Cleanup Discipline

Severity: medium  
Interest: medium

There are multiple active/preserved worktree lanes and `reports/` remains untracked. This is manageable, but it raises the chance of stale generated handoff files or accidental cross-lane edits.

Recommendation: keep tracker output in `reports/debt-report.md` and `reports/debt-actions.json`, but do not treat these as code health ground truth without a fresh scan. Clean preserved archive worktrees only one-by-one after merge/branch state is explicitly verified.

## Retrieval Receipt

- Tool used first: `jcodemunch-mcp` via `get_repo_health` and `get_symbol_importance`.
- jcodemunch result: unavailable for this repo because no index is loadable for `local/Codex-Orka`; the exposed tool surface did not include an indexing command.
- Fallback tool: bounded shell scans using `git`, `bd`, `find`, `wc`, `node --test`, and TAP filtering.
- Repo/query used: `/Users/Mace/Codex-Orka`, focused on live Beads state, git deltas since `9b15338`, largest files excluding `.worktrees`, current test health, and repo-local handoff files.
- Files/symbols retrieved: no full source-file reads for hot runtime code; report/config/memory files were read directly.
- Full-file reads avoided: yes for hot runtime code.
