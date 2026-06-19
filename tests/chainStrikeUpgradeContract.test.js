const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');
const assetLoaderPath = path.join(repoRoot, 'web-runner', 'systems', 'runtimeVisualAssetLoader.js');
const renderRuntimePath = path.join(repoRoot, 'web-runner', 'systems', 'renderRuntime.js');
const devBrowserHooksPath = path.join(repoRoot, 'web-runner', 'systems', 'devBrowserTestHooks.js');
const chainAssetPath = path.join(repoRoot, 'web-runner', 'assets', 'images', 'skill_chain_strike_arc_160x48.png');

function loadModule(modulePath) {
  const raw = fs.readFileSync(modulePath, 'utf8');
  const transformed = raw
    .replace(/import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];\n/g, '')
    .replace(/export\s+function\s+/g, 'function ')
    .replace(/export\s+\{[^}]*\};\n/g, '');
  const names = Array.from(transformed.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g), match => match[1]);
  const uniqueNames = [...new Set(names)];
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
  const suffix = `\nmodule.exports = { ${uniqueNames.join(', ')} };`;
  vm.runInNewContext(transformed + suffix, context, { filename: modulePath });
  return context.module.exports;
}

function makeContext({ activeI = false, activeII = false, onlyOneEnemy = false, pending = false } = {}) {
  const hero = { uid: 100, name: 'Falie', kind: 'hero', hp: 50, maxHP: 50, attackType: 'melee', ATK: 18, DEF: 5, MAG: 4 };
  const firstEnemy = { uid: 201, name: 'Gobloc', kind: 'enemy', hp: 80, maxHP: 80, slotIndex: 0, x: 240, y: 90 };
  const secondEnemy = { uid: 202, name: 'Lizardo', kind: 'enemy', hp: 80, maxHP: 80, slotIndex: 1, x: 240, y: 140 };
  const thirdEnemy = { uid: 203, name: 'Djinn', kind: 'enemy', hp: 80, maxHP: 80, slotIndex: 2, x: 240, y: 190 };
  const skills = [];
  if (activeI) {
    skills.push({ id: 'party_chain_strike_i', definitionId: 'party_chain_strike_i', selectionCount: 1 });
  }
  if (activeII) {
    skills.push({ id: 'party_chain_strike_ii', definitionId: 'party_chain_strike_ii', selectionCount: 1 });
  }
  return {
    state: {
      globals: {
        time: 3,
        SelectedEnemyUID: pending ? firstEnemy.uid : 0,
        PendingSkillID: pending ? 'HERO_SINGLE' : '',
        PendingActor: pending ? hero.uid : 0,
        SessionSkillsByHeroUID: skills.length ? { __party_shared__: skills } : {},
      },
      entities: onlyOneEnemy ? [hero, firstEnemy] : [hero, firstEnemy, secondEnemy, thirdEnemy],
    },
  };
}

test('Chain Strike II is a one-off upgrade gated behind Chain Strike I in both mirrors', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const defs = mod.GetPartySkillDefinitions();
    const chainI = defs.find(def => def.id === 'party_chain_strike_i');
    const chainII = defs.find(def => def.id === 'party_chain_strike_ii');
    assert.ok(chainI);
    assert.ok(chainII);
    assert.equal(chainII.drawClass, 'one_off');
    assert.equal(chainII.selection.sessionBucket, '__party_shared__');
    assert.equal(chainII.selection.duplicatePolicy, 'reject_after_selected');
    assert.equal(chainII.trigger.eligibility, 'requires_chain_strike_i');
    assert.equal(chainII.effect.kind, 'chain_bounce_upgrade');
    assert.equal(chainII.effect.upgrades, 'party_chain_strike_i');
    assert.equal(chainII.effect.bounceDamagePct, 66);
    assert.equal(chainII.effect.maxBounces, 2);
    assert.equal(chainII.effect.targeting, chainI.effect.targeting);

    const blockedCtx = makeContext();
    const blocked = mod.ForceAstralFlowSkillDraught(blockedCtx, 100, 'party_chain_strike_ii');
    assert.equal(blocked.ok, true);
    assert.equal(blocked.forcedSkillSuppressedReason, 'requires_chain_strike_i');
    assert.equal(blocked.candidates.some(candidate => candidate.id === 'party_chain_strike_ii'), false);

    const iCtx = makeContext();
    const openedI = mod.ForceAstralFlowSkillDraught(iCtx, 100, 'party_chain_strike_i');
    assert.equal(openedI.ok, true);
    assert.equal(openedI.candidates[0].id, 'party_chain_strike_i');
    const selectedI = mod.SelectSkillDraughtCard(iCtx, 0);
    assert.equal(selectedI.ok, true);

    const openedII = mod.ForceAstralFlowSkillDraught(iCtx, 100, 'party_chain_strike_ii');
    assert.equal(openedII.ok, true);
    assert.equal(openedII.forcedSkillSuppressedReason, '');
    assert.equal(openedII.candidates[0].id, 'party_chain_strike_ii');
    const selectedII = mod.SelectSkillDraughtCard(iCtx, 0);
    assert.equal(selectedII.ok, true);
    assert.equal(selectedII.skill.id, 'party_chain_strike_ii');

    const blockedII = mod.ForceAstralFlowSkillDraught(iCtx, 100, 'party_chain_strike_ii');
    assert.equal(blockedII.ok, true);
    assert.equal(blockedII.forcedSkillSuppressedReason, 'one_off_already_selected');
    assert.equal(blockedII.candidates.some(candidate => candidate.id === 'party_chain_strike_ii'), false);

    const blockedI = mod.ForceAstralFlowSkillDraught(iCtx, 100, 'party_chain_strike_i');
    assert.equal(blockedI.ok, true);
    assert.equal(blockedI.forcedSkillSuppressedReason, 'upgraded_by_chain_strike_ii');
    assert.equal(blockedI.candidates.some(candidate => candidate.id === 'party_chain_strike_i'), false);
  }
});

