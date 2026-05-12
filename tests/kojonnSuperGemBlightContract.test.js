const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function loadSuperGemRuntime() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'superGemRuntime.js'), 'utf8')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')
    + '\nmodule.exports = { executePendingSuperGemAction };';
  const context = { module: { exports: {} }, exports: {}, Math, Number, String, Array, Map };
  vm.runInNewContext(src, context, { filename: 'superGemRuntime.js' });
  return context.module.exports;
}

test('Kojonn green super-gem queues clustered blight waves instead of generic AOE damage', () => {
  const { executePendingSuperGemAction } = loadSuperGemRuntime();
  const actor = { uid: 4, name: 'Kojonn', kind: 'hero', attackType: 'magic', MAG: 22 };
  const enemies = [
    { uid: 101, name: 'Djinn', kind: 'enemy', hp: 30 },
    { uid: 102, name: 'Marid', kind: 'enemy', hp: 30 },
  ];
  const state = {
    globals: {
      time: 10,
      PendingSuperGemAction: { kind: 'super_gem_attack', color: 0, hitCount: 4, actorUID: actor.uid },
      PowerAmpByUID: {},
    },
    entities: [actor, ...enemies],
  };
  const calls = [];
  const callFunctionWithContext = (_ctx, name, ...args) => {
    calls.push(name);
    if (name === 'GetActorByUID') return [actor, ...enemies].find((entity) => entity.uid === args[0]) || null;
    if (name === 'GetPowerAmpMultiplierForActor') return 0;
    if (name === 'ConsumePowerAmpForActor') return 0;
    if (name === 'GetEffectiveStat') return args[1] === 'MAG' ? 22 : 0;
    if (name === 'StartHeroLunge') return true;
    if (name === 'CalculateDamage') throw new Error('Kojonn super-gem should not use generic AOE damage');
    return 0;
  };

  const activated = executePendingSuperGemAction({
    state,
    callFunctionWithContext,
    fnContext: {},
  });

  assert.equal(activated, true);
  assert.equal(state.globals.PendingSuperGemAction, null);
  assert.equal(state.globals.PendingHeroHits.length, 8);
  assert.ok(state.globals.PendingHeroHits.every((hit) => hit.effectType === 'dot_apply'));
  assert.ok(state.globals.PendingHeroHits.every((hit) => hit.dotTotalDamage === 16));
  assert.equal(
    JSON.stringify(state.globals.PendingHeroHits
      .filter((hit) => hit.targetUID === 101)
      .map((hit) => hit.effectName)),
    JSON.stringify(['Blight Wave 1', 'Blight Wave 2', 'Blight Wave 3', 'Blight Wave 4']),
  );
  assert.equal(calls.includes('CalculateDamage'), false);
});
