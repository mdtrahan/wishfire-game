const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'enemyTargetingRules.mjs');

function nextFunctionStart(source, start) {
  const match = /\n(?:export )?function\s/.exec(source.slice(start));
  return match ? start + match.index : -1;
}

test('simulation core module exposes a Rust-owned enemy target marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreEnemyTargetResolution/);
  assert.match(shadowSrc, /window\.__ORKA_ENEMY_TARGET_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowEnemyTargetOwner/);
});

test('enemy target resolver follows Rust owner when Rust and JS disagree', async () => {
  const { ENEMY_TARGET_MODE_CODES, resolveEnemyTargetHero } = await import(pathToFileURL(rulesPath));
  const heroes = [
    { uid: 11, name: 'Falie', hp: 10, maxHP: 40, stats: { ATK: 5 }, slotIndex: 0 },
    { uid: 22, name: 'Huun', hp: 20, maxHP: 35, stats: { ATK: 12 }, slotIndex: 1 },
  ];
  const decision = resolveEnemyTargetHero({
    enemy: { uid: 900, name: 'Djinn' },
    heroes,
    rng: () => 0.01,
    ownerHook: () => ({
      owner: 'rust',
      targetUID: 22,
      modeCode: ENEMY_TARGET_MODE_CODES.stable_order,
      rollIndex: 1,
    }),
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.target.uid, 22);
  assert.equal(decision.jsDecision.target.uid, 11);
  assert.equal(decision.trace.owner, 'rust');
});

test('continuous engagement selects only heroes within the attacking enemy reach', async () => {
  const vm = require('node:vm');
  const { selectContinuousEnemyTarget } = await import(pathToFileURL(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'arenaCombat.mjs')));
  const source = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'), 'utf8');
  const start = source.indexOf('function pickEnemyTargetHero(ctx, enemyUID = 0)');
  const end = nextFunctionStart(source, start + 1);
  const globals = { ContinuousCombatStageLoop: 1 };
  const enemy = { uid: 900, kind: 'enemy', hp: 20, footX: 250, footY: 100, streamState: 'engaged', arenaInReach: true };
  const heroes = [
    { uid: 11, kind: 'hero', hp: 5, footX: 200, footY: 100 },
    { uid: 22, kind: 'hero', hp: 50, footX: 800, footY: 100 },
  ];
  const neverRandom = () => { throw new Error('stable enemy targeting must not draw RNG'); };
  const context = {
    console,
    getGlobals: () => globals,
    GetActorByUID: (_ctx, uid) => (Number(uid) === enemy.uid ? enemy : heroes.find(hero => hero.uid === Number(uid))),
    getHeroes: () => heroes,
    getRandomSource: () => neverRandom,
    selectContinuousEnemyTarget,
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}; globalThis.pickEnemyTargetHero = pickEnemyTargetHero;`, context);
  const ctx = { state: { globals, entities: [enemy, ...heroes] } };
  assert.equal(context.pickEnemyTargetHero(ctx, enemy.uid).uid, 11);
  heroes[0].footX = 20;
  assert.equal(context.pickEnemyTargetHero(ctx, enemy.uid), null);
  enemy.streamState = 'approaching';
  assert.equal(context.pickEnemyTargetHero(ctx, enemy.uid), null);
});

test('no eligible target leaves the enemy attack lane ready', async () => {
  const vm = require('node:vm');
  const { resolveEnemyTargetHero } = await import(pathToFileURL(rulesPath));
  const { selectContinuousEnemyTarget } = await import(pathToFileURL(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'arenaCombat.mjs')));
  const source = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'), 'utf8');
  const pickerStart = source.indexOf('function pickEnemyTargetHero(ctx, enemyUID = 0)');
  const pickerEnd = nextFunctionStart(source, pickerStart + 1);
  const actionStart = source.indexOf('export function StartEnemyAction(ctx, enemyUID)');
  const actionEnd = nextFunctionStart(source, actionStart + 1);
  const globals = { ContinuousCombatStageLoop: 1, ActionInProgress: 0, ActionActorUID: 0 };
  const enemy = { uid: 900, kind: 'enemy', hp: 20, streamState: 'approaching', footX: 255, footY: 100, streamEngageX: 254 };
  const hero = { uid: 11, kind: 'hero', hp: 30, footX: 20, footY: 900 };
  const neverRandom = () => { throw new Error('stable enemy targeting must not draw RNG'); };
  const context = {
    console,
    getGlobals: () => globals,
    GetActorByUID: (_ctx, uid) => Number(uid) === enemy.uid ? enemy : null,
    getHeroes: () => [hero],
    getRandomSource: () => neverRandom,
    resolveEnemyTargetHero,
    selectContinuousEnemyTarget,
  };
  vm.createContext(context);
  const sourceFns = `${source.slice(pickerStart, pickerEnd)}\n${source.slice(actionStart, actionEnd).replace('export function ', 'function ')}; globalThis.StartEnemyAction = StartEnemyAction;`;
  vm.runInContext(sourceFns, context);
  context.StartEnemyAction({ state: { globals, entities: [enemy, hero] } }, enemy.uid);
  assert.equal(globals.ActionInProgress, 0);
  assert.equal(globals.ActionActorUID, 0);
  assert.equal(enemy.EnemyAction, undefined);
  assert.equal(globals.LastEnemyTargetBias, undefined);
});

test('pickEnemyTargetHero routes final enemy target through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /resolveEnemyTargetHero/);
    assert.match(src, /__ORKA_ENEMY_TARGET_OWNER__/);
    assert.match(src, /g\.LastEnemyTargetBias = result\.trace;/);
  }
});

test('sixth-member targeting survives the complete JS to WASM owner bridge', async () => {
  const vm = require('node:vm');
  const source = fs.readFileSync(shadowPath, 'utf8')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '');
  const context = { console, document: undefined };
  vm.createContext(context);
  vm.runInContext(source, context);
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(path.join(__dirname, '..', 'web-runner/assets/simulation_core.wasm')), {});
  const { resolveEnemyTargetHero } = await import(pathToFileURL(rulesPath));
  const heroes = Array.from({ length: 6 }, (_, i) => ({ uid: i + 1, hp: i === 5 ? 10 : 0, maxHP: 10 }));
  const decision = resolveEnemyTargetHero({
    heroes,
    rng: () => 0.5,
    ownerHook: payload => context.createSimulationCoreEnemyTargetResolution(payload, { exportsOverride: instance.exports }),
  });
  assert.equal(decision.owner, 'rust');
  assert.equal(decision.targetUID, 6);
  assert.equal(decision.jsDecision.targetUID, 6);
  const invalidOwner = resolveEnemyTargetHero({ heroes, rng: () => 0.5, ownerHook: () => ({ targetUID: 1 }) });
  assert.equal(invalidOwner.targetUID, 6);
});
