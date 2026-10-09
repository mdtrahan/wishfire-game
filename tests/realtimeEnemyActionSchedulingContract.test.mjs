import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { advanceEnemyActionSimulation } from '../web-runner/systems/combatSimulationTick.mjs';
import { pickEnemyTargetHeroFromRoster } from '../web-runner/src/core/enemyTargetingRules.mjs';
import { advanceContinuousCombatArena, selectContinuousEnemyTarget } from '../web-runner/src/core/arenaCombat.mjs';
import { isActorTargetInRange } from '../src/core/arenaCombatRules.mjs';
import { activateContinuousCombatSpawnedEnemy } from '../web-runner/src/core/continuousCombatStage.mjs';
import { realtimeCooldownSeconds } from '../web-runner/src/core/realtimeCooldown.mjs';
import { realtimeProvokeTarget } from '../web-runner/src/core/realtimeHeroSkills.mjs';

const functionBank = fs.readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');

function loadTickRealtimeEnemyActions(pickTarget = null, startAction = null) {
  const start = functionBank.indexOf('export function TickRealtimeEnemyActions(ctx) {');
  const end = functionBank.indexOf('\nfunction HeroAttackSplit(', start);
  const body = functionBank.slice(start, end).replace('export function', 'function');
  return new Function('getGlobals', 'getEntities', 'pickEnemyTargetHero', 'StartRealtimeEnemyAction', `${body}; return TickRealtimeEnemyActions;`)(
    ctx => ctx.state.globals,
    ctx => ctx.state.entities,
    pickTarget || ((ctx, uid) => ctx.state.entities.find(actor => actor.kind === 'hero' && actor.hp > 0) || null),
    startAction || ((ctx, uid) => {
      const enemy = ctx.state.entities.find(actor => actor.uid === uid);
      const now = Number(ctx.state.globals.time || 0);
      const cooldownSeconds = enemy.cooldownSeconds || 1.6;
      const target = (pickTarget || ((actionCtx) => actionCtx.state.entities.find(actor => actor.kind === 'hero' && actor.hp > 0) || null))(ctx, uid);
      ctx.state.globals.RealtimeEnemyActionsByUID[String(uid)] = {
        uid, active: true, state: 'ADVANCE', timer: 0, actionApplied: false,
        targetUID: target?.uid || 0,
        startedAt: now, cooldownSeconds, nextReadyAt: now + cooldownSeconds,
      };
      ctx.state.globals.RealtimeEnemyActionReadyAt[String(uid)] = now + cooldownSeconds;
    }),
  );
}

function loadResolveEnemyActionTarget() {
  const start = functionBank.indexOf('export function ResolveEnemyActionTarget(ctx, enemyUID, preferredTargetUID = 0) {');
  const end = functionBank.indexOf('\nfunction applyRunaMagicResist(', start);
  const body = functionBank.slice(start, end).replace('export function', 'function');
  return new Function('getGlobals', 'GetActorByUID', 'getHeroes', 'selectContinuousEnemyTarget', 'isActorTargetInRange', `${body}; return ResolveEnemyActionTarget;`)(
    ctx => ctx.state.globals,
    (ctx, uid) => ctx.state.entities.find(actor => actor.uid === uid) || null,
    ctx => ctx.state.entities.filter(actor => actor.kind === 'hero' && actor.hp > 0),
    selectContinuousEnemyTarget,
    isActorTargetInRange,
  );
}

function loadPickEnemyTargetHero() {
  const start = functionBank.indexOf('function pickEnemyTargetHero(ctx, enemyUID = 0) {');
  const end = functionBank.indexOf('\nexport function ResolveEnemyActionTarget(', start);
  const body = functionBank.slice(start, end);
  return new Function('getGlobals', 'GetActorByUID', 'getHeroes', 'selectContinuousEnemyTarget', `${body}; return pickEnemyTargetHero;`)(
    ctx => ctx.state.globals,
    (ctx, uid) => ctx.state.entities.find(actor => actor.uid === uid) || null,
    ctx => ctx.state.entities.filter(actor => actor.kind === 'hero' && actor.hp > 0),
    selectContinuousEnemyTarget,
  );
}

