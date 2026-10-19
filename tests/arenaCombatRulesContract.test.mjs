import test from 'node:test';
import assert from 'node:assert/strict';
import { actorAttackReach, actorFootprintRadius, isActorTargetInRange } from '../src/core/arenaCombatRules.mjs';
import { advanceContinuousCombatArena, deriveContinuousCombatRecoveryHuddle, selectContinuousEnemyTarget } from '../web-runner/src/core/arenaCombat.mjs';
import { activateContinuousCombatSpawnedEnemy, pushContinuousCombatEnemy } from '../web-runner/src/core/continuousCombatStage.mjs';
import { actorPuppetState } from '../web-runner/systems/actorPuppetPresentation.mjs';
import { deriveCombatWorldVerticalBounds } from '../src/core/combatOrientation.mjs';

test('hero reach uses initialized feet and a shared base range', () => {
  const melee = { kind: 'hero', hp: 10, footX: 100, footY: 200, attackType: 'melee', arenaEnabled: true };
  const mage = { kind: 'hero', hp: 10, footX: 100, footY: 200, attackType: 'magic', arenaEnabled: true };
  const enemy = { kind: 'enemy', hp: 10, footX: 210, footY: 200, streamState: 'in_range' };
  assert.equal(isActorTargetInRange(melee, enemy), true);
  assert.equal(isActorTargetInRange(mage, enemy), true);
  enemy.footX = 210.001;
  assert.equal(isActorTargetInRange(melee, enemy), false);
  assert.equal(isActorTargetInRange(mage, enemy), false);
  for (const name of ['Fara', 'Hondo', 'Runa', 'Kaja']) {
    for (const currentLevel of [1, 100]) assert.equal(actorAttackReach({kind:'hero',name,currentLevel}),92);
  }
  assert.equal(actorAttackReach({kind:'enemy',streamDelivery:'melee'}),46);
  assert.equal(actorAttackReach({kind:'enemy',streamDelivery:'ranged'}),146);
  assert.equal(actorAttackReach({kind:'enemy',combatRank:'boss'}),184);
});

test('arena advances both factions to contact with bounded semantic actor state', () => {
  const hero = { uid: 1, kind: 'hero', hp: 100, maxHP: 100, attackType: 'melee', footX: 990, footY: 370 };
  const enemy = { uid: 2, kind: 'enemy', hp: 100, maxHP: 100, x: 1090, y: 370, streamState: 'in_range', streamWalkSpeed: 40, streamDelivery: 'melee' };
  const entities = [hero, enemy];
  for (let index = 0; index < 70; index += 1) {
    advanceContinuousCombatArena({ globals: { EnemySize: 40 }, entities, seconds: 0.1 });
  }
  assert.ok(hero.footX > 906);
  assert.ok(enemy.footX < 1090);
  assert.equal(enemy.streamState, 'engaged');
  assert.notEqual(hero.arenaTargetUID, 0);
  assert.notEqual(enemy.arenaTargetUID, 0);
  for (const actor of entities) {
    assert.ok(Number.isFinite(actor.footX));
    assert.ok(Number.isFinite(actor.footY));
    assert.ok(['left', 'right'].includes(actor.facing));
    assert.ok(['idle', 'walk'].includes(actor.locomotion));
    assert.ok(['idle', 'walk'].includes(actor.actionState));
  }
});

test('missing-feet party fallback tightens its authored horizontal spread by twenty percent', () => {
  const heroes = [200, 240, 280, 320].map((footY, index) => ({ uid: index + 1, kind: 'hero', hp: 100, footY }));
  advanceContinuousCombatArena({ globals: {}, entities: heroes, seconds: 0 });
  const spread = Math.max(...heroes.map(hero => hero.footX)) - Math.min(...heroes.map(hero => hero.footX));
  const center = (Math.max(...heroes.map(hero => hero.footX)) + Math.min(...heroes.map(hero => hero.footX))) / 2;
  assert.ok(Math.abs(spread - 52.8) < 1e-9, 'the tightened startup spread remains 52.8 units');
  assert.ok(Math.abs(center - 1080) < 1e-9, 'fresh continuous combat starts in the center third');
});

test('straggler regroup begins at the tightened 144-unit squad leash', () => {
  const heroes = [
    { uid: 1, name: 'Fara', kind: 'hero', hp: 100, attackType: 'physical', footX: 900, footY: 290 },
    { uid: 2, name: 'Hondo', kind: 'hero', hp: 100, attackType: 'physical', footX: 910, footY: 330 },
    { uid: 3, name: 'Runa', kind: 'hero', hp: 100, attackType: 'magic', footX: 920, footY: 370 },
    { uid: 4, name: 'Kaja', kind: 'hero', hp: 100, attackType: 'magic', footX: 1120, footY: 410 },
  ];
  advanceContinuousCombatArena({ globals: {}, entities: heroes, seconds: 0.1 });
  assert.ok(heroes[3].footX < 1120, 'a 150-plus unit outlier starts moving toward the party before the old 180-unit leash');
});

