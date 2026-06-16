const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
const statePath = path.join(__dirname, '..', 'web-runner', 'modules', 'state.js');
const functionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const skillSheetPath = path.join(__dirname, '..', 'web-runner', 'modules', 'skillSheet.js');
const superGemRuntimePath = path.join(__dirname, '..', 'web-runner', 'systems', 'superGemRuntime.js');

function extractFunction(src, name) {
  const match = src.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `missing ${name}`);
  return match[0];
}

function loadRuntimeRngHelpers() {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const snippet = [
    'const COMBAT_RUNTIME_RNG_SALT = 0x9e3779b9;',
    'const state = { globals: {} };',
    'const calls = [];',
    `function createSimulationCoreSeededRng(seed = 1, opts = {}) {
      calls.push({ seed, source: opts.source || '' });
      let draws = 0;
      return () => {
        draws += 1;
        return draws === 1 ? 0.25 : 0.75;
      };
    }`,
    extractFunction(appSrc, 'normalizeRuntimeRngSeed'),
    extractFunction(appSrc, 'deriveCombatRuntimeRngSeed'),
    extractFunction(appSrc, 'createCombatRuntimeRandom'),
    extractFunction(appSrc, 'installCombatRuntimeRandom'),
  ].join('\n\n');
  const script = `${snippet}
module.exports = {
  state,
  calls,
  normalizeRuntimeRngSeed,
  deriveCombatRuntimeRngSeed,
  createCombatRuntimeRandom,
  installCombatRuntimeRandom,
};`;
  const context = {
    module: { exports: {} },
    exports: {},
    Number,
    String,
    Math,
    JSON,
  };
  vm.runInNewContext(script, context, { filename: 'combatRuntimeRngHelpers.js' });
  return context.module.exports;
}

function sequenceRandom(values) {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
}

function mathThatFailsOnRandom() {
  const math = Object.create(Math);
  math.random = () => {
    throw new Error('direct Math.random should not be used for deterministic combat RNG');
  };
  return math;
}

