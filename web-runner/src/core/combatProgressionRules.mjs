export const COMBAT_PROGRESSION_VERSION = 1;
export const COMBAT_PROGRESSION_SAVE_KEY = 'orka.combat_progression.v1';
export const TRAINING_STATS = Object.freeze(['ATK', 'DEF', 'MATK', 'RES']);
export const TRAINING_COST_BASE = 20;
export const TRAINING_COST_STEP = 10;
export const TRAINING_BONUS_PER_LEVEL = 0.02;
export const HERO_TICKET_REWARD = 5;
export const HERO_TICKET_LEVEL_COST_BASE = 100;
export const HERO_TICKET_LEVEL_COST_STEP = 50;
export const COMBAT_REWARD_BUNDLES = Object.freeze({
  enemy_defeat: Object.freeze({ resource: 'incense', amount: 5 }),
  wave_clear: Object.freeze({ resource: 'incense', amount: 5 }),
  gear_collect: Object.freeze({ resource: 'essence', amount: 2 }),
  training_upgrade: Object.freeze({ resource: 'hero_ticket', amount: HERO_TICKET_REWARD }),
  hero_upgrade: Object.freeze({ resource: 'hero_ticket', amount: HERO_TICKET_REWARD }),
});

const OBJECTIVE_TYPES = Object.freeze(['enemy_defeat', 'wave_clear', 'gear_collect', 'training_upgrade', 'hero_upgrade']);
const clampCount = value => Number.isSafeInteger(value) && value > 0 ? Math.min(value, 1000000000) : 0;
const safeId = value => typeof value === 'string' && value.length <= 180 && !['__proto__', 'constructor', 'prototype'].includes(value) ? value : '';

export function createCombatProgressionState(snapshot, seed = 0x43544f) {
  const raw = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : {};
  const objectiveTarget = raw.objective && OBJECTIVE_TYPES.includes(raw.objective.type)
    ? Math.max(1, Math.min(20, Math.floor(Number(raw.objective.target) || 1))) : 1;
  const objective = raw.objective && OBJECTIVE_TYPES.includes(raw.objective.type) ? {
    id: safeId(raw.objective.id), type: raw.objective.type,
    target: objectiveTarget,
    progress: Math.max(0, Math.min(objectiveTarget, Math.floor(Number(raw.objective.progress) || 0))),
    seed: Number(raw.objective.seed) >>> 0,
    ...(raw.objective.heroId ? { heroId: safeId(raw.objective.heroId) } : {}),
    ...(raw.objective.type === 'hero_upgrade' && raw.objective.heroName ? { heroName: String(raw.objective.heroName).slice(0, 32) } : {}),
    ...(raw.objective.type === 'training_upgrade' && raw.objective.rewardHeroName ? { rewardHeroName: String(raw.objective.rewardHeroName).slice(0, 32) } : {}),
  } : null;
  return {
    version: COMBAT_PROGRESSION_VERSION,
    seed: Number.isSafeInteger(raw.seed) ? raw.seed >>> 0 : Number(seed) >>> 0,
    cursor: Math.max(0, Math.floor(Number(raw.cursor) || 0)),
    objective,
    wallet: { incense: clampCount(raw.wallet?.incense), ticketsByHero: Object.fromEntries(Object.entries(raw.wallet?.ticketsByHero || {}).map(([id, amount]) => [safeId(id), clampCount(amount)]).filter(([id]) => id)) },
    training: Object.fromEntries(TRAINING_STATS.map(stat => [stat, Math.max(0, Math.min(100, Math.floor(Number(raw.training?.[stat]) || 0)))])),
    processedEvents: Array.isArray(raw.processedEvents) ? [...new Set(raw.processedEvents.map(safeId).filter(Boolean))].slice(-512) : [],
    pendingTicketSpends: Object.fromEntries(Object.entries(raw.pendingTicketSpends || {}).filter(([id, row]) => safeId(id) && row && safeId(row.heroId) && clampCount(row.cost) > 0).map(([id, row]) => [id, { id, heroId: safeId(row.heroId), cost: clampCount(row.cost), fromLevel: Math.max(1, Math.floor(Number(row.fromLevel) || 1)) }])),
    rewardReceipts: Array.isArray(raw.rewardReceipts) ? raw.rewardReceipts.filter(row => row && safeId(row.id)).slice(-256).map(row => {
      const resource = ['essence', 'hero_ticket'].includes(row.resource) ? row.resource : (!row.resource && clampCount(row.essence) > 0) ? 'essence' : 'incense';
      return { id: safeId(row.id), resource, amount: clampCount(row.amount ?? (resource === 'essence' ? row.essence : row.incense)), ...(resource === 'hero_ticket' ? { heroId: safeId(row.heroId), heroName: String(row.heroName || '').slice(0, 32) } : {}) };
    }) : [],
    lastReward: raw.lastReward && typeof raw.lastReward === 'object' ? {
      label: String(raw.lastReward.label || '').slice(0, 48), icon: ['essence', 'hero_ticket'].includes(raw.lastReward.icon) ? raw.lastReward.icon : 'incense',
      count: clampCount(raw.lastReward.count), shownAt: Math.max(0, Number(raw.lastReward.shownAt) || 0), receiptId: safeId(raw.lastReward.receiptId),
      ...(raw.lastReward.heroId ? { heroId: safeId(raw.lastReward.heroId), heroName: String(raw.lastReward.heroName || '').slice(0, 32) } : {}),
    } : null,
  };
}