test('four heroes retain stable targets and separate crowded footprints', () => {
  const heroes = Array.from({ length: 4 }, (_, index) => ({ uid: index + 1, kind: 'hero', hp: 100, attackType: index === 2 ? 'magic' : 'melee', footX: 906, footY: 340, arenaEnabled: true }));
  const enemies = [
    { uid: 10, kind: 'enemy', hp: 100, streamState: 'in_range', footX: 975, footY: 340, streamDelivery: 'melee', arenaEnabled: true },
    { uid: 11, kind: 'enemy', hp: 100, streamState: 'in_range', footX: 978, footY: 340, streamDelivery: 'melee', arenaEnabled: true },
  ];
  const entities = [...heroes, ...enemies];
  advanceContinuousCombatArena({ globals: { time: 1 }, entities, seconds: 0.1 });
  const targets = heroes.map(hero => hero.arenaTargetUID);
  advanceContinuousCombatArena({ globals: { time: 1.1 }, entities, seconds: 0.1 });
  assert.deepEqual(heroes.map(hero => hero.arenaTargetUID), targets, 'small distance changes stay inside hysteresis');
  for (let index = 0; index < entities.length; index += 1) for (let other = index + 1; other < entities.length; other += 1) {
    const a = entities[index], b = entities[other];
    assert.ok(Math.hypot(a.footX - b.footX, a.footY - b.footY) >= 35, `${a.uid}/${b.uid} footprints separate`);
  }
});

test('contact cancellation settles both tanks to idle without aging locomotion every frame', () => {
  const heroes = ['Fara', 'Hondo'].map((name, index) => ({
    uid: index + 1, name, kind: 'hero', hp: 100, attackType: 'physical', footX: 1580, footY: 370,
    locomotion: 'idle', locomotionStartedAt: 3,
  }));
  const enemy = { uid: 10, kind: 'enemy', hp: 100, footX: 1640, footY: 370, streamState: 'in_range', streamDelivery: 'melee' };
  const entities = [...heroes, enemy];
  const globals = { time: 4 };
  for (let tick = 0; tick < 60; tick += 1) {
    advanceContinuousCombatArena({ globals, entities, seconds: 0.1 });
    globals.time += 0.1;
  }
  assert.ok(heroes.every(hero => hero.locomotion === 'idle'), 'footprint separation cancels the blocked contact step');
  const settledAt = heroes.map(hero => hero.locomotionStartedAt);
  for (let tick = 0; tick < 8; tick += 1) {
    advanceContinuousCombatArena({ globals, entities, seconds: 0.1 });
    globals.time += 0.1;
  }
  assert.deepEqual(heroes.map(hero => hero.locomotionStartedAt), settledAt, 'stationary idle animation age continues across blocked frames');

  heroes[1].actionState = 'basic';
  heroes[1].actionStateUntil = globals.time + 1;
  enemy.actionState = 'hurt';
  enemy.actionStateUntil = globals.time + 1;
  advanceContinuousCombatArena({ globals, entities, seconds: 0.1 });
  assert.equal(heroes[1].actionState, 'basic');
  assert.equal(actorPuppetState(heroes[1], globals.time), 'basic', 'the active basic retains its actual presentation clip');
  assert.equal(enemy.actionState, 'hurt');
  assert.equal(actorPuppetState(enemy, globals.time), 'hurt', 'the active hurt retains its actual presentation clip');
  assert.ok(isActorTargetInRange(heroes[0], enemy), 'contact locomotion reconciliation leaves authored attack reach unchanged');

  const mover = { uid: 20, kind: 'hero', hp: 100, attackType: 'physical', footX: 1280, footY: 370, locomotion: 'idle', locomotionStartedAt: 2 };
  const distantEnemy = { uid: 21, kind: 'enemy', hp: 100, footX: 1430, footY: 370, streamState: 'in_range' };
  const movingGlobals = { time: 10 };
  advanceContinuousCombatArena({ globals: movingGlobals, entities: [mover, distantEnemy], seconds: 0.1 });
  assert.equal(mover.locomotion, 'walk');
  assert.equal(mover.locomotionStartedAt, 10, 'real movement starts the walk clip at its transition');
  movingGlobals.time = 10.1;
  advanceContinuousCombatArena({ globals: movingGlobals, entities: [mover, distantEnemy], seconds: 0.1 });
  assert.equal(mover.locomotionStartedAt, 10, 'continued movement does not restart the walk clip');
});

test('Fara and Hondo lead while Runa and Kaja keep ranged support spacing in either travel direction', () => {
  for (const enemyX of [1450, 880]) {
    const direction = enemyX > 1100 ? 1 : -1;
    const heroStartX = enemyX > 1100 ? 920 : 1120;
    const heroes = [
      { uid: 1, name: 'Fara', kind: 'hero', hp: 100, attackType: 'physical', footX: heroStartX, footY: 340 },
      { uid: 2, name: 'Hondo', kind: 'hero', hp: 100, attackType: 'physical', footX: heroStartX, footY: 380 },
      { uid: 3, name: 'Runa', kind: 'hero', hp: 100, attackType: 'magic', footX: heroStartX - direction * 10, footY: 340 },
      { uid: 4, name: 'Kaja', kind: 'hero', hp: 100, attackType: 'magic', footX: heroStartX - direction * 10, footY: 380 },
    ];
    const enemy = { uid: 20, name: 'Gobloc', kind: 'enemy', hp: 1000, streamState: 'in_range', streamWalkSpeed: 34, streamDelivery: 'melee', footX: enemyX, footY: 360 };
    const entities = [...heroes, enemy];
    for (let tick = 0; tick < 180; tick += 1) advanceContinuousCombatArena({ globals: { time: tick / 10 }, entities, seconds: 0.1 });
    const frontX = (heroes[0].footX + heroes[1].footX) / 2;
    const rearX = (heroes[2].footX + heroes[3].footX) / 2;
    assert.ok((frontX - rearX) * direction > 24, `front heroes should lead toward ${direction}`);
    assert.ok(heroes.every(hero => isActorTargetInRange(hero, enemy)), 'front melee and rear ranged heroes retain authored reach');
    const xs = heroes.map(hero => hero.footX);
    assert.ok(Math.max(...xs) - Math.min(...xs) < 150, 'four actors remain a compact band');
  }
});

