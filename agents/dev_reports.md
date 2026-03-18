# Development Reports

## Template
- bead id:
- summary of changes:
- files modified:
- test evidence:
- scope confirmation:

## Reports
- (append newest report at top)
- bead id: ORKA-5mt
- summary of changes: Aligned idle-combat hit flashes with the approved full-combat black flash by replacing the idle-only white invert filter with the same black overlay treatment and lowering idle sprite flash alpha to the same neutral value used in runtime combat. Added focused contract coverage so idle and full combat cannot silently drift apart again.
- files modified: web-runner/app.js; tests/hitFlashFeedbackContract.test.js; ai-memory/insights.md
- test evidence:
  - `npm test -- tests/hitFlashFeedbackContract.test.js tests/idleFarmLayoutScaffoldContract.test.js` (4/4 pass)
- scope confirmation: confined to idle-combat hit-flash presentation parity with existing full-combat black flash behavior; no idle timing, reward, or attack logic changed in this lane.

- bead id: ORKA-7kt / ORKA-1ys / ORKA-ws3p / ORKA-3as (source recovery)
- summary of changes: Recovered `web-runner/app.js` from an unreachable local Git blob that still contained the DOM-based developer tooling modal, `AstralFlow -> idleFarmLayout` wiring, `storyMock -> town -> combat` recovery flow, and the escort-party scaffold seam. Replaced the incorrect interim canvas dev-panel reconstruction with the recovered DOM implementation and restored targeted contracts for each recovered lane.
- files modified: web-runner/app.js; tests/devToolingModalContract.test.js; tests/idleFarmLayoutScaffoldContract.test.js; tests/townLayoutFlowContract.test.js; tests/escortPartyScaffoldContract.test.js
- test evidence:
  - `npm test -- tests/devToolingModalContract.test.js tests/idleFarmLayoutScaffoldContract.test.js tests/townLayoutFlowContract.test.js tests/escortPartyScaffoldContract.test.js` (4/4 pass)
  - `curl -I http://127.0.0.1:8095/web-runner/index.html` returned `HTTP/1.1 200 OK`
- scope confirmation: confined to source recovery of previously lost runtime lanes already documented in project reports; no new speculative dev-panel design, idle-farm behavior, town semantics, or escort rules were invented in this pass.

- bead id: ORKA-7kt (recovery shell)
- summary of changes: Restored the missing global dev tooling modal shell in `web-runner/app.js` with `Ctrl+Shift+P` / `Esc` toggle behavior, serialized config state in `state.globals.DevToolingConfig`, a minimal canvas-rendered recovery panel, and matching `render_game_to_text` / `window.__codexGame` exposure so later recovery lanes can build back on a visible debug surface.
- files modified: web-runner/app.js; tests/devToolingModalContract.test.js; ai-memory/insights.md
- test evidence:
  - `npm test -- tests/devToolingModalContract.test.js` (1/1 pass)
  - `curl -I http://127.0.0.1:8095/web-runner/index.html` returned `HTTP/1.1 200 OK`
  - attempted Playwright runtime smoke via the local skill wrapper against `http://127.0.0.1:8095/web-runner/index.html`, but Chrome launch remains blocked in-session by the known crashpad/bootstrap permission failure (`bootstrap_check_in ... Permission denied (1100)`)
- scope confirmation: confined to ORKA-7kt recovery of the developer tooling modal shell and debug-surface exposure in `web-runner/app.js`; no idle-farm routing, town flow, or combat-rule behavior was rebuilt in this pass.

- bead id: ORKA-1ys
- summary of changes: Replaced the old astral/layout-2 stub with a battle-first `idleFarmLayout` that stages a fake Falie/Kojonn idle skirmish instead of a text dashboard. The runtime now routes the existing `AstralFlow` combat nav into a 16:9 mock battle scene, drives the scripted two-hit enemy flow through the reusable module seam in `web-runner/src/core/idleFarmRuntime.mjs`, spawns enemies one-by-one with a 1.5 second delay after death, alternates leisurely hero strikes every 3 seconds, and keeps the lower strip minimal with reward/emission totals plus return controls.
- files modified: web-runner/app.js; web-runner/src/core/idleFarmRuntime.mjs; tests/idleFarmLayoutScaffoldContract.test.js
- test evidence:
  - `npm test -- tests/idleFarmLayoutScaffoldContract.test.js tests/evolutionLayoutScaffoldContract.test.js` (4/4 pass)
  - `curl -I http://127.0.0.1:8094/web-runner/index.html` returned `HTTP/1.1 200 OK`
  - attempted Playwright runtime pass against `http://127.0.0.1:8094/web-runner/index.html`, but browser launch failed in this session with the known persistent-session Chrome error (`Opening in existing browser session`)
- scope confirmation: confined to ORKA-1ys idle farming visual facade, routing, reward-emitter runtime seam, and deterministic contract coverage; no real combat formulas, gem-board rules, or dev-panel behavior were changed in this lane.

- bead id: ORKA-r9z
- summary of changes: Added an `evolutionLayout` scaffold to the runtime in the same Vault-family style as the existing progression shells. The new layout includes a deterministic seven-level stat ladder, future skill-research gate metadata, Vault retention routing, layout registration, render branch, and click handling for level selection/back navigation.
- files modified: web-runner/app.js; tests/evolutionLayoutScaffoldContract.test.js; tests/vaultNavAndChestsRailContract.test.js
- test evidence:
  - `npm test -- tests/evolutionLayoutScaffoldContract.test.js tests/vaultNavAndChestsRailContract.test.js tests/relicsLayoutScaffoldContract.test.js tests/petsLayoutScaffoldContract.test.js tests/mountsLayoutScaffoldContract.test.js tests/homesteadLayoutScaffoldContract.test.js` (15/15 pass)
  - attempted runtime browser pass against `http://127.0.0.1:8080/web-runner/`, but Playwright MCP launch failed in this session with the known persistent-session error (`Opening in existing browser session`)
- scope confirmation: confined to the evolution-tree scaffold, Vault routing, and matching contract coverage; no economy, unlock logic, or balance systems were finalized.

- bead id: ORKA-094
- summary of changes: Ran a full `jdocmunch` repository index for Codex-Orka and verified that the fresh documentation section inventory and table of contents are queryable afterward.
- files modified: none
- test evidence:
  - `mcp__jdocmunch__index_local(path=/Users/Mace/Wishfire/Codex-Orka, use_ai_summaries=false)` -> success
  - indexed repo: `local/Codex-Orka`
  - `section_count: 2486`
  - `mcp__jdocmunch__get_toc(repo=local/Codex-Orka)` returned the repo documentation hierarchy after indexing
- scope confirmation: retrieval-indexing only; no repo code or docs changed for this bead.

- bead id: ORKA-0zk
- summary of changes: Ran a full non-incremental `jcodemunch` repository index for Codex-Orka through the working MCP server and verified that the fresh repo/symbol inventory is queryable afterward.
- files modified: none
- test evidence:
  - `mcp__jcodemunch__index_folder(path=/Users/Mace/Wishfire/Codex-Orka, incremental=false, use_ai_summaries=false)` -> success
  - indexed repo: `local/Codex-Orka-f7dcaf91`
  - `file_count: 107`
  - `symbol_count: 1101`
  - `mcp__jcodemunch__get_repo_outline(repo=local/Codex-Orka-f7dcaf91)` confirmed directory/language/symbol inventory after rebuild
- scope confirmation: retrieval-indexing only; no repo code or docs changed for this bead.

- bead id: ORKA-maq
- summary of changes: Added a repository-local Codex agent rule file at `.codex/agent_rules.md` that defines the default jcodemunch-first code navigation policy for future agent work.
- files modified: .codex/agent_rules.md
- test evidence:
  - file content audit against requested policy text
- scope confirmation: confined to repository-local agent guidance only; no runtime, tooling, or gameplay code changed.

- bead id: ORKA-boj
- summary of changes: Added repository retrieval instructions under `.ai/retrieval_rules.md`, verified Node/npm are present, and indexed the repo through the working MCP servers already available in this session (`jcodemunch` and `jdocmunch`). Also audited the requested home-config/install path and found two blockers: this sandbox cannot write `~/.codex/config.json`, and the npm package names from the task text (`jcodemunch-mcp`, `jdocmunch-mcp`, `jcontextmunch-mcp`, `jcodemunch`) are not published as written.
- files modified: .ai/retrieval_rules.md
- test evidence:
  - `node --version` -> `v25.8.0`
  - `npm --version` -> `11.11.0`
  - `mcp__jcodemunch__index_folder` succeeded for `/Users/Mace/Wishfire/Codex-Orka` (`repo: local/Codex-Orka-f7dcaf91`, `symbol_count: 1101`)
  - `mcp__jcodemunch__list_repos` confirmed the repo index exists
  - `mcp__jdocmunch__index_local` succeeded for `/Users/Mace/Wishfire/Codex-Orka`
  - `npx jcodemunch status` failed with npm `E404`
  - `npx jcontextmunch-mcp --help` failed with npm `E404`
- scope confirmation: confined to retrieval-setup documentation and MCP/index verification for ORKA-boj; no game runtime code changed.

