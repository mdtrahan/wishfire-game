import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTINUOUS_COMBAT_PACK_CP_STEP,
  activateContinuousCombatSpawnedEnemy,
  advanceContinuousCombatStage,
  buildContinuousCombatSpawnPlan,
  configureContinuousCombatProduction,
  createContinuousCombatStageState,
  finalizeContinuousCombatProduction,
  maybeAdvanceContinuousCombatStage,
  scaleContinuousCombatPackRow,
} from '../web-runner/src/core/continuousCombatStage.mjs';

const rows = ['Gobloc', 'Skeleton', 'High Gobloc', 'Lizardo', 'Orc', 'Troll']
  .map((name, index) => ({ name, HP: 20 + index * 5, ATK: 2 + index, DEF: 2, MAG: 1, RES: 1, SPD: 8 }));

test('production starts with a weak three-enemy pack and a shallow linear CP ramp', () => {
  const start = createContinuousCombatStageState(42);
  const first = buildContinuousCombatSpawnPlan(rows, start);
  const secondState = advanceContinuousCombatStage(start).state;
  const second = buildContinuousCombatSpawnPlan(rows, secondState, { slotBase: 3 });
  const thirdState = advanceContinuousCombatStage(secondState).state;
  const third = buildContinuousCombatSpawnPlan(rows, thirdState, { slotBase: 6 });
  assert.equal(first.length, 3);
  assert.deepEqual(first.map(entry => entry.lane), [1, 0, 2]);
  assert.deepEqual(first.map(entry => entry.slotIndex), [0, 1, 2]);
  assert.deepEqual(second.map(entry => entry.slotIndex), [3, 4, 5]);
  const totals = [first, second, third].map(pack => pack.reduce((sum, entry) => sum + entry.row.CombatPower, 0));
  assert.ok(totals[0] < totals[1]);
  assert.ok(totals[1] < totals[2]);
  assert.ok(totals[1] / totals[0] < 1 + CONTINUOUS_COMBAT_PACK_CP_STEP * 2);
  assert.ok(totals[2] / totals[1] < 1 + CONTINUOUS_COMBAT_PACK_CP_STEP * 2);
});

test('stream enemies begin off-stage and become engaged only after walking to the boundary', () => {
  const globals = { EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 }, EnemySize: 40 };
  const enemy = activateContinuousCombatSpawnedEnemy(globals, { kind: 'enemy', hp: 10 }, { lane: 1, rank: 0, packIndex: 0 });
  assert.equal(enemy.streamState, 'approaching');
  assert.ok(enemy.x > globals.EnemyAreaRect.maxX);
  assert.equal(enemy.y, 150);
  assert.ok(enemy.streamEngageX < globals.EnemyAreaRect.maxX);
});

test('pack members enter with deterministic stagger instead of marching in unison', () => {
  const globals = { time: 3, EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 }, EnemySize: 40 };
  const enemies = [0, 1, 2].map(entryOrder => activateContinuousCombatSpawnedEnemy(
    globals,
    { kind: 'enemy', hp: 10 },
    { lane: entryOrder, entryOrder },
  ));
  assert.deepEqual(enemies.map(enemy => enemy.streamStartAt), [3, 3.62, 4.55]);
  assert.ok(enemies[1].streamWalkSpeed < enemies[0].streamWalkSpeed);
  assert.ok(enemies[2].streamWalkSpeed > enemies[0].streamWalkSpeed);
  assert.notEqual(enemies[1].x, enemies[2].x);
});

