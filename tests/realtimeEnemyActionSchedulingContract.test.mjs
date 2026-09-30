import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { advanceEnemyActionSimulation } from '../web-runner/systems/combatSimulationTick.mjs';
import { pickEnemyTargetHeroFromRoster } from '../web-runner/src/core/enemyTargetingRules.mjs';
import { activateContinuousCombatSpawnedEnemy } from '../web-runner/src/core/continuousCombatStage.mjs';
import { realtimeCooldownSeconds } from '../web-runner/src/core/realtimeCooldown.mjs';
import { realtimeProvokeTarget } from '../web-runner/src/core/realtimeHeroSkills.mjs';

const functionBank = fs.readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');

function loadTickRealtimeEnemyActions() {
  const start = functionBank.indexOf('export function TickRealtimeEnemyActions(ctx) {');
  const end = functionBank.indexOf('\nfunction HeroAttackSplit(', start);
  const body = functionBank.slice(start, end).replace('export function', 'function');
  return new Function('getGlobals', 'getEntities', 'pickEnemyTargetHero', 'StartRealtimeEnemyAction', `${body}; return TickRealtimeEnemyActions;`)(
    ctx => ctx.state.globals,
    ctx => ctx.state.entities,
    (ctx, uid) => ctx.state.entities.find(actor => actor.kind === 'hero' && actor.hp > 0) || null,
    (ctx, uid) => {
      const enemy = ctx.state.entities.find(actor => actor.uid === uid);
      const now = Number(ctx.state.globals.time || 0);
      const cooldownSeconds = enemy.cooldownSeconds || 1.6;
      ctx.state.globals.RealtimeEnemyActionsByUID[String(uid)] = {
        uid, active: true, state: 'ADVANCE', timer: 0, actionApplied: false,
        targetUID: ctx.state.entities.find(actor => actor.kind === 'hero' && actor.hp > 0)?.uid || 0,
        startedAt: now, cooldownSeconds, nextReadyAt: now + cooldownSeconds,
      };
      ctx.state.globals.RealtimeEnemyActionReadyAt[String(uid)] = now + cooldownSeconds;
    },
  );
}

function loadResolveEnemyActionTarget() {
  const start = functionBank.indexOf('export function ResolveEnemyActionTarget(ctx, enemyUID, preferredTargetUID = 0) {');
  const end = functionBank.indexOf('\nfunction applyRunaMagicResist(', start);
  const body = functionBank.slice(start, end).replace('export function', 'function');
  return new Function('getGlobals', 'GetActorByUID', 'pickEnemyTargetHero', 'realtimeProvokeTarget', `${body}; return ResolveEnemyActionTarget;`)(
    ctx => ctx.state.globals,
    (ctx, uid) => ctx.state.entities.find(actor => actor.uid === uid) || null,
    (ctx, enemyUID) => {
      const enemy = ctx.state.entities.find(actor => actor.kind === 'enemy' && actor.uid === enemyUID);
      const heroes = ctx.state.entities.filter(actor => actor.kind === 'hero' && actor.hp > 0);
      return pickEnemyTargetHeroFromRoster({ enemy, heroes }).target;
    },
    realtimeProvokeTarget,
  );
}

function loadStartRealtimeEnemyAction() {
  const start = functionBank.indexOf('export function StartRealtimeEnemyAction(ctx, enemyUID) {');
  const end = functionBank.indexOf('\nexport function StartEnemyAction(', start);
  const body = functionBank.slice(start, end).replace('export function', 'function');
  return new Function('getGlobals', 'GetActorByUID', 'pickEnemyTargetHero', 'realtimeCooldownSeconds', 'createEnemyActionState', `${body}; return StartRealtimeEnemyAction;`)(
    ctx => ctx.state.globals,
    (ctx, uid) => ctx.state.entities.find(actor => actor.uid === uid) || null,
    () => ({ uid: 1, kind: 'hero', hp: 10 }),
    realtimeCooldownSeconds,
    (_ctx, uid, target, options) => ({ uid, target, options }),
  );
}

function actionFixture() {
  const heroes = [
    { uid: 1, kind: 'hero', hp: 10, maxHP: 10 },
    { uid: 2, kind: 'hero', hp: 10, maxHP: 10 },
  ];
  const enemies = [
    { uid: 20, kind: 'enemy', hp: 30, x: 210, originX: 210, originY: 100, streamState: 'engaged', streamEngageX: 210, cooldownSeconds: 1.6 },
    { uid: 21, kind: 'enemy', hp: 30, x: 250, originX: 250, originY: 140, streamState: 'engaged', streamEngageX: 250, cooldownSeconds: 5 },
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

test('enemy impacts overlap and a later impact retargets after its captured hero is defeated', () => {
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
  assert.deepEqual(calls, [[20, 1], [21, 2]]);
  assert.equal(state.globals.RealtimeEnemyActionsByUID['20'].actionApplied, true);
  assert.equal(state.globals.RealtimeEnemyActionsByUID['21'].actionApplied, true);
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