- bead id: ORKA-a1k
- summary of changes: Added a durable combat QA and Playwright control guide that captures true hero-input gating, follow-up action rules, refill/repopulation waits, false-failure versus real-lock signals, and concrete timing expectations from the live runtime. Linked it from the game function reference and registered it as canonical in document lifecycle policy; also stored the reusable timing/control heuristics in insights.
- files modified: governance/qa/combat-playwright-control-model.md; governance/product/game-function-reference.md; governance/planning/document-lifecycle-policy.md; ai-memory/insights.md
- test evidence:
  - documentation audit against live timing/constants in `web-runner/app.js` and control-state seams in `web-runner/modules/functionBank.js`
  - Beads acceptance review for ORKA-a1k against documented hero-input, enemy-action, refill, and repopulation rules
- scope confirmation: confined to documentation and reusable QA/control guidance; no runtime gameplay or automation code was changed in this bead.

- bead id: ORKA-jwx
- summary of changes: Added read-only Power Amp lifecycle telemetry to both runtime mirrors, exposed the recent trace through `render_game_to_text`, and taught the balance harness to emit `power_amp_trace.json` plus per-session summaries. Also tightened harness action gating to require a true idle hero turn, retried pending target-selection flows, and waited through empty-board respawn windows so bounded Playwright prelim runs now complete.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/app.js; tools/balance_harness.js; tests/balanceHarnessContract.test.js; tests/powerAmpTelemetryContract.test.js
- test evidence:
  - `npm test -- tests/balanceHarnessContract.test.js tests/powerAmpTelemetryContract.test.js`
  - bounded prelim harness pass: `BALANCE_CDP_URL=http://127.0.0.1:9226 BALANCE_SESSION_COUNT=1 node tools/balance_harness.js --maxWaves 1 --outputDir /tmp/orka-balance-prelim-9226`
  - bounded repeat pass: `BALANCE_CDP_URL=http://127.0.0.1:9226 BALANCE_SESSION_COUNT=3 node tools/balance_harness.js --maxWaves 1 --outputDir /tmp/orka-balance-prelim-3`
- scope confirmation: confined to ORKA-jwx telemetry/trust and harness control flow; no combat damage, enemy behavior, or Power Amp gameplay rules were changed.

- bead id: ORKA-4m4
- summary of changes: Completed the harness-managed energy-depletion stop contract and verified it in live bounded runs. Session outputs now terminate deterministically on `energy <= 0`, write the stop rule into artifacts, and produce preliminary CSV/JSON/Markdown outputs under CDP-attached Chrome.
- files modified: tools/balance_harness.js; tests/balanceHarnessContract.test.js; agents/dev_reports.md; agents/pm_status.md; ai-memory/insights.md
- test evidence:
  - `npm test -- tests/balanceHarnessContract.test.js`
  - bounded prelim artifacts: `/tmp/orka-balance-prelim-9226/`; `/tmp/orka-balance-prelim-3/`
- scope confirmation: confined to ORKA-4m4 balance-harness test contract only; the live game still does not hard-stop gameplay at energy depletion.

- bead id: ORKA-4m4
- summary of changes: Added an explicit harness-managed energy-depletion session stop contract for the balance runner. The harness now treats `energy <= configured floor` as terminal, records `end_reason` per session, and writes the test-only stop rule into JSON/Markdown outputs so future balance reads do not confuse harness termination with live gameplay enforcement.
- files modified: tools/balance_harness.js; tests/balanceHarnessContract.test.js
- test evidence:
  - `npm test -- tests/balanceHarnessContract.test.js`
  - canary rerun pending after explicit stop-rule patch
- scope confirmation: confined to ORKA-4m4 balance-harness test contract only; no runtime gameplay stop rule was added to the game itself.

- bead id: ORKA-gxn
- summary of changes: Added a durable product-language game function reference that explains the live player loop, layout families, combat flow, gem meanings, currencies, progression surfaces, and placeholder-vs-real boundaries for FAQ/tutorial/spec writing; also linked it from the project retrieval index and registered it as canonical in document lifecycle policy.
- files modified: governance/product/game-function-reference.md; ai-memory/project.md; governance/planning/document-lifecycle-policy.md
- test evidence:
  - documentation audit against live runtime seams in `web-runner/app.js` and `web-runner/modules/functionBank.js`
  - jcodemunch outline verification on `web-runner/app.js` and `web-runner/modules/functionBank.js` to ground layout/combat/gem seam references
- scope confirmation: confined to documentation and retrieval-map governance for ORKA-gxn; no runtime, balance, or UI behavior was changed.

- bead id: ORKA-91m
- summary of changes: Applied the actual `.beads` mirror reconciliation pass. Removed mirror-only stale issue files absent from live `bd` and moved `ORKA-7c0` back to `.beads/open/` so the mirror no longer contradicted live status. Post-cleanup mismatch inventory now shows only `bd`-only issues with no mirror files, not contradictory mirror state.
- files modified: .beads/open/ORKA-7c0.md; removed stale `.beads/open/*.md`, `.beads/in_progress/*.md`, and `.beads/blocked/ORKA-9hl.md`; agents/dev_reports.md; agents/pm_status.md
- test evidence: live-vs-mirror inventory via `bd list --json` + `python3` diff script; post-cleanup mismatch count reduced to `bd`-only missing mirrors (`TOTAL 14`) with no mirror contradictions
- scope confirmation: Confined to repo-side `.beads` mirror reconciliation for ORKA-91m; runtime, tests, tooling, and governance content were not modified in this bead.

- bead id: ORKA-4ws
- summary of changes: Inventoried cleanup scope instead of performing blind destructive cleanup. Live `bd` shows `ORKA-4ws` as the only in-progress bead and 10 ready beads, while repo-side `.beads/` mirrors contain numerous stale open/in_progress entries that do not match live state. Dirty worktree is currently mixed across 24 mirror files, 8 governance files, 6 runtime files, 3 tests, and 4 tooling files.
- files modified: agents/issues.md; agents/dev_reports.md; agents/pm_status.md
- test evidence: inventory commands only: `bd ready`; `bd list --status=in_progress --json`; `git status --short`; `bd list --json | jq`; mirror-vs-bd diff inventory via `python3`
- scope confirmation: Confined to reconciliation inventory and cleanup planning for ORKA-4ws; no runtime, mirror, or destructive file cleanup was applied.

- bead id: ORKA-dme
- summary of changes: Changed floating combat damage/heal text from a softened halo shadow to a hard pure-black offset drop shadow by setting black shadow color, zero blur, and explicit X/Y offsets in the combat text renderer.
- files modified: web-runner/app.js; tests/combatTextShadowContract.test.js; agents/dev_reports.md; agents/pm_status.md
- test evidence: `npm test -- tests/combatTextShadowContract.test.js` (1/1 pass); user QA PASS on `http://127.0.0.1:8080/web-runner/`
- scope confirmation: Confined to combat floating-text shadow styling and a targeted contract; no animation, timing, or value logic changes.

- bead id: ORKA-6nk
- summary of changes: Added a canonical Codex-Orka Beads process doc covering live `bd` authority, executable bead criteria, dependency/readiness flow, hot-file serialization, closeout evidence, and `bd` double-read confirmation; linked it from `AGENTS.md` and registered it in document lifecycle policy.
- files modified: governance/execution/beads-process.md; AGENTS.md; governance/planning/document-lifecycle-policy.md; agents/dev_reports.md; agents/pm_status.md
- test evidence: targeted doc verification with `sed` and `git status` confirming the new canonical process doc and AGENTS pointer
- scope confirmation: Confined to governance/process documentation for ORKA-6nk; no runtime, tooling, or gameplay logic changes.

- bead id: ORKA-xtz
- summary of changes: Aligned governance policy so live `bd` state is authoritative for bead selection/status, documented the shell PATH prerequisite for `~/.local/bin/bd`, and removed prompt language that treated repo-side `.beads/` mirrors as workflow authority.
- files modified: AGENTS.md; agents/prompts/pm_agent.md; agents/prompts/dev_agent.md; agents/dev_reports.md; agents/pm_status.md
- test evidence: targeted doc verification via `rg`/`sed` confirming updated policy text in `AGENTS.md`, `agents/prompts/pm_agent.md`, and `agents/prompts/dev_agent.md`
- scope confirmation: Confined to workflow/governance documentation for ORKA-xtz; no runtime or gameplay code changes.

- bead id: ORKA-dzt
- summary of changes: Verified the active combat-power formula lane is implemented in the current worktree: combat power now accepts `MAG` + `attackType`, uses `MAG` for magic units, and falls back to `max(ATK, MAG)` when type is unknown; mirrored enemy spawn helpers use the same rule in both runtime mirrors.
- files modified: ai-memory/insights.md; agents/dev_reports.md; agents/pm_status.md
- test evidence: `npm test -- tests/combatPowerIndexContract.test.js` (3/3 pass)
- scope confirmation: Closeout/reporting only in this cycle; no new runtime logic was added beyond the already-present ORKA-dzt implementation.

