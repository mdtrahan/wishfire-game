const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');
const assetLoaderPath = path.join(repoRoot, 'web-runner', 'systems', 'runtimeVisualAssetLoader.js');
const renderRuntimePath = path.join(repoRoot, 'web-runner', 'systems', 'renderRuntime.js');
const chainAssetPath = path.join(repoRoot, 'web-runner', 'assets', 'images', 'skill_chain_strike_arc_160x48.png');

function loadModule(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ExecuteSkill,
  ForceAstralFlowSkillDraught,
  GetPartySkillDefinitions,
  GetSkillDefinition,
  GetSkillDraughtState,
  HeroAttackSingle,
  IsPartySessionSkillActive,
  SelectSkillDraughtCard,
};`;
  const context = {
    console: { log() {}, warn() {}, error() {} },
    Math,
    Number,
    String,
    Array,
    Object,
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function makeContext({ active = false, onlyOneEnemy = false, pending = false } = {}) {
  const hero = {
    uid: 100,
    kind: 'hero',
    name: 'Falie',
    baseHeroName: 'Falie',
    heroIndex: 0,
    attackType: 'melee',
    hp: 100,
    maxHP: 100,
    stats: { ATK: 10, DEF: 0, MAG: 3, RES: 0, SPD: 1 },
  };
  const firstEnemy = {
    uid: 201,
    kind: 'enemy',
    name: 'Ashling',
    slotIndex: 0,
    hp: 80,
    maxHP: 80,
    stats: { ATK: 4, DEF: 0, MAG: 2, RES: 0, SPD: 1 },
  };
  const secondEnemy = {
    uid: 202,
    kind: 'enemy',
    name: 'Cinder Imp',
    slotIndex: 1,
    hp: onlyOneEnemy ? 0 : 80,
    maxHP: 80,
    stats: { ATK: 4, DEF: 0, MAG: 2, RES: 0, SPD: 1 },
  };
  const globals = {
    time: 1,
    RuntimeRandom: () => 0.5,
    CombatLog: [],
    CombatActionLines: ['', '', '', ''],
    CurrentTurnIndex: 0,
    TurnOrderArray: [{ uid: 100, type: 0, spd: 1 }, { uid: 201, type: 1, spd: 1 }, { uid: 202, type: 1, spd: 1 }],
    PendingActor: pending ? hero.uid : 0,
    PendingSkillID: pending ? 'HERO_SINGLE' : '',
    SelectedEnemyUID: firstEnemy.uid,
    SkillDraughtOpen: 0,
    SkillDraughtHeroUID: 0,
    SkillDraughtCandidates: [],
    SkillDraughtHitZones: [],
    SkillDraughtSelectedSkillId: '',
    SessionSkillsByHeroUID: active ? {
      __party_shared__: [{ id: 'party_chain_strike_i', title: 'Chain Strike I', owner: 'Party' }],
    } : {},
    SkillDraughtTrace: [],
    SkillDraughtTraceSeq: 0,
    AstralFlowAmpPoints: 18,
    AstralFlowAmpMax: 18,
    AstralFlowAmpReady: 1,
    PowerAmpByUID: {},
  };
  return {
    state: { globals, entities: [hero, firstEnemy, secondEnemy] },
    callFunction(name) {
      if (name === 'UpdateAstralFlowAmpBar') return undefined;
      return undefined;
    },
  };
}

test('Chain Strike I is a one-off active party draw in both function bank mirrors', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const def = mod.GetSkillDefinition(null, 'party_chain_strike_i');

    assert.equal(def.id, 'party_chain_strike_i');
    assert.equal(def.title, 'Chain Strike I');
    assert.equal(def.owner, 'Party');
    assert.equal(def.payloadImplemented, true);
    assert.equal(def.drawClass, 'one_off');
    assert.equal(def.selection.sessionBucket, '__party_shared__');
    assert.equal(def.selection.duplicatePolicy, 'reject_after_selected');
    assert.equal(def.trigger.event, 'hero_attack_single');
    assert.equal(def.effect.kind, 'chain_bounce');
    assert.equal(def.effect.bounceDamagePct, 33);
    assert.equal(def.effect.maxBounces, 1);
    assert.equal(def.effect.targeting, 'next_living_enemy_sequence');
    assert.equal(typeof def.qa.proof, 'string');

    const partyIds = mod.GetPartySkillDefinitions().map(skill => skill.id);
    assert.ok(partyIds.includes('party_chain_strike_i'));

    const ctx = makeContext();
    const opened = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_chain_strike_i');
    assert.equal(opened.ok, true);
    assert.equal(opened.candidates[0].id, 'party_chain_strike_i');
    assert.equal(opened.candidates[0].description, 'Hero attacks bounce once for 33% damage.');

    const selected = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(selected.ok, true);
    assert.equal(selected.skill.id, 'party_chain_strike_i');
    assert.equal(mod.IsPartySessionSkillActive(ctx, 'party_chain_strike_i'), true);

    const blocked = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_chain_strike_i');
    assert.equal(blocked.ok, true);
    assert.equal(blocked.candidates.some(candidate => candidate.id === 'party_chain_strike_i'), false);
  }
});

test('Chain Strike I queues one bounce to the next living enemy without changing the selected target', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext({ active: true });

    mod.HeroAttackSingle(ctx, 100, 201);

    const hits = ctx.state.globals.PendingHeroHits;
    assert.equal(hits.length, 2);
    assert.equal(hits[0].targetUID, 201);
    assert.equal(hits[1].targetUID, 202);
    assert.equal(ctx.state.globals.SelectedEnemyUID, 201);
    assert.equal(hits[1].finalDmg, Math.max(1, Math.ceil(hits[0].finalDmg * 0.33)));
    assert.equal(hits[1].dmg, hits[1].finalDmg);
    assert.equal(hits[1].effectType, 'chain_bounce');
    assert.equal(hits[1].actionName, 'Chain Strike I');
    assert.equal(hits[1].generatedBySkillId, 'party_chain_strike_i');
    assert.equal(hits[1].chainStrikeDamagePct, 33);
    assert.equal(hits[1].chainStrikeSourceTargetUID, 201);
    assert.equal(hits[1].chainStrikeVisual, 'chain_arc_ribbon');
    assert.equal(hits[1].chainStrikeVisualAsset, 'SkillChainStrikeArc');
    assert.equal(hits[1].retargetOnDeath || 0, 0);
    assert.ok(Array.isArray(ctx.state.globals.ChainStrikeVisuals));
    assert.equal(ctx.state.globals.ChainStrikeVisuals.length, 1);
    assert.equal(ctx.state.globals.ChainStrikeVisuals[0].sourceTargetUID, 201);
    assert.equal(ctx.state.globals.ChainStrikeVisuals[0].targetUID, 202);
  }
});

test('Chain Strike I falls back to the same enemy when only one enemy is alive', () => {
  const mod = loadModule(runtimePath);
  const ctx = makeContext({ active: true, onlyOneEnemy: true });

  mod.HeroAttackSingle(ctx, 100, 201);

  const hits = ctx.state.globals.PendingHeroHits;
  assert.equal(hits.length, 2);
  assert.equal(JSON.stringify(hits.map(hit => hit.targetUID)), JSON.stringify([201, 201]));
  assert.equal(ctx.state.globals.ChainStrikeVisuals[0].sourceTargetUID, 201);
  assert.equal(ctx.state.globals.ChainStrikeVisuals[0].targetUID, 201);
});

test('pending HERO_SINGLE keeps player intent while Chain Strike I follows its bounce rule', () => {
  const mod = loadModule(runtimePath);
  const ctx = makeContext({ active: true, pending: true });

  mod.ExecuteSkill(ctx, 'HERO_SINGLE', 100);

  const hits = ctx.state.globals.PendingHeroHits;
  assert.equal(hits.length, 2);
  assert.equal(hits[0].targetUID, 201);
  assert.equal(hits[1].targetUID, 202);
});

test('Chain Strike I asset and renderer wiring are production asset based', () => {
  const assetLoader = fs.readFileSync(assetLoaderPath, 'utf8');
  const renderRuntime = fs.readFileSync(renderRuntimePath, 'utf8');

  assert.ok(fs.existsSync(chainAssetPath), 'chain strike must ship a raster PNG asset');
  assert.match(assetLoader, /SkillChainStrikeArc/);
  assert.match(assetLoader, /skill_chain_strike_arc_160x48\.png/);
  assert.match(renderRuntime, /ChainStrikeVisuals/);
  assert.match(renderRuntime, /SkillChainStrikeArc/);
});