function loadStartRealtimeEnemyAction(pickTarget = null) {
  const start = functionBank.indexOf('export function StartRealtimeEnemyAction(ctx, enemyUID) {');
  const end = functionBank.indexOf('\nexport function StartEnemyAction(', start);
  const body = functionBank.slice(start, end).replace('export function', 'function');
  return new Function('getGlobals', 'GetActorByUID', 'pickEnemyTargetHero', 'realtimeCooldownSeconds', 'createEnemyActionState', 'LUNGE_ANTICIPATION_SEC', 'LUNGE_FORWARD_SEC', `${body}; return StartRealtimeEnemyAction;`)(
    ctx => ctx.state.globals,
    (ctx, uid) => ctx.state.entities.find(actor => actor.uid === uid) || null,
    pickTarget || (() => ({ uid: 1, kind: 'hero', hp: 10 })),
    realtimeCooldownSeconds,
    (ctx, uid, target, options) => {
      const action = { uid, targetUID: target.uid, options, active: true, state: 'ADVANCE', timer: 0, actionApplied: false, cooldownSeconds: options.cooldownSeconds, startedAt: Number(ctx.state.globals.time || 0), nextReadyAt: Number(ctx.state.globals.time || 0) + options.cooldownSeconds };
      ctx.state.globals.RealtimeEnemyActionsByUID ||= {};
      ctx.state.globals.RealtimeEnemyActionsByUID[String(uid)] = action;
      ctx.state.globals.RealtimeEnemyActionReadyAt ||= {};
      ctx.state.globals.RealtimeEnemyActionReadyAt[String(uid)] = action.nextReadyAt;
      return action;
    }, 0.14, 0.75,
  );
}

function actionFixture() {
  const heroes = [
    { uid: 1, kind: 'hero', hp: 10, maxHP: 10, footX: 160, footY: 100 },
    { uid: 2, kind: 'hero', hp: 10, maxHP: 10, footX: 150, footY: 110 },
  ];
  const enemies = [
    { uid: 20, kind: 'enemy', hp: 30, x: 210, footX: 210, footY: 100, originX: 210, originY: 100, streamState: 'engaged', arenaInReach: true, streamEngageX: 210, cooldownSeconds: 1.6 },
    { uid: 21, kind: 'enemy', hp: 30, x: 250, footX: 250, footY: 140, originX: 250, originY: 140, streamState: 'engaged', arenaInReach: true, streamEngageX: 250, cooldownSeconds: 5 },
  ];
  const state = { globals: { ContinuousCombatStageLoop: 1, GamePhase: 'RUNTIME', time: 1, RealtimeEnemyActionReadyAt: {}, RealtimeEnemyActionsByUID: {} }, entities: [...heroes, ...enemies] };
  const ctx = { state };
  return { state, ctx, heroes, enemies, tick: loadTickRealtimeEnemyActions() };
}

test('two engaged enemies start independently and later wave entrants retain their own clock', () => {
  const { state, ctx, enemies, tick } = actionFixture();
  assert.equal(tick(ctx), 2);
  assert.deepEqual(Object.keys(state.globals.RealtimeEnemyActionsByUID), ['20', '21']);

  const later = { uid: 22, kind: 'enemy', hp: 30, x: 280, originX: 280, originY: 180, streamState: 'engaged', streamEngageX: 280 };
  state.entities.push(later);
  assert.equal(tick(ctx), 1);
  assert.equal(state.globals.RealtimeEnemyActionsByUID['22'].active, true);
  assert.equal(state.globals.RealtimeEnemyActionsByUID['20'].active, true);
  assert.equal(state.globals.RealtimeEnemyActionsByUID['21'].active, true);
  assert.equal(enemies.length, 2);
});

