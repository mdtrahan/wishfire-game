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

module.exports = { ExecuteAstralFlowSpecial, ProcessAstralFlowDestinyRegen };`;
  const context = { console: { log() {}, warn() {}, error() {} }, Math, module: { exports: {} }, exports: {}, state: { globals: {}, entities: [] } };
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
  return { state: { globals, entities: heroes }, callFunction() {} };
}

test('Magic Fruit divides a 30-percent caster-Max-HP pool among living heroes in roster order', () => {
  const mod = loadModule();
  const ctx = makeContext();
  const result = mod.ExecuteAstralFlowSpecial(ctx, 'magic_fruit', 1);
  assert.equal(result.ok, true);
  assert.equal(result.pool, 30);
  assert.deepEqual(JSON.parse(JSON.stringify(result.heals.map(row => [row.heroUID, row.requested]))), [[1, 10], [2, 10], [4, 10]]);
  assert.deepEqual(ctx.state.entities.map(hero => hero.hp), [20, 30, 0, 40]);
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
