import { state } from './state.js';
import { MONSTER_KEYS, MONSTER_LOOT_TABLE, TOKEN, EMPTY } from './monsterLootTableEventTokens.js';
import { ACTIVE_EVENT_IDS, LIVE_OPS_EVENTS, TOKEN_REGISTRY } from './liveOpsTokens.js';

const POWER_AMP_OUTCOMES = [
  { key: 'HERO_2X', multiplier: 2, chance: 0.62 },
  { key: 'HERO_3X', multiplier: 3, chance: 0.34 },
  { key: 'JACKPOT_ALL_2X', multiplier: 2, chance: 0.04, jackpotAllLivingHeroes: true },
];

const ENEMY_SKILL_ASSIGNMENT_MAP = {
  Djinn: {
    specialSkill: 'Enemy_Drain_Buff',
    specialChance: 0.30,
    regularSkill: 'Enemy_MAG_Single',
    regularChance: 0.85,
    requiresDamaged: false,
  },
  Marid: {
    specialSkill: 'Enemy_X_Out',
    specialChance: 0.25,
    regularSkill: 'Enemy_MAG_Single',
    regularChance: 0.65,
    requiresDamaged: false,
  },
  Chimerilass: {
    specialSkill: 'Enemy_Wipe',
    specialChance: 0.20,
    regularSkill: 'Enemy_Heal_Self',
    regularChance: 0.49,
    requiresDamaged: true,
  },
};

function getGlobals(ctx) {
  return (ctx && ctx.state ? ctx.state.globals : state.globals);
}

function getEntities(ctx) {
  return (ctx && ctx.state ? ctx.state.entities : state.entities) || [];
}

function ensureEntities(ctx) {
  const ref = (ctx && ctx.state ? ctx.state.entities : state.entities);
  if (!ref) {
    if (ctx && ctx.state) ctx.state.entities = [];
    else state.entities = [];
  }
  return (ctx && ctx.state ? ctx.state.entities : state.entities);
}

function getGems(ctx) {
  if (ctx && typeof ctx.getGems === 'function') return ctx.getGems();
  const g = getGlobals(ctx);
  return g.Gems || [];
}

function setGems(ctx, gems) {
  if (ctx && typeof ctx.setGems === 'function') ctx.setGems(gems);
  const g = getGlobals(ctx);
  g.Gems = gems;
}

function getSelectedGemIndices(ctx) {
  if (ctx && typeof ctx.getSelectedGemIndices === 'function') return ctx.getSelectedGemIndices();
  const g = getGlobals(ctx);
  return g.SelectedGems || [];
}

function setSelectedGemIndices(ctx, arr) {
  if (ctx && typeof ctx.setSelectedGemIndices === 'function') ctx.setSelectedGemIndices(arr);
  const g = getGlobals(ctx);
  g.SelectedGems = arr;
}

function ensurePowerAmpByUID(ctx) {
  const g = getGlobals(ctx);
  if (!g.PowerAmpByUID || typeof g.PowerAmpByUID !== 'object') g.PowerAmpByUID = {};
  return g.PowerAmpByUID;
}

function ensurePowerAmpVisuals(g) {
  if (!g.PowerAmpVisualByUID || typeof g.PowerAmpVisualByUID !== 'object') g.PowerAmpVisualByUID = {};
  if (!g.PowerAmpFadeByUID || typeof g.PowerAmpFadeByUID !== 'object') g.PowerAmpFadeByUID = {};
}

function setPowerAmpVisual(g, uid, mult) {
  ensurePowerAmpVisuals(g);
  g.PowerAmpVisualByUID[uid] = { mult, startAt: g.time || 0 };
}

function startPowerAmpFade(g, uid, mult) {
  ensurePowerAmpVisuals(g);
  g.PowerAmpFadeByUID[uid] = { mult, startAt: g.time || 0, duration: 0.42 };
  delete g.PowerAmpVisualByUID[uid];
}

function pickPowerAmpOutcome() {
  let r = Math.random();
  for (const entry of POWER_AMP_OUTCOMES) {
    r -= entry.chance;
    if (r <= 0) return entry;
  }
  return POWER_AMP_OUTCOMES[POWER_AMP_OUTCOMES.length - 1];
}

function armPowerAmpEntry(multiplier, turnNow, turnSerialNow) {
  return {
    mult: 0,
    pendingMult: Number(multiplier || 0),
    state: 'pending_next_own_turn',
    armedAtTurn: Number(turnNow || 0),
    armedAtTurnSerial: Number(turnSerialNow || 0),
    activatedAtTurn: -1,
    activatedAtTurnSerial: -1,
    usedThisTurn: false,
  };
}

function activatePowerAmp(ctx, actorUID) {
  const g = getGlobals(ctx);
  const store = ensurePowerAmpByUID(ctx);
  const outcome = pickPowerAmpOutcome();
  const grantTurn = Number(g.DebugTurnCount || 0);
  const grantTurnSerial = Number(g.TurnSerial || 0);
  if (outcome.jackpotAllLivingHeroes) {
    for (const hero of getHeroes(ctx)) {
      if ((hero.hp ?? 0) > 0) {
        store[hero.uid] = armPowerAmpEntry(outcome.multiplier, grantTurn, grantTurnSerial);
        setPowerAmpVisual(g, hero.uid, outcome.multiplier);
      }
    }
    LogCombat(ctx, 'JACKPOT! All heroes get Power Amp x2!');
    return;
  }
  store[actorUID] = armPowerAmpEntry(outcome.multiplier, grantTurn, grantTurnSerial);
  setPowerAmpVisual(g, actorUID, outcome.multiplier);
  LogCombat(ctx, `${getActorNameByUID(ctx, actorUID)} gained Power Amp x${outcome.multiplier}!`);
}

function consumePowerAmpForEvent(ctx, actorUID, values) {
  const g = getGlobals(ctx);
  const store = ensurePowerAmpByUID(ctx);
  const entry = store[actorUID];
  const mult = Number(entry?.mult || 0);
  if (!mult) return values;
  if (entry && entry.state === 'active_this_turn') {
    entry.usedThisTurn = true;
    return values.map(v => Math.max(1, Math.ceil((v || 0) * mult)));
  }
  return values;
}

function resolveEnemySkillDecision(enemy, roll) {
  const name = String(enemy?.name || '');
  const conf = ENEMY_SKILL_ASSIGNMENT_MAP[name];
  const fallback = 'Enemy_ATK_Single';
  if (!conf) {
    return { roll, selected: fallback, branch: 'fallback', enemyName: name };
  }
  const isDamaged = Number(enemy.hp || 0) < Number(enemy.maxHP || 0);
  const hpEligible = conf.requiresDamaged ? isDamaged : true;
  if (hpEligible && roll < Number(conf.specialChance || 0)) {
    return { roll, selected: conf.specialSkill, branch: 'special', enemyName: name };
  }
  if (hpEligible && roll < Number(conf.regularChance || 0)) {
    return { roll, selected: conf.regularSkill, branch: 'regular', enemyName: name };
  }
  return { roll, selected: fallback, branch: 'fallback', enemyName: name };
}

function traceEnemySkillDecision(ctx, enemyUID, decision) {
  const g = getGlobals(ctx);
  if (!Array.isArray(g.EnemySkillDecisionTrace)) g.EnemySkillDecisionTrace = [];
  g.EnemySkillDecisionTrace.push({
    enemyUID: Number(enemyUID || 0),
    enemyName: decision.enemyName,
    roll: Number(decision.roll),
    branch: decision.branch,
    selected: decision.selected,
    time: Number(g.time || 0),
  });
  if (g.EnemySkillDecisionTrace.length > 120) {
    g.EnemySkillDecisionTrace.shift();
  }
}

export function GetPowerAmpMultiplierForActor(ctx, actorUID) {
  const store = ensurePowerAmpByUID(ctx);
  const entry = store[actorUID];
  if (!entry) return 0;
  if (entry.state !== 'active_this_turn') return 0;
  if (entry.usedThisTurn) return 0;
  return Number(entry.mult || 0);
}

export function ConsumePowerAmpForActor(ctx, actorUID) {
  const store = ensurePowerAmpByUID(ctx);
  const entry = store[actorUID];
  if (!entry || entry.state !== 'active_this_turn') return 0;
  const mult = Number(entry?.mult || 0);
  if (!mult) return 0;
  if (entry.usedThisTurn) return 0;
  entry.usedThisTurn = true;
  return mult;
}

export function FinalizePowerAmpVisualClear(ctx, actorUID) {
  const g = getGlobals(ctx);
  const uid = Number(actorUID || 0);
  if (!uid) return;
  ensurePowerAmpVisuals(g);
  delete g.PowerAmpVisualByUID[uid];
  delete g.PowerAmpFadeByUID[uid];
}

function getAllHeroActors(ctx) {
  return getEntities(ctx).filter(e => e && e.kind === 'hero');
}

function makeStableHeroSkillPointId(hero) {
  const heroIndex = Number(hero && hero.heroIndex);
  if (Number.isInteger(heroIndex) && heroIndex >= 0) return `hero:${heroIndex}`;
  const heroName = String((hero && hero.name) || '').trim().toLowerCase();
  if (heroName) return `hero_name:${heroName}`;
  return '';
}

function resolveHeroSkillPointIdentity(ctx, heroRef) {
  const heroes = getAllHeroActors(ctx);
  const fromActor = (hero) => ({
    heroId: makeStableHeroSkillPointId(hero),
    heroIndex: Number.isInteger(Number(hero && hero.heroIndex)) ? Number(hero.heroIndex) : -1,
    heroName: String((hero && hero.name) || ''),
    actorUID: Number((hero && hero.uid) || 0),
  });
  const fromStableId = (heroId) => {
    const text = String(heroId || '');
    if (text.startsWith('hero:')) {
      const idx = Number(text.slice(5));
      const match = heroes.find(hero => Number(hero.heroIndex) === idx) || null;
      return {
        heroId: text,
        heroIndex: Number.isInteger(idx) ? idx : -1,
        heroName: match ? String(match.name || '') : '',
        actorUID: match ? Number(match.uid || 0) : 0,
      };
    }
    if (text.startsWith('hero_name:')) {
      const key = text.slice(10);
      const match = heroes.find(hero => String(hero.name || '').trim().toLowerCase() === key) || null;
      return {
        heroId: text,
        heroIndex: match && Number.isInteger(Number(match.heroIndex)) ? Number(match.heroIndex) : -1,
        heroName: match ? String(match.name || '') : key,
        actorUID: match ? Number(match.uid || 0) : 0,
      };
    }
    return { heroId: '', heroIndex: -1, heroName: '', actorUID: 0 };
  };

  if (heroRef && typeof heroRef === 'object') {
    const byActor = fromActor(heroRef);
    if (byActor.heroId) return byActor;
  }

  if (typeof heroRef === 'string') {
    const text = heroRef.trim();
    const byStableId = fromStableId(text);
    if (byStableId.heroId) return byStableId;
    const byName = heroes.find(hero => String(hero.name || '').trim().toLowerCase() === text.toLowerCase());
    if (byName) return fromActor(byName);
  }

  const numeric = Number(heroRef);
  if (Number.isFinite(numeric) && numeric > 0) {
    const byUID = heroes.find(hero => Number(hero.uid || 0) === numeric);
    if (byUID) return fromActor(byUID);
    const byIndex = heroes.find(hero => Number(hero.heroIndex) === numeric);
    if (byIndex) return fromActor(byIndex);
  }

  return { heroId: '', heroIndex: -1, heroName: '', actorUID: 0 };
}

function syncHeroSkillPointLegacyUidView(ctx, store) {
  const g = getGlobals(ctx);
  const legacy = {};
  const heroes = getAllHeroActors(ctx);
  for (const hero of heroes) {
    const identity = resolveHeroSkillPointIdentity(ctx, hero);
    if (!identity.heroId || !identity.actorUID) continue;
    legacy[identity.actorUID] = Number(store[identity.heroId] || 0);
  }
  g.HeroSkillPointsByUID = legacy;
  return legacy;
}

function ensureHeroSkillPointStore(ctx) {
  const g = getGlobals(ctx);
  if (!g.HeroSkillPointsByHeroId || typeof g.HeroSkillPointsByHeroId !== 'object') {
    g.HeroSkillPointsByHeroId = {};
  }
  const store = g.HeroSkillPointsByHeroId;
  if (!Array.isArray(g.HeroSkillPointLedger)) g.HeroSkillPointLedger = [];
  if (!Number.isFinite(g.HeroSkillPointLedgerSeq)) g.HeroSkillPointLedgerSeq = 0;

  const legacyStore = (g.HeroSkillPointsByUID && typeof g.HeroSkillPointsByUID === 'object') ? g.HeroSkillPointsByUID : {};
  if (Object.keys(store).length === 0) {
    for (const [legacyKey, rawValue] of Object.entries(legacyStore)) {
      const value = Number(rawValue || 0);
      if (!Number.isFinite(value) || value === 0) continue;
      const identity = resolveHeroSkillPointIdentity(ctx, legacyKey);
      if (!identity.heroId) continue;
      if (!Object.prototype.hasOwnProperty.call(store, identity.heroId)) {
        store[identity.heroId] = 0;
      }
      store[identity.heroId] += value;
    }
  }

  syncHeroSkillPointLegacyUidView(ctx, store);
  return store;
}

function nextHeroSkillLedgerSeq(g) {
  g.HeroSkillPointLedgerSeq = Number(g.HeroSkillPointLedgerSeq || 0) + 1;
  return g.HeroSkillPointLedgerSeq;
}

function appendHeroSkillPointTxn(g, entry) {
  const ledger = Array.isArray(g.HeroSkillPointLedger) ? g.HeroSkillPointLedger : (g.HeroSkillPointLedger = []);
  ledger.push(entry);
  if (ledger.length > 240) ledger.shift();
}

function appendHeroSkillPointRewardTrace(g, entry) {
  const trace = Array.isArray(g.HeroSkillPointRewardTrace) ? g.HeroSkillPointRewardTrace : (g.HeroSkillPointRewardTrace = []);
  trace.push(entry);
  if (trace.length > 120) trace.shift();
}

function getHeroSkillProgressConfigForHero(heroName) {
  const key = String(heroName || '').trim().toLowerCase();
  const titleByHero = {
    falie: 'Pummel',
    huun: 'Swipe',
    runa: 'Burst',
    kojonn: 'Faze',
  };
  const skill1Title = titleByHero[key] || 'Skill 1 Placeholder';
  return [
    { slot: 0, key: 'skill1', title: skill1Title, maxRank: 3, costs: [2, 3, 4] },
    { slot: 1, key: 'skill2', title: 'Skill 2 Placeholder', maxRank: 3, costs: [1, 2, 3] },
    { slot: 2, key: 'skill3', title: 'Skill 3 Placeholder', maxRank: 3, costs: [1, 2, 3] },
  ];
}

function buildDefaultHeroSkillProgressState(def) {
  const maxRank = Math.max(1, Math.floor(Number(def && def.maxRank) || 1));
  const costs = Array.isArray(def && def.costs)
    ? def.costs.map(value => Math.max(0, Math.floor(Number(value || 0))))
    : [];
  const nextCost = costs.length > 0 ? Number(costs[0] || 0) : 0;
  return {
    slot: Math.max(0, Math.floor(Number(def && def.slot) || 0)),
    key: String((def && def.key) || ''),
    title: String((def && def.title) || ''),
    status: 'locked',
    rank: 0,
    maxRank,
    costs,
    nextCost,
    lastCost: 0,
  };
}

function cloneHeroSkillProgressState(entry) {
  return {
    slot: Math.max(0, Math.floor(Number(entry && entry.slot) || 0)),
    key: String((entry && entry.key) || ''),
    title: String((entry && entry.title) || ''),
    status: String((entry && entry.status) || 'locked'),
    rank: Math.max(0, Math.floor(Number(entry && entry.rank) || 0)),
    maxRank: Math.max(1, Math.floor(Number(entry && entry.maxRank) || 1)),
    costs: Array.isArray(entry && entry.costs) ? entry.costs.map(value => Math.max(0, Math.floor(Number(value || 0)))) : [],
    nextCost: Math.max(0, Math.floor(Number(entry && entry.nextCost) || 0)),
    lastCost: Math.max(0, Math.floor(Number(entry && entry.lastCost) || 0)),
  };
}

function ensureHeroSkillProgressStore(ctx) {
  const g = getGlobals(ctx);
  if (!g.HeroSkillProgressByHeroId || typeof g.HeroSkillProgressByHeroId !== 'object') {
    g.HeroSkillProgressByHeroId = {};
  }
  if (!Array.isArray(g.HeroSkillProgressTrace)) g.HeroSkillProgressTrace = [];
  if (!Number.isFinite(g.HeroSkillProgressTraceSeq)) g.HeroSkillProgressTraceSeq = 0;
  return g.HeroSkillProgressByHeroId;
}

function nextHeroSkillProgressTraceSeq(g) {
  g.HeroSkillProgressTraceSeq = Number(g.HeroSkillProgressTraceSeq || 0) + 1;
  return g.HeroSkillProgressTraceSeq;
}

function appendHeroSkillProgressTrace(g, entry) {
  const trace = Array.isArray(g.HeroSkillProgressTrace) ? g.HeroSkillProgressTrace : (g.HeroSkillProgressTrace = []);
  trace.push(entry);
  if (trace.length > 180) trace.shift();
}

