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
  assert.deepEqual(out, { party: [], partyRefs: {}, heroes: { 1: [], 2: [] } });
});

test('KO heroes are excluded and do not block party-wide buffs on the living', () => {
  const ward = buff('1:ward', 'ward');
  const out = projectBuffSignals([hero(1, [ward]), hero(2, [ward]), hero(3, [], false)]);
  assert.deepEqual(out.party, ['party-ward']);
  assert.equal(out.heroes[3], undefined);
});

test('a lone survivor keeps its buffs on its own clock', () => {
  const out = projectBuffSignals([hero(1, [buff('4:elevate', 'SPD')]), hero(2, [buff('4:elevate', 'SPD')], false)]);
  assert.deepEqual(out, { party: [], partyRefs: {}, heroes: { 1: ['tempo'] } });
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

test('Rust snapshot buffs translate into channels and party icons keep their skill route', () => {
  const entities = [
    { kind: 'hero', name: 'Falie', uid: 1, hp: 30, maxHP: 100, currentLevel: 1 },
    { kind: 'hero', name: 'Kojonn', uid: 4, hp: 50, maxHP: 100, currentLevel: 1, statuses: [{ statusEffect: 'atkUp', duration: 2 }] },
    { kind: 'hero', name: 'Huun', uid: 2, hp: 0, maxHP: 100, currentLevel: 1 },
  ];
  const elevate = { sourceUID: 4, expiresAt: 1e9, modifiers: [{ channel: 'range', direction: 'up', magnitude: .1 }, { channel: 'critDamage', direction: 'up', magnitude: .05 }], data: { set: 'reach' } };
  const globals = {
    time: 10, PartyBuff_DEF: 3, HeroWardHPByUID: { 1: 20, 4: 20 }, HeroWardSourceUID: 1,
    RealtimeSkillEffects: { 1: { elevate: { ...elevate } }, 4: { elevate: { ...elevate }, old: { sourceUID: 4, expiresAt: 9, modifiers: [{ channel: 'MAG', direction: 'up' }] } } },
  };
  entities.forEach(actor => { actor.rustActorId = actor.uid; });
  globals.RustCombatPresentation = { state: { snapshot: { actors: [
    { actor_id: 1, team: 'hero', kind: 'fara', hp: 30, ward: 20 },
    { actor_id: 4, team: 'hero', kind: 'kaja', hp: 50, groove_active: 8, ward: 20, elevate: 'sword' },
    { actor_id: 2, team: 'hero', ward: 0, downed: true },
  ] } } };
  const before = JSON.stringify({ entities, globals });
  const input = heroBuffSignalInput(entities, globals);
  assert.equal(JSON.stringify({ entities, globals }), before);
  assert.deepEqual(input.map(hero => [hero.uid, hero.alive]), [[1, true], [4, true], [2, false]]);
  const out = projectBuffSignals(input);
  assert.deepEqual(out.party, ['party-ward']);
  assert.deepEqual(out.partyRefs['party-ward'], { effectId: 'ward' });
  assert.deepEqual(out.heroes, { 1: ['offense'], 4: ['offense'] }, 'each living recipient shows Elevate; legacy effect collections do not contribute');
});


test('every living hero signals Elevate until its Rust source ends, without enemy buffs', () => {
  const entities = ['Falie', 'Huun', 'Runa', 'Kojonn'].map((name, i) => ({ kind: 'hero', name, uid: i + 1, rustActorId: i + 1, hp: 100 }));
  const views = entities.map((a, i) => ({ team: 'hero', actor_id: a.rustActorId, kind: ['fara', 'hondo', 'runa', 'kaja'][i], hp: 100 }));
  const source = views[3];
  const globals = { RustCombatPresentation: { state: { snapshot: { actors: [...views, { team: 'enemy', actor_id: 5, hp: 100 }] } } } };
  for (const variant of ['sword', 'wings', 'wingedboots']) {
    source.elevate = variant;
    for (const duration of [8, 4, .0001]) {
      source.groove_active = duration;
      const before = structuredClone(globals);
      const input = heroBuffSignalInput(entities, globals), signals = projectBuffSignals(input);
      assert.equal(input.length, 4);
      assert.ok(input.every(hero => hero.buffs.some(buff => buff.ref.effectId === 'elevate')));
      assert.deepEqual(Object.values(signals.heroes), Array(4).fill(['offense']));
      assert.deepEqual(globals, before);
    }
    source.groove_active = 0;
    assert.ok(heroBuffSignalInput(entities, globals).every(hero => hero.buffs.length === 0));
  }
  source.groove_active = 8;
  source.hp = 0;
  assert.ok(heroBuffSignalInput(entities, globals).every(hero => hero.buffs.length === 0));
});
