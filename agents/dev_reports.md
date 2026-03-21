# Development Reports

Active handoff file only. Historical implementation reports live in `/agents/archive/dev_reports_archive.md` and should not be read during normal startup unless historical investigation is required.

## Template
- bead id:
- summary of changes:
- files modified:
- test evidence:
- scope confirmation:

## Recent Reports
- bead id: ORKA-tuin
- summary of changes: Follow-up hardened the new hot-file prepare/enforce flow so it can handle real `web-runner/app.js` commit lanes. The original strict function-only model came from the ORKA-9yo hot-file-lock policy and was later optimized in ORKA-qpff, but repo history and `ai-memory/insights.md` already showed the blind spot: top-level imports/constants/state-shape edits in hot files were valid work yet still uncommittable. The tooling now emits an explicit `__MODULE__` scope token for reviewed module-scope edits instead of failing those diffs as impossible.
- files modified: `tools/hot_file_scope.py`; `tools/test_hot_file_lock.sh`; `tools/README.md`; `governance/execution/beads-process.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `bash tools/test_hot_file_lock.sh` (6/6 pass)
  - `PYTHONPYCACHEPREFIX=/tmp/python-pyc python3 -m py_compile tools/hot_file_scope.py` (pass)
  - `tools/prepare_hot_file_commit.sh ORKA-tuin` on the current hot-file diff now succeeds and generates explicit `__MODULE__` scope instead of rejecting top-level `web-runner/app.js` edits
- scope confirmation: Confined to hot-file commit tooling and workflow semantics only. No runtime/gameplay rules changed in this follow-up.

- bead id: ORKA-tuin
- summary of changes: Replaced the iterative hot-file lock flow with a repo-owned prepare/enforce pipeline. Added `tools/prepare_hot_file_commit.sh` and shared parser/validator logic in `tools/hot_file_scope.py`, so staged hot-file diffs now generate `.scope` metadata automatically, active-bead misalignment can be corrected in one helper invocation, enforcement fails once with a single actionable prepare command when metadata is missing, and batched top-level/undeclared-function errors are reported in one pass instead of one commit attempt at a time.
- files modified: `tools/hot_file_scope.py`; `tools/prepare_hot_file_commit.sh`; `tools/enforce_hot_file_scope.sh`; `tools/test_hot_file_lock.sh`; `tools/README.md`; `governance/execution/beads-process.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `bash tools/test_hot_file_lock.sh` (6/6 pass)
- scope confirmation: Confined to repo-owned hot-file commit tooling, workflow docs, and coordination handoff only. No gameplay/runtime behavior, combat formulas, or browser harness ownership rules changed in this lane.

- bead id: ORKA-1qo
- summary of changes: Added a Playwright permission-preflight toolkit around the existing balance harness, then extended it with a direct-launch matrix. New `npm run playwright:doctor` probes distinguish direct-launch startup failures from CDP attach failures, new `npm run chrome:cdp` bootstraps a fresh external Chrome debug session for the supported path, new `npm run playwright:launch-matrix` compares Playwright-owned launch against plain Codex-owned Chrome child-process launch, and the balance harness now treats attached CDP browsers as externally owned by default instead of auto-closing the whole Chrome session.
- files modified: `tools/playwright_support.js`; `tools/playwright_doctor.js`; `tools/playwright_launch_matrix.js`; `tools/chrome_cdp_bootstrap.js`; `tools/balance_harness.js`; `package.json`; `tools/README.md`; `governance/qa/combat-playwright-control-model.md`; `ai-memory/insights.md`; `tests/playwrightSupportContract.test.js`; `tests/balanceHarnessCdpOwnershipContract.test.js`; `tests/playwrightLaunchMatrixContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `node --test tests/playwrightSupportContract.test.js tests/balanceHarnessCdpOwnershipContract.test.js` (5/5 pass)
  - `npm run playwright:doctor -- --json` classified bundled Chromium launch as `sandbox_browser_startup_denied` and recommended external Chrome + CDP attach for this Codex/macOS environment
  - `npm run playwright:doctor -- --only cdp --cdpUrl http://127.0.0.1:9222 --json` classified the missing external browser as `cdp_unreachable`