function buildHeroSkillProgressTrace(g, identity, skillState, action, cost, status, reason, balanceAfter) {
  return {
    seq: nextHeroSkillProgressTraceSeq(g),
    who: String((identity && identity.heroId) || ''),
    heroId: String((identity && identity.heroId) || ''),
    heroIndex: Number((identity && identity.heroIndex) ?? -1),
    heroName: String((identity && identity.heroName) || ''),
    actorUID: Number((identity && identity.actorUID) || 0),
    skillKey: String((skillState && skillState.key) || ''),
    skillTitle: String((skillState && skillState.title) || ''),
    slot: Number((skillState && skillState.slot) ?? -1),
    action: String(action || 'unknown'),
    cost: Math.max(0, Math.floor(Number(cost || 0))),
    status: String(status || 'unknown'),
    reason: String(reason || ''),
    balanceAfter: Math.max(0, Math.floor(Number(balanceAfter || 0))),
    rankAfter: Math.max(0, Math.floor(Number(skillState && skillState.rank) || 0)),
    time: Number(g.time || 0),
    turn: Number(g.DebugTurnCount || 0),
    turnSerial: Number(g.TurnSerial || 0),
  };
}

function ensureHeroSkillProgressRecord(ctx, heroRef) {
  const store = ensureHeroSkillProgressStore(ctx);
  const identity = resolveHeroSkillPointIdentity(ctx, heroRef);
  if (!identity.heroId) return { identity, record: null };
  if (!store[identity.heroId] || typeof store[identity.heroId] !== 'object') {
    store[identity.heroId] = {};
  }
  const record = store[identity.heroId];
  const defs = getHeroSkillProgressConfigForHero(identity.heroName);
  for (const def of defs) {
    if (!record[def.key] || typeof record[def.key] !== 'object') {
      record[def.key] = buildDefaultHeroSkillProgressState(def);
      continue;
    }
    const current = cloneHeroSkillProgressState(record[def.key]);
    current.slot = Math.max(0, Math.floor(Number(def.slot || 0)));
    current.key = String(def.key || current.key || '');
    current.title = String(def.title || current.title || '');
    current.maxRank = Math.max(1, Math.floor(Number(def.maxRank || current.maxRank || 1)));
    current.costs = Array.isArray(def.costs) ? def.costs.map(value => Math.max(0, Math.floor(Number(value || 0)))) : current.costs;
    current.nextCost = current.rank >= current.maxRank
      ? 0
      : Math.max(0, Math.floor(Number(current.costs[current.rank] || 0)));
    record[def.key] = current;
  }
  return { identity, record };
}

function resolveHeroSkillProgressEntry(record, skillRef) {
  if (!record || typeof record !== 'object') return null;
  if (typeof skillRef === 'number' && Number.isFinite(skillRef)) {
    const slot = Math.floor(Number(skillRef));
    const bySlot = Object.values(record).find(entry => Number(entry && entry.slot) === slot);
    if (bySlot) return bySlot;
  }
  if (skillRef && typeof skillRef === 'object') {
    if (Object.prototype.hasOwnProperty.call(skillRef, 'slot')) {
      const bySlot = resolveHeroSkillProgressEntry(record, Number(skillRef.slot));
      if (bySlot) return bySlot;
    }
    if (Object.prototype.hasOwnProperty.call(skillRef, 'key')) {
      const byKey = resolveHeroSkillProgressEntry(record, String(skillRef.key || ''));
      if (byKey) return byKey;
    }
  }
  if (typeof skillRef === 'string') {
    const text = skillRef.trim().toLowerCase();
    if (!text) return null;
    if (Object.prototype.hasOwnProperty.call(record, text)) return record[text];
    const byTitle = Object.values(record).find(entry => String(entry && entry.title || '').trim().toLowerCase() === text);
    if (byTitle) return byTitle;
  }
  return null;
}

function buildHeroSkillPointTxn(g, identity, source, delta, balanceAfter, kind, status, reason = '') {
  return {
    seq: nextHeroSkillLedgerSeq(g),
    who: String((identity && identity.heroId) || ''),
    heroId: String((identity && identity.heroId) || ''),
    heroIndex: Number((identity && identity.heroIndex) ?? -1),
    heroName: String((identity && identity.heroName) || ''),
    actorUID: Number((identity && identity.actorUID) || 0),
    source: String(source || 'unknown'),
    delta: Number(delta || 0),
    balanceAfter: Number(balanceAfter || 0),
    kind: String(kind || 'unknown'),
    status: String(status || 'unknown'),
    reason: String(reason || ''),
    time: Number(g.time || 0),
    turn: Number(g.DebugTurnCount || 0),
    turnSerial: Number(g.TurnSerial || 0),
  };
}

export function GrantHeroSkillPoints(ctx, heroUID, amount, source = 'unspecified') {
  const g = getGlobals(ctx);
  const delta = Math.floor(Number(amount || 0));
  const store = ensureHeroSkillPointStore(ctx);
  const identity = resolveHeroSkillPointIdentity(ctx, heroUID);
  if (!identity.heroId) {
    const tx = buildHeroSkillPointTxn(g, identity, source, delta, 0, 'grant', 'rejected', 'hero_not_found');
    appendHeroSkillPointTxn(g, tx);
    return { ok: false, reason: 'hero_not_found', tx };
  }
  if (!Number.isFinite(delta) || delta <= 0) {
    const tx = buildHeroSkillPointTxn(g, identity, source, delta, Number(store[identity.heroId] || 0), 'grant', 'rejected', 'invalid_amount');
    appendHeroSkillPointTxn(g, tx);
    return { ok: false, reason: 'invalid_amount', tx };
  }
  const current = Number(store[identity.heroId] || 0);
  const next = current + delta;
  store[identity.heroId] = next;
  syncHeroSkillPointLegacyUidView(ctx, store);
  const tx = buildHeroSkillPointTxn(g, identity, source, delta, next, 'grant', 'applied');
  appendHeroSkillPointTxn(g, tx);
  return { ok: true, balance: next, tx };
}

export function SpendHeroSkillPoints(ctx, heroUID, amount, source = 'unspecified') {
  const g = getGlobals(ctx);
  const spend = Math.floor(Number(amount || 0));
  const store = ensureHeroSkillPointStore(ctx);
  const identity = resolveHeroSkillPointIdentity(ctx, heroUID);
  if (!identity.heroId) {
    const tx = buildHeroSkillPointTxn(g, identity, source, -Math.abs(spend || 0), 0, 'spend', 'rejected', 'hero_not_found');
    appendHeroSkillPointTxn(g, tx);
    return { ok: false, reason: 'hero_not_found', tx };
  }
  if (!Number.isFinite(spend) || spend <= 0) {
    const tx = buildHeroSkillPointTxn(g, identity, source, -Math.abs(spend || 0), Number(store[identity.heroId] || 0), 'spend', 'rejected', 'invalid_amount');
    appendHeroSkillPointTxn(g, tx);
    return { ok: false, reason: 'invalid_amount', tx };
  }
  const current = Number(store[identity.heroId] || 0);
  if (spend > current) {
    const tx = buildHeroSkillPointTxn(g, identity, source, -spend, current, 'spend', 'rejected', 'overdraft');
    appendHeroSkillPointTxn(g, tx);
    return { ok: false, reason: 'overdraft', balance: current, tx };
  }
  const next = current - spend;
  store[identity.heroId] = next;
  syncHeroSkillPointLegacyUidView(ctx, store);
  const tx = buildHeroSkillPointTxn(g, identity, source, -spend, next, 'spend', 'applied');
  appendHeroSkillPointTxn(g, tx);
  return { ok: true, balance: next, tx };
}

export function GetHeroSkillPointBalance(ctx, heroUID) {
  const store = ensureHeroSkillPointStore(ctx);
  const identity = resolveHeroSkillPointIdentity(ctx, heroUID);
  if (!identity.heroId) return 0;
  return Number(store[identity.heroId] || 0);
}

export function GetAllHeroSkillPointBalances(ctx) {
  const store = ensureHeroSkillPointStore(ctx);
  const out = {};
  const stableIds = getAllHeroActors(ctx)
    .sort((a, b) => Number(a.heroIndex || 0) - Number(b.heroIndex || 0))
    .map(hero => makeStableHeroSkillPointId(hero))
    .filter(id => id);
  for (const heroId of stableIds) {
    out[heroId] = Number(store[heroId] || 0);
  }
  for (const key of Object.keys(store)) {
    if (out[key] != null) continue;
    out[key] = Number(store[key] || 0);
  }
  return out;
}

export function GetHeroSkillPointLedger(ctx, limit = 60) {
  const g = getGlobals(ctx);
  ensureHeroSkillPointStore(ctx);
  const max = Math.max(1, Math.floor(Number(limit || 60)));
  const ledger = Array.isArray(g.HeroSkillPointLedger) ? g.HeroSkillPointLedger : [];
  return ledger.slice(-max).map(row => ({ ...row }));
}

export function GrantHeroSkillPointsToParty(ctx, amountEach, source = 'party_reward') {
  const g = getGlobals(ctx);
  const heroes = getAllHeroActors(ctx)
    .slice()
    .sort((a, b) => Number(a.heroIndex || 0) - Number(b.heroIndex || 0));
  const results = heroes.map(hero => {
    const grant = GrantHeroSkillPoints(ctx, hero.uid, amountEach, source);
    const identity = resolveHeroSkillPointIdentity(ctx, hero.uid);
    return {
      ok: !!grant.ok,
      balance: Number(grant.balance || 0),
      heroId: String(identity.heroId || ''),
      heroIndex: Number((identity.heroIndex) ?? -1),
      heroName: String(identity.heroName || ''),
      actorUID: Number(identity.actorUID || 0),
      tx: grant.tx ? { ...grant.tx } : null,
    };
  });
  const entry = {
    kind: 'party_grant',
    source: String(source || 'party_reward'),
    amountEach: Math.floor(Number(amountEach || 0)),
    grantsApplied: results.filter(row => row.ok).length,
    heroIds: results.map(row => row.heroId),
    actorUIDs: results.map(row => row.actorUID),
    time: Number(g.time || 0),
    turn: Number(g.DebugTurnCount || 0),
    turnSerial: Number(g.TurnSerial || 0),
    results: results.map(row => ({
      ok: row.ok,
      balance: row.balance,
      heroId: row.heroId,
      heroIndex: row.heroIndex,
      heroName: row.heroName,
      actorUID: row.actorUID,
    })),
  };
  appendHeroSkillPointRewardTrace(g, entry);
  return { ok: results.every(row => row.ok), entry, results };
}

export function GrantTowerSkillPoints(ctx, amountEach = 1, source = 'tower_takedown') {
  return GrantHeroSkillPointsToParty(ctx, amountEach, source);
}

export function GrantBoPSkillPoints(ctx, amountEach = 1, source = 'bop_reward') {
  return GrantHeroSkillPointsToParty(ctx, amountEach, source);
}

export function GetHeroSkillPointRewardTrace(ctx, limit = 20) {
  const g = getGlobals(ctx);
  const max = Math.max(1, Math.floor(Number(limit || 20)));
  const trace = Array.isArray(g.HeroSkillPointRewardTrace) ? g.HeroSkillPointRewardTrace : [];
  return trace.slice(-max).map(row => ({
    ...row,
    heroIds: Array.isArray(row.heroIds) ? row.heroIds.slice() : [],
    actorUIDs: Array.isArray(row.actorUIDs) ? row.actorUIDs.slice() : [],
    results: Array.isArray(row.results) ? row.results.map(item => ({ ...item })) : [],
  }));
}

export function GetHeroSkillState(ctx, heroUID, skillRef) {
  const pair = ensureHeroSkillProgressRecord(ctx, heroUID);
  if (!pair.identity.heroId || !pair.record) return null;
  const entry = resolveHeroSkillProgressEntry(pair.record, skillRef);
  return entry ? cloneHeroSkillProgressState(entry) : null;
}

export function GetAllHeroSkillStates(ctx, heroUID) {
  const pair = ensureHeroSkillProgressRecord(ctx, heroUID);
  if (!pair.identity.heroId || !pair.record) return {};
  const out = {};
  for (const [key, entry] of Object.entries(pair.record)) {
    out[key] = cloneHeroSkillProgressState(entry);
  }
  return out;
}

export function GetHeroSkillProgressTrace(ctx, limit = 40) {
  const g = getGlobals(ctx);
  ensureHeroSkillProgressStore(ctx);
  const max = Math.max(1, Math.floor(Number(limit || 40)));
  const trace = Array.isArray(g.HeroSkillProgressTrace) ? g.HeroSkillProgressTrace : [];
  return trace.slice(-max).map(row => ({ ...row }));
}

export function AttemptHeroSkillUpgrade(ctx, heroUID, skillRef, source = 'hero_skill_upgrade') {
  const g = getGlobals(ctx);
  const pair = ensureHeroSkillProgressRecord(ctx, heroUID);
  if (!pair.identity.heroId || !pair.record) {
    const rejectedState = buildDefaultHeroSkillProgressState({ key: '', title: '', slot: -1, maxRank: 1, costs: [] });
    const trace = buildHeroSkillProgressTrace(g, pair.identity, rejectedState, 'upgrade', 0, 'rejected', 'hero_not_found', 0);
    appendHeroSkillProgressTrace(g, trace);
    return { ok: false, reason: 'hero_not_found', state: null, trace };
  }
  const entry = resolveHeroSkillProgressEntry(pair.record, skillRef);
  if (!entry) {
    const rejectedState = buildDefaultHeroSkillProgressState({ key: '', title: '', slot: -1, maxRank: 1, costs: [] });
    const trace = buildHeroSkillProgressTrace(g, pair.identity, rejectedState, 'upgrade', 0, 'rejected', 'skill_not_found', GetHeroSkillPointBalance(ctx, heroUID));
    appendHeroSkillProgressTrace(g, trace);
    return { ok: false, reason: 'skill_not_found', state: null, trace };
  }
  const state = cloneHeroSkillProgressState(entry);
  if (state.rank >= state.maxRank) {
    const trace = buildHeroSkillProgressTrace(g, pair.identity, state, 'upgrade', 0, 'rejected', 'max_rank_reached', GetHeroSkillPointBalance(ctx, heroUID));
    appendHeroSkillProgressTrace(g, trace);
    return { ok: false, reason: 'max_rank_reached', state, trace };
  }
  const cost = Math.max(0, Math.floor(Number(state.costs[state.rank] || 0)));
  if (!Number.isFinite(cost) || cost <= 0) {
    const trace = buildHeroSkillProgressTrace(g, pair.identity, state, 'upgrade', 0, 'rejected', 'invalid_cost_config', GetHeroSkillPointBalance(ctx, heroUID));
    appendHeroSkillProgressTrace(g, trace);
    return { ok: false, reason: 'invalid_cost_config', state, trace };
  }
  const action = state.rank === 0 ? 'unlock' : 'upgrade';
  const spend = SpendHeroSkillPoints(ctx, heroUID, cost, `${source}:${state.key}:${action}`);
  if (!spend.ok) {
    const reason = spend.reason === 'overdraft' ? 'insufficient_points' : String(spend.reason || 'spend_rejected');
    const trace = buildHeroSkillProgressTrace(g, pair.identity, state, action, cost, 'rejected', reason, Number(spend.balance || GetHeroSkillPointBalance(ctx, heroUID)));
    appendHeroSkillProgressTrace(g, trace);
    return { ok: false, reason, state, trace, spend };
  }
  state.rank += 1;
  state.status = 'unlocked';
  state.lastCost = cost;
  state.nextCost = state.rank >= state.maxRank
    ? 0
    : Math.max(0, Math.floor(Number(state.costs[state.rank] || 0)));
  pair.record[state.key] = state;
  const snapshot = cloneHeroSkillProgressState(state);
  const trace = buildHeroSkillProgressTrace(g, pair.identity, snapshot, action, cost, 'applied', '', Number(spend.balance || 0));
  appendHeroSkillProgressTrace(g, trace);
  return { ok: true, action, cost, balance: Number(spend.balance || 0), state: snapshot, trace, spend };
}

function ensureTokenWallet(ctx) {
  const g = getGlobals(ctx);
  if (!g.TokenWallet || typeof g.TokenWallet !== 'object') g.TokenWallet = {};
  return g.TokenWallet;
}

function ensureAstralFlowWallet(ctx) {
  const g = getGlobals(ctx);
  if (!Number.isFinite(g.AstralFlowWallet)) g.AstralFlowWallet = 0;
  return g.AstralFlowWallet;
}

function parseDropId(dropId) {
  if (!dropId || dropId === EMPTY) return { type: 'EMPTY', id: null };
  const raw = String(dropId);
  const parts = raw.split('.');
  if (parts.length === 2) return { type: parts[0], id: parts[1] };
  return { type: 'UNKNOWN', id: raw };
}

function getMonsterIdByName(name) {
  if (!name) return -1;
  return MONSTER_KEYS.findIndex(k => k === name);
}

function getActiveEventByToken(tokenId) {
  if (!tokenId) return null;
  const active = new Set(ACTIVE_EVENT_IDS || []);
  return (LIVE_OPS_EVENTS || []).find(e => e.token_id === tokenId && active.has(e.id)) || null;
}

