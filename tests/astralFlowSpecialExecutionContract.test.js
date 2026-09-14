const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const modulePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');

function loadModule() {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = { ExecuteAstralFlowSpecial, ProcessAstralFlowDestinyRegen, ApplyDamageToTarget };`;
  const context = { ...require('../web-runner/modules/heroCommands.mjs'), console: { log() {}, warn() {}, error() {} }, Math, module: { exports: {} }, exports: {}, state: { globals: {}, entities: [] }, effectiveStat: () => 10 };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function makeContext() {
  const heroes = [
    { uid: 1, kind: 'hero', name: 'Fara', heroDisplaySlot: 0, hp: 10, maxHP: 100, x: 1, y: 1 },
    { uid: 2, kind: 'hero', name: 'Hondo', heroDisplaySlot: 1, hp: 20, maxHP: 80, x: 2, y: 2 },
    { uid: 3, kind: 'hero', name: 'Runa', heroDisplaySlot: 2, hp: 0, maxHP: 70, x: 3, y: 3 },
    { uid: 4, kind: 'hero', name: 'Kaja', heroDisplaySlot: 3, hp: 30, maxHP: 50, x: 4, y: 4 },
  ];
  const globals = { time: 1, TurnSerial: 10, CombatLog: [], CombatActionLines: ['', '', '', ''], DamageTexts: [] };
  const enemies = [
    { uid: 11, kind: 'enemy', name: 'Ghoul A', hp: 80, maxHP: 80, x: 8, y: 2 },
    { uid: 12, kind: 'enemy', name: 'Ghoul B', hp: 80, maxHP: 80, x: 9, y: 3 },
  ];
  const state = { globals, entities: [...heroes, ...enemies] };
  return { state, callFunction(name, ...args) { if (name === 'SpawnDamageText') globals.DamageTexts.push({ amount: args[0], x: args[1], y: args[2], kind: args[3], targetKind: args[4] }); } };
}

test('Magic Fruit divides a 30-percent caster-Max-HP pool among living heroes in roster order', () => {
  const mod = loadModule();
  const ctx = makeContext();
  const result = mod.ExecuteAstralFlowSpecial(ctx, 'magic_fruit', 1);
  assert.equal(result.ok, true);
  assert.equal(result.pool, 30);
  assert.deepEqual(JSON.parse(JSON.stringify(result.heals.map(row => [row.heroUID, row.requested]))), [[1, 10], [2, 10], [4, 10]]);
  assert.deepEqual(ctx.state.entities.filter(actor => actor.kind === 'hero').map(hero => hero.hp), [20, 30, 0, 40]);
  assert.deepEqual(ctx.state.globals.DamageTexts.map(text => [text.targetUID, text.amount, text.kind]), [[1, 10, 'heal'], [2, 10, 'heal'], [4, 10, 'heal']]);
});

test('Destiny gives each living hero three personal-turn 8-percent Max-HP ticks and survives Kaja defeat', () => {
  const mod = loadModule();
  const ctx = makeContext();
  const activation = mod.ExecuteAstralFlowSpecial(ctx, 'destiny', 4);
  assert.equal(activation.ok, true);
  assert.deepEqual(Object.keys(ctx.state.globals.AstralFlowDestinyRegensByUID).sort(), ['1', '2', '4']);
  ctx.state.entities[3].hp = 0;
  for (let turn = 11; turn <= 13; turn += 1) {
    ctx.state.globals.TurnSerial = turn;
    assert.equal(mod.ProcessAstralFlowDestinyRegen(ctx, 1), true);
  }
  assert.equal(ctx.state.entities[0].hp, 34);
  assert.equal(ctx.state.globals.AstralFlowDestinyRegensByUID['1'], undefined);
  assert.equal(ctx.state.globals.AstralFlowDestinyRegensByUID['2'].remainingTicks, 3);
});

test('special runtime maps the four signature ids and keeps the retired Destiny hit proc out of this path', () => {
  for (const sourcePath of [modulePath, path.join(__dirname, '..', 'Scripts', 'functionBank.js')]) {
    const src = fs.readFileSync(sourcePath, 'utf8');
    assert.match(src, /export function ExecuteAstralFlowSpecial/);
    assert.match(src, /id === 'crimson_ward'/);
    assert.match(src, /id === 'split'/);
    assert.match(src, /id === 'arcane_pulse'/);
    assert.match(src, /id === 'destiny'/);
    assert.match(src, /remainingTicks: 3, healPct: 0\.08/);
    assert.doesNotMatch(src, /ExecuteAstralFlowSpecial[\s\S]{0,5000}TryPartyDestiny/);
  }
});

test('each non-healing AF special queues its existing AoE or targeted effect with one-use ownership', () => {
  const mod = loadModule();
  for (const [specialId, actorUID] of [['crimson_ward', 1], ['split', 2], ['arcane_pulse', 3], ['chain_strike_ii', 2], ['faze', 1]]) {
    const ctx = makeContext();
    ctx.state.entities.find(actor => actor.uid === 3).hp = 30;
    const result = mod.ExecuteAstralFlowSpecial(ctx, specialId, actorUID);
    assert.equal(result.ok, true, specialId);
    assert.equal(ctx.state.globals.LastAstralFlowSpecial.id, specialId);
    assert.equal(ctx.state.globals.LastAstralFlowSpecial.actorUID, actorUID);
    if (specialId === 'crimson_ward') assert.ok(Number(ctx.state.globals.PartyTempHPShield || 0) > 0);
    if (specialId === 'split') assert.equal(ctx.state.globals.PendingHeroHits.filter(hit => hit.actionName === 'Split').length, 2);
    if (specialId === 'arcane_pulse') assert.equal(ctx.state.globals.PendingHeroHits.filter(hit => hit.effectType === 'arcane_pulse').length, 1);
    if (specialId === 'chain_strike_ii') {
      const telemetry=ctx.state.globals.LastAstralFlowChainStrikeII;
      assert.equal(telemetry.primary.coefficient,396);assert.ok(telemetry.primary.damage>0);
      assert.ok(telemetry.hitCount>0);assert.equal((ctx.state.globals.PendingHeroHits || []).some(hit => hit.actionName === 'Chain Strike II'),false);
    }
    if (specialId === 'faze') assert.equal(ctx.state.globals.TaintedGroundZones.length, 2);
  }
});

test('Chain Strike II resolves immediately at the 396-percent payload and retargets a dead selection', () => {
  const mod=loadModule();const ctx=makeContext();ctx.state.entities.filter(actor=>actor.kind==='enemy').forEach(actor=>{actor.hp=5000;actor.maxHP=5000;});ctx.state.globals.SelectedEnemyUID=11;
  const result=mod.ExecuteAstralFlowSpecial(ctx,'chain_strike_ii',2);assert.equal(result.ok,true);
  const primary=ctx.state.globals.LastAstralFlowChainStrikeII.primary;assert.equal(primary.targetUID,11);assert.equal(primary.coefficient,396);assert.ok(primary.damage>0);assert.equal(primary.preHP,5000);assert.equal(primary.postHP,5000-primary.damage);
  ctx.state.entities.find(actor=>actor.uid===11).hp=0;ctx.state.globals.SelectedEnemyUID=11;const rerun=mod.ExecuteAstralFlowSpecial(ctx,'chain_strike_ii',2);assert.equal(rerun.ok,true);assert.equal(rerun.targetUID,12);assert.equal(ctx.state.globals.LastAstralFlowChainStrikeII.primary.targetUID,12);
});
