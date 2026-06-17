# app.js Decomposition and Guardrail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore `web-runner/app.js` to a strict app-shell role: start the runtime, build dependency objects, wire owner modules together, register top-level browser listeners, expose the debug facade, and nothing else.

**Architecture:** This is not a line-count cleanup. First make the rules enforceable, then migrate tests that currently pin logic to `app.js`, then extract closure-bound behavior in small owner-correct slices. Every slice must reduce or preserve `app.js` responsibility while keeping behavior unchanged.

**Tech Stack:** Browser ESM, Node `node --test`, Beads, Git worktrees, existing `web-runner` systems/modules/core boundaries, Codex in-app Browser QA, hot-file scope tooling.

---

## Hostile Review Verdict

The first draft was not launchable.

Two read-only antagonist agents challenged it from different directions:

- Technical reviewer: the plan treated extraction as simple function moves, but the biggest `app.js` blocks are closure-bound and source-test-bound.
- Governance reviewer: the AGENTS rules describe the desired shape, but they do not create hard stop points, so agents can keep bloating `app.js` while technically obeying scoped hot-file rules.

## Current Evidence

- Existing planning bead: `ORKA-yib8.1`.
- `ORKA-yib8.1` is planning-only. Its acceptance criteria say extraction seams and validation gates only; no code refactor.
- Current `web-runner/app.js` size: 7,607 lines.
- `jcodemunch-mcp digest` flags:
  - `web-runner/app.js::main` as top repo hotspot, cyclomatic 1375, churn 102.
  - `main.handlePointerDown` as a hotspot, cyclomatic 310.
  - `main.tick` as a hotspot, cyclomatic 155.
- `bd show ORKA-yib8.1` separately cites earlier Fallow evidence: `handlePointerDown`, `tick`, and `initEntities` are dangerous refactor territory.
- `rg -n "app\\.js" tests | wc -l` currently reports 109 direct test references to `app.js`.
- `git config --get core.hooksPath` produced no hook path in this checkout.
- `.git/hooks/pre-commit` is not executable/present in this checkout.
- `.beads/hooks/pre-commit` and `tools/hot_file_scope.py` enforce hot-file scope metadata, but only by changed function range. They do not prevent wrong ownership inside `app.js`.

## Why Codex Keeps Bloating app.js

The irreducible failure has four parts:

1. The rules are descriptive, not executable.
   `AGENTS.md` says `app.js` is orchestration-only and should stay thin, but it does not define a pass/fail gate.

2. The hot-file guard protects collision scope, not architecture.
   A commit can declare `handlePointerDown` or `tick` and still add more behavior inside those giant functions.

3. Tests reward keeping internals in `app.js`.
   Many contracts assert exact strings or function bodies inside `app.js`, so an agent trying to pass tests is pushed toward patching `app.js` instead of moving ownership out.

4. Emergency feature/bug fixes land where the state is visible.
   Since `app.js` has the closure variables, debug facade, canvas listeners, layout state, and runtime calls in one place, it is the lowest-friction patch target unless the plan forces dependency extraction first.

## app.js Allowlist and Denylist

Allowed in `web-runner/app.js` after this work:

- imports
- DOM element lookup for the top-level canvas/output surfaces
- top-level runtime dependency construction
- calls to owner-module factories/installers
- top-level browser listener registration that delegates immediately
- runtime startup sequencing
- debug/test facade that delegates to owner modules

Not allowed in `web-runner/app.js` after this work:

- feature state
- business/gameplay rules
- dev-tool modal DOM construction
- localStorage/sessionStorage wrappers
- JSON/cache-bust/asset loading helpers
- layout-specific click behavior
- gem/supergem selection behavior
- combat entity construction
- per-frame turn/refill/enemy-action logic
- deterministic decisions that belong in `web-runner/src/core`, root `src/core`, Rust SimulationCore, or functionBank owners

## Launch Blockers

Implementation must not start until all are true:

- A new child implementation bead exists. Do not implement under `ORKA-yib8.1`.
- The implementation bead has a bead-scoped branch/worktree.
- `web-runner/AGENTS.md` and `web-runner/systems/AGENTS.md` contain concrete `app.js` allowlist/denylist guidance.
- A source-test inventory exists for every current test that reads `web-runner/app.js`.
- An app-shell ratchet test exists before runtime extraction begins.
- Hot-file enforcement is actually active for the chosen worktree, either through `.git/hooks/pre-commit`, `core.hooksPath`, or an explicit CI/manual gate in the launch checklist.
- Feature-bead additions to `web-runner/app.js` are frozen while decomposition is active, unless the owner explicitly authorizes an emergency patch.

## Target Ownership

- `web-runner/app.js`: startup shell and composition wiring only.
- `web-runner/systems/devToolingControls.js`: dev config, modal DOM, modal events, pause/resume, restart/autoplay glue.
- `web-runner/systems/pointerRouter.js`: pointer route selection and delegation.
- `web-runner/systems/inputHandling.js`: low-level browser pointer/map drag helpers.
- `web-runner/systems/runtimeTickLoop.js`: restart-safe RAF loop wrapper and frame-step orchestration.
- `web-runner/modules/runtimeEntityInitialization.js`: combat session/entity envelope setup.
- `web-runner/systems/runtimeAssetLoading.js`: browser JSON/asset loading and startup load state.
- `web-runner/src/core/*.mjs`: deterministic browser-shipped rule helpers, with no DOM/localStorage/network.

## Rollback Model

- Use the new implementation bead id in all branches, tags, commits, and hot-file scope files.
- Create a rollback tag before the first runtime edit:

```bash
git tag rollback/pre-<BEAD_ID>-appjs-decomposition-$(date -u +%Y%m%d-%H%M%S) HEAD
```

- Before each extraction slice, preserve the current hot file:

```bash
mkdir -p /private/tmp/orka-appjs-decomp
cp web-runner/app.js /private/tmp/orka-appjs-decomp/app.$(date -u +%Y%m%d-%H%M%S).js
git diff -- web-runner/app.js > /private/tmp/orka-appjs-decomp/app.$(date -u +%Y%m%d-%H%M%S).diff
shasum -a 256 web-runner/app.js > /private/tmp/orka-appjs-decomp/app.sha256
```

- Each slice ends in one small commit containing `bd-<BEAD_ID>`.
- Roll back a failed slice with `git revert <slice-commit>`.
- Do not use `git reset --hard`.

## Baseline Validation Gate

Run before first edit, after every slice, and before merge:

```bash
git status --short
node --test tests/appShellDecompositionContract.test.js
node --test tests/devToolingModalContract.test.js tests/devToolingTurnIntegrityContract.test.js tests/devToolingLoadoutContract.test.js tests/devToolingBoardOverrideContract.test.js
node --test tests/combatNavClickGateContract.test.js tests/mapCloseControlContract.test.js tests/lockedGemInteractionContract.test.js tests/superGemInteractionPacingContract.test.js
node --test tests/skillDraughtDevPanelContract.test.js tests/partyFormationContract.test.js tests/enemyTargetSelectionOwnershipContract.test.js tests/combatRuntimeRngOwnershipContract.test.js
node --test tests/partyRegenTickOwnershipContract.test.js tests/enemyTurnGateRecoveryContract.test.js tests/yellowTurnHandoffContract.test.js tests/idleAutoplaySelectionBypassContract.test.js tests/idleAutoplayPriorityGemContract.test.js
node --test tests/startupAssetLoadPerfContract.test.js
npm run test:hot-file-gate
git diff --check
```

Browser QA:

```bash
npm run serve:qa
```

Use the Codex in-app Browser against `http://127.0.0.1:8000/web-runner/` and verify:

- boot has no console errors
- `window.__codexGame` exists and exposes expected debug hooks
- dev tooling opens, applies config, restarts, closes, and resumes input
- map/base/combat transitions work
- idle farm collect/restart/back buttons route correctly
- combat nav, pending enemy target, gem selection, supergem selection, refill, enemy turn, skill draught claim, and yellow handoff all still work
- no duplicate pointer listeners or duplicate RAF loops after restart/refresh

## Task 0: Planning Bead Closeout

**Files:**
- Modify: `docs/superpowers/plans/2026-06-14-app-js-decomposition-rollback-plan.md`

