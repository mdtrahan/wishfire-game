import test from 'node:test';
import assert from 'node:assert/strict';
import { heroCooldownSlots } from '../web-runner/systems/heroCooldownStrip.mjs';

const hero = (name = 'Falie', uid = 1, extra = {}) => ({ kind: 'hero', name, uid, hp: 75, currentLevel: 1, ...extra });
const globals = (time, clocks) => ({ time, RealtimeHeroBasicClocks: { 1: { skillReadyAt: clocks } } });

test('only deployed canonical heroes occupy slots, in roster order, with no duplicates or invented heroes', () => {
  const slots = heroCooldownSlots([hero('Kojonn', 4), hero(), hero('Huun', 2), hero('Runa', 3), hero('Fara', 5), hero('Unknown', 6), { kind: 'enemy', name: 'Falie' }]);
  assert.equal(slots.length, 8);
  assert.deepEqual(slots.slice(0, 4).map(slot => slot.name), ['Fara', 'Hondo', 'Runa', 'Kaja']);
  assert.ok(slots.slice(4).every(slot => slot === null));
  assert.deepEqual(heroCooldownSlots([]), Array(8).fill(null));
  assert.equal(heroCooldownSlots([hero('Runa', 3)])[0].path, 'images/Runa.png');
});

test('radial fraction follows the Special clock and ignores the basic attack', () => {
  const g = globals(10, { crimson_ward: 14, basic_attack: 10 });
  const slot = heroCooldownSlots([hero()], g)[0];
  assert.equal(slot.remaining, 4);
  assert.equal(slot.fraction, 4 / 50);
  assert.equal(slot.status, 'cooldown');
  assert.equal(slot.heroKey, 'Falie');
});

test('missing and expired clocks show cooldown-ready without promising eligible casting', () => {
  assert.equal(heroCooldownSlots([hero()])[0].status, 'ready');
  assert.equal(heroCooldownSlots([hero()], globals(14, { crimson_ward: 14 }))[0].fraction, 0);
});

test('KO and locked actors retain identity and never advertise readiness', () => {
  assert.equal(heroCooldownSlots([hero('Falie', 1, { hp: 0 })])[0].status, 'ko');
  assert.equal(heroCooldownSlots([hero('Falie', 1, { currentLevel: -1 })])[0].status, 'locked');
});

test('projection freezes at unchanged combat time, advances with it and never mutates combat state', () => {
  const actors = [hero()], g = globals(10, { crimson_ward: 14 });
  const before = JSON.stringify({ actors, g });
  const first = heroCooldownSlots(actors, g);
  assert.deepEqual(heroCooldownSlots(actors, g), first);
  assert.equal(JSON.stringify({ actors, g }), before);
  g.time = 12;
  assert.equal(heroCooldownSlots(actors, g)[0].remaining, 2);
  delete g.RealtimeHeroBasicClocks;
  assert.equal(heroCooldownSlots(actors, g)[0].status, 'ready');
});