- bead id: ORKA-cpc
- summary of changes: Added caller-owned encounter request hook (`setEncounterRequest`) and map-return CP stub (`deriveEncounterRequestFromMapState`) so war-meter state can drive targetCP/policy/seed before combat entry; added policy/faction contract coverage for solver branches.
- files modified: web-runner/app.js; tests/encounterRequestHookContract.test.js; tests/mapEncounterRequestStubContract.test.js; tests/encounterPolicyContract.test.js
- test evidence: `npm test -- tests/encounterPolicyContract.test.js tests/mapEncounterRequestStubContract.test.js tests/encounterRequestHookContract.test.js tests/encounterBudgetContract.test.js` (5/5 pass)
- scope confirmation: Confined to ORKA-cpc encounter-request injection and policy/faction contract hardening; no unrelated combat formula changes.

- bead id: ORKA-jmf
- summary of changes: Fixed yellow-match completion regression by removing crash-prone merge-target lookup dependencies in `handleGemMatch` (`instances`/`assetsLayout` scope issues), restored safe in-function target resolution, and added yellow completion regression contract.
- files modified: web-runner/app.js; tests/yellowMatchCompletionGuardContract.test.js; ai-memory/insights.md
- test evidence: `npm test -- tests/yellowMatchCompletionGuardContract.test.js tests/yellowSlamSequenceContract.test.js` (3/3 pass); Playwright multi-pass forceMatch checks confirm yellow cycle exits (`BoardFillActive` returns to `0`).
- scope confirmation: Confined to ORKA-jmf yellow-sequence completion stability and traceability corrections.

- bead id: ORKA-cpc
- summary of changes: Restored Beads-governed lane by moving CP-budget encounter builder work to in_progress and implementing strict locale-tag filtering, doctrine metadata normalization (faction/enemyRole/localeTags), deterministic encounter selection, and encounter-pooled respawn picking in runtime mirrors.
- files modified: web-runner/app.js; web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/assets/enemies.json; tests/encounterBudgetContract.test.js; tests/enemyBiomeContract.test.js
- test evidence: `npm test -- tests/combatPowerIndexContract.test.js tests/enemyBiomeContract.test.js tests/encounterBudgetContract.test.js` (7/7 pass)
- scope confirmation: All active code changes are now tracked under ORKA-cpc with explicit hot-file lock scope; ORKA-cpb retained for metadata follow-up migrations only.

- bead id: ORKA-dwg
- summary of changes: Added deterministic combat-power indexing to hero/enemy runtime records, enriched enemy source rows with CombatPower at bootstrap, surfaced combatPower in exported runtime hero/enemy snapshots, and mirrored enemy combatPower preservation in both function-bank SpawnEnemy paths.
- files modified: web-runner/app.js; web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/combatPowerIndexContract.test.js
- test evidence: `npm test -- tests/combatPowerIndexContract.test.js tests/chestsLayoutScaffoldContract.test.js` (5/5 pass)
- scope confirmation: Confined to combat-power data indexing/stub surfaces for downstream gating; no combat formula behavior changes beyond adding computed field.

- bead id: ORKA-a0k
- summary of changes: Added runtime Chests layout scaffold with deterministic tier tabs, progress bar placeholder, reward-list shell, and Mission-nav entry mapping from combat.
- files modified: web-runner/app.js; tests/chestsLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/chestsLayoutScaffoldContract.test.js tests/homesteadLayoutScaffoldContract.test.js tests/collectiblesLayoutScaffoldContract.test.js` (6/6 pass)
- scope confirmation: Confined to layout/state scaffold and navigation mapping only; no drop-table/economy/balance finalization.

- bead id: ORKA-51g
- summary of changes: Added runtime Homestead layout scaffold with deterministic scene-slot/emission metadata, map-locale entry mapping, and selectable Homestead builder shell with map/combat return routes.
- files modified: web-runner/app.js; tests/homesteadLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/homesteadLayoutScaffoldContract.test.js tests/collectiblesLayoutScaffoldContract.test.js tests/mountsLayoutScaffoldContract.test.js` (6/6 pass)
- scope confirmation: Confined to layout/state scaffold and navigation mapping only; no economy/balance or finalized homestead mechanics.

- bead id: ORKA-khb
- summary of changes: Added runtime Collectibles layout scaffold with deterministic gallery/passive metadata model, map-locale entry mapping, and selectable Collectibles gallery shell with map/combat return routes.
- files modified: web-runner/app.js; tests/collectiblesLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/collectiblesLayoutScaffoldContract.test.js tests/mountsLayoutScaffoldContract.test.js tests/artifactsLayoutScaffoldContract.test.js tests/tomesLayoutScaffoldContract.test.js` (8/8 pass)
- scope confirmation: Confined to layout/state scaffold and navigation mapping only; no economy/balance or finalized collectibles mechanics.

- bead id: ORKA-8k4
- summary of changes: Added runtime Mounts layout scaffold with deterministic gallery/passive metadata model, map-locale entry mapping, and selectable Mounts gallery shell with map/combat return routes.
- files modified: web-runner/app.js; tests/mountsLayoutScaffoldContract.test.js; tests/artifactsLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/mountsLayoutScaffoldContract.test.js tests/artifactsLayoutScaffoldContract.test.js tests/tomesLayoutScaffoldContract.test.js` (6/6 pass)
- scope confirmation: Confined to layout/state scaffold and navigation mapping only; no economy/balance or finalized mounts mechanics.

- bead id: ORKA-3e4
- summary of changes: Added runtime Artifacts layout scaffold with deterministic gallery/passive metadata model, map-locale entry mapping, and selectable Artifacts gallery shell with map/combat return routes.
- files modified: web-runner/app.js; tests/artifactsLayoutScaffoldContract.test.js; tests/tomesLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/artifactsLayoutScaffoldContract.test.js tests/tomesLayoutScaffoldContract.test.js tests/yellowSlamSequenceContract.test.js` (6/6 pass)
- scope confirmation: Confined to layout/state scaffold and navigation mapping only; no economy/balance or finalized artifact mechanics.

- bead id: ORKA-7pi
- summary of changes: Added runtime Tomes layout scaffold with deterministic gallery/buff metadata model, map-locale entry mapping, and dedicated Tomes layout shell with selectable placeholder tome cards.
- files modified: web-runner/app.js; tests/tomesLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/tomesLayoutScaffoldContract.test.js tests/yellowSlamSequenceContract.test.js` (4/4 pass)
- scope confirmation: Confined to layout/state scaffold and navigation mapping only; no economy or finalized tome mechanics.

- bead id: ORKA-fp9
- summary of changes: Hardened enemy debuff lifecycle by normalizing debuff state on read, unifying apply/decay paths through a single helper, sanitizing invalid/duplicate slot data, and preserving deterministic slot eviction behavior.
- files modified: Scripts/functionBank.js; web-runner/modules/functionBank.js; tests/debuffLifecycleReliabilityContract.test.js
- test evidence: `npm test -- tests/debuffLifecycleReliabilityContract.test.js` (2/2 pass); `npm test -- tests/traitHookFrameworkContract.test.js tests/blueBuffLifecycleContract.test.js` (4/4 pass)
- scope confirmation: Changes are confined to debuff apply/stack/expire/cleanup reliability for ORKA-fp9 with mirrored runtime maintenance only.

- bead id: ORKA-6gt
- summary of changes: Added Falie enmity target-bias for enemy single-target selection with hard cap guardrail and deterministic target-bias trace payload in globals.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/falieEnmityTargetBiasContract.test.js
- test evidence: `npm test -- tests/falieEnmityTargetBiasContract.test.js tests/traitHookFrameworkContract.test.js tests/debuffLifecycleReliabilityContract.test.js` (7/7 pass)
- scope confirmation: Confined to enemy target selection bias behavior for Falie trait and mirror parity.

- bead id: ORKA-2sa
- summary of changes: Added Runa passive magic-resist trigger against enemy magic single/AOE paths with deterministic proc/nullify trace state and guarded damage reduction/nullification outcomes.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/runaMagicResistContract.test.js
- test evidence: `npm test -- tests/runaMagicResistContract.test.js tests/falieEnmityTargetBiasContract.test.js tests/traitHookFrameworkContract.test.js tests/debuffLifecycleReliabilityContract.test.js` (10/10 pass)
- scope confirmation: Confined to Runa defensive trait behavior for incoming enemy magic and mirror parity.

- bead id: ORKA-mo4
- summary of changes: Added Huun-only execution drop bonus by carrying kill-credit through pending death resolution and applying a deterministic TH level bonus in existing drop-rate transform path.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/huunExecutionDropBonusContract.test.js
- test evidence: `npm test -- tests/huunExecutionDropBonusContract.test.js tests/runaMagicResistContract.test.js tests/falieEnmityTargetBiasContract.test.js tests/debuffLifecycleReliabilityContract.test.js` (11/11 pass)
- scope confirmation: Confined to kill-credit-aware drop bonus behavior for Huun executions inside existing loot pipeline (no new loot systems).

- bead id: ORKA-69r
- summary of changes: Added deterministic contract coverage to lock blue->Astral wallet routing, no direct blue stat-apply gating, and Astral wallet output/state surface.
- files modified: tests/blueAstralWalletContract.test.js
- test evidence: `npm test -- tests/blueAstralWalletContract.test.js tests/blueBuffLifecycleContract.test.js tests/runaMagicResistContract.test.js tests/falieEnmityTargetBiasContract.test.js tests/huunExecutionDropBonusContract.test.js` (15/15 pass)
- scope confirmation: QA closeout evidence only; no runtime behavior changes in this slice.