function getOrCreateEventProgress(ctx, eventId) {
  const g = getGlobals(ctx);
  if (!g.LiveOpsProgress || typeof g.LiveOpsProgress !== 'object') g.LiveOpsProgress = {};
  if (!g.LiveOpsProgress[eventId]) {
    g.LiveOpsProgress[eventId] = {
      tierIndex: 0,
      tierProgress: 0,
      milestoneIndex: 0,
      totalSpent: 0,
    };
  }
  return g.LiveOpsProgress[eventId];
}

function pickDropTier(g) {
  if (g && Number.isFinite(g.DropTierOverride)) return Math.max(0, Math.min(3, Math.floor(g.DropTierOverride)));
  const weights = [2, 8, 20, 70];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 3;
}

function applyRewardPayload(ctx, payload) {
  if (!payload || !payload.type) return;
  const g = getGlobals(ctx);
  if (payload.type === 'SKILL_POINTS_PARTY') {
    const amountEach = payload.amountEach ?? payload.amount ?? 0;
    GrantHeroSkillPointsToParty(ctx, amountEach, payload.source || 'event_skill_points_party');
    return;
  }
  if (payload.type === 'SKILL_POINTS_TOWER') {
    const amountEach = payload.amountEach ?? payload.amount ?? 1;
    GrantTowerSkillPoints(ctx, amountEach, payload.source || 'tower_takedown');
    return;
  }
  if (payload.type === 'SKILL_POINTS_BOP') {
    const amountEach = payload.amountEach ?? payload.amount ?? 1;
    GrantBoPSkillPoints(ctx, amountEach, payload.source || 'bop_reward');
    return;
  }
  if (payload.type === 'HEAL_RANDOM') {
    const amt = Math.max(1, Math.floor(Math.random() * 40) + 1);
    ctx.callFunction('ApplyPartyHeal', amt);
    LogCombat(ctx, `Event reward: +${amt} HP`);
    return;
  }
  if (payload.type === 'ENERGY_RANDOM') {
    const options = [10, 20, 30, 40];
    const amt = options[Math.floor(Math.random() * options.length)];
    const next = (g.Player_Energy || 0) + amt;
    g.Player_Energy = next;
    LogCombat(ctx, `Event reward: +${amt} Energy`);
    return;
  }
  if (payload.type === 'GOLD_RANDOM') {
    const options = [15, 30];
    const amt = options[Math.floor(Math.random() * options.length)];
    g.goldTotal = (g.goldTotal || 0) + amt;
    LogCombat(ctx, `Event reward: +${amt} Gold`);
  }
}

function sum(list) {
  return list.reduce((acc, v) => acc + v, 0);
}

function clamp(min, value, max) {
  return Math.max(min, Math.min(max, value));
}

function getHeroes(ctx) {
  const g = getGlobals(ctx);
  const partyAlive = (g.PartyHP ?? 0) > 0;
  return getEntities(ctx).filter(e => {
    if (!e || e.kind !== 'hero') return false;
    if (partyAlive) return true;
    return (e.hp ?? 0) > 0;
  });
}

function getEnemies(ctx) {
  return getEntities(ctx).filter(e => e && e.kind === 'enemy' && (e.hp ?? 0) > 0);
}

function nextUID(ctx) {
  const g = getGlobals(ctx);
  g.NextUID = (g.NextUID || 1) + 1;
  return g.NextUID;
}

