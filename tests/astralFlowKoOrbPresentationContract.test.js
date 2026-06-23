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

  mod.updateAndRenderAstralFlowKoOrbPresentation(deps);

  assert.equal(completed.length, 0);
  assert.equal(globals.AstralFlowKoOrbPresentationActive, 1);
  assert.equal(globals.AstralFlowKoOrbPresentationState.orbs.length, 7);
  assert.equal(globals.ActionLockUntil, globals.AstralFlowKoOrbPresentationState.endAt);
  assert.ok(globals.ActionLockUntil > 11.14);
  assert.ok(ctx.calls.some(call => call[0] === 'arc' && call[3] > 0));
  assert.ok(ctx.calls.some(call => call[0] === 'fillStyle' && call[1] === '#1e7bd6'));

  globals.time = globals.AstralFlowKoOrbPresentationState.endAt - 0.01;
  mod.updateAndRenderAstralFlowKoOrbPresentation(deps);
  assert.equal(completed.length, 0);

  globals.time = globals.AstralFlowKoOrbPresentationState.endAt + 0.01;
  mod.updateAndRenderAstralFlowKoOrbPresentation(deps);
  assert.deepEqual(completed, ['CompleteAstralFlowKoOrbRewards']);
  assert.equal(globals.AstralFlowKoOrbPresentationActive, 0);
  assert.equal(globals.AstralFlowKoOrbPresentationState, null);
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
  assert.match(appSrc, /astralFlowKoOrbPresentation\.updateAndRenderAstralFlowKoOrbPresentation\(\{[\s\S]*ctx,[\s\S]*state,[\s\S]*worldToCanvas,[\s\S]*callFunctionWithContext,[\s\S]*fnContext,[\s\S]*\}\);/);
  assert.doesNotMatch(appSrc, /getEnemyKoAstralFlowOrbPresentation|CompleteAstralFlowKoOrbRewards|applyAstralFlowEnemyKoReward/);

  assert.match(renderRuntimeSrc, /presentationPatches\.AstralFlowAmpBarCanvas = \{[\s\S]*x: ampX,[\s\S]*y: ampY,[\s\S]*w: ampW,[\s\S]*h: barH,[\s\S]*color: '#1e7bd6',[\s\S]*\};/);
});