- bead id: ORKA-xnz
- summary of changes: Added deterministic contract coverage for brief white hit-flash feedback on attacked combatants (damage path flash timing + renderer white-overlay behavior).
- files modified: tests/hitFlashFeedbackContract.test.js
- test evidence: `npm test -- tests/hitFlashFeedbackContract.test.js tests/blueAstralWalletContract.test.js tests/runaMagicResistContract.test.js tests/falieEnmityTargetBiasContract.test.js tests/huunExecutionDropBonusContract.test.js` (14/14 pass)
- scope confirmation: QA lock-in only; runtime behavior already present and unchanged.

- bead id: ORKA-ohb
- summary of changes: Added guard contracts to ensure regen debug spam markers are absent from runtime app and both skill-sheet mirrors by default.
- files modified: tests/regenDebugNoiseContract.test.js
- test evidence: `npm test -- tests/regenDebugNoiseContract.test.js tests/hitFlashFeedbackContract.test.js tests/blueAstralWalletContract.test.js tests/runaMagicResistContract.test.js tests/falieEnmityTargetBiasContract.test.js tests/huunExecutionDropBonusContract.test.js` (16/16 pass)
- scope confirmation: Runtime hygiene verification only; no gameplay logic changes.

- bead id: ORKA-6x3
- summary of changes: Implemented per-gem yellow sequence settle gate so each yellow-replaced/refilled gem now completes randomize -> slam/bounce settle -> advance before next gem.
- files modified: web-runner/app.js; tests/yellowSlamSequenceContract.test.js
- test evidence: `npm test -- tests/yellowSlamSequenceContract.test.js tests/yellowGoldFlyupContract.test.js tests/blueAstralWalletContract.test.js` (7/7 pass)
- scope confirmation: Confined to yellow sequence pacing/animation sequencing; existing randomize behavior preserved.

- bead id: ORKA-cpc
- summary of changes: Completed CP-budget encounter integration lane with caller-owned encounter request setter (`setEncounterRequest`), map-return encounter request derivation stub (`warMeter -> targetCP/policy`), seeded spawn wiring, and map encounter node setter for locale/faction handoff.
- files modified: web-runner/app.js; tests/encounterBudgetContract.test.js; tests/encounterPolicyContract.test.js; tests/encounterRequestHookContract.test.js; tests/mapEncounterRequestStubContract.test.js
- test evidence: `npm test -- tests/combatRuntimeGatewayContract.test.js tests/enemyBiomeContract.test.js tests/encounterBudgetContract.test.js tests/encounterPolicyContract.test.js tests/mapEncounterRequestStubContract.test.js tests/encounterRequestHookContract.test.js` (8/8 pass)
- scope confirmation: Confined to encounter-builder wiring and map->combat request stubs; no unrelated combat rules or render subsystem refactors.

- bead id: ORKA-cpb
- summary of changes: Began doctrine follow-up lane by refining elite taxonomy (`High Orc` promoted to `commander`) and adding full-roster doctrine consistency/default contracts.
- files modified: web-runner/assets/enemies.json; tests/enemyDoctrineMetadataContract.test.js
- test evidence: `npm test -- tests/enemyDoctrineMetadataContract.test.js tests/enemyBiomeContract.test.js tests/encounterBudgetContract.test.js tests/encounterPolicyContract.test.js tests/mapEncounterRequestStubContract.test.js tests/encounterRequestHookContract.test.js` (9/9 pass)
- scope confirmation: Confined to doctrine metadata content/validation hardening and default fallback contract coverage.

- bead id: ORKA-cpc
- summary of changes: Added contract coverage for map encounter-node authority (`setMapEncounterNode`) and ensured encounter request preview derives locale/faction from node metadata before combat return.
- files modified: tests/mapEncounterRequestStubContract.test.js
- test evidence: `npm test -- tests/mapEncounterRequestStubContract.test.js tests/encounterRequestHookContract.test.js tests/encounterBudgetContract.test.js tests/enemyDoctrineMetadataContract.test.js tests/enemyBiomeContract.test.js` (9/9 pass)
- scope confirmation: Test-only hardening inside existing ORKA-cpc lane; no gameplay logic expansion.

- bead id: ORKA-cpc
- summary of changes: Hardened encounter doctrine normalization in `buildEncounterByBudget` by normalizing locale tags regardless of source shape, applying optional faction filter through canonical faction normalization, and normalizing role checks during policy bucketing.
- files modified: web-runner/app.js; tests/encounterPolicyContract.test.js
- test evidence: `npm test -- tests/encounterPolicyContract.test.js tests/encounterBudgetContract.test.js tests/enemyDoctrineMetadataContract.test.js tests/enemyBiomeContract.test.js tests/mapEncounterRequestStubContract.test.js tests/encounterRequestHookContract.test.js` (10/10 pass)
- scope confirmation: Confined to CP encounter-builder doctrine normalization and matching contract updates.

- bead id: ORKA-zys
- summary of changes: Audited governance coordination layer presence; required coordination files already exist and are actively used (`agents/pm_status.md`, `agents/issues.md`, `agents/dev_reports.md`). Marked bead complete for legacy cleanup.
- files modified: .beads/open/ORKA-zys.md
- test evidence: file presence + active append history in coordination files
- scope confirmation: Status hygiene/traceability cleanup only; no runtime code changes.

- bead id: ORKA-jj0
- summary of changes: Legacy audit confirmed yellow->gold fly-up path is active in runtime and covered by contract tests; marked bead done.
- files modified: .beads/open/ORKA-jj0.md
- test evidence: tests/yellowGoldFlyupContract.test.js + app.js fly-up callsites
- scope confirmation: Status hygiene only.

- bead id: ORKA-9hl
- summary of changes: Marked blocked/superseded after audit; current runtime behavior intentionally uses yellow->gold fly-up (conflicts with "without fly-up" wording).
- files modified: .beads/blocked/ORKA-9hl.md
- test evidence: tests/yellowGoldFlyupContract.test.js + app.js fly-up callsites
- scope confirmation: Traceability cleanup only.

- bead id: ORKA-hlc
- summary of changes: Closed obsolete blue-buff lifecycle bead per product rule update; buff systems are decoupled from gem matches and handled via separate booster mechanics.
- files modified: .beads/open/ORKA-hlc.md
- test evidence: Policy decision closure (no runtime change)
- scope confirmation: Bead status/traceability cleanup only.

- bead id: ORKA-z0b
- summary of changes: Closed hero selector arrow bug bead after confirming existing runtime behavior and contract coverage (`heroSelectorRulesContract`).
- files modified: .beads/open/ORKA-z0b.md
- test evidence: `npm test -- tests/heroSelectorRulesContract.test.js` (pass)
- scope confirmation: Status/traceability cleanup only.

- bead id: ORKA-hsf
- summary of changes: Applied Hero layout Figma 1:3 compliance pass: updated hero layout geometry/spec values, wired Figma arrow/close assets, and restyled stat/skill card rendering to match provided frame while preserving existing behavior paths.
- files modified: web-runner/app.js; .beads/in_progress/ORKA-hsf.md; .beads/hot-file-lock/ORKA-hsf.scope
- test evidence: `npm test -- tests/heroSelectorRulesContract.test.js tests/yellowMatchCompletionGuardContract.test.js tests/yellowSlamSequenceContract.test.js tests/combatRuntimeGatewayContract.test.js` (5/5 pass)
- scope confirmation: Visual/layout-only pass for Hero screen; no combat mechanic changes.

- bead id: ORKA-hsf
- summary of changes: Tightened Hero screen placeholders to match Figma node 1:3 by forcing stat/value placeholders to `NUM` and locking skill titles to `Skill Title` / `Skill Title Lv.2` / `Skill Title`.
- files modified: web-runner/app.js
- test evidence: `npm test -- tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (6/6 pass)
- scope confirmation: Visual/text compliance only; behavior unchanged.

- bead id: ORKA-mwl
- summary of changes: Added initiative queue sanitization to prevent improper repeated hero slots from accumulating in time-mode turn order; extras are now preserved only for explicit mechanic provenance.
- files modified: web-runner/src/core/initiativeGuards.mjs; web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/initiativeGuardsContract.test.js; .beads/in_progress/ORKA-mwl.md
- test evidence: `npm test -- tests/initiativeGuardsContract.test.js tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (9/9 pass)
- scope confirmation: Turn-order scheduler guard only; no layout/UI behavior changes.

