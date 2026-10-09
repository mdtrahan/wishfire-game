import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatCameraProjection, deriveCombatFormationAnchors, deriveCombatWorldBounds, deriveCombatWorldVerticalBounds } from '../src/core/combatOrientation.mjs';
import { advanceContinuousCombatArena, deriveContinuousCombatRecoveryHuddle } from '../web-runner/src/core/arenaCombat.mjs';
import { computeCombatPower } from '../web-runner/src/core/combatPower.mjs';
import { derivePresentationTurnBarrier } from '../web-runner/src/core/turnGateController.mjs';
import {
  CONTINUOUS_COMBAT_PACK_CP_STEP,
  CONTINUOUS_COMBAT_PACK_INTERVAL_SEC,
  CONTINUOUS_COMBAT_PACKS_PER_WAVE,
  CONTINUOUS_COMBAT_ALL_PACKS_MASK,
  CONTINUOUS_COMBAT_ENEMIES_PER_WAVE_MAX,
  CONTINUOUS_COMBAT_SECTOR_RATIOS,
  CONTINUOUS_COMBAT_STAGES,
  activateContinuousCombatSpawnedEnemy,
  advanceContinuousCombatStage,
  armContinuousCombatBoss,
  buildContinuousCombatSpawnPlan,
  configureContinuousCombatProduction,
  createContinuousCombatStageState,
  deriveContinuousCombatWavePackProgress,
  finalizeContinuousCombatProduction,
  getContinuousCombatPartyCP,
  maybeAdvanceContinuousCombatStage,
  pushContinuousCombatEnemy,
  reverseContinuousCombatEnemy,
  resetContinuousCombatAfterDefeat,
  recordContinuousCombatWavePackProgress,
  scaleContinuousCombatPackRow,
  teleportContinuousCombatEnemy,
} from '../web-runner/src/core/continuousCombatStage.mjs';

const rows = ['Gobloc', 'Skeleton', 'High Gobloc', 'Lizardo', 'Orc', 'High Orc', 'Chimerilass', 'Djinn', 'Troll']
  .map((name, index) => ({ name, HP: 20 + index * 5, ATK: 2 + index, DEF: 2, MAG: 1, RES: 1, SPD: 8 }));

test('continuous combat ignores retired enemy-slot refill holds in both runtime banks', async () => {
  const { readFileSync } = await import('node:fs');
  const { getEnemyRosterStability } = await import('../web-runner/src/core/enemyRosterStability.mjs');
  const entities = [{ kind: 'enemy', uid: 2, hp: 10 }];
  assert.equal(getEnemyRosterStability({ enemySlots: [99], enemyIds: [98], pendingRespawnSlots: [1], entities }).stable, false);
  assert.equal(getEnemyRosterStability({ entities }).stable, true);
  for (const path of ['../web-runner/modules/functionBank.js', '../Scripts/functionBank.js']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /if \(Number\(g\.ContinuousCombatStageLoop \|\| 0\) === 1\) return getEnemyRosterStability\(\{ entities: getEntities\(ctx\) \}\);/);
    assert.match(source, /if \(!g\.QuestFiniteEncounter && !continuousStageActive && scheduleRespawn\) scheduleEnemyRespawnWindow\(ctx, slotIndex, respawnDelay\);/);
    assert.match(source, /if \(!g\.QuestFiniteEncounter && !continuousStageActive\) markEnemyRespawnPending\(ctx, slotIndex\);/);
    assert.match(source, /if \(Number\(g\.ContinuousCombatStageLoop \|\| 0\) === 1\) \{ g\.PendingEnemyRespawnTimerActive = 0; g\.PendingEnemyRespawnSlots = \[\]; return; \}/);
  }
});

test('continuous stage simulation makes no movement, emission or action claim while paused', () => {
  for (const pauseKey of ['DevToolingPaused', 'QaScenarioPaused', 'QaFixtureHoldTurn']) {
    const stage = createContinuousCombatStageState(91);
    stage.bossAvailable = true;
    stage.nextEmissionAt = 0;
    const enemy = { uid: 8, kind: 'enemy', hp: 10, streamState: 'approaching', streamPackIndex: 0, x: 650, y: 290, streamEngageX: 300, streamWalkSpeed: 100, streamStartAt: 0 };
    const globals = { ContinuousCombatStageLoop: 1, ContinuousCombatStage: stage, GamePhase: 'RUNTIME', time: 20, [pauseKey]: 1 };
    const calls = [];
    assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities: [enemy], call: (...args) => calls.push(args) }), false, pauseKey);
    assert.equal(enemy.x, 650, pauseKey);
    assert.equal(enemy.streamState, 'approaching', pauseKey);
    assert.equal(stage.transitions, 0, pauseKey);
    assert.equal(stage.nextEmissionAt, 0, pauseKey);
    assert.deepEqual(calls, [], pauseKey);
  }
});

test('normal wave plans start with six evenly spaced base packs of two or three actors', () => {
  const start = createContinuousCombatStageState(42);
  const first = buildContinuousCombatSpawnPlan(rows, start);
  const secondState = advanceContinuousCombatStage(start).state;
  const second = buildContinuousCombatSpawnPlan(rows, secondState, { slotBase: first.length });
  const thirdState = advanceContinuousCombatStage(secondState).state;
  const third = buildContinuousCombatSpawnPlan(rows, thirdState, { slotBase: first.length + second.length });
  assert.ok([12, 18].includes(first.length));
  assert.ok([12, 18].includes(second.length));
  assert.ok([12, 18].includes(third.length));
  for (const plan of [first, second, third]) {
    const counts = Array.from({ length: CONTINUOUS_COMBAT_PACKS_PER_WAVE }, (_, sector) => plan.filter(entry => entry.sectorIndex === sector).length);
    assert.ok(counts.every(count => count >= 2 && count <= 3));
  }
  assert.ok([12, 18].includes(first.length));
  assert.deepEqual(first.map(entry => entry.slotIndex), Array.from({ length: first.length }, (_, index) => index));
  assert.deepEqual(second.map(entry => entry.slotIndex), Array.from({ length: second.length }, (_, index) => first.length + index));
  assert.ok(second.some(entry => ['Gobloc', 'Skeleton'].includes(entry.row.name)));
  assert.ok(second.some(entry => ['High Gobloc', 'Lizardo'].includes(entry.row.name)));
  const totals = [first, second, third].map(pack => pack.reduce((sum, entry) => sum + entry.row.CombatPower, 0));
  assert.ok(totals[0] < totals[1]);
  assert.ok(totals[1] < totals[2]);
  assert.ok(totals[1] / totals[0] < 1 + CONTINUOUS_COMBAT_PACK_CP_STEP * 2);
  assert.ok(totals[2] / totals[1] < 1 + CONTINUOUS_COMBAT_PACK_CP_STEP * 2);
});

test('legacy four-wave refill state is ignored and saved boss access auto-enters once', () => {
  const globals = {
    ContinuousCombatStageLoop: 1, GamePhase: 'RUNTIME', BattleStartActive: 0, time: 0,
    EnemyData: rows, EnemySize: 40, EnemySlots: [], PendingDeaths: {}, EnemyDeathVisualHoldByUID: {},
    ContinuousCombatStage: { ...createContinuousCombatStageState(52), wave: 1, bossAvailable: true, bossArmed: false, bossActive: false, bossEntryDeferredUntilWaveFour: true, nextEmissionAt: 0 },
  };
  const entities = [{ uid: 1, kind: 'hero', hp: 40, maxHP: 40, footX: 180, footY: 280 }];
  let nextUID = 10;
  const call = (name, row, slotIndex) => {
    if (name === 'SettleContinuousCombatRewards') return;
    if (name !== 'SpawnEnemy') return;
    const enemy = { uid: nextUID++, kind: 'enemy', name: row.name, enemyRole: row.enemyRole || row.role, combatRank: row.combatRank, hp: row.HP, maxHP: row.HP, slotIndex };
    entities.push(enemy);
    globals.EnemySlots.push(enemy.uid);
    return enemy;
  };
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call }), true);
  assert.equal(globals.ContinuousCombatStage.bossActive, true);
  assert.equal(globals.ContinuousCombatStage.bossEntryDeferredUntilWaveFour, true, 'runtime ignores the retired field without requiring a save rewrite');
  assert.equal(entities.filter(actor => actor.kind === 'enemy').length, 1, 'ready boss entry does not refill with fodder');
});

