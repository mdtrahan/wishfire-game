const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');
const superGemPath = path.join(repoRoot, 'web-runner', 'systems', 'superGemRuntime.js');
const renderPath = path.join(repoRoot, 'web-runner', 'systems', 'renderRuntime.js');

function loadFunctionBank(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ExecuteSkill,
  ForceAstralFlowSkillDraught,
  GetPartySkillDefinitions,
  GetSkillDraughtState,
  IsPartySessionSkillActive,
  SelectSkillDraughtCard,
  DispatchSkillCardReactionsForCombatEvent,
  TryPartyCrimsonWard,
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

function loadSuperGemRuntime() {
  const src = `${fs.readFileSync(superGemPath, 'utf8')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')}

module.exports = {
  activateSuperGemEffect,
  executePendingSuperGemAction,
};`;
  const context = { module: { exports: {} }, exports: {}, Math, Number, String, Array, Map, Set, console };
  vm.runInNewContext(src, context, { filename: superGemPath });
  return context.module.exports;
}

function sequenceRandom(values) {
  const rolls = Array.isArray(values) && values.length ? values.slice() : [0];
  let index = 0;
  return () => {
    const value = rolls[Math.min(index, rolls.length - 1)];
    index += 1;
    return value;
  };
}

function makeDrawContext(randomValues = [0]) {
  const hero = {
    uid: 100,
    kind: 'hero',
    name: 'Falie',
    baseHeroName: 'Falie',
    heroIndex: 0,
    hp: 10,
    maxHP: 101,
    stats: { ATK: 4, DEF: 0, MAG: 2, RES: 0, SPD: 1 },
  };
  const calls = [];
  const globals = {
    time: 0,
    RuntimeRandom: sequenceRandom(randomValues),
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

function makeWardContext({ active = false, randomValues = [0.49], shield = 0, maxHP = 100 } = {}) {
  const heroes = [
    { uid: 4, kind: 'hero', name: 'Falie', heroIndex: 0, hp: maxHP, maxHP, x: 10, y: 10 },
    { uid: 5, kind: 'hero', name: 'Huun', heroIndex: 1, hp: maxHP, maxHP, x: 20, y: 10 },
  ];
  return {
    state: {
      globals: {
        time: 1,
        RuntimeRandom: sequenceRandom(randomValues),
        PartyHP: maxHP,
        PartyMaxHP: maxHP,
        PartyHPByIndex: heroes.map(hero => hero.hp),
        PartyMaxHPByIndex: heroes.map(hero => hero.maxHP),
        PartyTempHPShield: shield,
        PartyTempHPShieldRatio: shield / maxHP,
        PartyTempHPShieldMax: shield > 0 ? maxHP : 0,
        SessionSkillsByHeroUID: active ? {
          __party_shared__: [{ id: 'party_crimson_ward', title: 'Crimson Ward', owner: 'Party' }],
        } : {},
        SkillProcTrace: [],
        SkillProcTraceSeq: 0,
        SkillDraughtOpen: 0,
        SkillDraughtCandidates: [],
        SkillDraughtHitZones: [],
        SkillDraughtTrace: [],
        SkillDraughtTraceSeq: 0,
      },
      entities: heroes,
    },
    callFunction() {
      return undefined;
    },
  };
}

function makeExecuteContext({ actorName = 'Huun', active = true, randomValues = [0.5, 0.99, 0.49], shield = 0 } = {}) {
  const hero = {
    uid: 4,
    kind: 'hero',
    name: actorName,
    heroIndex: 1,
    attackType: 'melee',
    hp: 100,
    maxHP: 100,
    x: 10,
    y: 10,
    stats: { ATK: 50, DEF: 0, MAG: 10, RES: 0, SPD: 10 },
  };
  const enemy = {
    uid: 200,
    kind: 'enemy',
    name: 'Wisp',
    hp: 120,
    maxHP: 120,
    stats: { ATK: 10, DEF: 0, MAG: 10, RES: 0, SPD: 5 },
  };
  return {
    state: {
      globals: {
        time: 2,
        RuntimeRandom: sequenceRandom(randomValues),
        PartyHP: 100,
        PartyMaxHP: 100,
        PartyHPByIndex: [100],
        PartyMaxHPByIndex: [100],
        PartyTempHPShield: shield,
        PartyTempHPShieldRatio: shield / 100,
        PartyTempHPShieldMax: shield > 0 ? 100 : 0,
        PowerAmpByUID: {},
        SessionSkillsByHeroUID: active ? {
          __party_shared__: [{ id: 'party_crimson_ward', title: 'Crimson Ward', owner: 'Party' }],
        } : {},
        SkillProcTrace: [],
        SkillProcTraceSeq: 0,
        SkillDraughtOpen: 0,
        SkillDraughtCandidates: [],
        SkillDraughtHitZones: [],
        SkillDraughtTrace: [],
        SkillDraughtTraceSeq: 0,
        SelectedEnemyUID: enemy.uid,
        TurnPhase: 0,
        PendingHeroHits: [],
        CombatLog: [],
        CombatActionLines: ['', '', '', ''],
      },
      entities: [hero, enemy],
    },
  };
}

function createSuperGemContext(actorName = 'Falie', { active = false } = {}) {
  const actor = { uid: 4, kind: 'hero', name: actorName, attackType: 'melee', heroIndex: 0 };
  const enemy = { uid: 200, kind: 'enemy', name: 'Wisp', hp: 100, maxHP: 100 };
  const state = {
    globals: {
      PartyHP: 100,
      PartyMaxHP: 100,
      PowerAmpByUID: {},
      RuntimeRandom: sequenceRandom([0, 0.49]),
      SelectedEnemyUID: enemy.uid,
      time: 1,
      SessionSkillsByHeroUID: active ? {
        __party_shared__: [{ id: 'party_crimson_ward', title: 'Crimson Ward', owner: 'Party' }],
      } : {},
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
    if (name === 'TryPartyCrimsonWard') {
      const opts = args[0] || {};
      if (!active) return { ok: false, success: false, reason: 'skill_locked' };
      state.globals.PartyTempHPShield = Math.min(100, Math.max(0, Number(state.globals.PartyTempHPShield || 0)) + Number(opts.totalDamage || 0));
      state.globals.LastPartyCrimsonWard = {
        success: true,
        source: String(opts.source || ''),
        totalDamage: Number(opts.totalDamage || 0),
      };
      return { ok: true, success: true, reason: 'shielded', after: state.globals.PartyTempHPShield };
    }
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

test('skill card draw uses a five-card unweighted party pool and keeps Magic Fruit', () => {
  const expectedDrawPool = [
    'party_fresh_start',
    'party_second_chance',
    'party_momentum',
    'party_magic_fruit',
    'party_crimson_ward',
  ];

  for (const filePath of [runtimePath, scriptsPath]) {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.match(src, /const PARTY_SKILL_DRAUGHT_POOL_IDS = Object\.freeze\(\[/);
    for (const id of expectedDrawPool) assert.match(src, new RegExp(`'${id}'`));
    assert.match(src, /id: 'party_magic_fruit'[\s\S]*title: 'Magic Fruit'/);
    assert.match(src, /id: 'party_crimson_ward'[\s\S]*title: 'Crimson Ward'/);
    assert.match(src, /cardText: 'Chance for a magical ward to shield damage when matching red gems\.'/);
    assert.doesNotMatch(src, /withoutMagicFruit/);
  }

  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadFunctionBank(modulePath);
    const partyIds = Array.from(mod.GetPartySkillDefinitions(), skill => skill.id);
    assert.ok(partyIds.includes('party_magic_fruit'));
    assert.ok(partyIds.includes('party_crimson_ward'));

    const seenInDraws = new Set();
    for (let seed = 0; seed < 100; seed += 1) {
      const first = ((seed * 37) % 100) / 100;
      const second = ((seed * 53 + 17) % 100) / 100;
      const third = ((seed * 71 + 31) % 100) / 100;
      const { ctx: sampleCtx } = makeDrawContext([first, second, third]);
      const sampleDraw = mod.ForceAstralFlowSkillDraught(sampleCtx, 100);
      assert.equal(sampleDraw.ok, true);
      assert.equal(sampleDraw.candidates.length, 3);
      assert.equal(new Set(sampleDraw.candidates.map(candidate => candidate.id)).size, 3);
      for (const candidate of sampleDraw.candidates) {
        assert.ok(expectedDrawPool.includes(candidate.id), `unexpected draw candidate ${candidate.id}`);
        seenInDraws.add(candidate.id);
      }
    }
    assert.deepEqual(
      JSON.parse(JSON.stringify(Array.from(seenInDraws).sort())),
      expectedDrawPool.slice().sort()
    );

    const { ctx: lowCtx } = makeDrawContext([0, 0, 0]);
    const lowDraw = mod.ForceAstralFlowSkillDraught(lowCtx, 100);
    assert.equal(lowDraw.ok, true);
    assert.deepEqual(JSON.parse(JSON.stringify(lowDraw.candidates.map(candidate => candidate.id))), expectedDrawPool.slice(0, 3));

    const { ctx: highCtx } = makeDrawContext([0.99, 0.99, 0.99]);
    const highDraw = mod.ForceAstralFlowSkillDraught(highCtx, 100);
    assert.equal(highDraw.ok, true);
    assert.equal(highDraw.candidates.length, 3);
    assert.equal(new Set(highDraw.candidates.map(candidate => candidate.id)).size, 3);
    assert.ok(highDraw.candidates.some(candidate => candidate.id === 'party_crimson_ward'));

    const { ctx: magicCtx } = makeDrawContext([0.75, 0, 0]);
    const magicDraw = mod.ForceAstralFlowSkillDraught(magicCtx, 100);
    assert.equal(magicDraw.ok, true);
    assert.ok(magicDraw.candidates.some(candidate => candidate.id === 'party_magic_fruit'));
    assert.ok(magicDraw.candidates.every(candidate => expectedDrawPool.includes(candidate.id)));
  }
});

test('Crimson Ward can be selected without replacing Magic Fruit behavior', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadFunctionBank(modulePath);

    const { ctx: wardCtx, calls: wardCalls } = makeDrawContext([0]);
    const wardOpened = mod.ForceAstralFlowSkillDraught(wardCtx, 100, 'party_crimson_ward');
    assert.equal(wardOpened.ok, true);
    assert.equal(wardOpened.candidates[0].id, 'party_crimson_ward');
    assert.equal(wardOpened.candidates[0].title, 'Crimson Ward');
    assert.equal(wardOpened.candidates[0].cardText, 'Chance for a magical ward to shield damage when matching red gems.');
    const wardSelected = mod.SelectSkillDraughtCard(wardCtx, 0);
    assert.equal(wardSelected.ok, true);
    assert.equal(mod.IsPartySessionSkillActive(wardCtx, 'party_crimson_ward'), true);
    assert.equal(wardCtx.state.globals.PartyHP, 10);
    assert.equal(wardCalls.some(call => call.name === 'ApplyPartyHeal'), false);
    assert.match(wardCtx.state.globals.CombatLog.join('\n'), /Crimson Ward activated\./);

    const { ctx: stackedWardCtx } = makeDrawContext([0]);
    stackedWardCtx.state.globals.PartyHP = 70;
    stackedWardCtx.state.globals.PartyMaxHP = 100;
    stackedWardCtx.state.globals.PartyTempHPShield = 30;
    stackedWardCtx.state.globals.PartyTempHPShieldRatio = 0.3;
    stackedWardCtx.state.globals.PartyTempHPShieldMax = 100;
    const stackedWardOpened = mod.ForceAstralFlowSkillDraught(stackedWardCtx, 100, 'party_crimson_ward');
    assert.equal(stackedWardOpened.ok, true);
    const stackedWardSelected = mod.SelectSkillDraughtCard(stackedWardCtx, 0);
    assert.equal(stackedWardSelected.ok, true);
    assert.equal(stackedWardCtx.state.globals.PartyTempHPShield, 44);
    assert.equal(stackedWardCtx.state.globals.PartyTempHPShieldRatio, 0.44);
    assert.equal(stackedWardCtx.state.globals.PartyTempHPShieldMax, 100);
    assert.equal(stackedWardCtx.state.globals.PartyTempHPShieldAlpha, 0.85);
    assert.equal(stackedWardCtx.state.globals.LastPartyCrimsonWardSelectionBoost.added, 14);
    assert.equal(stackedWardCtx.state.globals.LastPartyCrimsonWardSelectionBoost.source, 'crimson_ward_selection');

    const { ctx: cappedWardCtx } = makeDrawContext([0]);
    cappedWardCtx.state.globals.PartyHP = 70;
    cappedWardCtx.state.globals.PartyMaxHP = 100;
    cappedWardCtx.state.globals.PartyTempHPShield = 95;
    cappedWardCtx.state.globals.PartyTempHPShieldRatio = 0.95;
    cappedWardCtx.state.globals.PartyTempHPShieldMax = 100;
    mod.ForceAstralFlowSkillDraught(cappedWardCtx, 100, 'party_crimson_ward');
    const cappedWardSelected = mod.SelectSkillDraughtCard(cappedWardCtx, 0);
    assert.equal(cappedWardSelected.ok, true);
    assert.equal(cappedWardCtx.state.globals.PartyTempHPShield, 100);
    assert.equal(cappedWardCtx.state.globals.LastPartyCrimsonWardSelectionBoost.added, 5);
    assert.equal(cappedWardCtx.state.globals.LastPartyCrimsonWardSelectionBoost.capHit, true);

    const { ctx: fruitCtx, calls: fruitCalls } = makeDrawContext([0]);
    const fruitOpened = mod.ForceAstralFlowSkillDraught(fruitCtx, 100, 'party_magic_fruit');
    assert.equal(fruitOpened.ok, true);
    assert.equal(fruitOpened.candidates[0].id, 'party_magic_fruit');
    const fruitSelected = mod.SelectSkillDraughtCard(fruitCtx, 0);
    assert.equal(fruitSelected.ok, true);
    assert.equal(fruitCtx.state.globals.PartyHP, 51);
    assert.deepEqual(
      fruitCalls.filter(call => call.name === 'ApplyPartyHeal').map(call => call.args),
      [[41]]
    );
  }
});

test('Crimson Ward rolls 50 percent and adds shield equal to red attack damage up to party HP cap', () => {
  const mod = loadFunctionBank(runtimePath);

  const inactive = makeWardContext({ active: false });
  const locked = mod.TryPartyCrimsonWard(inactive, { sourceUID: 4, totalDamage: 25, source: 'red_match' });
  assert.equal(locked.success, false);
  assert.equal(locked.reason, 'skill_locked');
  assert.equal(inactive.state.globals.PartyTempHPShield || 0, 0);

  const miss = makeWardContext({ active: true, randomValues: [0.51] });
  const missed = mod.TryPartyCrimsonWard(miss, { sourceUID: 4, totalDamage: 25, source: 'red_match' });
  assert.equal(missed.success, false);
  assert.equal(missed.reason, 'proc_miss');
  assert.equal(miss.state.globals.PartyTempHPShield || 0, 0);
  assert.equal(miss.state.globals.PartyCrimsonWardMisses, 1);

  const proc = makeWardContext({ active: true, randomValues: [0.49], shield: 90, maxHP: 100 });
  const result = mod.TryPartyCrimsonWard(proc, { sourceUID: 4, totalDamage: 25, source: 'red_match' });
  assert.equal(result.success, true);
  assert.equal(result.reason, 'shielded');
  assert.equal(proc.state.globals.PartyTempHPShield, 100);
  assert.equal(proc.state.globals.PartyTempHPShieldRatio, 1);
  assert.equal(proc.state.globals.PartyTempHPShieldMax, 100);
  assert.equal(proc.state.globals.PartyTempHPShieldColor, '#6CCBEE');
  assert.equal(proc.state.globals.PartyTempHPShieldSource, 'party_crimson_ward_red_match');
  assert.equal(proc.state.globals.PartyWardBarrierBaseAlpha, 0.85);
  assert.equal(proc.state.globals.PartyWardBarrierVisualsByUID[4].baseAlpha, 0.85);
  assert.equal(proc.state.globals.LastPartyCrimsonWard.added, 10);
  assert.equal(proc.state.globals.LastPartyCrimsonWard.capHit, true);
});

test('normal red attack emits a neutral skill reaction event and Crimson Ward listens only when active', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadFunctionBank(modulePath);

    const activeCtx = makeExecuteContext({ actorName: 'Huun', active: true, randomValues: [0.5, 0.99, 0.49] });
    activeCtx.state.globals.PendingGemActionEvent = {
      source: 'gem_match',
      color: 1,
      colorName: 'RED',
      actorUID: 4,
      skillId: 'HERO_SINGLE',
      eventName: 'red_match',
    };
    mod.ExecuteSkill(activeCtx, 'HERO_SINGLE', 4);
    assert.equal(activeCtx.state.globals.PendingHeroHits.length, 1);
    assert.equal(activeCtx.state.globals.PendingHeroHits[0].finalDmg, 50);
    assert.equal(activeCtx.state.globals.PendingHeroHits[0].crimsonWardTrigger, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(activeCtx.state.globals.PendingHeroHits[0].skillReactionEvent)), {
      type: 'hero_attack_damage',
      phase: 'post_hit',
      source: 'gem_match',
      color: 1,
      colorName: 'RED',
      actorUID: 4,
      targetUID: 200,
      skillId: 'HERO_SINGLE',
      eventName: 'red_match',
      amountType: 'damage',
    });
    assert.equal(activeCtx.state.globals.PartyTempHPShield || 0, 0);
    const proc = mod.DispatchSkillCardReactionsForCombatEvent(activeCtx, {
      ...activeCtx.state.globals.PendingHeroHits[0].skillReactionEvent,
      totalDamage: activeCtx.state.globals.PendingHeroHits[0].finalDmg,
    });
    assert.equal(proc.success, true);
    assert.equal(proc.reactions[0].skillId, 'party_crimson_ward');
    assert.equal(activeCtx.state.globals.PartyTempHPShield, 50);
    assert.equal(activeCtx.state.globals.LastPartyCrimsonWard.source, 'red_match');

    const inactiveCtx = makeExecuteContext({ actorName: 'Huun', active: false, randomValues: [0.49] });
    inactiveCtx.state.globals.PendingGemActionEvent = {
      source: 'gem_match',
      color: 1,
      colorName: 'RED',
      actorUID: 4,
      skillId: 'HERO_SINGLE',
      eventName: 'red_match',
    };
    mod.ExecuteSkill(inactiveCtx, 'HERO_SINGLE', 4);
    const locked = mod.DispatchSkillCardReactionsForCombatEvent(inactiveCtx, {
      ...inactiveCtx.state.globals.PendingHeroHits[0].skillReactionEvent,
      totalDamage: inactiveCtx.state.globals.PendingHeroHits[0].finalDmg,
    });
    assert.equal(locked.success, false);
    assert.equal(locked.reason, 'no_reactions');
    assert.equal(locked.reactions.length, 0);
    assert.equal(inactiveCtx.state.globals.PartyTempHPShield || 0, 0);

    const directCtx = makeExecuteContext({ actorName: 'Huun', active: true, randomValues: [0.49] });
    mod.ExecuteSkill(directCtx, 'HERO_SINGLE', 4);
    assert.equal(directCtx.state.globals.PendingHeroHits.length, 1);
    assert.equal(directCtx.state.globals.PendingHeroHits[0].skillReactionEvent, undefined);
    assert.equal(directCtx.state.globals.PendingHeroHits[0].crimsonWardTrigger, undefined);

    const falieCtx = makeExecuteContext({ actorName: 'Falie', active: false, randomValues: [0.5, 0.99], shield: 36 });
    mod.ExecuteSkill(falieCtx, 'HERO_SINGLE', 4);
    assert.equal(falieCtx.state.globals.PendingHeroHits.length, 1);
    assert.equal(falieCtx.state.globals.PartyTempHPShield, 36);
    assert.notEqual(falieCtx.state.globals.PartyTempHPShieldSource, 'falie_red_sustain');
  }
});

test('Falie red supergem uses standard attack path and never feeds Crimson Ward', () => {
  const runtime = loadSuperGemRuntime();

  const inactive = createSuperGemContext('Falie', { active: false });
  assert.equal(activateRedSuperGem(runtime, inactive), true);
  assert.equal(inactive.state.globals.PendingSkillID, 'HERO_SINGLE');
  assert.equal(inactive.state.globals.PendingSuperGemAction.kind, 'super_gem_attack');
  assert.equal(inactive.state.globals.PartyTempHPShield || 0, 0);

  const active = createSuperGemContext('Falie', { active: true });
  assert.equal(activateRedSuperGem(runtime, active), true);
  assert.equal(runtime.executePendingSuperGemAction(active), true);
  assert.equal(active.state.globals.PendingSuperGemAction, null);
  assert.equal(active.state.globals.PendingHeroHits.length, 3);
  assert.equal(active.state.globals.PendingHeroHits.filter(hit => Number(hit.superGemClusterApplyTotalOnHit || 0) > 0).length, 1);
  assert.equal(active.state.globals.PendingHeroHits.at(-1).superGemClusterApplyTotalOnHit, 40);
  assert.equal(active.calls.some(call => call.name === 'TryPartyCrimsonWard'), false);
  assert.equal(active.state.globals.PartyTempHPShield || 0, 0);
  assert.equal(active.state.globals.PendingHeroHits.at(-1).crimsonWardTrigger, undefined);
  assert.equal(active.state.globals.PendingHeroHits.at(-1).skillReactionEvent, undefined);
  const mod = loadFunctionBank(runtimePath);
  const supergemSource = mod.DispatchSkillCardReactionsForCombatEvent({
    state: active.state,
    callFunction() {
      return undefined;
    },
  }, {
    type: 'hero_attack_damage',
    phase: 'post_hit',
    source: 'supergem',
    color: 1,
    colorName: 'RED',
    actorUID: 4,
    targetUID: 200,
    skillId: 'HERO_SINGLE',
    eventName: 'red_match',
    amountType: 'damage',
    totalDamage: active.state.globals.PendingHeroHits.at(-1).superGemClusterApplyTotalOnHit,
  });
  assert.equal(supergemSource.success, false);
  assert.equal(supergemSource.reason, 'no_reactions');
  assert.equal(supergemSource.reactions.length, 0);

  const supergemEventName = mod.DispatchSkillCardReactionsForCombatEvent({
    state: active.state,
    callFunction() {
      return undefined;
    },
  }, {
    type: 'hero_attack_damage',
    phase: 'post_hit',
    source: 'gem_match',
    color: 1,
    colorName: 'RED',
    actorUID: 4,
    targetUID: 200,
    skillId: 'HERO_SINGLE',
    eventName: 'red_supergem',
    amountType: 'damage',
    totalDamage: active.state.globals.PendingHeroHits.at(-1).superGemClusterApplyTotalOnHit,
  });
  assert.equal(supergemEventName.success, false);
  assert.equal(supergemEventName.reason, 'no_reactions');
  assert.equal(supergemEventName.reactions.length, 0);
  assert.equal(active.state.globals.PartyTempHPShield || 0, 0);
});

test('Crimson Ward shield render expression keeps right-edge bar fill and 85 percent alpha fallback', () => {
  const source = fs.readFileSync(renderPath, 'utf8');
  assert.match(source, /#6CCBEE/);
  assert.match(source, /PartyTempHPShield/);
  assert.match(source, /Math\.min\(1, shieldValue \/ maxHP\)/);
  assert.match(source, /PartyTempHPShieldBarCanvas/);
  assert.match(source, /barX \+ barW - shieldW/);
  assert.match(source, /fillRect\(barX \+ barW - shieldW, barY, shieldW, barH\)/);
  assert.match(source, /PartyWardBarrierBaseAlpha \|\| 0\.85/);
  assert.match(source, /PartyTempHPShieldAlpha \|\| state\.globals\.PartyWardBarrierBaseAlpha \|\| 0\.85/);
  assert.match(source, /ctx\.globalAlpha = shieldAlpha/);
});
