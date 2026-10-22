import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatProgressionState } from '../web-runner/src/core/combatProgressionRules.mjs';
import { starUpHero, setHeroResonance, starUpCost, heroGrowthModifiers, heroGrowthBreakdown, sanitizeHeroGrowth, canonicalGrowthId, STAR_MAX } from '../web-runner/src/core/heroGrowthRules.mjs';
import { sanitizeHeroFormation, placeFormationHero, setFormationLeader, autoFormActive, copyFormationPresetTo, selectFormationPreset, activeFormationPreset, formationSuccession, formationPlacement, openFormationCells, unlockedFormationGrids, setFormationLocked, FORMATION_SECOND_GRID_LEVEL } from '../web-runner/src/core/heroFormationRules.mjs';
import { deriveContinuousCombatRecoveryHuddle } from '../web-runner/src/core/arenaCombat.mjs';
import { resolveCombatMovementTuning, resolveCombatLeader, sanitizeCombatMovementTuning } from '../web-runner/src/core/combatMovementTuning.mjs';
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

test('formation board is two 2x2 grids in one row; the right grid opens first with the frontline rightmost', () => {
  let state = sanitizeHeroFormation(null, roster);
  const preset = activeFormationPreset(state);
  assert.equal(state.unlockedGrids, 1);
  assert.deepEqual(preset, { leader: 'Falie', cells: { Falie: 3, Huun: 7, Runa: 2, Kojonn: 6 } }, 'tanks take the rightmost column, ranged the column beside it');
  assert.deepEqual(formationPlacement(preset), { Falie: { depth: 0, row: 0 }, Huun: { depth: 0, row: 1 }, Runa: { depth: 1, row: 0 }, Kojonn: { depth: 1, row: 1 } });
  assert.deepEqual(formationSuccession(preset), ['Falie', 'Huun', 'Runa', 'Kojonn']);
  assert.deepEqual(openFormationCells(1), [3, 7, 2, 6]);
  assert.deepEqual(openFormationCells(2), [3, 7, 2, 6, 1, 5, 0, 4]);
  assert.equal(placeFormationHero(state, 'Runa', 1), state, 'locked left grid refuses placement');
  state = placeFormationHero(state, 'Runa', 3);
  assert.deepEqual([activeFormationPreset(state).cells.Runa, activeFormationPreset(state).cells.Falie], [3, 2], 'occupied target swaps');
  state = setFormationLeader(state, 'Runa');
  assert.deepEqual(formationSuccession(activeFormationPreset(state)), ['Runa', 'Huun', 'Falie', 'Kojonn']);
  assert.equal(setFormationLeader(state, 'Ghost'), state);
  const copied = copyFormationPresetTo(state, [1, 2, 0]);
  assert.equal(copied.active, 0, 'the source stays selected');
  assert.deepEqual([copied.presets[1], copied.presets[2]], [copied.presets[0], copied.presets[0]], 'copy reaches every chosen destination');
  assert.equal(copyFormationPresetTo(state, []), state);
  const guarded = copyFormationPresetTo({ ...state, presets: state.presets.map((preset, index) => index === 2 ? { ...preset, locked: true } : preset) }, [2]);
  assert.equal(guarded.presets[2].leader, 'Falie', 'locked destinations are skipped');
  state = selectFormationPreset(copied, 1);
  state = autoFormActive(state, roster);
  assert.deepEqual(activeFormationPreset(state), { leader: 'Runa', cells: { Falie: 3, Huun: 7, Runa: 2, Kojonn: 6 } });
  assert.equal(selectFormationPreset(state, 7), state);
  const repaired = sanitizeHeroFormation({ active: 2, presets: [{ leader: 'Ghost', cells: { Falie: 0, Huun: 0, Runa: 99 } }] }, roster);
  assert.deepEqual(Object.values(repaired.presets[0].cells).sort(), [2, 3, 6, 7], 'locked or corrupt cells repair into the open grid');
  assert.equal(repaired.presets[0].leader, 'Falie');
  assert.equal(repaired.active, 2);
  assert.deepEqual([unlockedFormationGrids(29), unlockedFormationGrids(FORMATION_SECOND_GRID_LEVEL)], [1, 2]);
  let open = placeFormationHero(sanitizeHeroFormation(null, roster, 2), 'Kojonn', 0);
  assert.deepEqual(formationPlacement(activeFormationPreset(open)).Kojonn, { depth: 3, row: 0 }, 'an unlocked, occupied left grid adds depth');
  open = sanitizeHeroFormation(open, roster, 1);
  assert.ok([2, 3, 6, 7].includes(activeFormationPreset(open).cells.Kojonn), 'relocking returns heroes to the open grid');
});