- bead id: ORKA-spt
- summary of changes: Seeded party hero skill points to exact 300 at runtime combat init and validated deterministic skill-point consumption/cap behavior with Playwright multipass automation.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/app.js; tests/skillPointSeedContract.test.js; .beads/open/ORKA-spt.md
- test evidence: `npm test -- tests/skillPointSeedContract.test.js tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (8/8 pass); `playwright-cli run-code` multipass harness (12/12 passes): each hero start=300, end=279 after full 3-skill progression, applied upgrades=9, max-rank rejects=3, no over-consume.
- scope confirmation: Confined to ORKA-spt seed hook + verification lane; no unrelated combat/balance logic edits.

- bead id: ORKA-lod
- summary of changes: Reworked startup asset pipeline to stage critical sprite types for first-frame readiness and defer non-critical base sprites; converted core visual image boot loads from serial awaits to parallel batch loading.
- files modified: web-runner/app.js; tests/startupAssetLoadPerfContract.test.js; .beads/open/ORKA-lod.md
- test evidence: `npm test -- tests/startupAssetLoadPerfContract.test.js tests/enemyBarRenderContract.test.js tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (10/10 pass)
- scope confirmation: Confined to startup loading pipeline performance behavior and related contract coverage.

- bead id: ORKA-bar
- summary of changes: Fixed combat enemy HP bar distortion by snapping bar coordinates/sizes to integer pixels and disabling image smoothing for bar sprite layers.
- files modified: web-runner/app.js; tests/enemyBarRenderContract.test.js; .beads/open/ORKA-bar.md
- test evidence: `npm test -- tests/startupAssetLoadPerfContract.test.js tests/enemyBarRenderContract.test.js tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (10/10 pass)
- scope confirmation: Visual render-only fix for enemy bar stability; gameplay math and HP lag behavior unchanged.

- bead id: ORKA-lpb
- summary of changes: Implemented Layout 0 startup loading/progress bar and stage-based progress updates during bootstrap; loading overlay exits at runtime-ready state.
- files modified: web-runner/app.js; tests/startupLoadingBarContract.test.js; tests/startupAssetLoadPerfContract.test.js; .beads/open/ORKA-lpb.md
- test evidence: `npm test -- tests/startupAssetLoadPerfContract.test.js tests/enemyBarRenderContract.test.js tests/startupLoadingBarContract.test.js tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (12/12 pass)
- scope confirmation: Confined to startup load UX/progress instrumentation and contract updates.

- bead id: ORKA-lod / ORKA-lpb / ORKA-bar
- summary of changes: QA PASS confirmed by user after preload + loading bar + enemy bar distortion fixes.
- files modified: agents/pm_status.md; agents/dev_reports.md
- test evidence: user runtime QA pass on `http://127.0.0.1:8080/web-runner/`
- scope confirmation: documentation-only follow-up.

- bead id: ORKA-hsb
- summary of changes: Wired hero screen +/- buttons to skill progression actions and added downgrade/refund support (`AttemptHeroSkillDowngrade`) mirrored in runtime and Scripts.
- files modified: web-runner/app.js; web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/heroSkillButtonsContract.test.js; .beads/open/ORKA-hsb.md
- test evidence: `npm test -- tests/heroSkillButtonsContract.test.js tests/skillPointSeedContract.test.js tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (10/10 pass)
- scope confirmation: Confined to hero screen button interaction + skill state progression APIs.

- bead id: ORKA-vlt
- summary of changes: Moved retention-entry button stack from Map layout to Chests top rail, wired lazy routing from Chests to gallery layouts, and renamed Mission nav behavior/display to Vault.
- files modified: web-runner/app.js; tests/vaultNavAndChestsRailContract.test.js; .beads/open/ORKA-vlt.md
- test evidence: `npm test -- tests/vaultNavAndChestsRailContract.test.js tests/startupLoadingBarContract.test.js tests/startupAssetLoadPerfContract.test.js tests/heroSkillButtonsContract.test.js tests/layoutState.test.js` (14/14 pass)
- scope confirmation: UI/navigation-only changes; no gallery mechanic expansion.

- bead id: ORKA-l0p
- summary of changes: Updated Layout 0 loading presentation to bottom mobile-style progress bar while preserving bootstrap progress plumbing.
- files modified: web-runner/app.js; .beads/open/ORKA-l0p.md
- test evidence: same 14/14 suite pass above (includes startup loading contracts)
- scope confirmation: startup loading UX only.

- bead id: ORKA-vlt (reopen fix)
- summary of changes: Corrected retention gallery back-navigation home from map to vault; all mapBack buttons now route to `chestsLayout` with `Back To Vault` labels.
- files modified: web-runner/app.js; tests/vaultNavAndChestsRailContract.test.js; .beads/open/ORKA-vlt.md
- test evidence: `npm test -- tests/vaultNavAndChestsRailContract.test.js tests/layoutState.test.js` (9/9 pass)
- scope confirmation: Navigation/label fix only for reopened vault retention routing issue.

- bead id: ORKA-l0p (reopen fix)
- summary of changes: Enforced requested flow by preloading during storyMock and rendering bottom loading progress on layout 0; blocked 0->1 transition until preload completion.
- files modified: web-runner/app.js; tests/startupLoadingBarContract.test.js; .beads/open/ORKA-l0p.md
- test evidence: `npm test -- tests/startupLoadingBarContract.test.js tests/startupAssetLoadPerfContract.test.js tests/layoutState.test.js` (9/9 pass); `npm test -- tests/vaultNavAndChestsRailContract.test.js` (4/4 pass)
- scope confirmation: loading-flow sequencing and UI behavior only.

- bead id: ORKA-mxc
- summary of changes: Replaced Map layout `Return Combat` button with Hero-style circle `X` close control and routed close action to combat while preserving drag/pan interactions.
- files modified: web-runner/app.js; tests/mapCloseControlContract.test.js; .beads/open/ORKA-mxc.md
- test evidence: `node --test tests/mapCloseControlContract.test.js tests/vaultNavAndChestsRailContract.test.js tests/heroSkillButtonsContract.test.js` (9/9 pass)
- scope confirmation: Confined to map close-control UI/input lane; no combat/balance logic changes.

- bead id: ORKA-ysp
- summary of changes: Tuned yellow randomize+bounce cadence to complete faster while preserving per-gem anticipation and settle-gated sequencing.
- files modified: web-runner/app.js; tests/yellowSlamSequenceContract.test.js; .beads/open/ORKA-ysp.md
- test evidence: `node --test tests/yellowSlamSequenceContract.test.js tests/yellowMatchCompletionGuardContract.test.js tests/yellowGoldFlyupContract.test.js` (5/5 pass)
- scope confirmation: Timing-only tune for yellow sequence; no mechanic or gating model changes.

- bead id: ORKA-4c0
- summary of changes: Audited hero-screen control asset usage and switched to local hero-pack-first loading (plus/minus/close oval) with parity remote fallbacks retained.
- files modified: web-runner/app.js; tests/heroAssetPackUsageContract.test.js; .beads/open/ORKA-4c0.md
- test evidence: `node --test tests/heroAssetPackUsageContract.test.js tests/heroSkillButtonsContract.test.js tests/mapCloseControlContract.test.js tests/vaultNavAndChestsRailContract.test.js` (10/10 pass)
- scope confirmation: Asset loading policy only; no gameplay mechanics modified.

- bead id: ORKA-gsb
- summary of changes: Added per-slot gem backers behind board gems using `grid_placeholder` asset with an explicit `ORKA-gsb` feature flag and tagged begin/end block for instant rollback.
- files modified: web-runner/app.js; tests/gemSlotBackerContract.test.js; .beads/open/ORKA-gsb.md
- test evidence: `node --test tests/gemSlotBackerContract.test.js tests/yellowSlamSequenceContract.test.js tests/yellowMatchCompletionGuardContract.test.js` (4/4 pass)
- scope confirmation: Rendering-layer only; gem logic/match/refill behavior unchanged.

- bead id: ORKA-cmh (reopen cycle)
- summary of changes: Fixed Chimerilass threshold regression so heal skills are impossible above 50% HP and guaranteed below/equal 50% HP; enforced at selector seam (`PickEnemySkill`) plus resolver guard.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/chimerilassHealThresholdContract.test.js; .beads/open/ORKA-cmh.md
- test evidence:
  - `npm test -- tests/chimerilassHealThresholdContract.test.js tests/encounterPolicyContract.test.js` (3/3 pass)
  - Playwright multipass: above 50% => 0/800 heal picks; below 50% => 800/800 heal picks
- scope confirmation: confined to ORKA-cmh Chimerilass heal-threshold contract and verification only.

- bead id: ORKA-cpc
- summary of changes: Closed CP-budget encounter builder lane by aligning stale contract tests to current explicit-seed and history-aware builder behavior.
- files modified: tests/encounterBudgetContract.test.js; tests/encounterRequestHookContract.test.js; .beads/open/ORKA-cpc.md
- test evidence: `npm test -- tests/encounterBudgetContract.test.js tests/encounterPolicyContract.test.js tests/encounterRequestHookContract.test.js tests/enemyBiomeContract.test.js tests/enemyDoctrineMetadataContract.test.js` (8/8 pass)
- scope confirmation: test-contract and bead-closeout updates only; runtime encounter logic unchanged in this cycle.

- bead id: ORKA-wbk
- summary of changes: Implemented encounter slot assignment rules so strongest CP enemy is always center on non-solo packages, with true-random side-slot placement; added full-wave KO packaged repick path while preserving normal per-slot refill behavior.
- files modified: web-runner/app.js; web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/encounterSlotAssignmentContract.test.js; .beads/open/ORKA-wbk.md
- test evidence: `npm test -- tests/encounterSlotAssignmentContract.test.js tests/encounterBudgetContract.test.js tests/encounterPolicyContract.test.js tests/encounterRequestHookContract.test.js tests/enemyBiomeContract.test.js tests/enemyDoctrineMetadataContract.test.js` (10/10 pass)
- scope confirmation: confined to encounter slot-assignment and repick behavior specified in ORKA-wbk; no CP retune, no war-economy features.

- bead id: ORKA-cpb
- summary of changes: Closed doctrine follow-up lane as complete based on current normalized taxonomy/default behavior and passing doctrine/locale/policy contracts.
- files modified: .beads/open/ORKA-cpb.md
- test evidence: `npm test -- tests/enemyDoctrineMetadataContract.test.js tests/enemyBiomeContract.test.js tests/encounterPolicyContract.test.js` (5/5 pass)
- scope confirmation: no runtime code changes; bead closeout by acceptance evidence only.

- bead id: ORKA-jj0 (reopen tuning)
- summary of changes: Increased yellow->gold fly-up gem start size to 150% by adding `startScale` to merge FX and setting yellow call-site to `1.5`, while preserving existing timing/sequence behavior.
- files modified: web-runner/app.js; tests/yellowGoldFlyupContract.test.js; .beads/open/ORKA-jj0.md
- test evidence: `npm test -- tests/yellowGoldFlyupContract.test.js tests/yellowSlamSequenceContract.test.js tests/yellowMatchCompletionGuardContract.test.js` (5/5 pass)
- scope confirmation: animation presentation tweak only; no yellow flow logic/model changes.

- bead id: ORKA-jj0 (reopen regression fix)
- summary of changes: Restored deterministic frame-6 energy reward by removing gold-or-energy branching from `handleSpecialGem6`; frame-6 click now always adds energy.
- files modified: web-runner/app.js; tests/frame6EnergyContract.test.js; .beads/open/ORKA-jj0.md
- test evidence: `node --test tests/frame6EnergyContract.test.js` (1/1 pass); `node --test tests/yellowGoldFlyupContract.test.js` (3/3 pass)
- scope confirmation: confined to frame-6 reward behavior regression inside ORKA-jj0 lane.

- bead id: ORKA-jj0 (reopen timing fix)
- summary of changes: Deferred yellow gold tally mutation until fly-up merge completion so displayed Gold total updates when gems reach the label.
- files modified: web-runner/app.js; tests/yellowGoldFlyupContract.test.js; .beads/open/ORKA-jj0.md
- test evidence: `node --test tests/yellowGoldFlyupContract.test.js` (4/4 pass); `node --test tests/yellowSlamSequenceContract.test.js tests/yellowMatchCompletionGuardContract.test.js` (6/6 pass)
- scope confirmation: yellow fly-up feedback timing only; no change to yellow conversion totals.

- bead id: ORKA-3m8
- summary of changes: Closed undefined yellow extra-turn bug lane with explicit acceptance and regression contracts for deferred yellow handoff semantics and single-turn-advance ordering.
- files modified: tests/yellowTurnHandoffContract.test.js; .beads/open/ORKA-3m8.md
- test evidence: `node --test tests/yellowTurnHandoffContract.test.js` (2/2 pass); `node --test tests/yellowGoldFlyupContract.test.js tests/yellowMatchCompletionGuardContract.test.js tests/yellowSlamSequenceContract.test.js` (7/7 pass)
- scope confirmation: yellow handoff regression guard coverage only; no combat formula or encounter behavior changes.

- bead id: ORKA-jdu
- summary of changes: Locked the current Vault family by renaming Collectibles to Relics across runtime labels/routes, adding a Pets scaffold in the existing retention-button/gallery style, and updating vault-family contracts to the current chests-driven entry path.
- files modified: web-runner/app.js; tests/relicsLayoutScaffoldContract.test.js; tests/petsLayoutScaffoldContract.test.js; tests/vaultNavAndChestsRailContract.test.js; tests/mountsLayoutScaffoldContract.test.js; tests/homesteadLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/relicsLayoutScaffoldContract.test.js tests/petsLayoutScaffoldContract.test.js tests/mountsLayoutScaffoldContract.test.js tests/homesteadLayoutScaffoldContract.test.js tests/vaultNavAndChestsRailContract.test.js` (13/13 pass)
- scope confirmation: vault-family scaffold/navigation only; no economy, combat, or art-led redesign work introduced.

