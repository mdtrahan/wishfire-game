const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('damage float vector treats zero degrees as straight upward motion', async () => {
  const root = await import('../src/core/damageFloatVector.mjs');
  const runner = await import('../web-runner/src/core/damageFloatVector.mjs');
  for (const mod of [root, runner]) {
    const vector = mod.deriveDamageFloatVector({ angleDeg: 0, travel: 28 });
    assert.equal(vector.angleDeg, 0);
    assert.equal(vector.x, 0);
    assert.equal(vector.y, -28);
    assert.equal(mod.isDamageFloatVectorUpward(vector), true);
  }
});

test('damage float vectors clamp dispersion and always translate upward', async () => {
  const { deriveDamageFloatVector } = await import('../src/core/damageFloatVector.mjs');
  const left = deriveDamageFloatVector({ angleDeg: -30, travel: 28 });
  const right = deriveDamageFloatVector({ angleDeg: 30, travel: 28 });
  const clamped = deriveDamageFloatVector({ angleDeg: 90, travel: 28, maxAbsAngleDeg: 30 });

  assert.ok(left.x < 0);
  assert.ok(right.x > 0);
  assert.ok(left.y < 0);
  assert.ok(right.y < 0);
  assert.equal(clamped.angleDeg, 30);
  assert.ok(clamped.y < 0);
});

test('damage float frame offsets expose measurable angled x movement over time', async () => {
  const { deriveDamageFloatFrameOffset, deriveDamageFloatVector } = await import('../src/core/damageFloatVector.mjs');
  const vector = deriveDamageFloatVector({ angleDeg: 30, travel: 28 });
  const start = deriveDamageFloatFrameOffset({
    floatAngleDeg: vector.angleDeg,
    floatVectorX: vector.x,
    floatVectorY: vector.y,
    floatTravel: vector.travel,
  }, 0);
  const mid = deriveDamageFloatFrameOffset({
    floatAngleDeg: vector.angleDeg,
    floatVectorX: vector.x,
    floatVectorY: vector.y,
    floatTravel: vector.travel,
  }, 0.5);
  const end = deriveDamageFloatFrameOffset({
    floatAngleDeg: vector.angleDeg,
    floatVectorX: vector.x,
    floatVectorY: vector.y,
    floatTravel: vector.travel,
  }, 1);

  assert.equal(start.x, 0);
  assert.equal(start.y, 0);
  assert.ok(mid.x > 0);
  assert.ok(mid.y < 0);
  assert.ok(end.x > mid.x);
  assert.ok(end.y < mid.y);
});

test('damage float angle selection is deterministic under injected random sources', async () => {
  const { pickDamageFloatAngleDeg } = await import('../src/core/damageFloatVector.mjs');
  assert.equal(pickDamageFloatAngleDeg({ random: () => 0, maxAbsAngleDeg: 30 }), -30);
  assert.equal(pickDamageFloatAngleDeg({ random: () => 0.5, maxAbsAngleDeg: 30 }), 4.5);
  assert.equal(pickDamageFloatAngleDeg({ random: () => 0.999, maxAbsAngleDeg: 30 }) > 29.9, true);
});

test('damage float angle selection decorrelates repeated random values by spawn sequence', async () => {
  const root = await import('../src/core/damageFloatVector.mjs');
  const runner = await import('../web-runner/src/core/damageFloatVector.mjs');
  for (const mod of [root, runner]) {
    const angles = [1, 2, 3, 4].map((sequence) => mod.pickDamageFloatAngleDeg({
      random: () => 0.5,
      maxAbsAngleDeg: 30,
      sequence,
    }));
    assert.equal(new Set(angles.map((angle) => angle.toFixed(4))).size, angles.length);
    assert.equal(angles.every((angle) => Math.abs(angle) >= 4.5 && Math.abs(angle) <= 30), true);
    assert.equal(angles.some((angle) => angle < 0), true);
    assert.equal(angles.some((angle) => angle > 0), true);
  }
});

test('default damage float dispersion spans sixty degrees total with a centered 15 percent deadzone', async () => {
  const root = await import('../src/core/damageFloatVector.mjs');
  const runner = await import('../web-runner/src/core/damageFloatVector.mjs');
  for (const mod of [root, runner]) {
    assert.equal(mod.DAMAGE_FLOAT_MAX_ANGLE_DEG, 30);
    assert.equal(mod.DAMAGE_FLOAT_CENTER_DEADZONE_FRACTION, 0.15);
    assert.equal(mod.pickDamageFloatAngleDeg({ random: () => 0 }), -30);
    assert.equal(mod.pickDamageFloatAngleDeg({ random: () => 0.499 }) < -4.5, true);
    assert.equal(mod.pickDamageFloatAngleDeg({ random: () => 0.5 }), 4.5);
    assert.equal(mod.pickDamageFloatAngleDeg({ random: () => 0.999 }) > 29.9, true);
  }
});

test('spawned damage text stores angle/vector proof fields in both function-bank mirrors', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');
  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /g\.DamageFloatSpawnSeq = \(Number\(g\.DamageFloatSpawnSeq \|\| 0\) \+ 1\);/);
    assert.match(src, /pickDamageFloatAngleDeg\(\{\s*random: getRandomSource\(ctx\),\s*maxAbsAngleDeg: floatMaxAngleDeg,\s*sequence: g\.DamageFloatSpawnSeq,\s*\}\)/);
    assert.match(src, /deriveDamageFloatVector\(\{/);
    assert.match(src, /baseX: drawX,/);
    assert.match(src, /floatAngleDeg: floatVector\.angleDeg,/);
    assert.match(src, /floatVectorX: floatVector\.x,/);
    assert.match(src, /floatVectorY: floatVector\.y,/);
    assert.match(src, /\[DAMAGE_FLOAT\]/);
  }
});

test('DOM and canvas fallback consume the same damage float vector fields', () => {
  const appSrc = read('web-runner/app.js');
  const domSrc = read('web-runner/src/core/damageNumberAnimation.mjs');
  const renderSrc = read('web-runner/systems/renderRuntime.js');

  assert.match(appSrc, /floatVector: \{\s*x: Number\(d\.floatVectorX \|\| 0\),\s*y: Number\(d\.floatVectorY \|\| 0\),\s*\}/);
  assert.match(appSrc, /damageTexts: \(state\.globals\.DamageTexts \|\| \[\]\)\.map/);
  assert.match(appSrc, /DebugDamageFloatVectors/);
  assert.match(domSrc, /wrapper\.dataset\.floatAngleDeg/);
  assert.match(domSrc, /x: floatX,/);
  assert.match(domSrc, /y: floatY,/);
  assert.match(renderSrc, /const floatOffset = deriveDamageFloatFrameOffset\(d, floatProgress\);/);
  assert.match(renderSrc, /baseX \+ xOffset \+ floatOffset\.x/);
  assert.match(renderSrc, /baseY \+ floatOffset\.y/);
});
