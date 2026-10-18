# Character identity: reference and storage audit

Planning evidence for ORKA-90u; no runtime changes. This appendix supports the [revised plan](character-identity-rebuild.md).

## Baseline and reproducible census

Code baseline: local main `97f77474e44cb1f869ec2ecd227cc397fe4aac75`. Scan tracked UTF-8 files without NUL in `web-runner`, `Scripts`, `src`, `tests`, `tools`. Search literal `Falie|Huun|Kojonn` with and without case sensitivity; search literal case-sensitive `heroInstanceKey`. This reproduces **84 exact-case files and 31 instance-key files**. Case-insensitive matching adds eight files, yielding **92**. Counts include tests, docs and generated source, rather than only shipped runtime. Per-file results appear below; generated strings and filename references require semantic inspection before edits.

The eight additional files are `tests/falieEnmityTargetBiasContract.test.js`, `tests/heroSkillDefinitionRegistryContract.test.js`, `tests/sustainTrackerContract.test.mjs`, `tools/README.md`, `web-runner/src/core/arenaCombat.mjs`, `web-runner/src/core/idleAutoplayPriority.mjs`, `web-runner/systems/combatAttackVfxPresentation.mjs`, and `web-runner/systems/runtimeVisualAssetLoader.js`.

## Verified review findings

- `heroProgression.mjs:53` accepts saved heroes only at the current version; unmatched input becomes default ownership. `heroProgressStorage.js:19,34-36` invokes persistence and writes when dirty. An in-memory storage mock using the unchanged production restore code, input version 99 / level 42 / dirty=true, saved version 2 / level 1 with no error. This demonstrates a wipe path; it does not assert that every restore unconditionally writes. No browser or real save was touched by this probe.
- `heroProgression.mjs:70-74` creates/persists actors under their instance key. `heroDefinitions.mjs:122-125` maps display labels through retired names. `realtimeHeroSkills.mjs:187,191` gates both follow-up and retaliation on names. `realtimeCooldown.mjs:6` gives unresolved heroes the first hero's base attack interval.
- `combatProgressionRules.mjs:40,69-75` keys wallets/eligible recipients by actor identity; menu-level spending can target the canonical owner. Owner reconciliation must include credits, pending spends, objective/reward targets and idempotency receipts. This audit did not total any player's stranded balances.
- `actorPuppetPresentation.mjs:5`, live imported `superGemRuntime.js`, `gameState.js:318-321`, layout data, `Scripts/functionBank.js` and `src/core/dynamicInitiativeAuthorityExperiment.mjs` remain part of the reference surface. Name removal cannot stop at the original plan's module list.
- Combat roster resolution is configured in `heroScreenConfig.js` and `devToolingRuntime.js`; this audit found no current saved party field to convert. `createHeroProgressStore:65` creates ownership for every definition. A new persisted party or changed acquisition rule is a separate feature decision.

## Save-key manifest and authority

Record absent keys as absent. Preserve storage area, origin, exact bytes and relevant per-tab identity in the conversion checkpoint. Current Gold authority is `equipment-economy.v5.gold`; `wishfire.gold.v1` is a legacy import source, not an additional balance to add. Hero pending receipts and equipment settled receipts form a cross-store acknowledgment protocol.

| Key | Area and owner | Content / conversion concern |
| --- | --- | --- |
| `orka.hero_progress.v2` | localStorage; `heroProgressStorage.js`, developer controls | Permanent records, pending battle/Gold settlements, settled battles/ticket spends and continuous-stage checkpoint. Unknown versions can be overwritten today. |
| `orka.combat_progression.v1` | localStorage; `combatProgression.mjs` | Per-hero ticket wallets, pending spends, objectives, rewards, training/resources. Its commit path has no cross-tab lock today. |
| `wishfire.equipment-economy.v5` | localStorage; `equipmentStorage.mjs` | Inventory/loadouts, Gold, settled Gold receipts, lamp capacity/emissions/cache/held gear, Essence and upgrade state. Existing equipment lock and storage listener. |
| `wishfire.equipment-economy.v4` | localStorage; equipment import | Retained migration input; checkpoint even if inactive. |
| `wishfire.equipment-economy.v3` | localStorage; equipment import | Retained migration input; checkpoint even if inactive. |
| `wishfire.equipment-economy.v2` | localStorage; equipment import | Retained migration input; checkpoint even if inactive. |
| `wishfire.equipment-economy.v1` | localStorage; equipment import | Retained migration input; checkpoint even if inactive. |
| `wishfire.gold.v1` | localStorage; equipment legacy import | Preserve alongside the authoritative current bank and receipts; never double-credit. No current writer was identified in these scanned runtime roots. |
| `wishfire.qa.reset-backup.v1` | localStorage; `devToolingControls.js` | Opaque map of previous namespaced localStorage bytes. Reset writes it and removes all other `orka.`/`wishfire.` keys. Restore/import must be generation-aware; do not automatically replay old contents. |
| `wishfire.equipment-conveyor-clock.v1` | sessionStorage by default; equipment checkpoint storage can be injected | Seed/sequence/time/active-time clock. Capture per tab and fence against the associated equipment generation. It is not part of the localStorage reset backup. |
| `orka.dev_tooling_config.v1` | sessionStorage; `devToolingRuntime.js` | Resolved developer hero/enemy slots and options. Preserve current roster resolution; do not invent a party migration from this session-only configuration. |