- bead id: ORKA-1ol
- summary of changes: Cleaned the ready queue to binary state after Vault-family shipment by closing obsolete duplicate scaffold beads and preserving only the remaining future Relics stub.
- files modified: none (Beads queue hygiene only)
- test evidence: `bd show ORKA-axd` -> CLOSED; `bd show ORKA-c1j` -> CLOSED; `bd ready` no longer lists those duplicates; `bd show ORKA-n0g` remains OPEN with explicit future-stub comment.
- scope confirmation: issue-state cleanup only; no runtime code changes.

- bead id: ORKA-sht
- summary of changes: Audited the broader Beads queue for binary cleanliness, closed stale policy/duplicate work (`ORKA-2dt` plus prior Vault-family duplicates), confirmed no lingering `in_progress` beads, and preserved only intentionally future-facing stubs.
- files modified: none (Beads queue audit only)
- test evidence: `bd show ORKA-2dt` -> CLOSED; `bd list --status=in_progress --json` -> []; direct reads confirm `ORKA-n0g`, `ORKA-r9z`, `ORKA-hvj`, `ORKA-7c0`, `ORKA-ao8`, `ORKA-9ri`, and `ORKA-zih` remain legitimately OPEN. `bd ready` still shows short read-after-write lag immediately after closure.
- scope confirmation: queue-state audit only; no runtime or governance file edits beyond reporting.

- bead id: ORKA-s0v
- summary of changes: Upgraded Chimerilass heals from simple randomized values to shared-crit-semantics enemy heals with explicit crit/non-crit combat text and structured runtime heal trace across self-heal, ally-heal, and group-heal paths.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/chimerilassHealCritContract.test.js
- test evidence:
  - `npm test -- tests/chimerilassHealCritContract.test.js tests/chimerilassHealThresholdContract.test.js` (4/4 pass)
  - Browser multipass on `http://127.0.0.1:8080/web-runner/`: self-heal sampled `10..17` with crit and non-crit outcomes; ally-heal sampled `11..16` with ally-name combat text plus crit/non-crit outcomes; group-heal sampled `12..15` with crit/non-crit outcomes and targetCount `3`; enemy-turn runtime pass completed with `actionInProgress=0` and `enemyActionActive=false` after the heal action.
- scope confirmation: confined to Chimerilass heal behavior and verification only; no unrelated combat lanes changed.

- bead id: ORKA-f0l
- summary of changes: Added a separate Layout 1 gem counter radiator below the existing turn log, tracking per-hero and party gem usage totals by color from successful hero-turn matches only; fixed the active-hero label path to resolve from the authoritative turn selector contract instead of falling back to the selected hero.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/app.js; web-runner/index.html; tests/heroGemUsageCounterContract.test.js; tests/heroGemUsageRadiatorContract.test.js
- test evidence:
  - `npm test -- tests/heroGemUsageCounterContract.test.js tests/heroGemUsageRadiatorContract.test.js` (4/4 pass)
  - Browser verification on `http://127.0.0.1:8080/web-runner/index.html`: radiator renders as a separate panel beneath `#output`; existing turn log remains in `#output`; live match pass recorded `Huun.GREEN += 3` and `Party.GREEN += 3`; two-gem partial selection produced no counter state before match resolution.
  - Follow-up runtime bug fix: browser pass exposed hero label fallback to Falie after a Huun match; patched `drawGemCounterHUD()` to use `directUID + turnOrder + currentTurnIndex`, then added a contract guarding that selector call.
  - User QA PASS recorded after runtime review.
- scope confirmation: confined to ORKA-f0l hero gem usage telemetry and its Layout 1 radiator presentation; wallet, turn log, and unrelated combat rules were not repurposed.

- bead id: ORKA-c4s
- summary of changes: Added durable hero gem progress state keyed by stable hero identity, deterministic milestone hook surfaces with configurable thresholds, and a web-runner localStorage save/load seam for future Vault child progression layers.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/modules/state.js; Scripts/state.js; web-runner/app.js; tests/heroGemUsageCounterContract.test.js; tests/heroGemUsagePersistenceContract.test.js
- test evidence:
  - `npm test -- tests/heroGemUsageCounterContract.test.js tests/heroGemUsageRadiatorContract.test.js tests/heroGemUsagePersistenceContract.test.js` (7/7 pass)
  - Browser deterministic multipass on `http://127.0.0.1:8080/web-runner/index.html`: pass 1 injected a minimal hero roster, set thresholds to `[3,5]`, registered `Huun.GREEN += 3`, confirmed localStorage snapshot write under `orka.hero_gem_progress.v1`, and observed party/hero threshold `3` hook traces; pass 2 reloaded the page, loaded the stored snapshot back through the runtime API, and confirmed the saved per-hero totals plus milestone state survived the reload.
  - Follow-up runtime bug fixes during verification: milestone reached-state originally failed to mark crossed thresholds, then milestone normalization was zeroing party totals on read; both were corrected in the shared function-bank seam before closeout.
