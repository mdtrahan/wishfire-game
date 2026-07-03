➜  codex-orka git:(main) ✗ npx fallow
Need to install the following packages:
fallow@2.87.0
Ok to proceed? (y) y

■ Metrics: dead files 97.3% (320 of 329) · dead exports 90.3% (970 of 1074) · MI 73.8 (moderate) · 2 churn hotspots
  329 files analyzed
  6 entry points detected (6 package.json)
  106 refactoring targets — try `fallow dead-code --workspace <name>` to scope
Tip: run `fallow explain <issue label>`; spaces and hyphens both work, e.g. `fallow explain unused files`.


── Dead Code ──────────────────────────────────────

── Unused Code ─────────────────────────────────────

● Unused files (320)
  tests/  169 files
  web-runner/  82 files
  src/  44 files
  Scripts/  22 files
  tools/  2 files
  node-app/  1 file
  Files not reachable from any entry point — https://docs.fallow.tools/explanations/dead-code#unused-files
  To suppress a directory: add to ignorePatterns in .fallowrc.json
  151 in src, 169 in test directories

● Unused exports (1)
  tools/playwright_support.js
    :185 httpGetJson
  Exported symbols with no known consumers — https://docs.fallow.tools/explanations/dead-code#unused-exports
  (969 more in files already reported as unused)

── Dependencies ─────────────────────────────────────

● Unresolved imports (1)
  Scripts/functionBank.js
    :25 ../src/core/initiativeGuards.mjs
  Import paths that could not be resolved — check for missing packages or broken paths. Framework-specific imports may need a plugin: https://docs.fallow.tools/plugins — https://docs.fallow.tools/explanations/dead-code#unresolved-imports

✗ 320 files · 1 export · 1 unresolved import (0.06s)

── Duplication ────────────────────────────────────

● Duplicates (450 clone groups)

  2,338 lines  2 instances  dup:4d477798
    Scripts/functionBank.js:768-3105
    web-runner/modules/functionBank.js:811-3144

  2,129 lines  2 instances  dup:c63cb419
    Scripts/functionBank.js:3706-5834
    web-runner/modules/functionBank.js:3715-5843

  1,098 lines  2 instances  dup:2436780e
    Scripts/functionBank.js:7414-8511
    web-runner/modules/functionBank.js:7433-8530

    880 lines  2 instances  dup:a12c779a
    Scripts/functionBank.js:6535-7414
    web-runner/modules/functionBank.js:6554-7433

    574 lines  2 instances  dup:cc9f85d0
    Scripts/functionBank.js:5930-6503
    web-runner/modules/functionBank.js:5946-6519

    549 lines  2 instances  dup:908eb2e5
    src/core/statusEffectRules.mjs:1-549
    web-runner/src/core/statusEffectRules.mjs:1-549

    447 lines  2 instances  dup:645e11c1
    src/core/combatRuntimeGateway.cjs:7-453
    web-runner/src/core/combatRuntimeGateway.js:7-453

    407 lines  2 instances  dup:a39e335d
    Scripts/functionBank.js:43-449
    web-runner/modules/functionBank.js:44-450

    320 lines  2 instances  dup:b3ef4ecd
    src/core/turnGateController.mjs:1-320
    web-runner/src/core/turnGateController.mjs:1-320

    296 lines  2 instances  dup:eef219fe
    src/core/turnOrderGroupRules.mjs:1-296
    web-runner/src/core/turnOrderGroupRules.mjs:1-296

  ... and 440 more clone groups
  Identical code blocks detected via suffix-array analysis — https://docs.fallow.tools/explanations/duplication#clone-groups

● Mirrored: Scripts/ ↔ web-runner/modules/ (7 files, 9,038 lines)
  functionBank.js
  functionRegistry.js
  liveOpsTokens.js
  mainSheet.js
  monsterLootTableEventTokens.js
  skillSheet.js
  state.js

● Mirrored: src/core/ ↔ web-runner/src/core/ (28 files, 5,657 lines)
  calculateDamageRules.mjs
  combatRuntimeGateway.js
  damageFloatVector.mjs
  effectiveStatRules.mjs
  enemyJobSkillRules.mjs
  enemyRosterStability.mjs
  enemySkillChoiceRules.mjs
  enemyTargetingRules.mjs
  enemyTurnFlowRules.mjs
  gameStateEnvelopeRules.mjs
  ... and 18 more

  Directories containing identical file copies — https://docs.fallow.tools/explanations/duplication#clone-families

● Clone families (40 with multiple groups)

  3 groups, 37 lines across Scripts/functionBank.js, web-runner/app.js, web-runner/modules/functionBank.js
    → Extract shared function (11 lines) from functionBank.js, app.js, functionBank.js
    → Extract shared function (8 lines) from functionBank.js, app.js, functionBank.js
    → Extract shared function (18 lines) from functionBank.js, app.js, functionBank.js

  4 groups, 110 lines across Scripts/functionBank.js, web-runner/modules/functionBank.js, web-runner/systems/superGemRuntime.js
    → Extract 4 shared clone groups (110 lines) from functionBank.js, functionBank.js, superGemRuntime.js into a shared directory

  6 groups, 245 lines across src/core/combatRuntimeGateway.cjs, src/core/combatRuntimeGateway.js, web-runner/src/core/combatRuntimeGateway.js
    → Extract 6 shared clone groups (245 lines) from combatRuntimeGateway.cjs, combatRuntimeGateway.js, combatRuntimeGateway.js into a shared directory

  4 groups, 254 lines across src/core/gameStateEnvelopeRules.cjs, src/core/gameStateEnvelopeRules.mjs, web-runner/src/core/gameStateEnvelopeRules.mjs
    → Extract 4 shared clone groups (254 lines) from gameStateEnvelopeRules.cjs, gameStateEnvelopeRules.mjs, gameStateEnvelopeRules.mjs into a shared directory

  2 groups, 20 lines across tests/astralFlowAmpBarContract.test.js
    → Extract shared function (11 lines) from astralFlowAmpBarContract.test.js, astralFlowAmpBarContract.test.js
    → Extract shared function (9 lines) from astralFlowAmpBarContract.test.js, astralFlowAmpBarContract.test.js, astralFlowAmpBarContract.test.js

  2 groups, 24 lines across tests/astralFlowAmpBarContract.test.js, tests/extraTurnHarnessContract.test.js, tests/heroGemUsagePersistenceContract.test.js
    → Extract shared function (16 lines) from astralFlowAmpBarContract.test.js, extraTurnHarnessContract.test.js, heroGemUsagePersistenceContract.test.js
    → Extract shared function (8 lines) from astralFlowAmpBarContract.test.js, extraTurnHarnessContract.test.js, heroGemUsagePersistenceContract.test.js

  2 groups, 16 lines across tests/astralFlowAmpBarContract.test.js, tests/superGemAppContract.test.js
    → Extract shared function (10 lines) from astralFlowAmpBarContract.test.js, superGemAppContract.test.js
    → Extract shared function (6 lines) from astralFlowAmpBarContract.test.js, astralFlowAmpBarContract.test.js, superGemAppContract.test.js

  2 groups, 17 lines across tests/calculateDamageOwnershipContract.test.js, tests/enemyJobSkillOwnershipContract.test.js, tests/enemySkillChoiceOwnershipContract.test.js, tests/enemyTargetSelectionOwnershipContract.test.js, tests/enemyTurnFlowOwnershipContract.test.js, tests/gemActionOwnershipContract.test.js, tests/heroTurnEntryOwnershipContract.test.js, tests/roundPointerAdvanceOwnershipContract.test.js, tests/runaMagicResistOwnershipContract.test.js, tests/startEnemyActionOwnershipContract.test.js, tests/turnOrderGroupOwnershipContract.test.js, tests/turnPhaseAssignmentOwnershipContract.test.js
    → Extract shared function (8 lines) from calculateDamageOwnershipContract.test.js, enemyJobSkillOwnershipContract.test.js, enemySkillChoiceOwnershipContract.test.js, enemyTargetSelectionOwnershipContract.test.js, enemyTurnFlowOwnershipContract.test.js, gemActionOwnershipContract.test.js, heroTurnEntryOwnershipContract.test.js, roundPointerAdvanceOwnershipContract.test.js, runaMagicResistOwnershipContract.test.js, startEnemyActionOwnershipContract.test.js, turnOrderGroupOwnershipContract.test.js, turnPhaseAssignmentOwnershipContract.test.js
    → Extract shared function (9 lines) from calculateDamageOwnershipContract.test.js, enemyJobSkillOwnershipContract.test.js, enemySkillChoiceOwnershipContract.test.js, enemyTargetSelectionOwnershipContract.test.js, enemyTurnFlowOwnershipContract.test.js, gemActionOwnershipContract.test.js, heroTurnEntryOwnershipContract.test.js, roundPointerAdvanceOwnershipContract.test.js, runaMagicResistOwnershipContract.test.js, startEnemyActionOwnershipContract.test.js, turnOrderGroupOwnershipContract.test.js, turnPhaseAssignmentOwnershipContract.test.js

  2 groups, 40 lines across tests/chimerilassHealThresholdContract.test.js, tests/heroGemUsageCounterContract.test.js
    → Extract shared function (25 lines) from chimerilassHealThresholdContract.test.js, heroGemUsageCounterContract.test.js
    → Extract shared function (15 lines) from chimerilassHealThresholdContract.test.js, heroGemUsageCounterContract.test.js

  2 groups, 28 lines across tests/combatOutcomeOwnershipContract.test.js, tests/seededRngShadowWiringContract.test.js
    → Extract shared function (14 lines) from combatOutcomeOwnershipContract.test.js, seededRngShadowWiringContract.test.js
    → Extract shared function (14 lines) from combatOutcomeOwnershipContract.test.js, seededRngShadowWiringContract.test.js

  ... and 30 more families

  Groups of related clones across the same files — https://docs.fallow.tools/explanations/duplication#clone-families

✗ 38,734 lines (56.0%) duplicated across 256 files (0.16s)

── Complexity ─────────────────────────────────────

■ Metrics: 72,600 LOC · dead files 97.3% · dead exports 90.3% · avg cyclomatic 4.9 · p90 cyclomatic 12 · maintainability 73.8 (moderate) · 2 churn hotspots (since 6 months)

  Function size: 75% low · 13% medium · 8% high · 4% very high  (1-15 / 16-30 / 31-60 / >60 LOC)
  Parameters:    92% low · 7% medium · 1% high · 0% very high  (0-2 / 3-4 / 5-6 / >=7 params)

● Large functions (10 shown, 192 total)
  web-runner/app.js
    :4175 main  4035 lines
    :6690 handlePointerDown  815 lines
    :4608 registerCoreLayouts  344 lines
    :7564 tick  341 lines
  web-runner/systems/renderHeroScreen.js
    :343 renderHeroScreen  311 lines
  web-runner/app.js
    :1676 ensureDevToolingModal  220 lines
    :3277 initEntities  220 lines
    :4376 loadC3ProjectAssets  214 lines
  tests/statusEffectPacketContract.test.js
    :31 <arrow>  213 lines
  web-runner/systems/renderIdleFarm.js
    :1 renderIdleFarm  206 lines
  Functions exceeding 60 lines of code (very high risk): https://docs.fallow.tools/explanations/health#unit-size
  use --top 192 to see all