function loadFunctionBank({ math = Math } = {}) {
  const original = fs.readFileSync(functionBankPath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  Add_Energy,
  GrantPurpleMatchEnergy,
  SpawnDamageText,
};`;
  const context = {
    console,
    Math: math,
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: functionBankPath }).runInContext(context);
  return context.module.exports;
}

function loadDoHeal({ math = Math } = {}) {
  const src = fs.readFileSync(skillSheetPath, 'utf8')
    .replace(/^import .+;\n/gm, '')
    .replace(/export /g, '');
  return Function('Math', `${src}; return DoHeal;`)(math);
}

function loadSuperGemRuntime({ math = Math } = {}) {
  const src = fs.readFileSync(superGemRuntimePath, 'utf8')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')
    + '\nmodule.exports = { activateSuperGemEffect };';
  const context = { module: { exports: {} }, exports: {}, Math: math, Number, String, Array, Map };
  vm.runInNewContext(src, context, { filename: 'superGemRuntime.js' });
  return context.module.exports;
}

function makeEnergyContext(runtimeRandom) {
  return {
    state: {
      globals: {
        RuntimeRandom: runtimeRandom,
        Player_Energy: 0,
        CombatActionLines: ['', '', '', ''],
        TurnOrderArray: [{ uid: 1 }],
        CurrentTurnIndex: 0,
      },
      entities: [{ uid: 1, name: 'Falie', kind: 'hero', heroIndex: 0 }],
    },
  };
}

function makeHealContext(runtimeRandom) {
  const globals = {
    PartyHP: 10,
    PartyMaxHP: 147,
    RuntimeRandom: runtimeRandom,
    PartyHPBarPosWorld: { x: 100, y: 20, w: 80, h: 12, ox: 0, oy: 0 },
  };
  return {
    state: { globals },
    globals,
    callFunction(name, ...args) {
      if (name === 'GetActorByUID') return { uid: args[0], name: 'Falie' };
      if (name === 'ApplyPartyHeal') {
        globals.PartyHP = Math.min(globals.PartyMaxHP, globals.PartyHP + Number(args[0] || 0));
      }
      return undefined;
    },
  };
}

test('combat runtime RNG helpers install a Rust-owned seeded RuntimeRandom session', () => {
  const helpers = loadRuntimeRngHelpers();
  const seed = helpers.deriveCombatRuntimeRngSeed(123);
  const rng = helpers.installCombatRuntimeRandom(seed, 'test-install');

  assert.equal(typeof rng, 'function');
  assert.equal(helpers.state.globals.RuntimeRandomOwner, 'rust');
  assert.equal(helpers.state.globals.RuntimeRandomSeed, seed);
  assert.equal(helpers.state.globals.RuntimeRandomDraws, 0);
  assert.equal(helpers.state.globals.RuntimeRandomReason, 'test-install');
  assert.equal(helpers.calls[0].seed, seed);
  assert.equal(helpers.calls[0].source, 'app.combatRuntimeRng');

  assert.equal(helpers.state.globals.RuntimeRandom(), 0.25);
  assert.equal(helpers.state.globals.RuntimeRandom(), 0.75);
  assert.equal(helpers.state.globals.RuntimeRandomDraws, 2);
  assert.equal(helpers.state.globals.RuntimeRandomLastValue, 0.75);

  const saveLike = JSON.parse(JSON.stringify({ globals: helpers.state.globals }));
  assert.equal(saveLike.globals.RuntimeRandom, undefined);
  assert.equal(saveLike.globals.RuntimeRandomOwner, 'rust');
  assert.equal(saveLike.globals.RuntimeRandomSeed, seed);
  assert.equal(saveLike.globals.RuntimeRandomDraws, 2);
});

test('combat startup installs RuntimeRandom from the encounter seed and keeps metadata fields explicit', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const initializerSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'combatSessionInitializer.js'), 'utf8');
  const stateSrc = fs.readFileSync(statePath, 'utf8');

  assert.match(appSrc, /function normalizeRuntimeRngSeed/);
  assert.match(appSrc, /function deriveCombatRuntimeRngSeed/);
  assert.match(appSrc, /function installCombatRuntimeRandom/);
  assert.match(appSrc, /createCombatSessionInitializer\(\{[\s\S]*deriveCombatRuntimeRngSeed,[\s\S]*installCombatRuntimeRandom,/);
  assert.match(initializerSrc, /installCombatRuntimeRandom\(deriveCombatRuntimeRngSeed\(encounterSeed\), 'initEntities'\)/);
  assert.match(stateSrc, /RuntimeRandomSeed: 0/);
  assert.match(stateSrc, /RuntimeRandomDraws: 0/);
  assert.match(stateSrc, /RuntimeRandomOwner: ''/);
  assert.doesNotMatch(stateSrc, /RuntimeRandom: /);
});

test('functionBank deterministic energy paths consume RuntimeRandom without direct Math.random', () => {
  const mod = loadFunctionBank({ math: mathThatFailsOnRandom() });
  const energyCtx = makeEnergyContext(sequenceRandom([0.99]));

  mod.Add_Energy(energyCtx);

  assert.equal(energyCtx.state.globals.Player_Energy, 15);
  assert.match(energyCtx.state.globals.CombatActionLines[3], /grabbed 15 magic orbs/);

  const purpleCtx = makeEnergyContext(sequenceRandom([0.99]));
  const gained = mod.GrantPurpleMatchEnergy(purpleCtx, 1, 4);

  assert.equal(gained, 15);
  assert.equal(purpleCtx.state.globals.Player_Energy, 15);
  assert.equal(purpleCtx.state.globals.LastPurpleEnergyGain.amount, 15);
});

test('invalid installed RuntimeRandom output clamps instead of falling back to Math.random', () => {
  const mod = loadFunctionBank({ math: mathThatFailsOnRandom() });
  const ctx = makeEnergyContext(() => Number.NaN);

  mod.Add_Energy(ctx);

  assert.equal(ctx.state.globals.Player_Energy, 3);
});

test('skillSheet critical heal consumes RuntimeRandom without direct Math.random', () => {
  const DoHeal = loadDoHeal({ math: mathThatFailsOnRandom() });
  const ctx = makeHealContext(() => 0.999);

  DoHeal(ctx, 4, 6);

  assert.equal(ctx.state.globals.PartyHP, 72);
});

test('superGemRuntime combat rolls consume RuntimeRandom without direct Math.random', () => {
  const { activateSuperGemEffect } = loadSuperGemRuntime({ math: mathThatFailsOnRandom() });
  const actor = { uid: 2, name: 'Huun', kind: 'hero', attackType: 'melee' };
  const enemy = { uid: 101, name: 'Djinn', kind: 'enemy', hp: 50 };
  const state = {
    globals: {
      time: 8,
      goldTotal: 15,
      RuntimeRandom: () => 0.60,
    },
    entities: [actor, enemy],
  };
  const activated = activateSuperGemEffect({
    superGem: { baseColor: 3 },
    actorUID: actor.uid,
    selectedEnemyUID: enemy.uid,
    state,
    callFunctionWithContext: (_ctx, name, ...args) => {
      if (name === 'GetActorByUID') return state.entities.find((entity) => Number(entity.uid) === Number(args[0])) || null;
      if (name === 'StartHeroLunge') return true;
      return undefined;
    },
    fnContext: {},
    sourceItems: [],
    consumedColorGemCount: 10,
    startGemMergeFx: () => {},
    getGoldLabelTargetWorld: () => null,
  });

  assert.equal(activated, true);
  assert.equal(state.globals.PendingHeroHits[0].huunGoldstrikeRoll, 60);
  assert.equal(state.globals.PendingHeroHits[0].finalDmg, 75);
});

test('presentation damage text does not consume the deterministic combat RuntimeRandom', () => {
  const mod = loadFunctionBank();
  const ctx = {
    state: {
      globals: {
        RuntimeRandom: () => {
          throw new Error('presentation randomness must not consume RuntimeRandom');
        },
        DamageTexts: [],
        NextDamageTextScatter: { radiusX: 10, radiusY: 5 },
      },
      entities: [],
    },
  };

  mod.SpawnDamageText(ctx, 12, 100, 120, 'damage', 'enemy');

  assert.equal(ctx.state.globals.DamageTexts.length, 1);
  assert.equal(ctx.state.globals.NextDamageTextScatter, undefined);
});
