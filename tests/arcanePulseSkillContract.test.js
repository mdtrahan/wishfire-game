const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');
const superGemRuntimePath = path.join(repoRoot, 'web-runner', 'systems', 'superGemRuntime.js');
const loaderPath = path.join(repoRoot, 'web-runner', 'systems', 'runtimeVisualAssetLoader.js');
const rendererPath = path.join(repoRoot, 'web-runner', 'systems', 'renderRuntime.js');
const browserHooksPath = path.join(repoRoot, 'web-runner', 'systems', 'devBrowserTestHooks.js');
const assetPath = path.join(repoRoot, 'web-runner', 'assets', 'images', 'skill_arcane_pulse_96x96.png');

function loadFunctionBank(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ApplyDamageToTarget,
  ConfigureActorExtraTurnSkill,
  ExecuteSkill,
  ForceAstralFlowSkillDraught,
  GetPartySkillDefinitions,
  GetSkillDefinition,
  GetSkillDraughtState,
  HeroAttackSingle,
  QueuePartyArcanePulse,
  SelectSkillDraughtCard,
  TryGrantConfiguredExtraTurn,
};`;
  const context = {
    console,
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

function loadSuperGemRuntime() {
  const original = fs.readFileSync(superGemRuntimePath, 'utf8');
  const transformed = `${original
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')}

module.exports = {
  activateSuperGemEffect,
  executePendingSuperGemAction,
};`;
  const context = {
    console,
    Math,
    Number,
    String,
    Array,
    Map,
    module: { exports: {} },
    exports: {},
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: superGemRuntimePath }).runInContext(context);
  return context.module.exports;
}

function makeContext({ pending = false } = {}) {
  const hero = {
    uid: 100,
    kind: 'hero',
    name: 'Huun',
    baseHeroName: 'Huun',
    heroIndex: 1,
    attackType: 'melee',
    hp: 80,
    maxHP: 80,
    x: 84,
    y: 145,
    stats: { ATK: 20, DEF: 0, MAG: 6, RES: 0, SPD: 5 },
  };
  const runa = {
    uid: 101,
    kind: 'hero',
    name: 'Runa',
    baseHeroName: 'Runa',
    heroIndex: 2,
    attackType: 'ranged',
    hp: 80,
    maxHP: 80,
    x: 84,
    y: 205,
    stats: { ATK: 12, DEF: 0, MAG: 12, RES: 0, SPD: 5 },
  };
  const enemyA = {
    uid: 201,
    kind: 'enemy',
    name: 'Gobloc',
    hp: 90,
    maxHP: 90,
    x: 250,
    y: 126,
    slotIndex: 0,
    stats: { DEF: 0, RES: 0 },
  };
  const enemyB = {
    uid: 202,
    kind: 'enemy',
    name: 'Skeleton',
    hp: 90,
    maxHP: 90,
    x: 250,
    y: 178,
    slotIndex: 1,
    stats: { DEF: 0, RES: 0 },
  };
  const globals = {
    time: 1,
    CombatLog: [],
    CombatActionLines: ['', '', '', ''],
    ActionLockUntil: 0,
    PendingActor: pending ? hero.uid : 0,
    PendingSkillID: pending ? 'HERO_SINGLE' : '',
    SelectedEnemyUID: pending ? enemyB.uid : 0,
    PowerAmpByUID: {},
    SessionSkillsByHeroUID: {},
    SkillDraughtOpen: 0,
    SkillDraughtHeroUID: 0,
    SkillDraughtCandidates: [],
    SkillDraughtHitZones: [],
    SkillDraughtSelectedSkillId: '',
    SkillDraughtTrace: [],
    SkillDraughtTraceSeq: 0,
    AstralFlowAmpPoints: 18,
    AstralFlowAmpMax: 18,
    AstralFlowAmpReady: 1,
    RuntimeRandom: () => 0,
  };
  return {
    state: { globals, entities: [hero, runa, enemyA, enemyB] },
    callFunction() {
      return undefined;
    },
  };
}

function selectArcanePulse(mod, ctx) {
  const opened = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_arcane_pulse');
  assert.equal(opened.ok, true);
  assert.equal(opened.candidates[0].id, 'party_arcane_pulse');
  const selected = mod.SelectSkillDraughtCard(ctx, 0);
  assert.equal(selected.ok, true);
  assert.equal(selected.skill.id, 'party_arcane_pulse');
  return selected.skill;
}

function makeSuperGemArcaneContext(mod) {
  const ctx = makeContext();
  ctx.state.globals.SelectedEnemyUID = 202;
  selectArcanePulse(mod, ctx);
  ctx.state.globals.PartyArcanePulseActionCount = 1;
  const calls = [];
  const callFunctionWithContext = (_fnContext, name, ...args) => {
    calls.push({ name, args });
    if (name === 'GetActorByUID') {
      const uid = Number(args[0] || 0);
      return ctx.state.entities.find(entity => Number(entity.uid || 0) === uid) || null;
    }
    if (name === 'CalculateDamage') return 48;
    if (name === 'GetPowerAmpMultiplierForActor') return 0;
    if (name === 'ConsumePowerAmpForActor') return 0;
    if (name === 'StartHeroLunge') return true;
    if (name === 'QueuePartyArcanePulse') return mod.QueuePartyArcanePulse(ctx, args[0]);
    if (name === 'LogCombat') {
      ctx.state.globals.CombatLog.push(String(args[0] || ''));
      return undefined;
    }
    return undefined;
  };
  return {
    state: ctx.state,
    calls,
    callFunctionWithContext,
    fnContext: {},
  };
}

for (const modulePath of [runtimePath, scriptsPath]) {
  const rel = path.relative(repoRoot, modulePath);

  test(`Arcane Pulse is a one-off active party draw in ${rel}`, () => {
    const mod = loadFunctionBank(modulePath);
    const def = mod.GetSkillDefinition(null, 'party_arcane_pulse');
    assert.equal(def.title, 'Arcane Pulse');
    assert.equal(def.drawClass, 'one_off');
    assert.equal(def.selection.duplicatePolicy, 'reject_after_selected');
    assert.equal(def.trigger.event, 'hero_attack_single');
    assert.equal(def.effect.kind, 'arcane_pulse');
    assert.equal(def.effect.flatDamage, 12);
    assert.equal(def.effect.triggerEvery, 2);
    assert.equal(def.effect.targeting, 'selected_enemy');

    const partyIds = mod.GetPartySkillDefinitions().map(row => row.id);
    assert.ok(partyIds.includes('party_arcane_pulse'));

    const ctx = makeContext();
    const selected = selectArcanePulse(mod, ctx);
    assert.equal(selected.selectionCount, 1);
    assert.equal(ctx.state.globals.SessionSkillsByHeroUID.__party_shared__.length, 1);

    const reopened = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_arcane_pulse');
    assert.equal(reopened.ok, true);
    assert.equal(reopened.candidates.some(candidate => candidate.id === 'party_arcane_pulse'), false);
    assert.equal(mod.GetSkillDraughtState(ctx).lastForcedSkillSuppressedReason, 'one_off_already_selected');
  });

  test(`Arcane Pulse triggers every other normal hero attack on the selected target in ${rel}`, () => {
    const mod = loadFunctionBank(modulePath);
    const ctx = makeContext();
    selectArcanePulse(mod, ctx);

    mod.HeroAttackSingle(ctx, 100, 201);
    assert.equal(ctx.state.globals.PendingHeroHits.length, 1);
    assert.equal(ctx.state.globals.PendingHeroHits[0].targetUID, 201);
    assert.equal(ctx.state.globals.PartyArcanePulseActionCount, 1);
    assert.equal(ctx.state.globals.LastPartyArcanePulse.triggered, 0);

    ctx.state.globals.PendingHeroHits = [];
    mod.HeroAttackSingle(ctx, 100, 202);
    assert.equal(ctx.state.globals.PartyArcanePulseActionCount, 2);
    assert.equal(ctx.state.globals.PartyArcanePulseProcs, 1);
    assert.equal(ctx.state.globals.PendingHeroHits.length, 2);
    assert.equal(ctx.state.globals.PendingHeroHits[0].targetUID, 202);
    const normalHit = ctx.state.globals.PendingHeroHits[0];
    const pulse = ctx.state.globals.PendingHeroHits[1];
    assert.equal(pulse.targetUID, 202);
    assert.equal(pulse.effectType, 'arcane_pulse');
    assert.equal(pulse.actionName, 'Arcane Pulse');
    assert.equal(pulse.generatedBySkillId, 'party_arcane_pulse');
    assert.equal(pulse.finalDmg, 12);
    assert.equal(pulse.powerAmpMultiplier, 0);
    assert.equal(pulse.consumePowerAmp, 0);
    assert.equal(pulse.suppressPartySkillHitHooks, 1);
    assert.equal(pulse.suppressHitFlash, 1);
    assert.equal(pulse.suppressDamageText, 1);
    assert.equal(pulse.suppressAttackSkillBounds, 1);
    assert.equal(pulse.bonusDamageOnly, 1);
    assert.equal(pulse.hitFlashTone, undefined);
    assert.equal(pulse.damageTextKind, undefined);
    assert.equal(pulse.sequence, 'attack_then_bonus_pulse');
    assert.ok(Number(pulse.at) > Number(normalHit.at), 'Arcane Pulse damage must resolve after the base attack');
    assert.equal(pulse.retargetOnDeath, undefined);
    assert.equal(ctx.state.globals.LastPartyArcanePulse.selectedTargetUID, 202);
    assert.equal(ctx.state.globals.LastPartyArcanePulse.sequence, 'attack_then_bonus_pulse');
    assert.ok(
      Number(ctx.state.globals.LastPartyArcanePulse.visualStartAt) > Number(normalHit.at),
      'Arcane Pulse visual should begin after the base attack impact'
    );
    assert.equal(ctx.state.globals.ArcanePulseVisuals.length, 1);
    assert.equal(ctx.state.globals.ArcanePulseVisuals[0].targetUID, 202);
    assert.equal(ctx.state.globals.ArcanePulseVisuals[0].shape, 'crescent_arc_blast');
    assert.equal(ctx.state.globals.ArcanePulseVisuals[0].sequence, 'attack_then_bonus_pulse');
    assert.equal(ctx.state.globals.ArcanePulseVisuals[0].sourceX, 84);
    assert.equal(ctx.state.globals.ArcanePulseVisuals[0].sourceY, 175);
    assert.notEqual(ctx.state.globals.ArcanePulseVisuals[0].sourceY, ctx.state.entities[0].y);
    assert.ok(
      Number(ctx.state.globals.ArcanePulseVisuals[0].startAt) > Number(normalHit.at),
      'Arcane Pulse crescent should not overlap the normal attack impact'
    );
  });

  test(`Arcane Pulse uses cached party midpoint when live hero y coordinates are missing in ${rel}`, () => {
    const mod = loadFunctionBank(modulePath);
    const ctx = makeContext();
    selectArcanePulse(mod, ctx);
    for (const entity of ctx.state.entities) {
      if (entity.kind !== 'hero') continue;
      delete entity.x;
      delete entity.y;
    }
    ctx.state.globals.HeroIconPosByIndex = [
      null,
      { x: 72, y: 132 },
      { x: 96, y: 212 },
    ];
    ctx.state.globals.PartyArcanePulseActionCount = 1;

    mod.HeroAttackSingle(ctx, 100, 202);

    const visual = ctx.state.globals.ArcanePulseVisuals[0];
    assert.equal(visual.targetY, 178);
    assert.equal(visual.sourceX, 84);
    assert.equal(visual.sourceY, 172);
    assert.notEqual(visual.sourceY, visual.targetY);
  });

  test(`Arcane Pulse uses party formation midpoint instead of enemy y when cached positions are absent in ${rel}`, () => {
    const mod = loadFunctionBank(modulePath);
    const ctx = makeContext();
    selectArcanePulse(mod, ctx);
    for (const entity of ctx.state.entities) {
      if (entity.kind !== 'hero') continue;
      delete entity.x;
      delete entity.y;
    }
    ctx.state.entities[0].heroDisplaySlot = 0;
    ctx.state.entities[1].heroDisplaySlot = 1;
    ctx.state.globals.EnemyAreaRect = { minX: 200, maxX: 360, minY: 100, maxY: 260 };
    ctx.state.globals.EnemySize = 40;
    ctx.state.globals.PartyArcanePulseActionCount = 1;

    mod.HeroAttackSingle(ctx, 100, 202);

    const visual = ctx.state.globals.ArcanePulseVisuals[0];
    assert.equal(visual.targetY, 178);
    assert.equal(visual.sourceY, 144);
    assert.notEqual(visual.sourceY, visual.targetY);
  });

  test(`Arcane Pulse follows ExecuteSkill's pending selected target in ${rel}`, () => {
    const mod = loadFunctionBank(modulePath);
    const ctx = makeContext({ pending: true });
    selectArcanePulse(mod, ctx);
    ctx.state.globals.PartyArcanePulseActionCount = 1;

    mod.ExecuteSkill(ctx, 'HERO_SINGLE', 100);

    const hits = ctx.state.globals.PendingHeroHits;
    assert.equal(hits.length, 2);
    assert.equal(hits[0].targetUID, 202);
    assert.equal(hits[1].targetUID, 202);
    assert.equal(hits[1].effectType, 'arcane_pulse');
  });

  test(`Arcane Pulse bonus damage does not trigger Destiny in ${rel}`, () => {
    const mod = loadFunctionBank(modulePath);
    const ctx = makeContext();
    ctx.state.globals.TurnOrderArray = [{ uid: 100, type: 0 }];
    ctx.state.globals.CurrentTurnIndex = 0;
    ctx.state.globals.PartyMaxHP = 80;
    ctx.state.entities[0].hp = 40;
    selectArcanePulse(mod, ctx);
    ctx.state.globals.SessionSkillsByHeroUID.__party_shared__.push({
      id: 'party_destiny',
      key: 'party_destiny',
      definitionId: 'party_destiny',
      title: 'Destiny',
    });

    ctx.state.globals.PartyArcanePulseActionCount = 1;
    mod.HeroAttackSingle(ctx, 100, 202);
    const pulse = ctx.state.globals.PendingHeroHits.find(hit => hit && hit.effectType === 'arcane_pulse');
    assert.ok(pulse, 'expected Arcane Pulse hit packet');
    assert.equal(pulse.suppressPartySkillHitHooks, 1);
    assert.equal(pulse.suppressHitFlash, 1);
    assert.equal(pulse.suppressDamageText, 1);

    ctx.state.globals.time = Number(pulse.at || 0) + 0.01;
    const pulseDamage = mod.ApplyDamageToTarget(ctx, pulse.targetUID, pulse.finalDmg);
    assert.equal(pulseDamage, 12);
    assert.equal(ctx.state.globals.PartyDestinyAttempts || 0, 0);
    assert.equal(ctx.state.globals.PartyDestinyProcs || 0, 0);
    assert.equal(ctx.state.entities[0].hp, 40);
    assert.equal(ctx.state.globals.HitFlashByUID?.[pulse.targetUID], undefined);
    assert.equal((ctx.state.globals.DamageTexts || []).length, 0);

    ctx.state.globals.PendingHeroHits = [{
      at: ctx.state.globals.time,
      heroUID: 100,
      targetUID: 201,
      dmg: 5,
      finalDmg: 5,
    }];
    const normalDamage = mod.ApplyDamageToTarget(ctx, 201, 5);
    assert.equal(normalDamage, 5);
    assert.equal(ctx.state.globals.PartyDestinyAttempts, 1);
    assert.equal(ctx.state.globals.PartyDestinyProcs, 1);
    assert.ok(ctx.state.entities[0].hp > 40, 'normal hit should still allow Destiny healing');
    assert.ok(ctx.state.globals.HitFlashByUID?.[201], 'normal hits should still show hit flash feedback');
    assert.ok((ctx.state.globals.DamageTexts || []).length > 0, 'normal hits should still show damage text feedback');
  });

  test(`Arcane Pulse triggers last inside generated double-attack followup lanes in ${rel}`, () => {
    const src = fs.readFileSync(modulePath, 'utf8');
    assert.match(src, /function queueConfiguredDoubleAttackFollowUp/);
    assert.doesNotMatch(src, /SuppressArcanePulseForGeneratedAttack/);
    const mod = loadFunctionBank(modulePath);
    const ctx = makeContext();
    selectArcanePulse(mod, ctx);
    assert.equal(mod.ConfigureActorExtraTurnSkill(ctx, 100, {
      skillId: 'DOUBLE_ATTACK',
      chance: 1,
    }), true);
    ctx.state.globals.PartyArcanePulseActionCount = 1;

    const granted = mod.TryGrantConfiguredExtraTurn(ctx, 100, 0, {
      skillId: 'HERO_SINGLE',
      targetUID: 202,
    });

    assert.equal(granted, true);
    const hits = ctx.state.globals.PendingHeroHits;
    assert.equal(hits.length, 2);
    const normal = hits.find(hit => hit && hit.effectType !== 'arcane_pulse');
    const pulse = hits.find(hit => hit && hit.effectType === 'arcane_pulse');
    assert.ok(normal, 'expected generated base attack hit');
    assert.ok(pulse, 'expected generated attack to queue Arcane Pulse');
    assert.equal(normal.followUpSkillId, 'DOUBLE_ATTACK');
    assert.equal(pulse.followUpSkillId, 'DOUBLE_ATTACK');
    assert.equal(pulse.followUpBatchId, normal.followUpBatchId);
    assert.ok(Number(pulse.followUpOffset) > Number(normal.followUpOffset || 0));
    assert.ok(Number(pulse.at) > Number(normal.at));
    assert.equal(pulse.targetUID, 202);
    assert.equal(pulse.sequence, 'attack_then_bonus_pulse');
  });
}

