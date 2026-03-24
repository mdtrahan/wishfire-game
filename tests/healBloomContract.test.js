const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('heal bloom module uses heavy plus glyph particles and GSAP timelines', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'healBloomAnimation.mjs'), 'utf8');
  assert.match(src, /import\s+\{\s*gsap\s*\}\s+from\s+'..\/..\/..\/node_modules\/gsap\/index\.js';/);
  assert.match(src, /glyph: '➕',/);
  assert.match(src, /fontWeight: 800,/);
  assert.match(src, /color: '#A0FE0B',/);
  assert.match(src, /const total = Math\.max\(8, Math\.min\(14, Math\.floor\(Number\(count \|\| 12\)\)\)\);/);
  assert.match(src, /const tl = gsap\.timeline\(\);/);
  assert.match(src, /ease: 'back\.out\(1\.6\)'/);
  assert.match(src, /ease: 'power2\.out'/);
  assert.match(src, /ease: 'sine\.out'/);
  assert.match(src, /ease: 'power1\.out'/);
  assert.match(src, /const delay = random\(0, 0\.15\);/);
  assert.match(src, /const rotation = random\(-20, 20\);/);
});

test('app heal path spawns heal bloom on hero sprites and renders it behind actors', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  assert.match(src, /import\s+\{\s*createHealBloom\s*\}\s+from\s+'\.\/src\/core\/healBloomAnimation\.mjs';/);
  assert.match(src, /if \(d\.kind === 'heal' && d\.targetKind === 'hero' && !d\.healBloomSpawned\) \{/);
  assert.match(src, /d\.healBloomAnimation = createHealBloom\(\{/);
  assert.match(src, /else if \(d\.kind === 'heal' && d\.targetKind === 'bar' && !d\.healBloomSpawned\) \{/);
  assert.match(src, /const heroPositions = Array\.isArray\(state\.globals\.HeroIconPosByIndex\) \? state\.globals\.HeroIconPosByIndex : \[\];/);
  assert.match(src, /for \(const pos of heroPositions\) \{/);
  assert.match(src, /gameState\.healBlooms = Array\.isArray\(gameState\.healBlooms\) \? gameState\.healBlooms : \[\];/);
  assert.match(src, /gameState\.healBlooms\.push\(d\.healBloomAnimation\);/);
  assert.match(src, /if \(bloom\) gameState\.healBlooms\.push\(bloom\);/);
  assert.match(src, /const renderHealBlooms = \(\) => \{/);
  assert.match(src, /ctx\.fillRect\(-arm \/ 2, -length \/ 2, arm, length\);/);
  assert.match(src, /ctx\.fillRect\(-length \/ 2, -arm \/ 2, length, arm\);/);
  assert.match(src, /renderHealBlooms\(\);\s+\n\s*\/\/ Render hero portraits/);
});

test('party regen uses a persistent hero shimmer instead of a tint overlay', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  assert.match(src, /const hasPersistentHeroRegenOverlay = \(\) => \{/);
  assert.match(src, /const regens = Array\.isArray\(state\.globals\.PartyRegens\) \? state\.globals\.PartyRegens : \[\];/);
  assert.match(src, /const renderHeroRegenShimmer = \(drawX, drawY, scaledW, scaledH, seed = 0\) => \{/);
  assert.match(src, /const lineCount = 4;/);
  assert.match(src, /const diamondCount = 3;/);
  assert.doesNotMatch(src, /renderHeroRegenShimmer[\s\S]*ctx\.clip\(\);/);
  assert.match(src, /const lineX = drawX \+ scaledW \* \(0\.16 \+ i \* 0\.2\);/);
  assert.match(src, /ctx\.globalAlpha = 0\.096 \+ normalized \* 0\.216;/);
  assert.match(src, /ctx\.fillStyle = '#A0FE0B';/);
  assert.match(src, /const cycle = \(shimmerNow \* 0\.22 \+ seed \* 0\.09 \+ i \* 0\.31\) % 1;/);
  assert.match(src, /const diamondSize = Math\.max\(3, scaledW \* 0\.045\);/);
  assert.match(src, /const alpha = cycle < 0\.12 \? \(cycle \/ 0\.12\) \* 1\.12 : \(1 - cycle\) \* 1\.12;/);
  assert.match(src, /ctx\.globalAlpha = Math\.max\(0, Math\.min\(1, alpha\)\);/);
  assert.match(src, /ctx\.fillStyle = '#FFFFFF';/);
  assert.match(src, /ctx\.shadowColor = '#F4E96A';/);
  assert.match(src, /ctx\.quadraticCurveTo\(diamondSize \* 0\.55, -diamondSize \* 0\.35, diamondSize, 0\);/);
  assert.match(src, /if \(hero && hasPersistentHeroRegenOverlay\(\)\) \{\s*renderHeroRegenShimmer\(drawX, drawY, scaledW, scaledH, hero\.uid\);\s*\}/s);
  assert.match(src, /if \(hero && isHitFlashActive\(hero\.uid\)\) \{/);
  assert.doesNotMatch(src, /tone === 'regen'/);
});
