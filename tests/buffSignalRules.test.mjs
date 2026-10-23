import test from 'node:test';
import assert from 'node:assert/strict';
import { BUFF_SIGNAL_CHANNELS, BUFF_SIGNAL_FRAMES, projectBuffSignals } from '../src/core/buffSignalRules.mjs';
import { heroBuffSignalInput } from '../web-runner/systems/heroCooldownStrip.mjs';

const buff = (key, ...channels) => ({ key, modifiers: channels.map(channel => ({ channel, direction: 'up' })) });
const hero = (uid, buffs = [], alive = true) => ({ uid, alive, buffs });

test('every signalled channel maps to a sheet frame and one hero group', () => {
  for (const [icon, group] of Object.values(BUFF_SIGNAL_CHANNELS)) {
    assert.ok(BUFF_SIGNAL_FRAMES[icon], icon);
    assert.ok(BUFF_SIGNAL_FRAMES[`hero-${group}`], group);
  }
  assert.equal(Object.keys(BUFF_SIGNAL_FRAMES).length, 17);
});

test('the same effect from the same source on every living hero shows once in the party row', () => {
  const kaja = buff('4:elevate', 'SPD', 'ATK');
  const out = projectBuffSignals([hero(1, [kaja]), hero(2, [kaja]), hero(3, [kaja, buff('1:brace', 'damageReduction')])]);
  assert.deepEqual(out.party, ['party-spd', 'party-atk']);
  assert.deepEqual(out.heroes, { 1: [], 2: [], 3: ['defense'] });
});

test('same stat from different sources is not party-wide; one group badge per hero regardless of count', () => {
  const out = projectBuffSignals([hero(1, [buff('4:a', 'ATK'), buff('2:b', 'MAG', 'critRate')]), hero(2, [buff('5:a', 'ATK')])]);
  assert.deepEqual(out.party, []);
  assert.deepEqual(out.heroes[1], ['offense']);
  assert.deepEqual(out.heroes[2], ['offense']);
});

test('debuffs and unknown channels never signal', () => {
  const mixed = { key: '9:grow', modifiers: [{ channel: 'HP', direction: 'down' }, { channel: 'mystery', direction: 'up' }] };
  const out = projectBuffSignals([hero(1, [mixed]), hero(2, [mixed])]);
  assert.deepEqual(out, { party: [], heroes: { 1: [], 2: [] } });
});

test('KO heroes are excluded and do not block party-wide buffs on the living', () => {
  const ward = buff('1:ward', 'ward');
  const out = projectBuffSignals([hero(1, [ward]), hero(2, [ward]), hero(3, [], false)]);
  assert.deepEqual(out.party, ['party-ward']);
  assert.equal(out.heroes[3], undefined);
});

test('a lone survivor keeps its buffs on its own clock', () => {
  const out = projectBuffSignals([hero(1, [buff('4:elevate', 'SPD')]), hero(2, [buff('4:elevate', 'SPD')], false)]);
  assert.deepEqual(out, { party: [], heroes: { 1: ['tempo'] } });
});

test('hero badges fill left to right by arrival, close up when any one ends, and never exceed three', () => {
  let out = projectBuffSignals([hero(1, [buff('a', 'DEF')])]);
  assert.deepEqual(out.heroes[1], ['defense']);
  out = projectBuffSignals([hero(1, [buff('a', 'DEF'), buff('b', 'SPD')])], out);
  assert.deepEqual(out.heroes[1], ['defense', 'tempo']);
  out = projectBuffSignals([hero(1, [buff('a', 'DEF'), buff('b', 'SPD'), buff('c', 'ATK', 'MAG', 'range', 'heal')])], out);
  assert.deepEqual(out.heroes[1], ['defense', 'tempo', 'offense']);
  out = projectBuffSignals([hero(1, [buff('b', 'SPD'), buff('c', 'ATK')])], out);
  assert.deepEqual(out.heroes[1], ['tempo', 'offense']);
  out = projectBuffSignals([hero(1, [buff('c', 'ATK'), buff('d', 'reflect')])], out);
  assert.deepEqual(out.heroes[1], ['offense', 'defense']);
});

test('party icons also keep arrival order', () => {
  const party = channel => [hero(1, [buff(`s:${channel}`, channel)]), hero(2, [buff(`s:${channel}`, channel)])];
  let out = projectBuffSignals(party('RES'));
  out = projectBuffSignals([hero(1, [buff('s:RES', 'RES'), buff('s:SPD', 'SPD')]), hero(2, [buff('s:RES', 'RES'), buff('s:SPD', 'SPD')])], out);
  assert.deepEqual(out.party, ['party-res', 'party-spd']);
});

test('live combat effects translate into channels without mutating combat state', () => {
  const entities = [
    { kind: 'hero', name: 'Falie', uid: 1, hp: 50, currentLevel: 1 },
    { kind: 'hero', name: 'Kojonn', uid: 4, hp: 50, currentLevel: 1, statuses: [{ statusEffect: 'atkUp', duration: 2 }] },
    { kind: 'hero', name: 'Huun', uid: 2, hp: 0, currentLevel: 1 },
  ];
  const globals = {
    time: 10, PartyBuff_DEF: 3, PartyTempHPShield: 40, PartyTempHPShieldTargetUIDs: [1, 4, 2], PartyTempHPShieldSourceUID: 1,
    RealtimeSkillEffects: {
      1: { shared_tempo: { sourceUID: 4, expiresAt: 12 }, brace: { sourceUID: 1, expiresAt: 11, damageCutPct: 30 } },
      4: { shared_tempo: { sourceUID: 4, expiresAt: 12 }, wishgrant: { sourceUID: 4, expiresAt: 9, modifiers: [{ channel: 'ATK', direction: 'up', magnitude: .35 }] } },
    },
  };
  const before = JSON.stringify({ entities, globals });
  const input = heroBuffSignalInput(entities, globals);
  assert.equal(JSON.stringify({ entities, globals }), before);
  assert.deepEqual(input.map(hero => [hero.uid, hero.alive]), [[1, true], [2, false], [4, true]]);
  const out = projectBuffSignals(input);
  assert.deepEqual(out.party, ['party-spd', 'party-def', 'party-ward']);
  assert.deepEqual(out.heroes, { 1: ['defense'], 4: ['offense'] });
});
