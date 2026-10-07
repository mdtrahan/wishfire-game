import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveCombatFormationAnchors } from '../src/core/combatOrientation.mjs';
import {
  CONTINUOUS_COMBAT_PACK_CP_STEP,
  CONTINUOUS_COMBAT_PACK_INTERVAL_SEC,
  CONTINUOUS_COMBAT_STAGES,
  activateContinuousCombatSpawnedEnemy,
  advanceContinuousCombatStage,
  armContinuousCombatBoss,
  buildContinuousCombatSpawnPlan,
  configureContinuousCombatProduction,
  createContinuousCombatStageState,
  finalizeContinuousCombatProduction,
  maybeAdvanceContinuousCombatStage,
  pushContinuousCombatEnemy,
  reverseContinuousCombatEnemy,
  resetContinuousCombatAfterDefeat,
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
  }
});

test('continuous stage simulation makes no movement, emission or action claim while paused', () => {
  for (const pauseKey of ['DevToolingPaused', 'QaScenarioPaused', 'QaFixtureHoldTurn']) {
    const stage = createContinuousCombatStageState(91);
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

test('normal waves create three dispersed packs of two or three actors', () => {
  const start = createContinuousCombatStageState(42);
  const first = buildContinuousCombatSpawnPlan(rows, start);
  const secondState = advanceContinuousCombatStage(start).state;
  const second = buildContinuousCombatSpawnPlan(rows, secondState, { slotBase: first.length });
  const thirdState = advanceContinuousCombatStage(secondState).state;
  const third = buildContinuousCombatSpawnPlan(rows, thirdState, { slotBase: first.length + second.length });
  assert.ok([6, 9].includes(first.length));
  assert.ok([6, 9].includes(second.length));
  assert.ok([6, 9].includes(third.length));
  for (const plan of [first, second, third]) {
    const counts = [0, 1, 2].map(sector => plan.filter(entry => entry.sectorIndex === sector).length);
    assert.ok(counts.every(count => count >= 2 && count <= 3));
  }
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
      { uid: 1, kind: 'hero', baseHeroName: 'Falie', hp: 13, maxHP: 50, isAlive: true, statuses: [{ statusEffect: 'dot' }, { statusEffect: 'atkUp' }], statusEffects: [{ statusEffect: 'blind' }, { statusEffect: 'barrier' }] },
      { uid: 2, kind: 'hero', baseHeroName: 'Huun', hp: 0, maxHP: 40, isAlive: false, actionState: 'ko', actionFacing: 'left', actionStateStartedAt: 1, actionImpactAt: 1, actionStateUntil: 86401, statuses: [{ statusEffect: 'silence' }] },
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
      assert.equal(heroes[1].locomotion, 'idle');
      assert.equal(heroes[1].locomotionStartedAt, 10);
      for (const key of ['actionState', 'actionFacing', 'actionStateStartedAt', 'actionImpactAt', 'actionStateUntil']) assert.equal(heroes[1][key], undefined);
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

test('boss access survives defeat and retries immediately without normal kills', () => {
  const globals = { time: 12, EnemyData: rows, ContinuousCombatStage: createContinuousCombatStageState(42, { region: 2, stage: 4 }) };
  const entities=[{uid:1,kind:'hero',hp:40,maxHP:75}];
  const call=(name,row)=>{if(name==='SpawnEnemy'){const e={uid:2,kind:'enemy',hp:row.HP};entities.push(e);return e;}};
  assert.equal(armContinuousCombatBoss(globals,entities,call), false);
  globals.ContinuousCombatStage.bossAvailable = true;
  assert.equal(armContinuousCombatBoss(globals,entities,call), true);
  assert.equal(globals.ContinuousCombatStage.bossArmed, true);
  assert.equal(resetContinuousCombatAfterDefeat(globals), true);
  assert.equal(globals.ContinuousCombatStage.region, 2);
  assert.equal(globals.ContinuousCombatStage.stage, 4);
  assert.equal(globals.ContinuousCombatStage.wave, 1);
  assert.equal(globals.ContinuousCombatStage.bossAvailable, true);
  assert.equal(globals.ContinuousCombatStage.bossArmed, false);
  assert.equal(armContinuousCombatBoss(globals,entities,call),true);
  assert.equal(entities.filter(a=>a.kind==='enemy').length,1);
});

test('stream packs spawn across the four-screen world in deterministic sectors', () => {
  const globals = { EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 }, EnemySize: 40 };
  const enemies = [0, 1, 2].map(sectorIndex => activateContinuousCombatSpawnedEnemy(
    globals, { kind: 'enemy', hp: 10 }, { lane: 1, rank: 0, packIndex: 0, sectorIndex },
  ));
  assert.deepEqual(enemies.map(enemy => enemy.streamState), ['roaming', 'roaming', 'roaming']);
  assert.deepEqual(enemies.map(enemy => enemy.streamSectorIndex), [0, 1, 2]);
  assert.ok(enemies[0].x < enemies[1].x && enemies[1].x < enemies[2].x);
  assert.ok(enemies[2].x <= 2880);
  const heroYs = deriveCombatFormationAnchors({ globals, heroCount: 4 }).heroYs;
  assert.ok(enemies.every(enemy => enemy.y >= heroYs[0] && enemy.y <= heroYs.at(-1)));
  assert.ok(enemies.every(enemy => enemy.streamEngageX === enemy.x));
  assert.equal(enemies[0].streamWalkSpeed, Math.max(34, 40 * 0.9) * 0.7 * 0.9);
});

test('continuous stage reconciles legacy respawns into the world before they can render at slot coordinates', () => {
  const stage = { ...createContinuousCombatStageState(5), nextEmissionAt: 99, lastArenaUpdatedAt: 0.9 };
  const globals = {
    ContinuousCombatStageLoop: 1, ContinuousCombatStage: stage, GamePhase: 'RUNTIME',
    BattleStartActive: 0, time: 1, EnemySize: 40, EnemyData: rows, PendingDeaths: {},
  };
  const hero = { uid: 1, kind: 'hero', hp: 100, maxHP: 100, footX: 90, footY: 270 };
  const legacyRespawn = { uid: 12, kind: 'enemy', hp: 20, maxHP: 20, slotIndex: 1, x: 170, y: 240 };
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities: [hero, legacyRespawn], presentationBarrier: { lanes: {} }, call() {} }), false);
  assert.equal(legacyRespawn.streamState, 'in_range');
  assert.ok(legacyRespawn.streamSectorIndex >= 0);
  assert.ok(legacyRespawn.footX > 360);
  assert.equal(legacyRespawn.arenaEnabled, true);
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
  assert.equal(globals.ContinuousCombatStage.nextEmissionAt, globals.time + CONTINUOUS_COMBAT_PACK_INTERVAL_SEC);
  globals.time = globals.ContinuousCombatStage.nextEmissionAt;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities: [enemy], presentationBarrier: { lanes: {} }, call(name, data, slotIndex) {
    if (name !== 'SpawnEnemy') return null;
    const actor = { uid: 20 + spawned.length, kind: 'enemy', hp: data.HP, name: data.name, slotIndex };
    spawned.push(actor);
    return actor;
  }, runCombatStep() {} }), true);
  assert.equal(globals.ContinuousCombatStage.wave, transitions + 2);
  assert.ok([6, 9].includes(spawned.length));
  assert.deepEqual(new Set(spawned.map(actor => actor.streamSectorIndex)).size, 3);
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

