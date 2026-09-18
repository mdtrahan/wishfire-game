import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { emitResolvedHealEvent, rulesContext } from '../web-runner/modules/heroCommands.mjs';

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
    assert.deepEqual(globals.DamageTexts, [{ amount: 1, x: 44, y: 55, kind: 'heal', targetKind: 'hero', targetUID: 7, targetSlotIndex: 0, ownerUID: 7, healPresentation: 'minor', notBefore: 1.5 }]);
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
    assert.match(source, /emitResolvedHealEvent\(ctx, actor, actor, beforeHP, \{ presentation \}\)/, file);
  }
});

test('explicit heal presentation can opt into the major animation tier', () => {
  const { ctx, globals } = makeContext();
  assert.equal(applyRuntimeHeal(ctx, 1, 'major'), 1);
  assert.equal(globals.DamageTexts[0].healPresentation, 'major');
});

test('active heal keeps its actor-owned presentation lock through the bloom', () => {
  const { ctx, hero, globals } = makeContext();
  globals.time = 2;
  globals.ActionInProgress = 1;
  globals.ActionActorUID = hero.uid;
  globals.ActionLockUntil = 2.2;

  hero.hp = 10;
  assert.equal(emitResolvedHealEvent(ctx, hero, hero, 5, { presentation: 'major' }), 5);
  assert.equal(globals.ActionLockUntil, 4.83);
  assert.equal(globals.DeferAdvance, 1);
  assert.equal(globals.AdvanceAfterAction, 1);
  assert.equal(globals.ActionOwnerUID, hero.uid);
});

test('cross-actor heal keeps the current action owner and blocks handoff through the motes', () => {
  const { ctx, hero, globals } = makeContext();
  globals.time = 2;
  globals.ActionInProgress = 1;
  globals.ActionActorUID = 99;
  globals.ActionOwnerUID = 99;
  hero.hp = 10;

  assert.equal(emitResolvedHealEvent(ctx, hero, hero, 5, { presentation: 'minor' }), 5);
  assert.equal(globals.ActionLockUntil, 4.83);
  assert.equal(globals.ActionOwnerUID, 99);
  assert.equal(globals.DeferAdvance, 1);
  assert.equal(globals.AdvanceAfterAction, 1);
});

test('turn heal holds an already-claimed hero at home and delays its queued hit once', () => {
  const { ctx, hero, globals } = makeContext();
  globals.time = 2;
  globals.ActionInProgress = 1;
  globals.ActionActorUID = hero.uid;
  globals.ActionOwnerUID = hero.uid;
  globals.HeroAction = { uid: hero.uid, state: 'ADVANCE', active: true };
  globals.PendingHeroHits = [{ heroUID: hero.uid, at: 2.97 }, { heroUID: 99, at: 2.97 }];
  hero.hp = 10;

  assert.equal(emitResolvedHealEvent(ctx, hero, hero, 5, { presentation: 'minor' }), 5);
  assert.equal(globals.HeroAction.presentationStartAfter, 4.83);
  assert.ok(Math.abs(globals.PendingHeroHits[0].at - 5.8) < 1e-9);
  assert.equal(globals.PendingHeroHits[1].at, 2.97);

  hero.hp = 15;
  assert.equal(emitResolvedHealEvent(ctx, hero, hero, 10, { presentation: 'minor' }), 5);
  assert.ok(
    Math.abs(globals.PendingHeroHits[0].at - 5.8) < 1e-9,
    'same-frame party heals must not stack action delay',
  );
});

test('resolved Chimerilass self-heal text uses the stored home anchor', () => {
  const hero = { uid: 17, kind: 'hero', name: 'Chimerilass', hp: 10, maxHP: 30, x: 420, y: 310, heroDisplaySlot: 2 };
  const globals = {
    time: 1,
    DamageTexts: [],
    HeroRestFeetPosByUID: { 17: { x: 88, y: 144 } },
    ActionInProgress: 1,
    ActionActorUID: 17,
  };
  const ctx = {
    state: { globals, entities: [hero] },
    callFunction(name, ...args) {
      if (name === 'SpawnDamageText') globals.DamageTexts.push({ amount: args[0], x: args[1], y: args[2], kind: args[3], targetKind: args[4] });
    },
  };

  hero.hp = 20;
  assert.equal(emitResolvedHealEvent(ctx, hero, hero, 10, { presentation: 'major' }), 10);
  assert.deepEqual([globals.DamageTexts[0].x, globals.DamageTexts[0].y], [88, 144]);
  assert.equal(globals.DamageTexts[0].ownerUID, 17);
});

test('resolved heal effects keep HoT minor and cast heals major', () => {
  for (const [meta, expected] of [
    [{ effectType: 'heal', statusEffect: 'hot' }, 'minor'],
    [{ effectType: 'heal' }, 'major'],
  ]) {
    const { ctx, hero, globals } = makeContext();
    hero.hp = 10;
    rulesContext(ctx).onHeal(hero, hero, 1, meta);
    assert.equal(globals.DamageTexts[0].healPresentation, expected);
  }
});
