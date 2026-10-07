import test from 'node:test';
import assert from 'node:assert/strict';
import { actorFootprintRadius, isActorTargetInRange } from '../src/core/arenaCombatRules.mjs';
import { advanceContinuousCombatArena } from '../web-runner/src/core/arenaCombat.mjs';
import { activateContinuousCombatSpawnedEnemy, pushContinuousCombatEnemy } from '../web-runner/src/core/continuousCombatStage.mjs';
import { deriveCombatWorldVerticalBounds } from '../src/core/combatOrientation.mjs';

test('actor reach uses initialized feet and preserves delivery-specific range', () => {
  const melee = { kind: 'hero', hp: 10, footX: 100, footY: 200, attackType: 'melee', arenaEnabled: true };
  const mage = { kind: 'hero', hp: 10, footX: 100, footY: 200, attackType: 'magic', arenaEnabled: true };
  const enemy = { kind: 'enemy', hp: 10, footX: 210, footY: 200, streamState: 'in_range' };
  assert.equal(isActorTargetInRange(melee, enemy), false);
  assert.equal(isActorTargetInRange(mage, enemy), true);
});

test('arena advances both factions to contact with bounded semantic actor state', () => {
  const hero = { uid: 1, kind: 'hero', hp: 100, maxHP: 100, attackType: 'melee' };
  const enemy = { uid: 2, kind: 'enemy', hp: 100, maxHP: 100, x: 290, y: 200, streamState: 'in_range', streamWalkSpeed: 40, streamDelivery: 'melee' };
  const entities = [hero, enemy];
  for (let index = 0; index < 70; index += 1) {
    advanceContinuousCombatArena({ globals: { EnemySize: 40 }, entities, seconds: 0.1 });
  }
  assert.ok(hero.footX > 106);
  assert.ok(enemy.footX < 290);
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
  assert.ok(Math.abs(spread - 52.8) < 1e-9, '66-unit startup offset is reduced to 52.8 around its original center');
  assert.ok(Math.abs(center - 73) < 1e-9, 'the fallback formation center stays fixed');
});

test('straggler regroup begins at the tightened 144-unit squad leash', () => {
  const heroes = [
    { uid: 1, name: 'Fara', kind: 'hero', hp: 100, attackType: 'physical', footX: 100, footY: 220 },
    { uid: 2, name: 'Hondo', kind: 'hero', hp: 100, attackType: 'physical', footX: 110, footY: 260 },
    { uid: 3, name: 'Runa', kind: 'hero', hp: 100, attackType: 'magic', footX: 120, footY: 300 },
    { uid: 4, name: 'Kaja', kind: 'hero', hp: 100, attackType: 'magic', footX: 320, footY: 340 },
  ];
  advanceContinuousCombatArena({ globals: {}, entities: heroes, seconds: 0.1 });
  assert.ok(heroes[3].footX < 320, 'a 150-plus unit outlier starts moving toward the party before the old 180-unit leash');
});