function nextRandom(state) {
  let seed = (state.seed || 0x9e3779b9) >>> 0;
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  state.seed = seed >>> 0;
  return state.seed;
}

function openingObjective(cursor, seed) {
  const type = cursor === 0 ? 'gear_collect' : 'enemy_defeat';
  return { id: `cot-opening-${cursor}-${seed.toString(16)}`, type, target: cursor === 0 ? 1 : 3, progress: 0, seed };
}

export function eligibleTicketHeroes(heroes = []) {
  return heroes.filter(hero => hero?.kind === 'hero' && typeof hero.heroInstanceKey === 'string' && Number(hero.currentLevel) < Number(hero.maxLevel))
    .map(hero => ({ id: safeId(hero.heroInstanceKey), name: String(hero.baseHeroName || hero.name || '').slice(0, 32) }))
    .filter(hero => hero.id && hero.name).sort((a, b) => a.id.localeCompare(b.id));
}

export function eligibleHeroUpgradeTargets(state, heroes = []) {
  return eligibleTicketHeroes(heroes).filter(hero => (state.wallet.ticketsByHero[hero.id] || 0) >= heroTicketLevelCost(heroes.find(candidate => candidate.heroInstanceKey === hero.id)?.currentLevel));
}

export function ensureCombatObjective(state, heroes = []) {
  const next = createCombatProgressionState(state);
  if (next.objective && next.objective.progress >= next.objective.target) return next;
  const canTrain = TRAINING_STATS.some(stat => next.training[stat] < 100 && trainingCost(next, stat) <= next.wallet.incense);
  if (next.cursor < 2 && next.objective?.type === 'wave_clear') {
    next.objective = openingObjective(next.cursor, next.seed);
    return next;
  }
  if (next.cursor < 2 && !next.objective) {
    next.objective = openingObjective(next.cursor, next.seed);
    return next;
  }
  if (next.objective) {
    if (next.objective.type === 'training_upgrade' && !canTrain) next.objective = null;
  }
  if (next.objective) {
    if (['training_upgrade', 'hero_upgrade'].includes(next.objective.type)) {
      if (next.objective.heroId) {
        if (next.objective.type === 'training_upgrade') {
          delete next.objective.heroName;
          next.objective.rewardHeroName ||= eligibleTicketHeroes(heroes).find(hero => hero.id === next.objective.heroId)?.name || '';
          return next;
        }
        const pendingSpend = Object.values(next.pendingTicketSpends).some(spend => spend.heroId === next.objective.heroId);
        const readyHero = eligibleHeroUpgradeTargets(next, heroes).find(hero => hero.id === next.objective.heroId);
        if (pendingSpend || readyHero) {
          if (!next.objective.heroName) next.objective.heroName = eligibleTicketHeroes(heroes).find(hero => hero.id === next.objective.heroId)?.name || '';
          return next;
        }
        delete next.objective.heroId;
        delete next.objective.heroName;
      }
      const eligible = eligibleTicketHeroes(heroes);
      const ready = eligibleHeroUpgradeTargets(next, heroes);
      const recipients = next.objective.type === 'hero_upgrade' ? ready : eligible;
      const recipient = recipients[next.cursor % recipients.length];
      if (!recipient) next.objective = null;
      else {
        next.objective.heroId = recipient.id;
        if (next.objective.type === 'hero_upgrade') next.objective.heroName ||= recipient.name;
        else { delete next.objective.heroName; next.objective.rewardHeroName ||= recipient.name; }
      }
    }
    if (next.objective) return next;
  }
  const roll = nextRandom(next);
  const eligible = eligibleTicketHeroes(heroes);
  const ready = eligibleHeroUpgradeTargets(next, heroes);
  const candidates = OBJECTIVE_TYPES.filter(type => type !== 'wave_clear' && (type !== 'training_upgrade' && type !== 'hero_upgrade' || (type === 'training_upgrade' ? eligible.length > 0 && canTrain : ready.length > 0)));
  const type = candidates[(next.cursor + (roll % candidates.length)) % candidates.length];
  const target = type === 'enemy_defeat' ? 3 + (roll % 3) : 1;
  const recipients = type === 'hero_upgrade' ? ready : eligible;
  const hero = ['hero_upgrade', 'training_upgrade'].includes(type) ? recipients[next.cursor % recipients.length] : null;
  next.objective = { id: `cot-${next.cursor}-${next.seed.toString(16)}`, type, target, progress: 0, seed: next.seed, ...(hero ? { heroId: hero.id } : {}), ...(hero && type === 'hero_upgrade' ? { heroName: hero.name } : {}), ...(hero && type === 'training_upgrade' ? { rewardHeroName: hero.name } : {}) };
  return next;
}