test('melee enemies alternate between two buffered lines while ranged enemies retain the old line', () => {
  const globals = {
    time: 0,
    EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 },
    EnemySize: 40,
    HeroRestBasePosByUID: { 1: { x: 68 }, 2: { x: 40 } },
  };
  const melee = activateContinuousCombatSpawnedEnemy(globals, { kind: 'enemy', hp: 10, ATK: 10, MAG: 2 }, { entryOrder: 0 });
  const farMelee = activateContinuousCombatSpawnedEnemy(globals, { kind: 'enemy', hp: 10, ATK: 10, MAG: 2 }, { entryOrder: 1 });
  const ranged = activateContinuousCombatSpawnedEnemy(globals, { kind: 'enemy', hp: 10, ATK: 2, MAG: 10 }, { entryOrder: 2 });
  const laterRanged = activateContinuousCombatSpawnedEnemy(globals, { kind: 'enemy', hp: 10, ATK: 2, MAG: 10 }, { entryOrder: 2, rank: 4 });
  assert.equal(melee.streamDelivery, 'melee');
  assert.equal(melee.streamEngageX, 128);
  assert.equal(farMelee.streamEngageX, 160.6);
  assert.equal(ranged.streamDelivery, 'ranged');
  assert.equal(ranged.streamEngageX, 193.2);
  assert.equal(laterRanged.streamEngageX, 193.2);
});

test('overlapping packs reserve distinct engagement X positions', () => {
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
  assert.equal(new Set(enemies.map(enemy => enemy.streamEngageX)).size, enemies.length);
  assert.ok(enemies[3].streamEngageX > enemies[0].streamEngageX);
  assert.ok(enemies[6].streamEngageX > enemies[3].streamEngageX);
});

test('timed packs emit while survivors remain and boss waits for a clear field', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(9), nextEmissionAt: 7, lastUpdatedAt: 0, spawnSerial: 3 },
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
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), true);
  assert.equal(spawned.length, 3);
  assert.equal(globals.ContinuousCombatStage.stageId, '1-1-pack-2');
  assert.ok(entities.some(enemy => enemy.uid === survivor.uid));

  globals.time = 22;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), true);
  assert.equal(globals.ContinuousCombatStage.stageId, '1-1-pack-3');
  globals.time = 60;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), false);
  assert.equal(globals.ContinuousCombatStage.stageId, '1-1-pack-3');
});

test('walking completes deterministically and wakes the cooldown scheduler', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: { ...createContinuousCombatStageState(1), nextEmissionAt: 99, lastUpdatedAt: 0, spawnSerial: 1 },
    GamePhase: 'RUNTIME', BattleStartActive: 0, time: 0,
    EnemyAreaRect: { minX: 160, maxX: 200, minY: 60, maxY: 180 }, EnemySize: 40,
    EnemyData: rows, EnemySlots: [2], PendingDeaths: {}, ActionInProgress: 0, IsPlayerBusy: 0,
  };
  const enemy = activateContinuousCombatSpawnedEnemy(globals, { uid: 1, kind: 'enemy', hp: 10 }, { lane: 1 });
  enemy.x = enemy.streamEngageX + 1;
  globals.ContinuousCombatStage.lastUpdatedAt = 0.9;
  globals.time = 1;
  let resumed = 0;
  maybeAdvanceContinuousCombatStage({ globals, entities: [enemy], presentationBarrier: { lanes: {} }, call() {}, runCombatStep(name) { if (name === 'ProcessTurn') resumed += 1; } });
  assert.equal(enemy.streamState, 'engaged');
  assert.equal(enemy.x, enemy.streamEngageX);
  assert.equal(globals.ContinuousCombatStage.nextEmissionAt, 16);
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
  assert.equal(globals.ContinuousCombatStage.nextEmissionAt, 15);
});

test('runtime source keeps approaching enemies untargetable and assigns motion by attack role', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');
  const heroCommands = fs.readFileSync(new URL('../web-runner/modules/heroCommands.mjs', import.meta.url), 'utf8');
  assert.match(source, /e\.streamState !== 'approaching'/);
  assert.doesNotMatch(source, /stationary: enemy\.streamState === 'engaged'/);
  assert.match(source, /stationary: Number\(g\.ContinuousCombatStageLoop \|\| 0\) === 1 \|\| profile === 'ranged'/);
  assert.match(source, /stationary: Number\(g\.ContinuousCombatStageLoop \|\| 0\) === 1 \|\| \/\^Enemy_Heal_/);
  assert.match(source, /forwardX: originX/);
  assert.match(source, /!actors\.some\(actor => Number\(actor\?\.type \|\| 0\) === 1\)/);
  assert.match(heroCommands, /noLivingEnemy&&streamComplete/);
});