test('four heroes retain stable targets and separate crowded footprints', () => {
  const heroes = Array.from({ length: 4 }, (_, index) => ({ uid: index + 1, kind: 'hero', hp: 100, attackType: index === 2 ? 'magic' : 'melee', footX: 106, footY: 240, arenaEnabled: true }));
  const enemies = [
    { uid: 10, kind: 'enemy', hp: 100, streamState: 'in_range', footX: 175, footY: 240, streamDelivery: 'melee', arenaEnabled: true },
    { uid: 11, kind: 'enemy', hp: 100, streamState: 'in_range', footX: 178, footY: 240, streamDelivery: 'melee', arenaEnabled: true },
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

test('Fara and Hondo lead while Runa and Kaja keep ranged support spacing in either travel direction', () => {
  for (const enemyX of [650, 80]) {
    const direction = enemyX > 300 ? 1 : -1;
    const heroStartX = enemyX > 300 ? 120 : 320;
    const heroes = [
      { uid: 1, name: 'Fara', kind: 'hero', hp: 100, attackType: 'physical', footX: heroStartX, footY: 240 },
      { uid: 2, name: 'Hondo', kind: 'hero', hp: 100, attackType: 'physical', footX: heroStartX, footY: 280 },
      { uid: 3, name: 'Runa', kind: 'hero', hp: 100, attackType: 'magic', footX: heroStartX - direction * 10, footY: 240 },
      { uid: 4, name: 'Kaja', kind: 'hero', hp: 100, attackType: 'magic', footX: heroStartX - direction * 10, footY: 280 },
    ];
    const enemy = { uid: 20, name: 'Gobloc', kind: 'enemy', hp: 1000, streamState: 'in_range', streamWalkSpeed: 34, streamDelivery: 'melee', footX: enemyX, footY: 260 };
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
    { uid: 31, kind: 'enemy', hp: 80, footX: 2320, footY: 272, streamState: 'roaming', streamSectorIndex: 2 },
  ];
  const remoteBefore = enemies.slice(3).map(enemy => enemy.footX);
  advanceContinuousCombatArena({ globals: { time: 1 }, entities: [...heroes, ...enemies], seconds: 0.1 });
  assert.ok(heroes.every(hero => Number(hero.arenaTargetUID) >= 20 && Number(hero.arenaTargetUID) <= 22));
  assert.ok(enemies.slice(0, 3).every(enemy => ['in_range', 'engaged'].includes(enemy.streamState)));
  assert.deepEqual(enemies.slice(3).map(enemy => enemy.footX), remoteBefore);
  assert.deepEqual(enemies.slice(3).map(enemy => enemy.streamState), ['roaming', 'roaming']);
});

test('a wounded retreating encounter holds the whole squad until neutralized', () => {
  const heroes = Array.from({ length: 4 }, (_, index) => ({ uid: index + 1, kind: 'hero', hp: 100, footX: 300 + index * 6, footY: 250 + index * 10 }));
  const survivor = { uid: 20, kind: 'enemy', hp: 20, footX: 380, footY: 300, streamState: 'retreating', streamSectorIndex: 4 };
  const nearerPack = { uid: 30, kind: 'enemy', hp: 100, footX: 300, footY: 330, streamState: 'roaming', streamSectorIndex: 5 };
  const globals = { time: 2, ContinuousCombatStage: { activeEncounterGroupId: 4 } };
  const before = heroes.map(hero => [hero.footX, hero.footY]);
  advanceContinuousCombatArena({ globals, entities: [...heroes, survivor, nearerPack], seconds: 0.1 });
  assert.ok(heroes.every(hero => hero.arenaTargetUID === survivor.uid));
  assert.equal(globals.ContinuousCombatStage.activeEncounterGroupId, 4);
  assert.deepEqual([nearerPack.footX, nearerPack.footY, nearerPack.streamState], [300, 330, 'roaming']);
  assert.ok(heroes.some((hero, index) => Math.hypot(hero.footX - before[index][0], hero.footY - before[index][1]) > 0), 'party continues working the committed survivor');

  survivor.hp = 0;
  advanceContinuousCombatArena({ globals, entities: [...heroes, survivor, nearerPack], seconds: 0.1 });
  assert.equal(globals.ContinuousCombatStage.activeEncounterGroupId, 5);
  assert.ok(heroes.every(hero => hero.arenaTargetUID === nearerPack.uid));
});

test('six seeded packs occupy the full HUD-safe world height while each pack stays compact', () => {
  const globals = { EnemySize: 40, EncounterSeed: 17, ContinuousCombatStage: { seed: 17 } };
  const centers = [];
  for (let sector = 0; sector < 6; sector += 1) {
    const pack = [0, 1, 2].map(order => activateContinuousCombatSpawnedEnemy(globals, {
      uid: sector * 3 + order + 1, kind: 'enemy', hp: 20, name: 'Gobloc', enemyRole: 'ordinary',
    }, { lane: order, rank: 0, packIndex: 0, entryOrder: order, sectorIndex: sector }));
    const ys = pack.map(enemy => enemy.footY);
    assert.ok(Math.max(...ys) - Math.min(...ys) <= 20, 'each enemy pack remains a compact local group');
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
    { uid: 1, name: 'Fara', kind: 'hero', hp: 100, attackType: 'physical', footX: 1000, footY: 260 },
    { uid: 2, name: 'Hondo', kind: 'hero', hp: 100, attackType: 'physical', footX: 990, footY: 280 },
    { uid: 3, name: 'Runa', kind: 'hero', hp: 100, attackType: 'magic', footX: 980, footY: 260 },
    { uid: 4, name: 'Kaja', kind: 'hero', hp: 100, attackType: 'magic', footX: 970, footY: 280 },
  ];
  const first = { uid: 20, kind: 'enemy', hp: 50, footX: 1400, footY: 270, streamState: 'roaming', streamSectorIndex: 0 };
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
    { uid: 1, name: 'Fara', kind: 'hero', hp: 100, attackType: 'physical', footX: 220, footY: 300 },
    { uid: 2, name: 'Hondo', kind: 'hero', hp: 100, attackType: 'physical', footX: 210, footY: 320 },
    { uid: 3, name: 'Runa', kind: 'hero', hp: 100, attackType: 'magic', footX: 320, footY: 300 },
    { uid: 4, name: 'Kaja', kind: 'hero', hp: 100, attackType: 'magic', footX: 330, footY: 320 },
  ];
  const enemy = { uid: 20, kind: 'enemy', hp: 100, footX: 380, footY: 310, streamState: 'engaged', streamSectorIndex: 0 };
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
    assert.ok(heroes.slice(2).every(hero => isActorTargetInRange(hero, enemy)), 'rear ranged heroes remain inside their authored contact range');
    assert.ok(heroes.every(hero => Math.hypot(hero.footX - center.x, hero.footY - center.y) < 80), 'all four remain inside the tightened cohort envelope during close-contact regrouping');
  };
  assertFormation(1);
  enemy.footX = 145;
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
  assert.ok(heroes.every(hero => hero.footX > 40 && hero.footX < 1440), 'formation rear slots remain inside world bounds before the squad center advances');
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
    hero.footX = 2835;
    hero.arenaTargetUID = 30;
  }
  enemies[1].footX = 2875;
  advanceContinuousCombatArena({ globals: { time: 3 }, entities: [...heroes, ...enemies], seconds: 2 });
  assert.ok(heroes.every(hero => hero.footX <= 2840));
  assert.ok(enemies[1].footX <= 2880);
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

test('a live Provoke redirects arena pursuit before an enemy can start another contact attack', () => {
  const nearby = { uid: 1, kind: 'hero', hp: 100, attackType: 'melee', footX: 180, footY: 200, arenaEnabled: true };
  const provoker = { uid: 2, kind: 'hero', hp: 100, attackType: 'melee', footX: 106, footY: 340, arenaEnabled: true };
  const enemy = { uid: 10, kind: 'enemy', hp: 100, footX: 230, footY: 200, streamState: 'engaged', arenaInReach: true, streamDelivery: 'melee' };
  const globals = { time: 1, EnemySize: 40, RealtimeSkillEffects: { 10: { provoke: { sourceUID: 2, expiresAt: 5 } } } };
  advanceContinuousCombatArena({ globals, entities: [nearby, provoker, enemy], seconds: 0.1 });
  assert.equal(enemy.arenaTargetUID, 2);
  assert.equal(enemy.arenaInReach, false);
  assert.equal(enemy.streamState, 'in_range');
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
