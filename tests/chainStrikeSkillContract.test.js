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

function makeContext({
  active = false,
  activeSkillIds = null,
  enemyHpByUid = {},
  onlyOneEnemy = false,
  pending = false,
} = {}) {
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
    hp: Number.isFinite(Number(enemyHpByUid[201])) ? Number(enemyHpByUid[201]) : 80,
    maxHP: 80,
    stats: { ATK: 4, DEF: 0, MAG: 2, RES: 0, SPD: 1 },
  };
  const secondEnemy = {
    uid: 202,
    kind: 'enemy',
    name: 'Cinder Imp',
    slotIndex: 1,
    hp: onlyOneEnemy ? 0 : (Number.isFinite(Number(enemyHpByUid[202])) ? Number(enemyHpByUid[202]) : 80),
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
    SessionSkillsByHeroUID: active || Array.isArray(activeSkillIds) ? {
      __party_shared__: (Array.isArray(activeSkillIds) && activeSkillIds.length > 0
        ? activeSkillIds
        : ['party_chain_strike_i']
      ).map(id => ({ id, title: id, owner: 'Party' })),
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

test('Split is a one-off party draw skill in both function bank mirrors', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const def = mod.GetSkillDefinition(null, 'party_split');

    assert.equal(def.id, 'party_split');
    assert.equal(def.title, 'Split');
    assert.equal(def.owner, 'Party');
    assert.equal(def.payloadImplemented, true);
    assert.equal(def.drawClass, 'one_off');
    assert.equal(def.growth.length, 0);
    assert.equal(def.selection.sessionBucket, '__party_shared__');
    assert.equal(def.selection.duplicatePolicy, 'reject_after_selected');
    assert.equal(def.trigger.event, 'hero_attack_red');
    assert.equal(def.effect.kind, 'split_red_aoe');
    assert.equal(def.effect.damageMath, 'red_attack_total_divided_by_living_enemies');
    assert.equal(def.effect.chainStrikeSource, 'living_enemy_from_saved_red_target_anchor');
    assert.equal(typeof def.qa.proof, 'string');

    const partyIds = mod.GetPartySkillDefinitions().map(skill => skill.id);
    assert.ok(partyIds.includes('party_split'));

    const ctx = makeContext();
    const opened = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_split');
    assert.equal(opened.ok, true);
    assert.equal(opened.candidates[0].id, 'party_split');

    const selected = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(selected.ok, true);
    assert.equal(selected.skill.id, 'party_split');
    assert.equal(mod.IsPartySessionSkillActive(ctx, 'party_split'), true);

    const blocked = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_split');
    assert.equal(blocked.ok, true);
    assert.equal(blocked.candidates.some(candidate => candidate.id === 'party_split'), false);
  }
});

test('Split turns a red-lane attack into AOE while preserving the red target anchor', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext({ activeSkillIds: ['party_split'] });
    ctx.state.globals.SelectedEnemyUID = 999;

    mod.HeroAttackSingle(ctx, 100, 201);

    const hits = ctx.state.globals.PendingHeroHits;
    assert.equal(hits.length, 2);
    assert.equal(JSON.stringify(hits.map(hit => hit.targetUID)), JSON.stringify([201, 202]));
    assert.equal(JSON.stringify(hits.map(hit => hit.finalDmg)), JSON.stringify([5, 5]));
    assert.equal(hits.reduce((sum, hit) => sum + Number(hit.finalDmg || 0), 0), 10);
    assert.ok(hits.every(hit => hit.effectType === 'damage'));
    assert.ok(hits.every(hit => hit.actionName === 'Split'));
    assert.ok(hits.every(hit => hit.generatedBySkillId === 'party_split'));
    assert.ok(hits.every(hit => hit.splitRootTargetUID === 201));
    assert.equal(ctx.state.globals.SelectedEnemyUID, 999);
  }
});

