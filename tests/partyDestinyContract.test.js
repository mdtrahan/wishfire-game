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
  GetSkillDraughtState,
  SelectSkillDraughtCard,
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
    assert.match(src, /Small chance to restore HP when attacking enemies\./);
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

test('Destiny deterministic success heals the hitting hero for 10 percent max HP', () => {
  const mod = loadModule(runtimePath);
  const ctx = makeContext({ active: true });
  ctx.state.entities[0].hp = 50;
  ctx.state.globals.PartyHPByIndex = [50];
  ctx.state.globals.PartyHP = 50;

  const result = mod.TryPartyDestiny(ctx, { sourceUID: 100, targetUID: 200, appliedDamage: 1, forcedRollPct: 0 });
  assert.equal(result.success, true);
  assert.equal(result.reason, 'healed');
  assert.equal(result.appliedHeal, 10);
  assert.equal(ctx.state.entities[0].hp, 60);
  assert.equal(ctx.state.globals.PartyHPByIndex[0], 60);

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
  assert.equal(ctx.state.entities[0].hp, 50);
  assert.equal(ctx.state.globals.PartyDestinyAttempts, 1);
  assert.equal(ctx.state.globals.PartyDestinyProcs, 1);
  assert.equal(ctx.state.globals.PartyDestinyHeals, 1);
  assert.equal(ctx.state.globals.LastPartyDestiny.reason, 'healed');
});

test('dev panel exposes Destiny trigger without inlining effect logic', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  assert.match(appSrc, /data-devtool-trigger-destiny/);
  assert.match(appSrc, /TriggerPartyDestinyDev/);
  assert.match(appSrc, /const requestedUID = Number\(devToolingDom\.skillHero\?\.value \|\| 0\);/);
  assert.match(appSrc, /const requestedActor = state\.entities\.find\(actor => Number\(actor\?\.uid \|\| 0\) === requestedUID\) \|\| null;/);
  assert.match(appSrc, /const sourceUID = requestedActor\?\.kind === 'hero'/);
  assert.match(appSrc, /Destiny dev trigger failed:/);
  assert.match(appSrc, /closeDevToolingModal\(\{ restorePauseSnapshot: true \}\);/);
  assert.doesNotMatch(appSrc, /ApplyPartyHeal/);
});