-  - `node --test tests/playwrightSupportContract.test.js tests/balanceHarnessCdpOwnershipContract.test.js tests/playwrightLaunchMatrixContract.test.js` (6/6 pass)
-  - `npm run playwright:doctor -- --only cdp --cdpUrl http://127.0.0.1:9222` passed (`cdp_attach: pass`, `Chrome/146.0.7680.80`)
-  - `npm run playwright:launch-matrix` showed both Playwright-owned launch and plain Codex-owned Chrome child-process launch failing, so the remaining hands-off regression is not Playwright-specific in this environment
-  - Playwright MCP browser smoke passed in this environment (`https://example.com` opened with a normal snapshot), which confirms the MCP inspection layer is healthy even while the repo harness direct-launch path remains blocked
- scope confirmation: Confined to Playwright tooling, harness browser-session ownership, and QA guidance for ORKA-1qo. No runtime combat logic, balance formulas, or gameplay rules changed.
- limitations: External Terminal-launched Chrome bootstrap plus Codex CDP attach is proven working, and Playwright MCP inspection is healthy in this environment. The unresolved lane is narrower: the repo harness direct-launch path still cannot start a Codex-owned Chrome process hands-off, so full batch launch autonomy is still blocked there.

- bead id: ORKA-wnjr
- summary of changes: Permanently hardened turn integrity around the dev-panel refresh seam. Added shared refresh-baseline exports for full transient turn state, made combat refresh reseed through one canonical reset helper, invalidated stale dev-tool pause snapshots by `CombatSessionId` / `TurnSerial`, and centralized deferred-advance eligibility behind one app-side predicate so refresh, enemy idle recovery, and action handoff all read the same turn contract.
- files modified: `src/core/turnGateController.mjs`; `web-runner/src/core/turnGateController.mjs`; `web-runner/app.js`; `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/turnGateRefreshBaselineContract.test.js`; `tests/devToolingTurnIntegrityContract.test.js`; `tests/turnSchedulerRepeatGuardContract.test.js`; `tests/turnTransientWriteGuardContract.test.js`; `tests/enemyLineClearRefillContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/turnGateRefreshBaselineContract.test.js tests/devToolingTurnIntegrityContract.test.js tests/turnSchedulerRepeatGuardContract.test.js tests/turnTransientWriteGuardContract.test.js tests/devToolingModalContract.test.js tests/yellowTurnHandoffContract.test.js tests/enemyTurnGateRecoveryContract.test.js tests/extraTurnHarnessContract.test.js tests/enemyLineClearRefillContract.test.js` (27/27 pass)
  - Canonical browser-path validation: `npm run balance-harness -- --sessions 1 --minWaves 1 --maxWaves 1` failed on the known Codex-owned Chrome startup seam (`browser_closed_before_control`) before page control
  - Canonical browser-path fallback: `BALANCE_CDP_URL=http://127.0.0.1:9222 npm run balance-harness -- --sessions 1 --minWaves 1 --maxWaves 1` completed `1/1` sessions and wrote updated artifacts to `output/balance-harness/`
  - Harness artifact check: `output/balance-harness/session_results.csv` ended `1,0,0,0,energy_depleted`
  - Focused Playwright turn-order scenario: `node output/playwright/turn_refresh_validation.js` via CDP fallback (`http://127.0.0.1:9222`) passed against the live local game URL. The dev-tool apply changed enemy slots, `CombatSessionId` advanced from `1` to `2`, the refreshed combat opened on an enemy turn, the captured sequence included `Skeleton -> Djinn -> Marid` enemy turns before handing back to heroes, and the sampled turn timeline contained no repeated actor across turn advances. Artifacts: `output/playwright/turn-refresh-validation.json`, `output/playwright/turn-refresh-validation.png`
- scope confirmation: Confined to turn-transient ownership, dev-panel combat refresh/reset behavior, deferred-advance gate evaluation, deterministic regression contracts, and runtime validation evidence. No balance formulas, skill weights, layout art, or unrelated gameplay systems changed.
- limitations: Direct Codex-owned harness launch is still blocked on the known Chrome startup seam, so both browser proofs currently rely on the existing CDP fallback path.

