const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function sliceBetween(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return src.slice(start, end);
}

test('heal bloom module uses heavy plus glyph particles and GSAP timelines', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'healBloomAnimation.mjs'), 'utf8');
  assert.match(src, /import\s+\{\s*gsap\s*\}\s+from\s+'\.\/gsapShim\.mjs';/);
  assert.match(src, /glyph: '➕',/);
  assert.match(src, /fontWeight: 800,/);
  assert.match(src, /color: '#A0FE0B',/);
  assert.match(src, /const total = Math\.max\(8, Math\.min\(14, Math\.floor\(Number\(count \|\| 12\)\)\)\);/);
  assert.match(src, /const HEAL_BLOOM_WIDTH_SCALE = 0\.8;/);
  assert.match(src, /const dx = Math\.cos\(angle\) \* distance \* HEAL_BLOOM_WIDTH_SCALE;/);
  assert.match(src, /const tl = gsap\.timeline\(\);/);
  assert.match(src, /ease: 'back\.out\(1\.6\)'/);
  assert.match(src, /ease: 'power2\.out'/);
  assert.match(src, /ease: 'sine\.out'/);
  assert.match(src, /ease: 'power1\.out'/);
  assert.match(src, /const delay = random\(0, 0\.15\);/);
  assert.match(src, /const rotation = random\(-20, 20\);/);
});

test('app heal path spawns heal bloom on hero sprites and renders it behind actors', () => {
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const spawnSrc = sliceBetween(appSrc, 'function spawnPendingDamageNumbers', 'const RUNTIME_FINGERPRINT');
  const renderSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  assert.match(appSrc, /import\s+\{\s*createHealBloom\s*\}\s+from\s+'\.\/src\/core\/healBloomAnimation\.mjs';/);
  assert.match(spawnSrc, /if \(d\.kind === 'heal' && d\.targetKind === 'hero' && !d\.healBloomSpawned\) \{/);
  assert.match(spawnSrc, /d\.healBloomAnimation = createHealBloom\(\{/);
  assert.match(spawnSrc, /else if \(d\.kind === 'heal' && d\.targetKind === 'enemy' && !d\.healBloomSpawned\) \{[\s\S]*d\.healBloomAnimation = createHealBloom\(\{[\s\S]*x: d\.x,[\s\S]*y: d\.baseY != null \? d\.baseY : d\.y,[\s\S]*gameState\.healBlooms\.push\(d\.healBloomAnimation\);[\s\S]*\} else if \(d\.kind === 'heal' && d\.targetKind === 'bar'/);
  assert.match(spawnSrc, /else if \(d\.kind === 'heal' && d\.targetKind === 'bar' && !d\.healBloomSpawned\) \{/);
  assert.match(spawnSrc, /const heroPositions = Array\.isArray\(state\.globals\.HeroIconPosByIndex\) \? state\.globals\.HeroIconPosByIndex : \[\];/);
  assert.match(spawnSrc, /for \(const pos of heroPositions\) \{/);
  assert.match(spawnSrc, /gameState\.healBlooms = Array\.isArray\(gameState\.healBlooms\) \? gameState\.healBlooms : \[\];/);
  assert.match(spawnSrc, /gameState\.healBlooms\.push\(d\.healBloomAnimation\);/);
  assert.match(spawnSrc, /if \(bloom\) gameState\.healBlooms\.push\(bloom\);/);
  assert.match(renderSrc, /const renderHealBlooms = \(\) => \{/);
  assert.match(renderSrc, /ctx\.fillRect\(-arm \/ 2, -length \/ 2, arm, length\);/);
  assert.match(renderSrc, /ctx\.fillRect\(-length \/ 2, -arm \/ 2, length, arm\);/);
  assert.match(renderSrc, /renderHealBlooms\(\);[\s\S]*\/\/ Render hero portraits/);
});

test('party regen uses a persistent hero shimmer instead of a tint overlay', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  const shimmerSrc = sliceBetween(src, 'const renderHeroRegenShimmer', 'const renderEnemyTaintedGround');
  assert.match(src, /const hasPersistentHeroRegenOverlay = \(\) => \{/);
  assert.match(src, /const regens = Array\.isArray\(state\.globals\.PartyRegens\) \? state\.globals\.PartyRegens : \[\];/);
  assert.match(shimmerSrc, /const renderHeroRegenShimmer = \(drawX, drawY, scaledW, scaledH, seed = 0\) => \{/);
  assert.match(shimmerSrc, /const lineCount = 4;/);
  assert.match(shimmerSrc, /const diamondCount = 3;/);
  assert.doesNotMatch(shimmerSrc, /ctx\.clip\(\);/);
  assert.match(shimmerSrc, /const lineX = drawX \+ scaledW \* \(0\.16 \+ i \* 0\.2\);/);
  assert.match(shimmerSrc, /ctx\.globalAlpha = 0\.096 \+ normalized \* 0\.216;/);
  assert.match(shimmerSrc, /ctx\.fillStyle = '#A0FE0B';/);
  assert.match(shimmerSrc, /const cycle = \(shimmerNow \* 0\.22 \+ seed \* 0\.09 \+ i \* 0\.31\) % 1;/);
  assert.match(shimmerSrc, /const diamondSize = Math\.max\(3, scaledW \* 0\.045\);/);
  assert.match(shimmerSrc, /const alpha = cycle < 0\.12 \? \(cycle \/ 0\.12\) \* 1\.12 : \(1 - cycle\) \* 1\.12;/);
  assert.match(shimmerSrc, /ctx\.globalAlpha = Math\.max\(0, Math\.min\(1, alpha\)\);/);
  assert.match(shimmerSrc, /ctx\.fillStyle = '#FFFFFF';/);
  assert.match(shimmerSrc, /ctx\.shadowColor = '#F4E96A';/);
  assert.match(shimmerSrc, /ctx\.quadraticCurveTo\(diamondSize \* 0\.55, -diamondSize \* 0\.35, diamondSize, 0\);/);
  assert.match(src, /hasPersistentHeroRegenOverlay\(\)[\s\S]*renderHeroRegenShimmer\(drawX, drawY, scaledW, scaledH, hero\.uid\);/);
  assert.match(src, /if \(hero && isHitFlashActive\(hero\.uid\)\) \{/);
  assert.doesNotMatch(src, /tone === 'regen'/);
});