test('the squad detects one local pack together and leaves distant packs idle', () => {
  const heroes = Array.from({ length: 4 }, (_, index) => ({
    uid: index + 1, kind: 'hero', hp: 100, attackType: 'melee', footX: 60 + index * 8, footY: 220 + index * 38,
  }));
  const enemies = [
    ...[0, 1, 2].map(index => ({ uid: 20 + index, kind: 'enemy', hp: 80, footX: 500 + index * 24, footY: 230 + index * 34, streamState: 'roaming', streamSectorIndex: 0 })),
    { uid: 30, kind: 'enemy', hp: 80, footX: 1440, footY: 272, streamState: 'roaming', streamSectorIndex: 1 },
    { uid: 31, kind: 'enemy', hp: 80, footX: 2080, footY: 272, streamState: 'roaming', streamSectorIndex: 2 },
  ];
  const remoteBefore = enemies.slice(3).map(enemy => enemy.footX);
  advanceContinuousCombatArena({ globals: { time: 1 }, entities: [...heroes, ...enemies], seconds: 0.1 });
  assert.ok(heroes.every(hero => Number(hero.arenaTargetUID) >= 20 && Number(hero.arenaTargetUID) <= 22));
  assert.ok(enemies.slice(0, 3).some(enemy => ['in_range', 'engaged'].includes(enemy.streamState)));
  assert.ok(enemies.slice(0, 3).filter(enemy => heroes.every(hero => Math.hypot(hero.footX - enemy.footX, hero.footY - enemy.footY) > 460))
    .every(enemy => enemy.streamState === 'roaming'), 'members outside personal detection range stay dormant even when their pack is local');
  assert.deepEqual(enemies.slice(3).map(enemy => enemy.footX), remoteBefore);
  assert.deepEqual(enemies.slice(3).map(enemy => enemy.streamState), ['roaming', 'roaming']);
});

test('stale remote engagement cannot pull the squad or make a remote pack chase', () => {
  const heroes = Array.from({ length: 4 }, (_, index) => ({
    uid: index + 1, kind: 'hero', hp: 100, footX: 1000 + index * 8, footY: 280 + index * 14,
  }));
  const nearby = { uid: 20, kind: 'enemy', hp: 100, footX: 1320, footY: 300, streamState: 'roaming', streamEngagementGroupId: 20 };
  const nearbyGroupmate = { uid: 21, kind: 'enemy', hp: 100, footX: 1600, footY: 300, streamState: 'engaged', streamEngagementGroupId: 20, locomotion: 'run' };
  const staleRemote = { uid: 30, kind: 'enemy', hp: 100, footX: 1800, footY: 300, streamState: 'engaged', streamEngagementGroupId: 30, locomotion: 'run' };
  const stage = { activeEncounterGroupId: 30 };
  const globals = { time: 2, ContinuousCombatStage: stage };
  const remoteFeet = [nearbyGroupmate.footX, staleRemote.footX];

  advanceContinuousCombatArena({ globals, entities: [...heroes, nearby, nearbyGroupmate, staleRemote], seconds: 0.1 });

  assert.ok(heroes.every(hero => hero.arenaTargetUID === nearby.uid), 'the new local pack takes focus ahead of the stale remote commitment');
  assert.equal(stage.activeEncounterGroupId, nearby.streamEngagementGroupId);
  assert.deepEqual([nearbyGroupmate.footX, staleRemote.footX], remoteFeet, 'remote members do not begin or continue pursuit');
  assert.ok([nearbyGroupmate, staleRemote].every(enemy => enemy.streamState === 'roaming'
    && enemy.arenaTargetUID === 0 && enemy.arenaInReach === false && enemy.locomotion === 'idle'), 'stale remote engagement returns to dormant roaming');
  assert.notEqual(nearby.streamState, 'roaming', 'the physically local pack still engages');
});

test('a wounded retreating encounter holds the whole squad until neutralized', () => {
  const heroes = Array.from({ length: 4 }, (_, index) => ({ uid: index + 1, kind: 'hero', hp: 100, footX: 1100 + index * 6, footY: 290 + index * 10 }));
  const survivor = { uid: 20, kind: 'enemy', hp: 20, footX: 1180, footY: 340, streamState: 'retreating', streamSectorIndex: 4 };
  const nearerPack = { uid: 30, kind: 'enemy', hp: 100, footX: 1100, footY: 370, streamState: 'roaming', streamSectorIndex: 5 };
  const globals = { time: 2, ContinuousCombatStage: { activeEncounterGroupId: 4 } };
  const before = heroes.map(hero => [hero.footX, hero.footY]);
  advanceContinuousCombatArena({ globals, entities: [...heroes, survivor, nearerPack], seconds: 0.1 });
  assert.ok(heroes.every(hero => [survivor.uid, nearerPack.uid].includes(hero.arenaTargetUID)), 'the party may work every local threat while retaining the retreating survivor');
  assert.equal(globals.ContinuousCombatStage.activeEncounterGroupId, 4);
  assert.equal(nearerPack.streamState, 'engaged', 'a second nearby sector is no longer held dormant by the first local commitment');
  assert.ok(heroes.some((hero, index) => Math.hypot(hero.footX - before[index][0], hero.footY - before[index][1]) > 0), 'party continues working the committed survivor');

  survivor.hp = 0;
  advanceContinuousCombatArena({ globals, entities: [...heroes, survivor, nearerPack], seconds: 0.1 });
  assert.equal(globals.ContinuousCombatStage.activeEncounterGroupId, 5);
  assert.ok(heroes.every(hero => hero.arenaTargetUID === nearerPack.uid));
});

