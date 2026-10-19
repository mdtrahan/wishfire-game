import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createCombatProgressionState, ensureCombatObjective, recordCombatObjectiveEvent, claimCombatObjectiveReward, combatObjectivePresentation, combatObjectiveReward,
  COMBAT_PROGRESSION_SAVE_KEY, COMBAT_REWARD_BUNDLES, purchasePartyTraining, trainingCost, TRAINING_STATS, spendHeroTickets, settleHeroTicketSpend, heroTicketLevelCost,
} from '../web-runner/src/core/combatProgressionRules.mjs';
import { awardHeroEXP, createHeroProgressStore, newHeroProgress, saveHeroProgress } from '../web-runner/src/core/heroProgression.mjs';
import { partyTrainingCombatStat, realtimeCombatStat } from '../web-runner/src/core/realtimeSkillState.mjs';
import { createCombatProgression } from '../web-runner/systems/combatProgression.mjs';
import { createEquipmentStorage } from '../web-runner/systems/equipmentStorage.mjs';
import { claimObjectiveWithReceipt } from '../web-runner/systems/combatProgressionUI.mjs';
import { continuousCombatWaveClearEventId } from '../web-runner/src/core/continuousCombatStage.mjs';

const heroes = [
  { heroInstanceKey: 'hondo', baseHeroName: 'Hondo', currentLevel: 1, maxLevel: 100, kind: 'hero' },
  { heroInstanceKey: 'fara', baseHeroName: 'Fara', currentLevel: 100, maxLevel: 100, kind: 'hero' },
];

class MemoryStorage {
  values = new Map();
  writes = 0;
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { if (this.failKey === key) throw Error('disk full'); this.writes += 1; this.values.set(key, String(value)); }
}

test('objective generation is deterministic and freezes a bounded target', () => {
  const base = createCombatProgressionState({ seed: 12345 });
  const first = ensureCombatObjective(base);
  const second = ensureCombatObjective(base);
  assert.deepEqual(first, second);
  assert.equal(first.objective.type, 'gear_collect');
  assert.equal(first.objective.target, 1);
  assert.deepEqual(TRAINING_STATS, ['ATK', 'DEF', 'MATK', 'RES']);
});

test('single-target mini quests omit counters while multi-target quests keep progress', () => {
  assert.equal(combatObjectivePresentation(null).count, '');
  for (const type of Object.keys(COMBAT_REWARD_BUNDLES)) {
    for (const progress of [0, 1, 3]) {
      const objective = { type, target: 1, progress, chapter: 1, threshold: 5, heroName: 'Hondo', stat: 'ATK', slot: 'hat', rarity: 'rare' };
      assert.equal(combatObjectivePresentation(objective).count, '', `${type}:${progress}`);
      assert.equal(combatObjectivePresentation({ ...objective, target: 4 }).count, `${progress}/4`, type);
    }
  }
  assert.equal(combatObjectivePresentation({ type: 'boss_defeat', chapter: 1, target: 1, progress: 1 }).challenge, 'Defeat Chapter 1 boss');
});

test('legacy over-target progress normalizes to ready without exceeding the frozen target', () => {
  const state = createCombatProgressionState({ objective: { id: 'legacy-ready', type: 'enemy_defeat', target: 3, progress: 19, seed: 2 } });
  assert.equal(state.objective.progress, 3);
  assert.equal(combatObjectivePresentation(state.objective).count, '3/3');
});

test('opening objectives are deterministic and generated later objectives exclude wave clears', () => {
  for (let seed = 1; seed <= 500; seed += 1) {
    let state = ensureCombatObjective(createCombatProgressionState({ seed, wallet: { incense: 100, ticketsByHero: { hondo: 500 } } }), heroes);
    assert.equal(state.objective.type, 'gear_collect');
    assert.equal(state.objective.target, 1);
    assert.equal(combatObjectivePresentation(state.objective).challenge, 'Collect equipment');
    state = recordCombatObjectiveEvent(state, { id: `opening-gear-${seed}`, type: 'gear_collect' }, heroes).state;
    assert.equal(state.objective.progress, 1);
    assert.equal(state.cursor, 0);
    assert.equal(state.rewardReceipts.length, 0);
    state = claimCombatObjectiveReward(state, state.objective.id, heroes).state;
    assert.equal(state.cursor, 1);
    assert.equal(state.objective.type, 'enemy_defeat');
    assert.equal(state.objective.target, 3);
    assert.equal(combatObjectivePresentation(state.objective).challenge, 'Defeat enemies');
    for (let index = 0; index < 3; index += 1) {
      state = recordCombatObjectiveEvent(state, { id: `opening-enemy-${seed}-${index}`, type: 'enemy_defeat' }, heroes).state;
    }
    assert.equal(state.cursor, 1);
    assert.equal(state.objective.progress, state.objective.target);
    assert.equal(state.rewardReceipts.length, 1);
    const claim = claimCombatObjectiveReward(state, state.objective.id, heroes);
    assert.equal(claim.ok, true);
    state = claim.state;
    assert.equal(state.cursor, 2);
    assert.notEqual(state.objective.type, 'wave_clear');
  }
});