function randomPick(list) {
  if (!list || list.length === 0) return null;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

function logLine(ctx, text) {
  const g = getGlobals(ctx);
  g.CombatLog = g.CombatLog || [];
  if (text) g.CombatLog.push(String(text));
}

function updateHeatStats(g, key, value) {
  const stats = g.HeatStats || {};
  const cur = stats[key] || { mean: value, var: 0, n: 0 };
  const alpha = 0.2;
  const mean = cur.mean + alpha * (value - cur.mean);
  const diff = value - mean;
  const variance = cur.var + alpha * ((diff * diff) - cur.var);
  const next = { mean, var: Math.max(0, variance), n: (cur.n || 0) + 1 };
  stats[key] = next;
  g.HeatStats = stats;
  return next;
}

function computeHeat(g, key, value, defaults) {
  const stats = updateHeatStats(g, key, value);
  let low = defaults.low;
  let high = defaults.high;
  if (stats.n > 5) {
    const sigma = Math.sqrt(stats.var || 0);
    low = Math.max(0, stats.mean - sigma);
    high = stats.mean + 2 * sigma;
  }
  const denom = Math.max(0.001, high - low);
  let x = (value - low) / denom;
  x = Math.max(0, Math.min(1, x));
  const p = 2.0;
  return Math.pow(x, p);
}

function getActorNameByUID(ctx, uid) {
  const actor = GetActorByUID(ctx, uid);
  if (actor && actor.name) return actor.name;
  const g = getGlobals(ctx);
  if (!uid && g.CurrentHeroUID) {
    const curHero = GetActorByUID(ctx, g.CurrentHeroUID);
    if (curHero && curHero.name) return curHero.name;
  }
  if (!uid) {
    const curUID = GetCurrentTurn(ctx);
    const curActor = GetActorByUID(ctx, curUID);
    if (curActor && curActor.name) return curActor.name;
  }
  if (typeof uid === 'number') {
    const hero = getHeroes(ctx).find(h => h.heroIndex === uid);
    if (hero && hero.name) return hero.name;
  }
  return '?';
}

export function SlotX(ctx, i) {
  const g = getGlobals(ctx);
  const slots = g.Slots || 0;
  const center = Math.floor(slots / 2);
  let offset = 0;
  if (i === center) {
    offset = -Math.round((g.EnemySize || 0) / 2);
  }
  return (g.X0 || 0) + offset;
}

export function SlotY(ctx, i) {
  const g = getGlobals(ctx);
  return (g.EnemyAreaY0 || 0) + i * (g.Spacing || 0);
}

export function ComputeEnemyLayout(ctx) {
  const g = getGlobals(ctx);
  const rect = g.EnemyAreaRect;
  if (!rect) return;
  const Slots = 3;
  const MARGIN = 8;
  const enemyGAP = 8;
  const EnemyRowGap = enemyGAP;
  const EnemyAreaLeft = rect.minX;
  const EnemyAreaRight = rect.maxX;
  const EnemyAreaTop = rect.minY;
  const EnemyAreaBottom = rect.maxY;
  const EnemyAreaCX = (EnemyAreaLeft + EnemyAreaRight) / 2;
  const EnemyAreaCY = (EnemyAreaTop + EnemyAreaBottom) / 2;
  const VW = EnemyAreaRight - EnemyAreaLeft;
  const VH = EnemyAreaBottom - EnemyAreaTop;
  const EnemySizeW = Math.floor((VW - 2 * MARGIN - (Slots - 1) * enemyGAP) / Slots);
  const EnemySizeH = Math.floor((VH - 2 * MARGIN - 2 * EnemyRowGap) / 3);
  const EnemySize = Math.min(EnemySizeW, EnemySizeH);
  const X0 = EnemyAreaCX;
  const Spacing = EnemySize + enemyGAP;
  const EnemyAreaY0 = EnemyAreaTop + MARGIN + (EnemySize / 2);
  const OffscreenX = EnemyAreaRight + EnemySize;

  g.Slots = Slots;
  g.MARGIN = MARGIN;
  g.enemyGAP = enemyGAP;
  g.EnemyRowGap = EnemyRowGap;
  g.EnemyAreaLeft = EnemyAreaLeft;
  g.EnemyAreaRight = EnemyAreaRight;
  g.EnemyAreaTop = EnemyAreaTop;
  g.EnemyAreaBottom = EnemyAreaBottom;
  g.EnemyAreaCX = EnemyAreaCX;
  g.EnemyAreaCY = EnemyAreaCY;
  g.VW = VW;
  g.VH = VH;
  g.EnemySizeW = EnemySizeW;
  g.EnemySizeH = EnemySizeH;
  g.EnemySize = EnemySize;
  g.X0 = X0;
  g.Spacing = Spacing;
  g.EnemyAreaY0 = EnemyAreaY0;
  g.OffscreenX = OffscreenX;
}

export function RefreshEnemyPositions(ctx) {
  const g = getGlobals(ctx);
  for (const e of getEnemies(ctx)) {
    const slotIndex = e.slotIndex ?? 0;
    const ox = SlotX(ctx, slotIndex);
    const oy = SlotY(ctx, slotIndex);
    e.originX = ox;
    e.originY = oy;
    e.x = ox;
    e.y = oy;
  }
}

function isTimeInitiative(ctx) {
  const g = getGlobals(ctx);
  return g.InitiativeMode === 'time';
}

function getInitiativeRoster(ctx) {
  const g = getGlobals(ctx);
  const roster = [];
  const seen = new Set();
  const partyAlive = (g.PartyHP || 0) > 0;
  if (partyAlive) {
    for (const h of getHeroes(ctx)) {
      if (seen.has(h.uid)) continue;
      const spd = GetEffectiveStat(ctx, h, 'SPD');
      roster.push({ uid: h.uid, type: 0, spd });
      seen.add(h.uid);
    }
  }
  for (const e of getEnemies(ctx)) {
    if ((e.hp ?? 0) <= 0) continue;
    if (seen.has(e.uid)) continue;
    const spd = GetEffectiveStat(ctx, e, 'SPD');
    roster.push({ uid: e.uid, type: 1, spd });
    seen.add(e.uid);
  }
  return roster;
}

function getMeter(meters, uid) {
  return Number(meters[String(uid)] ?? 0);
}

function setMeter(meters, uid, value) {
  meters[String(uid)] = value;
}

function ensureTurnSchedulerAudit(g) { if (!g.TurnSchedulerAudit || typeof g.TurnSchedulerAudit !== 'object') g.TurnSchedulerAudit = { seq: 0, events: [], lastQueueMutation: null, lastRemovalSeq: 0 }; return g.TurnSchedulerAudit; }
function snapshotTurnOrderSlots(ctx, queue = null) { const g = getGlobals(ctx), arr = Array.isArray(queue) ? queue : (Array.isArray(g.TurnOrderArray) ? g.TurnOrderArray : []); return arr.map((slot, idx) => { const uid = Number(slot?.uid || 0), actor = uid ? GetActorByUID(ctx, uid) : null; return { idx, uid, type: Number(slot?.type ?? (actor && actor.kind === 'enemy' ? 1 : 0)), spd: Number(slot?.spd ?? (actor ? Number(actor.stats?.SPD ?? actor.SPD ?? 0) : 0)), extra: !!slot?.extra, name: actor ? String(actor.name || uid) : null }; }); }
function recordTurnSchedulerEvent(ctx, kind, details = {}) { const g = getGlobals(ctx), audit = ensureTurnSchedulerAudit(g), queue = Array.isArray(details.queue) ? details.queue : snapshotTurnOrderSlots(ctx), { queue: _queue, ...rest } = details, currentIndex = Number.isFinite(Number(g.CurrentTurnIndex)) ? Number(g.CurrentTurnIndex) : 0, currentSlot = queue[currentIndex] || null, positionsByUID = new Map(); for (const slot of queue) { const uid = Number(slot.uid || 0); if (!positionsByUID.has(uid)) positionsByUID.set(uid, []); positionsByUID.get(uid).push(slot.idx); } const repeats = []; for (const [uid, positions] of positionsByUID.entries()) { if (positions.length <= 1) continue; const repeatedSlots = positions.map(idx => queue[idx]).filter(Boolean), name = repeatedSlots[0]?.name || null, provenance = rest.repeatSource || rest.mutationSource || audit.lastQueueMutation?.source || null, source = provenance === 'collapse_after_future_slot_removal' ? 'collapse_after_future_slot_removal' : (provenance === 'explicit_mechanic' ? 'explicit_mechanic' : (provenance === 'cycle_rollover' ? 'cycle_rollover' : (provenance === 'non_compliant_scheduler_behavior' ? 'non_compliant_scheduler_behavior' : (repeatedSlots.some(slot => slot.extra) ? 'explicit_mechanic' : 'ambiguous_repeat')))); repeats.push({ uid, name, positions, source }); } const event = { seq: Number(audit.seq || 0) + 1, kind: String(kind || 'unknown'), time: Number(g.time || 0), turnSerial: Number(g.TurnSerial || 0), initiativeMode: String(g.InitiativeMode || ''), roundActive: !!g.RoundActive, currentTurnIndex: currentIndex, currentUID: currentSlot ? Number(currentSlot.uid || 0) : Number(g.InitiativeCurrentUID || 0), queueShape: queue.map(slot => ({ idx: slot.idx, uid: slot.uid, type: slot.type, spd: slot.spd, extra: !!slot.extra, name: slot.name })), repeats, ...rest }; audit.seq = event.seq; audit.events.push(event); if (audit.events.length > 500) audit.events.shift(); if (kind === 'queue_mutation' && event.mutationSource) audit.lastQueueMutation = { seq: event.seq, cause: event.cause || null, source: event.mutationSource, removedUIDs: Array.isArray(event.removedUIDs) ? event.removedUIDs.slice() : [], addedUIDs: Array.isArray(event.addedUIDs) ? event.addedUIDs.slice() : [] }; if (kind === 'removal_commit') audit.lastRemovalSeq = event.seq; return event; }
function setTurnOrderArrayWithAudit(ctx, nextQueue, cause, details = {}) { const g = getGlobals(ctx), audit = ensureTurnSchedulerAudit(g), beforeSlots = snapshotTurnOrderSlots(ctx), before = new Map(); for (const slot of beforeSlots) before.set(slot.uid, (before.get(slot.uid) || 0) + 1); g.TurnOrderArray = Array.isArray(nextQueue) ? nextQueue : []; const afterSlots = snapshotTurnOrderSlots(ctx), after = new Map(), removedUIDs = [], addedUIDs = []; for (const slot of afterSlots) after.set(slot.uid, (after.get(slot.uid) || 0) + 1); for (const uid of new Set([...before.keys(), ...after.keys()])) { const beforeCount = before.get(uid) || 0, afterCount = after.get(uid) || 0; for (let i = 0; i < beforeCount - afterCount; i++) removedUIDs.push(uid); for (let i = 0; i < afterCount - beforeCount; i++) addedUIDs.push(uid); } let mutationSource = null; if (cause === 'explicit_extra_turn_insert' || cause === 'spawn_insertion') mutationSource = 'explicit_mechanic'; else if (removedUIDs.length > 0 && Number(audit.lastRemovalSeq || 0) > 0 && Number(audit.lastRemovalSeq || 0) >= Number(audit.seq || 0) - 2) mutationSource = 'collapse_after_future_slot_removal'; recordTurnSchedulerEvent(ctx, 'queue_mutation', { cause, beforeLength: beforeSlots.length, afterLength: afterSlots.length, removedUIDs, addedUIDs, mutationSource, queue: afterSlots, ...details }); return afterSlots; }
function buildInitiativeCycle(ctx, roster, currentUID = 0, selectionPool = null) {
  const g = getGlobals(ctx), cycle = roster.map(r => ({ uid: r.uid, type: r.type, spd: Number(r.spd || 0), extra: false })), startPool = Array.isArray(selectionPool) && selectionPool.length && selectionPool.length < cycle.length ? new Set(selectionPool.map(r => Number(r.uid || 0))) : null;
  cycle.sort((a, b) => {
    const rankA = startPool ? (startPool.has(a.uid) ? 0 : 1) : 0, rankB = startPool ? (startPool.has(b.uid) ? 0 : 1) : 0;
    return rankA - rankB || (Number(b.spd || 0) - Number(a.spd || 0)) || (Number(a.type || 0) - Number(b.type || 0)) || (Number(a.uid || 0) - Number(b.uid || 0));
  });
  const anchorUID = Number(currentUID || 0);
  if (!anchorUID) return cycle;
  const idx = cycle.findIndex(slot => Number(slot.uid || 0) === anchorUID);
  return idx > 0 ? cycle.slice(idx).concat(cycle.slice(0, idx)) : cycle;
}

function reconcileInitiativeQueue(ctx, roster, cause = 'initiative_refresh_preview', details = {}) {
  const g = getGlobals(ctx);
  const currentUID = Number(g.InitiativeCurrentUID || 0);
  const existing = Array.isArray(g.TurnOrderArray) ? g.TurnOrderArray : [];
  const rosterByUID = new Map(roster.map(r => [Number(r.uid || 0), { uid: Number(r.uid || 0), type: Number(r.type || 0), spd: Number(r.spd || 0) }]));
  const override = getInitiativeOverridePool(ctx, roster);
  const nextQueue = [];
  const seenBase = new Set();
  for (const slot of existing) {
    const uid = Number(slot?.uid || 0);
    const live = rosterByUID.get(uid);
    if (!live) continue;
    const extra = !!slot?.extra;
    if (!extra) {
      if (seenBase.has(uid)) continue;
      seenBase.add(uid);
    }
    nextQueue.push({ uid, type: live.type, spd: live.spd, extra });
  }
  const missingBase = roster.filter(r => !seenBase.has(Number(r.uid || 0))).map(r => ({
    uid: Number(r.uid || 0),
    type: Number(r.type || 0),
    spd: Number(r.spd || 0),
    extra: false,
  }));
  if (!nextQueue.length) {
    return setTurnOrderArrayWithAudit(ctx, buildInitiativeCycle(ctx, roster, 0, override.pool || roster), cause, { ...details, trigger: details.trigger || 'reconcile_initiative_queue', overrideActive: !!override.active });
  }
  if (override.active) {
    const extraSlots = nextQueue
      .filter(slot => !!slot.extra && rosterByUID.has(Number(slot.uid || 0)))
      .map(slot => {
        const live = rosterByUID.get(Number(slot.uid || 0));
        return { uid: live.uid, type: live.type, spd: live.spd, extra: true };
      });
    nextQueue.length = 0;
    for (const slot of buildInitiativeCycle(ctx, roster, currentUID, override.pool || roster)) nextQueue.push(slot);
    for (const slot of extraSlots) nextQueue.push(slot);
  } else if (missingBase.length) {
    const orderedMissing = buildInitiativeCycle(ctx, missingBase, 0);
    for (const slot of orderedMissing) nextQueue.push(slot);
  }
  const after = setTurnOrderArrayWithAudit(ctx, nextQueue, cause, { ...details, trigger: details.trigger || 'reconcile_initiative_queue', preservedCurrentUID: currentUID, missingBaseUIDs: missingBase.map(slot => slot.uid) });
  const idx = after.findIndex(slot => Number(slot.uid || 0) === currentUID);
  if (idx !== -1) g.CurrentTurnIndex = idx;
  else if (after.length <= 0) g.CurrentTurnIndex = 0;
  else g.CurrentTurnIndex = Math.max(0, Math.min(Number(g.CurrentTurnIndex || 0), after.length - 1));
  return after;
}

function syncInitiativeSessionState(ctx) {
  const g = getGlobals(ctx);
  const combatSessionId = Number(g.CombatSessionId || 0);
  if (!Number.isFinite(combatSessionId) || combatSessionId <= 0) return false;
  const initiativeSessionId = Number(g.InitiativeSessionId || 0);
  if (initiativeSessionId === combatSessionId) return false;
  g.InitiativeMeters = {};
  g.InitiativeCurrentUID = 0;
  g.TurnOrderArray = [];
  g.CurrentTurnIndex = 0;
  g.BattleStartRemaining = {};
  g.BattleStartResolved = 0;
  g.ExtraTurnGranted = {};
  g.InitiativeSessionId = combatSessionId;
  return true;
}

function syncInitiativeMeters(ctx, roster) {
  const g = getGlobals(ctx);
  syncInitiativeSessionState(ctx);
  const meters = g.InitiativeMeters || {};
  const rosterUIDs = new Set(roster.map(r => r.uid));
  const meterVals = Object.values(meters).map(v => Number(v) || 0);
  const minMeter = meterVals.length ? Math.min(...meterVals) : 0;
  for (const key of Object.keys(meters)) {
    if (!rosterUIDs.has(Number(key))) delete meters[key];
  }
  for (const r of roster) {
    if (meters[String(r.uid)] == null) {
      // New spawns start at the lowest meter so they trail the queue.
      setMeter(meters, r.uid, minMeter);
    }
  }
  g.InitiativeMeters = meters;
  return meters;
}

function buildInitiativePreview(roster, meters, threshold, count, currentUID, selectionPool = null, tickPool = null) {
  const cycle = roster.map(r => ({ uid: r.uid, type: r.type, spd: Number(r.spd || 0), extra: false })), startPool = Array.isArray(selectionPool) && selectionPool.length && selectionPool.length < cycle.length ? new Set(selectionPool.map(r => Number(r.uid || 0))) : null;
  cycle.sort((a, b) => { const rankA = startPool ? (startPool.has(a.uid) ? 0 : 1) : 0, rankB = startPool ? (startPool.has(b.uid) ? 0 : 1) : 0; return rankA - rankB || (Number(b.spd || 0) - Number(a.spd || 0)) || (Number(a.type || 0) - Number(b.type || 0)) || (Number(a.uid || 0) - Number(b.uid || 0)); });
  const idx = cycle.findIndex(slot => Number(slot.uid || 0) === Number(currentUID || 0));
  return idx > 0 ? cycle.slice(idx).concat(cycle.slice(0, idx)) : cycle;
}

function getInitiativeOverridePool(ctx, roster) {
  const g = getGlobals(ctx);
  const startMode = g.BattleStartMode;
  const startActive = Boolean(startMode && !g.BattleStartResolved);
  if (!startActive) return { active: false, pool: roster };
  const teamType = startMode === 'ambush' ? 1 : 0;
  if (!g.BattleStartRemaining || typeof g.BattleStartRemaining !== 'object') {
    g.BattleStartRemaining = {};
  }
  const remaining = g.BattleStartRemaining;
  if (Object.keys(remaining).length === 0) {
    for (const r of roster) {
      if (r.type === teamType) remaining[r.uid] = true;
    }
  } else if (!Number(g.InitiativeCurrentUID || 0)) {
    for (const r of roster) {
      if (r.type === teamType && !remaining[r.uid]) remaining[r.uid] = true;
    }
  }
  const rosterUIDs = new Set(roster.map(r => r.uid));
  for (const uid of Object.keys(remaining)) {
    const num = Number(uid);
    const inRoster = rosterUIDs.has(num);
    const actor = roster.find(r => r.uid === num);
    if (!inRoster || !actor || actor.type !== teamType) delete remaining[uid];
  }
  if (Object.keys(remaining).length === 0) {
    g.BattleStartResolved = 1;
    g.BattleStartMode = '';
    return { active: false, pool: roster };
  }
  const pool = roster.filter(r => remaining[r.uid]);
  return { active: true, pool, remaining, teamType };
}

function selectNextInitiativeActor(ctx) {
  const g = getGlobals(ctx);
  const roster = getInitiativeRoster(ctx);
  if (!roster.length) {
    g.InitiativeCurrentUID = 0;
    g.CurrentTurnIndex = 0;
    g.TurnOrderArray = [];
    return null;
  }
  syncInitiativeSessionState(ctx);
  let queue = (g.TurnOrderArray || []).filter(slot => GetActorByUID(ctx, slot.uid));
  if (queue.length !== (g.TurnOrderArray || []).length) queue = setTurnOrderArrayWithAudit(ctx, queue, 'initiative_compact_invalid', { trigger: 'select_next_initiative_actor' });
  let idx = queue.findIndex(slot => Number(slot.uid || 0) === Number(g.InitiativeCurrentUID || 0));
  if (idx === -1 && queue.length) idx = Math.max(-1, Math.min(Number(g.CurrentTurnIndex || 0), queue.length) - 1);
  let nextIndex = idx + 1;
  const override = getInitiativeOverridePool(ctx, roster);
  if (!queue.length || nextIndex >= queue.length) {
    const cycle = buildInitiativeCycle(ctx, roster, 0, override.pool || roster);
    queue = setTurnOrderArrayWithAudit(ctx, cycle, 'initiative_cycle_build', { trigger: 'select_next_initiative_actor', rollover: !!(g.TurnOrderArray || []).length, overrideActive: !!override.active });
    nextIndex = 0;
  }
  const next = queue[nextIndex] || null;
  g.CurrentTurnIndex = next ? nextIndex : 0;
  g.InitiativeCurrentUID = next ? Number(next.uid || 0) : 0;
  if (override.active && next && override.remaining && override.remaining[g.InitiativeCurrentUID]) {
    delete override.remaining[g.InitiativeCurrentUID];
    if (Object.keys(override.remaining).length === 0) {
      g.BattleStartResolved = 1;
      g.BattleStartMode = '';
      g.BattleStartRemaining = {};
    }
  }
  return next ? { ...next, meter: 100 } : null;
}

function refreshInitiativePreview(ctx) {
  const g = getGlobals(ctx);
  const roster = getInitiativeRoster(ctx);
  if (!roster.length) {
    g.TurnOrderArray = [];
    g.CurrentTurnIndex = 0;
    g.InitiativeCurrentUID = 0;
    return;
  }
  const curUID = Number(g.InitiativeCurrentUID || 0);
  if (!curUID || !(g.TurnOrderArray || []).length) {
    const override = getInitiativeOverridePool(ctx, roster);
    setTurnOrderArrayWithAudit(ctx, buildInitiativeCycle(ctx, roster, curUID, override.pool || roster), 'initiative_refresh_preview', { trigger: 'refresh_initiative_preview', currentUID: curUID, overrideActive: !!override.active });
  } else {
    reconcileInitiativeQueue(ctx, roster, 'initiative_refresh_preview', { trigger: 'refresh_initiative_preview', currentUID: curUID });
  }
  const idx = g.TurnOrderArray.findIndex(a => a.uid === curUID);
  g.CurrentTurnIndex = idx !== -1 ? idx : 0;
}

function resolvePendingDeathsForInitiative(ctx) {
  const g = getGlobals(ctx);
  const pending = g.PendingDeaths || {};
  for (const uidStr of Object.keys(pending)) {
    const uid = Number(uidStr);
    const actor = GetActorByUID(ctx, uid);
    if (actor && actor.kind === 'enemy') {
      AwardMonsterDrop(ctx, actor.name || actor.key || actor.type || '');
      KillEnemyAt(ctx, actor.slotIndex ?? 0);
    } else if (actor && actor.kind === 'hero') {
      actor.isAlive = false;
    }
    delete pending[uidStr];
  }
  g.PendingDeaths = pending;
  g.GroupResolving = 0;
}

export function BuildTurnOrder(ctx) {
  const g = getGlobals(ctx);
  if (isTimeInitiative(ctx)) {
    refreshInitiativePreview(ctx);
    return;
  }
  if (g.RoundActive) return;
  BuildRoundGroups(ctx);
}

export function RebuildTurnOrderPreserveCurrent(ctx) {
  const g = getGlobals(ctx);
  if (isTimeInitiative(ctx)) {
    refreshInitiativePreview(ctx);
    return;
  }
  if (g.RoundActive) return;
  const prevOrder = (g.TurnOrderArray || []).slice();
  const currentUID = GetCurrentTurn(ctx);
  const idxInPrev = prevOrder.findIndex(a => a.uid === currentUID);
  const currentIndex = idxInPrev !== -1 ? idxInPrev : (g.CurrentTurnIndex || 0);
  const before = prevOrder.map(a => {
    const actor = GetActorByUID(ctx, a.uid);
    const base = actor ? Number(actor.stats?.SPD ?? actor.SPD ?? 0) : 0;
    const buff = actor && actor.kind === 'hero' ? (g.PartyBuff_SPD || 0) : 0;
    const debuff = actor && actor.kind === 'enemy' ? (g.EnemyDebuffs?.[actor.uid]?.SPD || 0) : 0;
    const cur = base + buff - debuff;
    return `${actor ? actor.name : a.uid} ${Math.round(cur)}`;
  });
  BuildTurnOrder(ctx);
  const sorted = g.TurnOrderArray || [];
  const byUid = new Map(sorted.map(a => [a.uid, a]));
  const actedUIDs = prevOrder.slice(0, currentIndex + 1).map(a => a.uid);
  const actedSet = new Set(actedUIDs);
  const actedSegment = actedUIDs.map(uid => byUid.get(uid)).filter(Boolean);
  const remaining = sorted.filter(a => !actedSet.has(a.uid));
  setTurnOrderArrayWithAudit(ctx, actedSegment.concat(remaining), 'rebuild_preserve_current_round', { currentUID, currentIndex, actedUIDs });
  const idx = g.TurnOrderArray.findIndex(a => a.uid === currentUID);
  if (idx !== -1) g.CurrentTurnIndex = idx;
  const after = g.TurnOrderArray.map(a => {
    const actor = GetActorByUID(ctx, a.uid);
    const base = actor ? Number(actor.stats?.SPD ?? actor.SPD ?? 0) : 0;
    const buff = actor && actor.kind === 'hero' ? (g.PartyBuff_SPD || 0) : 0;
    const debuff = actor && actor.kind === 'enemy' ? (g.EnemyDebuffs?.[actor.uid]?.SPD || 0) : 0;
    const cur = base + buff - debuff;
    return `${actor ? actor.name : a.uid} ${Math.round(cur)}`;
  });
  console.log('[TURN][SPD] Rebuild preserve:', {
    currentIndex,
    current: before[currentIndex],
    before,
    after,
    acted: actedSegment.map(a => a.uid),
  });
}

export function GetCurrentTurn(ctx) {
  const g = getGlobals(ctx);
  if (isTimeInitiative(ctx)) {
    return g.InitiativeCurrentUID || 0;
  }
  if (g.RoundActive && Array.isArray(g.RoundGroups) && g.RoundGroups.length) {
    const group = g.RoundGroups[g.RoundGroupIndex] || null;
    const member = group && group.members ? group.members[g.RoundMemberIndex] : null;
    return member ? member.uid : 0;
  }
  const arr = g.TurnOrderArray || [];
  const row = arr[g.CurrentTurnIndex] || null;
  return row ? row.uid : 0;
}

export function GetCurrentType(ctx) {
  const g = getGlobals(ctx);
  if (isTimeInitiative(ctx)) {
    const actor = GetActorByUID(ctx, g.InitiativeCurrentUID || 0);
    return actor && actor.kind === 'enemy' ? 1 : 0;
  }
  if (g.RoundActive && Array.isArray(g.RoundGroups) && g.RoundGroups.length) {
    const group = g.RoundGroups[g.RoundGroupIndex] || null;
    const member = group && group.members ? group.members[g.RoundMemberIndex] : null;
    return member ? member.type : 0;
  }
  const arr = g.TurnOrderArray || [];
  const row = arr[g.CurrentTurnIndex] || null;
  return row ? row.type : 0;
}

export function ProcessCurrentTurn(ctx) {
  const g = getGlobals(ctx);
  if (isTimeInitiative(ctx)) {
    const curUID = g.InitiativeCurrentUID || 0;
    const idx = (g.TurnOrderArray || []).findIndex(a => a.uid === curUID);
    g.CurrentTurnIndex = idx !== -1 ? idx : 0;
    g.TurnPhase = GetCurrentType(ctx) === 0 ? 0 : 2;
    return;
  }
  if (g.RoundActive && Array.isArray(g.RoundGroups) && g.RoundGroups.length) {
    const groups = g.RoundGroups;
    const group = groups[g.RoundGroupIndex] || { members: [] };
    g.RoundMemberIndex = (g.RoundMemberIndex || 0) + 1;
    if (g.RoundMemberIndex >= (group.members || []).length) {
      // end of group: resolve pending deaths for this group
      const pending = g.PendingDeaths || {};
      const resolvedGroup = g.RoundGroupIndex || 0;
      for (const [uidStr, grp] of Object.entries(pending)) {
        if (grp !== resolvedGroup) continue;
        const uid = Number(uidStr);
        const actor = GetActorByUID(ctx, uid);
        if (actor && actor.kind === 'enemy') {
          AwardMonsterDrop(ctx, actor.name || actor.key || actor.type || '');
          KillEnemyAt(ctx, actor.slotIndex ?? 0);
        } else if (actor && actor.kind === 'hero') {
          actor.isAlive = false;
        }
        delete pending[uidStr];
      }
      g.GroupResolving = 0;
      g.RoundMemberIndex = 0;
      g.RoundGroupIndex = (g.RoundGroupIndex || 0) + 1;
      if (g.RoundGroupIndex >= groups.length) {
        g.RoundActive = 0;
        StartRound(ctx);
      }
    }
    // update CurrentTurnIndex for UI (flattened order)
    const flat = g.RoundGroups.flatMap(gr => gr.members || []);
    g.TurnOrderArray = flat.map(a => ({ uid: a.uid, spd: a.spd, type: a.type }));
    const curUID = GetCurrentTurn(ctx);
    const idx = g.TurnOrderArray.findIndex(a => a.uid === curUID);
    if (idx !== -1) g.CurrentTurnIndex = idx;
  } else {
    const arr = g.TurnOrderArray || [];
    const actorCount = arr.length;

    g.CurrentTurnIndex = (g.CurrentTurnIndex || 0) + 1;
    if (actorCount === 0 || g.CurrentTurnIndex >= actorCount) {
      g.CurrentTurnIndex = 0;
      BuildTurnOrder(ctx);
      g.ExtraTurnGranted = {};
    }
  }

  const type = GetCurrentType(ctx);
  g.TurnPhase = type === 0 ? 0 : 2;
}

export function AdvanceTurn(ctx) {
  const g = getGlobals(ctx);
  const currentUID = GetCurrentTurn(ctx);
  const currentType = GetCurrentType(ctx);
  const timeMode = isTimeInitiative(ctx), beforeQueue = snapshotTurnOrderSlots(ctx), beforeIndex = Number(g.CurrentTurnIndex || 0), beforeSlot = beforeQueue[beforeIndex] || null, rolloverCandidate = beforeQueue.length > 0 && beforeIndex >= beforeQueue.length - 1;
  if (currentType === 0 && currentUID) {
    const store = ensurePowerAmpByUID(ctx);
    const entry = store[currentUID];
    if (entry) {
      const mult = Number(entry.mult || 0);
      if (entry.state === 'active_this_turn') {
        delete store[currentUID];
        if (mult) startPowerAmpFade(g, currentUID, mult);
      } else if (
        entry.state === 'pending_next_own_turn' &&
        Number(g.TurnSerial || 0) > Number(entry.armedAtTurnSerial || 0)
      ) {
        // Strict safety net: if a hero reached next own turn but activation was missed,
        // force expiry at that turn end to prevent carryover leaks.
        delete store[currentUID];
        if (mult) startPowerAmpFade(g, currentUID, mult);
      }
    }
  }
  if (currentType === 1 && currentUID) {
    const debuffs = g.EnemyDebuffs?.[currentUID];
    const turns = g.EnemyDebuffTurns?.[currentUID];
    const slots = g.EnemyDebuffSlots?.[currentUID] || [];
    if (debuffs && turns) {
      for (const stat of [...slots]) {
        if (turns[stat] > 0) turns[stat] -= 1;
        if (turns[stat] <= 0) {
          turns[stat] = 0;
          debuffs[stat] = 0;
          const idx = slots.indexOf(stat);
          if (idx !== -1) slots.splice(idx, 1);
        }
      }
    }
  }
  g.TurnSerial = Number(g.TurnSerial || 0) + 1;
  if (timeMode) {
    resolvePendingDeathsForInitiative(ctx);
    selectNextInitiativeActor(ctx);
    ProcessCurrentTurn(ctx);
  } else {
    ProcessCurrentTurn(ctx);
  }
  const afterQueue = snapshotTurnOrderSlots(ctx), afterIndex = Number(g.CurrentTurnIndex || 0), afterSlot = afterQueue[afterIndex] || null, audit = ensureTurnSchedulerAudit(g); let repeatSource = null;
  if (beforeSlot && afterSlot && Number(beforeSlot.uid || 0) === Number(afterSlot.uid || 0)) { if (audit.lastQueueMutation?.source === 'explicit_mechanic') repeatSource = 'explicit_mechanic'; else if (audit.lastQueueMutation?.source === 'collapse_after_future_slot_removal') repeatSource = 'collapse_after_future_slot_removal'; else if (rolloverCandidate) repeatSource = 'cycle_rollover'; else if (timeMode) repeatSource = 'non_compliant_scheduler_behavior'; }
  recordTurnSchedulerEvent(ctx, 'pointer_advance', { cause: timeMode ? 'time_select_next' : (rolloverCandidate ? 'round_cycle_rollover' : 'round_pointer_increment'), beforeUID: beforeSlot ? beforeSlot.uid : 0, afterUID: afterSlot ? afterSlot.uid : 0, beforeIndex, afterIndex, repeatSource, rolloverCandidate, queue: afterQueue });
}

export function TryGrantSpeedExtraTurn(ctx, actorUID) {
  const g = getGlobals(ctx);
  if (g.RoundActive) return false;
  const actor = GetActorByUID(ctx, actorUID);
  if (!actor || actor.kind !== 'hero') return false;
  if ((actor.hp ?? 0) <= 0) return false;
  if (!g.ExtraTurnGranted) g.ExtraTurnGranted = {};
  if (g.ExtraTurnGranted[actorUID]) return false;
  const enemies = getEnemies(ctx).filter(e => (e.hp ?? 0) > 0);
  if (!enemies.length) return false;
  const spdSelf = GetEffectiveStat(ctx, actor, 'SPD');
  let spdOppMax = 0;
  for (const e of enemies) {
    spdOppMax = Math.max(spdOppMax, GetEffectiveStat(ctx, e, 'SPD'));
  }
  const ratio = g.SpeedDoubleRatio || 2.0;
  if (spdSelf < spdOppMax * ratio) return false;
  const arr = g.TurnOrderArray || [];
  const insertAt = Math.min(arr.length, (g.CurrentTurnIndex || 0) + 1);
  arr.splice(insertAt, 0, { uid: actorUID, spd: spdSelf, type: 0, extra: true });
  setTurnOrderArrayWithAudit(ctx, arr, 'explicit_extra_turn_insert', { actorUID, insertAt, effectiveSPD: spdSelf });
  g.ExtraTurnGranted[actorUID] = true;
  return true;
}

export function GetActorByUID(ctx, uid) {
  return getEntities(ctx).find(a => a && a.uid === uid) || null;
}

export function IsHeroTurn(ctx) {
  return GetCurrentType(ctx) === 0;
}

export function IsEnemyTurn(ctx) {
  return GetCurrentType(ctx) === 1;
}

export function GetEffectiveStat(ctx, inst, stat) {
  if (!inst) return 0;
  const g = getGlobals(ctx);
  let base = Number(inst.stats?.[stat] ?? inst[stat] ?? 0);

  if (inst.kind === 'hero') {
    if (stat === 'ATK') base += g.PartyBuff_ATK || 0;
    if (stat === 'DEF') base += g.PartyBuff_DEF || 0;
    if (stat === 'SPD') base += g.PartyBuff_SPD || 0;
    if (stat === 'MAG') base += g.PartyBuff_MAG || 0;
    if (stat === 'RES') base += g.PartyBuff_RES || 0;
  } else if (inst.kind === 'enemy') {
    const debuffs = g.EnemyDebuffs?.[inst.uid];
    if (debuffs && debuffs[stat]) {
      base -= debuffs[stat];
    }
  }

  return Math.max(0, base);
}

export function GetBaseStat(ctx, inst, stat) {
  if (!inst) return 0;
  return Number(inst.stats?.[stat] ?? inst[stat] ?? 0);
}

export function ApplyScaledCrit({
  baseValue,
  relevantBuffTotal,
  sourceType,
  critThreshold = 0.1,
  rngRoll = Math.random(),
}) {
  const value = Number(baseValue) || 0;
  const buff = Math.max(0, Number(relevantBuffTotal) || 0);
  const buffCap = 2;
  let critMultiplierRaw = 1.1;
  if (buff > 0) {
    critMultiplierRaw = Math.min(1 + (buff / 10), 1 + buffCap);
  }
  critMultiplierRaw = Math.min(3.0, critMultiplierRaw);

  let critMultiplier = 1;
  if (sourceType === 'HERO') {
    critMultiplier = critMultiplierRaw;
  } else if (sourceType === 'ENEMY') {
    critMultiplier = 1 + ((critMultiplierRaw - 1) * 0.1);
  }

  const didCrit = rngRoll <= critThreshold;
  return {
    didCrit,
    critMultiplier,
    value: didCrit ? (value * critMultiplier) : value,
  };
}

export function CalculateDamage(ctx, attackerUID, targetUID, mode) {
  const g = getGlobals(ctx);
  const atk = GetActorByUID(ctx, attackerUID);
  const tgt = GetActorByUID(ctx, targetUID);
  if (!atk || !tgt) return 1;

  const isHeroAttacker = atk.kind === 'hero';
  const isHeroDefender = tgt.kind === 'hero';
  const isMagic = mode === 'magic';
  const power = isMagic
    ? (isHeroAttacker ? GetEffectiveStat(ctx, atk, 'MAG') : GetEffectiveStat(ctx, atk, 'MAG'))
    : (isHeroAttacker ? GetEffectiveStat(ctx, atk, 'ATK') : GetEffectiveStat(ctx, atk, 'ATK'));
  const resist = isMagic
    ? (isHeroDefender ? GetEffectiveStat(ctx, tgt, 'RES') : GetEffectiveStat(ctx, tgt, 'RES'))
    : (isHeroDefender ? GetEffectiveStat(ctx, tgt, 'DEF') : GetEffectiveStat(ctx, tgt, 'DEF'));
  const roll = 0.8 + Math.random() * 0.4;
  let dmg = 0;
  if (isHeroAttacker) {
    if (g.IsAOEMatch === 1) {
      dmg = Math.ceil((power - resist / 2) * roll);
    } else {
      dmg = Math.ceil((power - (resist * 0.35)) * roll);
    }
  } else {
    dmg = Math.ceil((power - resist / 2) * roll);
  }
  dmg = Math.max(1, dmg);
  const baseDmg = dmg;
  const crit = ApplyScaledCrit({
    baseValue: dmg,
    relevantBuffTotal: isMagic ? power : power,
    sourceType: isHeroAttacker ? 'HERO' : 'ENEMY',
  });
  dmg = Math.max(1, Math.ceil(crit.value));
  let chainApplied = false;
  if (isHeroAttacker && g.ApplyChainToNextDamage === 1) {
    dmg = Math.ceil(dmg * (g.ChainMultiplier || 1));
    g.ApplyChainToNextDamage = 0;
    chainApplied = true;
  }
  console.log(
    `[DMG_AUDIT] attackerType=${isHeroAttacker ? 'H' : 'E'} base=${baseDmg} final=${dmg} target=${tgt.name || tgt.uid || 'unknown'}`
  );
  console.log(`[DMG_AUDIT] chainApplied=${chainApplied} attackerType=${isHeroAttacker ? 'H' : 'E'}`);
  return dmg;
}

export function ApplyDamageToTarget(ctx, uid, dmg) {
  const t = GetActorByUID(ctx, uid);
  if (!t) return;
  t.hp = Math.max(0, (t.hp ?? 0) - dmg);
  const g = getGlobals(ctx);
  let dx = t.x;
  let dy = t.y;
  if (t.kind === 'hero') {
    const idx = t.heroIndex ?? 0;
    const pos = (g.HeroIconPosByIndex || [])[idx];
    if (pos) {
      dx = pos.x;
      dy = pos.y;
    }
  }
  if (dx != null && dy != null && g.SpawnDamageText !== 0) {
    SpawnDamageText(ctx, dmg, dx, dy, 'damage', t.kind || null);
  }
  if (t.hp === 0) {
    if ((g.RoundActive && g.GroupResolving) || (isTimeInitiative(ctx) && g.GroupResolving)) {
      g.PendingDeaths = g.PendingDeaths || {};
      g.PendingDeaths[t.uid] = g.RoundGroupIndex || 0;
    } else {
      t.isAlive = false;
      if (t.kind === 'enemy') {
        AwardMonsterDrop(ctx, t.name || t.key || t.type || '');
        KillEnemyAt(ctx, t.slotIndex ?? 0);
      }
    }
  }
  UpdateEnemyHPUI(ctx);
  UpdateHeroHPUI(ctx);
}

export function CalculateHeal(ctx, actorUID) {
  const h = GetActorByUID(ctx, actorUID);
  if (!h) return 1;
  const magTotal = GetEffectiveStat(ctx, h, 'MAG');
  const baseHeal = Math.max(1, Math.floor(magTotal * 0.75));
  const sourceType = h.kind === 'hero' ? 'HERO' : 'ENEMY';
  const crit = ApplyScaledCrit({
    baseValue: baseHeal,
    relevantBuffTotal: magTotal,
    sourceType,
  });
  return Math.max(1, Math.floor(crit.value));
}

export function UpdateEnemyHPUI(ctx) {
  const g = getGlobals(ctx);
  g.EnemyHPByIndex = getEnemies(ctx).map(e => e.hp ?? 0);
  g.EnemyMaxHPByIndex = getEnemies(ctx).map(e => e.maxHP ?? 0);
}

export function UpdateHeroHPUI(ctx) {
  const g = getGlobals(ctx);
  const heroes = getHeroes(ctx);
  g.PartyHPByIndex = heroes.map(h => h.hp ?? 0);
  g.PartyMaxHPByIndex = heroes.map(h => h.maxHP ?? 0);
  g.PartyHP = sum(g.PartyHPByIndex || []);
  g.PartyMaxHP = sum(g.PartyMaxHPByIndex || []);
}

export function InitPartyHPFromHeroes(ctx) {
  const g = getGlobals(ctx);
  const heroes = getHeroes(ctx);
  g.PartyHP = sum(heroes.map(h => h.hp ?? 0));
  g.PartyMaxHP = sum(heroes.map(h => h.maxHP ?? 0));
  g.PartyHPByIndex = heroes.map(h => h.hp ?? 0);
  g.PartyMaxHPByIndex = heroes.map(h => h.maxHP ?? 0);
}

export function SyncPartyHPToHeroes(ctx) {
  const g = getGlobals(ctx);
  const heroes = getHeroes(ctx);
  if (heroes.length === 0) return;
  const totalMax = sum(heroes.map(h => h.maxHP ?? 0));
  if (!totalMax) return;
  const ratio = g.PartyMaxHP ? (g.PartyHP / g.PartyMaxHP) : 0;
  for (const h of heroes) {
    const maxHP = h.maxHP ?? 0;
    h.hp = clamp(0, Math.floor(maxHP * ratio), maxHP);
  }
  UpdateHeroHPUI(ctx);
}

export function UpdatePartyHPText(ctx) {
  const g = getGlobals(ctx);
  g.PartyHPText = `${g.PartyHP}/${g.PartyMaxHP}`;
}

export function UpdatePartyHPBar(ctx) {
  const g = getGlobals(ctx);
  g.PartyHPBar = { max: g.PartyMaxHP, value: g.PartyHP };
}

export function Sub_Energy(ctx) {
  const g = getGlobals(ctx);
  g.Player_Energy = (g.Player_Energy || 0) - 3;
  // Yellow recolor path can bypass skill defer wiring; ensure deterministic turn handoff.
  if (Number(g.MatchedColorValue || -1) === 3) {
    const now = Number(g.time || 0);
    g.DeferAdvance = 1;
    g.AdvanceAfterAction = 1;
    if (!Number(g.ActionOwnerUID || 0)) {
      g.ActionOwnerUID = Number(GetCurrentTurn(ctx) || 0);
    }
    const lockUntil = Number(g.ActionLockUntil || 0);
    if (lockUntil <= now) {
      g.ActionLockUntil = now + 0.05;
    }
  }
}

export function Add_Energy(ctx) {
  const g = getGlobals(ctx);
  const roll = Math.random();
  let add = 3;
  if (roll < 0.65) add = 3;
  else if (roll < 0.85) add = 6;
  else if (roll < 0.95) add = 9;
  else add = 15;
  g.Player_Energy = (g.Player_Energy || 0) + add;
  const actorName = getActorNameByUID(ctx, GetCurrentTurn(ctx));
  LogCombat(ctx, `${actorName} grabbed ${add} magic orbs!`);
}

export function AddGoldToPlayer(ctx, amt) {
  const g = getGlobals(ctx);
  const min = 3;
  const max = Math.max(min, Math.floor(amt != null ? amt : 30));
  const cap = Math.min(30, max);
  const curve = Math.max(1, g.GoldDropCurve ?? 2.0);
  let finalAmount = min;
  if (cap >= 30 && Math.random() < 0.015) {
    finalAmount = 30;
  } else {
    const upper = Math.max(min, cap - 1);
    const u = Math.random();
    const biased = Math.pow(u, curve);
    finalAmount = Math.floor(min + (upper - min + 1) * biased);
  }
  g.goldTotal = (g.goldTotal || 0) + finalAmount;
  const actorName = getActorNameByUID(ctx, GetCurrentTurn(ctx));
  LogCombat(ctx, `${actorName} found ${finalAmount} gold!`);
}

function getRandomLivingEnemy(ctx) {
  const enemies = getEnemies(ctx).filter(e => (e.hp ?? 0) > 0);
  if (!enemies.length) return null;
  return enemies[Math.floor(Math.random() * enemies.length)];
}

function ensureEnemyDebuffRecord(ctx, enemyUID) {
  const g = getGlobals(ctx);
  if (!g.EnemyDebuffs) g.EnemyDebuffs = {};
  if (!g.EnemyDebuffSlots) g.EnemyDebuffSlots = {};
  if (!g.EnemyDebuffTurns) g.EnemyDebuffTurns = {};
  if (!g.EnemyDebuffs[enemyUID]) {
    g.EnemyDebuffs[enemyUID] = { ATK: 0, DEF: 0, MAG: 0, RES: 0, SPD: 0 };
  }
  if (!g.EnemyDebuffSlots[enemyUID]) {
    g.EnemyDebuffSlots[enemyUID] = [];
  }
  if (!g.EnemyDebuffTurns[enemyUID]) {
    g.EnemyDebuffTurns[enemyUID] = { ATK: 0, DEF: 0, MAG: 0, RES: 0, SPD: 0 };
  }
  return g.EnemyDebuffs[enemyUID];
}

export function ExecutePurpleDebuff(ctx, actorUID) {
  const g = getGlobals(ctx);
  const enemy = getRandomLivingEnemy(ctx);
  const hero = GetActorByUID(ctx, actorUID);
  if (!enemy || !hero) return;

  const roll = Math.floor(Math.random() * 5);
  const statKeys = ['ATK', 'DEF', 'MAG', 'SPD', 'RES'];
  const stat = statKeys[roll] || 'ATK';

  const heroStat = GetEffectiveStat(ctx, hero, stat);
  const enemyStat = GetBaseStat(ctx, enemy, stat);
  const debuffNames = {
    ATK: 'Attack Down',
    DEF: 'Defense Down',
    MAG: 'Magic Down',
    RES: 'Magic Resistance Down',
    SPD: 'Speed Down',
  };
  const debuffLabel = debuffNames[stat] || `${stat} Down`;
  if (enemyStat > heroStat) {
    LogCombat(ctx, `${hero.name || 'Hero'} tries ${debuffLabel} on ${enemy.name || 'Enemy'}! It failed!`);
    LogCombat(ctx, `${enemy.name || 'Enemy'} resisted ${stat} debuff!`);
    return;
  }

  LogCombat(ctx, `${hero.name || 'Hero'} tries ${debuffLabel} on ${enemy.name || 'Enemy'}! It succeeded!`);
  const debuffs = ensureEnemyDebuffRecord(ctx, enemy.uid);
  const debuffTurns = g.EnemyDebuffTurns[enemy.uid];
  debuffs[stat] = (debuffs[stat] || 0) + 2;
  if (debuffTurns) debuffTurns[stat] = 3;
  const slots = g.EnemyDebuffSlots[enemy.uid];
  if (!slots.includes(stat)) {
  if (slots.length >= 3) {
      const dropped = slots.shift();
      if (dropped) {
        debuffs[dropped] = 0;
        if (debuffTurns) debuffTurns[dropped] = 0;
      }
    }
    slots.push(stat);
  }
  LogCombat(ctx, `${enemy.name || 'Enemy'} ${stat} down! (${debuffs[stat]})`);
  g.EnemyDebuffPop = { uid: enemy.uid, stat, at: g.time || 0 };
  RebuildTurnOrderPreserveCurrent(ctx);
}

export function ApplyDamage(ctx, targetUID, dmg) {
  ApplyDamageToTarget(ctx, targetUID, dmg);
}

export function ApplyPartyDamage(ctx, dmg) {
  const heroes = getHeroes(ctx);
  for (const h of heroes) {
    h.hp = Math.max(0, (h.hp ?? 0) - dmg);
    if (h.hp === 0) h.isAlive = false;
  }
  UpdateHeroHPUI(ctx);
}

export function MeleeCalc(ctx, attackerUID, targetUID) {
  return CalculateDamage(ctx, attackerUID, targetUID, 'melee');
}

export function MagicCalc(ctx, attackerUID, targetUID) {
  return CalculateDamage(ctx, attackerUID, targetUID, 'magic');
}

export function HeroAttackSingle(ctx, heroUID, targetUID) {
  const actorName = getActorNameByUID(ctx, heroUID);
  const target = GetActorByUID(ctx, targetUID);
  if (!target) {
    LogCombat(ctx, `${actorName} had no target`);
    return;
  }
  const actor = GetActorByUID(ctx, heroUID);
  const mode = actor && actor.attackType === 'magic' ? 'magic' : 'melee';
  const dmg = CalculateDamage(ctx, heroUID, targetUID, mode);
  let ampMult = GetPowerAmpMultiplierForActor(ctx, heroUID);
  if (ampMult > 0) {
    const consumed = ConsumePowerAmpForActor(ctx, heroUID);
    if (consumed > 0) ampMult = consumed;
  }
  const g = getGlobals(ctx);
  const now = g.time || 0;
  const hitDelay = Math.max(0.14 + 0.32, 0.46);
  const applyAt = now + hitDelay;
  g.PendingHeroHits = g.PendingHeroHits || [];
  g.PendingHeroHits.push({
    at: applyAt,
    heroUID,
    targetUID,
    dmg,
    powerAmpMultiplier: ampMult,
    consumePowerAmp: ampMult > 0 ? 1 : 0,
    calcPath: mode === 'magic' ? 'magicCalc' : 'meleeCalc',
    heroName: actorName,
    heroType: mode,
    msg: `${actorName} hit ${target.name || '?'} for ${dmg}!`,
  });
}

export function HeroAttackAOE(ctx, heroUID) {
  const actor = GetActorByUID(ctx, heroUID);
  const actorName = actor ? (actor.name || '?') : '?';
  const mode = actor && actor.attackType === 'magic' ? 'magic' : 'melee';
  const heroIndex = actor && actor.heroIndex != null ? actor.heroIndex : 0;
  const isKojonn = heroIndex === 3;
  const aoeName = isKojonn ? 'Burst' : (['Pummel', 'Swipe', 'Burst', 'Faze'][heroIndex] || 'AOE');
  let totalDamage = 0;
  const g = getGlobals(ctx);
  let ampMult = GetPowerAmpMultiplierForActor(ctx, heroUID);
  if (ampMult > 0) {
    const consumed = ConsumePowerAmpForActor(ctx, heroUID);
    if (consumed > 0) ampMult = consumed;
  }
  const enemies = getEnemies(ctx);
  const hits = [];
  for (const e of enemies) {
    const dmg = CalculateDamage(ctx, heroUID, e.uid, mode);
    const finalDmg = ampMult > 0 ? Math.max(1, Math.ceil(dmg * ampMult)) : dmg;
    hits.push({ targetUID: e.uid, dmg, powerAmpMultiplier: ampMult, consumePowerAmp: 0, finalDmg });
    totalDamage += finalDmg;
  }
  if (hits.length > 0 && ampMult > 0) hits[0].consumePowerAmp = 1;
  const now = g.time || 0;
  const hitDelay = Math.max(0.14 + 0.32, 0.46);
  const applyAt = now + hitDelay;
  g.PendingHeroHits = g.PendingHeroHits || [];
  for (const hit of hits) {
    g.PendingHeroHits.push({
      at: applyAt,
      heroUID,
      targetUID: hit.targetUID,
      dmg: hit.dmg,
      powerAmpMultiplier: hit.powerAmpMultiplier,
      consumePowerAmp: hit.consumePowerAmp,
      calcPath: mode === 'magic' ? 'magicCalc' : 'meleeCalc',
      heroName: actorName,
      heroType: mode,
    });
  }
  LogCombat(ctx, `${actorName} used ${aoeName} on all enemies for ${totalDamage}!`);
}

export function Enemy_ATK_Single(ctx, enemyUID, targetHeroUID) {
  const dmg = CalculateDamage(ctx, enemyUID, targetHeroUID, 'melee');
  ApplyDamageToTarget(ctx, targetHeroUID, dmg);
  const enemyName = getActorNameByUID(ctx, enemyUID);
  const heroName = getActorNameByUID(ctx, targetHeroUID);
  LogCombat(ctx, `${enemyName} hit ${heroName} for ${dmg}!`);
}

export function Enemy_MAG_Single(ctx, enemyUID, targetHeroUID) {
  const dmg = CalculateDamage(ctx, enemyUID, targetHeroUID, 'magic');
  ApplyDamageToTarget(ctx, targetHeroUID, dmg);
  const enemyName = getActorNameByUID(ctx, enemyUID);
  const heroName = getActorNameByUID(ctx, targetHeroUID);
  LogCombat(ctx, `${enemyName} cast on ${heroName} for ${dmg}!`);
}

export function Enemy_Heal_Self(ctx, enemyUID) {
  const enemy = GetActorByUID(ctx, enemyUID);
  if (!enemy) return;
  const heal = Math.max(1, Math.floor((enemy.stats?.MAG ?? enemy.MAG ?? 0) * 0.5));
  enemy.hp = Math.min(enemy.maxHP ?? enemy.hp, (enemy.hp ?? 0) + heal);
  SpawnDamageText(ctx, heal, enemy.x ?? 0, enemy.y ?? 0, 'heal', 'enemy');
  LogCombat(ctx, `${enemy.name || 'Enemy'} healed for ${heal}!`);
}

export function PickNextEnemyID(ctx) {
  const g = getGlobals(ctx);
  const pool = Array.isArray(g.EnemyData) ? g.EnemyData : [];
  if (pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] || null;
}

export function SpawnEnemy(ctx, enemyData, slotIndex = 0) {
  if (!enemyData) return null;
  const g = getGlobals(ctx);
  const uid = nextUID(ctx);
  const enemy = {
    uid,
    kind: 'enemy',
    name: enemyData.name || `Enemy_${uid}`,
    hp: Number(enemyData.HP ?? 0),
    maxHP: Number(enemyData.HP ?? enemyData.maxHP ?? 0),
    stats: {
      ATK: Number(enemyData.ATK ?? 0),
      DEF: Number(enemyData.DEF ?? 0),
      MAG: Number(enemyData.MAG ?? 0),
      RES: Number(enemyData.RES ?? 0),
      SPD: Number(enemyData.SPD ?? 0),
    },
    slotIndex,
    originX: SlotX(ctx, slotIndex),
    originY: SlotY(ctx, slotIndex),
    x: SlotX(ctx, slotIndex),
    y: SlotY(ctx, slotIndex),
    isAlive: true,
  };
  ensureEntities(ctx).push(enemy);
  g.EnemyIDs = g.EnemyIDs || [];
  g.EnemyIDs[slotIndex] = enemy.uid;
  g.EnemySlots = g.EnemySlots || [];
  g.EnemySlots[slotIndex] = enemy.uid + 1;
  if (!g.InitialSpawn) {
    g.NewSpawnUIDs = g.NewSpawnUIDs || {};
    g.NewSpawnUIDs[enemy.uid] = true;
  }
  UpdateEnemyHPUI(ctx);
  if (isTimeInitiative(ctx)) {
    const roster = getInitiativeRoster(ctx);
    syncInitiativeMeters(ctx, roster);
    reconcileInitiativeQueue(ctx, roster, 'spawn_insertion', { trigger: 'spawn_enemy', spawnedUID: enemy.uid, slotIndex });
  }
  return enemy;
}

export function KillEnemyAt(ctx, slotIndex) {
  const g = getGlobals(ctx);
  const currentUID = GetCurrentTurn(ctx);
  g.EnemySlots = g.EnemySlots || [];
  if (g.EnemySlots.length === 0 && Array.isArray(g.EnemyIDs)) {
    g.EnemySlots = g.EnemyIDs.map(uid => (uid ? uid + 1 : 0));
  }
  const deadCell = g.EnemySlots[slotIndex] || 0;
  if (deadCell <= 0) return;
  const deadUID = deadCell - 1;
  const entities = ensureEntities(ctx);
  const idx = entities.findIndex(e => e && e.uid === deadUID);
  if (idx !== -1) entities.splice(idx, 1);
  if (g.EnemyDebuffs && g.EnemyDebuffs[deadUID]) delete g.EnemyDebuffs[deadUID];
  if (g.EnemyDebuffSlots && g.EnemyDebuffSlots[deadUID]) delete g.EnemyDebuffSlots[deadUID];
  if (g.EnemyDebuffTurns && g.EnemyDebuffTurns[deadUID]) delete g.EnemyDebuffTurns[deadUID];
  if (g.SelectedEnemyUID === deadUID) g.SelectedEnemyUID = 0;
  g.EnemySlots[slotIndex] = 0;
  if (Array.isArray(g.EnemyIDs)) g.EnemyIDs[slotIndex] = 0;
  g.IsPlayerBusy = 1;
  recordTurnSchedulerEvent(ctx, 'removal_commit', { cause: 'kill_enemy_at', removed: [{ uid: deadUID, kind: 'enemy', slotIndex }], currentUID });
  if (isTimeInitiative(ctx)) {
    const nextQueue = (g.TurnOrderArray || []).filter(slot => Number(slot?.uid || 0) !== deadUID && GetActorByUID(ctx, Number(slot?.uid || 0)));
    setTurnOrderArrayWithAudit(ctx, nextQueue, 'initiative_remove_actor', { trigger: 'kill_enemy_at', removedUID: deadUID, slotIndex, currentUID });
    if (Number(g.InitiativeCurrentUID || 0) === deadUID) g.InitiativeCurrentUID = 0;
    if (nextQueue.length <= 0) g.CurrentTurnIndex = 0;
    else if (Number(g.CurrentTurnIndex || 0) >= nextQueue.length) g.CurrentTurnIndex = Math.max(0, nextQueue.length - 1);
  }
  UpdateEnemyHPUI(ctx);
  const respawnDelay = Math.max(0.4, (g.DamageTextDurationSec || 1.35));
  setTimeout(() => {
    const pick = PickNextEnemyID(ctx);
    if (pick) SpawnEnemy(ctx, pick, slotIndex);
    UpdateEnemyHPUI(ctx);
    if (!g.RoundActive && !g.BattleStartActive) {
      StartRound(ctx);
      g.IsPlayerBusy = 0;
    }
  }, respawnDelay * 1000);
}

export function Add_Gold(ctx, amt) {
  AddGoldToPlayer(ctx, amt);
}

export function UpdateChain(ctx, color) {
  const g = getGlobals(ctx);
  if (g.LastMatchColor === color) g.ChainNumber = (g.ChainNumber || 0) + 1;
  else g.ChainNumber = 1;
  g.LastMatchColor = color;
  g.ChainMultiplier = g.ChainNumber >= 3 ? 1.25 : 1;
}

export function AddToken(ctx, tokenId, amount = 1) {
  if (!tokenId) return 0;
  const wallet = ensureTokenWallet(ctx);
  const key = String(tokenId);
  const next = (wallet[key] || 0) + (Number(amount) || 0);
  wallet[key] = Math.max(0, next);
  return wallet[key];
}

export function SpendToken(ctx, tokenId, amount = 1) {
  if (!tokenId) return false;
  const wallet = ensureTokenWallet(ctx);
  const key = String(tokenId);
  const current = wallet[key] || 0;
  if (current < amount) return false;
  wallet[key] = current - amount;
  return true;
}

export function GetTokenBalance(ctx, tokenId) {
  if (!tokenId) return 0;
  const wallet = ensureTokenWallet(ctx);
  return wallet[String(tokenId)] || 0;
}

export function ResolveMonsterDrop(ctx, monsterName, tierIndex = null) {
  const monsterId = getMonsterIdByName(monsterName);
  if (monsterId < 0) return EMPTY;
  const tiers = MONSTER_LOOT_TABLE[monsterId] || [];
  const idx = tierIndex == null ? pickDropTier(getGlobals(ctx)) : Math.max(0, Math.min(3, Math.floor(tierIndex)));
  return tiers[idx] ?? EMPTY;
}

const TH_DROP_RATE_THRESHOLDS = [2400, 1500, 1000, 500, 100, 50, 0];
const TH_DROP_RATE_TABLE = {
  2400: [2400, 2520, 2640, 2760, 2880, 3000, 3120, 3240, 3360, 3480, 3600],
  1500: [1500, 1650, 1800, 1950, 2100, 2250, 2400, 2550, 2700, 2850, 3000],
  1000: [1000, 1175, 1350, 1525, 1700, 1875, 2050, 2225, 2400, 2575, 2750],
  500: [500, 700, 900, 1100, 1300, 1500, 1700, 1900, 2100, 2300, 2500],
  100: [100, 220, 340, 460, 580, 700, 820, 940, 1060, 1180, 1300],
  50: [50, 130, 210, 290, 370, 450, 530, 610, 690, 770, 850],
  0: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
};

function sanitizeBps(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10000, Math.floor(n)));
}

