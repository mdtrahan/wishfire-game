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
  ResolveGemAction,
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
  const globals = {
    time: 0,
    RuntimeRandom: () => 0.99,
    PartyHP: 50,
    PartyMaxHP: 100,
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
    state: { globals, entities: [hero] },
    callFunction(name, ...args) {
      if (name === 'ApplyPartyHeal') {
        const amount = Math.max(0, Math.floor(Number(args[0] || 0)));
        globals.PartyHP = Math.min(globals.PartyMaxHP, globals.PartyHP + amount);
        return globals.PartyHP;
      }
      if (name === 'UpdateAstralFlowAmpBar') return undefined;
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
    assert.match(src, /id: 'party_destiny'[\s\S]*payloadImplemented: true/);
    assert.match(src, /TryPartyDestiny\(ctx, \{ eventName: 'valid_match'/);
  }
});

test('draught can force-select Destiny into the shared party session bucket', () => {
  const mod = loadModule(runtimePath);
  const ctx = makeContext();

  const opened = mod.ForceAstralFlowSkillDraught(ctx, 100, 'party_destiny');
  assert.equal(opened.ok, true);
  assert.equal(opened.candidates[0].id, 'party_destiny');

  const selected = mod.SelectSkillDraughtCard(ctx, 0);
  assert.equal(selected.ok, true);
  assert.equal(ctx.state.globals.SessionSkillsByHeroUID.__party_shared__[0].id, 'party_destiny');
  assert.equal(ctx.state.globals.AstralFlowAmpPoints, 0);
  assert.equal(ctx.state.globals.AstralFlowAmpReady, 0);
  assert.equal(mod.IsPartySessionSkillActive(ctx, 'party_destiny'), true);
});

test('Destiny locked and miss cases trace without healing', () => {
  const mod = loadModule(runtimePath);

  const lockedCtx = makeContext({ active: false });
  const locked = mod.TryPartyDestiny(lockedCtx, { forcedRollPct: 0, healAmount: 10 });
  assert.equal(locked.success, false);
  assert.equal(locked.reason, 'skill_locked');
  assert.equal(lockedCtx.state.globals.PartyHP, 50);
  assert.equal(mod.GetSkillProcTrace(lockedCtx, 1)[0].reason, 'skill_locked');

  const missCtx = makeContext({ active: true });
  const miss = mod.TryPartyDestiny(missCtx, { forcedRollPct: 99, healAmount: 10 });
  assert.equal(miss.success, false);
  assert.equal(miss.reason, 'proc_miss');
  assert.equal(missCtx.state.globals.PartyHP, 50);
  assert.equal(mod.GetSkillProcTrace(missCtx, 1)[0].reason, 'proc_miss');
});

test('Destiny deterministic success heals party HP and records party trace', () => {
  const mod = loadModule(runtimePath);
  const ctx = makeContext({ active: true });

  const result = mod.TryPartyDestiny(ctx, { forcedRollPct: 0, healAmount: 12 });
  assert.equal(result.success, true);
  assert.equal(result.reason, 'healed');
  assert.equal(result.appliedHeal, 12);
  assert.equal(ctx.state.globals.PartyHP, 62);

  const trace = mod.GetSkillProcTrace(ctx, 1)[0];
  assert.equal(trace.scope, 'party');
  assert.equal(trace.skillId, 'party_destiny');
  assert.equal(trace.success, true);
});

test('dev panel exposes Destiny trigger without inlining effect logic', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  assert.match(appSrc, /data-devtool-trigger-destiny/);
  assert.match(appSrc, /TryPartyDestiny/);
  assert.doesNotMatch(appSrc, /ApplyPartyHeal/);
});