test('saved opening wave objectives migrate without rewards while valid progress remains frozen', () => {
  for (const cursor of [0, 1]) {
    const saved = createCombatProgressionState({
      cursor,
      seed: 123,
      wallet: { incense: 25, ticketsByHero: { hondo: 9 } },
      processedEvents: ['earlier-event'],
      rewardReceipts: [{ id: 'earlier-reward', resource: 'incense', amount: 5 }],
      objective: { id: `old-opening-wave-${cursor}`, type: 'wave_clear', target: 1, progress: 0, seed: 456 },
    });
    const repaired = ensureCombatObjective(saved, heroes);
    assert.equal(repaired.cursor, cursor);
    assert.equal(repaired.objective.type, cursor === 0 ? 'gear_collect' : 'enemy_defeat');
    assert.equal(repaired.objective.target, cursor === 0 ? 1 : 3);
    assert.equal(repaired.objective.progress, 0);
    assert.notEqual(repaired.objective.id, saved.objective.id);
    assert.deepEqual(repaired.rewardReceipts, saved.rewardReceipts);
    assert.deepEqual(repaired.processedEvents, saved.processedEvents);
    assert.deepEqual(repaired.wallet, saved.wallet);
  }

  const valid = createCombatProgressionState({
    cursor: 1,
    objective: { id: 'earned-progress', type: 'enemy_defeat', target: 4, progress: 2, seed: 7 },
  });
  const preserved = ensureCombatObjective(valid, heroes);
  assert.equal(preserved.objective.id, 'earned-progress');
  assert.equal(combatObjectivePresentation(preserved.objective).count, '2/4');
  const laterWave = createCombatProgressionState({
    cursor: 2,
    objective: { id: 'later-wave', type: 'wave_clear', target: 2, progress: 1, seed: 8 },
  });
  assert.deepEqual(ensureCombatObjective(laterWave, heroes).objective, laterWave.objective);
});

test('reward preview follows the active objective and freezes a ticket recipient', () => {
  const gear = createCombatProgressionState({
    objective: { id: 'gear', type: 'gear_collect', target: 1, progress: 0, seed: 1 },
    lastReward: { icon: 'incense', count: 5 },
  });
  assert.deepEqual(combatObjectiveReward(gear.objective), { resource: 'essence', amount: 2 });
  const training = ensureCombatObjective(createCombatProgressionState({ wallet: { incense: 20 }, objective: { id: 'train', type: 'training_upgrade', target: 1, progress: 0, seed: 2 } }), heroes);
  assert.equal(training.objective.rewardHeroName, 'Hondo');
  assert.deepEqual(combatObjectiveReward(training.objective), { resource: 'hero_ticket', amount: 5, heroId: 'hondo', heroName: 'Hondo' });
});

test('eligible ticket objectives freeze the selected hero identity at generation', () => {
  const eligible = [heroes[0], heroes[1]].map(hero => ({ ...hero, kind: 'hero' }));
  const found = new Set();
  for (let seed = 1; seed <= 500; seed += 1) {
    const generated = ensureCombatObjective(createCombatProgressionState({ seed, cursor: 2, wallet: { incense: 100, ticketsByHero: { hondo: 500 } } }), eligible);
    if (['training_upgrade', 'hero_upgrade'].includes(generated.objective.type)) {
      if (generated.objective.type === 'hero_upgrade') { assert.equal(generated.objective.heroId, 'hondo'); assert.equal(generated.objective.heroName, 'Hondo'); }
      else { assert.ok(generated.objective.heroId); assert.equal(generated.objective.heroName, undefined); }
      assert.equal(ensureCombatObjective(generated, eligible).objective.heroId, generated.objective.heroId);
      found.add(generated.objective.type);
    }
  }
  assert.deepEqual(found, new Set(['training_upgrade', 'hero_upgrade']));
});

test('hero level objectives are excluded until one eligible hero can afford the current level cost', () => {
  const eligible = [{ ...heroes[0], kind: 'hero' }];
  for (let seed = 1; seed <= 200; seed += 1) {
    assert.notEqual(ensureCombatObjective(createCombatProgressionState({ seed, wallet: { ticketsByHero: { hondo: 99 } } }), eligible).objective.type, 'hero_upgrade');
  }
  const training = createCombatProgressionState({ objective: { id: 'training', type: 'training_upgrade', target: 1, progress: 0, seed: 1, heroId: 'hondo', heroName: 'Hondo' } });
  assert.equal(combatObjectivePresentation(training.objective).challenge, 'Train a party stat');
});

