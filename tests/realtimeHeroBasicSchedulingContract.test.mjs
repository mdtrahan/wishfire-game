import { previewSeededRng } from '../src/core/seededRngRules.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { realtimeCooldownSeconds, scheduleRealtimeActions, selectRealtimeReadyActor } from '../web-runner/src/core/realtimeCooldown.mjs';
import { isHeroBasicTargetInRange, resolveHeroAttackTarget } from '../src/core/heroAttackTargetingRules.mjs';
import { resetCombatSessionConditions } from '../web-runner/systems/combatSessionReset.mjs';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { heroDefinition, heroSkillUnlocked } from '../web-runner/src/core/heroDefinitions.mjs';
import { filterContinuousEncounterEnemies, selectRealtimeHeroSkillTarget } from '../web-runner/src/core/realtimeHeroTargeting.mjs';
import { castRealtimeHeroSkill, realtimeBasicInterval, realtimeSpecialCooldown, tickRealtimeHeroSkillZones } from '../web-runner/src/core/realtimeHeroSkills.mjs';
import { advancePassiveHeroRegen } from '../web-runner/src/core/heroSustainRules.mjs';
import { recordBalanceCombatEvent } from '../web-runner/src/core/balanceTelemetry.mjs';
import { saveHeroProgress } from '../web-runner/src/core/heroProgression.mjs';

const source = fs.readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');

function loadTickRealtimeHeroBasics() {
  const start = source.indexOf('export function TickRealtimeHeroBasics(ctx) {');
  const end = source.indexOf('\nexport function TickRealtimeEnemyActions(', start);
  const body = source.slice(start, end).replace('export function', 'function');
  return new Function(
    'getGlobals', 'getEnemies', 'resolveHeroAttackTarget', 'isHeroBasicTargetInRange', 'getEntities',
    'GetEffectiveStat', 'realtimeCooldownSeconds', 'selectRealtimeReadyActor', 'scheduleRealtimeActions',
    'HeroAttackSingle', 'GetActorByUID', 'tickRealtimeHeroSkillZones', 'heroDefinition', 'heroSkillUnlocked',
    'selectRealtimeHeroSkillTarget', 'filterContinuousEncounterEnemies', 'castRealtimeHeroSkill', 'realtimeBasicInterval', 'realtimeSpecialCooldown',
    'advancePassiveHeroRegen', 'recordBalanceCombatEvent', 'saveHeroProgress', 'UpdateHeroHPUI',
    'pushContinuousCombatEnemy', 'reverseContinuousCombatEnemy', 'teleportContinuousCombatEnemy',
    `${body}; return TickRealtimeHeroBasics;`,
  )(ctx => ctx.state.globals,
    ctx => ctx.state.entities.filter(entity => entity.kind === 'enemy' && entity.hp > 0 && entity.streamState !== 'approaching'),
    resolveHeroAttackTarget,
    isHeroBasicTargetInRange,
    ctx => ctx.state.entities,
    (_ctx, hero, stat) => Number(hero.stats?.[stat] ?? hero[stat] ?? 0),
    realtimeCooldownSeconds,
    selectRealtimeReadyActor,
    scheduleRealtimeActions,
    (ctx, heroUID, targetUID) => {
      ctx.state.globals.PendingHeroHits.push({ at: ctx.state.globals.time + 0.52, heroUID, targetUID });
    },
    (ctx, uid) => ctx.state.entities.find(entity => Number(entity.uid) === Number(uid)) || null,
    tickRealtimeHeroSkillZones, heroDefinition, heroSkillUnlocked, selectRealtimeHeroSkillTarget, filterContinuousEncounterEnemies, castRealtimeHeroSkill, realtimeBasicInterval, realtimeSpecialCooldown,
    advancePassiveHeroRegen, recordBalanceCombatEvent, saveHeroProgress, () => {},
    () => false, () => false, () => false,
  );
}