- bead id: ORKA-4dcz
- summary of changes: Hardened Djinn/Marid gem clears around named skill identity. `Enemy_Scathe` and `Enemy_Sweep` now route through explicit board-pressure skill harness profiles, so Scathe owns column-clear semantics and Sweep owns row-clear semantics while enemy AI remains responsible only for selecting the skill ID.
- files modified: `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/enemyLineClearContract.test.js`; `tests/enemyLineAxisContract.test.js`; `tests/enemyLineClearRefillContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/enemyLineClearContract.test.js tests/enemyLineAxisContract.test.js tests/enemyLineClearRefillContract.test.js` (8/8 pass)
- scope confirmation: Confined to Djinn/Marid line-clear skill ownership and direct harness coverage; no enemy AI weighting, board-pressure timing, or unrelated combat rules changed.
- insights check: No new reusable bug insight beyond the structural hardening itself; this lane was an architecture task, not a regression fix.

- bead id: ORKA-xtpi
- summary of changes: Reopened to verify the reported Marid row-clear regression. The runtime seams were still correct, but the existing tests only covered skill names and log text. Added a deterministic axis contract that proves Djinn removes a column and Marid removes a row in both mirrors, including the actual surviving cell coordinates.
- files modified: `tests/enemyLineAxisContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/enemyLineAxisContract.test.js tests/enemyLineClearContract.test.js tests/enemyLineClearRefillContract.test.js` (8/8 pass)
- scope confirmation: No gameplay/runtime logic changed in this pass. This lane added missing semantic coverage for the actual line-clear axis behavior.

- bead id: ORKA-xtpi
- summary of changes: Fixed the follow-on infinite-turn regression by giving Djinn/Marid line clears explicit board-pressure state. Enemy row/column clears now mark persistent pressure, generic refill gates ignore those holes until the player commits a real gem action, and deferred advance can still hand the turn off deterministically instead of looping the hero turn forever.
- files modified: `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `web-runner/app.js`; `tests/enemyLineClearRefillContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`; `ai-memory/insights.md`
- test evidence:
  - `npm test -- tests/enemyLineClearContract.test.js tests/enemyLineClearBoardSyncContract.test.js tests/enemyLineClearRefillContract.test.js tests/yellowTurnHandoffContract.test.js tests/enemyTurnGateRecoveryContract.test.js` (13/13 pass)
- scope confirmation: Confined to Djinn/Marid board-pressure state and the refill/advance gates that read it; no enemy damage rules, skill probabilities, or normal refill ownership were changed.

- bead id: ORKA-xtpi
- summary of changes: Reopened and corrected the Djinn/Marid line-clear behavior to match the actual gameplay intent. Enemy row/column clears now persist as board pressure instead of auto-refilling from the enemy-action completion seam, while the incomplete-board fallback guard remains intact.
- files modified: `web-runner/app.js`; `tests/enemyLineClearRefillContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`; `ai-memory/insights.md`
- test evidence:
  - `npm test -- tests/enemyLineClearContract.test.js tests/enemyLineClearBoardSyncContract.test.js tests/enemyLineClearRefillContract.test.js` (7/7 pass)
- scope confirmation: Confined to enemy line-clear refill timing and its regression contract; no enemy damage formulas, skill selection rates, or normal player-turn refill behavior changed.

- bead id: ORKA-890
- summary of changes: Closed the stale heal-punctuation bug on proof rather than runtime churn. Current heal combat emit paths in both mirrored function banks already end with `!`, so I added a narrow punctuation contract to keep that formatting from drifting.
- files modified: `tests/healCombatTextPunctuationContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/healCombatTextPunctuationContract.test.js tests/chimerilassHealCritContract.test.js` (4/4 pass)
- scope confirmation: No gameplay/runtime logic changed. This lane only added regression coverage for existing heal-text punctuation.
- insights check: No reusable future-facing insight beyond the contract itself; this was a stale-open formatting bead, not a systemic runtime failure.

- bead id: ORKA-3g5x
- summary of changes: Hardened Kojonn Power Amp delayed-hit accounting so queued hero-hit packets carry immutable final damage totals instead of relying solely on later recomputation. Added focused coverage for Kojonn's red single-target `INCINERATE` path at base, x2, and x3, and updated the app-side delayed-hit resolver to prefer queued `finalDmg` when present.
- files modified: `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `web-runner/app.js`; `tests/kojonnPowerAmpSingleContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`; `ai-memory/insights.md`
- test evidence:
  - `npm test -- tests/enemyLineClearContract.test.js tests/enemyLineClearBoardSyncContract.test.js tests/enemyLineClearRefillContract.test.js tests/kojonnAmpAoeContract.test.js tests/kojonnPowerAmpSingleContract.test.js` (10/10 pass)
