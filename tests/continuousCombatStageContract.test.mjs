import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTINUOUS_COMBAT_PACK_CP_STEP,
  CONTINUOUS_COMBAT_STAGES,
  activateContinuousCombatSpawnedEnemy,
  advanceContinuousCombatStage,
  armContinuousCombatBoss,
  buildContinuousCombatSpawnPlan,
  configureContinuousCombatProduction,
  createContinuousCombatStageState,
  finalizeContinuousCombatProduction,
  maybeAdvanceContinuousCombatStage,
  resetContinuousCombatAfterDefeat,
  scaleContinuousCombatPackRow,
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
  }
});

test('wave size falls from five to four to three as average enemy CP rises', () => {
  const start = createContinuousCombatStageState(42);
  const first = buildContinuousCombatSpawnPlan(rows, start);
  const secondState = advanceContinuousCombatStage(start).state;
  const second = buildContinuousCombatSpawnPlan(rows, secondState, { slotBase: 5 });
  const thirdState = advanceContinuousCombatStage(secondState).state;
  const third = buildContinuousCombatSpawnPlan(rows, thirdState, { slotBase: 9 });
  assert.deepEqual([first.length, second.length, third.length], [5, 4, 3]);
  assert.deepEqual(first.map(entry => entry.lane), [1, 0, 2, 0, 2]);
  assert.deepEqual(first.map(entry => entry.slotIndex), [0, 1, 2, 3, 4]);
  assert.deepEqual(second.map(entry => entry.slotIndex), [5, 6, 7, 8]);
  assert.ok(second.some(entry => ['Gobloc', 'Skeleton'].includes(entry.row.name)));
  assert.ok(second.some(entry => ['High Gobloc', 'Lizardo'].includes(entry.row.name)));
  const totals = [first, second, third].map(pack => pack.reduce((sum, entry) => sum + entry.row.CombatPower, 0));
  assert.ok(totals[0] < totals[1]);
  assert.ok(totals[1] < totals[2]);
  assert.ok(totals[1] / totals[0] < 1 + CONTINUOUS_COMBAT_PACK_CP_STEP * 2);
  assert.ok(totals[2] / totals[1] < 1 + CONTINUOUS_COMBAT_PACK_CP_STEP * 2);
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
  assert.ok(total(bossPlan) > total(latePlan));
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
  assert.equal(transition.state.bossArmed, true);
  assert.equal(transition.state.bossAvailable, false);
  assert.equal(transition.state.clearedBosses, 1);
});

test('boss control arms only at the gate and defeat resets the current stage', () => {
  const globals = { time: 12, ContinuousCombatStage: createContinuousCombatStageState(42, { region: 2, stage: 4 }) };
  assert.equal(armContinuousCombatBoss(globals), false);
  globals.ContinuousCombatStage.bossAvailable = true;
  assert.equal(armContinuousCombatBoss(globals), true);
  assert.equal(globals.ContinuousCombatStage.bossArmed, true);
  assert.equal(resetContinuousCombatAfterDefeat(globals), true);
  assert.equal(globals.ContinuousCombatStage.region, 2);
  assert.equal(globals.ContinuousCombatStage.stage, 4);
  assert.equal(globals.ContinuousCombatStage.wave, 1);
  assert.equal(globals.ContinuousCombatStage.bossAvailable, false);
  assert.equal(globals.ContinuousCombatStage.bossArmed, false);
});

test('stream enemies begin off-stage and become engaged only after walking to the boundary', () => {
  const globals = { EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 }, EnemySize: 40 };
  const enemy = activateContinuousCombatSpawnedEnemy(globals, { kind: 'enemy', hp: 10 }, { lane: 1, rank: 0, packIndex: 0 });
  assert.equal(enemy.streamState, 'approaching');
  assert.ok(enemy.x > 360);
  assert.ok(enemy.y >= 190 && enemy.y <= 355);
  assert.equal(enemy.streamEngageX, 130);
  assert.equal(enemy.streamWalkSpeed, Math.max(34, 40 * 0.9) * 0.7 * 0.9);
});

test('boss walks to its own home and holds position for attacks', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(1), bossActive: true, lastUpdatedAt: 0.9 },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 1, EnemySize: 40,
    EnemyData: rows, PendingDeaths: {}, ActionInProgress: 0, IsPlayerBusy: 0,
  };
  const boss = activateContinuousCombatSpawnedEnemy(globals, { kind: 'enemy', name: 'Troll', enemyRole: 'boss', hp: 10 }, { entryOrder: 0 });
  assert.ok(boss.x > 360);
  assert.equal(boss.streamEngageX, 290);
  assert.equal(boss.originY, 290);
  boss.x = 291;
  let resumed = 0;
  globals.time = 1.1;
  maybeAdvanceContinuousCombatStage({ globals, entities: [boss], presentationBarrier: { lanes: {} }, call() {}, runCombatStep() { resumed += 1; } });
  assert.equal(boss.streamState, 'engaged');
  assert.equal(boss.x, 290);
  assert.equal(boss.y, 290);
  assert.equal(resumed, 1);
  globals.time = 1.2;
  maybeAdvanceContinuousCombatStage({ globals, entities: [boss], presentationBarrier: { lanes: {} }, call() {}, runCombatStep() { resumed += 1; } });
  assert.equal(boss.x, 290);
  assert.equal(boss.y, 290);
});