function sanitizeThLevel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function getDropRateBracket(dropRate) {
  const bps = sanitizeBps(dropRate);
  for (const threshold of TH_DROP_RATE_THRESHOLDS) {
    if (bps >= threshold) return threshold;
  }
  return 0;
}

export function getDropRate(thLevel, dropRate) {
  const base = sanitizeBps(dropRate);
  const level = sanitizeThLevel(thLevel);
  const bracket = getDropRateBracket(base);
  const row = TH_DROP_RATE_TABLE[bracket];
  if (!Array.isArray(row) || row.length === 0) return base;
  const idx = Math.min(level, row.length - 1);
  const transformed = Number(row[idx]);
  if (!Number.isFinite(transformed)) return base;
  return sanitizeBps(transformed);
}

export function GetDropRateBracket(ctx, dropRate) {
  return getDropRateBracket(dropRate);
}

export function GetDropRate(ctx, thLevel, dropRate) {
  return getDropRate(thLevel, dropRate);
}

export function AwardMonsterDrop(ctx, monsterName, tierIndex = null) {
  const g = getGlobals(ctx);
  const thLevel = Number(g.TreasureHunterLevel ?? g.THLevel ?? g.DebugTHLevel ?? 0);
  const baseDropRate = Number(g.LootDropRateBps ?? g.DropRateBps ?? 10000);
  const transformedDropRate = getDropRate(thLevel, baseDropRate);
  const rollsPerDeath = 4;
  const awarded = [];
  for (let i = 0; i < rollsPerDeath; i++) {
    const roll = Math.floor(Math.random() * 10000);
    if (roll >= transformedDropRate) {
      awarded.push('EMPTY');
      continue;
    }
    const dropId = ResolveMonsterDrop(ctx, monsterName, tierIndex);
    const parsed = parseDropId(dropId);
    if (parsed.type === 'TOKEN') {
      const registry = TOKEN_REGISTRY[parsed.id];
      const activeEvent = getActiveEventByToken(parsed.id);
      if (!activeEvent && registry && registry.fallback && registry.fallback !== EMPTY) {
        const fallbackParsed = parseDropId(registry.fallback);
        if (fallbackParsed.type === 'TOKEN') {
          AddToken(ctx, fallbackParsed.id, 1);
          LogCombat(ctx, `Token drop (fallback): ${fallbackParsed.id}`);
          awarded.push(fallbackParsed.id);
          continue;
        }
        if (registry.fallback === EMPTY) {
          awarded.push('EMPTY');
          continue;
        }
      }
      AddToken(ctx, parsed.id, 1);
      LogCombat(ctx, `Token drop: ${parsed.id}`);
      awarded.push(parsed.id);
      continue;
    }
    if (parsed.type === 'ITEM') {
      LogCombat(ctx, `Item drop: ${parsed.id}`);
      awarded.push(parsed.id);
      continue;
    }
    awarded.push('EMPTY');
  }
  console.log(`[LOOT] Monster ${monsterName} awarded: ${awarded.join(', ')}`);
  return awarded.find(v => v && v !== 'EMPTY') || EMPTY;
}