- scope confirmation: confined to ORKA-c4s gem counter persistence and deterministic milestone surfaces only; no reward balancing, unlock payouts, or unrelated combat rules were introduced.

- bead id: ORKA-1qo
- summary of changes: Added a Playwright-driven energy session balance harness CLI with two browser paths: direct Playwright launch and CDP attach to an already-running Chrome via `BALANCE_CDP_URL`/`--cdpUrl`. The harness now drives real canvas clicks, resolves pending hero attack UI by selecting an enemy and pressing the centered attack button, counts zero-HP enemies as defeated, and writes per-session/report artifacts.
- files modified: tools/balance_harness.js; package.json; tests/balanceHarnessContract.test.js
- test evidence:
  - `npm test -- tests/balanceHarnessContract.test.js` (2/2 pass)
  - Runtime seam validation on `http://127.0.0.1:8091/web-runner/index.html`: `window.render_game_to_text` present, `#view` canvas present, layout reached `storyMock`
  - Direct Node Playwright launch against `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` still aborts in this sandbox with `SIGABRT` / Crashpad-bootstrap permission errors, so the recovery path is CDP attach rather than browser spawn
  - Real smoke run passed via attached Chrome: `BALANCE_CDP_URL=http://127.0.0.1:9222 BALANCE_SESSION_COUNT=1 node tools/balance_harness.js --maxWaves 1 --outputDir /tmp/orka-balance-harness-smoke`
  - Artifact verification: `/tmp/orka-balance-harness-smoke/session_results.csv`, `/tmp/orka-balance-harness-smoke/wave_distribution.json`, `/tmp/orka-balance-harness-smoke/balance_recommendations.json`, `/tmp/orka-balance-harness-smoke/balance_report.md`
- scope confirmation: confined to the ORKA-1qo external balance-harness lane; no runtime combat logic or balance formulas were modified.

- bead id: ORKA-9gv
- summary of changes: Reduced mirrored functionBank drift at the Power Amp lifecycle seam by aligning `Scripts/functionBank.js` with the web runner’s activation telemetry semantics, then added a deterministic contract that compares curated high-risk mirrored functions across both runtime paths.
- files modified: Scripts/functionBank.js; tests/functionBankParityContract.test.js
- test evidence:
  - `npm test -- tests/functionBankParityContract.test.js` (1/1 pass)
  - Contract compares normalized source for `activatePowerAmp`, `computeCombatPowerFromStats`, `ApplyScaledCrit`, `CalculateDamage`, `ResolveGemAction`, `ExecuteEnemyJobSkill`, `StartEnemyAction`, `EnemyTurn`, `HeroTurn`, and `PickEnemySkill` across `Scripts/functionBank.js` and `web-runner/modules/functionBank.js`
- scope confirmation: confined to mirrored functionBank parity fencing for high-risk combat/economy seams; no unrelated runtime systems were changed in this lane.

- bead id: ORKA-x18
- summary of changes: Replaced swallowed entity update failures with bounded quarantine behavior after three consecutive faults, added stable entity attribution (`uid` or derived instance key), and recorded structured diagnostics in runtime globals for later inspection.
- files modified: Scripts/entities.js; tests/entityUpdateQuarantineContract.test.js
- test evidence:
  - `npm test -- tests/entityUpdateQuarantineContract.test.js` (2/2 pass)
  - Contract proves repeated failures stop at the quarantine threshold, writes trace/quarantine records with stable keys, and resets consecutive-failure count after a successful update before the next fault.
- scope confirmation: confined to entity lifecycle/update failure handling only; no combat rules, rendering, or game-loop ownership changes were introduced in this lane.

- bead id: ORKA-7kt
- summary of changes: Added a global developer tooling modal shell in the web runner with `Ctrl+Shift+P` hotkey access, config serialization in `state.globals`, safe live-apply controls for gold/board-color/combat-speed, and staged controls for hero count, enemy count, enemy type, and reward configuration exposed through `render_game_to_text` and `window.__codexGame`.
- files modified: web-runner/app.js; tests/devToolingModalContract.test.js
- test evidence:
  - `npm test -- tests/devToolingModalContract.test.js` (1/1 pass)
  - Contract guards the hotkey (`Ctrl+Shift+P`), modal field surface, runtime config writes, combat-speed multiplier seam, and debug-surface accessors.
  - Browser spot-check attempt via local server on `http://127.0.0.1:8092/web-runner/index.html` was blocked by the known Playwright MCP persistent-session startup error (`Opening in existing browser session`), so closeout relies on the deterministic contract plus runtime debug-surface serialization.
- scope confirmation: confined to the ORKA-7kt global dev-tooling modal shell in `web-runner/app.js`; no combat-rule changes or layout-specific UI rewrites were introduced.

- bead id: ORKA-7kt (reopen follow-up)
- summary of changes: Upgraded the dev tooling modal so `Apply` now refreshes combat with stored staged values, `Refresh Game` explicitly reseeds combat from the current config, hero-count changes flow into `initEntities`, forced enemy type filters the encounter pool, and reward drop selection is now a structured known-item select plus count instead of free text.
- files modified: web-runner/app.js; tests/devToolingModalContract.test.js
- test evidence:
  - `npm test -- tests/devToolingModalContract.test.js` (1/1 pass)
  - Contract now guards the refresh handler, apply+refresh button behavior, hero-count reseed seam, forced-enemy-type filtering, and structured reward-drop selection/count wiring.
- scope confirmation: confined to ORKA-7kt modal behavior and combat reseed plumbing for staged dev controls; no unrelated gameplay/system refactors were introduced.

- bead id: ORKA-7kt (final QA closeout)
- summary of changes: Stabilized the dev tooling modal apply path for live runtime use by switching to explicit hero/enemy slot selectors, immediate board fill on dev refresh, pause-safe modal behavior, and unique cloned-hero runtime identity so duplicate heroes do not share turns or actor state.
- files modified: web-runner/app.js; web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/devToolingModalContract.test.js; tests/devHeroCloneIdentityContract.test.js
- test evidence:
  - `npm test -- tests/devToolingModalContract.test.js tests/devHeroCloneIdentityContract.test.js` (2/2 pass)
  - User QA PASS: single-color board apply remains playable, dynamic hero swaps apply cleanly, and duplicate hero clones behave as separate runtime actors.
- scope confirmation: confined to ORKA-7kt dev tooling modal runtime behavior and mirrored hero identity handling needed to support duplicate hero slots; autoplay/idle mode remains separate under ORKA-5vf.

- bead id: ORKA-1ys (visual polish follow-up)
- summary of changes: Tightened the idle farming scene into a cleaner endless mock battle by removing visible hero/enemy labels, switching enemy hit flashes to the real combat-style inverted sprite flash instead of a white-box mask, increasing enemy defeat cadence to 3 hits, and adding visible enemy attack beats so the scene reads as a slow reciprocal fight rather than a hero-only firing line.
- files modified: web-runner/app.js; web-runner/src/core/idleFarmRuntime.mjs; tests/idleFarmLayoutScaffoldContract.test.js
- test evidence:
  - `npm test -- tests/idleFarmLayoutScaffoldContract.test.js tests/evolutionLayoutScaffoldContract.test.js` (4/4 pass)
  - Contract now guards the endless idle facade configuration (`loopForever`, two visible enemy slots, 3-hit enemies, 1.5s spawn delay) and asserts the old `Enemy Approaching...` plus visible hero/enemy label text are absent from the render branch.
- scope confirmation: confined to ORKA-1ys idle-farm presentation/rhythm polish only; no combat-system logic or dev-panel behavior was changed in this follow-up.

- bead id: ORKA-1ys (closeout split)
- summary of changes: Closed the idle-farm combat presentation lane after user-approved rhythm/staging polish and split the remaining reward/emission tuning into follow-up bead `ORKA-gxd` so the economy/display contract can proceed independently from the combat facade.
- files modified: agents/dev_reports.md; agents/pm_status.md
- test evidence:
  - `bd show ORKA-1ys` -> `CLOSED`
  - `bd show ORKA-gxd` -> `OPEN`
- scope confirmation: no gameplay/runtime code changed in this closeout step; this only records the scope split between completed idle-combat presentation and the new emission/display follow-up.

- bead id: ORKA-gxd
- summary of changes: Replaced the idle-farm placeholder reward seam with visible timer-based emissions every ~18 seconds using a faithful adapter of the game’s tiered monster-loot logic, surfaced all loot buckets in the idle strip, removed routed-count math from the player-facing display, and wired `Collect` to credit the shared token wallet plus gold.
- files modified: web-runner/src/core/idleFarmRuntime.mjs; web-runner/app.js; tests/idleFarmLayoutScaffoldContract.test.js
- test evidence:
  - `node --check web-runner/src/core/idleFarmRuntime.mjs` (pass)
  - `npm test -- tests/idleFarmLayoutScaffoldContract.test.js` (2/2 pass)
- scope confirmation: confined to ORKA-gxd idle-farm emission cadence, loot-bucket selection, reward ledger, and idle reward-strip display; no combat-presentation choreography changes were introduced in this lane.

