import { state } from './state.js';
import { MONSTER_KEYS, MONSTER_LOOT_TABLE, TOKEN, EMPTY } from './monsterLootTableEventTokens.js';
import { ACTIVE_EVENT_IDS, LIVE_OPS_EVENTS, TOKEN_REGISTRY } from './liveOpsTokens.js';

const POWER_AMP_OUTCOMES = [
  { key: 'HERO_2X', multiplier: 2, chance: 0.62 },
  { key: 'HERO_3X', multiplier: 3, chance: 0.34 },
  { key: 'JACKPOT_ALL_2X', multiplier: 2, chance: 0.04, jackpotAllLivingHeroes: true },
];

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
  g.PowerAmpFadeByUID[uid] = { mult, startAt: g.time || 0, duration: 0.16 };
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

function activatePowerAmp(ctx, actorUID) {
  const g = getGlobals(ctx);
  const store = ensurePowerAmpByUID(ctx);
  const outcome = pickPowerAmpOutcome();
  const grantTurn = g.DebugTurnCount || 0;
  if (outcome.jackpotAllLivingHeroes) {
    for (const hero of getHeroes(ctx)) {
      if ((hero.hp ?? 0) > 0) {
        store[hero.uid] = {
          mult: outcome.multiplier,
          grantedTurn: grantTurn,
          readyTurn: null,
          usedThisTurn: false,
        };
      }
    }
    for (const hero of getHeroes(ctx)) {
      if (store[hero.uid]) setPowerAmpVisual(g, hero.uid, store[hero.uid].mult);
    }
    LogCombat(ctx, 'JACKPOT! All heroes get Power Amp x2!');
    return;
  }
  store[actorUID] = {
    mult: outcome.multiplier,
    grantedTurn: grantTurn,
    readyTurn: null,
    usedThisTurn: false,
  };
  setPowerAmpVisual(g, actorUID, outcome.multiplier);
  LogCombat(ctx, `${getActorNameByUID(ctx, actorUID)} gained Power Amp x${outcome.multiplier}!`);
}

function consumePowerAmpForEvent(ctx, actorUID, values) {
  const g = getGlobals(ctx);
  const store = ensurePowerAmpByUID(ctx);
  const entry = store[actorUID];
  const mult = Number(entry?.mult || 0);
  if (!mult) return values;
  if (entry && entry.readyTurn === (g.DebugTurnCount || 0)) {
    entry.usedThisTurn = true;
    return values.map(v => Math.max(1, Math.ceil((v || 0) * mult)));
  }
  return values;
}

export function GetPowerAmpMultiplierForActor(ctx, actorUID) {
  const g = getGlobals(ctx);
  const store = ensurePowerAmpByUID(ctx);
  const entry = store[actorUID];
  if (!entry) return 0;
  if (entry.readyTurn !== (g.DebugTurnCount || 0)) return 0;
  entry.usedThisTurn = true;
  return Number(entry.mult || 0);
}

