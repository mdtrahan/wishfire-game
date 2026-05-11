const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadDoHeal(relPath) {
  const src = fs.readFileSync(relPath, 'utf8')
    .replace(/^import .+;\n/gm, '')
    .replace(/export /g, '');
  return Function(`${src}; return DoHeal;`)();
}

function createKojonnHealContext({ heal = 30, potency = 1 } = {}) {
  const calls = [];
  const globals = {
    PartyHP: 10,
    PartyMaxHP: 100,
    TurnSerial: 12,
    PartyHPBarPosWorld: { x: 100, y: 20, w: 80, h: 12, ox: 0, oy: 0 },
  };
  const ctx = {
    state: { globals },
    globals,
    callFunction(name, ...args) {
      calls.push({ name, args });
      if (name === 'CalculateHeal') return heal;
      if (name === 'GetActorByUID') return { uid: args[0], name: 'Kojonn' };
      if (name === 'ApplyPartyHeal') {
        globals.PartyHP = Math.min(globals.PartyMaxHP, globals.PartyHP + Number(args[0] || 0));
        return undefined;
      }
      return undefined;
    },
  };
  return { ctx, calls, potency };
}

test('Kojonn heal queues the recovered 3-turn regen payload in the web runner module', () => {
  const DoHeal = loadDoHeal('web-runner/modules/skillSheet.js');
  const { ctx, calls } = createKojonnHealContext({ heal: 30 });

  DoHeal(ctx, 4);

  assert.equal(ctx.globals.PartyHP, 20);
  assert.equal(ctx.globals.PartyRegens.length, 1);
  assert.deepEqual(ctx.globals.PartyRegens[0], {
    remainingFires: 2,
    totalHealRemaining: 20,
    cadence: 'turn',
    firesEveryTurns: 1,
    nextFireTurnSerial: 13,
    appliedOnTurnSerial: 12,
    sourceUID: 4,
    effectName: 'KojonnRegen',
    nextFireTick: Number.MAX_SAFE_INTEGER,
  });
  assert.ok(calls.some(call => call.name === 'SpawnDamageText' && call.args[3] === 'heal' && call.args[4] === 'bar'));
  assert.ok(calls.some(call => call.name === 'LogCombat' && call.args[0] === 'Kojonn applies 3-turn Regen!'));
});

test('Kojonn super-heal potency still feeds the 3-turn regen total', () => {
  const DoHeal = loadDoHeal('web-runner/modules/skillSheet.js');
  const { ctx } = createKojonnHealContext({ heal: 30 });

  DoHeal(ctx, 4, 2);

  assert.equal(ctx.globals.PartyHP, 30);
  assert.equal(ctx.globals.PartyRegens[0].remainingFires, 2);
  assert.equal(ctx.globals.PartyRegens[0].totalHealRemaining, 40);
});

test('Construct mirror carries the same recovered Kojonn regen payload shape', () => {
  const src = fs.readFileSync('Scripts/skillSheet.js', 'utf8');

  assert.match(src, /const totalTicks = 3;/);
  assert.match(src, /effectName: 'KojonnRegen'/);
  assert.match(src, /cadence: 'turn'/);
  assert.match(src, /nextFireTick: Number\.MAX_SAFE_INTEGER/);
  assert.doesNotMatch(src, /const totalTicks = 8;/);
  assert.doesNotMatch(src, /applies Regen over time/);
});

test('app processes turn-cadence party regens outside the timer tick lane', () => {
  const src = fs.readFileSync('web-runner/app.js', 'utf8');

  assert.match(src, /function processTurnCadencePartyRegens\(\) \{/);
  assert.match(src, /String\(regen\.cadence \|\| 'tick'\) !== 'turn'/);
  assert.match(src, /currentTurnSerial <= Number\(regen\.appliedOnTurnSerial \|\| 0\)/);
  assert.match(src, /regen\.nextFireTurnSerial = gateTurn \+ Math\.max\(1, Math\.floor\(Number\(regen\.firesEveryTurns \|\| 1\) \|\| 1\)\);/);
  assert.match(src, /syncSuperGemShapes\(\{ gameState, state, boardGeometry, reason: 'draw-frame' \}\);\n    processTurnCadencePartyRegens\(\);/);
});