test('Chain Strike II upgrades into two 66 percent bounces without changing player target', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext({ activeI: true, activeII: true });

    mod.HeroAttackSingle(ctx, 100, 201);

    const hits = ctx.state.globals.PendingHeroHits;
    assert.equal(hits.length, 3);
    assert.equal(JSON.stringify(hits.map(hit => hit.targetUID)), JSON.stringify([201, 202, 203]));
    assert.equal(ctx.state.globals.SelectedEnemyUID, 0);
    assert.equal(hits[1].finalDmg, Math.max(1, Math.ceil(hits[0].finalDmg * 0.66)));
    assert.equal(hits[2].finalDmg, Math.max(1, Math.ceil(hits[0].finalDmg * 0.66)));
    assert.equal(hits[1].effectType, 'chain_bounce');
    assert.equal(hits[2].effectType, 'chain_bounce');
    assert.equal(hits[1].actionName, 'Chain Strike II');
    assert.equal(hits[2].actionName, 'Chain Strike II');
    assert.equal(hits[1].generatedBySkillId, 'party_chain_strike_ii');
    assert.equal(hits[2].generatedBySkillId, 'party_chain_strike_ii');
    assert.equal(hits[1].chainStrikeDamagePct, 66);
    assert.equal(hits[2].chainStrikeDamagePct, 66);
    assert.equal(hits[1].retargetOnDeath || 0, 0);
    assert.equal(hits[2].retargetOnDeath || 0, 0);
    assert.equal(ctx.state.globals.PartyChainStrikeIIProcs, 1);
    assert.equal(ctx.state.globals.PartyChainStrikeIProcs || 0, 0);
    assert.equal(ctx.state.globals.LastPartyChainStrike.skillId, 'party_chain_strike_ii');
    assert.equal(ctx.state.globals.LastPartyChainStrike.damagePct, 66);
    assert.equal(ctx.state.globals.LastPartyChainStrike.bounceCount, 2);
    assert.equal(JSON.stringify(ctx.state.globals.LastPartyChainStrike.targetUIDs), JSON.stringify([202, 203]));
    assert.equal(ctx.state.globals.ChainStrikeVisuals.length, 2);
    assert.equal(ctx.state.globals.ChainStrikeVisuals[0].skillId, 'party_chain_strike_ii');
    assert.equal(ctx.state.globals.ChainStrikeVisuals[1].skillId, 'party_chain_strike_ii');
  }
});