test('training objectives require an affordable stat and retain their frozen target while valid', () => {
  const valid = ensureCombatObjective(createCombatProgressionState({ wallet: { incense: 20 }, objective: { id: 'frozen-training', type: 'training_upgrade', target: 1, progress: 0, seed: 1 } }), heroes);
  assert.equal(valid.objective.id, 'frozen-training');
  assert.equal(valid.objective.target, 1);
  const recovered = ensureCombatObjective(createCombatProgressionState({ seed: 23, objective: { id: 'unfunded-training', type: 'training_upgrade', target: 1, progress: 0, seed: 1 } }), heroes);
  assert.notEqual(recovered.objective.id, 'unfunded-training');
  assert.notEqual(recovered.objective.type, 'training_upgrade');
  for (let seed = 1; seed <= 200; seed += 1) assert.notEqual(ensureCombatObjective(createCombatProgressionState({ seed }), heroes).objective.type, 'training_upgrade');
  const capped = ensureCombatObjective(createCombatProgressionState({ wallet: { incense: 10000 }, training: { ATK: 100, DEF: 100, MATK: 100, RES: 100 }, objective: { id: 'maxed-training', type: 'training_upgrade', target: 1, progress: 0, seed: 1 } }), heroes);
  assert.notEqual(capped.objective.id, 'maxed-training');
  assert.notEqual(capped.objective.type, 'training_upgrade');
});

test('saved hero upgrade objectives reassign capped heroes but preserve pending matching spends', () => {
  const roster = [{ ...heroes[0], currentLevel: 100 }, { ...heroes[1], currentLevel: 1, maxLevel: 100 }];
  const saved = createCombatProgressionState({ wallet: { ticketsByHero: { fara: 100 } }, objective: { id: 'frozen-level', type: 'hero_upgrade', target: 1, progress: 0, seed: 1, heroId: 'hondo', heroName: 'Hondo' } });
  const rebound = ensureCombatObjective(saved, roster);
  assert.equal(rebound.objective.id, 'frozen-level');
  assert.equal(rebound.objective.target, 1);
  assert.equal(rebound.objective.heroId, 'fara');
  assert.equal(rebound.objective.heroName, 'Fara');

  const pending = createCombatProgressionState({ wallet: { ticketsByHero: { hondo: 0 } }, pendingTicketSpends: { 'spend-last': { id: 'spend-last', heroId: 'hondo', cost: 100, fromLevel: 99 } }, objective: { id: 'last-level', type: 'hero_upgrade', target: 1, progress: 0, seed: 1, heroId: 'hondo', heroName: 'Hondo' } });
  const restored = ensureCombatObjective(pending, roster);
  assert.equal(restored.objective.id, 'last-level');
  assert.equal(restored.objective.heroId, 'hondo');
  const settled = settleHeroTicketSpend(pending, 'spend-last', roster, 1000);
  assert.equal(settled.receipt, null);
  assert.equal(settled.state.objective.progress, 1);
  assert.equal(settled.state.cursor, 0);
  assert.ok(settled.state.processedEvents.includes('ticket-level-up:spend-last'));
  assert.deepEqual(settled.state.pendingTicketSpends, {});
});

test('hero level objective advances and pays only when the named hero levels up', () => {
  const objective = { id: 'hero-target', type: 'hero_upgrade', target: 1, progress: 0, seed: 1, heroId: 'fara', heroName: 'Fara' };
  const roster = [heroes[0], { ...heroes[1], currentLevel: 1 }];
  const initial = createCombatProgressionState({ objective, wallet: { ticketsByHero: { fara: 100 } } });
  const wrongHero = recordCombatObjectiveEvent(initial, { id: 'hondo-level-up', type: 'hero_upgrade', heroId: 'hondo' }, roster, 1000);
  assert.equal(wrongHero.state.objective.progress, 0);
  assert.equal(wrongHero.receipt, null);
  assert.equal(wrongHero.state.wallet.ticketsByHero.fara, 100);
  assert.equal(wrongHero.state.rewardReceipts.length, 0);

  const reserved = spendHeroTickets(wrongHero.state, 'fara', roster[1], 'fara-level-up');
  assert.equal(reserved.ok, true);
  const matchingHero = settleHeroTicketSpend(reserved.state, 'fara-level-up', roster, 2000);
  assert.equal(matchingHero.receipt, null);
  assert.equal(matchingHero.state.objective.progress, 1);
  assert.equal(matchingHero.state.cursor, 0);
  const claim = claimCombatObjectiveReward(matchingHero.state, matchingHero.state.objective.id, roster, 3000);
  assert.equal(claim.receipt.heroId, 'fara');
  assert.equal(claim.receipt.heroName, 'Fara');
  assert.equal(claim.state.wallet.ticketsByHero.fara, 5);
  assert.equal(claim.state.wallet.ticketsByHero.hondo || 0, 0);
  assert.equal(claim.state.lastReward.heroId, 'fara');
});

