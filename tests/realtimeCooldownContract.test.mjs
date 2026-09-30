import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectRealtimeReadyActors, heroBasicAttackRate, realtimeCooldownSeconds, selectRealtimeReadyActor } from '../web-runner/src/core/realtimeCooldown.mjs';

test('real-time cooldowns advance from wall time and only reset the actor that completed', () => {
  const actors = [
    { uid: 1, hp: 10, speed: 8 },
    { uid: 2, hp: 10, speed: 16 },
  ];
  const opening = selectRealtimeReadyActor({ actors, now: 0 });
  assert.equal(opening.selected, null);
  const firstReadyAt = Math.min(...Object.values(opening.readyAt));
  const first = selectRealtimeReadyActor({ actors, readyAt: opening.readyAt, now: firstReadyAt });
  assert.ok(first.selected);
  const firstUID = first.selected.uid;
  const idle = selectRealtimeReadyActor({ actors, readyAt: first.readyAt, now: firstReadyAt + 0.1, completedUID: firstUID });
  assert.equal(idle.selected, null);
  assert.equal(idle.readyAt[String(firstUID)], firstReadyAt + 0.1 + realtimeCooldownSeconds(first.selected));
  const otherUID = actors.find(actor => actor.uid !== firstUID).uid;
  assert.equal(idle.readyAt[String(otherUID)], opening.readyAt[String(otherUID)]);
  const secondReadyAt = Math.min(...Object.values(idle.readyAt));
  const secondReady = selectRealtimeReadyActor({ actors, readyAt: idle.readyAt, now: secondReadyAt });
  assert.ok(secondReady.selected);
});

test('hero SPD alone produces distinct basic rates with independent staggered clocks', () => {
  const actors = ['Falie', 'Kojonn', 'Runa', 'Huun'].map((name, index) => ({ uid: index + 1, type: 0, hp: 10, name, speed: [8, 10, 11, 12][index] }));
  const rates = actors.map(heroBasicAttackRate);
  assert.ok(rates.every((rate, index) => index === 0 || rate > rates[index - 1]));
  assert.ok(Math.abs(rates[0] - 30 / (0.99 * 32) * 1.4) < 1e-12);
  assert.ok(Math.abs(rates[3] - 30 / (0.99 * 22) * 1.4) < 1e-12);
  assert.equal(heroBasicAttackRate({ ...actors[0], palFlatSpeedBonus: 0.1, palSpeedModifier: 5 }), rates[0]);
  const waiting = selectRealtimeReadyActor({ actors, now: 5, selectionEnabled: false });
  assert.equal(waiting.selected, null);
  const openingTimes = Object.values(waiting.readyAt);
  assert.ok(openingTimes.every((time, index) => time >= 5 + realtimeCooldownSeconds(actors[index]) && time < 6.5 + realtimeCooldownSeconds(actors[index])));
  assert.equal(new Set(openingTimes).size, 4);
  const released = collectRealtimeReadyActors({ actors, readyAt: waiting.readyAt, now: 7.5 });
  assert.equal(released.ready.length, 1);
  assert.equal(released.ready[0].uid, actors[openingTimes.indexOf(Math.min(...openingTimes))].uid);
});

test('one hero fires per frame while all four retain their derived rates', () => {
  const actors = ['Falie', 'Kojonn', 'Runa', 'Huun'].map((name, index) => ({ uid: index + 1, type: 0, hp: 10, name, speed: [8, 10, 11, 12][index] }));
  let readyAt = {};
  const shots = [0, 0, 0, 0];
  for (let frame = 0; frame < 120 * 60; frame += 1) {
    const now = frame / 60;
    const result = collectRealtimeReadyActors({ actors, readyAt, now });
    readyAt = result.readyAt;
    assert.ok(result.ready.length <= 1);
    for (const actor of result.ready) {
      shots[actor.uid - 1] += 1;
      const interval = realtimeCooldownSeconds(actor);
      const due = readyAt[String(actor.uid)];
      readyAt[String(actor.uid)] = due + (Math.floor(Math.max(0, now - due) / interval) + 1) * interval;
    }
  }
  shots.forEach((count, index) => assert.ok(Math.abs(count - 120 * heroBasicAttackRate(actors[index])) < 5));
});

