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
    assert.match(src, /const damageTextKind = String\(g\.NextDamageTextKind \|\| 'damage'\);/);
    assert.match(src, /SpawnDamageText\(ctx, appliedDamage, dx, dy, damageTextKind, t\.kind \|\| null, \{/);
    assert.match(src, /delete g\.NextDamageTextKind;/);
  }
});

test('renderer avoids duplicate canvas floating text when dom layer is active', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /const renderDamageTexts = \(filterFn\) => \{/);
  assert.match(src, /if \(damageNumberLayer\) syncDamageNumberLayerBounds\(\);/);
  assert.match(src, /if \(damageNumberLayer && \(d\.domAnimation \|\| d\.domSpawned\)\) continue;/);
});

test('web runner loads Rubik Mono One for combat floating text', () => {
  const src = read('web-runner/index.html');
  assert.match(src, /fonts\.googleapis\.com\/css2\?family=Rubik\+Mono\+One&display=swap/);
});

test('app preloads the combat text font before rendering damage numbers', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /ensureDamageTextFontReady\(\);/);
  assert.match(src, /isDamageTextFontReady\(\)/);
});

test('canvas fallback keeps non-heal kinds mapped to damage instead of dropping', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /const kind = d\.kind === 'heal' \? 'heal' : 'damage';/);
});

test('dom floating numbers apply outlined gradients, glow, and squash-stretch for damage\/heal', () => {
  const src = read('web-runner/src/core/damageNumberAnimation.mjs');
  assert.match(src, /const gradientStops = isHeal/);
  assert.match(src, /#86eb2e/);
  assert.match(src, /#9fdfff/);
  assert.match(src, /#fbfdce/);
  assert.match(src, /#f7f8d4/);
  assert.match(src, /const numberText = document\.createElement\('canvas'\);/);
  assert.match(src, /const ctx = numberText\.getContext\('2d'\);/);
  assert.match(src, /const DAMAGE_TEXT_FONT = '"Rubik Mono One", "Trebuchet MS", "Verdana", sans-serif';/);
  assert.match(src, /numberText\.style\.background = 'transparent';/);
  assert.match(src, /numberText\.style\.border = 'none';/);
  assert.match(src, /ctx\.shadowColor = 'transparent';/);
  assert.match(src, /ctx\.shadowOffsetY = 0;/);
  assert.match(src, /ctx\.strokeStyle = '#0f0f0f';/);
  assert.match(src, /ctx\.createLinearGradient\(0, 0, 0, approxHeight\);/);
  assert.match(src, /ctx\.fillText\(value, approxWidth \/ 2, approxHeight \/ 2 \+ 1\);/);
  assert.match(src, /tl\.to\(wrapper,\s*\{[\s\S]*y: -28,[\s\S]*duration: 0\.8/);
  assert.match(src, /tl\.to\(wrapper,\s*\{[\s\S]*opacity: 0,[\s\S]*duration: 0\.16/);
  assert.doesNotMatch(src, /ctx\.globalAlpha = 0\.7/);
  assert.doesNotMatch(src, /glowColor/);
  assert.doesNotMatch(src, /rotation: random/);
  assert.doesNotMatch(src, /backgroundClip = 'text'/);
  assert.doesNotMatch(src, /webkitTextFillColor = 'transparent'/);
});

test('Kojonn dot paths explicitly arm dot floating-text kind before damage application', () => {
  const src = read('web-runner/app.js');
  const dotKindHooks = src.match(/state\.globals\.NextDamageTextKind = 'dot';/g) || [];
  assert.ok(dotKindHooks.length >= 2, 'expected dot text kind to be armed for immediate and queued Kojonn dot damage');
});