function fixture({ time = 0, heroes = [1], readyAt = null, enemies = [] } = {}) {
  const actors = heroes.map(uid => ({ uid, kind: 'hero', hp: 50, SPD: 8, footX: 160, footY: 200, stats: { SPD: 8 } }));
  const globals = { ContinuousCombatStageLoop: 1, GamePhase: 'RUNTIME', time, PendingHeroHits: [] };
  if (readyAt) globals.RealtimeHeroBasicReadyAt = { ...readyAt };
  for (const enemy of enemies) {
    if (!Number.isFinite(Number(enemy.footX))) enemy.footX = enemy.x;
    if (!Number.isFinite(Number(enemy.footY))) enemy.footY = enemy.y ?? 200;
  }
  const ctx = { state: { globals, entities: [...actors, ...enemies] } };
  return { ctx, globals, actors, tick: loadTickRealtimeHeroBasics() };
}

test('first engagement seeds SPD interval and UID phase through TickRealtimeHeroBasics', () => {
  const { ctx, globals, actors, tick } = fixture({ time: 9, heroes: [1, 2] });
  assert.equal(tick(ctx), 0);
  assert.deepEqual(globals.RealtimeHeroBasicReadyAt, {});

  ctx.state.entities.push({ uid: 90, kind: 'enemy', hp: 100, x: 400, y: 200, footX: 400, footY: 200, streamState: 'approaching' });
  assert.equal(tick(ctx), 0);
  assert.deepEqual(globals.RealtimeHeroBasicReadyAt, {});

  ctx.state.entities[2].x = 200;
  ctx.state.entities[2].footX = 200;
  ctx.state.entities[2].streamState = 'in_range';
  const seeded = selectRealtimeReadyActor({ actors: actors.map(hero => ({ ...hero, type: 0, speed: 8 })), now: 9, selectionEnabled: false }).readyAt;
  assert.equal(tick(ctx), 0);
  assert.deepEqual(globals.RealtimeHeroBasicReadyAt, seeded);
  assert.equal(globals.PendingHeroHits.length, 0);

  const firstDue = Math.min(...Object.values(seeded));
  globals.time = firstDue;
  assert.equal(tick(ctx), 1);
  assert.equal(globals.PendingHeroHits.length, 1);
  assert.equal(globals.PendingHeroHits[0].heroUID, Number(Object.keys(seeded).find(uid => seeded[uid] === firstDue)));
  assert.equal(globals.PendingHeroHits[0].targetUID, 90);
  assert.equal(globals.PendingHeroHits[0].at, firstDue + 0.52);
});

test('colliding basics start on separate ticks and re-resolve the in-range target', () => {
  const targetA = { uid: 90, kind: 'enemy', hp: 20, x: 200, streamState: 'in_range' };
  const targetB = { uid: 91, kind: 'enemy', hp: 20, x: 210, streamState: 'in_range' };
  const { ctx, globals, tick } = fixture({ time: 20, heroes: [1, 2], readyAt: { 1: 20, 2: 20 }, enemies: [targetA, targetB] });
  assert.equal(tick(ctx), 1);
  assert.deepEqual(globals.PendingHeroHits.map(hit => hit.heroUID), [1]);
  assert.equal(globals.RealtimeHeroBasicScheduledActions['2'].startAt, 20 + 1 / 60);
  assert.ok(globals.RealtimeHeroBasicClocks['1'].castUntil < globals.PendingHeroHits[0].at);

  targetA.hp = 0;
  globals.time += 1 / 60;
  assert.equal(tick(ctx), 1);
  assert.deepEqual(globals.PendingHeroHits.map(hit => [hit.heroUID, hit.targetUID]), [[1, 91], [2, 91]]);
});