test('Arcane Pulse queues after red supergem cluster attacks', () => {
  const runtime = loadSuperGemRuntime();
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadFunctionBank(modulePath);
    const context = makeSuperGemArcaneContext(mod);

    assert.equal(runtime.activateSuperGemEffect({
      superGem: { id: 'sg-red', baseColor: 1 },
      actorUID: 100,
      selectedEnemyUID: 202,
      state: context.state,
      callFunctionWithContext: context.callFunctionWithContext,
      fnContext: context.fnContext,
      sourceItems: [],
      startGemMergeFx: () => {},
      getGoldLabelTargetWorld: () => null,
    }), true);
    assert.equal(runtime.executePendingSuperGemAction(context), true);

    const hits = context.state.globals.PendingHeroHits;
    const clusterHits = hits.filter(hit => hit && Number(hit.superGemClusterBatchId || 0) > 0);
    const pulse = hits.find(hit => hit && hit.effectType === 'arcane_pulse');
    assert.equal(clusterHits.length, 3);
    assert.ok(pulse, `expected red supergem to queue Arcane Pulse for ${path.relative(repoRoot, modulePath)}`);
    assert.equal(pulse.targetUID, 202);
    assert.equal(pulse.sequence, 'attack_then_bonus_pulse');
    assert.equal(pulse.suppressHitFlash, 1);
    assert.equal(pulse.suppressDamageText, 1);
    assert.ok(
      Number(pulse.at) > Math.max(...clusterHits.map(hit => Number(hit.at || 0))),
      'Arcane Pulse should resolve after the final red supergem cluster hit'
    );
    assert.equal(context.calls.some(call => call.name === 'QueuePartyArcanePulse'), true);
  }
});

