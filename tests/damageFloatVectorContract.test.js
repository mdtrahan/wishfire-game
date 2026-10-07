const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('damage floats rise vertically even when old angled state reaches the fallback', async () => {
  const root = await import('../src/core/damageFloatVector.mjs');
  const runner = await import('../web-runner/src/core/damageFloatVector.mjs');
  for (const mod of [root, runner]) {
    assert.deepEqual(mod.deriveDamageFloatVector({ angleDeg: 30, travel: 28 }),
      { angleDeg: 0, x: 0, y: -28, travel: 28 });
    const stale = { floatAngleDeg: -30, floatVectorX: 14, floatVectorY: -24, floatTravel: 28 };
    assert.deepEqual(mod.deriveDamageFloatFrameOffset(stale, 0), { x: 0, y: 0, progress: 0 });
    assert.deepEqual(mod.deriveDamageFloatFrameOffset(stale, 0.5), { x: 0, y: -12, progress: 0.5 });
    assert.deepEqual(mod.deriveDamageFloatFrameOffset(stale, 1), { x: 0, y: -24, progress: 1 });
  }
});

test('both function-bank mirrors spawn damage text at the given point with a vertical vector', () => {
  for (const rel of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = read(rel);
    const body = src.slice(src.indexOf('export function SpawnDamageText('), src.indexOf('\nexport function ', src.indexOf('export function SpawnDamageText(') + 10));
    assert.match(body, /const drawX = x;/);
    assert.match(body, /const drawY = y;/);
    assert.match(body, /delete g\.NextDamageTextScatter;/);
    assert.match(body, /deriveDamageFloatVector\(\{ angleDeg: 0, travel: floatTravel \}\)/);
    assert.doesNotMatch(body, /Math\.random|pickDamageFloatAngleDeg|drawX \+=|drawY \+=/);
  }
});

test('DOM and Canvas damage floats grow from 40 percent to full size while rising', () => {
  const dom = read('web-runner/src/core/damageNumberAnimation.mjs');
  const canvas = read('web-runner/systems/renderRuntime.js');
  assert.match(dom, /scaleX: 0\.4,\s*scaleY: 0\.4/);
  assert.match(dom, /tl\.to\(numberText, \{\s*scaleX: 1,\s*scaleY: 1,\s*duration: 0\.12,\s*ease: 'power2\.out',\s*\}, 0\)/);
  assert.match(canvas, /const scalePulse = \(0\.4 \+ 0\.6 \* floatProgress\)/);
  assert.match(canvas, /const floatOffset = deriveDamageFloatFrameOffset\(d, floatProgress\);/);
});