test('cleared packs move the current-wave HUD while production waits for all packs and presentation to settle', async () => {
  const { drawCombatProgressHud } = await import('../web-runner/systems/renderCombatBossControl.mjs');
  const stage = { ...createContinuousCombatStageState(42), wave: 2, transitions: 2, nextEmissionAt: 0, lastUpdatedAt: 10, lastArenaUpdatedAt: 10 };
  const plan = buildContinuousCombatSpawnPlan(rows, stage, { partyCP: 100000 });
  stage.spawnSerial = plan.length;
  stage.spawnedPackMask = plan.reduce((mask, entry) => mask | (1 << entry.sectorIndex), 0);
  const packSizes = Array.from({ length: CONTINUOUS_COMBAT_PACKS_PER_WAVE }, (_, sector) => plan.filter(entry => entry.sectorIndex === sector).length);
  assert.ok(new Set(packSizes).size > 1, 'fixture includes different sector sizes from seeded CP extras');
  let nextUID = 10;
  const entities = [{ uid: 1, kind: 'hero', hp: 100, maxHP: 100 }];
  const enemyBySector = new Map();
  for (const entry of plan) {
    const enemy = { uid: nextUID++, kind: 'enemy', hp: 20, maxHP: 20, name: entry.row.name, enemyRole: 'fodder', slotIndex: entry.slotIndex };
    activateContinuousCombatSpawnedEnemy({}, enemy, entry);
    entities.push(enemy);
    const pack = enemyBySector.get(entry.sectorIndex) || [];
    pack.push(enemy);
    enemyBySector.set(entry.sectorIndex, pack);
  }
  const globals = {
    ContinuousCombatStageLoop: 1, ContinuousCombatStage: stage, GamePhase: 'RUNTIME', BattleStartActive: 0,
    EnemyData: rows, EnemySize: 40, EnemySlots: [], PendingDeaths: {}, EnemyDeathVisualHoldByUID: {},
    PendingHeroHits: [], RealtimeEnemyActionsByUID: {}, RealtimeEnemyActionReadyAt: {}, RealtimeHeroBasicScheduledActions: {},
    CombatImpactRequests: [], CombatImpactVisuals: [], ChainStrikeVisuals: [], ArcanePulseVisuals: [], DamageTexts: [],
    ActionInProgress: 0, time: 10,
  };
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_target, key) => (...args) => calls.push([key, ...args]),
    set: (_target, key, value) => { calls.push(['set', key, value]); return true; },
  });
  const notchColors = () => calls.filter(([name, key, value]) => name === 'set' && key === 'strokeStyle' && ['#55d4be', '#243237'].includes(value)).map(([, , value]) => value);
  const draw = () => drawCombatProgressHud(ctx, { state: { globals, entities }, worldToCanvas: (x, y) => ({ x, y }) });
  const initialHud = draw();
  assert.equal(initialHud.completedWaves, 1);
  assert.equal(initialHud.waveProgress, 0);
  const initialFillWidth = calls.find(([name]) => name === 'fillRect')?.[3] || 0;

  const oneMemberOfPack = enemyBySector.get(0)[0];
  oneMemberOfPack.hp = 0;
  assert.equal(deriveContinuousCombatWavePackProgress(stage, entities).fraction, 0, 'a sector remains incomplete while any pack member survives');
  calls.length = 0;
  assert.equal(draw().waveProgress, 0);

  for (const sector of [0, 3]) for (const enemy of enemyBySector.get(sector)) enemy.hp = 0;
  const progress = deriveContinuousCombatWavePackProgress(stage, entities);
  assert.deepEqual(progress, { clearedPacks: 2, packsPerWave: 6, fraction: 2 / 6 });
  calls.length = 0;
  const partialHud = draw();
  assert.equal(partialHud.completedWaves, 1, 'the established full-wave counter remains integral');
  assert.equal(partialHud.waveProgress, 2 / 6);
  assert.equal(partialHud.progressPosition, 1 + 2 / 6);
  const partialFillWidth = calls.find(([name]) => name === 'fillRect')?.[3] || 0;
  assert.ok(partialFillWidth > initialFillWidth, 'the rail visibly advances inside the active wave segment');
  assert.deepEqual(notchColors(), ['#55d4be', '#243237', '#243237']);
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: derivePresentationTurnBarrier({ globals }), call() {} }), false);
  assert.equal(stage.wave, 2, 'living members in other sectors keep the actual wave gate locked');

  for (const enemy of entities.filter(actor => actor.kind === 'enemy')) enemy.hp = 0;
  const heldDeath = entities.find(actor => actor.kind === 'enemy');
  globals.EnemyDeathVisualHoldByUID[String(heldDeath.uid)] = true;
  globals.CombatImpactVisuals.push({ uid: 'settling' });
  calls.length = 0;
  const heldWaveHud = draw();
  assert.equal(heldWaveHud.progressPosition, 2, 'all six pack defeats can fill the wave segment while their presentation settles');
  assert.deepEqual(notchColors(), ['#55d4be', '#55d4be', '#243237'], 'a notch at the filled position uses the teal completed color');
  assert.equal(derivePresentationTurnBarrier({ globals }).lanes.combatEffects, true);
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: derivePresentationTurnBarrier({ globals }), call() {} }), false);
  assert.equal(stage.wave, 2);
  delete globals.EnemyDeathVisualHoldByUID[String(heldDeath.uid)];
  globals.CombatImpactVisuals = [];
  let spawnedUID = 100;
  const call = (name, row, slotIndex) => {
    if (name !== 'SpawnEnemy') return;
    const enemy = { uid: spawnedUID++, kind: 'enemy', name: row.name, enemyRole: row.enemyRole, hp: row.HP, maxHP: row.HP, slotIndex };
    entities.push(enemy);
    return enemy;
  };
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: derivePresentationTurnBarrier({ globals }), call }), true);
  assert.equal(globals.ContinuousCombatStage.wave, 3);
  assert.equal(deriveContinuousCombatWavePackProgress(globals.ContinuousCombatStage, entities).fraction, 0, 'new-wave spawns reset transient pack progress');

  const savedGlobals = {
    EncounterSeed: 88,
    HeroProgress: { continuousStage: { region: 2, stage: 4, wave: 3, bossAvailable: false, clearedBosses: 13 } },
  };
  configureContinuousCombatProduction(savedGlobals, { productionPath: true });
  const savedWaveEntities = Array.from({ length: 18 }, (_, index) => ({ uid: index + 1, kind: 'enemy', name: rows[index % rows.length].name, hp: 20, maxHP: 20 }));
  assert.equal(finalizeContinuousCombatProduction(savedGlobals, savedWaveEntities), true);
  assert.equal(savedGlobals.ContinuousCombatStage.wave, 3, 'reload restores the saved wave number');
  assert.equal(savedGlobals.ContinuousCombatStage.transitions, 0, 'legacy checkpoints without a transition counter remain valid');
  for (const enemy of savedWaveEntities.filter(actor => actor.streamSectorIndex % CONTINUOUS_COMBAT_PACKS_PER_WAVE === 1 || actor.streamSectorIndex % CONTINUOUS_COMBAT_PACKS_PER_WAVE === 4)) enemy.hp = 0;
  assert.equal(deriveContinuousCombatWavePackProgress(savedGlobals.ContinuousCombatStage, savedWaveEntities).clearedPacks, 2);

  const retryGlobals = { ContinuousCombatStageLoop: 1, time: 14, EnemyData: rows, ContinuousCombatStage: { ...stage, bossAvailable: true } };
  assert.equal(resetContinuousCombatAfterDefeat(retryGlobals), true);
  const retryPlan = buildContinuousCombatSpawnPlan(rows, retryGlobals.ContinuousCombatStage, { partyCP: 100000 });
  retryGlobals.ContinuousCombatStage.spawnSerial = retryPlan.length;
  const retryEnemies = retryPlan.map((entry, index) => {
    const enemy = { uid: 200 + index, kind: 'enemy', hp: 20, maxHP: 20, name: entry.row.name, enemyRole: 'fodder', slotIndex: entry.slotIndex };
    activateContinuousCombatSpawnedEnemy(retryGlobals, enemy, entry);
    return enemy;
  });
  assert.equal(retryGlobals.ContinuousCombatStage.wave, stage.wave);
  assert.equal(retryGlobals.ContinuousCombatStage.bossAvailable, true);
  assert.equal(retryGlobals.ContinuousCombatStage.bossEntryDeferredUntilWaveFour, false);
  assert.equal(deriveContinuousCombatWavePackProgress(retryGlobals.ContinuousCombatStage, retryEnemies).fraction, 1, 'defeat recovery retains the full earned boss milestone');

  const legacyReady = { ...createContinuousCombatStageState(89), wave: 1, bossAvailable: true, spawnSerial: 0 };
  const legacyReadyHud = drawCombatProgressHud(ctx, { state: { globals: { ContinuousCombatStage: legacyReady }, entities: [] }, worldToCanvas: (x, y) => ({ x, y }) });
  assert.equal(legacyReadyHud.completedWaves, 4, 'older saved boss-ready flags retain the full ready meter');
  assert.equal(legacyReadyHud.waveProgress, 0);

  const uninitialized = { ...createContinuousCombatStageState(88), wave: 2, transitions: 2, spawnSerial: 0 };
  assert.deepEqual(deriveContinuousCombatWavePackProgress(uninitialized, []), { clearedPacks: 0, packsPerWave: 6, fraction: 0 });
});

test('current-wave pack credit is idempotent across KO recovery and unfinished-pack respawns', () => {
  const stage = { ...createContinuousCombatStageState(61), wave: 3, transitions: 4 };
  const plan = buildContinuousCombatSpawnPlan(rows, stage);
  stage.spawnSerial = plan.length;
  stage.spawnedPackMask = plan.reduce((mask, entry) => mask | (1 << entry.sectorIndex), 0);
  const entities = plan.map((entry, index) => {
    const enemy = { uid: index + 1, kind: 'enemy', hp: entry.row.HP, maxHP: entry.row.HP, name: entry.row.name };
    activateContinuousCombatSpawnedEnemy({ ContinuousCombatStage: stage, time: 0 }, enemy, entry);
    return enemy;
  });
  const bySector = new Map();
  for (const enemy of entities) {
    const sector = enemy.streamSectorIndex % CONTINUOUS_COMBAT_PACKS_PER_WAVE;
    bySector.set(sector, [...(bySector.get(sector) || []), enemy]);
  }
  bySector.get(0)[0].hp = 0;
  assert.equal(deriveContinuousCombatWavePackProgress(stage, entities).fraction, 0, 'one death inside a multi-member pack earns no sector credit');
  for (const sector of [0, 4]) for (const enemy of bySector.get(sector)) enemy.hp = 0;
  assert.equal(recordContinuousCombatWavePackProgress(stage, entities), true);
  assert.equal(recordContinuousCombatWavePackProgress(stage, entities), false, 'recording the same clear twice changes no progress');
  assert.equal(stage.clearedPackMask, (1 << 0) | (1 << 4));
  assert.equal(deriveContinuousCombatWavePackProgress(stage, entities).fraction, 2 / 6);

  const globals = { ContinuousCombatStage: stage, time: 9 };
  resetContinuousCombatAfterDefeat(globals);
  const retryStage = globals.ContinuousCombatStage;
  const retryPlan = buildContinuousCombatSpawnPlan(rows, retryStage);
  assert.deepEqual([...new Set(retryPlan.map(entry => entry.sectorIndex))], [1, 2, 3, 5], 'recovery respawns only unfinished sectors');
  retryStage.spawnSerial = retryPlan.length;
  retryStage.spawnedPackMask = retryPlan.reduce((mask, entry) => mask | (1 << entry.sectorIndex), 0);
  const retryEnemies = retryPlan.map((entry, index) => {
    const enemy = { uid: 100 + index, kind: 'enemy', hp: entry.row.HP, maxHP: entry.row.HP, name: entry.row.name };
    activateContinuousCombatSpawnedEnemy(globals, enemy, entry);
    return enemy;
  });
  assert.equal(deriveContinuousCombatWavePackProgress(retryStage, retryEnemies).fraction, 2 / 6, 'recovered wave keeps the earned fraction');
  for (const enemy of retryEnemies) enemy.hp = 0;
  recordContinuousCombatWavePackProgress(retryStage, retryEnemies);
  assert.equal(retryStage.clearedPackMask, CONTINUOUS_COMBAT_ALL_PACKS_MASK, 'the remaining clear completes the same wave exactly once');
  assert.equal(buildContinuousCombatSpawnPlan(rows, retryStage).length, 0, 'a fully credited wave has no fodder to respawn');
});

