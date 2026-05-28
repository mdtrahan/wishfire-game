const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('power amp arms for next own turn before becoming active', async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'powerAmpRules.mjs')).href);
  const armed = mod.createPowerAmpArmedEntry(3, 12, 44, 9);
  assert.equal(armed.state, 'pending_next_own_turn');
  assert.equal(armed.mult, 0);
  assert.equal(armed.pendingMult, 3);

  const sameTurn = mod.derivePowerAmpActivationEntry(armed, 12, 44);
  assert.equal(sameTurn.activated, false);
  assert.equal(sameTurn.entry.state, 'pending_next_own_turn');

  const nextTurn = mod.derivePowerAmpActivationEntry(armed, 13, 45);
  assert.equal(nextTurn.activated, true);
  assert.equal(nextTurn.entry.state, 'active_this_turn');
  assert.equal(nextTurn.entry.mult, 3);
});

test('power amp combat log messaging reflects next-turn arming semantics in both mirrors', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');
  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /Lucky! Heroes are amped up!/);
    assert.match(src, /armed Power Amp x\$\{outcome\.multiplier\} for next turn!/);
  }
});

