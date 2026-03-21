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

function buildHeroAttackSingle(fnSource, deps) {
  const body = fnSource
    .replace(/^export\s+/, '')
    .replace(/^function\s+HeroAttackSingle\s*\(/, 'function(');
  return new Function(
    'getActorNameByUID',
    'GetActorByUID',
    'CalculateDamage',
    'ensurePowerAmpByUID',
    'GetPowerAmpMultiplierForActor',
    'ConsumePowerAmpForActor',
    'getGlobals',
    'ensureActorRedAttackSkillStore',
    'LogCombat',
    `return (${body});`
  )(
    deps.getActorNameByUID,
    deps.GetActorByUID,
    deps.CalculateDamage,
    deps.ensurePowerAmpByUID,
    deps.GetPowerAmpMultiplierForActor,
    deps.ConsumePowerAmpForActor,
    deps.getGlobals,
    deps.ensureActorRedAttackSkillStore,
    deps.LogCombat
  );
}

function runKojonnSingleCase(src, ampMult) {
  const actor = { uid: 4, name: 'Kojonn', kind: 'hero', attackType: 'magic' };
  const target = { uid: 101, name: 'Djinn', kind: 'enemy', hp: 999 };
  const ctx = { globals: { time: 10 } };
  let consumeCalls = 0;
  const logs = [];
  const fn = buildHeroAttackSingle(extractFunctionSource(src, 'HeroAttackSingle'), {
    getActorNameByUID: (_ctx, uid) => (uid === actor.uid ? actor.name : target.name),
    GetActorByUID: (_ctx, uid) => (uid === actor.uid ? actor : (uid === target.uid ? target : null)),
    CalculateDamage: () => 17,
    ensurePowerAmpByUID: () => ({
      [actor.uid]: { lifecycleId: 9, state: ampMult > 0 ? 'active_this_turn' : 'inactive', mult: ampMult, usedThisTurn: 0 },
    }),
    GetPowerAmpMultiplierForActor: () => ampMult,
    ConsumePowerAmpForActor: () => {
      consumeCalls += 1;
      return ampMult;
    },
    getGlobals: (runtimeCtx) => runtimeCtx.globals,
    ensureActorRedAttackSkillStore: () => ({
      [actor.uid]: { actorUID: actor.uid, skillId: 'INCINERATE' },
    }),
    LogCombat: (_ctx, msg) => logs.push(String(msg)),
  });

  fn(ctx, actor.uid, target.uid);
  return {
    pending: ctx.globals.PendingHeroHits || [],
    logs,
    consumeCalls,
  };
}

test('Kojonn red single stores full queued totals for base, x2, and x3 Power Amp in both mirrors', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = read(relPath);
    const base = runKojonnSingleCase(src, 0);
    const amp2 = runKojonnSingleCase(src, 2);
    const amp3 = runKojonnSingleCase(src, 3);

    assert.equal(base.pending.length, 4, `${relPath} should split Kojonn red into four queued hits`);
    assert.equal(amp2.pending.length, 4, `${relPath} should keep four queued hits with x2 amp`);
    assert.equal(amp3.pending.length, 4, `${relPath} should keep four queued hits with x3 amp`);
    assert.equal(base.pending.reduce((sum, hit) => sum + Number(hit.finalDmg || hit.dmg || 0), 0), 17, `${relPath} should preserve base total`);
    assert.equal(amp2.pending.reduce((sum, hit) => sum + Number(hit.finalDmg || hit.dmg || 0), 0), 34, `${relPath} should preserve x2 total`);
    assert.equal(amp3.pending.reduce((sum, hit) => sum + Number(hit.finalDmg || hit.dmg || 0), 0), 51, `${relPath} should preserve x3 total`);
    assert.ok(amp2.pending.every((hit) => Number(hit.finalDmg || 0) > 0), `${relPath} should queue explicit final hit totals`);
    assert.ok(amp3.pending.every((hit) => Number(hit.finalDmg || 0) > 0), `${relPath} should queue explicit final hit totals at x3`);
    assert.equal(base.logs[0], 'Kojonn used Incinerate on Djinn for 17!');
    assert.equal(amp2.logs[0], 'Kojonn used Incinerate on Djinn for 34!');
    assert.equal(amp3.logs[0], 'Kojonn used Incinerate on Djinn for 51!');
    assert.equal(base.consumeCalls, 0, `${relPath} should not consume amp when inactive`);
    assert.equal(amp2.consumeCalls, 1, `${relPath} should consume amp once at x2`);
    assert.equal(amp3.consumeCalls, 1, `${relPath} should consume amp once at x3`);
  }
});

test('app delayed-hit resolver honors queued final damage before fallback recomputation', () => {
  const src = read('web-runner/app.js');
  assert.match(
    src,
    /const queuedFinalDmg = Number\(hit\.finalDmg\);[\s\S]*const finalDmg = Number\.isFinite\(queuedFinalDmg\) && queuedFinalDmg > 0[\s\S]*: \(ampMult > 0 \? Math\.max\(1, Math\.ceil\(\(hit\.dmg \|\| 0\) \* ampMult\)\) : hit\.dmg\);/
  );
});