test('partial spawned-sector metadata limits progress capture to sectors that actually entered', () => {
  const stage = { ...createContinuousCombatStageState(7), spawnSerial: 2, spawnedPackMask: 0b000101 };
  const entities = [
    { kind: 'enemy', hp: 0, streamPackIndex: 0, streamSectorIndex: 0 },
    { kind: 'enemy', hp: 20, streamPackIndex: 0, streamSectorIndex: 2 },
  ];
  assert.equal(deriveContinuousCombatWavePackProgress(stage, entities).fraction, 1 / 6, 'only a dead sector in the actual spawn plan earns credit');
  recordContinuousCombatWavePackProgress(stage, entities);
  assert.equal(stage.clearedPackMask, 0b000001);
});

test('only underpowered ordinary sectors draw one seeded plus-one-to-three count and preserve base rows', () => {
  const stage = { ...createContinuousCombatStageState(17), transitions: 9 };
  const base = buildContinuousCombatSpawnPlan(rows, stage);
  const cpBySector = Array.from({ length: CONTINUOUS_COMBAT_PACKS_PER_WAVE }, (_, sector) =>
    base.filter(entry => entry.sectorIndex === sector).reduce((sum, entry) => sum + computeCombatPower(entry.row), 0));
  const minimumSectorCP = Math.min(...cpBySector);
  assert.equal(buildContinuousCombatSpawnPlan(rows, stage, { partyCP: minimumSectorCP - 0.1 }).length, base.length, 'below-pack party CP adds none');
  assert.equal(buildContinuousCombatSpawnPlan(rows, stage, { partyCP: minimumSectorCP }).length, base.length, 'equal and higher sectors add none');
  assert.ok(buildContinuousCombatSpawnPlan(rows, stage, { partyCP: minimumSectorCP + 0.1 }).length > base.length, 'a strictly underpowered sector receives extras');

  const observedExtraCounts = new Set();
  for (let seed = 1; seed <= 80 && observedExtraCounts.size < 3; seed += 1) {
    const seededStage = { ...stage, seed };
    const plan = buildContinuousCombatSpawnPlan(rows, seededStage, { partyCP: Number.MAX_SAFE_INTEGER });
    const repeated = buildContinuousCombatSpawnPlan(rows, seededStage, { partyCP: Number.MAX_SAFE_INTEGER });
    assert.deepEqual(plan, repeated, 'stage seed and transition count fully determine pack padding');
    const sectorRows = Array.from({ length: CONTINUOUS_COMBAT_PACKS_PER_WAVE }, (_, sector) => plan.filter(entry => entry.sectorIndex === sector));
    for (const pack of sectorRows) {
      const extraCount = pack.length - base.filter(entry => entry.sectorIndex === pack[0].sectorIndex).length;
      assert.ok(extraCount >= 1 && extraCount <= 3);
      observedExtraCounts.add(extraCount);
      assert.equal(pack.length, pack[0].sectorSize);
      assert.deepEqual(pack.map(entry => entry.entryOrder), Array.from({ length: pack.length }, (_, index) => index));
    }
    assert.deepEqual(plan.map(entry => entry.slotIndex), Array.from({ length: plan.length }, (_, index) => index));
    assert.equal(new Set(plan.map(entry => entry.slotIndex)).size, plan.length);
    assert.equal(new Set(plan.map(entry => entry.sectorIndex)).size, 6);
    for (const entry of base) {
      const padded = plan.find(candidate => candidate.slotIndex === entry.slotIndex);
      for (const key of ['HP', 'ATK', 'DEF', 'MAG', 'RES', 'SPD', 'CombatPower', 'streamCpScale']) assert.equal(padded.row[key], entry.row[key]);
    }
  }
  assert.deepEqual([...observedExtraCounts].sort(), [1, 2, 3]);
  assert.equal(CONTINUOUS_COMBAT_ENEMIES_PER_WAVE_MAX, 36);

  const boss = { ...stage, wave: 4, bossAvailable: true, bossArmed: true, bossActive: true };
  assert.deepEqual(buildContinuousCombatSpawnPlan(rows, boss, { partyCP: Number.MAX_SAFE_INTEGER }), buildContinuousCombatSpawnPlan(rows, boss), 'boss count and stats do not use pack padding');
});

test('deployed party CP includes KO heroes and uses the direct canonical actor sum', () => {
  const heroes = [
    { kind: 'hero', currentLevel: 25, maxHP: 280, stats: { ATK: 40, DEF: 30, MAG: 25, RES: 30, SPD: 10 } },
    { kind: 'hero', currentLevel: 25, hp: 0, maxHP: 250, stats: { ATK: 35, DEF: 25, MAG: 40, RES: 35, SPD: 12 } },
  ];
  assert.equal(getContinuousCombatPartyCP(heroes), heroes.reduce((sum, hero) => sum + computeCombatPower(hero), 0));
  assert.ok(getContinuousCombatPartyCP(heroes) > computeCombatPower(heroes[0]));
});

test('runtime wave emission pads each weak pack and arena commitment still selects one whole sector', () => {
  const enemyRows=['Gobloc','Skeleton','High Gobloc','Lizardo','Orc','High Orc','Chimerilass','Djinn','Troll']
    .map(name=>({name,HP:1,ATK:1,DEF:1,MAG:1,RES:1,SPD:1}));
  const stage={...createContinuousCombatStageState(53),nextEmissionAt:0,lastUpdatedAt:5,lastArenaUpdatedAt:5};
  const heroes=Array.from({length:4},(_,index)=>({uid:index+1,kind:'hero',hp:300,maxHP:300,currentLevel:50,stats:{ATK:100,DEF:100,MAG:100,RES:100,SPD:100},footX:180+index*4,footY:220+index*8}));
  const entities=[...heroes];
  const globals={ContinuousCombatStageLoop:1,ContinuousCombatStage:stage,GamePhase:'RUNTIME',BattleStartActive:0,time:5,EnemyData:enemyRows,EnemySize:40,EnemySlots:[],EnemyIDs:[],PendingDeaths:{},EnemyDeathVisualHoldByUID:{}};
  const call=(name,row,slotIndex)=>{
    if(name!=='SpawnEnemy')return null;
    const enemy={uid:100+slotIndex,kind:'enemy',name:row.name,hp:row.HP,maxHP:row.HP,stats:{ATK:row.ATK,DEF:row.DEF,MAG:row.MAG,RES:row.RES,SPD:row.SPD},slotIndex};
    entities.push(enemy);return enemy;
  };
  assert.equal(maybeAdvanceContinuousCombatStage({globals,entities,presentationBarrier:{lanes:{}},call}),true);
  assert.equal(globals.ContinuousCombatStage.wave,2);
  const packs=new Map();
  for(const enemy of entities.filter(actor=>actor.kind==='enemy')) {
    const packId=enemy.streamSectorIndex;
    const pack=packs.get(packId)||[];pack.push(enemy);packs.set(packId,pack);
  }
  assert.equal(packs.size,6);
  assert.ok([...packs.values()].every(pack=>pack.length>=3&&pack.length<=6));
  const committedPack=[...packs.entries()][0];
  for(const enemy of committedPack[1])enemy.streamState='in_range';
  advanceContinuousCombatArena({globals,entities,seconds:0});
  assert.equal(globals.ContinuousCombatStage.activeEncounterGroupId,committedPack[0]);
  const committedUIDs=new Set(committedPack[1].map(enemy=>enemy.uid));
  assert.ok(heroes.every(hero=>committedUIDs.has(hero.arenaTargetUID)),'hero targeting remains committed to every member of the selected sector pack');
});

test('stage-owned linear scaling raises later waves and makes the boss a group-level spike', () => {
  const early = createContinuousCombatStageState(42, { region: 1, stage: 1 });
  const late = createContinuousCombatStageState(42, { region: 1, stage: 10 });
  const earlyPlan = buildContinuousCombatSpawnPlan(rows, early);
  const latePlan = buildContinuousCombatSpawnPlan(rows, late);
  const bossState = { ...late, wave: 4, bossAvailable: true, bossArmed: true, bossActive: true };
  const bossPlan = buildContinuousCombatSpawnPlan(rows, bossState);
  const total = plan => plan.reduce((sum, entry) => sum + entry.row.CombatPower, 0);
  assert.ok(total(latePlan) > total(earlyPlan) * 1.6);
  assert.equal(bossPlan.length, 1);
  assert.ok(total(bossPlan) > total(latePlan) / CONTINUOUS_COMBAT_PACKS_PER_WAVE);
  assert.ok(total(bossPlan) < total(latePlan) / CONTINUOUS_COMBAT_PACKS_PER_WAVE * 1.6);
});

test('four normal waves unlock the boss gate and loop back to wave one', () => {
  const transition = advanceContinuousCombatStage({
    ...createContinuousCombatStageState(42),
    wave: 4,
  });
  assert.equal(transition.done, false);
  assert.equal(transition.stage.id, '1-1-wave-1');
  assert.equal(transition.state.wave, 1);
  assert.equal(transition.state.bossAvailable, true);
});

test('boss victory advances the checkpoint and wraps stage ten into the next region', () => {
  const transition = advanceContinuousCombatStage({
    ...createContinuousCombatStageState(42, { region: 2, stage: 10 }),
    bossAvailable: true,
    bossArmed: true,
    bossActive: true,
  });
  assert.equal(transition.stage.id, '3-1-wave-1');
  assert.equal(transition.state.region, 3);
  assert.equal(transition.state.stage, 1);
  assert.equal(transition.state.wave, 1);
  assert.equal(transition.state.bossArmed, false);
  assert.equal(transition.state.bossAvailable, false);
  assert.equal(transition.state.clearedBosses, 1);
});