test('a locked preset refuses moves and Auto-Form and survives a save round trip', () => {
  let state = setFormationLocked(sanitizeHeroFormation(null, roster), true);
  assert.equal(activeFormationPreset(state).locked, true);
  assert.equal(placeFormationHero(state, 'Runa', 3), state);
  assert.equal(autoFormActive(state, roster), state);
  assert.equal(sanitizeHeroFormation(JSON.parse(JSON.stringify(state)), roster).presets[0].locked, true);
  state = setFormationLocked(state, false);
  assert.equal('locked' in activeFormationPreset(state), false);
  assert.notEqual(placeFormationHero(state, 'Runa', 3), state);
});

test('default board reproduces the authored combat formation and mirrors with travel direction', () => {
  const heroes = ['Falie', 'Huun', 'Runa', 'Kojonn'].map(baseHeroName => ({ baseHeroName, hp: 10, kind: 'hero' }));
  const placement = Object.fromEntries(Object.entries(formationPlacement(activeFormationPreset(sanitizeHeroFormation(null, roster)))).map(([id, slot]) => [id.toLowerCase(), slot]));
  for (const heading of [1, -1]) assert.deepEqual(deriveContinuousCombatRecoveryHuddle(heroes, heading, placement).map(row => [row.x, row.y]), deriveContinuousCombatRecoveryHuddle(heroes, heading).map(row => [row.x, row.y]), 'default board matches the authored huddle');
  const swapped = { ...placement, falie: { depth: 1, row: 0 }, runa: { depth: 0, row: 0 } };
  // The board faces right: travelling right, the frontline leads on the right; travelling left it mirrors.
  const right = deriveContinuousCombatRecoveryHuddle(heroes, 1, swapped), left = deriveContinuousCombatRecoveryHuddle(heroes, -1, swapped);
  const x = (rows, name) => rows.find(row => row.hero.baseHeroName === name).x;
  assert.ok(x(right, 'Runa') > x(right, 'Falie'), 'moving right, the frontline leads on the right');
  assert.ok(x(left, 'Runa') < x(left, 'Falie'), 'moving left, the frontline leads on the left');
});

test('combat leader follows Formation unless the dev override is enabled, with succession on KO', () => {
  assert.equal(resolveCombatMovementTuning({}).leaderName, 'Fara');
  const globals = { HeroFormationLeader: 'Runa', HeroFormationOrder: ['Runa', 'Kaja', 'Fara', 'Hondo'] };
  const tuning = resolveCombatMovementTuning(globals);
  assert.equal(tuning.leaderName, 'Runa');
  assert.deepEqual(tuning.succession, ['Runa', 'Kaja', 'Fara', 'Hondo']);
  // Dev tunings saved by the panel always carry a leader name; without the override flag Formation still leads.
  assert.equal(resolveCombatMovementTuning({ ...globals, DevMovementTuning: { leaderName: 'Hondo', heroOverlap: 0.5 } }).leaderName, 'Runa');
  assert.equal(resolveCombatMovementTuning({ ...globals, DevMovementTuning: sanitizeCombatMovementTuning({ heroOverlap: 0.5 }) }).leaderName, 'Runa', 'panel defaults and Reset never override');
  assert.equal(resolveCombatMovementTuning({ ...globals, DevMovementTuning: { leaderName: 'Hondo', leaderOverride: 'yes' } }).leaderName, 'Runa', 'only a literal true enables the override');
  const overridden = resolveCombatMovementTuning({ ...globals, DevMovementTuning: { leaderName: 'Hondo', leaderOverride: true } });
  assert.equal(overridden.leaderName, 'Hondo');
  assert.equal(overridden.leaderOverride, true);
  assert.equal(resolveCombatMovementTuning({ DevMovementTuning: { leaderName: 'Kaja' } }).leaderName, 'Fara', 'no Formation and no override keeps the default leader');
  const heroes = [{ baseHeroName: 'Falie', hp: 5 }, { baseHeroName: 'Huun', hp: 5 }, { baseHeroName: 'Runa', hp: 0 }, { baseHeroName: 'Kojonn', hp: 5 }];
  assert.equal(resolveCombatLeader(heroes, tuning.leaderName, tuning.succession).baseHeroName, 'Kojonn');
  assert.equal(resolveCombatLeader(heroes, 'Runa').baseHeroName, 'Falie', 'without succession the party order still applies');
});
