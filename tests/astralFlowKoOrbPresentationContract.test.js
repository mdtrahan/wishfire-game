const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const modulePath = path.join(repoRoot, 'web-runner', 'systems', 'astralFlowKoOrbPresentation.js');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function loadPresentationModule() {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original.replace(/\bexport\s+/g, '')}

module.exports = {
  createAstralFlowKoOrbPresentation,
  drawAstralFlowKoOrbPresentation,
  getAstralFlowKoOrbFrame,
  prepareAstralFlowKoOrbPresentation,
  updateAndRenderAstralFlowKoOrbPresentation,
};`;
  const context = {
    Math,
    Number,
    String,
    Array,
    Object,
    module: { exports: {} },
    exports: {},
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function makeCanvasRecorder() {
  const calls = [];
  return {
    calls,
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    beginPath() { calls.push(['beginPath']); },
    arc(x, y, r) { calls.push(['arc', x, y, r]); },
    fill() { calls.push(['fill']); },
    set fillStyle(value) { calls.push(['fillStyle', value]); },
    set globalAlpha(value) { calls.push(['globalAlpha', value]); },
  };
}

test('Astral Flow KO orb presentation waits until dissolve completion before applying reward', async () => {
  const mod = loadPresentationModule();
  const globals = {
    time: 10,
    AstralFlowKoOrbQueue: [
      {
        id: 'ko-a',
        enemyName: 'High Orc',
        source: { x: 220, y: 90 },
        ground: { x: 220, y: 110 },
        color: '#1e7bd6',
        orbScales: [1, 1, 1, 1],
      },
      {
        id: 'ko-b',
        enemyName: 'Troll',
        source: { x: 260, y: 120 },
        ground: { x: 260, y: 140 },
        color: '#1e7bd6',
        orbScales: [1, 1.5, 1],
      },
    ],
    AstralFlowAmpBarCanvas: { x: 40, y: 20, w: 120, h: 8, color: '#1e7bd6' },
  };
  const ctx = makeCanvasRecorder();
  const completed = [];
  const deps = {
    ctx,
    state: { globals },
    worldToCanvas: (x, y) => ({ x, y }),
    callFunctionWithContext: (_fnContext, name) => {
      completed.push(name);
      return { ok: true };
    },
    fnContext: {},
  };

  mod.prepareAstralFlowKoOrbPresentation(deps);
  mod.updateAndRenderAstralFlowKoOrbPresentation(deps);

  assert.deepEqual(completed, ['BeginAstralFlowKoOrbEnemyDeaths']);
  assert.equal(globals.AstralFlowKoOrbPresentationActive, 1);
  assert.equal(globals.AstralFlowKoOrbPresentationState.orbs.length, 7);
  assert.equal(globals.ActionLockUntil, globals.AstralFlowKoOrbPresentationState.endAt);
  assert.ok(globals.ActionLockUntil > 11.14);
  assert.ok(ctx.calls.some(call => call[0] === 'arc' && call[3] > 0));
  assert.ok(ctx.calls.some(call => call[0] === 'fillStyle' && call[1] === '#1e7bd6'));

  globals.time = globals.AstralFlowKoOrbPresentationState.endAt - 0.01;
  mod.updateAndRenderAstralFlowKoOrbPresentation(deps);
  assert.equal(completed.length, 1);

  globals.time = globals.AstralFlowKoOrbPresentationState.endAt + 0.01;
  mod.updateAndRenderAstralFlowKoOrbPresentation(deps);
  assert.deepEqual(completed, ['BeginAstralFlowKoOrbEnemyDeaths', 'CompleteAstralFlowKoOrbRewards']);
  assert.equal(globals.AstralFlowKoOrbPresentationActive, 0);
  assert.equal(globals.AstralFlowKoOrbPresentationState, null);
});

test('Astral Flow KO orbs wait for attack visuals then begin death payout before spill', async () => {
  const mod = loadPresentationModule();
  const globals = {
    time: 6,
    PendingHeroHits: [{ targetUID: 300, at: 6.1 }],
    ChainStrikeVisuals: [{ sourceTargetUID: 300, targetUID: 301 }],
    AstralFlowKoOrbQueue: [
      {
        id: 'ko-held',
        enemyUID: 300,
        enemyName: 'High Orc',
        source: { x: 220, y: 90 },
        ground: { x: 220, y: 110 },
        color: '#1e7bd6',
        orbScales: [1, 1, 1, 1],
      },
    ],
    AstralFlowAmpBarCanvas: { x: 40, y: 20, w: 120, h: 8, color: '#1e7bd6' },
  };
  const calls = [];
  const deps = {
    ctx: makeCanvasRecorder(),
    state: { globals },
    worldToCanvas: (x, y) => ({ x, y }),
    callFunctionWithContext: (_fnContext, name) => {
      calls.push(name);
      return { ok: true };
    },
    fnContext: {},
  };

  const held = mod.prepareAstralFlowKoOrbPresentation(deps);
  assert.equal(held.active, false);
  assert.equal(held.pending, true);
  assert.deepEqual(calls, []);
  assert.equal(globals.AstralFlowKoOrbPresentationState, undefined);
  assert.equal(globals.AstralFlowKoOrbPresentationPending, 1);

  globals.PendingHeroHits = [];
  globals.ChainStrikeVisuals = [];
  const started = mod.prepareAstralFlowKoOrbPresentation(deps);

  assert.deepEqual(calls, ['BeginAstralFlowKoOrbEnemyDeaths']);
  assert.equal(started.active, true);
  assert.equal(globals.AstralFlowKoOrbPresentationActive, 1);
  assert.equal(globals.AstralFlowKoOrbPresentationPending, 0);
  assert.equal(globals.AstralFlowKoOrbPresentationState.orbs.length, 4);
});

test('Astral Flow KO orbs keep dead enemy held until action and damage presentation clears', async () => {
  const mod = loadPresentationModule();
  const globals = {
    time: 8,
    HeroAction: { active: true, uid: 2 },
    TextAnimEndAt: 8.9,
    ActionLockUntil: 9.1,
    DamageTexts: [{ targetKind: 'enemy', phase: 1, age: 0.2 }],
    AstralFlowKoOrbQueue: [
      {
        id: 'ko-held-action',
        enemyUID: 300,
        enemyName: 'High Orc',
        source: { x: 220, y: 90 },
        ground: { x: 220, y: 110 },
        color: '#1e7bd6',
        orbScales: [1, 1, 1],
      },
    ],
    AstralFlowAmpBarCanvas: { x: 40, y: 20, w: 120, h: 8, color: '#1e7bd6' },
  };
  const calls = [];
  const deps = {
    ctx: makeCanvasRecorder(),
    state: { globals },
    worldToCanvas: (x, y) => ({ x, y }),
    callFunctionWithContext: (_fnContext, name) => {
      calls.push(name);
      return { ok: true };
    },
    fnContext: {},
  };

  const heldDuringAction = mod.prepareAstralFlowKoOrbPresentation(deps);
  assert.equal(heldDuringAction.active, false);
  assert.equal(heldDuringAction.pending, true);
  assert.deepEqual(calls, []);

  globals.HeroAction.active = false;
  globals.time = 9.05;
  globals.DamageTexts = [];
  const started = mod.prepareAstralFlowKoOrbPresentation(deps);
  assert.deepEqual(calls, ['BeginAstralFlowKoOrbEnemyDeaths']);
  assert.equal(started.active, true);
  assert.equal(globals.AstralFlowKoOrbPresentationActive, 1);
  assert.equal(globals.AstralFlowKoOrbPresentationPending, 0);
});

test('Astral Flow KO orb preparation does not wait on its own action lock', async () => {
  const mod = loadPresentationModule();
  const globals = {
    time: 8,
    ActionLockUntil: 9.1,
    AstralFlowKoOrbQueue: [
      {
        id: 'ko-self-lock',
        enemyUID: 300,
        enemyName: 'High Orc',
        source: { x: 220, y: 90 },
        ground: { x: 220, y: 110 },
        color: '#1e7bd6',
        orbScales: [1, 1, 1],
      },
    ],
    AstralFlowAmpBarCanvas: { x: 40, y: 20, w: 120, h: 8, color: '#1e7bd6' },
  };
  const calls = [];
  const started = mod.prepareAstralFlowKoOrbPresentation({
    ctx: makeCanvasRecorder(),
    state: { globals },
    worldToCanvas: (x, y) => ({ x, y }),
    callFunctionWithContext: (_fnContext, name) => {
      calls.push(name);
      return { ok: true };
    },
    fnContext: {},
  });

  assert.equal(started.active, true);
  assert.deepEqual(calls, ['BeginAstralFlowKoOrbEnemyDeaths']);
  assert.equal(globals.AstralFlowKoOrbPresentationActive, 1);
  assert.equal(globals.AstralFlowKoOrbPresentationPending, 0);
});

test('Astral Flow KO orb preparation begins death payout before the spill draw frame', async () => {
  const mod = loadPresentationModule();
  const globals = {
    time: 12,
    AstralFlowKoOrbQueue: [
      {
        id: 'ko-prepare',
        enemyUID: 300,
        enemyName: 'High Orc',
        source: { x: 220, y: 90 },
        ground: { x: 220, y: 110 },
        color: '#1e7bd6',
        orbScales: [1, 1, 1],
      },
    ],
    AstralFlowAmpBarCanvas: { x: 40, y: 20, w: 120, h: 8, color: '#1e7bd6' },
  };
  const calls = [];

  const prepared = mod.prepareAstralFlowKoOrbPresentation({
    state: { globals },
    worldToCanvas: (x, y) => ({ x, y }),
    callFunctionWithContext: (_fnContext, name) => {
      calls.push(name);
      return { ok: true };
    },
    fnContext: {},
  });

  assert.deepEqual(calls, ['BeginAstralFlowKoOrbEnemyDeaths']);
  assert.equal(prepared.active, true);
  assert.equal(prepared.prepared, true);
  assert.equal(globals.AstralFlowKoOrbPresentationActive, 1);
  assert.equal(globals.AstralFlowKoOrbPresentationState.orbs.length, 3);
});

test('Astral Flow KO orb draw pass never begins death payout after combat render', async () => {
  const mod = loadPresentationModule();
  const globals = {
    time: 12,
    AstralFlowKoOrbQueue: [
      {
        id: 'ko-ready-after-render',
        enemyUID: 300,
        enemyName: 'High Orc',
        source: { x: 220, y: 90 },
        ground: { x: 220, y: 110 },
        color: '#1e7bd6',
        orbScales: [1, 1, 1],
      },
    ],
    AstralFlowAmpBarCanvas: { x: 40, y: 20, w: 120, h: 8, color: '#1e7bd6' },
  };
  const calls = [];

  const result = mod.updateAndRenderAstralFlowKoOrbPresentation({
    ctx: makeCanvasRecorder(),
    state: { globals },
    worldToCanvas: (x, y) => ({ x, y }),
    callFunctionWithContext: (_fnContext, name) => {
      calls.push(name);
      return { ok: true };
    },
    fnContext: {},
  });

  assert.equal(result.active, false);
  assert.equal(result.pending, true);
  assert.deepEqual(calls, []);
  assert.equal(globals.AstralFlowKoOrbPresentationState, undefined);
});

test('Astral Flow KO orbs spill outward from the enemy and bounce multiple times before flying home', () => {
  const mod = loadPresentationModule();
  const globals = {
    time: 2,
    AstralFlowKoOrbQueue: [
      {
        id: 'ko-spill',
        enemyName: 'High Orc',
        source: { x: 220, y: 90 },
        ground: { x: 220, y: 110 },
        color: '#1e7bd6',
        orbScales: [1, 1, 1, 1, 1],
      },
    ],
    AstralFlowAmpBarCanvas: { x: 40, y: 20, w: 120, h: 8, color: '#1e7bd6' },
  };

  const presentation = mod.createAstralFlowKoOrbPresentation({
    globals,
    worldToCanvas: (x, y) => ({ x, y }),
  });

  assert.equal(presentation.orbs.length, 5);
  assert.ok(presentation.orbs.every(orb => Math.abs(orb.source.x - 220) <= 1));
  assert.ok(presentation.orbs.some(orb => orb.spillX < -20));
  assert.ok(presentation.orbs.some(orb => orb.spillX > 20));

  const rightOrb = presentation.orbs.find(orb => orb.spillX > 20);
  const early = mod.getAstralFlowKoOrbFrame(rightOrb, 2.12, presentation.startedAt);
  const firstBounce = mod.getAstralFlowKoOrbFrame(rightOrb, 2.34, presentation.startedAt);
  const secondBounce = mod.getAstralFlowKoOrbFrame(rightOrb, 2.53, presentation.startedAt);
  const thirdBounce = mod.getAstralFlowKoOrbFrame(rightOrb, 2.69, presentation.startedAt);
  const fly = mod.getAstralFlowKoOrbFrame(rightOrb, 2.86, presentation.startedAt);

  assert.equal(early.phase, 'spill');
  assert.equal(firstBounce.phase, 'bounce-1');
  assert.equal(secondBounce.phase, 'bounce-2');
  assert.equal(thirdBounce.phase, 'bounce-3');
  assert.equal(fly.phase, 'fly');
  assert.ok(firstBounce.x > early.x);
  assert.ok(secondBounce.x > firstBounce.x);
  assert.ok(thirdBounce.x > secondBounce.x);
});

test('runtime wiring keeps KO orb presentation outside app-level orchestration', () => {
  const appSrc = read('web-runner/app.js');
  const renderRuntimeSrc = read('web-runner/systems/renderRuntime.js');

  assert.match(appSrc, /import \* as astralFlowKoOrbPresentation from '\.\/systems\/astralFlowKoOrbPresentation\.js';/);
  assert.ok(
    appSrc.indexOf('astralFlowKoOrbPresentation.prepareAstralFlowKoOrbPresentation({') <
      appSrc.indexOf('renderRuntime.renderRuntime(runtimeScope)'),
    'KO orb preparation must begin death payout before the main combat frame renders'
  );
  assert.ok(
    appSrc.indexOf('renderRuntime.renderRuntime(runtimeScope)') <
      appSrc.indexOf('astralFlowKoOrbPresentation.updateAndRenderAstralFlowKoOrbPresentation({'),
    'KO orb drawing must still happen after the main combat frame renders'
  );
  assert.match(appSrc, /astralFlowKoOrbPresentation\.updateAndRenderAstralFlowKoOrbPresentation\(\{[\s\S]*ctx,[\s\S]*state,[\s\S]*worldToCanvas,[\s\S]*callFunctionWithContext,[\s\S]*fnContext,[\s\S]*\}\);/);
  assert.doesNotMatch(appSrc, /getEnemyKoAstralFlowOrbPresentation|CompleteAstralFlowKoOrbRewards|applyAstralFlowEnemyKoReward/);

  assert.match(renderRuntimeSrc, /presentationPatches\.AstralFlowAmpBarCanvas = \{[\s\S]*x: ampX,[\s\S]*y: ampY,[\s\S]*w: ampW,[\s\S]*h: barH,[\s\S]*color: '#1e7bd6',[\s\S]*\};/);
  assert.match(renderRuntimeSrc, /EnemyDeathVisualHoldByUID/);
  assert.match(renderRuntimeSrc, /\(e\.hp \?\? 0\) > 0 \|\| \(deathHoldByUID\[e\.uid\] && !deathHoldByUID\[e\.uid\]\.hiddenForOrb\)/);
});
