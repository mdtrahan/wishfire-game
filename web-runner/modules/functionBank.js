import { settleContinuousCombatRewards } from "./heroCommands.mjs";
import { state } from "./state.js";
import { MONSTER_KEYS, MONSTER_LOOT_TABLE, TOKEN, EMPTY } from "./monsterLootTableEventTokens.js";
import { ACTIVE_EVENT_IDS, LIVE_OPS_EVENTS, TOKEN_REGISTRY } from "./liveOpsTokens.js";
import { createYellowSafetyNet } from "../src/core/turnGateController.mjs";
import { computeCombatPower as canonicalCombatPower } from "../src/core/combatPower.mjs";
const GROW_TIERS = /* @__PURE__ */ Object.freeze([
  /* @__PURE__ */ Object.freeze({ tier: 1, powerAmpPct: 8, powerAmpMultiplier: 1.08, maxHpPenaltyPct: 8 }),
  /* @__PURE__ */ Object.freeze({ tier: 2, powerAmpPct: 14, powerAmpMultiplier: 1.14, maxHpPenaltyPct: 14 }),
  /* @__PURE__ */ Object.freeze({ tier: 3, powerAmpPct: 20, powerAmpMultiplier: 1.2, maxHpPenaltyPct: 20 })
]);
const GROW_MAX_TIER = GROW_TIERS.length;
const PARTY_CHAIN_STRIKE_I_ID = "party_chain_strike_i";
const PARTY_CHAIN_STRIKE_I_DAMAGE_PCT = 33;
const PARTY_CHAIN_STRIKE_II_ID = "party_chain_strike_ii";
const PARTY_CHAIN_STRIKE_II_DAMAGE_PCT = 66;
const PARTY_CHAIN_STRIKE_VISUAL_KEY = "chain_arc_ribbon";
const PARTY_SPLIT_ID = "party_split";
function getGlobals(ctx) {
  return ctx && ctx.state ? ctx.state.globals : state.globals;
}
function getRandomSource(ctx) {
  const g = getGlobals(ctx);
  const fn = g && typeof g.RuntimeRandom === "function" ? g.RuntimeRandom : null;
  return fn || Math.random;
}
function random01(ctx) {
  const g = getGlobals(ctx);
  const hasRuntimeRandom = !!(g && typeof g.RuntimeRandom === "function");
  const value = Number(getRandomSource(ctx)());
  if (Number.isFinite(value) && value >= 0 && value < 1) return value;
  if (hasRuntimeRandom) return 0;
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
  const ref = ctx && ctx.state ? ctx.state.entities : state.entities;
  if (!ref) {
    if (ctx && ctx.state) ctx.state.entities = [];
    else state.entities = [];
  }
  return ctx && ctx.state ? ctx.state.entities : state.entities;
}
function computeCombatPowerFromStats(atk, def, hp) {
  const [mag = 0, res = 0, spd = 0, level = 1] = arguments.length > 3 ? [...arguments].slice(3) : [];
  return canonicalCombatPower({ maxHP: hp, level, stats: { ATK: atk, DEF: def, MAG: mag, RES: res, SPD: spd } });
}
function normalizeLocaleTags(input) {
  if (Array.isArray(input)) {
    const tags2 = input.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean);
    return tags2.length ? tags2 : ["all"];
  }
  const raw = String(input ?? "").trim();
  if (!raw) return ["all"];
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeLocaleTags(parsed);
    } catch (_) {
    }
  }
  const tags = raw.split("|").flatMap((part) => String(part).split(",")).map((v) => String(v || "").trim().toLowerCase()).filter(Boolean);
  return tags.length ? tags : ["all"];
}
function applyTurnGateState(g, next) {
  if (!g || !next) return;
  const TURN_TRANSIENT_NUMERIC_KEYS = /* @__PURE__ */ Object.freeze([
    "CanPickGems",
    "IsPlayerBusy",
    "DeferAdvance",
    "AdvanceAfterAction",
    "ActionLockUntil",
    "ActionOwnerUID",
    "ActionInProgress",
    "ActionActorUID",
    "PendingActor",
    "EnemyLineClearPressureActive"
  ]);
  const TURN_TRANSIENT_STRING_KEYS = /* @__PURE__ */ Object.freeze([
    "PendingSkillID"
  ]);
  for (const key of TURN_TRANSIENT_NUMERIC_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue;
    g[key] = Number(next[key] || 0);
  }
  for (const key of TURN_TRANSIENT_STRING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue;
    g[key] = String(next[key] || "");
  }
}
function applyTurnGateIntent(g, createIntent, options = void 0) {
  if (!g || typeof createIntent !== "function") return;
  applyTurnGateState(g, createIntent(g, options));
}
function getAllHeroActors(ctx) {
  return getEntities(ctx).filter((e) => e && e.kind === "hero");
}
function getHeroPartyIndex(hero, fallback = -1) {
  const index = Number(hero?.heroDisplaySlot ?? hero?.displaySlot ?? hero?.heroIndex ?? fallback);
  return Number.isInteger(index) && index >= 0 && index < 6 ? index : -1;
}
function syncPartyHpTotalsFromHeroes(ctx) {
  const g = getGlobals(ctx);
  const heroes = getDeployedHeroes(ctx);
  g.PartyHPByIndex = [];
  g.PartyMaxHPByIndex = [];
  heroes.forEach((hero, order) => {
    const index = getHeroPartyIndex(hero, order);
    if (index < 0) return;
    g.PartyHPByIndex[index] = Math.max(0, Number(hero.hp || 0));
    g.PartyMaxHPByIndex[index] = Math.max(0, Number(hero.maxHP || 0));
  });
  g.PartyHPByIndex = Array.from(g.PartyHPByIndex, (value) => value || 0);
  g.PartyMaxHPByIndex = Array.from(g.PartyMaxHPByIndex, (value) => value || 0);
  g.PartyHP = sum(heroes.map((hero) => Math.max(0, Number(hero.hp || 0))));
  g.PartyMaxHP = sum(heroes.map((hero) => Math.max(0, Number(hero.maxHP || 0))));
}
function makeStableHeroSkillPointId(hero) {
  const actorUID = Number(hero && hero.uid);
  if (Number.isInteger(actorUID) && actorUID > 0) return `hero_actor:${actorUID}`;
  const instanceKey = String(hero && hero.heroInstanceKey || "").trim().toLowerCase();
  if (instanceKey) return `hero_instance:${instanceKey}`;
  const heroIndex = Number(hero && hero.heroIndex);
  if (Number.isInteger(heroIndex) && heroIndex >= 0) return `hero:${heroIndex}`;
  const heroName = String(hero && (hero.baseHeroName || hero.name) || "").trim().toLowerCase();
  if (heroName) return `hero_name:${heroName}`;
  return "";
}
const HERO_SKILL_SHARED_KEY = "__party_shared__";
const PARTY_SKILL_DEFINITIONS = /* @__PURE__ */ Object.freeze([
  { id: "party_fresh_start", owner: "Party", slot: 0, title: "Fresh Start", description: "Start combat with a small burst of power.", risk: "LOW", growth: [6, 6, 7, 8], procPattern: "On battle start", payloadImplemented: false },
  { id: "party_second_chance", owner: "Party", slot: 1, title: "Second Chance", description: "Reroll part of a weak board into a better setup.", risk: "MED", growth: [4, 4, 5, 5], procPattern: "On weak board state", payloadImplemented: false },
  { id: "party_momentum", owner: "Party", slot: 2, title: "Momentum", description: "Carry one strong turn into the next.", risk: "MED", growth: [4, 4, 5, 5], procPattern: "On combo finisher", payloadImplemented: false },
  { id: "party_guard_rail", owner: "Party", slot: 3, title: "Guard Rail", description: "Reduce the impact of a dangerous hit.", risk: "MED", growth: [4, 4, 5, 5], procPattern: "On heavy hit taken", payloadImplemented: false },
  { id: "party_blue_spark", owner: "Party", slot: 4, title: "Blue Spark", description: "Turn blue water gains into a bonus for the whole party.", risk: "MED", growth: [4, 4, 5, 5], procPattern: "On blue water match", payloadImplemented: false },
  { id: "party_weaken", owner: "Party", slot: 5, title: "Weaken", description: "Lower enemy defense so your hits land harder.", risk: "MED", growth: [4, 4, 5, 5], procPattern: "On special hit", payloadImplemented: false },
  { id: "party_destiny", owner: "Party", slot: 6, title: "Destiny", description: "Attacks have a chance to restore 2.5% health on impact.", risk: "MED", growth: [32, 32, 32, 32], procPattern: "On hit", payloadImplemented: true, trigger: { event: "hit_enemy", eligibility: "active_party_skill_positive_hero_damage" }, effect: { kind: "proc_heal", procChancePct: 32, healPctActorMax: 2.5 }, qa: { proof: "PartyDestinyAttempts/Procs/Heals/Misses" } },
  { id: "party_hot_streak", owner: "Party", slot: 7, title: "Hot Streak", description: "Build up a better payoff with consecutive matches.", risk: "MED", growth: [4, 4, 5, 5], procPattern: "On consecutive matches", payloadImplemented: false },
  { id: "party_last_push", owner: "Party", slot: 8, title: "Last Push", description: "Gain a brief comeback burst when the party nears defeat.", risk: "MED", growth: [4, 4, 5, 5], procPattern: "On low party HP", payloadImplemented: false },
  { id: "party_chain_pop", owner: "Party", slot: 9, title: "Chain Pop", description: "Trigger an extra board effect from a match.", risk: "MED", growth: [4, 4, 5, 5], procPattern: "On match", payloadImplemented: false },
  { id: "party_magic_fruit", owner: "Party", slot: 10, title: "Magic Fruit", description: "Heals the active hero for 32% and raises party max HP by 15%", risk: "MED", growth: [4, 4, 5, 5], procPattern: "On cooldown-ready action", payloadImplemented: true, trigger: { event: "cooldown_ready", eligibility: "active_party_skill" }, effect: { kind: "party_heal_max_hp", healPctActorMax: 32, maxHpPctPartyMax: 15 }, qa: { proof: "ApplyActiveHeroHeal once per cooldown-ready action and PartyMaxHP increase" } },
  { id: "party_crimson_ward", owner: "Party", slot: 11, title: "Crimson Ward", description: "Grant a temporary party ward before true HP is damaged.", risk: "MED", growth: [4, 4, 5, 5], procPattern: "On cooldown-ready action", payloadImplemented: true, trigger: { event: "cooldown_ready", eligibility: "active_party_skill" }, effect: { kind: "party_temp_hp_shield", shieldPctPartyMax: 18, stacking: "refresh_capped_shield" }, qa: { proof: "PartyTempHPShield and ward visuals refresh" } },
  { id: "party_faze", owner: "Party", slot: 12, title: "Faze", description: "Blights the field, poisoning enemies for the remainder of the session.", risk: "HIGH", growth: [2, 2, 3, 3], procPattern: "On cooldown-ready action", payloadImplemented: true, trigger: { event: "cooldown_ready", eligibility: "active_party_skill" }, effect: { kind: "field_refresh", status: "tainted_ground" }, qa: { proof: "TaintedGroundZones and PendingHeroHits refresh" } },
  { id: "party_grow", owner: "Party", slot: 13, title: "Grow", description: "Grow all living heroes: more power, less Max HP.", risk: "HIGH", growth: [8, 14, 20], procPattern: "On cooldown-ready action", payloadImplemented: true, trigger: { event: "cooldown_ready", eligibility: "all_living_heroes" }, effect: { kind: "grow", maxTier: GROW_MAX_TIER, application: "all_living_heroes", powerAmpPctByTier: GROW_TIERS.map((row) => row.powerAmpPct), maxHpPenaltyPctByTier: GROW_TIERS.map((row) => row.maxHpPenaltyPct) }, qa: { proof: "GrowAcquisitionTrace and persistent PowerAmpVisualByUID state" } },
  { id: PARTY_CHAIN_STRIKE_I_ID, owner: "Party", slot: 14, title: "Chain Strike I", description: "Hero attacks bounce once for 33% damage.", risk: "MED", growth: [33], procPattern: "On hero attack", payloadImplemented: true, trigger: { event: "hero_attack_single", eligibility: "active_party_skill_living_enemy_target" }, effect: { kind: "chain_bounce", bounceDamagePct: PARTY_CHAIN_STRIKE_I_DAMAGE_PCT, maxBounces: 1, targeting: "next_living_enemy_sequence", oneEnemyFallback: "same_enemy", visual: PARTY_CHAIN_STRIKE_VISUAL_KEY }, qa: { proof: "PendingHeroHits chain_bounce packet and ChainStrikeVisuals arc ribbon" } },
  { id: PARTY_CHAIN_STRIKE_II_ID, owner: "Party", slot: 15, title: "Chain Strike II", description: "Upgrade Chain Strike to bounce twice for 66% damage.", risk: "MED", growth: [66], procPattern: "On hero attack", payloadImplemented: true, trigger: { event: "hero_attack_single", eligibility: "requires_chain_strike_i" }, effect: { kind: "chain_bounce_upgrade", upgrades: PARTY_CHAIN_STRIKE_I_ID, bounceDamagePct: PARTY_CHAIN_STRIKE_II_DAMAGE_PCT, maxBounces: 2, targeting: "next_living_enemy_sequence", oneEnemyFallback: "same_enemy", visual: PARTY_CHAIN_STRIKE_VISUAL_KEY }, qa: { proof: "Requires Chain Strike I and upgrades LastPartyChainStrike to two 66% bounces" } },
  { id: "party_arcane_pulse", owner: "Party", slot: 16, title: "Arcane Pulse", description: "Every other hero attack deals 12 bonus magic damage to the selected target.", risk: "MED", growth: [12, 12, 12, 12], procPattern: "Every 2 hero attacks", payloadImplemented: true, trigger: { event: "hero_attack_single", eligibility: "active_party_skill_enemy_target" }, effect: { kind: "arcane_pulse", flatDamage: 12, triggerEvery: 2, targeting: "selected_enemy", visual: "arcane_pulse_burst" }, qa: { proof: "PartyArcanePulseActionCount/Procs and ArcanePulseVisuals" } },
  { id: PARTY_SPLIT_ID, owner: "Party", slot: 17, title: "Split", description: "Red attacks split their damage through all living enemies.", risk: "MED", growth: [], procPattern: "On red attack", payloadImplemented: true, trigger: { event: "hero_attack_red", eligibility: "active_party_skill_red_lane_attack" }, effect: { kind: "split_red_aoe", targeting: "all_living_enemies", damageMath: "red_attack_total_divided_by_living_enemies", chainStrikeSource: "living_enemy_from_saved_red_target_anchor" }, qa: { proof: "PendingHeroHits Split AOE packets and Chain Strike living-anchor fallback" } }
]);
const PARTY_ARCANE_PULSE_DAMAGE_TEXT_CLEAR_SEC = 0.18 + 0.7 + 0.45;
function resolveHeroSkillPointIdentity(ctx, heroRef) {
  const heroes = getAllHeroActors(ctx);
  const fromActor = (hero) => ({
    heroId: makeStableHeroSkillPointId(hero),
    heroIndex: Number.isInteger(Number(hero && hero.heroIndex)) ? Number(hero.heroIndex) : -1,
    heroName: String(hero && (hero.baseHeroName || hero.name) || ""),
    actorUID: Number(hero && hero.uid || 0)
  });
  const fromStableId = (heroId) => {
    const text = String(heroId || "");
    if (text.startsWith("hero_actor:")) {
      const uid = Number(text.slice(11));
      const match = heroes.find((hero) => Number(hero.uid) === uid) || null;
      return {
        heroId: text,
        heroIndex: match && Number.isInteger(Number(match.heroIndex)) ? Number(match.heroIndex) : -1,
        heroName: match ? String(match.baseHeroName || match.name || "") : "",
        actorUID: match ? Number(match.uid || 0) : 0
      };
    }
    if (text.startsWith("hero_instance:")) {
      const key = text.slice(14);
      const match = heroes.find((hero) => String(hero.heroInstanceKey || "").trim().toLowerCase() === key) || null;
      return {
        heroId: text,
        heroIndex: match && Number.isInteger(Number(match.heroIndex)) ? Number(match.heroIndex) : -1,
        heroName: match ? String(match.baseHeroName || match.name || "") : "",
        actorUID: match ? Number(match.uid || 0) : 0
      };
    }
    if (text.startsWith("hero:")) {
      const idx = Number(text.slice(5));
      const match = heroes.find((hero) => Number(hero.heroIndex) === idx) || null;
      return {
        heroId: text,
        heroIndex: Number.isInteger(idx) ? idx : -1,
        heroName: match ? String(match.baseHeroName || match.name || "") : "",
        actorUID: match ? Number(match.uid || 0) : 0
      };
    }
    if (text.startsWith("hero_name:")) {
      const key = text.slice(10);
      const match = heroes.find((hero) => String(hero.baseHeroName || hero.name || "").trim().toLowerCase() === key) || null;
      return {
        heroId: text,
        heroIndex: match && Number.isInteger(Number(match.heroIndex)) ? Number(match.heroIndex) : -1,
        heroName: match ? String(match.baseHeroName || match.name || "") : key,
        actorUID: match ? Number(match.uid || 0) : 0
      };
    }
    return { heroId: "", heroIndex: -1, heroName: "", actorUID: 0 };
  };
  if (heroRef && typeof heroRef === "object") {
    const byActor = fromActor(heroRef);
    if (byActor.heroId) return byActor;
  }
  if (typeof heroRef === "string") {
    const text = heroRef.trim();
    const byStableId = fromStableId(text);
    if (byStableId.heroId) return byStableId;
    const byName = heroes.find((hero) => String(hero.baseHeroName || hero.name || "").trim().toLowerCase() === text.toLowerCase());
    if (byName) return fromActor(byName);
  }
  const numeric = Number(heroRef);
  if (Number.isFinite(numeric) && numeric > 0) {
    const byUID = heroes.find((hero) => Number(hero.uid || 0) === numeric);
    if (byUID) return fromActor(byUID);
    const byIndex = heroes.find((hero) => Number(hero.heroIndex) === numeric);
    if (byIndex) return fromActor(byIndex);
  }
  return { heroId: "", heroIndex: -1, heroName: "", actorUID: 0 };
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
  if (!g.HeroSkillPointsByHeroId || typeof g.HeroSkillPointsByHeroId !== "object") {
    g.HeroSkillPointsByHeroId = {};
  }
  const store = g.HeroSkillPointsByHeroId;
  if (!Array.isArray(g.HeroSkillPointLedger)) g.HeroSkillPointLedger = [];
  if (!Number.isFinite(g.HeroSkillPointLedgerSeq)) g.HeroSkillPointLedgerSeq = 0;
  const legacyStore = g.HeroSkillPointsByUID && typeof g.HeroSkillPointsByUID === "object" ? g.HeroSkillPointsByUID : {};
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
  if (!Number.isFinite(Number(store[HERO_SKILL_SHARED_KEY]))) {
    const candidates = Object.entries(store).filter(([key]) => key !== HERO_SKILL_SHARED_KEY).map(([, rawValue]) => Math.max(0, Math.floor(Number(rawValue || 0)))).filter((value) => Number.isFinite(value));
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
  const ledger = Array.isArray(g.HeroSkillPointLedger) ? g.HeroSkillPointLedger : g.HeroSkillPointLedger = [];
  ledger.push(entry);
  if (ledger.length > 240) ledger.shift();
}
function appendHeroSkillPointRewardTrace(g, entry) {
  const trace = Array.isArray(g.HeroSkillPointRewardTrace) ? g.HeroSkillPointRewardTrace : g.HeroSkillPointRewardTrace = [];
  trace.push(entry);
  if (trace.length > 120) trace.shift();
}
function buildHeroSkillPointTxn(g, identity, source, delta, balanceAfter, kind, status, reason = "") {
  return {
    seq: nextHeroSkillLedgerSeq(g),
    who: String(identity && identity.heroId || ""),
    heroId: String(identity && identity.heroId || ""),
    heroIndex: Number((identity && identity.heroIndex) ?? -1),
    heroName: String(identity && identity.heroName || ""),
    actorUID: Number(identity && identity.actorUID || 0),
    source: String(source || "unknown"),
    delta: Number(delta || 0),
    balanceAfter: Number(balanceAfter || 0),
    kind: String(kind || "unknown"),
    status: String(status || "unknown"),
    reason: String(reason || ""),
    time: Number(g.time || 0),
    turn: Number(g.DebugTurnCount || 0),
    turnSerial: Number(g.TurnSerial || 0)
  };
}
function GrantHeroSkillPoints(ctx, heroUID, amount, source = "unspecified") {
  const g = getGlobals(ctx);
  const delta = Math.floor(Number(amount || 0));
  const store = ensureHeroSkillPointStore(ctx);
  const identity = resolveHeroSkillPointIdentity(ctx, heroUID);
  if (!identity.heroId) {
    const tx2 = buildHeroSkillPointTxn(g, identity, source, delta, 0, "grant", "rejected", "hero_not_found");
    appendHeroSkillPointTxn(g, tx2);
    return { ok: false, reason: "hero_not_found", tx: tx2 };
  }
  if (!Number.isFinite(delta) || delta <= 0) {
    const tx2 = buildHeroSkillPointTxn(g, identity, source, delta, Number(store[HERO_SKILL_SHARED_KEY] || 0), "grant", "rejected", "invalid_amount");
    appendHeroSkillPointTxn(g, tx2);
    return { ok: false, reason: "invalid_amount", tx: tx2 };
  }
  const current = Number(store[HERO_SKILL_SHARED_KEY] || 0);
  const next = current + delta;
  store[HERO_SKILL_SHARED_KEY] = next;
  syncHeroSkillPointLegacyUidView(ctx, store);
  const tx = buildHeroSkillPointTxn(g, identity, source, delta, next, "grant", "applied");
  appendHeroSkillPointTxn(g, tx);
  return { ok: true, balance: next, tx };
}
function GrantHeroSkillPointsToParty(ctx, amountEach, source = "party_reward") {
  const g = getGlobals(ctx);
  const store = ensureHeroSkillPointStore(ctx);
  const heroes = getAllHeroActors(ctx).slice().sort((a, b) => Number(a.heroIndex || 0) - Number(b.heroIndex || 0));
  const primaryUID = Number(heroes[0] && heroes[0].uid || 0);
  const primaryGrant = primaryUID > 0 ? GrantHeroSkillPoints(ctx, primaryUID, amountEach, source) : { ok: false, tx: null };
  const sharedBalance = Number(store[HERO_SKILL_SHARED_KEY] || 0);
  const results = heroes.map((hero) => {
    const identity = resolveHeroSkillPointIdentity(ctx, hero.uid);
    return {
      ok: !!primaryGrant.ok,
      balance: sharedBalance,
      heroId: String(identity.heroId || ""),
      heroIndex: Number(identity.heroIndex ?? -1),
      heroName: String(identity.heroName || ""),
      actorUID: Number(identity.actorUID || 0),
      tx: primaryGrant.tx ? { ...primaryGrant.tx } : null
    };
  });
  const entry = {
    kind: "party_grant",
    source: String(source || "party_reward"),
    amountEach: Math.floor(Number(amountEach || 0)),
    grantsApplied: results.filter((row) => row.ok).length,
    heroIds: results.map((row) => row.heroId),
    actorUIDs: results.map((row) => row.actorUID),
    time: Number(g.time || 0),
    turn: Number(g.DebugTurnCount || 0),
    turnSerial: Number(g.TurnSerial || 0),
    results: results.map((row) => ({
      ok: row.ok,
      balance: row.balance,
      heroId: row.heroId,
      heroIndex: row.heroIndex,
      heroName: row.heroName,
      actorUID: row.actorUID
    }))
  };
  appendHeroSkillPointRewardTrace(g, entry);
  return { ok: results.every((row) => row.ok), entry, results };
}
function GrantTowerSkillPoints(ctx, amountEach = 1, source = "tower_takedown") {
  return GrantHeroSkillPointsToParty(ctx, amountEach, source);
}
function GrantBoPSkillPoints(ctx, amountEach = 1, source = "bop_reward") {
  return GrantHeroSkillPointsToParty(ctx, amountEach, source);
}
function ensureTokenWallet(ctx) {
  const g = getGlobals(ctx);
  if (!g.TokenWallet || typeof g.TokenWallet !== "object") g.TokenWallet = {};
  return g.TokenWallet;
}
function parseDropId(dropId) {
  if (!dropId || dropId === EMPTY) return { type: "EMPTY", id: null };
  const raw = String(dropId);
  const parts = raw.split(".");
  if (parts.length === 2) return { type: parts[0], id: parts[1] };
  return { type: "UNKNOWN", id: raw };
}
function getMonsterIdByName(name) {
  if (!name) return -1;
  return MONSTER_KEYS.findIndex((k) => k === name);
}
function getActiveEventByToken(tokenId) {
  if (!tokenId) return null;
  const active = new Set(ACTIVE_EVENT_IDS || []);
  return (LIVE_OPS_EVENTS || []).find((e) => e.token_id === tokenId && active.has(e.id)) || null;
}
function getOrCreateEventProgress(ctx, eventId) {
  const g = getGlobals(ctx);
  if (!g.LiveOpsProgress || typeof g.LiveOpsProgress !== "object") g.LiveOpsProgress = {};
  if (!g.LiveOpsProgress[eventId]) {
    g.LiveOpsProgress[eventId] = {
      tierIndex: 0,
      tierProgress: 0,
      milestoneIndex: 0,
      totalSpent: 0
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
const TH_DROP_BRACKET_THRESHOLDS = [
  { bracket: 1, threshold: 2400 },
  { bracket: 2, threshold: 1500 },
  { bracket: 3, threshold: 1e3 },
  { bracket: 4, threshold: 500 },
  { bracket: 5, threshold: 100 },
  { bracket: 6, threshold: 50 },
  { bracket: 7, threshold: 0 }
];
const DEFAULT_TREASURE_HUNTER_TABLE = [
  [5e3, 2400, 1500, 1e3, 500, 100, 50],
  [5200, 2550, 1600, 1080, 550, 120, 60],
  [5350, 2700, 1700, 1160, 600, 140, 70],
  [5500, 2850, 1800, 1240, 650, 160, 80],
  [5650, 3e3, 1900, 1320, 700, 180, 90],
  [5800, 3150, 2e3, 1400, 750, 200, 100],
  [5950, 3300, 2100, 1480, 800, 220, 110],
  [6100, 3450, 2200, 1560, 850, 240, 120],
  [6250, 3600, 2300, 1640, 900, 260, 130],
  [6400, 3750, 2400, 1720, 950, 280, 140],
  [6550, 3900, 2500, 1800, 1e3, 300, 150],
  [6700, 4050, 2600, 1880, 1050, 320, 160],
  [6850, 4200, 2700, 1960, 1100, 340, 170],
  [7e3, 4350, 2800, 2040, 1150, 360, 180],
  [7150, 4500, 2900, 2120, 1200, 380, 190]
];
function sanitizeInt(input, fallback = 0) {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}
function getDropBracket(dropRate) {
  for (const row of TH_DROP_BRACKET_THRESHOLDS) {
    if (dropRate >= row.threshold) return row.bracket;
  }
  return 7;
}
function getDropRate(thLevel, dropRate) {
  const tier = clamp(0, sanitizeInt(thLevel, 0), 14);
  const sanitizedDropRate = clamp(0, sanitizeInt(dropRate, 0), 1e4);
  if (sanitizedDropRate === 1e4) return 1e4;
  if (sanitizedDropRate === 0) return 0;
  const bracket = getDropBracket(sanitizedDropRate);
  const row = DEFAULT_TREASURE_HUNTER_TABLE[tier];
  const entry = row ? row[bracket - 1] : null;
  if (!Number.isFinite(entry)) {
    console.warn(`[TH_DROP_RATE] Missing table entry for tier=${tier} bracket=${bracket}; using sanitized input.`);
    return sanitizedDropRate;
  }
  return clamp(0, sanitizeInt(entry, sanitizedDropRate), 1e4);
}
function getDropRateBracket(dropRate) {
  const sanitizedDropRate = clamp(0, sanitizeInt(dropRate, 0), 1e4);
  return getDropBracket(sanitizedDropRate);
}
function applyRewardPayload(ctx, payload) {
  if (!payload || !payload.type) return;
  const g = getGlobals(ctx);
  if (payload.type === "SKILL_POINTS_PARTY") {
    const amountEach = payload.amountEach ?? payload.amount ?? 0;
    GrantHeroSkillPointsToParty(ctx, amountEach, payload.source || "event_skill_points_party");
    return;
  }
  if (payload.type === "SKILL_POINTS_TOWER") {
    const amountEach = payload.amountEach ?? payload.amount ?? 1;
    GrantTowerSkillPoints(ctx, amountEach, payload.source || "tower_takedown");
    return;
  }
  if (payload.type === "SKILL_POINTS_BOP") {
    const amountEach = payload.amountEach ?? payload.amount ?? 1;
    GrantBoPSkillPoints(ctx, amountEach, payload.source || "bop_reward");
    return;
  }
  if (payload.type === "HEAL_RANDOM") {
    const amt = Math.max(1, Math.floor(random01(ctx) * 40) + 1);
    ctx.callFunction("ApplyActiveHeroHeal", amt);
    LogCombat(ctx, `Event reward: +${amt} HP`);
    return;
  }
  if (payload.type === "ENERGY_RANDOM") {
    const options = [10, 20, 30, 40];
    const amt = options[randomIndex(ctx, options.length)];
    const next = (g.Player_Energy || 0) + amt;
    g.Player_Energy = next;
    LogCombat(ctx, `Event reward: +${amt} Energy`);
    return;
  }
  if (payload.type === "GOLD_RANDOM") {
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
function getDeployedHeroes(ctx) {
  return getEntities(ctx).filter((entity) => entity && entity.kind === "hero");
}
function getEnemies(ctx) {
  return getEntities(ctx).filter((e) => e && e.kind === "enemy" && (e.hp ?? 0) > 0 && e.streamState !== "approaching");
}
function nextUID(ctx) {
  const g = getGlobals(ctx);
  g.NextUID = (g.NextUID || 1) + 1;
  return g.NextUID;
}
function logLine(ctx, text) {
  const g = getGlobals(ctx);
  g.CombatLog = g.CombatLog || [];
  if (text) g.CombatLog.push(String(text));
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
    const curUID = 0;
    const curActor = GetActorByUID(ctx, curUID);
    if (curActor && curActor.name) return curActor.name;
  }
  if (typeof uid === "number") {
    const hero = getDeployedHeroes(ctx).find((h) => h.heroIndex === uid);
    if (hero && hero.name) return hero.name;
  }
  return "?";
}
function SlotX(ctx, i) {
  const g = getGlobals(ctx);
  const slots = g.Slots || 0;
  const center = Math.floor(slots / 2);
  let offset = 0;
  if (i === center) {
    offset = -Math.round((g.EnemySize || 0) / 2);
  }
  return (g.X0 || 0) + offset;
}
function SlotY(ctx, i) {
  const g = getGlobals(ctx);
  return (g.EnemyAreaY0 || 0) + i * (g.Spacing || 0);
}
function GetActorByUID(ctx, uid) {
  return getEntities(ctx).find((a) => a && a.uid === uid) || null;
}
function UpdateEnemyHPUI(ctx) {
  const g = getGlobals(ctx);
  g.EnemyHPByIndex = getEnemies(ctx).map((e) => e.hp ?? 0);
  g.EnemyMaxHPByIndex = getEnemies(ctx).map((e) => e.maxHP ?? 0);
}
function UpdateHeroHPUI(ctx) {
  syncPartyHpTotalsFromHeroes(ctx);
}
function InitPartyHPFromHeroes(ctx) {
  syncPartyHpTotalsFromHeroes(ctx);
}
function UpdatePartyHPText(ctx) {
  const g = getGlobals(ctx);
  g.PartyHPText = `${g.PartyHP}/${g.PartyMaxHP}`;
}
function UpdatePartyHPBar(ctx) {
  const g = getGlobals(ctx);
  g.PartyHPBar = { max: g.PartyMaxHP, value: g.PartyHP };
}
function Sub_Energy(ctx, amount = 3) {
  const g = getGlobals(ctx);
  if (Number(g.MatchedColorValue || -1) === 3) {
    applyTurnGateIntent(g, createYellowSafetyNet, {
      now: Number(g.time || 0),
      currentTurnUID: Number(0)
    });
  }
}
function Add_Energy(ctx) {
  const g = getGlobals(ctx);
  const roll = random01(ctx);
  let add = 3;
  if (roll < 0.65) add = 3;
  else if (roll < 0.85) add = 6;
  else if (roll < 0.95) add = 9;
  else add = 15;
  g.Player_Energy = (g.Player_Energy || 0) + add;
  const actorName = getActorNameByUID(ctx, 0);
  LogCombat(ctx, `${actorName} grabbed ${add} magic orbs!`);
}
function AddGoldToPlayer(ctx, amt) {
  const g = getGlobals(ctx);
  const min = 3;
  const max = Math.max(min, Math.floor(amt != null ? amt : 30));
  const cap = Math.min(30, max);
  const curve = Math.max(1, g.GoldDropCurve ?? 2);
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
  const actorName = getActorNameByUID(ctx, 0);
  LogCombat(ctx, `${actorName} found ${finalAmount} gold!`);
}
function SpawnEnemy(ctx, enemyData, slotIndex = 0) {
  if (!enemyData) return null;
  const g = getGlobals(ctx);
  const uid = nextUID(ctx);
  const enemy = {
    uid,
    kind: "enemy",
    name: enemyData.name || `Enemy_${uid}`,
    expValue: enemyData.expValue ?? enemyData.EXP,
    hp: Number(enemyData.HP ?? 0),
    maxHP: Number(enemyData.HP ?? enemyData.maxHP ?? 0),
    combatPower: computeCombatPowerFromStats(
      enemyData.ATK,
      enemyData.DEF,
      enemyData.HP ?? enemyData.maxHP,
      enemyData.MAG,
      enemyData.RES,
      enemyData.SPD,
      enemyData.level ?? enemyData.currentLevel
    ),
    stats: {
      ATK: Number(enemyData.ATK ?? 0),
      DEF: Number(enemyData.DEF ?? 0),
      MAG: Number(enemyData.MAG ?? 0),
      RES: Number(enemyData.RES ?? 0),
      SPD: Number(enemyData.SPD ?? 0)
    },
    faction: String(enemyData.faction || "wishless"),
    enemyRole: String(enemyData.enemyRole || enemyData.role || "fodder"),
    combatTier: String(enemyData.combatTier || enemyData.routineTier || "routine"),
    attackPattern: enemyData.attackPattern && typeof enemyData.attackPattern === "object" ? { ...enemyData.attackPattern } : void 0,
    targetPreference: enemyData.targetPreference || enemyData.targetingPreference || enemyData.targetingPolicy || enemyData.targetPolicy || "",
    localeTags: normalizeLocaleTags(enemyData.localeTags || enemyData.locale || enemyData.biomes || enemyData.biome || "all"),
    slotIndex,
    originX: SlotX(ctx, slotIndex),
    originY: SlotY(ctx, slotIndex),
    x: SlotX(ctx, slotIndex),
    y: SlotY(ctx, slotIndex),
    isAlive: true
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
  return enemy;
}
function Add_Gold(ctx, amt) {
  AddGoldToPlayer(ctx, amt);
}
function AddToken(ctx, tokenId, amount = 1) {
  if (!tokenId) return 0;
  const wallet = ensureTokenWallet(ctx);
  const key = String(tokenId);
  const next = (wallet[key] || 0) + (Number(amount) || 0);
  wallet[key] = Math.max(0, next);
  return wallet[key];
}
function SpendToken(ctx, tokenId, amount = 1) {
  if (!tokenId) return false;
  const wallet = ensureTokenWallet(ctx);
  const key = String(tokenId);
  const current = wallet[key] || 0;
  if (current < amount) return false;
  wallet[key] = current - amount;
  return true;
}
function GetTokenBalance(ctx, tokenId) {
  if (!tokenId) return 0;
  const wallet = ensureTokenWallet(ctx);
  return wallet[String(tokenId)] || 0;
}
function ResolveMonsterDrop(ctx, monsterName, tierIndex = null) {
  const monsterId = getMonsterIdByName(monsterName);
  if (monsterId < 0) return EMPTY;
  const tiers = MONSTER_LOOT_TABLE[monsterId] || [];
  const idx = tierIndex == null ? pickDropTier(ctx) : Math.max(0, Math.min(3, Math.floor(tierIndex)));
  return tiers[idx] ?? EMPTY;
}
const HUUN_EXECUTION_NAME = "Huun";
const HUUN_EXECUTION_TH_BONUS = 2;
function resolveHuunExecutionDropBonusLevel(ctx, killerUID) {
  const killer = GetActorByUID(ctx, killerUID);
  if (!killer || killer.kind !== "hero") return 0;
  if (String(killer.name || "") !== HUUN_EXECUTION_NAME) return 0;
  return HUUN_EXECUTION_TH_BONUS;
}
function AwardMonsterDrop(ctx, monsterName, tierIndex = null, killerUID = 0) {
  const g = getGlobals(ctx);
  const baseThLevel = Number(g.TreasureHunterLevel ?? g.THLevel ?? g.DebugTHLevel ?? 0);
  const huunBonusLevel = resolveHuunExecutionDropBonusLevel(ctx, killerUID);
  const thLevel = baseThLevel + huunBonusLevel;
  const baseDropRate = Number(g.LootDropRateBps ?? g.DropRateBps ?? 1e4);
  const transformedDropRate = getDropRate(thLevel, baseDropRate);
  g.LastHuunExecutionDropBonus = {
    killerUID: Number(killerUID || 0),
    baseThLevel: Number(baseThLevel || 0),
    bonusLevel: Number(huunBonusLevel || 0),
    effectiveThLevel: Number(thLevel || 0),
    transformedDropRate: Number(transformedDropRate || 0),
    monsterName: String(monsterName || "")
  };
  const rollsPerDeath = 4;
  const awarded = [];
  for (let i = 0; i < rollsPerDeath; i++) {
    const roll = Math.floor(Math.random() * 1e4);
    if (roll >= transformedDropRate) {
      awarded.push("EMPTY");
      continue;
    }
    const dropId = ResolveMonsterDrop(ctx, monsterName, tierIndex);
    const parsed = parseDropId(dropId);
    if (parsed.type === "TOKEN") {
      const registry = TOKEN_REGISTRY[parsed.id];
      const activeEvent = getActiveEventByToken(parsed.id);
      if (!activeEvent && registry && registry.fallback && registry.fallback !== EMPTY) {
        const fallbackParsed = parseDropId(registry.fallback);
        if (fallbackParsed.type === "TOKEN") {
          AddToken(ctx, fallbackParsed.id, 1);
          LogCombat(ctx, `Token drop (fallback): ${fallbackParsed.id}`);
          awarded.push(fallbackParsed.id);
          continue;
        }
        if (registry.fallback === EMPTY) {
          awarded.push("EMPTY");
          continue;
        }
      }
      AddToken(ctx, parsed.id, 1);
      LogCombat(ctx, `Token drop: ${parsed.id}`);
      awarded.push(parsed.id);
    } else if (parsed.type === "ITEM") {
      LogCombat(ctx, `Item drop: ${parsed.id}`);
      awarded.push(parsed.id);
    } else {
      awarded.push("EMPTY");
    }
  }
  const resolved = awarded.find((entry) => entry && entry !== "EMPTY") || EMPTY;
  const trace = {
    thLevel,
    baseDropRate,
    transformedDropRate,
    awarded: awarded.slice(),
    resolved
  };
  g.LastLootSlotTrace = [trace];
  g.LastLootGateTrace = trace;
  console.log(`[LOOT_TRACE] ${monsterName} ${JSON.stringify(trace)}`);
  console.log(`[LOOT] Monster ${monsterName} awarded: ${resolved}`);
  return resolved;
}
function SpendTokensOnEvent(ctx, eventId, amount) {
  if (!eventId || !amount) return false;
  const event = (LIVE_OPS_EVENTS || []).find((e) => e.id === eventId);
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
function LogCombat(ctx, text) {
  const g = getGlobals(ctx);
  const value = String(text || "");
  if (!value) return;
  const now = Number(g.time || 0);
  const pinnedLine = typeof g.CombatActionPinnedLine === "string" ? g.CombatActionPinnedLine : "";
  const pinUntil = Number(g.CombatActionPinnedUntil || 0);
  if (pinUntil > now && pinnedLine && value !== pinnedLine) {
    logLine(ctx, value);
    return;
  }
  const lines = g.CombatActionLines || ["", "", "", ""];
  lines[0] = lines[1];
  lines[1] = lines[2];
  lines[2] = lines[3];
  lines[3] = value;
  g.CombatActionLines = lines;
  if (/ gained Astral Flow!$/.test(value)) {
    g.CombatActionPinnedLine = String(value || "");
    g.CombatActionPinnedUntil = Math.max(pinUntil, now + 4);
  } else if (pinUntil <= now) {
    g.CombatActionPinnedLine = "";
    g.CombatActionPinnedUntil = 0;
  }
  logLine(ctx, value);
}
const ENEMY_GEM_LOCK_DURATIONS = /* @__PURE__ */ Object.freeze({
  Enemy_Scathe: 3,
  Enemy_Sweep: 5
});
const ENEMY_GEM_LOCK_TARGET_COLORS = /* @__PURE__ */ Object.freeze({
  Enemy_Scathe: 2,
  Enemy_Sweep: 4
});
const ENEMY_BOARD_PRESSURE_SKILL_HARNESSES = /* @__PURE__ */ Object.freeze({
  Enemy_Scathe: /* @__PURE__ */ Object.freeze({
    skillId: "Enemy_Scathe",
    axis: "column",
    label: "Scathe",
    duration: ENEMY_GEM_LOCK_DURATIONS.Enemy_Scathe,
    maxLocks: 1,
    targetColor: ENEMY_GEM_LOCK_TARGET_COLORS.Enemy_Scathe,
    logSuffix: "from a column."
  }),
  Enemy_Sweep: /* @__PURE__ */ Object.freeze({
    skillId: "Enemy_Sweep",
    axis: "row",
    label: "Sweep",
    duration: ENEMY_GEM_LOCK_DURATIONS.Enemy_Sweep,
    maxLocks: 2,
    targetColor: ENEMY_GEM_LOCK_TARGET_COLORS.Enemy_Sweep,
    logSuffix: "from a row."
  })
});
function SettleContinuousCombatRewards(ctx) {
  return settleContinuousCombatRewards(ctx);
}
export {
  AddGoldToPlayer,
  AddToken,
  Add_Energy,
  Add_Gold,
  AwardMonsterDrop,
  GetActorByUID,
  GetTokenBalance,
  InitPartyHPFromHeroes,
  LogCombat,
  ResolveMonsterDrop,
  SettleContinuousCombatRewards,
  SlotX,
  SlotY,
  SpawnEnemy,
  SpendToken,
  SpendTokensOnEvent,
  Sub_Energy,
  UpdateEnemyHPUI,
  UpdateHeroHPUI,
  UpdatePartyHPBar,
  UpdatePartyHPText,
  getDropRate,
  getDropRateBracket
};
