import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { advanceEnemyActionSimulation, createCombatSimulationTicker } from '../web-runner/systems/combatSimulationTick.mjs';
import { createEnemyActivationFade, paintWithActivationAlpha } from '../web-runner/systems/enemyActivationFadePresentation.mjs';

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


test('combat actors never draw static artwork when a puppet is unavailable', () => {
  const body = effectiveRendererBody();
  assert.doesNotMatch(body, /drawCombatActorSprite\(/);
  for (const kind of ['Hero', 'Enemy']) {
    const declaration = body.match(new RegExp(`const draw${kind}Sprite = \\(\\) =>[^;]+;`))?.[0];
    assert.ok(declaration, `${kind} puppet draw is present`);
    let draws = 0;
    const invoke = new Function('puppet', 'drawActorPuppetFrame', 'ctx', 'pos', 'footY', 'scaledH', 'enemyH', 'hero', 'enemy', 'g', `${declaration}; return draw${kind}Sprite();`);
    const args = [() => { draws++; }, {}, { x: 10, y: 20 }, 20, 56, 40, { uid: 1 }, { uid: 2 }, { time: 0 }];
    invoke(null, ...args);
    assert.equal(draws, 0, 'missing puppet cannot select static art');
    invoke({ frame: {} }, ...args);
    assert.equal(draws, 1, 'ready puppet uses the same draw path');
  }
});

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

test('assembled renderer paints each actor with its health bar in the shared foot-depth queue', () => {
  const body = effectiveRendererBody();
  assert.match(body, /const actorPaintQueue = \[\];[\s\S]*const actorFrontOverlayQueue = \[\];/);
  assert.match(body, /const enemyFootY = Number\(pos\.y\)/);
  assert.match(body, /actorPaintQueue\.push\(\{ footY: enemyFootY, uid: Number\(enemy\.uid/);
  assert.match(body, /const paintEnemyActor = \(\) => \{\s*ctx\.save\(\);\s*ctx\.globalAlpha \*= enemyFadeAlpha;[\s\S]*?ctx\.restore\(\);\s*\};/);
  assert.match(body, /actorPaintQueue\.push\(\{ footY: Number\(footY\), uid: Number\(hero\?\.uid/);
  assert.match(body, /addActorPaint\(enemy\.uid, \(\) => \{ ctx\.save\(\); ctx\.globalAlpha \*= enemyFadeAlpha; drawCombatHealthBar/);
  assert.match(body, /const paintHeroActor = \(\) => paintWithActivationAlpha\(ctx, heroSpriteFadeAlpha/);
  assert.match(body, /addActorPaint\(uid, \(\) => paintWithActivationAlpha\(ctx, heroBarFadeAlpha/);
  assert.doesNotMatch(body, /actorFrontOverlayQueue\.push\(\(\) => drawCombatHealthBar/);
  const paintAt = body.indexOf('actorPaintQueue.sort(');
  const heroHealthAt = body.indexOf('// Hero health lives with the battlefield actor');
  assert.ok(heroHealthAt >= 0 && paintAt > heroHealthAt, 'health bar callbacks attach before the shared ascending foot-Y actor pass');
});

test('hero recovery fade multiplies both queued sprite and HP-bar opacity', () => {
  const fadeAlpha = createEnemyActivationFade();
  const hero = { uid: 2, kind: 'hero', recoveryFadeStartedAt: 8 };
  const ctx = { globalAlpha: 0.6, stack: [], save() { this.stack.push(this.globalAlpha); }, restore() { this.globalAlpha = this.stack.pop(); } };
  const observed = [];
  const alpha = fadeAlpha(hero, 8.175);
  const body = () => observed.push(ctx.globalAlpha);
  paintWithActivationAlpha(ctx, alpha, body);
  paintWithActivationAlpha(ctx, alpha, body);
  assert.ok(observed.every(alpha => Math.abs(alpha - 0.3) < 1e-10));
  assert.equal(ctx.globalAlpha, 0.6, 'both actor and bar painters restore the parent canvas alpha');
  assert.match(effectiveRendererBody(), /paintWithActivationAlpha\(ctx, heroSpriteFadeAlpha/);
  assert.match(effectiveRendererBody(), /paintWithActivationAlpha\(ctx, heroBarFadeAlpha/);
});

test('assembled enemy queue anchors puppet and loading bars to the same feet', () => {
  const body = effectiveRendererBody();
  const get = (pattern, label) => {
    const match = body.match(pattern);
    assert.ok(match, `assembled renderer retains ${label}`);
    return match[0];
  };
  const enemyFoot = get(/const enemyFootY = Number\(pos\.y\);/, 'enemy foot selection');
  const enemyFade = get(/const enemyFadeAlpha = getEnemyActivationFadeAlpha\(enemy, Number\(g\.time \|\| 0\)\);/, 'activation fade capture');
  const actorPush = get(/actorPaintQueue\.push\(\{ footY: enemyFootY, uid: Number\(enemy\.uid \|\| 0\), paint: paintEnemyActor \}\);/, 'actor queue insertion');
  const barPush = get(/barQueue\.push\(\{ enemy, pos, enemyH, origH, enemyW, enemyFootY, enemyFadeAlpha \}\);/, 'bar queue insertion');
  const barRead = get(/const \{ enemy, pos, enemyH, origH, enemyW, enemyFootY, enemyFadeAlpha \} = entry;/, 'bar queue read');
  const barDrawY = get(/const barY = Math\.round\(enemyFootY \+ \(4 \* layoutScale\)\);/, 'bar foot offset');
  assert.match(body, /ctx\.globalAlpha \*= enemyFadeAlpha;[\s\S]*ctx\.restore\(\);/);
  assert.match(body, /addActorPaint\(enemy\.uid, \(\) => \{ ctx\.save\(\); ctx\.globalAlpha \*= enemyFadeAlpha; drawCombatHealthBar/);
  const run = new Function('puppet', 'posY', 'drawY', 'height', 'getEnemyActivationFadeAlpha', `
    const actorPaintQueue = [];
    const barQueue = [];
    const paintEnemyActor = () => {};
    const enemy = { uid: 7 };
    const pos = { y: posY };
    const enemyH = height;
    const origH = height;
    const enemyW = height;
    const g = { time: 5 };
    ${enemyFade}
    const layoutScale = 1;
    ${enemyFoot}
    ${actorPush}
    ${barPush}
    const result = [];
    for (const entry of barQueue) {
      ${barRead}
      ${barDrawY}
      result.push({ actorFootY: actorPaintQueue[0].footY, barY, enemyFadeAlpha });
    }
    return result[0];
  `);
  assert.deepEqual(run({ frame: {} }, 100, 40, 60, () => 0.5), { actorFootY: 100, barY: 104, enemyFadeAlpha: 0.5 });
  assert.deepEqual(run(null, 100, 70, 60, () => 0.5), { actorFootY: 100, barY: 104, enemyFadeAlpha: 0.5 });
  assert.deepEqual(run(null, 100, 40, 60, () => 0.5), { actorFootY: 100, barY: 104, enemyFadeAlpha: 0.5 });
});

test('enemy activation fade follows active combat time and resets only for a new activation', () => {
  const fadeAlpha = createEnemyActivationFade();
  const enemy = { uid: 9, streamStartAt: 12 };
  assert.equal(fadeAlpha(enemy, 12), 0);
  assert.ok(Math.abs(fadeAlpha(enemy, 12.0875) - 0.15625) < 1e-12);
  assert.ok(Math.abs(fadeAlpha(enemy, 12.175) - 0.5) < 1e-12);
  assert.ok(Math.abs(fadeAlpha(enemy, 12.175) - 0.5) < 1e-12, 'paused active time holds the same opacity');
  assert.equal(fadeAlpha(enemy, 12.35), 1);
  assert.equal(fadeAlpha(enemy, 12.5), 1, 'camera entry or later art readiness does not restart the actor fade');
  enemy.streamStartAt = 20;
  assert.equal(fadeAlpha(enemy, 20), 0, 'a true continuous activation timestamp starts a fresh fade');
  assert.equal(fadeAlpha(enemy, 20.35), 1);

  const regularSpawn = {};
  assert.equal(fadeAlpha(regularSpawn, 30), 0, 'regular SpawnEnemy actors use their first render time');
  assert.equal(fadeAlpha(regularSpawn, 30.35), 1);
});

test('assembled enemy puppet and nested overlays respect activation alpha', () => {
  const body = effectiveRendererBody();
  const paintStart = body.indexOf('const puppet = actorPuppetPresentation?.frameFor(enemy');
  const paintEnd = body.indexOf('\n\n        // Queue enemy HP bars', paintStart);
  assert.ok(paintStart >= 0 && paintEnd > paintStart, 'assembled actor paint closure is present');
  const paintChunk = body.slice(paintStart, paintEnd);
  assert.match(body, /ctx\.globalAlpha \*= tone === 'purple'/);
  assert.match(body, /ctx\.globalAlpha \*= Math\.max\(0, Math\.min\(0\.9, alpha\)\)/);
  const paint = new Function('scope', `with (scope) { ${paintChunk}; return actorPaintQueue[0].paint; }`);

  const run = (sprite, enemyFadeAlpha) => {
    let alpha = 0.8;
    const alphaStack = [];
    const samples = [];
    const ctx = {
      save() { alphaStack.push(alpha); },
      restore() { alpha = alphaStack.pop(); },
      get globalAlpha() { return alpha; },
      set globalAlpha(value) { alpha = value; },
      fillRect() { samples.push(alpha); },
      strokeRect() { samples.push(alpha); },
    };
    const scope = {
      ctx, enemyFadeAlpha, sprite, g: { time: 5 }, enemy: { uid: 9, hp: 10 },
      pos: { x: 100, y: 80 }, drawX: 80, drawY: 50, enemyW: 40, enemyH: 60,
      activeCombatOrientation: 'left-wise', actorPaintQueue: [],
      getEnemyActivationFadeAlpha: () => enemyFadeAlpha,
      actorPuppetPresentation: { frameFor: () => ({ frame: {}, clip: {} }) },
      drawActorPuppetFrame: () => samples.push(alpha),
      drawCombatActorSprite: () => samples.push(alpha),
      hasPersistentEnemyBlightOverlay: () => true,
      enemyStandsInRenderedTaintedGround: () => false,
      renderHitFlashOverlay(draw) { ctx.save(); ctx.globalAlpha *= 0.5; draw(); ctx.restore(); },
      renderEnemyBlightShimmer() { ctx.save(); ctx.globalAlpha *= 0.25; ctx.fillRect(); ctx.restore(); },
      isHitFlashActive: () => false,
    };
    paint(scope)();
    return samples;
  };

  for (const fade of [0, 0.5, 1]) {
    const multiplier = 0.8 * fade;
    assert.deepEqual(run(null, fade), [multiplier, multiplier * 0.5, multiplier * 0.25]);
    assert.deepEqual(run({}, fade), [multiplier, multiplier * 0.5, multiplier * 0.25]);
  }
});