test('hero basics and conditional skills can target every active local sector while remote roaming stays dormant', () => {
  const committed = { uid: 90, kind: 'enemy', hp: 800, maxHP: 1000, x: 200, footX: 200, footY: 200, streamState: 'retreating', streamSectorIndex: 10 };
  const nearerNextPack = { uid: 91, kind: 'enemy', hp: 1000, maxHP: 1000, x: 165, footX: 165, footY: 200, streamState: 'engaged', streamSectorIndex: 11 };
  const remotePack = { uid: 92, kind: 'enemy', hp: 1000, maxHP: 1000, x: 1300, footX: 1300, footY: 600, streamState: 'roaming', streamSectorIndex: 12 };
  const preActivation = { uid: 93, kind: 'enemy', hp: 1000, x: 160, footX: 160, footY: 200, streamState: 'roaming', streamSectorIndex: 13 };
  const { ctx, globals, actors, tick } = fixture({ time: 30, heroes: [1], readyAt: { 1: 30 }, enemies: [committed, nearerNextPack, remotePack, preActivation] });
  Object.assign(actors[0], { baseHeroName: 'Huun', currentLevel: 100 });
  globals.ContinuousCombatStage = { activeEncounterGroupId: 10 };
  const localTargets = filterContinuousEncounterEnemies([committed, nearerNextPack, remotePack, preActivation], globals, actors);
  assert.deepEqual(localTargets.map(enemy => enemy.uid), [90, 91, 93]);
  assert.equal(resolveHeroAttackTarget({ hero:actors[0], enemies:localTargets, inRange:enemy=>isHeroBasicTargetInRange(enemy,actors[0]) })?.uid,93,'each hero acquires its closest living foe');
  const shadow = HERO_DEFINITIONS.Huun.special;
  const skillSelection = selectRealtimeHeroSkillTarget({ skill: shadow, hero: actors[0], heroes: actors, enemies: [committed, nearerNextPack], globals, now: globals.time });
  assert.equal(skillSelection?.targetUID, 91, 'the Special targets the nearest local foe in reach');
  assert.equal(tick(ctx), 1);
  assert.equal(globals.PendingHeroHits[0].targetUID, 93, 'basic acquisition uses the nearest living foe regardless of sector');
});

test('no in-range target preserves an overdue attack for the next eligible target', () => {
  const outOfRange = { uid: 90, kind: 'enemy', hp: 20, x: 1000, streamState: 'in_range' };
  const { ctx, globals, tick } = fixture({ time: 100, heroes: [1], readyAt: { 1: 5 }, enemies: [outOfRange] });
  assert.equal(tick(ctx), 0);
  assert.equal(globals.RealtimeHeroBasicReadyAt['1'], 5);
  outOfRange.x = 200;
  outOfRange.footX = 200;
  assert.equal(tick(ctx), 1);
  assert.equal(globals.PendingHeroHits[0].targetUID, 90);
  assert.ok(globals.RealtimeHeroBasicReadyAt['1'] > 5);
});

test('long-frame catch-up services at most one basic for each actor per tick', () => {
  const enemy = { uid: 90, kind: 'enemy', hp: 100, x: 200, streamState: 'in_range' };
  const { ctx, globals, tick } = fixture({ time: 100, heroes: [1, 2], readyAt: { 1: 1, 2: 1 }, enemies: [enemy] });
  assert.equal(tick(ctx), 1);
  assert.deepEqual(globals.PendingHeroHits.map(hit => hit.heroUID), [1]);
  globals.time += 0.02;
  assert.equal(tick(ctx), 2);
  const secondTickUIDs = globals.PendingHeroHits.slice(1).map(hit => hit.heroUID);
  assert.deepEqual(secondTickUIDs, [2, 1], 'the earlier staged start dispatches before the new overdue start');
  assert.equal(new Set(secondTickUIDs).size, secondTickUIDs.length);
  assert.equal(globals.PendingHeroHits.filter(hit => hit.heroUID === 1).length, 2);
  assert.equal(globals.PendingHeroHits.filter(hit => hit.heroUID === 2).length, 1);
});