test('each objective pays one deterministic multi-item reward to its displayed resource', () => {
  const payouts = { enemy_defeat: ['incense', 5], wave_clear: ['incense', 5], gear_collect: ['essence', 2], training_upgrade: ['hero_ticket', 5], hero_upgrade: ['hero_ticket', 5] };
  const eligible = [{ ...heroes[0], kind: 'hero' }];
  for (const [type, [resource, amount]] of Object.entries(payouts)) {
    const base = createCombatProgressionState({ seed: 77, cursor: type === 'wave_clear' ? 2 : 0, wallet: { incense: 100, ticketsByHero: { hondo: 100 } }, objective: { id: `fixed-${type}`, type, target: 1, progress: 0, seed: 77, heroId: 'hondo', heroName: 'Hondo', rewardHeroName: 'Hondo' } });
    const progress = recordCombatObjectiveEvent(base, { id: `event-${type}`, type, ...(type === 'hero_upgrade' ? { heroId: 'hondo' } : {}) }, eligible, 1000);
    assert.equal(progress.receipt, null);
    assert.equal(progress.state.rewardReceipts.length, 0);
    const ready = recordCombatObjectiveEvent(progress.state, { id: `event-again-${type}`, type, ...(type === 'hero_upgrade' ? { heroId: 'hondo' } : {}) }, eligible, 1000);
    assert.equal(ready.state.objective.progress, 1);
    assert.equal(ready.state.cursor, base.cursor);
    assert.equal(ready.state.rewardReceipts.length, 0);
    const result = claimCombatObjectiveReward(ready.state, ready.state.objective.id, eligible, 1000);
    assert.equal(result.ok, true);
    assert.deepEqual(result.receipt, { id: `cot-reward:fixed-${type}`, resource, amount, ...(resource === 'hero_ticket' ? { heroId: 'hondo', heroName: 'Hondo' } : {}) });
    assert.equal(result.state.lastReward.icon, resource);
    assert.equal(result.state.lastReward.count, amount);
    assert.ok(amount > 1);
    assert.equal(result.state.wallet.incense, 100 + (resource === 'incense' ? amount : 0));
    if (resource === 'hero_ticket') { assert.equal(result.state.wallet.ticketsByHero.hondo, 100 + amount); assert.equal(result.state.lastReward.heroId, 'hondo'); }
  }
});

test('objective events persist readiness; explicit claim settles one bundled reward across reload', () => {
  let state = ensureCombatObjective(createCombatProgressionState({ seed: 99, objective: { id: 'fixed-gear', type: 'gear_collect', target: 1, progress: 0, seed: 99 } }));
  const objective = { ...state.objective };
  let finalId = '';
  for (let index = 0; index < objective.target; index += 1) {
    finalId = `event-${index}`;
    const result = recordCombatObjectiveEvent(state, { id: finalId, type: objective.type }, heroes, 1000 + index);
    state = result.state;
    assert.equal(result.receipt, null);
  }
  assert.equal(state.cursor, 0);
  assert.equal(state.objective.progress, state.objective.target);
  assert.equal(state.rewardReceipts.length, 0);
  const claim = claimCombatObjectiveReward(state, objective.id, heroes, 2000);
  assert.equal(claim.ok, true);
  state = claim.state;
  assert.equal(state.rewardReceipts.length, 1);
  assert.deepEqual(state.rewardReceipts[0], { id: `cot-reward:${objective.id}`, resource: 'essence', amount: 2 });
  assert.equal(state.wallet.incense, 0);
  const reloaded = createCombatProgressionState(state);
  const duplicate = recordCombatObjectiveEvent(reloaded, { id: finalId, type: objective.type }, heroes, 2000);
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.state.wallet.incense, 0);
  assert.equal(duplicate.state.rewardReceipts.length, 1);
});

test('claim requires ready state and expected objective ID', () => {
  const state = createCombatProgressionState({ objective: { id: 'claim-ready', type: 'enemy_defeat', target: 2, progress: 1, seed: 1 } });
  const notReady = claimCombatObjectiveReward(state, 'claim-ready', heroes, 1000);
  assert.equal(notReady.ok, false);
  assert.equal(notReady.reason, 'not_ready');
  assert.equal(notReady.state.objective.progress, 1);
  assert.equal(notReady.state.cursor, 0);
  assert.equal(notReady.state.rewardReceipts.length, 0);
  const ready = recordCombatObjectiveEvent(notReady.state, { id: 'last-defeat', type: 'enemy_defeat' }, heroes, 2000).state;
  const stale = claimCombatObjectiveReward(ready, 'old-id', heroes, 3000);
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, 'stale_objective');
  assert.equal(stale.state.objective.progress, 2);
  assert.equal(stale.state.rewardReceipts.length, 0);
  const claimed = claimCombatObjectiveReward(ready, 'claim-ready', heroes, 4000);
  assert.equal(claimed.ok, true);
  assert.equal(claimed.state.rewardReceipts.length, 1);
  assert.equal(claimCombatObjectiveReward(claimed.state, 'claim-ready', heroes).reason, 'stale_objective');
});

