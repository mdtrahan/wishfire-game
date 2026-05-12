const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadDoHeal(relPath) {
  const src = fs.readFileSync(relPath, 'utf8')
    .replace(/^import .+;\n/gm, '')
    .replace(/export /g, '');
  return Function(`${src}; return DoHeal;`)();
}

function createHealContext({ partyHP = 40, partyMaxHP = 100 } = {}) {
  const calls = [];
  const globals = {
    PartyHP: partyHP,
    PartyMaxHP: partyMaxHP,
    PartyHPBarPosWorld: { x: 100, y: 20, w: 80, h: 12, ox: 0, oy: 0 },
  };
  const ctx = {
    state: { globals },
    globals,
    callFunction(name, ...args) {
      calls.push({ name, args });
      if (name === 'CalculateHeal') return 999;
      if (name === 'GetActorByUID') return { uid: args[0], name: 'Falie' };
      if (name === 'ApplyPartyHeal') {
        globals.PartyHP = Math.min(globals.PartyMaxHP, globals.PartyHP + Number(args[0] || 0));
      }
      return undefined;
    },
  };
  return { ctx, calls };
}

test('healing gems restore 10 percent of party max HP per consumed healing gem', () => {
  const DoHeal = loadDoHeal('web-runner/modules/skillSheet.js');
  const { ctx, calls } = createHealContext({ partyHP: 40, partyMaxHP: 100 });

  DoHeal(ctx, 4, 1, 3);

  assert.equal(ctx.globals.PartyHP, 70);
  assert.ok(calls.some(call => call.name === 'ApplyPartyHeal' && call.args[0] === 30));
  assert.ok(calls.every(call => call.name !== 'CalculateHeal'));
});

test('healing gems respect the current HP cap', () => {
  const DoHeal = loadDoHeal('web-runner/modules/skillSheet.js');
  const { ctx } = createHealContext({ partyHP: 95, partyMaxHP: 100 });

  DoHeal(ctx, 4, 1, 3);

  assert.equal(ctx.globals.PartyHP, 100);
});

test('healing gem count is passed from both ResolveGemAction mirrors', () => {
  const runtimeSrc = fs.readFileSync('web-runner/modules/functionBank.js', 'utf8');
  const scriptsSrc = fs.readFileSync('Scripts/functionBank.js', 'utf8');

  assert.match(runtimeSrc, /ctx\.callFunction\('DoHeal', actorUID, 1, consumedCount\);/);
  assert.match(scriptsSrc, /ctx\.callFunction\('DoHeal', actorUID, 1, consumedCount\);/);
});
