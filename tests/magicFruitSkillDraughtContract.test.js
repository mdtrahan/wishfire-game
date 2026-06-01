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
  const expectedExistingPartyIds = [
    'party_fresh_start',
    'party_second_chance',
    'party_momentum',
    'party_guard_rail',
    'party_blue_spark',
    'party_weaken',
    'party_destiny',
    'party_hot_streak',
    'party_last_push',
    'party_chain_pop',
  ];

  for (const filePath of [runtimePath, scriptsPath]) {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.match(src, /id: 'party_magic_fruit'[\s\S]*title: 'Magic Fruit'/);
    assert.match(src, /cardText: 'Heals party for 40% of max HP'/);
    assert.match(src, /payloadImplemented: true/);
  }

  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const partyIds = Array.from(mod.GetPartySkillDefinitions(), skill => skill.id);
    assert.deepEqual(partyIds.slice(0, expectedExistingPartyIds.length), expectedExistingPartyIds);
    assert.equal(partyIds[expectedExistingPartyIds.length], 'party_magic_fruit');

    const { ctx: defaultCtx } = makeContext();
    installSequenceRandom(defaultCtx, [0.75, 0, 0]);
    const defaultOpened = mod.ForceAstralFlowSkillDraught(defaultCtx, 100);
    assert.equal(defaultOpened.ok, true);
    const defaultMagicFruit = defaultOpened.candidates.find(candidate => candidate.id === 'party_magic_fruit');
    assert.ok(defaultMagicFruit, 'Magic Fruit should appear in the normal skill draw candidates');
    assert.equal(defaultMagicFruit.title, 'Magic Fruit');
    assert.equal(defaultMagicFruit.cardText, 'Heals party for 40% of max HP');
    assert.equal(defaultMagicFruit.description, 'Heals party for 40% of max HP');

    const { ctx, calls } = makeContext();
    const opened = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_magic_fruit');
    assert.equal(opened.ok, true);
    assert.equal(opened.candidates[0].id, 'party_magic_fruit');
    assert.equal(opened.candidates[0].title, 'Magic Fruit');
    assert.equal(opened.candidates[0].cardText, 'Heals party for 40% of max HP');
    assert.equal(opened.candidates[0].description, 'Heals party for 40% of max HP');

    const selected = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(selected.ok, true);
    assert.equal(selected.skill.id, 'party_magic_fruit');
    assert.equal(ctx.state.globals.SessionSkillsByHeroUID.__party_shared__[0].id, 'party_magic_fruit');
    assert.equal(ctx.state.globals.PartyHP, 51);
    assert.equal(ctx.state.entities[0].hp, 51);
    assert.deepEqual(
      calls.filter(call => call.name === 'ApplyPartyHeal').map(call => call.args),
      [[41]]
    );

    const stateAfterSelect = mod.GetSkillDraughtState(ctx);
    assert.equal(stateAfterSelect.open, 0);
    assert.equal(stateAfterSelect.candidates.length, 0);
    assert.match(ctx.state.globals.CombatLog.join('\n'), /Magic Fruit activated\./);

    const selectedAgain = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(selectedAgain.ok, false);
    assert.equal(selectedAgain.reason, 'draught_closed');
    assert.equal(calls.filter(call => call.name === 'ApplyPartyHeal').length, 1);
    assert.equal(ctx.state.globals.PartyHP, 51);
  }
});

test('normal party skill draught samples the full party pool through RuntimeRandom', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const { ctx } = makeContext();
    const draws = installSequenceRandom(ctx, [0.9, 0, 0]);

    const opened = mod.ForceAstralFlowSkillDraught(ctx, 100);

    assert.equal(opened.ok, true);
    assert.ok(draws.length >= 1, 'normal skill draw should consume RuntimeRandom');
    assert.equal(opened.candidates.length, 3);
    assert.equal(new Set(opened.candidates.map(candidate => candidate.id)).size, 3);
    assert.equal(opened.candidates[0].id, 'party_crimson_ward');
    assert.ok(
      opened.candidates.some(candidate => candidate.id === 'party_crimson_ward'),
      'Crimson Ward should be reachable from the normal random draw'
    );
  }
});

test('normal party skill draught excludes Weaken from random and forced card draws', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const { ctx } = makeContext();
    installSequenceRandom(ctx, [0.4, 0, 0]);

    const opened = mod.ForceAstralFlowSkillDraught(ctx, 100);

    assert.equal(opened.ok, true);
    assert.equal(opened.candidates.length, 3);
    assert.equal(
      opened.candidates.some(candidate => candidate.id === 'party_weaken'),
      false,
      'Weaken should not be reachable through normal party skill draw',
    );

    const { ctx: forcedCtx } = makeContext();
    installSequenceRandom(forcedCtx, [0, 0, 0]);

    const forcedOpened = mod.ForceAstralFlowSkillDraught(forcedCtx, 100, 'party_weaken');

    assert.equal(forcedOpened.ok, true);
    assert.equal(forcedOpened.candidates.length, 3);
    assert.equal(
      forcedOpened.candidates.some(candidate => candidate.id === 'party_weaken'),
      false,
      'Weaken should not be reachable through forced party skill draw',
    );
  }
});