export function combatObjectivePresentation(objective) {
  if (!objective) return { category: 'Ready', challenge: 'Complete a combat action', count: '0/1' };
  const labels = {
    enemy_defeat: ['Battle', 'Defeat enemies'], wave_clear: ['Advance', 'Clear a wave'],
    gear_collect: ['Supplies', 'Collect equipment'], training_upgrade: ['Training', 'Train a party stat'], hero_upgrade: ['Level Up', 'Level up a hero'],
  };
  const [category, baseChallenge] = labels[objective.type] || labels.enemy_defeat;
  const challenge = objective.type === 'hero_upgrade' && objective.heroName ? `${baseChallenge}: ${objective.heroName}` : baseChallenge;
  return { category, challenge, count: `${Math.min(objective.progress, objective.target)}/${objective.target}` };
}

export function combatObjectiveReward(objective) {
  if (!objective || !OBJECTIVE_TYPES.includes(objective.type)) return null;
  const reward = COMBAT_REWARD_BUNDLES[objective.type];
  return {
    resource: reward.resource,
    amount: reward.amount,
    ...(reward.resource === 'hero_ticket' ? {
      heroId: safeId(objective.heroId),
      heroName: String((objective.type === 'hero_upgrade' ? objective.heroName : objective.rewardHeroName) || '').slice(0, 32),
    } : {}),
  };
}

export function recordCombatObjectiveEvent(state, event, heroes = [], now = 0) {
  const next = ensureCombatObjective(state, heroes);
  const id = safeId(event?.id);
  if (!id || !OBJECTIVE_TYPES.includes(event?.type) || next.processedEvents.includes(id)) return { state: next, changed: false, receipt: null };
  next.processedEvents.push(id);
  next.processedEvents = next.processedEvents.slice(-512);
  if (next.objective && next.objective.progress < next.objective.target && next.objective.type === event.type && (event.type !== 'hero_upgrade' || event.heroId === next.objective.heroId)) {
    next.objective.progress = Math.min(next.objective.target, next.objective.progress + 1);
  }
  return { state: next, changed: true, receipt: null };
}

