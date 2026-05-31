const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const MIRRORED_FUNCTION_BANKS = [
  path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'),
  path.join(__dirname, '..', 'Scripts', 'functionBank.js'),
];

function extractFunctionSource(src, name) {
  const marker = `function ${name}(`;
  const exportMarker = `export function ${name}(`;
  let start = src.indexOf(exportMarker);
  if (start === -1) start = src.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const parenStart = src.indexOf('(', start);
  assert.notEqual(parenStart, -1, `missing params for ${name}`);
  let parenDepth = 0;
  let paramsEnd = -1;
  for (let i = parenStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '(') parenDepth += 1;
    if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        paramsEnd = i;
        break;
      }
    }
  }
  assert.notEqual(paramsEnd, -1, `unterminated params for ${name}`);
  const braceStart = src.indexOf('{', paramsEnd);
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

function loadSuperGemRuntime() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'superGemRuntime.js'), 'utf8')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')
    + '\nmodule.exports = { activateSuperGemEffect };';
  const context = { module: { exports: {} }, exports: {}, Math, Number, String, Array, Map };
  vm.runInNewContext(src, context, { filename: 'superGemRuntime.js' });
  return context.module.exports;
}

for (const filePath of MIRRORED_FUNCTION_BANKS) {
  test(`purple gem action grants energy instead of power amp in ${path.relative(process.cwd(), filePath)}`, () => {
    const src = fs.readFileSync(filePath, 'utf8');
    const grantSrc = extractFunctionSource(src, 'GrantPurpleMatchEnergy');
    assert.match(grantSrc, /const energyOptions = \[6, 12, 15\];/);
    assert.match(grantSrc, /g\.Player_Energy = \(g\.Player_Energy \|\| 0\) \+ amt;/);
    assert.match(grantSrc, /LogCombat\(ctx, `\$\{actorName\} gained \$\{amt\} energy!`\);/);
    assert.match(grantSrc, /const energyText = g\.EnergyReadoutTextCanvas;/);
    assert.match(grantSrc, /SpawnDamageText\(ctx, amt, Number\(energyText\.x\), Number\(energyText\.y\), 'energy', 'energy'\);/);

    const resolveSrc = extractFunctionSource(src, 'ResolveGemAction');
    assert.match(resolveSrc, /resolveGemActionCompat/);
    assert.match(resolveSrc, /__ORKA_GEM_ACTION_OWNER__/);
    assert.match(resolveSrc, /GEM_ACTION_CALL_PURPLE_MATCH_ENERGY/);
    assert.match(resolveSrc, /GrantPurpleMatchEnergy\(ctx, actorUID, consumedCount, decision\.purpleEnergyAmount\);/);
    assert.match(resolveSrc, /g\.ActionLockUntil = Number\(decision\.actionLockUntil \|\| 0\);/);
    assert.doesNotMatch(resolveSrc, /activatePowerAmp\(ctx, actorUID\);/);

    const spawnSrc = extractFunctionSource(src, 'SpawnDamageText');
    assert.match(spawnSrc, /const canvasAnchored = targetKind === 'energy' \? 1 : 0;/);
    assert.match(spawnSrc, /canvasAnchored,/);

    const superGrantSrc = extractFunctionSource(src, 'GrantPurpleSuperGemEnergy');
    assert.match(superGrantSrc, /const energyOptions = \[6, 12, 15\];/);
    assert.match(superGrantSrc, /const regularMaxEnergy = Math\.max\(\.\.\.energyOptions\);/);
    assert.match(superGrantSrc, /const amt = regularMaxEnergy \+ randomIndex\(ctx, regularMaxEnergy \+ 1\);/);
    assert.match(superGrantSrc, /source: 'supergem',/);
    assert.match(superGrantSrc, /regularMaxEnergy,/);
    assert.match(superGrantSrc, /SpawnDamageText\(ctx, amt, Number\(energyText\.x\), Number\(energyText\.y\), 'energy', 'energy'\);/);

    const superResolveSrc = extractFunctionSource(src, 'ResolvePurpleSuperGemEnergyAction');
    assert.match(superResolveSrc, /RegisterHeroGemUsage\(ctx, actorUID, 5, 1\);/);
    assert.match(superResolveSrc, /LogGemIntent\(ctx, 5, 'PURPLE', 'Energy_Gain_Super', 'supergem-routing', actorUID\);/);
    assert.match(superResolveSrc, /GrantPurpleSuperGemEnergy\(ctx, actorUID\);/);
    assert.match(superResolveSrc, /g\.ActionLockUntil = Math\.max\(g\.ActionLockUntil \|\| 0, \(g\.time \|\| 0\) \+ 0\.32, g\.TextAnimEndAt \|\| 0\);/);
  });

  test(`energy spend can charge the explicit purple gem count in ${path.relative(process.cwd(), filePath)}`, () => {
    const src = fs.readFileSync(filePath, 'utf8');
    const subEnergySrc = extractFunctionSource(src, 'Sub_Energy');
    assert.match(subEnergySrc, /export function Sub_Energy\(ctx, amount = 3\)/);
    assert.match(subEnergySrc, /const rawCost = Math\.floor\(Number\(amount \?\? 3\)\);/);
    assert.match(subEnergySrc, /const cost = Number\.isFinite\(rawCost\) \? Math\.max\(0, rawCost\) : 0;/);
    assert.match(subEnergySrc, /g\.Player_Energy = \(g\.Player_Energy \|\| 0\) - cost;/);
  });
}

