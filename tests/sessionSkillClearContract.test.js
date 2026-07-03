const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');

function loadModule(modulePath) {
  const raw = fs.readFileSync(modulePath, 'utf8');
  const transformed = raw
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '');
  const names = Array.from(transformed.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g), match => match[1]);
  const context = {
    console,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    JSON,
    Date,
    structuredClone: (value) => JSON.parse(JSON.stringify(value)),
    document: { documentElement: { setAttribute() {}, getAttribute() { return null; } } },
    globalThis: {},
    module: { exports: {} },
    exports: {},
  };
  vm.runInNewContext(`${transformed}\nmodule.exports = { ${[...new Set(names)].join(', ')} };`, context, { filename: modulePath });
  return context.module.exports;
}

function makeContext() {
  const hero = { uid: 100, kind: 'hero', name: 'Falie', heroIndex: 0, hp: 50, maxHP: 50, attackType: 'melee', ATK: 18, DEF: 5, MAG: 4 };
  const enemies = [
    { uid: 201, name: 'Djinn', kind: 'enemy', hp: 80, maxHP: 80, slotIndex: 0, x: 240, y: 90 },
    { uid: 202, name: 'Marid', kind: 'enemy', hp: 80, maxHP: 80, slotIndex: 1, x: 240, y: 140 },
    { uid: 203, name: 'Ifrit', kind: 'enemy', hp: 80, maxHP: 80, slotIndex: 2, x: 240, y: 190 },
  ];
  return {
    state: {
      globals: {
        time: 5,
        PartyHP: 200,
        PartyMaxHP: 200,
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
        PendingHeroHits: [],
      },
      entities: [hero, ...enemies],
    },
    callFunction() {
      return undefined;
    },
  };
}

function forceSelect(mod, ctx, skillId) {
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

test('Clear Skills fully unloads staged session skills and visible skill effects in both mirrors', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext();

    forceSelect(mod, ctx, 'party_chain_strike_i');
    forceSelect(mod, ctx, 'party_chain_strike_ii');
    forceSelect(mod, ctx, 'party_crimson_ward');
    forceSelect(mod, ctx, 'party_faze');

    mod.HeroAttackSingle(ctx, 100, 201);
    assert.equal(mod.IsPartySessionSkillActive(ctx, 'party_chain_strike_ii'), true);
    assert.equal(ctx.state.globals.SessionSkillsByHeroUID.__party_shared__.length, 4);
    assert.equal(ctx.state.globals.PartyTempHPShield, 36);
    assert.ok(Object.keys(ctx.state.globals.PartyWardBarrierVisualsByUID).length > 0);
    assert.ok(ctx.state.globals.TaintedGroundZones.length > 0);
    assert.ok(ctx.state.globals.PendingHeroHits.some(hit => hit.generatedBySkillId === 'party_chain_strike_ii'));
    assert.ok(ctx.state.globals.PendingHeroHits.some(hit => hit.actionName === 'Faze'));
    assert.equal(ctx.state.globals.PartyChainStrikeIIProcs, 1);
    assert.equal(ctx.state.globals.LastPartyChainStrike.skillId, 'party_chain_strike_ii');
    ctx.state.globals.EnemyDamageOverTime = [
      {
        targetUID: 201,
        sourceUID: 100,
        remainingFires: 2,
        totalDamageRemaining: 2,
        cadence: 'turn',
        effectName: 'Blight',
        taintedGroundZoneId: ctx.state.globals.TaintedGroundZones[0].id,
      },
      {
        targetUID: 203,
        sourceUID: 999,
        remainingFires: 2,
        totalDamageRemaining: 2,
        cadence: 'turn',
        effectName: 'RiftBurn',
        taintedGroundZoneId: 'external-zone',
      },
    ];
    ctx.state.globals.LastEnemyDotApplicationPacket = { effectName: 'Blight' };
    ctx.state.globals.LastPartyDestinyDevTrigger = { sourceUID: 100 };

    const cleared = mod.ClearSessionSkillDraught(ctx);
    assert.equal(cleared.ok, true);
    assert.deepEqual(plain(ctx.state.globals.SessionSkillsByHeroUID), {});
    assert.equal(mod.IsPartySessionSkillActive(ctx, 'party_chain_strike_i'), false);
    assert.equal(mod.IsPartySessionSkillActive(ctx, 'party_chain_strike_ii'), false);
    assert.equal(mod.IsPartySessionSkillActive(ctx, 'party_crimson_ward'), false);
    assert.equal(mod.IsPartySessionSkillActive(ctx, 'party_faze'), false);
    assert.deepEqual(plain(ctx.state.globals.SkillDraughtOneOffExposureBySkillId), {});
    assert.equal(ctx.state.globals.PartyTempHPShield, 0);
    assert.equal(ctx.state.globals.PartyTempHPShieldStacks, 0);
    assert.equal(ctx.state.globals.PartyTempHPShieldRatio, 0);
    assert.equal(ctx.state.globals.PartyTempHPShieldMax, 0);
    assert.equal(ctx.state.globals.LastCrimsonWard, null);
    assert.equal(ctx.state.globals.PartyWardBarrierVisualsByUID, undefined);
    assert.deepEqual(plain(ctx.state.globals.TaintedGroundZones), []);
    assert.deepEqual(plain(ctx.state.globals.EnemyDamageOverTime), [{
      targetUID: 203,
      sourceUID: 999,
      remainingFires: 2,
      totalDamageRemaining: 2,
      cadence: 'turn',
      effectName: 'RiftBurn',
      taintedGroundZoneId: 'external-zone',
    }]);
    assert.equal(ctx.state.globals.LastEnemyDotApplicationPacket, null);
    assert.equal(ctx.state.globals.LastPartyDestinyDevTrigger, null);
    assert.equal(ctx.state.globals.PartyChainStrikeIProcs, 0);
    assert.equal(ctx.state.globals.PartyChainStrikeIIProcs, 0);
    assert.equal(ctx.state.globals.LastPartyChainStrike, null);
    assert.deepEqual(plain(ctx.state.globals.ChainStrikeVisuals), []);
    assert.equal(ctx.state.globals.PendingHeroHits.some(hit => hit.generatedBySkillId === 'party_chain_strike_ii'), false);
    assert.equal(ctx.state.globals.PendingHeroHits.some(hit => hit.actionName === 'Faze'), false);

    const openedAgain = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_chain_strike_i');
    assert.equal(openedAgain.ok, true);
    assert.equal(openedAgain.candidates[0].id, 'party_chain_strike_i');
    assert.equal(openedAgain.forcedSkillSuppressedReason, '');
  }
});
