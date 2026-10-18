import test from 'node:test';
import assert from 'node:assert/strict';
import { beginCombatDpsSession, recordCombatDpsDamage, combatDpsSnapshot } from '../web-runner/src/core/combatDps.mjs';
import { combatDpsPlacement, combatDpsReadout, formatDps } from '../web-runner/systems/renderCombatDps.mjs';
import { computeCombatPower } from '../web-runner/src/core/combatPower.mjs';
import { resetCombatSessionConditions } from '../web-runner/systems/combatSessionReset.mjs';

const fara = { uid: 1, kind: 'hero', name: 'Fara' };
const hondo = { uid: 2, kind: 'hero', name: 'Hondo' };
const enemy = { uid: 10, kind: 'enemy' };
const roster = [fara, hondo];
function fixture() { const globals = { time: 10, ContinuousCombatStageLoop: 1 }; beginCombatDpsSession(globals); return globals; }

test('DPS attributes heroes separately and retains zero-damage members in roster order', () => {
  const globals = fixture(); globals.time = 12;
  recordCombatDpsDamage(globals, fara, enemy, 30);
  const snapshot = combatDpsSnapshot(globals, roster);
  assert.equal(snapshot.party.total, 30);
  assert.equal(snapshot.party.hitRate, 0.5);
  assert.equal(snapshot.party.hits, 1);
  assert.deepEqual(snapshot.heroes.map(row => [row.uid, row.total]), [[1, 30], [2, 0]]);
  assert.equal(recordCombatDpsDamage(globals, enemy, fara, 100), false);
  for (const invalid of [0, -1, NaN, Infinity]) assert.equal(recordCombatDpsDamage(globals, fara, enemy, invalid), false);
  assert.equal(combatDpsSnapshot(globals, roster).party.total, 30);
});

test('hit rate divides session outgoing hits by active combat time and declines during idle time', () => {
  const globals = fixture(); globals.time = 11;
  recordCombatDpsDamage(globals, fara, enemy, 30);
  globals.time = 15;
  recordCombatDpsDamage(globals, hondo, enemy, 20);
  globals.time = 17;
  const snapshot = combatDpsSnapshot(globals, roster);
  assert.equal(snapshot.party.total, 50);
  assert.equal(snapshot.party.hitRate, 2 / 7);
  assert.equal(snapshot.party.hits, 2);
  assert.deepEqual(snapshot.heroes.map(hero => hero.hitRate), [1 / 7, 1 / 7]);
  globals.time = 21;
  assert.equal(combatDpsSnapshot(globals, roster).party.hitRate, 2 / 11);
  globals.time = 10;
  assert.equal(combatDpsSnapshot(globals, roster).party.hitRate, 0);
});

test('pause, hide/show, and ordinary recovery preserve measurements; fresh entry clears them', () => {
  const globals = fixture(); globals.time = 12;
  recordCombatDpsDamage(globals, fara, enemy, 30);
  const before = combatDpsSnapshot(globals, roster);
  globals.ShowCombatDpsOverlay = false;
  assert.deepEqual(combatDpsSnapshot(globals, roster), before);
  globals.ShowCombatDpsOverlay = true;
  resetCombatSessionConditions(globals, {});
  assert.deepEqual(combatDpsSnapshot(globals, roster), before);
  beginCombatDpsSession(globals);
  assert.equal(combatDpsSnapshot(globals, roster).party.total, 0);
  assert.equal(combatDpsSnapshot(globals, roster).party.hitRate, 0);
});

test('session counters remain exact without retaining per-hit samples', () => {
  const globals = fixture();
  for (let tick = 0; tick < 1000; tick++) { globals.time = 10 + tick; recordCombatDpsDamage(globals, fara, enemy, 1); }
  assert.equal(globals.CombatDps.totalDamage, 1000);
  assert.equal(globals.CombatDps.hitCount, 1000);
  assert.equal(globals.CombatDps.hits, undefined);
});