test('ordinary waves carry HP while a boss clear restores and cleanses the party', () => {
  for (const stage of [
    { wave: 4 },
    { wave: 4, bossAvailable: true, bossArmed: true, bossActive: true },
  ]) {
    const heroes = [
      { uid: 1, kind: 'hero', baseHeroName: 'Falie', hp: 13, maxHP: 50, isAlive: true, footX: 1800, footY: 275, statuses: [{ statusEffect: 'dot' }, { statusEffect: 'atkUp' }], statusEffects: [{ statusEffect: 'blind' }, { statusEffect: 'barrier' }] },
      { uid: 2, kind: 'hero', baseHeroName: 'Huun', hp: 0, maxHP: 40, isAlive: false, footX: 420, footY: 205, actionState: 'ko', actionFacing: 'left', actionStateStartedAt: 1, actionImpactAt: 1, actionStateUntil: 86401, statuses: [{ statusEffect: 'silence' }] },
    ];
    const entities = [...heroes];
    const globals = {
      ContinuousCombatStageLoop: 1,
      ContinuousCombatStage: { ...createContinuousCombatStageState(1), ...stage, nextEmissionAt: 0 },
      EnemyData: rows, EnemySize: 40, GamePhase: 'RUNTIME', BattleStartActive: 0,
      time: 10, PendingDeaths: {}, EnemyDeathVisualHoldByUID: {}, EnemySlots: [],
      HeroProgress: { heroes: {} },
    };
    const calls = [];
    const call = (name, row, slotIndex) => {
      calls.push(name);
      if (name === 'SettleContinuousCombatRewards' && stage.bossActive) heroes[0].maxHP = 60;
      if (name !== 'SpawnEnemy') return null;
      const enemy = { uid: 10 + slotIndex, kind: 'enemy', name: row.name, hp: row.HP, maxHP: row.HP };
      entities.push(enemy);
      return enemy;
    };
    assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call }), true);
    const clearedBoss = !!stage.bossActive;
    assert.deepEqual(heroes.map(hero => hero.hp), clearedBoss ? [60, 40] : [13, 0]);
    assert.deepEqual(heroes.map(hero => hero.isAlive), clearedBoss ? [true, true] : [true, false]);
    if (clearedBoss) {
      const huddle = deriveContinuousCombatRecoveryHuddle(heroes);
      assert.deepEqual(heroes.map(hero => [hero.footX, hero.footY]), huddle.map(({ x, y }) => [x, y]), 'the revived party snaps to role-based huddle coordinates');
      assert.ok(heroes.every(hero => hero.recoveryFadeStartedAt === 10), 'all revived heroes share one fade start');
    } else {
      assert.deepEqual([heroes[1].footX, heroes[1].footY], [420, 205], 'ordinary wave settlement leaves KO position unchanged');
    }
    if (clearedBoss) {
      for (const hero of heroes) {
        assert.equal(hero.locomotion, 'idle');
        assert.equal(hero.locomotionStartedAt, 10);
        for (const key of ['actionState', 'actionFacing', 'actionStateStartedAt', 'actionImpactAt', 'actionStateUntil']) assert.equal(hero[key], undefined);
      }
    }
    assert.deepEqual(heroes.map(hero => hero.statuses.map(status => status.statusEffect)),
      clearedBoss ? [['atkUp'], []] : [['dot', 'atkUp'], ['silence']]);
    assert.deepEqual(heroes[0].statusEffects.map(status => status.statusEffect), clearedBoss ? ['barrier'] : ['blind', 'barrier']);
    assert.equal(calls.includes('UpdateHeroHPUI'), clearedBoss);
    assert.equal(globals.HeroProgress.heroes.Falie?.hp, clearedBoss ? 60 : undefined);
    assert.equal(globals.HeroProgress.heroes.Huun?.hp, clearedBoss ? 40 : undefined);
    assert.equal(globals.ContinuousCombatStage.wave, 1);
  }
});

test('the fourth wave waits for its normal interval before looping', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(1), wave: 4, nextEmissionAt: 20 },
    EnemyData: rows, EnemySize: 40, GamePhase: 'RUNTIME', BattleStartActive: 0,
    time: 19, PendingDeaths: {}, EnemyDeathVisualHoldByUID: {}, EnemySlots: [],
  };
  const call = name => name === 'SpawnEnemy' ? { kind: 'enemy', hp: 10 } : null;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities: [], presentationBarrier: { lanes: {} }, call }), false);
  assert.equal(globals.ContinuousCombatStage.wave, 4);
  globals.time = 20;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities: [], presentationBarrier: { lanes: {} }, call }), true);
  assert.equal(globals.ContinuousCombatStage.wave, 1);
});

test('boss defeat retains readiness and retries automatically after the recovery interval', () => {
  const globals = { ContinuousCombatStageLoop: 1, time: 12, GamePhase: 'RUNTIME', BattleStartActive: 0, EnemyData: rows, EnemySlots: [], PendingDeaths: {}, EnemyDeathVisualHoldByUID: {}, ContinuousCombatStage: createContinuousCombatStageState(42, { region: 2, stage: 4 }) };
  const entities=[{uid:1,kind:'hero',hp:40,maxHP:75}];
  const call=(name,row)=>{if(name==='SpawnEnemy'){const e={uid:2,kind:'enemy',hp:row.HP};entities.push(e);return e;}};
  assert.equal(armContinuousCombatBoss(globals,entities,call), false);
  globals.ContinuousCombatStage.bossAvailable = true;
  assert.equal(armContinuousCombatBoss(globals,entities,call), true);
  assert.equal(globals.ContinuousCombatStage.bossArmed, true);
  entities.splice(0, entities.length, ...entities.filter(actor => actor.kind === 'hero'));
  assert.equal(resetContinuousCombatAfterDefeat(globals), true);
  assert.equal(globals.ContinuousCombatStage.region, 2);
  assert.equal(globals.ContinuousCombatStage.stage, 4);
  assert.equal(globals.ContinuousCombatStage.wave, 1);
  assert.equal(globals.ContinuousCombatStage.bossAvailable, true);
  assert.equal(deriveContinuousCombatWavePackProgress(globals.ContinuousCombatStage, entities).fraction, 1);
  assert.equal(globals.ContinuousCombatStage.bossArmed, false);
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call }), false, 'boss retry observes the recovery interval');
  globals.time = 15;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call }), true);
  assert.equal(globals.ContinuousCombatStage.bossActive, true);
  assert.equal(entities.filter(a=>a.kind==='enemy').length,1,'the retry enters one boss encounter');
});

test('fourth cleared wave enters the boss once through the existing wipe without spawning wave-one fodder', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(42), wave: 4, nextEmissionAt: 0 },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 12,
    EnemyData: rows, EnemySize: 40, EnemySlots: [], PendingDeaths: {}, EnemyDeathVisualHoldByUID: {},
  };
  const hero = { uid: 1, kind: 'hero', hp: 40, maxHP: 75, footX: 200, footY: 290 };
  const entities = [hero];
  const spawned = [];
  const call = (name, row, slotIndex) => {
    if (name === 'SpawnEnemy') {
      spawned.push(row.enemyRole);
      const enemy = { uid: 2, kind: 'enemy', name: row.name, enemyRole: row.enemyRole, hp: row.HP, slotIndex };
      entities.push(enemy);
      return enemy;
    }
  };
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call }), true);
  assert.deepEqual(spawned, ['boss']);
  assert.equal(globals.ContinuousCombatStage.wave, 1);
  assert.equal(globals.ContinuousCombatStage.bossActive, true);
  assert.equal(globals.ContinuousCombatStage.bossAvailable, true);
  assert.equal(globals.ContinuousCombatStage.bossTransitionEndsAtMs - globals.ContinuousCombatStage.bossTransitionStartedAtMs, 440);
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call }), false);
  assert.deepEqual(spawned, ['boss']);
});

test('restored readiness auto-enters once and clears queued fodder actions', () => {
  const globals = {
    HeroProgress: { continuousStage: { region: 2, stage: 4, wave: 1, bossAvailable: true, clearedBosses: 3 } },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 12, EnemyData: rows, EnemySize: 40,
    EnemySlots: [2], PendingDeaths: {}, EnemyDeathVisualHoldByUID: {},
    RealtimeEnemyActionsByUID: { 2: { active: true } }, RealtimeEnemyActionReadyAt: { 2: 20 },
    PendingHeroHits: [{ targetUID: 2 }], RealtimeHeroBasicScheduledActions: { 1: { targetUID: 2 } },
  };
  assert.equal(configureContinuousCombatProduction(globals, { productionPath: true }), true);
  assert.equal(globals.ContinuousCombatStage.region, 2);
  assert.equal(globals.ContinuousCombatStage.stage, 4);
  assert.equal(globals.ContinuousCombatStage.bossActive, false);
  const entities = [
    { uid: 1, kind: 'hero', hp: 40, footX: 200, footY: 290 },
    { uid: 2, kind: 'enemy', hp: 10, name: 'Gobloc' },
  ];
  const spawned = [];
  const call = (name, row, slotIndex) => {
    if (name === 'SpawnEnemy') {
      spawned.push(row.enemyRole);
      const enemy = { uid: 3, kind: 'enemy', name: row.name, enemyRole: row.enemyRole, hp: row.HP, slotIndex };
      entities.push(enemy);
      return enemy;
    }
  };
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call }), true);
  assert.deepEqual(spawned, ['boss']);
  assert.deepEqual(entities.filter(actor => actor.kind === 'enemy').map(actor => actor.enemyRole), ['boss']);
  assert.deepEqual(globals.PendingHeroHits, []);
  assert.deepEqual(globals.RealtimeHeroBasicScheduledActions, {});
  assert.deepEqual(globals.RealtimeEnemyActionsByUID, {});
  assert.deepEqual(globals.RealtimeEnemyActionReadyAt, {});
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call }), false);
  assert.deepEqual(spawned, ['boss']);
});