export function ConsumePowerAmpForActor(ctx, actorUID) {
  const store = ensurePowerAmpByUID(ctx);
  const entry = store[actorUID];
  const mult = Number(entry?.mult || 0);
  if (!mult) return 0;
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

function ensureTokenWallet(ctx) {
  const g = getGlobals(ctx);
  if (!g.TokenWallet || typeof g.TokenWallet !== 'object') g.TokenWallet = {};
  return g.TokenWallet;
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

function syncInitiativeMeters(ctx, roster) {
  const g = getGlobals(ctx);
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

function buildInitiativePreview(roster, meters, threshold, count, currentUID, pool = null) {
  const preview = [];
  const localMeters = {};
  for (const [key, val] of Object.entries(meters)) {
    localMeters[key] = Number(val) || 0;
  }
  const localRoster = roster.map(r => ({ ...r }));
  const localPool = (pool && pool.length) ? pool.map(r => ({ ...r })) : localRoster;
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
      for (const r of localPool) {
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
      for (const r of localPool) {
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
  if (!g.BattleStartRemaining || typeof g.BattleStartRemaining !== 'object') {
    g.BattleStartRemaining = {};
  }
  const remaining = g.BattleStartRemaining;
  if (Object.keys(remaining).length === 0) {
    for (const r of roster) {
      if (r.type === teamType) remaining[r.uid] = true;
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
  const threshold = Number(g.InitiativeThreshold || 100);
  const meters = syncInitiativeMeters(ctx, roster);
  const override = getInitiativeOverridePool(ctx, roster);
  const pool = override.pool || roster;
  const maxLoops = Number(g.InitiativeMaxLoops || 500);
  let loops = 0;
  while (loops < maxLoops) {
    let ready = null;
    for (const r of pool) {
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
        delete override.remaining[ready.uid];
        if (Object.keys(override.remaining).length === 0) {
          g.BattleStartResolved = 1;
          g.BattleStartMode = '';
        }
      }
      g.InitiativeCurrentUID = ready.uid;
      g.CurrentTurnIndex = 0;
      const previewSize = Number(g.InitiativePreviewSize || 6);
      g.TurnOrderArray = buildInitiativePreview(roster, meters, threshold, previewSize, ready.uid, pool);
      return ready;
    }
    for (const r of pool) {
      const meter = getMeter(meters, r.uid);
      setMeter(meters, r.uid, meter + (r.spd || 0));
    }
    loops += 1;
  }
  console.log('[INIT] guard hit; forcing next actor');
  const fallback = roster[0];
  g.InitiativeCurrentUID = fallback.uid;
  g.CurrentTurnIndex = 0;
  const previewSize = Number(g.InitiativePreviewSize || 6);
  g.TurnOrderArray = buildInitiativePreview(roster, meters, threshold, previewSize, fallback.uid, pool);
  return fallback;
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
  const meters = syncInitiativeMeters(ctx, roster);
  const threshold = Number(g.InitiativeThreshold || 100);
  const previewSize = Number(g.InitiativePreviewSize || 6);
  const curUID = g.InitiativeCurrentUID;
  const override = getInitiativeOverridePool(ctx, roster);
  const pool = override.pool || roster;
  g.TurnOrderArray = buildInitiativePreview(roster, meters, threshold, previewSize, curUID, pool);
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
  g.TurnOrderArray = actedSegment.concat(remaining);
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
  if (currentType === 0 && currentUID) {
    const store = ensurePowerAmpByUID(ctx);
    const entry = store[currentUID];
    if (entry && entry.readyTurn === (g.DebugTurnCount || 0)) {
      const mult = Number(entry.mult || 0);
      delete store[currentUID];
      if (mult) startPowerAmpFade(g, currentUID, mult);
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
  if (isTimeInitiative(ctx)) {
    resolvePendingDeathsForInitiative(ctx);
    selectNextInitiativeActor(ctx);
    ProcessCurrentTurn(ctx);
    return;
  }
  ProcessCurrentTurn(ctx);
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
  g.TurnOrderArray = arr;
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
  const ampMult = GetPowerAmpMultiplierForActor(ctx, heroUID);
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
  const ampMult = GetPowerAmpMultiplierForActor(ctx, heroUID);
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
    refreshInitiativePreview(ctx);
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

export function AwardMonsterDrop(ctx, monsterName, tierIndex = null) {
  const rollsPerDeath = 4;
  const awarded = [];
  for (let i = 0; i < rollsPerDeath; i++) {
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

export function ResolveGemAction(ctx, gemColor, actorUID) {
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
    if (roll === 1) { skillId = 'ATK_UP'; intentKey = 'Party_ATK_UP'; }
    if (roll === 2) { skillId = 'MAG_UP'; intentKey = 'Party_MAG_UP'; }
    if (roll === 3) { skillId = 'RES_UP'; intentKey = 'Party_RES_UP'; }
    LogGemIntent(ctx, 2, 'BLUE', intentKey, '', actorUID);
    g.BuffRollSkillID = skillId;
    g.BuffRollActor = actorUID;
    g.BuffRollType = roll;
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
  } else if (skillId === 'SPD_UP') {
    handled = true;
    ctx.callFunction('Party_SPD_UP', buffTurns, actorUID, 0, 2);
    LogCombat(ctx, `${actorName} increased the party's speed!`);
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
  if (skillId === 'Enemy_Heal_Self') {
    Enemy_Heal_Self(ctx, enemyUID);
    return 1;
  }
  if (skillId === 'Enemy_MAG_Single') {
    const target = randomPick(getHeroes(ctx));
    if (target) Enemy_MAG_Single(ctx, enemyUID, target.uid);
    return 1;
  }
  if (skillId === 'Enemy_ATK_Single') {
    const target = randomPick(getHeroes(ctx));
    if (target) Enemy_ATK_Single(ctx, enemyUID, target.uid);
    return 1;
  }
  return 0;
}

export function EnemyAttack(ctx, enemyUID) {
  const skillId = PickEnemySkill(ctx, enemyUID);
  const target = randomPick(getHeroes(ctx));
  const targetUID = target ? target.uid : 0;
  ApplyEnemySkill(ctx, enemyUID, skillId, targetUID);
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
    const turnNow = g.DebugTurnCount || 0;
    if (entry.readyTurn == null && turnNow > (entry.grantedTurn || 0)) {
      entry.readyTurn = turnNow;
      entry.usedThisTurn = false;
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
  const name = enemy.name || '';
  if (name === 'Chimerilass' && enemy.hp < enemy.maxHP && roll < 0.49) return 'Enemy_Heal_Self';
  if (name === 'Djinn' && roll < 0.85) return 'Enemy_MAG_Single';
  if (name === 'Marid' && roll < 0.65) return 'Enemy_MAG_Single';
  return 'Enemy_ATK_Single';
}

export function ApplyEnemySkill(ctx, enemyUID, skillId, targetUID) {
  if (skillId === 'Enemy_Heal_Self') {
    Enemy_Heal_Self(ctx, enemyUID);
    return;
  }
  if (skillId === 'Enemy_MAG_Single') {
    if (targetUID) Enemy_MAG_Single(ctx, enemyUID, targetUID);
    return;
  }
  if (skillId === 'Enemy_MAG_AOE') {
    for (const h of getHeroes(ctx)) {
      const dmg = CalculateDamage(ctx, enemyUID, h.uid, 'magic');
      ApplyDamageToTarget(ctx, h.uid, dmg);
    }
    return;
  }
  if (targetUID) Enemy_ATK_Single(ctx, enemyUID, targetUID);
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
  if (buffType < 0 || buffType > 3) return;
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
  if (g.BuffRollSkillID) {
    ExecuteSkill(ctx, g.BuffRollSkillID, g.BuffRollActor, 0);
    g.BuffRollSkillID = '';
    g.BuffRollActor = 0;
  }
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
  if (buffType == null || buffType < 0 || buffType > 3) return;
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
