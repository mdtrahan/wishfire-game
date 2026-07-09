const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');
const appPath = path.join(repoRoot, 'web-runner', 'app.js');

function loadModule(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ForceAstralFlowSkillDraught,
  GetPartySkillDefinitions,
  GetSkillDefinition,
  GetSkillDraughtState,
  SelectSkillDraughtCard,
  ClearSessionSkillDraught,
  IsPartySessionSkillActive,
  RollPartySkillProc,
  TryPartyDestiny,
  TriggerPartyDestinyDev,
  ApplyDamageToTarget,
  GetSkillProcTrace,
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

function makeContext({ active = false } = {}) {
  const hero = {
    uid: 100,
    kind: 'hero',
    name: 'Falie',
    baseHeroName: 'Falie',
    heroIndex: 0,
    hp: 100,
    maxHP: 100,
    x: 10,
    y: 10,
    stats: { ATK: 4, DEF: 0, MAG: 2, RES: 0, SPD: 1 },
  };
  const enemy = {
    uid: 200,
    kind: 'enemy',
    name: 'Marid',
    hp: 100,
    maxHP: 100,
    x: 20,
    y: 20,
    stats: { ATK: 4, DEF: 0, MAG: 2, RES: 0, SPD: 1 },
  };
  const globals = {
    time: 0,
    RuntimeRandom: () => 0.99,
    PartyHP: 100,
    PartyMaxHP: 100,
    PartyHPByIndex: [100],
    PartyMaxHPByIndex: [100],
    TurnOrderArray: [{ uid: 100, type: 0, spd: 1 }, { uid: 200, type: 1, spd: 1 }],
    CurrentTurnIndex: 0,
    CombatLog: [],
    CombatActionLines: ['', '', '', ''],
    SkillDraughtOpen: 0,
    SkillDraughtHeroUID: 0,
    SkillDraughtCandidates: [],
    SkillDraughtHitZones: [],
    SkillDraughtSelectedSkillId: '',
    SessionSkillsByHeroUID: active ? {
      __party_shared__: [{ id: 'party_destiny', title: 'Destiny', owner: 'Party' }],
    } : {},
    SkillDraughtTrace: [],
    SkillDraughtTraceSeq: 0,
    SkillProcTrace: [],
    SkillProcTraceSeq: 0,
    AstralFlowAmpPoints: 18,
    AstralFlowAmpMax: 18,
    AstralFlowAmpReady: 1,
  };
  const ctx = {
    state: { globals, entities: [hero, enemy] },
    callFunction(name, ...args) {
      if (name === 'UpdateAstralFlowAmpBar') return undefined;
      if (name === 'UpdateHeroHPUI') return undefined;
      if (name === 'UpdatePartyHPText') return undefined;
      if (name === 'UpdatePartyHPBar') return undefined;
      return undefined;
    },
  };
  return ctx;
}

test('Destiny payload is mirrored and party scoped', () => {
  for (const filePath of [runtimePath, scriptsPath]) {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.match(src, /export function IsPartySessionSkillActive\(/);
    assert.match(src, /export function RollPartySkillProc\(/);
    assert.match(src, /export function TryPartyDestiny\(/);
    assert.match(src, /export function TriggerPartyDestinyDev\(/);
    assert.match(src, /id: 'party_destiny'[\s\S]*payloadImplemented: true/);
    assert.match(src, /Attacks have a chance to restore 2\.5% health on impact\./);
    assert.match(src, /id: 'party_destiny'[\s\S]*growth: \[32, 32, 32, 32\]/);
    assert.match(src, /procPattern: 'On hit'/);
    assert.match(src, /TryPartyDestiny\(ctx, \{[\s\S]*eventName: 'hit_enemy'/);
    assert.doesNotMatch(src, /TryPartyDestiny\(ctx, \{ eventName: 'valid_match'/);
    assert.doesNotMatch(src, /Restore health whenever you make a match\./);
    assert.doesNotMatch(src, /already at full HP/);
  }
});

test('draw can force-select Destiny into the shared party session bucket', () => {
  const mod = loadModule(runtimePath);
  const ctx = makeContext();

  const opened = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_destiny');
  assert.equal(opened.ok, true);
  assert.equal(opened.candidates[0].id, 'party_destiny');
  ctx.state.globals.CombatActionPinnedLine = 'Falie gained Astral Flow!';
  ctx.state.globals.CombatActionPinnedUntil = 4;

  const selected = mod.SelectSkillDraughtCard(ctx, 0);
  assert.equal(selected.ok, true);
  assert.equal(ctx.state.globals.SessionSkillsByHeroUID.__party_shared__[0].id, 'party_destiny');
  assert.match(ctx.state.globals.CombatLog.join('\n'), /Destiny activated\./);
  assert.equal(ctx.state.globals.CombatActionPinnedLine, '');
  assert.equal(ctx.state.globals.CombatActionPinnedUntil, 0);
  assert.equal(ctx.state.globals.CombatActionLines[3], 'Destiny activated.');
  assert.equal(ctx.state.globals.AstralFlowAmpPoints, 0);
  assert.equal(ctx.state.globals.AstralFlowAmpReady, 0);
  assert.equal(mod.IsPartySessionSkillActive(ctx, 'party_destiny'), true);
});

test('Destiny one-off draw is spent after exposure and forced draws fall back to eligible skills', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const registryDestiny = mod.GetSkillDefinition(null, 'party_destiny');
    assert.equal(registryDestiny.drawClass, 'one_off');
    assert.equal(registryDestiny.selection.duplicatePolicy, 'reject_after_selected');

    const exposureCtx = makeContext();
    exposureCtx.state.globals.RuntimeRandom = () => 0;
    const firstExposure = mod.ForceAstralFlowSkillDraught(exposureCtx, 100, 'party_destiny');
    assert.equal(firstExposure.ok, true);
    assert.equal(firstExposure.candidates[0].id, 'party_destiny');
    assert.equal(exposureCtx.state.globals.SkillDraughtOneOffExposureBySkillId.party_destiny, 1);

    exposureCtx.state.globals.SkillDraughtOpen = 0;
    exposureCtx.state.globals.SkillDraughtCandidates = [];
    const afterExposure = mod.ForceAstralFlowSkillDraught(exposureCtx, 100, 'party_destiny');
    assert.equal(afterExposure.ok, true);
    assert.equal(afterExposure.forcedSkillSuppressedReason, 'one_off_already_exposed');
    assert.equal(afterExposure.candidates.some(candidate => candidate.id === 'party_destiny'), false);
    assert.ok(afterExposure.candidates.length > 0);
    assert.ok(afterExposure.candidates.length <= 3);

    const selectedCtx = makeContext();
    const opened = mod.ForceAstralFlowSkillDraught(selectedCtx, 100, 'party_destiny');
    assert.equal(opened.ok, true);
    const selected = mod.SelectSkillDraughtCard(selectedCtx, 0);
    assert.equal(selected.ok, true);
    assert.equal(selected.skill.id, 'party_destiny');
    assert.equal(selected.skill.drawClass, 'one_off');
    assert.equal(selected.skill.sessionBucket, '__party_shared__');
    assert.equal(selected.skill.duplicatePolicy, 'reject_after_selected');
    assert.equal(selected.skill.selectionCount, 1);

    const forcedAfterSelection = mod.ForceAstralFlowSkillDraught(selectedCtx, 100, 'party_destiny');
    assert.equal(forcedAfterSelection.ok, true);
    assert.equal(forcedAfterSelection.forcedSkillSuppressedReason, 'one_off_already_selected');
    assert.equal(forcedAfterSelection.candidates.some(candidate => candidate.id === 'party_destiny'), false);
    assert.ok(forcedAfterSelection.candidates.length > 0);
    assert.ok(forcedAfterSelection.candidates.length <= 3);
    assert.equal(mod.GetSkillDefinition(null, 'party_destiny').id, 'party_destiny');

    const trace = selectedCtx.state.globals.SkillDraughtTrace;
    assert.equal(trace.some(entry => (
      entry.action === 'open'
      && entry.forcedSkillId === 'party_destiny'
      && entry.forcedSkillSuppressedReason === 'one_off_already_selected'
    )), true);
  }
});

test('Destiny dev trigger activates session skill without rolling or healing', () => {
  const mod = loadModule(runtimePath);
  const ctx = makeContext({ active: false });
  ctx.state.entities[0].hp = 50;
  ctx.state.globals.PartyHPByIndex = [50];
  ctx.state.globals.PartyHP = 50;

  const result = mod.TriggerPartyDestinyDev(ctx, 100);
  assert.equal(result.success, true);
  assert.equal(result.reason, 'activated');
  assert.equal(ctx.state.globals.SessionSkillsByHeroUID.__party_shared__[0].id, 'party_destiny');
  assert.equal(ctx.state.entities[0].hp, 50);
  assert.equal(ctx.state.globals.PartyDestinyAttempts, 0);
  assert.equal(ctx.state.globals.PartyDestinyProcs, 0);
  assert.equal(ctx.state.globals.PartyDestinyHeals, 0);
  assert.equal(ctx.state.globals.PartyDestinyMisses, 0);
  assert.equal(ctx.state.globals.PartyDestinyLastResult, 'activated');
  assert.match(ctx.state.globals.CombatLog.join('\n'), /Chance to restore HP when attacking enemies activated!/);
  assert.doesNotMatch(ctx.state.globals.CombatLog.join('\n'), /Destiny restores/);
});

test('Destiny dev activation stays player-facing at full HP without a proc', () => {
  const mod = loadModule(runtimePath);
  const ctx = makeContext({ active: false });

  const result = mod.TriggerPartyDestinyDev(ctx, 100);
  assert.equal(result.success, true);
  assert.equal(result.reason, 'activated');
  assert.equal(ctx.state.globals.PartyDestinyAttempts, 0);
  assert.equal(ctx.state.globals.PartyDestinyProcs, 0);
  assert.equal(ctx.state.globals.PartyDestinyHeals, 0);
  assert.equal(ctx.state.globals.PartyDestinyLastResult, 'activated');
  assert.match(ctx.state.globals.CombatLog.join('\n'), /Chance to restore HP when attacking enemies activated!/);
  assert.doesNotMatch(ctx.state.globals.CombatLog.join('\n'), /already at full HP/);
});

test('Destiny locked and miss cases trace without healing', () => {
  const mod = loadModule(runtimePath);

  const lockedCtx = makeContext({ active: false });
  lockedCtx.state.entities[0].hp = 50;
  lockedCtx.state.globals.PartyHPByIndex = [50];
  const locked = mod.TryPartyDestiny(lockedCtx, { sourceUID: 100, targetUID: 200, appliedDamage: 1, forcedRollPct: 0 });
  assert.equal(locked.success, false);
  assert.equal(locked.reason, 'skill_locked');
  assert.equal(lockedCtx.state.entities[0].hp, 50);
  assert.equal(lockedCtx.state.globals.PartyDestinyAttempts, 0);
  assert.equal(lockedCtx.state.globals.PartyDestinyProcs, 0);
  assert.equal(mod.GetSkillProcTrace(lockedCtx, 1)[0].reason, 'skill_locked');

  const missCtx = makeContext({ active: true });
  missCtx.state.entities[0].hp = 50;
  missCtx.state.globals.PartyHPByIndex = [50];
  const miss = mod.TryPartyDestiny(missCtx, { sourceUID: 100, targetUID: 200, appliedDamage: 1, forcedRollPct: 99 });
  assert.equal(miss.success, false);
  assert.equal(miss.reason, 'proc_miss');
  assert.equal(missCtx.state.entities[0].hp, 50);
  assert.equal(missCtx.state.globals.PartyDestinyAttempts, 1);
  assert.equal(missCtx.state.globals.PartyDestinyMisses, 1);
  assert.equal(missCtx.state.globals.PartyDestinyProcs, 0);
  assert.equal(missCtx.state.globals.PartyDestinyLastResult, 'proc_miss');
  assert.equal(mod.GetSkillProcTrace(missCtx, 1)[0].reason, 'proc_miss');
});

test('Destiny uses 32 percent proc threshold', () => {
  const mod = loadModule(runtimePath);

  const hitCtx = makeContext({ active: true });
  hitCtx.state.entities[0].hp = 50;
  hitCtx.state.globals.PartyHPByIndex = [50];
  const hit = mod.TryPartyDestiny(hitCtx, { sourceUID: 100, targetUID: 200, appliedDamage: 1, forcedRollPct: 32 });
  assert.equal(hit.success, true);
  assert.equal(hit.roll.chancePct, 32);

  const missCtx = makeContext({ active: true });
  missCtx.state.entities[0].hp = 50;
  missCtx.state.globals.PartyHPByIndex = [50];
  const miss = mod.TryPartyDestiny(missCtx, { sourceUID: 100, targetUID: 200, appliedDamage: 1, forcedRollPct: 32.01 });
  assert.equal(miss.success, false);
  assert.equal(miss.reason, 'proc_miss');
  assert.equal(miss.roll.chancePct, 32);
});

test('Destiny deterministic success heals the hitting hero for 2.5 percent party max HP rounded up', () => {
  const mod = loadModule(runtimePath);
  const ctx = makeContext({ active: true });
  ctx.state.entities[0].hp = 50;
  ctx.state.globals.PartyHPByIndex = [50];
  ctx.state.globals.PartyHP = 50;
  ctx.state.globals.PartyMaxHP = 121;

  const result = mod.TryPartyDestiny(ctx, { sourceUID: 100, targetUID: 200, appliedDamage: 1, forcedRollPct: 0 });
  assert.equal(result.success, true);
  assert.equal(result.reason, 'healed');
  assert.equal(result.requestedHeal, 4);
  assert.equal(result.appliedHeal, 4);
  assert.equal(ctx.state.entities[0].hp, 54);
  assert.equal(ctx.state.globals.PartyHPByIndex[0], 54);

  const trace = mod.GetSkillProcTrace(ctx, 1)[0];
  assert.equal(trace.scope, 'party');
  assert.equal(trace.skillId, 'party_destiny');
  assert.equal(trace.success, true);
});

test('Destiny resolves from enemy damage receive seam after hero hit', () => {
  const mod = loadModule(runtimePath);
  const ctx = makeContext({ active: true });
  ctx.state.entities[0].hp = 40;
  ctx.state.globals.PartyHPByIndex = [40];
  ctx.state.globals.PartyHP = 40;
  ctx.state.globals.RuntimeRandom = () => 0;

  const appliedDamage = mod.ApplyDamageToTarget(ctx, 200, 5);
  assert.equal(appliedDamage, 5);
  assert.equal(ctx.state.entities[1].hp, 95);
  assert.equal(ctx.state.entities[0].hp, 43);
  assert.equal(ctx.state.globals.PartyDestinyAttempts, 1);
  assert.equal(ctx.state.globals.PartyDestinyProcs, 1);
  assert.equal(ctx.state.globals.PartyDestinyHeals, 1);
  assert.equal(ctx.state.globals.LastPartyDestiny.reason, 'healed');
});

test('dev panel does not expose direct Destiny trigger', () => {
  const runtimeSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'devToolingRuntime.js'), 'utf8');
  assert.doesNotMatch(runtimeSrc, /data-devtool-trigger-destiny/);
  assert.doesNotMatch(runtimeSrc, /devToolingDom\.triggerDestiny/);
  assert.doesNotMatch(runtimeSrc, /TriggerPartyDestinyDev/);
  assert.match(runtimeSrc, /data-devtool-force-skill-draught/);
  assert.match(runtimeSrc, /data-devtool-clear-session-skills/);
  assert.match(runtimeSrc, /Number\(actor\?\.uid \|\| 0\) === requestedUID/);
  assert.match(runtimeSrc, /heroIndex \+ 1 === requestedUID/);
});

test('Clear Skills reset clears Destiny session state and proc readout counters in both mirrors', () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = loadModule(modulePath);
    const ctx = makeContext({ active: false });
    ctx.state.entities[0].hp = 50;
    ctx.state.globals.PartyHPByIndex = [50];
    ctx.state.globals.PartyHP = 50;

    const activated = mod.TriggerPartyDestinyDev(ctx, 100);
    assert.equal(activated.success, true);
    assert.equal(mod.IsPartySessionSkillActive(ctx, 'party_destiny'), true);
    const healed = mod.TryPartyDestiny(ctx, { sourceUID: 100, targetUID: 200, appliedDamage: 1, forcedRollPct: 0 });
    assert.equal(healed.success, true);
    assert.equal(ctx.state.globals.PartyDestinyAttempts, 1);
    assert.equal(ctx.state.globals.PartyDestinyProcs, 1);
    assert.equal(ctx.state.globals.PartyDestinyHeals, 1);
    assert.ok(mod.GetSkillProcTrace(ctx, 20).length > 0);

    const cleared = mod.ClearSessionSkillDraught(ctx);
    assert.equal(cleared.ok, true);
    assert.equal(mod.IsPartySessionSkillActive(ctx, 'party_destiny'), false);
    assert.equal(ctx.state.globals.PartyDestinyAttempts, 0);
    assert.equal(ctx.state.globals.PartyDestinyProcs, 0);
    assert.equal(ctx.state.globals.PartyDestinyHeals, 0);
    assert.equal(ctx.state.globals.PartyDestinyMisses, 0);
    assert.equal(ctx.state.globals.PartyDestinyLastResult, '');
    assert.equal(ctx.state.globals.LastPartyDestiny, null);
    assert.equal(mod.GetSkillProcTrace(ctx, 20).length, 0);
  }
});
