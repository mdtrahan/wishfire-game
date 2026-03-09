# Development Reports

## Template
- bead id:
- summary of changes:
- files modified:
- test evidence:
- scope confirmation:

## Reports
- (append newest report at top)
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