test('failed claim keeps ready objective through reload and a later click pays once', () => {
  const storage = new MemoryStorage();
  storage.setItem(COMBAT_PROGRESSION_SAVE_KEY, JSON.stringify({ objective: { id: 'retry-claim', type: 'enemy_defeat', target: 2, progress: 0, seed: 4 } }));
  let progression = createCombatProgression({ globals: {}, storage, getHeroes: () => heroes, reportError: () => {} });
  progression.record({ id: 'retry-1', type: 'enemy_defeat' });
  progression.record({ id: 'retry-2', type: 'enemy_defeat' });
  storage.failKey = COMBAT_PROGRESSION_SAVE_KEY;
  const failed = progression.claimObjective('retry-claim');
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'save_failed');
  assert.equal(progression.state().objective.progress, 2);
  assert.equal(progression.state().cursor, 0);
  assert.equal(progression.state().rewardReceipts.length, 0);

  storage.failKey = null;
  progression = createCombatProgression({ globals: {}, storage, getHeroes: () => heroes });
  assert.equal(progression.state().objective.progress, 2);
  assert.equal(progression.claimObjective('retry-claim').ok, true);
  assert.equal(progression.state().wallet.incense, 5);
  assert.equal(progression.state().rewardReceipts.length, 1);
  assert.equal(progression.claimObjective('retry-claim').reason, 'stale_objective');
  assert.equal(progression.state().wallet.incense, 5);
  assert.equal(progression.state().rewardReceipts.length, 1);
});

test('COT opens a timed receipt only after a successful saved claim', () => {
  const readySnapshot = { objective: { id: 'visible-claim', type: 'hero_upgrade', target: 1, progress: 1, seed: 4, heroId: 'hondo', heroName: 'Hondo' } };
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) };
  const shown = [];
  const present = (surface, receipt, title, durationMs) => shown.push({ surface, receipt, title, durationMs });
  const successStorage = new MemoryStorage();
  successStorage.setItem(COMBAT_PROGRESSION_SAVE_KEY, JSON.stringify(readySnapshot));
  const success = createCombatProgression({ globals: {}, storage: successStorage, getHeroes: () => heroes });
  const claimed = claimObjectiveWithReceipt(id => success.claimObjective(id), 'visible-claim', canvas, present);
  assert.equal(claimed.ok, true);
  assert.deepEqual(shown, [{ surface: canvas, receipt: { id: 'cot-reward:visible-claim', resource: 'hero_ticket', amount: 5, heroId: 'hondo', heroName: 'Hondo' }, title: 'Reward Obtained', durationMs: 1500 }]);

  const failedStorage = new MemoryStorage();
  failedStorage.setItem(COMBAT_PROGRESSION_SAVE_KEY, JSON.stringify(readySnapshot));
  const failed = createCombatProgression({ globals: {}, storage: failedStorage, getHeroes: () => heroes, reportError: () => {} });
  failedStorage.failKey = COMBAT_PROGRESSION_SAVE_KEY;
  const rejected = claimObjectiveWithReceipt(id => failed.claimObjective(id), 'visible-claim', canvas, present);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'save_failed');
  assert.equal(shown.length, 1, 'failed claims do not open or queue reward modals');
  assert.equal(failed.state().objective.progress, 1);
  assert.equal(failed.state().rewardReceipts.length, 0);
});

test('training spends Incense atomically and applies permanent bonuses to each hero stat path', () => {
  const initial = createCombatProgressionState({ wallet: { incense: 19 } });
  assert.equal(trainingCost(initial, 'ATK'), 20);
  assert.equal(purchasePartyTraining(initial, 'ATK').reason, 'insufficient_incense');
  const purchased = purchasePartyTraining({ ...initial, wallet: { incense: 20 } }, 'MATK');
  assert.equal(purchased.ok, true);
  assert.equal(purchased.state.wallet.incense, 0);
  assert.equal(purchased.state.training.MATK, 1);
  assert.equal(initial.wallet.incense, 19);

  const globals = { PartyTrainingLevels: { ATK: 1, DEF: 1, MATK: 1, RES: 1 } };
  for (const stat of ['ATK', 'DEF', 'MAG', 'RES']) {
    const actors = heroes.map(hero => ({ ...hero, stats: { [stat]: 100 } }));
    for (const actor of actors) assert.ok(partyTrainingCombatStat(globals, actor, stat, 100) > 100);
    assert.equal(realtimeCombatStat(globals, actors[0], stat, 100), partyTrainingCombatStat(globals, actors[0], stat, 100));
    assert.equal(actors[0].stats[stat], 100);
  }
  assert.equal(partyTrainingCombatStat(globals, { kind: 'enemy' }, 'ATK', 100), 100);
});