export function SpendTokensOnEvent(ctx, eventId, amount) {
  if (!eventId || !amount) return false;
  const event = (LIVE_OPS_EVENTS || []).find(e => e.id === eventId);
  if (!event) return false;
  const tokenId = event.token_id;
  if (!SpendToken(ctx, tokenId, amount)) return false;
  const progress = getOrCreateEventProgress(ctx, eventId);
  progress.totalSpent += amount;
  let remaining = amount;
  while (remaining > 0) {
    const tier = event.tiers[progress.tierIndex];
    if (!tier) break;
    const tierRemaining = Math.max(0, tier.required - progress.tierProgress);
    const spendNow = Math.min(remaining, tierRemaining);
    progress.tierProgress += spendNow;
    remaining -= spendNow;
    const milestones = tier.milestones || [];
    const nextMilestone = milestones[progress.milestoneIndex];
    if (nextMilestone && progress.tierProgress >= nextMilestone.spend) {
      for (const reward of nextMilestone.rewards || []) applyRewardPayload(ctx, reward);
      progress.milestoneIndex += 1;
    }
    if (progress.tierProgress >= tier.required) {
      for (const reward of tier.rewards || []) applyRewardPayload(ctx, reward);
      progress.tierIndex += 1;
      progress.tierProgress = 0;
      progress.milestoneIndex = 0;
    }
  }
  return true;
}

