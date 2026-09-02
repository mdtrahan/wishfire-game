const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('damage application can route a dedicated floating-text kind through both function-bank mirrors', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');
  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /const damageTextKind = String\(g\.NextDamageTextKind \|\| getPendingDamageTextKind\(ctx, uid, dmg, opts\) \|\| 'damage'\);/);
    assert.match(src, /SpawnDamageText\(ctx, appliedDamage, dx, dy, damageTextKind, t\.kind \|\| null/);
    assert.match(src, /delete g\.NextDamageTextKind;/);
  }
});

test('renderer avoids duplicate canvas floating text when dom layer is active', () => {
  const src = read('web-runner/systems/renderRuntime.js');
  assert.match(src, /const renderDamageTexts = \(filterFn\) => \{/);
  assert.match(src, /if \(damageNumberLayer\) syncDamageNumberLayerBounds\(\);/);
  assert.match(src, /if \(damageNumberLayer && \(d\.domAnimation \|\| d\.domSpawned\)\) continue;/);
});

test('web runner loads Bungee locally for combat floating text', () => {
  const src = read('web-runner/index.html');
  assert.match(src, /font-family:"Bungee";/);
  assert.match(src, /src:url\("\.\/assets\/fonts\/Bungee-Regular\.ttf"\) format\("truetype"\);/);
  assert.doesNotMatch(src, /fonts\.googleapis\.com/);
  assert.doesNotMatch(src, /fonts\.gstatic\.com/);
});

test('app preloads the combat text font before rendering damage numbers', () => {
  const appSrc = read('web-runner/app.js');
  const renderSrc = read('web-runner/systems/renderRuntime.js');
  assert.match(appSrc, /ensureDamageTextFontReady\(\);/);
  assert.match(renderSrc, /isDamageTextFontReady\(\)/);
});

test('dom and canvas fallback preserve energy floating text as a readout effect', () => {
  const appSrc = read('web-runner/app.js');
  const renderSrc = read('web-runner/systems/renderRuntime.js');
  assert.match(appSrc, /const isEnergyText = d\.targetKind === 'energy' \|\| d\.kind === 'energy';/);
  assert.match(appSrc, /const domKind = isEnergyText/);
  assert.match(appSrc, /const xOffset = d\.targetKind === 'hero' \? -10 : \(d\.targetKind === 'ward' \? 0 : \(d\.canvasAnchored \? 0 : 10\)\);/);
  assert.match(appSrc, /const pos = d\.canvasAnchored/);
  assert.match(appSrc, /const text = isEnergyText/);
  assert.match(appSrc, /\?\s*`\+\$\{formatDamageValue\(\{ value: d\.amount, type: 'heal', isCrit \}\)\}`/);
  assert.match(appSrc, /kind: domKind,/);
  assert.match(renderSrc, /const kind = d\.kind === 'heal' \|\| d\.kind === 'energy' \|\| d\.kind === 'ward' \|\| d\.kind === 'arcane_pulse' \? d\.kind : 'damage';/);
  assert.match(renderSrc, /const xOffset = d\.targetKind === 'hero' \? -10 : \(d\.targetKind === 'ward' \? 0 : \(d\.canvasAnchored \? 0 : 10\)\);/);
  assert.match(renderSrc, /d\.targetKind === 'bar' \|\| d\.targetKind === 'energy'/);
  assert.match(renderSrc, /if \(kind === 'energy'\) \{/);
});

test('damage floating text has explicit global recency layers across spawn and render paths', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');
  const appSrc = read('web-runner/app.js');
  const renderSrc = read('web-runner/systems/renderRuntime.js');
  const animationSrc = read('web-runner/src/core/damageNumberAnimation.mjs');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /g\.DamageTextLayerSeq = Number\(g\.DamageTextLayerSeq \|\| 0\) \+ 1;/);
    assert.match(src, /const zIndex = g\.DamageTextLayerSeq;/);
    assert.match(src, /zIndex,/);
  }
  assert.match(appSrc, /const layeredTexts = texts/);
  assert.match(appSrc, /\.sort\(\(a, b\) => \(Number\(a\.d\?\.zIndex \|\| 0\) \|\| a\.index\) - \(Number\(b\.d\?\.zIndex \|\| 0\) \|\| b\.index\)\)/);
  assert.match(appSrc, /zIndex: Number\(d\.zIndex \|\| entry\.index \|\| 0\),/);
  assert.match(renderSrc, /const layeredDamageTexts = dmgTexts/);
  assert.match(renderSrc, /\.sort\(\(a, b\) => \(Number\(a\.d\?\.zIndex \|\| 0\) \|\| a\.index\) - \(Number\(b\.d\?\.zIndex \|\| 0\) \|\| b\.index\)\)/);
  assert.match(animationSrc, /zIndex = 4,/);
  assert.match(animationSrc, /wrapper\.style\.zIndex = String\(Math\.max\(4, Math\.floor\(Number\(zIndex \|\| 0\)\)\)\);/);
});

