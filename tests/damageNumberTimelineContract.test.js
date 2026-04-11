const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('damage number animation module keeps each damage value grouped as one animated text node', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'damageNumberAnimation.mjs');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /import\s+\{\s*gsap\s*\}\s+from\s+'\.\/gsapShim\.mjs';/);
  assert.match(src, /const DAMAGE_TEXT_FONT = '"Rubik Mono One", "Trebuchet MS", "Verdana", sans-serif';/);
  assert.match(src, /const DAMAGE_TEXT_FONT_SPEC = `28px \$\{DAMAGE_TEXT_FONT\}`;/);
  assert.match(src, /export function ensureDamageTextFontReady\(\)/);
  assert.match(src, /export function isDamageTextFontReady\(\)/);
  assert.match(src, /const numberText = document\.createElement\('canvas'\);/);
  assert.match(src, /const tl = activeTimeline = gsap\.timeline\(\{\s*onComplete: cleanup,\s*\}\);/);
  assert.match(src, /const ctx = numberText\.getContext\('2d'\);/);
  assert.match(src, /gsap\.set\(wrapper,\s*\{[\s\S]*x: 0,[\s\S]*y: 0,[\s\S]*opacity: 0,[\s\S]*transformOrigin: 'center bottom',[\s\S]*\}\);/);
  assert.match(src, /gsap\.set\(numberText,[\s\S]*y: 0,[\s\S]*rotation: 0,[\s\S]*scaleX: 1,[\s\S]*scaleY: 1,[\s\S]*opacity: 1,[\s\S]*\}\);/);
  assert.match(src, /tl\.set\(wrapper,\s*\{[\s\S]*opacity: 1,[\s\S]*y: 0,[\s\S]*\}\);/);
  assert.match(src, /tl\.to\(wrapper,\s*\{[\s\S]*y: -28,[\s\S]*duration: 0\.8,[\s\S]*ease: 'power2\.out',[\s\S]*\}, 0\);/);
  assert.match(src, /tl\.to\(wrapper,\s*\{[\s\S]*y: -28,[\s\S]*opacity: 1,[\s\S]*duration: 0\.484,[\s\S]*ease: 'none',[\s\S]*\}\);/);
  assert.match(src, /tl\.to\(wrapper,\s*\{[\s\S]*opacity: 0,[\s\S]*duration: 0\.16,[\s\S]*ease: 'sine\.out',[\s\S]*\}\);/);
  assert.match(src, /ctx\.createLinearGradient\(0, 0, 0, approxHeight\);/);
  assert.match(src, /ctx\.strokeText\(value, approxWidth \/ 2, approxHeight \/ 2 \+ 1\);/);
  assert.match(src, /ctx\.fillText\(value, approxWidth \/ 2, approxHeight \/ 2 \+ 1\);/);
  assert.match(src, /ctx\.shadowBlur = 0;/);
  assert.match(src, /ctx\.shadowOffsetY = 0;/);
  assert.match(src, /wrapper\.appendChild\(numberText\);/);
  assert.match(src, /container\.appendChild\(wrapper\);[\s\S]*if \(isDamageTextFontReady\(\)\) \{/);
  assert.match(src, /if \(isDamageTextFontReady\(\)\) \{/);
  assert.match(src, /ensureDamageTextFontReady\(\)\.then\(\(\) => \{/);
  assert.match(src, /const isHeal = String\(kind \|\| 'damage'\) === 'heal';/);
  assert.match(src, /const gradientStops = isHeal/);
  assert.match(src, /gsap\.set\(numberText,/);
  assert.doesNotMatch(src, /rgba\(255,215,96/);
  assert.doesNotMatch(src, /filter: 'brightness\(1\.9\)'/);
  assert.match(src, /ease: 'power2\.out'/);
  assert.match(src, /ease: 'sine\.out'/);
  assert.match(src, /onComplete: cleanup/);
  assert.doesNotMatch(src, /backgroundClip = 'text'/);
  assert.doesNotMatch(src, /webkitTextFillColor = 'transparent'/);
  assert.doesNotMatch(src, /ctx\.globalAlpha = 0\.7/);
  assert.doesNotMatch(src, /random\(/);
  assert.doesNotMatch(src, /glowColor/);
});

test('app damage text path spawns DOM damage numbers instead of canvas text rendering', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /import\s+\{\s*createDamageNumber,\s*ensureDamageTextFontReady,\s*isDamageTextFontReady\s*\}\s+from\s+'\.\/src\/core\/damageNumberAnimation\.mjs';/);
  assert.match(src, /function ensureDamageNumberLayer\(\)/);
  assert.match(src, /function spawnPendingDamageNumbers\(projectToCanvas = null\)/);
  assert.match(src, /if \(!texts\.length \|\| typeof projectToCanvas !== 'function'\) return;/);
  assert.match(src, /const pos = projectToCanvas\(/);
  assert.match(src, /const isCrit = !!d\.isCrit;/);
  assert.match(src, /formatDamageValue\(\{ value: d\.amount, type: 'heal', isCrit \}\)/);
  assert.match(src, /formatDamageValue\(\{ value: d\.amount, type: d\.kind === 'heal' \? 'heal' : 'damage', isCrit \}\)/);
  assert.match(src, /const animation = createDamageNumber\(\{/);
  assert.match(src, /if \(animation\) \{/);
  assert.match(src, /d\.domAnimation = animation;/);
  assert.match(src, /kind: d\.kind === 'heal' \? 'heal' : 'damage',/);
  assert.match(src, /targetKind: d\.targetKind \|\| null,/);
  assert.match(src, /spawnPendingDamageNumbers\(worldToCanvas\);/);
  assert.match(src, /if \(damageNumberLayer && \(d\.domAnimation \|\| d\.domSpawned\)\) continue;/);
});

test('mirrored function banks carry explicit crit metadata into floating text payloads', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const filePath = path.join(__dirname, '..', relPath);
    const src = fs.readFileSync(filePath, 'utf8');
    assert.match(src, /g\.LastCalculatedDamageCrit = Boolean\(crit\.didCrit\);/);
    assert.match(src, /g\.LastCalculatedHealCrit = Boolean\(crit\.didCrit\);/);
    assert.match(src, /SpawnDamageText\(ctx, appliedDamage, dx, dy, damageTextKind, t\.kind \|\| null, \{\s*isCrit: !!options\?\.isCrit,/);
    assert.match(src, /SpawnDamageText\(ctx, heal, [^\\n]+ 'heal', 'enemy', \{ isCrit: !!healInfo\.didCrit \}\);/);
    assert.match(src, /isCrit: !!options\?\.isCrit,/);
    assert.match(src, /isCrit: !!options\?\.isCrit,\s*powerAmpMultiplier:/s);
    assert.match(src, /isCrit: !!options\?\.isCrit,/);
    assert.match(src, /didCrit: !!hit\.didCrit,/);
  }
});

test('app queued damage and over-time paths preserve crit metadata', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /const actualHeal = Math\.max\(0, afterHP - beforeHP\);/);
  assert.match(src, /partyHpBarAnim\.hotOverlayUntil = Math\.max\(/);
  assert.match(src, /ApplyDamageToTarget', dot\.targetUID, dmg, \{\s*isCrit: !!dot\.isCrit \|\| Number\(dot\.powerAmpMultiplier \|\| 0\) > 0,/);
  assert.match(src, /const overTimeCrit = !!hit\.didCrit \|\| Number\(hit\.powerAmpMultiplier \|\| 0\) > 0;/);
  assert.match(src, /QueueEnemyDamageOverTime', hit\.heroUID, hit\.targetUID, remainingDotDamage, \{[\s\S]*isCrit: overTimeCrit,[\s\S]*powerAmpMultiplier: Number\(hit\.powerAmpMultiplier \|\| 0\),/);
  assert.match(src, /ApplyDamageToTarget', hit\.targetUID, finalDmg, \{\s*isCrit: !!hit\.didCrit \|\| ampMult > 0,/);
});

test('power amp queue provenance survives multi-hit and Kojonn Faze application paths', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const filePath = path.join(__dirname, '..', relPath);
    const src = fs.readFileSync(filePath, 'utf8');
    assert.match(src, /finalDmg: shotDamage,[\s\S]*powerAmpMultiplier: ampMult,/);
    assert.match(src, /dotTotalDamage: kojonnDotDamage,[\s\S]*powerAmpMultiplier: ampMult,/);
    assert.match(src, /casts Faze on enemies\./);
    assert.match(src, /casts Faze on \$\{enemy\.name \|\| 'Enemy'\}!/);
  }
});
