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
  const actor = { uid: 4, kind: 'hero', name: actorName, attackType: 'melee' };
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

function resolveRedSuperGem(runtime, context) {
  context.state.globals.PendingSuperGemAction = {
    kind: 'super_gem_attack',
    color: 1,
    hitCount: 3,
    actorUID: 4,
  };
  context.state.globals.SelectedEnemyUID = 200;
  return runtime.executePendingSuperGemAction(context);
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

test('Falie red super-gem use grants party tempHP shield immediately without arming the red attack path', () => {
  const runtime = loadSuperGemRuntime();
  const context = createSuperGemContext('Falie');
  const expected = [
    { stacks: 1, shield: 36, ratio: 0.18 },
    { stacks: 2, shield: 52, ratio: 0.26 },
    { stacks: 3, shield: 68, ratio: 0.34 },
    { stacks: 4, shield: 84, ratio: 0.42 },
    { stacks: 5, shield: 100, ratio: 0.5 },
  ];

  for (const step of expected) {
    assert.equal(activateRedSuperGem(runtime, context), true);
    assert.equal(context.state.globals.PendingSkillID || '', '');
    assert.equal(context.state.globals.PendingSuperGemAction || null, null);
    assert.equal(context.state.globals.PartyTempHPShieldStacks, step.stacks);
    assert.equal(context.state.globals.PartyTempHPShield, step.shield);
    assert.equal(context.state.globals.PartyTempHPShieldRatio, step.ratio);
    assert.equal(context.state.globals.PartyTempHPShieldColor, '#6CCBEE');
    assert.equal(context.state.globals.PartyHP, 200);
    assert.equal(context.state.globals.DeferAdvance, 1);
    assert.equal(context.state.globals.AdvanceAfterAction, 1);
  }
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

test('party shield render expression is light blue and right-edge aligned over the PartyHP bar', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');

  assert.match(source, /#6CCBEE/);
  assert.match(source, /PartyTempHPShield/);
  assert.match(source, /PartyTempHPShieldBarCanvas/);
  assert.match(source, /barX \+ barW - shieldW/);
  assert.match(source, /fillRect\(barX \+ barW - shieldW, barY, shieldW, barH\)/);
});
