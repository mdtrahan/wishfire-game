const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function extractFunctionSource(src, name) {
  const markers = [`export function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const marker of markers) {
    start = src.indexOf(marker);
    if (start !== -1) break;
  }
  assert.notEqual(start, -1, `missing ${name}`);
  const braceStart = src.indexOf('{', start);
  assert.notEqual(braceStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

function buildHeroAttackAOE(fnSource, deps) {
  const body = fnSource
    .replace(/^export\s+/, '')
    .replace(/^function\s+HeroAttackAOE\s*\(/, 'function(');
  return new Function(
    'GetActorByUID',
    'getGlobals',
    'ensurePowerAmpByUID',
    'GetPowerAmpMultiplierForActor',
    'ConsumePowerAmpForActor',
    'getEnemies',
    'GetEffectiveStat',
    'CalculateDamage',
    'LogCombat',
    `return (${body});`
  )(
    deps.GetActorByUID,
    deps.getGlobals,
    deps.ensurePowerAmpByUID,
    deps.GetPowerAmpMultiplierForActor,
    deps.ConsumePowerAmpForActor,
    deps.getEnemies,
    deps.GetEffectiveStat,
    deps.CalculateDamage,
    deps.LogCombat
  );
}

function runKojonnAoeCase(src, ampMult) {
  const ctx = { globals: { time: 10 } };
  const actor = { uid: 4, name: 'Kojonn', heroIndex: 3, attackType: 'magic', MAG: 22 };
  const enemies = [
    { uid: 101, name: 'Djinn', hp: 30 },
    { uid: 102, name: 'Marid', hp: 30 },
    { uid: 103, name: 'Gobloc', hp: 30 },
  ];
  const logs = [];
  let consumeCalls = 0;
  const fn = buildHeroAttackAOE(extractFunctionSource(src, 'HeroAttackAOE'), {
    GetActorByUID: (_ctx, uid) => (uid === actor.uid ? actor : enemies.find((e) => e.uid === uid) || null),
    getGlobals: (runtimeCtx) => runtimeCtx.globals,
    ensurePowerAmpByUID: () => ({
      [actor.uid]: { lifecycleId: 9, state: ampMult > 0 ? 'active_this_turn' : 'inactive', mult: ampMult, usedThisTurn: 0 },
    }),
    GetPowerAmpMultiplierForActor: () => ampMult,
    ConsumePowerAmpForActor: () => {
      consumeCalls += 1;
      return ampMult;
    },
    getEnemies: () => enemies,
    GetEffectiveStat: (_ctx, unit, stat) => (stat === 'MAG' ? Number(unit.MAG || 0) : 0),
    CalculateDamage: () => {
      throw new Error('generic damage path should not run for Kojonn green AOE');
    },
    LogCombat: (_ctx, msg) => logs.push(String(msg)),
  });

  fn(ctx, actor.uid);
  return {
    pending: ctx.globals.PendingHeroHits || [],
    logs,
    consumeCalls,
  };
}

test('Kojonn green AOE multiplies blight totals when power amp is active in both mirrors', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = read(relPath);
    const base = runKojonnAoeCase(src, 0);
    const amped = runKojonnAoeCase(src, 3);

    assert.equal(base.pending.length, 3, `${relPath} should queue one blight packet per enemy`);
    assert.equal(amped.pending.length, 3, `${relPath} should queue one blight packet per enemy when amped`);
    assert.ok(base.pending.every((hit) => hit.effectType === 'dot_apply'), `${relPath} should queue dot_apply packets`);
    assert.ok(amped.pending.every((hit) => hit.effectType === 'dot_apply'), `${relPath} should keep dot_apply packets when amped`);
    assert.ok(base.pending.every((hit) => hit.dotTotalDamage === 16), `${relPath} should queue base blight total from MAG`);
    assert.ok(amped.pending.every((hit) => hit.dotTotalDamage === 48), `${relPath} should triple blight total when amp is active`);
    assert.equal(base.logs[0], 'Kojonn used Faze to spread blight over time for 48!');
    assert.equal(amped.logs[0], 'Kojonn used Faze to spread blight over time for 144!');
    assert.equal(base.consumeCalls, 0, `${relPath} should not consume amp when no amp is active`);
    assert.equal(amped.consumeCalls, 1, `${relPath} should consume amp once for the whole AOE cast`);
  }
});

