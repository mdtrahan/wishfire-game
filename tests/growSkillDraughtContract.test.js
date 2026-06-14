const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');

function normalizePowerAmpLifecycleMeta(existingMeta, lifecycleId = 0) {
  const normalizedLife = Number(lifecycleId || 0);
  if (existingMeta && Number(existingMeta.lifecycleId || 0) === normalizedLife) {
    return { ...existingMeta, lifecycleId: normalizedLife };
  }
  return {
    lifecycleId: normalizedLife,
    visualStarted: false,
    visualStartAt: 0,
    consumed: false,
    fadeStarted: false,
    fadeStartAt: 0,
    closed: false,
  };
}

function derivePowerAmpVisualState({ existingVisual, existingMeta, now, mult, lifecycleId }) {
  const normalizedLife = Number(lifecycleId || 0);
  const safeNow = Number(now || 0);
  const meta = normalizePowerAmpLifecycleMeta(existingMeta, normalizedLife);
  const visual = existingVisual && Number(existingVisual.lifecycleId || 0) === normalizedLife
    ? { ...existingVisual, mult }
    : { mult, startAt: safeNow, lifecycleId: normalizedLife };
  meta.visualStarted = true;
  meta.visualStartAt = Number(visual.startAt || safeNow);
  return {
    meta,
    visual,
    seeded: visual.startAt === safeNow,
    startAt: Number(visual.startAt || safeNow),
    lifecycleId: normalizedLife,
  };
}