test('scheduled basic dispatch validates range again and restores dueAt when its target disappears', () => {
  const target = { uid: 90, kind: 'enemy', hp: 20, x: 200, streamState: 'in_range' };
  const { ctx, globals, tick } = fixture({ time: 20, heroes: [1, 2], readyAt: { 1: 20, 2: 20 }, enemies: [target] });
  tick(ctx);
  const action = globals.RealtimeHeroBasicScheduledActions['2'];
  assert.ok(action);
  target.x = 1000;
  target.footX = 1000;
  globals.time += 1 / 60;
  assert.equal(tick(ctx), 0);
  assert.equal(globals.RealtimeHeroBasicScheduledActions['2'], undefined);
  assert.equal(globals.RealtimeHeroBasicReadyAt['2'], action.dueAt);
});

test('each Hero attacks a reachable enemy when shared focus is out of range', () => {
  const enemies = [
    { uid: 90, kind: 'enemy', hp: 20, x: 200, y: 200, streamState: 'engaged' },
    { uid: 91, kind: 'enemy', hp: 20, x: 520, y: 200, streamState: 'engaged' },
  ];
  const { ctx, globals, actors, tick } = fixture({ time: 20, heroes: [1, 2], readyAt: { 1: 20, 2: 20 }, enemies });
  actors[1].footX = 480;
  globals.RealtimeHeroFocusTargetUID = 90;
  for (let frame = 0; frame < 4; frame += 1) {
    globals.time = 20 + frame / 60;
    tick(ctx);
  }
  assert.equal(globals.RealtimeHeroFocusTargetUID, 90);
  assert.deepEqual(globals.PendingHeroHits.map(hit => [hit.heroUID, hit.targetUID]), [[1, 90], [2, 91]]);
});

test('redirected basics choose replacements reachable by each source Hero', () => {
  const enemies = [
    { uid: 90, kind: 'enemy', hp: 20, x: 200, y: 200, streamState: 'engaged' },
    { uid: 91, kind: 'enemy', hp: 20, x: 520, y: 200, streamState: 'engaged' },
    { uid: 99, kind: 'enemy', hp: 0, x: 350, y: 200, streamState: 'engaged' },
  ];
  const { ctx, globals, actors, tick } = fixture({ time: 20, heroes: [1, 2], readyAt: { 1: 100, 2: 100 }, enemies });
  actors[1].footX = 480;
  globals.RealtimeHeroFocusTargetUID = 90;
  globals.PendingHeroHits.push(
    { heroUID: 1, targetUID: 99, realtimeBasic: 1, retargetOnDeath: 1, at: 20 },
    { heroUID: 2, targetUID: 99, realtimeBasic: 1, retargetOnDeath: 1, at: 20 },
  );
  tick(ctx);
  assert.deepEqual(globals.PendingHeroHits.map(hit => [hit.heroUID, hit.targetUID, hit.at]), [[1, 90, 20.52], [2, 91, 20.52]]);
});

test('fresh session reset discards pending clocks before hero UIDs repeat', () => {
  const enemy = { uid: 90, kind: 'enemy', hp: 100, x: 200, streamState: 'in_range' };
  const { ctx, globals, tick } = fixture({ time: 20, heroes: [1, 2], readyAt: { 1: 20, 2: 20 }, enemies: [enemy] });
  assert.equal(tick(ctx), 1);
  assert.ok(globals.RealtimeHeroBasicScheduledActions['2']);

  resetCombatSessionConditions(globals, {});
  globals.ContinuousCombatStageLoop = 1;
  globals.GamePhase = 'RUNTIME';
  globals.time = 50;
  assert.equal(globals.RealtimeHeroBasicClocks, undefined);
  assert.equal(globals.RealtimeHeroBasicScheduledActions, undefined);
  assert.equal(globals.RealtimeHeroBasicReadyAt, undefined);
  assert.equal(tick(ctx), 0);
  assert.ok(Object.values(globals.RealtimeHeroBasicReadyAt).every(at => at > globals.time));
  assert.equal(globals.PendingHeroHits.length, 0);
});


