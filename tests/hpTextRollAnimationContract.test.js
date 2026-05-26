const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('HP text roll helper starts stable then rolls damage and healing toward canonical HP', async () => {
  const root = await import('../src/core/hpTextRollAnimation.mjs');
  const runner = await import('../web-runner/src/core/hpTextRollAnimation.mjs');

  for (const mod of [root, runner]) {
    const state = {};
    const initial = mod.updateHpTextRollState(state, {
      currentHp: 100,
      maxHp: 140,
      now: 0,
    });
    assert.equal(initial.displayHp, 100);
    assert.equal(initial.text, '100 / 140');
    assert.equal(initial.active, false);

    const damageStart = mod.updateHpTextRollState(state, {
      currentHp: 72,
      maxHp: 140,
      now: 1,
    });
    assert.equal(damageStart.displayHp, 100);
    assert.equal(damageStart.active, true);

    const damageMid = mod.updateHpTextRollState(state, {
      currentHp: 72,
      maxHp: 140,
      now: 1 + mod.HP_TEXT_ROLL_DURATION_SEC / 2,
    });
    assert.ok(damageMid.displayHp < 100);
    assert.ok(damageMid.displayHp > 72);
    assert.equal(damageMid.text.endsWith(' / 140'), true);

    const damageEnd = mod.updateHpTextRollState(state, {
      currentHp: 72,
      maxHp: 140,
      now: 1 + mod.HP_TEXT_ROLL_DURATION_SEC,
    });
    assert.equal(damageEnd.displayHp, 72);
    assert.equal(damageEnd.text, '72 / 140');
    assert.equal(damageEnd.active, false);

    const healStart = mod.updateHpTextRollState(state, {
      currentHp: 91,
      maxHp: 140,
      now: 2,
    });
    assert.equal(healStart.displayHp, 72);
    assert.equal(healStart.active, true);

    const healMid = mod.updateHpTextRollState(state, {
      currentHp: 91,
      maxHp: 140,
      now: 2 + mod.HP_TEXT_ROLL_DURATION_SEC / 2,
    });
    assert.ok(healMid.displayHp > 72);
    assert.ok(healMid.displayHp < 91);

    const healEnd = mod.updateHpTextRollState(state, {
      currentHp: 91,
      maxHp: 140,
      now: 2 + mod.HP_TEXT_ROLL_DURATION_SEC,
    });
    assert.equal(healEnd.displayHp, 91);
    assert.equal(healEnd.text, '91 / 140');
    assert.equal(healEnd.active, false);
  }
});

test('combat renderer uses HP text roll state only for PartyHP_text presentation', () => {
  const renderSrc = read('web-runner/systems/renderRuntime.js');
  const functionBankSrc = read('web-runner/modules/functionBank.js');
  const scriptsFunctionBankSrc = read('Scripts/functionBank.js');

  assert.match(renderSrc, /import\s+\{\s*updateHpTextRollState\s*\}\s+from\s+'..\/src\/core\/hpTextRollAnimation\.mjs';/);
  assert.match(renderSrc, /gameState\.partyHpTextRoll = gameState\.partyHpTextRoll \|\| \{\};/);
  assert.match(renderSrc, /const hpTextRoll = updateHpTextRollState\(gameState\.partyHpTextRoll, \{/);
  assert.match(renderSrc, /currentHp: cur,/);
  assert.match(renderSrc, /maxHp: max,/);
  assert.match(renderSrc, /now: state\.globals\.time \|\| 0,/);
  assert.match(renderSrc, /text = hpTextRoll\.text;/);
  assert.match(renderSrc, /const hpBarRoll = updateHpTextRollState\(gameState\.partyHpTextRoll, \{/);
  assert.match(renderSrc, /currentHp: state\.globals\.PartyHP \|\| 0,/);
  assert.match(renderSrc, /maxHp: maxHP,/);
  assert.match(renderSrc, /const ratio = Math\.max\(0, Math\.min\(1, hpBarRoll\.displayHp \/ maxHP\)\);/);
  assert.doesNotMatch(renderSrc, /const ratio = Math\.max\(0, Math\.min\(1, \(state\.globals\.PartyHP \|\| 0\) \/ maxHP\)\);/);

  assert.doesNotMatch(functionBankSrc, /hpTextRoll|HP_TEXT_ROLL|updateHpTextRollState/);
  assert.doesNotMatch(scriptsFunctionBankSrc, /hpTextRoll|HP_TEXT_ROLL|updateHpTextRollState/);
});
