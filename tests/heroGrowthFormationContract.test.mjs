import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatProgressionState } from '../web-runner/src/core/combatProgressionRules.mjs';
import { starUpHero, setHeroResonance, starUpCost, heroGrowthModifiers, heroGrowthBreakdown, sanitizeHeroGrowth, canonicalGrowthId, STAR_MAX, STAR_EFFECTS } from '../web-runner/src/core/heroGrowthRules.mjs';
import { resolveCombatMovementTuning, resolveCombatAnchor } from '../web-runner/src/core/combatMovementTuning.mjs';
import { permanentHeroModifiers } from '../web-runner/src/core/heroPermanentModifiers.mjs';

const withTickets = tickets => createCombatProgressionState({ wallet: { ticketsByHero: tickets } });

test('untouched progression saves carry no growth field', () => {
  const state = createCombatProgressionState({ wallet: { ticketsByHero: { Falie: 5 } } });
  assert.equal('growth' in state, false);
  assert.equal(sanitizeHeroGrowth({ stars: {}, resonance: {} }), null);
});

test('Star Up spends the hero\'s own tickets with a rising cost and caps at 8', () => {
  assert.deepEqual([0, 1, 7].map(starUpCost), [50, 100, 400]);
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

test('each star grants its hero 2% stats; migrated resonance links grant none', () => {
  const growth = sanitizeHeroGrowth({ stars: { Huun: 5, Runa: 2 }, resonance: { Huun: ['Runa', 'Falie'] } });
  const breakdown = heroGrowthBreakdown(growth, 'Huun');
  assert.equal(breakdown.own, 0.1);
  assert.equal(breakdown.party, undefined);
  assert.equal(growth.resonance, undefined);
  assert.deepEqual(Object.fromEntries(heroGrowthModifiers(growth, 'huun#1').map(row => [row.channel, row.magnitude])), { HP: 0.1, ATK: 0.1, DEF: 0.1, MAG: 0.1, RES: 0.1 });
  assert.deepEqual(heroGrowthModifiers(growth, 'huun#2'), [], 'later combat copies do not inherit growth');
  assert.equal(canonicalGrowthId('kojonn#1'), 'Kojonn');
});

test('party training and growth stack into one permanent modifier per stat', () => {
  const globals = { PartyTrainingLevels: { ATK: 3 }, HeroGrowth: { stars: { Huun: 1 } } };
  const mods = Object.fromEntries(permanentHeroModifiers(globals, { kind: 'hero', heroInstanceKey: 'Huun', stats: { ATK: 10, DEF: 5, MAG: 3, RES: 4 } }).map(row => [row.channel, row.magnitude]));
  assert.ok(Math.abs(mods.ATK - 0.08) < 1e-9);
  assert.equal(mods.HP, 0.02);
});

test('accepted resonance scaffolds reject legacy stat-link writes', () => {
 const base=withTickets({});
 assert.deepEqual(setHeroResonance(base,'Falie',0,'Huun'),{state:base,ok:false,reason:'unavailable'});
});

test('eight stars map in pairs to accepted skill slots and clamp legacy saves', () => {
 assert.equal(STAR_MAX,8);
 assert.deepEqual(Object.values(STAR_EFFECTS).map(slots=>{const [skillSlot,effect]=Object.entries(slots)[0];return[skillSlot,effect.statBonus];}), ['special','special','passive','passive','resonance1','resonance1','resonance2','resonance2'].map(slot=>[slot,.02]));
 assert.deepEqual(sanitizeHeroGrowth({stars:{Falie:15,Huun:99,Runa:'bad',Kojonn:-2},resonance:{Falie:['Huun','Runa']}}),{stars:{Falie:8,Huun:8}});
 assert.equal(heroGrowthBreakdown({stars:{Falie:8}},'Falie').own,.16);
 for(const raw of [null,[],{},'bad',{stars:null},{stars:{Falie:Infinity}}])assert.equal(sanitizeHeroGrowth(raw),null);
});

test('retired leader choices cannot change the first living party anchor', () => {
  const globals = { HeroFormationLeader: 'Runa', HeroFormationOrder: ['Runa', 'Kaja'], DevMovementTuning: { leaderName: 'Kaja', leaderOverride: true, heroOverlap: 0.5 } };
  const tuning = resolveCombatMovementTuning(globals);
  assert.equal(tuning.heroOverlap, 0.5);
  for (const field of ['leaderName', 'leaderOverride', 'succession']) assert.equal(field in tuning, false);
  const heroes = [{ baseHeroName: 'Huun', hp: 5 }, { baseHeroName: 'Falie', hp: 5 }, { baseHeroName: 'Runa', hp: 5 }];
  assert.equal(resolveCombatAnchor(heroes), heroes[0]);
  heroes[0].hp = 0;
  assert.equal(resolveCombatAnchor(heroes), heroes[1]);
  heroes[1].hp = heroes[2].hp = 0;
  assert.equal(resolveCombatAnchor(heroes), null);
});