test('three compact packs keep deterministic lanes and travel speeds', () => {
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

test('three packs occupy separated world sectors with bounded local footprints', () => {
  const globals = {
    time: 0,
    EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 },
    EnemySize: 40,
    HeroRestBasePosByUID: { 1: { x: 68 } },
  };
  const enemies = [0, 1, 2].flatMap(sectorIndex => [0, 1, 2].map(entryOrder => activateContinuousCombatSpawnedEnemy(
    globals,
    { kind: 'enemy', hp: 10, ATK: 10, MAG: 2 },
    { packIndex: 0, sectorIndex, entryOrder, lane: entryOrder },
  )));
  assert.equal(new Set(enemies.map(enemy => enemy.streamSectorIndex)).size, 3);
  for (let sector = 0; sector < 3; sector += 1) {
    const group = enemies.filter(enemy => enemy.streamSectorIndex === sector);
    assert.equal(group.length, 3);
    assert.ok(Math.max(...group.map(enemy => enemy.x)) - Math.min(...group.map(enemy => enemy.x)) <= 100);
  }
  assert.ok(enemies[0].x < enemies[3].x && enemies[3].x < enemies[6].x);
});

test('timed waves emit while survivors remain and the fourth wave waits for a clear field', () => {
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
  assert.ok([6, 9].includes(spawned.length));
  assert.equal(new Set(spawned.map(enemy => enemy.streamSectorIndex)).size, 3);
  assert.equal(globals.ContinuousCombatStage.wave, 2);
  assert.ok(entities.some(enemy => enemy.uid === survivor.uid));

  for (const enemy of spawned) { enemy.streamState = 'engaged'; enemy.x = enemy.streamEngageX; }
  maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} });
  globals.time = 10;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), true);
  assert.equal(globals.ContinuousCombatStage.wave, 3);
  for (const enemy of spawned) { enemy.streamState = 'engaged'; enemy.x = enemy.streamEngageX; }
  maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} });
  globals.time = 13;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), true);
  assert.equal(globals.ContinuousCombatStage.wave, 4);
  globals.time = 40;
  assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call, runCombatStep() {} }), false);
  assert.equal(globals.ContinuousCombatStage.wave, 4);
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
  assert.equal(spawned[0].streamEngageX, 290);
  assert.equal(spawned[0].originY, 290);
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
  assert.equal(globals.ContinuousCombatStage.nextEmissionAt, 4);
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

test('queryless production marks initial enemies as roaming and disables AF', () => {
  const globals = { EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 }, EnemySize: 40 };
  assert.equal(configureContinuousCombatProduction(globals, { productionPath: true }), true);
  assert.equal(globals.RealtimeHeroFocusTargetUID, 0);
  const entities = [
    { kind: 'hero', uid: 1, flow: 100, flowReady: true },
    { kind: 'enemy', uid: 2, hp: 20, slotIndex: 1 },
  ];
  assert.equal(finalizeContinuousCombatProduction(globals, entities), true);
  assert.equal(entities[0].flow, 0);
  assert.equal(entities[1].streamState, 'roaming');
  assert.equal(globals.ContinuousCombatStage.nextEmissionAt, 3);
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
