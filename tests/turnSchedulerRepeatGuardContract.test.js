const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('initiative repeat guard only flags improper same-actor repeats in time mode', async () => {
  const guards = await import(path.join('file://', __dirname, '..', 'web-runner', 'src', 'core', 'initiativeGuards.mjs'));

  assert.equal(guards.shouldAutoCorrectImproperRepeat({
    timeMode: true,
    beforeUID: 11,
    afterSlot: { uid: 11 },
    queue: [{ uid: 11 }, { uid: 22 }],
  }), true);

  assert.equal(guards.shouldAutoCorrectImproperRepeat({
    timeMode: false,
    beforeUID: 11,
    afterSlot: { uid: 11 },
    queue: [{ uid: 11 }, { uid: 22 }],
  }), false);

  assert.equal(guards.shouldAutoCorrectImproperRepeat({
    timeMode: true,
    beforeUID: 11,
    afterSlot: { uid: 11 },
    queue: [{ uid: 11 }],
  }), false);

  assert.deepEqual(
    guards.sanitizeInitiativeQueue([
      { uid: 11, extra: false },
      { uid: 22, extra: false },
      { uid: 11, extra: true },
    ], { allowExtraRepeats: true }),
    [
      { uid: 11, extra: false },
      { uid: 22, extra: false },
      { uid: 11, extra: true },
    ],
  );
});

test('advance turn keeps the improper-repeat autocorrection seam active', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'), 'utf8');
  assert.match(src, /shouldAutoCorrectImproperRepeat\(\{/);
  assert.match(src, /recordTurnSchedulerEvent\(ctx, 'pointer_advance', \{/);
});
