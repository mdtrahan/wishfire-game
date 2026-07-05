const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'effectiveStatRules.mjs');
const combatTurnQaReadoutPath = path.join(__dirname, '..', 'web-runner', 'systems', 'combatTurnQaReadout.mjs');

function extractFunctionBody(src, functionName) {
  const marker = `export function ${functionName}`;
  const start = src.indexOf(marker);
  assert.notEqual(start, -1, `${functionName} export exists`);
  const open = src.indexOf('{', start);
  assert.notEqual(open, -1, `${functionName} body opens`);
  let depth = 0;
  for (let idx = open; idx < src.length; idx += 1) {
    const ch = src[idx];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return src.slice(open + 1, idx);
  }
  assert.fail(`${functionName} body closes`);
}

function loadFunctionBank(modulePath, effectiveStatOwner) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  GetEffectiveStat,
};`;
  const calls = [];
  const context = {
    console: {
      log() {},
      warn() {},
      error() {},
    },
    Math,
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
    createEffectiveStatSimulationPacket: (payload) => {
      const { ownerHook, ...submitted } = payload;
      const result = ownerHook(submitted);
      return {
        owner: result.owner,
        value: result.value,
        simulationCoreRequest: {
          action: { type: 'combat.effectiveStat' },
        },
        simulationCoreResponse: {
          result: 'effective_stat',
          diagnostics: {
            jsValue: submitted.jsValue,
          },
        },
      };
    },
    __ORKA_EFFECTIVE_STAT_OWNER__: (payload) => {
      calls.push(payload);
      return effectiveStatOwner(payload);
    },
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return { mod: context.module.exports, calls };
}

function makeContext() {
  const hero = {
    uid: 100,
    kind: 'hero',
    name: 'Kojonn',
    hp: 40,
    stats: {
      ATK: 10,
      DEF: 10,
      MAG: 10,
      SPD: 10,
      RES: 10,
    },
  };
  const enemy = {
    uid: 200,
    kind: 'enemy',
    name: 'Marid',
    hp: 100,
    stats: {
      ATK: 6,
      DEF: 10,
      MAG: 6,
      SPD: 6,
      RES: 6,
    },
  };
  return {
    state: {
      globals: {
        PartyBuff_ATK: 3,
        PartyBuff_DEF: 0,
        PartyBuff_MAG: 0,
        PartyBuff_SPD: 0,
        PartyBuff_RES: 0,
        EnemyDebuffs: {
          200: { DEF: 4 },
        },
      },
      entities: [hero, enemy],
    },
  };
}

test('simulation core module exposes a Rust-owned effective stat marker', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_EFFECTIVE_STAT_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCoreEffectiveStatResolution/);
  assert.match(shadowSrc, /simulationCore\.startup\.effectiveStatOwner/);
  assert.match(shadowSrc, /effectiveStatOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowEffectiveStatOwner/);
});

test('turn-order rebuild diagnostics read effective Speed through the named owner', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const src = fs.readFileSync(modulePath, 'utf8');
    const body = extractFunctionBody(src, 'RebuildTurnOrderPreserveCurrent');

    assert.match(body, /GetEffectiveStat\(ctx,\s*actor,\s*['"]SPD['"]\)/, `${modulePath} uses GetEffectiveStat for rebuild Speed logs`);
    assert.doesNotMatch(body, /PartyBuff_SPD/, `${modulePath} does not re-read party Speed buffs in rebuild logs`);
    assert.doesNotMatch(body, /EnemyDebuffs/, `${modulePath} does not re-read enemy Speed debuffs in rebuild logs`);
    assert.doesNotMatch(body, /stats\?\.\s*SPD|actor\.SPD/, `${modulePath} does not recompute base Speed in rebuild logs`);
  }
});

test('combat turn QA readout does not own effective Speed calculation', () => {
  const src = fs.readFileSync(combatTurnQaReadoutPath, 'utf8');

  assert.match(src, /callFunctionWithContext\(fnContext,\s*['"]GetEffectiveStat['"],\s*actor,\s*['"]SPD['"]\)/);
  assert.doesNotMatch(src, /Math\.max\(0,\s*readBaseSpeed/);
  assert.doesNotMatch(src, /readBaseSpeed\(actor\)\s*\+\s*Number\(modifier\.amount/);
  assert.match(src, /Unavailable: effective Speed owner was not available\./);
});

test('effective stat packet follows Rust owner when Rust and JS disagree', async () => {
  const { createEffectiveStatSimulationPacket } = await import(pathToFileURL(rulesPath));
  const packet = createEffectiveStatSimulationPacket({
    source: 'test.packetizedEffectiveStat',
    uid: 100,
    stat: 'ATK',
    actorKind: 'hero',
    base: 10,
    partyBuff: 3,
    enemyDebuff: 0,
    isHero: 1,
    isEnemy: 0,
    ownerHook: (payload) => ({
      owner: 'rust',
      value: Number(payload.jsValue || 0) + 9,
    }),
  });

  assert.equal(packet.owner, 'rust');
  assert.equal(packet.value, 22);
  assert.equal(packet.simulationCoreRequest.action.type, 'combat.effectiveStat');
  assert.equal(packet.simulationCoreRequest.context.ruleFamily, 'effectiveStat');
  assert.equal(packet.simulationCoreResponse.result, 'effective_stat');
  assert.equal(packet.simulationCoreResponse.diagnostics.jsValue, 13);
  assert.equal(packet.simulationCoreResponse.nextGameState.combat.lastEffectiveStat.value, 22);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreRequest)), packet.simulationCoreRequest);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreResponse)), packet.simulationCoreResponse);
});

test('effective stat follows Rust owner when Rust and JS disagree', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const { mod, calls } = loadFunctionBank(modulePath, (payload) => ({
      owner: 'rust',
      value: payload.isHero ? 77 : 5,
    }));
    const ctx = makeContext();
    const [hero, enemy] = ctx.state.entities;

    assert.equal(mod.GetEffectiveStat(ctx, hero, 'ATK'), 77, `${modulePath} hero Rust-owned value`);
    assert.equal(mod.GetEffectiveStat(ctx, enemy, 'DEF'), 5, `${modulePath} enemy Rust-owned value`);

    assert.equal(calls[0].stat, 'ATK', `${modulePath} submitted hero stat`);
    assert.equal(calls[0].base, 10, `${modulePath} submitted hero base`);
    assert.equal(calls[0].partyBuff, 3, `${modulePath} submitted hero buff`);
    assert.equal(calls[0].enemyDebuff, 0, `${modulePath} submitted hero debuff`);
    assert.equal(calls[0].jsValue, 13, `${modulePath} submitted hero JS value`);
    assert.equal(calls[1].stat, 'DEF', `${modulePath} submitted enemy stat`);
    assert.equal(calls[1].base, 10, `${modulePath} submitted enemy base`);
    assert.equal(calls[1].partyBuff, 0, `${modulePath} submitted enemy buff`);
    assert.equal(calls[1].enemyDebuff, 4, `${modulePath} submitted enemy debuff`);
    assert.equal(calls[1].jsValue, 6, `${modulePath} submitted enemy JS value`);
    assert.equal(ctx.state.globals.LastEffectiveStatOwner.owner, 'rust');
    assert.equal(ctx.state.globals.LastEffectiveStatOwner.value, 5);
    assert.equal(ctx.state.globals.LastEffectiveStatPacket.owner, 'rust');
    assert.equal(ctx.state.globals.LastEffectiveStatPacket.actionType, 'combat.effectiveStat');
  }
});