test('Arcane Pulse queues after Huun yellow supergem Goldstrike attacks', () => {
  const runtime = loadSuperGemRuntime();
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadFunctionBank(modulePath);
    const context = makeSuperGemArcaneContext(mod);
    context.state.globals.goldTotal = 8;

    assert.equal(runtime.activateSuperGemEffect({
      superGem: { id: 'sg-yellow', baseColor: 3 },
      actorUID: 100,
      selectedEnemyUID: 202,
      state: context.state,
      callFunctionWithContext: context.callFunctionWithContext,
      fnContext: context.fnContext,
      sourceItems: [],
      consumedColorGemCount: 4,
      startGemMergeFx: () => {},
      getGoldLabelTargetWorld: () => null,
    }), true);

    const hits = context.state.globals.PendingHeroHits;
    const goldstrike = hits.find(hit => hit && hit.calcPath === 'goldstrike');
    const pulse = hits.find(hit => hit && hit.effectType === 'arcane_pulse');
    assert.ok(goldstrike, `expected Huun Goldstrike hit for ${path.relative(repoRoot, modulePath)}`);
    assert.ok(pulse, `expected Huun Goldstrike to queue Arcane Pulse for ${path.relative(repoRoot, modulePath)}`);
    assert.equal(goldstrike.targetUID, 202);
    assert.equal(pulse.targetUID, 202);
    assert.equal(pulse.sequence, 'attack_then_bonus_pulse');
    assert.ok(
      Number(pulse.at) > Number(goldstrike.at || 0),
      'Arcane Pulse should resolve after Huun yellow supergem Goldstrike'
    );
    assert.equal(context.calls.some(call => call.name === 'QueuePartyArcanePulse'), true);
  }
});

test('Arcane Pulse has raster asset and browser-visible render hooks', () => {
  const asset = fs.readFileSync(assetPath);
  assert.deepEqual(Array.from(asset.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(asset.length > 1000, 'Arcane Pulse PNG should not be an empty placeholder');

  const loaderSrc = fs.readFileSync(loaderPath, 'utf8');
  const rendererSrc = fs.readFileSync(rendererPath, 'utf8');
  const hooksSrc = fs.readFileSync(browserHooksPath, 'utf8');
  assert.match(loaderSrc, /skill_arcane_pulse_96x96\.png/);
  assert.match(loaderSrc, /SkillArcanePulse/);
  assert.match(rendererSrc, /renderArcanePulseVisuals/);
  assert.match(rendererSrc, /images\.SkillArcanePulse/);
  assert.match(rendererSrc, /crescent_arc_blast/);
  assert.match(rendererSrc, /drawCrescentArc/);
  assert.doesNotMatch(rendererSrc, /drawPulseSprite/);
  assert.doesNotMatch(rendererSrc, /ctx\.translate\(target\.x, target\.y\)/);
  assert.doesNotMatch(rendererSrc, /Math\.PI - 0\.62/);
  assert.match(hooksSrc, /arcanePulseVisuals/);
});
