import { state } from './state.js';
import { MONSTER_KEYS, MONSTER_LOOT_TABLE, TOKEN, EMPTY } from './monsterLootTableEventTokens.js';
import { ACTIVE_EVENT_IDS, LIVE_OPS_EVENTS, TOKEN_REGISTRY } from './liveOpsTokens.js';
import {
  createPowerAmpArmedEntry,
  derivePowerAmpActivationEntry,
  derivePowerAmpCloseDecision,
  derivePowerAmpConsumeState,
  derivePowerAmpFadeState,
  derivePowerAmpRenderState,
  derivePowerAmpVisualState,
  normalizePowerAmpLifecycleMeta,
} from '../src/core/powerAmpRules.mjs';
import {
  createEnemyTurnGateBaseline,
  createHeroTurnGateBaseline,
  createYellowSafetyNet,
} from '../src/core/turnGateController.mjs';
import { sanitizeInitiativeQueue } from '../src/core/initiativeGuards.mjs';
import {
  createBattleStartResetState,
  deriveBattleStartConsume,
  deriveBattleStartRemaining,
  deriveBattleStartRoundPartition,
} from '../src/core/schedulerRules.mjs';
import { pickEnemyTargetHeroFromRoster } from '../src/core/enemyTargetingRules.mjs';

const POWER_AMP_OUTCOMES = [
  { key: 'HERO_2X', multiplier: 2, chance: 0.62 },
  { key: 'HERO_3X', multiplier: 3, chance: 0.34 },
  { key: 'JACKPOT_ALL_2X', multiplier: 2, chance: 0.04, jackpotAllLivingHeroes: true },
];

const ENEMY_SKILL_ASSIGNMENT_MAP = {
  Djinn: {
    specialSkill: 'Enemy_Scathe',
    specialChance: 0.30,
    regularSkill: 'Enemy_MAG_Single',
    regularChance: 0.85,
    requiresDamaged: false,
  },
  Marid: {
    specialSkill: 'Enemy_Sweep',
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

function getRandomSource(ctx) {
  const g = getGlobals(ctx);
  const fn = g && typeof g.RuntimeRandom === 'function' ? g.RuntimeRandom : null;
  return fn || Math.random;
}

function random01(ctx) {
  const value = Number(getRandomSource(ctx)());
  if (Number.isFinite(value) && value >= 0 && value < 1) return value;
  return Math.random();
}

function randomIndex(ctx, size) {
  if (!(size > 0)) return 0;
  return Math.floor(random01(ctx) * size);
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

function computeCombatPowerFromStats(atk, def, hp) {
  const a = Number(atk || 0);
  const d = Number(def || 0);
  const h = Number(hp || 0);
  return Math.round((a + d + (h / 10)) * 100) / 100;
}

function normalizeLocaleTags(input) {
  if (Array.isArray(input)) {
    const tags = input.map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
    return tags.length ? tags : ['all'];
  }
  const raw = String(input ?? '').trim();
  if (!raw) return ['all'];
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeLocaleTags(parsed);
    } catch (_) {
      // no-op
    }
  }
  const tags = raw
    .split('|')
    .flatMap(part => String(part).split(','))
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean);
  return tags.length ? tags : ['all'];
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

const TRAIT_HOOK_EVENTS = new Set([
  'turn_start',
  'action_resolve',
  'damage_receive',
  'enemy_death',
  'status_apply',
]);

function ensureTraitRuntime(ctx) {
  const g = getGlobals(ctx);
  if (!g.TraitHooks || typeof g.TraitHooks !== 'object') g.TraitHooks = {};
  if (!Array.isArray(g.TraitHookTrace)) g.TraitHookTrace = [];
  if (!Number.isFinite(g.TraitHookSeq)) g.TraitHookSeq = 0;
  return g;
}

function nextTraitHookSeq(g) {
  g.TraitHookSeq = Number(g.TraitHookSeq || 0) + 1;
  return g.TraitHookSeq;
}

function appendTraitHookTrace(g, eventName, payload, results = []) {
  const cleanPayload = payload && typeof payload === 'object' ? { ...payload } : {};
  const trace = {
    seq: nextTraitHookSeq(g),
    event: String(eventName || ''),
    payload: cleanPayload,
    results: Array.isArray(results) ? results.slice(0, 8) : [],
    time: Number(g.time || 0),
  };
  g.TraitHookTrace.push(trace);
  if (g.TraitHookTrace.length > 200) g.TraitHookTrace.shift();
  return trace;
}

function runTraitHooks(ctx, eventName, payload = {}) {
  const g = ensureTraitRuntime(ctx);
  const eventKey = String(eventName || '');
  if (!TRAIT_HOOK_EVENTS.has(eventKey)) {
    appendTraitHookTrace(g, eventKey, payload, [{ status: 'ignored_unknown_event' }]);
    return [];
  }
  const handlers = Array.isArray(g.TraitHooks[eventKey]) ? g.TraitHooks[eventKey] : [];
  const ordered = handlers
    .filter((entry) => entry && typeof entry.handler === 'function')
    .slice()
    .sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0));
  const results = [];
  for (const entry of ordered) {
    try {
      const outcome = entry.handler(payload, ctx);
      results.push({ traitId: String(entry.traitId || ''), status: 'ok', outcome: outcome ?? null });
    } catch (err) {
      results.push({
        traitId: String(entry.traitId || ''),
        status: 'error',
        message: String(err?.message || err || 'unknown'),
      });
    }
  }
  appendTraitHookTrace(g, eventKey, payload, results);
  return results;
}

export function RegisterTraitHook(ctx, eventName, traitId, handler) {
  const g = ensureTraitRuntime(ctx);
  const eventKey = String(eventName || '');
  if (!TRAIT_HOOK_EVENTS.has(eventKey)) return false;
  if (typeof handler !== 'function') return false;
  const id = String(traitId || '');
  if (!Array.isArray(g.TraitHooks[eventKey])) g.TraitHooks[eventKey] = [];
  g.TraitHooks[eventKey] = g.TraitHooks[eventKey].filter((entry) => String(entry.traitId || '') !== id);
  g.TraitHooks[eventKey].push({ traitId: id, handler, seq: nextTraitHookSeq(g) });
  return true;
}

export function UnregisterTraitHook(ctx, eventName, traitId) {
  const g = ensureTraitRuntime(ctx);
  const eventKey = String(eventName || '');
  if (!Array.isArray(g.TraitHooks[eventKey])) return 0;
  const before = g.TraitHooks[eventKey].length;
  const id = String(traitId || '');
  g.TraitHooks[eventKey] = g.TraitHooks[eventKey].filter((entry) => String(entry.traitId || '') !== id);
  return before - g.TraitHooks[eventKey].length;
}

export function GetTraitHookTrace(ctx, limit = 40) {
  const g = ensureTraitRuntime(ctx);
  const size = Math.max(0, Number(limit || 0));
  if (!size) return [];
  return g.TraitHookTrace.slice(-size);
}

function applyTurnGateState(g, next) {
  if (!g || !next) return;
  const TURN_TRANSIENT_NUMERIC_KEYS = Object.freeze([
    'CanPickGems',
    'IsPlayerBusy',
    'DeferAdvance',
    'AdvanceAfterAction',
    'ActionLockUntil',
    'ActionOwnerUID',
    'ActionInProgress',
    'ActionActorUID',
    'PendingActor',
    'EnemyLineClearPressureActive',
  ]);
  const TURN_TRANSIENT_STRING_KEYS = Object.freeze([
    'PendingSkillID',
  ]);
  for (const key of TURN_TRANSIENT_NUMERIC_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue;
    g[key] = Number(next[key] || 0);
  }
  for (const key of TURN_TRANSIENT_STRING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue;
    g[key] = String(next[key] || '');
  }
}

function applyTurnGateIntent(g, createIntent, options = undefined) {
  if (!g || typeof createIntent !== 'function') return;
  applyTurnGateState(g, createIntent(g, options));
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

function ensurePowerAmpLifecycleMeta(g) {
  if (!g.PowerAmpLifecycleMetaByUID || typeof g.PowerAmpLifecycleMetaByUID !== 'object') g.PowerAmpLifecycleMetaByUID = {};
  return g.PowerAmpLifecycleMetaByUID;
}

function ensureLifecycleMetaForActor(g, uid, lifecycleId = 0) {
  const allMeta = ensurePowerAmpLifecycleMeta(g);
  const normalizedUID = Number(uid || 0);
  const normalizedLife = Number(lifecycleId || 0);
  if (!normalizedUID) return null;
  const meta = normalizePowerAmpLifecycleMeta(allMeta[normalizedUID], normalizedLife);
  allMeta[normalizedUID] = meta;
  return meta;
}

function writePowerAmpLifecycleMetaForActor(g, uid, meta) {
  const normalizedUID = Number(uid || 0);
  if (!normalizedUID || !meta) return null;
  ensurePowerAmpLifecycleMeta(g)[normalizedUID] = meta;
  return meta;
}

function buildPowerAmpRuleInput(g, uid, lifecycleId = 0) {
  return {
    existingMeta: ensureLifecycleMetaForActor(g, uid, lifecycleId),
    now: Number(g.time || 0),
    lifecycleId: Number(lifecycleId || 0),
  };
}

function clearPowerAmpVisualState(g, uid) {
  ensurePowerAmpVisuals(g);
  delete g.PowerAmpVisualByUID[uid];
  delete g.PowerAmpFadeByUID[uid];
}

function nextPowerAmpLifecycleId(g) {
  g.PowerAmpLifecycleSeq = Number(g.PowerAmpLifecycleSeq || 0) + 1;
  return g.PowerAmpLifecycleSeq;
}

function ensurePowerAmpTelemetryTrace(g) {
  if (!Array.isArray(g.PowerAmpTelemetryTrace)) g.PowerAmpTelemetryTrace = [];
  return g.PowerAmpTelemetryTrace;
}

function getPowerAmpTelemetryIdentity(ctx, actorUID) {
  const actor = GetActorByUID(ctx, actorUID);
  const uid = Number(actorUID || 0);
  const actorName = actor ? String(actor.name || '') : (uid ? String(getActorNameByUID(ctx, uid) || '') : '');
  const heroId = actor && actor.kind === 'hero' ? makeStableHeroSkillPointId(actor) : '';
  const heroIndex = actor && Number.isInteger(Number(actor.heroIndex)) ? Number(actor.heroIndex) : -1;
  return {
    uid,
    actorKind: String(actor?.kind || ''),
    actorName,
    heroId,
    heroIndex,
  };
}

function emitPowerAmpStateLog(ctx, phase, actorUID, extra = {}) {
  const g = getGlobals(ctx);
  const trace = ensurePowerAmpTelemetryTrace(g);
  const identity = getPowerAmpTelemetryIdentity(ctx, actorUID);
  const event = {
    phase: String(phase || ''),
    uid: identity.uid,
    actorKind: identity.actorKind,
    actorName: identity.actorName,
    heroId: identity.heroId,
    heroIndex: identity.heroIndex,
    time: Number(g.time || 0),
    turnSerial: Number(g.TurnSerial || 0),
    turn: Number(g.DebugTurnCount || 0),
  };
  for (const [key, value] of Object.entries(extra || {})) {
    if (value == null || value === '') continue;
    event[key] = value;
  }
  trace.push(event);
  if (trace.length > 200) trace.shift();
}

function setPowerAmpVisual(g, uid, mult, lifecycleId = 0) {
  ensurePowerAmpVisuals(g);
  const next = derivePowerAmpVisualState({
    existingVisual: g.PowerAmpVisualByUID[uid] || null,
    ...buildPowerAmpRuleInput(g, uid, lifecycleId),
    mult,
  });
  writePowerAmpLifecycleMetaForActor(g, uid, next.meta);
  if (next.visual) g.PowerAmpVisualByUID[uid] = next.visual;
  return { seeded: !!next.seeded, startAt: Number(next.startAt || 0), lifecycleId: Number(next.lifecycleId || 0) };
}

function startPowerAmpFade(g, uid, mult, lifecycleId = 0) {
  ensurePowerAmpVisuals(g);
  const next = derivePowerAmpFadeState({
    ...buildPowerAmpRuleInput(g, uid, lifecycleId),
    mult,
    duration: 0.42,
  });
  writePowerAmpLifecycleMetaForActor(g, uid, next.meta);
  if (next.fade) g.PowerAmpFadeByUID[uid] = next.fade;
  delete g.PowerAmpVisualByUID[uid];
  return { started: !!next.started, startAt: Number(next.startAt || 0), lifecycleId: Number(next.lifecycleId || 0) };
}

function pickPowerAmpOutcome(ctx) {
  let r = random01(ctx);
  for (const entry of POWER_AMP_OUTCOMES) {
    r -= entry.chance;
    if (r <= 0) return entry;
  }
  return POWER_AMP_OUTCOMES[POWER_AMP_OUTCOMES.length - 1];
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
        const lifecycleId = nextPowerAmpLifecycleId(g);
        store[hero.uid] = createPowerAmpArmedEntry(outcome.multiplier, grantTurn, grantTurnSerial, lifecycleId);
        emitPowerAmpStateLog(ctx, 'activation_armed', hero.uid, { mult: outcome.multiplier, mode: 'jackpot', lifecycle: lifecycleId });
        const seeded = setPowerAmpVisual(g, hero.uid, outcome.multiplier, lifecycleId);
        emitPowerAmpStateLog(ctx, 'activation_visible', hero.uid, { mult: outcome.multiplier, mode: 'jackpot', lifecycle: lifecycleId, seeded: seeded.seeded ? 1 : 0 });
      }
    }
    LogCombat(ctx, 'Lucky! Heroes are amped up!');
    return;
  }
  const lifecycleId = nextPowerAmpLifecycleId(g);
  store[actorUID] = createPowerAmpArmedEntry(outcome.multiplier, grantTurn, grantTurnSerial, lifecycleId);
  emitPowerAmpStateLog(ctx, 'activation_armed', actorUID, { mult: outcome.multiplier, mode: 'single', lifecycle: lifecycleId });
  const seeded = setPowerAmpVisual(g, actorUID, outcome.multiplier, lifecycleId);
  emitPowerAmpStateLog(ctx, 'activation_visible', actorUID, { mult: outcome.multiplier, mode: 'single', lifecycle: lifecycleId, seeded: seeded.seeded ? 1 : 0 });
  LogCombat(ctx, `${getActorNameByUID(ctx, actorUID)} armed Power Amp x${outcome.multiplier} for next turn!`);
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

function traceEnemyHealRoll(ctx, payload) {
  const g = getGlobals(ctx);
  if (!Array.isArray(g.EnemyHealTrace)) g.EnemyHealTrace = [];
  g.EnemyHealTrace.push({
    enemyUID: Number(payload.enemyUID || 0),
    enemyName: String(payload.enemyName || ''),
    skillId: String(payload.skillId || ''),
    targetUID: Number(payload.targetUID || 0),
    targetName: String(payload.targetName || ''),
    targetScope: String(payload.targetScope || ''),
    targetCount: Number(payload.targetCount || 0),
    low: Number(payload.low || 0),
    high: Number(payload.high || 0),
    rolledBase: Number(payload.rolledBase || 0),
    rangeRoll: Number(payload.rangeRoll || 0),
    critRoll: Number(payload.critRoll || 0),
    didCrit: Boolean(payload.didCrit),
    critMultiplier: Number(payload.critMultiplier || 1),
    finalHeal: Number(payload.finalHeal || 0),
    time: Number(g.time || 0),
  });
  if (g.EnemyHealTrace.length > 120) g.EnemyHealTrace.shift();
}

function rollEnemyHealAmount(ctx, healer, {
  skillId = 'Enemy_Heal_Self',
  lowFloor = 1,
  lowOffset = 0,
  highOffset = 0,
  critThreshold = 0.1,
} = {}) {
  const magTotal = Math.max(0, GetEffectiveStat(ctx, healer, 'MAG'));
  const base = Math.max(1, Math.floor(magTotal * 0.5));
  const low = Math.max(lowFloor, base + lowOffset);
  const high = Math.max(low, base + highOffset);
  const rangeRoll = Math.random();
  const rolledBase = low + Math.floor(rangeRoll * (high - low + 1));
  const critRoll = Math.random();
  const crit = ApplyScaledCrit({
    baseValue: rolledBase,
    relevantBuffTotal: magTotal,
    sourceType: 'ENEMY',
    critThreshold,
    rngRoll: critRoll,
  });
  return {
    skillId,
    low,
    high,
    rolledBase,
    rangeRoll,
    critRoll,
    didCrit: Boolean(crit.didCrit),
    critMultiplier: Number(crit.critMultiplier || 1),
    finalHeal: Math.max(1, Math.floor(crit.value)),
  };
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
  const g = getGlobals(ctx);
  const store = ensurePowerAmpByUID(ctx);
  const entry = store[actorUID];
  const next = derivePowerAmpConsumeState(entry, ensureLifecycleMetaForActor(g, actorUID, Number(entry?.lifecycleId || 0)));
  if (!next.canConsume) return 0;
  store[actorUID] = next.entry;
  writePowerAmpLifecycleMetaForActor(g, actorUID, next.meta);
  emitPowerAmpStateLog(ctx, 'consume', actorUID, { mult: Number(next.multiplier || 0), lifecycle: Number(next.entry?.lifecycleId || 0) });
  return Number(next.multiplier || 0);
}

export function ClosePowerAmpForActor(ctx, actorUID, reason = 'manual_close') {
  const store = ensurePowerAmpByUID(ctx);
  const g = getGlobals(ctx);
  const uid = Number(actorUID || 0);
  if (!uid) return 0;
  const entry = store[uid];
  const next = derivePowerAmpCloseDecision(entry, ensureLifecycleMetaForActor(g, uid, Number(entry?.lifecycleId || 0)));
  if (!next.shouldClose) return 0;
  const mult = Number(next.mult || 0);
  delete store[uid];
  writePowerAmpLifecycleMetaForActor(g, uid, next.meta);
  if (next.alreadyClosed) return mult;
  if (next.shouldFade) {
    const fade = startPowerAmpFade(g, uid, mult, next.lifecycleId);
    if (fade.started) emitPowerAmpStateLog(ctx, 'fade_start', uid, { mult, reason, lifecycle: Number(next.lifecycleId || 0) });
  } else {
    FinalizePowerAmpVisualClear(ctx, uid, next.lifecycleId);
  }
  return mult;
}

export function FinalizePowerAmpVisualClear(ctx, actorUID, lifecycleId = 0) {
  const g = getGlobals(ctx);
  const uid = Number(actorUID || 0);
  if (!uid) return;
  if (lifecycleId) {
    const meta = ensureLifecycleMetaForActor(g, uid, lifecycleId);
    if (meta) meta.closed = true;
  }
  clearPowerAmpVisualState(g, uid);
  emitPowerAmpStateLog(ctx, 'clear', uid, { lifecycle: Number(lifecycleId || 0) });
}

function expirePowerAmpFadeEntries(ctx) {
  const g = getGlobals(ctx);
  const fades = g.PowerAmpFadeByUID;
  if (!fades || typeof fades !== 'object') return 0;
  const now = Number(g.time || 0);
  let expiredCount = 0;
  for (const [uid, fade] of Object.entries(fades)) {
    if (!fade) continue;
    const duration = Number(fade.duration || 0.42);
    if (now < Number(fade.startAt || 0) + duration) continue;
    emitPowerAmpStateLog(ctx, 'closed_off', Number(uid || 0), { lifecycle: Number(fade.lifecycleId || 0) });
    delete fades[uid];
    expiredCount += 1;
  }
  return expiredCount;
}

export function TickPowerAmpState(ctx) {
  return expirePowerAmpFadeEntries(ctx);
}

export function GetHeroPowerAmpRenderState(ctx, actorUID) {
  const g = getGlobals(ctx);
  const uid = Number(actorUID || 0);
  if (!uid) {
    return {
      active: false,
      fadeActive: false,
      mult: 0,
      lifecycleId: 0,
      visualStartAt: 0,
      fadeStartAt: 0,
      fadeDuration: 0.42,
      heroScale: 1,
      scaleState: 'normal',
    };
  }
  ensurePowerAmpVisuals(g);
  const store = ensurePowerAmpByUID(ctx);
  const visual = g.PowerAmpVisualByUID[uid] || null;
  const fade = g.PowerAmpFadeByUID[uid] || null;
  const entry = store[uid] || null;
  const next = derivePowerAmpRenderState({
    entry,
    visual,
    fade,
    existingMeta: ensureLifecycleMetaForActor(g, uid, Number(visual?.lifecycleId || entry?.lifecycleId || fade?.lifecycleId || 0)),
    now: Number(g.time || 0),
    defaultFadeDuration: 0.42,
    scalePeak: 1.3,
  });
  ensurePowerAmpLifecycleMeta(g)[uid] = next.meta;
  return {
    active: !!next.active,
    fadeActive: !!next.fadeActive,
    mult: Number(next.mult || 0),
    lifecycleId: Number(next.lifecycleId || 0),
    visualStartAt: Number(next.visualStartAt || 0),
    fadeStartAt: Number(next.fadeStartAt || 0),
    fadeDuration: Number(next.fadeDuration || 0.42),
    heroScale: Number(next.heroScale || 1),
    scaleState: String(next.scaleState || 'normal'),
  };
}

function getAllHeroActors(ctx) {
  return getEntities(ctx).filter(e => e && e.kind === 'hero');
}

function makeStableHeroSkillPointId(hero) {
  const actorUID = Number(hero && hero.uid);
  if (Number.isInteger(actorUID) && actorUID > 0) return `hero_actor:${actorUID}`;
  const instanceKey = String((hero && hero.heroInstanceKey) || '').trim().toLowerCase();
  if (instanceKey) return `hero_instance:${instanceKey}`;
  const heroIndex = Number(hero && hero.heroIndex);
  if (Number.isInteger(heroIndex) && heroIndex >= 0) return `hero:${heroIndex}`;
  const heroName = String((hero && (hero.baseHeroName || hero.name)) || '').trim().toLowerCase();
  if (heroName) return `hero_name:${heroName}`;
  return '';
}
const HERO_SKILL_SHARED_KEY = '__party_shared__';

const HERO_SKILL_COSTS_BY_RISK = Object.freeze({
  LOW: [1, 2, 3, 4],
  MED: [2, 3, 4, 5],
  HIGH: [3, 4, 5, 6],
});

