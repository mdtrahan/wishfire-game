import { resetCombatSessionConditions } from './combatSessionReset.mjs';
import { CANONICAL_HERO_ROSTER } from '../state/heroScreenConfig.js';
import {
  DEV_TOOL_EMPTY_SLOT,
  DEV_TOOL_RANDOM_ENEMY_SLOT,
} from './devToolingRuntime.js';
import * as runtimeDebugLogging from './runtimeDebugLogging.js';

function createDefaultSeededRng(seed = 1) {
  let state = Number(seed || 1) >>> 0;
  if (!state) state = 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function defaultComputeCombatPower(atk, def, hp) {
  const a = Number(atk || 0);
  const d = Number(def || 0);
  const h = Number(hp || 0);
  return Math.round((a + d + (h / 10)) * 100) / 100;
}

export function resolveEnemyEncounterCombatPower(row, computeCombatPower = defaultComputeCombatPower) {
  const explicit = Number(row?.EncounterCP ?? row?.encounterCP ?? row?.CombatPower ?? row?.combatPower);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit * 100) / 100;
  return computeCombatPower(row?.ATK, row?.DEF, row?.HP);
}

export function normalizeBiomeTags(input) {
  if (Array.isArray(input)) {
    const tags = input.map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
    return tags.length ? tags : ['all'];
  }
  const raw = String(input ?? '').trim();
  if (!raw) return ['all'];
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeBiomeTags(parsed);
    } catch (_) {
      // no-op: fall through to delimited parsing
    }
  }
  const tags = raw
    .split('|')
    .flatMap(part => String(part).split(','))
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean);
  return tags.length ? tags : ['all'];
}

export function normalizeEnemyRole(input) {
  const role = String(input || '').trim().toLowerCase();
  if (role === 'commander' || role === 'bodyguard' || role === 'fodder') return role;
  return 'fodder';
}

export function normalizeFaction(input) {
  const faction = String(input || '').trim().toLowerCase();
  if (faction === 'wishless' || faction === 'dreamless' || faction === 'hopeless') return faction;
  return 'wishless';
}

