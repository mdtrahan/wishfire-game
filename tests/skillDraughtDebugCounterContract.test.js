const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');

function loadModule(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ForceAstralFlowSkillDraught,
  GetSkillDraughtState,
  SelectSkillDraughtCard,
};`;
  const context = {
    console,
    Math,
    document: {
      documentElement: {
        attributes: {},
        getAttribute(name) {
          return Object.prototype.hasOwnProperty.call(this.attributes, name)
            ? this.attributes[name]
            : null;
        },
        setAttribute(name, value) {
          this.attributes[name] = String(value);
        },
      },
    },
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return { ...context.module.exports, __context: context };
}

function makeContext() {
  const hero = {
    uid: 100,
    kind: 'hero',
    name: 'Falie',
    baseHeroName: 'Falie',
    heroIndex: 0,
    hp: 10,
    maxHP: 101,
    x: 10,
    y: 10,
    stats: { ATK: 4, DEF: 0, MAG: 2, RES: 0, SPD: 1 },
  };
  const globals = {
    time: 0,
    PartyHP: 10,
    PartyMaxHP: 101,
    PartyHPByIndex: [10],
    PartyMaxHPByIndex: [101],
    CombatLog: [],
    CombatActionLines: ['', '', '', ''],
    SkillDraughtOpen: 0,
    SkillDraughtHeroUID: 0,
    SkillDraughtCandidates: [],
    SkillDraughtHitZones: [],
    SkillDraughtSelectedSkillId: '',
    SessionSkillsByHeroUID: {},
    SkillDraughtTrace: [],
    SkillDraughtTraceSeq: 0,
    AstralFlowAmpPoints: 18,
    AstralFlowAmpMax: 18,
    AstralFlowAmpReady: 1,
  };
  const ctx = {
    state: { globals, entities: [hero] },
    callFunction(name, ...args) {
      if (name === 'ApplyPartyHeal') {
        const heal = Math.max(0, Number(args[0] || 0));
        globals.PartyHP = Math.min(globals.PartyMaxHP, globals.PartyHP + heal);
        hero.hp = globals.PartyHP;
        globals.PartyHPByIndex[0] = hero.hp;
      }
      return undefined;
    },
  };
  return ctx;
}

function selectForcedSkill(mod, ctx, skillId) {
  const opened = mod.ForceAstralFlowSkillDraught(ctx, 100, skillId);
  assert.equal(opened.ok, true);
  assert.equal(opened.candidates[0].id, skillId);
  const selected = mod.SelectSkillDraughtCard(ctx, 0);
  assert.equal(selected.ok, true);
  assert.equal(selected.skill.id, skillId);
  return selected;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function domDebug(mod) {
  return JSON.parse(mod.__context.document.documentElement.getAttribute('data-skill-draw-debug'));
}

test('skill draw debug counters track allowed calls and flag unexpected selections', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext();

    const emptyDebug = {
      calls: {
        party_crimson_ward: 0,
        party_magic_fruit: 0,
        party_destiny: 0,
      },
      unexpectedCalls: 0,
      unexpectedSkillIds: [],
      lastCallId: '',
      lastCallAllowed: 0,
    };
    assert.deepEqual(plain(mod.__context.__orkaSkillDrawDebug), emptyDebug);
    assert.deepEqual(plain(mod.__context.SkillDrawCalls), emptyDebug.calls);
    assert.equal(mod.__context.SkillDrawUnexpectedCalls, 0);
    assert.deepEqual(domDebug(mod), emptyDebug);
    assert.deepEqual(plain(mod.GetSkillDraughtState(ctx).skillDrawDebug), emptyDebug);
    assert.deepEqual(plain(mod.__context.__orkaSkillDrawDebug), emptyDebug);
    assert.deepEqual(domDebug(mod), emptyDebug);

    selectForcedSkill(mod, ctx, 'party_magic_fruit');
    selectForcedSkill(mod, ctx, 'party_destiny');
    selectForcedSkill(mod, ctx, 'party_crimson_ward');

    const allowedState = plain(mod.GetSkillDraughtState(ctx).skillDrawDebug);
    assert.deepEqual(allowedState.calls, {
      party_crimson_ward: 1,
      party_magic_fruit: 1,
      party_destiny: 1,
    });
    assert.equal(allowedState.unexpectedCalls, 0);
    assert.deepEqual(allowedState.unexpectedSkillIds, []);
    assert.equal(allowedState.lastCallId, 'party_crimson_ward');
    assert.equal(allowedState.lastCallAllowed, 1);
    assert.deepEqual(plain(mod.__context.__orkaSkillDrawDebug), allowedState);
    assert.deepEqual(plain(mod.__context.SkillDrawCalls), allowedState.calls);
    assert.equal(mod.__context.SkillDrawUnexpectedCalls, 0);
    assert.deepEqual(domDebug(mod), allowedState);
    assert.deepEqual(plain(ctx.state.globals.SkillDrawCalls), allowedState.calls);
    assert.equal(ctx.state.globals.SkillDrawUnexpectedCalls, 0);

    const unexpectedCtx = makeContext();
    selectForcedSkill(mod, unexpectedCtx, 'party_faze');
    const unexpectedState = plain(mod.GetSkillDraughtState(unexpectedCtx).skillDrawDebug);

    assert.deepEqual(unexpectedState.calls, {
      party_crimson_ward: 0,
      party_magic_fruit: 0,
      party_destiny: 0,
    });
    assert.equal(unexpectedState.unexpectedCalls, 1);
    assert.deepEqual(unexpectedState.unexpectedSkillIds, ['party_faze']);
    assert.equal(unexpectedState.lastCallId, 'party_faze');
    assert.equal(unexpectedState.lastCallAllowed, 0);
    assert.deepEqual(plain(mod.__context.__orkaSkillDrawDebug), unexpectedState);
    assert.deepEqual(domDebug(mod), unexpectedState);
    assert.equal(mod.__context.document.documentElement.getAttribute('data-skill-draw-unexpected-calls'), '1');
    assert.equal(unexpectedCtx.state.globals.SkillDrawUnexpectedCalls, 1);
    assert.deepEqual(plain(unexpectedCtx.state.globals.SkillDrawUnexpectedSkillIds), ['party_faze']);
  }
});