- bead id: ORKA-1ys (reopen staging polish)
- summary of changes: Reopened the idle-farm combat presentation lane to stage actor entry more cinematically, with per-hero entrance timing, 1.5-second enemy arrivals after each lane hero enters, and lowered lane anchors so the two duels read more clearly before the regular idle battle loop takes over.
- files modified: web-runner/src/core/idleFarmRuntime.mjs; web-runner/app.js
- test evidence:
  - `node --check web-runner/src/core/idleFarmRuntime.mjs` (pass)
  - `npm test -- tests/idleFarmLayoutScaffoldContract.test.js` (2/2 pass)
- scope confirmation: confined to ORKA-1ys idle-farm entry choreography and lane staging only; the reward cadence/display changes remain under ORKA-gxd.

- bead id: ORKA-srm
- summary of changes: Fixed the idle-farm Collect path by routing claimed rewards through a shared wallet-commit helper, cloning the token wallet on credit, and recording an explicit `IdleFarmLastCollect` summary so wallet/debug surfaces can confirm the claim instead of only clearing the idle ledger.
- files modified: web-runner/src/core/idleFarmRuntime.mjs; web-runner/app.js; tests/idleFarmCollectWalletContract.test.js
- test evidence:
  - `node --check web-runner/src/core/idleFarmRuntime.mjs` (pass)
  - `npm test -- tests/idleFarmCollectWalletContract.test.js tests/idleFarmLayoutScaffoldContract.test.js` (4/4 pass)
- scope confirmation: confined to ORKA-srm idle-farm reward claim ownership and wallet credit visibility; no combat-presentation or unrelated resource systems were changed.

- bead id: ORKA-xyu
- summary of changes: Rebalanced the idle-farm loot adapter so gold now takes a fixed 40 percent share of emissions while the existing non-gold tier weights are renormalized proportionally, preserving their prior relative rarity ordering.
- files modified: web-runner/src/core/idleFarmRuntime.mjs; tests/idleFarmLootWeightContract.test.js
- test evidence:
  - `node --check web-runner/src/core/idleFarmRuntime.mjs` (pass)
  - `npm test -- tests/idleFarmCollectWalletContract.test.js tests/idleFarmLootWeightContract.test.js tests/idleFarmLayoutScaffoldContract.test.js` (5/5 pass)
- scope confirmation: confined to ORKA-xyu idle emission weighting only; the reward collection seam from ORKA-srm and the larger ORKA-gxd idle-emission QA lane remain otherwise intact.

- bead id: ORKA-4u7
- summary of changes: Fixed the main combat speed bleed by resetting `DevCombatSpeedMultiplier` to `1` on boot instead of hydrating it from persisted dev-tool config. Explicit dev apply still sets the multiplier on purpose, but stale QA settings no longer make normal combat start at an unintended accelerated rate.
- files modified: web-runner/app.js; tests/combatSpeedIsolationContract.test.js
- test evidence:
  - `npm test -- tests/combatSpeedIsolationContract.test.js` (1/1 pass)
  - Note: `node --check web-runner/app.js` is not a valid syntax check in this repo because `web-runner/app.js` is loaded as a browser ES module and Node parses it as CommonJS without package `type: module`.
- scope confirmation: confined to ORKA-4u7 combat-speed initialization only; no turn logic, timing rules, or combat formulas were changed.

- bead id: ORKA-bmv
- summary of changes: Fixed idle-layout entry to cold-boot through the same restart seam as the `Restart Run` button instead of preserving cached session state. This keeps the staged idle presentation deterministic on every entry while leaving the separate reward ledger intact.
- files modified: web-runner/app.js; tests/idleFarmLayoutScaffoldContract.test.js
- test evidence:
  - `node --check web-runner/src/core/idleFarmRuntime.mjs` (pass)
  - `npm test -- tests/idleFarmLayoutScaffoldContract.test.js` (2/2 pass)
- scope confirmation: confined to ORKA-bmv idle-farm entry boot semantics only; no reward ledger math, main combat behavior, or idle presentation choreography timings were changed.

- bead id: ORKA-eh1
- summary of changes: Split idle-farm reward accrual out of the visible theater session into a dedicated background emission ledger with its own cadence state. Idle emissions now continue accruing independently once started, Collect cashes out the current ledger and immediately restarts cadence without restarting the theater, and re-entering the layout still restarts only the staged visual session.
- files modified: web-runner/src/core/idleFarmRuntime.mjs; web-runner/app.js; tests/idleFarmCollectWalletContract.test.js
- test evidence:
  - `node --check web-runner/src/core/idleFarmRuntime.mjs` (pass)
  - `npm test -- tests/idleFarmCollectWalletContract.test.js tests/idleFarmLayoutScaffoldContract.test.js tests/idleFarmLootWeightContract.test.js` (6/6 pass)
- scope confirmation: confined to ORKA-eh1 idle emission ownership and cadence reset semantics only; no regular combat rules, idle theater choreography, or unrelated wallet systems were changed.
- bead: ORKA-3as
- summary of changes: Added an escort-party scaffold seam to combat bootstrap. `app.js` now supports an optional `state.globals.EscortPartyConfig`, builds a one-hero-plus-escort party layout when enabled, spawns the escort as a non-acting `kind: 'escort'` entity, stores `EscortNPCState` in globals, and renders the escort through the combat portrait roster without including it in initiative. Added a hot-file scope declaration at `.beads/hot-file-lock/ORKA-3as.scope`.
- files modified: web-runner/app.js; tests/escortPartyScaffoldContract.test.js; .beads/hot-file-lock/ORKA-3as.scope
- test evidence: `npm test -- tests/escortPartyScaffoldContract.test.js` (2/2 pass)
- scope confirmation: Confined to escort-party scaffold wiring in combat bootstrap/rendering only; no encounter design, targeting, or acting escort logic was introduced.
- bead: ORKA-l8sd
- summary of changes: Reconciled the product model between the older permanent-roster direction and the new Hall of Heroes legacy system. The ruling is now documented in `governance/product/game-function-reference.md`: permanent party units remain valid for the active four-slot roster, while temporary event allies now resolve into Hall relic/spirit legacy rewards instead of permanent roster bodies. Also narrowed the meanings of `ORKA-d9g` and `ORKA-v2s` so future implementation beads do not conflict.
- files modified: governance/product/game-function-reference.md
- test evidence: Policy/documentation decision bead; no runtime test required.
- scope confirmation: This lane only resolves product-model ownership and future bead direction. No gameplay/runtime code changed.
- bead: ORKA-jpvp
- summary of changes: Reprioritized the Hall of Heroes lane after product review. Marked the Hall epic and child beads as blocked/P3, recorded the prerequisite systems that must exist first, and kept the earlier product-model ruling as the active future-compatible truth.
- files modified: agents/pm_status.md
- test evidence: PM queue cleanup only; direct `bd show` verification on blocked Hall beads.
- scope confirmation: This lane only changed priority/dependency status and PM tracking. No runtime or product-rule implementation changed.
- bead: ORKA-qpff
- summary of changes: Optimized the hot-file scope enforcement hook by replacing the quadratic bash line/function scan with a single-pass Python validator over the staged changed-line set. This preserved the same hot-file policy checks while cutting runtime on the ORKA-luo staged diff from about 28m46s to 0.01s.
- files modified: tools/enforce_hot_file_scope.sh
- test evidence:
  - `/usr/bin/time -p bash tools/enforce_hot_file_scope.sh ORKA-luo` (pass; `real 0.01`)
- scope confirmation: Confined to tooling performance only. No gameplay/runtime policy was loosened; the hook still enforces one active bead, declared hot-file scopes, and function-only edits.

- bead id: ORKA-ysp
- summary of changes: Tuned the yellow randomize/bounce sequence to complete faster by shortening the telegraph, per-gem spin, and settle timings while keeping the ordered per-gem settle flow intact. Also updated the adjacent yellow gold-flyup contract to match the current gold-target owner seam.
- files modified: web-runner/app.js; tests/yellowSlamSequenceContract.test.js; tests/yellowGoldFlyupContract.test.js
- test evidence:
  - `npm test -- tests/yellowSlamSequenceContract.test.js tests/yellowGoldFlyupContract.test.js tests/functionBankParityContract.test.js` (5/5 pass)
- scope confirmation: Confined to ORKA-ysp yellow sequence timing and matching contract upkeep only; no yellow mechanic rules, reward math, or turn-gate semantics were changed.

- bead id: ORKA-vm7
- summary of changes: Removed gradient/heat-mapped floating combat text colors and replaced them with fixed approved palette values. Generic damage now renders flat red, healing renders flat cyan, and Kojonn DoT damage routes through a dedicated `dot` text kind for flat purple text without changing damage math.
- files modified: web-runner/app.js; web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/damageTextPaletteContract.test.js
- test evidence:
  - `npm test -- tests/damageTextPaletteContract.test.js tests/hitFlashFeedbackContract.test.js tests/functionBankParityContract.test.js` (7/7 pass)
- scope confirmation: Confined to ORKA-vm7 floating combat text palette selection and the minimal DoT text-kind payload seam only; no combat formulas, timing, or DoT lifecycle rules were changed.
