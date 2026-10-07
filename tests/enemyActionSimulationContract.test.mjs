import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { advanceEnemyActionSimulation, createCombatSimulationTicker } from '../web-runner/systems/combatSimulationTick.mjs';

const rendererSource = fs.readFileSync(new URL('../web-runner/systems/renderRuntime.js', import.meta.url), 'utf8');

function effectiveRendererBody(source = rendererSource) {
  const start = source.indexOf('const body = ') + 'const body = '.length;
  const end = source.indexOf(';\n    const effectiveBody = assembleCombatRenderBody(body);', start);
  const rawBody = vm.runInNewContext(source.slice(start, end));
  const helperStart = source.indexOf('export function assembleCombatRenderBody(body) {');
  const helperEnd = source.indexOf('\n}\n\nlet renderImpl', helperStart) + 2;
  const helper = source.slice(helperStart, helperEnd).replace('export function', 'function');
  return new Function(`${helper}; return assembleCombatRenderBody;`)()(rawBody);
}

function fixture(action = {}, globalOverrides = {}) {
  const enemy = { uid: 9, kind: 'enemy', hp: 50, maxHP: 50, x: 200, y: 180, originX: 200, originY: 180, attackType: 'melee' };
  const hero = { uid: 1, kind: 'hero', hp: 100, maxHP: 100, x: 100, y: 180, heroIndex: 0 };
  const globals = {
    time: 5,
    ContinuousCombatStageLoop: 0,
    ...globalOverrides,
    EnemyAction: { active: true, uid: 9, targetUID: 1, skillId: 'Enemy_ATK_Single', state: 'LUNGE', timer: 0, actionApplied: false, ...action },
    HeroIconPosByIndex: [{ x: 100, y: 180 }],
  };
  const state = { globals, entities: [enemy, hero] };
  const calls = [];
  const impacts = [];
  const scope = {
    state,
    gameState: { healBlooms: [] },
    fnContext: {},
    dt: 0.2,
    layoutW: 360,
    animationMath: {
      LUNGE_ANTICIPATION_SEC: 0.1,
      LUNGE_FORWARD_SEC: 0.2,
      LUNGE_HOLD_SEC: 0.1,
      LUNGE_RETREAT_SEC: 0.2,
      LUNGE_FORWARD_DIST_PX: 60,
      easeLungeForward: (t) => t,
    },
    combatVfxProfileForActor: (actor) => ({ delivery: actor.attackType === 'magic' ? 'ranged' : 'melee', impact: 'blue' }),
    queueCombatAttackImpactVfx: (...args) => impacts.push(args),
    impacts,
    applyTurnGateGlobals: (patch) => Object.assign(globals, patch),
    applyTurnGateIntent: (create, options) => Object.assign(globals, create(globals, options)),
    createEnemyTurnIdleRecovery: (_globals, options) => ({ LastEnemyTurnIdleRecovery: options }),
    callFunctionWithContext: (_ctx, name, ...args) => {
      calls.push([name, ...args]);
      if (name === 'GetCurrentTurn') return 9;
      if (name === 'ApplyEnemySkill') {
        hero.hp = Math.max(0, hero.hp - 20);
        return true;
      }
      return true;
    },
  };
  return { state, enemy, hero, calls, impacts, scope };
}

function runCurrentBlock(scope) {
  advanceEnemyActionSimulation({
    ...scope,
    queueCombatAttackImpactVfx: (...args) => scope.impacts.push(args),
  });
}

test('lunge impact applies damage once and queues the matching hero impact', () => {
  const { state, hero, calls, impacts, scope } = fixture();
  runCurrentBlock(scope);
  assert.equal(hero.hp, 80);
  assert.equal(state.globals.EnemyAction.state, 'HIT');
  assert.equal(state.globals.EnemyAction.actionApplied, true);
  assert.equal(calls.filter(([name]) => name === 'ApplyEnemySkill').length, 1);
  assert.equal(impacts.length, 1);
  assert.equal(impacts[0][1].impactVfxKind, 'blue');
  assert.equal(impacts[0][2].uid, 1);
  assert.equal(impacts[0][3], 5);
});

test('ranged action stays at its origin and waits for its impact presentation before retreat', () => {
  const { state, enemy, hero, calls, scope } = fixture(
    { skillId: 'Enemy_MAG_AOE', stationary: true, state: 'HIT', timer: 0.1, actionApplied: true },
    { ContinuousCombatStageLoop: 0, ActionLockUntil: 5.5 },
  );
  enemy.attackType = 'magic';
  state.globals.CombatImpactVisuals = [{ ownerUID: 9 }];
  scope.dt = 0.1;
  runCurrentBlock(scope);
  assert.equal(enemy.x, enemy.originX);
  assert.equal(state.globals.EnemyAction.state, 'HIT');
  assert.equal(hero.hp, 100);
  assert.equal(calls.filter(([name]) => name === 'ApplyEnemySkill').length, 0);
  state.globals.CombatImpactVisuals = [];
  state.globals.time = 5.6;
  scope.dt = 0.01;
  runCurrentBlock(scope);
  assert.equal(state.globals.EnemyAction.state, 'RETREAT');
});

test('story enemy action transitions through retreat to the legacy deferred turn handoff', () => {
  const { state, enemy, calls, scope } = fixture({ state: 'RETREAT', timer: 0 });
  scope.dt = 0.2;
  runCurrentBlock(scope);
  assert.equal(state.globals.EnemyAction.state, 'DONE');
  assert.equal(state.globals.EnemyAction.active, false);
  assert.equal(enemy.x, enemy.originX);
  assert.equal(enemy.y, enemy.originY);
  assert.equal(calls.filter(([name]) => name === 'AdvanceTurn').length, 0);
  assert.ok(state.globals.LastEnemyTurnIdleRecovery);
});

test('combat simulation tick advances time before resolving the due enemy impact', () => {
  const { state, hero, calls, impacts, scope } = fixture({ timer: 0.19 });
  const ticker = createCombatSimulationTicker();
  ticker.tick({ ...scope, nowMs: 0 });
  const timeBeforeImpact = state.globals.time;
  const dt = ticker.tick({ ...scope, nowMs: 200 });
  assert.ok(dt > 0);
  assert.ok(state.globals.time > timeBeforeImpact);
  assert.equal(hero.hp, 80);
  assert.equal(state.globals.EnemyAction.actionApplied, true);
  assert.equal(calls.filter(([name]) => name === 'ApplyEnemySkill').length, 1);
  assert.equal(impacts.length, 1);
});

test('renderer contains no enemy action advancement or enemy damage application', () => {
  const body = effectiveRendererBody();
  assert.doesNotMatch(body, /EnemyAction|ApplyEnemySkill/);
  assert.doesNotMatch(body, /state\.globals\.time \+= dt/);
  assert.doesNotThrow(() => new Function('scope', 'dtOverride', `with (scope) {\n${body}\n}`));
});
