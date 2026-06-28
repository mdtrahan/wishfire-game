const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');
const magicFruitText = 'Heals party for 32% and raises max HP by 15% of current max HP';
const legalPartyDrawIds = [
  'party_destiny',
  'party_magic_fruit',
  'party_crimson_ward',
  'party_faze',
  'party_grow',
  'party_chain_strike_i',
  'party_chain_strike_ii',
  'party_arcane_pulse',
  'party_split',
];
const ungatedNormalDrawIds = legalPartyDrawIds.filter(id => id !== 'party_chain_strike_ii');

function loadModule(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ForceAstralFlowSkillDraught,
  GetPartySkillDefinitions,
  GetSkillDraughtState,
  SelectSkillDraughtCard,
};`;
  const context = {
    console,
    Math,
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
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
  const calls = [];
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
      calls.push({ name, args });
      if (name === 'ApplyPartyHeal') {
        const heal = Math.max(0, Number(args[0] || 0));
        globals.PartyHP = Math.min(globals.PartyMaxHP, globals.PartyHP + heal);
        hero.hp = globals.PartyHP;
        globals.PartyHPByIndex[0] = hero.hp;
      }
      if (name === 'UpdateHeroHPUI' || name === 'UpdatePartyHPText' || name === 'UpdatePartyHPBar') {
        return undefined;
      }
      return undefined;
    },
  };
  return { ctx, calls };
}

function installSequenceRandom(ctx, values) {
  let index = 0;
  const draws = [];
  ctx.state.globals.RuntimeRandom = () => {
    const value = Number(values[Math.min(index, values.length - 1)] ?? 0);
    index += 1;
    draws.push(value);
    return value;
  };
  return draws;
}

test('Magic Fruit is a mirrored party draw option that heals once through ApplyPartyHeal', () => {
  for (const filePath of [runtimePath, scriptsPath]) {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.match(src, /id: 'party_magic_fruit'[\s\S]*title: 'Magic Fruit'/);
    assert.match(src, /cardText: 'Heals party for 32% and raises max HP by 15% of current max HP'/);
    assert.match(src, /effect: \{ kind: 'party_heal_max_hp', healPctPartyMax: 32, maxHpPctPartyMax: 15 \}/);
    assert.match(src, /payloadImplemented: true/);
  }

  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const partyIds = Array.from(mod.GetPartySkillDefinitions(), skill => skill.id);
    assert.deepEqual(partyIds, legalPartyDrawIds);

    const { ctx: defaultCtx } = makeContext();
    installSequenceRandom(defaultCtx, [0.4, 0, 0]);
    const defaultOpened = mod.ForceAstralFlowSkillDraught(defaultCtx, 100);
    assert.equal(defaultOpened.ok, true);
    const defaultMagicFruit = defaultOpened.candidates.find(candidate => candidate.id === 'party_magic_fruit');
    assert.ok(defaultMagicFruit, 'Magic Fruit should appear in the normal skill draw candidates');
    assert.equal(defaultMagicFruit.title, 'Magic Fruit');
    assert.equal(defaultMagicFruit.cardText, magicFruitText);
    assert.equal(defaultMagicFruit.description, magicFruitText);

    const { ctx, calls } = makeContext();
    const opened = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_magic_fruit');
    assert.equal(opened.ok, true);
    assert.equal(opened.candidates[0].id, 'party_magic_fruit');
    assert.equal(opened.candidates[0].title, 'Magic Fruit');
    assert.equal(opened.candidates[0].cardText, magicFruitText);
    assert.equal(opened.candidates[0].description, magicFruitText);

    const selected = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(selected.ok, true);
    assert.equal(selected.skill.id, 'party_magic_fruit');
    assert.equal(selected.skill.drawClass, 'repeatable');
    assert.equal(selected.skill.duplicatePolicy, 'allow_repeat');
    assert.equal(selected.skill.selectionCount, 1);
    assert.equal(ctx.state.globals.SessionSkillsByHeroUID.__party_shared__[0].id, 'party_magic_fruit');
    assert.equal(ctx.state.globals.PartyHP, 42);
    assert.equal(ctx.state.globals.PartyMaxHP, 116);
    assert.equal(ctx.state.entities[0].hp, 42);
    assert.equal(ctx.state.entities[0].maxHP, 116);
    assert.deepEqual(ctx.state.globals.PartyHPByIndex, [42]);
    assert.deepEqual(ctx.state.globals.PartyMaxHPByIndex, [116]);
    assert.deepEqual(
      calls.filter(call => call.name === 'ApplyPartyHeal').map(call => call.args),
      [[32]]
    );

    const stateAfterSelect = mod.GetSkillDraughtState(ctx);
    assert.equal(stateAfterSelect.open, 0);
    assert.equal(stateAfterSelect.candidates.length, 0);
    assert.match(ctx.state.globals.CombatLog.join('\n'), /Magic Fruit activated\./);

    const selectedAgain = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(selectedAgain.ok, false);
    assert.equal(selectedAgain.reason, 'draught_closed');
    assert.equal(calls.filter(call => call.name === 'ApplyPartyHeal').length, 1);
    assert.equal(ctx.state.globals.PartyHP, 42);
    assert.equal(ctx.state.globals.PartyMaxHP, 116);

    const openedRepeat = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_magic_fruit');
    assert.equal(openedRepeat.ok, true);
    assert.equal(openedRepeat.candidates[0].id, 'party_magic_fruit');
    const selectedRepeat = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(selectedRepeat.ok, true);
    assert.equal(selectedRepeat.skill.id, 'party_magic_fruit');
    assert.equal(selectedRepeat.skill.drawClass, 'repeatable');
    assert.equal(selectedRepeat.skill.selectionCount, 2);
    assert.equal(ctx.state.globals.SessionSkillsByHeroUID.__party_shared__.length, 2);
    assert.equal(ctx.state.globals.SessionSkillsByHeroUID.__party_shared__[1].rank, 0);
    assert.equal(calls.filter(call => call.name === 'ApplyPartyHeal').length, 2);
    assert.equal(ctx.state.globals.PartyHP, 79);
    assert.equal(ctx.state.globals.PartyMaxHP, 133);
    assert.equal(ctx.state.entities[0].hp, 79);
    assert.equal(ctx.state.entities[0].maxHP, 133);
    assert.deepEqual(ctx.state.globals.PartyHPByIndex, [79]);
    assert.deepEqual(ctx.state.globals.PartyMaxHPByIndex, [133]);
    assert.deepEqual(
      calls.filter(call => call.name === 'ApplyPartyHeal').map(call => call.args),
      [[32], [37]]
    );
  }
});

test('normal party skill draught samples the full party pool through RuntimeRandom', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const { ctx } = makeContext();
    const draws = installSequenceRandom(ctx, [0.99, 0.5, 0]);

    const opened = mod.ForceAstralFlowSkillDraught(ctx, 100);

    assert.equal(opened.ok, true);
    assert.ok(draws.length >= 1, 'normal skill draw should consume RuntimeRandom');
    assert.equal(opened.candidates.length, 3);
    assert.equal(new Set(opened.candidates.map(candidate => candidate.id)).size, 3);
    assert.equal(opened.candidates[0].id, 'party_split');
    assert.ok(
      opened.candidates.some(candidate => candidate.id === 'party_faze'),
      'Faze should be reachable from the normal random draw'
    );
  }
});

test('normal party skill draught excludes removed stubs and uses only the active party draw allowlist', () => {
  const removedStubIds = [
    'party_fresh_start',
    'party_second_chance',
    'party_momentum',
    'party_guard_rail',
    'party_blue_spark',
    'party_weaken',
    'party_hot_streak',
    'party_last_push',
    'party_chain_pop',
  ];

  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const legalIdSet = new Set(legalPartyDrawIds);
    const partyIds = mod.GetPartySkillDefinitions().map(def => def.id);

    for (const removedId of removedStubIds) {
      assert.equal(partyIds.includes(removedId), false, `${removedId} should be removed from the party registry`);
    }

    const observedLegalIds = new Set();
    for (const randomValues of [[0, 0, 0], [0.25, 0, 0], [0.35, 0, 0], [0.45, 0, 0], [0.5, 0, 0], [0.65, 0, 0], [0.8, 0, 0], [0.95, 0, 0]]) {
      const { ctx } = makeContext();
      installSequenceRandom(ctx, randomValues);

      const opened = mod.ForceAstralFlowSkillDraught(ctx, 100);

      assert.equal(opened.ok, true);
      assert.equal(opened.candidates.length, 3);
      for (const candidate of opened.candidates) {
        assert.ok(legalIdSet.has(candidate.id), `${candidate.id} must be in the active party draw allowlist`);
        observedLegalIds.add(candidate.id);
      }
    }

    assert.deepEqual(
      Array.from(observedLegalIds).sort(),
      ungatedNormalDrawIds.slice().sort(),
      'deterministic random samples should prove every ungated party draw id is reachable',
    );

    for (const id of removedStubIds) {
      const { ctx: forcedCtx } = makeContext();
      installSequenceRandom(forcedCtx, [0, 0, 0]);

      const forcedOpened = mod.ForceAstralFlowSkillDraught(forcedCtx, 100, id);

      assert.equal(forcedOpened.ok, true);
      assert.equal(forcedOpened.candidates.length, 3);
      assert.equal(forcedOpened.candidates.some(candidate => candidate.id === id), false);
      for (const candidate of forcedOpened.candidates) {
        assert.ok(legalIdSet.has(candidate.id), `${candidate.id} must be in the active party draw allowlist`);
      }
    }
  }
});