test('DPS stays inside the Canvas frame above the conveyor at reference and compact sizes', () => {
  for (const [width, height] of [[360, 640], [216, 384], [233, 452], [316, 452], [1280, 800]]) {
    const rect = { left: 17, top: 9, width, height };
    const scale = Math.min(width / 360, height / 640);
    const safeBottom = rect.top + height * 0.74;
    const placement = combatDpsPlacement(rect, safeBottom);
    assert.equal(placement.scale, scale);
    assert.ok(placement.left >= rect.left);
    assert.ok(placement.left + 270 * scale <= rect.left + width);
    assert.ok(placement.top >= rect.top);
    assert.ok(placement.top + 96 * scale <= safeBottom);
  }
  assert.equal(formatDps(Infinity), '0.0');
  assert.equal(formatDps(123456789), '1.2e+8');
});


test('current CP follows canonical equipped stats and refreshes independently of damage totals', () => {
  const globals = fixture();
  const saved = { name: 'Falie', currentLevel: 1, maxHP: 100, stats: { ATK: 10, MAG: 0, DEF: 5, RES: 5, SPD: 10 } };
  globals.HeroProgress = { heroes: { Falie: saved } };
  const actor = { ...fara, name: 'Falie', heroInstanceKey: 'Falie', maxHP: 1, hp: 0, stats: { ATK: 1 } };
  const second = { ...hondo, maxHP: 40, stats: { ATK: 8, SPD: 12 } };
  const state = { globals, entities: [actor, second, enemy] };
  globals.time = 12;
  recordCombatDpsDamage(globals, actor, enemy, 30);
  const first = combatDpsReadout(state);
  assert.equal(first.heroes[0].cp, computeCombatPower(saved));
  assert.equal(first.party.cp, first.heroes.reduce((sum, hero) => sum + hero.cp, 0));
  saved.stats.ATK = 50;
  const updated = combatDpsReadout(state);
  assert.ok(updated.heroes[0].cp > first.heroes[0].cp);
  assert.equal(updated.party.total, first.party.total);
});


test('yellow leader follows the far-right damage total, retains ties and ignores the hit-rate column', () => {
  const globals = fixture(), state = { globals, entities: roster };
  const leaders = () => combatDpsReadout(state).heroes.filter(hero => hero.leading).map(hero => hero.uid);
  assert.deepEqual(leaders(), []);
  globals.time = 12;
  recordCombatDpsDamage(globals, fara, enemy, 30);
  recordCombatDpsDamage(globals, hondo, enemy, 40);
  assert.deepEqual(leaders(), [hondo.uid]);
  globals.time = 18;
  recordCombatDpsDamage(globals, fara, enemy, 10);
  assert.deepEqual(leaders(), [fara.uid]);
  recordCombatDpsDamage(globals, hondo, enemy, 10);
  assert.deepEqual(leaders(), [hondo.uid]);
  globals.time = 24;
  assert.deepEqual(leaders(), [hondo.uid]);
  assert.equal(combatDpsReadout(state).heroes[1].hitRate, 2 / 14);
});


test('Hits count successful per-target damage events, exclude zero damage and retain session totals', () => {
  const globals = fixture();
  globals.time = 12;
  recordCombatDpsDamage(globals, fara, enemy, 5);
  recordCombatDpsDamage(globals, fara, { ...enemy, uid: 11 }, 7);
  recordCombatDpsDamage(globals, hondo, enemy, 10);
  recordCombatDpsDamage(globals, hondo, enemy, 0);
  recordCombatDpsDamage(globals, enemy, fara, 2);
  const snapshot = combatDpsSnapshot(globals, roster);
  assert.equal(snapshot.party.hits, 3);
  assert.deepEqual(snapshot.heroes.map(hero => hero.hits), [2, 1]);
  globals.time = 30;
  assert.equal(combatDpsSnapshot(globals, roster).party.hits, 3);
  beginCombatDpsSession(globals);
  assert.equal(combatDpsSnapshot(globals, roster).party.hits, 0);
});