test('stream packs distribute deterministically across A, B, and C in the three-screen world', () => {
  const globals = { EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 }, EnemySize: 40 };
  const enemies = [0, 1, 2, 3, 4, 5].map(sectorIndex => activateContinuousCombatSpawnedEnemy(
    globals, { kind: 'enemy', hp: 10 }, { lane: 1, rank: 0, packIndex: 0, sectorIndex },
  ));
  assert.deepEqual(enemies.map(enemy => enemy.streamState), Array(6).fill('roaming'));
  assert.deepEqual(enemies.map(enemy => enemy.streamSectorIndex), [0, 1, 2, 3, 4, 5]);
  assert.ok(enemies[0].x < enemies[1].x && enemies[1].x < enemies[2].x);
  assert.ok(enemies.every(enemy => enemy.x >= 0 && enemy.x <= 2160));
  assert.deepEqual(enemies.reduce((counts, enemy) => {
    counts[Math.min(2, Math.floor(enemy.x / 720))] += 1;
    return counts;
  }, [0, 0, 0]), [2, 2, 2]);
  const safeY = deriveCombatWorldVerticalBounds();
  assert.ok(enemies.every(enemy => enemy.y >= safeY.minY + 32 && enemy.y <= safeY.maxY - 32));
  assert.ok(enemies.every(enemy => enemy.streamEngageX === enemy.x));
  assert.equal(enemies[0].streamWalkSpeed, Math.max(34, 40 * 0.9) * 0.7 * 0.9);
});

test('Shield Slam and Return Gate move right within the attack boundary', () => {
  const enemy = { uid: 71, kind: 'enemy', hp: 10, streamState: 'engaged', x: 280, originX: 280, streamEngageX: 280 };
  assert.equal(pushContinuousCombatEnemy(enemy, 80, 5), 10);
  assert.equal(enemy.x, 290);
  assert.equal(enemy.streamState, 'in_range');
  enemy.x = 200;
  enemy.originX = 200;
  enemy.streamEngageX = 200;
  enemy.streamState = 'engaged';
  assert.equal(pushContinuousCombatEnemy(enemy, 80, 5), 55);
  assert.equal(enemy.x, 255);
  enemy.x = 180;
  enemy.originX = 180;
  enemy.streamEngageX = 180;
  enemy.streamState = 'engaged';
  assert.equal(teleportContinuousCombatEnemy(enemy, 100, 6), 100);
  assert.equal(enemy.x, 280);
  enemy.x = 300;
  enemy.originX = 300;
  enemy.streamEngageX = 300;
  assert.equal(teleportContinuousCombatEnemy(enemy, 100, 7), 0);
  assert.equal(enemy.x, 300);
});

test('active arena displacement clamps against the three-screen world edge', () => {
  const enemy = { uid: 90, kind: 'enemy', hp: 10, streamState: 'engaged', arenaEnabled: true, x: 2110, y: 280, footX: 2110, footY: 280 };
  const source = { uid: 1, kind: 'hero', hp: 100, footX: 2055, footY: 280 };
  assert.equal(pushContinuousCombatEnemy(enemy, 55, 0, source), 10);
  assert.equal(enemy.footX, 2120);
  assert.equal(reverseContinuousCombatEnemy(enemy, 1, 1, source), true);
});

test('displacement preserves an active stationary impact and returns the enemy to its attack anchor', () => {
  const enemy = { uid: 74, kind: 'enemy', hp: 10, streamState: 'engaged', x: 200, originX: 200, originY: 210, streamEngageX: 200, streamWalkSpeed: 80, streamStartAt: 0 };
  const action = { uid: enemy.uid, active: true, stationary: true, state: 'HIT', timer: 0.2, nextReadyAt: 7 };
  const pendingImpact = { ownerUID: enemy.uid, impactAt: 1.2 };
  const stage = { ...createContinuousCombatStageState(3), lastUpdatedAt: 1 };
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: stage,
    RealtimeEnemyActionsByUID: { [enemy.uid]: action },
    PendingHeroHits: [pendingImpact],
    GamePhase: 'RUNTIME',
    time: 1,
  };

  assert.equal(pushContinuousCombatEnemy(enemy, 55, 1), 55);
  assert.equal(enemy.x, 255);
  assert.equal(enemy.streamEngageX, 200);
  globals.time = 1.1;
  enemy.x = enemy.originX;
  maybeAdvanceContinuousCombatStage({ globals, entities: [enemy], call() {} });
  assert.equal(enemy.originX, 255);
  assert.equal(enemy.x, 255);
  assert.equal(enemy.streamState, 'in_range');
  assert.equal(action.active, true);
  assert.equal(action.timer, 0.2);
  assert.equal(action.nextReadyAt, 7);
  assert.equal(globals.PendingHeroHits[0], pendingImpact);

  action.active = false;
  globals.time = 1.2;
  maybeAdvanceContinuousCombatStage({ globals, entities: [enemy], call() {} });
  assert.equal(enemy.streamEngageX, 200);
  assert.ok(enemy.x < 255);
});

test('Frost Reversal retreats on simulation time, blocks new enemy actions, and preserves pending impacts', () => {
  const stage = { ...createContinuousCombatStageState(4), lastUpdatedAt: 1 };
  const enemy = { uid: 72, kind: 'enemy', hp: 10, streamState: 'engaged', x: 200, originX: 200, originY: 210, streamEngageX: 200, streamWalkSpeed: 80, streamStartAt: 0 };
  const pendingHit = { uid: 9, targetUID: enemy.uid, impactAt: 1.3 };
  const globals = { ContinuousCombatStageLoop: 1, ContinuousCombatStage: stage, GamePhase: 'RUNTIME', time: 1, PendingHeroHits: [pendingHit] };
  assert.equal(reverseContinuousCombatEnemy(enemy, 1), true);
  assert.equal(enemy.streamState, 'retreating');
  let enemyActionCalls = 0;
  for (let step = 1; step <= 10; step += 1) {
    globals.time = 1 + step * 0.1;
    maybeAdvanceContinuousCombatStage({ globals, entities: [enemy], call(name) { if (name === 'TickRealtimeEnemyActions') enemyActionCalls += 1; } });
  }
  assert.equal(enemy.x, 280);
  assert.equal(enemy.streamState, 'retreating');
  assert.equal(enemyActionCalls, 0);
  assert.equal(globals.PendingHeroHits[0], pendingHit);

  for (let step = 11; step <= 14; step += 1) {
    globals.time = 1 + step * 0.1;
    maybeAdvanceContinuousCombatStage({ globals, entities: [enemy], call(name) { if (name === 'TickRealtimeEnemyActions') enemyActionCalls += 1; } });
    if (step === 12) assert.equal(enemy.streamState, 'retreating');
    if (step === 13) assert.equal(enemy.streamState, 'in_range');
  }
  assert.ok(enemy.x < 300, 'the enemy resumes its leftward approach after 1.25 seconds');
  assert.equal(enemy.streamState, 'in_range');
  assert.equal(globals.PendingHeroHits[0], pendingHit);
});

test('paused simulation time freezes a forced retreat', () => {
  const enemy = { uid: 73, kind: 'enemy', hp: 10, streamState: 'engaged', x: 200, originX: 200, streamEngageX: 200, streamWalkSpeed: 80, streamStartAt: 0 };
  assert.equal(reverseContinuousCombatEnemy(enemy, 2), true);
  const globals = { ContinuousCombatStageLoop: 1, ContinuousCombatStage: { ...createContinuousCombatStageState(1), lastUpdatedAt: 2 }, GamePhase: 'RUNTIME', time: 2, DevToolingPaused: 1 };
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities: [enemy], call() {} }), false);
  assert.equal(enemy.x, 200);
  assert.equal(enemy.streamState, 'retreating');
});

test('next dispersed wave follows the three-second emission interval', () => {
  for (const transitions of [0, 2]) {
  const globals = {
    EnemySize: 40, EnemyData: rows, time: 0, GamePhase: 'RUNTIME', BattleStartActive: 0,
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(1), wave: transitions + 1, transitions, awaitingPackArrival: true, nextEmissionAt: 10, lastUpdatedAt: 0.01 },
  };
  const enemy = activateContinuousCombatSpawnedEnemy(globals, { uid: 9, kind: 'enemy', name: 'Gobloc', hp: 100 }, { entryOrder: 0, packIndex: transitions, sectorIndex: 0 });
  const spawned = [];
  globals.time = 1;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities: [enemy], presentationBarrier: { lanes: {} }, call() {}, runCombatStep() {} }), false);
  assert.equal(globals.ContinuousCombatStage.nextEmissionAt, 10);
  enemy.hp = 0;
  globals.time = globals.ContinuousCombatStage.nextEmissionAt;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities: [enemy], presentationBarrier: { lanes: {} }, call(name, data, slotIndex) {
    if (name !== 'SpawnEnemy') return null;
    const actor = { uid: 20 + spawned.length, kind: 'enemy', hp: data.HP, name: data.name, slotIndex };
    spawned.push(actor);
    return actor;
  }, runCombatStep() {} }), true);
  assert.equal(globals.ContinuousCombatStage.wave, transitions + 2);
  assert.ok([12, 18].includes(spawned.length));
  assert.deepEqual(new Set(spawned.map(actor => actor.streamSectorIndex)).size, CONTINUOUS_COMBAT_PACKS_PER_WAVE);
  }
});

test('boss spawn accepts a world-space squad-relative home', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(1), bossActive: true, lastUpdatedAt: 0.9 },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 1, EnemySize: 40,
    EnemyData: rows, PendingDeaths: {}, ActionInProgress: 0, IsPlayerBusy: 0,
  };
  const boss = activateContinuousCombatSpawnedEnemy(globals, { kind: 'enemy', name: 'Troll', enemyRole: 'boss', hp: 10 }, { entryOrder: 0, bossX: 900 });
  assert.equal(boss.x, 900);
  assert.equal(boss.streamState, 'roaming');
  assert.equal(boss.streamEngageX, 900);
  assert.equal(boss.originY, 290);
  boss.x = 901;
  let resumed = 0;
  globals.time = 1.1;
  maybeAdvanceContinuousCombatStage({ globals, entities: [boss], presentationBarrier: { lanes: {} }, call(name) { if (name === 'TickRealtimeEnemyActions') resumed += 1; }, runCombatStep() {} });
  assert.equal(boss.streamState, 'roaming');
  assert.equal(boss.x, 901);
  assert.equal(boss.y, 290);
  assert.equal(resumed, 0);
  globals.time = 1.2;
  maybeAdvanceContinuousCombatStage({ globals, entities: [boss], presentationBarrier: { lanes: {} }, call() {}, runCombatStep() { resumed += 1; } });
  assert.equal(boss.x, 901);
  assert.equal(boss.y, 290);
});