test('dom floating numbers apply outlined gradients, glow, and squash-stretch for damage\/heal\/energy', () => {
  const src = read('web-runner/src/core/damageNumberAnimation.mjs');
  assert.match(src, /const isEnergy = normalizedKind === 'energy';/);
  assert.match(src, /const ENERGY_TEXT_COLOR = '#D87DFF';/);
  assert.match(src, /const gradientStops = isEnergy/);
  assert.match(src, /\? \[ENERGY_TEXT_COLOR, ENERGY_TEXT_COLOR\]/);
  assert.match(src, /#86eb2e/);
  assert.match(src, /#9fdfff/);
  assert.match(src, /#fbfdce/);
  assert.match(src, /#f7f8d4/);
  assert.match(src, /const numberText = document\.createElement\('canvas'\);/);
  assert.match(src, /const ctx = numberText\.getContext\('2d'\);/);
  assert.match(src, /const DAMAGE_TEXT_FONT = '"Bungee", "Trebuchet MS", "Verdana", sans-serif';/);
  assert.match(src, /numberText\.style\.background = 'transparent';/);
  assert.match(src, /numberText\.style\.border = 'none';/);
  assert.match(src, /ctx\.shadowColor = 'transparent';/);
  assert.match(src, /ctx\.shadowOffsetY = 0;/);
  assert.match(src, /ctx\.strokeStyle = '#0f0f0f';/);
  assert.match(src, /ctx\.createLinearGradient\(0, 0, 0, approxHeight\);/);
  assert.match(src, /ctx\.fillText\(value, approxWidth \/ 2, approxHeight \/ 2 \+ 1\);/);
  assert.match(src, /travel: isEnergy \? DAMAGE_FLOAT_ENERGY_TRAVEL : DAMAGE_FLOAT_DEFAULT_TRAVEL,/);
  assert.match(src, /const floatY = Number\.isFinite\(Number\(floatVector && floatVector\.y\)\)/);
  assert.match(src, /const isWard = normalizedKind === 'ward';/);
  assert.match(src, /tl\.to\(wrapper,\s*\{[\s\S]*y: floatY,[\s\S]*duration: 0\.8/);
  assert.match(src, /tl\.to\(wrapper,\s*\{[\s\S]*opacity: 0,[\s\S]*duration: 0\.16/);
  assert.doesNotMatch(src, /ctx\.globalAlpha = 0\.7/);
  assert.doesNotMatch(src, /glowColor/);
  assert.doesNotMatch(src, /rotation: random/);
  assert.doesNotMatch(src, /backgroundClip = 'text'/);
  assert.doesNotMatch(src, /webkitTextFillColor = 'transparent'/);
});

test('damage floating text disperses upward and damage tiers scale by amount', () => {
  const animationSrc = read('web-runner/src/core/damageNumberAnimation.mjs');
  const appSrc = read('web-runner/app.js');
  const renderSrc = read('web-runner/systems/renderRuntime.js');
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /const partyMaxHP = Math\.max\(0, Number\(g\.PartyMaxHP \|\| 0\)\);/);
    assert.match(src, /partyMaxHP,/);
    assert.match(src, /baseX: drawX,/);
    assert.match(src, /floatAngleDeg: floatVector\.angleDeg,/);
  }

  assert.match(appSrc, /amount: d\.amount,/);
  assert.match(appSrc, /zIndex: Number\(d\.zIndex \|\| entry\.index \|\| 0\),/);
  assert.match(appSrc, /partyMaxHP: d\.partyMaxHP,/);
  assert.match(appSrc, /floatAngleDeg: d\.floatAngleDeg,/);
  assert.match(animationSrc, /partyMaxHP = 0,/);
  assert.match(animationSrc, /amount,\s*\n\s*partyMaxHP = 0,/);
  assert.match(animationSrc, /angleDeg = 0,/);
  assert.match(animationSrc, /const isWeakDamage = normalizedKind === 'damage' && Number\(amount\) < 10;/);
  assert.match(animationSrc, /const isLargeDamage = normalizedKind === 'damage'\s*\n\s*&& Number\(partyMaxHP\) > 0\s*\n\s*&& Number\(amount\) > Number\(partyMaxHP\) \* 0\.5;/);
  assert.match(animationSrc, /const damageFontSize = 28;/);
  assert.match(animationSrc, /const tierFontSize = isWeakDamage\s*\n\s*\? damageFontSize \* 0\.75\s*\n\s*: \(isLargeDamage \? damageFontSize \* 1\.2 : damageFontSize\);/);
  assert.match(animationSrc, /const fontSize = Math\.max\(1, Number\(displayFontSize\) \|\| tierFontSize\);/);
  assert.match(appSrc, /displayFontSize: computeCombatDamageFontSize\(\{/);
  assert.match(animationSrc, /const fallbackVector = deriveDamageFloatVector\(\{/);
  assert.match(animationSrc, /const floatX = Number\.isFinite\(Number\(floatVector && floatVector\.x\)\)/);
  assert.match(animationSrc, /const floatY = Number\.isFinite\(Number\(floatVector && floatVector\.y\)\)/);

  assert.match(renderSrc, /const floatOffset = deriveDamageFloatFrameOffset\(d, floatProgress\);/);
  assert.match(renderSrc, /baseX \+ xOffset \+ floatOffset\.x/);
  assert.match(renderSrc, /baseY \+ floatOffset\.y/);
  assert.match(renderSrc, /const damageTextType = kind === 'heal' \|\| kind === 'energy' \? 'heal' : 'damage';/);
  assert.match(renderSrc, /const isWeakDamage = damageTextType === 'damage' && Number\(d\.amount\) < 10;\\n\s*const isLargeDamage = damageTextType === 'damage' && Number\(d\.partyMaxHP\) > 0 && Number\(d\.amount\) > Number\(d\.partyMaxHP\) \* 0\.5;\\n\s*const fontBaseSize = isWeakDamage \? 22 \* 0\.75 : \(isLargeDamage \? 22 \* 1\.2 : \(d\.isCrit \? 26 : 22\)\);\\n\s*const fontSize = isWeakDamage \? scaleFont\(fontBaseSize\) : Math\.max\(scaleFont\(fontBaseSize\), 12\);/);
});

test('Kojonn dot paths explicitly arm dot floating-text kind before damage application', () => {
  const src = `${read('web-runner/app.js')}\n${read('web-runner/systems/renderRuntime.js')}`;
  const dotKindHooks = src.match(/(?:state\.globals|visualControlPatches)\.NextDamageTextKind = 'dot';/g) || [];
  assert.ok(dotKindHooks.length >= 2, 'expected dot text kind to be armed for immediate and queued Kojonn dot damage');
});