test('all nearby melee and ranged actors across sectors schedule independent attacks in one tick', () => {
  const heroes = Array.from({ length: 4 }, (_, index) => ({
    uid: index + 1, kind: 'hero', hp: 100, maxHP: 100, attackType: index > 1 ? 'magic' : 'melee',
    footX: 1080 + (index % 2 ? 18 : -18), footY: 319.5 + (index < 2 ? -14 : 14),
  }));
  const enemies = Array.from({ length: 15 }, (_, index) => {
    const ranged = index % 3 !== 0;
    const radius = ranged ? 118 : 48;
    const angle = (Math.PI * 2 * index) / 15;
    return {
      uid: 100 + index, kind: 'enemy', hp: 80, streamState: 'roaming', arenaInReach: false,
      streamDelivery: ranged ? 'ranged' : 'melee', streamSectorIndex: Math.floor(index / 3),
      footX: 1080 + Math.cos(angle) * radius, footY: 319.5 + Math.sin(angle) * radius,
      cooldownSeconds: ranged ? 5 : 1.6,
    };
  });
  const beyondReach = { uid: 200, kind: 'enemy', hp: 80, streamState: 'roaming', arenaInReach: false, streamDelivery: 'melee', streamSectorIndex: 5, footX: 1330, footY: 319.5 };
  const globals = { ContinuousCombatStageLoop: 1, GamePhase: 'RUNTIME', time: 1, RealtimeEnemyActionReadyAt: {}, RealtimeEnemyActionsByUID: {} };
  const entities = [...heroes, ...enemies, beyondReach];
  advanceContinuousCombatArena({ globals, entities, seconds: 0 });
  const state = { globals, entities };
  const ctx = { state };
  const pickTarget = loadPickEnemyTargetHero();
  const startAction = loadStartRealtimeEnemyAction(pickTarget);
  const tick = loadTickRealtimeEnemyActions(pickTarget, (actionCtx, uid) => startAction(actionCtx, uid));
  assert.equal(tick(ctx), 15);
  const actions = Object.values(globals.RealtimeEnemyActionsByUID);
  assert.equal(actions.length, 15);
  assert.equal(new Set(actions.map(action => action.targetUID)).size, 4, 'actor-relative target selection distributes attacks across living heroes');
  assert.equal(globals.RealtimeEnemyActionsByUID[String(beyondReach.uid)], undefined, 'the out-of-reach actor remains unscheduled');
  for (const enemy of enemies) {
    const action = globals.RealtimeEnemyActionsByUID[String(enemy.uid)];
    assert.ok(action, `enemy ${enemy.uid} starts its own action clock`);
    assert.ok(isActorTargetInRange(enemy, entities.find(actor => actor.uid === action.targetUID)), `enemy ${enemy.uid} targets an in-reach hero`);
    assert.equal(action.cooldownSeconds, enemy.cooldownSeconds);
    assert.equal(action.targetUID, pickTarget(ctx, enemy.uid).uid);
  }
  assert.ok(enemies.some(enemy => enemy.streamDelivery === 'melee') && enemies.some(enemy => enemy.streamDelivery === 'ranged'));
  const calls = [];
  const resolve = loadResolveEnemyActionTarget();
  const advanceActionFrame = dt => advanceEnemyActionSimulation({
    state, gameState: { healBlooms: [] }, dt, layoutW: 400,
    animationMath: { LUNGE_ANTICIPATION_SEC: 0.1, LUNGE_FORWARD_SEC: 0.2, LUNGE_HOLD_SEC: 0.1, LUNGE_RETREAT_SEC: 0.2, LUNGE_FORWARD_DIST_PX: 30, easeLungeForward: t => t },
    fnContext: {}, callFunctionWithContext: (_ctx, name, ...args) => {
      if (name === 'ResolveEnemyActionTarget') return resolve(ctx, args[0], args[1]);
      if (name === 'ApplyEnemySkill') {
        calls.push([args[0], args[2]]);
        const target = heroes.find(hero => hero.uid === args[2]);
        if (target) target.hp -= 1;
      }
      return null;
    },
    applyTurnGateGlobals() {}, applyTurnGateIntent() {}, createEnemyTurnIdleRecovery() {},
    combatVfxProfileForActor: enemy => ({ delivery: enemy.streamDelivery, impact: enemy.streamDelivery === 'ranged' ? 'magic' : 'physical' }),
    queueCombatAttackImpactVfx() {},
  });
  advanceActionFrame(0.2);
  state.globals.time = 1.2;
  advanceActionFrame(0.2);
  assert.equal(calls.length, enemies.length, 'all independently scheduled melee and ranged actions reach impact on the shared simulation step');
  assert.ok(enemies.every(enemy => calls.some(([uid]) => uid === enemy.uid)));
});

test('impact target resolution preserves a live story target and picks the first living continuous target', () => {
  const resolveTarget = loadResolveEnemyActionTarget();
  const { state, ctx } = actionFixture();
  state.globals.ContinuousCombatStageLoop = 1;
  assert.equal(resolveTarget(ctx, 20, 1).uid, 1);
  state.entities.find(actor => actor.uid === 1).hp = 0;
  assert.equal(resolveTarget(ctx, 20, 1).uid, 2);
  state.globals.ContinuousCombatStageLoop = 0;
  assert.equal(resolveTarget(ctx, 20, 2).uid, 2, 'story actions retain their captured living target');
  state.entities.find(actor => actor.uid === 2).hp = 0;
  assert.equal(resolveTarget(ctx, 20, 2), null);
});