- [ ] Confirm `bd show ORKA-yib8.1` still says planning-only.
- [ ] Attach this revised plan to `ORKA-yib8.1` as evidence.
- [ ] Create a new child implementation bead for code work.
- [ ] Do not mark the child bead `in_progress` until Tasks 1-3 below are ready to execute.

## Task 1: Make AGENTS Rules Computable

**Files:**
- Modify: `web-runner/AGENTS.md`
- Modify: `web-runner/systems/AGENTS.md`
- Optional modify: `tests/AGENTS.md`

- [ ] Add the `app.js` allowlist/denylist from this plan to `web-runner/AGENTS.md`.
- [ ] Add systems ownership for `pointerRouter.js`, `runtimeTickLoop.js`, and `runtimeAssetLoading.js` to `web-runner/systems/AGENTS.md` once those files are created or committed in the same slice.
- [ ] Add test guidance: new contracts should not assert that business/dev/UI internals live in `app.js`.
- [ ] Validation: `git diff --check`.

## Task 2: Add app-shell Ratchet Before Extraction

**Files:**
- Create: `tests/appShellDecompositionContract.test.js`
- Optional modify: `package.json` only if adding a named script is chosen.

- [ ] Add a test that fails on net new `app.js` functions unless allowlisted.
- [ ] Add a test that fails on net `app.js` line growth from the recorded baseline during this bead.
- [ ] Add a test that fails on new direct `app.js` source assertions in tests unless they are listed in an inventory file.
- [ ] Add a test that verifies `app.js` imports and delegates to each owner module after that owner module is introduced.
- [ ] Run `node --test tests/appShellDecompositionContract.test.js`.

## Task 3: Inventory app.js Source Assertions

**Files:**
- Create: `docs/superpowers/plans/2026-06-14-app-js-source-assertion-inventory.md`
- Modify: tests only when moving an assertion to its new owner.

- [ ] Enumerate every test file that reads `web-runner/app.js`.
- [ ] Classify each assertion:
  - `stays-app-shell`: import/wiring/debug facade/startup only.
  - `moves-with-owner`: update the assertion to the extracted module in the same slice.
  - `rewrite-behavior`: replace brittle source shape with module-level behavior or Browser QA.
- [ ] Do not move runtime code until the affected tests for that slice have a destination classification.

## Task 4: Dev Tooling Extraction, Split Into Three Slices

**Files:**
- Modify: `web-runner/app.js`
- Modify: `web-runner/systems/devToolingControls.js`
- Modify tests classified from `tests/devToolingModalContract.test.js`, `tests/devToolingTurnIntegrityContract.test.js`, `tests/devToolingLoadoutContract.test.js`, `tests/devToolingBoardOverrideContract.test.js`

- [ ] Slice 4A: move dev constants, config defaults, sanitize/read/persist/clear helpers.
- [ ] Slice 4B: move modal DOM factory and modal event binding.
- [ ] Slice 4C: move pause/resume/refresh/restart/autoplay behavior.
- [ ] Keep turn-gate restoration and hard restart semantics unchanged.
- [ ] Browser QA after each slice.
- [ ] Commit each slice separately.

## Task 5: Pointer Routing Extraction, Split Into Small Slices

**Files:**
- Modify: `web-runner/app.js`
- Modify: `web-runner/systems/inputHandling.js`
- Create: `web-runner/systems/pointerRouter.js`
- Modify tests classified from `tests/combatNavClickGateContract.test.js`, `tests/mapCloseControlContract.test.js`, `tests/lockedGemInteractionContract.test.js`, `tests/superGemInteractionPacingContract.test.js`

- [ ] Slice 5A: extract pointer-down coordinate adapter without changing map drag move coordinates.
- [ ] Slice 5B: extract non-combat layout clicks: story, town, idle farm, map close/back.
- [ ] Slice 5C: extract combat nav and pending-target routing.
- [ ] Slice 5D: extract gem, supergem, overlay, and modal-dismiss routing.
- [ ] Router may choose routes and call callbacks; it must not become a gameplay owner.
- [ ] Browser QA after each slice.
- [ ] Commit each slice separately.

## Task 6: Entity Initialization Extraction