test('engaged enemy cooldowns keep ticking while hero projectiles are in flight', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(1), bossActive: true },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 2,
    PendingHeroHits: [{ targetUID: 1 }], ActionInProgress: 1, IsPlayerBusy: 1,
  };
  const boss = { kind: 'enemy', hp: 10, streamState: 'engaged', x: 290, y: 290 };
  let enemyTimerChecks = 0;
  maybeAdvanceContinuousCombatStage({ globals, entities: [boss], presentationBarrier: { lanes: { pendingHeroHits: true } }, call(name) { if (name === 'TickRealtimeEnemyActions') enemyTimerChecks += 1; }, runCombatStep() { assert.fail('continuous enemy scheduling must not use ProcessTurn'); } });
  assert.equal(enemyTimerChecks, 1);
});

test('active per-enemy actions hold boss or wave clearance through their own impact', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(1), bossActive: true, bossAvailable: true, bossArmed: true },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 2,
    RealtimeEnemyActionsByUID: { 9: { uid: 9, active: true, state: 'HIT' } },
  };
  let settled = 0;
  maybeAdvanceContinuousCombatStage({ globals, entities: [], presentationBarrier: { lanes: {} }, call(name) { if (name === 'SettleContinuousCombatRewards') settled += 1; }, runCombatStep() {} });
  assert.equal(settled, 0);
  assert.equal(globals.ContinuousCombatStage.bossActive, true);
});

test('one compact pack keeps deterministic lanes and travel speeds', () => {
  const globals = { time: 3, EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 }, EnemySize: 40 };
  const enemies = [0, 1, 2].map(entryOrder => activateContinuousCombatSpawnedEnemy(
    globals,
    { kind: 'enemy', hp: 10 },
    { lane: entryOrder, entryOrder, sectorIndex: entryOrder },
  ));
  assert.deepEqual(enemies.map(enemy => enemy.streamStartAt), [3, 3, 3]);
  assert.ok(enemies[1].streamWalkSpeed < enemies[0].streamWalkSpeed);
  assert.ok(enemies[2].streamWalkSpeed > enemies[0].streamWalkSpeed);
  assert.equal(new Set(enemies.map(enemy => enemy.x)).size, 3);
  assert.equal(new Set(enemies.map(enemy => enemy.y)).size, 3);
  assert.deepEqual(enemies.map(enemy => enemy.streamState), ['roaming', 'roaming', 'roaming']);
});

test('melee and ranged packs preserve delivery tags inside the authored world', () => {
  const globals = {
    time: 0,
    EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 },
    EnemySize: 40,
    HeroRestBasePosByUID: { 1: { x: 68 }, 2: { x: 40 } },
  };
  const melee = activateContinuousCombatSpawnedEnemy(globals, { kind: 'enemy', hp: 10, ATK: 10, MAG: 2 }, { entryOrder: 0 });
  const farMelee = activateContinuousCombatSpawnedEnemy(globals, { kind: 'enemy', hp: 10, ATK: 10, MAG: 2 }, { entryOrder: 1 });
  const ranged = activateContinuousCombatSpawnedEnemy(globals, { kind: 'enemy', name: 'Djinn', hp: 10, ATK: 2, MAG: 10 }, { entryOrder: 2 });
  const laterRanged = activateContinuousCombatSpawnedEnemy(globals, { kind: 'enemy', name: 'Marid', hp: 10, ATK: 2, MAG: 10 }, { entryOrder: 2, rank: 4 });
  const highMagicMelee = activateContinuousCombatSpawnedEnemy(globals, { kind: 'enemy', name: 'Gobloc', hp: 10, ATK: 2, MAG: 99 }, { entryOrder: 0 });
  assert.equal(melee.streamDelivery, 'melee');
  assert.equal(melee.streamEngageX, melee.x);
  assert.equal(farMelee.streamEngageX, farMelee.x);
  assert.equal(ranged.streamDelivery, 'ranged');
  assert.equal(ranged.streamEngageX, ranged.x);
  assert.equal(laterRanged.streamEngageX, laterRanged.x);
  assert.equal(highMagicMelee.streamDelivery, 'melee');
});

test('six huddled packs keep their authored world anchors with bounded local footprints', () => {
  const globals = {
    time: 0,
    EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 },
    EnemySize: 40,
    HeroRestBasePosByUID: { 1: { x: 68 } },
  };
  const enemies = CONTINUOUS_COMBAT_SECTOR_RATIOS.flatMap((_, sectorIndex) => [0, 1].map(entryOrder => activateContinuousCombatSpawnedEnemy(
    globals,
    { kind: 'enemy', hp: 10, ATK: 10, MAG: 2 },
    { packIndex: 0, sectorIndex, entryOrder, lane: entryOrder },
  )));
  assert.equal(new Set(enemies.map(enemy => enemy.streamSectorIndex)).size, CONTINUOUS_COMBAT_PACKS_PER_WAVE);
  const world = deriveCombatWorldBounds();
  for (let sector = 0; sector < CONTINUOUS_COMBAT_PACKS_PER_WAVE; sector += 1) {
    const group = enemies.filter(enemy => enemy.streamSectorIndex === sector);
    assert.equal(group.length, 2);
    const expectedAnchor = world.worldWidth * CONTINUOUS_COMBAT_SECTOR_RATIOS[sector];
    assert.ok(Math.abs(group.reduce((sum, enemy) => sum + enemy.x, 0) / group.length - expectedAnchor) <= 58);
    assert.ok(Math.max(...group.map(enemy => enemy.x)) - Math.min(...group.map(enemy => enemy.x)) <= 116);
  }
  assert.ok(enemies[0].x < enemies[3].x && enemies[3].x < enemies[6].x);
});

test('ordinary six-member packs form repeatable compact two-dimensional clouds inside arena bounds', () => {
  const globals = {
    EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 }, EnemySize: 40,
    ContinuousCombatStage: createContinuousCombatStageState(3187),
  };
  const createPack = () => Array.from({ length: 6 }, (_, entryOrder) => activateContinuousCombatSpawnedEnemy(
    globals, { kind: 'enemy', hp: 10 }, { packIndex: 2, rank: 1, sectorIndex: 3, entryOrder, sectorSize: 6 },
  ));
  const pack = createPack();
  const repeated = createPack();
  assert.deepEqual(pack.map(enemy => [enemy.footX, enemy.footY]), repeated.map(enemy => [enemy.footX, enemy.footY]));
  const vertical = deriveCombatWorldVerticalBounds();
  assert.ok(pack.every(enemy => enemy.x >= 0 && enemy.x <= 2160));
  assert.ok(pack.every(enemy => enemy.y >= vertical.minY + 32 && enemy.y <= vertical.maxY - 32));
  assert.ok(Math.max(...pack.map(enemy => enemy.x)) - Math.min(...pack.map(enemy => enemy.x)) <= 116);
  assert.ok(Math.max(...pack.map(enemy => enemy.y)) - Math.min(...pack.map(enemy => enemy.y)) <= 116);
  for (let left = 0; left < pack.length; left += 1) {
    for (let right = left + 1; right < pack.length; right += 1) {
      assert.ok(Math.hypot(pack[left].x - pack[right].x, pack[left].y - pack[right].y) >= 22);
    }
  }
  const triangleArea = (a, b, c) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
  const largestTriangle = Math.max(...pack.flatMap((a, i) => pack.slice(i + 1).flatMap((b, j) => pack.slice(i + j + 2).map(c => triangleArea(a, b, c)))));
  assert.ok(largestTriangle > 200, 'the cluster occupies a real 2D area instead of forming a line or stair');
  assert.ok(new Set(pack.map(enemy => `${enemy.x},${enemy.y}`)).size === pack.length);
});

test('two-to-six member clouds stay separated at the top and bottom sector anchors', () => {
  const vertical = deriveCombatWorldVerticalBounds();
  for (const sectorIndex of [0, 5]) {
    for (let sectorSize = 2; sectorSize <= 6; sectorSize += 1) {
      const globals = { EnemySize: 40, ContinuousCombatStage: createContinuousCombatStageState(44) };
      const pack = Array.from({ length: sectorSize }, (_, entryOrder) => activateContinuousCombatSpawnedEnemy(
        globals, { kind: 'enemy', hp: 10 }, { packIndex: 1, sectorIndex, entryOrder, sectorSize },
      ));
      assert.ok(pack.every(enemy => enemy.y >= vertical.minY + 32 && enemy.y <= vertical.maxY - 32));
      assert.ok(Math.max(...pack.map(enemy => enemy.x)) - Math.min(...pack.map(enemy => enemy.x)) <= 116);
      assert.ok(Math.max(...pack.map(enemy => enemy.y)) - Math.min(...pack.map(enemy => enemy.y)) <= 116);
      for (let left = 0; left < pack.length; left += 1) {
        for (let right = left + 1; right < pack.length; right += 1) {
          assert.ok(Math.hypot(pack[left].x - pack[right].x, pack[left].y - pack[right].y) >= 22);
        }
      }
    }
  }
});

test('each wave clears before the next emission and retains the three-second minimum interval', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(9), nextEmissionAt: 7, lastUpdatedAt: 0, spawnSerial: 5 },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 7,
    EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 }, EnemySize: 40,
    EnemyData: rows, EnemySlots: [2, 3, 4], PendingDeaths: {}, ProgressionBattle: { outcome: 'active', settled: false },
  };
  const survivor = { uid: 1, kind: 'enemy', hp: 10, streamState: 'engaged', slotIndex: 0 };
  const entities = [survivor];
  const spawned = [];
  const call = (name, data, slotIndex) => {
    if (name !== 'SpawnEnemy') return null;
    const enemy = { uid: 10 + spawned.length, kind: 'enemy', hp: data.HP, maxHP: data.HP, name: data.name, slotIndex };
    entities.push(enemy);
    spawned.push(enemy);
    return enemy;
  };
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: { flowOrbs: true } }, call, runCombatStep() {} }), false);
  survivor.hp = 0;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: { flowOrbs: true } }, call, runCombatStep() {} }), true);
  assert.ok([12, 18].includes(spawned.length));
  assert.equal(new Set(spawned.map(enemy => enemy.streamSectorIndex)).size, CONTINUOUS_COMBAT_PACKS_PER_WAVE);
  assert.equal(globals.ContinuousCombatStage.wave, 2);
  assert.ok(entities.some(enemy => enemy.uid === survivor.uid));

  globals.time = 9;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), false);
  globals.time = 10;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), false);
  spawned.forEach(enemy => { enemy.hp = 0; });
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), true);
  assert.equal(globals.ContinuousCombatStage.wave, 3);
  globals.time = 12;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), false);
  globals.time = 13;
  spawned.forEach(enemy => { enemy.hp = 0; });
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), true);
  assert.equal(globals.ContinuousCombatStage.wave, 4);
  globals.time = 16;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), false);
  assert.equal(globals.ContinuousCombatStage.wave, 4);
  spawned.forEach(enemy => { enemy.hp = 0; });
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), true);
  assert.equal(globals.ContinuousCombatStage.bossAvailable, true);
});

