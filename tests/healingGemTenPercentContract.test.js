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
      if (name === 'GetCurrentTurn') return 4;
      if (name === 'GetActorByUID') return { uid: args[0], kind: 'hero', name: 'Falie', hp: globals.PartyHP, maxHP: globals.PartyMaxHP };
      if (name === 'ApplyActiveHeroHeal') {
        const before = globals.PartyHP;
        globals.PartyHP = Math.min(globals.PartyMaxHP, before + Number(args[0] || 0));
        return globals.PartyHP - before;
      }
      return undefined;
    },
  };
  return { ctx, calls };
}

test('healing gem matches restore 7 percent of the active hero maximum', () => {
  const DoHeal = loadDoHeal('web-runner/modules/skillSheet.js');
  const { ctx, calls } = createHealContext({ partyHP: 40, partyMaxHP: 100 });

  DoHeal(ctx, 4);

  assert.equal(ctx.globals.PartyHP, 47);
  assert.ok(calls.some(call => call.name === 'ApplyActiveHeroHeal' && call.args[0] === 7));
  assert.ok(calls.every(call => call.name !== 'CalculateHeal'));
});

test('healing gems respect the current HP cap', () => {
  const DoHeal = loadDoHeal('web-runner/modules/skillSheet.js');
  const { ctx } = createHealContext({ partyHP: 95, partyMaxHP: 100 });

  DoHeal(ctx, 4, 1, 3);

  assert.equal(ctx.globals.PartyHP, 100);
});

test('healing gem resolution does not multiply by consumed gem count', () => {
  const runtimeSrc = fs.readFileSync('web-runner/modules/functionBank.js', 'utf8');
  const scriptsSrc = fs.readFileSync('Scripts/functionBank.js', 'utf8');

  assert.match(runtimeSrc, /ctx\.callFunction\('DoHeal', actorUID\);/);
  assert.match(scriptsSrc, /ctx\.callFunction\('DoHeal', actorUID\);/);
  assert.doesNotMatch(runtimeSrc, /DoHeal', actorUID, 1, consumedCount/);
  assert.doesNotMatch(scriptsSrc, /DoHeal', actorUID, 1, consumedCount/);
});

test('healing changes only the active living hero in every loaded group and rejects other actors', () => {
  for (const file of ['web-runner/modules/skillSheet.js', 'Scripts/skillSheet.js']) {
    const src = fs.readFileSync(file, 'utf8').replace(/^import .+;\n/gm, '').replace(/export /g, '');
    const skills = Function(`${src}; return { ApplyActiveHeroHeal, DoHeal };`)();
    for (let count = 1; count <= 6; count++) {
      const heroes = Array.from({ length: count }, (_, index) => ({
        uid: index + 1, kind: 'hero', name: `Hero ${index}`, hp: 5, maxHP: 100, x: index * 10, y: 20,
      }));
      const enemy = { uid: 99, kind: 'enemy', hp: 5, maxHP: 100 };
      let currentUID = count;
      const globals = { PartyHP: 9999, PartyMaxHP: 9999 };
      const calls = [];
      const ctx = { state: { globals, entities: [...heroes, enemy] }, callFunction(name, ...args) {
        calls.push({ name, args });
        if (name === 'GetCurrentTurn') return currentUID;
        if (name === 'GetActorByUID') return ctx.state.entities.find(actor => actor.uid === args[0]);
        if (skills[name]) return skills[name](ctx, ...args);
      } };
      skills.DoHeal(ctx, currentUID);
      assert.deepEqual(heroes.map(hero => hero.hp), heroes.map((_, i) => i === count - 1 ? 12 : 5), file);
      assert.equal(globals.ActionOwnerUID, currentUID);
      assert.equal(globals.AdvanceAfterAction, 1);
      assert.deepEqual(calls.filter(call => call.name === 'SpawnDamageText').map(call => call.args),
        [[7, heroes.at(-1).x, 20, 'heal', 'hero']]);
      assert.equal(skills.ApplyActiveHeroHeal(ctx, 500), 88);
      assert.equal(skills.ApplyActiveHeroHeal(ctx, 5), 0);
      for (const amount of [-10, NaN, Infinity]) assert.equal(skills.ApplyActiveHeroHeal(ctx, amount), 0);
      const before = heroes.map(hero => hero.hp);
      assert.equal(skills.DoHeal(ctx, currentUID === 1 ? 99 : 1), false);
      assert.deepEqual(heroes.map(hero => hero.hp), before);
      heroes.at(-1).hp = 0;
      assert.equal(skills.ApplyActiveHeroHeal(ctx, 30), 0);
      currentUID = 99;
      assert.equal(skills.ApplyActiveHeroHeal(ctx, 30), 0);
      assert.equal(enemy.hp, 5);
      assert.equal(heroes.at(-1).hp, 0);
    }
  }
});
