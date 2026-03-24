const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('damage number animation module uses GSAP timelines with per-digit phases', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'damageNumberAnimation.mjs');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /import\s+\{\s*gsap\s*\}\s+from\s+'..\/..\/..\/node_modules\/gsap\/index\.js';/);
  assert.match(src, /const chars = Array\.from\(String\(text \|\| ''\)\);/);
  assert.match(src, /const wrapperTimeline = gsap\.timeline\(\{/);
  assert.match(src, /wrapperTimeline\.to\(wrapper, \{/);
  assert.match(src, /y: '-=60'/);
  assert.match(src, /x: '\+=4'/);
  assert.match(src, /chars\.forEach\(\(char, index\) => \{/);
  assert.match(src, /const tl = gsap\.timeline\(\{/);
  assert.match(src, /delay = index \* 0\.02/);
  assert.match(src, /const initialY = random\(-2, 2\);/);
  assert.match(src, /const initialRotation = random\(-3, 3\);/);
  assert.doesNotMatch(src, /const driftX = random\(/);
  assert.doesNotMatch(src, /x: initialX \+ driftX/);
  assert.match(src, /const isHeal = String\(kind \|\| 'damage'\) === 'heal';/);
  assert.match(src, /const isBarHeal = isHeal && String\(targetKind \|\| ''\) === 'bar';/);
  assert.match(src, /digit\.style\.color = isHeal/);
  assert.match(src, /\? \(isBarHeal \? '#05FD1B' : '#66CCFF'\)/);
  assert.match(src, /: '#FFFFFF';/);
  assert.doesNotMatch(src, /rgba\(255,215,96/);
  assert.doesNotMatch(src, /filter: 'brightness\(1\.9\)'/);
  assert.match(src, /ease: 'back\.out\(1\.7\)'/);
  assert.match(src, /ease: 'power2\.out'/);
  assert.match(src, /ease: 'sine\.out'/);
  assert.match(src, /ease: 'sine\.inOut'/);
  assert.match(src, /ease: 'power2\.in'/);
  assert.match(src, /ease: 'expo\.in'/);
  assert.match(src, /onComplete: cleanup/);
});

test('app damage text path spawns DOM damage numbers instead of canvas text rendering', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /import\s+\{\s*createDamageNumber\s*\}\s+from\s+'\.\/src\/core\/damageNumberAnimation\.mjs';/);
  assert.match(src, /function ensureDamageNumberLayer\(\)/);
  assert.match(src, /function spawnPendingDamageNumbers\(projectToCanvas = null\)/);
  assert.match(src, /if \(!texts\.length \|\| typeof projectToCanvas !== 'function'\) return;/);
  assert.match(src, /const pos = projectToCanvas\(/);
  assert.match(src, /const isCrit = !!d\.isCrit;/);
  assert.match(src, /formatDamageValue\(\{ value: d\.amount, type: 'heal', isCrit \}\)/);
  assert.match(src, /formatDamageValue\(\{ value: d\.amount, type: d\.kind === 'heal' \? 'heal' : 'damage', isCrit \}\)/);
  assert.match(src, /d\.domAnimation = createDamageNumber\(\{/);
  assert.match(src, /kind: d\.kind === 'heal' \? 'heal' : 'damage',/);
  assert.match(src, /targetKind: d\.targetKind \|\| null,/);
  assert.match(src, /spawnPendingDamageNumbers\(worldToCanvas\);/);
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