test('frame-6 energy pickup is removed as a separate combat path', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  assert.doesNotMatch(src, /function handleSpecialGem6\(/);
  assert.doesNotMatch(src, /if \(x === 998\) return 6;/);
  assert.doesNotMatch(src, /if \(gem\.color === 6\) \{/);
  assert.doesNotMatch(src, /function findIdleAutoplayPrioritySinglePick\(/);
});

test('renderer exposes the energy readout as a floating-text target', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  assert.match(src, /} else if \(r\.inst\.type === 'Text_Energy'\) \{/);
  assert.match(src, /presentationPatches\.EnergyReadoutTextWorld = \{/);
  assert.match(src, /presentationPatches\.EnergyReadoutTextCanvas = \{/);
  assert.match(src, /x: centerX,/);
  assert.match(src, /y: y \+ 5,/);
  assert.match(src, /x: Number\(r\.world\.x \|\| 0\) \+ \(0\.5 - ox\) \* w,/);
  assert.match(src, /y: Number\(r\.world\.y \|\| 0\) \+ \(0\.5 - oy\) \* h,/);
});

test('regular purple matches spend a flat one energy', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const branch = src.match(/} else if \(color === 5\) \{[\s\S]*?\n  \}/);
  assert.ok(branch, 'handleGemMatch should have a purple branch');
  assert.match(branch[0], /const matchedCount = Math\.max\(0, Array\.isArray\(gameState\.selectedGems\) \? gameState\.selectedGems\.length : 0\);/);
  assert.match(branch[0], /callFunctionWithContext\(fnContext, 'ResolveGemAction', 5, actorUID, matchedCount\);/);
  assert.match(branch[0], /callFunctionWithContext\(fnContext, 'Sub_Energy', 1\);/);
  assert.doesNotMatch(branch[0], /callFunctionWithContext\(fnContext, 'Sub_Energy', matchedCount\);/);
  assert.doesNotMatch(branch[0], /callFunctionWithContext\(fnContext, 'Sub_Energy'\);/);
});

test('purple super gems use the purple energy path instead of fixed power amp', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'superGemRuntime.js'), 'utf8');
  const activateSrc = extractFunctionSource(src, 'activateSuperGemEffect');
  const purpleBranch = activateSrc.match(/if \(color === 5\) \{[\s\S]*?\n  \}/);
  assert.ok(purpleBranch, 'activateSuperGemEffect should have a purple branch');
  assert.match(purpleBranch[0], /const purpleGemCost = 1;/);
  assert.match(purpleBranch[0], /callFunctionWithContext\(fnContext, 'ResolvePurpleSuperGemEnergyAction', actorUID, purpleGemCost\);/);
  assert.doesNotMatch(purpleBranch[0], /ResolveGemAction', 5, actorUID, purpleGemCost/);
  assert.doesNotMatch(purpleBranch[0], /ResolveGemAction', 5, actorUID, consumedColorGemCount/);
  assert.doesNotMatch(purpleBranch[0], /superGem\.cells\.length/);
  assert.doesNotMatch(purpleBranch[0], /ArmPowerAmpFixed/);
});

test('purple super-gem cost is always one energy', () => {
  const { activateSuperGemEffect } = loadSuperGemRuntime();
  const calls = [];
  const activated = activateSuperGemEffect({
    superGem: {
      baseColor: 5,
      cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
    },
    actorUID: 7,
    selectedEnemyUID: 0,
    state: { globals: { time: 1 } },
    callFunctionWithContext: (_ctx, name, ...args) => {
      calls.push({ name, args });
      return 0;
    },
    fnContext: {},
    sourceItems: [],
    consumedColorGemCount: 9,
    startGemMergeFx: () => {},
    getGoldLabelTargetWorld: () => null,
  });

  assert.equal(activated, true);
  assert.deepEqual(calls.find(call => call.name === 'ResolvePurpleSuperGemEnergyAction')?.args, [7, 1]);
});

test('purple super-gem spend costs one energy while other supergems keep default cost', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'superGemBoardState.mjs'), 'utf8');
  assert.match(src, /const resolvedSuperGemCost = Number\(superGem\?\.baseColor\) === 5 \? 1 : Number\(superGemCost \|\| 0\);/);
  assert.match(src, /const afterEnergy = Math\.max\(0, beforeEnergy - resolvedSuperGemCost\);/);
  assert.match(src, /area: resolvedSuperGemCost,/);
});