test('Chain Strike II upgrades attacks after the forced draw select sequence', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext();

    const openedI = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_chain_strike_i');
    assert.equal(openedI.ok, true);
    assert.equal(openedI.candidates[0].id, 'party_chain_strike_i');
    const selectedI = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(selectedI.ok, true);

    const openedII = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_chain_strike_ii');
    assert.equal(openedII.ok, true);
    assert.equal(openedII.candidates[0].id, 'party_chain_strike_ii');
    const selectedII = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(selectedII.ok, true);

    const sharedSkills = ctx.state.globals.SessionSkillsByHeroUID.__party_shared__ || [];
    assert.equal(JSON.stringify(sharedSkills.map(skill => skill.id)), JSON.stringify(['party_chain_strike_i', 'party_chain_strike_ii']));

    mod.HeroAttackSingle(ctx, 100, 201);

    const hits = ctx.state.globals.PendingHeroHits;
    assert.equal(hits.length, 3);
    assert.equal(JSON.stringify(hits.map(hit => hit.targetUID)), JSON.stringify([201, 202, 203]));
    assert.equal(hits[1].finalDmg, Math.max(1, Math.ceil(hits[0].finalDmg * 0.66)));
    assert.equal(hits[2].finalDmg, Math.max(1, Math.ceil(hits[0].finalDmg * 0.66)));
    assert.equal(hits[1].actionName, 'Chain Strike II');
    assert.equal(hits[2].actionName, 'Chain Strike II');
    assert.equal(hits[1].generatedBySkillId, 'party_chain_strike_ii');
    assert.equal(hits[2].generatedBySkillId, 'party_chain_strike_ii');
    assert.equal(hits[1].chainStrikeDamagePct, 66);
    assert.equal(hits[2].chainStrikeDamagePct, 66);
    assert.equal(ctx.state.globals.PartyChainStrikeIIProcs, 1);
    assert.equal(ctx.state.globals.PartyChainStrikeIProcs || 0, 0);
    assert.equal(ctx.state.globals.LastPartyChainStrike.skillId, 'party_chain_strike_ii');
    assert.equal(ctx.state.globals.LastPartyChainStrike.damagePct, 66);
    assert.equal(ctx.state.globals.LastPartyChainStrike.bounceCount, 2);
  }
});

test('Chain Strike II preserves selected-target ExecuteSkill flow and one-enemy fallback', () => {
  const mod = loadModule(runtimePath);
  const pendingCtx = makeContext({ activeI: true, activeII: true, pending: true });
  mod.ExecuteSkill(pendingCtx, 'HERO_SINGLE', 100);
  assert.equal(JSON.stringify(pendingCtx.state.globals.PendingHeroHits.map(hit => hit.targetUID)), JSON.stringify([201, 202, 203]));
  assert.equal(pendingCtx.state.globals.SelectedEnemyUID, 201);

  const soloCtx = makeContext({ activeI: true, activeII: true, onlyOneEnemy: true });
  mod.HeroAttackSingle(soloCtx, 100, 201);
  assert.equal(JSON.stringify(soloCtx.state.globals.PendingHeroHits.map(hit => hit.targetUID)), JSON.stringify([201, 201, 201]));
  assert.equal(soloCtx.state.globals.PendingHeroHits[1].generatedBySkillId, 'party_chain_strike_ii');
  assert.equal(soloCtx.state.globals.PendingHeroHits[2].generatedBySkillId, 'party_chain_strike_ii');
  assert.equal(soloCtx.state.globals.ChainStrikeVisuals[0].targetUID, 201);
  assert.equal(soloCtx.state.globals.ChainStrikeVisuals[1].targetUID, 201);
});

test('Chain Strike II reuses the production raster connector asset and renderer', () => {
  const assetLoader = fs.readFileSync(assetLoaderPath, 'utf8');
  const renderRuntime = fs.readFileSync(renderRuntimePath, 'utf8');

  assert.ok(fs.existsSync(chainAssetPath), 'chain strike upgrade must ship the raster arc asset in its own worktree');
  assert.match(assetLoader, /SkillChainStrikeArc/);
  assert.match(assetLoader, /skill_chain_strike_arc_160x48\.png/);
  assert.match(renderRuntime, /ChainStrikeVisuals/);
  assert.match(renderRuntime, /"const resolvedSelectedUid = selectedUid \|\| pendingHitTargetUID;"/);
  assert.doesNotMatch(renderRuntime, /ctx\.moveTo\([^)]*ChainStrike/);
});

test('Chain Strike II browser QA scenario bypasses draw RNG and exposes actor target proof', () => {
  const hooks = fs.readFileSync(devBrowserHooksPath, 'utf8');

  assert.match(hooks, /setupChainStrikeIIScenario\(/);
  assert.match(hooks, /waitForStartupReady/);
  assert.match(hooks, /waitForLayout/);
  assert.match(hooks, /party_chain_strike_i/);
  assert.match(hooks, /party_chain_strike_ii/);
  assert.match(hooks, /requestLayoutChange\('town', 'chain-strike-ii-qa-scenario-story'\)/);
  assert.match(hooks, /requestLayoutChange\('combat', 'chain-strike-ii-qa-scenario-town', \{ freshStart: true \}\)/);
  assert.match(hooks, /PendingSkillID = 'HERO_SINGLE'/);
  assert.match(hooks, /SelectedEnemyUIDOwner = Number\(hero\.uid \|\| 0\)/);
  assert.match(hooks, /pendingHeroHits:/);
  assert.match(hooks, /chainStrikeDamagePct/);
  assert.match(hooks, /layoutId:/);
  assert.match(hooks, /expectedBounceCount: 2/);
  assert.match(hooks, /scenario === 'chain-strike-ii'/);
});