export function generateEncounterSeed() {
  const now = Date.now() >>> 0;
  const perfNow = Math.floor(((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) * 1000) >>> 0;
  const rand = Math.floor(Math.random() * 0x7fffffff) >>> 0;
  const mixed = (now ^ perfNow ^ rand) >>> 0;
  return mixed || 1;
}

export function computeEncounterTotalCP(picks) {
  return (picks || []).reduce((sum, row) => sum + Number(row?.CombatPower || row?.combatPower || 0), 0);
}

export function buildEncounterSpawnPlan(picks, { policy = 'mixed' } = {}) {
  const rows = Array.isArray(picks) ? picks.filter(Boolean) : [];
  if (!rows.length) return [];
  const isSoloCommander = String(policy || '').trim().toLowerCase() === 'solo_commander';
  if (isSoloCommander) {
    const commanderRows = rows.filter((row) => normalizeEnemyRole(row?.enemyRole || row?.role) === 'commander');
    const soloPool = commanderRows.length ? commanderRows : rows;
    const pick = soloPool[Math.floor(Math.random() * soloPool.length)];
    return [{ row: pick, slotIndex: 1 }];
  }

  const pool = [...rows];
  const selected = [];
  while (selected.length < Math.min(3, rows.length) && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    selected.push(pool[idx]);
    pool.splice(idx, 1);
  }
  if (!selected.length) return [];
  const getCP = (row) => Number(row?.CombatPower || row?.combatPower || 0);
  let strongestIdx = 0;
  for (let i = 1; i < selected.length; i += 1) {
    if (getCP(selected[i]) > getCP(selected[strongestIdx])) strongestIdx = i;
  }
  const strongest = selected[strongestIdx];
  const sideRows = selected.filter((_, idx) => idx !== strongestIdx);
  if (sideRows.length > 1 && Math.random() < 0.5) sideRows.reverse();

  const plan = [{ row: strongest, slotIndex: 1 }];
  if (sideRows[0]) plan.push({ row: sideRows[0], slotIndex: 0 });
  if (sideRows[1]) plan.push({ row: sideRows[1], slotIndex: 2 });
  return plan;
}

export function buildForcedEnemySpawnPlan(row, count) {
  if (!row) return [];
  const total = Math.max(0, Math.min(3, Math.floor(Number(count || 0))));
  if (!total) return [];
  const slotOrder = [1, 0, 2];
  const plan = [];
  for (let i = 0; i < total; i += 1) {
    plan.push({ row, slotIndex: slotOrder[i] });
  }
  return plan;
}

export function deriveEncounterPoolNames({ pool, locale = 'all', faction = '' } = {}) {
  const candidates = Array.isArray(pool) ? pool : [];
  const normalizedLocale = String(locale || 'all').trim().toLowerCase() || 'all';
  const rawFactionFilter = String(faction || '').trim().toLowerCase();
  const normalizedFaction = rawFactionFilter ? normalizeFaction(rawFactionFilter) : '';
  return candidates
    .filter((row) => {
      const tags = normalizeBiomeTags(row?.localeTags || row?.locale || row?.biome || 'all');
      const localeOk = normalizedLocale === 'all' || tags.includes('all') || tags.includes(normalizedLocale);
      if (!localeOk) return false;
      if (!normalizedFaction) return true;
      return normalizeFaction(row?.faction) === normalizedFaction;
    })
    .map((row) => String(row?.name || '').trim())
    .filter(Boolean);
}

export function buildEncounterByBudget({
  pool,
  targetCP,
  locale = 'all',
  maxSlots = 3,
  policy = 'mixed',
  seed = 1,
  faction = '',
  historyCounts = null,
  createSeededRng = createDefaultSeededRng,
} = {}) {
  const candidates = Array.isArray(pool) ? pool : [];
  const normalizedLocale = String(locale || 'all').trim().toLowerCase() || 'all';
  const rawFactionFilter = String(faction || '').trim().toLowerCase();
  const normalizedFaction = rawFactionFilter ? normalizeFaction(rawFactionFilter) : '';
  const rng = createSeededRng(seed);
  const reasonCodes = [];
  const eligibleNames = new Set(deriveEncounterPoolNames({ pool: candidates, locale: normalizedLocale, faction: normalizedFaction }));
  const eligible = candidates.filter((row) => eligibleNames.has(String(row?.name || '').trim()));
  if (!eligible.length) {
    return { selected: [], finalCP: 0, targetCP: Number(targetCP || 0), deltaCP: Number(targetCP || 0), slotsUsed: 0, underfilled: true, reasonCodes: ['no_locale_candidates'] };
  }

  const slots = Math.max(1, Number(maxSlots || 3));
  const target = Math.max(0, Number(targetCP || 0));
  const selected = [];
  const usedNames = new Set();
  const byRole = {
    commander: eligible.filter(e => normalizeEnemyRole(e?.enemyRole || e?.role) === 'commander'),
    bodyguard: eligible.filter(e => normalizeEnemyRole(e?.enemyRole || e?.role) === 'bodyguard'),
    fodder: eligible.filter(e => normalizeEnemyRole(e?.enemyRole || e?.role) === 'fodder'),
  };

  const pickBest = (source, remainingTarget, capName = '') => {
    const arr = (source || []).filter(row => row && !usedNames.has(String(row.name || '')));
    if (!arr.length) return null;
    const getSeen = (row) => Number(historyCounts && historyCounts[String(row?.name || '')] || 0);
    const hasHistory = !!(historyCounts && typeof historyCounts === 'object');
    let working = arr;
    if (hasHistory) {
      let minSeen = Infinity;
      for (const row of arr) minSeen = Math.min(minSeen, getSeen(row));
      const lowestSeenPool = arr.filter(row => getSeen(row) === minSeen);
      if (lowestSeenPool.length) working = lowestSeenPool;
    }
    const ranked = working
      .map((row) => {
        const cp = Number(row?.CombatPower || row?.combatPower || 0);
        const diff = Math.abs(remainingTarget - cp);
        return { row, diff };
      })
      .sort((a, b) => a.diff - b.diff);
    const topK = ranked.slice(0, Math.max(1, Math.min(6, ranked.length)));
    const rollPool = topK.length ? topK : ranked;
    const pickIndex = Math.floor(rng() * rollPool.length);
    const best = rollPool[Math.max(0, Math.min(rollPool.length - 1, pickIndex))].row;
    if (capName) reasonCodes.push(`picked_${capName}`);
    return best;
  };

  const pushPick = (row) => {
    if (!row || selected.length >= slots) return;
    selected.push(row);
    usedNames.add(String(row.name || ''));
  };

  const normalizedPolicy = String(policy || 'mixed').trim().toLowerCase();
  if (normalizedPolicy === 'solo_commander') {
    const commander = pickBest(byRole.commander, target, 'commander');
    if (commander) {
      pushPick(commander);
    } else {
      reasonCodes.push('no_commander_for_solo_policy');
      pushPick(pickBest(eligible, target, 'fallback_any'));
    }
  } else if (normalizedPolicy === 'fodder_only') {
    while (selected.length < slots) {
      const remaining = target - computeEncounterTotalCP(selected);
      const fodder = pickBest(byRole.fodder, remaining, 'fodder');
      if (!fodder) break;
      pushPick(fodder);
    }
  } else {
    while (selected.length < slots) {
      const remaining = target - computeEncounterTotalCP(selected);
      let pick = pickBest(eligible, remaining, 'mixed_any');
      if (!pick) pick = pickBest(byRole.fodder, remaining, 'fodder');
      if (!pick) pick = pickBest(byRole.bodyguard, remaining, 'bodyguard');
      if (!pick) pick = pickBest(byRole.commander, remaining, 'commander');
      if (!pick) pick = pickBest(eligible, remaining, 'fallback_any');
      if (!pick) break;
      pushPick(pick);
    }
  }

  const finalCP = computeEncounterTotalCP(selected);
  const underfilled = selected.length < slots || finalCP < target;
  if (selected.length < slots) reasonCodes.push('underfilled_slots');
  if (finalCP < target) reasonCodes.push('underfilled_cp');
  return {
    selected,
    finalCP,
    targetCP: target,
    deltaCP: target - finalCP,
    slotsUsed: selected.length,
    underfilled,
    reasonCodes,
  };
}

export function createCombatSessionInitializer({
  state,
  gameState,
  fnContext,
  callFunctionWithContext,
  assertCombatLayoutDev,
  computeCombatPower,
  createSeededRng,
  resetBootstrapRngSession,
  generateEncounterSeed: generateEncounterSeedFn = generateEncounterSeed,
  deriveCombatRuntimeRngSeed,
  installCombatRuntimeRandom,
  getConfiguredHeroSlots,
  readEscortPartyConfig,
  buildConfiguredCombatPartyMembers,
  getConfiguredEnemySlots,
  syncFromGlobals,
}) {
  return function initCombatSessionEntities(enemyRows) {
    assertCombatLayoutDev('initEntities');
    resetCombatSessionConditions(state.globals, gameState);
    state.entities = [];
    state.globals.EnemyData = (enemyRows || []).map((row) => ({
      ...row,
      faction: normalizeFaction(row?.faction),
      enemyRole: normalizeEnemyRole(row?.enemyRole || row?.role),
      locale: String(row?.locale || row?.biome || row?.biomes || 'all').trim().toLowerCase() || 'all',
      biome: String(row?.biome || row?.biomes || 'all').trim().toLowerCase() || 'all',
      biomeTags: normalizeBiomeTags(row?.biomes || row?.biome || 'all'),
      localeTags: normalizeBiomeTags(row?.localeTags || row?.locale_tags || row?.locale || row?.biomes || row?.biome || 'all'),
      CombatPower: resolveEnemyEncounterCombatPower(row, computeCombatPower),
    }));
    const mappedEnemyData = state.globals.EnemyData;
    state.globals.DevToolEnemyCatalog = [...new Set(state.globals.EnemyData.map((row) => String(row?.name || row?.EnemyName || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    state.globals.CombatSessionId = Number(state.globals.CombatSessionId || 0) + 1;
    callFunctionWithContext(fnContext, 'ClearSessionSkillDraught');
    resetBootstrapRngSession();

    const partyHP = [];
    const partyMaxHP = [];
    const configuredHeroSlots = getConfiguredHeroSlots();
    const escortConfig = readEscortPartyConfig();
    const partyMembers = buildConfiguredCombatPartyMembers(configuredHeroSlots, escortConfig);
    const heroSlotRoster = partyMembers.heroMembers;
    for (let i = 0; i < CANONICAL_HERO_ROSTER.length; i += 1) {
      const v = heroSlotRoster[i];
      if (!v) {
        partyHP[i] = 0;
        partyMaxHP[i] = 0;
        continue;
      }
      let maxHP = Number(v.maxHP);
      if (!Number.isFinite(maxHP) || maxHP <= 0) maxHP = 1;
      let hp = Number(v.hp);
      if (!Number.isFinite(hp) || hp < 0) hp = maxHP;
      if (hp > maxHP) hp = maxHP;
      partyHP[i] = hp;
      partyMaxHP[i] = maxHP;
      state.entities.push({
        uid: i + 1,
        kind: 'hero',
        name: v.instanceName,
        baseHeroName: v.baseHeroName,
        heroInstanceKey: v.heroInstanceKey,
        heroCloneOrdinal: v.cloneOrdinal,
        heroCloneLabel: v.cloneLabel,
        hp,
        maxHP: partyMaxHP[i],
        combatPower: computeCombatPower(v.ATK, v.DEF, partyMaxHP[i]),
        stats: {
          ATK: Number(v.ATK),
          DEF: Number(v.DEF),
          MAG: Number(v.MAG),
          RES: Number(v.RES),
          SPD: Number(v.SPD),
        },
        heroIndex: Number(v.canonicalIndex || 0),
        heroDisplaySlot: i,
        attackType: v.attackType,
        isAlive: true,
      });
      runtimeDebugLogging.startupDebugLog(`[HP_FIX] hero=${v.name} maxHP=${maxHP}`);
    }
    if (partyMembers.escortMember) {
      const escortUID = state.entities.reduce((max, entity) => Math.max(max, Number(entity?.uid || 0)), 0) + 1;
      const escortEntity = {
        ...partyMembers.escortMember,
        uid: escortUID,
      };
      state.entities.push(escortEntity);
      state.globals.EscortNPCState = {
        uid: escortUID,
        name: escortEntity.name,
        portraitName: escortEntity.baseHeroName,
        hp: escortEntity.hp,
        maxHP: escortEntity.maxHP,
        displaySlot: escortEntity.heroDisplaySlot,
        enabled: 1,
      };
    } else {
      delete state.globals.EscortNPCState;
    }

    gameState.partyHP = partyHP;
    gameState.partyMaxHP = partyMaxHP;
    callFunctionWithContext(fnContext, 'InitPartyHPFromHeroes');
    callFunctionWithContext(fnContext, 'SetHeroSkillPointsForParty', 300, 'ORKA-spt-seed');
    state.globals.BattleStartMode = 'heroes';
    state.globals.BattleStartResolved = 1;
    state.globals.TeamPhaseType = 0;
    state.globals.BattleStartShown = 1;
    state.globals.BattleStartClearedForSession = 0;
    const msg = 'Heroes take the initiative!';
    state.globals.BattleStartText = msg;
    state.globals.BattleStartSessionText = msg;
    state.globals.BattleStartSessionId = Number(state.globals.CombatSessionId || 0);
    state.globals.BattleStartActive = 1;
    state.globals.BattleStartProcessStarted = 0;
    state.globals.BattleStartEndsAt = 2.0;
    state.globals.BattleStartFadeEndsAt = 2.4;
    state.globals.IsPlayerBusy = 1;
    state.globals.CanPickGems = 0;
    state.globals.NextUID = state.entities.reduce((max, e) => Math.max(max, e.uid || 0), 0) + 1;

    if (enemyRows && enemyRows.length) {
      state.globals.InitialSpawn = 1;
      const rawSeed = Number(state.globals.EncounterSeed || 0);
      const explicitSeed = Number(state.globals.EncounterSeedExplicit || 0) === 1;
      const encounterSeed = (explicitSeed && Number.isFinite(rawSeed) && rawSeed > 0)
        ? rawSeed
        : generateEncounterSeedFn();
      state.globals.EncounterSeed = encounterSeed;
      state.globals.EncounterSeedExplicit = 0;
      installCombatRuntimeRandom(deriveCombatRuntimeRngSeed(encounterSeed), 'initEntities');
      const encounterRequest = {
        pool: mappedEnemyData,
        targetCP: Number(state.globals.EncounterTargetCP || 120),
        locale: String(state.globals.EncounterLocale || state.globals.CurrentLocale || 'clouds'),
        maxSlots: Number(state.globals.EncounterMaxSlots || 3),
        policy: String(state.globals.EncounterPolicy || 'mixed'),
        seed: encounterSeed,
        faction: String(state.globals.EncounterFaction || ''),
        historyCounts: (state.globals.EncounterSeenCounts && typeof state.globals.EncounterSeenCounts === 'object')
          ? state.globals.EncounterSeenCounts
          : {},
        createSeededRng,
      };
      runtimeDebugLogging.startupDebugLog(`[ENCOUNTER] seed=${encounterSeed} targetCP=${encounterRequest.targetCP} locale=${encounterRequest.locale} policy=${encounterRequest.policy}`);
      const questEnemy = gameState.storyEntry?.cards[gameState.storyEntry.activeCard]?.enemyName;
      const configuredEnemySlots = questEnemy ? [questEnemy] : getConfiguredEnemySlots();
      const hasManualEnemyLayout = configuredEnemySlots.some((value) => String(value || '').trim() !== DEV_TOOL_RANDOM_ENEMY_SLOT);
      let encounter = null;
      let spawnPlan = [];
      if (hasManualEnemyLayout) {
        const randomSlotIndexes = [];
        for (let slotIndex = 0; slotIndex < configuredEnemySlots.length; slotIndex += 1) {
          const slotValue = String(configuredEnemySlots[slotIndex] || '').trim();
          if (!slotValue) continue;
          if (slotValue === DEV_TOOL_RANDOM_ENEMY_SLOT) {
            randomSlotIndexes.push(slotIndex);
            continue;
          }
          const row = mappedEnemyData.find((entry) => String(entry?.name || entry?.EnemyName || '').trim() === slotValue);
          if (row) spawnPlan.push({ row, slotIndex });
        }
        if (randomSlotIndexes.length) {
          const randomEncounter = buildEncounterByBudget({
            ...encounterRequest,
            maxSlots: randomSlotIndexes.length,
          });
          const randomRows = randomEncounter.selected || [];
          for (let i = 0; i < Math.min(randomSlotIndexes.length, randomRows.length); i += 1) {
            spawnPlan.push({ row: randomRows[i], slotIndex: randomSlotIndexes[i] });
          }
        }
        spawnPlan.sort((a, b) => Number(a.slotIndex || 0) - Number(b.slotIndex || 0));
        encounter = {
          selected: spawnPlan.map((entry) => entry.row),
          finalCP: spawnPlan.reduce((sum, entry) => sum + Number(entry?.row?.CombatPower || entry?.row?.combatPower || 0), 0),
          targetCP: Number(encounterRequest.targetCP || 0),
          deltaCP: 0,
          slotsUsed: spawnPlan.length,
          underfilled: spawnPlan.length < configuredEnemySlots.filter((value) => String(value || '').trim() !== DEV_TOOL_EMPTY_SLOT).length,
          reasonCodes: ['manual_enemy_slots'],
        };
      } else {
        encounter = buildEncounterByBudget(encounterRequest);
        const picks = encounter.selected || [];
        spawnPlan = buildEncounterSpawnPlan(picks, { policy: encounterRequest.policy });
      }
      const picks = encounter.selected || [];
      state.globals.EncounterSummary = encounter;
      state.globals.EncounterPoolNames = hasManualEnemyLayout
        ? picks.map((pick) => String(pick?.name || '')).filter(Boolean)
        : deriveEncounterPoolNames({
            pool: mappedEnemyData,
            locale: encounterRequest.locale,
            faction: encounterRequest.faction,
          });
      const seen = (state.globals.EncounterSeenCounts && typeof state.globals.EncounterSeenCounts === 'object')
        ? state.globals.EncounterSeenCounts
        : {};
      for (const pick of picks) {
        const key = String(pick?.name || '').trim();
        if (!key) continue;
        seen[key] = Number(seen[key] || 0) + 1;
      }
      state.globals.EncounterSeenCounts = seen;
      for (let i = 0; i < spawnPlan.length; i += 1) {
        const pick = spawnPlan[i].row;
        const slotIndex = Number(spawnPlan[i].slotIndex || 0);
        callFunctionWithContext(fnContext, 'SpawnEnemy', {
          name: pick.name,
          HP: Number(pick.HP || 0),
          ATK: Number(pick.ATK || 0),
          DEF: Number(pick.DEF || 0),
          MAG: Number(pick.MAG || 0),
          RES: Number(pick.RES || 0),
          SPD: Number(pick.SPD || 0),
          attackType: String(pick.attackType || ''),
          faction: String(pick.faction || 'wishless'),
          enemyRole: String(pick.enemyRole || 'fodder'),
          localeTags: Array.isArray(pick.localeTags) ? pick.localeTags : ['all'],
          CombatPower: Number(pick.CombatPower || pick.combatPower || resolveEnemyEncounterCombatPower(pick, computeCombatPower)),
        }, slotIndex);
      }
      state.globals.InitialSpawn = 0;
    }

    if (state.globals.PartyMaxHP > 0) {
      state.globals.PartyHP = state.globals.PartyMaxHP;
      syncFromGlobals();
    }
    callFunctionWithContext(fnContext, 'UpdateEnemyHPUI');
    if (state.globals.EnemyHPByIndex) {
      gameState.enemyHP = [...state.globals.EnemyHPByIndex];
      gameState.enemyMaxHP = [...state.globals.EnemyMaxHPByIndex];
    }
  };
}