test('six seeded packs occupy the full HUD-safe world height with compact huddled members', () => {
  const globals = { EnemySize: 40, EncounterSeed: 17, ContinuousCombatStage: { seed: 17 } };
  const centers = [];
  for (let sector = 0; sector < 6; sector += 1) {
    const pack = [0, 1, 2].map(order => activateContinuousCombatSpawnedEnemy(globals, {
      uid: sector * 3 + order + 1, kind: 'enemy', hp: 20, name: 'Gobloc', enemyRole: 'ordinary',
    }, { lane: order, rank: 0, packIndex: 0, entryOrder: order, sectorIndex: sector }));
    const ys = pack.map(enemy => enemy.footY);
    assert.ok(Math.max(...ys) - Math.min(...ys) <= 116, 'each enemy pack remains a compact local group');
    centers.push(ys.reduce((sum, y) => sum + y, 0) / ys.length);
  }
  assert.ok(Math.max(...centers) - Math.min(...centers) > 400, 'packs span the visible combat field rather than a hero-row band');
  const safe = deriveCombatWorldVerticalBounds();
  assert.ok(centers.every(y => y >= safe.minY + 20 && y <= safe.maxY - 20));
  const replayCenters = [];
  for (let sector = 0; sector < 6; sector += 1) {
    const pack = [0, 1, 2].map(order => activateContinuousCombatSpawnedEnemy(globals, { uid: 100 + sector * 3 + order, kind: 'enemy', hp: 20, name: 'Skeleton', enemyRole: 'ordinary' }, { lane: order, rank: 0, packIndex: 0, entryOrder: order, sectorIndex: sector }));
    replayCenters.push(pack.reduce((sum, enemy) => sum + enemy.footY / pack.length, 0));
  }
  assert.ok(centers.every((center, index) => Math.abs(center - replayCenters[index]) < 1e-9), 'the same seed reproduces pack vertical placement');
});

test('frontline roles follow diagonal target reversals while ranged supports stay behind', () => {
  const heroes = [
    { uid: 1, name: 'Fara', kind: 'hero', hp: 100, attackType: 'physical', footX: 1000, footY: 330 },
    { uid: 2, name: 'Hondo', kind: 'hero', hp: 100, attackType: 'physical', footX: 990, footY: 350 },
    { uid: 3, name: 'Runa', kind: 'hero', hp: 100, attackType: 'magic', footX: 980, footY: 330 },
    { uid: 4, name: 'Kaja', kind: 'hero', hp: 100, attackType: 'magic', footX: 970, footY: 350 },
  ];
  const first = { uid: 20, kind: 'enemy', hp: 50, footX: 1400, footY: 340, streamState: 'roaming', streamSectorIndex: 0 };
  const second = { uid: 30, kind: 'enemy', hp: 50, footX: 600, footY: 430, streamState: 'roaming', streamSectorIndex: 1 };
  const globals = { time: 0 };
  const checkOrder = (target, sign, expectRegroup = true) => {
    let regroupTicks = 0;
    for (let tick = 0; tick < 30; tick += 1) {
      const beforeCenter = heroes.reduce((sum, hero) => ({ x: sum.x + hero.footX / 4, y: sum.y + hero.footY / 4 }), { x: 0, y: 0 });
      const beforeVector = { x: target.footX - beforeCenter.x, y: target.footY - beforeCenter.y };
      const beforeLength = Math.hypot(beforeVector.x, beforeVector.y);
      const beforeProgress = hero => ((hero.footX - beforeCenter.x) * beforeVector.x + (hero.footY - beforeCenter.y) * beforeVector.y) / beforeLength;
      const regrouping = Math.min(...heroes.slice(0, 2).map(beforeProgress)) <= Math.max(...heroes.slice(2).map(beforeProgress)) + 6.4;
      const supportProgress = heroes.slice(2).map(beforeProgress);
      advanceContinuousCombatArena({ globals, entities: [...heroes, first, second], seconds: 0.1 });
      if (regrouping) {
        regroupTicks += 1;
        const afterSupportProgress = heroes.slice(2).map(hero => ((hero.footX - beforeCenter.x) * beforeVector.x + (hero.footY - beforeCenter.y) * beforeVector.y) / beforeLength);
        assert.ok(afterSupportProgress.every((value, index) => value <= supportProgress[index] + 4),
          `supports do not advance more than collision separation during ${sign} regroup: ${supportProgress.map(value => value.toFixed(1))} -> ${afterSupportProgress.map(value => value.toFixed(1))}`);
      }
    }
    if (expectRegroup) assert.ok(regroupTicks > 0, `${sign} reversal exercises a compact regroup phase`);
    const center = heroes.reduce((sum, hero) => ({ x: sum.x + hero.footX / 4, y: sum.y + hero.footY / 4 }), { x: 0, y: 0 });
    const vector = { x: target.footX - center.x, y: target.footY - center.y };
    const length = Math.hypot(vector.x, vector.y);
    const progress = hero => ((hero.footX - center.x) * vector.x + (hero.footY - center.y) * vector.y) / length;
    const frontline = heroes.slice(0, 2).map(progress);
    const support = heroes.slice(2).map(progress);
    assert.ok(frontline[0] > frontline[1] + 1.5,
      `Fara remains foremost with Hondo behind during ${sign}; ${frontline.map(value => value.toFixed(1))}`);
    assert.ok(Math.min(...frontline) > Math.max(...support) + 6.4,
      `each frontline hero leads each support along target direction ${sign}; ${frontline.map(value => value.toFixed(1))} vs ${support.map(value => value.toFixed(1))}`);
    assert.equal(heroes[1].facing, sign.startsWith('right') ? 'right' : 'left', 'Hondo faces the actual horizontal travel/target direction');
    assert.ok(Math.max(...heroes.map(hero => Math.hypot(hero.footX - center.x, hero.footY - center.y))) < 80, 'party stays within the tightened cohort envelope through the turn');
  };
  checkOrder(first, 'right/up', false);
  first.hp = 0;
  checkOrder(second, 'left/down');
  first.hp = 50;
  second.hp = 0;
  checkOrder(first, 'right/up again', false);
});