test('continuous picker and impact resolver use only heroes inside this enemy delivery reach', () => {
  const pick = loadPickEnemyTargetHero();
  const resolve = loadResolveEnemyActionTarget();
  const farHero = { uid: 1, kind: 'hero', hp: 10, footX: 106, footY: 340 };
  const contactHero = { uid: 2, kind: 'hero', hp: 10, footX: 180, footY: 200 };
  const enemy = { uid: 20, kind: 'enemy', hp: 30, footX: 230, footY: 200, streamState: 'engaged', arenaInReach: true, streamDelivery: 'melee' };
  const ctx = { state: { globals: { ContinuousCombatStageLoop: 1, time: 1 }, entities: [farHero, contactHero, enemy] } };
  assert.equal(pick(ctx, 20).uid, 2);
  assert.equal(resolve(ctx, 20, 1).uid, 2, 'a displaced melee target cannot be struck through the nearer hero');
});

test('a displaced living enemy retains its cooldown deadline until it re-enters contact', () => {
  const { state, ctx, heroes, enemies, tick } = actionFixture();
  const enemy = enemies[0];
  state.entities = [...heroes, enemy];
  enemy.streamState = 'in_range';
  state.globals.RealtimeEnemyActionReadyAt = { [enemy.uid]: 5 };
  state.globals.time = 1;
  assert.equal(tick(ctx), 0);
  assert.equal(state.globals.RealtimeEnemyActionReadyAt[enemy.uid], 5);
  enemy.streamState = 'engaged';
  state.globals.time = 2;
  assert.equal(tick(ctx), 0);
  assert.equal(state.globals.RealtimeEnemyActionReadyAt[enemy.uid], 5);
  state.globals.time = 5;
  assert.equal(tick(ctx), 1);
  assert.equal(state.globals.RealtimeEnemyActionsByUID[enemy.uid].startedAt, 5);
});

test('spawned melee, ranged, and boss actors keep their authored realtime intervals', () => {
  const globals = { time: 0, EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 }, EnemySize: 40 };
  const melee = activateContinuousCombatSpawnedEnemy(globals, { uid: 30, kind: 'enemy', name: 'Gobloc', enemyRole: 'fodder', hp: 10 }, { entryOrder: 0 });
  const ranged = activateContinuousCombatSpawnedEnemy(globals, { uid: 31, kind: 'enemy', name: 'Djinn', enemyRole: 'fodder', hp: 10 }, { entryOrder: 1 });
  const boss = activateContinuousCombatSpawnedEnemy(globals, { uid: 32, kind: 'enemy', name: 'Troll', enemyRole: 'boss', hp: 10, attackPattern: { intervalSeconds: 2.25 } }, { entryOrder: 2 });
  const interval = enemy => realtimeCooldownSeconds({ ...enemy, type: 1, attackDelivery: enemy.streamDelivery, attackPattern: enemy.attackPattern });
  assert.equal(interval(melee), 1.6);
  assert.equal(interval(ranged), 5);
  assert.equal(interval(boss), 2.25);
  assert.match(functionBank, /type: 1,[\s\S]*attackDelivery: enemy\.streamDelivery \|\| enemy\.attackDelivery,[\s\S]*attackPattern: enemy\.attackPattern/);
  assert.match(functionBank, /attackPattern: enemyData\.attackPattern && typeof enemyData\.attackPattern === 'object'/);
  const start = loadStartRealtimeEnemyAction();
  for (const enemy of [melee, ranged, boss]) {
    const result = start({ state: { globals: { time: 0 }, entities: [enemy] } }, enemy.uid);
    assert.equal(result.options.cooldownSeconds, interval(enemy));
    assert.equal(result.options.continuousCombat, true);
    assert.equal(enemy.actionImpactAt, 0.89);
    assert.equal(enemy.actionStateUntil, 1.09);
  }
});