test('hero ticket purchases reserve per-hero balance, level through awardHeroEXP, and enforce the hero cap', () => {
  const hero = { ...newHeroProgress('Hondo', 'hondo'), kind: 'hero' };
  const initial = createCombatProgressionState({ wallet: { ticketsByHero: { hondo: 100 } }, objective: { id: 'last-ticket-level', type: 'hero_upgrade', target: 1, progress: 0, seed: 2, heroId: 'hondo', heroName: 'Hondo' } });
  assert.equal(heroTicketLevelCost(1), 100);
  assert.equal(heroTicketLevelCost(2), 150);
  const insufficient = spendHeroTickets({ ...initial, wallet: { ticketsByHero: { hondo: 99 } } }, 'hondo', hero, 'spend-no');
  assert.equal(insufficient.ok, false);
  assert.equal(insufficient.state.wallet.ticketsByHero.hondo, 99);
  const store = createHeroProgressStore(); store.heroes.hondo = hero;
  const storage = new MemoryStorage();
  storage.setItem('orka.combat_progression.v1', JSON.stringify(initial));
  const globals = { HeroProgress: store };
  const progression = createCombatProgression({
    globals, storage, getHeroes: () => [hero], persistHeroProgress: () => true, now: () => 1000,
  });
  const result = progression.spendLevelUp('hondo');
  assert.equal(result.ok, true);
  assert.equal(result.cost, 100);
  assert.equal(hero.currentLevel, 2);
  assert.equal(progression.ticketCount('hondo'), 0);
  assert.ok(progression.state().processedEvents.some(id => id.startsWith('ticket-level-up:')));
  assert.equal(progression.state().objective.progress, 1);
  assert.equal(progression.state().rewardReceipts.length, 0);
  assert.equal(progression.claimObjective('last-ticket-level').ok, true);
  assert.equal(progression.ticketCount('hondo'), 5);
  assert.ok(progression.state().rewardReceipts.some(receipt => receipt.id === 'cot-reward:last-ticket-level'));
  assert.equal(store.settledTicketSpends.length, 1);
  assert.equal(progression.spendLevelUp('hondo').reason, 'insufficient_tickets');
  const cappedHero = { ...hero, currentLevel: hero.maxLevel };
  assert.equal(spendHeroTickets(progression.state(), 'hondo', cappedHero, 'spend-cap').reason, 'max_level');
});

test('pending ticket settlement reloads idempotently after HeroProgress receipt save', () => {
  const hero = { ...newHeroProgress('Hondo', 'hondo'), kind: 'hero' };
  const store = createHeroProgressStore(); store.heroes.hondo = hero;
  const reserved = spendHeroTickets(createCombatProgressionState({ wallet: { ticketsByHero: { hondo: 100 } } }), 'hondo', hero, 'spend-reload');
  assert.equal(reserved.ok, true);
  awardHeroEXP(hero, 100); saveHeroProgress(hero, store); store.settledTicketSpends.push('spend-reload');
  const storage = new MemoryStorage(); storage.setItem('orka.combat_progression.v1', JSON.stringify(reserved.state));
  const progression = createCombatProgression({ globals: { HeroProgress: store }, storage, getHeroes: () => [hero], persistHeroProgress: () => true, now: () => 2000 });
  progression.reconcileTicketSpends();
  assert.equal(hero.currentLevel, 2);
  assert.equal(progression.state().wallet.ticketsByHero.hondo, 0);
  assert.deepEqual(progression.state().pendingTicketSpends, {});
  assert.ok(progression.state().processedEvents.includes('ticket-level-up:spend-reload'));
});

test('saved Essence reward receipt prevents duplicate wallet payment across service reload', async () => {
  const storage = new MemoryStorage();
  storage.setItem('orka.combat_progression.v1', JSON.stringify({ seed: 99, objective: { id: 'fixed-gear', type: 'gear_collect', target: 1, progress: 0, seed: 99 } }));
  const globals = { goldTotal: 0, HeroProgress: { heroes: {} } };
  const equipment = createEquipmentStorage({ globals, storage, getActors: () => [], locks: { request: async (_key, callback) => callback() }, seed: () => 1, now: () => 1000 });
  const progression = createCombatProgression({ globals, storage, equipmentProgress: equipment, getHeroes: () => heroes, now: () => 1000 });
  const objective = { ...progression.state().objective };
  for (let index = 0; index < objective.target; index += 1) progression.record({ id: `settle-${index}`, type: objective.type });
  assert.equal(progression.state().objective.progress, objective.target);
  assert.equal(progression.state().rewardReceipts.length, 0);
  assert.equal(globals.Equipment, undefined);
  assert.equal(progression.claimObjective(objective.id).ok, true);
  await progression.sync();
  assert.equal(globals.Equipment.lamp.essence, 2);
  const savedWallet = progression.state().wallet;
  const savedReceipts = progression.state().rewardReceipts.length;
  const reloaded = createCombatProgression({ globals, storage, equipmentProgress: equipment, getHeroes: () => heroes, now: () => 2000 });
  const writesBeforeDuplicateSync = storage.writes;
  await reloaded.sync();
  assert.equal(storage.writes, writesBeforeDuplicateSync);
  assert.equal(globals.Equipment.lamp.essence, 2);
  assert.equal(reloaded.state().wallet.incense, savedWallet.incense);
  assert.equal(reloaded.state().rewardReceipts.length, savedReceipts);
});