- scope confirmation: Confined to delayed-hit Power Amp accounting and regression coverage for Kojonn attack packets; no unrelated hero formulas, targeting, or Power Amp lifecycle odds changed.


- bead id: ORKA-l8r
- summary of changes: Fixed the fallback game-loop ownership bug in `Scripts/logicCore.js`. The setInterval fallback now stores its interval handle, startup is idempotent, and `stopGameLoop()` clears either the fallback interval or the tracked tick-listener owner so restart/re-init flows can tear the loop down deterministically.
- files modified: `Scripts/logicCore.js`; `tests/logicCoreFallbackLoopContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/logicCoreFallbackLoopContract.test.js tests/partyFormationContract.test.js tests/devToolingLoadoutContract.test.js tests/enemyTurnGateRecoveryContract.test.js` (8/8 pass)
- scope confirmation: Confined to lifecycle ownership in `Scripts/logicCore.js`; no combat rules, rendering, or fallback cadence values changed.

- bead id: ORKA-d9g
- summary of changes: Added party formation mode inside `heroLayout` and wired it to the existing four-slot combat-party seam. The hero screen now has a formation toggle, available-roster cards, active-party slot buttons, deterministic assign/swap behavior, and runtime text export of the active slot package. Slot changes persist through `applyDevToolingConfig({ heroSlots })`, which is the same seam combat boot already reads.
- files modified: `web-runner/app.js`; `src/core/partyFormationRules.mjs`; `web-runner/src/core/partyFormationRules.mjs`; `tests/partyFormationContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/partyFormationContract.test.js tests/devToolingLoadoutContract.test.js tests/yellowTurnHandoffContract.test.js tests/enemyTurnGateRecoveryContract.test.js` (9/9 pass)
  - Real browser seam check via attached Chrome + Playwright `connectOverCDP()`: applying `heroSlots: ['Kojonn', 'Runa', 'Falie', 'Huun']` produced `render_game_to_text().heroScreen.activePartySlots = ['Kojonn','Runa','Falie','Huun']`
- scope confirmation: Confined to hero-screen formation UI and the existing `DevToolingConfig.heroSlots` persistence seam; no combat formulas or new party-state owner were introduced.

- bead id: ORKA-7c0.2
- summary of changes: Closed a stale-open hero-screen parity child after verifying the historical evidence pack still exists and the current `heroLayout` code still carries the locked `heroLayoutSpec`, portrait-frame removal, minus-icon orientation, and circular close-control details recorded in the bead comments.
- files modified: `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `ls test-results/ORKA-7c0.2`
  - `bd show ORKA-7c0.2`
  - `rg -n "heroLayoutSpec|minusIconImage" web-runner/app.js`
- scope confirmation: Queue reconciliation only. No new runtime code was required for this child bead in the current pass.

- bead id: ORKA-3go
- summary of changes: Closed the narrower enemy-turn actionable-state bead on the same runtime fix and validation evidence as `ORKA-dnm`. The shared enemy-turn idle-recovery gate prevents the exact leaked state this bead described (`TurnPhase === 2`, `IsPlayerBusy === 0`, `CanPickGems === 1`) and the attached-browser harness runs no longer timeout on enemy-turn actionable-state stalls.
- files modified: `src/core/turnGateController.mjs`; `web-runner/src/core/turnGateController.mjs`; `web-runner/app.js`; `tests/enemyTurnGateRecoveryContract.test.js`; `tests/yellowTurnHandoffContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/yellowTurnHandoffContract.test.js tests/enemyTurnGateRecoveryContract.test.js` (5/5 pass)
  - Attached-browser harness pass: `BALANCE_CDP_URL=http://127.0.0.1:9226 BALANCE_SESSION_COUNT=1 node tools/balance_harness.js --serverPort 8095 --maxWaves 1 --outputDir /tmp/orka-balance-dnm-cdp`
  - Fresh-profile attached-browser harness repeat: `BALANCE_CDP_URL=http://127.0.0.1:9227 BALANCE_SESSION_COUNT=1 node tools/balance_harness.js --serverPort 8095 --maxWaves 1 --outputDir /tmp/orka-balance-dnm-cdp-fresh`