test('engaged enemy cooldowns keep ticking while hero projectiles are in flight', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(1), bossActive: true },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 2,
    PendingHeroHits: [{ targetUID: 1 }], ActionInProgress: 0, IsPlayerBusy: 0,
  };
  const boss = { kind: 'enemy', hp: 10, streamState: 'engaged', x: 290, y: 290 };
  let enemyTimerChecks = 0;
  maybeAdvanceContinuousCombatStage({ globals, entities: [boss], presentationBarrier: { lanes: { pendingHeroHits: true } }, call() {}, runCombatStep() { enemyTimerChecks += 1; } });
  assert.equal(enemyTimerChecks, 1);
});

test('five-enemy packs enter with deterministic stagger instead of marching in unison', () => {
  const globals = { time: 3, EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 }, EnemySize: 40 };
  const enemies = [0, 1, 2, 3, 4].map(entryOrder => activateContinuousCombatSpawnedEnemy(
    globals,
    { kind: 'enemy', hp: 10 },
    { lane: entryOrder, entryOrder },
  ));
  assert.deepEqual(enemies.map(enemy => enemy.streamStartAt), [3, 3.4, 3.92, 4.48, 5.12]);
  assert.ok(enemies[1].streamWalkSpeed < enemies[0].streamWalkSpeed);
  assert.ok(enemies[2].streamWalkSpeed > enemies[0].streamWalkSpeed);
  assert.equal(new Set(enemies.map(enemy => enemy.x)).size, 1);
  assert.equal(new Set(enemies.map(enemy => enemy.y)).size, 5);
  assert.ok(enemies.every(enemy => enemy.y >= 190 && enemy.y <= 355));
});

test('melee and ranged enemies stop inside their annotated home bands', () => {
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
  assert.equal(melee.streamEngageX, 130);
  assert.equal(farMelee.streamEngageX, 130);
  assert.equal(ranged.streamDelivery, 'ranged');
  assert.equal(ranged.streamEngageX, 254);
  assert.equal(laterRanged.streamEngageX, 254);
  assert.equal(highMagicMelee.streamDelivery, 'melee');
});

test('overlapping packs share one emitter and retain distinct bounded Y positions', () => {
  const globals = {
    time: 0,
    EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 },
    EnemySize: 40,
    HeroRestBasePosByUID: { 1: { x: 68 } },
  };
  const enemies = [0, 1, 2].flatMap(packIndex => [0, 1, 2].map(entryOrder => activateContinuousCombatSpawnedEnemy(
    globals,
    { kind: 'enemy', hp: 10, ATK: 10, MAG: 2 },
    { packIndex, entryOrder, lane: entryOrder },
  )));
  assert.equal(new Set(enemies.map(enemy => enemy.x)).size, 1);
  assert.equal(new Set(enemies.map(enemy => enemy.streamEngageX)).size, 1);
  assert.equal(new Set(enemies.map(enemy => enemy.y)).size, enemies.length);
  for (let left = 0; left < enemies.length; left += 1) {
    for (let right = left + 1; right < enemies.length; right += 1) {
      assert.ok(Math.abs(enemies[left].y - enemies[right].y) > 0.5);
    }
  }
});

test('timed packs emit while survivors remain and the fourth pack waits for a clear field', () => {
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
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: { flowOrbs: true } }, call, runCombatStep() {} }), true);
  assert.equal(spawned.length, 4);
  assert.equal(globals.ContinuousCombatStage.wave, 2);
  assert.ok(entities.some(enemy => enemy.uid === survivor.uid));

  globals.time = 17;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), true);
  assert.equal(globals.ContinuousCombatStage.wave, 3);
  globals.time = 27;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), true);
  assert.equal(globals.ContinuousCombatStage.wave, 4);
  globals.time = 40;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), false);
  assert.equal(globals.ContinuousCombatStage.wave, 4);
});

test('an armed available gate replaces the next farming pack with the boss after clear', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(9), wave: 2, bossAvailable: true, bossArmed: true, nextEmissionAt: 99 },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 7,
    EnemySize: 40, EnemyData: rows, EnemySlots: [999], PendingDeaths: {}, ProgressionBattle: { outcome: 'active', settled: false },
  };
  const entities = [];
  const spawned = [];
  const call = (name, data, slotIndex) => {
    if (name === 'SettleContinuousCombatRewards') return [];
    if (name !== 'SpawnEnemy') return null;
    const enemy = { uid: 20, kind: 'enemy', hp: data.HP, maxHP: data.HP, name: data.name, enemyRole: data.enemyRole, slotIndex };
    entities.push(enemy);
    spawned.push(enemy);
    return enemy;
  };
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), true);
  assert.equal(globals.ContinuousCombatStage.bossActive, true);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].name, 'Troll');
  assert.equal(spawned[0].enemyRole, 'boss');
  assert.equal(spawned[0].streamEngageX, 290);
  assert.equal(spawned[0].originY, 290);
});