export function claimCombatObjectiveReward(state, expectedObjectiveId, heroes = [], now = 0) {
  const next = ensureCombatObjective(state, heroes);
  const objective = next.objective;
  if (!objective || objective.id !== safeId(expectedObjectiveId)) return { state: next, ok: false, reason: 'stale_objective', receipt: null };
  if (objective.progress < objective.target) return { state: next, ok: false, reason: 'not_ready', receipt: null };
  const receiptId = `cot-reward:${objective.id}`;
  if (next.rewardReceipts.some(row => row.id === receiptId)) return { state: next, ok: false, reason: 'already_claimed', receipt: null };
  const ticketRecipient = eligibleTicketHeroes(heroes).find(hero => hero.id === objective.heroId);
  const rewards = { id: receiptId, ...COMBAT_REWARD_BUNDLES[objective.type], ...(COMBAT_REWARD_BUNDLES[objective.type].resource === 'hero_ticket' ? { heroId: objective.heroId, heroName: objective.type === 'hero_upgrade' ? objective.heroName : objective.rewardHeroName || ticketRecipient?.name } : {}) };
  if (rewards.resource === 'incense') next.wallet.incense += rewards.amount;
  if (rewards.resource === 'hero_ticket' && rewards.heroId) next.wallet.ticketsByHero[rewards.heroId] = (next.wallet.ticketsByHero[rewards.heroId] || 0) + rewards.amount;
  next.rewardReceipts.push(rewards);
  next.lastReward = { label: 'Objective cleared', icon: rewards.resource, count: rewards.amount, shownAt: Math.max(0, Number(now) || 0), receiptId, ...(rewards.heroId ? { heroId: rewards.heroId, heroName: rewards.heroName } : {}) };
  next.cursor += 1;
  next.objective = null;
  return { state: ensureCombatObjective(next, heroes), ok: true, reason: null, receipt: rewards, changed: true };
}

export function heroTicketLevelCost(level) { return HERO_TICKET_LEVEL_COST_BASE + Math.max(0, Number(level) - 1) * HERO_TICKET_LEVEL_COST_STEP; }

export function spendHeroTickets(state, heroId, hero, spendId) {
  const next = createCombatProgressionState(state);
  if (!hero || hero.heroInstanceKey !== heroId) return { state: next, ok: false, reason: 'hero_unavailable' };
  if (hero.currentLevel >= hero.maxLevel) return { state: next, ok: false, reason: 'max_level' };
  const cost = heroTicketLevelCost(hero.currentLevel);
  if ((next.wallet.ticketsByHero[heroId] || 0) < cost) return { state: next, ok: false, reason: 'insufficient_tickets', cost };
  next.wallet.ticketsByHero[heroId] -= cost;
  next.pendingTicketSpends ||= {};
  next.pendingTicketSpends[spendId] = { id: spendId, heroId, cost, fromLevel: hero.currentLevel };
  return { state: next, ok: true, cost };
}

export function settleHeroTicketSpend(state, spendId, heroes, now = 0) {
  const next = createCombatProgressionState(state);
  const spend = next.pendingTicketSpends[spendId];
  if (!spend) return { state: next, changed: false, receipt: null };
  const hero = heroes.find(candidate => candidate.heroInstanceKey === spend.heroId);
  const result = recordCombatObjectiveEvent(next, { id: `ticket-level-up:${spendId}`, type: 'hero_upgrade', heroId: spend.heroId }, heroes, now);
  delete result.state.pendingTicketSpends[spendId];
  return { ...result, state: result.state, changed: true, receipt: result.receipt, hero: hero || null };
}

export function trainingCost(state, stat) {
  if (!TRAINING_STATS.includes(stat)) return 0;
  return TRAINING_COST_BASE + state.training[stat] * TRAINING_COST_STEP;
}

export function purchasePartyTraining(state, stat) {
  const next = createCombatProgressionState(state);
  if (!TRAINING_STATS.includes(stat)) return { state: next, ok: false, reason: 'invalid_stat' };
  const level = next.training[stat];
  if (level >= 100) return { state: next, ok: false, reason: 'max_level' };
  const cost = trainingCost(next, stat);
  if (next.wallet.incense < cost) return { state: next, ok: false, reason: 'insufficient_incense', cost };
  next.wallet.incense -= cost;
  next.training[stat] += 1;
  return { state: next, ok: true, stat, cost, level: next.training[stat] };
}