- scope confirmation: No additional code beyond the `ORKA-dnm` runtime fix was required. This bead was a narrower duplicate statement of the same enemy-turn leak and was closed on shared evidence rather than a second divergent patch.

- bead id: ORKA-dnm
- summary of changes: Fixed the runtime enemy-turn idle leak instead of loosening the harness wait gate. Added a shared `createEnemyTurnIdleRecovery(...)` helper in both turn-gate modules, used it when an enemy action aborts mid-animation, and added an app-side recovery branch for the exact leaked enemy-idle state (`TurnPhase === 2`, no action in progress, no pending skill, leaked pickability or missing deferred advance). This keeps enemy turns non-pickable and forces deterministic deferred advance instead of parking the harness on a false deadlock.
- files modified: `src/core/turnGateController.mjs`; `web-runner/src/core/turnGateController.mjs`; `web-runner/app.js`; `tests/enemyTurnGateRecoveryContract.test.js`; `tests/yellowTurnHandoffContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/yellowTurnHandoffContract.test.js tests/enemyTurnGateRecoveryContract.test.js` (5/5 pass)
  - Attached-browser harness pass: `BALANCE_CDP_URL=http://127.0.0.1:9226 BALANCE_SESSION_COUNT=1 node tools/balance_harness.js --serverPort 8095 --maxWaves 1 --outputDir /tmp/orka-balance-dnm-cdp`
  - Fresh-profile attached-browser harness repeat: `BALANCE_CDP_URL=http://127.0.0.1:9227 BALANCE_SESSION_COUNT=1 node tools/balance_harness.js --serverPort 8095 --maxWaves 1 --outputDir /tmp/orka-balance-dnm-cdp-fresh`
  - Both harness outputs ended on `energy_depleted` without the old enemy-turn actionable-state timeout, and both debug ports were closed afterward (`curl http://127.0.0.1:9226/json/version` and `curl http://127.0.0.1:9227/json/version` both failed after run completion).
- scope confirmation: Confined to enemy-turn progression recovery and its deterministic contract coverage only. The harness wait predicate was intentionally left strict; the fix lands in the runtime seam the harness was exposing.

