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
  ForceAstralFlowSkillDraught,
  GetPartySkillDefinitions,
  GetSkillDraughtState,
  SelectSkillDraughtCard,
};`;
  const context = {
    console,
    Math,
    document: {
      documentElement: {
        attributes: {},
        getAttribute(name) {
          return Object.prototype.hasOwnProperty.call(this.attributes, name)
            ? this.attributes[name]
            : null;
        },
        setAttribute(name, value) {
          this.attributes[name] = String(value);
        },
      },
    },
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
    normalizePowerAmpLifecycleMeta,
    derivePowerAmpVisualState,
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return { ...context.module.exports, __context: context };
}

function makeContext() {
  const hero = {
    uid: 100,
    kind: 'hero',
    name: 'Falie',
    baseHeroName: 'Falie',
    heroIndex: 0,
    hp: 10,
    maxHP: 101,
    x: 10,
    y: 10,
    stats: { ATK: 4, DEF: 0, MAG: 2, RES: 0, SPD: 1 },
  };
  const globals = {
    time: 0,
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
      if (name === 'ApplyPartyHeal') {
        const heal = Math.max(0, Number(args[0] || 0));
        globals.PartyHP = Math.min(globals.PartyMaxHP, globals.PartyHP + heal);
        hero.hp = globals.PartyHP;
        globals.PartyHPByIndex[0] = hero.hp;
      }
      return undefined;
    },
  };
  return ctx;
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

function openForcedSkillDraw(mod, ctx, skillId) {
  const opened = mod.ForceAstralFlowSkillDraught(ctx, 100, skillId);
  assert.equal(opened.ok, true);
  assert.equal(opened.candidates[0].id, skillId);
  return opened;
}

function selectForcedSkill(mod, ctx, skillId) {
  const opened = openForcedSkillDraw(mod, ctx, skillId);
  const selected = mod.SelectSkillDraughtCard(ctx, 0);
  assert.equal(selected.ok, true);
  assert.equal(selected.skill.id, skillId);
  return { opened, selected };
}

function closeSkillDrawWithoutSelection(ctx) {
  ctx.state.globals.SkillDraughtOpen = 0;
  ctx.state.globals.SkillDraughtCandidates = [];
  ctx.state.globals.SkillDraughtHitZones = [];
}

function selectInjectedSkill(mod, ctx, skillId) {
  ctx.state.globals.SkillDraughtOpen = 1;
  ctx.state.globals.SkillDraughtHeroUID = 100;
  ctx.state.globals.SkillDraughtCandidates = [{
    index: 0,
    id: skillId,
    key: skillId,
    title: 'Unexpected Skill',
    owner: 'Party',
    cardText: '',
  }];
  const selected = mod.SelectSkillDraughtCard(ctx, 0);
  assert.equal(selected.ok, true);
  assert.equal(selected.skill.id, skillId);
  return selected;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function domDebug(mod) {
  return JSON.parse(mod.__context.document.documentElement.getAttribute('data-skill-draw-debug'));
}

test('skill draw debug counters track card appearances, not selected/used skills', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext();

    const emptyDebug = {
      calls: {
        party_crimson_ward: 0,
        party_magic_fruit: 0,
        party_destiny: 0,
        party_faze: 0,
        party_grow: 0,
        party_chain_strike_i: 0,
        party_chain_strike_ii: 0,
        party_arcane_pulse: 0,
        party_split: 0,
      },
      unexpectedCalls: 0,
    };
    assert.deepEqual(plain(mod.__context.__orkaSkillDrawDebug), emptyDebug);
    assert.deepEqual(plain(mod.__context.SkillDrawCalls), emptyDebug.calls);
    assert.equal(mod.__context.SkillDrawUnexpectedCalls, 0);
    assert.deepEqual(domDebug(mod), emptyDebug);
    assert.deepEqual(plain(mod.GetSkillDraughtState(ctx).skillDrawDebug), emptyDebug);
    assert.deepEqual(plain(mod.__context.__orkaSkillDrawDebug), emptyDebug);
    assert.deepEqual(domDebug(mod), emptyDebug);

    setRuntimeRandomSequence(ctx, [0.2, 0]);
    const openedAllowed = openForcedSkillDraw(mod, ctx, 'party_magic_fruit');
    assert.deepEqual(plain(openedAllowed.candidates.map(candidate => candidate.id)), [
      'party_magic_fruit',
      'party_crimson_ward',
      'party_destiny',
    ]);

    const allowedState = plain(mod.GetSkillDraughtState(ctx).skillDrawDebug);
    assert.deepEqual(allowedState.calls, {
      party_crimson_ward: 1,
      party_magic_fruit: 1,
      party_destiny: 1,
      party_faze: 0,
      party_grow: 0,
      party_chain_strike_i: 0,
      party_chain_strike_ii: 0,
      party_arcane_pulse: 0,
      party_split: 0,
    });
    assert.equal(allowedState.unexpectedCalls, 0);
    assert.deepEqual(plain(mod.__context.__orkaSkillDrawDebug), allowedState);
    assert.deepEqual(plain(mod.__context.SkillDrawCalls), allowedState.calls);
    assert.equal(mod.__context.SkillDrawUnexpectedCalls, 0);
    assert.deepEqual(domDebug(mod), allowedState);
    assert.deepEqual(plain(ctx.state.globals.SkillDrawCalls), allowedState.calls);
    assert.equal(ctx.state.globals.SkillDrawUnexpectedCalls, 0);

    const selectedAllowed = mod.SelectSkillDraughtCard(ctx, 0);
    assert.equal(selectedAllowed.ok, true);
    assert.equal(selectedAllowed.skill.id, 'party_magic_fruit');
    assert.deepEqual(plain(mod.GetSkillDraughtState(ctx).skillDrawDebug), allowedState);

    const legalOnlyCtx = makeContext();
    setRuntimeRandomSequence(legalOnlyCtx, [0.99, 0]);
    const openedLegalOnly = openForcedSkillDraw(mod, legalOnlyCtx, 'party_magic_fruit');
    assert.deepEqual(plain(openedLegalOnly.candidates.map(candidate => candidate.id)), [
      'party_magic_fruit',
      'party_split',
      'party_destiny',
    ]);
    const legalOnlyState = plain(mod.GetSkillDraughtState(legalOnlyCtx).skillDrawDebug);

    assert.deepEqual(legalOnlyState.calls, {
      party_crimson_ward: 0,
      party_magic_fruit: 1,
      party_destiny: 1,
      party_faze: 0,
      party_grow: 0,
      party_chain_strike_i: 0,
      party_chain_strike_ii: 0,
      party_arcane_pulse: 0,
      party_split: 1,
    });
    assert.equal(legalOnlyState.unexpectedCalls, 0);
    assert.deepEqual(plain(mod.__context.__orkaSkillDrawDebug), legalOnlyState);
    assert.deepEqual(domDebug(mod), legalOnlyState);
    assert.equal(mod.__context.document.documentElement.getAttribute('data-skill-draw-unexpected-calls'), '0');
    assert.equal(legalOnlyCtx.state.globals.SkillDrawUnexpectedCalls, 0);

    const injectedCtx = makeContext();
    selectInjectedSkill(mod, injectedCtx, 'non_registered_skill');
    assert.deepEqual(plain(mod.GetSkillDraughtState(injectedCtx).skillDrawDebug), emptyDebug);
  }
});

test('Force Draw by skill id respects every active skill draw class', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const defs = mod.GetPartySkillDefinitions()
      .filter(def => ['one_off', 'repeatable', 'tiered'].includes(String(def.drawClass || '')));
    const auditedIds = new Set();

    for (const def of defs.filter(row => row.drawClass === 'one_off' && row.id !== 'party_chain_strike_ii')) {
      const ctx = makeContext();
      const first = openForcedSkillDraw(mod, ctx, def.id);
      assert.equal(ctx.state.globals.SkillDraughtOneOffExposureBySkillId[def.id], 1, `${def.id} should spend on exposure`);
      assert.equal(first.forcedSkillSuppressedReason, '');

      closeSkillDrawWithoutSelection(ctx);
      const afterExposure = mod.ForceAstralFlowSkillDraught(ctx, 100, def.id);
      assert.equal(afterExposure.ok, true);
      assert.equal(afterExposure.forcedSkillSuppressedReason, 'one_off_already_exposed', `${def.id} should reject repeat forced exposure`);
      assert.equal(afterExposure.candidates.some(candidate => candidate.id === def.id), false, `${def.id} should not reappear after exposure`);
      auditedIds.add(def.id);
    }

    {
      const ctx = makeContext();
      selectForcedSkill(mod, ctx, 'party_chain_strike_i');
      const first = openForcedSkillDraw(mod, ctx, 'party_chain_strike_ii');
      assert.equal(first.forcedSkillSuppressedReason, '');
      assert.equal(ctx.state.globals.SkillDraughtOneOffExposureBySkillId.party_chain_strike_ii, 1);

      closeSkillDrawWithoutSelection(ctx);
      const afterExposure = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_chain_strike_ii');
      assert.equal(afterExposure.ok, true);
      assert.equal(afterExposure.forcedSkillSuppressedReason, 'one_off_already_exposed');
      assert.equal(afterExposure.candidates.some(candidate => candidate.id === 'party_chain_strike_ii'), false);
      auditedIds.add('party_chain_strike_ii');
    }

    for (const def of defs.filter(row => row.drawClass === 'repeatable')) {
      const ctx = makeContext();
      openForcedSkillDraw(mod, ctx, def.id);
      closeSkillDrawWithoutSelection(ctx);

      const repeated = mod.ForceAstralFlowSkillDraught(ctx, 100, def.id);
      assert.equal(repeated.ok, true);
      assert.equal(repeated.forcedSkillSuppressedReason, '', `${def.id} should remain forceable`);
      assert.equal(repeated.candidates[0].id, def.id, `${def.id} should be forceable more than once`);
      auditedIds.add(def.id);
    }

    {
      const grow = defs.find(def => def.id === 'party_grow');
      assert.ok(grow, 'party_grow should be audited as the current tiered skill');
      const maxTier = Math.max(1, Math.floor(Number(grow.effect.maxTier || 0)));
      const ctx = makeContext();
      for (let tier = 1; tier <= maxTier; tier += 1) {
        const selected = selectForcedSkill(mod, ctx, 'party_grow').selected;
        assert.equal(selected.skill.selectionCount, tier);
      }

      const afterCap = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_grow');
      assert.equal(afterCap.ok, true);
      assert.equal(afterCap.forcedSkillSuppressedReason, 'tier_cap_reached');
      assert.equal(afterCap.candidates.some(candidate => candidate.id === 'party_grow'), false);
      auditedIds.add('party_grow');
    }

    assert.equal(
      JSON.stringify([...auditedIds].sort()),
      JSON.stringify(defs.map(def => def.id).sort()),
      `${modulePath} should audit every active skill draw id`,
    );
  }
});
