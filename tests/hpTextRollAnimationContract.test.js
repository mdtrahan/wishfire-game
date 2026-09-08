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

test('combat health presentation reads hero HP while simulation stays independent of rolling text', () => {
  const commandSrc = read('web-runner/systems/heroCommandUI.mjs');
  assert.match(commandSrc, /bar.value = Math.max\(0, hero.hp\)/);
  for (const file of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    assert.doesNotMatch(read(file), /hpTextRoll|HP_TEXT_ROLL|updateHpTextRollState/);
  }
});