const HERO_SKILL_DEFINITIONS = Object.freeze([
  { id: 'falie_ward_bash', owner: 'Falie', slot: 0, title: 'Ward Bash', cardText: 'Counterattack with a ward strike after taking a hit.', risk: 'LOW', growth: [6, 6, 7, 8], procPattern: 'On defend', payloadImplemented: false },
  { id: 'falie_cover_block', owner: 'Falie', slot: 1, title: 'Cover / Block', cardText: 'Step in and take a hit for an ally.', risk: 'MED', growth: [4, 4, 5, 5], procPattern: 'On ally hit', payloadImplemented: false },
  { id: 'falie_reprisal_bounce', owner: 'Falie', slot: 2, title: 'Reprisal / Bounce', cardText: 'Reflect part of the damage back to the attacker.', risk: 'MED', growth: [4, 4, 5, 5], procPattern: 'On defend', payloadImplemented: false },
  { id: 'falie_phalanx', owner: 'Falie', slot: 3, title: 'Phalanx', cardText: 'Cut down a portion of heavy incoming damage.', risk: 'HIGH', growth: [2, 2, 3, 3], procPattern: 'On heavy hit taken', payloadImplemented: false },
  { id: 'huun_bell', owner: 'Huun', slot: 0, title: 'Bell', cardText: 'Slam one enemy with a much stronger finishing hit.', risk: 'MED', growth: [4, 4, 5, 5], procPattern: 'On combo finisher', payloadImplemented: false },
  { id: 'huun_glare', owner: 'Huun', slot: 1, title: 'Glare', cardText: 'Push an enemy back in the turn order.', risk: 'MED', growth: [4, 4, 5, 5], procPattern: 'On attack', payloadImplemented: false },
  { id: 'huun_trinity', owner: 'Huun', slot: 2, title: 'Trinity', cardText: 'Unleash a burst of repeated attacks.', risk: 'HIGH', growth: [2, 2, 3, 3], procPattern: 'On combo finisher', payloadImplemented: false },
  { id: 'huun_growth', owner: 'Huun', slot: 3, title: 'Growth', cardText: 'Turn dealt damage into Astral Flow.', risk: 'HIGH', growth: [2, 2, 3, 3], procPattern: 'On damage dealt', payloadImplemented: false },
  { id: 'runa_aura_totem_blast', owner: 'Runa', slot: 0, title: 'Aura Totem: Blast', cardText: 'Summon a totem that deals melee damage over time.', risk: 'HIGH', growth: [2, 2, 3, 3], procPattern: 'On attack', payloadImplemented: false },
  { id: 'runa_aura_totem_burn', owner: 'Runa', slot: 1, title: 'Aura Totem: Burn', cardText: 'Summon a totem that deals magic damage over time.', risk: 'HIGH', growth: [2, 2, 3, 3], procPattern: 'On attack', payloadImplemented: false },
  { id: 'runa_invert', owner: 'Runa', slot: 2, title: 'Invert', cardText: "Switch an enemy's physical attack and magic resistance.", risk: 'HIGH', growth: [2, 2, 3, 3], procPattern: 'On special trigger', payloadImplemented: false },
  { id: 'runa_intensify', owner: 'Runa', slot: 3, title: 'Intensify', cardText: 'Double the payoff of red fire matches.', risk: 'HIGH', growth: [2, 2, 3, 3], procPattern: 'On red fire match', payloadImplemented: false },
  { id: 'kojonn_lock', owner: 'Kojonn', slot: 0, title: 'Lock', cardText: 'Use a gem action without paying its cost.', risk: 'HIGH', growth: [2, 2, 3, 3], procPattern: 'On gem use', payloadImplemented: false },
  { id: 'kojonn_lift', owner: 'Kojonn', slot: 1, title: 'Lift', cardText: "Greatly increase an ally's physical damage.", risk: 'HIGH', growth: [2, 2, 3, 3], procPattern: 'On ally attack', payloadImplemented: false },
  { id: 'kojonn_step', owner: 'Kojonn', slot: 2, title: 'Step', cardText: 'Move an ally forward in the turn order.', risk: 'HIGH', growth: [2, 2, 3, 3], procPattern: 'On ally action', payloadImplemented: false },
  { id: 'kojonn_elevate', owner: 'Kojonn', slot: 3, title: 'Elevate', cardText: 'Raise an ally effect power to the next tier.', risk: 'HIGH', growth: [2, 2, 3, 3], procPattern: 'On special trigger', payloadImplemented: false },
]);

const PARTY_SKILL_DEFINITIONS = Object.freeze([
  { id: 'party_fresh_start', owner: 'Party', slot: 0, title: 'Fresh Start', cardText: 'Start combat with a small burst of power.', risk: 'LOW', growth: [6, 6, 7, 8], procPattern: 'On battle start', payloadImplemented: false },
  { id: 'party_second_chance', owner: 'Party', slot: 1, title: 'Second Chance', cardText: 'Reroll part of a weak board into a better setup.', risk: 'MED', growth: [4, 4, 5, 5], procPattern: 'On weak board state', payloadImplemented: false },
  { id: 'party_momentum', owner: 'Party', slot: 2, title: 'Momentum', cardText: 'Carry one strong turn into the next.', risk: 'MED', growth: [4, 4, 5, 5], procPattern: 'On combo finisher', payloadImplemented: false },
  { id: 'party_guard_rail', owner: 'Party', slot: 3, title: 'Guard Rail', cardText: 'Reduce the impact of a dangerous hit.', risk: 'MED', growth: [4, 4, 5, 5], procPattern: 'On heavy hit taken', payloadImplemented: false },
  { id: 'party_blue_spark', owner: 'Party', slot: 4, title: 'Blue Spark', cardText: 'Turn blue water gains into a bonus for the whole party.', risk: 'MED', growth: [4, 4, 5, 5], procPattern: 'On blue water match', payloadImplemented: false },
  { id: 'party_weaken', owner: 'Party', slot: 5, title: 'Weaken', cardText: 'Lower enemy defense so your hits land harder.', risk: 'MED', growth: [4, 4, 5, 5], procPattern: 'On special hit', payloadImplemented: false },
  { id: 'party_destiny', owner: 'Party', slot: 6, title: 'Destiny', cardText: 'Small chance to restore HP when attacking enemies.', risk: 'MED', growth: [4, 4, 5, 5], procPattern: 'On hit', payloadImplemented: true },
  { id: 'party_hot_streak', owner: 'Party', slot: 7, title: 'Hot Streak', cardText: 'Build up a better payoff with consecutive matches.', risk: 'MED', growth: [4, 4, 5, 5], procPattern: 'On consecutive matches', payloadImplemented: false },
  { id: 'party_last_push', owner: 'Party', slot: 8, title: 'Last Push', cardText: 'Gain a brief comeback burst when the party nears defeat.', risk: 'MED', growth: [4, 4, 5, 5], procPattern: 'On low party HP', payloadImplemented: false },
  { id: 'party_chain_pop', owner: 'Party', slot: 9, title: 'Chain Pop', cardText: 'Trigger an extra board effect from a match.', risk: 'MED', growth: [4, 4, 5, 5], procPattern: 'On match', payloadImplemented: false },
]);

function cloneSkillDefinition(def) {
  return {
    id: String(def.id || ''),
    owner: String(def.owner || ''),
    slot: Math.max(0, Math.floor(Number(def.slot) || 0)),
    title: String(def.title || ''),
    cardText: String(def.cardText || ''),
    risk: String(def.risk || 'MED'),
    growth: Array.isArray(def.growth) ? def.growth.map(value => Math.max(0, Number(value) || 0)) : [],
    procPattern: String(def.procPattern || ''),
    payloadImplemented: def.payloadImplemented === true,
  };
}

function getHeroSkillDefinitionsForOwner(heroName) {
  const key = String(heroName || '').trim().toLowerCase();
  return HERO_SKILL_DEFINITIONS
    .filter(def => String(def.owner || '').trim().toLowerCase() === key)
    .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
}

function getSkillDefinitionById(skillId) {
  const key = String(skillId || '').trim().toLowerCase();
  return HERO_SKILL_DEFINITIONS.concat(PARTY_SKILL_DEFINITIONS)
    .find(def => String(def.id || '').toLowerCase() === key) || null;
}

export function GetHeroSkillDefinitions(ctx, heroName = '') {
  const defs = heroName
    ? getHeroSkillDefinitionsForOwner(heroName)
    : HERO_SKILL_DEFINITIONS.slice();
  return defs.map(cloneSkillDefinition);
}

export function GetPartySkillDefinitions() {
  return PARTY_SKILL_DEFINITIONS.map(cloneSkillDefinition);
}

export function GetSkillDefinition(ctx, skillId) {
  const def = getSkillDefinitionById(skillId);
  return def ? cloneSkillDefinition(def) : null;
}

export function GetHeroSkillDefinitionCardsForHero(ctx, heroName) {
  return getHeroSkillDefinitionsForOwner(heroName).map((def) => {
    const clean = cloneSkillDefinition(def);
    return {
      ...clean,
      key: clean.id,
      description: clean.cardText,
      badge: clean.risk === 'HIGH' ? 'HR' : (clean.risk === 'LOW' ? 'LR' : 'MR'),
      iconShape: clean.risk === 'HIGH' ? 'diamond' : 'circle',
      actionable: true,
      maxRank: clean.growth.length || 1,
      costs: HERO_SKILL_COSTS_BY_RISK[clean.risk] || HERO_SKILL_COSTS_BY_RISK.MED,
    };
  });
}

function ensureSkillDraughtState(ctx) {
  const g = getGlobals(ctx);
  if (!Number.isFinite(g.SkillDraughtOpen)) g.SkillDraughtOpen = 0;
  if (!Number.isFinite(g.SkillDraughtHeroUID)) g.SkillDraughtHeroUID = 0;
  if (!Array.isArray(g.SkillDraughtCandidates)) g.SkillDraughtCandidates = [];
  if (!Array.isArray(g.SkillDraughtHitZones)) g.SkillDraughtHitZones = [];
  if (typeof g.SkillDraughtSelectedSkillId !== 'string') g.SkillDraughtSelectedSkillId = '';
  if (!g.SessionSkillsByHeroUID || typeof g.SessionSkillsByHeroUID !== 'object') g.SessionSkillsByHeroUID = {};
  if (!Array.isArray(g.SkillDraughtTrace)) g.SkillDraughtTrace = [];
  if (!Number.isFinite(g.SkillDraughtTraceSeq)) g.SkillDraughtTraceSeq = 0;
  return g;
}

function makeSkillDraughtCandidate(def, index = 0) {
  const clean = cloneSkillDefinition(def);
  return {
    index: Math.max(0, Math.floor(Number(index) || 0)),
    id: clean.id,
    key: clean.id,
    owner: clean.owner,
    slot: clean.slot,
    title: clean.title,
    name: clean.title,
    description: clean.cardText,
    cardText: clean.cardText,
    risk: clean.risk,
    payloadImplemented: clean.payloadImplemented,
  };
}

function appendSkillDraughtTrace(g, action, payload = {}) {
  g.SkillDraughtTraceSeq = Math.max(0, Math.floor(Number(g.SkillDraughtTraceSeq || 0))) + 1;
  g.SkillDraughtTrace.push({
    seq: g.SkillDraughtTraceSeq,
    action,
    at: Number(g.time || 0),
    ...payload,
  });
  if (g.SkillDraughtTrace.length > 80) g.SkillDraughtTrace.splice(0, g.SkillDraughtTrace.length - 80);
}

function buildSkillDraughtCandidates(ctx, heroUID, forcedSkillId = '') {
  const forced = GetSkillDefinition(ctx, forcedSkillId);
  const defs = GetPartySkillDefinitions();
  let ordered = defs.slice();
  if (forced && String(forced.owner || '').toLowerCase() === 'party') {
    ordered = [forced].concat(defs.filter(def => String(def.id) !== String(forced.id)));
  }
  return ordered.slice(0, 3).map((def, index) => makeSkillDraughtCandidate(def, index));
}

export function GetSkillDraughtState(ctx) {
  const g = ensureSkillDraughtState(ctx);
  return {
    open: Number(g.SkillDraughtOpen || 0),
    heroUID: Number(g.SkillDraughtHeroUID || 0),
    candidates: g.SkillDraughtCandidates.map(candidate => ({ ...candidate })),
    selectedSkillId: String(g.SkillDraughtSelectedSkillId || ''),
    sessionSkillsByHeroUID: JSON.parse(JSON.stringify(g.SessionSkillsByHeroUID || {})),
  };
}

export function OpenSkillDraughtForHero(ctx, heroUID, forcedSkillId = '') {
  const g = ensureSkillDraughtState(ctx);
  const uid = Number(heroUID || 0);
  const actor = GetActorByUID(ctx, uid);
  if (!actor) {
    appendSkillDraughtTrace(g, 'open_rejected', { heroUID: uid, reason: 'hero_not_found' });
    return { ok: false, reason: 'hero_not_found', candidates: [] };
  }
  const candidates = buildSkillDraughtCandidates(ctx, uid, forcedSkillId);
  if (!candidates.length) {
    appendSkillDraughtTrace(g, 'open_rejected', { heroUID: uid, reason: 'no_candidates' });
    return { ok: false, reason: 'no_candidates', candidates: [] };
  }
  g.SkillDraughtOpen = 1;
  g.SkillDraughtHeroUID = uid;
  g.SkillDraughtCandidates = candidates;
  g.SkillDraughtHitZones = [];
  g.SkillDraughtSelectedSkillId = '';
  appendSkillDraughtTrace(g, 'open', { heroUID: uid, candidateIds: candidates.map(candidate => candidate.id) });
  LogCombat(ctx, 'The party found new skills.');
  return { ok: true, heroUID: uid, candidates: candidates.map(candidate => ({ ...candidate })) };
}

export function SelectSkillDraughtCard(ctx, candidateIndex = 0) {
  const g = ensureSkillDraughtState(ctx);
  if (!Number(g.SkillDraughtOpen || 0)) return { ok: false, reason: 'draught_closed' };
  const index = Math.max(0, Math.floor(Number(candidateIndex) || 0));
  const candidate = g.SkillDraughtCandidates.find(row => Number(row.index) === index) || g.SkillDraughtCandidates[index] || null;
  if (!candidate) return { ok: false, reason: 'candidate_not_found' };
  const uid = Number(g.SkillDraughtHeroUID || 0);
  const key = String(candidate.owner || '').toLowerCase() === 'party' ? HERO_SKILL_SHARED_KEY : String(uid || 0);
  if (!Array.isArray(g.SessionSkillsByHeroUID[key])) g.SessionSkillsByHeroUID[key] = [];
  const sessionSkill = {
    id: String(candidate.id || ''),
    key: String(candidate.key || candidate.id || ''),
    title: String(candidate.title || candidate.name || ''),
    description: String(candidate.description || candidate.cardText || ''),
    owner: String(candidate.owner || ''),
    selectedAt: Number(g.time || 0),
  };
  g.SessionSkillsByHeroUID[key].push(sessionSkill);
  g.SkillDraughtSelectedSkillId = sessionSkill.id;
  g.SkillDraughtOpen = 0;
  g.SkillDraughtCandidates = [];
  g.SkillDraughtHitZones = [];
  g.AstralFlowAmpPoints = 0;
  g.AstralFlowAmpReady = 0;
  UpdateAstralFlowAmpBar(ctx);
  const scope = String(sessionSkill.owner || '').toLowerCase() === 'party' ? 'party' : 'hero';
  appendSkillDraughtTrace(g, 'select', { heroUID: uid, skillId: sessionSkill.id, scope });
  g.CombatActionPinnedLine = '';
  g.CombatActionPinnedUntil = 0;
  LogCombat(ctx, scope === 'party'
    ? `${sessionSkill.title} activated.`
    : `${getActorNameByUID(ctx, uid)} activated ${sessionSkill.title}.`);
  return { ok: true, heroUID: uid, skill: { ...sessionSkill } };
}

export function ClearSessionSkillDraught(ctx) {
  const g = ensureSkillDraughtState(ctx);
  g.SkillDraughtOpen = 0;
  g.SkillDraughtHeroUID = 0;
  g.SkillDraughtCandidates = [];
  g.SkillDraughtHitZones = [];
  g.SkillDraughtSelectedSkillId = '';
  g.SessionSkillsByHeroUID = {};
  appendSkillDraughtTrace(g, 'clear', {});
  return { ok: true };
}

export function ForceAstralFlowSkillDraught(ctx, heroUID, forcedSkillId = '') {
  const g = ensureAstralFlowAmpState(ctx);
  const ampMax = Math.max(1, Number(g.AstralFlowAmpMax || 18));
  g.AstralFlowAmpPoints = ampMax;
  g.AstralFlowAmpReady = 1;
  UpdateAstralFlowAmpBar(ctx);
  return OpenSkillDraughtForHero(ctx, heroUID, forcedSkillId);
}