test('training purchase and matching COT event use one durable write', () => {
  const storage = new MemoryStorage();
  storage.setItem('orka.combat_progression.v1', JSON.stringify({ wallet: { incense: 20 }, objective: { id: 'train-once', type: 'training_upgrade', target: 1, progress: 0, seed: 1, heroId: 'hondo', rewardHeroName: 'Hondo' } }));
  const globals = { HeroProgress: { heroes: {} } };
  const progression = createCombatProgression({ globals, storage, getHeroes: () => heroes, now: () => 1000 });
  storage.writes = 0;
  const result = progression.train('ATK');
  assert.equal(result.ok, true);
  assert.equal(storage.writes, 1);
  assert.equal(progression.state().wallet.incense, 0);
  assert.equal(progression.state().training.ATK, 1);
  assert.equal(progression.state().objective.progress, 1);
  assert.equal(progression.state().wallet.ticketsByHero.hondo, undefined);
  assert.ok(progression.state().processedEvents.includes('training:0:ATK:1'));
  assert.equal(progression.claimObjective('train-once').ok, true);
  assert.equal(progression.state().wallet.ticketsByHero.hondo, 5);

  const saved = JSON.stringify({ wallet: { incense: 20 }, objective: { id: 'train-fail', type: 'training_upgrade', target: 1, progress: 0, seed: 1, heroId: 'hondo', rewardHeroName: 'Hondo' } });
  const failingStorage = { getItem: () => saved, setItem: () => { throw Error('disk full'); } };
  const failed = createCombatProgression({ globals: { HeroProgress: { heroes: {} } }, storage: failingStorage, getHeroes: () => heroes, reportError: () => {} });
  assert.equal(failed.train('ATK').reason, 'save_failed');
  assert.equal(failed.state().wallet.incense, 20);
  assert.equal(failed.state().training.ATK, 0);
});

test('accepted lethal receipts advance and notify COT progress before visual death removal', () => {
  const storage = new MemoryStorage();
  storage.setItem(COMBAT_PROGRESSION_SAVE_KEY, JSON.stringify({ objective: { id: 'three-defeats', type: 'enemy_defeat', target: 3, progress: 0, seed: 1 } }));
  const errors = [];
  const progression = createCombatProgression({ globals: {}, storage, getHeroes: () => heroes, reportError: (...args) => errors.push(args) });
  const notifications = [];
  progression.subscribe(reason => notifications.push(reason));
  const battle = { id: 'saved-battle', defeated: {} };

  storage.failKey = COMBAT_PROGRESSION_SAVE_KEY;
  battle.defeated['enemy-1'] = true;
  assert.equal(progression.recordCommittedEnemyDefeats(battle), 0);
  assert.equal(progression.state().objective.progress, 0);
  assert.equal(errors.length, 1);
  storage.failKey = null;

  assert.equal(progression.recordCommittedEnemyDefeats(battle), 1);
  assert.equal(combatObjectivePresentation(progression.state().objective).count, '1/3');
  battle.defeated['enemy-2'] = true;
  assert.equal(progression.recordCommittedEnemyDefeats(battle), 1);
  assert.equal(combatObjectivePresentation(progression.state().objective).count, '2/3');
  assert.deepEqual(notifications, ['progress', 'progress']);
  battle.defeated['enemy-3'] = true;
  assert.equal(progression.recordCommittedEnemyDefeats(battle), 1);
  assert.equal(progression.state().objective.progress, 3);
  assert.equal(progression.state().rewardReceipts.length, 0);
  assert.equal(progression.state().objective.id, 'three-defeats');
  assert.deepEqual(notifications, ['progress', 'progress', 'progress']);
  assert.equal(progression.claimObjective('three-defeats').ok, true);
  assert.equal(progression.state().rewardReceipts.length, 1);
  assert.deepEqual(notifications, ['progress', 'progress', 'progress', 'reward']);

  const reloaded = createCombatProgression({ globals: {}, storage, getHeroes: () => heroes });
  reloaded.recordCommittedEnemyDefeats(battle);
  assert.equal(reloaded.state().rewardReceipts.length, 1);
  assert.deepEqual(reloaded.state().processedEvents.filter(id => id.startsWith('enemy:saved-battle:')), ['enemy:saved-battle:enemy-1', 'enemy:saved-battle:enemy-2', 'enemy:saved-battle:enemy-3']);
});

test('manual gear collection records the committed event and settles its Essence payout', async () => {
  const storage = new MemoryStorage();
  storage.setItem('orka.combat_progression.v1', JSON.stringify({ seed: 12, objective: { id: 'collect-gear', type: 'gear_collect', target: 1, progress: 0, seed: 12 } }));
  const globals = { goldTotal: 0, HeroProgress: { heroes: {} } };
  let progression;
  const equipment = createEquipmentStorage({
    globals, storage, getActors: () => [], locks: { request: async (_key, callback) => callback() },
    seed: () => 1, now: () => 100000,
    onGearCollected: result => progression.record({ id: `gear:${result.item.instanceId}`, type: 'gear_collect' }),
  });
  progression = createCombatProgression({ globals, storage, equipmentProgress: equipment, now: () => 100000 });
  const emission = await equipment.tickConveyor({}, () => true, { deferCollection: true });
  const collected = await equipment.collect(emission.instanceId);
  assert.equal(collected.saved, true);
  assert.equal(progression.state().objective.progress, 1);
  assert.equal(progression.state().rewardReceipts.length, 0);
  assert.equal(globals.Equipment.lamp.essence, 0);
  assert.equal(progression.claimObjective('collect-gear').ok, true);
  await progression.sync();
  assert.equal(progression.state().rewardReceipts[0].resource, 'essence');
  assert.equal(globals.Equipment.lamp.essence, 2);
});