● High complexity functions (1279)
  CRAP scores are estimated from export references; run `fallow health --coverage <coverage-final.json>` for exact scores.
  web-runner/app.js
    :6690 handlePointerDown CRITICAL
         244 cyclomatic  402 cognitive  815 lines
         59780.0 CRAP
    :7564 tick CRITICAL
         132 cyclomatic  123 cognitive  341 lines
         17556.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :178 updateShadowDomMarker CRITICAL
         131 cyclomatic   66 cognitive  193 lines
         17292.0 CRAP
  Scripts/functionBank.js
    :4904 ApplyDamageToTarget CRITICAL
          74 cyclomatic   81 cognitive  131 lines
         5550.0 CRAP
  web-runner/modules/functionBank.js
    :4913 ApplyDamageToTarget CRITICAL
          74 cyclomatic   81 cognitive  131 lines
         5550.0 CRAP
  Scripts/functionBank.js
    :7545 ExecuteSkill CRITICAL
          70 cyclomatic   75 cognitive  149 lines
         4970.0 CRAP
  web-runner/modules/functionBank.js
    :7564 ExecuteSkill CRITICAL
          70 cyclomatic   75 cognitive  149 lines
         4970.0 CRAP
  web-runner/app.js
    :3277 initEntities CRITICAL
          64 cyclomatic   92 cognitive  220 lines
         4160.0 CRAP
  Scripts/functionBank.js
    :3537 ProcessCurrentTurn CRITICAL
          61 cyclomatic   74 cognitive   94 lines
         3782.0 CRAP
  web-runner/modules/functionBank.js
    :3527 ProcessCurrentTurn CRITICAL
          61 cyclomatic   74 cognitive   94 lines
         3782.0 CRAP
  web-runner/src/core/idleFarmRuntime.mjs
    :273 updateIdleFarmSessionState CRITICAL
          60 cyclomatic   75 cognitive  177 lines
         3660.0 CRAP
  Scripts/functionBank.js
    :7953 ProcessTurn CRITICAL
          58 cyclomatic   72 cognitive  128 lines
         3422.0 CRAP
  web-runner/modules/functionBank.js
    :7972 ProcessTurn CRITICAL
          58 cyclomatic   72 cognitive  128 lines
         3422.0 CRAP
  web-runner/systems/renderHeroScreen.js
    :343 renderHeroScreen CRITICAL
          56 cyclomatic   48 cognitive  311 lines
         3192.0 CRAP
  Scripts/functionBank.js
    :5950 QueueEnemyDamageOverTime CRITICAL
          54 cyclomatic   49 cognitive   84 lines
         2970.0 CRAP
  web-runner/modules/functionBank.js
    :5966 QueueEnemyDamageOverTime CRITICAL
          54 cyclomatic   49 cognitive   84 lines
         2970.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :2385 createSimulationCoreGemActionResolution CRITICAL
          53 cyclomatic   41 cognitive  173 lines
         2862.0 CRAP
  web-runner/app.js
    :5653 processTurnCadencePartyRegens CRITICAL
          51 cyclomatic   65 cognitive  115 lines
         2652.0 CRAP
  Scripts/functionBank.js
    :4427 maybeResolveEnemyDotPacketOwner CRITICAL
          50 cyclomatic   34 cognitive   70 lines
         2550.0 CRAP
  web-runner/modules/functionBank.js
    :4436 maybeResolveEnemyDotPacketOwner CRITICAL
          50 cyclomatic   34 cognitive   70 lines
         2550.0 CRAP
  Scripts/functionBank.js
    :6035 ProcessEnemyTurnDamageOverTime CRITICAL
          49 cyclomatic   67 cognitive  120 lines
         2450.0 CRAP
  web-runner/modules/functionBank.js
    :6051 ProcessEnemyTurnDamageOverTime CRITICAL
          49 cyclomatic   67 cognitive  120 lines
         2450.0 CRAP
  Scripts/functionBank.js
    :4106 maybeResolveSingleHitOwner CRITICAL
          47 cyclomatic   33 cognitive   56 lines
         2256.0 CRAP
    :7282 ResolveGemAction CRITICAL
          47 cyclomatic   47 cognitive   99 lines
         2256.0 CRAP
  tools/balance_harness.js
    :330 waitForCombatReady CRITICAL
          47 cyclomatic   38 cognitive   66 lines
         2256.0 CRAP
  web-runner/modules/functionBank.js
    :4115 maybeResolveSingleHitOwner CRITICAL
          47 cyclomatic   33 cognitive   56 lines
         2256.0 CRAP
    :7301 ResolveGemAction CRITICAL
          47 cyclomatic   47 cognitive   99 lines
         2256.0 CRAP
  Scripts/functionBank.js
    :1999 TryPartyDestiny CRITICAL
          46 cyclomatic   44 cognitive   60 lines
         2162.0 CRAP
  web-runner/modules/functionBank.js
    :2042 TryPartyDestiny CRITICAL
          46 cyclomatic   44 cognitive   60 lines
         2162.0 CRAP
  web-runner/app.js
    :7909 <arrow> CRITICAL
          45 cyclomatic   42 cognitive  145 lines
         2070.0 CRAP
    :512 spawnPendingDamageNumbers CRITICAL
          44 cyclomatic   84 cognitive   64 lines
         1980.0 CRAP
    :2539 <arrow> CRITICAL
          44 cyclomatic   32 cognitive   35 lines
         1980.0 CRAP
  web-runner/modules/functionBank.js
    :3659 AdvanceTurn CRITICAL
          44 cyclomatic   45 cognitive   58 lines
         1980.0 CRAP
  Scripts/functionBank.js
    :8295 ExecuteEnemyJobSkill CRITICAL
          42 cyclomatic   43 cognitive   72 lines
         1806.0 CRAP
  web-runner/app.js
    :2328 <arrow> CRITICAL
          42 cyclomatic   13 cognitive   28 lines
         1806.0 CRAP
  web-runner/modules/functionBank.js
    :8314 ExecuteEnemyJobSkill CRITICAL
          42 cyclomatic   43 cognitive   72 lines
         1806.0 CRAP
  web-runner/src/core/superGemBoardState.mjs
    :222 spendSuperGem CRITICAL
          42 cyclomatic   36 cognitive  102 lines
         1806.0 CRAP
  web-runner/systems/renderHeroScreen.js
    :96 drawHeroSkillNode CRITICAL
          42 cyclomatic   40 cognitive   96 lines
         1806.0 CRAP
  src/core/gemActionRules.mjs
    :144 ownerDecisionFromResult CRITICAL
          40 cyclomatic   23 cognitive   34 lines
         1640.0 CRAP
  tools/balance_harness.js
    :483 runSession CRITICAL
          40 cyclomatic   41 cognitive   79 lines
         1640.0 CRAP
  web-runner/src/core/gemActionRules.mjs
    :144 ownerDecisionFromResult CRITICAL
          40 cyclomatic   23 cognitive   34 lines
         1640.0 CRAP
  web-runner/systems/renderHeroScreen.js
    :193 renderHeroSkillModal CRITICAL
          40 cyclomatic   39 cognitive  149 lines
         1640.0 CRAP
  Scripts/functionBank.js
    :5300 applyRunaMagicResist CRITICAL
          39 cyclomatic   29 cognitive   58 lines
         1560.0 CRAP
    :8368 StartEnemyAction CRITICAL
          39 cyclomatic   28 cognitive   46 lines
         1560.0 CRAP
  web-runner/modules/functionBank.js
    :5309 applyRunaMagicResist CRITICAL
          39 cyclomatic   29 cognitive   58 lines
         1560.0 CRAP
    :8387 StartEnemyAction CRITICAL
          39 cyclomatic   28 cognitive   46 lines
         1560.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :1912 createSimulationCoreHeroTurnEntryResolution CRITICAL
          39 cyclomatic   33 cognitive  131 lines
         1560.0 CRAP
    :3357 createSimulationCoreEnemyDotPacketResolution CRITICAL
          39 cyclomatic   32 cognitive  126 lines
         1560.0 CRAP
  Scripts/functionBank.js
    :1231 fromStableId CRITICAL
          37 cyclomatic   44 cognitive   44 lines
         1406.0 CRAP
    :3783 queueConfiguredDoubleAttackFollowUp CRITICAL
          37 cyclomatic   46 cognitive   53 lines
         1406.0 CRAP
    :4594 maybeResolveCalculateDamageOwner CRITICAL
          37 cyclomatic   26 cognitive   44 lines
         1406.0 CRAP
    :6867 buildGemActionFallbackDecision CRITICAL
          37 cyclomatic   39 cognitive   52 lines
         1406.0 CRAP
    :7399 BuildRoundGroups CRITICAL
          37 cyclomatic   45 cognitive   99 lines
         1406.0 CRAP
    :7695 ResolveEnemyAction CRITICAL
          37 cyclomatic   59 cognitive   70 lines
         1406.0 CRAP
  web-runner/modules/functionBank.js
    :1274 fromStableId CRITICAL
          37 cyclomatic   44 cognitive   44 lines
         1406.0 CRAP
    :3792 queueConfiguredDoubleAttackFollowUp CRITICAL
          37 cyclomatic   46 cognitive   53 lines
         1406.0 CRAP
    :4603 maybeResolveCalculateDamageOwner CRITICAL
          37 cyclomatic   26 cognitive   44 lines
         1406.0 CRAP
    :6886 buildGemActionFallbackDecision CRITICAL
          37 cyclomatic   39 cognitive   52 lines
         1406.0 CRAP
    :7418 BuildRoundGroups CRITICAL
          37 cyclomatic   45 cognitive   99 lines
         1406.0 CRAP
    :7714 ResolveEnemyAction CRITICAL
          37 cyclomatic   59 cognitive   70 lines
         1406.0 CRAP
  web-runner/systems/superGemRuntime.js
    :547 queueClusterAoeHits CRITICAL
          37 cyclomatic   49 cognitive   82 lines
         1406.0 CRAP
  Scripts/functionBank.js
    :4305 maybeResolveEnemyDotTickOwner CRITICAL
          36 cyclomatic   23 cognitive   56 lines
         1332.0 CRAP
  web-runner/modules/functionBank.js
    :4314 maybeResolveEnemyDotTickOwner CRITICAL
          36 cyclomatic   23 cognitive   56 lines
         1332.0 CRAP
  web-runner/systems/renderHUD.js
    :41 drawGemCounterHUD CRITICAL
          36 cyclomatic   33 cognitive   70 lines
         1332.0 CRAP
  web-runner/systems/superGemRuntime.js
    :357 refreshTaintedGroundZone CRITICAL
          36 cyclomatic   31 cognitive   68 lines
         1332.0 CRAP
  Scripts/functionBank.js
    :7845 HeroTurn CRITICAL
          35 cyclomatic   42 cognitive   52 lines
         1260.0 CRAP
  web-runner/modules/functionBank.js
    :3149 recordTurnSchedulerEvent CRITICAL
          35 cyclomatic   49 cognitive    1 lines
         1260.0 CRAP
    :7864 HeroTurn CRITICAL
          35 cyclomatic   42 cognitive   52 lines
         1260.0 CRAP
  Scripts/functionBank.js
    :1022 refreshFazeTaintedGroundZone CRITICAL
          34 cyclomatic   30 cognitive   62 lines
         1190.0 CRAP
    :7898 resolveProcessTurnActorEligibility CRITICAL
          34 cyclomatic   29 cognitive   54 lines
         1190.0 CRAP
  src/core/turnGateController.mjs
    :21 derivePresentationTurnBarrier CRITICAL
          34 cyclomatic   21 cognitive   65 lines
         1190.0 CRAP
  web-runner/modules/functionBank.js
    :1065 refreshFazeTaintedGroundZone CRITICAL
          34 cyclomatic   30 cognitive   62 lines
         1190.0 CRAP
    :7917 resolveProcessTurnActorEligibility CRITICAL
          34 cyclomatic   29 cognitive   54 lines
         1190.0 CRAP
  web-runner/src/core/turnGateController.mjs
    :21 derivePresentationTurnBarrier CRITICAL
          34 cyclomatic   21 cognitive   65 lines
         1190.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :3975 shadowEnemyDotTick CRITICAL
          34 cyclomatic   31 cognitive   66 lines
         1190.0 CRAP
  src/core/powerAmpRules.mjs
    :184 derivePowerAmpRenderState CRITICAL
          33 cyclomatic   13 cognitive   44 lines
         1122.0 CRAP
  web-runner/app.js
    :3688 startYellowCasinoSequence CRITICAL
          33 cyclomatic   43 cognitive  126 lines
         1122.0 CRAP
  web-runner/src/core/powerAmpRules.mjs
    :184 derivePowerAmpRenderState CRITICAL
          33 cyclomatic   13 cognitive   44 lines
         1122.0 CRAP
  Scripts/functionBank.js
    :1411 cloneHeroSkillProgressState CRITICAL
          32 cyclomatic   30 cognitive   19 lines
         1056.0 CRAP
    :3899 maybeResolveEffectiveStatOwner CRITICAL
          32 cyclomatic   20 cognitive   36 lines
         1056.0 CRAP
  web-runner/modules/functionBank.js
    :1454 cloneHeroSkillProgressState CRITICAL
          32 cyclomatic   30 cognitive   19 lines
         1056.0 CRAP
    :3908 maybeResolveEffectiveStatOwner CRITICAL
          32 cyclomatic   20 cognitive   36 lines
         1056.0 CRAP
  web-runner/systems/renderBoard.js
    :65 renderBoard CRITICAL
          32 cyclomatic   60 cognitive  104 lines
         1056.0 CRAP
  web-runner/systems/superGemRuntime.js
    :630 syncTaintedGroundZones CRITICAL
          32 cyclomatic   40 cognitive   67 lines
         1056.0 CRAP
  Scripts/functionBank.js
    :4378 maybeResolveEnemyDotLifecycleOwner CRITICAL
          31 cyclomatic   23 cognitive   44 lines
         992.0 CRAP
  web-runner/app.js
    :2824 fetchJson CRITICAL
          31 cyclomatic   37 cognitive   97 lines
         992.0 CRAP
    :3280 <arrow> CRITICAL
          31 cyclomatic    5 cognitive   10 lines
         992.0 CRAP
    :3978 handleGemMatch CRITICAL
          31 cyclomatic   36 cognitive  155 lines
         992.0 CRAP
  web-runner/modules/functionBank.js
    :4387 maybeResolveEnemyDotLifecycleOwner CRITICAL
          31 cyclomatic   23 cognitive   44 lines
         992.0 CRAP
    :5834 HeroAttackSingle CRITICAL
          31 cyclomatic   43 cognitive   74 lines
         992.0 CRAP
  web-runner/systems/renderHUD.js
    :112 drawHUD CRITICAL
          31 cyclomatic   29 cognitive   70 lines
         992.0 CRAP
  Scripts/functionBank.js
    :4208 maybeResolveTurnSummaryOwner CRITICAL
          30 cyclomatic   19 cognitive   36 lines
         930.0 CRAP
    :4639 CalculateDamage CRITICAL
          30 cyclomatic   32 cognitive   72 lines
         930.0 CRAP
    :5747 maybeResolvePartyDamageOwner CRITICAL
          30 cyclomatic   16 cognitive   46 lines
         930.0 CRAP
    :6393 finalizeEnemyRespawnWindow CRITICAL
          30 cyclomatic   45 cognitive   49 lines
         930.0 CRAP
    :6451 SpawnEnemy CRITICAL
          30 cyclomatic   20 cognitive   56 lines
         930.0 CRAP
  web-runner/modules/functionBank.js
    :4217 maybeResolveTurnSummaryOwner CRITICAL
          30 cyclomatic   19 cognitive   36 lines
         930.0 CRAP
    :4648 CalculateDamage CRITICAL
          30 cyclomatic   32 cognitive   72 lines
         930.0 CRAP
    :5756 maybeResolvePartyDamageOwner CRITICAL
          30 cyclomatic   16 cognitive   46 lines
         930.0 CRAP
    :6409 finalizeEnemyRespawnWindow CRITICAL
          30 cyclomatic   45 cognitive   49 lines
         930.0 CRAP
    :6467 SpawnEnemy CRITICAL
          30 cyclomatic   20 cognitive   56 lines
         930.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :2150 <arrow> CRITICAL
          30 cyclomatic   16 cognitive   14 lines
         930.0 CRAP
    :3903 shadowSingleHitResolution CRITICAL
          30 cyclomatic   29 cognitive   71 lines
         930.0 CRAP
  web-runner/systems/superGemRuntime.js
    :726 executePendingSuperGemAction CRITICAL
          30 cyclomatic   28 cognitive   70 lines
         930.0 CRAP
  Scripts/functionBank.js
    :4071 maybeShadowSingleHitResolution CRITICAL
          29 cyclomatic   25 cognitive   34 lines
         870.0 CRAP
    :5630 ExecutePurpleDebuff CRITICAL
          29 cyclomatic   27 cognitive   90 lines
         870.0 CRAP
    :5825 HeroAttackSingle CRITICAL
          29 cyclomatic   42 cognitive   70 lines
         870.0 CRAP
  src/core/enemyRosterStability.mjs
    :16 getEnemyRosterStability CRITICAL
          29 cyclomatic   31 cognitive   79 lines
         870.0 CRAP
  web-runner/modules/functionBank.js
    :4080 maybeShadowSingleHitResolution CRITICAL
          29 cyclomatic   25 cognitive   34 lines
         870.0 CRAP
    :5639 ExecutePurpleDebuff CRITICAL
          29 cyclomatic   27 cognitive   90 lines
         870.0 CRAP
  web-runner/src/core/enemyRosterStability.mjs
    :16 getEnemyRosterStability CRITICAL
          29 cyclomatic   31 cognitive   79 lines
         870.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :558 hasRequiredExports CRITICAL
          29 cyclomatic    1 cognitive   30 lines
         870.0 CRAP
    :2288 createSimulationCoreRoundPointerAdvanceResolution CRITICAL
          29 cyclomatic   25 cognitive   96 lines
         870.0 CRAP
  web-runner/systems/superGemRuntime.js
    :229 queueHuunYellowGoldstrike CRITICAL
          29 cyclomatic   29 cognitive   81 lines
         870.0 CRAP
  Scripts/functionBank.js
    :3837 TryGrantConfiguredExtraTurn CRITICAL
          28 cyclomatic   26 cognitive   39 lines
         812.0 CRAP
    :8415 SpawnDamageText CRITICAL
          28 cyclomatic   25 cognitive   78 lines
         812.0 CRAP
  src/core/calculateDamageRules.mjs
    :164 createCalculateDamageSimulationPacket CRITICAL
          28 cyclomatic   15 cognitive   72 lines
         812.0 CRAP
  src/core/gemActionRules.mjs
    :79 gemActionFromJs CRITICAL
          28 cyclomatic   27 cognitive   64 lines
         812.0 CRAP
  tools/playwright_support.js
    :98 classifyPlaywrightFailure CRITICAL
          28 cyclomatic   14 cognitive   81 lines
         812.0 CRAP
  web-runner/modules/functionBank.js
    :3846 TryGrantConfiguredExtraTurn CRITICAL
          28 cyclomatic   26 cognitive   39 lines
         812.0 CRAP
    :8434 SpawnDamageText CRITICAL
          28 cyclomatic   25 cognitive   78 lines
         812.0 CRAP
  web-runner/src/core/calculateDamageRules.mjs
    :164 createCalculateDamageSimulationPacket CRITICAL
          28 cyclomatic   15 cognitive   72 lines
         812.0 CRAP
  web-runner/src/core/gemActionRules.mjs
    :79 gemActionFromJs CRITICAL
          28 cyclomatic   27 cognitive   64 lines
         812.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :537 hasGemActionExports CRITICAL
          28 cyclomatic    1 cognitive   16 lines
         812.0 CRAP
  web-runner/systems/superGemRuntime.js
    :138 queueClusterSingleHits CRITICAL
          28 cyclomatic   33 cognitive   67 lines
         812.0 CRAP
    :797 activateSuperGemEffect CRITICAL
          28 cyclomatic   34 cognitive  105 lines
         812.0 CRAP
  Scripts/functionBank.js
    :1164 SelectSkillDraughtCard CRITICAL
          27 cyclomatic   22 cognitive   37 lines
         756.0 CRAP
    :1452 buildHeroSkillProgressTrace CRITICAL
          27 cyclomatic   26 cognitive   22 lines
         756.0 CRAP
    :1475 ensureHeroSkillProgressRecord CRITICAL
          27 cyclomatic   22 cognitive   33 lines
         756.0 CRAP
  src/core/schedulerRules.mjs
    :75 deriveBattleStartRemaining CRITICAL
          27 cyclomatic   28 cognitive   30 lines
         756.0 CRAP
  web-runner/modules/functionBank.js
    :1207 SelectSkillDraughtCard CRITICAL
          27 cyclomatic   22 cognitive   37 lines
         756.0 CRAP
    :1495 buildHeroSkillProgressTrace CRITICAL
          27 cyclomatic   26 cognitive   22 lines
         756.0 CRAP
    :1518 ensureHeroSkillProgressRecord CRITICAL
          27 cyclomatic   22 cognitive   33 lines
         756.0 CRAP
    :3187 reconcileInitiativeQueue CRITICAL
          27 cyclomatic   34 cognitive   65 lines
         756.0 CRAP
  web-runner/src/core/schedulerRules.mjs
    :75 deriveBattleStartRemaining CRITICAL
          27 cyclomatic   28 cognitive   30 lines
         756.0 CRAP
  Scripts/functionBank.js
    :1386 buildDefaultHeroSkillProgressState CRITICAL
          26 cyclomatic   24 cognitive   24 lines
         702.0 CRAP
    :4498 maybeResolveEnemyDebuffDecayOwner CRITICAL
          26 cyclomatic   16 cognitive   45 lines
         702.0 CRAP
    :4544 maybeResolveEnemyDebuffApplyOwner CRITICAL
          26 cyclomatic   16 cognitive   49 lines
         702.0 CRAP
    :8137 PickEnemySkill CRITICAL
          26 cyclomatic   19 cognitive   39 lines
         702.0 CRAP
  src/core/partyDamageRules.mjs
    :154 createPartyDamageSimulationPacket CRITICAL
          26 cyclomatic   19 cognitive   86 lines
         702.0 CRAP
  web-runner/app.js
    :3176 buildEncounterByBudget CRITICAL
          26 cyclomatic   41 cognitive  100 lines
         702.0 CRAP
    :5610 maybeResolvePartyRegenTickOwner CRITICAL
          26 cyclomatic   13 cognitive   42 lines
         702.0 CRAP
    :5769 drawFrame CRITICAL
          26 cyclomatic   25 cognitive  156 lines
         702.0 CRAP
  web-runner/modules/functionBank.js
    :1429 buildDefaultHeroSkillProgressState CRITICAL
          26 cyclomatic   24 cognitive   24 lines
         702.0 CRAP
    :4507 maybeResolveEnemyDebuffDecayOwner CRITICAL
          26 cyclomatic   16 cognitive   45 lines
         702.0 CRAP
    :4553 maybeResolveEnemyDebuffApplyOwner CRITICAL
          26 cyclomatic   16 cognitive   49 lines
         702.0 CRAP
    :8156 PickEnemySkill CRITICAL
          26 cyclomatic   19 cognitive   39 lines
         702.0 CRAP
  web-runner/src/core/partyDamageRules.mjs
    :154 createPartyDamageSimulationPacket CRITICAL
          26 cyclomatic   19 cognitive   86 lines
         702.0 CRAP
  web-runner/systems/renderIdleFarm.js
    :1 renderIdleFarm CRITICAL
          26 cyclomatic   18 cognitive  206 lines
         702.0 CRAP
  Scripts/functionBank.js
    :2580 RegisterHeroGemUsage CRITICAL
          25 cyclomatic   20 cognitive   30 lines
         650.0 CRAP
    :3214 buildInitiativePreview CRITICAL
          25 cyclomatic   37 cognitive   50 lines
         650.0 CRAP
  Scripts/skillSheet.js
    :76 DoHeal CRITICAL
          25 cyclomatic   26 cognitive   49 lines
         650.0 CRAP
  web-runner/app.js
    :1608 applyDevToolingConfig CRITICAL
          25 cyclomatic   25 cognitive   67 lines
         650.0 CRAP
    :5362 rebuildRenderedCache CRITICAL
          25 cyclomatic   33 cognitive   72 lines
         650.0 CRAP
  web-runner/modules/functionBank.js
    :2623 RegisterHeroGemUsage CRITICAL
          25 cyclomatic   20 cognitive   30 lines
         650.0 CRAP
  web-runner/modules/skillSheet.js
    :76 DoHeal CRITICAL
          25 cyclomatic   26 cognitive   49 lines
         650.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :1745 createSimulationCoreStartEnemyActionResolution CRITICAL
          25 cyclomatic   22 cognitive   90 lines
         650.0 CRAP
  Scripts/functionBank.js
    :5494 maybeResolveEnemyDebuffSlotOwner CRITICAL
          24 cyclomatic   14 cognitive   53 lines
         600.0 CRAP
    :6644 AwardMonsterDrop CRITICAL
          24 cyclomatic   29 cognitive   65 lines
         600.0 CRAP
  src/core/turnOrderGroupRules.mjs
    :82 normalizeTurnOrderActor CRITICAL
          24 cyclomatic    6 cognitive   18 lines
         600.0 CRAP
  src/core/turnSummaryRules.mjs
    :167 createTurnSummarySimulationPacket CRITICAL
          24 cyclomatic   22 cognitive   89 lines
         600.0 CRAP
  web-runner/app.js
    :1417 readEscortPartyConfig CRITICAL
          24 cyclomatic   13 cognitive   21 lines
         600.0 CRAP
  web-runner/modules/functionBank.js
    :5503 maybeResolveEnemyDebuffSlotOwner CRITICAL
          24 cyclomatic   14 cognitive   53 lines
         600.0 CRAP
    :6663 AwardMonsterDrop CRITICAL
          24 cyclomatic   29 cognitive   65 lines
         600.0 CRAP
  web-runner/src/core/turnOrderGroupRules.mjs
    :82 normalizeTurnOrderActor CRITICAL
          24 cyclomatic    6 cognitive   18 lines
         600.0 CRAP
  web-runner/src/core/turnSummaryRules.mjs
    :167 createTurnSummarySimulationPacket CRITICAL
          24 cyclomatic   22 cognitive   89 lines
         600.0 CRAP
  web-runner/systems/renderIdleFarm.js
    :138 <arrow> CRITICAL
          24 cyclomatic   22 cognitive   30 lines
         600.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :1645 createSimulationCoreEnemyJobSkillResolution CRITICAL
          24 cyclomatic   21 cognitive   99 lines
         600.0 CRAP
    :3256 createSimulationCoreSingleHitResolution CRITICAL
          24 cyclomatic   23 cognitive  100 lines
         600.0 CRAP
  web-runner/systems/superGemRuntime.js
    :474 queueKojonnTaintedGroundAoe CRITICAL
          24 cyclomatic   25 cognitive   72 lines
         600.0 CRAP
  Scripts/functionBank.js
    :2635 LoadHeroGemProgressSnapshot CRITICAL
          23 cyclomatic   19 cognitive   41 lines
         552.0 CRAP
  src/core/combatRuntimeGateway.cjs
    :296 createCombatSnapshotOwnerPayload CRITICAL
          23 cyclomatic   21 cognitive   26 lines
         552.0 CRAP
  src/core/enemyTargetingRules.mjs
    :180 resolveEnemyTargetHero CRITICAL
          23 cyclomatic   21 cognitive   60 lines
         552.0 CRAP
  src/core/roundPointerAdvanceRules.mjs
    :147 createRoundPointerAdvanceSimulationPacket CRITICAL
          23 cyclomatic   19 cognitive   87 lines
         552.0 CRAP
  tools/balance_harness.js
    :438 resolveMatch CRITICAL
          23 cyclomatic   15 cognitive   44 lines
         552.0 CRAP
  web-runner/app.js
    :333 canResolveDeferredAdvance CRITICAL
          23 cyclomatic   14 cognitive   45 lines
         552.0 CRAP
    :6505 runDevAutoplayUntilDepleted CRITICAL
          23 cyclomatic   38 cognitive   72 lines
         552.0 CRAP
    :8096 setEncounterRequest CRITICAL
          23 cyclomatic   21 cognitive   22 lines
         552.0 CRAP
  web-runner/modules/functionBank.js
    :2678 LoadHeroGemProgressSnapshot CRITICAL
          23 cyclomatic   19 cognitive   41 lines
         552.0 CRAP
  web-runner/src/core/combatRuntimeGateway.js
    :296 createCombatSnapshotOwnerPayload CRITICAL
          23 cyclomatic   21 cognitive   26 lines
         552.0 CRAP
  web-runner/src/core/enemyTargetingRules.mjs
    :180 resolveEnemyTargetHero CRITICAL
          23 cyclomatic   21 cognitive   60 lines
         552.0 CRAP
  web-runner/src/core/roundPointerAdvanceRules.mjs
    :147 createRoundPointerAdvanceSimulationPacket CRITICAL
          23 cyclomatic   19 cognitive   87 lines
         552.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :1255 createSimulationCoreCombatSnapshotResolution CRITICAL
          23 cyclomatic   25 cognitive   96 lines
         552.0 CRAP
    :3019 createSimulationCorePartyRegenTickResolution CRITICAL
          23 cyclomatic   21 cognitive  101 lines
         552.0 CRAP
  Scripts/functionBank.js
    :1975 applyPartyDestinyActorHeal CRITICAL
          22 cyclomatic   24 cognitive   23 lines
         506.0 CRAP
    :3936 GetEffectiveStat CRITICAL
          22 cyclomatic   18 cognitive   32 lines
         506.0 CRAP
  tools/balance_harness.js
    :397 waitForLivingEnemies CRITICAL
          22 cyclomatic   18 cognitive   27 lines
         506.0 CRAP
  web-runner/modules/functionBank.js
    :2018 applyPartyDestinyActorHeal CRITICAL
          22 cyclomatic   24 cognitive   23 lines
         506.0 CRAP
    :3945 GetEffectiveStat CRITICAL
          22 cyclomatic   18 cognitive   32 lines
         506.0 CRAP
  web-runner/src/core/damageNumberAnimation.mjs
    :41 createDamageNumber CRITICAL
          22 cyclomatic   25 cognitive  187 lines
         506.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :2046 <arrow> CRITICAL
          22 cyclomatic    8 cognitive   12 lines
         506.0 CRAP
    :2849 createSimulationCorePartyDamageResolution CRITICAL
          22 cyclomatic   19 cognitive  111 lines
         506.0 CRAP
    :3484 createSimulationCoreEnemyDotTickResolution CRITICAL
          22 cyclomatic   20 cognitive   98 lines
         506.0 CRAP
  web-runner/systems/superGemRuntime.js
    :442 removeDirectBlightCoveredByTaintedGround CRITICAL
          22 cyclomatic   27 cognitive   31 lines
         506.0 CRAP
  Scripts/functionBank.js
    :3285 selectNextInitiativeActor CRITICAL
          21 cyclomatic   28 cognitive   67 lines
         462.0 CRAP
    :6557 KillEnemyByUID CRITICAL
          21 cyclomatic   20 cognitive   31 lines
         462.0 CRAP
  web-runner/app.js
    :4626 onEnter CRITICAL
          21 cyclomatic   18 cognitive   48 lines
         462.0 CRAP
  web-runner/modules/functionBank.js
    :5909 HeroAttackAOE CRITICAL
          21 cyclomatic   22 cognitive   47 lines
         462.0 CRAP
    :6576 KillEnemyByUID CRITICAL
          21 cyclomatic   20 cognitive   31 lines
         462.0 CRAP
  web-runner/src/core/gsapShim.mjs
    :103 applyDomStyle CRITICAL
          21 cyclomatic   19 cognitive   36 lines
         462.0 CRAP
  web-runner/src/core/idleFarmRuntime.mjs
    :235 updateIdleFarmEmissionState CRITICAL
          21 cyclomatic   20 cognitive   25 lines
         462.0 CRAP
  web-runner/systems/renderIdleFarm.js
    :100 <arrow> CRITICAL
          21 cyclomatic   16 cognitive   31 lines
         462.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :1562 createSimulationCoreEnemySkillChoiceResolution CRITICAL
          21 cyclomatic   20 cognitive   82 lines
         462.0 CRAP
    :2787 createSimulationCoreCalculateDamageResolution CRITICAL
          21 cyclomatic   21 cognitive   61 lines
         462.0 CRAP
    :3739 createSimulationCoreEnemyDebuffSlotTransition CRITICAL
          21 cyclomatic   20 cognitive   85 lines
         462.0 CRAP
  web-runner/systems/superGemRuntime.js
    :89 beginQueuedHeroAction CRITICAL
          21 cyclomatic   20 cognitive   48 lines
         462.0 CRAP
  Scripts/functionBank.js
    :1536 buildHeroSkillPointTxn CRITICAL
          20 cyclomatic   19 cognitive   19 lines
         420.0 CRAP
    :2863 applyRewardPayload CRITICAL
          20 cyclomatic   16 cognitive   39 lines
         420.0 CRAP
    :4272 maybeShadowEnemyDotTick CRITICAL
          20 cyclomatic   18 cognitive   32 lines
         420.0 CRAP
    :4362 computeEnemyDotLifecycleAction CRITICAL
          20 cyclomatic   19 cognitive   15 lines
         420.0 CRAP
    :6242 Enemy_Heal_Ally CRITICAL
          20 cyclomatic   17 cognitive   45 lines
         420.0 CRAP
  Scripts/legacy but partially working/scripts/CombatLogic.js
    :13 <arrow> CRITICAL
          20 cyclomatic   17 cognitive  113 lines
         420.0 CRAP
  src/core/combatRuntimeGateway.cjs
    :265 evaluateCheckpointJsFailures CRITICAL
          20 cyclomatic   23 cognitive   30 lines
         420.0 CRAP
    :407 resume CRITICAL
          20 cyclomatic   18 cognitive   36 lines
         420.0 CRAP
  src/core/combatRuntimeGateway.js
    :180 evaluateCheckpoint CRITICAL
          20 cyclomatic   23 cognitive   34 lines
         420.0 CRAP
  src/core/turnGateController.mjs
    :121 createEnemyRosterRefillHold CRITICAL
          20 cyclomatic   17 cognitive   23 lines
         420.0 CRAP
  web-runner/app.js
    :6633 getEnemyHit CRITICAL
          20 cyclomatic   21 cognitive   23 lines
         420.0 CRAP
  web-runner/modules/functionBank.js
    :1579 buildHeroSkillPointTxn CRITICAL
          20 cyclomatic   19 cognitive   19 lines
         420.0 CRAP
    :2906 applyRewardPayload CRITICAL
          20 cyclomatic   16 cognitive   39 lines
         420.0 CRAP
    :3318 selectNextInitiativeActor CRITICAL
          20 cyclomatic   18 cognitive   30 lines
         420.0 CRAP
    :4281 maybeShadowEnemyDotTick CRITICAL
          20 cyclomatic   18 cognitive   32 lines
         420.0 CRAP
    :4371 computeEnemyDotLifecycleAction CRITICAL
          20 cyclomatic   19 cognitive   15 lines
         420.0 CRAP
    :6258 Enemy_Heal_Ally CRITICAL
          20 cyclomatic   17 cognitive   45 lines
         420.0 CRAP
    :6524 KillEnemyAt CRITICAL
          20 cyclomatic   19 cognitive   34 lines
         420.0 CRAP
  web-runner/src/core/combatRuntimeGateway.js
    :265 evaluateCheckpointJsFailures CRITICAL
          20 cyclomatic   23 cognitive   30 lines
         420.0 CRAP
    :407 resume CRITICAL
          20 cyclomatic   18 cognitive   36 lines
         420.0 CRAP
  web-runner/src/core/turnGateController.mjs
    :121 createEnemyRosterRefillHold CRITICAL
          20 cyclomatic   17 cognitive   23 lines
         420.0 CRAP
  web-runner/systems/renderChests.js
    :3 renderChests CRITICAL
          20 cyclomatic   18 cognitive   65 lines
         420.0 CRAP
  web-runner/systems/renderTomes.js
    :3 renderTomes CRITICAL
          20 cyclomatic   23 cognitive  106 lines
         420.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :1836 createSimulationCoreEnemyTurnFlowResolution CRITICAL
          20 cyclomatic   21 cognitive   75 lines
         420.0 CRAP
    :3583 createSimulationCoreEnemyDotLifecycleResolution CRITICAL
          20 cyclomatic   20 cognitive   73 lines
         420.0 CRAP
  web-runner/modules/functionBank.js
    :773 GetHeroPowerAmpRenderState CRITICAL
          20 cyclomatic   14 cognitive   43 lines
         420.0 CRAP
  web-runner/src/core/partyDamageRules.mjs
    :95 resolvePartyDamage CRITICAL
          20 cyclomatic   12 cognitive   58 lines
         420.0 CRAP
  Scripts/functionBank.js
    :730 GetHeroPowerAmpRenderState CRITICAL
          20 cyclomatic   14 cognitive   43 lines
         420.0 CRAP
  web-runner/app.js
    :5580 maybeResolvePartyRegenLifecycleOwner CRITICAL
          20 cyclomatic   12 cognitive   29 lines
         420.0 CRAP
  src/core/partyDamageRules.mjs
    :95 resolvePartyDamage CRITICAL
          20 cyclomatic   12 cognitive   58 lines
         420.0 CRAP
  Scripts/functionBank.js
    :2223 AttemptHeroSkillDowngrade CRITICAL
          19 cyclomatic   17 cognitive   50 lines
         380.0 CRAP
    :3669 AdvanceTurn CRITICAL
          19 cyclomatic   20 cognitive   39 lines
         380.0 CRAP
    :5896 HeroAttackAOE CRITICAL
          19 cyclomatic   21 cognitive   44 lines
         380.0 CRAP
    :6305 buildWaveRespawnPlan CRITICAL
          19 cyclomatic   20 cognitive   48 lines
         380.0 CRAP
    :6508 KillEnemyAt CRITICAL
          19 cyclomatic   18 cognitive   31 lines
         380.0 CRAP
  src/core/turnActorEligibilityRules.mjs
    :79 turnActorEligibilityCodeFromJs CRITICAL
          19 cyclomatic   21 cognitive   26 lines
         380.0 CRAP
  web-runner/app.js
    :4376 loadC3ProjectAssets CRITICAL
          19 cyclomatic   19 cognitive  214 lines
         380.0 CRAP
  web-runner/modules/functionBank.js
    :2266 AttemptHeroSkillDowngrade CRITICAL
          19 cyclomatic   17 cognitive   50 lines
         380.0 CRAP
    :6321 buildWaveRespawnPlan CRITICAL
          19 cyclomatic   20 cognitive   48 lines
         380.0 CRAP
  web-runner/src/core/turnActorEligibilityRules.mjs
    :79 turnActorEligibilityCodeFromJs CRITICAL
          19 cyclomatic   21 cognitive   26 lines
         380.0 CRAP
  web-runner/systems/renderHeroScreen.js
    :21 resolveHeroSkillSpriteFocus CRITICAL
          19 cyclomatic   29 cognitive   61 lines
         380.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :3657 createSimulationCoreEnemyDebuffApplyResolution CRITICAL
          19 cyclomatic   18 cognitive   81 lines
         380.0 CRAP
  web-runner/modules/functionBank.js
    :4858 getPartyWardBarrierDamageTextPos CRITICAL
          19 cyclomatic   14 cognitive   22 lines
         380.0 CRAP
    :7072 buildEnemyJobSkillFallbackDecision CRITICAL
          19 cyclomatic    9 cognitive   25 lines
         380.0 CRAP
  src/core/heroTurnEntryRules.mjs
    :49 ownerDecisionFromResult CRITICAL
          19 cyclomatic    9 cognitive   17 lines
         380.0 CRAP
  Scripts/functionBank.js
    :4849 getPartyWardBarrierDamageTextPos CRITICAL
          19 cyclomatic   14 cognitive   22 lines
         380.0 CRAP
    :7053 buildEnemyJobSkillFallbackDecision CRITICAL
          19 cyclomatic    9 cognitive   25 lines
         380.0 CRAP
  web-runner/src/core/heroTurnEntryRules.mjs
    :49 ownerDecisionFromResult CRITICAL
          19 cyclomatic    9 cognitive   17 lines
         380.0 CRAP
  Scripts/functionBank.js
    :597 traceEnemyHealRoll CRITICAL
          18 cyclomatic   17 cognitive   23 lines
         342.0 CRAP
    :1314 ensureHeroSkillPointStore CRITICAL
          18 cyclomatic   26 cognitive   38 lines
         342.0 CRAP
  src/core/roundPointerAdvanceRules.mjs
    :92 resolveRoundPointerAdvance CRITICAL
          18 cyclomatic   16 cognitive   54 lines
         342.0 CRAP
  tools/audit_initiative_fairness.js
    :138 selectNext CRITICAL
          18 cyclomatic   30 cognitive   58 lines
         342.0 CRAP
  tools/balance_harness.js
    :136 summarizePowerAmpTelemetry CRITICAL
          18 cyclomatic   16 cognitive   25 lines
         342.0 CRAP
  web-runner/app.js
    :251 getActionHandoffSnapshot CRITICAL
          18 cyclomatic   17 cognitive   26 lines
         342.0 CRAP
  web-runner/modules/functionBank.js
    :638 traceEnemyHealRoll CRITICAL
          18 cyclomatic   17 cognitive   23 lines
         342.0 CRAP
    :1357 ensureHeroSkillPointStore CRITICAL
          18 cyclomatic   26 cognitive   38 lines
         342.0 CRAP
    :3186 setTurnOrderArrayWithAudit CRITICAL
          18 cyclomatic   18 cognitive    1 lines
         342.0 CRAP
  web-runner/src/core/idleFarmRuntime.mjs
    :345 resolveAction CRITICAL
          18 cyclomatic   19 cognitive   32 lines
         342.0 CRAP
  web-runner/src/core/roundPointerAdvanceRules.mjs
    :92 resolveRoundPointerAdvance CRITICAL
          18 cyclomatic   16 cognitive   54 lines
         342.0 CRAP
  web-runner/modules/functionBank.js
    :3499 resolveCurrentTurnPhase CRITICAL
          18 cyclomatic   12 cognitive   27 lines
         342.0 CRAP
  Scripts/entities.js
    :34 recordEntityUpdateFailure CRITICAL
          18 cyclomatic   11 cognitive   24 lines
         342.0 CRAP
  web-runner/src/core/startEnemyActionRules.mjs
    :59 ownerDecisionFromResult CRITICAL
          18 cyclomatic    8 cognitive   20 lines
         342.0 CRAP
  web-runner/src/core/seededRngRules.mjs
    :83 createSeededRngSimulationPacket CRITICAL
          18 cyclomatic    7 cognitive   76 lines
         342.0 CRAP
  src/core/startEnemyActionRules.mjs
    :59 ownerDecisionFromResult CRITICAL
          18 cyclomatic    8 cognitive   20 lines
         342.0 CRAP
  src/core/seededRngRules.mjs
    :83 createSeededRngSimulationPacket CRITICAL
          18 cyclomatic    7 cognitive   76 lines
         342.0 CRAP
  Scripts/functionBank.js
    :3509 resolveCurrentTurnPhase CRITICAL
          18 cyclomatic   12 cognitive   27 lines
         342.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :414 hasEnemyDotPacketExports CRITICAL
          18 cyclomatic    1 cognitive   11 lines
         342.0 CRAP
    :2179 turnOrderMembersMatch CRITICAL
          18 cyclomatic   14 cognitive    9 lines
         342.0 CRAP
  Scripts/functionBank.js
    :1509 resolveHeroSkillProgressEntry CRITICAL
          17 cyclomatic   26 cognitive   26 lines
         306.0 CRAP
    :2174 AttemptHeroSkillUpgrade CRITICAL
          17 cyclomatic   17 cognitive   48 lines
         306.0 CRAP
    :2401 appendHeroGemMilestoneTrace CRITICAL
          17 cyclomatic   16 cognitive   17 lines
         306.0 CRAP
    :8258 Enemy_Wipe CRITICAL
          17 cyclomatic   20 cognitive   36 lines
         306.0 CRAP
  src/core/gameStateEnvelopeRules.cjs
    :55 normalizeTurnState CRITICAL
          17 cyclomatic   18 cognitive   29 lines
         306.0 CRAP
  src/core/gameStateEnvelopeRules.mjs
    :55 normalizeTurnState CRITICAL
          17 cyclomatic   18 cognitive   29 lines
         306.0 CRAP
  src/core/hpTextRollAnimation.mjs
    :22 updateHpTextRollState CRITICAL
          17 cyclomatic   20 cognitive   47 lines
         306.0 CRAP
  web-runner/app.js
    :2403 buildHeroSkillDescriptionLines CRITICAL
          17 cyclomatic   18 cognitive   42 lines
         306.0 CRAP
    :3920 getInstanceWorldCenter CRITICAL
          17 cyclomatic   20 cognitive   20 lines
         306.0 CRAP
    :6190 auditGemClickability CRITICAL
          17 cyclomatic   27 cognitive   65 lines
         306.0 CRAP
  web-runner/modules/functionBank.js
    :1552 resolveHeroSkillProgressEntry CRITICAL
          17 cyclomatic   26 cognitive   26 lines
         306.0 CRAP
    :2217 AttemptHeroSkillUpgrade CRITICAL
          17 cyclomatic   17 cognitive   48 lines
         306.0 CRAP
    :2444 appendHeroGemMilestoneTrace CRITICAL
          17 cyclomatic   16 cognitive   17 lines
         306.0 CRAP
    :8277 Enemy_Wipe CRITICAL
          17 cyclomatic   20 cognitive   36 lines
         306.0 CRAP
  web-runner/src/core/gameStateEnvelopeRules.mjs
    :55 normalizeTurnState CRITICAL
          17 cyclomatic   18 cognitive   29 lines
         306.0 CRAP
  web-runner/src/core/gsapShim.mjs
    :352 _flush CRITICAL
          17 cyclomatic   21 cognitive   49 lines
         306.0 CRAP
  web-runner/src/core/hpTextRollAnimation.mjs
    :22 updateHpTextRollState CRITICAL
          17 cyclomatic   20 cognitive   47 lines
         306.0 CRAP
  web-runner/systems/renderPets.js
    :3 renderPets CRITICAL
          17 cyclomatic   19 cognitive   34 lines
         306.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :1352 createSimulationCoreEffectiveStatResolution CRITICAL
          17 cyclomatic   17 cognitive   58 lines
         306.0 CRAP
    :1460 createSimulationCoreTurnActorEligibilityResolution CRITICAL
          17 cyclomatic   17 cognitive   60 lines
         306.0 CRAP
    :2961 createSimulationCorePartyRegenLifecycleResolution CRITICAL
          17 cyclomatic   17 cognitive   57 lines
         306.0 CRAP
    :3121 createSimulationCoreRunaMagicResistResolution CRITICAL
          17 cyclomatic   17 cognitive   70 lines
         306.0 CRAP
    :3825 createSimulationCoreEnemyDebuffDecayResolution CRITICAL
          17 cyclomatic   16 cognitive   77 lines
         306.0 CRAP
  web-runner/modules/functionBank.js
    :1899 RollHeroSkillProc CRITICAL
          17 cyclomatic   15 cognitive   52 lines
         306.0 CRAP
    :3148 <arrow> CRITICAL
          17 cyclomatic    9 cognitive    1 lines
         306.0 CRAP
    :7135 buildStartEnemyActionFallbackDecision CRITICAL
          17 cyclomatic    9 cognitive   21 lines
         306.0 CRAP
  web-runner/src/core/turnOrderGroupRules.mjs
    :129 compareTurnOrderSlotsFromJs CRITICAL
          17 cyclomatic    8 cognitive    8 lines
         306.0 CRAP
  tools/balance_harness.js
    :740 buildConfig CRITICAL
          17 cyclomatic   14 cognitive   21 lines
         306.0 CRAP
  Scripts/functionBank.js
    :1856 RollHeroSkillProc CRITICAL
          17 cyclomatic   15 cognitive   52 lines
         306.0 CRAP
    :7116 buildStartEnemyActionFallbackDecision CRITICAL
          17 cyclomatic    9 cognitive   21 lines
         306.0 CRAP
  src/core/turnOrderGroupRules.mjs
    :129 compareTurnOrderSlotsFromJs CRITICAL
          17 cyclomatic    8 cognitive    8 lines
         306.0 CRAP
  web-runner/app.js
    :1871 <arrow> CRITICAL
          17 cyclomatic   11 cognitive   15 lines
         306.0 CRAP
    :5103 initializeStoryCardLayout CRITICAL
          17 cyclomatic   15 cognitive   66 lines
         306.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :2671 shadowSeededRng CRITICAL
          17 cyclomatic   15 cognitive   69 lines
         306.0 CRAP
  Scripts/functionBank.js
    :6710 SpendTokensOnEvent CRITICAL
          16 cyclomatic   22 cognitive   31 lines
         272.0 CRAP
  web-runner/app.js
    :425 hasPersistentEnemyBlightOverlay CRITICAL
          16 cyclomatic   20 cognitive   14 lines
         272.0 CRAP
    :6160 assertBoardIntegrity CRITICAL
          16 cyclomatic   22 cognitive   30 lines
         272.0 CRAP
  web-runner/modules/functionBank.js
    :6729 SpendTokensOnEvent CRITICAL
          16 cyclomatic   22 cognitive   31 lines
         272.0 CRAP
  web-runner/systems/renderArtifacts.js
    :3 renderArtifacts CRITICAL
          16 cyclomatic   19 cognitive   68 lines
         272.0 CRAP
  web-runner/systems/renderMounts.js
    :3 renderMounts CRITICAL
          16 cyclomatic   18 cognitive   37 lines
         272.0 CRAP
  web-runner/modules/functionBank.js
    :2345 recoverStaleActionInProgress CRITICAL
          16 cyclomatic   12 cognitive   11 lines
         272.0 CRAP
    :3368 resolvePendingDeathsForInitiative CRITICAL
          16 cyclomatic   13 cognitive   23 lines
         272.0 CRAP
    :3722 ConfigureActorExtraTurnSkill CRITICAL
          16 cyclomatic    9 cognitive   19 lines
         272.0 CRAP
    :6387 clearEnemyRespawnPendingForFilledSlot CRITICAL
          16 cyclomatic   11 cognitive   14 lines
         272.0 CRAP
    :7807 EnemyTurn CRITICAL
          16 cyclomatic   13 cognitive   43 lines
         272.0 CRAP
    :8542 StartHeroLunge CRITICAL
          16 cyclomatic   15 cognitive   52 lines
         272.0 CRAP
  src/core/layoutState.js
    :156 requestLayoutChange CRITICAL
          16 cyclomatic   15 cognitive   92 lines
         272.0 CRAP
  web-runner/src/core/turnOrderGroupRules.mjs
    :221 createTurnOrderGroupSimulationPacket CRITICAL
          16 cyclomatic   13 cognitive   77 lines
         272.0 CRAP
  web-runner/src/core/turnPhaseAssignmentRules.mjs
    :109 createTurnPhaseAssignmentSimulationPacket CRITICAL
          16 cyclomatic   12 cognitive   69 lines
         272.0 CRAP
  web-runner/systems/renderMap.js
    :3 renderMap CRITICAL
          16 cyclomatic    8 cognitive   89 lines
         272.0 CRAP
  Scripts/functionBank.js
    :2302 recoverStaleActionInProgress CRITICAL
          16 cyclomatic   12 cognitive   11 lines
         272.0 CRAP
    :3378 resolvePendingDeathsForInitiative CRITICAL
          16 cyclomatic   13 cognitive   23 lines
         272.0 CRAP
    :3713 ConfigureActorExtraTurnSkill CRITICAL
          16 cyclomatic    9 cognitive   19 lines
         272.0 CRAP
    :6371 clearEnemyRespawnPendingForFilledSlot CRITICAL
          16 cyclomatic   11 cognitive   14 lines
         272.0 CRAP
    :7788 EnemyTurn CRITICAL
          16 cyclomatic   13 cognitive   43 lines
         272.0 CRAP
    :8523 StartHeroLunge CRITICAL
          16 cyclomatic   15 cognitive   52 lines
         272.0 CRAP
  web-runner/src/core/powerAmpRules.mjs
    :61 derivePowerAmpVisualState CRITICAL
          16 cyclomatic   14 cognitive   39 lines
         272.0 CRAP
  src/core/turnOrderGroupRules.mjs
    :221 createTurnOrderGroupSimulationPacket CRITICAL
          16 cyclomatic   13 cognitive   77 lines
         272.0 CRAP
  src/core/turnPhaseAssignmentRules.mjs
    :109 createTurnPhaseAssignmentSimulationPacket CRITICAL
          16 cyclomatic   12 cognitive   69 lines
         272.0 CRAP
  web-runner/app.js
    :1256 sanitizeDevToolingConfig CRITICAL
          16 cyclomatic   15 cognitive   30 lines
         272.0 CRAP
    :5439 drawHarnessLayoutTakeover CRITICAL
          16 cyclomatic    4 cognitive  114 lines
         272.0 CRAP
    :5566 computePartyRegenLifecycleAction CRITICAL
          16 cyclomatic   15 cognitive   13 lines
         272.0 CRAP
    :5986 getStoryCardLiveLineState CRITICAL
          16 cyclomatic   12 cognitive   24 lines
         272.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :500 hasHeroTurnEntryExports CRITICAL
          16 cyclomatic    1 cognitive   10 lines
         272.0 CRAP
    :2071 createSimulationCoreEnemyTargetResolution CRITICAL
          16 cyclomatic   15 cognitive   71 lines
         272.0 CRAP
  src/core/combatRuntimeGateway.js
    :277 resume CRITICAL
          16 cyclomatic   12 cognitive   24 lines
         272.0 CRAP
  src/core/powerAmpRules.mjs
    :61 derivePowerAmpVisualState CRITICAL
          16 cyclomatic   14 cognitive   39 lines
         272.0 CRAP
  web-runner/systems/runtimeDebugLogging.js
    :11 isGemDebugEnabled CRITICAL
          16 cyclomatic   11 cognitive   11 lines
         272.0 CRAP
  Scripts/functionBank.js
    :3493 GetCurrentType CRITICAL
          15 cyclomatic   16 cognitive   15 lines
         240.0 CRAP
    :5372 ensureEnemyDebuffState CRITICAL
          15 cyclomatic   18 cognitive   29 lines
         240.0 CRAP
    :5577 decayEnemyDebuffsForTurn CRITICAL
          15 cyclomatic   21 cognitive   52 lines
         240.0 CRAP
  web-runner/app.js
    :3113 buildEncounterSpawnPlan CRITICAL
          15 cyclomatic   16 cognitive   33 lines
         240.0 CRAP
    :7508 handleGlobalKeydown CRITICAL
          15 cyclomatic   18 cognitive   35 lines
         240.0 CRAP
  web-runner/modules/functionBank.js
    :3483 GetCurrentType CRITICAL
          15 cyclomatic   16 cognitive   15 lines
         240.0 CRAP
    :5381 ensureEnemyDebuffState CRITICAL
          15 cyclomatic   18 cognitive   29 lines
         240.0 CRAP
    :5586 decayEnemyDebuffsForTurn CRITICAL
          15 cyclomatic   21 cognitive   52 lines
         240.0 CRAP
  web-runner/src/core/idleAutoplayPriority.mjs
    :140 pickIdleAutoplaySuperGem CRITICAL
          15 cyclomatic   16 cognitive   16 lines
         240.0 CRAP
  web-runner/src/core/superGemBoardState.mjs
    :191 resolveSuperGemDecomposition CRITICAL
          15 cyclomatic   24 cognitive   30 lines
         240.0 CRAP
  web-runner/systems/renderRelics.js
    :3 renderRelics CRITICAL
          15 cyclomatic   17 cognitive   34 lines
         240.0 CRAP
  web-runner/modules/functionBank.js
    :5227 resolveRunaMagicResistFallback CRITICAL
          15 cyclomatic   14 cognitive   57 lines
         240.0 CRAP
  src/core/singleHitRules.mjs
    :51 normalizeSingleHitInput CRITICAL
          15 cyclomatic   14 cognitive   63 lines
         240.0 CRAP
    :163 createSingleHitSimulationPacket CRITICAL
          15 cyclomatic   13 cognitive   70 lines
         240.0 CRAP
  web-runner/src/core/combatOutcomeRules.mjs
    :101 createCombatOutcomeSimulationPacket CRITICAL
          15 cyclomatic   14 cognitive   65 lines
         240.0 CRAP
  web-runner/src/core/enemyTargetingRules.mjs
    :116 pickEnemyTargetHeroFromRoster CRITICAL
          15 cyclomatic    9 cognitive   44 lines
         240.0 CRAP
  Scripts/functionBank.js
    :5218 resolveRunaMagicResistFallback CRITICAL
          15 cyclomatic   14 cognitive   57 lines
         240.0 CRAP
  web-runner/app.js
    :408 enemyOccupiesTaintedGroundZone CRITICAL
          15 cyclomatic   10 cognitive   16 lines
         240.0 CRAP
    :8012 damageTexts CRITICAL
          15 cyclomatic   14 cognitive   30 lines
         240.0 CRAP
    :8118 setMapEncounterNode CRITICAL
          15 cyclomatic    9 cognitive   17 lines
         240.0 CRAP
    :4175 main CRITICAL
          15 cyclomatic   15 cognitive  4035 lines
         240.0 CRAP
  web-runner/src/core/singleHitRules.mjs
    :51 normalizeSingleHitInput CRITICAL
          15 cyclomatic   14 cognitive   63 lines
         240.0 CRAP
    :163 createSingleHitSimulationPacket CRITICAL
          15 cyclomatic   13 cognitive   70 lines
         240.0 CRAP
  web-runner/systems/superGemRuntime.js
    :320 getHeroTeamTurnSpan CRITICAL
          15 cyclomatic   13 cognitive   19 lines
         240.0 CRAP
  web-runner/src/core/gsapShim.mjs
    :36 parseEase CRITICAL
          15 cyclomatic   14 cognitive   27 lines
         240.0 CRAP
  src/core/enemyTargetingRules.mjs
    :116 pickEnemyTargetHeroFromRoster CRITICAL
          15 cyclomatic    9 cognitive   44 lines
         240.0 CRAP
  web-runner/src/core/idleFarmRuntime.mjs
    :466 applyIdleFarmRewardsToGlobals CRITICAL
          15 cyclomatic   15 cognitive   21 lines
         240.0 CRAP
  Scripts/functionBank.js
    :4760 refreshCrimsonWardBarrierVisuals CRITICAL
          14 cyclomatic   16 cognitive   39 lines
         210.0 CRAP
  tools/audit_initiative_fairness.js
    :98 getOverride CRITICAL
          14 cyclomatic   16 cognitive   39 lines
         210.0 CRAP
  web-runner/app.js
    :2446 getHeroScreenSkillCards CRITICAL
          14 cyclomatic   16 cognitive  129 lines
         210.0 CRAP
  web-runner/modules/functionBank.js
    :4769 refreshCrimsonWardBarrierVisuals CRITICAL
          14 cyclomatic   16 cognitive   39 lines
         210.0 CRAP
  web-runner/src/core/gsapShim.mjs
    :244 start CRITICAL
          14 cyclomatic   20 cognitive   69 lines
         210.0 CRAP
  web-runner/systems/renderHarnessFallback.js
    :1 renderHarnessFallback CRITICAL
          14 cyclomatic   17 cognitive   55 lines
         210.0 CRAP
  web-runner/modules/functionBank.js
    :821 makeStableHeroSkillPointId CRITICAL
          14 cyclomatic   13 cognitive   11 lines
         210.0 CRAP
    :1963 RollPartySkillProc CRITICAL
          14 cyclomatic   11 cognitive   54 lines
         210.0 CRAP
    :2357 logActionGateBlock CRITICAL
          14 cyclomatic   12 cognitive   18 lines
         210.0 CRAP
    :3291 <arrow> CRITICAL
          14 cyclomatic   12 cognitive    1 lines
         210.0 CRAP
    :3392 resolvePendingEnemyDeaths CRITICAL
          14 cyclomatic   11 cognitive   19 lines
         210.0 CRAP
    :4060 recordSingleHitDamageShadow CRITICAL
          14 cyclomatic   13 cognitive   19 lines
         210.0 CRAP
    :7242 heroTurnEntryShouldResetAstralFlow CRITICAL
          14 cyclomatic    7 cognitive    7 lines
         210.0 CRAP
    :8101 isBoardFullyPopulatedForEnemyMutation CRITICAL
          14 cyclomatic   11 cognitive   17 lines
         210.0 CRAP
  web-runner/src/core/gameStateEnvelopeRules.mjs
    :94 normalizeResources CRITICAL
          14 cyclomatic   11 cognitive   13 lines
         210.0 CRAP
  src/core/gameStateEnvelopeRules.cjs
    :94 normalizeResources CRITICAL
          14 cyclomatic   11 cognitive   13 lines
         210.0 CRAP
  src/core/runaMagicResistRules.mjs
    :206 createRunaMagicResistSimulationPacket CRITICAL
          14 cyclomatic   12 cognitive   90 lines
         210.0 CRAP
  src/core/enemySkillChoiceRules.mjs
    :234 resolveEnemySkillChoice CRITICAL
          14 cyclomatic   13 cognitive   59 lines
         210.0 CRAP
  src/core/schedulerRules.mjs
    :40 isAbleToActSlot CRITICAL
          14 cyclomatic   10 cognitive   20 lines
         210.0 CRAP
  Scripts/functionBank.js
    :778 makeStableHeroSkillPointId CRITICAL
          14 cyclomatic   13 cognitive   11 lines
         210.0 CRAP
    :1920 RollPartySkillProc CRITICAL
          14 cyclomatic   11 cognitive   54 lines
         210.0 CRAP
    :2314 logActionGateBlock CRITICAL
          14 cyclomatic   12 cognitive   18 lines
         210.0 CRAP
    :3402 resolvePendingEnemyDeaths CRITICAL
          14 cyclomatic   11 cognitive   19 lines
         210.0 CRAP
    :4051 recordSingleHitDamageShadow CRITICAL
          14 cyclomatic   13 cognitive   19 lines
         210.0 CRAP
    :7223 heroTurnEntryShouldResetAstralFlow CRITICAL
          14 cyclomatic    7 cognitive    7 lines
         210.0 CRAP
    :8082 isBoardFullyPopulatedForEnemyMutation CRITICAL
          14 cyclomatic   11 cognitive   17 lines
         210.0 CRAP
  src/core/gameStateEnvelopeRules.mjs
    :94 normalizeResources CRITICAL
          14 cyclomatic   11 cognitive   13 lines
         210.0 CRAP
  web-runner/app.js
    :707 requestLayoutChange CRITICAL
          14 cyclomatic   15 cognitive   44 lines
         210.0 CRAP
    :2515 <arrow> CRITICAL
          14 cyclomatic   14 cognitive   18 lines
         210.0 CRAP
  web-runner/systems/superGemRuntime.js
    :426 removeTaintedGroundOwnedBlight CRITICAL
          14 cyclomatic   14 cognitive   15 lines
         210.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :2741 shadowTurnSummary CRITICAL
          14 cyclomatic   14 cognitive   45 lines
         210.0 CRAP
    :3192 createSimulationCoreTurnSummaryResolution CRITICAL
          14 cyclomatic   14 cognitive   63 lines
         210.0 CRAP
  web-runner/src/core/runaMagicResistRules.mjs
    :206 createRunaMagicResistSimulationPacket CRITICAL
          14 cyclomatic   12 cognitive   90 lines
         210.0 CRAP
  web-runner/src/core/enemySkillChoiceRules.mjs
    :234 resolveEnemySkillChoice CRITICAL
          14 cyclomatic   13 cognitive   59 lines
         210.0 CRAP
  web-runner/src/core/schedulerRules.mjs
    :40 isAbleToActSlot CRITICAL
          14 cyclomatic   10 cognitive   20 lines
         210.0 CRAP
  web-runner/app.js
    :453 getPersistentTaintedGroundOverlays CRITICAL
          13 cyclomatic   16 cognitive   22 lines
         182.0 CRAP
    :3595 refillGemBoard CRITICAL
          13 cyclomatic   20 cognitive   62 lines
         182.0 CRAP
  web-runner/src/core/idleAutoplayPriority.mjs
    :117 pickIdleAutoplayTriplet CRITICAL
          13 cyclomatic   19 cognitive   22 lines
         182.0 CRAP
  web-runner/src/core/initiativeGuards.mjs
    :22 sanitizeInitiativeQueue CRITICAL
          13 cyclomatic   18 cognitive   22 lines
         182.0 CRAP
  web-runner/src/core/superGemRender.mjs
    :17 getLiveGemFootprint CRITICAL
          13 cyclomatic    9 cognitive   30 lines
         182.0 CRAP
  web-runner/modules/functionBank.js
    :604 resolveEnemySkillDecision CRITICAL
          13 cyclomatic   11 cognitive   17 lines
         182.0 CRAP
    :2493 syncHeroGemUsageLegacyView CRITICAL
          13 cyclomatic   10 cognitive   18 lines
         182.0 CRAP
    :3015 getActorNameByUID CRITICAL
          13 cyclomatic   15 cognitive   19 lines
         182.0 CRAP
    :3433 before CRITICAL
          13 cyclomatic    9 cognitive    8 lines
         182.0 CRAP
    :3451 after CRITICAL
          13 cyclomatic    9 cognitive    8 lines
         182.0 CRAP
    :3468 GetCurrentTurn CRITICAL
          13 cyclomatic   13 cognitive   14 lines
         182.0 CRAP
    :3639 recordHeroTeamTurnProgress CRITICAL
          13 cyclomatic   11 cognitive   19 lines
         182.0 CRAP
    :4014 calculateDamageFromJsFallback CRITICAL
          13 cyclomatic   12 cognitive   38 lines
         182.0 CRAP
    :4833 markPartyWardBarrierHit CRITICAL
          13 cyclomatic   11 cognitive   24 lines
         182.0 CRAP
    :4881 startPartyWardBarrierFadeOut CRITICAL
          13 cyclomatic   14 cognitive   31 lines
         182.0 CRAP
    :5566 applyEnemyDebuffSlotDecision CRITICAL
          13 cyclomatic   10 cognitive   19 lines
         182.0 CRAP
    :6197 Enemy_Heal_Self CRITICAL
          13 cyclomatic   11 cognitive   27 lines
         182.0 CRAP
    :7157 resolveStartEnemyActionCompat CRITICAL
          13 cyclomatic    9 cognitive   34 lines
         182.0 CRAP
    :7211 resolveEnemyTurnFlowCompat CRITICAL
          13 cyclomatic   14 cognitive   30 lines
         182.0 CRAP
    :7530 LogCombat CRITICAL
          13 cyclomatic   11 cognitive   26 lines
         182.0 CRAP
    :8204 Enemy_Drain_Buff CRITICAL
          13 cyclomatic    9 cognitive   28 lines
         182.0 CRAP
  tools/playwright_doctor.js
    :205 main CRITICAL
          13 cyclomatic   12 cognitive   52 lines
         182.0 CRAP
  src/core/turnActorEligibilityRules.mjs
    :162 createTurnActorEligibilitySimulationPacket CRITICAL
          13 cyclomatic   10 cognitive   88 lines
         182.0 CRAP
  tools/balance_harness.js
    :284 enterCombat CRITICAL
          13 cyclomatic    7 cognitive   21 lines
         182.0 CRAP
  web-runner/src/core/turnPhaseAssignmentRules.mjs
    :72 resolveTurnPhaseAssignment CRITICAL
          13 cyclomatic   12 cognitive   36 lines
         182.0 CRAP
  src/core/statusEffectRules.mjs
    :207 mapOwnerResult CRITICAL
          13 cyclomatic    2 cognitive   28 lines
         182.0 CRAP
  Scripts/functionBank.js
    :563 resolveEnemySkillDecision CRITICAL
          13 cyclomatic   11 cognitive   17 lines
         182.0 CRAP
    :2450 syncHeroGemUsageLegacyView CRITICAL
          13 cyclomatic   10 cognitive   18 lines
         182.0 CRAP
    :2972 getActorNameByUID CRITICAL
          13 cyclomatic   15 cognitive   19 lines
         182.0 CRAP
    :3443 before CRITICAL
          13 cyclomatic    9 cognitive    8 lines
         182.0 CRAP
    :3461 after CRITICAL
          13 cyclomatic    9 cognitive    8 lines
         182.0 CRAP
    :3478 GetCurrentTurn CRITICAL
          13 cyclomatic   13 cognitive   14 lines
         182.0 CRAP
    :3649 recordHeroTeamTurnProgress CRITICAL
          13 cyclomatic   11 cognitive   19 lines
         182.0 CRAP
    :4005 calculateDamageFromJsFallback CRITICAL
          13 cyclomatic   12 cognitive   38 lines
         182.0 CRAP
    :4824 markPartyWardBarrierHit CRITICAL
          13 cyclomatic   11 cognitive   24 lines
         182.0 CRAP
    :4872 startPartyWardBarrierFadeOut CRITICAL
          13 cyclomatic   14 cognitive   31 lines
         182.0 CRAP
    :5557 applyEnemyDebuffSlotDecision CRITICAL
          13 cyclomatic   10 cognitive   19 lines
         182.0 CRAP
    :6181 Enemy_Heal_Self CRITICAL
          13 cyclomatic   11 cognitive   27 lines
         182.0 CRAP
    :7138 resolveStartEnemyActionCompat CRITICAL
          13 cyclomatic    9 cognitive   34 lines
         182.0 CRAP
    :7192 resolveEnemyTurnFlowCompat CRITICAL
          13 cyclomatic   14 cognitive   30 lines
         182.0 CRAP
    :7511 LogCombat CRITICAL
          13 cyclomatic   11 cognitive   26 lines
         182.0 CRAP
    :8185 Enemy_Drain_Buff CRITICAL
          13 cyclomatic    9 cognitive   28 lines
         182.0 CRAP
  tools/audit_initiative_fairness.js
    :33 readEnemyPool CRITICAL
          13 cyclomatic   13 cognitive   18 lines
         182.0 CRAP
  web-runner/systems/renderEvolution.js
    :3 renderEvolution CRITICAL
          13 cyclomatic   13 cognitive   38 lines
         182.0 CRAP
  src/core/turnPhaseAssignmentRules.mjs
    :72 resolveTurnPhaseAssignment CRITICAL
          13 cyclomatic   12 cognitive   36 lines
         182.0 CRAP
  web-runner/app.js
    :305 getYellowSequenceCompletionIntent CRITICAL
          13 cyclomatic    7 cognitive   16 lines
         182.0 CRAP
    :397 isActiveTaintedGroundZone CRITICAL
          13 cyclomatic   11 cognitive   10 lines
         182.0 CRAP
    :576 RUNTIME_FINGERPRINT CRITICAL
          13 cyclomatic   10 cognitive   22 lines
         182.0 CRAP
    :2175 resolveEnemyEncounterCombatPower CRITICAL
          13 cyclomatic    3 cognitive    5 lines
         182.0 CRAP
    :4331 refreshCombatSessionFromDevTooling CRITICAL
          13 cyclomatic   10 cognitive   44 lines
         182.0 CRAP
    :5301 getTextContent CRITICAL
          13 cyclomatic   15 cognitive   24 lines
         182.0 CRAP
    :6289 isIdleAutoplayHeroWindow CRITICAL
          13 cyclomatic    3 cognitive   15 lines
         182.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :1411 createSimulationCoreCombatOutcomeResolution CRITICAL
          13 cyclomatic   13 cognitive   48 lines
         182.0 CRAP
  web-runner/src/core/turnActorEligibilityRules.mjs
    :162 createTurnActorEligibilitySimulationPacket CRITICAL
          13 cyclomatic   10 cognitive   88 lines
         182.0 CRAP
  web-runner/src/core/idleFarmRuntime.mjs
    :45 createIdleFarmSessionState CRITICAL
          13 cyclomatic   12 cognitive   39 lines
         182.0 CRAP
  web-runner/src/core/statusEffectRules.mjs
    :207 mapOwnerResult CRITICAL
          13 cyclomatic    2 cognitive   28 lines
         182.0 CRAP
  Scripts/legacy but partially working/scripts/Initializer.js
    :55 CreateGemBoard CRITICAL
          12 cyclomatic   20 cognitive   73 lines
         156.0 CRAP
  web-runner/app.js
    :4979 <arrow> CRITICAL
          12 cyclomatic   17 cognitive   51 lines
         156.0 CRAP
  web-runner/src/core/gsapShim.mjs
    :179 cloneStateForKeys CRITICAL
          12 cyclomatic   16 cognitive   17 lines
         156.0 CRAP
  web-runner/systems/renderCombatRuntime.js
    :1 renderCombatRuntime CRITICAL
          12 cyclomatic   17 cognitive   46 lines
         156.0 CRAP
  web-runner/src/core/enemyJobSkillRules.mjs
    :200 resolveEnemyJobSkill CRITICAL
          12 cyclomatic   12 cognitive   44 lines
         156.0 CRAP
  web-runner/modules/functionBank.js
    :119 pickDamageFloatAngleDeg CRITICAL
          12 cyclomatic   10 cognitive   18 lines
         156.0 CRAP
    :282 runTraitHooks CRITICAL
          12 cyclomatic   10 cognitive   28 lines
         156.0 CRAP
    :457 getPowerAmpTelemetryIdentity CRITICAL
          12 cyclomatic   11 cognitive   14 lines
         156.0 CRAP
    :496 emitPowerAmpStateLog CRITICAL
          12 cyclomatic   10 cognitive   17 lines
         156.0 CRAP
    :1810 ensureSkillProcRuntime CRITICAL
          12 cyclomatic   11 cognitive   13 lines
         156.0 CRAP
    :1886 GetHeroSkillGrowthValue CRITICAL
          12 cyclomatic   11 cognitive   12 lines
         156.0 CRAP
    :2868 pickWeightedLootToken CRITICAL
          12 cyclomatic   11 cognitive   37 lines
         156.0 CRAP
    :3898 partyBuffForStat CRITICAL
          12 cyclomatic   11 cognitive    9 lines
         156.0 CRAP
    :4254 maybeShadowTurnSummary CRITICAL
          12 cyclomatic   10 cognitive   26 lines
         156.0 CRAP
  web-runner/systems/renderHomestead.js
    :3 renderHomestead CRITICAL
          12 cyclomatic   13 cognitive   39 lines
         156.0 CRAP
  src/core/schedulerRules.mjs
    :65 <arrow> CRITICAL
          12 cyclomatic    3 cognitive    6 lines
         156.0 CRAP
  web-runner/systems/appShellViewport.js
    :1 getAppViewport CRITICAL
          12 cyclomatic    7 cognitive   17 lines
         156.0 CRAP
  src/core/statusEffectRules.mjs
    :66 createStatusEffectPacket CRITICAL
          12 cyclomatic   12 cognitive   78 lines
         156.0 CRAP
  src/core/enemyJobSkillRules.mjs
    :200 resolveEnemyJobSkill CRITICAL
          12 cyclomatic   12 cognitive   44 lines
         156.0 CRAP
  web-runner/src/core/effectiveStatRules.mjs
    :120 createEffectiveStatSimulationPacket CRITICAL
          12 cyclomatic   10 cognitive   67 lines
         156.0 CRAP
  web-runner/src/core/enemyTargetingRules.mjs
    :104 normalizeHeroForOwner CRITICAL
          12 cyclomatic    4 cognitive   11 lines
         156.0 CRAP
  web-runner/src/core/turnGateController.mjs
    :1 normalizeCombatTurnTransientState CRITICAL
          12 cyclomatic   11 cognitive   15 lines
         156.0 CRAP
  Scripts/functionBank.js
    :118 pickDamageFloatAngleDeg CRITICAL
          12 cyclomatic   10 cognitive   18 lines
         156.0 CRAP
    :281 runTraitHooks CRITICAL
          12 cyclomatic   10 cognitive   28 lines
         156.0 CRAP
    :451 getPowerAmpTelemetryIdentity CRITICAL
          12 cyclomatic   11 cognitive   14 lines
         156.0 CRAP
    :1767 ensureSkillProcRuntime CRITICAL
          12 cyclomatic   11 cognitive   13 lines
         156.0 CRAP
    :1843 GetHeroSkillGrowthValue CRITICAL
          12 cyclomatic   11 cognitive   12 lines
         156.0 CRAP
    :2825 pickWeightedLootToken CRITICAL
          12 cyclomatic   11 cognitive   37 lines
         156.0 CRAP
    :3889 partyBuffForStat CRITICAL
          12 cyclomatic   11 cognitive    9 lines
         156.0 CRAP
    :4245 maybeShadowTurnSummary CRITICAL
          12 cyclomatic   10 cognitive   26 lines
         156.0 CRAP
  web-runner/src/core/calculateDamageRules.mjs
    :58 calculateDamageFromJs CRITICAL
          12 cyclomatic   11 cognitive   43 lines
         156.0 CRAP
  web-runner/app.js
    :2674 recordTask011RefillWriteEvent CRITICAL
          12 cyclomatic   11 cognitive   28 lines
         156.0 CRAP
    :3165 <arrow> CRITICAL
          12 cyclomatic    4 cognitive    7 lines
         156.0 CRAP
    :4295 calculateGridBounds CRITICAL
          12 cyclomatic   13 cognitive   30 lines
         156.0 CRAP
    :6011 splitStoryCardActorSegment CRITICAL
          12 cyclomatic   14 cognitive   38 lines
         156.0 CRAP
    :6274 setDevAutoplayState CRITICAL
          12 cyclomatic   13 cognitive   15 lines
         156.0 CRAP
    :6345 autoResolvePendingSelectionForDevIdle CRITICAL
          12 cyclomatic   10 cognitive   49 lines
         156.0 CRAP
  web-runner/src/core/superGemBoardState.mjs
    :60 buildSuperGemColorClear CRITICAL
          12 cyclomatic   12 cognitive   28 lines
         156.0 CRAP
    :131 getSuperGemAtCanvasPoint CRITICAL
          12 cyclomatic    9 cognitive   31 lines
         156.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :483 hasStartEnemyActionExports CRITICAL
          12 cyclomatic    1 cognitive    8 lines
         156.0 CRAP
    :528 hasRoundPointerAdvanceExports CRITICAL
          12 cyclomatic    1 cognitive    8 lines
         156.0 CRAP
    :1521 createSimulationCoreTurnPhaseAssignmentResolution CRITICAL
          12 cyclomatic   12 cognitive   40 lines
         156.0 CRAP
  tests/gameStateEnvelopeFixtureContract.test.js
    :23 <arrow> CRITICAL
          12 cyclomatic    7 cognitive   22 lines
         156.0 CRAP
  src/core/effectiveStatRules.mjs
    :120 createEffectiveStatSimulationPacket CRITICAL
          12 cyclomatic   10 cognitive   67 lines
         156.0 CRAP
  src/core/enemyTargetingRules.mjs
    :104 normalizeHeroForOwner CRITICAL
          12 cyclomatic    4 cognitive   11 lines
         156.0 CRAP
  src/core/turnGateController.mjs
    :1 normalizeCombatTurnTransientState CRITICAL
          12 cyclomatic   11 cognitive   15 lines
         156.0 CRAP
  src/core/calculateDamageRules.mjs
    :58 calculateDamageFromJs CRITICAL
          12 cyclomatic   11 cognitive   43 lines
         156.0 CRAP
  web-runner/src/core/schedulerRules.mjs
    :65 <arrow> CRITICAL
          12 cyclomatic    3 cognitive    6 lines
         156.0 CRAP
  web-runner/src/core/statusEffectRules.mjs
    :66 createStatusEffectPacket CRITICAL
          12 cyclomatic   12 cognitive   78 lines
         156.0 CRAP
  Scripts/functionBank.js
    :2530 evaluateHeroGemMilestones CRITICAL
          11 cyclomatic   19 cognitive   49 lines
         132.0 CRAP
  web-runner/modules/functionBank.js
    :2573 evaluateHeroGemMilestones CRITICAL
          11 cyclomatic   19 cognitive   49 lines
         132.0 CRAP
  web-runner/src/core/gsapShim.mjs
    :279 tick CRITICAL
          11 cyclomatic   18 cognitive   31 lines
         132.0 CRAP
    :332 _resolvePosition CRITICAL
          11 cyclomatic   19 cognitive   19 lines
         132.0 CRAP
  web-runner/src/core/enemyJobSkillRules.mjs
    :126 enemyJobSkillActionCode CRITICAL
          11 cyclomatic   10 cognitive   15 lines
         132.0 CRAP
    :183 ownerDecisionFromResult CRITICAL
          11 cyclomatic    4 cognitive   16 lines
         132.0 CRAP
  web-runner/src/core/superGemRender.mjs
    :1 getCellWorldBounds CRITICAL
          11 cyclomatic    6 cognitive   15 lines
         132.0 CRAP
  web-runner/modules/functionBank.js
    :717 ClosePowerAmpForActor CRITICAL
          11 cyclomatic   11 cognitive   22 lines
         132.0 CRAP
    :752 expirePowerAmpFadeEntries CRITICAL
          11 cyclomatic   12 cognitive   16 lines
         132.0 CRAP
    :1128 activateFazeSkill CRITICAL
          11 cyclomatic   10 cognitive   44 lines
         132.0 CRAP
    :1266 resolveHeroSkillPointIdentity CRITICAL
          11 cyclomatic   15 cognitive   76 lines
         132.0 CRAP
    :1414 <arrow> CRITICAL
          11 cyclomatic   10 cognitive   13 lines
         132.0 CRAP
    :1952 GetPartySkillGrowthValue CRITICAL
          11 cyclomatic    9 cognitive   10 lines
         132.0 CRAP
    :2162 GetHeroTempSkillState CRITICAL
          11 cyclomatic    8 cognitive   12 lines
         132.0 CRAP
    :2192 AddSessionPassive CRITICAL
          11 cyclomatic   10 cognitive   17 lines
         132.0 CRAP
    :2478 migrateLegacyHeroGemUsageByName CRITICAL
          11 cyclomatic    7 cognitive   14 lines
         132.0 CRAP
    :6309 localePool CRITICAL
          11 cyclomatic    2 cognitive    4 lines
         132.0 CRAP
    :6326 localePool CRITICAL
          11 cyclomatic    2 cognitive    4 lines
         132.0 CRAP
    :6832 RefreshPartyBuffUI CRITICAL
          11 cyclomatic   10 cognitive   24 lines
         132.0 CRAP
    :6939 resolveGemActionCompat CRITICAL
          11 cyclomatic    8 cognitive   39 lines
         132.0 CRAP
    :7056 enemyJobSkillActionCode CRITICAL
          11 cyclomatic   10 cognitive   15 lines
         132.0 CRAP
    :7250 buildHeroTurnEntryFallbackDecision CRITICAL
          11 cyclomatic    7 cognitive   17 lines
         132.0 CRAP
    :7851 recordHeroTurnEntryOwner CRITICAL
          11 cyclomatic    8 cognitive   12 lines
         132.0 CRAP
    :8513 StartBuffRoll CRITICAL
          11 cyclomatic    8 cognitive   28 lines
         132.0 CRAP
  src/core/singleHitRules.mjs
    :125 resolveSingleHit CRITICAL
          11 cyclomatic    7 cognitive   37 lines
         132.0 CRAP
  tools/playwright_doctor.js
    :167 deriveRecommendation CRITICAL
          11 cyclomatic    7 cognitive   20 lines
         132.0 CRAP
  web-runner/systems/renderSystem.js
    :22 getHeroStyleCloseRect CRITICAL
          11 cyclomatic    5 cognitive   11 lines
         132.0 CRAP
  Scripts/skillSheet.js
    :56 ApplyPartyHeal CRITICAL
          11 cyclomatic   13 cognitive   19 lines
         132.0 CRAP
  web-runner/src/core/initiativeGuards.mjs
    :1 shouldAutoCorrectImproperRepeat CRITICAL
          11 cyclomatic    9 cognitive   20 lines
         132.0 CRAP
  tests/encounterCpOverrideDistribution.test.js
    :56 loadEnemyRows CRITICAL
          11 cyclomatic    8 cognitive   22 lines
         132.0 CRAP
  web-runner/src/core/gameStateEnvelopeRules.mjs
    :172 normalizeFlags CRITICAL
          11 cyclomatic    9 cognitive   12 lines
         132.0 CRAP
  src/core/gameStateEnvelopeRules.cjs
    :172 normalizeFlags CRITICAL
          11 cyclomatic    9 cognitive   12 lines
         132.0 CRAP
  web-runner/src/core/turnOrderGroupRules.mjs
    :101 turnOrderActorInPhaseFromJs CRITICAL
          11 cyclomatic    7 cognitive   18 lines
         132.0 CRAP
    :178 resolveTurnOrderGroupProjection CRITICAL
          11 cyclomatic    8 cognitive   42 lines
         132.0 CRAP
  src/core/runaMagicResistRules.mjs
    :125 resolveRunaMagicResist CRITICAL
          11 cyclomatic   10 cognitive   47 lines
         132.0 CRAP
  tools/balance_harness.js
    :259 maybeResolvePendingHeroAction CRITICAL
          11 cyclomatic    7 cognitive   13 lines
         132.0 CRAP
  src/core/enemySkillChoiceRules.mjs
    :180 enemySkillChoiceFromJs CRITICAL
          11 cyclomatic   12 cognitive   53 lines
         132.0 CRAP
  src/core/enemyJobSkillRules.mjs
    :126 enemyJobSkillActionCode CRITICAL
          11 cyclomatic   10 cognitive   15 lines
         132.0 CRAP
    :183 ownerDecisionFromResult CRITICAL
          11 cyclomatic    4 cognitive   16 lines
         132.0 CRAP
  web-runner/src/core/combatOutcomeRules.mjs
    :63 resolveCombatOutcome CRITICAL
          11 cyclomatic   10 cognitive   37 lines
         132.0 CRAP
  src/core/combatRuntimeGateway.cjs
    :174 getAuthoritativeTurnState CRITICAL
          11 cyclomatic    9 cognitive   21 lines
         132.0 CRAP
  web-runner/src/core/combatRuntimeGateway.js
    :174 getAuthoritativeTurnState CRITICAL
          11 cyclomatic    9 cognitive   21 lines
         132.0 CRAP
  Scripts/functionBank.js
    :676 ClosePowerAmpForActor CRITICAL
          11 cyclomatic   11 cognitive   20 lines
         132.0 CRAP
    :709 expirePowerAmpFadeEntries CRITICAL
          11 cyclomatic   12 cognitive   16 lines
         132.0 CRAP
    :1085 activateFazeSkill CRITICAL
          11 cyclomatic   10 cognitive   44 lines
         132.0 CRAP
    :1223 resolveHeroSkillPointIdentity CRITICAL
          11 cyclomatic   15 cognitive   76 lines
         132.0 CRAP
    :1371 <arrow> CRITICAL
          11 cyclomatic   10 cognitive   13 lines
         132.0 CRAP
    :1909 GetPartySkillGrowthValue CRITICAL
          11 cyclomatic    9 cognitive   10 lines
         132.0 CRAP
    :2119 GetHeroTempSkillState CRITICAL
          11 cyclomatic    8 cognitive   12 lines
         132.0 CRAP
    :2149 AddSessionPassive CRITICAL
          11 cyclomatic   10 cognitive   17 lines
         132.0 CRAP
    :2435 migrateLegacyHeroGemUsageByName CRITICAL
          11 cyclomatic    7 cognitive   14 lines
         132.0 CRAP
    :6293 localePool CRITICAL
          11 cyclomatic    2 cognitive    4 lines
         132.0 CRAP
    :6310 localePool CRITICAL
          11 cyclomatic    2 cognitive    4 lines
         132.0 CRAP
    :6813 RefreshPartyBuffUI CRITICAL
          11 cyclomatic   10 cognitive   24 lines
         132.0 CRAP
    :6920 resolveGemActionCompat CRITICAL
          11 cyclomatic    8 cognitive   39 lines
         132.0 CRAP
    :7037 enemyJobSkillActionCode CRITICAL
          11 cyclomatic   10 cognitive   15 lines
         132.0 CRAP
    :7231 buildHeroTurnEntryFallbackDecision CRITICAL
          11 cyclomatic    7 cognitive   17 lines
         132.0 CRAP
    :7832 recordHeroTurnEntryOwner CRITICAL
          11 cyclomatic    8 cognitive   12 lines
         132.0 CRAP
    :8494 StartBuffRoll CRITICAL
          11 cyclomatic    8 cognitive   28 lines
         132.0 CRAP
  web-runner/src/core/powerAmpRules.mjs
    :43 derivePowerAmpActivationEntry CRITICAL
          11 cyclomatic    9 cognitive   17 lines
         132.0 CRAP
  src/core/gameStateEnvelopeRules.mjs
    :172 normalizeFlags CRITICAL
          11 cyclomatic    9 cognitive   12 lines
         132.0 CRAP
  web-runner/modules/skillSheet.js
    :56 ApplyPartyHeal CRITICAL
          11 cyclomatic   13 cognitive   19 lines
         132.0 CRAP
  src/core/turnOrderGroupRules.mjs
    :101 turnOrderActorInPhaseFromJs CRITICAL
          11 cyclomatic    7 cognitive   18 lines
         132.0 CRAP
    :178 resolveTurnOrderGroupProjection CRITICAL
          11 cyclomatic    8 cognitive   42 lines
         132.0 CRAP
  web-runner/src/core/heroSelectorRules.mjs
    :11 shouldRenderHeroTurnSelector CRITICAL
          11 cyclomatic    9 cognitive   14 lines
         132.0 CRAP
  web-runner/app.js
    :2127 applyAuthoritativeTurnState CRITICAL
          11 cyclomatic   12 cognitive   10 lines
         132.0 CRAP
    :2756 syncFromGlobals CRITICAL
          11 cyclomatic   10 cognitive   17 lines
         132.0 CRAP
    :6461 getDevAutoplayProgressSig CRITICAL
          11 cyclomatic   10 cognitive   14 lines
         132.0 CRAP
    :6657 deriveEncounterRequestFromMapState CRITICAL
          11 cyclomatic    7 cognitive   25 lines
         132.0 CRAP
  web-runner/src/core/superGemBoardState.mjs
    :95 canStartSuperGemSpend CRITICAL
          11 cyclomatic    3 cognitive   23 lines
         132.0 CRAP
  web-runner/src/core/singleHitRules.mjs
    :125 resolveSingleHit CRITICAL
          11 cyclomatic    7 cognitive   37 lines
         132.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :2205 createSimulationCoreTurnOrderGroupProjection CRITICAL
          11 cyclomatic   11 cognitive   82 lines
         132.0 CRAP
    :2650 shadowCombatPower CRITICAL
          11 cyclomatic   11 cognitive   20 lines
         132.0 CRAP
  Scripts/legacy but partially working/scripts/DataAdapter.js
    :117 GetEnemyDataSafe CRITICAL
          11 cyclomatic   11 cognitive   20 lines
         132.0 CRAP
  web-runner/src/core/runaMagicResistRules.mjs
    :125 resolveRunaMagicResist CRITICAL
          11 cyclomatic   10 cognitive   47 lines
         132.0 CRAP
  src/core/powerAmpRules.mjs
    :43 derivePowerAmpActivationEntry CRITICAL
          11 cyclomatic    9 cognitive   17 lines
         132.0 CRAP
  web-runner/src/core/enemySkillChoiceRules.mjs
    :180 enemySkillChoiceFromJs CRITICAL
          11 cyclomatic   12 cognitive   53 lines
         132.0 CRAP
  tests/purpleEnergyPathContract.test.js
    :12 extractFunctionSource CRITICAL
          10 cyclomatic   17 cognitive   35 lines
         110.0 CRAP
  web-runner/app.js
    :3815 startRefillBounce CRITICAL
          10 cyclomatic   16 cognitive   55 lines
         110.0 CRAP
    :4542 loadDeferredVisuals CRITICAL
          10 cyclomatic   16 cognitive   27 lines
         110.0 CRAP
  web-runner/src/core/superGemRender.mjs
    :77 getSuperGemRenderImage CRITICAL
          10 cyclomatic    6 cognitive   12 lines
         110.0 CRAP
  web-runner/modules/functionBank.js
    :200 normalizeLocaleTags CRITICAL
          10 cyclomatic   12 cognitive   22 lines
         110.0 CRAP
    :472 recordPowerAmpTelemetry CRITICAL
          10 cyclomatic   10 cognitive   23 lines
         110.0 CRAP
    :953 ensureSkillDraughtState CRITICAL
          10 cyclomatic    9 cognitive   12 lines
         110.0 CRAP
    :1623 SpendHeroSkillPoints CRITICAL
          10 cyclomatic    9 cognitive   28 lines
         110.0 CRAP
    :1682 GrantHeroSkillPointsToParty CRITICAL
          10 cyclomatic    9 cognitive   45 lines
         110.0 CRAP
    :1869 logPartyDestinyQa CRITICAL
          10 cyclomatic    9 cognitive   16 lines
         110.0 CRAP
    :2103 TriggerPartyDestinyDev CRITICAL
          10 cyclomatic    8 cognitive   36 lines
         110.0 CRAP
    :2175 ExpireHeroTempSkillState CRITICAL
          10 cyclomatic   13 cognitive   16 lines
         110.0 CRAP
    :2337 shouldResetAstralFlowAmpOnHeroTurn CRITICAL
          10 cyclomatic    9 cognitive    7 lines
         110.0 CRAP
    :2397 createHeroGemMilestoneColorState CRITICAL
          10 cyclomatic    9 cognitive   16 lines
         110.0 CRAP
    :2512 ensureHeroGemUsageState CRITICAL
          10 cyclomatic    9 cognitive   20 lines
         110.0 CRAP
    :2787 getDropGateChancePct CRITICAL
          10 cyclomatic    5 cognitive   11 lines
         110.0 CRAP
    :5144 GrantPurpleMatchEnergy CRITICAL
          10 cyclomatic    8 cognitive   25 lines
         110.0 CRAP
    :5803 ApplyPartyDamage CRITICAL
          10 cyclomatic    9 cognitive   22 lines
         110.0 CRAP
    :6225 Enemy_Heal_Allies CRITICAL
          10 cyclomatic    9 cognitive   32 lines
         110.0 CRAP
    :7098 resolveEnemyJobSkillCompat CRITICAL
          10 cyclomatic    7 cognitive   32 lines
         110.0 CRAP
    :7195 buildEnemyTurnFlowFallbackDecision CRITICAL
          10 cyclomatic    5 cognitive   15 lines
         110.0 CRAP
    :8601 RegisterPartyBuffSlot CRITICAL
          10 cyclomatic    9 cognitive   22 lines
         110.0 CRAP
  tools/serve_web.js
    :54 detectIssueId CRITICAL
          10 cyclomatic   13 cognitive   20 lines
         110.0 CRAP
  Scripts/entities.js
    :26 getEntityDiagnosticKey CRITICAL
          10 cyclomatic    4 cognitive    7 lines
         110.0 CRAP
  src/core/simulationCorePacket.cjs
    :32 normalizeSimulationRngState CRITICAL
          10 cyclomatic    7 cognitive   10 lines
         110.0 CRAP
  tools/playwright_doctor.js
    :188 printHumanSummary CRITICAL
          10 cyclomatic    8 cognitive   16 lines
         110.0 CRAP
  src/core/layoutState.js
    :3 DEBUG_LAYOUT CRITICAL
          10 cyclomatic    6 cognitive   14 lines
         110.0 CRAP
  web-runner/src/core/gameStateEnvelopeRules.mjs
    :108 normalizeActor CRITICAL
          10 cyclomatic    8 cognitive   19 lines
         110.0 CRAP
  src/core/gameStateEnvelopeRules.cjs
    :108 normalizeActor CRITICAL
          10 cyclomatic    8 cognitive   19 lines
         110.0 CRAP
  src/core/combatRuntimeGateway.cjs
    :78 DEBUG_LAYOUT CRITICAL
          10 cyclomatic    6 cognitive   14 lines
         110.0 CRAP
    :217 applySimulationCoreResponse CRITICAL
          10 cyclomatic   11 cognitive   21 lines
         110.0 CRAP
    :323 evaluateCheckpoint CRITICAL
          10 cyclomatic   12 cognitive   15 lines
         110.0 CRAP
  web-runner/src/core/combatRuntimeGateway.js
    :78 DEBUG_LAYOUT CRITICAL
          10 cyclomatic    6 cognitive   14 lines
         110.0 CRAP
    :217 applySimulationCoreResponse CRITICAL
          10 cyclomatic   11 cognitive   21 lines
         110.0 CRAP
    :323 evaluateCheckpoint CRITICAL
          10 cyclomatic   12 cognitive   15 lines
         110.0 CRAP
  web-runner/src/core/enemyTargetingRules.mjs
    :37 normalizeEnemyTargetPreference CRITICAL
          10 cyclomatic    2 cognitive   10 lines
         110.0 CRAP
    :161 enemyTargetSelectionFromJs CRITICAL
          10 cyclomatic    8 cognitive   18 lines
         110.0 CRAP
  Scripts/functionBank.js
    :199 normalizeLocaleTags CRITICAL
          10 cyclomatic   12 cognitive   22 lines
         110.0 CRAP
    :466 emitPowerAmpStateLog CRITICAL
          10 cyclomatic   10 cognitive   22 lines
         110.0 CRAP
    :910 ensureSkillDraughtState CRITICAL
          10 cyclomatic    9 cognitive   12 lines
         110.0 CRAP
    :1580 SpendHeroSkillPoints CRITICAL
          10 cyclomatic    9 cognitive   28 lines
         110.0 CRAP
    :1639 GrantHeroSkillPointsToParty CRITICAL
          10 cyclomatic    9 cognitive   45 lines
         110.0 CRAP
    :1826 logPartyDestinyQa CRITICAL
          10 cyclomatic    9 cognitive   16 lines
         110.0 CRAP
    :2060 TriggerPartyDestinyDev CRITICAL
          10 cyclomatic    8 cognitive   36 lines
         110.0 CRAP
    :2132 ExpireHeroTempSkillState CRITICAL
          10 cyclomatic   13 cognitive   16 lines
         110.0 CRAP
    :2294 shouldResetAstralFlowAmpOnHeroTurn CRITICAL
          10 cyclomatic    9 cognitive    7 lines
         110.0 CRAP
    :2354 createHeroGemMilestoneColorState CRITICAL
          10 cyclomatic    9 cognitive   16 lines
         110.0 CRAP
    :2469 ensureHeroGemUsageState CRITICAL
          10 cyclomatic    9 cognitive   20 lines
         110.0 CRAP
    :2744 getDropGateChancePct CRITICAL
          10 cyclomatic    5 cognitive   11 lines
         110.0 CRAP
    :5135 GrantPurpleMatchEnergy CRITICAL
          10 cyclomatic    8 cognitive   25 lines
         110.0 CRAP
    :5794 ApplyPartyDamage CRITICAL
          10 cyclomatic    9 cognitive   22 lines
         110.0 CRAP
    :6209 Enemy_Heal_Allies CRITICAL
          10 cyclomatic    9 cognitive   32 lines
         110.0 CRAP
    :7079 resolveEnemyJobSkillCompat CRITICAL
          10 cyclomatic    7 cognitive   32 lines
         110.0 CRAP
    :7176 buildEnemyTurnFlowFallbackDecision CRITICAL
          10 cyclomatic    5 cognitive   15 lines
         110.0 CRAP
    :8582 RegisterPartyBuffSlot CRITICAL
          10 cyclomatic    9 cognitive   22 lines
         110.0 CRAP
  web-runner/src/core/powerAmpRules.mjs
    :101 derivePowerAmpConsumeState CRITICAL
          10 cyclomatic    7 cognitive   19 lines
         110.0 CRAP
  web-runner/src/core/calculateDamageRules.mjs
    :102 normalizeCalculateDamageInput CRITICAL
          10 cyclomatic    9 cognitive   29 lines
         110.0 CRAP
  web-runner/src/core/simulationCorePacket.js
    :32 normalizeSimulationRngState CRITICAL
          10 cyclomatic    7 cognitive   10 lines
         110.0 CRAP
  src/core/gameStateEnvelopeRules.mjs
    :108 normalizeActor CRITICAL
          10 cyclomatic    8 cognitive   19 lines
         110.0 CRAP
  src/core/inputDomains.js
    :1 DEBUG_LAYOUT CRITICAL
          10 cyclomatic    6 cognitive   14 lines
         110.0 CRAP
  web-runner/app.js
    :124 DEBUG_LAYOUT CRITICAL
          10 cyclomatic    6 cognitive   14 lines
         110.0 CRAP
    :379 isHitFlashActive CRITICAL
          10 cyclomatic    8 cognitive    9 lines
         110.0 CRAP
    :1287 syncConfiguredDoubleAttackHarness CRITICAL
          10 cyclomatic   10 cognitive   29 lines
         110.0 CRAP
    :1949 resetCombatRuntimeForFreshSession CRITICAL
          10 cyclomatic    9 cognitive   61 lines
         110.0 CRAP
    :2084 traceTask015YellowWrite CRITICAL
          10 cyclomatic    9 cognitive   14 lines
         110.0 CRAP
    :2474 fallbackSkillStates CRITICAL
          10 cyclomatic    9 cognitive   16 lines
         110.0 CRAP
    :2950 parseC2ArrayTable CRITICAL
          10 cyclomatic   12 cognitive   19 lines
         110.0 CRAP
    :2970 normalizeBiomeTags CRITICAL
          10 cyclomatic   12 cognitive   22 lines
         110.0 CRAP
    :3881 collectBoardCoverageIssues CRITICAL
          10 cyclomatic   15 cognitive   19 lines
         110.0 CRAP
    :3901 tryActivateRuntimePhase CRITICAL
          10 cyclomatic    9 cognitive   18 lines
         110.0 CRAP
    :5089 traceTask015StoryPlacement CRITICAL
          10 cyclomatic    9 cognitive   13 lines
         110.0 CRAP
    :5926 getLatestCombatActionLine CRITICAL
          10 cyclomatic    9 cognitive    9 lines
         110.0 CRAP
    :5964 getBattleStartStoryCardOverlay CRITICAL
          10 cyclomatic    9 cognitive   12 lines
         110.0 CRAP
    :6305 getCurrentIdleAutoplayHeroName CRITICAL
          10 cyclomatic    3 cognitive   15 lines
         110.0 CRAP
    :6394 autoResolveSkillDraughtForDevIdle CRITICAL
          10 cyclomatic    9 cognitive   20 lines
         110.0 CRAP
    :6414 resolveCombatOutcomeWithOwner CRITICAL
          10 cyclomatic    8 cognitive   31 lines
         110.0 CRAP
  web-runner/systems/superGemRuntime.js
    :698 armPendingSuperGemAttack CRITICAL
          10 cyclomatic    7 cognitive   22 lines
         110.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :388 hasPartyDamageExports CRITICAL
          10 cyclomatic    1 cognitive    7 lines
         110.0 CRAP
    :475 hasEnemyJobSkillExports CRITICAL
          10 cyclomatic    1 cognitive    7 lines
         110.0 CRAP
    :492 hasEnemyTurnFlowExports CRITICAL
          10 cyclomatic    1 cognitive    7 lines
         110.0 CRAP
  src/core/combatRuntimeGateway.js
    :43 DEBUG_LAYOUT CRITICAL
          10 cyclomatic    6 cognitive   14 lines
         110.0 CRAP
  src/core/enemyTargetingRules.mjs
    :37 normalizeEnemyTargetPreference CRITICAL
          10 cyclomatic    2 cognitive   10 lines
         110.0 CRAP
    :161 enemyTargetSelectionFromJs CRITICAL
          10 cyclomatic    8 cognitive   18 lines
         110.0 CRAP
  src/core/powerAmpRules.mjs
    :101 derivePowerAmpConsumeState CRITICAL
          10 cyclomatic    7 cognitive   19 lines
         110.0 CRAP
  src/core/calculateDamageRules.mjs
    :102 normalizeCalculateDamageInput CRITICAL
          10 cyclomatic    9 cognitive   29 lines
         110.0 CRAP
  web-runner/src/core/idleFarmRuntime.mjs
    :92 ensureRewardLedger CRITICAL
          10 cyclomatic    9 cognitive   49 lines
         110.0 CRAP
  tests/devToolingModalContract.test.js
    :6 extractFunctionSource HIGH
           9 cyclomatic   16 cognitive   33 lines
          90.0 CRAP
  tests/enemyRefillTurnGateContract.test.js
    :12 extractFunctionSource HIGH
           9 cyclomatic   16 cognitive   36 lines
          90.0 CRAP
  Scripts/legacy but partially working/scripts/Initializer.js
    :8 InitializeGame HIGH
           9 cyclomatic    8 cognitive   46 lines
          90.0 CRAP
  web-runner/src/core/superGemRender.mjs
    :48 getSuperGemRenderRect HIGH
           9 cyclomatic    6 cognitive   28 lines
          90.0 CRAP
  web-runner/modules/functionBank.js
    :340 applyTurnGateState HIGH
           9 cyclomatic   10 cognitive   26 lines
          90.0 CRAP
    :550 activatePowerAmp HIGH
           9 cyclomatic   14 cognitive   26 lines
          90.0 CRAP
    :888 cloneSkillDefinition HIGH
           9 cyclomatic    8 cognitive   13 lines
          90.0 CRAP
    :2146 SetHeroTempSkillState HIGH
           9 cyclomatic    8 cognitive   15 lines
          90.0 CRAP
    :2468 buildHeroGemUsageRecord HIGH
           9 cyclomatic    8 cognitive    9 lines
          90.0 CRAP
    :3113 getInitiativeRoster HIGH
           9 cyclomatic   13 cognitive   22 lines
          90.0 CRAP
    :5234 jsDecision HIGH
           9 cyclomatic    8 cognitive   21 lines
          90.0 CRAP
    :6559 resolveEnemySlotIndex HIGH
           9 cyclomatic   12 cognitive   16 lines
          90.0 CRAP
    :7268 resolveHeroTurnEntryCompat HIGH
           9 cyclomatic    7 cognitive   32 lines
          90.0 CRAP
  tests/enemyDotLifecycleFixtureContract.test.js
    :23 jsLifecycleAction HIGH
           9 cyclomatic    8 cognitive   10 lines
          90.0 CRAP
  tools/playwright_doctor.js
    :118 runCdpProbe HIGH
           9 cyclomatic   12 cognitive   48 lines
          90.0 CRAP
  web-runner/src/core/enemyTurnFlowRules.mjs
    :42 ownerDecisionFromResult HIGH
           9 cyclomatic    4 cognitive   13 lines
          90.0 CRAP
  src/core/layoutState.js
    :23 assertLayoutDescriptor HIGH
           9 cyclomatic    8 cognitive   20 lines
          90.0 CRAP
  web-runner/src/core/gameStateEnvelopeRules.mjs
    :213 createGameStateEnvelopeSimulationPacket HIGH
           9 cyclomatic    6 cognitive   49 lines
          90.0 CRAP
  src/core/gameStateEnvelopeRules.cjs
    :213 createGameStateEnvelopeSimulationPacket HIGH
           9 cyclomatic    6 cognitive   49 lines
          90.0 CRAP
  web-runner/systems/renderSkillDraughtOverlay.js
    :1 drawWrappedText HIGH
           9 cyclomatic   11 cognitive   21 lines
          90.0 CRAP
    :46 <arrow> HIGH
           9 cyclomatic    7 cognitive   17 lines
          90.0 CRAP
    :23 renderSkillDraughtOverlay HIGH
           9 cyclomatic    6 cognitive   42 lines
          90.0 CRAP
  tools/balance_harness.js
    :273 maybeClearSelectedGems HIGH
           9 cyclomatic    4 cognitive   10 lines
          90.0 CRAP
  Scripts/legacy but partially working/scripts/Function_Bank.js
    :34 BuildTurnOrder HIGH
           9 cyclomatic   10 cognitive   38 lines
          90.0 CRAP
    :307 RefreshPartyBuffUI HIGH
           9 cyclomatic    8 cognitive   13 lines
          90.0 CRAP
  src/core/enemySkillChoiceRules.mjs
    :106 baseEnemySkillChoice HIGH
           9 cyclomatic    8 cognitive   27 lines
          90.0 CRAP
    :134 applyBoardFallback HIGH
           9 cyclomatic    7 cognitive   16 lines
          90.0 CRAP
  src/core/gemActionRules.mjs
    :179 resolveGemAction HIGH
           9 cyclomatic    9 cognitive   51 lines
          90.0 CRAP
  src/core/schedulerRules.mjs
    :1 compareSchedulerSlots HIGH
           9 cyclomatic    6 cognitive    5 lines
          90.0 CRAP
  src/core/combatRuntimeGateway.cjs
    :99 constructor HIGH
           9 cyclomatic    8 cognitive   27 lines
          90.0 CRAP
  web-runner/src/core/superGemRules.mjs
    :16 buildColorGrid HIGH
           9 cyclomatic    9 cognitive   12 lines
          90.0 CRAP
  src/core/enemyTurnFlowRules.mjs
    :42 ownerDecisionFromResult HIGH
           9 cyclomatic    4 cognitive   13 lines
          90.0 CRAP
  web-runner/src/core/combatRuntimeGateway.js
    :99 constructor HIGH
           9 cyclomatic    8 cognitive   27 lines
          90.0 CRAP
  web-runner/src/core/enemyTargetingRules.mjs
    :80 pickPreferredHero HIGH
           9 cyclomatic    8 cognitive   18 lines
          90.0 CRAP
    :99 heroRoleCode HIGH
           9 cyclomatic    3 cognitive    4 lines
          90.0 CRAP
  Scripts/functionBank.js
    :339 applyTurnGateState HIGH
           9 cyclomatic   10 cognitive   26 lines
          90.0 CRAP
    :523 activatePowerAmp HIGH
           9 cyclomatic   14 cognitive   26 lines
          90.0 CRAP
    :845 cloneSkillDefinition HIGH
           9 cyclomatic    8 cognitive   13 lines
          90.0 CRAP
    :2103 SetHeroTempSkillState HIGH
           9 cyclomatic    8 cognitive   15 lines
          90.0 CRAP
    :2425 buildHeroGemUsageRecord HIGH
           9 cyclomatic    8 cognitive    9 lines
          90.0 CRAP
    :3070 getInitiativeRoster HIGH
           9 cyclomatic   13 cognitive   22 lines
          90.0 CRAP
    :5225 jsDecision HIGH
           9 cyclomatic    8 cognitive   21 lines
          90.0 CRAP
    :6540 resolveEnemySlotIndex HIGH
           9 cyclomatic   12 cognitive   16 lines
          90.0 CRAP
    :7249 resolveHeroTurnEntryCompat HIGH
           9 cyclomatic    7 cognitive   32 lines
          90.0 CRAP
  tools/audit_initiative_fairness.js
    :197 runSingleSample HIGH
           9 cyclomatic   10 cognitive   50 lines
          90.0 CRAP
  src/core/gameStateEnvelopeRules.mjs
    :213 createGameStateEnvelopeSimulationPacket HIGH
           9 cyclomatic    6 cognitive   49 lines
          90.0 CRAP
  web-runner/app.js
    :476 hasPersistentHeroRegenOverlay HIGH
           9 cyclomatic   11 cognitive   10 lines
          90.0 CRAP
    :1499 <arrow> HIGH
           9 cyclomatic    5 cognitive    8 lines
          90.0 CRAP
    :1594 readDevToolingDomConfigPatch HIGH
           9 cyclomatic    7 cognitive   13 lines
          90.0 CRAP
    :2329 live HIGH
           9 cyclomatic    4 cognitive    3 lines
          90.0 CRAP
    :2368 getHeroStatValue HIGH
           9 cyclomatic    7 cognitive   15 lines
          90.0 CRAP
    :2395 getHeroRoleLabel HIGH
           9 cyclomatic    7 cognitive    7 lines
          90.0 CRAP
    :2703 trackTask011EnemyBoundary HIGH
           9 cyclomatic    8 cognitive   14 lines
          90.0 CRAP
    :3199 pickBest HIGH
           9 cyclomatic   10 cognitive   26 lines
          90.0 CRAP
    :4148 shouldSuppressCombatLayoutInstance HIGH
           9 cyclomatic    4 cognitive    9 lines
          90.0 CRAP
    :4437 getSpriteImagePath HIGH
           9 cyclomatic    6 cognitive   11 lines
          90.0 CRAP
    :5258 getSpriteOrigin HIGH
           9 cyclomatic    3 cognitive    9 lines
          90.0 CRAP
    :5331 getAttackButtonBounds HIGH
           9 cyclomatic   11 cognitive   23 lines
          90.0 CRAP
    :5942 getStoryCardIntentFallbackLine HIGH
           9 cyclomatic    7 cognitive    9 lines
          90.0 CRAP
    :6475 requestCombatFailureExit HIGH
           9 cyclomatic    7 cognitive   30 lines
          90.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :2566 <arrow> HIGH
           9 cyclomatic    9 cognitive   82 lines
          90.0 CRAP
  src/core/enemyTargetingRules.mjs
    :80 pickPreferredHero HIGH
           9 cyclomatic    8 cognitive   18 lines
          90.0 CRAP
    :99 heroRoleCode HIGH
           9 cyclomatic    3 cognitive    4 lines
          90.0 CRAP
  web-runner/systems/renderCollectibles.js
    :3 renderCollectibles HIGH
           9 cyclomatic   10 cognitive   32 lines
          90.0 CRAP
  web-runner/src/core/enemySkillChoiceRules.mjs
    :106 baseEnemySkillChoice HIGH
           9 cyclomatic    8 cognitive   27 lines
          90.0 CRAP
    :134 applyBoardFallback HIGH
           9 cyclomatic    7 cognitive   16 lines
          90.0 CRAP
  web-runner/src/core/gemActionRules.mjs
    :179 resolveGemAction HIGH
           9 cyclomatic    9 cognitive   51 lines
          90.0 CRAP
  web-runner/src/core/schedulerRules.mjs
    :1 compareSchedulerSlots HIGH
           9 cyclomatic    6 cognitive    5 lines
          90.0 CRAP
  tests/superGemAppContract.test.js
    :5 <arrow> HIGH
           8 cyclomatic   13 cognitive   30 lines
          72.0 CRAP
  web-runner/modules/functionBank.js
    :184 ensureEntities HIGH
           8 cyclomatic    9 cognitive    8 lines
          72.0 CRAP
    :705 ConsumePowerAmpForActor HIGH
           8 cyclomatic    5 cognitive   11 lines
          72.0 CRAP
    :1028 getFazeHeroTeamTurnSpan HIGH
           8 cyclomatic    9 cognitive   17 lines
          72.0 CRAP
    :1268 fromActor HIGH
           8 cyclomatic    7 cognitive    6 lines
          72.0 CRAP
    :2546 ensureHeroGemMilestonesState HIGH
           8 cyclomatic    7 cognitive   26 lines
          72.0 CRAP
    :2878 source HIGH
           8 cyclomatic    5 cognitive    6 lines
          72.0 CRAP
    :3349 refreshInitiativePreview HIGH
           8 cyclomatic    7 cognitive   18 lines
          72.0 CRAP
    :3422 RebuildTurnOrderPreserveCurrent HIGH
           8 cyclomatic    7 cognitive   45 lines
          72.0 CRAP
    :3766 ConfigureActorRedAttackSkill HIGH
           8 cyclomatic    6 cognitive   11 lines
          72.0 CRAP
    :4179 turnSummaryCodeFromSnapshot HIGH
           8 cyclomatic    7 cognitive   24 lines
          72.0 CRAP
    :5117 Sub_Energy HIGH
           8 cyclomatic    7 cognitive   13 lines
          72.0 CRAP
    :6261 candidates HIGH
           8 cyclomatic    4 cognitive    5 lines
          72.0 CRAP
    :6304 PickNextEnemyID HIGH
           8 cyclomatic    6 cognitive   16 lines
          72.0 CRAP
    :7722 damagedAllies HIGH
           8 cyclomatic    4 cognitive    5 lines
          72.0 CRAP
    :7797 recordEnemyTurnFlowOwner HIGH
           8 cyclomatic    5 cognitive    9 lines
          72.0 CRAP
    :8161 damagedAlliesCount HIGH
           8 cyclomatic    4 cognitive    5 lines
          72.0 CRAP
    :8233 clearRandomGemLine HIGH
           8 cyclomatic    7 cognitive   26 lines
          72.0 CRAP
  web-runner/src/core/startEnemyActionRules.mjs
    :28 startEnemyActionFromJs HIGH
           8 cyclomatic    7 cognitive   30 lines
          72.0 CRAP
    :80 resolveStartEnemyAction HIGH
           8 cyclomatic    8 cognitive   40 lines
          72.0 CRAP
  tests/falieRedSuperGemBufferShieldContract.test.js
    :66 callFunctionWithContext HIGH
           8 cyclomatic    7 cognitive   12 lines
          72.0 CRAP
  web-runner/src/core/gameStateEnvelopeRules.mjs
    :128 normalizeActors HIGH
           8 cyclomatic    9 cognitive   18 lines
          72.0 CRAP
  src/core/gameStateEnvelopeRules.cjs
    :128 normalizeActors HIGH
           8 cyclomatic    9 cognitive   18 lines
          72.0 CRAP
  web-runner/src/core/turnOrderGroupRules.mjs
    :72 turnOrderStatusBlockedFromJs HIGH
           8 cyclomatic    3 cognitive    9 lines
          72.0 CRAP
  src/core/runaMagicResistRules.mjs
    :80 runaMagicResistFromJs HIGH
           8 cyclomatic    7 cognitive   44 lines
          72.0 CRAP
  tools/balance_harness.js
    :306 buildCandidateMatches HIGH
           8 cyclomatic    8 cognitive   12 lines
          72.0 CRAP
    :607 aggregateSessions HIGH
           8 cyclomatic    7 cognitive   49 lines
          72.0 CRAP
  src/core/schedulerRules.mjs
    :16 cycle HIGH
           8 cyclomatic    3 cognitive    6 lines
          72.0 CRAP
  src/core/statusEffectRules.mjs
    :275 mapOwnerResult HIGH
           8 cyclomatic    2 cognitive   12 lines
          72.0 CRAP
    :537 mapOwnerResult HIGH
           8 cyclomatic    2 cognitive   12 lines
          72.0 CRAP
  tools/qa_huun_yellow_supergem_browser.mjs
    :175 runScenario HIGH
           8 cyclomatic    8 cognitive   51 lines
          72.0 CRAP
  web-runner/src/core/superGemRules.mjs
    :39 classifySquare HIGH
           8 cyclomatic    7 cognitive   15 lines
          72.0 CRAP
  src/core/startEnemyActionRules.mjs
    :28 startEnemyActionFromJs HIGH
           8 cyclomatic    7 cognitive   30 lines
          72.0 CRAP
    :80 resolveStartEnemyAction HIGH
           8 cyclomatic    8 cognitive   40 lines
          72.0 CRAP
  web-runner/src/core/effectiveStatRules.mjs
    :65 normalizeEffectiveStatInput HIGH
           8 cyclomatic    7 cognitive   23 lines
          72.0 CRAP
  tools/playwright_launch_matrix.js
    :105 main HIGH
           8 cyclomatic    8 cognitive   61 lines
          72.0 CRAP
  web-runner/src/core/enemyTargetingRules.mjs
    :91 <arrow> HIGH
           8 cyclomatic    2 cognitive    4 lines
          72.0 CRAP
  Scripts/functionBank.js
    :183 ensureEntities HIGH
           8 cyclomatic    9 cognitive    8 lines
          72.0 CRAP
    :664 ConsumePowerAmpForActor HIGH
           8 cyclomatic    5 cognitive   11 lines
          72.0 CRAP
    :985 getFazeHeroTeamTurnSpan HIGH
           8 cyclomatic    9 cognitive   17 lines
          72.0 CRAP
    :1225 fromActor HIGH
           8 cyclomatic    7 cognitive    6 lines
          72.0 CRAP
    :2503 ensureHeroGemMilestonesState HIGH
           8 cyclomatic    7 cognitive   26 lines
          72.0 CRAP
    :2835 source HIGH
           8 cyclomatic    5 cognitive    6 lines
          72.0 CRAP
    :3432 RebuildTurnOrderPreserveCurrent HIGH
           8 cyclomatic    7 cognitive   45 lines
          72.0 CRAP
    :3757 ConfigureActorRedAttackSkill HIGH
           8 cyclomatic    6 cognitive   11 lines
          72.0 CRAP
    :4170 turnSummaryCodeFromSnapshot HIGH
           8 cyclomatic    7 cognitive   24 lines
          72.0 CRAP
    :5108 Sub_Energy HIGH
           8 cyclomatic    7 cognitive   13 lines
          72.0 CRAP
    :6245 candidates HIGH
           8 cyclomatic    4 cognitive    5 lines
          72.0 CRAP
    :6288 PickNextEnemyID HIGH
           8 cyclomatic    6 cognitive   16 lines
          72.0 CRAP
    :7703 damagedAllies HIGH
           8 cyclomatic    4 cognitive    5 lines
          72.0 CRAP
    :7778 recordEnemyTurnFlowOwner HIGH
           8 cyclomatic    5 cognitive    9 lines
          72.0 CRAP
    :8142 damagedAlliesCount HIGH
           8 cyclomatic    4 cognitive    5 lines
          72.0 CRAP
    :8214 clearRandomGemLine HIGH
           8 cyclomatic    7 cognitive   26 lines
          72.0 CRAP
  web-runner/src/core/powerAmpRules.mjs
    :121 derivePowerAmpCloseDecision HIGH
           8 cyclomatic    6 cognitive   36 lines
          72.0 CRAP
  tools/audit_initiative_fairness.js
    :248 summarize HIGH
           8 cyclomatic   11 cognitive   37 lines
          72.0 CRAP
  web-runner/src/core/calculateDamageRules.mjs
    :132 resolveCalculateDamage HIGH
           8 cyclomatic    7 cognitive   31 lines
          72.0 CRAP
  src/core/gameStateEnvelopeRules.mjs
    :128 normalizeActors HIGH
           8 cyclomatic    9 cognitive   18 lines
          72.0 CRAP
  src/core/turnOrderGroupRules.mjs
    :72 turnOrderStatusBlockedFromJs HIGH
           8 cyclomatic    3 cognitive    9 lines
          72.0 CRAP
  web-runner/src/core/damageFloatVector.mjs
    :34 pickDamageFloatAngleDeg HIGH
           8 cyclomatic    7 cognitive   21 lines
          72.0 CRAP
  tests/partyRegenTickFixtureContract.test.js
    :24 jsPartyRegenTick HIGH
           8 cyclomatic   13 cognitive   25 lines
          72.0 CRAP
  web-runner/src/core/heroSelectorRules.mjs
    :1 resolveCurrentHeroUID HIGH
           8 cyclomatic    6 cognitive    9 lines
          72.0 CRAP
  web-runner/app.js
    :234 applyTurnGateGlobals HIGH
           8 cyclomatic    9 cognitive   11 lines
          72.0 CRAP
    :1402 syncIdleFarmDevLoadoutConfig HIGH
           8 cyclomatic    6 cognitive   14 lines
          72.0 CRAP
    :1523 updateDevToolingStatus HIGH
           8 cyclomatic    7 cognitive   15 lines
          72.0 CRAP
    :1897 pauseGameplayForDevTooling HIGH
           8 cyclomatic    7 cognitive   16 lines
          72.0 CRAP
    :1918 resumeGameplayFromDevTooling HIGH
           8 cyclomatic    7 cognitive   15 lines
          72.0 CRAP
    :2029 isDevToolingHotkey HIGH
           8 cyclomatic    6 cognitive    6 lines
          72.0 CRAP
    :2137 getDeterministicRngState HIGH
           8 cyclomatic    7 cognitive   10 lines
          72.0 CRAP
    :5442 applyLayoutResult HIGH
           8 cyclomatic    6 cognitive    5 lines
          72.0 CRAP
    :5952 getLatestStoryCardActionLine HIGH
           8 cyclomatic   10 cognitive   11 lines
          72.0 CRAP
    :5977 isBattleStartSessionLine HIGH
           8 cyclomatic    7 cognitive    8 lines
          72.0 CRAP
    :6584 forceDeterministicBoard HIGH
           8 cyclomatic    9 cognitive   12 lines
          72.0 CRAP
    :6577 runGemInteractivityDiagnostic HIGH
           8 cyclomatic    7 cognitive   53 lines
          72.0 CRAP
    :7146 navHit HIGH
           8 cyclomatic    5 cognitive    8 lines
          72.0 CRAP
  web-runner/src/core/superGemBoardState.mjs
    :163 settleSuperGemShapes HIGH
           8 cyclomatic    7 cognitive   22 lines
          72.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :396 hasPartyRegenTickExports HIGH
           8 cyclomatic    1 cognitive    6 lines
          72.0 CRAP
    :407 hasEnemyDotTickExports HIGH
           8 cyclomatic    1 cognitive    6 lines
          72.0 CRAP
    :1120 initializeSimulationCoreShadow HIGH
           8 cyclomatic    6 cognitive   88 lines
          72.0 CRAP
  tests/fazeGreenSuperGemSeparationContract.test.js
    :39 callFunctionWithContext HIGH
           8 cyclomatic    7 cognitive   10 lines
          72.0 CRAP
  src/core/effectiveStatRules.mjs
    :65 normalizeEffectiveStatInput HIGH
           8 cyclomatic    7 cognitive   23 lines
          72.0 CRAP
  src/core/enemyTargetingRules.mjs
    :91 <arrow> HIGH
           8 cyclomatic    2 cognitive    4 lines
          72.0 CRAP
  web-runner/src/core/runaMagicResistRules.mjs
    :80 runaMagicResistFromJs HIGH
           8 cyclomatic    7 cognitive   44 lines
          72.0 CRAP
  src/core/powerAmpRules.mjs
    :121 derivePowerAmpCloseDecision HIGH
           8 cyclomatic    6 cognitive   36 lines
          72.0 CRAP
  src/core/calculateDamageRules.mjs
    :132 resolveCalculateDamage HIGH
           8 cyclomatic    7 cognitive   31 lines
          72.0 CRAP
  web-runner/src/core/idleFarmRuntime.mjs
    :205 startIdleFarmEmissionState HIGH
           8 cyclomatic    7 cognitive   17 lines
          72.0 CRAP
  web-runner/src/core/schedulerRules.mjs
    :16 cycle HIGH
           8 cyclomatic    3 cognitive    6 lines
          72.0 CRAP
  web-runner/src/core/statusEffectRules.mjs
    :275 mapOwnerResult HIGH
           8 cyclomatic    2 cognitive   12 lines
          72.0 CRAP
    :537 mapOwnerResult HIGH
           8 cyclomatic    2 cognitive   12 lines
          72.0 CRAP
  src/core/damageFloatVector.mjs
    :34 pickDamageFloatAngleDeg HIGH
           8 cyclomatic    7 cognitive   21 lines
          72.0 CRAP
  web-runner/src/core/superGemRules.mjs
    :55 detectSuperGemClusters HIGH
           7 cyclomatic   18 cognitive   29 lines
          56.0 CRAP
  web-runner/modules/functionBank.js
    :268 appendTraitHookTrace HIGH
           7 cyclomatic    6 cognitive   13 lines
          56.0 CRAP
    :1599 GrantHeroSkillPoints HIGH
           7 cyclomatic    6 cognitive   23 lines
          56.0 CRAP
    :1736 results HIGH
           7 cyclomatic    6 cognitive   13 lines
          56.0 CRAP
    :1824 normalizeSkillProcId HIGH
           7 cyclomatic    4 cognitive    6 lines
          56.0 CRAP
    :1845 IsHeroSessionSkillActive HIGH
           7 cyclomatic    4 cognitive   11 lines
          56.0 CRAP
    :2836 getTreasureHunterLevel HIGH
           7 cyclomatic    1 cognitive    4 lines
          56.0 CRAP
    :3177 schedulerApplyRemovalCompaction HIGH
           7 cyclomatic    6 cognitive    9 lines
          56.0 CRAP
    :3226 extraSlots HIGH
           7 cyclomatic    4 cognitive    7 lines
          56.0 CRAP
    :3269 syncInitiativeMeters HIGH
           7 cyclomatic    8 cognitive   19 lines
          56.0 CRAP
    :3983 ApplyScaledCrit HIGH
           7 cyclomatic    6 cognitive   30 lines
          56.0 CRAP
    :5459 createEnemyDebuffSlotDecision HIGH
           7 cyclomatic    7 cognitive   43 lines
          56.0 CRAP
    :6762 GetChainMultiplier HIGH
           7 cyclomatic    6 cognitive    9 lines
          56.0 CRAP
    :6876 gemActionIntentMetaFallback HIGH
           7 cyclomatic    6 cognitive    9 lines
          56.0 CRAP
    :8119 resolveEnemyBoardLineFallbackSkill HIGH
           7 cyclomatic    4 cognitive    6 lines
          56.0 CRAP
    :8145 normalizeEnemyBoardLineSkillDecision HIGH
           7 cyclomatic    4 cognitive   10 lines
          56.0 CRAP
  tools/chrome_cdp_bootstrap.js
    :27 main HIGH
           7 cyclomatic    6 cognitive   34 lines
          56.0 CRAP
  src/core/heroTurnEntryRules.mjs
    :67 resolveHeroTurnEntry HIGH
           7 cyclomatic    7 cognitive   44 lines
          56.0 CRAP
  web-runner/src/core/turnSummaryRules.mjs
    :126 resolveTurnSummary HIGH
           7 cyclomatic    6 cognitive   40 lines
          56.0 CRAP
  src/core/layoutState.js
    :106 processQueuedLayoutRequest HIGH
           7 cyclomatic    5 cognitive   18 lines
          56.0 CRAP
  tests/falieRedSuperGemBufferShieldContract.test.js
    :95 <arrow> HIGH
           7 cyclomatic    6 cognitive   23 lines
          56.0 CRAP
  src/core/turnActorEligibilityRules.mjs
    :116 resolveTurnActorEligibility HIGH
           7 cyclomatic    6 cognitive   45 lines
          56.0 CRAP
  tests/kojonnAmpAoeContract.test.js
    :10 extractFunctionSource HIGH
           7 cyclomatic   11 cognitive   21 lines
          56.0 CRAP
  web-runner/src/core/gameStateEnvelopeRules.mjs
    :33 compactObject HIGH
           7 cyclomatic   11 cognitive   12 lines
          56.0 CRAP
    :147 normalizeGem HIGH
           7 cyclomatic    4 cognitive    9 lines
          56.0 CRAP
  web-runner/src/core/roundPointerAdvanceRules.mjs
    :63 roundPointerAdvanceFromJs HIGH
           7 cyclomatic    7 cognitive   28 lines
          56.0 CRAP
  src/core/gameStateEnvelopeRules.cjs
    :33 compactObject HIGH
           7 cyclomatic   11 cognitive   12 lines
          56.0 CRAP
    :147 normalizeGem HIGH
           7 cyclomatic    4 cognitive    9 lines
          56.0 CRAP
  tools/balance_harness.js
    :427 <arrow> HIGH
           7 cyclomatic    6 cognitive    9 lines
          56.0 CRAP
  web-runner/src/core/turnPhaseAssignmentRules.mjs
    :58 turnPhaseFromJs HIGH
           7 cyclomatic    7 cognitive   13 lines
          56.0 CRAP
  Scripts/legacy but partially working/scripts/Function_Bank.js
    :130 GetEffectiveStat HIGH
           7 cyclomatic   10 cognitive   13 lines
          56.0 CRAP
  src/core/enemySkillChoiceRules.mjs
    :151 chimerilassHealChoice HIGH
           7 cyclomatic    7 cognitive   28 lines
          56.0 CRAP
  src/core/gemActionRules.mjs
    :62 gemActionIntentMeta HIGH
           7 cyclomatic    6 cognitive   10 lines
          56.0 CRAP
  src/core/schedulerRules.mjs
    :15 buildFixedCycleSlots HIGH
           7 cyclomatic    5 cognitive   20 lines
          56.0 CRAP
  web-runner/systems/appShellViewport.js
    :37 resizeCanvasToContainedViewport HIGH
           7 cyclomatic    6 cognitive   33 lines
          56.0 CRAP
  src/core/statusEffectRules.mjs
    :450 mapOwnerResult HIGH
           7 cyclomatic    2 cognitive    9 lines
          56.0 CRAP
  tools/qa_huun_yellow_supergem_browser.mjs
    :27 <arrow> HIGH
           7 cyclomatic    2 cognitive    8 lines
          56.0 CRAP
  web-runner/src/core/combatOutcomeRules.mjs
    :49 combatOutcomeCodeFromJs HIGH
           7 cyclomatic    6 cognitive    6 lines
          56.0 CRAP
    :56 combatOutcomeReasonFromCode HIGH
           7 cyclomatic    6 cognitive    6 lines
          56.0 CRAP
  web-runner/src/core/effectiveStatRules.mjs
    :89 resolveEffectiveStat HIGH
           7 cyclomatic    6 cognitive   30 lines
          56.0 CRAP
  src/core/turnSummaryRules.mjs
    :126 resolveTurnSummary HIGH
           7 cyclomatic    6 cognitive   40 lines
          56.0 CRAP
  web-runner/src/core/turnGateController.mjs
    :188 createYellowSafetyNet HIGH
           7 cyclomatic    5 cognitive   14 lines
          56.0 CRAP
  Scripts/functionBank.js
    :267 appendTraitHookTrace HIGH
           7 cyclomatic    6 cognitive   13 lines
          56.0 CRAP
    :1556 GrantHeroSkillPoints HIGH
           7 cyclomatic    6 cognitive   23 lines
          56.0 CRAP
    :1693 results HIGH
           7 cyclomatic    6 cognitive   13 lines
          56.0 CRAP
    :1781 normalizeSkillProcId HIGH
           7 cyclomatic    4 cognitive    6 lines
          56.0 CRAP
    :1802 IsHeroSessionSkillActive HIGH
           7 cyclomatic    4 cognitive   11 lines
          56.0 CRAP
    :2793 getTreasureHunterLevel HIGH
           7 cyclomatic    1 cognitive    4 lines
          56.0 CRAP
    :3194 syncInitiativeMeters HIGH
           7 cyclomatic    8 cognitive   19 lines
          56.0 CRAP
    :3974 ApplyScaledCrit HIGH
           7 cyclomatic    6 cognitive   30 lines
          56.0 CRAP
    :5450 createEnemyDebuffSlotDecision HIGH
           7 cyclomatic    7 cognitive   43 lines
          56.0 CRAP
    :6743 GetChainMultiplier HIGH
           7 cyclomatic    6 cognitive    9 lines
          56.0 CRAP
    :6857 gemActionIntentMetaFallback HIGH
           7 cyclomatic    6 cognitive    9 lines
          56.0 CRAP
    :8100 resolveEnemyBoardLineFallbackSkill HIGH
           7 cyclomatic    4 cognitive    6 lines
          56.0 CRAP
    :8126 normalizeEnemyBoardLineSkillDecision HIGH
           7 cyclomatic    4 cognitive   10 lines
          56.0 CRAP
  web-runner/src/core/powerAmpRules.mjs
    :13 normalizePowerAmpLifecycleMeta HIGH
           7 cyclomatic    6 cognitive   15 lines
          56.0 CRAP
  tools/audit_initiative_fairness.js
    :286 main HIGH
           7 cyclomatic    4 cognitive   85 lines
          56.0 CRAP
  src/core/roundPointerAdvanceRules.mjs
    :63 roundPointerAdvanceFromJs HIGH
           7 cyclomatic    7 cognitive   28 lines
          56.0 CRAP
  src/core/gameStateEnvelopeRules.mjs
    :33 compactObject HIGH
           7 cyclomatic   11 cognitive   12 lines
          56.0 CRAP
    :147 normalizeGem HIGH
           7 cyclomatic    4 cognitive    9 lines
          56.0 CRAP
  tests/enemyLineAxisContract.test.js
    :10 extractFunctionSource HIGH
           7 cyclomatic   11 cognitive   21 lines
          56.0 CRAP
  web-runner/src/core/idleAutoplayPriority.mjs
    :70 resolveIdleAutoplayPartyHpRatio HIGH
           7 cyclomatic    4 cognitive   20 lines
          56.0 CRAP
  src/core/turnPhaseAssignmentRules.mjs
    :58 turnPhaseFromJs HIGH
           7 cyclomatic    7 cognitive   13 lines
          56.0 CRAP
  tests/partyRegenTickFixtureContract.test.js
    :50 jsPartyRegenLifecycle HIGH
           7 cyclomatic    6 cognitive   13 lines
          56.0 CRAP
  Scripts/legacy but partially working/scripts/CombatLogic.js
    :128 <arrow> HIGH
           7 cyclomatic    6 cognitive   26 lines
          56.0 CRAP
  web-runner/app.js
    :293 hasPendingEnemyDeathResolution HIGH
           7 cyclomatic    8 cognitive   11 lines
          56.0 CRAP
    :389 getHitFlashTone HIGH
           7 cyclomatic    5 cognitive    7 lines
          56.0 CRAP
    :440 hasPersistentEnemyTaintedGroundOverlay HIGH
           7 cyclomatic    8 cognitive   12 lines
          56.0 CRAP
    :1342 hardRestartRuntimeFromDevTooling HIGH
           7 cyclomatic    6 cognitive   18 lines
          56.0 CRAP
    :1439 buildConfiguredCombatPartyMembers HIGH
           7 cyclomatic    7 cognitive   55 lines
          56.0 CRAP
    :1539 getSkillDraughtDevSummary HIGH
           7 cyclomatic    6 cognitive    7 lines
          56.0 CRAP
    :1547 populateDevToolSlotSelect HIGH
           7 cyclomatic    6 cognitive   23 lines
          56.0 CRAP
    :1571 syncDevToolingDomFromConfig HIGH
           7 cyclomatic    6 cognitive   22 lines
          56.0 CRAP
    :2073 <arrow> HIGH
           7 cyclomatic    6 cognitive    9 lines
          56.0 CRAP
    :2774 assertCombatLayoutDev HIGH
           7 cyclomatic    5 cognitive    9 lines
          56.0 CRAP
    :2836 fetchWithServerHints HIGH
           7 cyclomatic    3 cognitive    7 lines
          56.0 CRAP
    :2942 summaryText HIGH
           7 cyclomatic    7 cognitive    7 lines
          56.0 CRAP
    :3499 createGemBoard HIGH
           7 cyclomatic    7 cognitive   48 lines
          56.0 CRAP
    :3548 rebuildGridFromGems HIGH
           7 cyclomatic    7 cognitive   15 lines
          56.0 CRAP
    :3871 hasEmptySlots HIGH
           7 cyclomatic    9 cognitive    9 lines
          56.0 CRAP
    :3949 startGemMergeFx HIGH
           7 cyclomatic    6 cognitive   28 lines
          56.0 CRAP
    :5268 findAssetInstance HIGH
           7 cyclomatic   10 cognitive   10 lines
          56.0 CRAP
    :6336 playIdleAutoplayTriplet HIGH
           7 cyclomatic    7 cognitive    9 lines
          56.0 CRAP
  tests/kojonnPowerAmpSingleContract.test.js
    :10 extractFunctionSource HIGH
           7 cyclomatic   11 cognitive   21 lines
          56.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :2170 <arrow> HIGH
           7 cyclomatic    2 cognitive    6 lines
          56.0 CRAP
  web-runner/src/core/heroTurnEntryRules.mjs
    :67 resolveHeroTurnEntry HIGH
           7 cyclomatic    7 cognitive   44 lines
          56.0 CRAP
  tests/turnOrderGroupFixtureContract.test.js
    :63 <arrow> HIGH
           7 cyclomatic    6 cognitive   13 lines
          56.0 CRAP
    :84 members HIGH
           7 cyclomatic    6 cognitive   13 lines
          56.0 CRAP
  tests/enemyLineClearRefillContract.test.js
    :11 extractFunctionSource HIGH
           7 cyclomatic   11 cognitive   21 lines
          56.0 CRAP
  web-runner/systems/renderHUD.js
    :22 drawWalletHUD HIGH
           7 cyclomatic    3 cognitive   11 lines
          56.0 CRAP
  web-runner/src/core/turnActorEligibilityRules.mjs
    :116 resolveTurnActorEligibility HIGH
           7 cyclomatic    6 cognitive   45 lines
          56.0 CRAP
  src/core/effectiveStatRules.mjs
    :89 resolveEffectiveStat HIGH
           7 cyclomatic    6 cognitive   30 lines
          56.0 CRAP
  web-runner/src/core/gsapShim.mjs
    :140 applyVars HIGH
           7 cyclomatic    9 cognitive   11 lines
          56.0 CRAP
    :161 resolveTweenValue HIGH
           7 cyclomatic    6 cognitive    9 lines
          56.0 CRAP
    :197 applyTweenState HIGH
           7 cyclomatic    9 cognitive   13 lines
          56.0 CRAP
    :455 killTweensOf HIGH
           7 cyclomatic   10 cognitive   11 lines
          56.0 CRAP
  src/core/combatRuntimeGateway.js
    :64 constructor HIGH
           7 cyclomatic    6 cognitive   17 lines
          56.0 CRAP
    :129 getAuthoritativeTurnState HIGH
           7 cyclomatic    4 cognitive   14 lines
          56.0 CRAP
  src/core/turnGateController.mjs
    :188 createYellowSafetyNet HIGH
           7 cyclomatic    5 cognitive   14 lines
          56.0 CRAP
  web-runner/systems/inputHandling.js
    :29 handleMapPointerMove HIGH
           7 cyclomatic    6 cognitive   21 lines
          56.0 CRAP
  tests/combatSnapshotGateFixtureContract.test.js
    :10 parseCsvLine HIGH
           7 cyclomatic   11 cognitive   23 lines
          56.0 CRAP
  src/core/powerAmpRules.mjs
    :13 normalizePowerAmpLifecycleMeta HIGH
           7 cyclomatic    6 cognitive   15 lines
          56.0 CRAP
  web-runner/src/core/idleFarmRuntime.mjs
    :8 createEnemy HIGH
           7 cyclomatic    5 cognitive   17 lines
          56.0 CRAP
    :191 ensureIdleFarmSessionState HIGH
           7 cyclomatic    6 cognitive   13 lines
          56.0 CRAP
    :451 claimIdleFarmRewardsFromState HIGH
           7 cyclomatic    7 cognitive   14 lines
          56.0 CRAP
  web-runner/src/core/enemySkillChoiceRules.mjs
    :151 chimerilassHealChoice HIGH
           7 cyclomatic    7 cognitive   28 lines
          56.0 CRAP
  web-runner/src/core/gemActionRules.mjs
    :62 gemActionIntentMeta HIGH
           7 cyclomatic    6 cognitive   10 lines
          56.0 CRAP
  web-runner/src/core/schedulerRules.mjs
    :15 buildFixedCycleSlots HIGH
           7 cyclomatic    5 cognitive   20 lines
          56.0 CRAP
  web-runner/src/core/statusEffectRules.mjs
    :450 mapOwnerResult HIGH
           7 cyclomatic    2 cognitive    9 lines
          56.0 CRAP
  web-runner/src/core/enemyJobSkillRules.mjs
    :95 enemyJobSkillNormalizedCode
           6 cyclomatic    5 cognitive   21 lines
          42.0 CRAP
  web-runner/modules/functionBank.js
    :166 random01
           6 cyclomatic    4 cognitive    8 lines
          42.0 CRAP
    :311 RegisterTraitHook
           6 cyclomatic    5 cognitive   11 lines
          42.0 CRAP
    :447 isPowerAmpLifecycleDebugEnabled
           6 cyclomatic    6 cognitive    4 lines
          42.0 CRAP
    :591 consumePowerAmpForEvent
           6 cyclomatic    4 cognitive   12 lines
          42.0 CRAP
    :740 FinalizePowerAmpVisualClear
           6 cyclomatic    6 cognitive   11 lines
          42.0 CRAP
    :938 <arrow>
           6 cyclomatic    6 cognitive   13 lines
          42.0 CRAP
    :1005 buildSkillDraughtCandidates
           6 cyclomatic    6 cognitive   14 lines
          42.0 CRAP
    :1693 results
           6 cyclomatic    5 cognitive   12 lines
          42.0 CRAP
    :1728 SetHeroSkillPointsForParty
           6 cyclomatic    5 cognitive   36 lines
          42.0 CRAP
    :1831 appendSkillProcTrace
           6 cyclomatic    5 cognitive   13 lines
          42.0 CRAP
    :2210 GetSessionPassiveTotal
           6 cyclomatic    4 cognitive    6 lines
          42.0 CRAP
    :2414 createHeroGemMilestoneRecord
           6 cyclomatic    6 cognitive   12 lines
          42.0 CRAP
    :2427 extractHeroGemMilestoneTotals
           6 cyclomatic    5 cognitive   10 lines
          42.0 CRAP
    :2537 resolveGemUsageColorKey
           6 cyclomatic    5 cognitive    8 lines
          42.0 CRAP
    :2654 GetHeroGemProgressSnapshot
           6 cyclomatic    6 cognitive   23 lines
          42.0 CRAP
    :3179 nextQueue
           6 cyclomatic    3 cognitive    1 lines
          42.0 CRAP
    :3253 syncInitiativeSessionState
           6 cyclomatic    5 cognitive   15 lines
          42.0 CRAP
    :3296 getInitiativeOverridePool
           6 cyclomatic    5 cognitive   21 lines
          42.0 CRAP
    :4740 applyPartyTempHPShieldAbsorptionResult
           6 cyclomatic    5 cognitive   17 lines
          42.0 CRAP
    :5084 SyncPartyHPToHeroes
           6 cyclomatic    5 cognitive   13 lines
          42.0 CRAP
    :5170 GrantPurpleSuperGemEnergy
           6 cyclomatic    4 cognitive   25 lines
          42.0 CRAP
    :5196 AddGoldToPlayer
           6 cyclomatic    6 cognitive   19 lines
          42.0 CRAP
    :5734 collectPartyDamageOwnerSnapshot
           6 cyclomatic    5 cognitive   21 lines
          42.0 CRAP
    :5957 getTaintedGroundSlotIndex
           6 cyclomatic    5 cognitive    8 lines
          42.0 CRAP
    :7025 enemyJobSkillKindCode
           6 cyclomatic    5 cognitive    8 lines
          42.0 CRAP
  tests/skillDraughtDevPanelContract.test.js
    :12 extractFunctionSource
           6 cyclomatic    9 cognitive   19 lines
          42.0 CRAP
  web-runner/systems/renderIdleFarm.js
    :67 getLaneAction
           6 cyclomatic    5 cognitive    8 lines
          42.0 CRAP
    :78 computeLungeOffset
           6 cyclomatic    5 cognitive   13 lines
          42.0 CRAP
  Scripts/entities.js
    :65 updateAllEntities
           6 cyclomatic   10 cognitive   16 lines
          42.0 CRAP
  tools/playwright_doctor.js
    :170 directLaunchBlocked
           6 cyclomatic    1 cognitive    5 lines
          42.0 CRAP
  src/core/heroTurnEntryRules.mjs
    :16 shouldResetAstralFlowAmp
           6 cyclomatic    5 cognitive   14 lines
          42.0 CRAP
  web-runner/src/core/enemyTurnFlowRules.mjs
    :22 enemyTurnFlowFromJs
           6 cyclomatic    4 cognitive   19 lines
          42.0 CRAP
    :56 resolveEnemyTurnFlow
           6 cyclomatic    6 cognitive   34 lines
          42.0 CRAP
  tests/falieRedSuperGemBufferShieldContract.test.js
    :267 <arrow>
           6 cyclomatic    5 cognitive   14 lines
          42.0 CRAP
  tests/singleHitResolutionFixtureContract.test.js
    :61 computeSingleHitDamage
           6 cyclomatic    5 cognitive   19 lines
          42.0 CRAP
  web-runner/src/core/gameStateEnvelopeRules.mjs
    :157 normalizeBoard
           6 cyclomatic    6 cognitive   14 lines
          42.0 CRAP
  src/core/gameStateEnvelopeRules.cjs
    :157 normalizeBoard
           6 cyclomatic    6 cognitive   14 lines
          42.0 CRAP
  web-runner/systems/heroGemProgressStorage.js
    :11 readPersistedHeroGemProgress
           6 cyclomatic    5 cognitive   11 lines
          42.0 CRAP
  web-runner/src/core/turnPhaseAssignmentRules.mjs
    :52 turnPhaseAssignmentResultFromPhase
           6 cyclomatic    5 cognitive    5 lines
          42.0 CRAP
  tests/skillProcRuntimeContract.test.js
    :10 extractFunctionSource
           6 cyclomatic    9 cognitive   19 lines
          42.0 CRAP
  src/core/schedulerRules.mjs
    :25 <arrow>
           6 cyclomatic    7 cognitive    5 lines
          42.0 CRAP
    :120 sortByBattleStartInit
           6 cyclomatic    2 cognitive    2 lines
          42.0 CRAP
  tests/kojonnSuperGemBlightContract.test.js
    :28 callFunctionWithContext
           6 cyclomatic    6 cognitive   13 lines
          42.0 CRAP
  web-runner/systems/appShellViewport.js
    :19 computeContainedStageSize
           6 cyclomatic    5 cognitive   17 lines
          42.0 CRAP
  src/core/statusEffectRules.mjs
    :364 mapOwnerResult
           6 cyclomatic    1 cognitive    6 lines
          42.0 CRAP
    :405 mapOwnerResult
           6 cyclomatic    1 cognitive    6 lines
          42.0 CRAP
  src/core/enemyJobSkillRules.mjs
    :95 enemyJobSkillNormalizedCode
           6 cyclomatic    5 cognitive   21 lines
          42.0 CRAP
  tools/qa_huun_yellow_supergem_browser.mjs
    :38 <arrow>
           6 cyclomatic    5 cognitive   57 lines
          42.0 CRAP
  src/core/combatRuntimeGateway.cjs
    :36 parseResumeToken
           6 cyclomatic    4 cognitive   16 lines
          42.0 CRAP
    :159 isInAtomicSection
           6 cyclomatic    4 cognitive   14 lines
          42.0 CRAP
  tools/playwright_launch_matrix.js
    :55 stopChild
           6 cyclomatic    6 cognitive   12 lines
          42.0 CRAP
    :68 runSpawnProbe
           6 cyclomatic    7 cognitive   36 lines
          42.0 CRAP
  src/core/enemyTurnFlowRules.mjs
    :22 enemyTurnFlowFromJs
           6 cyclomatic    4 cognitive   19 lines
          42.0 CRAP
    :56 resolveEnemyTurnFlow
           6 cyclomatic    6 cognitive   34 lines
          42.0 CRAP
  web-runner/src/core/combatRuntimeGateway.js
    :36 parseResumeToken
           6 cyclomatic    4 cognitive   16 lines
          42.0 CRAP
    :159 isInAtomicSection
           6 cyclomatic    4 cognitive   14 lines
          42.0 CRAP
  web-runner/src/core/enemyTargetingRules.mjs
    :26 readRandomUnit
           6 cyclomatic    4 cognitive    4 lines
          42.0 CRAP
    :70 hpRatio
           6 cyclomatic    2 cognitive    5 lines
          42.0 CRAP
  web-runner/src/core/turnGateController.mjs
    :162 createCombatTurnRefreshBaseline
           6 cyclomatic    4 cognitive   25 lines
          42.0 CRAP
  Scripts/legacy but partially working/scripts/EnemySpawner.js
    :8 constructor
           6 cyclomatic    5 cognitive   13 lines
          42.0 CRAP
    :70 spawnRandomWave
           6 cyclomatic    9 cognitive   28 lines
          42.0 CRAP
  Scripts/functionBank.js
    :165 random01
           6 cyclomatic    4 cognitive    8 lines
          42.0 CRAP
    :310 RegisterTraitHook
           6 cyclomatic    5 cognitive   11 lines
          42.0 CRAP
    :550 consumePowerAmpForEvent
           6 cyclomatic    4 cognitive   12 lines
          42.0 CRAP
    :697 FinalizePowerAmpVisualClear
           6 cyclomatic    6 cognitive   11 lines
          42.0 CRAP
    :895 <arrow>
           6 cyclomatic    6 cognitive   13 lines
          42.0 CRAP
    :962 buildSkillDraughtCandidates
           6 cyclomatic    6 cognitive   14 lines
          42.0 CRAP
    :1650 results
           6 cyclomatic    5 cognitive   12 lines
          42.0 CRAP
    :1685 SetHeroSkillPointsForParty
           6 cyclomatic    5 cognitive   36 lines
          42.0 CRAP
    :1788 appendSkillProcTrace
           6 cyclomatic    5 cognitive   13 lines
          42.0 CRAP
    :2167 GetSessionPassiveTotal
           6 cyclomatic    4 cognitive    6 lines
          42.0 CRAP
    :2371 createHeroGemMilestoneRecord
           6 cyclomatic    6 cognitive   12 lines
          42.0 CRAP
    :2384 extractHeroGemMilestoneTotals
           6 cyclomatic    5 cognitive   10 lines
          42.0 CRAP
    :2494 resolveGemUsageColorKey
           6 cyclomatic    5 cognitive    8 lines
          42.0 CRAP
    :2611 GetHeroGemProgressSnapshot
           6 cyclomatic    6 cognitive   23 lines
          42.0 CRAP
    :3178 syncInitiativeSessionState
           6 cyclomatic    5 cognitive   15 lines
          42.0 CRAP
    :3353 refreshInitiativePreview
           6 cyclomatic    5 cognitive   24 lines
          42.0 CRAP
    :4731 applyPartyTempHPShieldAbsorptionResult
           6 cyclomatic    5 cognitive   17 lines
          42.0 CRAP
    :5075 SyncPartyHPToHeroes
           6 cyclomatic    5 cognitive   13 lines
          42.0 CRAP
    :5161 GrantPurpleSuperGemEnergy
           6 cyclomatic    4 cognitive   25 lines
          42.0 CRAP
    :5187 AddGoldToPlayer
           6 cyclomatic    6 cognitive   19 lines
          42.0 CRAP
    :5725 collectPartyDamageOwnerSnapshot
           6 cyclomatic    5 cognitive   21 lines
          42.0 CRAP
    :5941 getTaintedGroundSlotIndex
           6 cyclomatic    5 cognitive    8 lines
          42.0 CRAP
    :7006 enemyJobSkillKindCode
           6 cyclomatic    5 cognitive    8 lines
          42.0 CRAP
  web-runner/gameLogic.js
    :34 handleKeyInput
           6 cyclomatic    5 cognitive    7 lines
          42.0 CRAP
  web-runner/src/core/powerAmpRules.mjs
    :158 derivePowerAmpFadeState
           6 cyclomatic    5 cognitive   25 lines
          42.0 CRAP
  tests/huunYellowSuperGemGoldstrikeContract.test.js
    :32 callFunctionWithContext
           6 cyclomatic    5 cognitive    8 lines
          42.0 CRAP
    :96 callFunctionWithContext
           6 cyclomatic    5 cognitive    8 lines
          42.0 CRAP
  src/core/gameStateEnvelopeRules.mjs
    :157 normalizeBoard
           6 cyclomatic    6 cognitive   14 lines
          42.0 CRAP
  tests/partyDamageAccountingContract.test.js
    :105 runSingleTargetAccountingPasses
           6 cyclomatic    5 cognitive   41 lines
          42.0 CRAP
  web-runner/src/core/damageNumberAnimation.mjs
    :14 ensureDamageTextFontReady
           6 cyclomatic    4 cognitive   18 lines
          42.0 CRAP
  web-runner/systems/renderHeroScreen.js
    :4 heroSkillSpriteFocusCanvas
           6 cyclomatic    7 cognitive   16 lines
          42.0 CRAP
  src/core/turnPhaseAssignmentRules.mjs
    :52 turnPhaseAssignmentResultFromPhase
           6 cyclomatic    5 cognitive    5 lines
          42.0 CRAP
  tests/enemyDotTickFixtureContract.test.js
    :23 jsDotTick
           6 cyclomatic    7 cognitive   21 lines
          42.0 CRAP
  web-runner/app.js
    :163 BOOTSTRAP_SEED
           6 cyclomatic    5 cognitive   11 lines
          42.0 CRAP
    :674 canTransitionTo
           6 cyclomatic    4 cognitive   10 lines
          42.0 CRAP
    :1449 heroMembers
           6 cyclomatic    5 cognitive   20 lines
          42.0 CRAP
    :1509 applyBoardGemColor
           6 cyclomatic    6 cognitive   13 lines
          42.0 CRAP
    :1865 <arrow>
           6 cyclomatic    2 cognitive    6 lines
          42.0 CRAP
    :2011 toggleDevToolingModal
           6 cyclomatic    5 cognitive   17 lines
          42.0 CRAP
    :2119 getAuthoritativeTurnState
           6 cyclomatic    5 cognitive    8 lines
          42.0 CRAP
    :2635 requestMapLocaleLayout
           6 cyclomatic    5 cognitive    8 lines
          42.0 CRAP
    :2743 restorePartyToFullHP
           6 cyclomatic    5 cognitive   12 lines
          42.0 CRAP
    :3159 deriveEncounterPoolNames
           6 cyclomatic    4 cognitive   16 lines
          42.0 CRAP
    :3564 randomGemFrame
           6 cyclomatic    4 cognitive   29 lines
          42.0 CRAP
    :4072 <arrow>
           6 cyclomatic    5 cognitive    7 lines
          42.0 CRAP
    :4448 loadSpriteTypeImage
           6 cyclomatic    6 cognitive   24 lines
          42.0 CRAP
    :4871 onEnter
           6 cyclomatic    6 cognitive    9 lines
          42.0 CRAP
    :6145 waitForRefillReady
           6 cyclomatic    4 cognitive   15 lines
          42.0 CRAP
  web-runner/src/core/superGemBoardState.mjs
    :32 <arrow>
           6 cyclomatic    3 cognitive    5 lines
          42.0 CRAP
  web-runner/systems/superGemRuntime.js
    :16 randomIntInclusive
           6 cyclomatic    5 cognitive   10 lines
          42.0 CRAP
    :311 getEnemySlotIndex
           6 cyclomatic    5 cognitive    8 lines
          42.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :372 hasSeededRngExports
           6 cyclomatic    1 cognitive    5 lines
          42.0 CRAP
    :378 hasSingleHitExports
           6 cyclomatic    1 cognitive    5 lines
          42.0 CRAP
    :430 hasEnemyDebuffDecayExports
           6 cyclomatic    1 cognitive    5 lines
          42.0 CRAP
    :436 hasEnemyDebuffApplyExports
           6 cyclomatic    1 cognitive    5 lines
          42.0 CRAP
    :442 hasEnemyDebuffSlotExports
           6 cyclomatic    1 cognitive    5 lines
          42.0 CRAP
    :456 hasCombatSnapshotExports
           6 cyclomatic    1 cognitive    5 lines
          42.0 CRAP
    :511 hasEnemyTargetExports
           6 cyclomatic    1 cognitive    5 lines
          42.0 CRAP
    :522 hasTurnOrderGroupExports
           6 cyclomatic    1 cognitive    5 lines
          42.0 CRAP
  web-runner/src/core/heroTurnEntryRules.mjs
    :16 shouldResetAstralFlowAmp
           6 cyclomatic    5 cognitive   14 lines
          42.0 CRAP
  tools/playwright_support.js
    :27 readBool
           6 cyclomatic    5 cognitive    8 lines
          42.0 CRAP
    :47 <arrow>
           6 cyclomatic    4 cognitive   11 lines
          42.0 CRAP
    :94 getErrorText
           6 cyclomatic    1 cognitive    3 lines
          42.0 CRAP
  tests/enemyDebuffSlotTransitionFixtureContract.test.js
    :43 jsSlotTransition
           6 cyclomatic    6 cognitive   20 lines
          42.0 CRAP
  src/core/combatRuntimeGateway.js
    :114 isInAtomicSection
           6 cyclomatic    4 cognitive   14 lines
          42.0 CRAP
    :144 applyAuthoritativeTurnState
           6 cyclomatic    4 cognitive   13 lines
          42.0 CRAP
  src/core/enemyTargetingRules.mjs
    :26 readRandomUnit
           6 cyclomatic    4 cognitive    4 lines
          42.0 CRAP
    :70 hpRatio
           6 cyclomatic    2 cognitive    5 lines
          42.0 CRAP
  src/core/turnGateController.mjs
    :162 createCombatTurnRefreshBaseline
           6 cyclomatic    4 cognitive   25 lines
          42.0 CRAP
  src/core/powerAmpRules.mjs
    :158 derivePowerAmpFadeState
           6 cyclomatic    5 cognitive   25 lines
          42.0 CRAP
  web-runner/systems/renderChests.js
    :38 <arrow>
           6 cyclomatic    4 cognitive    8 lines
          42.0 CRAP
  web-runner/src/core/idleFarmRuntime.mjs
    :31 <arrow>
           6 cyclomatic    3 cognitive   12 lines
          42.0 CRAP
    :181 pickIdleEmissionMonster
           6 cyclomatic    4 cognitive    9 lines
          42.0 CRAP
    :261 restartIdleFarmSessionState
           6 cyclomatic    5 cognitive   11 lines
          42.0 CRAP
    :295 getCandidateForLane
           6 cyclomatic    4 cognitive   10 lines
          42.0 CRAP
  web-runner/src/core/schedulerRules.mjs
    :25 <arrow>
           6 cyclomatic    7 cognitive    5 lines
          42.0 CRAP
    :120 sortByBattleStartInit
           6 cyclomatic    2 cognitive    2 lines
          42.0 CRAP
  web-runner/src/core/statusEffectRules.mjs
    :364 mapOwnerResult
           6 cyclomatic    1 cognitive    6 lines
          42.0 CRAP
    :405 mapOwnerResult
           6 cyclomatic    1 cognitive    6 lines
          42.0 CRAP
  web-runner/src/core/enemyJobSkillRules.mjs
    :57 normalizeKindCode
           5 cyclomatic    3 cognitive    9 lines
          30.0 CRAP
  web-runner/src/core/partyFormationRules.mjs
    :5 assignHeroToPartySlot
           5 cyclomatic    4 cognitive   15 lines
          30.0 CRAP
  web-runner/modules/functionBank.js
    :255 ensureTraitRuntime
           5 cyclomatic    4 cognitive    7 lines
          30.0 CRAP
    :372 GetEnemyRosterStability
           5 cyclomatic    4 cognitive   10 lines
          30.0 CRAP
    :401 ensurePowerAmpVisuals
           5 cyclomatic    4 cognitive    4 lines
          30.0 CRAP
    :514 setPowerAmpVisual
           5 cyclomatic    4 cognitive   13 lines
          30.0 CRAP
    :577 ArmPowerAmpFixed
           5 cyclomatic    4 cognitive   13 lines
          30.0 CRAP
    :622 traceEnemySkillDecision
           5 cyclomatic    4 cognitive   15 lines
          30.0 CRAP
    :696 GetPowerAmpMultiplierForActor
           5 cyclomatic    4 cognitive    8 lines
          30.0 CRAP
    :994 sampleSkillDraughtDefinitions
           5 cyclomatic    5 cognitive   10 lines
          30.0 CRAP
    :1173 GetSkillDraughtState
           5 cyclomatic    4 cognitive   10 lines
          30.0 CRAP
    :1474 ensureHeroSkillProgressStore
           5 cyclomatic    4 cognitive    9 lines
          30.0 CRAP
    :1851 <arrow>
           5 cyclomatic    3 cognitive    4 lines
          30.0 CRAP
    :1863 <arrow>
           5 cyclomatic    3 cognitive    4 lines
          30.0 CRAP
    :2109 hasDestiny
           5 cyclomatic    3 cognitive    2 lines
          30.0 CRAP
    :2329 ensureAstralFlowAmpState
           5 cyclomatic    4 cognitive    7 lines
          30.0 CRAP
    :2387 sanitizeHeroGemMilestoneThresholds
           5 cyclomatic    5 cognitive    9 lines
          30.0 CRAP
    :2754 getActiveEventByToken
           5 cyclomatic    3 cognitive    5 lines
          30.0 CRAP
    :2774 pickDropTier
           5 cyclomatic    5 cognitive   12 lines
          30.0 CRAP
    :2848 getDropRate
           5 cyclomatic    4 cognitive   14 lines
          30.0 CRAP
    :2957 <arrow>
           5 cyclomatic    4 cognitive    5 lines
          30.0 CRAP
    :3035 SlotX
           5 cyclomatic    4 cognitive   10 lines
          30.0 CRAP
    :3154 schedulerClampIndex
           5 cyclomatic    5 cognitive    1 lines
          30.0 CRAP
    :3192 rosterByUID
           5 cyclomatic    4 cognitive    1 lines
          30.0 CRAP
    :3289 buildInitiativePreview
           5 cyclomatic    3 cognitive    6 lines
          30.0 CRAP
    :3628 <arrow>
           5 cyclomatic    3 cognitive    4 lines
          30.0 CRAP
    :3742 RemoveActorExtraTurnSkill
           5 cyclomatic    4 cognitive   11 lines
          30.0 CRAP
    :3978 GetBaseStat
           5 cyclomatic    2 cognitive    4 lines
          30.0 CRAP
    :5131 Add_Energy
           5 cyclomatic    5 cognitive   12 lines
          30.0 CRAP
    :6337 commanders
           5 cyclomatic    1 cognitive    1 lines
          30.0 CRAP
    :6355 getCP
           5 cyclomatic    1 cognitive    1 lines
          30.0 CRAP
    :6645 ResolveMonsterDrop
           5 cyclomatic    4 cognitive    7 lines
          30.0 CRAP
    :6656 resolveHuunExecutionDropBonusLevel
           5 cyclomatic    4 cognitive    6 lines
          30.0 CRAP
    :6772 ApplyChain
           5 cyclomatic    5 cognitive   11 lines
          30.0 CRAP
    :8019 orderLine
           5 cyclomatic    4 cognitive    6 lines
          30.0 CRAP
  tools/serve_web.js
    :134 <arrow>
           5 cyclomatic    4 cognitive    8 lines
          30.0 CRAP
  Scripts/entities.js
    :17 ensureEntityUpdateDiagnostics
           5 cyclomatic    4 cognitive    8 lines
          30.0 CRAP
  src/core/simulationCorePacket.cjs
    :49 normalizeSimulationContext
           5 cyclomatic    5 cognitive    9 lines
          30.0 CRAP
  src/core/heroTurnEntryRules.mjs
    :31 heroTurnEntryFromJs
           5 cyclomatic    4 cognitive   17 lines
          30.0 CRAP
  tests/partyDestinyContract.test.js
    :93 callFunction
           5 cyclomatic    4 cognitive    7 lines
          30.0 CRAP
  web-runner/src/core/turnSummaryRules.mjs
    :120 turnSummaryResultFromSnapshot
           5 cyclomatic    4 cognitive    5 lines
          30.0 CRAP
  src/core/layoutState.js
    :56 constructor
           5 cyclomatic    4 cognitive   11 lines
          30.0 CRAP
  tests/singleHitResolutionFixtureContract.test.js
    :48 applyScaledCrit
           5 cyclomatic    4 cognitive   12 lines
          30.0 CRAP
  tests/enemyRefillTurnGateContract.test.js
    :315 callFunctionWithContext
           5 cyclomatic    4 cognitive    7 lines
          30.0 CRAP
  web-runner/src/core/healBloomAnimation.mjs
    :7 createHealBloom
           5 cyclomatic    4 cognitive   75 lines
          30.0 CRAP
  src/core/turnActorEligibilityRules.mjs
    :106 turnActorEligibilityReasonFromCode
           5 cyclomatic    4 cognitive    5 lines
          30.0 CRAP
  Scripts/logicCore.js
    :13 startGameLoop
           5 cyclomatic    6 cognitive   29 lines
          30.0 CRAP
    :43 stopGameLoop
           5 cyclomatic    3 cognitive   12 lines
          30.0 CRAP
  tests/encounterCpOverrideDistribution.test.js
    :79 <arrow>
           5 cyclomatic    5 cognitive   61 lines
          30.0 CRAP
  web-runner/src/core/roundPointerAdvanceRules.mjs
    :57 roundPointerAdvanceResultFromCode
           5 cyclomatic    4 cognitive    5 lines
          30.0 CRAP
  tests/blueAstralWalletContract.test.js
    :55 callFunctionWithContext
           5 cyclomatic    4 cognitive   13 lines
          30.0 CRAP
  web-runner/src/core/turnOrderGroupRules.mjs
    :141 <arrow>
           5 cyclomatic    0 cognitive    6 lines
          30.0 CRAP
  src/core/enemyRosterStability.mjs
    :10 isLiveEnemy
           5 cyclomatic    4 cognitive    5 lines
          30.0 CRAP
  tests/heroSkillDefinitionRegistryContract.test.js
    :10 extractFunctionSource
           5 cyclomatic    8 cognitive   17 lines
          30.0 CRAP
  web-runner/systems/heroGemProgressStorage.js
    :23 writePersistedHeroGemProgress
           5 cyclomatic    3 cognitive    9 lines
          30.0 CRAP
  src/core/runaMagicResistRules.mjs
    :173 normalizeRunaMagicResistInput
           5 cyclomatic    4 cognitive   32 lines
          30.0 CRAP
  tests/combatPowerFormulaFixtureContract.test.js
    :11 extractFunctionSource
           5 cyclomatic    8 cognitive   17 lines
          30.0 CRAP
  tools/balance_harness.js
    :30 parseArgs
           5 cyclomatic    7 cognitive   16 lines
          30.0 CRAP
    :224 stopServer
           5 cyclomatic    3 cognitive    9 lines
          30.0 CRAP
    :575 close
           5 cyclomatic    5 cognitive   13 lines
          30.0 CRAP
  web-runner/systems/renderOverlays.js
    :1 drawStartupLoadingFrame
           5 cyclomatic    4 cognitive   67 lines
          30.0 CRAP
  Scripts/legacy but partially working/scripts/Function_Bank.js
    :110 GetActorByUID
           5 cyclomatic    6 cognitive    9 lines
          30.0 CRAP
    :146 CalculateDamage
           5 cyclomatic    5 cognitive   24 lines
          30.0 CRAP
  src/core/schedulerRules.mjs
    :52 <arrow>
           5 cyclomatic    1 cognitive    7 lines
          30.0 CRAP
    :93 rosterByUID
           5 cyclomatic    2 cognitive    1 lines
          30.0 CRAP
    :118 deriveBattleStartRoundPartition
           5 cyclomatic    4 cognitive   12 lines
          30.0 CRAP
  src/core/statusEffectRules.mjs
    :149 normalizeEnemyDotPacketInput
           5 cyclomatic    4 cognitive   27 lines
          30.0 CRAP
    :323 mapOwnerResult
           5 cyclomatic    2 cognitive    4 lines
          30.0 CRAP
    :492 mapOwnerResult
           5 cyclomatic    2 cognitive    4 lines
          30.0 CRAP
  src/core/enemyJobSkillRules.mjs
    :57 normalizeKindCode
           5 cyclomatic    3 cognitive    9 lines
          30.0 CRAP
  src/core/partyFormationRules.mjs
    :5 assignHeroToPartySlot
           5 cyclomatic    4 cognitive   15 lines
          30.0 CRAP
  tools/qa_huun_yellow_supergem_browser.mjs
    :113 <arrow>
           5 cyclomatic    4 cognitive   28 lines
          30.0 CRAP
    :180 <arrow>
           5 cyclomatic    1 cognitive    1 lines
          30.0 CRAP
  src/core/combatRuntimeGateway.cjs
    :26 hasValidCurrentIndex
           5 cyclomatic    3 cognitive    5 lines
          30.0 CRAP
    :67 getGlobalCombatSnapshotOwner
           5 cyclomatic    4 cognitive   10 lines
          30.0 CRAP
    :136 runCombatStep
           5 cyclomatic    4 cognitive   10 lines
          30.0 CRAP
    :196 getDeterministicRngState
           5 cyclomatic    4 cognitive    6 lines
          30.0 CRAP
  web-runner/src/core/effectiveStatRules.mjs
    :49 effectiveStatFromJs
           5 cyclomatic    4 cognitive   15 lines
          30.0 CRAP
  src/core/turnSummaryRules.mjs
    :120 turnSummaryResultFromSnapshot
           5 cyclomatic    4 cognitive    5 lines
          30.0 CRAP
  web-runner/src/core/combatRuntimeGateway.js
    :26 hasValidCurrentIndex
           5 cyclomatic    3 cognitive    5 lines
          30.0 CRAP
    :67 getGlobalCombatSnapshotOwner
           5 cyclomatic    4 cognitive   10 lines
          30.0 CRAP
    :136 runCombatStep
           5 cyclomatic    4 cognitive   10 lines
          30.0 CRAP
    :196 getDeterministicRngState
           5 cyclomatic    4 cognitive    6 lines
          30.0 CRAP
  web-runner/src/core/enemyTargetingRules.mjs
    :31 randomIndexFromUnit
           5 cyclomatic    3 cognitive    5 lines
          30.0 CRAP
    :76 statValue
           5 cyclomatic    1 cognitive    3 lines
          30.0 CRAP
    :88 <arrow>
           5 cyclomatic    2 cognitive    1 lines
          30.0 CRAP
  web-runner/src/core/turnGateController.mjs
    :294 createEnemyTurnIdleRecovery
           5 cyclomatic    3 cognitive   18 lines
          30.0 CRAP
  Scripts/legacy but partially working/scripts/EnemySpawner.js
    :29 spawnEnemy
           5 cyclomatic    4 cognitive   33 lines
          30.0 CRAP
  Scripts/functionBank.js
    :254 ensureTraitRuntime
           5 cyclomatic    4 cognitive    7 lines
          30.0 CRAP
    :371 GetEnemyRosterStability
           5 cyclomatic    4 cognitive   10 lines
          30.0 CRAP
    :400 ensurePowerAmpVisuals
           5 cyclomatic    4 cognitive    4 lines
          30.0 CRAP
    :489 setPowerAmpVisual
           5 cyclomatic    4 cognitive   11 lines
          30.0 CRAP
    :581 traceEnemySkillDecision
           5 cyclomatic    4 cognitive   15 lines
          30.0 CRAP
    :655 GetPowerAmpMultiplierForActor
           5 cyclomatic    4 cognitive    8 lines
          30.0 CRAP
    :951 sampleSkillDraughtDefinitions
           5 cyclomatic    5 cognitive   10 lines
          30.0 CRAP
    :1130 GetSkillDraughtState
           5 cyclomatic    4 cognitive   10 lines
          30.0 CRAP
    :1431 ensureHeroSkillProgressStore
           5 cyclomatic    4 cognitive    9 lines
          30.0 CRAP
    :1808 <arrow>
           5 cyclomatic    3 cognitive    4 lines
          30.0 CRAP
    :1820 <arrow>
           5 cyclomatic    3 cognitive    4 lines
          30.0 CRAP
    :2066 hasDestiny
           5 cyclomatic    3 cognitive    2 lines
          30.0 CRAP
    :2286 ensureAstralFlowAmpState
           5 cyclomatic    4 cognitive    7 lines
          30.0 CRAP
    :2344 sanitizeHeroGemMilestoneThresholds
           5 cyclomatic    5 cognitive    9 lines
          30.0 CRAP
    :2711 getActiveEventByToken
           5 cyclomatic    3 cognitive    5 lines
          30.0 CRAP
    :2731 pickDropTier
           5 cyclomatic    5 cognitive   12 lines
          30.0 CRAP
    :2805 getDropRate
           5 cyclomatic    4 cognitive   14 lines
          30.0 CRAP
    :2914 <arrow>
           5 cyclomatic    4 cognitive    5 lines
          30.0 CRAP
    :2992 SlotX
           5 cyclomatic    4 cognitive   10 lines
          30.0 CRAP
    :3127 schedulerClampIndex
           5 cyclomatic    5 cognitive    6 lines
          30.0 CRAP
    :3171 schedulerApplyRemovalCompaction
           5 cyclomatic    4 cognitive    6 lines
          30.0 CRAP
    :3265 getInitiativeOverridePool
           5 cyclomatic    4 cognitive   19 lines
          30.0 CRAP
    :3638 <arrow>
           5 cyclomatic    3 cognitive    4 lines
          30.0 CRAP
    :3733 RemoveActorExtraTurnSkill
           5 cyclomatic    4 cognitive   11 lines
          30.0 CRAP
    :3969 GetBaseStat
           5 cyclomatic    2 cognitive    4 lines
          30.0 CRAP
    :5122 Add_Energy
           5 cyclomatic    5 cognitive   12 lines
          30.0 CRAP
    :6321 commanders
           5 cyclomatic    1 cognitive    1 lines
          30.0 CRAP
    :6339 getCP
           5 cyclomatic    1 cognitive    1 lines
          30.0 CRAP
    :6626 ResolveMonsterDrop
           5 cyclomatic    4 cognitive    7 lines
          30.0 CRAP
    :6637 resolveHuunExecutionDropBonusLevel
           5 cyclomatic    4 cognitive    6 lines
          30.0 CRAP
    :6753 ApplyChain
           5 cyclomatic    5 cognitive   11 lines
          30.0 CRAP
    :8000 orderLine
           5 cyclomatic    4 cognitive    6 lines
          30.0 CRAP
  web-runner/src/core/powerAmpRules.mjs
    :29 createPowerAmpArmedEntry
           5 cyclomatic    4 cognitive   13 lines
          30.0 CRAP
  tools/audit_initiative_fairness.js
    :86 syncMeters
           5 cyclomatic    6 cognitive   11 lines
          30.0 CRAP
  web-runner/src/core/simulationCorePacket.js
    :49 normalizeSimulationContext
           5 cyclomatic    5 cognitive    9 lines
          30.0 CRAP
  src/core/roundPointerAdvanceRules.mjs
    :57 roundPointerAdvanceResultFromCode
           5 cyclomatic    4 cognitive    5 lines
          30.0 CRAP
  web-runner/src/core/damageNumberAnimation.mjs
    :33 isDamageTextFontReady
           5 cyclomatic    3 cognitive    7 lines
          30.0 CRAP
  tests/devToolingTurnIntegrityContract.test.js
    :10 extractFunctionSource
           5 cyclomatic    7 cognitive   14 lines
          30.0 CRAP
  web-runner/systems/animationMath.js
    :10 evaluateCubicBezier
           5 cyclomatic    5 cognitive   24 lines
          30.0 CRAP
  web-runner/src/core/idleAutoplayPriority.mjs
    :43 sumNumeric
           5 cyclomatic    5 cognitive   12 lines
          30.0 CRAP
    :56 pushTier
           5 cyclomatic    5 cognitive    9 lines
          30.0 CRAP
  src/core/turnOrderGroupRules.mjs
    :141 <arrow>
           5 cyclomatic    0 cognitive    6 lines
          30.0 CRAP
  web-runner/systems/renderHeroScreen.js
    :83 drawHeroSkillSpriteMasked
           5 cyclomatic    4 cognitive   12 lines
          30.0 CRAP
    :374 totalSpent
           5 cyclomatic    4 cognitive    8 lines
          30.0 CRAP
  web-runner/systems/renderEvolution.js
    :36 <arrow>
           5 cyclomatic    4 cognitive    3 lines
          30.0 CRAP
  web-runner/app.js
    :138 DEBUG_GEMS_QUERY
           5 cyclomatic    2 cognitive   13 lines
          30.0 CRAP
    :690 activateInitialLayout
           5 cyclomatic    4 cognitive   17 lines
          30.0 CRAP
    :1244 claimIdleFarmRewards
           5 cyclomatic    3 cognitive   11 lines
          30.0 CRAP
    :1317 readPersistedDevToolingConfig
           5 cyclomatic    4 cognitive   10 lines
          30.0 CRAP
    :1498 <arrow>
           5 cyclomatic    2 cognitive    1 lines
          30.0 CRAP
    :1876 fallbackHero
           5 cyclomatic    2 cognitive    1 lines
          30.0 CRAP
    :2036 isEditableDomTarget
           5 cyclomatic    2 cognitive    4 lines
          30.0 CRAP
    :2054 updateStartupLoadState
           5 cyclomatic    4 cognitive   16 lines
          30.0 CRAP
    :2327 <arrow>
           5 cyclomatic    2 cognitive    1 lines
          30.0 CRAP
    :2588 isPointInRect
           5 cyclomatic    2 cognitive    4 lines
          30.0 CRAP
    :2826 parseResponseJson
           5 cyclomatic    2 cognitive   10 lines
          30.0 CRAP
    :2993 normalizeEnemyRole
           5 cyclomatic    3 cognitive    5 lines
          30.0 CRAP
    :2999 normalizeFaction
           5 cyclomatic    3 cognitive    5 lines
          30.0 CRAP
    :3110 <arrow>
           5 cyclomatic    1 cognitive    1 lines
          30.0 CRAP
    :3132 getCP
           5 cyclomatic    1 cognitive    1 lines
          30.0 CRAP
    :3147 buildForcedEnemySpawnPlan
           5 cyclomatic    4 cognitive   11 lines
          30.0 CRAP
    :3202 getSeen
           5 cyclomatic    3 cognitive    1 lines
          30.0 CRAP
    :3212 ranked
           5 cyclomatic    1 cognitive    5 lines
          30.0 CRAP
    :3291 <arrow>
           5 cyclomatic    1 cognitive    1 lines
          30.0 CRAP
    :3420 row
           5 cyclomatic    1 cognitive    1 lines
          30.0 CRAP
    :3436 finalCP
           5 cyclomatic    1 cognitive    1 lines
          30.0 CRAP
    :3571 <arrow>
           5 cyclomatic    5 cognitive    4 lines
          30.0 CRAP
    :3761 <arrow>
           5 cyclomatic    3 cognitive    5 lines
          30.0 CRAP
    :3960 items
           5 cyclomatic    3 cognitive    5 lines
          30.0 CRAP
    :4412 <arrow>
           5 cyclomatic    1 cognitive    1 lines
          30.0 CRAP
    :5117 hpBarBottom
           5 cyclomatic    4 cognitive    6 lines
          30.0 CRAP
    :5131 layoutAnchorBottom
           5 cyclomatic    4 cognitive    6 lines
          30.0 CRAP
    :5174 onEnter
           5 cyclomatic    3 cognitive    5 lines
          30.0 CRAP
    :6264 getDevAutoplayState
           5 cyclomatic    4 cognitive   10 lines
          30.0 CRAP
    :7452 <arrow>
           5 cyclomatic    5 cognitive   16 lines
          30.0 CRAP
  web-runner/systems/superGemRuntime.js
    :9 getRuntimeRandom
           5 cyclomatic    3 cognitive    6 lines
          30.0 CRAP
    :68 splitDamageAcrossHits
           5 cyclomatic    2 cognitive   11 lines
          30.0 CRAP
    :206 getDefaultSingleTargetUID
           5 cyclomatic    2 cognitive    8 lines
          30.0 CRAP
    :446 coveredUIDs
           5 cyclomatic    2 cognitive    6 lines
          30.0 CRAP
    :672 enemy
           5 cyclomatic    2 cognitive    6 lines
          30.0 CRAP
  web-runner/systems/simulationCoreShadow.js
    :1230 combatSnapshotIndexFailureFromCode
           5 cyclomatic    2 cognitive   12 lines
          30.0 CRAP
  web-runner/src/core/heroTurnEntryRules.mjs
    :31 heroTurnEntryFromJs
           5 cyclomatic    4 cognitive   17 lines
          30.0 CRAP
  web-runner/systems/renderHUD.js
    :1 formatWalletText
           5 cyclomatic    4 cognitive   20 lines
          30.0 CRAP
  tools/playwright_support.js
    :6 parseArgs
           5 cyclomatic    7 cognitive   16 lines
          30.0 CRAP
  tests/functionBankParityContract.test.js
    :9 extractFunctionSource
           5 cyclomatic    8 cognitive   17 lines
          30.0 CRAP
  web-runner/src/core/turnActorEligibilityRules.mjs
    :106 turnActorEligibilityReasonFromCode
           5 cyclomatic    4 cognitive    5 lines
          30.0 CRAP
  src/core/effectiveStatRules.mjs
    :49 effectiveStatFromJs
           5 cyclomatic    4 cognitive   15 lines
          30.0 CRAP
  web-runner/src/core/gsapShim.mjs
    :444 fromTo
           5 cyclomatic    3 cognitive    8 lines
          30.0 CRAP
  src/core/combatRuntimeGateway.js
    :20 hasValidCurrentIndex
           5 cyclomatic    3 cognitive    5 lines
          30.0 CRAP
    :30 normalizeTurnState
           5 cyclomatic    3 cognitive   12 lines
          30.0 CRAP
    :91 runCombatStep
           5 cyclomatic    4 cognitive   10 lines
          30.0 CRAP
  web-runner/src/core/enemyRosterStability.mjs
    :10 isLiveEnemy
           5 cyclomatic    4 cognitive    5 lines
          30.0 CRAP
  src/core/enemyTargetingRules.mjs
    :31 randomIndexFromUnit
           5 cyclomatic    3 cognitive    5 lines
          30.0 CRAP
    :76 statValue
           5 cyclomatic    1 cognitive    3 lines
          30.0 CRAP
    :88 <arrow>
           5 cyclomatic    2 cognitive    1 lines
          30.0 CRAP
  web-runner/src/core/runaMagicResistRules.mjs
    :173 normalizeRunaMagicResistInput
           5 cyclomatic    4 cognitive   32 lines
          30.0 CRAP
  src/core/turnGateController.mjs
    :294 createEnemyTurnIdleRecovery
           5 cyclomatic    3 cognitive   18 lines
          30.0 CRAP
  tests/healingGemTenPercentContract.test.js
    :22 callFunction
           5 cyclomatic    4 cognitive    9 lines
          30.0 CRAP
  web-runner/systems/inputHandling.js
    :51 finishMapDrag
           5 cyclomatic    4 cognitive   11 lines
          30.0 CRAP
  src/core/powerAmpRules.mjs
    :29 createPowerAmpArmedEntry
           5 cyclomatic    4 cognitive   13 lines
          30.0 CRAP
  tests/kojonnRoleCorrectionContract.test.js
    :10 extractFunctionSource
           5 cyclomatic    8 cognitive   17 lines
          30.0 CRAP
  web-runner/src/core/idleFarmRuntime.mjs
    :165 resolveIdleMonsterDrop
           5 cyclomatic    4 cognitive    7 lines
          30.0 CRAP
    :223 resetIdleFarmEmissionCadence
           5 cyclomatic    4 cognitive   11 lines
          30.0 CRAP
    :306 <arrow>
           5 cyclomatic    3 cognitive    2 lines
          30.0 CRAP
    :311 <arrow>
           5 cyclomatic    3 cognitive    2 lines
          30.0 CRAP
  src/layout/combatLayout.js
    :10 onEnter
           5 cyclomatic    3 cognitive    7 lines
          30.0 CRAP
  web-runner/src/core/schedulerRules.mjs
    :52 <arrow>
           5 cyclomatic    1 cognitive    7 lines
          30.0 CRAP
    :93 rosterByUID
           5 cyclomatic    2 cognitive    1 lines
          30.0 CRAP
    :118 deriveBattleStartRoundPartition
           5 cyclomatic    4 cognitive   12 lines
          30.0 CRAP
  web-runner/src/core/statusEffectRules.mjs
    :149 normalizeEnemyDotPacketInput
           5 cyclomatic    4 cognitive   27 lines
          30.0 CRAP
    :323 mapOwnerResult
           5 cyclomatic    2 cognitive    4 lines
          30.0 CRAP
    :492 mapOwnerResult
           5 cyclomatic    2 cognitive    4 lines
          30.0 CRAP
  Functions exceeding cyclomatic, cognitive, or CRAP thresholds (https://docs.fallow.tools/explanations/health#complexity-metrics)
  To suppress: // fallow-ignore-next-line complexity

● File health scores (316 files) · sorted by triage concern

   53.3    web-runner/app.js                               risk
           8219 LOC    1 fan-in   48 fan-out  100% dead  0.39 density  >999 risk

   67.6    web-runner/systems/simulationCoreShadow.js      risk
           4041 LOC    1 fan-in    1 fan-out  100% dead  0.32 density  >999 risk

   50.3    web-runner/modules/functionBank.js              risk
           8623 LOC    1 fan-in   26 fan-out  100% dead  0.55 density  >999 risk

   51.1    Scripts/functionBank.js                         risk
           8604 LOC    1 fan-in   25 fan-out  100% dead  0.53 density  >999 risk

   60.7    web-runner/src/core/idleFarmRuntime.mjs         risk
            487 LOC    1 fan-in    1 fan-out  100% dead  0.55 density  >999 risk

   68.8    web-runner/systems/renderHeroScreen.js          risk
            654 LOC    1 fan-in    1 fan-out  100% dead  0.28 density  >999 risk

   83.7    tools/balance_harness.js                        risk
            811 LOC    1 fan-in    1 fan-out    0% dead  0.45 density  >999 risk

   60.1    web-runner/src/core/superGemBoardState.mjs      risk
            324 LOC    3 fan-in    3 fan-out  100% dead  0.48 density  >999 risk

   65.9    src/core/gemActionRules.mjs                     risk
            230 LOC    1 fan-in    0 fan-out  100% dead  0.47 density  >999 risk

   65.9    web-runner/src/core/gemActionRules.mjs          risk
            230 LOC    1 fan-in    0 fan-out  100% dead  0.47 density  >999 risk

  ... and 306 more files (--format json for full list)

  Sorted by triage concern: the larger of low-MI concern and CRAP risk. The risk / structure tag marks which one placed each file. MI reflects complexity, coupling, and dead code; risk reflects untested complexity (CRAP) and can diverge from MI. Risk: low <15, moderate 15-30, high >=30. CRAP estimated from export references (85% direct, 40% indirect, 0% untested). Run `fallow health --coverage <coverage-final.json>` for exact scores. https://docs.fallow.tools/explanations/health#file-health-scores

● Hotspots (57 files, since 6 months)

   55.0 ─  web-runner/modules/functionBank.js
         142 commits  12221 churn  0.55 density   1 fan-in  ─ stable

   51.5 ─  Scripts/functionBank.js
         137 commits  11915 churn  0.53 density   1 fan-in  ─ stable

   34.9 ─  web-runner/app.js
         141 commits  26139 churn  0.39 density   1 fan-in  ─ stable

    9.9 ─  web-runner/systems/simulationCoreShadow.js
          33 commits   4120 churn  0.32 density   1 fan-in  ─ stable

    6.2 ▼  web-runner/systems/superGemRuntime.js
          15 commits   1350 churn  0.48 density   1 fan-in  ▼ cooling

    5.0 ▲  web-runner/modules/skillSheet.js
          15 commits    362 churn  0.47 density   1 fan-in  ▲ accelerating

    4.8 ─  Scripts/skillSheet.js
          15 commits    368 churn  0.47 density   1 fan-in  ─ stable

    3.4 ─  src/core/schedulerRules.mjs
           5 commits    145 churn  1.00 density   2 fan-in  ─ stable

    3.0 ▲  web-runner/src/core/schedulerRules.mjs
           4 commits    145 churn  1.00 density   2 fan-in  ▲ accelerating

    2.4 ▼  web-runner/src/core/superGemBoardState.mjs
           6 commits    349 churn  0.48 density   3 fan-in  ▼ cooling

    2.0 ▼  tests/kojonnHealHotContract.test.js [test]
           6 commits    194 churn  0.39 density   0 fan-in  ▼ cooling

    1.9 ─  src/core/turnGateController.mjs
           8 commits    325 churn  0.34 density   1 fan-in  ─ stable

    1.5 ▲  web-runner/src/core/turnGateController.mjs
           6 commits    325 churn  0.34 density   3 fan-in  ▲ accelerating

    1.5 ─  web-runner/src/core/combatRuntimeGateway.js
           5 commits    474 churn  0.41 density   1 fan-in  ─ stable

    1.4 ─  src/core/combatRuntimeGateway.cjs
           5 commits    792 churn  0.41 density   1 fan-in  ─ stable

    1.4 ▲  web-runner/src/core/damageNumberAnimation.mjs
           8 commits    265 churn  0.21 density   1 fan-in  ▲ accelerating

    1.2 ▼  src/core/combatRuntimeGateway.js
           6 commits    359 churn  0.39 density   0 fan-in  ▼ cooling

    1.2 ─  tools/serve_web.js
           7 commits    151 churn  0.27 density   0 fan-in  ─ stable

    1.0 ▲  tests/devToolingModalContract.test.js [test]
          14 commits    205 churn  0.09 density   0 fan-in  ▲ accelerating

    1.0 ▼  tests/falieRedSuperGemBufferShieldContract.test.js [test]
           8 commits    835 churn  0.15 density   0 fan-in  ▼ cooling

    1.0 ▲  tests/magicFruitSkillDraughtContract.test.js [test]
          10 commits    417 churn  0.11 density   0 fan-in  ▲ accelerating

    0.9 ▲  web-runner/src/core/idleFarmRuntime.mjs
           3 commits    516 churn  0.55 density   1 fan-in  ▲ accelerating

    0.8 ▼  tests/superGemCriticalHealContract.test.js [test]
           4 commits    170 churn  0.25 density   0 fan-in  ▼ cooling

    0.7 ▲  web-runner/systems/renderBoard.js
           4 commits    236 churn  0.23 density   1 fan-in  ▲ accelerating

    0.7 ▲  tests/kojonnRoleCorrectionContract.test.js [test]
           4 commits    138 churn  0.22 density   0 fan-in  ▲ accelerating

    0.7 ▲  tests/blueAstralWalletContract.test.js [test]
           5 commits    137 churn  0.17 density   0 fan-in  ▲ accelerating

    0.7 ▼  tests/partyDestinyContract.test.js [test]
          12 commits    325 churn  0.07 density   0 fan-in  ▼ cooling

    0.7 ▲  tests/damageTextPaletteContract.test.js [test]
           9 commits    215 churn  0.09 density   0 fan-in  ▲ accelerating

    0.6 ▲  tests/kojonnAmpAoeContract.test.js [test]
           3 commits    151 churn  0.27 density   0 fan-in  ▲ accelerating

    0.6 ▼  tests/superGemInteractionPacingContract.test.js [test]
           5 commits    438 churn  0.15 density   0 fan-in  ▼ cooling

    0.5 ▼  tests/skillDraughtDevPanelContract.test.js [test]
           5 commits    111 churn  0.13 density   0 fan-in  ▼ cooling

    0.5 ▼  tests/healingGemTenPercentContract.test.js [test]
           3 commits     83 churn  0.20 density   0 fan-in  ▼ cooling

    0.5 ▲  tests/teamPhaseSchedulerContract.test.js [test]
           3 commits     75 churn  0.17 density   0 fan-in  ▲ accelerating

    0.5 ─  tests/kojonnFazeDotContract.test.js [test]
           5 commits     83 churn  0.11 density   0 fan-in  ─ stable

    0.4 ▼  tests/kojonnSuperGemBlightContract.test.js [test]
           3 commits    669 churn  0.15 density   0 fan-in  ▼ cooling

    0.4 ▼  Scripts/logicCore.js
           4 commits    152 churn  0.19 density   1 fan-in  ▼ cooling

    0.4 ▼  tests/turnOrderGroupOwnershipContract.test.js [test]
           3 commits    118 churn  0.13 density   0 fan-in  ▼ cooling

    0.4 ─  tests/hitFlashFeedbackContract.test.js [test]
           7 commits    149 churn  0.09 density   0 fan-in  ─ stable

    0.4 ▼  tests/astralFlowAmpBarContract.test.js [test]
           5 commits    160 churn  0.09 density   0 fan-in  ▼ cooling

    0.4 ▲  tests/idleAutoplayPriorityGemContract.test.js [test]
           6 commits    455 churn  0.09 density   0 fan-in  ▲ accelerating

    0.4 ▲  tests/superGemSupportContracts.test.js [test]
           6 commits     39 churn  0.08 density   0 fan-in  ▲ accelerating

    0.3 ▲  tests/enemyLineClearRefillContract.test.js [test]
           3 commits    138 churn  0.15 density   0 fan-in  ▲ accelerating

    0.3 ▼  tests/superGemRulesContract.test.js [test]
           3 commits    151 churn  0.14 density   0 fan-in  ▼ cooling

    0.3 ▲  tests/partyRegenTickOwnershipContract.test.js [test]
           3 commits     97 churn  0.11 density   0 fan-in  ▲ accelerating

    0.3 ▼  tests/combatUiCleanupContract.test.js [test]
           3 commits     74 churn  0.13 density   0 fan-in  ▼ cooling

    0.3 ▼  tests/enemyLineClearContract.test.js [test]
           4 commits     61 churn  0.10 density   0 fan-in  ▼ cooling

    0.3 ▲  tests/combatPowerIndexContract.test.js [test]
           3 commits     39 churn  0.11 density   0 fan-in  ▲ accelerating

    0.2 ▼  tests/superGemAppContract.test.js [test]
           3 commits    116 churn  0.08 density   0 fan-in  ▼ cooling

    0.2 ▼  web-runner/systems/renderRuntime.js
          25 commits    199 churn  0.01 density   1 fan-in  ▼ cooling

    0.2 ▼  tests/extraTurnHarnessContract.test.js [test]
           3 commits     75 churn  0.09 density   0 fan-in  ▼ cooling

    0.2 ▲  tests/enemyTurnGateRecoveryContract.test.js [test]
           4 commits     90 churn  0.08 density   0 fan-in  ▲ accelerating

    0.2 ▲  tests/combatOutcomeOwnershipContract.test.js [test]
           3 commits    109 churn  0.07 density   0 fan-in  ▲ accelerating

    0.2 ▲  tests/debuffLifecycleReliabilityContract.test.js [test]
           3 commits     40 churn  0.09 density   0 fan-in  ▲ accelerating

    0.1 ▲  tests/idleAutoplaySelectionBypassContract.test.js [test]
           3 commits     30 churn  0.06 density   0 fan-in  ▲ accelerating

    0.1 ▼  tests/seededRngShadowWiringContract.test.js [test]
           3 commits     51 churn  0.04 density   0 fan-in  ▼ cooling

    0.1 ─  tests/townLayoutFlowContract.test.js [test]
           4 commits     28 churn  0.04 density   0 fan-in  ─ stable

    0.1 ▲  tests/turnGateRefreshBaselineContract.test.js [test]
           4 commits    219 churn  0.02 density   0 fan-in  ▲ accelerating

  258 files excluded (< 3 commits)

  Files with high churn and high complexity — https://docs.fallow.tools/explanations/health#hotspot-metrics

● Refactoring targets (106)
  7 low effort · 83 medium · 16 high
    score = quick-win ROI (higher = better) · pri = absolute priority

   45.8  pri:45.8    web-runner/src/core/heroSelectorRules.mjs
         untested risk · effort:low · confidence:high  2 complex functions lack test coverage path, add tests before modifying

   39.6  pri:39.6    web-runner/systems/renderEvolution.js
         untested risk · effort:low · confidence:high  2 complex functions lack test coverage path, add tests before modifying

   35.6  pri:35.6    web-runner/systems/renderSkillDraughtOverlay.js
         untested risk · effort:low · confidence:high  3 complex functions lack test coverage path, add tests before modifying

   31.7  pri:31.7    web-runner/src/core/yellowRefillRules.mjs
         dead code · effort:low · confidence:high  Remove 4 unused exports to reduce surface area (100% dead)

   31.3  pri:31.3    Scripts/logicCore.js
         dead code · effort:low · confidence:high  Remove 3 unused exports to reduce surface area (100% dead)

   27.5  pri:27.5    Scripts/utils.js
         dead code · effort:low · confidence:high  Remove 3 unused exports to reduce surface area (100% dead)

   27.2  pri:27.2    web-runner/state/uiState.js
         dead code · effort:low · confidence:high  Remove 4 unused exports to reduce surface area (100% dead)

   23.9  pri:47.8    web-runner/src/core/superGemBoardState.mjs
         high impact · effort:medium · confidence:medium  Split high-impact file (324 LOC) — 3 dependents amplify every change

   22.8  pri:45.5    web-runner/src/core/superGemRender.mjs
         high impact · effort:medium · confidence:medium  Split high-impact file (89 LOC) — 3 dependents amplify every change

   21.1  pri:63.3    web-runner/modules/functionBank.js
         dead code · effort:high · confidence:high  Remove 160 unused exports to reduce surface area (100% dead)

  ... and 96 more targets (--format json for full list)

  Prioritized refactoring recommendations based on complexity, churn, and coupling signals — https://docs.fallow.tools/explanations/health#refactoring-targets

✗ 1279 above threshold · 4847 analyzed · maintainability 73.8 (moderate) (0.02s)
  Maintainability scale: good ≥85, moderate ≥65, low <65 (0–100)

Failed: dead-code (1291 issues), dupes (450 clone groups), health (1279 above threshold) — start with web-runner/src/core/heroSelectorRules.mjs
➜  codex-orka git:(main) ✗ 