function resolveHeroSkillPointIdentity(ctx, heroRef) {
  const heroes = getAllHeroActors(ctx);
  const fromActor = (hero) => ({
    heroId: makeStableHeroSkillPointId(hero),
    heroIndex: Number.isInteger(Number(hero && hero.heroIndex)) ? Number(hero.heroIndex) : -1,
    heroName: String((hero && (hero.baseHeroName || hero.name)) || ''),
    actorUID: Number((hero && hero.uid) || 0),
  });
  const fromStableId = (heroId) => {
    const text = String(heroId || '');
    if (text.startsWith('hero_actor:')) {
      const uid = Number(text.slice(11));
      const match = heroes.find(hero => Number(hero.uid) === uid) || null;
      return {
        heroId: text,
        heroIndex: match && Number.isInteger(Number(match.heroIndex)) ? Number(match.heroIndex) : -1,
        heroName: match ? String(match.baseHeroName || match.name || '') : '',
        actorUID: match ? Number(match.uid || 0) : 0,
      };
    }
    if (text.startsWith('hero_instance:')) {
      const key = text.slice(14);
      const match = heroes.find(hero => String(hero.heroInstanceKey || '').trim().toLowerCase() === key) || null;
      return {
        heroId: text,
        heroIndex: match && Number.isInteger(Number(match.heroIndex)) ? Number(match.heroIndex) : -1,
        heroName: match ? String(match.baseHeroName || match.name || '') : '',
        actorUID: match ? Number(match.uid || 0) : 0,
      };
    }
    if (text.startsWith('hero:')) {
      const idx = Number(text.slice(5));
      const match = heroes.find(hero => Number(hero.heroIndex) === idx) || null;
      return {
        heroId: text,
        heroIndex: Number.isInteger(idx) ? idx : -1,
        heroName: match ? String(match.baseHeroName || match.name || '') : '',
        actorUID: match ? Number(match.uid || 0) : 0,
      };
    }
    if (text.startsWith('hero_name:')) {
      const key = text.slice(10);
      const match = heroes.find(hero => String(hero.baseHeroName || hero.name || '').trim().toLowerCase() === key) || null;
      return {
        heroId: text,
        heroIndex: match && Number.isInteger(Number(match.heroIndex)) ? Number(match.heroIndex) : -1,
        heroName: match ? String(match.baseHeroName || match.name || '') : key,
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
    const byName = heroes.find(hero => String(hero.baseHeroName || hero.name || '').trim().toLowerCase() === text.toLowerCase());
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
  const sharedBalance = Math.max(0, Math.floor(Number(store[HERO_SKILL_SHARED_KEY] || 0)));
  for (const hero of heroes) {
    const identity = resolveHeroSkillPointIdentity(ctx, hero);
    if (!identity.actorUID) continue;
    legacy[identity.actorUID] = sharedBalance;
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
  // ORKA-hvj: migrate legacy per-hero point buckets to one shared party wallet.
  if (!Number.isFinite(Number(store[HERO_SKILL_SHARED_KEY]))) {
    const candidates = Object.entries(store)
      .filter(([key]) => key !== HERO_SKILL_SHARED_KEY)
      .map(([, rawValue]) => Math.max(0, Math.floor(Number(rawValue || 0))))
      .filter(value => Number.isFinite(value));
    store[HERO_SKILL_SHARED_KEY] = candidates.length ? Math.max(...candidates) : 0;
  }
  for (const key of Object.keys(store)) {
    if (key === HERO_SKILL_SHARED_KEY) continue;
    delete store[key];
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
  return getHeroSkillDefinitionsForOwner(heroName).map((def) => ({
    slot: Math.max(0, Math.floor(Number(def.slot) || 0)),
    key: String(def.id || ''),
    definitionId: String(def.id || ''),
    title: String(def.title || ''),
    cardText: String(def.cardText || ''),
    risk: String(def.risk || 'MED'),
    growth: Array.isArray(def.growth) ? def.growth.slice() : [],
    procPattern: String(def.procPattern || ''),
    payloadImplemented: def.payloadImplemented === true,
    maxRank: Array.isArray(def.growth) ? def.growth.length : 1,
    costs: HERO_SKILL_COSTS_BY_RISK[def.risk] || HERO_SKILL_COSTS_BY_RISK.MED,
  }));
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
    definitionId: String((def && def.definitionId) || (def && def.key) || ''),
    title: String((def && def.title) || ''),
    cardText: String((def && def.cardText) || ''),
    risk: String((def && def.risk) || ''),
    growth: Array.isArray(def && def.growth) ? def.growth.map(value => Math.max(0, Number(value) || 0)) : [],
    procPattern: String((def && def.procPattern) || ''),
    payloadImplemented: def && def.payloadImplemented === true,
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
    definitionId: String((entry && entry.definitionId) || (entry && entry.key) || ''),
    title: String((entry && entry.title) || ''),
    cardText: String((entry && entry.cardText) || ''),
    risk: String((entry && entry.risk) || ''),
    growth: Array.isArray(entry && entry.growth) ? entry.growth.map(value => Math.max(0, Number(value) || 0)) : [],
    procPattern: String((entry && entry.procPattern) || ''),
    payloadImplemented: entry && entry.payloadImplemented === true,
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
    current.definitionId = String(def.definitionId || current.definitionId || current.key || '');
    current.title = String(def.title || current.title || '');
    current.cardText = String(def.cardText || current.cardText || '');
    current.risk = String(def.risk || current.risk || '');
    current.growth = Array.isArray(def.growth) ? def.growth.map(value => Math.max(0, Number(value) || 0)) : current.growth;
    current.procPattern = String(def.procPattern || current.procPattern || '');
    current.payloadImplemented = def.payloadImplemented === true;
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
    const tx = buildHeroSkillPointTxn(g, identity, source, delta, Number(store[HERO_SKILL_SHARED_KEY] || 0), 'grant', 'rejected', 'invalid_amount');
    appendHeroSkillPointTxn(g, tx);
    return { ok: false, reason: 'invalid_amount', tx };
  }
  const current = Number(store[HERO_SKILL_SHARED_KEY] || 0);
  const next = current + delta;
  store[HERO_SKILL_SHARED_KEY] = next;
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
    const tx = buildHeroSkillPointTxn(g, identity, source, -Math.abs(spend || 0), Number(store[HERO_SKILL_SHARED_KEY] || 0), 'spend', 'rejected', 'invalid_amount');
    appendHeroSkillPointTxn(g, tx);
    return { ok: false, reason: 'invalid_amount', tx };
  }
  const current = Number(store[HERO_SKILL_SHARED_KEY] || 0);
  if (spend > current) {
    const tx = buildHeroSkillPointTxn(g, identity, source, -spend, current, 'spend', 'rejected', 'overdraft');
    appendHeroSkillPointTxn(g, tx);
    return { ok: false, reason: 'overdraft', balance: current, tx };
  }
  const next = current - spend;
  store[HERO_SKILL_SHARED_KEY] = next;
  syncHeroSkillPointLegacyUidView(ctx, store);
  const tx = buildHeroSkillPointTxn(g, identity, source, -spend, next, 'spend', 'applied');
  appendHeroSkillPointTxn(g, tx);
  return { ok: true, balance: next, tx };
}

export function GetHeroSkillPointBalance(ctx, heroUID) {
  const store = ensureHeroSkillPointStore(ctx);
  const identity = resolveHeroSkillPointIdentity(ctx, heroUID);
  if (!identity.heroId) return 0;
  return Number(store[HERO_SKILL_SHARED_KEY] || 0);
}

export function GetAllHeroSkillPointBalances(ctx) {
  const store = ensureHeroSkillPointStore(ctx);
  const out = {};
  const sharedBalance = Number(store[HERO_SKILL_SHARED_KEY] || 0);
  const stableIds = getAllHeroActors(ctx)
    .sort((a, b) => Number(a.heroIndex || 0) - Number(b.heroIndex || 0))
    .map(hero => makeStableHeroSkillPointId(hero))
    .filter(id => id);
  for (const heroId of stableIds) {
    out[heroId] = sharedBalance;
  }
  out[HERO_SKILL_SHARED_KEY] = sharedBalance;
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
  const store = ensureHeroSkillPointStore(ctx);
  const heroes = getAllHeroActors(ctx)
    .slice()
    .sort((a, b) => Number(a.heroIndex || 0) - Number(b.heroIndex || 0));
  const primaryUID = Number(heroes[0] && heroes[0].uid || 0);
  const primaryGrant = primaryUID > 0
    ? GrantHeroSkillPoints(ctx, primaryUID, amountEach, source)
    : { ok: false, tx: null };
  const sharedBalance = Number(store[HERO_SKILL_SHARED_KEY] || 0);
  const results = heroes.map(hero => {
    const identity = resolveHeroSkillPointIdentity(ctx, hero.uid);
    return {
      ok: !!primaryGrant.ok,
      balance: sharedBalance,
      heroId: String(identity.heroId || ''),
      heroIndex: Number((identity.heroIndex) ?? -1),
      heroName: String(identity.heroName || ''),
      actorUID: Number(identity.actorUID || 0),
      tx: primaryGrant.tx ? { ...primaryGrant.tx } : null,
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

export function SetHeroSkillPointsForParty(ctx, exactAmount = 300, source = 'party_seed_exact') {
  const g = getGlobals(ctx);
  const target = Math.max(0, Math.floor(Number(exactAmount || 0)));
  const store = ensureHeroSkillPointStore(ctx);
  const heroes = getAllHeroActors(ctx)
    .slice()
    .sort((a, b) => Number(a.heroIndex || 0) - Number(b.heroIndex || 0));
  store[HERO_SKILL_SHARED_KEY] = target;
  const results = heroes.map((hero) => {
    const identity = resolveHeroSkillPointIdentity(ctx, hero.uid);
    if (!identity.heroId) {
      return { ok: false, heroId: '', heroName: String(hero.name || ''), actorUID: Number(hero.uid || 0), balance: 0 };
    }
    return {
      ok: true,
      heroId: String(identity.heroId || ''),
      heroName: String(identity.heroName || ''),
      actorUID: Number(identity.actorUID || 0),
      balance: target,
    };
  });
  syncHeroSkillPointLegacyUidView(ctx, store);
  appendHeroSkillPointRewardTrace(g, {
    kind: 'party_seed_exact',
    source: String(source || 'party_seed_exact'),
    amountEach: target,
    grantsApplied: results.filter((row) => row.ok).length,
    heroIds: results.map((row) => row.heroId),
    actorUIDs: results.map((row) => row.actorUID),
    time: Number(g.time || 0),
    turn: Number(g.DebugTurnCount || 0),
    turnSerial: Number(g.TurnSerial || 0),
    results: results.map((row) => ({ ...row })),
  });
  return { ok: results.every((row) => row.ok), amountEach: target, results };
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

function ensureSkillProcRuntime(ctx) {
  const g = getGlobals(ctx);
  if (!g.HeroTempSkillStateByUID || typeof g.HeroTempSkillStateByUID !== 'object') g.HeroTempSkillStateByUID = {};
  if (!g.SessionSkillPassivesByHeroUID || typeof g.SessionSkillPassivesByHeroUID !== 'object') g.SessionSkillPassivesByHeroUID = {};
  if (!Array.isArray(g.SkillProcTrace)) g.SkillProcTrace = [];
  if (!Number.isFinite(g.SkillProcTraceSeq)) g.SkillProcTraceSeq = 0;
  if (!Number.isFinite(g.PartyDestinyAttempts)) g.PartyDestinyAttempts = 0;
  if (!Number.isFinite(g.PartyDestinyProcs)) g.PartyDestinyProcs = 0;
  if (!Number.isFinite(g.PartyDestinyHeals)) g.PartyDestinyHeals = 0;
  if (!Number.isFinite(g.PartyDestinyMisses)) g.PartyDestinyMisses = 0;
  if (typeof g.PartyDestinyLastResult !== 'string') g.PartyDestinyLastResult = '';
  return g;
}

function normalizeSkillProcId(skillRef) {
  if (skillRef && typeof skillRef === 'object') {
    return String(skillRef.id || skillRef.key || skillRef.definitionId || '').trim();
  }
  return String(skillRef || '').trim();
}

function appendSkillProcTrace(g, entry) {
  g.SkillProcTraceSeq = Math.max(0, Math.floor(Number(g.SkillProcTraceSeq || 0))) + 1;
  const trace = {
    seq: g.SkillProcTraceSeq,
    at: Number(g.time || 0),
    turn: Number(g.DebugTurnCount || 0),
    turnSerial: Number(g.TurnSerial || 0),
    ...entry,
  };
  g.SkillProcTrace.push(trace);
  if (g.SkillProcTrace.length > 120) g.SkillProcTrace.splice(0, g.SkillProcTrace.length - 120);
  return trace;
}

export function IsHeroSessionSkillActive(ctx, heroUID, skillRef) {
  const g = ensureSkillDraughtState(ctx);
  const skillId = normalizeSkillProcId(skillRef).toLowerCase();
  if (!skillId) return false;
  const bucket = g.SessionSkillsByHeroUID[String(Number(heroUID || 0))] || g.SessionSkillsByHeroUID[String(heroUID || '')] || [];
  if (!Array.isArray(bucket)) return false;
  return bucket.some(entry => {
    const id = String((entry && (entry.id || entry.key || entry.definitionId)) || '').trim().toLowerCase();
    return id === skillId;
  });
}

export function IsPartySessionSkillActive(ctx, skillRef) {
  const g = ensureSkillDraughtState(ctx);
  const skillId = normalizeSkillProcId(skillRef).toLowerCase();
  if (!skillId) return false;
  const bucket = g.SessionSkillsByHeroUID[HERO_SKILL_SHARED_KEY] || [];
  if (!Array.isArray(bucket)) return false;
  return bucket.some(entry => {
    const id = String((entry && (entry.id || entry.key || entry.definitionId)) || '').trim().toLowerCase();
    return id === skillId;
  });
}

function logPartyDestinyQa(ctx, eventName, data = {}) {
  const g = getGlobals(ctx);
  try {
    console.log('[DESTINY_QA]', {
      event: String(eventName || ''),
      checks: Number(g.PartyDestinyAttempts || 0),
      procs: Number(g.PartyDestinyProcs || 0),
      heals: Number(g.PartyDestinyHeals || 0),
      misses: Number(g.PartyDestinyMisses || 0),
      last: String(g.PartyDestinyLastResult || ''),
      turnPhase: Number(g.TurnPhase || 0),
      currentTurn: Number(GetCurrentTurn(ctx) || 0),
      ...data,
    });
  } catch (_) {}
}

export function GetHeroSkillGrowthValue(ctx, heroUID, skillRef, fallback = 0) {
  const skillId = normalizeSkillProcId(skillRef);
  const definition = GetSkillDefinition(ctx, skillRef) || GetSkillDefinition(ctx, skillId);
  if (!definition) return Number(fallback || 0);
  const progress = GetHeroSkillState(ctx, heroUID, skillId);
  const sessionActive = IsHeroSessionSkillActive(ctx, heroUID, skillId);
  const rank = Math.max(0, Math.floor(Number(progress && progress.rank || 0)), sessionActive ? 1 : 0);
  if (rank <= 0) return Number(fallback || 0);
  const growth = Array.isArray(definition.growth) ? definition.growth : [];
  const value = Number(growth[Math.min(growth.length - 1, rank - 1)]);
  return Number.isFinite(value) ? value : Number(fallback || 0);
}

export function RollHeroSkillProc(ctx, heroUID, skillRef, fallbackChancePct = 0, eventName = '') {
  const g = ensureSkillProcRuntime(ctx);
  const skillId = normalizeSkillProcId(skillRef);
  const definition = GetSkillDefinition(ctx, skillId);
  if (!definition) {
    const trace = appendSkillProcTrace(g, {
      eventName: String(eventName || ''),
      heroUID: Number(heroUID || 0),
      skillId,
      success: false,
      reason: 'skill_not_found',
      rollPct: 0,
      chancePct: 0,
      rank: 0,
    });
    return { ok: false, success: false, reason: 'skill_not_found', trace };
  }
  const progress = GetHeroSkillState(ctx, heroUID, skillId);
  const sessionActive = IsHeroSessionSkillActive(ctx, heroUID, skillId);
  const rank = Math.max(0, Math.floor(Number(progress && progress.rank || 0)), sessionActive ? 1 : 0);
  if (rank <= 0) {
    const trace = appendSkillProcTrace(g, {
      eventName: String(eventName || ''),
      heroUID: Number(heroUID || 0),
      skillId,
      skillTitle: String(definition.title || ''),
      success: false,
      reason: 'skill_locked',
      rollPct: 0,
      chancePct: 0,
      rank,
    });
    return { ok: false, success: false, reason: 'skill_locked', trace };
  }
  const growthChance = GetHeroSkillGrowthValue(ctx, heroUID, skillId, fallbackChancePct);
  const chancePct = Math.max(0, Math.min(100, Number(growthChance || fallbackChancePct || 0)));
  const rollPct = Math.floor(random01(ctx) * 10000) / 100;
  const success = rollPct <= chancePct;
  const trace = appendSkillProcTrace(g, {
    eventName: String(eventName || ''),
    heroUID: Number(heroUID || 0),
    skillId,
    skillTitle: String(definition.title || ''),
    success,
    reason: success ? 'proc_success' : 'proc_miss',
    rollPct,
    chancePct,
    rank,
    sessionActive,
  });
  return { ok: true, success, reason: trace.reason, rollPct, chancePct, rank, trace };
}

export function GetPartySkillGrowthValue(ctx, skillRef, fallback = 0) {
  const skillId = normalizeSkillProcId(skillRef);
  const definition = GetSkillDefinition(ctx, skillId);
  if (!definition || String(definition.owner || '').toLowerCase() !== 'party') return Number(fallback || 0);
  const rank = IsPartySessionSkillActive(ctx, skillId) ? 1 : 0;
  if (rank <= 0) return Number(fallback || 0);
  const growth = Array.isArray(definition.growth) ? definition.growth : [];
  const value = Number(growth[Math.min(growth.length - 1, rank - 1)]);
  return Number.isFinite(value) ? value : Number(fallback || 0);
}

export function RollPartySkillProc(ctx, skillRef, fallbackChancePct = 0, eventName = '') {
  const g = ensureSkillProcRuntime(ctx);
  const skillId = normalizeSkillProcId(skillRef);
  const definition = GetSkillDefinition(ctx, skillId);
  if (!definition || String(definition.owner || '').toLowerCase() !== 'party') {
    const trace = appendSkillProcTrace(g, {
      eventName: String(eventName || ''),
      scope: 'party',
      heroUID: 0,
      skillId,
      success: false,
      reason: 'skill_not_found',
      rollPct: 0,
      chancePct: 0,
      rank: 0,
    });
    return { ok: false, success: false, reason: 'skill_not_found', trace };
  }
  const sessionActive = IsPartySessionSkillActive(ctx, skillId);
  const rank = sessionActive ? 1 : 0;
  if (rank <= 0) {
    const trace = appendSkillProcTrace(g, {
      eventName: String(eventName || ''),
      scope: 'party',
      heroUID: 0,
      skillId,
      skillTitle: String(definition.title || ''),
      success: false,
      reason: 'skill_locked',
      rollPct: 0,
      chancePct: 0,
      rank,
    });
    return { ok: false, success: false, reason: 'skill_locked', trace };
  }
  const growthChance = GetPartySkillGrowthValue(ctx, skillId, fallbackChancePct);
  const chancePct = Math.max(0, Math.min(100, Number(growthChance || fallbackChancePct || 0)));
  const rollPct = Math.floor(random01(ctx) * 10000) / 100;
  const success = rollPct <= chancePct;
  const trace = appendSkillProcTrace(g, {
    eventName: String(eventName || ''),
    scope: 'party',
    heroUID: 0,
    skillId,
    skillTitle: String(definition.title || ''),
    success,
    reason: success ? 'proc_success' : 'proc_miss',
    rollPct,
    chancePct,
    rank,
    sessionActive,
  });
  return { ok: true, success, reason: trace.reason, rollPct, chancePct, rank, trace };
}

function applyPartyDestinyActorHeal(ctx, actorUID, healAmount) {
  const g = getGlobals(ctx);
  const actor = GetActorByUID(ctx, actorUID);
  if (!actor || actor.kind !== 'hero') return { before: 0, after: 0, appliedHeal: 0, reason: 'source_not_hero' };
  const before = Math.max(0, Number(actor.hp || 0));
  const maxHP = Math.max(before, Number(actor.maxHP || actor.MaxHP || 0));
  const desired = Math.min(maxHP, before + Math.max(0, Math.floor(Number(healAmount || 0))));
  if (desired <= before) return { before, after: before, appliedHeal: 0 };
  actor.hp = desired;
  const idx = Number(actor.heroIndex ?? -1);
  if (Array.isArray(g.PartyHPByIndex) && idx >= 0) {
    const beforeSlot = Math.max(0, Number(g.PartyHPByIndex[idx] ?? before));
    const maxSlot = Array.isArray(g.PartyMaxHPByIndex) ? Number(g.PartyMaxHPByIndex[idx] ?? maxHP) : maxHP;
    g.PartyHPByIndex[idx] = Math.min(Math.max(beforeSlot, maxSlot), beforeSlot + (desired - before));
    g.PartyHP = sum(g.PartyHPByIndex || []);
  }
  if (ctx && typeof ctx.callFunction === 'function') {
    try { ctx.callFunction('UpdateHeroHPUI'); } catch (_) {}
    try { ctx.callFunction('UpdatePartyHPText'); } catch (_) {}
    try { ctx.callFunction('UpdatePartyHPBar'); } catch (_) {}
  }
  return { before, after: Number(actor.hp || 0), appliedHeal: Math.max(0, Number(actor.hp || 0) - before) };
}

export function TryPartyDestiny(ctx, options = undefined) {
  const g = ensureSkillProcRuntime(ctx);
  const opts = options && typeof options === 'object' ? options : {};
  const sourceUID = Number(opts.sourceUID || opts.actorUID || GetCurrentTurn(ctx) || 0);
  const target = GetActorByUID(ctx, Number(opts.targetUID || 0));
  const source = GetActorByUID(ctx, sourceUID);
  if (!source || source.kind !== 'hero') {
    g.LastPartyDestiny = { success: false, reason: 'source_not_hero', sourceUID };
    return { ok: false, success: false, reason: 'source_not_hero', sourceUID, appliedHeal: 0 };
  }
  if (target && target.kind !== 'enemy') {
    g.LastPartyDestiny = { success: false, reason: 'target_not_enemy', sourceUID, targetUID: Number(target.uid || 0) };
    return { ok: false, success: false, reason: 'target_not_enemy', sourceUID, targetUID: Number(target.uid || 0), appliedHeal: 0 };
  }
  if (Number(opts.appliedDamage || 0) <= 0 && !opts.allowNoDamage) {
    g.LastPartyDestiny = { success: false, reason: 'no_applied_damage', sourceUID, targetUID: Number(opts.targetUID || 0) };
    return { ok: false, success: false, reason: 'no_applied_damage', sourceUID, targetUID: Number(opts.targetUID || 0), appliedHeal: 0 };
  }
  const forcedRoll = Number(opts.forcedRollPct);
  const previousRandom = g.RuntimeRandom;
  if (Number.isFinite(forcedRoll)) {
    g.RuntimeRandom = () => Math.max(0, Math.min(0.9999, forcedRoll / 100));
  }
  let roll;
  try {
    roll = RollPartySkillProc(ctx, 'party_destiny', 0, opts.eventName || 'hit_enemy');
  } finally {
    if (Number.isFinite(forcedRoll)) g.RuntimeRandom = previousRandom;
  }
  if (roll.ok) {
    g.PartyDestinyAttempts = Math.max(0, Math.floor(Number(g.PartyDestinyAttempts || 0))) + 1;
  }
  logPartyDestinyQa(ctx, 'roll_resolved', {
    sourceUID,
    targetUID: Number(opts.targetUID || 0),
    appliedDamage: Number(opts.appliedDamage || 0),
    rollOk: !!roll.ok,
    rollSuccess: !!roll.success,
    reason: String(roll.reason || ''),
    chancePct: Number(roll.chancePct || 0),
    rollPct: Number(roll.rollPct || 0),
  });
  if (!roll.success) {
    if (roll.reason === 'proc_miss') g.PartyDestinyMisses = Math.max(0, Math.floor(Number(g.PartyDestinyMisses || 0))) + 1;
    g.PartyDestinyLastResult = String(roll.reason || 'no_proc');
    g.LastPartyDestiny = { success: false, reason: roll.reason, sourceUID, targetUID: Number(opts.targetUID || 0), roll };
    return { ok: roll.ok, success: false, reason: roll.reason, sourceUID, targetUID: Number(opts.targetUID || 0), roll, appliedHeal: 0 };
  }
  g.PartyDestinyProcs = Math.max(0, Math.floor(Number(g.PartyDestinyProcs || 0))) + 1;
  const maxHP = Math.max(0, Number(source.maxHP || source.MaxHP || 0));
  const defaultHeal = Math.max(1, Math.ceil(maxHP * 0.10));
  const requestedHeal = Math.max(1, Math.floor(Number(opts.healAmount || defaultHeal)));
  const heal = applyPartyDestinyActorHeal(ctx, sourceUID, requestedHeal);
  if (heal.appliedHeal > 0) g.PartyDestinyHeals = Math.max(0, Math.floor(Number(g.PartyDestinyHeals || 0))) + 1;
  g.LastPartyDestiny = { success: true, reason: heal.appliedHeal > 0 ? 'healed' : 'hp_full', sourceUID, targetUID: Number(opts.targetUID || 0), roll, requestedHeal, ...heal };
  g.PartyDestinyLastResult = String(g.LastPartyDestiny.reason || 'proc_success');
  if (heal.appliedHeal > 0) LogCombat(ctx, `Destiny restores ${heal.appliedHeal} HP to ${source.name || 'the hero'}.`);
  else LogCombat(ctx, 'Chance to restore HP when attacking enemies activated!');
  return { ok: true, success: true, reason: g.LastPartyDestiny.reason, sourceUID, targetUID: Number(opts.targetUID || 0), roll, requestedHeal, ...heal };
}

export function TriggerPartyDestinyDev(ctx, sourceUID = 0) {
  const g = ensureSkillProcRuntime(ctx);
  ensureSkillDraughtState(ctx);
  const source = GetActorByUID(ctx, sourceUID) || getHeroes(ctx).find(hero => Number(hero?.hp || 0) > 0) || null;
  if (!source) return { ok: false, success: false, reason: 'source_not_found', appliedHeal: 0 };
  if (!Array.isArray(g.SessionSkillsByHeroUID[HERO_SKILL_SHARED_KEY])) g.SessionSkillsByHeroUID[HERO_SKILL_SHARED_KEY] = [];
  const hasDestiny = g.SessionSkillsByHeroUID[HERO_SKILL_SHARED_KEY].some(entry =>
    String((entry && (entry.id || entry.key || entry.definitionId)) || '').trim().toLowerCase() === 'party_destiny'
  );
  if (!hasDestiny) {
    g.SessionSkillsByHeroUID[HERO_SKILL_SHARED_KEY].push({
      id: 'party_destiny',
      key: 'party_destiny',
      title: 'Destiny',
      description: 'Attacks can restore HP.',
      owner: 'Party',
      selectedAt: Number(g.time || 0),
      source: 'dev_trigger',
    });
  }
  g.PartyDestinyAttempts = 0;
  g.PartyDestinyProcs = 0;
  g.PartyDestinyHeals = 0;
  g.PartyDestinyMisses = 0;
  g.PartyDestinyLastResult = 'activated';
  g.LastPartyDestiny = {
    success: false,
    reason: 'activated',
    sourceUID: Number(source.uid || 0),
    targetUID: 0,
    appliedHeal: 0,
  };
  LogCombat(ctx, 'Chance to restore HP when attacking enemies activated!');
  logPartyDestinyQa(ctx, 'activated', { sourceUID: Number(source.uid || 0) });
  return { ok: true, success: true, reason: 'activated', sourceUID: Number(source.uid || 0), appliedHeal: 0 };
}

export function GetSkillProcTrace(ctx, limit = 40) {
  const g = ensureSkillProcRuntime(ctx);
  const max = Math.max(1, Math.floor(Number(limit || 40)));
  return g.SkillProcTrace.slice(-max).map(row => ({ ...row }));
}

export function SetHeroTempSkillState(ctx, heroUID, key, value, expiresAt = 0) {
  const g = ensureSkillProcRuntime(ctx);
  const uidKey = String(Number(heroUID || 0));
  if (!g.HeroTempSkillStateByUID[uidKey] || typeof g.HeroTempSkillStateByUID[uidKey] !== 'object') {
    g.HeroTempSkillStateByUID[uidKey] = {};
  }
  const stateKey = String(key || '');
  if (!stateKey) return { ok: false, reason: 'invalid_key' };
  g.HeroTempSkillStateByUID[uidKey][stateKey] = {
    value,
    expiresAt: Number(expiresAt || 0),
    setAt: Number(g.time || 0),
  };
  return { ok: true, heroUID: Number(heroUID || 0), key: stateKey, entry: { ...g.HeroTempSkillStateByUID[uidKey][stateKey] } };
}

export function GetHeroTempSkillState(ctx, heroUID, key) {
  const g = ensureSkillProcRuntime(ctx);
  const bucket = g.HeroTempSkillStateByUID[String(Number(heroUID || 0))] || {};
  const entry = bucket[String(key || '')] || null;
  if (!entry) return null;
  const expiresAt = Number(entry.expiresAt || 0);
  if (expiresAt > 0 && expiresAt <= Number(g.time || 0)) {
    delete bucket[String(key || '')];
    return null;
  }
  return { ...entry };
}

export function ExpireHeroTempSkillState(ctx) {
  const g = ensureSkillProcRuntime(ctx);
  let expired = 0;
  const now = Number(g.time || 0);
  for (const bucket of Object.values(g.HeroTempSkillStateByUID)) {
    if (!bucket || typeof bucket !== 'object') continue;
    for (const [key, entry] of Object.entries(bucket)) {
      const expiresAt = Number(entry && entry.expiresAt || 0);
      if (expiresAt > 0 && expiresAt <= now) {
        delete bucket[key];
        expired += 1;
      }
    }
  }
  return { ok: true, expired };
}

export function AddSessionPassive(ctx, heroUID, passiveKey, amount = 0, sourceSkillId = '') {
  const g = ensureSkillProcRuntime(ctx);
  const uidKey = String(Number(heroUID || 0));
  if (!g.SessionSkillPassivesByHeroUID[uidKey] || typeof g.SessionSkillPassivesByHeroUID[uidKey] !== 'object') {
    g.SessionSkillPassivesByHeroUID[uidKey] = {};
  }
  const key = String(passiveKey || '');
  if (!key) return { ok: false, reason: 'invalid_key' };
  if (!Array.isArray(g.SessionSkillPassivesByHeroUID[uidKey][key])) g.SessionSkillPassivesByHeroUID[uidKey][key] = [];
  const entry = {
    amount: Number(amount || 0),
    sourceSkillId: String(sourceSkillId || ''),
    addedAt: Number(g.time || 0),
  };
  g.SessionSkillPassivesByHeroUID[uidKey][key].push(entry);
  return { ok: true, heroUID: Number(heroUID || 0), key, total: GetSessionPassiveTotal(ctx, heroUID, key), entry: { ...entry } };
}

export function GetSessionPassiveTotal(ctx, heroUID, passiveKey) {
  const g = ensureSkillProcRuntime(ctx);
  const bucket = g.SessionSkillPassivesByHeroUID[String(Number(heroUID || 0))] || {};
  const entries = Array.isArray(bucket[String(passiveKey || '')]) ? bucket[String(passiveKey || '')] : [];
  return entries.reduce((total, entry) => total + Number(entry && entry.amount || 0), 0);
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

export function AttemptHeroSkillDowngrade(ctx, heroUID, skillRef, source = 'hero_skill_downgrade') {
  const g = getGlobals(ctx);
  const pair = ensureHeroSkillProgressRecord(ctx, heroUID);
  if (!pair.identity.heroId || !pair.record) {
    const rejectedState = buildDefaultHeroSkillProgressState({ key: '', title: '', slot: -1, maxRank: 1, costs: [] });
    const trace = buildHeroSkillProgressTrace(g, pair.identity, rejectedState, 'downgrade', 0, 'rejected', 'hero_not_found', 0);
    appendHeroSkillProgressTrace(g, trace);
    return { ok: false, reason: 'hero_not_found', state: null, trace };
  }
  const entry = resolveHeroSkillProgressEntry(pair.record, skillRef);
  if (!entry) {
    const rejectedState = buildDefaultHeroSkillProgressState({ key: '', title: '', slot: -1, maxRank: 1, costs: [] });
    const trace = buildHeroSkillProgressTrace(g, pair.identity, rejectedState, 'downgrade', 0, 'rejected', 'skill_not_found', GetHeroSkillPointBalance(ctx, heroUID));
    appendHeroSkillProgressTrace(g, trace);
    return { ok: false, reason: 'skill_not_found', state: null, trace };
  }
  const state = cloneHeroSkillProgressState(entry);
  if (state.rank <= 0) {
    const trace = buildHeroSkillProgressTrace(g, pair.identity, state, 'downgrade', 0, 'rejected', 'min_rank_reached', GetHeroSkillPointBalance(ctx, heroUID));
    appendHeroSkillProgressTrace(g, trace);
    return { ok: false, reason: 'min_rank_reached', state, trace };
  }
  const refundIndex = Math.max(0, state.rank - 1);
  const refund = Math.max(0, Math.floor(Number(state.costs[refundIndex] || state.lastCost || 0)));
  if (!Number.isFinite(refund) || refund <= 0) {
    const trace = buildHeroSkillProgressTrace(g, pair.identity, state, 'downgrade', 0, 'rejected', 'invalid_refund_config', GetHeroSkillPointBalance(ctx, heroUID));
    appendHeroSkillProgressTrace(g, trace);
    return { ok: false, reason: 'invalid_refund_config', state, trace };
  }
  const grant = GrantHeroSkillPoints(ctx, heroUID, refund, `${source}:${state.key}:refund`);
  if (!grant.ok) {
    const reason = String(grant.reason || 'refund_failed');
    const trace = buildHeroSkillProgressTrace(g, pair.identity, state, 'downgrade', refund, 'rejected', reason, Number(grant.balance || GetHeroSkillPointBalance(ctx, heroUID)));
    appendHeroSkillProgressTrace(g, trace);
    return { ok: false, reason, state, trace, grant };
  }
  state.rank -= 1;
  state.status = state.rank > 0 ? 'unlocked' : 'locked';
  state.nextCost = state.rank >= state.maxRank
    ? 0
    : Math.max(0, Math.floor(Number(state.costs[state.rank] || 0)));
  state.lastCost = state.rank > 0
    ? Math.max(0, Math.floor(Number(state.costs[state.rank - 1] || 0)))
    : 0;
  pair.record[state.key] = state;
  const snapshot = cloneHeroSkillProgressState(state);
  const trace = buildHeroSkillProgressTrace(g, pair.identity, snapshot, 'downgrade', refund, 'applied', '', Number(grant.balance || 0));
  appendHeroSkillProgressTrace(g, trace);
  return { ok: true, action: 'downgrade', refund, balance: Number(grant.balance || 0), state: snapshot, trace, grant };
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

function ensureAstralFlowAmpState(ctx) {
  const g = getGlobals(ctx);
  if (!Number.isFinite(g.AstralFlowAmpPoints)) g.AstralFlowAmpPoints = 0;
  if (!Number.isFinite(g.AstralFlowAmpMax) || Number(g.AstralFlowAmpMax) <= 0) g.AstralFlowAmpMax = 18;
  if (!Number.isFinite(g.AstralFlowAmpReady)) g.AstralFlowAmpReady = 0;
  return g;
}

function shouldResetAstralFlowAmpOnHeroTurn(g) {
  if (Number(g.SkillDraughtOpen || 0)) return false;
  if (!Number(g.AstralFlowAmpReady || 0)) return false;
  const ampMax = Math.max(1, Number(g.AstralFlowAmpMax || 18));
  if (Math.max(0, Number(g.AstralFlowAmpPoints || 0)) < ampMax) return false;
  return Number(g.time || 0) >= Number(g.CombatActionPinnedUntil || 0);
}

function recoverStaleActionInProgress(g, currentUID = 0) {
  const ownerUID = Number(g.ActionActorUID || 0);
  if (!Number(g.ActionInProgress || 0) || !ownerUID || ownerUID === Number(currentUID || 0)) return false;
  const heroActive = !!(g.HeroAction && g.HeroAction.active && Number(g.HeroAction.uid || 0) === ownerUID);
  const enemyActive = !!(g.EnemyAction && g.EnemyAction.active && Number(g.EnemyAction.uid || 0) === ownerUID);
  if (heroActive || enemyActive) return false;
  g.ActionInProgress = 0;
  g.ActionActorUID = 0;
  return true;
}

const HERO_GEM_USAGE_KEYS = Object.freeze(['RED', 'GREEN', 'BLUE', 'HEAL', 'YELLOW']);
const HERO_GEM_MILESTONE_DEFAULTS = Object.freeze([1000, 5000, 10000]);

function cloneGemUsageRow(input = null) {
  const row = createGemUsageRow();
  for (const key of HERO_GEM_USAGE_KEYS) {
    row[key] = Math.max(0, Math.floor(Number(input && input[key]) || 0));
  }
  return row;
}

function sanitizeHeroGemMilestoneThresholds(thresholds) {
  const source = Array.isArray(thresholds) ? thresholds : HERO_GEM_MILESTONE_DEFAULTS;
  const unique = new Set();
  for (const raw of source) {
    const value = Math.max(0, Math.floor(Number(raw) || 0));
    if (value > 0) unique.add(value);
  }
  return Array.from(unique).sort((a, b) => a - b);
}

function createHeroGemMilestoneColorState(total = 0, thresholds = HERO_GEM_MILESTONE_DEFAULTS, reached = []) {
  const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
  const safeThresholds = sanitizeHeroGemMilestoneThresholds(thresholds);
  const reachedSet = new Set();
  for (const raw of Array.isArray(reached) ? reached : []) {
    const value = Math.max(0, Math.floor(Number(raw) || 0));
    if (value > 0 && value <= safeTotal && safeThresholds.includes(value)) reachedSet.add(value);
  }
  const normalizedReached = safeThresholds.filter((value) => value <= safeTotal || reachedSet.has(value));
  return {
    total: safeTotal,
    reached: normalizedReached,
    next: safeThresholds.find((value) => value > safeTotal) || 0,
    lastReached: normalizedReached.length ? normalizedReached[normalizedReached.length - 1] : 0,
  };
}

function createHeroGemMilestoneRecord(thresholds = HERO_GEM_MILESTONE_DEFAULTS, totals = null, existing = null) {
  const record = {};
  for (const key of HERO_GEM_USAGE_KEYS) {
    const current = existing && typeof existing[key] === 'object' ? existing[key] : null;
    record[key] = createHeroGemMilestoneColorState(
      totals && totals[key],
      thresholds,
      current && current.reached,
    );
  }
  return record;
}

function extractHeroGemMilestoneTotals(record = null) {
  const totals = createGemUsageRow();
  for (const key of HERO_GEM_USAGE_KEYS) {
    const value = record && record[key] && typeof record[key] === 'object'
      ? record[key].total
      : 0;
    totals[key] = Math.max(0, Math.floor(Number(value) || 0));
  }
  return totals;
}

function nextHeroGemMilestoneTraceSeq(g) {
  const next = Math.max(0, Math.floor(Number(g.HeroGemMilestones?.traceSeq || 0))) + 1;
  g.HeroGemMilestones.traceSeq = next;
  return next;
}

function appendHeroGemMilestoneTrace(g, entry) {
  const store = g.HeroGemMilestones;
  if (!store || typeof store !== 'object') return null;
  if (!Array.isArray(store.trace)) store.trace = [];
  const traceEntry = {
    seq: nextHeroGemMilestoneTraceSeq(g),
    scope: String(entry && entry.scope || 'party'),
    heroId: String(entry && entry.heroId || ''),
    heroName: String(entry && entry.heroName || ''),
    colorKey: String(entry && entry.colorKey || ''),
    threshold: Math.max(0, Math.floor(Number(entry && entry.threshold) || 0)),
    total: Math.max(0, Math.floor(Number(entry && entry.total) || 0)),
  };
  store.trace.push(traceEntry);
  if (store.trace.length > 80) store.trace.splice(0, store.trace.length - 80);
  return traceEntry;
}

function touchHeroGemProgressDirty(ctx) {
  const g = getGlobals(ctx);
  g.HeroGemProgressDirty = 1;
  g.HeroGemProgressLastChangedAt = Number(g.time || 0);
}

function buildHeroGemUsageRecord(identity, totals = null) {
  return {
    heroId: String(identity && identity.heroId || ''),
    heroName: String(identity && identity.heroName || ''),
    heroIndex: Number.isInteger(Number(identity && identity.heroIndex)) ? Number(identity.heroIndex) : -1,
    actorUID: Math.max(0, Math.floor(Number(identity && identity.actorUID) || 0)),
    totals: cloneGemUsageRow(totals),
  };
}

function migrateLegacyHeroGemUsageByName(ctx, usage) {
  const legacy = usage && usage.byHero && typeof usage.byHero === 'object' ? usage.byHero : {};
  if (Object.keys(usage.byHeroId || {}).length > 0) return;
  for (const [heroName, totals] of Object.entries(legacy)) {
    const identity = resolveHeroSkillPointIdentity(ctx, heroName);
    const heroId = identity.heroId || `hero_name:${String(heroName || '').trim().toLowerCase()}`;
    usage.byHeroId[heroId] = buildHeroGemUsageRecord({
      heroId,
      heroName: identity.heroName || String(heroName || ''),
      heroIndex: identity.heroIndex,
      actorUID: identity.actorUID,
    }, totals);
  }
}

function syncHeroGemUsageLegacyView(ctx, usage) {
  usage.party = cloneGemUsageRow(usage.party);
  if (!usage.byHeroId || typeof usage.byHeroId !== 'object') usage.byHeroId = {};
  usage.byHero = {};
  for (const [heroId, rawRecord] of Object.entries(usage.byHeroId)) {
    const identity = resolveHeroSkillPointIdentity(ctx, heroId);
    const record = buildHeroGemUsageRecord({
      heroId,
      heroName: identity.heroName || rawRecord?.heroName || '',
      heroIndex: identity.heroIndex >= 0 ? identity.heroIndex : rawRecord?.heroIndex,
      actorUID: identity.actorUID > 0 ? identity.actorUID : rawRecord?.actorUID,
    }, rawRecord && rawRecord.totals);
    usage.byHeroId[heroId] = record;
    const heroName = record.heroName || heroId;
    usage.byHero[heroName] = cloneGemUsageRow(record.totals);
  }
  return usage;
}

function ensureHeroGemUsageState(ctx) {
  const g = getGlobals(ctx);
  if (!g.HeroGemUsage || typeof g.HeroGemUsage !== 'object') {
    g.HeroGemUsage = {
      version: 1,
      byHeroId: {},
      byHero: {},
      party: { RED: 0, GREEN: 0, BLUE: 0, HEAL: 0, YELLOW: 0 },
    };
  }
  if (!Number.isFinite(g.HeroGemUsage.version)) g.HeroGemUsage.version = 1;
  if (!g.HeroGemUsage.byHeroId || typeof g.HeroGemUsage.byHeroId !== 'object') g.HeroGemUsage.byHeroId = {};
  if (!g.HeroGemUsage.byHero || typeof g.HeroGemUsage.byHero !== 'object') g.HeroGemUsage.byHero = {};
  if (!g.HeroGemUsage.party || typeof g.HeroGemUsage.party !== 'object') {
    g.HeroGemUsage.party = { RED: 0, GREEN: 0, BLUE: 0, HEAL: 0, YELLOW: 0 };
  }
  migrateLegacyHeroGemUsageByName(ctx, g.HeroGemUsage);
  syncHeroGemUsageLegacyView(ctx, g.HeroGemUsage);
  return g.HeroGemUsage;
}

function createGemUsageRow() {
  return { RED: 0, GREEN: 0, BLUE: 0, HEAL: 0, YELLOW: 0 };
}

function resolveGemUsageColorKey(gemColor) {
  if (gemColor === 0) return 'GREEN';
  if (gemColor === 1) return 'RED';
  if (gemColor === 2) return 'BLUE';
  if (gemColor === 3) return 'YELLOW';
  if (gemColor === 4) return 'HEAL';
  return '';
}

function ensureHeroGemMilestonesState(ctx) {
  const g = getGlobals(ctx);
  if (!g.HeroGemMilestones || typeof g.HeroGemMilestones !== 'object') {
    g.HeroGemMilestones = {
      thresholds: [...HERO_GEM_MILESTONE_DEFAULTS],
      byHeroId: {},
      party: createHeroGemMilestoneRecord(HERO_GEM_MILESTONE_DEFAULTS),
      trace: [],
      traceSeq: 0,
    };
  }
  const store = g.HeroGemMilestones;
  store.thresholds = sanitizeHeroGemMilestoneThresholds(store.thresholds);
  if (!store.byHeroId || typeof store.byHeroId !== 'object') store.byHeroId = {};
  if (!Array.isArray(store.trace)) store.trace = [];
  if (!Number.isFinite(store.traceSeq)) store.traceSeq = 0;
  store.party = createHeroGemMilestoneRecord(store.thresholds, extractHeroGemMilestoneTotals(store.party), store.party);
  for (const heroId of Object.keys(store.byHeroId)) {
    store.byHeroId[heroId] = createHeroGemMilestoneRecord(
      store.thresholds,
      extractHeroGemMilestoneTotals(store.byHeroId[heroId]),
      store.byHeroId[heroId],
    );
  }
  return store;
}

function evaluateHeroGemMilestones(ctx, heroId = '', emitTrace = false) {
  const usage = ensureHeroGemUsageState(ctx);
  const store = ensureHeroGemMilestonesState(ctx);
  const g = getGlobals(ctx);
  const thresholds = store.thresholds;
  const hits = [];

  const partyPrevious = createHeroGemMilestoneRecord(thresholds, null, store.party);
  const recordParty = createHeroGemMilestoneRecord(thresholds, usage.party, store.party);
  store.party = recordParty;
  for (const colorKey of HERO_GEM_USAGE_KEYS) {
    const previous = partyPrevious[colorKey];
    const current = recordParty[colorKey];
    const newHits = current.reached.filter((value) => !previous.reached.includes(value));
    for (const threshold of newHits) {
      const traceEntry = emitTrace ? appendHeroGemMilestoneTrace(g, {
        scope: 'party',
        colorKey,
        threshold,
        total: current.total,
      }) : null;
      hits.push({ scope: 'party', colorKey, threshold, total: current.total, trace: traceEntry });
    }
  }

  const heroKey = String(heroId || '');
  if (heroKey) {
    const heroRecord = usage.byHeroId[heroKey];
    const previous = createHeroGemMilestoneRecord(thresholds, null, store.byHeroId[heroKey]);
    const current = createHeroGemMilestoneRecord(thresholds, heroRecord && heroRecord.totals, store.byHeroId[heroKey]);
    store.byHeroId[heroKey] = current;
    for (const colorKey of HERO_GEM_USAGE_KEYS) {
      const newHits = current[colorKey].reached.filter((value) => !previous[colorKey].reached.includes(value));
      for (const threshold of newHits) {
        const traceEntry = emitTrace ? appendHeroGemMilestoneTrace(g, {
          scope: 'hero',
          heroId: heroKey,
          heroName: heroRecord && heroRecord.heroName,
          colorKey,
          threshold,
          total: current[colorKey].total,
        }) : null;
        hits.push({ scope: 'hero', heroId: heroKey, colorKey, threshold, total: current[colorKey].total, trace: traceEntry });
      }
    }
  }

  return hits;
}

export function RegisterHeroGemUsage(ctx, actorUID, gemColor, consumedCount = 0) {
  const hero = GetActorByUID(ctx, actorUID);
  if (!hero || hero.kind !== 'hero') return false;
  const colorKey = resolveGemUsageColorKey(Number(gemColor));
  const increment = Math.max(0, Number(consumedCount) || 0);
  if (!colorKey || increment <= 0) return false;
  const usage = ensureHeroGemUsageState(ctx);
  const identity = resolveHeroSkillPointIdentity(ctx, hero);
  const heroKey = identity.heroId || `hero_name:${String(hero.name || actorUID || 'hero').trim().toLowerCase()}`;
  if (!usage.byHeroId[heroKey] || typeof usage.byHeroId[heroKey] !== 'object') {
    usage.byHeroId[heroKey] = buildHeroGemUsageRecord({
      heroId: heroKey,
      heroName: identity.heroName || String(hero.name || ''),
      heroIndex: identity.heroIndex,
      actorUID: identity.actorUID || actorUID,
    });
  }
  const record = usage.byHeroId[heroKey];
  record.heroName = identity.heroName || record.heroName || String(hero.name || '');
  record.heroIndex = identity.heroIndex >= 0 ? identity.heroIndex : record.heroIndex;
  record.actorUID = identity.actorUID > 0 ? identity.actorUID : Math.max(0, Math.floor(Number(actorUID) || 0));
  if (!record.totals || typeof record.totals !== 'object') record.totals = createGemUsageRow();
  if (!usage.party[colorKey]) usage.party[colorKey] = 0;
  record.totals[colorKey] = Number(record.totals[colorKey] || 0) + increment;
  usage.party[colorKey] = Number(usage.party[colorKey] || 0) + increment;
  syncHeroGemUsageLegacyView(ctx, usage);
  evaluateHeroGemMilestones(ctx, heroKey, true);
  touchHeroGemProgressDirty(ctx);
  return true;
}

export function GetHeroGemProgressSnapshot(ctx) {
  const usage = ensureHeroGemUsageState(ctx);
  const milestones = ensureHeroGemMilestonesState(ctx);
  const byHeroId = {};
  for (const [heroId, record] of Object.entries(usage.byHeroId || {})) {
    byHeroId[heroId] = {
      heroId: String(record.heroId || heroId),
      heroName: String(record.heroName || ''),
      heroIndex: Number.isInteger(Number(record.heroIndex)) ? Number(record.heroIndex) : -1,
      totals: cloneGemUsageRow(record.totals),
    };
  }
  return {
    version: 1,
    usage: {
      byHeroId,
      party: cloneGemUsageRow(usage.party),
    },
    milestones: {
      thresholds: sanitizeHeroGemMilestoneThresholds(milestones.thresholds),
    },
  };
}

export function LoadHeroGemProgressSnapshot(ctx, snapshot = null) {
  const usage = ensureHeroGemUsageState(ctx);
  const incomingUsage = snapshot && snapshot.usage && typeof snapshot.usage === 'object'
    ? snapshot.usage
    : {};
  const byHeroId = incomingUsage.byHeroId && typeof incomingUsage.byHeroId === 'object'
    ? incomingUsage.byHeroId
    : {};
  usage.byHeroId = {};
  for (const [heroId, record] of Object.entries(byHeroId)) {
    const identity = resolveHeroSkillPointIdentity(ctx, heroId);
    const stableHeroId = identity.heroId || String(record && record.heroId || heroId || '');
    if (!stableHeroId) continue;
    usage.byHeroId[stableHeroId] = buildHeroGemUsageRecord({
      heroId: stableHeroId,
      heroName: identity.heroName || String(record && record.heroName || ''),
      heroIndex: identity.heroIndex >= 0 ? identity.heroIndex : Number(record && record.heroIndex),
      actorUID: identity.actorUID,
    }, record && record.totals);
  }
  usage.party = cloneGemUsageRow(incomingUsage.party);
  syncHeroGemUsageLegacyView(ctx, usage);

  const store = ensureHeroGemMilestonesState(ctx);
  const incomingMilestones = snapshot && snapshot.milestones && typeof snapshot.milestones === 'object'
    ? snapshot.milestones
    : {};
  store.thresholds = sanitizeHeroGemMilestoneThresholds(incomingMilestones.thresholds);
  store.byHeroId = {};
  store.party = createHeroGemMilestoneRecord(store.thresholds, usage.party);
  store.trace = [];
  store.traceSeq = 0;
  for (const heroId of Object.keys(usage.byHeroId)) {
    store.byHeroId[heroId] = createHeroGemMilestoneRecord(store.thresholds, usage.byHeroId[heroId].totals);
  }

  const g = getGlobals(ctx);
  g.HeroGemProgressDirty = 0;
  g.HeroGemProgressLastChangedAt = Number(g.time || 0);
  return true;
}

export function ConfigureHeroGemMilestoneThresholds(ctx, thresholds = []) {
  const store = ensureHeroGemMilestonesState(ctx);
  store.thresholds = sanitizeHeroGemMilestoneThresholds(thresholds);
  store.party = createHeroGemMilestoneRecord(store.thresholds);
  store.byHeroId = {};
  store.trace = [];
  store.traceSeq = 0;
  const usage = ensureHeroGemUsageState(ctx);
  for (const heroId of Object.keys(usage.byHeroId)) {
    store.byHeroId[heroId] = createHeroGemMilestoneRecord(store.thresholds, usage.byHeroId[heroId].totals);
  }
  store.party = createHeroGemMilestoneRecord(store.thresholds, usage.party);
  touchHeroGemProgressDirty(ctx);
  return [...store.thresholds];
}

export function GetHeroGemMilestones(ctx) {
  const store = ensureHeroGemMilestonesState(ctx);
  return JSON.parse(JSON.stringify(store));
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

function pickDropTier(ctx) {
  const g = getGlobals(ctx);
  if (g && Number.isFinite(g.DropTierOverride)) return Math.max(0, Math.min(3, Math.floor(g.DropTierOverride)));
  const weights = [2, 8, 20, 70];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random01(ctx) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 3;
}

function getDropGateChancePct(g) {
  const topLevel = Number(g?.DropGateChancePct);
  if (Number.isFinite(topLevel)) return clamp(0, topLevel, 100);
  const legacy = Number(g?.DropChancePct);
  if (Number.isFinite(legacy)) return clamp(0, legacy, 100);
  const fromArray = Array.isArray(g?.DropSlotChancePctByIndex) ? Number(g.DropSlotChancePctByIndex[0]) : NaN;
  if (Number.isFinite(fromArray)) return clamp(0, fromArray, 100);
  const keyed = Number(g?.DropSlotChancePct1);
  if (Number.isFinite(keyed)) return clamp(0, keyed, 100);
  return 50;
}

// Basis points thresholds for TH bracket classification (10000 = 100%).
const TH_DROP_BRACKET_THRESHOLDS = [
  { bracket: 1, threshold: 2400 },
  { bracket: 2, threshold: 1500 },
  { bracket: 3, threshold: 1000 },
  { bracket: 4, threshold: 500 },
  { bracket: 5, threshold: 100 },
  { bracket: 6, threshold: 50 },
  { bracket: 7, threshold: 0 },
];

// Default Treasure Hunter effective drop-rate table in basis points.
// Rows are TH tiers (0..14); columns are brackets (1..7).
const DEFAULT_TREASURE_HUNTER_TABLE = [
  [5000, 2400, 1500, 1000, 500, 100, 50],
  [5200, 2550, 1600, 1080, 550, 120, 60],
  [5350, 2700, 1700, 1160, 600, 140, 70],
  [5500, 2850, 1800, 1240, 650, 160, 80],
  [5650, 3000, 1900, 1320, 700, 180, 90],
  [5800, 3150, 2000, 1400, 750, 200, 100],
  [5950, 3300, 2100, 1480, 800, 220, 110],
  [6100, 3450, 2200, 1560, 850, 240, 120],
  [6250, 3600, 2300, 1640, 900, 260, 130],
  [6400, 3750, 2400, 1720, 950, 280, 140],
  [6550, 3900, 2500, 1800, 1000, 300, 150],
  [6700, 4050, 2600, 1880, 1050, 320, 160],
  [6850, 4200, 2700, 1960, 1100, 340, 170],
  [7000, 4350, 2800, 2040, 1150, 360, 180],
  [7150, 4500, 2900, 2120, 1200, 380, 190],
];

function sanitizeInt(input, fallback = 0) {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function getTreasureHunterLevel(g) {
  const raw = g?.DropTHLevel ?? g?.TreasureHunterLevel ?? g?.THLevel ?? 0;
  return clamp(0, sanitizeInt(raw, 0), 14);
}

function getDropBracket(dropRate) {
  for (const row of TH_DROP_BRACKET_THRESHOLDS) {
    if (dropRate >= row.threshold) return row.bracket;
  }
  return 7;
}

export function getDropRate(thLevel, dropRate) {
  const tier = clamp(0, sanitizeInt(thLevel, 0), 14);
  const sanitizedDropRate = clamp(0, sanitizeInt(dropRate, 0), 10000);
  if (sanitizedDropRate === 10000) return 10000;
  if (sanitizedDropRate === 0) return 0;
  const bracket = getDropBracket(sanitizedDropRate);
  const row = DEFAULT_TREASURE_HUNTER_TABLE[tier];
  const entry = row ? row[bracket - 1] : null;
  if (!Number.isFinite(entry)) {
    console.warn(`[TH_DROP_RATE] Missing table entry for tier=${tier} bracket=${bracket}; using sanitized input.`);
    return sanitizedDropRate;
  }
  return clamp(0, sanitizeInt(entry, sanitizedDropRate), 10000);
}

export function getDropRateBracket(dropRate) {
  const sanitizedDropRate = clamp(0, sanitizeInt(dropRate, 0), 10000);
  return getDropBracket(sanitizedDropRate);
}

function pickWeightedLootToken(ctx) {
  const g = getGlobals(ctx);
  const configured = Array.isArray(g?.DropTokenWeights) ? g.DropTokenWeights : null;
  const defaultWeights = [
    { token: TOKEN.BONE_CHIP, weight: 55 },
    { token: TOKEN.SAND, weight: 25 },
    { token: TOKEN.SHELL, weight: 15 },
    { token: TOKEN.SLIME, weight: 5 },
  ];
  const source = configured && configured.length >= 4
    ? configured.map((entry, idx) => {
        const fallback = defaultWeights[idx] || defaultWeights[0];
        const token = String(entry?.token || fallback.token);
        const weight = Number(entry?.weight ?? fallback.weight);
        return { token, weight: Number.isFinite(weight) && weight > 0 ? weight : 0 };
      })
    : defaultWeights;
  const total = source.reduce((acc, item) => acc + Number(item.weight || 0), 0);
  if (!(total > 0)) return { dropId: EMPTY, itemRollPct: 0, selectedWeightPct: 0 };
  let cursor = random01(ctx) * total;
  for (const item of source) {
    cursor -= Number(item.weight || 0);
    if (cursor <= 0) {
      return {
        dropId: `TOKEN.${item.token}`,
        itemRollPct: Number(((cursor + Number(item.weight || 0)) / total * 100).toFixed(4)),
        selectedWeightPct: Number(((Number(item.weight || 0) / total) * 100).toFixed(4)),
      };
    }
  }
  const tail = source[source.length - 1];
  return {
    dropId: `TOKEN.${tail.token}`,
    itemRollPct: 99.9999,
    selectedWeightPct: Number(((Number(tail.weight || 0) / total) * 100).toFixed(4)),
  };
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
    const amt = Math.max(1, Math.floor(random01(ctx) * 40) + 1);
    ctx.callFunction('ApplyPartyHeal', amt);
    LogCombat(ctx, `Event reward: +${amt} HP`);
    return;
  }
  if (payload.type === 'ENERGY_RANDOM') {
    const options = [10, 20, 30, 40];
    const amt = options[randomIndex(ctx, options.length)];
    const next = (g.Player_Energy || 0) + amt;
    g.Player_Energy = next;
    LogCombat(ctx, `Event reward: +${amt} Energy`);
    return;
  }
  if (payload.type === 'GOLD_RANDOM') {
    const options = [15, 30];
    const amt = options[randomIndex(ctx, options.length)];
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

function randomPick(ctx, list) {
  if (!list || list.length === 0) return null;
  const idx = randomIndex(ctx, list.length);
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

function schedulerWriteQueue(ctx, nextQueue) {
  const g = getGlobals(ctx);
  g.TurnOrderArray = Array.isArray(nextQueue) ? nextQueue : [];
  return g.TurnOrderArray;
}

function schedulerWriteIndex(ctx, nextIndex) {
  const g = getGlobals(ctx), normalized = Number(nextIndex);
  g.CurrentTurnIndex = Number.isFinite(normalized) ? Math.max(0, Math.trunc(normalized)) : 0;
  return g.CurrentTurnIndex;
}

function schedulerClearQueue(ctx) {
  schedulerWriteQueue(ctx, []);
  schedulerWriteIndex(ctx, 0);
  return [];
}

function schedulerSyncIndexToUID(ctx, uid, queue = null, fallback = 0) {
  const arr = Array.isArray(queue) ? queue : (Array.isArray(getGlobals(ctx).TurnOrderArray) ? getGlobals(ctx).TurnOrderArray : []);
  const idx = arr.findIndex(slot => Number(slot?.uid || 0) === Number(uid || 0));
  if (idx !== -1) schedulerWriteIndex(ctx, idx);
  else schedulerWriteIndex(ctx, fallback);
  return idx;
}

function schedulerClampIndex(ctx, queue = null) {
  const arr = Array.isArray(queue) ? queue : (Array.isArray(getGlobals(ctx).TurnOrderArray) ? getGlobals(ctx).TurnOrderArray : []);
  if (!arr.length) return schedulerWriteIndex(ctx, 0);
  const current = Number(getGlobals(ctx).CurrentTurnIndex || 0);
  return schedulerWriteIndex(ctx, Math.max(0, Math.min(current, arr.length - 1)));
}

function ensureActorExtraTurnSkillStore(g) {
  if (!g.ActorExtraTurnSkillByUID || typeof g.ActorExtraTurnSkillByUID !== 'object') g.ActorExtraTurnSkillByUID = {};
  return g.ActorExtraTurnSkillByUID;
}
function ensureActorExtraTurnProcCountStore(g) {
  if (!g.ActorExtraTurnProcCountByUID || typeof g.ActorExtraTurnProcCountByUID !== 'object') g.ActorExtraTurnProcCountByUID = {};
  return g.ActorExtraTurnProcCountByUID;
}
function ensureActorRedAttackSkillStore(g) {
  if (!g.ActorRedAttackSkillByUID || typeof g.ActorRedAttackSkillByUID !== 'object') g.ActorRedAttackSkillByUID = {};
  return g.ActorRedAttackSkillByUID;
}

function schedulerApplyBattleStartState(g, next = {}) {
  if (Object.prototype.hasOwnProperty.call(next, 'remaining')) g.BattleStartRemaining = next.remaining;
  if (next.reset) {
    const reset = createBattleStartResetState();
    g.BattleStartRemaining = reset.remaining;
    g.BattleStartResolved = reset.resolved;
    g.BattleStartMode = reset.mode;
  }
}
function schedulerInsertExplicitExtraTurn(ctx, actorUID, effectiveSPD) {
  const g = getGlobals(ctx);
  const arr = Array.isArray(g.TurnOrderArray) ? g.TurnOrderArray.slice() : [];
  const insertAt = Math.min(arr.length, Number(g.CurrentTurnIndex || 0) + 1);
  arr.splice(insertAt, 0, { uid: actorUID, spd: effectiveSPD, type: 0, extra: true });
  schedulerWriteQueue(ctx, arr);
  return insertAt;
}
function schedulerApplySpawnInsertion(ctx) {
  if (!isTimeInitiative(ctx)) return null;
  const roster = getInitiativeRoster(ctx);
  syncInitiativeMeters(ctx, roster);
  refreshInitiativePreview(ctx);
  return roster.length;
}
function schedulerApplyRemovalCompaction(ctx, removedUID) {
  if (!isTimeInitiative(ctx)) return null;
  const g = getGlobals(ctx);
  if (Number(g.InitiativeCurrentUID || 0) === Number(removedUID || 0)) g.InitiativeCurrentUID = 0;
  return null;
}

function syncInitiativeSessionState(ctx) {
  const g = getGlobals(ctx);
  const combatSessionId = Number(g.CombatSessionId || 0);
  if (!Number.isFinite(combatSessionId) || combatSessionId <= 0) return false;
  const initiativeSessionId = Number(g.InitiativeSessionId || 0);
  if (initiativeSessionId === combatSessionId) return false;
  g.InitiativeMeters = {};
  g.InitiativeCurrentUID = 0;
  schedulerClearQueue(ctx);
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
  const baselineMeter = meterVals.length ? Math.max(...meterVals) : 0;
  for (const key of Object.keys(meters)) {
    if (!rosterUIDs.has(Number(key))) delete meters[key];
  }
  for (const r of roster) {
    if (meters[String(r.uid)] == null) {
      // New spawns inherit the current initiative baseline; SPD decides placement.
      setMeter(meters, r.uid, baselineMeter);
    }
  }
  g.InitiativeMeters = meters;
  return meters;
}

function buildInitiativePreview(roster, meters, threshold, count, currentUID, selectionPool = null, tickPool = null) {
  const preview = [];
  const localMeters = {};
  for (const [key, val] of Object.entries(meters)) {
    localMeters[key] = Number(val) || 0;
  }
  const localRoster = roster.map(r => ({ ...r }));
  const localSelectionPool = (selectionPool && selectionPool.length) ? selectionPool.map(r => ({ ...r })) : localRoster;
  const localTickPool = (tickPool && tickPool.length) ? tickPool.map(r => ({ ...r })) : localRoster;
  let lastUID = null;
  if (currentUID) {
    const cur = localRoster.find(r => r.uid === currentUID);
    if (cur) {
      preview.push({ uid: cur.uid, spd: cur.spd, type: cur.type, extra: false });
      lastUID = cur.uid;
    }
  }
  const targetCount = Math.max(1, count || localRoster.length || 1);
  while (preview.length < targetCount) {
    let guard = 0;
    while (guard < 500) {
      let ready = null;
      for (const r of localSelectionPool) {
        const meter = getMeter(localMeters, r.uid);
        if (meter < threshold) continue;
        if (
          !ready ||
          meter > ready.meter ||
          (meter === ready.meter && (r.spd > ready.spd || (r.spd === ready.spd && r.uid < ready.uid)))
        ) {
          ready = { ...r, meter };
        }
      }
      if (ready) {
        setMeter(localMeters, ready.uid, ready.meter - threshold);
        const extra = lastUID === ready.uid;
        preview.push({ uid: ready.uid, spd: ready.spd, type: ready.type, extra });
        lastUID = ready.uid;
        break;
      }
      for (const r of localTickPool) {
        const meter = getMeter(localMeters, r.uid);
        setMeter(localMeters, r.uid, meter + (r.spd || 0));
      }
      guard += 1;
    }
    if (guard >= 500) break;
  }
  return preview;
}

function getInitiativeOverridePool(ctx, roster) {
  const g = getGlobals(ctx);
  const startMode = g.BattleStartMode;
  const startActive = Boolean(startMode && !g.BattleStartResolved);
  if (!startActive) return { active: false, pool: roster };
  const teamType = startMode === 'ambush' ? 1 : 0;
  const next = deriveBattleStartRemaining({
    remaining: g.BattleStartRemaining,
    roster,
    teamType,
  });
  schedulerApplyBattleStartState(g, { remaining: next.remaining });
  if (next.exhausted) {
    schedulerApplyBattleStartState(g, { reset: true });
    return { active: false, pool: roster };
  }
  const pool = roster.filter(r => next.remaining[r.uid]);
  return { active: true, pool, remaining: next.remaining, teamType };
}

function selectNextInitiativeActor(ctx) {
  const g = getGlobals(ctx);
  const roster = getInitiativeRoster(ctx);
  if (!roster.length) {
    g.InitiativeCurrentUID = 0;
    schedulerWriteIndex(ctx, 0);
    schedulerClearQueue(ctx);
    return null;
  }
  const threshold = Number(g.InitiativeThreshold || 100);
  const meters = syncInitiativeMeters(ctx, roster);
  const override = getInitiativeOverridePool(ctx, roster);
  const selectionPool = override.pool || roster;
  const tickPool = roster;
  const maxLoops = Number(g.InitiativeMaxLoops || 500);
  let loops = 0;
  while (loops < maxLoops) {
    let ready = null;
    for (const r of selectionPool) {
      const meter = getMeter(meters, r.uid);
      if (meter < threshold) continue;
      if (
        !ready ||
        meter > ready.meter ||
        (meter === ready.meter && (r.spd > ready.spd || (r.spd === ready.spd && r.uid < ready.uid)))
      ) {
        ready = { ...r, meter };
      }
    }
    if (ready) {
      setMeter(meters, ready.uid, ready.meter - threshold);
      if (override.active && override.remaining) {
        const consumed = deriveBattleStartConsume(override.remaining, ready.uid);
        schedulerApplyBattleStartState(g, { remaining: consumed.remaining, reset: consumed.exhausted });
      }
      g.InitiativeCurrentUID = ready.uid;
      schedulerWriteIndex(ctx, 0);
      const previewSize = Number(g.InitiativePreviewSize || 6);
      schedulerWriteQueue(
        ctx,
        sanitizeInitiativeQueue(
          buildInitiativePreview(roster, meters, threshold, previewSize, ready.uid, selectionPool, tickPool),
          { allowExtraRepeats: false },
        ),
      );
      return ready;
    }
    for (const r of tickPool) {
      const meter = getMeter(meters, r.uid);
      setMeter(meters, r.uid, meter + (r.spd || 0));
    }
    loops += 1;
  }
  console.log('[INIT] guard hit; forcing next actor');
  const fallback = roster[0];
  g.InitiativeCurrentUID = fallback.uid;
  schedulerWriteIndex(ctx, 0);
  const previewSize = Number(g.InitiativePreviewSize || 6);
  schedulerWriteQueue(
    ctx,
    sanitizeInitiativeQueue(
      buildInitiativePreview(roster, meters, threshold, previewSize, fallback.uid, selectionPool, tickPool),
      { allowExtraRepeats: false },
    ),
  );
  return fallback;
}

function refreshInitiativePreview(ctx) {
  const g = getGlobals(ctx);
  const roster = getInitiativeRoster(ctx);
  if (!roster.length) {
    schedulerClearQueue(ctx);
    g.InitiativeCurrentUID = 0;
    return;
  }
  const meters = syncInitiativeMeters(ctx, roster);
  const threshold = Number(g.InitiativeThreshold || 100);
  const previewSize = Number(g.InitiativePreviewSize || 6);
  const curUID = g.InitiativeCurrentUID;
  const override = getInitiativeOverridePool(ctx, roster);
  const selectionPool = override.pool || roster;
  schedulerWriteQueue(
    ctx,
    sanitizeInitiativeQueue(
      buildInitiativePreview(roster, meters, threshold, previewSize, curUID, selectionPool, roster),
      { allowExtraRepeats: false },
    ),
  );
  const idx = g.TurnOrderArray.findIndex(a => a.uid === curUID);
  schedulerWriteIndex(ctx, idx !== -1 ? idx : 0);
}

function resolvePendingDeathsForInitiative(ctx) {
  const g = getGlobals(ctx);
  const pending = g.PendingDeaths || {};
  for (const uidStr of Object.keys(pending)) {
    const pendingMeta = pending[uidStr];
    const killerUID = Number(
      (pendingMeta && typeof pendingMeta === 'object' && pendingMeta.killerUID != null)
        ? pendingMeta.killerUID
        : (g.LastDamageSourceUID || GetCurrentTurn(ctx) || 0)
    );
    const uid = Number(uidStr);
    const actor = GetActorByUID(ctx, uid);
    if (actor && actor.kind === 'enemy') {
      AwardMonsterDrop(ctx, actor.name || actor.key || actor.type || '', null, killerUID);
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
  schedulerWriteQueue(ctx, actedSegment.concat(remaining));
  const idx = g.TurnOrderArray.findIndex(a => a.uid === currentUID);
  if (idx !== -1) schedulerWriteIndex(ctx, idx);
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
    schedulerWriteIndex(ctx, idx !== -1 ? idx : 0);
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
      for (const [uidStr, pendingMeta] of Object.entries(pending)) {
        const grp = Number(
          (pendingMeta && typeof pendingMeta === 'object' && pendingMeta.group != null)
            ? pendingMeta.group
            : pendingMeta
        );
        if (grp !== resolvedGroup) continue;
        const killerUID = Number(
          (pendingMeta && typeof pendingMeta === 'object' && pendingMeta.killerUID != null)
            ? pendingMeta.killerUID
            : (g.LastDamageSourceUID || GetCurrentTurn(ctx) || 0)
        );
        const uid = Number(uidStr);
        const actor = GetActorByUID(ctx, uid);
        if (actor && actor.kind === 'enemy') {
          AwardMonsterDrop(ctx, actor.name || actor.key || actor.type || '', null, killerUID);
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
    schedulerWriteQueue(ctx, flat.map(a => ({ uid: a.uid, spd: a.spd, type: a.type })));
    const curUID = GetCurrentTurn(ctx);
    const idx = g.TurnOrderArray.findIndex(a => a.uid === curUID);
    if (idx !== -1) schedulerWriteIndex(ctx, idx);
  } else {
    const arr = g.TurnOrderArray || [];
    const actorCount = arr.length;

    schedulerWriteIndex(ctx, Number(g.CurrentTurnIndex || 0) + 1);
    if (actorCount === 0 || g.CurrentTurnIndex >= actorCount) {
      schedulerWriteIndex(ctx, 0);
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
  if (currentType === 0 && currentUID && g.ExtraTurnGranted && Object.prototype.hasOwnProperty.call(g.ExtraTurnGranted, currentUID)) {
    delete g.ExtraTurnGranted[currentUID];
  }
  if (currentType === 0 && currentUID) {
    const store = ensurePowerAmpByUID(ctx);
    const entry = store[currentUID];
    if (entry) {
      if (entry.state === 'active_this_turn') {
        ClosePowerAmpForActor(ctx, currentUID, 'turn_complete');
      } else if (
        entry.state === 'pending_next_own_turn' &&
        Number(g.TurnSerial || 0) > Number(entry.armedAtTurnSerial || 0)
      ) {
        // Strict safety net: if a hero reached next own turn but activation was missed,
        // force expiry at that turn end to prevent carryover leaks.
        ClosePowerAmpForActor(ctx, currentUID, 'missed_activation_expire');
      }
    }
  }
  if (currentType === 1 && currentUID) {
    const debuffState = ensureEnemyDebuffState(ctx, currentUID);
    const debuffs = debuffState.debuffs;
    const turns = debuffState.turns;
    const slots = debuffState.slots;
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
  g.TurnSerial = Number(g.TurnSerial || 0) + 1;
  if (isTimeInitiative(ctx)) {
    resolvePendingDeathsForInitiative(ctx);
    selectNextInitiativeActor(ctx);
    ProcessCurrentTurn(ctx);
    return;
  }
  ProcessCurrentTurn(ctx);
}

export function TryGrantSpeedExtraTurn(ctx, actorUID) {
  return TryGrantConfiguredExtraTurn(ctx, actorUID);
}

export function ConfigureActorExtraTurnSkill(ctx, actorUID, options = {}) {
  const g = getGlobals(ctx);
  const uid = Number(actorUID || 0);
  if (uid <= 0) return false;
  const actor = GetActorByUID(ctx, uid);
  if (!actor || actor.kind !== 'hero') return false;
  const chance = Number(options?.chance ?? options?.procChance ?? 0);
  if (!Number.isFinite(chance) || chance <= 0 || chance > 1) return false;
  const store = ensureActorExtraTurnSkillStore(g);
  const procCounts = ensureActorExtraTurnProcCountStore(g);
  store[uid] = {
    actorUID: uid,
    chance,
    traitId: String(options?.traitId || `extra_turn_skill:${uid}`),
    skillId: String(options?.skillId || 'EXTRA_TURN_SKILL'),
  };
  procCounts[uid] = 0;
  return true;
}

export function RemoveActorExtraTurnSkill(ctx, actorUID) {
  const g = getGlobals(ctx);
  const uid = Number(actorUID || 0);
  const store = ensureActorExtraTurnSkillStore(g);
  const procCounts = ensureActorExtraTurnProcCountStore(g);
  if (!store[uid]) return false;
  delete store[uid];
  delete procCounts[uid];
  if (g.ExtraTurnGranted && Object.prototype.hasOwnProperty.call(g.ExtraTurnGranted, uid)) delete g.ExtraTurnGranted[uid];
  return true;
}

export function GetActorExtraTurnSkill(ctx, actorUID) {
  const uid = Number(actorUID || 0);
  const entry = ensureActorExtraTurnSkillStore(getGlobals(ctx))[uid];
  return entry ? { ...entry } : null;
}

export function GetActorExtraTurnProcCount(ctx, actorUID) {
  const uid = Number(actorUID || 0);
  const counts = ensureActorExtraTurnProcCountStore(getGlobals(ctx));
  return Number(counts[uid] || 0);
}

export function ConfigureActorRedAttackSkill(ctx, actorUID, options = {}) {
  const g = getGlobals(ctx);
  const uid = Number(actorUID || 0);
  if (uid <= 0) return false;
  const actor = GetActorByUID(ctx, uid);
  if (!actor || actor.kind !== 'hero') return false;
  const skillId = String(options?.skillId || '').trim();
  if (!skillId) return false;
  ensureActorRedAttackSkillStore(g)[uid] = { actorUID: uid, skillId };
  return true;
}

export function RemoveActorRedAttackSkill(ctx, actorUID) {
  const store = ensureActorRedAttackSkillStore(getGlobals(ctx));
  const uid = Number(actorUID || 0);
  if (!store[uid]) return false;
  delete store[uid];
  return true;
}

export function GetActorRedAttackSkill(ctx, actorUID) {
  const uid = Number(actorUID || 0);
  const entry = ensureActorRedAttackSkillStore(getGlobals(ctx))[uid];
  return entry ? { ...entry } : null;
}

function queueConfiguredDoubleAttackFollowUp(ctx, actorUID, preferredTargetUID = 0) {
  const actor = GetActorByUID(ctx, actorUID);
  if (!actor || actor.kind !== 'hero' || (actor.hp ?? 0) <= 0) return false;
  const enemies = getEnemies(ctx).filter((enemy) => (enemy.hp ?? 0) > 0);
  if (!enemies.length) return false;
  const preferred = Number(preferredTargetUID || 0);
  const resolvedTargetUID = enemies.some((enemy) => Number(enemy.uid || 0) === preferred)
    ? preferred
    : Number(enemies[0]?.uid || 0);
  if (resolvedTargetUID <= 0) return false;
  const g = getGlobals(ctx);
  const now = Number(g.time || 0);
  const beforeLen = Array.isArray(g.PendingHeroHits) ? g.PendingHeroHits.length : 0;
  let latestExistingAt = 0;
  if (beforeLen > 0) {
    for (let idx = 0; idx < beforeLen; idx += 1) {
      const hit = g.PendingHeroHits[idx];
      if (!hit) continue;
      if (Number(hit.heroUID || 0) !== Number(actorUID || 0)) continue;
      const at = Number(hit.at || 0);
      if (at > latestExistingAt) latestExistingAt = at;
    }
  }
  HeroAttackSingle(ctx, actorUID, resolvedTargetUID);
  const after = Array.isArray(g.PendingHeroHits) ? g.PendingHeroHits : [];
  if (after.length <= beforeLen) return false;
  const batchId = Number(g.DoubleAttackBatchSerial || 0) + 1;
  g.DoubleAttackBatchSerial = batchId;
  let earliestNewAt = 0;
  for (let idx = beforeLen; idx < after.length; idx += 1) {
    const hit = after[idx];
    if (!hit) continue;
    const at = Number(hit.at || 0);
    if (at <= 0) continue;
    if (earliestNewAt <= 0 || at < earliestNewAt) earliestNewAt = at;
  }
  const lungeTotal = 0.14 + 0.75 + 0.16 + 0.26;
  const firstAttackSettledAt = latestExistingAt > 0 ? latestExistingAt : (now + lungeTotal);
  const finalFollowUpUntil = firstAttackSettledAt + (lungeTotal * 2);
  g.ActionLockUntil = Math.max(Number(g.ActionLockUntil || 0), finalFollowUpUntil);
  g.DeferAdvance = 1;
  for (let idx = beforeLen; idx < after.length; idx += 1) {
    const hit = after[idx];
    if (!hit) continue;
    hit.followUpBatchId = batchId;
    hit.retargetOnDeath = 1;
    hit.followUpSkillId = 'DOUBLE_ATTACK';
    hit.followUpAwaitTextClear = 1;
    hit.followUpOriginalAt = Number(hit.at || 0);
    hit.followUpOffset = earliestNewAt > 0 ? Math.max(0, Number(hit.at || 0) - earliestNewAt) : 0;
  }
  return true;
}

export function TryGrantConfiguredExtraTurn(ctx, actorUID, forcedRoll = null, meta = null) {
  const g = getGlobals(ctx);
  const uid = Number(actorUID || 0);
  const config = ensureActorExtraTurnSkillStore(g)[uid];
  if (!config) return false;
  if (g.RoundActive) return false;
  const actor = GetActorByUID(ctx, uid);
  if (!actor || actor.kind !== 'hero') return false;
  if ((actor.hp ?? 0) <= 0) return false;
  if (!g.ExtraTurnGranted) g.ExtraTurnGranted = {};
  if (g.ExtraTurnGranted[uid]) return false;
  const enemies = getEnemies(ctx).filter(e => (e.hp ?? 0) > 0);
  if (!enemies.length) return false;
  const roll = forcedRoll == null ? Math.random() : Number(forcedRoll);
  if (!Number.isFinite(roll) || roll < 0 || roll >= Number(config.chance || 0)) return false;
  const actionSkillId = String(meta?.skillId || '');
  const preferredTargetUID = Number(meta?.targetUID || 0);
  let granted = false;
  if (String(config.skillId || '') === 'DOUBLE_ATTACK') {
    if (actionSkillId !== 'HERO_SINGLE') return false;
    granted = queueConfiguredDoubleAttackFollowUp(ctx, uid, preferredTargetUID);
  } else {
    const spdSelf = GetEffectiveStat(ctx, actor, 'SPD');
    schedulerInsertExplicitExtraTurn(ctx, uid, spdSelf);
    granted = true;
  }
  if (!granted) return false;
  g.ExtraTurnGranted[uid] = true;
  const procCounts = ensureActorExtraTurnProcCountStore(g);
  procCounts[uid] = Number(procCounts[uid] || 0) + 1;
  g.LastExtraTurnProc = {
    actorUID: uid,
    traitId: String(config.traitId || ''),
    skillId: String(config.skillId || ''),
    chance: Number(config.chance || 0),
    roll,
  };
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
  const roll = 0.8 + random01(ctx) * 0.4;
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
    rngRoll: random01(ctx),
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

function absorbPartyTempHPShield(g, dmg) {
  const incoming = Math.max(0, Number(dmg || 0));
  const shieldBefore = Math.max(0, Number(g.PartyTempHPShield || 0));
  const absorbed = Math.min(shieldBefore, incoming);
  if (absorbed <= 0) {
    g.LastPartyTempHPShieldAbsorbed = 0;
    return { damageAfterShield: incoming, absorbed: 0 };
  }
  const shieldAfter = Math.max(0, shieldBefore - absorbed);
  g.PartyTempHPShield = shieldAfter;
  g.LastPartyTempHPShieldAbsorbed = absorbed;
  if (shieldAfter <= 0) {
    g.PartyTempHPShieldStacks = 0;
    g.PartyTempHPShieldRatio = 0;
    g.PartyTempHPShieldMax = 0;
  }
  return { damageAfterShield: Math.max(0, incoming - absorbed), absorbed };
}

export function ApplyDamageToTarget(ctx, uid, dmg) {
  const g = getGlobals(ctx);
  g.LastDamageSourceUID = Number(GetCurrentTurn(ctx) || 0);
  const t = GetActorByUID(ctx, uid);
  if (!t) return 0;
  const beforeHP = Number(t.hp ?? 0);
  let damageToHP = Math.max(0, Number(dmg || 0));
  let shieldAbsorbed = 0;
  if (t.kind === 'hero') {
    const shieldResult = absorbPartyTempHPShield(g, damageToHP);
    damageToHP = shieldResult.damageAfterShield;
    shieldAbsorbed = shieldResult.absorbed;
  }
  t.hp = Math.max(0, (t.hp ?? 0) - damageToHP);
  const afterHP = Number(t.hp ?? 0);
  const appliedDamage = Math.max(0, beforeHP - afterHP);
  if (t.kind === 'hero' && appliedDamage > 0) {
    const idx = Number(t.heroIndex ?? 0);
    if (Array.isArray(g.PartyHPByIndex)) {
      g.PartyHPByIndex[idx] = Math.max(0, Number(g.PartyHPByIndex[idx] ?? beforeHP) - appliedDamage);
      g.PartyHP = sum(g.PartyHPByIndex || []);
    } else {
      g.PartyHP = Math.max(0, Number(g.PartyHP ?? beforeHP) - appliedDamage);
    }
  }
  runTraitHooks(ctx, 'damage_receive', {
    targetUID: Number(uid || 0),
    targetKind: String(t.kind || ''),
    sourceUID: Number(g.LastDamageSourceUID || 0),
    damage: Number(dmg || 0),
    appliedDamage,
    shieldAbsorbed,
    beforeHP,
    afterHP,
  });
  if (t.kind === 'enemy' && appliedDamage > 0) {
    if (IsPartySessionSkillActive(ctx, 'party_destiny')) {
      logPartyDestinyQa(ctx, 'enemy_hit_hook', {
        sourceUID: Number(g.LastDamageSourceUID || 0),
        targetUID: Number(uid || 0),
        appliedDamage,
      });
    }
    TryPartyDestiny(ctx, {
      eventName: 'hit_enemy',
      sourceUID: Number(g.LastDamageSourceUID || 0),
      targetUID: Number(uid || 0),
      appliedDamage,
    });
  }
  const now = Number(g.time || 0);
  if (!g.HitFlashByUID || typeof g.HitFlashByUID !== 'object') {
    g.HitFlashByUID = {};
  }
  const hitFlashTone = String(g.NextHitFlashTone || 'black');
  g.HitFlashByUID[uid] = {
    until: now + 0.14,
    tone: hitFlashTone,
  };
  delete g.NextHitFlashTone;
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
  if (appliedDamage > 0 && dx != null && dy != null && g.SpawnDamageText !== 0) {
    const damageTextKind = String(g.NextDamageTextKind || 'damage');
    SpawnDamageText(ctx, appliedDamage, dx, dy, damageTextKind, t.kind || null);
  }
  delete g.NextDamageTextKind;
  if (t.hp === 0 && t.isAlive !== false) {
    t.isAlive = false;
    if ((g.RoundActive && g.GroupResolving) || (isTimeInitiative(ctx) && g.GroupResolving)) {
      g.PendingDeaths = g.PendingDeaths || {};
      g.PendingDeaths[t.uid] = {
        group: Number(g.RoundGroupIndex || 0),
        killerUID: Number(g.LastDamageSourceUID || 0),
      };
    } else {
      if (t.kind === 'enemy') {
        AwardMonsterDrop(ctx, t.name || t.key || t.type || '', null, Number(g.LastDamageSourceUID || 0));
        KillEnemyByUID(ctx, t.uid, t.slotIndex ?? 0);
      }
    }
  }
  UpdateEnemyHPUI(ctx);
  UpdateHeroHPUI(ctx);
  return appliedDamage;
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
    rngRoll: random01(ctx),
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

export function UpdateAstralFlowAmpBar(ctx) {
  const g = ensureAstralFlowAmpState(ctx);
  g.AstralFlowAmpBar = {
    max: Math.max(1, Number(g.AstralFlowAmpMax || 18)),
    value: Math.max(0, Number(g.AstralFlowAmpPoints || 0)),
    ready: Number(g.AstralFlowAmpReady || 0),
  };
}

export function Sub_Energy(ctx) {
  const g = getGlobals(ctx);
  g.Player_Energy = (g.Player_Energy || 0) - 3;
  // Yellow recolor path can bypass skill defer wiring; ensure deterministic turn handoff.
  if (Number(g.MatchedColorValue || -1) === 3) {
    applyTurnGateIntent(g, createYellowSafetyNet, {
      now: Number(g.time || 0),
      currentTurnUID: Number(GetCurrentTurn(ctx) || 0),
    });
  }
}

export function Add_Energy(ctx) {
  const g = getGlobals(ctx);
  const roll = random01(ctx);
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
  if (cap >= 30 && random01(ctx) < 0.015) {
    finalAmount = 30;
  } else {
    const upper = Math.max(min, cap - 1);
    const u = random01(ctx);
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
  return enemies[randomIndex(ctx, enemies.length)];
}

const RUNA_MAGIC_RESIST_NAME = 'Runa';
const RUNA_MAGIC_RESIST_TRIGGER_CHANCE = 0.6;
const RUNA_MAGIC_RESIST_NULLIFY_CHANCE = 0.35;
const RUNA_MAGIC_RESIST_REDUCE_FACTOR = 0.2;

function pickEnemyTargetHero(ctx, enemyUID = 0) {
  const g = getGlobals(ctx);
  const enemy = GetActorByUID(ctx, enemyUID);
  const result = pickEnemyTargetHeroFromRoster({
    enemy,
    heroes: getHeroes(ctx),
    rng: getRandomSource(ctx),
  });
  g.LastEnemyTargetBias = result.trace;
  const target = result.target;
  return target;
}

function applyRunaMagicResist(ctx, enemyUID, targetHeroUID, incomingDamage, skillId = 'Enemy_MAG_Single') {
  const g = getGlobals(ctx);
  const baseDamage = Math.max(0, Number(incomingDamage) || 0);
  const target = GetActorByUID(ctx, targetHeroUID);
  if (!target || String(target?.name || '') !== RUNA_MAGIC_RESIST_NAME) {
    g.LastRunaMagicResist = {
      enemyUID: Number(enemyUID || 0),
      targetUID: Number(targetHeroUID || 0),
      skillId: String(skillId || ''),
      mode: 'not_runa',
      incomingDamage: baseDamage,
      finalDamage: baseDamage,
    };
    return { finalDamage: baseDamage, mode: 'not_runa' };
  }
  const triggerRoll = Math.random();
  if (triggerRoll >= RUNA_MAGIC_RESIST_TRIGGER_CHANCE) {
    g.LastRunaMagicResist = {
      enemyUID: Number(enemyUID || 0),
      targetUID: Number(targetHeroUID || 0),
      skillId: String(skillId || ''),
      mode: 'no_proc',
      incomingDamage: baseDamage,
      finalDamage: baseDamage,
      triggerRoll: Number(triggerRoll || 0),
    };
    return { finalDamage: baseDamage, mode: 'no_proc' };
  }
  const nullifyRoll = Math.random();
  const nullified = nullifyRoll < RUNA_MAGIC_RESIST_NULLIFY_CHANCE;
  const finalDamage = nullified ? 0 : Math.max(1, Math.floor(baseDamage * RUNA_MAGIC_RESIST_REDUCE_FACTOR));
  const mode = nullified ? 'nullify' : 'heavy_resist';
  g.LastRunaMagicResist = {
    enemyUID: Number(enemyUID || 0),
    targetUID: Number(targetHeroUID || 0),
    skillId: String(skillId || ''),
    mode,
    incomingDamage: baseDamage,
    finalDamage,
    triggerRoll: Number(triggerRoll || 0),
    nullifyRoll: Number(nullifyRoll || 0),
  };
  return { finalDamage, mode };
}

const ENEMY_DEBUFF_STATS = ['ATK', 'DEF', 'MAG', 'RES', 'SPD'];
const ENEMY_DEBUFF_SLOT_LIMIT = 3;

function sanitizeDebuffValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function ensureEnemyDebuffState(ctx, enemyUID) {
  const g = getGlobals(ctx);
  if (!g.EnemyDebuffs) g.EnemyDebuffs = {};
  if (!g.EnemyDebuffSlots) g.EnemyDebuffSlots = {};
  if (!g.EnemyDebuffTurns) g.EnemyDebuffTurns = {};
  const debuffs = g.EnemyDebuffs[enemyUID] || {};
  const turns = g.EnemyDebuffTurns[enemyUID] || {};
  for (const stat of ENEMY_DEBUFF_STATS) {
    debuffs[stat] = sanitizeDebuffValue(debuffs[stat]);
    turns[stat] = sanitizeDebuffValue(turns[stat]);
  }
  const rawSlots = Array.isArray(g.EnemyDebuffSlots[enemyUID]) ? g.EnemyDebuffSlots[enemyUID] : [];
  const slots = [];
  for (const rawStat of rawSlots) {
    const stat = String(rawStat || '').toUpperCase();
    if (!ENEMY_DEBUFF_STATS.includes(stat)) continue;
    if (debuffs[stat] <= 0 || turns[stat] <= 0) {
      debuffs[stat] = 0;
      turns[stat] = 0;
      continue;
    }
    if (!slots.includes(stat)) slots.push(stat);
    if (slots.length >= ENEMY_DEBUFF_SLOT_LIMIT) break;
  }
  g.EnemyDebuffs[enemyUID] = debuffs;
  g.EnemyDebuffTurns[enemyUID] = turns;
  g.EnemyDebuffSlots[enemyUID] = slots;
  return { debuffs, turns, slots };
}

function ensureEnemyDebuffRecord(ctx, enemyUID) {
  return ensureEnemyDebuffState(ctx, enemyUID).debuffs;
}

export function ExecutePurpleDebuff(ctx, actorUID) {
  const g = getGlobals(ctx);
  const enemy = getRandomLivingEnemy(ctx);
  const hero = GetActorByUID(ctx, actorUID);
  if (!enemy || !hero) return;

  const roll = randomIndex(ctx, 5);
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
  const debuffState = ensureEnemyDebuffState(ctx, enemy.uid);
  const debuffs = debuffState.debuffs;
  const debuffTurns = debuffState.turns;
  const slots = debuffState.slots;
  debuffs[stat] = sanitizeDebuffValue(debuffs[stat]) + 2;
  debuffTurns[stat] = 3;
  if (!slots.includes(stat)) {
    if (slots.length >= ENEMY_DEBUFF_SLOT_LIMIT) {
      const dropped = slots.shift();
      if (dropped) {
        debuffs[dropped] = 0;
        debuffTurns[dropped] = 0;
      }
    }
    slots.push(stat);
  }
  LogCombat(ctx, `${enemy.name || 'Enemy'} ${stat} down! (${debuffs[stat]})`);
  runTraitHooks(ctx, 'status_apply', {
    sourceUID: Number(actorUID || 0),
    targetUID: Number(enemy.uid || 0),
    statusType: 'debuff',
    stat: String(stat),
    turns: Number((debuffTurns && debuffTurns[stat]) || 0),
    amount: Number(debuffs[stat] || 0),
  });
  g.EnemyDebuffPop = { uid: enemy.uid, stat, at: g.time || 0 };
  RebuildTurnOrderPreserveCurrent(ctx);
}

export function ApplyDamage(ctx, targetUID, dmg) {
  ApplyDamageToTarget(ctx, targetUID, dmg);
}

export function ApplyPartyDamage(ctx, dmg) {
  const g = getGlobals(ctx);
  const shieldResult = absorbPartyTempHPShield(g, dmg);
  const damageToHP = shieldResult.damageAfterShield;
  const heroes = getHeroes(ctx);
  for (const h of heroes) {
    h.hp = Math.max(0, (h.hp ?? 0) - damageToHP);
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
  const finalDmg = ampMult > 0 ? Math.max(1, Math.ceil(dmg * ampMult)) : Math.max(1, dmg);
  const g = getGlobals(ctx);
  const now = g.time || 0;
  const hitDelay = Math.max(0.14 + 0.75 + 0.08, 0.97);
  const applyAt = now + hitDelay;
  g.PendingHeroHits = g.PendingHeroHits || [];
  const redSkillConfig = ensureActorRedAttackSkillStore(g)[Number(heroUID || 0)] || null;
  if (String(redSkillConfig?.skillId || '') === 'INCINERATE') {
    const heroName = String(actor && actor.name || '');
    const presentationProfiles = {
      Falie: { hitCount: 4, intervalSec: 0.3, scatter: { radiusX: 10, radiusY: 8 } },
      Huun: { hitCount: 4, intervalSec: 0.3, scatter: { radiusX: 16, radiusY: 6 } },
      Runa: { hitCount: 4, intervalSec: 0.3, scatter: { radiusX: 14, radiusY: 12 } },
      Kojonn: { hitCount: 4, intervalSec: 0.3, scatter: { radiusX: 22, radiusY: 16 } },
    };
    const presentation = presentationProfiles[heroName] || null;
    if (presentation && presentation.hitCount > 1) {
      const totalBurstDamage = finalDmg;
      const base = Math.floor(totalBurstDamage / presentation.hitCount);
      let remainder = totalBurstDamage % presentation.hitCount;
      for (let hitIndex = 0; hitIndex < presentation.hitCount; hitIndex += 1) {
        const shotDamage = Math.max(1, base + (remainder > 0 ? 1 : 0));
        if (remainder > 0) remainder -= 1;
        g.PendingHeroHits.push({
          at: applyAt + (hitIndex * presentation.intervalSec),
          heroUID,
          targetUID,
          dmg: shotDamage,
          finalDmg: shotDamage,
          powerAmpMultiplier: 0,
          consumePowerAmp: ampMult > 0 && hitIndex === 0 ? 1 : 0,
          damageTextScatter: presentation.scatter,
          calcPath: mode === 'magic' ? 'magicCalc' : 'meleeCalc',
          heroName: actorName,
          heroType: mode,
        });
      }
      LogCombat(ctx, `${actorName} used Incinerate on ${target.name || '?'} for ${totalBurstDamage}!`);
      return;
    }
  }
  g.PendingHeroHits.push({
    at: applyAt,
    heroUID,
    targetUID,
    dmg,
    powerAmpMultiplier: ampMult,
    finalDmg,
    consumePowerAmp: ampMult > 0 ? 1 : 0,
    calcPath: mode === 'magic' ? 'magicCalc' : 'meleeCalc',
    heroName: actorName,
    heroType: mode,
    msg: `${actorName} hit ${target.name || '?'} for ${finalDmg}!`,
  });
}

export function HeroAttackAOE(ctx, heroUID) {
  const actor = GetActorByUID(ctx, heroUID);
  const actorName = actor ? (actor.name || '?') : '?';
  const mode = actor && actor.attackType === 'magic' ? 'magic' : 'melee';
  const heroIndex = actor && actor.heroIndex != null ? actor.heroIndex : 0;
  const isKojonn = String(actor && actor.name || '') === 'Kojonn';
  const aoeName = isKojonn ? 'Faze' : (['Pummel', 'Swipe', 'Burst', 'Faze'][heroIndex] || 'AOE');
  let totalDamage = 0;
  const g = getGlobals(ctx);
  let ampMult = GetPowerAmpMultiplierForActor(ctx, heroUID);
  if (ampMult > 0) {
    const consumed = ConsumePowerAmpForActor(ctx, heroUID);
    if (consumed > 0) ampMult = consumed;
  }
  const enemies = getEnemies(ctx);
  const hits = [];
  const baseKojonnDotDamage = isKojonn
    ? Math.max(1, Math.floor(GetEffectiveStat(ctx, actor, 'MAG') * 0.75))
    : 0;
  const kojonnDotDamage = isKojonn
    ? (ampMult > 0 ? Math.max(1, Math.ceil(baseKojonnDotDamage * ampMult)) : baseKojonnDotDamage)
    : 0;
  for (const e of enemies) {
    if (isKojonn) {
      hits.push({ targetUID: e.uid, dotTotalDamage: kojonnDotDamage, consumePowerAmp: 0 });
      totalDamage += kojonnDotDamage;
      continue;
    }
    const dmg = CalculateDamage(ctx, heroUID, e.uid, mode);
    const finalDmg = ampMult > 0 ? Math.max(1, Math.ceil(dmg * ampMult)) : dmg;
    hits.push({ targetUID: e.uid, dmg, powerAmpMultiplier: ampMult, consumePowerAmp: 0, finalDmg });
    totalDamage += finalDmg;
  }
  if (hits.length > 0 && ampMult > 0) hits[0].consumePowerAmp = 1;
  const now = g.time || 0;
  const hitDelay = Math.max(0.14 + 0.75 + 0.18, 1.07);
  const applyAt = now + hitDelay;
  g.PendingHeroHits = g.PendingHeroHits || [];
  for (const hit of hits) {
    g.PendingHeroHits.push({
      at: applyAt,
      heroUID,
      targetUID: hit.targetUID,
      dmg: hit.dmg,
      finalDmg: Number(hit.finalDmg || 0),
      dotTotalDamage: Number(hit.dotTotalDamage || 0),
      powerAmpMultiplier: hit.powerAmpMultiplier,
      consumePowerAmp: hit.consumePowerAmp,
      effectType: isKojonn ? 'dot_apply' : 'damage',
      calcPath: mode === 'magic' ? 'magicCalc' : 'meleeCalc',
      heroName: actorName,
      heroType: mode,
    });
  }
  if (isKojonn) {
    LogCombat(ctx, `${actorName} used ${aoeName} to spread blight over time for ${totalDamage}!`);
  } else {
    LogCombat(ctx, `${actorName} used ${aoeName} on all enemies for ${totalDamage}!`);
  }
}

export function QueueEnemyDamageOverTime(ctx, actorUID, enemyUID, totalDamage, options = undefined) {
  const g = getGlobals(ctx);
  const enemy = GetActorByUID(ctx, enemyUID);
  const actor = GetActorByUID(ctx, actorUID);
  if (!enemy || !actor || Number(enemy.hp || 0) <= 0) return 0;
  const totalTicks = Math.max(1, Math.floor(Number(options?.totalTicks || 8) || 8));
  const nowTick = Number(g.RegenTickCounter || 0);
  const nowTurnSerial = Number(g.TurnSerial || 0);
  const effectName = String(options?.effectName || 'Blight');
  const cadence = String(options?.cadence || 'tick');
  if (!g.EnemyDamageOverTime) g.EnemyDamageOverTime = [];
  // Reapplying same DoT source/effect on same target resets the package.
  for (let i = g.EnemyDamageOverTime.length - 1; i >= 0; i--) {
    const existing = g.EnemyDamageOverTime[i];
    if (!existing) continue;
    if (Number(existing.targetUID || 0) !== Number(enemyUID || 0)) continue;
    if (Number(existing.sourceUID || 0) !== Number(actorUID || 0)) continue;
    if (String(existing.effectName || 'Blight') !== effectName) continue;
    g.EnemyDamageOverTime.splice(i, 1);
  }
  g.EnemyDamageOverTime.push({
    targetUID: Number(enemyUID || 0),
    sourceUID: Number(actorUID || 0),
    remainingFires: totalTicks,
    totalDamageRemaining: Math.max(1, Math.floor(Number(totalDamage || 0) || 1)),
    firesEveryTicks: Math.max(1, Math.floor(Number(options?.firesEveryTicks || 1) || 1)),
    nextFireTick: nowTick + Math.max(1, Math.floor(Number(options?.startAfterTicks || 1) || 1)),
    cadence,
    firesEveryTurns: Math.max(1, Math.floor(Number(options?.firesEveryTurns || 1) || 1)),
    nextFireTurnSerial: nowTurnSerial + Math.max(1, Math.floor(Number(options?.startAfterTurns || 1) || 1)),
    lastProcessedTurnSerial: nowTurnSerial,
    effectName,
  });
  LogCombat(ctx, `${actor.name || 'Hero'} applies ${effectName} to ${enemy.name || 'Enemy'}!`);
  return 1;
}

export function ProcessEnemyTurnDamageOverTime(ctx, enemyUID) {
  const g = getGlobals(ctx);
  const targetUID = Number(enemyUID || 0);
  if (!targetUID || !Array.isArray(g.EnemyDamageOverTime) || g.EnemyDamageOverTime.length === 0) return 0;
  const enemyDots = g.EnemyDamageOverTime;
  const currentTurnSerial = Number(g.TurnSerial || 0);
  let applied = 0;
  for (let i = enemyDots.length - 1; i >= 0; i--) {
    const dot = enemyDots[i];
    if (!dot || Number(dot.remainingFires || 0) <= 0) {
      enemyDots.splice(i, 1);
      continue;
    }
    if (String(dot.cadence || 'tick') !== 'turn') continue;
    if (Number(dot.targetUID || 0) !== targetUID) continue;
    if (dot.totalDamageRemaining != null && Number(dot.totalDamageRemaining || 0) <= 0) {
      enemyDots.splice(i, 1);
      continue;
    }
    const enemy = GetActorByUID(ctx, targetUID);
    if (!enemy || Number(enemy.hp || 0) <= 0) {
      enemyDots.splice(i, 1);
      continue;
    }
    const gateTurn = Number(dot.nextFireTurnSerial || 0);
    if (currentTurnSerial < gateTurn) continue;
    if (Number(dot.lastProcessedTurnSerial || 0) >= currentTurnSerial) continue;
    let dmg = 1;
    if (dot.totalDamageRemaining != null && Number(dot.remainingFires || 0) > 0) {
      const remaining = Math.max(0, Math.floor(dot.totalDamageRemaining));
      if (remaining <= 0) {
        enemyDots.splice(i, 1);
        continue;
      }
      const fires = Math.max(1, Math.floor(dot.remainingFires));
      const base = Math.floor(remaining / fires);
      const extra = (remaining % fires) > 0 ? 1 : 0;
      dmg = Math.max(1, base + extra);
      dot.totalDamageRemaining = Math.max(0, remaining - dmg);
    } else {
      dmg = Math.max(1, Math.round(dot.damagePerFire || 1));
    }
    g.NextHitFlashTone = 'purple';
    g.NextDamageTextKind = 'dot';
    ApplyDamageToTarget(ctx, targetUID, dmg, {
      isCrit: !!dot.isCrit || Number(dot.powerAmpMultiplier || 0) > 0,
    });
    applied += 1;
    dot.remainingFires -= 1;
    dot.lastProcessedTurnSerial = currentTurnSerial;
    dot.nextFireTurnSerial = gateTurn + Math.max(1, Math.floor(Number(dot.firesEveryTurns || 1) || 1));
    if (dot.remainingFires <= 0) {
      enemyDots.splice(i, 1);
    }
  }
  if (enemyDots.length === 0) delete g.EnemyDamageOverTime;
  return applied;
}

export function Enemy_ATK_Single(ctx, enemyUID, targetHeroUID) {
  const dmg = CalculateDamage(ctx, enemyUID, targetHeroUID, 'melee');
  const appliedDamage = ApplyDamageToTarget(ctx, targetHeroUID, dmg);
  const enemyName = getActorNameByUID(ctx, enemyUID);
  const heroName = getActorNameByUID(ctx, targetHeroUID);
  LogCombat(ctx, `${enemyName} hit ${heroName} for ${appliedDamage}!`);
}

export function Enemy_MAG_Single(ctx, enemyUID, targetHeroUID) {
  const dmg = CalculateDamage(ctx, enemyUID, targetHeroUID, 'magic');
  const resist = applyRunaMagicResist(ctx, enemyUID, targetHeroUID, dmg, 'Enemy_MAG_Single');
  const appliedDamage = resist.finalDamage > 0
    ? ApplyDamageToTarget(ctx, targetHeroUID, resist.finalDamage)
    : 0;
  const enemyName = getActorNameByUID(ctx, enemyUID);
  const heroName = getActorNameByUID(ctx, targetHeroUID);
  if (resist.mode === 'nullify') {
    LogCombat(ctx, `${heroName} nullified ${enemyName}'s magic!`);
  } else if (resist.mode === 'heavy_resist') {
    LogCombat(ctx, `${heroName} heavily resisted magic! (${dmg}->${appliedDamage})`);
  } else {
    LogCombat(ctx, `${enemyName} cast on ${heroName} for ${appliedDamage}!`);
  }
}

export function Enemy_Heal_Self(ctx, enemyUID) {
  const enemy = GetActorByUID(ctx, enemyUID);
  if (!enemy) return;
  const healInfo = rollEnemyHealAmount(ctx, enemy, {
    skillId: 'Enemy_Heal_Self',
    lowFloor: 6,
    lowOffset: -3,
    highOffset: 4,
  });
  const heal = healInfo.finalHeal;
  enemy.hp = Math.min(enemy.maxHP ?? enemy.hp, (enemy.hp ?? 0) + heal);
  SpawnDamageText(ctx, heal, enemy.x ?? 0, enemy.y ?? 0, 'heal', 'enemy');
  traceEnemyHealRoll(ctx, {
    enemyUID,
    enemyName: String(enemy.name || 'Enemy'),
    targetUID: Number(enemy.uid || enemyUID || 0),
    targetName: String(enemy.name || 'Enemy'),
    targetScope: 'self',
    ...healInfo,
  });
  LogCombat(
    ctx,
    healInfo.didCrit
      ? `${enemy.name || 'Enemy'} critically healed for ${heal}!`
      : `${enemy.name || 'Enemy'} healed for ${heal}!`,
  );
}

export function Enemy_Heal_Allies(ctx, enemyUID) {
  const healer = GetActorByUID(ctx, enemyUID);
  if (!healer) return;
  const healInfo = rollEnemyHealAmount(ctx, healer, {
    skillId: 'Enemy_Heal_Allies',
    lowFloor: 9,
    lowOffset: -1,
    highOffset: 2,
  });
  const heal = healInfo.finalHeal;
  const allies = getEnemies(ctx).filter((enemy) =>
    enemy && (enemy.hp || 0) > 0,
  );
  if (!allies.length) {
    Enemy_Heal_Self(ctx, enemyUID);
    return;
  }
  for (const ally of allies) {
    ally.hp = Math.min(ally.maxHP ?? ally.hp, (ally.hp ?? 0) + heal);
    SpawnDamageText(ctx, heal, ally.x ?? 0, ally.y ?? 0, 'heal', 'enemy');
  }
  traceEnemyHealRoll(ctx, {
    enemyUID,
    enemyName: String(healer.name || 'Enemy'),
    targetUID: 0,
    targetName: 'allies',
    targetScope: 'group',
    targetCount: allies.length,
    ...healInfo,
  });
  LogCombat(ctx, healInfo.didCrit ? 'Chimerilass critically heals her allies!' : 'Chimerilass heals her allies!');
}

export function Enemy_Heal_Ally(ctx, enemyUID, targetEnemyUID = 0) {
  const healer = GetActorByUID(ctx, enemyUID);
  if (!healer) return;
  const candidates = getEnemies(ctx).filter((enemy) =>
    enemy &&
    enemy.uid !== healer.uid &&
    (enemy.hp || 0) > 0 &&
    (enemy.maxHP || enemy.hp || 0) > (enemy.hp || 0),
  );
  if (!candidates.length) {
    Enemy_Heal_Self(ctx, enemyUID);
    return;
  }
  let target = targetEnemyUID ? GetActorByUID(ctx, targetEnemyUID) : null;
  if (!target || target.kind !== 'enemy' || target.uid === healer.uid || (target.hp || 0) <= 0) {
    target = randomPick(candidates);
  }
  if (!target) {
    Enemy_Heal_Self(ctx, enemyUID);
    return;
  }
  const healInfo = rollEnemyHealAmount(ctx, healer, {
    skillId: 'Enemy_Heal_Ally',
    lowFloor: 5,
    lowOffset: -2,
    highOffset: 3,
  });
  const heal = healInfo.finalHeal;
  target.hp = Math.min(target.maxHP ?? target.hp, (target.hp ?? 0) + heal);
  SpawnDamageText(ctx, heal, target.x ?? 0, target.y ?? 0, 'heal', 'enemy');
  traceEnemyHealRoll(ctx, {
    enemyUID,
    enemyName: String(healer.name || 'Enemy'),
    targetUID: Number(target.uid || 0),
    targetName: String(target.name || 'ally'),
    targetScope: 'ally',
    ...healInfo,
  });
  LogCombat(
    ctx,
    healInfo.didCrit
      ? `Chimerilass critically heals ${target.name || 'ally'} for ${heal}!`
      : `Chimerilass heals ${target.name || 'ally'} for ${heal}!`,
  );
}

export function PickNextEnemyID(ctx) {
  const g = getGlobals(ctx);
  const basePool = Array.isArray(g.EnemyData) ? g.EnemyData : [];
  const encounterNames = Array.isArray(g.EncounterPoolNames) ? g.EncounterPoolNames : [];
  const locale = String(g.EncounterLocale || g.CurrentLocale || 'all').trim().toLowerCase();
  const localePool = basePool.filter((row) => {
    const tags = normalizeLocaleTags(row?.localeTags || row?.locale || row?.biomes || row?.biome || 'all');
    return locale === 'all' || tags.includes('all') || tags.includes(locale);
  });
  const pool = encounterNames.length
    ? localePool.filter(row => encounterNames.includes(String(row?.name || '')))
    : localePool;
  if (pool.length === 0) return null;
  const idx = randomIndex(ctx, pool.length);
  return pool[idx] || null;
}

function buildWaveRespawnPlan(ctx, desiredSlots = 3) {
  const g = getGlobals(ctx);
  const basePool = Array.isArray(g.EnemyData) ? g.EnemyData : [];
  const encounterNames = Array.isArray(g.EncounterPoolNames) ? g.EncounterPoolNames : [];
  const locale = String(g.EncounterLocale || g.CurrentLocale || 'all').trim().toLowerCase();
  const localePool = basePool.filter((row) => {
    const tags = normalizeLocaleTags(row?.localeTags || row?.locale || row?.biomes || row?.biome || 'all');
    return locale === 'all' || tags.includes('all') || tags.includes(locale);
  });
  const pool = encounterNames.length
    ? localePool.filter(row => encounterNames.includes(String(row?.name || '')))
    : localePool;
  if (!pool.length) return [];

  const isSoloCommander = String(g.EncounterPolicy || 'mixed').trim().toLowerCase() === 'solo_commander';
  if (isSoloCommander) {
    const commanders = pool.filter((row) => String(row?.enemyRole || row?.role || '').trim().toLowerCase() === 'commander');
    const soloPool = commanders.length ? commanders : pool;
    const pick = soloPool[Math.floor(Math.random() * soloPool.length)];
    return [{ slotIndex: 1, row: pick }];
  }

  const targetCount = Math.max(1, Number(desiredSlots || 3));
  const selected = [];
  const remaining = [...pool];
  while (selected.length < targetCount) {
    if (remaining.length > 0) {
      const idx = Math.floor(Math.random() * remaining.length);
      selected.push(remaining[idx]);
      remaining.splice(idx, 1);
      continue;
    }
    selected.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  const getCP = (row) => Number(row?.CombatPower || row?.combatPower || 0);
  let strongestIdx = 0;
  for (let i = 1; i < selected.length; i += 1) {
    if (getCP(selected[i]) > getCP(selected[strongestIdx])) strongestIdx = i;
  }
  const strongest = selected[strongestIdx];
  const sideRows = selected.filter((_, idx) => idx !== strongestIdx);
  if (sideRows.length > 1 && Math.random() < 0.5) sideRows.reverse();

  const plan = [{ slotIndex: 1, row: strongest }];
  if (sideRows[0]) plan.push({ slotIndex: 0, row: sideRows[0] });
  if (sideRows[1]) plan.push({ slotIndex: 2, row: sideRows[1] });
  return plan;
}

function ensurePendingEnemyRespawnSlots(g, desiredSlots = 3) {
  if (!Array.isArray(g.PendingEnemyRespawnSlots)) {
    g.PendingEnemyRespawnSlots = Array.from({ length: Math.max(1, Number(desiredSlots || 3)) }, () => 0);
  }
  while (g.PendingEnemyRespawnSlots.length < desiredSlots) g.PendingEnemyRespawnSlots.push(0);
  return g.PendingEnemyRespawnSlots;
}

function finalizeEnemyRespawnWindow(ctx) {
  const g = getGlobals(ctx);
  g.PendingEnemyRespawnTimerActive = 0;
  const desiredSlots = Math.max(1, Number((Array.isArray(g.EnemySlots) && g.EnemySlots.length) ? g.EnemySlots.length : 3));
  g.EnemySlots = g.EnemySlots || Array.from({ length: desiredSlots }, () => 0);
  while (g.EnemySlots.length < desiredSlots) g.EnemySlots.push(0);
  if (!Array.isArray(g.EnemyIDs)) g.EnemyIDs = Array.from({ length: desiredSlots }, () => 0);
  while (g.EnemyIDs.length < desiredSlots) g.EnemyIDs.push(0);
  const pending = ensurePendingEnemyRespawnSlots(g, desiredSlots);
  const emptySlots = [];
  for (let slotIndex = 0; slotIndex < desiredSlots; slotIndex += 1) {
    if (Number(g.EnemySlots[slotIndex] || 0) <= 0) emptySlots.push(slotIndex);
  }
  if (emptySlots.length === desiredSlots) {
    const plan = buildWaveRespawnPlan(ctx, desiredSlots);
    for (const entry of plan) {
      const slotIndex = Number(entry?.slotIndex || 0);
      if (!entry || !entry.row) continue;
      if (Number(g.EnemySlots[slotIndex] || 0) > 0) continue;
      SpawnEnemy(ctx, entry.row, slotIndex);
    }
  } else {
    for (const slotIndex of emptySlots) {
      if (!Number(pending[slotIndex] || 0)) continue;
      if (Number(g.EnemySlots[slotIndex] || 0) > 0) continue;
      const pick = PickNextEnemyID(ctx);
      if (pick) SpawnEnemy(ctx, pick, slotIndex);
    }
  }
  g.PendingEnemyRespawnSlots = Array.from({ length: desiredSlots }, () => 0);
  UpdateEnemyHPUI(ctx);
  if (!g.RoundActive && !g.BattleStartActive) {
    StartRound(ctx);
    g.IsPlayerBusy = 0;
  }
}

function scheduleEnemyRespawnWindow(ctx, slotIndex, respawnDelay) {
  const g = getGlobals(ctx);
  const desiredSlots = Math.max(1, Number((Array.isArray(g.EnemySlots) && g.EnemySlots.length) ? g.EnemySlots.length : 3));
  const pending = ensurePendingEnemyRespawnSlots(g, desiredSlots);
  const safeSlot = Math.max(0, Math.min(desiredSlots - 1, Number(slotIndex || 0)));
  pending[safeSlot] = 1;
  if (Number(g.PendingEnemyRespawnTimerActive || 0) === 1) return;
  g.PendingEnemyRespawnTimerActive = 1;
  setTimeout(() => finalizeEnemyRespawnWindow(ctx), Math.max(0, Number(respawnDelay || 0)) * 1000);
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
    combatPower: Number(
      enemyData.CombatPower
      ?? enemyData.combatPower
      ?? computeCombatPowerFromStats(
        enemyData.ATK,
        enemyData.DEF,
        enemyData.HP ?? enemyData.maxHP,
        enemyData.MAG,
        enemyData.RES,
        enemyData.attackType,
      ),
    ),
    stats: {
      ATK: Number(enemyData.ATK ?? 0),
      DEF: Number(enemyData.DEF ?? 0),
      MAG: Number(enemyData.MAG ?? 0),
      RES: Number(enemyData.RES ?? 0),
      SPD: Number(enemyData.SPD ?? 0),
    },
    faction: String(enemyData.faction || 'wishless'),
    enemyRole: String(enemyData.enemyRole || enemyData.role || 'fodder'),
    targetPreference: enemyData.targetPreference || enemyData.targetingPreference || enemyData.targetingPolicy || enemyData.targetPolicy || '',
    localeTags: normalizeLocaleTags(enemyData.localeTags || enemyData.locale || enemyData.biomes || enemyData.biome || 'all'),
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
    schedulerApplySpawnInsertion(ctx);
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
  runTraitHooks(ctx, 'enemy_death', {
    enemyUID: Number(deadUID || 0),
    slotIndex: Number(slotIndex || 0),
    killerUID: Number(currentUID || 0),
  });
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
  schedulerApplyRemovalCompaction(ctx, deadUID);
  UpdateEnemyHPUI(ctx);
  const respawnDelay = Math.max(0.4, (g.DamageTextDurationSec || 1.35));
  scheduleEnemyRespawnWindow(ctx, slotIndex, respawnDelay);
}

function resolveEnemySlotIndex(ctx, enemyUID, fallbackSlotIndex = 0) {
  const g = getGlobals(ctx);
  const targetUID = Number(enemyUID || 0);
  const preferred = Number(fallbackSlotIndex || 0);
  if (targetUID > 0) {
    const fromSlots = Array.isArray(g.EnemySlots)
      ? g.EnemySlots.findIndex((cell) => Number(cell || 0) === targetUID + 1)
      : -1;
    if (fromSlots >= 0) return fromSlots;
    const fromIDs = Array.isArray(g.EnemyIDs)
      ? g.EnemyIDs.findIndex((uid) => Number(uid || 0) === targetUID)
      : -1;
    if (fromIDs >= 0) return fromIDs;
  }
  return preferred >= 0 ? preferred : 0;
}

export function KillEnemyByUID(ctx, enemyUID, fallbackSlotIndex = 0) {
  const g = getGlobals(ctx);
  const targetUID = Number(enemyUID || 0);
  if (!targetUID) return;
  const slotIndex = resolveEnemySlotIndex(ctx, targetUID, fallbackSlotIndex);
  const deadCell = Array.isArray(g.EnemySlots) ? Number(g.EnemySlots[slotIndex] || 0) : 0;
  if (deadCell > 0) {
    KillEnemyAt(ctx, slotIndex);
    return;
  }
  const currentUID = GetCurrentTurn(ctx);
  runTraitHooks(ctx, 'enemy_death', {
    enemyUID: targetUID,
    slotIndex: Number(slotIndex || 0),
    killerUID: Number(currentUID || 0),
  });
  const entities = ensureEntities(ctx);
  const idx = entities.findIndex(e => e && e.uid === targetUID);
  if (idx !== -1) entities.splice(idx, 1);
  if (g.EnemyDebuffs && g.EnemyDebuffs[targetUID]) delete g.EnemyDebuffs[targetUID];
  if (g.EnemyDebuffSlots && g.EnemyDebuffSlots[targetUID]) delete g.EnemyDebuffSlots[targetUID];
  if (g.EnemyDebuffTurns && g.EnemyDebuffTurns[targetUID]) delete g.EnemyDebuffTurns[targetUID];
  if (g.SelectedEnemyUID === targetUID) g.SelectedEnemyUID = 0;
  if (Array.isArray(g.EnemySlots) && slotIndex >= 0) g.EnemySlots[slotIndex] = 0;
  if (Array.isArray(g.EnemyIDs) && slotIndex >= 0) g.EnemyIDs[slotIndex] = 0;
  g.IsPlayerBusy = 1;
  UpdateEnemyHPUI(ctx);
  const respawnDelay = Math.max(0.4, (g.DamageTextDurationSec || 1.35));
  scheduleEnemyRespawnWindow(ctx, slotIndex, respawnDelay);
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
  const idx = tierIndex == null ? pickDropTier(ctx) : Math.max(0, Math.min(3, Math.floor(tierIndex)));
  return tiers[idx] ?? EMPTY;
}

const HUUN_EXECUTION_NAME = 'Huun';
const HUUN_EXECUTION_TH_BONUS = 2;

function resolveHuunExecutionDropBonusLevel(ctx, killerUID) {
  const killer = GetActorByUID(ctx, killerUID);
  if (!killer || killer.kind !== 'hero') return 0;
  if (String(killer.name || '') !== HUUN_EXECUTION_NAME) return 0;
  return HUUN_EXECUTION_TH_BONUS;
}

export function AwardMonsterDrop(ctx, monsterName, tierIndex = null, killerUID = 0) {
  const g = getGlobals(ctx);
  const baseThLevel = Number(g.TreasureHunterLevel ?? g.THLevel ?? g.DebugTHLevel ?? 0);
  const huunBonusLevel = resolveHuunExecutionDropBonusLevel(ctx, killerUID || GetCurrentTurn(ctx));
  const thLevel = baseThLevel + huunBonusLevel;
  const baseDropRate = Number(g.LootDropRateBps ?? g.DropRateBps ?? 10000);
  const transformedDropRate = getDropRate(thLevel, baseDropRate);
  g.LastHuunExecutionDropBonus = {
    killerUID: Number(killerUID || 0),
    baseThLevel: Number(baseThLevel || 0),
    bonusLevel: Number(huunBonusLevel || 0),
    effectiveThLevel: Number(thLevel || 0),
    transformedDropRate: Number(transformedDropRate || 0),
    monsterName: String(monsterName || ''),
  };
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
    } else if (parsed.type === 'ITEM') {
      LogCombat(ctx, `Item drop: ${parsed.id}`);
      awarded.push(parsed.id);
    } else {
      awarded.push('EMPTY');
    }
  }
  const resolved = awarded.find((entry) => entry && entry !== 'EMPTY') || EMPTY;
  const trace = {
    thLevel,
    baseDropRate,
    transformedDropRate,
    awarded: awarded.slice(),
    resolved,
  };
  g.LastLootSlotTrace = [trace];
  g.LastLootGateTrace = trace;
  console.log(`[LOOT_TRACE] ${monsterName} ${JSON.stringify(trace)}`);
  console.log(`[LOOT] Monster ${monsterName} awarded: ${resolved}`);
  return resolved;
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
  UpdateAstralFlowAmpBar(ctx);
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
  RegisterHeroGemUsage(ctx, actorUID, gemColor, consumedCount);
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
    LogGemIntent(ctx, 2, 'BLUE', 'Astral_Flow', '', actorUID);
    g.BuffRollApplyStat = 0;
    g.BuffRollSkillID = '';
    g.BuffRollActor = 0;
    g.BuffRollType = 0;
    // Blue path is wallet-only: clear deprecated buff icon loop state.
    g.BlueBuffSequenceActive = 0;
    g.BuffRollActive = 0;
    g.BuffRollDoneAt = 0;
    g.BuffIconPopType = -1;
    g.BuffIconPopAt = 0;
    g.BuffIconPopStacking = 0;
    g.TrackBuffs = [-1, -1, -1, -1];
    g.PartyBuffSlots = [];
    g.PartyBuffUI = { atk: false, def: false, mag: false, res: false };
    g.BuffFrames = [-1, -1, -1, -1];
    const consumedBlue = Math.max(0, Number(consumedCount) || 0);
    const wallet = ensureAstralFlowWallet(ctx);
    g.AstralFlowWallet = wallet + consumedBlue;
    LogCombat(ctx, `${getActorNameByUID(ctx, actorUID)} channeled ${consumedBlue} Astral Flow.`);
    ensureAstralFlowAmpState(ctx);
    if (consumedBlue >= 3 && !g.AstralFlowAmpReady) {
      const currentAmp = Math.max(0, Number(g.AstralFlowAmpPoints || 0));
      const ampMax = Math.max(1, Number(g.AstralFlowAmpMax || 18));
      const nextAmp = Math.min(ampMax, currentAmp + consumedBlue);
      g.AstralFlowAmpPoints = nextAmp;
      if (nextAmp >= ampMax) {
        g.AstralFlowAmpReady = 1;
        OpenSkillDraughtForHero(ctx, actorUID);
        LogCombat(ctx, `${getActorNameByUID(ctx, actorUID)} gained Astral Flow!`);
        g.ActionLockUntil = Math.max(g.ActionLockUntil || 0, (g.time || 0) + 4);
      }
    }
    UpdateAstralFlowAmpBar(ctx);
    // Blue matches are turn-consuming actions: lock input and defer exactly one handoff.
    g.CanPickGems = 0;
    g.IsPlayerBusy = 0;
    g.ActionOwnerUID = actorUID;
    // Keep handoff behind blue merge/fly-up completion (app blue merge duration is 0.28s).
    g.ActionLockUntil = Math.max(g.ActionLockUntil || 0, (g.time || 0) + 0.32);
    g.DeferAdvance = 1;
    g.AdvanceAfterAction = 1;
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

export function BuildRoundGroups(ctx) {
  const g = getGlobals(ctx);
  if (isTimeInitiative(ctx)) {
    const roster = getInitiativeRoster(ctx);
    if (!roster.length) {
      g.InitiativeMeters = {};
      schedulerWriteQueue(ctx, []);
      g.InitiativeCurrentUID = 0;
      schedulerWriteIndex(ctx, 0);
      return;
    }
    syncInitiativeMeters(ctx, roster);
    if (g.BattleStartMode && !g.BattleStartResolved) {
      const teamType = g.BattleStartMode === 'ambush' ? 1 : 0;
      const next = deriveBattleStartRemaining({ remaining: {}, roster, teamType });
      schedulerApplyBattleStartState(g, { remaining: next.remaining });
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
    schedulerClearQueue(ctx);
    return;
  }
  const jitter = g.RoundJitter ?? 0;
  const tol = g.UnisonTolerance ?? 0.5;
  const withInit = roster.map(r => ({
    ...r,
    init: r.spd + ((random01(ctx) * 2 - 1) * jitter)
  }));
  const startMode = g.BattleStartMode;
  const startModeApplied = Boolean(startMode && !g.BattleStartResolved);
  if (startModeApplied) {
    const ordered = deriveBattleStartRoundPartition(withInit, startMode);
    withInit.length = 0;
    withInit.push(...ordered);
    schedulerApplyBattleStartState(g, { reset: true });
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
    if (Math.abs(last.init - actor.init) <= tol) {
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
  schedulerWriteQueue(ctx, flat.map(a => ({ uid: a.uid, spd: a.spd, type: a.type })));
  schedulerWriteIndex(ctx, 0);
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
  schedulerWriteQueue(ctx, arr);
}

export function LogCombat(ctx, text) {
  const g = getGlobals(ctx);
  const value = String(text || '');
  if (!value) return;
  const now = Number(g.time || 0);
  const pinnedLine = typeof g.CombatActionPinnedLine === 'string' ? g.CombatActionPinnedLine : '';
  const pinUntil = Number(g.CombatActionPinnedUntil || 0);
  if (pinUntil > now && pinnedLine && value !== pinnedLine) {
    logLine(ctx, value);
    return;
  }
  const lines = g.CombatActionLines || ['', '', '', ''];
  lines[0] = lines[1];
  lines[1] = lines[2];
  lines[2] = lines[3];
  lines[3] = value;
  g.CombatActionLines = lines;
  if (/ gained Astral Flow!$/.test(value)) {
    g.CombatActionPinnedLine = String(value || '');
    g.CombatActionPinnedUntil = Math.max(pinUntil, now + 4);
  } else if (pinUntil <= now) {
    g.CombatActionPinnedLine = '';
    g.CombatActionPinnedUntil = 0;
  }
  logLine(ctx, value);
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
  let resolvedTargetUID = 0;
  const actor = GetActorByUID(ctx, actorUID);
  const actorName = actor ? actor.name : 'Actor';
  if (actor && actor.kind === 'hero') {
    const entry = ensurePowerAmpByUID(ctx)[actorUID];
    const activeMultiplier = GetPowerAmpMultiplierForActor(ctx, actorUID);
    emitPowerAmpStateLog(ctx, 'action_observed', actorUID, {
      skillId: String(skillId || ''),
      actionType: String(skillId || ''),
      powerAmpState: String(entry?.state || ''),
      powerAmpVisible: activeMultiplier > 0 ? 1 : 0,
      powerAmpLifecycleId: Number(entry?.lifecycleId || 0),
    });
  }
  console.log(`[SKILL] start skill=${skillId} actor=${actorName} uid=${actorUID} phase=${g.TurnPhase} busy=${g.IsPlayerBusy} canPick=${g.CanPickGems}`);
  if (actor && actor.kind === 'hero' && (skillId === 'HERO_SINGLE' || skillId === 'HERO_AOE')) {
    g.NextHeroActionProfile = skillId === 'HERO_AOE' ? 'aoe' : 'single';
    StartHeroLunge(ctx, actorUID);
  }

  if (skillId === 'DEF_UP') {
    handled = true;
    ctx.callFunction('Party_DEF_UP', 0, actorUID, 0, 2);
    runTraitHooks(ctx, 'status_apply', {
      sourceUID: Number(actorUID || 0),
      targetUID: Number(actorUID || 0),
      statusType: 'buff',
      stat: 'DEF',
      turns: 0,
      amount: 2,
    });
    LogCombat(ctx, `${actorName} increased the party's defense!`);
  } else if (skillId === 'ATK_UP') {
    handled = true;
    ctx.callFunction('Party_ATK_UP', 0, actorUID, 0, 2);
    runTraitHooks(ctx, 'status_apply', {
      sourceUID: Number(actorUID || 0),
      targetUID: Number(actorUID || 0),
      statusType: 'buff',
      stat: 'ATK',
      turns: 0,
      amount: 2,
    });
    LogCombat(ctx, `${actorName} increased the party's attack!`);
  } else if (skillId === 'MAG_UP') {
    handled = true;
    ctx.callFunction('Party_MAG_UP', 0, actorUID, 0, 2);
    runTraitHooks(ctx, 'status_apply', {
      sourceUID: Number(actorUID || 0),
      targetUID: Number(actorUID || 0),
      statusType: 'buff',
      stat: 'MAG',
      turns: 0,
      amount: 2,
    });
    LogCombat(ctx, `${actorName} increased the party's magic attack!`);
  } else if (skillId === 'RES_UP') {
    handled = true;
    ctx.callFunction('Party_RES_UP', 0, actorUID, 0, 2);
    runTraitHooks(ctx, 'status_apply', {
      sourceUID: Number(actorUID || 0),
      targetUID: Number(actorUID || 0),
      statusType: 'buff',
      stat: 'RES',
      turns: 0,
      amount: 2,
    });
    LogCombat(ctx, `${actorName} increased the party's magic defense!`);
  } else if (skillId === 'HERO_SINGLE') {
    handled = true;
    const enemies = getEnemies(ctx);
    const preferred = g.SelectedEnemyUID ? GetActorByUID(ctx, g.SelectedEnemyUID) : null;
    const target = preferred && preferred.kind === 'enemy' ? preferred : enemies[0];
    if (target) {
      resolvedTargetUID = Number(target.uid || 0);
      HeroAttackSingle(ctx, actorUID, target.uid);
    }
    const now = g.time || 0;
    g.ActionLockUntil = Math.max(g.ActionLockUntil || 0, now + 0.5);
  } else if (skillId === 'HERO_AOE') {
    handled = true;
    HeroAttackAOE(ctx, actorUID);
    const now = g.time || 0;
    g.ActionLockUntil = Math.max(g.ActionLockUntil || 0, now + 0.5);
  } else if (skillId === 'Enemy_ATK_Single') {
    handled = true;
    const target = pickEnemyTargetHero(ctx, actorUID);
    if (target) Enemy_ATK_Single(ctx, actorUID, target.uid);
  } else if (skillId === 'Enemy_MAG_Single') {
    handled = true;
    const target = pickEnemyTargetHero(ctx, actorUID);
    if (target) Enemy_MAG_Single(ctx, actorUID, target.uid);
  } else if (skillId === 'Enemy_MAG_AOE') {
    handled = true;
    g.IsAOEMatch = 1;
    for (const h of getHeroes(ctx)) {
      const dmg = CalculateDamage(ctx, actorUID, h.uid, 'magic');
      const resist = applyRunaMagicResist(ctx, actorUID, h.uid, dmg, 'Enemy_MAG_AOE');
      if (resist.finalDamage > 0) ApplyDamageToTarget(ctx, h.uid, resist.finalDamage);
    }
  }

  if (!handled) {
    LogCombat(ctx, `${actorName} tried skill: ${skillId} (UNKNOWN)`);
  }
  runTraitHooks(ctx, 'action_resolve', {
    actorUID: Number(actorUID || 0),
    actorKind: String(actor?.kind || ''),
    skillId: String(skillId || ''),
    handled: !!handled,
  });
  if (actor?.kind === 'hero' && handled) {
    TryGrantConfiguredExtraTurn(ctx, Number(actorUID || 0), null, {
      skillId: String(skillId || ''),
      targetUID: Number(resolvedTargetUID || 0),
    });
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
  const roll = random01(ctx);
  const name = enemy.name || '';

  if (!handled && name === 'Chimerilass') {
    const damagedAllies = getEnemies(ctx).filter((ally) =>
      ally &&
      ally.uid !== enemy.uid &&
      (ally.hp || 0) > 0 &&
      (ally.maxHP || ally.hp || 0) > (ally.hp || 0),
    );
    const hp = Number(enemy.hp || 0);
    const maxHP = Math.max(1, Number(enemy.maxHP || hp || 1));
    const belowHalfHP = hp <= Math.floor(maxHP * 0.5);
    if (!belowHalfHP) {
      return 0;
    }
    const canGroupHeal = damagedAllies.length > 1;
    const canAllyHeal = damagedAllies.length > 0;
    const canSelfHeal = hp < maxHP;
    if (belowHalfHP && (canGroupHeal || canAllyHeal || canSelfHeal)) {
      const weighted = [];
      if (canGroupHeal) weighted.push({ skillId: 'Enemy_Heal_Allies', weight: 20 });
      if (canAllyHeal) weighted.push({ skillId: 'Enemy_Heal_Ally', weight: 15 });
      if (canSelfHeal) weighted.push({ skillId: 'Enemy_Heal_Self', weight: 65 });
      const total = weighted.reduce((sum, row) => sum + Number(row.weight || 0), 0);
      if (total > 0) {
        let pick = Math.random() * total;
        let selected = weighted[weighted.length - 1];
        for (const row of weighted) {
          pick -= row.weight;
          if (pick <= 0) {
            selected = row;
            break;
          }
        }
        const allyTarget = (selected.skillId === 'Enemy_Heal_Ally') ? randomPick(damagedAllies) : null;
        ExecuteEnemySkill(ctx, enemyUID, selected.skillId, allyTarget ? allyTarget.uid : 0);
        handled = 1;
      }
    }
    if (handled) return handled;
    if (damagedAllies.length > 1 && Math.random() < 0.16) {
      ExecuteEnemySkill(ctx, enemyUID, 'Enemy_Heal_Allies');
      handled = 1;
    }
    if (!handled && damagedAllies.length > 0 && Math.random() < 0.10) {
      const target = randomPick(damagedAllies);
      ExecuteEnemySkill(ctx, enemyUID, 'Enemy_Heal_Ally', target ? target.uid : 0);
      handled = 1;
    }
    if (!handled && enemy.hp < enemy.maxHP && roll < 0.49) {
      ExecuteEnemySkill(ctx, enemyUID, 'Enemy_Heal_Self');
      handled = 1;
    }
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
  const target = randomPick(ctx, getHeroes(ctx));
  const targetUID = target ? target.uid : 0;
  ExecuteEnemyJobSkill(ctx, enemyUID, skillId, targetUID);
  return 1;
}

export function EnemyTurn(ctx, enemyUID) {
  const g = getGlobals(ctx);
  const activeEnemyUID = Number(enemyUID || GetCurrentTurn(ctx) || 0);
  g.TurnPhase = 2;
  applyTurnGateIntent(g, createEnemyTurnGateBaseline);
  if (!activeEnemyUID) {
    AdvanceTurn(ctx);
    ProcessTurn(ctx);
    return;
  }
  ProcessEnemyTurnDamageOverTime(ctx, activeEnemyUID);
  const enemy = GetActorByUID(ctx, activeEnemyUID);
  if (!enemy || Number(enemy.hp || 0) <= 0) {
    AdvanceTurn(ctx);
    ProcessTurn(ctx);
    return;
  }
  StartEnemyAction(ctx, activeEnemyUID);
}

export function HeroTurn(ctx, heroUID) {
  const g = getGlobals(ctx);
  const store = ensurePowerAmpByUID(ctx);
  ensureAstralFlowAmpState(ctx);
  g.TurnPhase = 0;
  applyTurnGateIntent(g, createHeroTurnGateBaseline);
  g.HideHeroSelector = 0;
  if (shouldResetAstralFlowAmpOnHeroTurn(g)) {
    g.AstralFlowAmpPoints = 0;
    g.AstralFlowAmpReady = 0;
    g.CombatActionPinnedLine = '';
    g.CombatActionPinnedUntil = 0;
  }
  UpdateAstralFlowAmpBar(ctx);
  if (heroUID) g.CurrentHeroUID = heroUID;
  if (heroUID && store[heroUID]) {
    const entry = store[heroUID];
    const turnNow = Number(g.DebugTurnCount || 0);
    const turnSerialNow = Number(g.TurnSerial || 0);
    if (
      entry.state === 'pending_next_own_turn' &&
      turnSerialNow > Number(entry.armedAtTurnSerial || 0)
    ) {
      const next = derivePowerAmpActivationEntry(entry, turnNow, turnSerialNow);
      store[heroUID] = next.entry;
      const activeEntry = next.entry;
      if (activeEntry && activeEntry.mult > 0) {
        const seeded = setPowerAmpVisual(g, heroUID, activeEntry.mult, activeEntry.lifecycleId);
        emitPowerAmpStateLog(ctx, 'activation_on', heroUID, { mult: activeEntry.mult, lifecycle: Number(activeEntry.lifecycleId || 0), seeded: seeded.seeded ? 1 : 0 });
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
  recoverStaleActionInProgress(g, uid);
  if (g.ActionInProgress && g.ActionActorUID && g.ActionActorUID !== uid) return;
  if (g.IsPlayerBusy && g.TurnPhase === 1) return;
  g.DebugTurnCount = (g.DebugTurnCount || 0) + 1;
  console.log(`[DEBUG] matches=${g.DebugMatchCount || 0} turns=${g.DebugTurnCount}`);
  const flatRaw = isTimeInitiative(ctx)
    ? (g.TurnOrderArray || [])
    : (g.RoundActive ? (g.RoundGroups || []).flatMap(gr => gr.members || []) : (g.TurnOrderArray || []));
  const flatOrder = flatRaw.filter(a => GetActorByUID(ctx, a.uid));
  if (g.RoundActive) {
    schedulerWriteQueue(ctx, flatOrder.map(a => ({ uid: a.uid, spd: a.spd, type: a.type })));
  }
  const curUID = uid;
  const currentIdx = flatOrder.findIndex(a => a.uid === curUID);
  if (currentIdx !== -1) schedulerWriteIndex(ctx, currentIdx);
  const orderLine = flatOrder.map((a, i) => {
    const act = GetActorByUID(ctx, a.uid);
    const name = act && act.name ? act.name : a.uid;
    const tag = a.type === 0 ? '(H)' : '(E)';
    return `${i === g.CurrentTurnIndex ? '>' : ''}${name}${tag}`;
  }).join(' | ');
  console.log(`[TURN][ORDER] idx=${g.CurrentTurnIndex} ${orderLine}`);
  if (actor) {
    const eff = GetEffectiveStat(ctx, actor, 'SPD');
    const cp = Number(actor.combatPower || actor.CombatPower || 0);
    const cpSuffix = type === 1 ? ` CP: ${Math.round(cp)}` : '';
    console.log(`[TURN] idx=${g.CurrentTurnIndex} ${actor.name || uid} type=${type} SPD: ${Math.round(eff)}${cpSuffix}`);
  }
  runTraitHooks(ctx, 'turn_start', {
    actorUID: Number(uid || 0),
    actorKind: String(actor?.kind || ''),
    turnType: Number(type || 0),
    turnIndex: Number(g.CurrentTurnIndex || 0),
  });

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

function isBoardFullyPopulatedForEnemyMutation(ctx) {
  const g = getGlobals(ctx);
  const gems = getGems(ctx);
  const rows = Math.max(1, Number(g.BoardRows || 4));
  const cols = Math.max(1, Number(g.BoardCols || 6));
  const expectedCount = rows * cols;
  if (!Array.isArray(gems) || gems.length !== expectedCount) return false;
  const occupied = new Set();
  for (const gem of gems) {
    const row = Number(gem?.cellR);
    const col = Number(gem?.cellC);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
    occupied.add(`${row},${col}`);
  }
  return occupied.size === expectedCount;
}

function resolveEnemyBoardLineFallbackSkill(enemy, skillId) {
  if (skillId !== 'Enemy_Scathe' && skillId !== 'Enemy_Sweep') return skillId;
  const name = String(enemy?.name || '');
  const conf = ENEMY_SKILL_ASSIGNMENT_MAP[name];
  return String(conf?.regularSkill || 'Enemy_ATK_Single');
}

const ENEMY_BOARD_PRESSURE_SKILL_HARNESSES = Object.freeze({
  Enemy_Scathe: Object.freeze({
    skillId: 'Enemy_Scathe',
    axis: 'column',
    label: 'Scathe',
    logSuffix: 'from a column.',
  }),
  Enemy_Sweep: Object.freeze({
    skillId: 'Enemy_Sweep',
    axis: 'row',
    label: 'Sweep',
    logSuffix: 'from a row.',
  }),
});

function getEnemyBoardPressureSkillHarness(skillId) {
  return ENEMY_BOARD_PRESSURE_SKILL_HARNESSES[String(skillId || '')] || null;
}

function normalizeEnemyBoardLineSkillDecision(ctx, enemy, decision) {
  const selected = String(decision?.selected || '');
  if (!getEnemyBoardPressureSkillHarness(selected)) return decision;
  if (isBoardFullyPopulatedForEnemyMutation(ctx)) return decision;
  return {
    ...decision,
    selected: resolveEnemyBoardLineFallbackSkill(enemy, selected),
    branch: `${String(decision?.branch || 'special')}_blocked_incomplete_board`,
  };
}

export function PickEnemySkill(ctx, enemyUID) {
  const enemy = GetActorByUID(ctx, enemyUID);
  if (!enemy) return 'Enemy_ATK_Single';
  if (String(enemy.name || '') === 'Chimerilass') {
    const hp = Number(enemy.hp || 0);
    const maxHP = Math.max(1, Number(enemy.maxHP || hp || 1));
    const belowHalfHP = hp <= Math.floor(maxHP * 0.5);
    if (!belowHalfHP) {
      const roll = Math.random();
      const decision = resolveEnemySkillDecision(enemy, roll);
      if (
        decision.selected === 'Enemy_Heal_Self' ||
        decision.selected === 'Enemy_Heal_Ally' ||
        decision.selected === 'Enemy_Heal_Allies' ||
        decision.selected === 'Enemy_Wipe'
      ) {
        const forced = {
          roll,
          selected: 'Enemy_MAG_Single',
          branch: 'cmh_over_50_no_heal',
          enemyName: String(enemy.name || ''),
        };
        traceEnemySkillDecision(ctx, enemyUID, forced);
        return forced.selected;
      }
      traceEnemySkillDecision(ctx, enemyUID, decision);
      return decision.selected;
    }
    if (belowHalfHP) {
      const damagedAllies = getEnemies(ctx).filter((ally) =>
        ally &&
        ally.uid !== enemy.uid &&
        (ally.hp || 0) > 0 &&
        (ally.maxHP || ally.hp || 0) > (ally.hp || 0),
      );
      const canGroupHeal = damagedAllies.length > 1;
      const canAllyHeal = damagedAllies.length > 0;
      const canSelfHeal = hp < maxHP;
      const weighted = [];
      if (canGroupHeal) weighted.push({ skillId: 'Enemy_Heal_Allies', weight: 20 });
      if (canAllyHeal) weighted.push({ skillId: 'Enemy_Heal_Ally', weight: 15 });
      if (canSelfHeal) weighted.push({ skillId: 'Enemy_Heal_Self', weight: 65 });
      if (weighted.length) {
        const total = weighted.reduce((sum, row) => sum + Number(row.weight || 0), 0);
        let pick = Math.random() * total;
        let selected = weighted[weighted.length - 1];
        for (const row of weighted) {
          pick -= row.weight;
          if (pick <= 0) {
            selected = row;
            break;
          }
        }
        traceEnemySkillDecision(ctx, enemyUID, {
          roll: -1,
          selected: selected.skillId,
          branch: 'cmh_under_50_forced_heal',
          enemyName: String(enemy.name || ''),
        });
        return selected.skillId;
      }
    }
  }
  const roll = Math.random();
  const decision = normalizeEnemyBoardLineSkillDecision(ctx, enemy, resolveEnemySkillDecision(enemy, roll));
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

function clearRandomGemLine(ctx, axis) {
  const g = getGlobals(ctx);
  const gems = getGems(ctx);
  const occupiedIndices = Array.from(new Set(
    gems
      .map((gem) => Number(axis === 'column' ? gem?.cellC : gem?.cellR))
      .filter((value) => Number.isInteger(value) && value >= 0)
  ));
  if (!occupiedIndices.length) return { cleared: 0, lineIndex: -1 };
  const lineIndex = occupiedIndices[Math.floor(Math.random() * occupiedIndices.length)];
  const nextGems = [];
  let consumed = 0;
  for (const gem of gems) {
    const gemIndex = Number(axis === 'column' ? gem?.cellC : gem?.cellR);
    if (gemIndex === lineIndex) {
      consumed += 1;
      continue;
    }
    nextGems.push(gem);
  }
  setGems(ctx, nextGems);
  setSelectedGemIndices(ctx, []);
  g.TapIndex = 0;
  if (consumed > 0) g.EnemyLineClearPressureActive = 1;
  return { cleared: consumed, lineIndex };
}

function executeEnemyBoardPressureSkill(ctx, enemyUID, skillId) {
  const harness = getEnemyBoardPressureSkillHarness(skillId);
  if (!harness) return 0;
  const enemyName = getActorNameByUID(ctx, enemyUID);
  const result = clearRandomGemLine(ctx, harness.axis);
  LogCombat(ctx, `${enemyName} used ${harness.label} and removed ${result.cleared} gems ${harness.logSuffix}`);
  return 1;
}

export function Enemy_Scathe(ctx, enemyUID) {
  return executeEnemyBoardPressureSkill(ctx, enemyUID, 'Enemy_Scathe');
}

export function Enemy_Sweep(ctx, enemyUID) {
  return executeEnemyBoardPressureSkill(ctx, enemyUID, 'Enemy_Sweep');
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
  const enemy = GetActorByUID(ctx, enemyUID);
  if (!enemy) return 0;
  const normalizedSkillId = normalizeEnemyBoardLineSkillDecision(ctx, enemy, {
    roll: -1,
    selected: skillId,
    branch: 'execute',
    enemyName: String(enemy.name || ''),
  }).selected;
  const resolvedTargetUID = targetUID || (pickEnemyTargetHero(ctx, enemyUID)?.uid || 0);
  if (normalizedSkillId === 'Enemy_Heal_Self') {
    Enemy_Heal_Self(ctx, enemyUID);
    return 1;
  }
  if (normalizedSkillId === 'Enemy_Heal_Allies') {
    Enemy_Heal_Allies(ctx, enemyUID);
    return 1;
  }
  if (normalizedSkillId === 'Enemy_Heal_Ally') {
    Enemy_Heal_Ally(ctx, enemyUID, targetUID);
    return 1;
  }
  if (normalizedSkillId === 'Enemy_Scathe') {
    Enemy_Scathe(ctx, enemyUID);
    return 1;
  }
  if (normalizedSkillId === 'Enemy_Sweep') {
    Enemy_Sweep(ctx, enemyUID);
    return 1;
  }
  if (normalizedSkillId === 'Enemy_MAG_Single') {
    if (resolvedTargetUID) Enemy_MAG_Single(ctx, enemyUID, resolvedTargetUID);
    return 1;
  }
  if (normalizedSkillId === 'Enemy_MAG_AOE') {
    for (const h of getHeroes(ctx)) {
      const dmg = CalculateDamage(ctx, enemyUID, h.uid, 'magic');
      const resist = applyRunaMagicResist(ctx, enemyUID, h.uid, dmg, 'Enemy_MAG_AOE');
      if (resist.finalDamage > 0) ApplyDamageToTarget(ctx, h.uid, resist.finalDamage);
    }
    return 1;
  }
  if (normalizedSkillId === 'Enemy_Drain_Buff') {
    return Enemy_Drain_Buff(ctx, enemyUID);
  }
  if (normalizedSkillId === 'Enemy_Wipe') {
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
  const target = pickEnemyTargetHero(ctx, enemyUID);
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
  let drawX = x;
  let drawY = y;
  if (kind === 'damage' && g.NextDamageTextScatter && typeof g.NextDamageTextScatter === 'object') {
    const scatter = g.NextDamageTextScatter;
    const radiusX = Math.max(0, Number(scatter.radiusX || 0));
    const radiusY = Math.max(0, Number(scatter.radiusY || 0));
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random());
    drawX += Math.cos(angle) * radiusX * distance;
    drawY += Math.sin(angle) * radiusY * distance;
    delete g.NextDamageTextScatter;
  }
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
    x: drawX,
    y: drawY,
    kind,
    targetKind,
    heat,
    peakScale,
    baseY: drawY,
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
  const profile = String(g.NextHeroActionProfile || 'single');
  delete g.NextHeroActionProfile;
  g.ActionInProgress = 1;
  g.ActionActorUID = actorUID;
  g.IsPlayerBusy = 1;
  g.CanPickGems = 0;
  g.TurnPhase = 1;
  const totalDur = profile === 'aoe'
    ? 0.14 + 0.75 + 0.24 + 0.42
    : 0.14 + 0.75 + 0.16 + 0.26;
  const until = (g.time || 0) + totalDur;
  g.ActionLockUntil = Math.max(g.ActionLockUntil || 0, until);
  g.DeferAdvance = 1;
  g.HeroAction = {
    uid: actorUID,
    profile,
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