- bead id: ORKA-8w4u
- summary of changes: Reopened the coordination-guidance lane to remove the hard unresolved-issue count gate from the PM and dev prompt specs. Unresolved issues still inform prioritization and bead hygiene, but they no longer freeze ready-bead selection or active work purely because the issue list is long.
- files modified: `agents/prompts/pm_agent.md`; `agents/prompts/dev_agent.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `rg -n "Issue Accumulation Guard|hard stop|do not create a hard stop|do not create a hard stop on active work" agents/prompts/pm_agent.md agents/prompts/dev_agent.md`
  - `bd show ORKA-8w4u`
- scope confirmation: Confined to governance/prompt policy only. No gameplay/runtime code, bead acceptance, or browser/test harness logic changed.

- bead id: ORKA-xtpi
- summary of changes: Verified the Djinn/Marid line-clear path still behaves correctly: line clears remove options temporarily, the app-side gem sync rebuilds board occupancy immediately, and the main loop starts refill whenever empty slots remain. Added focused regression coverage that simulates a line-clear style gem removal and proves `startRefillBounce()` queues the missing cells, while also reasserting that the older incomplete-board fallback guard for `Scathe` / `Sweep` is still intact in both mirrored function-bank files.
- files modified: `tests/enemyLineClearRefillContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/enemyLineClearContract.test.js tests/enemyLineClearBoardSyncContract.test.js tests/enemyLineClearRefillContract.test.js` (7/7 pass)
- scope confirmation: Verification-only lane. No runtime gameplay code changed because the refill path and the anti-unplayable fallback guard were already intact.
- insights check: No new reusable insight was needed beyond the existing line-clear seam guidance; this lane confirmed the current refill and fallback contracts still hold.

- bead id: ORKA-av1q
- summary of changes: Added an AOE-specific hero lunge profile so green match attacks get extra hold/return breathing room without slowing single-target actions. `HERO_AOE` now tags the next hero action as `aoe`, `StartHeroLunge(...)` stores that profile, AOE casts hold longer and retreat longer in the app renderer, and AOE hit landing is delayed further so the green match presentation no longer crowds the flinch beat.
- files modified: `web-runner/app.js`; `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/lungeMotionContract.test.js`; `tests/kojonnAmpAoeContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/lungeMotionContract.test.js tests/extraTurnHarnessContract.test.js tests/kojonnAmpAoeContract.test.js` (9/9 pass)
- scope confirmation: Confined to `HERO_AOE` lunge/return pacing and delayed impact timing only; green attack damage, blight totals, targeting, and non-AOE hero actions were intentionally left unchanged.

- bead id: ORKA-7clz
- summary of changes: Added an explicit impact handoff delay between the attacker lunge and defender flinch/damage beat. Hero-hit scheduling in both mirrored function banks now waits until the longer forward lunge plus a short settle gap, the follow-up lunge anchor uses the same delayed handoff, and the session/combat renderer starts hit-state flashes later so the beats read as a smooth relay instead of a collision.
- files modified: `web-runner/app.js`; `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/lungeMotionContract.test.js`; `tests/extraTurnHarnessContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/lungeMotionContract.test.js tests/extraTurnHarnessContract.test.js` (7/7 pass)
- scope confirmation: Confined to presentation pacing and hit scheduling handoff only; damage values, target logic, and combat outcomes were intentionally left unchanged.

- bead id: ORKA-gc68
- summary of changes: Added a midpoint clamp to actor lunge targets so neither side can push past the combat centerline on x. Hero and enemy lunge timing stayed the same; only the maximum forward destination is now bounded by the midpoint in both the combat state machine and the idle/session renderer.
- files modified: `web-runner/app.js`; `tests/lungeMotionContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/lungeMotionContract.test.js tests/extraTurnHarnessContract.test.js` (7/7 pass)
- scope confirmation: Confined to lunge destination clamping only; no damage rules, turn ownership, or follow-up timing totals changed in this tweak lane.

- bead id: ORKA-x7gh
- summary of changes: Reduced hero-only forward lunge travel to 85% of the shared 200px distance so heroes stop overlapping enemies as aggressively. Enemy lunge distance and the shared 750ms forward-bezier timing stayed unchanged.
- files modified: `web-runner/app.js`; `tests/lungeMotionContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/lungeMotionContract.test.js tests/extraTurnHarnessContract.test.js` (7/7 pass)
- scope confirmation: Confined to hero lunge presentation distance only; enemy travel, combat timing totals, and damage logic were intentionally left unchanged in this tweak lane.

- bead id: ORKA-nri9
- summary of changes: Updated the shared actor lunge presentation to use a 200px forward travel with a 750ms forward phase driven by the requested `cubic-bezier(1, 0, 0, 1)` curve. Applied the same motion profile to combat heroes, combat enemies, and the idle/session lunge renderer, and extended the mirrored follow-up timing totals so double-attack scheduling still waits for the longer lunge window.
- files modified: `web-runner/app.js`; `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/lungeMotionContract.test.js`; `tests/extraTurnHarnessContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/lungeMotionContract.test.js tests/extraTurnHarnessContract.test.js` (7/7 pass)
  - `node --check web-runner/app.js` is not a valid syntax check in this repo because the file is ESM while the package is CommonJS; the import-mode failure is expected and was not used as a regression signal.
- scope confirmation: Confined to actor lunge presentation/timing only; damage rules, target selection, and unrelated combat state transitions were not intentionally changed in this lane.

- bead id: ORKA-tvn5
- summary of changes: Fixed Djinn/Marid line-clear recovery by moving board-occupancy resync into the app-owned `fnContext.setGems(...)` seam. When runtime modules replace the gem array after a line-clear, the app now rebuilds `gameState.grid` immediately so refill/pickability logic sees real empty slots instead of a stale full board. Added focused contract coverage for the sync seam and a deterministic execution test that simulates a line-clear style gem replacement.
- files modified: `web-runner/app.js`; `tests/enemyLineClearBoardSyncContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/enemyLineClearContract.test.js tests/enemyLineClearBoardSyncContract.test.js tests/townLayoutFlowContract.test.js` (5/5 pass)
  - Browser/runtime validation attempted with Playwright tooling, but local Chrome launch is blocked in this sandbox (`SIGABRT` / session-cache permission failures), so deterministic execution coverage was used instead.
- scope confirmation: Confined to the app-owned gem sync seam that runtime module mutations already use; no enemy skill selection rules, combat formulas, or unrelated board-processing phases changed.

- bead id: ORKA-t2h3
- summary of changes: Traced the encounter randomization collapse to `EncounterPoolNames` being set from the initial selected picks instead of the broader eligible locale/faction pool. Added `deriveEncounterPoolNames(...)`, kept manual enemy-slot runs pinned to their explicit picks, and restored broad candidate diversity for normal respawns with deterministic helper coverage.
- files modified: `web-runner/app.js`; `tests/encounterPoolDiversityContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/encounterPoolDiversityContract.test.js tests/townLayoutFlowContract.test.js tests/idleFarmEnergyCollectContract.test.js tests/idleFarmForcedEnemyNamesContract.test.js` (6/6 pass)
- scope confirmation: Confined to encounter candidate-pool caching for normal runtime respawns only; manual enemy-slot overrides still preserve their explicit picks, and no combat formulas or locale-tag normalization rules changed.

- bead id: ORKA-47nj
- summary of changes: Unified combat fail exits so both energy depletion and party wipe return to layout 0 (`storyMock`), and converted idle-farm collect rewards from the old gold ledger into real player energy with backward-compatible migration for legacy stored reward state. Added focused regression coverage for idle energy collect behavior and updated the town/fail-route contract accordingly.
- files modified: `web-runner/src/core/idleFarmRuntime.mjs`; `web-runner/app.js`; `tests/idleFarmEnergyCollectContract.test.js`; `tests/townLayoutFlowContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/idleFarmEnergyCollectContract.test.js tests/idleFarmForcedEnemyNamesContract.test.js tests/idleFarmLayoutScaffoldContract.test.js tests/devToolingLoadoutContract.test.js tests/townLayoutFlowContract.test.js` (7/7 pass)
- scope confirmation: Confined to combat fail-exit routing and idle reward-to-energy ownership only; no unrelated combat formulas, town entry flow, or token wallet rules changed.

- bead id: ORKA-pa1z
- summary of changes: Restored the idle forced-enemy-name respawn seam by rehydrating `session.forcedEnemyNames` inside the session update path before delayed enemy respawns occur. Added a focused regression contract so idle session updates preserve forced loadouts and do not crash after layout entry.
- files modified: `web-runner/src/core/idleFarmRuntime.mjs`; `tests/idleFarmForcedEnemyNamesContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/devToolingLoadoutContract.test.js tests/idleFarmLayoutScaffoldContract.test.js tests/idleFarmForcedEnemyNamesContract.test.js` (4/4 pass)
- scope confirmation: Confined to the idle runtime forced-enemy-name respawn seam only; no idle autoplay priority, reward cadence, or dev-panel write behavior changed.

- bead id: ORKA-3nlw
- summary of changes: Inventoried the dirty worktree and reduced it to three actionable buckets with explicit save/wait guidance. The current tree is dominated by Beads mirror reconciliation plus governance-log cleanup, with one separate runtime/test bundle that should not be mixed into the governance patch.
- files modified: `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `git status --short`
  - `git diff --name-only`
  - `git diff --cached --name-only`
  - `git status --short | awk '{print $2}' | cut -d/ -f1 | sort | uniq -c`
