const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');

function loadSuperGemRuntime() {
  const modulePath = path.join(repoRoot, 'web-runner', 'systems', 'superGemRuntime.js');
  const src = `${fs.readFileSync(modulePath, 'utf8')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')}

module.exports = {
  activateSuperGemEffect,
  executePendingSuperGemAction,
};`;
  const context = { module: { exports: {} }, exports: {}, Math, Number, String, Array, Map };
  vm.runInNewContext(src, context, { filename: modulePath });
  return context.module.exports;
}

function loadFunctionBank(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ApplyDamageToTarget,
  ExecuteSkill,
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

function createSuperGemContext(actorName = 'Falie') {
  const actor = { uid: 4, kind: 'hero', name: actorName, attackType: 'melee', heroIndex: 0 };
  const enemy = { uid: 200, kind: 'enemy', name: 'Wisp', hp: 100, maxHP: 100 };
  const state = {
    globals: {
      PartyHP: 200,
      PartyMaxHP: 200,
      PowerAmpByUID: {},
      RuntimeRandom: () => 0,
      SelectedEnemyUID: enemy.uid,
      time: 1,
    },
    entities: [actor, enemy],
  };
  const calls = [];
  const fnContext = {};
  const callFunctionWithContext = (_ctx, name, ...args) => {
    calls.push({ name, args });
    if (name === 'GetActorByUID') {
      const uid = Number(args[0] || 0);
      return state.entities.find(entity => Number(entity.uid || 0) === uid) || null;
    }
    if (name === 'CalculateDamage') return 40;
    if (name === 'GetPowerAmpMultiplierForActor') return 0;
    if (name === 'ConsumePowerAmpForActor') return 0;
    if (name === 'StartHeroLunge') return true;
    return undefined;
  };
  return { state, calls, callFunctionWithContext, fnContext };
}

function activateRedSuperGem(runtime, context) {
  return runtime.activateSuperGemEffect({
    superGem: { id: 'sg-red', baseColor: 1 },
    actorUID: 4,
    selectedEnemyUID: 0,
    state: context.state,
    callFunctionWithContext: context.callFunctionWithContext,
    fnContext: context.fnContext,
    sourceItems: [],
    startGemMergeFx: () => {},
    getGoldLabelTargetWorld: () => null,
  });
}

test('Falie red super-gem creates then sustains party ward without arming the red attack path', () => {
  const runtime = loadSuperGemRuntime();
  const context = createSuperGemContext('Falie');
  const expected = [
    { shield: 36, ratio: 0.18 },
    { shield: 108, ratio: 0.54 },
    { shield: 180, ratio: 0.9 },
    { shield: 200, ratio: 1 },
  ];

  for (const step of expected) {
    assert.equal(activateRedSuperGem(runtime, context), true);
    assert.equal(context.state.globals.PendingSkillID || '', '');
    assert.equal(context.state.globals.PendingSuperGemAction || null, null);
    assert.equal(context.state.globals.PartyTempHPShield, step.shield);
    assert.equal(context.state.globals.PartyTempHPShieldRatio, step.ratio);
    assert.equal(context.state.globals.PartyTempHPShieldMax, 200);
    assert.equal(context.state.globals.PartyTempHPShieldColor, '#6CCBEE');
    assert.equal(context.state.globals.PartyHP, 200);
    assert.equal(context.state.globals.DeferAdvance, 1);
    assert.equal(context.state.globals.AdvanceAfterAction, 1);
  }
});

function makeFalieRedAttackContext(modulePath, { shield = 36, maxHP = 200 } = {}) {
  const { ExecuteSkill } = loadFunctionBank(modulePath);
  const hero = {
    uid: 4,
    kind: 'hero',
    name: 'Falie',
    heroIndex: 0,
    attackType: 'melee',
    hp: maxHP,
    maxHP,
    stats: { ATK: 50, DEF: 10, MAG: 10, RES: 10, SPD: 10 },
  };
  const enemy = {
    uid: 200,
    kind: 'enemy',
    name: 'Wisp',
    hp: 120,
    maxHP: 120,
    stats: { ATK: 10, DEF: 5, MAG: 10, RES: 5, SPD: 5 },
  };
  const ctx = {
    state: {
      globals: {
        time: 2,
        PartyHP: maxHP,
        PartyMaxHP: maxHP,
        PartyHPByIndex: [maxHP],
        PartyMaxHPByIndex: [maxHP],
        PartyTempHPShield: shield,
        PartyTempHPShieldRatio: shield / maxHP,
        PartyTempHPShieldMax: shield > 0 ? maxHP : 0,
        PowerAmpByUID: {},
        RuntimeRandom: () => 0,
        SelectedEnemyUID: enemy.uid,
        TurnPhase: 0,
      },
      entities: [hero, enemy],
    },
  };
  return { ExecuteSkill, ctx, hero, enemy };
}

function assertFalieRedAttackSustainsActiveWard(modulePath) {
  const { ExecuteSkill, ctx, hero } = makeFalieRedAttackContext(modulePath, { shield: 36 });

  ExecuteSkill(ctx, 'HERO_SINGLE', hero.uid);

  assert.equal(ctx.state.globals.PartyTempHPShield, 72);
  assert.equal(ctx.state.globals.PartyTempHPShieldRatio, 0.36);
  assert.equal(ctx.state.globals.PartyTempHPShieldMax, 200);
  assert.equal(ctx.state.globals.PartyTempHPShieldSource, 'falie_red_sustain');
  assert.equal(ctx.state.globals.PendingHeroHits.length, 1);
}

test('Falie ordinary red attack sustains an active ward in both runtime mirrors', () => {
  assertFalieRedAttackSustainsActiveWard(path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js'));
  assertFalieRedAttackSustainsActiveWard(path.join(repoRoot, 'Scripts', 'functionBank.js'));
});

function assertFalieRedAttackDoesNotRecreateBrokenWard(modulePath) {
  const { ExecuteSkill, ctx, hero } = makeFalieRedAttackContext(modulePath, { shield: 0 });

  ExecuteSkill(ctx, 'HERO_SINGLE', hero.uid);

  assert.equal(ctx.state.globals.PartyTempHPShield || 0, 0);
  assert.equal(ctx.state.globals.PartyTempHPShieldRatio || 0, 0);
  assert.equal(ctx.state.globals.PartyTempHPShieldMax || 0, 0);
  assert.equal(ctx.state.globals.PendingHeroHits.length, 1);
}

test('Falie ordinary red attack cannot recreate a broken ward in both runtime mirrors', () => {
  assertFalieRedAttackDoesNotRecreateBrokenWard(path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js'));
  assertFalieRedAttackDoesNotRecreateBrokenWard(path.join(repoRoot, 'Scripts', 'functionBank.js'));
});

test('Falie Ward creates one refreshed barrier visual per hero', () => {
  const runtime = loadSuperGemRuntime();
  const context = createSuperGemContext('Falie');
  context.state.entities.splice(
    1,
    0,
    { uid: 5, kind: 'hero', name: 'Huun', heroIndex: 1, hp: 100, maxHP: 100 },
    { uid: 6, kind: 'hero', name: 'Runa', heroIndex: 2, hp: 100, maxHP: 100 },
    { uid: 7, kind: 'hero', name: 'Kojonn', heroIndex: 3, hp: 100, maxHP: 100 },
  );

  assert.equal(activateRedSuperGem(runtime, context), true);
  const firstVisuals = context.state.globals.PartyWardBarrierVisualsByUID;
  assert.deepEqual(Object.keys(firstVisuals).sort(), ['4', '5', '6', '7']);
  assert.equal(context.state.globals.PartyWardBarrierAssetPath, 'images/falie_ward_84x62.png');
  assert.equal(context.state.globals.PartyWardBarrierOffsetWorldX, 22);
  assert.equal(context.state.globals.PartyWardBarrierWidth, 84);
  assert.equal(context.state.globals.PartyWardBarrierHeight, 62);
  assert.equal(firstVisuals[4].state, 'fadeIn');
  assert.equal(firstVisuals[4].refreshCount, 1);

  assert.equal(activateRedSuperGem(runtime, context), true);
  const refreshedVisuals = context.state.globals.PartyWardBarrierVisualsByUID;
  assert.strictEqual(refreshedVisuals, firstVisuals);
  assert.deepEqual(Object.keys(refreshedVisuals).sort(), ['4', '5', '6', '7']);
  assert.equal(refreshedVisuals[4].refreshCount, 2);
});

test('red super-gem shield is Falie-only', () => {
  const runtime = loadSuperGemRuntime();
  const context = createSuperGemContext('Kojonn');

  assert.equal(activateRedSuperGem(runtime, context), true);
  assert.equal(context.state.globals.PendingSkillID, 'HERO_SINGLE');
  assert.equal(context.state.globals.PendingSuperGemAction.color, 1);
  assert.equal(context.state.globals.PartyTempHPShield || 0, 0);
  assert.equal(context.state.globals.PartyTempHPShieldStacks || 0, 0);
});

test('non-Falie red super-gem still executes the single-target cluster attack contract', () => {
  const runtime = loadSuperGemRuntime();
  const context = createSuperGemContext('Huun');

  assert.equal(activateRedSuperGem(runtime, context), true);
  assert.equal(context.state.globals.PendingSkillID, 'HERO_SINGLE');
  assert.equal(context.state.globals.PendingSuperGemAction.kind, 'super_gem_attack');
  assert.equal(context.state.globals.PendingSuperGemAction.color, 1);
  assert.equal(context.state.globals.PendingSuperGemAction.actorUID, 4);
  assert.equal(context.state.globals.PartyTempHPShield || 0, 0);

  assert.equal(runtime.executePendingSuperGemAction(context), true);
  assert.equal(context.state.globals.PendingSuperGemAction, null);
  assert.equal(context.state.globals.PendingHeroHits.length, 3);
  assert.equal(context.state.globals.PendingHeroHits.every(hit => hit.targetUID === 200), true);
  assert.equal(context.state.globals.PendingHeroHits.every(hit => hit.heroUID === 4), true);
  assert.equal(context.state.globals.NextHeroActionProfile, 'single');
});

test('non-Falie red super-gem cluster falls back to the first living enemy when no target is preselected', () => {
  const runtime = loadSuperGemRuntime();
  const context = createSuperGemContext('Huun');
  context.state.globals.SelectedEnemyUID = 0;

  assert.equal(activateRedSuperGem(runtime, context), true);
  assert.equal(runtime.executePendingSuperGemAction(context), true);
  assert.equal(context.state.globals.PendingSuperGemAction, null);
  assert.equal(context.state.globals.PendingHeroHits.length, 3);
  assert.equal(context.state.globals.PendingHeroHits.every(hit => hit.targetUID === 200), true);
  assert.equal(context.state.globals.NextHeroActionProfile, 'single');
});

function makeDamageContext() {
  const hero = {
    uid: 100,
    kind: 'hero',
    name: 'Falie',
    heroIndex: 0,
    hp: 100,
    maxHP: 100,
    x: 10,
    y: 10,
  };
  return {
    state: {
      globals: {
        time: 0,
        SpawnDamageText: 0,
        PartyHP: 100,
        PartyMaxHP: 100,
        PartyHPByIndex: [100],
        PartyMaxHPByIndex: [100],
        PartyTempHPShield: 42,
        PartyTempHPShieldStacks: 4,
        PartyTempHPShieldRatio: 0.42,
        HeroIconPosByIndex: [{ x: 10, y: 10 }],
        TurnOrderArray: [{ uid: 200, type: 1, spd: 1 }],
        CurrentTurnIndex: 0,
      },
      entities: [
        hero,
        { uid: 200, kind: 'enemy', name: 'Wisp', hp: 50, maxHP: 50 },
      ],
    },
  };
}

function assertShieldAbsorbsDamageBeforePartyHp(modulePath) {
  const { ApplyDamageToTarget } = loadFunctionBank(modulePath);
  const ctx = makeDamageContext();
  const hero = ctx.state.entities[0];

  assert.equal(ApplyDamageToTarget(ctx, hero.uid, 30), 0);
  assert.equal(hero.hp, 100);
  assert.equal(ctx.state.globals.PartyHP, 100);
  assert.equal(ctx.state.globals.PartyTempHPShield, 12);
  assert.equal(ctx.state.globals.PartyTempHPShieldStacks, 4);

  assert.equal(ApplyDamageToTarget(ctx, hero.uid, 20), 8);
  assert.equal(hero.hp, 92);
  assert.equal(ctx.state.globals.PartyHP, 92);
  assert.equal(ctx.state.globals.PartyTempHPShield, 0);
  assert.equal(ctx.state.globals.PartyTempHPShieldStacks, 0);
}

test('party tempHP shield absorbs enemy damage before true party HP in both runtime mirrors', () => {
  assertShieldAbsorbsDamageBeforePartyHp(path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js'));
  assertShieldAbsorbsDamageBeforePartyHp(path.join(repoRoot, 'Scripts', 'functionBank.js'));
});

function assertShieldDamageTargetsWard(modulePath) {
  const { ApplyDamageToTarget } = loadFunctionBank(modulePath);
  const ctx = makeDamageContext();
  const hero = ctx.state.entities[0];
  ctx.state.globals.SpawnDamageText = 1;
  ctx.state.globals.PartyWardBarrierPosByUID = {
    [hero.uid]: { x: 32, y: 10 },
  };
  ctx.state.globals.PartyWardBarrierVisualsByUID = {
    [hero.uid]: {
      uid: hero.uid,
      state: 'active',
      baseAlpha: 0.82,
      fadeOutDuration: 0.28,
    },
  };

  assert.equal(ApplyDamageToTarget(ctx, hero.uid, 30), 0);
  assert.equal(hero.hp, 100);
  assert.equal(ctx.state.globals.PartyTempHPShield, 12);
  assert.equal(ctx.state.globals.DamageTexts.length, 1);
  assert.equal(ctx.state.globals.DamageTexts[0].kind, 'ward');
  assert.equal(ctx.state.globals.DamageTexts[0].targetKind, 'ward');
  assert.equal(ctx.state.globals.DamageTexts[0].amount, 30);
  assert.equal(ctx.state.globals.DamageTexts[0].x, 32);
  assert.equal(ctx.state.globals.DamageTexts[0].y, 10);
  assert.ok(!ctx.state.globals.HitFlashByUID || !ctx.state.globals.HitFlashByUID[hero.uid]);
  assert.equal(ctx.state.globals.PartyWardBarrierVisualsByUID[hero.uid].lastAbsorbed, 30);
}

test('absorbed hero damage spawns soft Ward floating text over the barrier in both mirrors', () => {
  assertShieldDamageTargetsWard(path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js'));
  assertShieldDamageTargetsWard(path.join(repoRoot, 'Scripts', 'functionBank.js'));
});

function assertShieldDepletionFadesWardBeforeAdvancing(modulePath) {
  const { ApplyDamageToTarget } = loadFunctionBank(modulePath);
  const ctx = makeDamageContext();
  const hero = ctx.state.entities[0];
  ctx.state.globals.time = 2;
  ctx.state.globals.SpawnDamageText = 1;
  ctx.state.globals.PartyTempHPShield = 12;
  ctx.state.globals.PartyWardBarrierVisualsByUID = {
    [hero.uid]: {
      uid: hero.uid,
      state: 'active',
      baseAlpha: 0.82,
      fadeOutDuration: 0.28,
    },
  };

  assert.equal(ApplyDamageToTarget(ctx, hero.uid, 20), 8);
  assert.equal(ctx.state.globals.PartyTempHPShield, 0);
  assert.equal(ctx.state.globals.PartyWardBarrierVisualsByUID[hero.uid].state, 'fadeOut');
  assert.equal(ctx.state.globals.PartyWardBarrierVisualsByUID[hero.uid].fadeOutStartedAt, 2);
  assert.ok(Math.abs(ctx.state.globals.PartyWardBarrierFadeOutUntil - 2.28) < 1e-9);
  assert.ok(Math.abs(ctx.state.globals.ActionLockUntil - 2.28) < 1e-9);
  assert.equal(ctx.state.globals.DeferAdvance, 1);
  assert.equal(ctx.state.globals.AdvanceAfterAction, 1);
  assert.equal(ctx.state.globals.DamageTexts.some(text => text.kind === 'ward' && text.amount === 12), true);
  assert.equal(ctx.state.globals.DamageTexts.some(text => text.kind === 'damage' && text.targetKind === 'hero' && text.amount === 8), true);
}

test('depleting Falie Ward starts a fade-out gate before combat advances in both mirrors', () => {
  assertShieldDepletionFadesWardBeforeAdvancing(path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js'));
  assertShieldDepletionFadesWardBeforeAdvancing(path.join(repoRoot, 'Scripts', 'functionBank.js'));
});

test('party shield render expression is light blue and right-edge aligned over the PartyHP bar', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');

  assert.match(source, /#6CCBEE/);
  assert.match(source, /PartyTempHPShield/);
  assert.match(source, /Math\.min\(1, shieldValue \/ maxHP\)/);
  assert.match(source, /PartyTempHPShieldBarCanvas/);
  assert.match(source, /barX \+ barW - shieldW/);
  assert.match(source, /fillRect\(barX \+ barW - shieldW, barY, shieldW, barH\)/);
});

test('Ward barrier asset is loaded and rendered from the game assets path', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'web-runner', 'app.js'), 'utf8');
  const renderSource = fs.readFileSync(path.join(repoRoot, 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  const assetPath = path.join(repoRoot, 'web-runner', 'assets', 'images', 'falie_ward_84x62.png');

  assert.equal(fs.existsSync(assetPath), true);
  assert.match(appSource, /wardBarrierImage = await loadImage\(assetUrl\('images\/falie_ward_84x62\.png'\)\);/);
  assert.match(appSource, /wardBarrierImage,/);
  assert.match(renderSource, /PartyWardBarrierVisualsByUID/);
  assert.match(renderSource, /wardBarrierImage/);
  assert.match(renderSource, /PartyWardBarrierPosByUID/);
  assert.match(renderSource, /PartyWardBarrierTextCanvasByUID/);
  assert.match(renderSource, /drawImage\(wardBarrierImage/);
});