test('walking completes deterministically and wakes the cooldown scheduler', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(1), nextEmissionAt: 99, lastUpdatedAt: 0, spawnSerial: 1 },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 0,
    EnemyAreaRect: { minX: 160, maxX: 200, minY: 60, maxY: 180 }, EnemySize: 40,
    EnemyData: rows, EnemySlots: [2], PendingDeaths: {}, ActionInProgress: 0, IsPlayerBusy: 0,
  };
  const enemy = activateContinuousCombatSpawnedEnemy(globals, { uid: 1, kind: 'enemy', hp: 10 }, { lane: 1, entryOrder: 0 });
  enemy.x = enemy.streamEngageX + 1;
  globals.ContinuousCombatStage.lastUpdatedAt = 0.9;
  globals.time = 1;
  let resumed = 0;
  maybeAdvanceContinuousCombatStage({ globals, entities: [enemy], presentationBarrier: { lanes: {} }, call() {}, runCombatStep(name) { if (name === 'ProcessTurn') resumed += 1; } });
  assert.equal(enemy.streamState, 'engaged');
  assert.equal(enemy.x, enemy.streamEngageX);
  assert.equal(globals.ContinuousCombatStage.nextEmissionAt, 11);
  assert.equal(resumed, 1);
});

test('heroes can target an approaching enemy after it crosses the cyan range line', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(1), nextEmissionAt: 99, lastUpdatedAt: 0.9, spawnSerial: 1 },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 1,
    EnemySize: 40, EnemyData: rows, EnemySlots: [2], PendingDeaths: {}, ActionInProgress: 0, IsPlayerBusy: 0,
  };
  const enemy = activateContinuousCombatSpawnedEnemy(globals, { uid: 1, kind: 'enemy', hp: 10 }, { lane: 1, entryOrder: 0 });
  enemy.x = 331;
  let resumed = 0;
  maybeAdvanceContinuousCombatStage({ globals, entities: [enemy], presentationBarrier: { lanes: {} }, call() {}, runCombatStep(name) { if (name === 'ProcessTurn') resumed += 1; } });
  assert.equal(enemy.streamState, 'in_range');
  assert.ok(enemy.x <= 330);
  assert.ok(enemy.x > enemy.streamEngageX);
  assert.equal(resumed, 1);
});

test('queryless production marks the initial pack as approaching and disables AF', () => {
  const globals = { EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 }, EnemySize: 40 };
  assert.equal(configureContinuousCombatProduction(globals, { productionPath: true }), true);
  const entities = [
    { kind: 'hero', uid: 1, flow: 100, flowReady: true },
    { kind: 'enemy', uid: 2, hp: 20, slotIndex: 1 },
  ];
  assert.equal(finalizeContinuousCombatProduction(globals, entities), true);
  assert.equal(entities[0].flow, 0);
  assert.equal(entities[1].streamState, 'approaching');
  assert.equal(globals.ContinuousCombatStage.nextEmissionAt, 10);
});

test('runtime source targets in-range walkers while keeping them out of the enemy scheduler', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');
  const heroCommands = fs.readFileSync(new URL('../web-runner/modules/heroCommands.mjs', import.meta.url), 'utf8');
  assert.match(source, /e\.streamState !== 'approaching'/);
  assert.match(source, /enemy\.streamState && enemy\.streamState !== 'engaged'/);
  assert.doesNotMatch(source, /stationary: enemy\.streamState === 'engaged'/);
  assert.match(source, /stationary: Number\(g\.ContinuousCombatStageLoop \|\| 0\) === 1 \|\| profile === 'ranged'/);
  assert.match(source, /stationary: Number\(g\.ContinuousCombatStageLoop \|\| 0\) === 1 \|\| \/\^Enemy_Heal_/);
  assert.match(source, /forwardX: originX/);
  assert.match(source, /selectionEnabled: targetAvailable/);
  assert.match(source, /actorRoster\.eligible\.filter\(actor => Number\(actor\.type \|\| 0\) === 1\)/);
  assert.match(source, /export function TickRealtimeHeroBasics/);
  assert.match(source, /hit\.realtimeBasic = 1/);
  assert.match(heroCommands, /noLivingEnemy&&streamComplete/);
  assert.match(source, /Number\(astralFlowAward\?\.spawned \|\| 0\) > 0 && markEnemyDeathVisualHold/);
  const renderer = fs.readFileSync(new URL('../web-runner/systems/renderRuntime.js', import.meta.url), 'utf8');
  assert.match(renderer, /enemiesToDraw = .*\.sort\(\(a, b\) => Number\(b\.y/);
  assert.match(renderer, /const completeEnemyTurn = .*'AdvanceTurn'/);
  assert.match(renderer, /!pendingHit && !pendingImpact && !pendingBloom && \(Number\(state\.globals\.ContinuousCombatStageLoop/);
});
