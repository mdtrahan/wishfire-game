import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatProgressionState } from '../web-runner/src/core/combatProgressionRules.mjs';
import { starUpHero, setHeroResonance, starUpCost, heroGrowthModifiers, heroGrowthBreakdown, sanitizeHeroGrowth, canonicalGrowthId, STAR_MAX } from '../web-runner/src/core/heroGrowthRules.mjs';
import { sanitizeHeroFormation, placeFormationHero, setFormationLeader, autoFormActive, copyFormationPreset, selectFormationPreset, activeFormationPreset, formationSuccession, formationOccupant } from '../web-runner/src/core/heroFormationRules.mjs';
import { resolveCombatMovementTuning, resolveCombatLeader } from '../web-runner/src/core/combatMovementTuning.mjs';
import { permanentHeroModifiers } from '../web-runner/src/core/realtimeSkillState.mjs';

const roster = [{ id: 'Falie', name: 'Fara', role: 'Tank' }, { id: 'Huun', name: 'Hondo', role: 'Damage' }, { id: 'Runa', name: 'Runa', role: 'Mage' }, { id: 'Kojonn', name: 'Kaja', role: 'Support' }];
const withTickets = tickets => createCombatProgressionState({ wallet: { ticketsByHero: tickets } });

test('untouched progression saves carry no growth field', () => {
  const state = createCombatProgressionState({ wallet: { ticketsByHero: { Falie: 5 } } });
  assert.equal('growth' in state, false);
  assert.equal(sanitizeHeroGrowth({ stars: {}, resonance: {} }), null);
});

test('Star Up spends the hero\'s own tickets with a rising cost and caps at 15', () => {
  assert.deepEqual([0, 1, 14].map(starUpCost), [50, 100, 750]);
  let result = starUpHero(withTickets({ Falie: 49 }), 'Falie');
  assert.deepEqual([result.ok, result.reason, result.cost], [false, 'insufficient_tickets', 50]);
  result = starUpHero(withTickets({ Falie: 160, Huun: 999 }), 'Falie');
  assert.equal(result.ok, true);
  assert.equal(result.state.wallet.ticketsByHero.Falie, 110);
  assert.equal(result.state.wallet.ticketsByHero.Huun, 999);
  assert.deepEqual(result.state.growth.stars, { Falie: 1 });
  const reloaded = createCombatProgressionState(JSON.parse(JSON.stringify(result.state)));
  assert.deepEqual(reloaded.growth, result.state.growth, 'growth survives a save round trip');
  const maxed = createCombatProgressionState({ wallet: { ticketsByHero: { Falie: 1e6 } }, growth: { stars: { Falie: STAR_MAX } } });
  assert.equal(starUpHero(maxed, 'Falie').reason, 'max_stars');
  assert.equal(starUpHero(withTickets({ Ghost: 999 }), 'Ghost').reason, 'hero_unavailable');
});

test('stars, completed tiers and resonance echoes combine into permanent bonuses', () => {
  const growth = sanitizeHeroGrowth({ stars: { Huun: 5, Runa: 2 }, resonance: { Huun: ['Runa', 'Falie'] } });
  const breakdown = heroGrowthBreakdown(growth, 'Huun');
  assert.equal(breakdown.own, 0.1);
  assert.equal(breakdown.party, 0.01);
  assert.deepEqual(breakdown.echoes.map(echo => [echo.from, echo.stat, echo.magnitude]), [['Runa', 'MAG', 0.06], ['Falie', 'DEF', 0.05]]);
  assert.deepEqual(Object.fromEntries(heroGrowthModifiers(growth, 'huun#1').map(row => [row.channel, row.magnitude])), { HP: 0.11, ATK: 0.11, DEF: 0.16, MAG: 0.17, RES: 0.11 });
  assert.deepEqual(heroGrowthModifiers(growth, 'huun#2'), [], 'later combat copies do not inherit growth');
  assert.equal(canonicalGrowthId('kojonn#1'), 'Kojonn');
});

test('party training and growth stack into one permanent modifier per stat', () => {
  const globals = { PartyTrainingLevels: { ATK: 3 }, HeroGrowth: { stars: { Huun: 1 } } };
  const mods = Object.fromEntries(permanentHeroModifiers(globals, { kind: 'hero', heroInstanceKey: 'Huun', stats: { ATK: 10, DEF: 5, MAG: 3, RES: 4 } }).map(row => [row.channel, row.magnitude]));
  assert.ok(Math.abs(mods.ATK - 0.08) < 1e-9);
  assert.equal(mods.HP, 0.02);
});

