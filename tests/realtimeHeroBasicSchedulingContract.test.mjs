import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { realtimeCooldownSeconds, scheduleRealtimeActions, selectRealtimeReadyActor } from '../web-runner/src/core/realtimeCooldown.mjs';
import { isHeroBasicTargetInRange, resolveHeroAttackTarget } from '../src/core/heroAttackTargetingRules.mjs';
import { resetCombatSessionConditions } from '../web-runner/systems/combatSessionReset.mjs';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { heroDefinition, heroSkillUnlocked } from '../web-runner/src/core/heroDefinitions.mjs';
import { filterContinuousEncounterEnemies, selectRealtimeHeroSkillTarget } from '../web-runner/src/core/realtimeHeroTargeting.mjs';
import { castRealtimeHeroSkill, realtimeBasicInterval, tickRealtimeHeroSkillZones } from '../web-runner/src/core/realtimeHeroSkills.mjs';

const source = fs.readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');

function loadTickRealtimeHeroBasics() {
  const start = source.indexOf('export function TickRealtimeHeroBasics(ctx) {');
  const end = source.indexOf('\nexport function TickRealtimeEnemyActions(', start);
  const body = source.slice(start, end).replace('export function', 'function');
  return new Function(
    'getGlobals', 'getEnemies', 'resolveHeroAttackTarget', 'isHeroBasicTargetInRange', 'getEntities',
    'GetEffectiveStat', 'realtimeCooldownSeconds', 'selectRealtimeReadyActor', 'scheduleRealtimeActions',
    'HeroAttackSingle', 'GetActorByUID', 'tickRealtimeHeroSkillZones', 'heroDefinition', 'heroSkillUnlocked',
    'selectRealtimeHeroSkillTarget', 'filterContinuousEncounterEnemies', 'castRealtimeHeroSkill', 'realtimeBasicInterval',
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
    tickRealtimeHeroSkillZones, heroDefinition, heroSkillUnlocked, selectRealtimeHeroSkillTarget, filterContinuousEncounterEnemies, castRealtimeHeroSkill, realtimeBasicInterval,
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
  assert.equal(resolveHeroAttackTarget({ enemies: localTargets, focusUID: 90, inRange: enemy => isHeroBasicTargetInRange(actors[0], enemy) })?.uid, 90,
    'a living in-reach focus remains sticky across sector identity');
  assert.equal(resolveHeroAttackTarget({ enemies: localTargets, focusUID: 93, inRange: enemy => isHeroBasicTargetInRange(actors[0], enemy) })?.uid, 93,
    'a roaming actor already inside hero reach is a valid target before arena state catches up');
  const ambush = HERO_DEFINITIONS.Huun.actives.find(skill => skill.skillId === 'ambush');
  const skillSelection = selectRealtimeHeroSkillTarget({ skill: ambush, hero: actors[0], heroes: actors, enemies: [committed, nearerNextPack], globals, now: globals.time });
  assert.equal(skillSelection?.targetUID, 90, 'the authored skill ordering still chooses the lower-health local target');
  assert.equal(tick(ctx), 1);
  assert.equal(globals.PendingHeroHits[0].targetUID, 90, 'the retained living focus remains stable while other local sectors are eligible');
});

test('no in-range target preserves an overdue attack for the next eligible target', () => {
  const outOfRange = { uid: 90, kind: 'enemy', hp: 20, x: 500, streamState: 'in_range' };
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
  target.x = 500;
  target.footX = 500;
  globals.time += 1 / 60;
  assert.equal(tick(ctx), 0);
  assert.equal(globals.RealtimeHeroBasicScheduledActions['2'], undefined);
  assert.equal(globals.RealtimeHeroBasicReadyAt['2'], action.dueAt);
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


test('the real scheduler filters locked skills even when every skill clock is ready',()=>{
 const {ctx,globals,actors,tick}=fixture({heroes:[1],enemies:[{uid:90,kind:'enemy',hp:1000,maxHP:1000,x:220,y:200,streamState:'engaged'}]});
 Object.assign(actors[0],{baseHeroName:'Huun',currentLevel:1});
 ctx.callFunction=()=>0;
 const used=new Set();
 for(let n=0;n<1800;n++){globals.time=n/30;tick(ctx);if(globals.LastRealtimeHeroSkill)used.add(globals.LastRealtimeHeroSkill.skillId);globals.PendingHeroHits=[];}
 assert.deepEqual([...used],['ambush']);
 actors[0].currentLevel=5;globals.RealtimeHeroBasicClocks={};globals.RealtimeHeroBasicScheduledActions={};
 for(let n=1800;n<2400;n++){globals.time=n/30;tick(ctx);if(globals.LastRealtimeHeroSkill)used.add(globals.LastRealtimeHeroSkill.skillId);globals.PendingHeroHits=[];}
 assert.deepEqual([...used].sort(),['ambush','cheap_shot']);
});

test('the live scheduler lets Sanctuary see KO allies while preserving the caster cooldowns',()=>{
 const {ctx,globals,actors,tick}=fixture({time:10,heroes:[1,2],enemies:[{uid:90,kind:'enemy',hp:1000,maxHP:1000,x:220,y:200,streamState:'engaged'}]});
 Object.assign(actors[0],{baseHeroName:'Falie',maxHP:100,hp:0,currentLevel:100});Object.assign(actors[1],{baseHeroName:'Kojonn',maxHP:100,hp:100,currentLevel:100});
 globals.RealtimeHeroBasicClocks={1:{basicReadyAt:20,skillReadyAt:{cover:100}},2:{basicReadyAt:100,skillReadyAt:Object.fromEntries(heroDefinition(actors[1]).actives.map(skill=>[skill.skillId,skill.skillId==='sanctuary'?0:100]))}};
 ctx.callFunction=(name,sourceUID,targetUID,pct,revive)=>{if(name==='HealRealtimeActor'){const target=ctx.state.entities.find(a=>a.uid===targetUID);if(revive&&target.hp===0){target.hp=Math.floor(target.maxHP*pct/100);return target.hp;}}return 0;};
 assert.equal(tick(ctx),1);assert.equal(actors[0].hp,30);assert.equal(globals.LastRealtimeHeroSkill.skillId,'sanctuary');assert.equal(globals.RealtimeHeroBasicClocks[1].skillReadyAt.cover,100);
 assert.equal(globals.RealtimeHeroBasicClocks[2].skillReadyAt.sanctuary,75);
});
test('a cancelled skill refunds its due time if its caster KOs before commitment',()=>{
 const {ctx,globals,actors,tick}=fixture({time:10,heroes:[1],enemies:[{uid:90,kind:'enemy',hp:1000,maxHP:1000,x:220,y:200,streamState:'engaged'}]});
 actors[0].hp=0;globals.RealtimeHeroBasicClocks={1:{basicReadyAt:20,skillReadyAt:{cover:100}}};globals.RealtimeHeroBasicScheduledActions={1:{kind:'skill',skillId:'cover',dueAt:5,startAt:11}};
 tick(ctx);assert.equal(globals.RealtimeHeroBasicClocks[1].skillReadyAt.cover,5);assert.equal(globals.RealtimeHeroBasicScheduledActions[1],undefined);
});