function loadModule(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ClearSessionSkillDraught,
  ForceAstralFlowSkillDraught,
  GetEffectiveStat,
  GetGrowSkillState,
  GetPartySkillDefinitions,
  GetPowerAmpMultiplierForActor,
  GetSkillDraughtState,
  SelectSkillDraughtCard,
};`;
  const context = {
    console,
    Math,
    normalizePowerAmpLifecycleMeta,
    derivePowerAmpVisualState,
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function makeContext() {
  const heroes = [
    {
      uid: 100,
      kind: 'hero',
      name: 'Falie',
      baseHeroName: 'Falie',
      heroIndex: 0,
      attackType: 'melee',
      hp: 80,
      maxHP: 100,
      stats: { ATK: 50, DEF: 100, MAG: 20, RES: 100, SPD: 10 },
    },
    {
      uid: 101,
      kind: 'hero',
      name: 'Huun',
      baseHeroName: 'Huun',
      heroIndex: 1,
      attackType: 'melee',
      hp: 70,
      maxHP: 100,
      stats: { ATK: 40, DEF: 100, MAG: 10, RES: 100, SPD: 10 },
    },
    {
      uid: 102,
      kind: 'hero',
      name: 'Runa',
      baseHeroName: 'Runa',
      heroIndex: 2,
      attackType: 'magic',
      hp: 60,
      maxHP: 100,
      stats: { ATK: 10, DEF: 100, MAG: 50, RES: 100, SPD: 10 },
    },
    {
      uid: 103,
      kind: 'hero',
      name: 'Kojonn',
      baseHeroName: 'Kojonn',
      heroIndex: 3,
      attackType: 'magic',
      hp: 0,
      maxHP: 100,
      stats: { ATK: 10, DEF: 100, MAG: 30, RES: 100, SPD: 10 },
    },
  ];
  const globals = {
    time: 10,
    PartyHP: 210,
    PartyMaxHP: 400,
    PartyHPByIndex: [80, 70, 60, 0],
    PartyMaxHPByIndex: [100, 100, 100, 100],
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
    PowerAmpByUID: {},
    PowerAmpVisualByUID: {},
    PowerAmpFadeByUID: {},
    PowerAmpLifecycleMetaByUID: {},
    PowerAmpLifecycleSeq: 0,
  };
  return {
    state: { globals, entities: heroes },
    callFunction() {
      return undefined;
    },
  };
}

function setRuntimeRandomSequence(ctx, values) {
  let index = 0;
  ctx.state.globals.RuntimeRandom = () => {
    const fallback = values.length ? values[values.length - 1] : 0;
    const value = index < values.length ? values[index] : fallback;
    index += 1;
    return value;
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function selectGrow(mod, ctx, randomValues) {
  setRuntimeRandomSequence(ctx, randomValues);
  const opened = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_grow');
  assert.equal(opened.ok, true);
  assert.equal(opened.candidates[0].id, 'party_grow');
  const selected = mod.SelectSkillDraughtCard(ctx, 0);
  assert.equal(selected.ok, true);
  assert.equal(selected.skill.id, 'party_grow');
  return { opened, selected };
}

test('Grow is a mirrored deterministic tiered party draw card with cap metadata', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const partyGrow = mod.GetPartySkillDefinitions().find(def => def.id === 'party_grow');
    assert.ok(partyGrow, `${modulePath} should define party_grow`);
    assert.equal(partyGrow.title, 'Grow');
    assert.equal(partyGrow.drawClass, 'tiered');
    assert.equal(partyGrow.selection.duplicatePolicy, 'allow_until_cap');
    assert.equal(partyGrow.effect.kind, 'grow');
    assert.equal(partyGrow.effect.maxTier, 3);
    assert.equal(partyGrow.effect.acceptanceChancePct, undefined);
    assert.deepEqual(plain(partyGrow.effect.powerAmpPctByTier), [8, 14, 20]);
    assert.deepEqual(plain(partyGrow.effect.maxHpPenaltyPctByTier), [8, 14, 20]);
    assert.equal(partyGrow.effect.defensePenaltyPctByTier, undefined);
  }
});

test('Grow selection deterministically gives all living heroes persistent Max HP tradeoff state', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext();

    const { selected } = selectGrow(mod, ctx, [0.99, 0.99, 0.99, 0.99, 0.99]);

    assert.equal(selected.skill.drawClass, 'tiered');
    assert.equal(selected.skill.rank, 1);
    assert.equal(ctx.state.globals.SkillDraughtOpen, 0, 'Grow resolution happens after modal close');
    assert.equal(ctx.state.globals.GrowTier, 1);
    assert.equal(ctx.state.globals.GrowSelectionCount, 1);

    const growState = mod.GetGrowSkillState(ctx);
    assert.equal(growState.tier, 1);
    assert.deepEqual(plain(Object.keys(growState.heroes).sort()), ['100', '101', '102']);
    assert.equal(growState.heroes['100'].powerAmpPct, 8);
    assert.equal(growState.heroes['100'].maxHpPenaltyPct, 8);
    assert.equal(growState.heroes['102'].powerAmpMultiplier, 1.08);
    assert.equal(mod.GetPowerAmpMultiplierForActor(ctx, 100), 1.08);
    assert.equal(mod.GetPowerAmpMultiplierForActor(ctx, 101), 1.08);
    assert.equal(ctx.state.entities[0].maxHP, 92);
    assert.equal(ctx.state.entities[0].hp, 73);
    assert.equal(ctx.state.entities[1].maxHP, 92);
    assert.equal(ctx.state.entities[1].hp, 64);
    assert.equal(ctx.state.entities[2].maxHP, 92);
    assert.equal(ctx.state.entities[2].hp, 55);
    assert.equal(ctx.state.globals.PartyMaxHPByIndex[0], 92);
    assert.equal(ctx.state.globals.PartyHPByIndex[0], 73);
    assert.equal(ctx.state.globals.PartyMaxHPByIndex[1], 92);
    assert.equal(ctx.state.globals.PartyHPByIndex[1], 64);
    assert.equal(ctx.state.globals.PartyMaxHPByIndex[2], 92);
    assert.equal(ctx.state.globals.PartyHPByIndex[2], 55);
    assert.equal(ctx.state.globals.PartyMaxHP, 376);
    assert.equal(ctx.state.globals.PartyHP, 192);
    assert.equal(mod.GetEffectiveStat(ctx, ctx.state.entities[0], 'DEF'), 100);
    assert.equal(mod.GetEffectiveStat(ctx, ctx.state.entities[0], 'RES'), 100);
    assert.equal(mod.GetEffectiveStat(ctx, ctx.state.entities[0], 'ATK'), 50);
    assert.equal(ctx.state.entities[3].maxHP, 100, 'dead heroes are not acquired by deterministic Grow');
    assert.equal(ctx.state.entities[3].hp, 0);

    assert.deepEqual(plain(ctx.state.globals.GrowAcquisitionQueue), []);
    assert.ok(ctx.state.globals.GrowAcquisitionTrace.every(event => event.deterministic === 1));
    assert.ok(ctx.state.globals.GrowAcquisitionTrace.every(event => event.roll === undefined));
    assert.ok(ctx.state.globals.GrowAcquisitionTrace.every(event => event.accepted === undefined));
    assert.equal(ctx.state.globals.PowerAmpVisualByUID[100].source, 'party_grow');
    assert.equal(ctx.state.globals.PowerAmpVisualByUID[100].growTier, 1);
    assert.equal(ctx.state.globals.PowerAmpVisualByUID[101].source, 'party_grow');
    assert.equal(ctx.state.globals.PowerAmpVisualByUID[102].source, 'party_grow');
    assert.equal(ctx.state.globals.PowerAmpVisualByUID[103], undefined);
  }
});

test('Grow tier updates existing grown heroes without rerolling and leaves the pool after tier three', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext();

    selectGrow(mod, ctx, [0, 0, 0.9, 0.9, 0.9]);
    assert.deepEqual(plain(Object.keys(mod.GetGrowSkillState(ctx).heroes).sort()), ['100', '101', '102']);
    assert.equal(ctx.state.globals.GrowAcquisitionQueue.length, 0);

    ctx.state.entities[3].hp = 50;
    ctx.state.globals.PartyHPByIndex[3] = 50;
    ctx.state.globals.PartyHP = 242;

    ctx.state.globals.time += 1;
    const second = selectGrow(mod, ctx, [0, 0, 0.9, 0.9]);
    assert.equal(second.selected.skill.rank, 2);
    assert.equal(ctx.state.globals.GrowTier, 2);
    assert.deepEqual(plain(ctx.state.globals.GrowAcquisitionQueue), []);
    assert.deepEqual(plain(Object.keys(mod.GetGrowSkillState(ctx).heroes).sort()), ['100', '101', '102', '103']);
    assert.equal(mod.GetGrowSkillState(ctx).heroes['100'].currentTier, 2);
    assert.equal(mod.GetGrowSkillState(ctx).heroes['100'].powerAmpPct, 14);
    assert.equal(mod.GetGrowSkillState(ctx).heroes['100'].maxHpPenaltyPct, 14);
    assert.equal(ctx.state.entities[0].maxHP, 86);
    assert.equal(ctx.state.entities[0].hp, 68);
    assert.equal(ctx.state.entities[1].maxHP, 86);
    assert.equal(ctx.state.entities[1].hp, 59);
    assert.equal(ctx.state.entities[2].maxHP, 86);
    assert.equal(ctx.state.entities[2].hp, 51);
    assert.equal(ctx.state.entities[3].maxHP, 86);
    assert.equal(ctx.state.entities[3].hp, 43);
    assert.equal(mod.GetEffectiveStat(ctx, ctx.state.entities[0], 'DEF'), 100);

    const visualStartAt = ctx.state.globals.PowerAmpVisualByUID[100].startAt;
    ctx.state.globals.time += 1;
    const third = selectGrow(mod, ctx, [0, 0]);
    assert.equal(third.selected.skill.rank, 3);
    assert.equal(ctx.state.globals.GrowTier, 3);
    assert.deepEqual(plain(ctx.state.globals.GrowAcquisitionQueue), []);
    assert.equal(mod.GetGrowSkillState(ctx).heroes['100'].currentTier, 3);
    assert.equal(mod.GetGrowSkillState(ctx).heroes['100'].powerAmpPct, 20);
    assert.equal(mod.GetPowerAmpMultiplierForActor(ctx, 100), 1.2);
    assert.equal(ctx.state.entities[0].maxHP, 80);
    assert.equal(ctx.state.entities[0].hp, 63);
    assert.equal(ctx.state.entities[1].maxHP, 80);
    assert.equal(ctx.state.entities[1].hp, 54);
    assert.equal(ctx.state.entities[2].maxHP, 80);
    assert.equal(ctx.state.entities[2].hp, 47);
    assert.equal(ctx.state.entities[3].maxHP, 80);
    assert.equal(ctx.state.entities[3].hp, 40);
    assert.equal(ctx.state.globals.PartyMaxHPByIndex[0], 80);
    assert.equal(ctx.state.globals.PartyHPByIndex[0], 63);
    assert.equal(ctx.state.globals.PowerAmpVisualByUID[100].startAt, visualStartAt, 'tier updates do not regrow the hero');

    setRuntimeRandomSequence(ctx, [0, 0, 0]);
    const afterCap = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_grow');
    assert.equal(afterCap.ok, true);
    assert.equal(afterCap.candidates.some(candidate => candidate.id === 'party_grow'), false);
    assert.equal(mod.GetSkillDraughtState(ctx).lastForcedSkillSuppressedReason, 'tier_cap_reached');
  }
});

test('Grow tier updates remain percentage-based when natural Max HP increases', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext();

    selectGrow(mod, ctx, [0, 0, 0.1, 0.9, 0.9]);
    assert.equal(ctx.state.entities[0].maxHP, 92);
    assert.equal(ctx.state.entities[0].hp, 73);

    ctx.state.entities[0].baseMaxHP = 120;
    ctx.state.globals.time += 1;
    selectGrow(mod, ctx, [0, 0, 0.9, 0.9]);

    assert.equal(ctx.state.entities[0].growBaseMaxHP, 120);
    assert.equal(ctx.state.entities[0].maxHP, 103);
    assert.equal(ctx.state.entities[0].hp, 81);
    assert.equal(mod.GetGrowSkillState(ctx).heroes['100'].baseMaxHP, 120);
    assert.equal(ctx.state.globals.PartyMaxHPByIndex[0], 103);
    assert.equal(ctx.state.globals.PartyHPByIndex[0], 81);
  }
});

test('Grow clears with the session skill draught reset', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext();

    selectGrow(mod, ctx, [0, 0, 0.1, 0.1, 0.1]);
    assert.equal(ctx.state.globals.GrowTier, 1);
    assert.equal(Object.keys(ctx.state.globals.GrowStateByHeroUID).length, 3);

    const cleared = mod.ClearSessionSkillDraught(ctx);
    assert.equal(cleared.ok, true);
    assert.equal(ctx.state.globals.GrowTier, 0);
    assert.deepEqual(plain(ctx.state.globals.GrowStateByHeroUID), {});
    assert.deepEqual(plain(ctx.state.globals.GrowAcquisitionQueue), []);
    assert.equal(mod.GetPowerAmpMultiplierForActor(ctx, 100), 0);
    assert.equal(ctx.state.entities[0].maxHP, 100);
    assert.ok(ctx.state.entities[0].hp <= ctx.state.entities[0].maxHP);
    assert.equal(ctx.state.globals.PartyMaxHPByIndex[0], 100);
    assert.equal(ctx.state.globals.PowerAmpVisualByUID[100], undefined);
  }
});