test('Fara leads Hondo and the compact support row across all eight travel headings', () => {
  for (let octant = 0; octant < 8; octant += 1) {
    const angle = octant * Math.PI / 4;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const perpendicular = { x: -direction.y, y: direction.x };
    const position = (along, side) => ({
      footX: 1080 + direction.x * along + perpendicular.x * side,
      footY: 370 + direction.y * along + perpendicular.y * side,
    });
    const heroes = [
      { uid: 1, baseHeroName: 'Falie', name: 'Fara', kind: 'hero', hp: 100, ...position(18, -8) },
      { uid: 2, baseHeroName: 'Huun', name: 'Hondo', kind: 'hero', hp: 100, ...position(6, 8) },
      { uid: 3, baseHeroName: 'Runa', name: 'Runa', kind: 'hero', hp: 100, ...position(-12, -8) },
      { uid: 4, baseHeroName: 'Kojonn', name: 'Kaja', kind: 'hero', hp: 100, ...position(-12, 8) },
    ];
    const enemy = {
      uid: 20, kind: 'enemy', hp: 100,
      footX: 1080 + direction.x * 100,
      footY: 370 + direction.y * 100,
      streamState: 'roaming', streamSectorIndex: octant,
    };
    const globals = { time: 0 };
    for (let tick = 0; tick < 8; tick += 1) {
      advanceContinuousCombatArena({ globals, entities: [...heroes, enemy], seconds: 0.1 });
    }
    const center = heroes.reduce((sum, hero) => ({ x: sum.x + hero.footX / 4, y: sum.y + hero.footY / 4 }), { x: 0, y: 0 });
    const progress = hero => (hero.footX - center.x) * direction.x + (hero.footY - center.y) * direction.y;
    const fara = progress(heroes[0]), hondo = progress(heroes[1]);
    const rear = heroes.slice(2).map(progress);
    assert.ok(fara > hondo + 4, `octant ${octant}: Fara leads Hondo (${fara.toFixed(1)} vs ${hondo.toFixed(1)})`);
    assert.ok(hondo > Math.max(...rear) + 4, `octant ${octant}: Hondo leads the rear row (${hondo.toFixed(1)} vs ${rear.map(value => value.toFixed(1))})`);
  }
});

test('the legacy frontline formation remains when no living Fara is present', () => {
  const heroes = [
    { uid: 1, baseHeroName: 'Huun', name: 'Hondo', kind: 'hero', hp: 100 },
    { uid: 2, baseHeroName: 'Runa', name: 'Runa', kind: 'hero', hp: 100 },
    { uid: 3, baseHeroName: 'Kojonn', name: 'Kaja', kind: 'hero', hp: 100 },
    { uid: 4, baseHeroName: 'Falie', name: 'Fara', kind: 'hero', hp: 0 },
  ];
  const huddle = deriveContinuousCombatRecoveryHuddle(heroes, 1);
  assert.ok(huddle[0].x > huddle[1].x && huddle[0].x > huddle[2].x,
    'Hondo remains the existing frontline lead when Fara is KO');
  assert.equal(huddle[0].x, huddle[3].x, 'a KO Fara record does not activate the living-Fara formation');
});

test('remaining ranged heroes can finish a local encounter and regroup without a tank', () => {
  const heroes = [
    { uid: 1, name: 'Fara', kind: 'hero', hp: 0, footX: 100, footY: 220 },
    { uid: 2, name: 'Hondo', kind: 'hero', hp: 0, footX: 110, footY: 250 },
    { uid: 3, name: 'Runa', kind: 'hero', hp: 100, attackType: 'magic', footX: 120, footY: 280 },
    { uid: 4, name: 'Kaja', kind: 'hero', hp: 100, attackType: 'magic', footX: 130, footY: 310 },
  ];
  const encounter = { uid: 20, kind: 'enemy', hp: 80, footX: 330, footY: 280, streamState: 'roaming', streamSectorIndex: 2 };
  const next = { uid: 30, kind: 'enemy', hp: 80, footX: 1440, footY: 640, streamState: 'roaming', streamSectorIndex: 3 };
  const globals = { time: 1, ContinuousCombatStage: {} };
  for (let tick = 0; tick < 120; tick += 1) advanceContinuousCombatArena({ globals, entities: [...heroes, encounter, next], seconds: 0.1 });
  assert.ok(heroes.slice(2).every(hero => hero.arenaTargetUID === encounter.uid || isActorTargetInRange(hero, encounter)), 'support-only party keeps working the current pack');
  encounter.hp = 0;
  for (let tick = 0; tick < 8; tick += 1) advanceContinuousCombatArena({ globals, entities: [...heroes, encounter, next], seconds: 0.1 });
  assert.ok(heroes.slice(2).every(hero => hero.arenaTargetUID === 0 || hero.footX < next.footX), 'support-only party resumes roaming toward the next sector');
});

