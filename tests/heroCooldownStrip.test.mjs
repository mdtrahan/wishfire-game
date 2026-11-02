import test from 'node:test';
import assert from 'node:assert/strict';
import { heroCooldownSlots } from '../web-runner/systems/heroCooldownStrip.mjs';
const hero = (name = 'Falie', uid = 1) => ({ kind: 'hero', name, heroInstanceKey: name, uid, hp: 75 });
const globals = (meter, extra = {}) => ({ RustCombatPresentation: { state: { snapshot: { actors: [{ team: 'hero', host_id: 'Falie', meter, ...extra }] } } } });
test('strip preserves deployed Rust party order and leaves unused portrait slots empty', () => {
 const slots = heroCooldownSlots([hero('Kojonn', 4), hero(), hero('Huun', 2), hero('Runa', 3), hero('Unknown', 5)]);
 assert.deepEqual(slots.slice(0, 4).map(slot => slot.name), ['Kaja', 'Fara', 'Hondo', 'Runa']);
 assert.equal(slots.length, 8); assert.ok(slots.slice(4).every(slot => slot === null));
 assert.deepEqual(heroCooldownSlots([]), Array(8).fill(null));
});
test('radial fill reads the authoritative Rust meter without a JS cooldown', () => {
 assert.equal(heroCooldownSlots([hero()], globals(.25))[0].fraction, .75);
 assert.equal(heroCooldownSlots([hero()], globals(1))[0].status, 'ready');
 assert.equal(heroCooldownSlots([hero()], globals(0))[0].status, 'cooldown');
 assert.equal(heroCooldownSlots([hero()], globals(1, { downed: true }))[0].status, 'ko');
});
test('projection freezes with the snapshot and never mutates combat state', () => {
 const actors = [hero()], g = globals(.4), before = structuredClone({ actors, g });
 assert.deepEqual(heroCooldownSlots(actors,g),heroCooldownSlots(actors,g));
 assert.deepEqual({actors,g},before);
 g.RustCombatPresentation.state.snapshot.actors[0].meter=.8;
 assert.ok(Math.abs(heroCooldownSlots(actors,g)[0].fraction-.2)<1e-9);
});
