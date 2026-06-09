const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');

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
    throw new Error('direct Math.random should not be used for enemy action RNG');
  };
  return math;
}

function loadFunctionBank(modulePath, overrides = {}) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  Enemy_Heal_Ally,
  Enemy_Heal_Self,
  PickEnemySkill,
};`;
  const context = {
    console,
    Math: mathThatFailsOnRandom(),
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
    ...overrides,
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function makeEnemyActionContext(randomValues = [0]) {
  const healer = {
    uid: 300,
    kind: 'enemy',
    name: 'Chimerilass',
    hp: 40,
    maxHP: 100,
    MAG: 30,
    stats: { MAG: 30, ATK: 10, DEF: 4, RES: 4, SPD: 1 },
    x: 10,
    y: 10,
  };
  const allyA = {
    uid: 301,
    kind: 'enemy',
    name: 'Ally A',
    hp: 10,
    maxHP: 30,
    MAG: 10,
    stats: { MAG: 10, ATK: 10, DEF: 4, RES: 4, SPD: 1 },
    x: 20,
    y: 20,
  };
  const allyB = {
    uid: 302,
    kind: 'enemy',
    name: 'Ally B',
    hp: 12,
    maxHP: 30,
    MAG: 10,
    stats: { MAG: 10, ATK: 10, DEF: 4, RES: 4, SPD: 1 },
    x: 30,
    y: 30,
  };
  return {
    state: {
      globals: {
        RuntimeRandom: sequenceRandom(randomValues),
        CombatActionLines: ['', '', '', ''],
        CombatLog: [],
        DamageTexts: [],
      },
      entities: [healer, allyA, allyB],
    },
  };
}

function captureEnemySkillChoice() {
  const calls = [];
  return {
    calls,
    resolveEnemySkillChoice(payload) {
      calls.push(payload);
      return {
        owner: 'rust',
        selected: payload.healRoll >= 0.5 ? 'Enemy_Heal_Self' : 'Enemy_Heal_Allies',
        branch: 'cmh_under_50_forced_heal',
        jsDecision: {
          selected: 'Enemy_Heal_Allies',
          branch: 'cmh_under_50_forced_heal',
        },
      };
    },
  };
}

function sourceSlice(src, startNeedle, endNeedle) {
  const start = src.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing ${startNeedle}`);
  const end = endNeedle ? src.indexOf(endNeedle, start + startNeedle.length) : -1;
  return end === -1 ? src.slice(start) : src.slice(start, end);
}

test('enemy action RNG pockets no longer call direct Math.random in deterministic functions', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const src = fs.readFileSync(modulePath, 'utf8');
    const snippets = [
      sourceSlice(src, 'function rollEnemyHealAmount', 'export function GetPowerAmpMultiplierForActor'),
      sourceSlice(src, 'function applyRunaMagicResist', 'const ENEMY_DEBUFF_STATS'),
      sourceSlice(src, 'export function Enemy_Heal_Ally', 'export function PickNextEnemyID'),
      sourceSlice(src, 'function buildWaveRespawnPlan', 'function ensurePendingEnemyRespawnSlots'),
      sourceSlice(src, 'export function ResolveEnemyAction', 'export function ExecuteEnemySkill'),
      sourceSlice(src, 'export function PickEnemySkill', 'export function GetEnemySkillAssignmentMap'),
      sourceSlice(src, 'function lockRandomGemLine', 'function executeEnemyBoardPressureSkill'),
    ];
    for (const snippet of snippets) {
      assert.doesNotMatch(snippet, /Math\.random\(\)/, modulePath);
    }
  }
});

test('PickEnemySkill consumes RuntimeRandom for Rust-owned enemy skill choice rolls', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const captured = captureEnemySkillChoice();
    const mod = loadFunctionBank(modulePath, captured);
    const ctx = makeEnemyActionContext([0.73]);

    const selected = mod.PickEnemySkill(ctx, 300);

    assert.equal(selected, 'Enemy_Heal_Self', modulePath);
    assert.equal(captured.calls.length, 1, modulePath);
    assert.equal(captured.calls[0].roll, -1, modulePath);
    assert.equal(captured.calls[0].healRoll, 0.73, modulePath);
    assert.equal(ctx.state.globals.LastEnemySkillChoiceOwner.owner, 'rust', modulePath);
  }
});

test('enemy heal amount and ally target rolls consume RuntimeRandom', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const mod = loadFunctionBank(modulePath);
    const ctx = makeEnemyActionContext([0.75, 0, 0.99]);

    mod.Enemy_Heal_Ally(ctx, 300, 0);

    const trace = ctx.state.globals.EnemyHealTrace?.[0];
    assert.ok(trace, modulePath);
    assert.equal(trace.targetUID, 302, modulePath);
    assert.equal(trace.rangeRoll, 0, modulePath);
    assert.equal(trace.critRoll, 0.99, modulePath);
  }
});