test('rear supports retain authored reach while both tanks lead in close contact', () => {
  const heroes = [
    { uid: 1, name: 'Fara', kind: 'hero', hp: 100, attackType: 'physical', footX: 1020, footY: 300 },
    { uid: 2, name: 'Hondo', kind: 'hero', hp: 100, attackType: 'physical', footX: 1010, footY: 320 },
    { uid: 3, name: 'Runa', kind: 'hero', hp: 100, attackType: 'magic', footX: 1120, footY: 300 },
    { uid: 4, name: 'Kaja', kind: 'hero', hp: 100, attackType: 'magic', footX: 1130, footY: 320 },
  ];
  const enemy = { uid: 20, kind: 'enemy', hp: 100, footX: 1180, footY: 310, streamState: 'engaged', streamSectorIndex: 0 };
  const globals = { time: 0, ContinuousCombatStage: {} };
  globals.ContinuousCombatStage.activeEncounterGroupId = 0;
  assert.ok(heroes.slice(2).every(hero => Math.hypot(hero.footX - enemy.footX, hero.footY - enemy.footY) <= 64),
    'the committed-contact reversal starts with both supports inside melee-stop distance');
  for (let tick = 0; tick < 48; tick += 1) advanceContinuousCombatArena({ globals, entities: [...heroes, enemy], seconds: 0.1 });
  const assertFormation = direction => {
    const center = heroes.reduce((sum, hero) => ({ x: sum.x + hero.footX / 4, y: sum.y + hero.footY / 4 }), { x: 0, y: 0 });
    const vector = { x: (enemy.footX - center.x) * direction, y: (enemy.footY - center.y) * direction };
    const length = Math.hypot(vector.x, vector.y);
    const progress = hero => ((hero.footX - center.x) * vector.x + (hero.footY - center.y) * vector.y) / length;
    assert.ok(Math.min(...heroes.slice(0, 2).map(progress)) > Math.max(...heroes.slice(2).map(progress)) + 6.4,
      'both frontline heroes lead both supports during the committed contact turn');
    assert.ok(progress(heroes[0]) > progress(heroes[1]) + 1.5,
      'Fara retains the foremost contact position while Hondo remains close enough to attack');
    assert.ok(heroes.slice(0, 2).every(hero => isActorTargetInRange(hero, enemy)),
      'both melee heroes stay within their authored attack reach at dense contact');
    assert.ok(heroes.slice(2).every(hero => isActorTargetInRange(hero, enemy)), 'rear ranged heroes remain inside their authored contact range');
    assert.ok(heroes.every(hero => Math.hypot(hero.footX - center.x, hero.footY - center.y) < 80),
      `all four remain inside the tightened cohort envelope during close-contact regrouping (${heroes.map(hero => Math.hypot(hero.footX - center.x, hero.footY - center.y).toFixed(1))})`);
  };
  assertFormation(1);
  enemy.footX = 945;
  enemy.footY = 400;
  const reversalCenter = heroes.reduce((sum, hero) => ({ x: sum.x + hero.footX / 4, y: sum.y + hero.footY / 4 }), { x: 0, y: 0 });
  assert.ok(enemy.footX < reversalCenter.x && enemy.footY > reversalCenter.y, 'the same committed pack reverses to a left/down approach');
  for (let tick = 0; tick < 48; tick += 1) advanceContinuousCombatArena({ globals: { ...globals, time: 4.8 + tick / 10 }, entities: [...heroes, enemy], seconds: 0.1 });
  assertFormation(1);
});

test('frontline ordering follows pure vertical approaches without injecting horizontal travel', () => {
  const heroes = [
    { uid: 1, name: 'Fara', kind: 'hero', hp: 100, attackType: 'physical', footX: 900, footY: 420 },
    { uid: 2, name: 'Hondo', kind: 'hero', hp: 100, attackType: 'physical', footX: 920, footY: 410 },
    { uid: 3, name: 'Runa', kind: 'hero', hp: 100, attackType: 'magic', footX: 900, footY: 400 },
    { uid: 4, name: 'Kaja', kind: 'hero', hp: 100, attackType: 'magic', footX: 920, footY: 390 },
  ];
  const target = { uid: 40, kind: 'enemy', hp: 50, footX: 910, footY: 90, streamState: 'roaming', streamSectorIndex: 7 };
  const globals = { time: 0 };
  for (let tick = 0; tick < 30; tick += 1) advanceContinuousCombatArena({ globals, entities: [...heroes, target], seconds: 0.1 });
  assert.ok(heroes.every(hero => hero.footY < 420), 'zero horizontal delta stays vertical');
  const centerY = heroes.reduce((sum, hero) => sum + hero.footY / heroes.length, 0);
  const frontAdvance = heroes.slice(0, 2).map(hero => centerY - hero.footY);
  const supportAdvance = heroes.slice(2).map(hero => centerY - hero.footY);
  assert.ok(Math.min(...frontAdvance) > Math.max(...supportAdvance) + 6.4,
    `both tanks lead both supports on vertical travel; ${frontAdvance.map(value => value.toFixed(1))} vs ${supportAdvance.map(value => value.toFixed(1))}`);
});

test('target death sends the whole squad toward the next pack within world bounds', () => {
  const heroes = Array.from({ length: 4 }, (_, index) => ({ uid: index + 1, kind: 'hero', hp: 100, footX: 560 + index * 6, footY: 240 + index * 18 }));
  const enemies = [
    { uid: 20, kind: 'enemy', hp: 0, footX: 560, footY: 272, streamState: 'engaged', streamSectorIndex: 0 },
    { uid: 30, kind: 'enemy', hp: 100, footX: 1440, footY: 272, streamState: 'roaming', streamSectorIndex: 1 },
  ];
  advanceContinuousCombatArena({ globals: { time: 2 }, entities: [...heroes, ...enemies], seconds: 1 });
  assert.ok(heroes.every(hero => hero.footX > 40 && hero.footX < 2120), 'formation rear slots remain inside world bounds before the squad center advances');
  assert.ok(heroes.reduce((sum, hero) => sum + hero.footX / heroes.length, 0) > 560, 'the squad advances toward the next sector as a group');
  assert.ok(heroes.every(hero => hero.arenaTargetUID === 0));
  assert.equal(enemies[1].footX, 1440);
  heroes[3].footX = 950;
  const leftBeforeRegroup = heroes[0].footX;
  advanceContinuousCombatArena({ globals: { time: 2.5 }, entities: [...heroes, ...enemies], seconds: 1 });
  assert.ok(heroes[3].footX < 950);
  assert.ok(heroes[0].footX > leftBeforeRegroup);
  assert.ok(heroes.every(hero => hero.arenaTargetUID === 0));
  for (const hero of heroes) {
    hero.footX = 2115;
    hero.arenaTargetUID = 30;
  }
  enemies[1].footX = 2155;
  advanceContinuousCombatArena({ globals: { time: 3 }, entities: [...heroes, ...enemies], seconds: 2 });
  assert.ok(heroes.every(hero => hero.footX <= 2120));
  assert.ok(enemies[1].footX <= 2160);
});

