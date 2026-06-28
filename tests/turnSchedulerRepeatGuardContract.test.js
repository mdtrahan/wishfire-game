const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const rootGuardPath = path.join(__dirname, '..', 'src', 'core', 'initiativeGuards.mjs');
const runnerGuardPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'initiativeGuards.mjs');

async function importGuards(filePath) {
  return import(path.join('file://', filePath));
}

test('initiative repeat guard only flags improper same-actor repeats in time mode', async () => {
  const guardModules = [
    await importGuards(rootGuardPath),
    await importGuards(runnerGuardPath),
  ];

  for (const guards of guardModules) {
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
  }
});

test('initiative guard root and browser mirrors stay aligned', () => {
  assert.equal(fs.readFileSync(rootGuardPath, 'utf8'), fs.readFileSync(runnerGuardPath, 'utf8'));
});

test('Scripts functionBank initiative guard import resolves to shared root core', () => {
  const scriptsPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
  const scriptsSrc = fs.readFileSync(scriptsPath, 'utf8');
  const match = scriptsSrc.match(/from ['"](\.\.\/src\/core\/initiativeGuards\.mjs)['"]/);
  assert.ok(match, 'Scripts/functionBank.js must import initiativeGuards from root src/core');
  assert.equal(path.resolve(path.dirname(scriptsPath), match[1]), rootGuardPath);
  assert.ok(fs.existsSync(rootGuardPath), 'root initiativeGuards.mjs must exist for Scripts/functionBank.js');
});

test('advance turn keeps the improper-repeat autocorrection seam active', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'), 'utf8');
  assert.match(src, /shouldAutoCorrectImproperRepeat\(\{/);
  assert.match(src, /recordTurnSchedulerEvent\(ctx, 'pointer_advance', \{/);
});
