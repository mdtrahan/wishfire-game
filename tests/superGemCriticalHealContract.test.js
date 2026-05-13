const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function loadDoHeal(relPath) {
  const src = fs.readFileSync(relPath, 'utf8')
    .replace(/^import .+;\n/gm, '')
    .replace(/export /g, '');
  return Function(`${src}; return DoHeal;`)();
}

function loadSuperGemRuntime() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'superGemRuntime.js'), 'utf8')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')
    + '\nmodule.exports = { activateSuperGemEffect };';
  const context = { module: { exports: {} }, exports: {}, Math, Number, String, Array, Map };
  vm.runInNewContext(src, context, { filename: 'superGemRuntime.js' });
  return context.module.exports;
}

function createHealContext({
  partyHP = 10,
  partyMaxHP = 100,
  actorName = 'Falie',
  runtimeRandom = () => 0,
  chainMultiplier = 1,
} = {}) {
  const calls = [];
  const globals = {
    PartyHP: partyHP,
    PartyMaxHP: partyMaxHP,
    RuntimeRandom: runtimeRandom,
    ApplyChainToNextHeal: chainMultiplier > 1 ? 1 : 0,
    ChainMultiplier: chainMultiplier,
    PartyHPBarPosWorld: { x: 100, y: 20, w: 80, h: 12, ox: 0, oy: 0 },
  };
  const ctx = {
    state: { globals },
    globals,
    callFunction(name, ...args) {
      calls.push({ name, args });
      if (name === 'GetActorByUID') return { uid: args[0], name: actorName };
      if (name === 'ApplyPartyHeal') {
        globals.PartyHP = Math.min(globals.PartyMaxHP, globals.PartyHP + Number(args[0] || 0));
      }
      return undefined;
    },
  };
  return { ctx, calls };
}

test('super-gem critical heal rolls within the tightened 32 to 42 percent party max HP band', () => {
  const DoHeal = loadDoHeal('web-runner/modules/skillSheet.js');
  const low = createHealContext({ partyHP: 10, partyMaxHP: 147, runtimeRandom: () => 0 });
  const high = createHealContext({ partyHP: 10, partyMaxHP: 147, runtimeRandom: () => 0.999 });

  DoHeal(low.ctx, 4, 6);
  DoHeal(high.ctx, 4, 6);

  assert.equal(low.ctx.globals.PartyHP, 58);
  assert.equal(high.ctx.globals.PartyHP, 72);
  assert.ok(low.calls.some(call => call.name === 'ApplyPartyHeal' && call.args[0] === 48));
  assert.ok(high.calls.some(call => call.name === 'ApplyPartyHeal' && call.args[0] === 62));
  assert.ok(high.calls.some(call => call.name === 'LogCombat' && /critically heals party for 62/.test(String(call.args[0]))));
});

test('super-gem critical heal respects the current HP cap', () => {
  const DoHeal = loadDoHeal('web-runner/modules/skillSheet.js');
  const { ctx } = createHealContext({ partyHP: 130, partyMaxHP: 147, runtimeRandom: () => 0.999 });

  DoHeal(ctx, 4, 6);

  assert.equal(ctx.globals.PartyHP, 147);
});

test('super-gem critical heal is not amplified beyond the rolled percent by chain math', () => {
  const DoHeal = loadDoHeal('web-runner/modules/skillSheet.js');
  const { ctx, calls } = createHealContext({
    partyHP: 10,
    partyMaxHP: 147,
    runtimeRandom: () => 0.999,
    chainMultiplier: 2,
  });

  DoHeal(ctx, 4, 6);

  assert.equal(ctx.globals.PartyHP, 72);
  assert.ok(calls.some(call => call.name === 'ApplyPartyHeal' && call.args[0] === 62));
  assert.equal(ctx.globals.ApplyChainToNextHeal, 0);
});

test('heal super-gem activation routes to critical DoHeal and consumes turn pacing', () => {
  const { activateSuperGemEffect } = loadSuperGemRuntime();
  const state = {
    globals: {
      time: 12,
      RuntimeRandom: () => 0,
    },
  };
  const calls = [];
  const callFunctionWithContext = (_ctx, name, ...args) => {
    calls.push({ name, args });
    if (name === 'GetActorByUID') return { uid: args[0], name: 'Falie' };
    if (name === 'DoHeal') {
      state.globals.DeferAdvance = 1;
      state.globals.AdvanceAfterAction = 1;
      state.globals.ActionOwnerUID = args[0];
    }
    return undefined;
  };

  const activated = activateSuperGemEffect({
    superGem: { baseColor: 4 },
    actorUID: 4,
    selectedEnemyUID: 0,
    state,
    callFunctionWithContext,
    fnContext: {},
    sourceItems: [{ x: 1, y: 2, color: 4 }],
    startGemMergeFx: () => {},
    getGoldLabelTargetWorld: () => null,
  });

  assert.equal(activated, true);
  assert.deepEqual(calls.find(call => call.name === 'DoHeal')?.args, [4, 6]);
  assert.equal(state.globals.DeferAdvance, 1);
  assert.equal(state.globals.AdvanceAfterAction, 1);
  assert.equal(state.globals.ActionOwnerUID, 4);
});