test('animation hold does not shift an enemy cooldown beyond its start-to-start deadline', () => {
  const { state, ctx, tick } = actionFixture();
  state.entities = [state.entities[0], state.entities[2]];
  assert.equal(tick(ctx), 1);
  const action = state.globals.RealtimeEnemyActionsByUID['20'];
  assert.equal(action.nextReadyAt, 2.6);
  action.state = 'RETREAT';
  action.timer = 0.19;
  state.globals.time = 1.5;
  advanceEnemyActionSimulation({
    state, gameState: { healBlooms: [] }, dt: 0.02, layoutW: 400,
    animationMath: { LUNGE_ANTICIPATION_SEC: 0.1, LUNGE_FORWARD_SEC: 0.2, LUNGE_HOLD_SEC: 0.1, LUNGE_RETREAT_SEC: 0.2, LUNGE_FORWARD_DIST_PX: 30, easeLungeForward: t => t },
    fnContext: {}, callFunctionWithContext: (_ctx, name, ...args) => name === 'ResolveEnemyActionTarget' ? state.entities[0] : null,
    applyTurnGateGlobals() {}, applyTurnGateIntent() {}, createEnemyTurnIdleRecovery() {},
    combatVfxProfileForActor: () => ({ delivery: 'melee', impact: 'physical' }), queueCombatAttackImpactVfx() {},
  });
  assert.equal(state.globals.RealtimeEnemyActionsByUID['20'], undefined);
  assert.equal(state.globals.RealtimeEnemyActionReadyAt['20'], 2.6);
  state.globals.time = 2.6;
  assert.equal(tick(ctx), 1);
  assert.equal(state.globals.RealtimeEnemyActionsByUID['20'].startedAt, 2.6);
});

test('the first ordinary hero KO interrupts later enemy impacts in the same scheduler batch', () => {
  const { state, heroes, enemies } = actionFixture();
  const calls = [];
  state.globals.RealtimeEnemyActionsByUID = Object.fromEntries(enemies.map(enemy => [String(enemy.uid), {
    uid: enemy.uid, active: true, state: 'LUNGE', timer: 0, actionApplied: false,
    targetUID: 1, skillId: 'Enemy_ATK_Single', stationary: true,
    forwardX: enemy.originX, cooldownSeconds: 1.6,
  }]));
  const callFunctionWithContext = (_ctx, name, ...args) => {
    if (name === 'ResolveEnemyActionTarget') {
      const preferred = state.entities.find(actor => actor.kind === 'hero' && actor.uid === args[1] && actor.hp > 0);
      return preferred || state.entities.find(actor => actor.kind === 'hero' && actor.hp > 0) || null;
    }
    if (name === 'ApplyEnemySkill') {
      calls.push([args[0], args[2]]);
      const target = heroes.find(hero => hero.uid === args[2]);
      if (target) target.hp = args[0] === 20 ? 0 : target.hp - 1;
    }
    return null;
  };
  advanceEnemyActionSimulation({
    state, gameState: { healBlooms: [] }, dt: 0.2, layoutW: 400,
    animationMath: { LUNGE_ANTICIPATION_SEC: 0.1, LUNGE_FORWARD_SEC: 0.2, LUNGE_HOLD_SEC: 0.1, LUNGE_RETREAT_SEC: 0.1, LUNGE_FORWARD_DIST_PX: 30, easeLungeForward: t => t },
    fnContext: {}, callFunctionWithContext, applyTurnGateGlobals() {}, applyTurnGateIntent() {}, createEnemyTurnIdleRecovery() {},
    combatVfxProfileForActor: () => ({ delivery: 'melee', impact: 'physical' }), queueCombatAttackImpactVfx() {},
  });
  assert.deepEqual(calls, [[20, 1]]);
  assert.equal(state.globals.RealtimeEnemyActionsByUID['20'].actionApplied, true);
  assert.equal(state.globals.RealtimeEnemyActionsByUID['21'].actionApplied, false, 'later actors hold their impacts until the recovery path completes');
});

test('continuous enemy cue reaches its marker when the state machine applies HP damage without restoring arena feet', () => {
  const hero = { uid: 1, kind: 'hero', hp: 10, maxHP: 10, footX: 106, footY: 320 };
  const enemy = { uid: 20, kind: 'enemy', hp: 30, footX: 190, footY: 250, x: 190, y: 250, originX: 290, originY: 80, actionState: 'basic', actionStateStartedAt: 1, actionImpactAt: 1.89, actionStateUntil: 2.09 };
  const state = { globals: { time: 1, ContinuousCombatStageLoop: 1, RealtimeEnemyActionsByUID: { 20: { uid: 20, active: true, state: 'ADVANCE', timer: 0, actionApplied: false, targetUID: 1, skillId: 'Enemy_ATK_Single', startedAt: 1, nextReadyAt: 2.6, cooldownSeconds: 1.6 } }, RealtimeEnemyActionReadyAt: { 20: 2.6 } }, entities: [hero, enemy] };
  const advance = (dt, now) => {
    state.globals.time = now;
    advanceEnemyActionSimulation({
      state, gameState: { healBlooms: [] }, dt, layoutW: 400,
      animationMath: { LUNGE_ANTICIPATION_SEC: 0.14, LUNGE_FORWARD_SEC: 0.75, LUNGE_HOLD_SEC: 0.1, LUNGE_RETREAT_SEC: 0.1, LUNGE_FORWARD_DIST_PX: 30, easeLungeForward: t => t },
      fnContext: {}, callFunctionWithContext: (_ctx, name, ...args) => {
        if (name === 'ResolveEnemyActionTarget') return hero;
        if (name === 'ApplyEnemySkill') { hero.hp -= 1; return 1; }
        return null;
      },
      applyTurnGateGlobals() {}, applyTurnGateIntent() {}, createEnemyTurnIdleRecovery() {}, combatVfxProfileForActor: () => ({ delivery: 'melee', impact: 'physical' }), queueCombatAttackImpactVfx() {},
    });
  };
  advance(0.14, 1.14);
  assert.equal(hero.hp, 10);
  advance(0.75, 1.89);
  assert.equal(hero.hp, 9);
  assert.equal(enemy.actionImpactAt, 1.89);
  assert.deepEqual([enemy.x, enemy.y, enemy.footX, enemy.footY], [190, 250, 190, 250]);
});