test('Split Chain Strike I resolves from living saved red target anchor', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext({ activeSkillIds: ['party_split', 'party_chain_strike_i'] });

    mod.HeroAttackSingle(ctx, 100, 201);

    const hits = ctx.state.globals.PendingHeroHits;
    assert.equal(hits.length, 3);
    assert.equal(JSON.stringify(hits.map(hit => hit.targetUID)), JSON.stringify([201, 202, 202]));
    assert.equal(JSON.stringify(hits.slice(0, 2).map(hit => hit.finalDmg)), JSON.stringify([5, 5]));
    assert.equal(hits[2].effectType, 'chain_bounce');
    assert.equal(hits[2].actionName, 'Chain Strike I');
    assert.equal(hits[2].generatedBySkillId, 'party_chain_strike_i');
    assert.equal(hits[2].chainStrikeSourceTargetUID, 201);
    assert.equal(hits[2].finalDmg, 4);
    assert.equal(ctx.state.globals.PartyChainStrikeIProcs, 1);
    assert.equal(ctx.state.globals.LastPartyChainStrike.sourceTargetUID, 201);
  }
});

test('Split Chain Strike II queues two bounces from the living red target anchor', () => {
  const mod = loadModule(runtimePath);
  const ctx = makeContext({ activeSkillIds: ['party_split', 'party_chain_strike_ii'] });

  mod.HeroAttackSingle(ctx, 100, 201);

  const hits = ctx.state.globals.PendingHeroHits;
  assert.equal(hits.length, 4);
  assert.equal(JSON.stringify(hits.map(hit => hit.targetUID)), JSON.stringify([201, 202, 202, 201]));
  assert.equal(JSON.stringify(hits.slice(0, 2).map(hit => hit.finalDmg)), JSON.stringify([5, 5]));
  assert.equal(hits[2].effectType, 'chain_bounce');
  assert.equal(hits[3].effectType, 'chain_bounce');
  assert.ok(hits.slice(2).every(hit => hit.actionName === 'Chain Strike II'));
  assert.ok(hits.slice(2).every(hit => hit.generatedBySkillId === 'party_chain_strike_ii'));
  assert.ok(hits.slice(2).every(hit => hit.chainStrikeDamagePct === 66));
  assert.equal(hits[2].chainStrikeSourceTargetUID, 201);
  assert.equal(hits[3].chainStrikeSourceTargetUID, 202);
  assert.equal(hits[2].finalDmg, 7);
  assert.equal(hits[3].finalDmg, 7);
  assert.equal(ctx.state.globals.PartyChainStrikeIIProcs, 1);
});

test('Split Chain Strike falls back to the next living enemy when the saved root dies from AOE', () => {
  const mod = loadModule(runtimePath);
  const ctx = makeContext({
    activeSkillIds: ['party_split', 'party_chain_strike_i'],
    enemyHpByUid: { 201: 1, 202: 80 },
  });

  mod.HeroAttackSingle(ctx, 100, 201);

  const hits = ctx.state.globals.PendingHeroHits;
  assert.equal(hits.length, 3);
  assert.equal(JSON.stringify(hits.map(hit => hit.targetUID)), JSON.stringify([201, 202, 202]));
  assert.equal(JSON.stringify(hits.slice(0, 2).map(hit => hit.finalDmg)), JSON.stringify([5, 5]));
  assert.equal(hits[2].effectType, 'chain_bounce');
  assert.equal(hits[2].chainStrikeSourceTargetUID, 202);
  assert.equal(hits[2].finalDmg, 4);
  assert.equal(ctx.state.globals.ChainStrikeVisuals[0].sourceTargetUID, 202);
  assert.equal(ctx.state.globals.ChainStrikeVisuals[0].targetUID, 202);
});

test('Split Chain Strike does not fire when Split AOE leaves no living enemies', () => {
  const mod = loadModule(runtimePath);
  const ctx = makeContext({
    activeSkillIds: ['party_split', 'party_chain_strike_i'],
    enemyHpByUid: { 201: 1, 202: 1 },
  });

  mod.HeroAttackSingle(ctx, 100, 201);

  const hits = ctx.state.globals.PendingHeroHits;
  assert.equal(hits.length, 2);
  assert.equal(JSON.stringify(hits.map(hit => hit.targetUID)), JSON.stringify([201, 202]));
  assert.equal(JSON.stringify(hits.map(hit => hit.finalDmg)), JSON.stringify([5, 5]));
  assert.equal(hits.some(hit => hit.effectType === 'chain_bounce'), false);
  assert.equal(ctx.state.globals.PartyChainStrikeIProcs || 0, 0);
  assert.equal(ctx.state.globals.ChainStrikeVisuals, undefined);
});

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