- scope confirmation: Planning/inventory only. No gameplay/runtime behavior changed in this lane.

- cleanup buckets:
  - Bucket A, save now: Beads mirror + governance coordination cleanup
    - `.beads/**` mirror deletions/additions from live-`bd` reconciliation
    - `AGENTS.md`
    - `agents/dev_reports.md`
    - `agents/pm_status.md`
    - `agents/issues.md`
    - `agents/prompts/dev_agent.md`
    - `agents/prompts/pm_agent.md`
    - `governance/**`
    - `agents/archive/**`
  - Bucket B, wait: runtime/test bug-fix bundle
    - `web-runner/src/core/idleFarmRuntime.mjs`
    - `tests/idleFarmForcedEnemyNamesContract.test.js`
    - `ai-memory/insights.md`
    - rationale: this is real runtime/test work and should close under its owning bug bead, not be buried inside governance cleanup
  - Bucket C, save with Bucket A as a rename, not as independent churn
    - `governance/qa/orka-3j6/**` deletions
    - `governance/qa/hero-layout-qa-packet/**` additions
    - rationale: this is one QA packet rename/retitle and should be preserved as a single governance move

- commit order:
  - 1. Commit Bucket A plus Bucket C together as governance/coordination cleanup
  - 2. Re-run `git status --short` and confirm only Bucket B remains
  - 3. Validate/runtime-close the owning bug lane for Bucket B, then commit that runtime/test bundle separately