test('an engaged enemy attacks on arrival and waits for its own cooldown afterward', () => {
  const enemy = { uid: 9, type: 1, hp: 10, speed: 8 };
  const arrival = selectRealtimeReadyActor({ actors: [enemy], now: 4 });
  assert.equal(arrival.selected.uid, 9);
  const afterAttack = selectRealtimeReadyActor({ actors: [enemy], readyAt: arrival.readyAt, now: 4, completedUID: 9 });
  assert.equal(afterAttack.selected, null);
  assert.equal(afterAttack.readyAt['9'], 4 + realtimeCooldownSeconds(enemy));
});

test('melee, ranged, and later entrants keep attacking on their own timers', () => {
  const melee = { uid: 9, type: 1, hp: 100, attackDelivery: 'melee' };
  const ranged = { uid: 10, type: 1, hp: 100, attackDelivery: 'ranged' };
  const later = { uid: 11, type: 1, hp: 100, attackDelivery: 'melee' };
  const hits = { 9: 0, 10: 0, 11: 0 };
  let readyAt = {};
  let completedUID = 0;
  for (let tick = 0; tick <= 200; tick += 1) {
    const actors = tick >= 50 ? [melee, ranged, later] : [melee, ranged];
    const result = selectRealtimeReadyActor({ actors, readyAt, now: tick / 10, completedUID });
    readyAt = result.readyAt;
    completedUID = result.selected?.uid || 0;
    if (completedUID) hits[completedUID] += 1;
  }
  assert.ok(hits[9] >= 10);
  assert.ok(hits[10] >= 3);
  assert.ok(hits[11] >= 8);
});

test('enemy attack bands follow attack reach, including bosses, independent of travel and SPD', () => {
  const melee = { uid: 9, type: 1, hp: 10, speed: 3, attackDelivery: 'melee', approachSeconds: 8 };
  const ranged = { uid: 10, type: 1, hp: 10, speed: 40, attackDelivery: 'ranged', approachSeconds: 0 };
  assert.equal(realtimeCooldownSeconds(melee), 1.6);
  assert.equal(realtimeCooldownSeconds(ranged), 5);
  assert.equal(realtimeCooldownSeconds({ ...melee, enemyRole: 'boss' }), 1.6);
  assert.equal(realtimeCooldownSeconds({ ...ranged, enemyRole: 'boss' }), 5);
  assert.equal(realtimeCooldownSeconds({ ...ranged, enemyRole: 'boss', attackPattern: { intervalSeconds: 2.4 } }), 2.4);
  assert.equal(realtimeCooldownSeconds({ ...ranged, enemyRole: 'boss', attackPattern: { intervalSeconds: -2 } }), 5);
  const arrival = selectRealtimeReadyActor({ actors: [melee], now: 8 });
  const completed = selectRealtimeReadyActor({ actors: [melee], readyAt: arrival.readyAt, now: 8.2, completedUID: 9 });
  assert.ok(Math.abs(completed.readyAt['9'] - 9.8) < 1e-12);
});

test('both combat mirrors classify every enemy by its actual attack delivery before scheduling', () => {
  for (const path of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const roster = source.match(/function getDynamicInitiativeRoster\(ctx\) \{[^\n]+/)[0];
    assert.match(roster, /attackDelivery: enemy\.streamDelivery \|\| \(Number\(enemy\.stats\?\.MAG/);
    assert.match(roster, /enemyRole: String\(enemy\.enemyRole \|\| enemy\.role \|\| ''\)\.toLowerCase\(\)/);
    assert.match(roster, /attackPattern: enemy\.attackPattern/);
  }
});

test('hero opening timers start when a target enters range, not while the lane is empty', () => {
  const actors = [1, 2, 3, 4].map(uid => ({ uid, type: 0, hp: 10, speed: 10 }));
  const idle = collectRealtimeReadyActors({ actors, now: 1, selectionEnabled: false });
  assert.deepEqual(idle, { ready: [], readyAt: {} });
  const armed = collectRealtimeReadyActors({ actors, readyAt: idle.readyAt, now: 8 });
  assert.deepEqual(armed.ready, []);
  const times = Object.values(armed.readyAt);
  assert.ok(times.every((time, index) => time > 8 + realtimeCooldownSeconds(actors[index]) && time < 9.5 + realtimeCooldownSeconds(actors[index])));
  assert.equal(new Set(times).size, 4);
});