test('Resonance slots respect star unlocks, exclude self and never duplicate a lender', () => {
  const base = withTickets({});
  assert.equal(setHeroResonance(base, 'Falie', 1, 'Huun').reason, 'slot_locked');
  assert.equal(setHeroResonance(base, 'Falie', 0, 'Falie').reason, 'invalid_link');
  let result = setHeroResonance(base, 'Falie', 0, 'Huun');
  assert.deepEqual(result.state.growth.resonance, { Falie: ['Huun', ''] });
  const starred = { ...result.state, growth: { ...result.state.growth, stars: { Falie: 5 } } };
  result = setHeroResonance(starred, 'Falie', 1, 'Huun');
  assert.deepEqual(result.state.growth.resonance.Falie, ['', 'Huun'], 'moving a lender clears its old slot');
  result = setHeroResonance(result.state, 'Falie', 1, '');
  assert.equal(result.state.growth.resonance?.Falie, undefined);
});

test('formation board defaults to the role layout and supports move, swap, leader and presets', () => {
  let state = sanitizeHeroFormation(null, roster);
  const preset = activeFormationPreset(state);
  assert.deepEqual(preset, { leader: 'Falie', cells: { Falie: 1, Huun: 2, Runa: 9, Kojonn: 10 } });
  assert.deepEqual(formationSuccession(preset), ['Falie', 'Huun', 'Runa', 'Kojonn']);
  state = placeFormationHero(state, 'Runa', 2);
  assert.deepEqual([activeFormationPreset(state).cells.Runa, activeFormationPreset(state).cells.Huun], [2, 9], 'occupied target swaps');
  state = placeFormationHero(state, 'Kojonn', 0);
  assert.equal(formationOccupant(activeFormationPreset(state), 0), 'Kojonn');
  state = setFormationLeader(state, 'Runa');
  assert.deepEqual(formationSuccession(activeFormationPreset(state)), ['Runa', 'Kojonn', 'Falie', 'Huun']);
  assert.equal(setFormationLeader(state, 'Ghost'), state);
  state = copyFormationPreset(state);
  assert.equal(state.active, 1);
  assert.deepEqual(state.presets[1], state.presets[0]);
  state = autoFormActive(state, roster);
  assert.deepEqual(activeFormationPreset(state), { leader: 'Runa', cells: { Falie: 1, Huun: 2, Runa: 9, Kojonn: 10 } });
  assert.equal(selectFormationPreset(state, 7), state);
  const repaired = sanitizeHeroFormation({ active: 2, presets: [{ leader: 'Ghost', cells: { Falie: 3, Huun: 3, Runa: 99 } }] }, roster);
  const cells = Object.values(repaired.presets[0].cells);
  assert.equal(new Set(cells).size, 4, 'corrupt saves repair to unique cells');
  assert.equal(repaired.presets[0].leader, 'Falie');
  assert.equal(repaired.active, 2);
});

test('combat leader follows Formation unless a dev tuning names one, with succession on KO', () => {
  assert.equal(resolveCombatMovementTuning({}).leaderName, 'Fara');
  const globals = { HeroFormationLeader: 'Runa', HeroFormationOrder: ['Runa', 'Kaja', 'Fara', 'Hondo'] };
  const tuning = resolveCombatMovementTuning(globals);
  assert.equal(tuning.leaderName, 'Runa');
  assert.deepEqual(tuning.succession, ['Runa', 'Kaja', 'Fara', 'Hondo']);
  assert.equal(resolveCombatMovementTuning({ ...globals, DevMovementTuning: { leaderName: 'Hondo' } }).leaderName, 'Hondo');
  const heroes = [{ baseHeroName: 'Falie', hp: 5 }, { baseHeroName: 'Huun', hp: 5 }, { baseHeroName: 'Runa', hp: 0 }, { baseHeroName: 'Kojonn', hp: 5 }];
  assert.equal(resolveCombatLeader(heroes, tuning.leaderName, tuning.succession).baseHeroName, 'Kojonn');
  assert.equal(resolveCombatLeader(heroes, 'Runa').baseHeroName, 'Falie', 'without succession the party order still applies');
});
