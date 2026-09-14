import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { emitResolvedHealEvent } from '../web-runner/modules/heroCommands.mjs';

function loadApplyActiveHeroHeal(path) {
  const source = fs.readFileSync(path, 'utf8')
    .replace(/^import .+;\n/gm, '')
    .replace(/export /g, '');
  return Function('emitResolvedHealEvent', `${source}; return ApplyActiveHeroHeal;`)(emitResolvedHealEvent);
}

const applyRuntimeHeal = loadApplyActiveHeroHeal('web-runner/modules/skillSheet.js');
const applyMirrorHeal = loadApplyActiveHeroHeal('Scripts/skillSheet.js');

function makeContext() {
  const hero = { uid: 7, kind: 'hero', hp: 9, maxHP: 10, x: 21, y: 34, heroDisplaySlot: 0 };
  const globals = { DamageTexts: [], HeroPortraitPosByIndex: [{ x: 44, y: 55 }] };
  const calls = [];
  const ctx = {
    state: { globals, entities: [hero] },
    callFunction(name, ...args) {
      calls.push({ name, args });
      if (name === 'GetCurrentTurn') return 7;
      if (name === 'GetActorByUID') return hero;
      if (name === 'SpawnDamageText') {
        globals.DamageTexts.push({ amount: args[0], x: args[1], y: args[2], kind: args[3], targetKind: args[4] });
      }
      return undefined;
    },
  };
  return { ctx, hero, globals, calls };
}

for (const [label, apply] of [['runtime', applyRuntimeHeal], ['Construct mirror', applyMirrorHeal]]) {
  test(`${label} active heal emits only its actual resolved delta through the shared presentation path`, () => {
    const { ctx, hero, globals, calls } = makeContext();
    assert.equal(apply(ctx, 8), 1);
    assert.deepEqual(globals.DamageTexts, [{ amount: 1, x: 44, y: 55, kind: 'heal', targetKind: 'hero', targetUID: 7, targetSlotIndex: 0 }]);
    assert.equal(apply(ctx, 8), 0, 'full health must not emit a heal event');
    assert.equal(globals.DamageTexts.length, 1);
    assert.equal(calls.filter(call => call.name === 'SpawnDamageText').length, 1);
    assert.equal(hero.hp, 10);
  });
}

test('both active-heal surfaces import the shared resolved-heal emitter', () => {
  for (const file of ['web-runner/modules/skillSheet.js', 'Scripts/skillSheet.js']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /import \{ emitResolvedHealEvent \}/, file);
    assert.match(source, /emitResolvedHealEvent\(ctx, actor, actor, beforeHP\)/, file);
  }
});
