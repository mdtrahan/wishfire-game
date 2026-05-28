const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function extractFunctionSource(src, name) {
  const marker = `export function ${name}(`;
  const start = src.indexOf(marker);
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

function buildExecuteSkill(fnSource, deps) {
  const body = fnSource
    .replace(/^export\s+/, '')
    .replace(/^function\s+ExecuteSkill\s*\(/, 'function(');
  return new Function(
    'getGlobals',
    'GetActorByUID',
    'ensurePowerAmpByUID',
    'GetPowerAmpMultiplierForActor',
    'emitPowerAmpStateLog',
    'StartHeroLunge',
    'HeroAttackAOE',
    'runTraitHooks',
    'TryGrantConfiguredExtraTurn',
    'AdvanceTurn',
    'ProcessTurn',
    'console',
    `return (${body});`
  )(
    deps.getGlobals,
    deps.GetActorByUID,
    deps.ensurePowerAmpByUID,
    deps.GetPowerAmpMultiplierForActor,
    deps.emitPowerAmpStateLog,
    deps.StartHeroLunge,
    deps.HeroAttackAOE,
    deps.runTraitHooks,
    deps.TryGrantConfiguredExtraTurn,
    deps.AdvanceTurn,
    deps.ProcessTurn,
    deps.console,
  );
}

function runHeroAoeProfileCase(src, actor) {
  const ctx = { globals: { TurnPhase: 0, IsPlayerBusy: 0, CanPickGems: 1 } };
  let profileAtLunge = null;
  let aoeCalled = false;
  const fn = buildExecuteSkill(extractFunctionSource(src, 'ExecuteSkill'), {
    getGlobals: (runtimeCtx) => runtimeCtx.globals,
    GetActorByUID: (_ctx, uid) => (uid === actor.uid ? actor : null),
    ensurePowerAmpByUID: () => ({ [actor.uid]: { state: 'inactive', lifecycleId: 0 } }),
    GetPowerAmpMultiplierForActor: () => 0,
    emitPowerAmpStateLog: () => {},
    StartHeroLunge: (runtimeCtx) => {
      profileAtLunge = String(runtimeCtx.globals.NextHeroActionProfile || '');
    },
    HeroAttackAOE: () => {
      aoeCalled = true;
    },
    runTraitHooks: () => {},
    TryGrantConfiguredExtraTurn: () => {},
    AdvanceTurn: () => {},
    ProcessTurn: () => {},
    console: { log: () => {} },
  });

  fn(ctx, 'HERO_AOE', actor.uid);
  return { profileAtLunge, aoeCalled };
}

test('Kojonn green AOE uses blight-over-time packets instead of generic burst damage in both mirrors', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /const isKojonn = String\(actor && actor\.name \|\| ''\) === 'Kojonn';/);
    assert.match(src, /const aoeName = isKojonn \? 'Faze' :/);
    assert.match(src, /const baseKojonnDotDamage = isKojonn/);
    assert.match(src, /dotTotalDamage: Number\(hit\.dotTotalDamage \|\| 0\),/);
    assert.match(src, /effectType: isKojonn \? 'dot_apply' : 'damage',/);
    assert.match(src, /used \$\{aoeName\} to spread blight over time for \$\{totalDamage\}!/);
    assert.match(src, /export function QueueEnemyDamageOverTime\(ctx, actorUID, enemyUID, totalDamage, options = undefined\) \{/);
    assert.match(src, /g\.EnemyDamageOverTime\.push\(\{/);
    assert.match(src, /const effectName = String\(options\?\.effectName \|\| 'Blight'\);/);
    assert.match(src, /effectName,/);
  }
});

test('Kojonn regular green match keeps a Faze expression profile instead of common AOE', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = read(relPath);
    const kojonn = runHeroAoeProfileCase(src, { uid: 4, name: 'Kojonn', kind: 'hero' });
    const falie = runHeroAoeProfileCase(src, { uid: 1, name: 'Falie', kind: 'hero' });

    assert.equal(kojonn.aoeCalled, true, `${relPath} should still resolve through the green AOE skill`);
    assert.equal(kojonn.profileAtLunge, 'faze', `${relPath} should tag Kojonn green as Faze expression`);
    assert.equal(falie.profileAtLunge, 'aoe', `${relPath} should keep non-Kojonn green on the common AOE profile`);
  }
});