export function GetChainMultiplier(ctx, chainNum) {
  if (chainNum <= 1) return 1.0;
  if (chainNum === 2) return 1.2;
  if (chainNum === 3) return 1.25;
  if (chainNum === 4) return 1.3;
  if (chainNum === 5) return 1.4;
  if (chainNum === 6) return 1.5;
  return 1.55;
}

export function ApplyChain(ctx, chainNum) {
  const g = getGlobals(ctx);
  const uiChain = Math.max(0, (chainNum || 0) - 1);
  if (uiChain > 1) {
    g.SuppressChainUI = 0;
    g.ChainUIHideAt = (g.time || 0) + (g.ChainUIDuration || 0);
    g.ApplyChainToNextDamage = 1;
  } else {
    g.ChainUIHideAt = 0;
  }
}

export function ShowAttackUI(ctx) {
  const g = getGlobals(ctx);
  g.CanPickGems = false;
  g.IsPlayerBusy = 1;
  g.SuppressChainUI = 0;
  g.TurnPhase = 1;
  g.HideHeroSelector = 1;
  g.DeferAdvance = 0;
  g.ActionLockUntil = 0;
}

export function HideAttackUI(ctx) {
  const g = getGlobals(ctx);
  g.CanPickGems = true;
  g.IsPlayerBusy = 0;
  g.SuppressChainUI = 0;
  g.TurnPhase = 0;
}

export function DestroyGem(ctx) {
  const gems = getGems(ctx);
  const filtered = gems.filter(g => !(g.selected || g.Selected));
  setGems(ctx, filtered);
}

export function ClearMatchState(ctx) {
  const gems = getGems(ctx);
  for (const gem of gems) {
    gem.selected = false;
    gem.Selected = 0;
  }
  setSelectedGemIndices(ctx, []);
  getGlobals(ctx).TapIndex = 0;
}

export function RefreshSelectors(ctx) {
  const g = getGlobals(ctx);
  if (Array.isArray(g.Selectors)) {
    for (const s of g.Selectors) s.visible = true;
  }
}

export function Update_Bars(ctx) {
  UpdatePartyHPBar(ctx);
  UpdatePartyHPText(ctx);
}

export function RefreshPartyBuffUI(ctx) {
  const g = getGlobals(ctx);
  if (g.BuffRollActive) return;
  const track = g.TrackBuffs || [];
  const ordered = [
    { type: 'atk', active: g.PartyBuff_ATK > 0 && g.BuffTurns_ATK > 0 },
    { type: 'def', active: g.PartyBuff_DEF > 0 && g.BuffTurns_DEF > 0 },
    { type: 'mag', active: g.PartyBuff_MAG > 0 && g.BuffTurns_MAG > 0 },
    { type: 'res', active: g.PartyBuff_RES > 0 && g.BuffTurns_RES > 0 },
  ];
  g.PartyBuffUI = {
    atk: ordered[0].active,
    def: ordered[1].active,
    mag: ordered[2].active,
    res: ordered[3].active,
  };
  g.PartyBuffSlots = ordered.filter(b => b.active).map(b => b.type);
  g.BuffFrames = [
    track[0] ?? -1,
    track[1] ?? -1,
    track[2] ?? -1,
    track[3] ?? -1,
  ];
}

export function ResolveGemAction(ctx, gemColor, actorUID, consumedCount = 0) {
  const g = getGlobals(ctx);
  g.HideHeroSelector = 1;
  if (gemColor === 0) {
    g.IsAOEMatch = 1;
    LogGemIntent(ctx, 0, 'GREEN', 'HERO_AOE', '', actorUID);
    g.PendingSkillID = 'HERO_AOE';
    g.PendingActor = actorUID;
    ShowAttackUI(ctx);
    return;
  }
  if (gemColor === 1) {
    g.PendingSkillID = 'HERO_SINGLE';
    g.PendingActor = actorUID;
    g.IsAOEMatch = 0;
    LogGemIntent(ctx, 1, 'RED', 'HERO_SINGLE', '', actorUID);
    ShowAttackUI(ctx);
    return;
  }
  if (gemColor === 2) {
    g.IsAOEMatch = 0;
    const roll = Math.floor(Math.random() * 4);
    let skillId = 'DEF_UP';
    let intentKey = 'Party_DEF_UP';
    let buffType = 0;
    if (roll === 1) { skillId = 'ATK_UP'; intentKey = 'Party_ATK_UP'; }
    if (roll === 2) { skillId = 'MAG_UP'; intentKey = 'Party_MAG_UP'; }
    if (roll === 3) { skillId = 'RES_UP'; intentKey = 'Party_RES_UP'; buffType = 4; }
    if (roll === 1 || roll === 2) buffType = roll;
    LogGemIntent(ctx, 2, 'BLUE', intentKey, '', actorUID);
    g.BuffRollSkillID = skillId;
    g.BuffRollActor = actorUID;
    g.BuffRollType = buffType;
    g.BuffRollApplyStat = 0;
    const consumedBlue = Math.max(0, Number(consumedCount) || 0);
    const wallet = ensureAstralFlowWallet(ctx);
    g.AstralFlowWallet = wallet + consumedBlue;
    LogCombat(ctx, `${getActorNameByUID(ctx, actorUID)} channeled ${consumedBlue} Astral Flow.`);
    StartBuffRoll(ctx);
    return;
  }
  if (gemColor === 3) {
    LogGemIntent(ctx, 3, 'YELLOW', 'Casino_Recolor', '', actorUID);
    return;
  }
  if (gemColor === 4) {
    LogGemIntent(ctx, 4, 'LIGHTGREEN', 'Do_Heal', '', actorUID);
    ctx.callFunction('DoHeal', actorUID);
    return;
  }
  if (gemColor === 5) {
    LogGemIntent(ctx, 5, 'PURPLE', 'Power_Amp', 'hero-routing', actorUID);
    activatePowerAmp(ctx, actorUID);
    g.ActionLockUntil = (g.time || 0) + 0.6;
    g.DeferAdvance = 1;
    g.AdvanceAfterAction = 1;
    g.ActionOwnerUID = actorUID;
    return;
  }
}

export function Update_Bars_And_Buffs(ctx) {
  Update_Bars(ctx);
  RefreshPartyBuffUI(ctx);
}

export function DebugTest() {}

export function BuildRoundGroups(ctx) {
  const g = getGlobals(ctx);
  if (isTimeInitiative(ctx)) {
    const roster = getInitiativeRoster(ctx);
    if (!roster.length) {
      g.InitiativeMeters = {};
      g.TurnOrderArray = [];
      g.InitiativeCurrentUID = 0;
      g.CurrentTurnIndex = 0;
      return;
    }
    syncInitiativeMeters(ctx, roster);
    if (g.BattleStartMode && !g.BattleStartResolved) {
      g.BattleStartRemaining = {};
      const teamType = g.BattleStartMode === 'ambush' ? 1 : 0;
      for (const r of roster) {
        if (r.type === teamType) g.BattleStartRemaining[r.uid] = true;
      }
    }
    if (!g.InitiativeCurrentUID) {
      selectNextInitiativeActor(ctx);
    } else {
      refreshInitiativePreview(ctx);
    }
    g.RoundActive = 0;
    return;
  }
  const roster = [];
  const seen = new Set();
  for (const h of getHeroes(ctx)) {
    if ((h.hp ?? 0) > 0) {
      if (seen.has(h.uid)) continue;
      const spd = GetEffectiveStat(ctx, h, 'SPD');
      roster.push({ uid: h.uid, type: 0, spd });
      seen.add(h.uid);
    }
  }
  for (const e of getEnemies(ctx)) {
    if ((e.hp ?? 0) > 0) {
      if (seen.has(e.uid)) continue;
      const spd = GetEffectiveStat(ctx, e, 'SPD');
      roster.push({ uid: e.uid, type: 1, spd });
      seen.add(e.uid);
    }
  }
  if (!roster.length) {
    g.RoundRoster = [];
    g.RoundGroups = [];
    g.RoundGroupIndex = 0;
    g.RoundMemberIndex = 0;
    g.RoundActive = 0;
    g.PendingDeaths = {};
    g.TurnOrderArray = [];
    g.CurrentTurnIndex = 0;
    return;
  }
  const jitter = g.RoundJitter ?? 0;
  const tol = g.UnisonTolerance ?? 0.5;
  const withInit = roster.map(r => ({
    ...r,
    init: r.spd + ((Math.random() * 2 - 1) * jitter)
  }));
  const startMode = g.BattleStartMode;
  const startModeApplied = Boolean(startMode && !g.BattleStartResolved);
  if (startModeApplied) {
    const heroes = withInit.filter(a => a.type === 0).sort((a, b) => b.init - a.init);
    const enemies = withInit.filter(a => a.type === 1).sort((a, b) => b.init - a.init);
    withInit.length = 0;
    if (startMode === 'ambush') withInit.push(...enemies, ...heroes);
    else withInit.push(...heroes, ...enemies);
    g.BattleStartResolved = 1;
  } else {
    withInit.sort((a, b) => b.init - a.init);
  }
  const groups = [];
  let lastType = null;
  for (const actor of withInit) {
    if (!groups.length) {
      groups.push({ init: actor.init, members: [actor] });
      lastType = actor.type;
      continue;
    }
    const last = groups[groups.length - 1];
    const boundary = startModeApplied && lastType !== actor.type;
    if (!boundary && Math.abs(last.init - actor.init) <= tol) {
      last.members.push(actor);
    } else {
      groups.push({ init: actor.init, members: [actor] });
    }
    lastType = actor.type;
  }
  g.RoundRoster = withInit;
  g.RoundGroups = groups;
  g.RoundGroupIndex = 0;
  g.RoundMemberIndex = 0;
  g.RoundActive = 1;
  g.PendingDeaths = {};
  g.GroupResolving = 0;
  g.ActiveGroupIndex = 0;
  const flat = groups.flatMap(gr => gr.members || []);
  g.TurnOrderArray = flat.map(a => ({ uid: a.uid, spd: a.spd, type: a.type }));
  g.CurrentTurnIndex = 0;
  console.log('[ROUND] Built groups:', groups.map(gp => gp.members.map(m => {
    const a = GetActorByUID(ctx, m.uid);
    return a && a.name ? a.name : m.uid;
  }).join(',')).join(' | '));
}

export function StartRound(ctx) {
  BuildRoundGroups(ctx);
}

export function SortTurnOrder(ctx) {
  const g = getGlobals(ctx);
  if (isTimeInitiative(ctx)) return;
  const arr = g.TurnOrderArray || [];
  arr.sort((a, b) => (b.spd || 0) - (a.spd || 0));
  g.TurnOrderArray = arr;
}

export function LogCombat(ctx, text) {
  const g = getGlobals(ctx);
  const lines = g.CombatActionLines || ['', '', '', ''];
  lines[0] = lines[1];
  lines[1] = lines[2];
  lines[2] = lines[3];
  lines[3] = String(text || '');
  g.CombatActionLines = lines;
  logLine(ctx, text);
}

export function LogGemIntent(ctx, frame, colorName, intentKey, extra, actorUID) {
  const g = getGlobals(ctx);
  const whoName = getActorNameByUID(ctx, actorUID);
  const suffix = extra && String(extra).length ? ` (${extra})` : '';
  g.ActorIntent = `[GEM f${frame} ${colorName}] ${whoName} -> ${intentKey}${suffix}`;
}

export function ExecuteSkill(ctx, skillId, actorUID) {
  const g = getGlobals(ctx);
  g.IsAOEMatch = 0;
  let handled = false;
  const actor = GetActorByUID(ctx, actorUID);
  const actorName = actor ? actor.name : 'Actor';
  console.log(`[SKILL] start skill=${skillId} actor=${actorName} uid=${actorUID} phase=${g.TurnPhase} busy=${g.IsPlayerBusy} canPick=${g.CanPickGems}`);
  const buffTurns = Math.min(12, g.BuffDurationDefault || 12);
  if (actor && actor.kind === 'hero' && (skillId === 'HERO_SINGLE' || skillId === 'HERO_AOE')) {
    StartHeroLunge(ctx, actorUID);
  }

  if (skillId === 'DEF_UP') {
    handled = true;
    ctx.callFunction('Party_DEF_UP', buffTurns, actorUID, 0, 2);
    LogCombat(ctx, `${actorName} increased the party's defense!`);
  } else if (skillId === 'ATK_UP') {
    handled = true;
    ctx.callFunction('Party_ATK_UP', buffTurns, actorUID, 0, 2);
    LogCombat(ctx, `${actorName} increased the party's attack!`);
  } else if (skillId === 'MAG_UP') {
    handled = true;
    ctx.callFunction('Party_MAG_UP', buffTurns, actorUID, 0, 2);
    LogCombat(ctx, `${actorName} increased the party's magic attack!`);
  } else if (skillId === 'RES_UP') {
    handled = true;
    ctx.callFunction('Party_RES_UP', buffTurns, actorUID, 0, 2);
    LogCombat(ctx, `${actorName} increased the party's magic defense!`);
  } else if (skillId === 'HERO_SINGLE') {
    handled = true;
    const enemies = getEnemies(ctx);
    const preferred = g.SelectedEnemyUID ? GetActorByUID(ctx, g.SelectedEnemyUID) : null;
    const target = preferred && preferred.kind === 'enemy' ? preferred : enemies[0];
    if (target) HeroAttackSingle(ctx, actorUID, target.uid);
    const now = g.time || 0;
    g.ActionLockUntil = Math.max(g.ActionLockUntil || 0, now + 0.5);
  } else if (skillId === 'HERO_AOE') {
    handled = true;
    HeroAttackAOE(ctx, actorUID);
    const now = g.time || 0;
    g.ActionLockUntil = Math.max(g.ActionLockUntil || 0, now + 0.5);
  } else if (skillId === 'Enemy_ATK_Single') {
    handled = true;
    const target = randomPick(getHeroes(ctx));
    if (target) Enemy_ATK_Single(ctx, actorUID, target.uid);
  } else if (skillId === 'Enemy_MAG_Single') {
    handled = true;
    const target = randomPick(getHeroes(ctx));
    if (target) Enemy_MAG_Single(ctx, actorUID, target.uid);
  } else if (skillId === 'Enemy_MAG_AOE') {
    handled = true;
    g.IsAOEMatch = 1;
    for (const h of getHeroes(ctx)) {
      const dmg = CalculateDamage(ctx, actorUID, h.uid, 'magic');
      ApplyDamageToTarget(ctx, h.uid, dmg);
    }
  }

  if (!handled) {
    LogCombat(ctx, `${actorName} tried skill: ${skillId} (UNKNOWN)`);
  }

  g.ActionLockUntil = (g.time || 0) + 0.6;
  if (g.ActionLockUntil && (g.time || 0) < g.ActionLockUntil) {
    g.DeferAdvance = 1;
    g.AdvanceAfterAction = 1;
    g.ActionOwnerUID = actorUID;
    console.log(`[SKILL] defer skill=${skillId} owner=${actorUID} lockUntil=${g.ActionLockUntil.toFixed(3)} phase=${g.TurnPhase} busy=${g.IsPlayerBusy} canPick=${g.CanPickGems}`);
    return;
  }
  console.log(`[SKILL] immediate-advance skill=${skillId} actor=${actorName} uid=${actorUID}`);
  AdvanceTurn(ctx);
  ProcessTurn(ctx);
}

export function ResolveEnemyAction(ctx, enemyUID) {
  const enemy = GetActorByUID(ctx, enemyUID);
  if (!enemy) return 0;
  let handled = 0;
  const roll = Math.random();
  const name = enemy.name || '';

  if (!handled && name === 'Chimerilass' && enemy.hp < enemy.maxHP && roll < 0.49) {
    ExecuteEnemySkill(ctx, enemyUID, 'Enemy_Heal_Self');
    handled = 1;
  }
  if (!handled && name === 'Djinn' && roll < 0.85) {
    ExecuteEnemySkill(ctx, enemyUID, 'Enemy_MAG_Single');
    handled = 1;
  }
  if (!handled && name === 'Marid' && roll < 0.65) {
    ExecuteEnemySkill(ctx, enemyUID, 'Enemy_MAG_Single');
    handled = 1;
  }

  return handled;
}

export function ExecuteEnemySkill(ctx, enemyUID, skillId) {
  return ExecuteEnemyJobSkill(ctx, enemyUID, skillId, 0);
}