test('the real scheduler casts only the Special; passives and resonances never take a clock',()=>{
 const {ctx,globals,actors,tick}=fixture({heroes:[1],enemies:[{uid:90,kind:'enemy',hp:1000,maxHP:1000,x:220,y:200,streamState:'engaged'}]});
 Object.assign(actors[0],{baseHeroName:'Huun',currentLevel:1});
 ctx.callFunction=()=>0;
 const used=new Set();
 for(let n=0;n<1800;n++){globals.time=n/30;tick(ctx);if(globals.LastRealtimeHeroSkill)used.add(globals.LastRealtimeHeroSkill.skillId);globals.PendingHeroHits=[];}
 assert.deepEqual([...used],['shadow']);
 assert.deepEqual(Object.keys(globals.RealtimeHeroBasicClocks[1].skillReadyAt),['shadow']);
});

test('the live scheduler reserves the star-reduced Special cooldown without changing basic cadence',()=>{
 for(const stars of [0,2,4,8]){
  const {ctx,globals,actors,tick}=fixture({heroes:[1],enemies:[{uid:90,kind:'enemy',hp:1000,maxHP:1000,x:220,y:200,streamState:'engaged'}]});
  Object.assign(actors[0],{baseHeroName:'Huun',currentLevel:1,maxHP:100,hp:100});
  globals.HeroGrowth={stars:{Huun:stars}};
  globals.RealtimeHeroBasicClocks={1:{basicReadyAt:20,skillReadyAt:{shadow:0}}};
  ctx.callFunction=()=>0;
  tick(ctx);
  assert.equal(globals.LastRealtimeHeroSkill.skillId,'shadow');
  assert.equal(globals.RealtimeHeroBasicClocks[1].skillReadyAt.shadow,20*(stars>=2?.92:1));
  assert.equal(globals.RealtimeHeroBasicClocks[1].basicReadyAt,20);
 }
});

test('the live scheduler casts party-wide Elevate while preserving every other clock',()=>{
 const {ctx,globals,actors,tick}=fixture({time:10,heroes:[1,2],enemies:[{uid:90,kind:'enemy',hp:1000,maxHP:1000,x:220,y:200,streamState:'engaged'}]});
 Object.assign(actors[0],{baseHeroName:'Falie',maxHP:100,hp:100,currentLevel:1,footX:900,x:900});Object.assign(actors[1],{baseHeroName:'Kojonn',maxHP:100,hp:100,currentLevel:1});
 Object.assign(globals,{RuntimeRandomSeed:12,RuntimeRandomDraws:0});globals.RuntimeRandom=()=>previewSeededRng(globals.RuntimeRandomSeed,globals.RuntimeRandomDraws++);
 globals.RealtimeHeroBasicClocks={1:{basicReadyAt:20,skillReadyAt:{crimson_ward:100}},2:{basicReadyAt:100,skillReadyAt:{elevate:0}}};
 ctx.callFunction=()=>0;
 tick(ctx);assert.equal(globals.LastRealtimeHeroSkill.skillId,'elevate');assert.ok(globals.RealtimeSkillEffects[1].elevate,'distant allies still receive Elevate');
 assert.equal(globals.RealtimeHeroBasicClocks[1].skillReadyAt.crimson_ward,100);
 assert.ok(Math.abs(globals.RealtimeHeroBasicClocks[2].skillReadyAt.elevate-30)<.1);
});
test('a cancelled skill refunds its due time if its caster KOs before commitment',()=>{
 const {ctx,globals,actors,tick}=fixture({time:10,heroes:[1],enemies:[{uid:90,kind:'enemy',hp:1000,maxHP:1000,x:220,y:200,streamState:'engaged'}]});
 actors[0].hp=0;globals.RealtimeHeroBasicClocks={1:{basicReadyAt:20,skillReadyAt:{cover:100}}};globals.RealtimeHeroBasicScheduledActions={1:{kind:'skill',skillId:'cover',dueAt:5,startAt:11}};
 tick(ctx);assert.equal(globals.RealtimeHeroBasicClocks[1].skillReadyAt.cover,5);assert.equal(globals.RealtimeHeroBasicScheduledActions[1],undefined);
});