**Files:**
- Modify: `web-runner/app.js`
- Create: `web-runner/modules/runtimeEntityInitialization.js`
- Modify tests classified from `tests/skillDraughtDevPanelContract.test.js`, `tests/partyFormationContract.test.js`, `tests/enemyTargetSelectionOwnershipContract.test.js`, `tests/combatRuntimeRngOwnershipContract.test.js`

- [ ] Define an explicit dependency object for initialization instead of reaching through `app.js` closure variables.
- [ ] Preserve skill draught clear/reset order.
- [ ] Preserve runtime RNG install/reset order.
- [ ] Preserve dev enemy slot behavior.
- [ ] Preserve all `state.globals` and `state.entities` shapes.
- [ ] Do not touch mirrored functionBank rules.
- [ ] Browser QA: dev restart with multiple party/enemy configs.

## Task 7: Asset Loading Extraction

**Files:**
- Modify: `web-runner/app.js`
- Create: `web-runner/systems/runtimeAssetLoading.js`
- Modify tests classified from `tests/startupAssetLoadPerfContract.test.js`

- [ ] Treat this as stateful browser loading, not pure helper extraction.
- [ ] Move JSON fetch/cache-bust/fallback code.
- [ ] Move startup asset load status helpers.
- [ ] Preserve load failure messages and HUD loading text.
- [ ] Keep network/browser behavior out of `src/core`.
- [ ] Browser QA: hard refresh and verify bootstrap completes.

## Task 8: Runtime Tick Loop Extraction, Last

**Files:**
- Modify: `web-runner/app.js`
- Create: `web-runner/systems/runtimeTickLoop.js`
- Modify tests classified from tick-related contracts.

- [ ] Slice 8A: introduce `createRuntimeTickLoop({ step, requestFrame, cancelFrame })` with `start()` and `stop()`; keep existing `tick` internals in `app.js`.
- [ ] Slice 8B: move bootstrap transition and hero-input restore step.
- [ ] Slice 8C: move skill draught claim and refill barrier step.
- [ ] Slice 8D: move deferred advance/enemy action recovery step.
- [ ] Slice 8E: move render/persist/frame scheduling step.
- [ ] Prove single-RAF behavior after restart/refresh.
- [ ] Browser QA after each slice.
- [ ] Commit each slice separately.

## Task 9: Final Guardrail Hardening

**Files:**
- Modify: `tests/appShellDecompositionContract.test.js`
- Modify: `web-runner/AGENTS.md`
- Modify: `web-runner/systems/AGENTS.md`
- Optional modify: `tools/hot_file_scope.py`

- [ ] Lower the app-shell ratchet to the new post-extraction baseline.
- [ ] If feasible in this bead, make `tools/hot_file_scope.py` treat `web-runner/app.js` specially by rejecting module-scope growth and requiring owner-module declarations.
- [ ] Verify hook availability in the implementation worktree:

```bash
git config --get core.hooksPath
test -x .git/hooks/pre-commit
```

- [ ] If hooks are still not wired, final handoff must state the explicit manual gate commands required before commit/merge.
- [ ] Run the full baseline validation gate and Browser QA.

## Stop Conditions

- The active bead is still `ORKA-yib8.1`.
- Any touched hot file has unrelated dirty changes.
- A slice needs gameplay behavior changes to pass.
- A slice needs `Scripts/functionBank.js` parity changes.
- `renderRuntime.js` generated-body cleanup becomes necessary.
- Tests still require moved internals to remain in `app.js`.
- Browser QA shows a regression that cannot be isolated to the current slice quickly.
- The extraction merely moves bloat into the wrong owner.

## Retrieval Receipt

- Tool used: `jcodemunch-mcp digest`.
- Repo/query used: `mdtrahan/wishfire-game`, hotspot digest for current repo.
- Files/symbols retrieved: `web-runner/app.js::main`, `main.handlePointerDown`, `main.tick`, plus risk surface around `renderRuntime`.
- If not `jcodemunch-mcp`, why not: not applicable.
- Full-file reads avoided: yes for indexed retrieval; focused shell reads inspected AGENTS, hooks, tests, and selected `app.js` line ranges.