- what should wait versus save now:
  - Save now: all `.beads`, agent-policy, archive, planning, and QA-packet rename work
  - Wait: `idleFarmRuntime.mjs`, `idleFarmForcedEnemyNamesContract.test.js`, and the related `ai-memory/insights.md` changes until the owning runtime bead is explicitly reviewed/closed

- bead id: ORKA-8w4u
- summary of changes: Split historical coordination history out of the active PM/dev guidance files. Archived the full pre-trim `agents/pm_status.md` and `agents/dev_reports.md` into `/agents/archive/`, rewrote the active files as current-state documents only, and updated repo workflow prompts/rules so future cycles keep the active files concise instead of appending rolling history forever.
- files modified: `agents/archive/pm_status_archive.md`; `agents/archive/dev_reports_archive.md`; `agents/pm_status.md`; `agents/dev_reports.md`; `AGENTS.md`; `agents/prompts/pm_agent.md`; `agents/prompts/dev_agent.md`; `governance/execution/beads-process.md`
- test evidence:
  - `wc -l agents/pm_status.md agents/dev_reports.md agents/archive/pm_status_archive.md agents/archive/dev_reports_archive.md agents/prompts/pm_agent.md agents/prompts/dev_agent.md`
  - `rg -n "archive/pm_status_archive|archive/dev_reports_archive|current snapshot only|current/recent" AGENTS.md agents/prompts/pm_agent.md agents/prompts/dev_agent.md governance/execution/beads-process.md agents/pm_status.md agents/dev_reports.md`
  - `git diff --stat -- agents/pm_status.md agents/dev_reports.md agents/archive/pm_status_archive.md agents/archive/dev_reports_archive.md AGENTS.md agents/prompts/pm_agent.md agents/prompts/dev_agent.md governance/execution/beads-process.md`
- scope confirmation: Confined to coordination/governance file structure only. No gameplay/runtime code or product behavior changed.

- bead id: ORKA-zys
- summary of changes: Reconciled the repo-side `.beads/open` and `.beads/in_progress` mirrors against live `bd` state, removed stale cache entries, added missing live entries, and moved `ORKA-zys`/`ORKA-y5x` into the correct mirrored status directories so local governance artifacts no longer disagree with live queue state.
- files modified: `.beads/open/*.md`; `.beads/in_progress/*.md`; `agents/dev_reports.md`; `agents/pm_status.md`; `agents/issues.md`
- test evidence:
  - `bd list --status open`
  - `bd list --status in_progress`
  - `bd ready`
  - mirror-vs-live `comm` diff for `.beads/open` vs live open ids (empty after reconciliation)
  - mirror-vs-live `comm` diff for `.beads/in_progress` vs live in-progress ids (empty after reconciliation)
- scope confirmation: Confined to mirror/governance reconciliation only. No gameplay/runtime code or product rules were changed.
