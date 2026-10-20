import { observeChapterMilestones } from '../src/core/questMilestones.mjs';
import {
  COMBAT_PROGRESSION_SAVE_KEY, createCombatProgressionState, ensureCombatObjective,
  recordCombatObjectiveEvent, claimCombatObjectiveReward, purchasePartyTraining, TRAINING_STATS, eligibleTicketHeroes,
  spendHeroTickets, settleHeroTicketSpend,
} from '../src/core/combatProgressionRules.mjs';
import { PROGRESSION } from '../src/core/heroDefinitions.mjs';
import { starUpHero, setHeroResonance } from '../src/core/heroGrowthRules.mjs';
import { createHeroFormationStore } from './heroFormationStore.mjs';
import { awardHeroEXP, expToNextLevel, saveHeroProgress } from '../src/core/heroProgression.mjs';

export function createCombatProgression({ globals, storage, equipmentProgress, getHeroes = () => [], persistHeroProgress = () => false, now = () => Date.now(), reportError = console.error }) {
  let state, storageReady = true, essenceSyncPromise = null, essenceRetryAt = 0;
  const essenceSettled = new Set();
  const listeners = new Set();
  let ticketSpendSequence = 0;
  let defeatBattleId = '';
  const committedDefeats = new Set();
  try {
    state = createCombatProgressionState(JSON.parse(storage.getItem(COMBAT_PROGRESSION_SAVE_KEY) || 'null'));
  } catch (error) {
    storageReady = false;
    globals.CombatProgressionStorageError = String(error);
    state = createCombatProgressionState(null);
  }

  function applyGlobals() {
    globals.CombatProgression = state;
    globals.PartyTrainingLevels = { ...state.training };
    globals.HeroGrowth = state.growth || null;
  }
  function commit(next) {
    if (!storageReady) throw new Error('Combat progression storage is unavailable; saved data was preserved.');
    storage.setItem(COMBAT_PROGRESSION_SAVE_KEY, JSON.stringify(next));
    state = next;
    delete globals.CombatProgressionStorageError;
    applyGlobals();
  }
  const heroes = () => getHeroes().filter(hero => hero?.kind === 'hero');
  const context = () => ({ equipment: equipmentProgress?.data, chapter: globals.ContinuousCombatStage?.region });
  let observationSignature = '', observedEquipment;
  function observe() {
    const party = heroes(), stage = globals.ContinuousCombatStage;
    const signature = JSON.stringify([stage?.region, stage?.bossActive, party.map(hero => [hero.heroInstanceKey, hero.currentLevel, Number(hero.hp) <= 0]), state.cursor, state.training]);
    if (signature === observationSignature && observedEquipment === equipmentProgress?.data) return state;
    const next = ensureCombatObjective(observeChapterMilestones(createCombatProgressionState(state), party, stage), party, context());
    if (JSON.stringify(next) !== JSON.stringify(state)) {
      try { commit(next); } catch (error) { reportError('Quest milestone save failed', error); return state; }
    }
    observationSignature = signature; observedEquipment = equipmentProgress?.data;
    return state;
  }
  const ensured = ensureCombatObjective(state, heroes(), context());
  if (!storageReady) { state = ensured; applyGlobals(); }
  else if (!state.objective || JSON.stringify(ensured) !== JSON.stringify(state)) {
    try { commit(ensured); } catch (error) { globals.CombatProgressionStorageError = String(error); state = ensured; applyGlobals(); }
  } else applyGlobals();

  async function settleEssenceReceipts() {
    if (!equipmentProgress?.awardCombatEssence) return false;
    if (essenceSyncPromise) return essenceSyncPromise;
    if (now() < essenceRetryAt) return false;
    essenceSyncPromise = (async () => {
      for (const receipt of state.rewardReceipts) {
        if (receipt.resource !== 'essence' || receipt.amount <= 0 || essenceSettled.has(receipt.id)) continue;
        try {
          if (equipmentProgress.hasSettledCombatEssenceReward?.(receipt.id)) { essenceSettled.add(receipt.id); continue; }
          await equipmentProgress.awardCombatEssence(receipt.id, receipt.amount); essenceSettled.add(receipt.id);
        }
        catch (error) { essenceRetryAt = now() + 5000; reportError('COT Essence reward save failed', error); return false; }
      }
      return true;
    })().finally(() => { essenceSyncPromise = null; });
    return essenceSyncPromise;
  }
  function notify(reason) { for (const listener of listeners) listener(reason, state); }

  function persistHeroLevelSpend(spend) {
    const store = globals.HeroProgress;
    const savedHero = store?.heroes?.[spend.heroId];
    const hero = heroes().find(candidate => candidate.heroInstanceKey === spend.heroId) || savedHero;
    if (!savedHero || !hero) return false;
    store.settledTicketSpends ||= [];
    if (!store.settledTicketSpends.includes(spend.id)) {
      if (hero.currentLevel !== spend.fromLevel || hero.currentLevel >= hero.maxLevel) return false;
      const required = expToNextLevel(hero.currentLevel, { ...PROGRESSION, maxLevel: hero.maxLevel }) - hero.currentEXP;
      if (required <= 0) return false;
      const result = awardHeroEXP(hero, required);
      if (result.toLevel !== result.fromLevel + 1) return false;
      saveHeroProgress(hero, store);
      store.settledTicketSpends.push(spend.id);
      store.settledTicketSpends = store.settledTicketSpends.slice(-256);
    }
    globals.HeroProgressDirty = true;
    return persistHeroProgress();
  }

  function reconcileTicketSpends() {
    for (const spend of Object.values(state.pendingTicketSpends)) {
      if (!persistHeroLevelSpend(spend)) continue;
      const result = settleHeroTicketSpend(state, spend.id, heroes(), now());
      commit(result.state);
      if (result.receipt?.resource === 'essence') void settleEssenceReceipts();
      notify('ticket-spend');
    }
  }

  function record(event) {
    observe();
    const result = recordCombatObjectiveEvent(state, event, heroes(), now());
    if (JSON.stringify(result.state) !== JSON.stringify(state)) {
      commit(result.state);
      notify('progress');
    }
    return result;
  }

  function claimObjective(expectedObjectiveId) {
    observe();
    const result = claimCombatObjectiveReward(state, expectedObjectiveId, heroes(), now(), context());
    if (!result.ok) return result;
    try { commit(result.state); }
    catch (error) { reportError('COT reward claim save failed', error); return { ...result, ok: false, reason: 'save_failed', receipt: null }; }
    notify('reward');
    if (result.receipt?.resource === 'essence') void settleEssenceReceipts();
    return result;
  }

  function recordCommittedEnemyDefeats(battle) {
    const battleId = String(battle?.id || '');
    if (!battleId || !battle.defeated || typeof battle.defeated !== 'object') return 0;
    if (battleId !== defeatBattleId) { defeatBattleId = battleId; committedDefeats.clear(); }
    let recorded = 0;
    for (const uid of Object.keys(battle.defeated)) {
      const id = `enemy:${battleId}:${uid}`;
      if (committedDefeats.has(id)) continue;
      try {
        record({ id, type: 'enemy_defeat' });
        committedDefeats.add(id);
        recorded += 1;
      } catch (error) {
        reportError('COT enemy defeat save failed', error);
        break;
      }
    }
    return recorded;
  }

  const formation = createHeroFormationStore({ globals, storage, reportError });
  function commitGrowth(result, reason, label) {
    if (!result.ok) return result;
    try { commit(result.state); }
    catch (error) { reportError(label, error); return { ...result, ok: false, reason: 'save_failed' }; }
    notify(reason);
    return result;
  }

  return {
    state: observe,
    formation,
    heroGrowth() { return state.growth || null; },
    starUp(heroId) { return commitGrowth(starUpHero(state, heroId), 'star-up', 'Star Up save failed'); },
    setResonance(heroId, slot, linkedId) { return commitGrowth(setHeroResonance(state, heroId, slot, linkedId), 'resonance', 'Resonance save failed'); },
    observe,
    sync: settleEssenceReceipts,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    record,
    claimObjective,
    recordCommittedEnemyDefeats,
    reconcileTicketSpends,
    ticketCount(heroId) { return state.wallet.ticketsByHero[heroId] || 0; },
    spendLevelUp(heroId) {
      reconcileTicketSpends();
      const hero = globals.HeroProgress?.heroes?.[heroId];
      const spendId = `ticket-spend:${heroId}:${state.cursor}:${state.rewardReceipts.length}:${now()}:${++ticketSpendSequence}`;
      const result = spendHeroTickets(state, heroId, hero, spendId);
      if (!result.ok) return result;
      try { commit(result.state); }
      catch (error) { reportError('Hero ticket reservation save failed', error); return { ok: false, reason: 'save_failed' }; }
      if (!persistHeroLevelSpend(result.state.pendingTicketSpends[spendId])) return { ok: false, reason: 'save_failed', pending: true };
      const settled = settleHeroTicketSpend(state, spendId, heroes(), now());
      try { commit(settled.state); }
      catch (error) { reportError('Hero ticket settlement save failed', error); return { ok: false, reason: 'save_failed', pending: true }; }
      if (settled.receipt) notify('reward');
      notify('ticket-spend');
      return { ok: true, cost: result.cost, heroId, level: globals.HeroProgress.heroes[heroId].currentLevel };
    },
    train(stat) {
      if (!TRAINING_STATS.includes(stat)) return { ok: false, reason: 'invalid_stat' };
      const purchase = purchasePartyTraining(state, stat);
      if (!purchase.ok) return purchase;
      const event = recordCombatObjectiveEvent(state, { id: `training:${purchase.state.cursor}:${purchase.stat}:${purchase.level}`, type: 'training_upgrade' }, heroes(), now());
      event.state.wallet.incense = purchase.state.wallet.incense;
      event.state.training = purchase.state.training;
      const committed = ensureCombatObjective(event.state, heroes(), context());
      try { commit(committed); }
      catch (error) { reportError('Party training save failed', error); return { ok: false, reason: 'save_failed' }; }
      notify('training');
      if (event.receipt) notify('reward');
      return purchase;
    },
  };
}
