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

test('retired green route no longer maps gems to HERO_AOE in both mirrors', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.doesNotMatch(src, /GEM_ACTION_GREEN_ATTACK/);
    assert.doesNotMatch(src, /color >= 0 && color <= 5/);
    assert.doesNotMatch(src, /routeCode === 0 \? 1/);
    assert.doesNotMatch(src, /colorName: 'GREEN', intentKey: 'HERO_AOE'/);
    assert.doesNotMatch(src, /const isKojonn = String\(actor && actor\.name \|\| ''\) === 'Kojonn';/);
    assert.doesNotMatch(src, /dotTotalDamage: Number\(hit\.dotTotalDamage \|\| 0\),/);
    assert.doesNotMatch(src, /\['Pummel', 'Swipe', 'Burst', 'Faze'\]/);
    assert.match(src, /effectType: 'damage',/);
    assert.match(src, /used \$\{aoeName\} on all enemies for \$\{totalDamage\}!/);
    assert.match(src, /export function QueueEnemyDamageOverTime\(ctx, actorUID, enemyUID, totalDamage, options = undefined\) \{/);
    assert.match(src, /g\.EnemyDamageOverTime\.push\(\{/);
    assert.match(src, /const effectName = String\(options\?\.effectName \|\| 'Blight'\);/);
    assert.match(src, /effectName,/);
  }
});

test('direct HERO_AOE calls use common AOE presentation profile', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = read(relPath);
    const kojonn = runHeroAoeProfileCase(src, { uid: 4, name: 'Kojonn', kind: 'hero' });
    const falie = runHeroAoeProfileCase(src, { uid: 1, name: 'Falie', kind: 'hero' });

    assert.equal(kojonn.aoeCalled, true, `${relPath} should still resolve direct AOE skill calls`);
    assert.equal(kojonn.profileAtLunge, 'aoe', `${relPath} should keep Kojonn on common AOE profile`);
    assert.equal(falie.profileAtLunge, 'aoe', `${relPath} should keep non-Kojonn on the common AOE profile`);
  }
});