test('boss click removes living fodder and pending actions before immediate boss spawn', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(9), wave: 2, bossAvailable: true, bossArmed: false, nextEmissionAt: 99 },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 7,
    EnemySize: 40, EnemyData: rows, EnemySlots: [999], PendingDeaths: {}, ProgressionBattle: { outcome: 'active', settled: false },
  };
  const entities = [{uid:999,kind:'enemy',hp:100}];
  globals.PendingHeroHits=[{targetUID:999}];globals.RealtimeEnemyActionsByUID={999:{active:true}};
  const spawned = [];
  const call = (name, data, slotIndex) => {
    if (name === 'SettleContinuousCombatRewards') return [];
    if (name !== 'SpawnEnemy') return null;
    const enemy = { uid: 20, kind: 'enemy', hp: data.HP, maxHP: data.HP, name: data.name, enemyRole: data.enemyRole, slotIndex };
    entities.push(enemy);
    spawned.push(enemy);
    return enemy;
  };
  assert.equal(armContinuousCombatBoss(globals,entities,call),true);
  assert.deepEqual(globals.PendingHeroHits,[]);assert.deepEqual(globals.RealtimeEnemyActionsByUID,{});assert.ok(!entities.some(e=>e.uid===999));
  assert.equal(globals.ContinuousCombatStage.bossActive, true);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].name, 'Troll');
  assert.equal(spawned[0].enemyRole, 'boss');
  assert.equal(spawned[0].streamEngageX, globals.ContinuousCombatStage.bossWorldX);
  assert.equal(spawned[0].originY, 290);
});

test('boss entry stages an edge-bound party into a fixed left-heroes right-boss scene without changing roam orientation', () => {
  const world = deriveCombatWorldBounds();
  for (const startX of [world.heroMinX, world.heroMaxX]) {
    const heroes = Array.from({ length: 4 }, (_, index) => ({
      uid: index + 1, kind: 'hero', hp: 100, footX: startX + (startX === world.heroMinX ? index * 8 : -index * 8),
      x: startX, footY: 250 + index * 12, y: 250 + index * 12,
    }));
    const globals = { ContinuousCombatStageLoop: 1, ContinuousCombatStage: { ...createContinuousCombatStageState(19), bossAvailable: true },
      EnemyData: rows, EnemySize: 40, time: 7, CombatOrientation: 'right-wise' };
    const entities = heroes.slice();
    let boss;
    const call = (name, data, slotIndex) => {
      if (name === 'SpawnEnemy') {
        boss = { uid: 99, kind: 'enemy', hp: data.HP, maxHP: data.HP, enemyRole: data.enemyRole, name: data.name, slotIndex };
        entities.push(boss);
        return boss;
      }
      return [];
    };
    assert.equal(armContinuousCombatBoss(globals, entities, call, { wallNowMs: 1000 }), true);
    assert.equal(globals.CombatOrientation, 'right-wise', 'boss presentation leaves the saved roam preference untouched');
    const leftwise = createCombatCameraProjection({ viewportWidth: 360, worldWidth: world.worldWidth, zoom: 0.5,
      centerX: globals.ContinuousCombatStage.bossCameraCenterX, orientation: 'left-wise' });
    const heroX = leftwise.project(heroes.reduce((sum, hero) => sum + hero.footX, 0) / heroes.length, 250, 'hero').x;
    const bossX = leftwise.project(boss.footX, boss.footY, 'enemy').x;
    assert.ok(heroX < bossX, 'heroes stay left of the boss at either world edge');
    assert.ok(heroX > 0 && bossX < 360, 'both sides fit inside the fixed viewport');
    assert.ok(Math.max(...heroes.map(hero => hero.footX)) - Math.min(...heroes.map(hero => hero.footX)) < 40,
      'edge staging preserves the party formation span');
  }
});

test('nearby pack engagement wakes the cooldown scheduler', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(1), awaitingPackArrival: true, nextEmissionAt: 99, lastUpdatedAt: 0, lastArenaUpdatedAt: 0, spawnSerial: 1 },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 0,
    EnemyAreaRect: { minX: 160, maxX: 200, minY: 60, maxY: 180 }, EnemySize: 40,
    EnemyData: rows, EnemySlots: [2], PendingDeaths: {}, ActionInProgress: 0, IsPlayerBusy: 1, DeferAdvance: 1,
  };
  const enemy = activateContinuousCombatSpawnedEnemy(globals, { uid: 1, kind: 'enemy', hp: 10 }, { lane: 1, entryOrder: 0, sectorIndex: 0 });
  const hero = { uid: 2, kind: 'hero', hp: 100, attackType: 'melee', footX: enemy.x - 40, footY: enemy.y };
  globals.ContinuousCombatStage.lastUpdatedAt = 0.9;
  globals.time = 1;
  let resumed = 0;
  maybeAdvanceContinuousCombatStage({ globals, entities: [hero, enemy], presentationBarrier: { lanes: {} }, call(name) { if (name === 'TickRealtimeEnemyActions') resumed += 1; }, runCombatStep() {} });
  assert.equal(enemy.streamState, 'engaged');
  assert.equal(enemy.arenaInReach, true);
  assert.equal(globals.ContinuousCombatStage.nextEmissionAt, 99);
  assert.equal(resumed, 1);
});

test('heroes leave remote roaming packs dormant until local detection', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(1), nextEmissionAt: 99, lastUpdatedAt: 0.9, spawnSerial: 1 },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 1,
    EnemySize: 40, EnemyData: rows, EnemySlots: [2], PendingDeaths: {}, ActionInProgress: 0, IsPlayerBusy: 0,
  };
  const hero = { uid: 2, kind: 'hero', hp: 100, footX: 60, footY: 270 };
  const enemy = activateContinuousCombatSpawnedEnemy(globals, { uid: 1, kind: 'enemy', hp: 10 }, { lane: 1, entryOrder: 0, sectorIndex: 2 });
  const farX = enemy.x;
  let resumed = 0;
  maybeAdvanceContinuousCombatStage({ globals, entities: [hero, enemy], presentationBarrier: { lanes: {} }, call(name) { if (name === 'TickRealtimeEnemyActions') resumed += 1; }, runCombatStep() {} });
  assert.equal(enemy.streamState, 'roaming');
  assert.equal(enemy.x, farX);
  assert.equal(resumed, 0);
});

test('queryless production centers only the fresh continuous party in B and disables AF', () => {
  const globals = { EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 }, EnemySize: 40 };
  assert.equal(configureContinuousCombatProduction(globals, { productionPath: true }), true);
  assert.equal(globals.RealtimeHeroFocusTargetUID, 0);
  const heroes = Array.from({ length: 4 }, (_, index) => ({ kind: 'hero', uid: index + 1, hp: 100, flow: 100, flowReady: true }));
  const enemies = Array.from({ length: 6 }, (_, entryOrder) => ({
    kind: 'enemy', uid: 20 + entryOrder, hp: 20, slotIndex: entryOrder,
    continuousStageSectorIndex: 2, continuousStageEntryOrder: entryOrder,
    continuousStageSectorSize: 6, continuousStagePackIndex: 3,
  }));
  const entities = [...heroes, ...enemies];
  assert.equal(finalizeContinuousCombatProduction(globals, entities), true);
  assert.ok(heroes.every(hero => hero.flow === 0));
  assert.equal(heroes.reduce((sum, hero) => sum + hero.footX, 0) / heroes.length, 1080);
  assert.ok(heroes.every(hero => hero.footX >= 720 && hero.footX <= 1440));
  assert.ok(Math.abs(Math.max(...heroes.map(hero => hero.footX)) - Math.min(...heroes.map(hero => hero.footX)) - 52.8) < 1e-9);
  assert.ok(enemies.every(enemy => enemy.streamState === 'roaming'));
  assert.ok(Math.max(...enemies.map(enemy => enemy.x)) - Math.min(...enemies.map(enemy => enemy.x)) <= 116,
    'the production finalizer routes existing enemies through the shared clustered placement owner');
  assert.equal(globals.ContinuousCombatStage.nextEmissionAt, 3);
  advanceContinuousCombatArena({ globals, entities: heroes, seconds: 0 });
  assert.ok(heroes.every(hero => Number.isFinite(hero.footY)), 'first arena tick completes finite world feet from the same fresh-entry fixture');
  assert.equal(heroes.reduce((sum, hero) => sum + hero.footX, 0) / heroes.length, 1080);
});

test('production finalization preserves an already-positioned continuous party', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: createContinuousCombatStageState(3),
    time: 0,
  };
  const heroes = [
    { kind: 'hero', uid: 1, footX: 880, footY: 250 },
    { kind: 'hero', uid: 2, footX: 920, footY: 270 },
  ];
  assert.equal(finalizeContinuousCombatProduction(globals, heroes), true);
  assert.deepEqual(heroes.map(hero => [hero.footX, hero.footY]), [[880, 250], [920, 270]]);
});