The literal namespace-string scan also finds five lab/report schemas (`orka.combat-claims.v1`, `orka.combat-lab-manifest.v1`, `orka.sustain-case-run.v2`, `orka.sustain-cases.v1`, `orka.sustain-tracker.v2`) and two bundle filenames. These are not established browser save keys. A raw namespace match is not a save inventory. Before implementation, inspect computed keys and enumerate actual keys from each supported save/origin; preserve additional discovered state rather than assuming this static list proves none exists.

## Writers and removal paths

| Writer | Coordination requirement |
| --- | --- |
| `heroProgressStorage.js`: restore, dirty persistence, bound reward persistence, settlement acknowledgment | One version/revision-aware write owner; no fallback save after unsupported restore. Flush or block queued writes at migration. |
| `equipmentStorage.mjs`: locked transactions and separate conveyor checkpoint writes | Retain cross-tab protection; agree on cross-domain lock order and generation-qualified session clock. |
| `combatProgression.mjs`: `commit` | Protect ticket/objective writes under the affected-domain coordinator; reject stale state. |
| `devToolingControls.js`: `applyDeveloperLevel`, `resetDeveloperGame` | Direct hero write and namespace-wide removal. Route supported calls through the coordinator; preserve backups and guard imports. |
| `devToolingRuntime.js`: session config writes/removal, reset/level dispatch | Existing reset call holds the equipment lock, but normal hero writers do not. Coordinate all paths rather than recursively taking the same lock. |
| `tools/balance_harness.js`, storage-writing fixtures in tests | These deliberately seed raw saves. Use isolated QA storage/origins or the new supported fixture import path; never target an active player generation. |

A broad `.clear()` scan also matches Set/Map cleanup in animation/presentation helpers; those matches are not browser storage writers. Already-running incompatible code can ignore all new locks and remove the entire namespace. Use the revised plan's quiescence/isolation requirement; a marker alone cannot make that safe.

## Per-file census

`R` means case-insensitive retired-name match; `H` means `heroInstanceKey`. An `R` without exact casing is included in the eight additions above. Classification as required supported consumer, generated source, test or obsolete artifact is an implementation preflight responsibility; a match does not authorize restoring retired code.