test('automatic gear collection retries a failed COT save after service reload', async () => {
  const storage = new MemoryStorage();
  storage.setItem(COMBAT_PROGRESSION_SAVE_KEY, JSON.stringify({ seed: 12, objective: { id: 'collect-auto-gear', type: 'gear_collect', target: 2, progress: 0, seed: 12 } }));
  const globals = { goldTotal: 0, HeroProgress: { heroes: {} } };
  let progression;
  let clock = 100000;
  const equipmentOptions = { globals, storage, getActors: () => [], locks: { request: async (_key, callback) => callback() }, seed: () => 1, now: () => clock, reportError: () => {}, onGearCollected: result => progression.record({ id: `gear:${result.item.instanceId}`, type: 'gear_collect' }) };
  let equipment = createEquipmentStorage(equipmentOptions);
  progression = createCombatProgression({ globals, storage, equipmentProgress: equipment, getHeroes: () => heroes, now: () => clock, reportError: () => {} });
  const emission = await equipment.tickConveyor({}, () => true, { deferCollection: true });
  clock += 16000;
  storage.failKey = COMBAT_PROGRESSION_SAVE_KEY;
  const collected = await equipment.collectAvailable([emission.instanceId]);
  assert.equal(collected[0].saved, true);
  assert.equal(equipment.data.pendingGearCollections[0].id, emission.instanceId);
  assert.equal(progression.state().rewardReceipts.length, 0);

  storage.failKey = null;
  equipment = createEquipmentStorage(equipmentOptions);
  progression = createCombatProgression({ globals, storage, equipmentProgress: equipment, getHeroes: () => heroes, now: () => clock, reportError: () => {} });
  await equipment.sync();
  await progression.sync();
  assert.deepEqual(equipment.data.pendingGearCollections, []);
  assert.ok(progression.state().processedEvents.includes(`gear:${emission.instanceId}`));
  assert.equal(combatObjectivePresentation(progression.state().objective).count, '1/2');
  assert.equal(progression.state().rewardReceipts.length, 0);
  assert.equal(globals.Equipment.lamp.essence, 0);

  clock += 16000;
  const nextEmission = await equipment.tickConveyor({}, () => true, { deferCollection: true });
  assert.ok(nextEmission);
  const nextCollection = await equipment.collectAvailable([nextEmission.instanceId]);
  assert.equal(nextCollection[0].saved, true);
  assert.equal(combatObjectivePresentation(progression.state().objective).count, '2/2');
  assert.equal(progression.state().rewardReceipts.length, 0);
  assert.equal(progression.claimObjective('collect-auto-gear').ok, true);
  await progression.sync();
  assert.equal(progression.state().rewardReceipts.length, 1);
  assert.equal(globals.Equipment.lamp.essence, 2);
});

test('wave clear identities remain unique across repeated region-sized cycles', () => {
  let state = createCombatProgressionState({ cursor: 2, objective: { id: 'first-wave', type: 'wave_clear', target: 1, progress: 0, seed: 1 } });
  const ids = [];
  for (let transitions = 0; transitions < 20; transitions += 1) {
    const eventId = continuousCombatWaveClearEventId({ region: 1, stage: 1, wave: transitions % 10 + 1, bossActive: false, transitions });
    ids.push(eventId);
    state.objective = { id: `wave-${transitions}`, type: 'wave_clear', target: 1, progress: 0, seed: transitions + 1 };
    const result = recordCombatObjectiveEvent(state, { id: eventId, type: 'wave_clear' }, heroes, transitions);
    state = result.state;
    assert.equal(result.receipt, null);
    assert.equal(state.objective.progress, 1);
    assert.equal(state.cursor, transitions + 2);
    state = claimCombatObjectiveReward(state, state.objective.id, heroes, transitions).state;
  }
  assert.equal(new Set(ids).size, 20);
  assert.ok(ids[0].endsWith('-0-1-wave'));
  assert.ok(ids[10].endsWith('-10-1-wave'));
  assert.equal(state.processedEvents.length, 20);
});

test('COT UI exposes a claim action only for ready objectives and uses the two-row ticket sheet crop', () => {
  const ui = readFileSync(new URL('../web-runner/systems/combatProgressionUI.mjs', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../web-runner/app.js', import.meta.url), 'utf8');
  const tickets = readFileSync(new URL('../web-runner/assets/images/progression/hero-tickets.png', import.meta.url));
  assert.equal(tickets.readUInt32BE(16), 1536);
  assert.equal(tickets.readUInt32BE(20), 1024);
  assert.match(ui, /background-size:200% 200%/);
  assert.match(ui, /objective\.dataset\.ready = String\(ready\)/);
  assert.match(ui, /if \(!readyClaimId \|\| \(event\.key !== 'Enter' && event\.key !== ' '\)\) return/);
  assert.match(ui, /if \(readyClaimId\) claimObjectiveWithReceipt\(onClaim, readyClaimId, canvas\)/);
  assert.match(ui, /if \(result\?\.ok && result\.receipt\) present\(canvas, result\.receipt, 'Reward Obtained', 1500\)/);
  assert.match(app, /onClaim: objectiveId => combatProgression\.claimObjective\(objectiveId\)/);
});