test('production traversal visits six sectors before wave clear advances the stage', () => {
  const heroes = Array.from({ length: 4 }, (_, index) => ({ uid: index + 1, kind: 'hero', hp: 1000, maxHP: 1000, footX: 100 + index * 6, footY: 220 + index * 18 }));
  const initialPlan = buildContinuousCombatSpawnPlan(rows, createContinuousCombatStageState(7));
  const enemies = initialPlan.map((entry, index) => ({ uid: 20 + index, kind: 'enemy', hp: 100, maxHP: 100, slotIndex: index }));
  const entities = [...heroes, ...enemies];
  const globals = {
    ContinuousCombatStageLoop: 1, ContinuousCombatStage: createContinuousCombatStageState(7),
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 0, EnemySize: 40, EnemyData: rows,
    EncounterMaxSlots: 9, EnemySlots: enemies.map(enemy => enemy.uid + 1), EnemyIDs: enemies.map(enemy => enemy.uid), PendingDeaths: {}, EnemyDeathVisualHoldByUID: {},
    ProgressionBattle: { outcome: 'active', settled: false },
  };
  assert.equal(finalizeContinuousCombatProduction(globals, entities), true);
  const discovered = new Set();
  const spawnSlotArguments = [];
  let nextUid = 100;
  const call = (name, data, slotIndex) => {
    if (name !== 'SpawnEnemy') return null;
    const enemy = { uid: nextUid++, kind: 'enemy', hp: data.HP, maxHP: data.HP, name: data.name, enemyRole: data.enemyRole, slotIndex };
    spawnSlotArguments.push(slotIndex);
    globals.EnemyIDs[slotIndex] = enemy.uid;
    globals.EnemySlots[slotIndex] = enemy.uid + 1;
    entities.push(enemy);
    return enemy;
  };
  for (let tick = 0; tick <= 700 && globals.ContinuousCombatStage.wave === 1; tick += 1) {
    globals.time = tick / 10;
    maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} });
    for (const enemy of enemies) {
      if (enemy.hp > 0 && enemy.streamState !== 'roaming') {
        discovered.add(enemy.streamSectorIndex);
        enemy.hp = 0;
      }
    }
  }
  assert.deepEqual([...discovered].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  assert.equal(globals.ContinuousCombatStage.wave, 2);
  assert.ok(globals.time >= CONTINUOUS_COMBAT_PACK_INTERVAL_SEC);
  assert.ok(entities.some(enemy => enemy.kind === 'enemy' && enemy.hp > 0 && enemy.streamState === 'roaming'), 'next wave remains remote and dormant after the clear');

  for (const expectedWave of [2, 3, 4]) {
    const activeWave = entities.filter(enemy => enemy.kind === 'enemy' && enemy.hp > 0);
    const sectorCounts = new Map();
    for (const enemy of activeWave) {
      const count = sectorCounts.get(enemy.streamSectorIndex) || 0;
      sectorCounts.set(enemy.streamSectorIndex, count + 1);
    }
    assert.ok(activeWave.length >= 12 && activeWave.length <= CONTINUOUS_COMBAT_ENEMIES_PER_WAVE_MAX);
    assert.equal(sectorCounts.size, CONTINUOUS_COMBAT_PACKS_PER_WAVE);
    assert.ok([...sectorCounts.values()].every(count => count >= 2 && count <= 6));
    assert.ok(activeWave.every(enemy => enemy.slotIndex >= 0 && enemy.slotIndex < CONTINUOUS_COMBAT_ENEMIES_PER_WAVE_MAX));
    activeWave.forEach(enemy => { enemy.hp = 0; globals.EnemyIDs[enemy.slotIndex] = 0; globals.EnemySlots[enemy.slotIndex] = 0; });
    const priorSpawnCount = spawnSlotArguments.length;
    globals.time = globals.ContinuousCombatStage.nextEmissionAt;
    assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), true);
    const emitted = spawnSlotArguments.slice(priorSpawnCount);
    if (expectedWave === 4) {
      assert.deepEqual(emitted, [0], 'the fourth clear enters the boss without another fodder wave');
      assert.equal(globals.ContinuousCombatStage.bossActive, true);
    } else {
    assert.ok(emitted.length >= 12 && emitted.length <= CONTINUOUS_COMBAT_ENEMIES_PER_WAVE_MAX);
    }
    assert.deepEqual(emitted, emitted.map((_, slotIndex) => slotIndex), 'each new wave reuses its fixed slot range');
    assert.ok(emitted.every(slotIndex => slotIndex >= 0 && slotIndex < CONTINUOUS_COMBAT_ENEMIES_PER_WAVE_MAX));
    assert.ok(globals.EnemySlots.length <= CONTINUOUS_COMBAT_ENEMIES_PER_WAVE_MAX);
    if (expectedWave < 4) assert.equal(globals.ContinuousCombatStage.wave, expectedWave + 1);
  }
  assert.equal(globals.ContinuousCombatStage.wave, 1);
  assert.equal(globals.ContinuousCombatStage.bossAvailable, true);
  assert.equal(globals.ContinuousCombatStage.bossActive, true);
  assert.deepEqual(entities.filter(enemy => enemy.kind === 'enemy').map(enemy => [enemy.name, enemy.slotIndex]), [['Troll', 0]]);
  assert.ok(globals.EnemySlots.length <= CONTINUOUS_COMBAT_ENEMIES_PER_WAVE_MAX);
});

test('runtime source targets in-range walkers while keeping them out of the enemy scheduler', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');
  const heroCommands = fs.readFileSync(new URL('../web-runner/modules/heroCommands.mjs', import.meta.url), 'utf8');
  assert.match(source, /e\.streamState !== 'approaching'/);
  assert.match(source, /enemy\.streamState && enemy\.streamState !== 'engaged'/);
  assert.doesNotMatch(source, /stationary: enemy\.streamState === 'engaged'/);
  assert.match(source, /stationary: Number\(g\.ContinuousCombatStageLoop \|\| 0\) === 1 \|\| profile === 'ranged'/);
  assert.match(source, /stationary: continuousCombat \|\| \/\^Enemy_Heal_/);
  assert.match(source, /forwardX: originX/);
  assert.match(source, /selectionEnabled: targetAvailable/);
  assert.match(source, /actorRoster\.eligible\.filter\(actor => Number\(actor\.type \|\| 0\) === 1\)/);
  assert.match(source, /export function TickRealtimeHeroBasics/);
  assert.match(source, /hit\.realtimeBasic = 1/);
  assert.match(heroCommands, /noLivingEnemy&&streamComplete/);
  assert.match(source, /Number\(astralFlowAward\?\.spawned \|\| 0\) > 0 && markEnemyDeathVisualHold/);
  const renderer = fs.readFileSync(new URL('../web-runner/systems/renderRuntime.js', import.meta.url), 'utf8');
  const simulationTick = fs.readFileSync(new URL('../web-runner/systems/combatSimulationTick.mjs', import.meta.url), 'utf8');
  const stage = fs.readFileSync(new URL('../web-runner/src/core/continuousCombatStage.mjs', import.meta.url), 'utf8');
  assert.match(renderer, /enemiesToDraw = .*\.sort\(\(a, b\) => Number\(b\.y/);
  assert.match(simulationTick, /const completeEnemyTurn =/);
  assert.match(simulationTick, /delete actionMap\[key\]/);
  assert.doesNotMatch(simulationTick.slice(simulationTick.indexOf('export function advanceEnemyActionSimulation')), /callFunctionWithContext\(fnContext, 'AdvanceTurn'\)/);
  assert.match(simulationTick, /!pendingHit && !pendingImpact && !pendingBloom && \(Number\(state\.globals\.ContinuousCombatStageLoop/);
  assert.match(stage, /call\('TickRealtimeEnemyActions'\)/);
  assert.doesNotMatch(stage, /runCombatStep\('ProcessTurn'\)/);
});

test('engaged enemies select only a living hero inside their actor-relative reach', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');
  const targeter = source.slice(source.indexOf('function pickEnemyTargetHero('), source.indexOf('function applyRunaMagicResist('));
  assert.match(targeter, /enemy\?\.streamState !== 'engaged' \|\| enemy\.arenaInReach === false/);
  assert.match(targeter, /selectContinuousEnemyTarget\(\{[\s\S]*requireInReach: true/);
  assert.doesNotMatch(targeter, /HeroRestBasePosByUID|visibleBottomY/);
});

test('continuous scheduler rejects a stale hero claim before selecting an engaged enemy', async () => {
  const { readFileSync } = await import('node:fs');
  for (const path of ['../web-runner/modules/functionBank.js', '../Scripts/functionBank.js']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const scheduler = source.slice(source.indexOf('export function ProcessTurn(ctx)'), source.indexOf('function isBoardFullyPopulatedForEnemyMutation'));
    assert.match(scheduler, /current\?\.type === 1/);
    assert.match(scheduler, /state\.readyAt\?\.\[String\(current\.uid\)\] !== Number\.MAX_SAFE_INTEGER/);
    assert.match(scheduler, /state\.current = null/);
  }
});


test('the introductory boss stays damageable and gives the default frontline time to fight', async () => {
  const { readFileSync } = await import('node:fs');
  const { scaleRoutineEnemy } = await import('../web-runner/src/core/routineEnemyScaling.mjs');
  const { calculateDamageFromJs } = await import('../web-runner/src/core/calculateDamageRules.mjs');
  const { HERO_DEFINITIONS } = await import('../web-runner/src/core/heroDefinitions.mjs');
  const { realtimeCooldownSeconds } = await import('../web-runner/src/core/realtimeCooldown.mjs');
  const data = JSON.parse(readFileSync(new URL('../web-runner/assets/enemies.json', import.meta.url))).data;
  const catalog = data[0].slice(1).map((_, i) => Object.fromEntries(data.map(column => [column[0][0], column[i + 1][0]])))
    .filter(row => row.name).map(row => scaleRoutineEnemy(row, 1));
  const boss = buildContinuousCombatSpawnPlan(catalog, { region: 1, stage: 1, wave: 4, bossActive: true })[0].row;
  assert.equal(boss.HP, 231);
  assert.equal(boss.ATK, 20);
  for (const [key, stat, resist] of [['Huun', 'ATK', 'DEF'], ['Runa', 'MAG', 'RES']]) {
    assert.ok(calculateDamageFromJs({ power: HERO_DEFINITIONS[key].baseStats[stat], resist: boss[resist] }).damage > 0);
  }
  const tank = HERO_DEFINITIONS.Falie.baseStats;
  const criticalHit = calculateDamageFromJs({ power: boss.ATK, resist: tank.DEF, critRoll01: 0 }).damage;
  const survival = (Math.ceil(tank.HP / criticalHit) - 1) * realtimeCooldownSeconds({ ...boss, type: 1, enemyRole: 'boss', attackDelivery: 'melee' });
  assert.ok(survival >= 10, `fresh Fara survives at least10seconds even if every hit crits: ${survival}`);
});