export function EnemyAttack(ctx, enemyUID) {
  const skillId = PickEnemySkill(ctx, enemyUID);
  const target = randomPick(getHeroes(ctx));
  const targetUID = target ? target.uid : 0;
  ExecuteEnemyJobSkill(ctx, enemyUID, skillId, targetUID);
  return 1;
}

export function EnemyTurn(ctx, enemyUID) {
  const g = getGlobals(ctx);
  g.TurnPhase = 2;
  g.CanPickGems = 0;
  g.IsPlayerBusy = 1;
  g.DeferAdvance = 0;
  g.AdvanceAfterAction = 0;
  g.ActionLockUntil = 0;
  if (!enemyUID) {
    AdvanceTurn(ctx);
    ProcessTurn(ctx);
    return;
  }
  StartEnemyAction(ctx, enemyUID);
}

export function HeroTurn(ctx, heroUID) {
  const g = getGlobals(ctx);
  const store = ensurePowerAmpByUID(ctx);
  g.TurnPhase = 0;
  g.CanPickGems = 1;
  g.IsPlayerBusy = 0;
  g.HideHeroSelector = 0;
  g.DeferAdvance = 0;
  g.AdvanceAfterAction = 0;
  g.ActionLockUntil = 0;
  if (heroUID) g.CurrentHeroUID = heroUID;
  if (heroUID && store[heroUID]) {
    const entry = store[heroUID];
    const turnNow = Number(g.DebugTurnCount || 0);
    const turnSerialNow = Number(g.TurnSerial || 0);
    if (
      entry.state === 'pending_next_own_turn' &&
      turnSerialNow > Number(entry.armedAtTurnSerial || 0)
    ) {
      entry.state = 'active_this_turn';
      entry.mult = Number(entry.pendingMult || entry.mult || 0);
      entry.activatedAtTurn = turnNow;
      entry.activatedAtTurnSerial = turnSerialNow;
      entry.usedThisTurn = false;
      if (entry.mult > 0) {
        const existingVisual = g.PowerAmpVisualByUID && g.PowerAmpVisualByUID[heroUID];
        if (!existingVisual || Number(existingVisual.mult || 0) !== Number(entry.mult || 0)) {
          setPowerAmpVisual(g, heroUID, entry.mult);
        }
      }
    }
  }
}

export function ProcessTurn(ctx) {
  const type = GetCurrentType(ctx);
  const uid = GetCurrentTurn(ctx);
  const actor = GetActorByUID(ctx, uid);
  const g = getGlobals(ctx);
  if (g.BoardFillActive) return;
  if (g.ActionInProgress && g.ActionActorUID && g.ActionActorUID !== uid) return;
  if (g.IsPlayerBusy && g.TurnPhase === 1) return;
  g.DebugTurnCount = (g.DebugTurnCount || 0) + 1;
  console.log(`[DEBUG] matches=${g.DebugMatchCount || 0} turns=${g.DebugTurnCount}`);
  const flatRaw = isTimeInitiative(ctx)
    ? (g.TurnOrderArray || [])
    : (g.RoundActive ? (g.RoundGroups || []).flatMap(gr => gr.members || []) : (g.TurnOrderArray || []));
  const flatOrder = flatRaw.filter(a => GetActorByUID(ctx, a.uid));
  if (g.RoundActive) {
    g.TurnOrderArray = flatOrder.map(a => ({ uid: a.uid, spd: a.spd, type: a.type }));
  }
  const curUID = uid;
  const currentIdx = flatOrder.findIndex(a => a.uid === curUID);
  if (currentIdx !== -1) g.CurrentTurnIndex = currentIdx;
  const orderLine = flatOrder.map((a, i) => {
    const act = GetActorByUID(ctx, a.uid);
    const name = act && act.name ? act.name : a.uid;
    const tag = a.type === 0 ? '(H)' : '(E)';
    return `${i === g.CurrentTurnIndex ? '>' : ''}${name}${tag}`;
  }).join(' | ');
  console.log(`[TURN][ORDER] idx=${g.CurrentTurnIndex} ${orderLine}`);
  if (actor) {
    const base = Number(actor.stats?.SPD ?? actor.SPD ?? 0);
    const eff = GetEffectiveStat(ctx, actor, 'SPD');
    const delta = Math.round(eff - base);
    console.log(`[TURN] idx=${g.CurrentTurnIndex} ${actor.name || uid} type=${type} spd=${Math.round(eff)}/${Math.round(base)} (+${delta})`);
  }

  if (type === 0) {
    g.GroupResolving = 1;
    if (g.RoundActive) {
      g.ActiveGroupIndex = g.RoundGroupIndex || 0;
    }
    const pendingGroup = g.PendingDeaths ? g.PendingDeaths[uid] : null;
    const partyAlive = (g.PartyHP || 0) > 0;
    if (actor && (partyAlive || (g.RoundActive && pendingGroup === g.RoundGroupIndex))) {
      HeroTurn(ctx, uid);
    } else {
      if (actor && !partyAlive) {
        console.log(`[TURN] skip hero uid=${uid} partyHP=${g.PartyHP || 0}`);
      }
      AdvanceTurn(ctx);
      ProcessTurn(ctx);
    }
    return;
  }

  if (type === 1) {
    g.GroupResolving = 1;
    if (g.RoundActive) {
      g.ActiveGroupIndex = g.RoundGroupIndex || 0;
    }
    const pendingGroup = g.PendingDeaths ? g.PendingDeaths[uid] : null;
    if (g.BlueBuffSequenceActive) return;
    if (actor && ((actor.hp ?? 0) > 0 || (g.RoundActive && pendingGroup === g.RoundGroupIndex))) {
      EnemyTurn(ctx, uid);
    } else {
      AdvanceTurn(ctx);
      ProcessTurn(ctx);
    }
    return;
  }

  AdvanceTurn(ctx);
  ProcessTurn(ctx);
}

export function PickEnemySkill(ctx, enemyUID) {
  const enemy = GetActorByUID(ctx, enemyUID);
  if (!enemy) return 'Enemy_ATK_Single';
  const roll = Math.random();
  const decision = resolveEnemySkillDecision(enemy, roll);
  traceEnemySkillDecision(ctx, enemyUID, decision);
  return decision.selected;
}

export function GetEnemySkillAssignmentMap() {
  return JSON.parse(JSON.stringify(ENEMY_SKILL_ASSIGNMENT_MAP));
}

export function ApplyEnemySkill(ctx, enemyUID, skillId, targetUID) {
  ExecuteEnemyJobSkill(ctx, enemyUID, skillId, targetUID);
}

export function Enemy_Drain_Buff(ctx, enemyUID) {
  const g = getGlobals(ctx);
  const enemy = GetActorByUID(ctx, enemyUID);
  if (!enemy) return 0;
  const gems = getGems(ctx);
  const nextGems = [];
  let consumedBlue = 0;
  // Board mutation first: consume all blue gems.
  for (const gem of gems) {
    const color = Number(gem?.color ?? gem?.elementIndex ?? -1);
    if (color === 2) {
      consumedBlue += 1;
      continue;
    }
    nextGems.push(gem);
  }
  setGems(ctx, nextGems);
  setSelectedGemIndices(ctx, []);
  g.TapIndex = 0;
  if (consumedBlue > 0) {
    enemy.stats = enemy.stats || {};
    enemy.stats.DEF = Number(enemy.stats.DEF || enemy.DEF || 0) + consumedBlue;
    enemy.DEF = Number(enemy.DEF || 0) + consumedBlue;
  }
  const enemyName = getActorNameByUID(ctx, enemyUID);
  LogCombat(ctx, `${enemyName} used Drain Buff and gained ${consumedBlue} DEF.`);
  return 1;
}

export function Enemy_X_Out(ctx, enemyUID) {
  const g = getGlobals(ctx);
  const gems = getGems(ctx);
  const rows = Number(g.BoardRows || 4);
  const cols = Number(g.BoardCols || 6);
  const diagonalSlots = new Set();
  for (let r = 0; r < rows; r++) {
    const cMain = r;
    const cAnti = (cols - 1) - r;
    if (cMain >= 0 && cMain < cols) diagonalSlots.add(`${r},${cMain}`);
    if (cAnti >= 0 && cAnti < cols) diagonalSlots.add(`${r},${cAnti}`);
  }
  // Board mutation first: remove both diagonals.
  const nextGems = [];
  let consumed = 0;
  for (const gem of gems) {
    const key = `${Number(gem?.cellR ?? -1)},${Number(gem?.cellC ?? -1)}`;
    if (diagonalSlots.has(key)) {
      consumed += 1;
      continue;
    }
    nextGems.push(gem);
  }
  setGems(ctx, nextGems);
  setSelectedGemIndices(ctx, []);
  g.TapIndex = 0;
  const enemyName = getActorNameByUID(ctx, enemyUID);
  LogCombat(ctx, `${enemyName} used X Out and removed ${consumed} diagonal gems.`);
  return 1;
}

export function Enemy_Wipe(ctx, enemyUID) {
  const g = getGlobals(ctx);
  const gems = getGems(ctx);
  const LIGHT_GREEN_COLOR = 4;
  // Board mutation first: consume only light-green gems.
  const nextGems = [];
  let consumed = 0;
  for (const gem of gems) {
    const color = Number(gem?.color ?? gem?.elementIndex ?? -1);
    if (color === LIGHT_GREEN_COLOR) {
      consumed += 1;
      continue;
    }
    nextGems.push(gem);
  }
  setGems(ctx, nextGems);
  setSelectedGemIndices(ctx, []);
  g.TapIndex = 0;
  // Combat effect second: total heal pool = consumed * 4, split across living enemies.
  const totalHeal = Math.max(0, consumed * 4);
  const livingEnemies = getEnemies(ctx).filter(enemy => (enemy.hp || 0) > 0);
  if (totalHeal > 0 && livingEnemies.length > 0) {
    const baseShare = Math.floor(totalHeal / livingEnemies.length);
    let remainder = totalHeal % livingEnemies.length;
    for (const enemy of livingEnemies) {
      const share = baseShare + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      if ((enemy.hp || 0) <= 0) continue;
      enemy.hp = Math.min(enemy.maxHP || enemy.hp || 0, (enemy.hp || 0) + share);
    }
    UpdateEnemyHPUI(ctx);
  }
  const enemyName = getActorNameByUID(ctx, enemyUID);
  LogCombat(ctx, `${enemyName} used Wipe and healed allies for ${totalHeal}!`);
  return 1;
}

export function ExecuteEnemyJobSkill(ctx, enemyUID, skillId, targetUID = 0) {
  const resolvedTargetUID = targetUID || (randomPick(getHeroes(ctx))?.uid || 0);
  if (skillId === 'Enemy_Heal_Self') {
    Enemy_Heal_Self(ctx, enemyUID);
    return 1;
  }
  if (skillId === 'Enemy_MAG_Single') {
    if (resolvedTargetUID) Enemy_MAG_Single(ctx, enemyUID, resolvedTargetUID);
    return 1;
  }
  if (skillId === 'Enemy_MAG_AOE') {
    for (const h of getHeroes(ctx)) {
      const dmg = CalculateDamage(ctx, enemyUID, h.uid, 'magic');
      ApplyDamageToTarget(ctx, h.uid, dmg);
    }
    return 1;
  }
  if (skillId === 'Enemy_Drain_Buff') {
    return Enemy_Drain_Buff(ctx, enemyUID);
  }
  if (skillId === 'Enemy_X_Out') {
    return Enemy_X_Out(ctx, enemyUID);
  }
  if (skillId === 'Enemy_Wipe') {
    return Enemy_Wipe(ctx, enemyUID);
  }
  if (resolvedTargetUID) {
    Enemy_ATK_Single(ctx, enemyUID, resolvedTargetUID);
    return 1;
  }
  return 0;
}

export function StartEnemyAction(ctx, enemyUID) {
  const g = getGlobals(ctx);
  const enemy = GetActorByUID(ctx, enemyUID);
  if (!enemy) return;
  if (g.ActionInProgress && g.ActionActorUID && g.ActionActorUID !== enemyUID) return;
  g.ActionInProgress = 1;
  g.ActionActorUID = enemyUID;
  if (enemy.originX == null) enemy.originX = SlotX(ctx, enemy.slotIndex ?? 0);
  if (enemy.originY == null) enemy.originY = SlotY(ctx, enemy.slotIndex ?? 0);
  if (enemy.x == null) enemy.x = enemy.originX;
  if (enemy.y == null) enemy.y = enemy.originY;
  const target = randomPick(getHeroes(ctx));
  const targetUID = target ? target.uid : 0;
  const skillId = PickEnemySkill(ctx, enemyUID);
  g.EnemyAction = {
    active: true,
    uid: enemyUID,
    state: 'ADVANCE',
    timer: 0,
    actionApplied: false,
    targetUID,
    skillId,
    forwardX: (enemy.originX ?? enemy.x ?? 0) - 55,
  };
}

export function SpawnDamageText(ctx, amount, x, y, kind = 'damage', targetKind = null) {
  const g = getGlobals(ctx);
  g.DamageTexts = g.DamageTexts || [];
  const defaults = kind === 'heal'
    ? { low: 5, high: 30 }
    : { low: 10, high: 80 };
  const heat = computeHeat(g, kind, amount, defaults);
  const peakScale = 1.02 + (1.10 - 1.02) * heat;
  const riseInSec = 0.18;
  const holdSec = 0.7;
  const fadeSec = 0.45;
  g.DamageTexts.push({
    amount,
    x,
    y,
    kind,
    targetKind,
    heat,
    peakScale,
    baseY: y,
    age: 0,
    phase: 0,
    opacity: 1,
    riseInSec,
    holdSec,
    fadeSec
  });
  g.TextAnimEndAt = Math.max(g.TextAnimEndAt || 0, (g.time || 0) + riseInSec + holdSec + fadeSec);
}

export function StartBuffRoll(ctx) {
  const g = getGlobals(ctx);
  const buffType = g.BuffRollType ?? 0;
  if (buffType < 0 || buffType > 4) return;
  g.BlueBuffSequenceActive = 1;
  g.IsPlayerBusy = 1;
  g.CanPickGems = false;
  g.SuppressChainUI = 0;
  g.BuffRollActive = 0;
  g.BuffRollFrame = 0;
  g.BuffRollSlot = -1;
  g.BuffRollEndsAt = 0;
  RegisterPartyBuffSlot(ctx, buffType);
  RefreshPartyBuffUI(ctx);
  if (g.BuffRollApplyStat === 1 && g.BuffRollSkillID) {
    ExecuteSkill(ctx, g.BuffRollSkillID, g.BuffRollActor, 0);
  }
  g.BuffRollApplyStat = 0;
  g.BuffRollSkillID = '';
  g.BuffRollActor = 0;
  // Buff roll has no lunge/animation to clear busy; allow DeferAdvance to resolve.
  g.IsPlayerBusy = 0;
  const until = (g.time || 0) + 0.6;
  g.ActionLockUntil = Math.max(g.ActionLockUntil || 0, until);
  g.DeferAdvance = 1;
  g.AdvanceAfterAction = 1;
  g.ActionOwnerUID = g.ActionOwnerUID || g.PendingActor || g.BuffRollActor || GetCurrentTurn(ctx);
}

export function StartHeroLunge(ctx, actorUID) {
  const g = getGlobals(ctx);
  if (!actorUID) return;
  if (g.HeroAction && g.HeroAction.active && g.HeroAction.uid === actorUID) return;
  if (g.ActionInProgress && g.ActionActorUID && g.ActionActorUID !== actorUID) return;
  g.ActionInProgress = 1;
  g.ActionActorUID = actorUID;
  g.IsPlayerBusy = 1;
  g.CanPickGems = 0;
  g.TurnPhase = 1;
  const totalDur = 0.14 + 0.32 + 0.16 + 0.26;
  const until = (g.time || 0) + totalDur;
  g.ActionLockUntil = Math.max(g.ActionLockUntil || 0, until);
  g.DeferAdvance = 1;
  g.HeroAction = {
    uid: actorUID,
    state: 'ADVANCE',
    timer: 0,
    active: true,
    baseX: null,
    forwardX: null,
    anticipationX: null,
  };
}

export function ShowBuffProgress(ctx) {
  const g = getGlobals(ctx);
  g.BuffProgActive = 1;
  g.BuffProgEndAt = (g.time || 0) + 1;
}

export function RegisterPartyBuffSlot(ctx, buffType) {
  const g = getGlobals(ctx);
  if (buffType == null || buffType < 0 || buffType > 4) return;
  if (!Array.isArray(g.TrackBuffs) || g.TrackBuffs.length !== 4) {
    g.TrackBuffs = [-1, -1, -1, -1];
  }
  if (g.TrackBuffs.includes(buffType)) {
    g.BuffIconPopType = buffType;
    g.BuffIconPopAt = g.time || 0;
    g.BuffIconPopStacking = 1;
    return;
  }
  const emptyIndex = g.TrackBuffs.findIndex(v => v === -1);
  if (emptyIndex !== -1) {
    g.TrackBuffs[emptyIndex] = buffType;
  } else {
    g.TrackBuffs = g.TrackBuffs.slice(1).concat([buffType]);
  }
  g.BuffIconPopType = buffType;
  g.BuffIconPopAt = g.time || 0;
  g.BuffIconPopStacking = 0;
}
