const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadDoHeal(relPath) {
  const src = fs.readFileSync(relPath, 'utf8')
    .replace(/^import .+;\n/gm, '')
    .replace(/export /g, '');
  return Function(`${src}; return DoHeal;`)();
}

function createKojonnHealContext({ runtimeRandom = () => 0 } = {}) {
  const calls = [];
  const globals = {
    PartyHP: 10,
    PartyMaxHP: 100,
    RuntimeRandom: runtimeRandom,
    TurnSerial: 12,
    PartyHPBarPosWorld: { x: 100, y: 20, w: 80, h: 12, ox: 0, oy: 0 },
  };
  const ctx = {
    state: { globals },
    globals,
    callFunction(name, ...args) {
      calls.push({ name, args });
      if (name === 'GetActorByUID') return { uid: args[0], name: 'Kojonn' };
      if (name === 'ApplyPartyHeal') {
        globals.PartyHP = Math.min(globals.PartyMaxHP, globals.PartyHP + Number(args[0] || 0));
        return undefined;
      }
      return undefined;
    },
  };
  return { ctx, calls };
}

test('Kojonn normal heal-gem potency uses the shared regular heal path without regen in either mirror', () => {
  for (const relPath of ['web-runner/modules/skillSheet.js', 'Scripts/skillSheet.js']) {
    const DoHeal = loadDoHeal(relPath);
    const { ctx, calls } = createKojonnHealContext();

    DoHeal(ctx, 4);

    assert.equal(ctx.globals.PartyHP, 17, `${relPath} should restore the regular 7 percent heal`);
    assert.deepEqual(ctx.globals.PartyRegens || [], [], `${relPath} should not queue Kojonn regen`);
    assert.ok(calls.some(call => call.name === 'ApplyPartyHeal' && call.args[0] === 7), `${relPath} should use shared ApplyPartyHeal`);
    assert.ok(calls.some(call => call.name === 'SpawnDamageText' && call.args[0] === 7 && call.args[3] === 'heal' && call.args[4] === 'bar'), `${relPath} should use shared heal text`);
    assert.ok(calls.some(call => call.name === 'LogCombat' && call.args[0] === 'Kojonn heals party for 7'), `${relPath} should use shared regular heal copy`);
    assert.ok(calls.every(call => !/Regen/.test(String(call.args[0] || ''))), `${relPath} should not log regen`);
    assert.equal(ctx.globals.DeferAdvance, 1, `${relPath} should still consume action pacing`);
    assert.equal(ctx.globals.AdvanceAfterAction, 1, `${relPath} should still advance after the action`);
    assert.equal(ctx.globals.ActionOwnerUID, 4, `${relPath} should preserve action ownership`);
  }
});

test('Kojonn heal supergem uses the shared critical heal path in either mirror', () => {
  for (const relPath of ['web-runner/modules/skillSheet.js', 'Scripts/skillSheet.js']) {
    const DoHeal = loadDoHeal(relPath);
    const { ctx, calls } = createKojonnHealContext({ runtimeRandom: () => 0.999 });

    DoHeal(ctx, 4, 6);

    assert.equal(ctx.globals.PartyHP, 52, `${relPath} should restore the shared 42 percent critical heal`);
    assert.deepEqual(ctx.globals.PartyRegens || [], [], `${relPath} should not queue Kojonn regen`);
    assert.ok(calls.some(call => call.name === 'ApplyPartyHeal' && call.args[0] === 42), `${relPath} should use shared ApplyPartyHeal`);
    assert.ok(calls.some(call => call.name === 'SpawnDamageText' && call.args[0] === 42 && call.args[3] === 'heal' && call.args[4] === 'bar'), `${relPath} should use shared heal text`);
    assert.ok(calls.some(call => call.name === 'LogCombat' && call.args[0] === 'Kojonn used Magic Fruit!'), `${relPath} should use Magic Fruit super-heal copy`);
  }
});

test('app processes turn-cadence party regens outside the timer tick lane', () => {
  const src = fs.readFileSync('web-runner/app.js', 'utf8');

  assert.match(src, /function processTurnCadencePartyRegens\(\) \{/);
  assert.match(src, /String\(regen\.cadence \|\| 'tick'\) !== 'turn'/);
  assert.match(src, /currentTurnSerial <= Number\(regen\.appliedOnTurnSerial \|\| 0\)/);
  assert.match(src, /regen\.nextFireTurnSerial = gateTurn \+ Math\.max\(1, Math\.floor\(Number\(regen\.firesEveryTurns \|\| 1\) \|\| 1\)\);/);
  assert.match(src, /syncSuperGemShapes\(\{ gameState, state, boardGeometry, reason: 'draw-frame' \}\);\n    processTurnCadencePartyRegens\(\);/);
});