test('enemy pursuit retains two-dimensional feet over repeated arena ticks', () => {
  const hero = { uid: 1, kind: 'hero', hp: 100, attackType: 'melee', footX: 106, footY: 340, arenaEnabled: true };
  const enemy = { uid: 10, kind: 'enemy', hp: 100, footX: 260, footY: 90, x: 260, y: 90, originX: 290, originY: 80, streamState: 'in_range', streamWalkSpeed: 40, attackType: 'melee' };
  const entities = [hero, enemy];
  for (let index = 0; index < 12; index += 1) advanceContinuousCombatArena({ globals: { time: index / 10, EnemySize: 40 }, entities, seconds: 0.1 });
  assert.ok(enemy.footY > 90, 'enemy pursues the vertically offset hero');
  assert.equal(enemy.y, enemy.footY, 'render mirror retains semantic foot Y');
  assert.notEqual(enemy.footX, enemy.originX, 'arena motion does not restore the stream entry origin');
});

test('boss combat keeps the four-times body to the right of the party and preserves surface reach', () => {
  for (const orientation of ['left-wise', 'right-wise']) {
    const heroes = [
      { uid: 1, name: 'Fara', kind: 'hero', hp: 100, attackType: 'melee', footX: 400, footY: 230 },
      { uid: 2, name: 'Hondo', kind: 'hero', hp: 100, attackType: 'melee', footX: 400, footY: 250 },
      { uid: 3, name: 'Runa', kind: 'hero', hp: 100, attackType: 'magic', footX: 400, footY: 270 },
      { uid: 4, name: 'Kaja', kind: 'hero', hp: 100, attackType: 'magic', footX: 400, footY: 290 },
    ];
    const boss = { uid: 90, name: 'Troll', kind: 'enemy', combatRank: 'boss', hp: 5000,
      streamState: 'roaming', streamSectorIndex: 0, streamDelivery: 'melee', streamWalkSpeed: 40, footX: 660, footY: 260 };
    const anchorX = 660;
    const globals = { time: 0, CombatOrientation: orientation,
      ContinuousCombatStage: { bossActive: true, bossWorldX: anchorX } };
    for (let tick = 0; tick < 500; tick += 1) {
      globals.time = tick * 0.1;
      advanceContinuousCombatArena({ globals, entities: [...heroes, boss], seconds: 0.1 });
    }

    assert.equal(actorFootprintRadius(boss), 72, 'boss collision radius matches its four-times linear sprite scale');
    assert.ok(boss.footX >= anchorX && boss.footX <= anchorX + 32, 'boss pursuit stays inside the local right-side encounter band');
    assert.ok(heroes.every(hero => hero.footX < boss.footX - actorFootprintRadius(boss) - actorFootprintRadius(hero)),
      'all living heroes remain left of the full boss footprint in either saved roam orientation');
    assert.ok(isActorTargetInRange(heroes[0], boss), 'frontline melee reaches the visible boss surface');
    assert.ok(isActorTargetInRange(boss, heroes[0]), 'boss melee reaches back from its visible body edge');
    assert.ok(heroes[0].footX > heroes[2].footX, 'frontline remains ahead of the ranged backline toward the boss');

    heroes[0].footX = boss.footX + 20;
    boss.footX = anchorX + 120;
    advanceContinuousCombatArena({ globals, entities: [...heroes, boss], seconds: 0 });
    assert.ok(heroes.every(hero => hero.footX <= anchorX - actorFootprintRadius(boss) - actorFootprintRadius(hero)),
      'post-separation bounds restore any skill or stationary displacement to the heroes-left side');
    assert.ok(boss.footX <= anchorX + 32, 'post-separation bounds keep the boss inside its local encounter band');
  }
});

test('enemy contact uses an in-reach target when a Provoke source is outside delivery range', () => {
  const nearby = { uid: 1, kind: 'hero', hp: 100, attackType: 'melee', footX: 980, footY: 300, arenaEnabled: true };
  const provoker = { uid: 2, kind: 'hero', hp: 100, attackType: 'melee', footX: 906, footY: 440, arenaEnabled: true };
  const enemy = { uid: 10, kind: 'enemy', hp: 100, footX: 1030, footY: 300, streamState: 'engaged', arenaInReach: true, streamDelivery: 'melee' };
  const globals = { time: 1, EnemySize: 40, RealtimeSkillEffects: { 10: { provoke: { sourceUID: 2, expiresAt: 5 } } } };
  advanceContinuousCombatArena({ globals, entities: [nearby, provoker, enemy], seconds: 0.1 });
  assert.equal(enemy.arenaTargetUID, nearby.uid);
  assert.equal(enemy.arenaInReach, true);
  assert.equal(enemy.streamState, 'engaged');
});

