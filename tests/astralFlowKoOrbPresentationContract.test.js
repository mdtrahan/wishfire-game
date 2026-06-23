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
  assert.equal(globals.ActionLockUntil, 11.14);
  assert.ok(ctx.calls.some(call => call[0] === 'arc' && call[3] > 0));
  assert.ok(ctx.calls.some(call => call[0] === 'fillStyle' && call[1] === '#1e7bd6'));

  globals.time = 11.13;
  mod.updateAndRenderAstralFlowKoOrbPresentation(deps);
  assert.equal(completed.length, 0);

  globals.time = 11.15;
  mod.updateAndRenderAstralFlowKoOrbPresentation(deps);
  assert.deepEqual(completed, ['CompleteAstralFlowKoOrbRewards']);
  assert.equal(globals.AstralFlowKoOrbPresentationActive, 0);
  assert.equal(globals.AstralFlowKoOrbPresentationState, null);
});

test('runtime wiring keeps KO orb presentation outside app-level orchestration', () => {
  const appSrc = read('web-runner/app.js');
  const renderRuntimeSrc = read('web-runner/systems/renderRuntime.js');

  assert.match(appSrc, /import \* as astralFlowKoOrbPresentation from '\.\/systems\/astralFlowKoOrbPresentation\.js';/);
  assert.match(appSrc, /astralFlowKoOrbPresentation\.updateAndRenderAstralFlowKoOrbPresentation\(\{[\s\S]*ctx,[\s\S]*state,[\s\S]*worldToCanvas,[\s\S]*callFunctionWithContext,[\s\S]*fnContext,[\s\S]*\}\);/);
  assert.doesNotMatch(appSrc, /getEnemyKoAstralFlowOrbPresentation|CompleteAstralFlowKoOrbRewards|applyAstralFlowEnemyKoReward/);

  assert.match(renderRuntimeSrc, /presentationPatches\.AstralFlowAmpBarCanvas = \{[\s\S]*x: ampX,[\s\S]*y: ampY,[\s\S]*w: ampW,[\s\S]*h: barH,[\s\S]*color: '#1e7bd6',[\s\S]*\};/);
});
