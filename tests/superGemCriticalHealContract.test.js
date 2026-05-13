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

function createHealContext({ partyHP = 10, partyMaxHP = 100, actorName = 'Falie' } = {}) {
  const calls = [];
  const globals = {
    PartyHP: partyHP,
    PartyMaxHP: partyMaxHP,
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

test('super-gem critical heal can reach but not exceed 40 percent of party max HP', () => {
  const DoHeal = loadDoHeal('web-runner/modules/skillSheet.js');
  const { ctx, calls } = createHealContext({ partyHP: 10, partyMaxHP: 100 });

  DoHeal(ctx, 4, 6);

  assert.equal(ctx.globals.PartyHP, 50);
  assert.ok(calls.some(call => call.name === 'ApplyPartyHeal' && call.args[0] === 40));
  assert.ok(calls.some(call => call.name === 'LogCombat' && /critically heals party for 40/.test(String(call.args[0]))));
});

test('super-gem critical heal respects the current HP cap', () => {
  const DoHeal = loadDoHeal('web-runner/modules/skillSheet.js');
  const { ctx } = createHealContext({ partyHP: 75, partyMaxHP: 100 });

  DoHeal(ctx, 4, 6);

  assert.equal(ctx.globals.PartyHP, 100);
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