test('a missing impact target consumes no attack cooldown and remains ready', () => {
  const { state, enemies } = actionFixture();
  state.entities = enemies;
  state.globals.RealtimeEnemyActionReadyAt = { 20: Number.MAX_SAFE_INTEGER };
  state.globals.RealtimeEnemyActionsByUID = { 20: {
    uid: 20, active: true, state: 'LUNGE', timer: 0, actionApplied: false,
    targetUID: 1, skillId: 'Enemy_ATK_Single', stationary: true, forwardX: 210, cooldownSeconds: 1.6,
  } };
  let applied = 0;
  const callFunctionWithContext = (_ctx, name) => {
    if (name === 'ResolveEnemyActionTarget') return null;
    if (name === 'ApplyEnemySkill') applied += 1;
    return null;
  };
  const advance = dt => advanceEnemyActionSimulation({
    state, gameState: { healBlooms: [] }, dt, layoutW: 400,
    animationMath: { LUNGE_ANTICIPATION_SEC: 0.1, LUNGE_FORWARD_SEC: 0.2, LUNGE_HOLD_SEC: 0.1, LUNGE_RETREAT_SEC: 0.1, LUNGE_FORWARD_DIST_PX: 30, easeLungeForward: t => t },
    fnContext: {}, callFunctionWithContext, applyTurnGateGlobals() {}, applyTurnGateIntent() {}, createEnemyTurnIdleRecovery() {},
    combatVfxProfileForActor: () => ({ delivery: 'melee', impact: 'physical' }), queueCombatAttackImpactVfx() {},
  });
  advance(0.2);
  assert.equal(applied, 0);
  assert.equal(state.globals.RealtimeEnemyActionsByUID['20'].noTargetAtImpact, true);
  state.globals.time += 0.2;
  advance(0.1);
  state.globals.time += 0.1;
  advance(0.1);
  assert.equal(state.globals.RealtimeEnemyActionsByUID['20'], undefined);
  assert.equal(state.globals.RealtimeEnemyActionReadyAt['20'], state.globals.time);
});


test('boss action acquisition and captured impact retarget to rear supports after tank KO', () => {
  const pick = loadPickEnemyTargetHero();
  const resolve = loadResolveEnemyActionTarget();
  const heroes = [
    { uid: 1, name: 'Fara', kind: 'hero', hp: 0, footX: 180, footY: 290 },
    { uid: 2, name: 'Hondo', kind: 'hero', hp: 0, footX: 180, footY: 320 },
    { uid: 3, name: 'Runa', kind: 'hero', hp: 60, footX: 70, footY: 280 },
    { uid: 4, name: 'Kaja', kind: 'hero', hp: 65, footX: 70, footY: 340 },
  ];
  const enemy = { uid: 20, kind: 'enemy', hp: 100, footX: 300, footY: 290, combatRank: 'boss', enemyRole: 'boss', streamDelivery: 'melee', streamState: 'engaged', arenaInReach: true };
  const ctx = { state: { globals: { ContinuousCombatStageLoop: 1, time: 1 }, entities: [...heroes, enemy] } };
  assert.equal(pick(ctx, 20).uid, 3);
  assert.equal(resolve(ctx, 20, 3).uid, 3);
  heroes[2].hp = 0;
  assert.equal(pick(ctx, 20).uid, 4);
  assert.equal(resolve(ctx, 20, 3).uid, 4);
});