| File | R | H |
| --- | --- | --- |
| [Scripts/functionBank.js](../../Scripts/functionBank.js) | yes | yes |
| [src/core/dynamicInitiativeAuthorityExperiment.mjs](../../src/core/dynamicInitiativeAuthorityExperiment.mjs) | yes |  |
| [tests/actorPuppetPresentation.test.mjs](../../tests/actorPuppetPresentation.test.mjs) | yes |  |
| [tests/arenaCombatRulesContract.test.mjs](../../tests/arenaCombatRulesContract.test.mjs) | yes |  |
| [tests/balanceHarnessEntryContract.test.js](../../tests/balanceHarnessEntryContract.test.js) | yes |  |
| [tests/combatAttackVfxContract.test.mjs](../../tests/combatAttackVfxContract.test.mjs) | yes |  |
| [tests/combatKnowledgeLabContract.test.mjs](../../tests/combatKnowledgeLabContract.test.mjs) | yes |  |
| [tests/combatPartyInitializationContract.test.js](../../tests/combatPartyInitializationContract.test.js) | yes | yes |
| [tests/combatProgression.test.mjs](../../tests/combatProgression.test.mjs) |  | yes |
| [tests/combatRulesMigration.test.js](../../tests/combatRulesMigration.test.js) | yes |  |
| [tests/combatRuntimeRngOwnershipContract.test.js](../../tests/combatRuntimeRngOwnershipContract.test.js) | yes |  |
| [tests/conditionalSkillRulesContract.test.mjs](../../tests/conditionalSkillRulesContract.test.mjs) | yes |  |
| [tests/continuousCombatStageContract.test.mjs](../../tests/continuousCombatStageContract.test.mjs) | yes |  |
| [tests/dynamicInitiativeAuthorityExperimentContract.test.js](../../tests/dynamicInitiativeAuthorityExperimentContract.test.js) | yes |  |
| [tests/dynamicInitiativeRuntimeShadowContract.test.js](../../tests/dynamicInitiativeRuntimeShadowContract.test.js) | yes |  |
| [tests/dynamicInitiativeSchedulerContract.test.js](../../tests/dynamicInitiativeSchedulerContract.test.js) | yes |  |
| [tests/effectiveStatOwnershipContract.test.js](../../tests/effectiveStatOwnershipContract.test.js) | yes |  |
| [tests/enemyDebuffApplyOwnershipContract.test.js](../../tests/enemyDebuffApplyOwnershipContract.test.js) | yes |  |
| [tests/enemyDebuffSlotTransitionOwnershipContract.test.js](../../tests/enemyDebuffSlotTransitionOwnershipContract.test.js) | yes |  |
| [tests/enemyDotPacketOwnershipContract.test.js](../../tests/enemyDotPacketOwnershipContract.test.js) | yes |  |
| [tests/enemyRefillTurnGateContract.test.js](../../tests/enemyRefillTurnGateContract.test.js) | yes |  |
| [tests/enemyRewardLifecycleContract.test.js](../../tests/enemyRewardLifecycleContract.test.js) | yes | yes |
| [tests/enemyTargetSelectionOwnershipContract.test.js](../../tests/enemyTargetSelectionOwnershipContract.test.js) | yes |  |
| [tests/enemyTargetingRulesContract.test.js](../../tests/enemyTargetingRulesContract.test.js) | yes |  |
| [tests/entityUpdateQuarantineContract.test.js](../../tests/entityUpdateQuarantineContract.test.js) | yes |  |
| [tests/falieEnmityTargetBiasContract.test.js](../../tests/falieEnmityTargetBiasContract.test.js) | yes |  |
| [tests/fazeGreenSuperGemSeparationContract.test.js](../../tests/fazeGreenSuperGemSeparationContract.test.js) | yes |  |
| [tests/fixtures/lamp-auto-earned-69.json](../../tests/fixtures/lamp-auto-earned-69.json) | yes | yes |
| [tests/gameStateEnvelopePacketContract.test.js](../../tests/gameStateEnvelopePacketContract.test.js) | yes |  |
| [tests/healingGemTenPercentContract.test.js](../../tests/healingGemTenPercentContract.test.js) | yes |  |
| [tests/heroArtAssetsContract.test.mjs](../../tests/heroArtAssetsContract.test.mjs) | yes |  |
| [tests/heroCommandsContract.test.js](../../tests/heroCommandsContract.test.js) | yes |  |
| [tests/heroProgressionMigration.test.js](../../tests/heroProgressionMigration.test.js) | yes | yes |
| [tests/heroScreenProgressionContract.test.mjs](../../tests/heroScreenProgressionContract.test.mjs) |  | yes |
| [tests/heroScreenUILayout.test.mjs](../../tests/heroScreenUILayout.test.mjs) |  | yes |
| [tests/heroSkillDefinitionRegistryContract.test.js](../../tests/heroSkillDefinitionRegistryContract.test.js) | yes |  |
| [tests/heroTargetRandomizationContract.test.js](../../tests/heroTargetRandomizationContract.test.js) | yes |  |
| [tests/huunExecutionDropBonusContract.test.js](../../tests/huunExecutionDropBonusContract.test.js) | yes |  |
| [tests/huunYellowSuperGemGoldstrikeContract.test.js](../../tests/huunYellowSuperGemGoldstrikeContract.test.js) | yes |  |
| [tests/idleAutoplayPriorityGemContract.test.js](../../tests/idleAutoplayPriorityGemContract.test.js) | yes |  |
| [tests/kojonnAmpAoeContract.test.js](../../tests/kojonnAmpAoeContract.test.js) | yes |  |
| [tests/kojonnFazeDotContract.test.js](../../tests/kojonnFazeDotContract.test.js) | yes |  |
| [tests/kojonnHealHotContract.test.js](../../tests/kojonnHealHotContract.test.js) | yes |  |
| [tests/kojonnRoleCorrectionContract.test.js](../../tests/kojonnRoleCorrectionContract.test.js) | yes |  |
| [tests/kojonnSuperGemBlightContract.test.js](../../tests/kojonnSuperGemBlightContract.test.js) | yes |  |
| [tests/lampBagCount.test.mjs](../../tests/lampBagCount.test.mjs) |  | yes |
| [tests/lampConveyor.test.mjs](../../tests/lampConveyor.test.mjs) | yes | yes |
| [tests/lampEquipment.test.mjs](../../tests/lampEquipment.test.mjs) | yes | yes |
| [tests/lampPresentation.test.mjs](../../tests/lampPresentation.test.mjs) | yes | yes |
| [tests/partyDamageAccountingContract.test.js](../../tests/partyDamageAccountingContract.test.js) | yes |  |
| [tests/partyFormationContract.test.js](../../tests/partyFormationContract.test.js) | yes |  |
| [tests/partyStatOsdContract.test.js](../../tests/partyStatOsdContract.test.js) | yes |  |
| [tests/partySustain.test.mjs](../../tests/partySustain.test.mjs) | yes |  |
| [tests/pendingRewardPersistenceContract.test.mjs](../../tests/pendingRewardPersistenceContract.test.mjs) | yes |  |
| [tests/progressionTransitions.test.mjs](../../tests/progressionTransitions.test.mjs) | yes | yes |
| [tests/questCombatSessionContract.test.js](../../tests/questCombatSessionContract.test.js) |  | yes |
| [tests/realtimeBasicCombatRulesContract.test.mjs](../../tests/realtimeBasicCombatRulesContract.test.mjs) | yes |  |
| [tests/realtimeCooldownContract.test.mjs](../../tests/realtimeCooldownContract.test.mjs) | yes |  |
| [tests/realtimeHeroBasicSchedulingContract.test.mjs](../../tests/realtimeHeroBasicSchedulingContract.test.mjs) | yes |  |
| [tests/realtimeHeroSkillTargetingContract.test.mjs](../../tests/realtimeHeroSkillTargetingContract.test.mjs) | yes |  |
| [tests/realtimeHeroSkillsContract.test.mjs](../../tests/realtimeHeroSkillsContract.test.mjs) | yes |  |
| [tests/realtimeTwoWaveIntegration.test.mjs](../../tests/realtimeTwoWaveIntegration.test.mjs) | yes | yes |
| [tests/sessionLevelUpSettlementPresentation.test.mjs](../../tests/sessionLevelUpSettlementPresentation.test.mjs) | yes | yes |
| [tests/singleHitOwnershipContract.test.js](../../tests/singleHitOwnershipContract.test.js) | yes |  |
| [tests/speedInitiativeSchedulerContract.test.js](../../tests/speedInitiativeSchedulerContract.test.js) | yes |  |
| [tests/superGemAttackSkillBoundsContract.test.js](../../tests/superGemAttackSkillBoundsContract.test.js) | yes |  |
| [tests/superGemCriticalHealContract.test.js](../../tests/superGemCriticalHealContract.test.js) | yes |  |
| [tests/superGemInteractionPacingContract.test.js](../../tests/superGemInteractionPacingContract.test.js) | yes |  |
| [tests/sustainTrackerContract.test.mjs](../../tests/sustainTrackerContract.test.mjs) | yes |  |
| [tests/yellowCoinAccountingContract.test.js](../../tests/yellowCoinAccountingContract.test.js) | yes |  |
| [tools/README.md](../../tools/README.md) | yes |  |
| [tools/audit_initiative_fairness.js](../../tools/audit_initiative_fairness.js) | yes |  |
| [tools/balance_harness.js](../../tools/balance_harness.js) |  | yes |
| [tools/combat_knowledge_lab.mjs](../../tools/combat_knowledge_lab.mjs) | yes |  |
| [tools/combat_lab/claims.mjs](../../tools/combat_lab/claims.mjs) | yes |  |
| [tools/combat_lab/model.mjs](../../tools/combat_lab/model.mjs) | yes |  |
| [tools/eval_target_selector_sync.mjs](../../tools/eval_target_selector_sync.mjs) | yes |  |
| [tools/eval_yellow_coin_accounting.mjs](../../tools/eval_yellow_coin_accounting.mjs) | yes |  |
| [tools/qa_huun_yellow_supergem_browser.mjs](../../tools/qa_huun_yellow_supergem_browser.mjs) | yes |  |
| [web-runner/assets/AGENTS.md](../../web-runner/assets/AGENTS.md) | yes |  |
| [web-runner/assets/layouts.json](../../web-runner/assets/layouts.json) | yes |  |
| [web-runner/modules/functionBank.js](../../web-runner/modules/functionBank.js) | yes | yes |
| [web-runner/modules/heroCommands.mjs](../../web-runner/modules/heroCommands.mjs) |  | yes |
| [web-runner/modules/sessionLevelUpSettlementPresentation.mjs](../../web-runner/modules/sessionLevelUpSettlementPresentation.mjs) |  | yes |
| [web-runner/src/core/arenaCombat.mjs](../../web-runner/src/core/arenaCombat.mjs) | yes |  |
| [web-runner/src/core/combatProgressionRules.mjs](../../web-runner/src/core/combatProgressionRules.mjs) |  | yes |
| [web-runner/src/core/dynamicInitiativeAuthorityExperiment.mjs](../../web-runner/src/core/dynamicInitiativeAuthorityExperiment.mjs) | yes |  |
| [web-runner/src/core/heroDefinitions.mjs](../../web-runner/src/core/heroDefinitions.mjs) | yes |  |
| [web-runner/src/core/heroProgression.mjs](../../web-runner/src/core/heroProgression.mjs) |  | yes |
| [web-runner/src/core/idleAutoplayPriority.mjs](../../web-runner/src/core/idleAutoplayPriority.mjs) | yes |  |
| [web-runner/src/core/lampGear.mjs](../../web-runner/src/core/lampGear.mjs) |  | yes |
| [web-runner/src/core/realtimeCooldown.mjs](../../web-runner/src/core/realtimeCooldown.mjs) | yes |  |
| [web-runner/src/core/realtimeHeroSkills.mjs](../../web-runner/src/core/realtimeHeroSkills.mjs) | yes |  |
| [web-runner/state/gameState.js](../../web-runner/state/gameState.js) | yes |  |
| [web-runner/state/heroArtAssets.mjs](../../web-runner/state/heroArtAssets.mjs) | yes |  |
| [web-runner/state/heroScreenConfig.js](../../web-runner/state/heroScreenConfig.js) | yes |  |
| [web-runner/systems/AGENTS.md](../../web-runner/systems/AGENTS.md) | yes |  |
| [web-runner/systems/actorPuppetPresentation.mjs](../../web-runner/systems/actorPuppetPresentation.mjs) | yes |  |
| [web-runner/systems/combatAttackVfxPresentation.mjs](../../web-runner/systems/combatAttackVfxPresentation.mjs) | yes |  |
| [web-runner/systems/combatProgression.mjs](../../web-runner/systems/combatProgression.mjs) |  | yes |
| [web-runner/systems/combatSessionInitializer.js](../../web-runner/systems/combatSessionInitializer.js) |  | yes |
| [web-runner/systems/devToolingRuntime.js](../../web-runner/systems/devToolingRuntime.js) | yes | yes |
| [web-runner/systems/equipmentStorage.mjs](../../web-runner/systems/equipmentStorage.mjs) |  | yes |
| [web-runner/systems/heroGearUI.mjs](../../web-runner/systems/heroGearUI.mjs) |  | yes |
| [web-runner/systems/heroProgressStorage.js](../../web-runner/systems/heroProgressStorage.js) |  | yes |
| [web-runner/systems/lampEquipmentUI.mjs](../../web-runner/systems/lampEquipmentUI.mjs) | yes | yes |
| [web-runner/systems/renderHeroScreen.js](../../web-runner/systems/renderHeroScreen.js) |  | yes |
| [web-runner/systems/runtimeVisualAssetLoader.js](../../web-runner/systems/runtimeVisualAssetLoader.js) | yes |  |
| [web-runner/systems/superGemRuntime.js](../../web-runner/systems/superGemRuntime.js) | yes |  |
