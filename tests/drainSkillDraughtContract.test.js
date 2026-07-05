const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');
const appPath = path.join(repoRoot, 'web-runner', 'app.js');
const renderRuntimePath = path.join(repoRoot, 'web-runner', 'systems', 'renderRuntime.js');
const retiredDocPath = path.join(repoRoot, 'governance', 'product', 'retired-skills', 'drain.md');
const retiredSkillId = ['party', 'drain'].join('_');

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
  assert.match(retiredDoc, /Historical note:/);
  assert.match(retiredDoc, /Current normal combat uses effective Speed interleaving\./);
  assert.match(retiredDoc, /Drain must not appear in normal skill draughts, forced skill draughts, or active\s+skill draw debug counters\./);

  for (const modulePath of [runtimePath, scriptsPath]) {
    const src = fs.readFileSync(modulePath, 'utf8');
    const allowedListStart = src.indexOf('const PARTY_SKILL_DRAW_ALLOWED_IDS');
    const allowedListEnd = src.indexOf(']);', allowedListStart);
    assert.notEqual(allowedListStart, -1);
    const allowedListSrc = src.slice(allowedListStart, allowedListEnd);
    assert.equal(allowedListSrc.includes(retiredSkillId), false);
    assert.doesNotMatch(src, /sessionSkill\.id === 'party_drain'\)\s+activateDrainSkill/);

    const mod = loadModule(modulePath);
    const partyIds = Array.from(mod.GetPartySkillDefinitions(), skill => skill.id);
    assert.equal(partyIds.includes(retiredSkillId), false, 'retired definition must not stay in the public party registry');

    const ctx = makeContext();
    const forced = mod.ForceAstralFlowSkillDraught(ctx, 100, retiredSkillId);
    assert.equal(forced.ok, true);
    assert.equal(forced.candidates.some(candidate => candidate.id === retiredSkillId), false);
    assert.equal(mod.GetSkillDraughtState(ctx).skillDrawDebug.calls[retiredSkillId], undefined);
  }
});

test('retired party Drain implementation residue is absent from active runtime files', () => {
  const forbiddenRuntimePatterns = [
    /\bactivateDrainSkill\b/,
    /\bSyncDrainFieldZones\b/,
    /\bDrainFieldZones\b/,
    /\bdrainSlowPct\b/,
    /\bdrain_lines\b/,
    /\bParty uses Drain\b/,
  ];
  for (const modulePath of [runtimePath, scriptsPath]) {
    const src = fs.readFileSync(modulePath, 'utf8');
    for (const pattern of forbiddenRuntimePatterns) assert.doesNotMatch(src, pattern);
  }

  const appSrc = fs.readFileSync(appPath, 'utf8');
  assert.doesNotMatch(appSrc, /\bgetPersistentDrainFieldOverlays\b/);
  assert.doesNotMatch(appSrc, /\bhasPersistentEnemyDrainOverlay\b/);
  assert.doesNotMatch(appSrc, /\bSyncDrainFieldZones\b/);

  const renderRuntimeSrc = fs.readFileSync(renderRuntimePath, 'utf8');
  assert.doesNotMatch(renderRuntimeSrc, /\brenderEnemyDrainLines\b/);
  assert.doesNotMatch(renderRuntimeSrc, /\bdrainFieldOverlays\b/);
  assert.doesNotMatch(renderRuntimeSrc, /\benemyIsDrained\b/);
});
