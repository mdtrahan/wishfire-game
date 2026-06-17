const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');
const retiredDocPath = path.join(repoRoot, 'governance', 'product', 'retired-skills', 'drain.md');

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
    heroIndex: 3,
    hp: 50,
    maxHP: 50,
    stats: { ATK: 4, DEF: 0, MAG: 40, RES: 0, SPD: 10 },
  };
  return {
    state: {
      globals: {
        time: 5,
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
        RuntimeRandom: () => 0.99,
      },
      entities: [hero],
    },
    callFunction() {
      return undefined;
    },
  };
}

test('Drain is retired from active skill draught draw surfaces', () => {
  const retiredDoc = fs.readFileSync(retiredDocPath, 'utf8');
  assert.match(retiredDoc, /Status: retired/);
  assert.match(retiredDoc, /Drain must not appear in normal skill draughts, forced skill draughts, or active\s+skill draw debug counters\./);

  for (const modulePath of [runtimePath, scriptsPath]) {
    const src = fs.readFileSync(modulePath, 'utf8');
    const allowedListStart = src.indexOf('const PARTY_SKILL_DRAW_ALLOWED_IDS');
    const allowedListEnd = src.indexOf(']);', allowedListStart);
    assert.notEqual(allowedListStart, -1);
    const allowedListSrc = src.slice(allowedListStart, allowedListEnd);
    assert.doesNotMatch(allowedListSrc, /party_drain/);
    assert.doesNotMatch(src, /sessionSkill\.id === 'party_drain'\)\s+activateDrainSkill/);

    const mod = loadModule(modulePath);
    const partyIds = Array.from(mod.GetPartySkillDefinitions(), skill => skill.id);
    assert.equal(partyIds.includes('party_drain'), false, 'retired definition must not stay in the public party registry');

    const ctx = makeContext();
    const forced = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_drain');
    assert.equal(forced.ok, true);
    assert.equal(forced.candidates.some(candidate => candidate.id === 'party_drain'), false);
    assert.equal(mod.GetSkillDraughtState(ctx).skillDrawDebug.calls.party_drain, undefined);
    assert.equal(ctx.state.globals.DrainFieldZones, undefined);
  }
});

test('injected Drain candidates do not activate retired Drain runtime behavior', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext();
    ctx.state.globals.SkillDraughtOpen = 1;
    ctx.state.globals.SkillDraughtHeroUID = 100;
    ctx.state.globals.SkillDraughtCandidates = [{
      index: 0,
      id: 'party_drain',
      key: 'party_drain',
      title: 'Drain',
      owner: 'Party',
      drawClass: 'repeatable',
    }];

    const selected = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(selected.ok, true);
    assert.equal(selected.skill.id, 'party_drain');
    assert.equal(ctx.state.globals.DrainFieldZones, undefined);
    assert.doesNotMatch(ctx.state.globals.CombatLog.join('\n'), /Party uses Drain/);
  }
});