test('all in-reach enemies across local sectors engage without a pack-count cap', () => {
  const heroes = Array.from({ length: 4 }, (_, index) => ({
    uid: index + 1, kind: 'hero', hp: 100, attackType: index > 1 ? 'magic' : 'melee',
    footX: 1080 + (index % 2 ? 18 : -18), footY: 319.5 + (index < 2 ? -14 : 14),
  }));
  const enemies = Array.from({ length: 15 }, (_, index) => {
    const ranged = index % 3 !== 0;
    const radius = ranged ? 118 : 48;
    const angle = (Math.PI * 2 * index) / 15;
    return {
      uid: 100 + index, kind: 'enemy', hp: 80, streamState: 'roaming',
      streamDelivery: ranged ? 'ranged' : 'melee', streamSectorIndex: Math.floor(index / 3),
      footX: 1080 + Math.cos(angle) * radius,
      footY: 319.5 + Math.sin(angle) * radius,
    };
  });
  const beyondReach = { uid: 200, kind: 'enemy', hp: 80, streamState: 'roaming', streamDelivery: 'melee', streamSectorIndex: 5, footX: 1080 + 250, footY: 319.5 };
  const globals = { time: 1, ContinuousCombatStage: {} };
  advanceContinuousCombatArena({ globals, entities: [...heroes, ...enemies, beyondReach], seconds: 0 });
  const engaged = enemies.filter(enemy => enemy.streamState === 'engaged' && enemy.arenaInReach === true);
  assert.equal(engaged.length, enemies.length, 'all fifteen in-range actors across five sectors can engage in the same arena tick');
  assert.equal(new Set(engaged.map(enemy => enemy.streamSectorIndex)).size, 5);
  assert.equal(beyondReach.streamState, 'in_range');
  assert.equal(beyondReach.arenaInReach, false, 'actor-relative reach still gates enemy actions');
});

test('spawned pack feet are clustered and source-relative displacement remains bounded', () => {
  const globals = { time: 0, EnemySize: 40, EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 } };
  const spawned = Array.from({ length: 3 }, (_, index) => activateContinuousCombatSpawnedEnemy(globals, { uid: 20 + index, kind: 'enemy', hp: 100, name: 'Gobloc' }, { entryOrder: index, packIndex: 0, sectorIndex: 0 }));
  assert.equal(new Set(spawned.map(enemy => enemy.streamSectorIndex)).size, 1);
  assert.ok(Math.max(...spawned.map(enemy => enemy.footX)) - Math.min(...spawned.map(enemy => enemy.footX)) <= 100);
  assert.equal(new Set(spawned.map(enemy => enemy.footY)).size, 3);
  assert.ok(spawned.every(enemy => enemy.streamState === 'roaming'));
  assert.ok(spawned.every(enemy => enemy.actionState === 'spawn' && Number.isFinite(enemy.footY)));
  const enemy = { uid: 99, kind: 'enemy', hp: 100, streamState: 'engaged', footX: 180, footY: 230, x: 180, y: 230 };
  const source = { uid: 1, kind: 'hero', hp: 100, footX: 150, footY: 200 };
  assert.ok(pushContinuousCombatEnemy(enemy, 55, 0, source) > 0);
  assert.ok(enemy.footX > 180 && enemy.footY > 230);
  assert.ok(enemy.footX <= 290 && enemy.footY <= 375);
});

test('arena-enabled skill displacement stays in the expanded safe world height', () => {
  const bounds = deriveCombatWorldVerticalBounds();
  const enemy = { uid: 99, kind: 'enemy', hp: 100, streamState: 'engaged', arenaEnabled: true, footX: 500, footY: bounds.maxY - 2, x: 500, y: bounds.maxY - 2 };
  const source = { uid: 1, kind: 'hero', hp: 100, footX: 500, footY: bounds.maxY - 100 };
  assert.ok(pushContinuousCombatEnemy(enemy, 55, 0, source) > 0);
  assert.ok(enemy.footY <= bounds.maxY);
  assert.ok(enemy.footY > bounds.maxY - 10, 'push resolves against expanded arena bounds without returning to the legacy middle band');
});


test('a fixed boss can acquire and revalidate both ranged supports after frontline KO', () => {
  const boss = { uid: 20, name: 'Troll', kind: 'enemy', hp: 100, combatRank: 'boss', enemyRole: 'boss', streamDelivery: 'melee', footX: 1000, footY: 290, streamState: 'engaged' };
  const heroes = [
    { uid: 1, name: 'Fara', kind: 'hero', hp: 0, footX: 885, footY: 290 },
    { uid: 2, name: 'Hondo', kind: 'hero', hp: 0, footX: 885, footY: 330 },
    { uid: 3, name: 'Runa', kind: 'hero', hp: 60, attackType: 'magic', footX: 770, footY: 280 },
    { uid: 4, name: 'Kaja', kind: 'hero', hp: 65, attackType: 'magic', footX: 770, footY: 340 },
  ];
  const globals = { time: 1, ContinuousCombatStage: { bossActive: true, bossWorldX: 1000, bossWorldY: 290 } };
  advanceContinuousCombatArena({ globals, entities: [...heroes, boss], seconds: 1 / 60 });
  assert.equal(boss.streamState, 'engaged');
  assert.equal(boss.arenaInReach, true);
  for (const support of heroes.slice(2)) {
    assert.equal(isActorTargetInRange(boss, support), true);
    assert.equal(selectContinuousEnemyTarget({ enemy: boss, heroes, globals, preferredTarget: support, requireInReach: true })?.uid, support.uid);
  }
  heroes[2].hp = 0;
  assert.equal(selectContinuousEnemyTarget({ enemy: boss, heroes, globals, requireInReach: true })?.uid, 4);
  assert.equal(isActorTargetInRange({ ...boss, combatRank: 'ordinary', enemyRole: 'fodder' }, heroes[3]), false);
});
