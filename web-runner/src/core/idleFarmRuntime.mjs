import { EMPTY, MONSTER_KEYS, MONSTER_LOOT_TABLE, TOKEN } from '../../modules/monsterLootTableEventTokens.js';

function pickEnemyName(index, catalog) {
  const list = Array.isArray(catalog) && catalog.length ? catalog : ['Gobloc', 'High Orc', 'Chimerilass'];
  return String(list[index % list.length] || `Enemy ${index + 1}`);
}

function createEnemy(slotIndex, spawnIndex, catalog, hitsToKill, nowSec = 0, forcedEnemyNames = []) {
  const maxHits = Math.max(2, Number(hitsToKill || 3));
  const minHits = Math.min(2, maxHits);
  const resolvedHits = minHits >= maxHits
    ? maxHits
    : (minHits + Math.floor(Math.random() * ((maxHits - minHits) + 1)));
  const forcedName = String(forcedEnemyNames?.[slotIndex] || '').trim();
  return {
    slot: slotIndex,
    enemyId: `idle-enemy-${spawnIndex}`,
    name: forcedName || pickEnemyName(spawnIndex - 1, catalog),
    hitsRemaining: resolvedHits,
    maxHits: resolvedHits,
    spawnedAtSec: Number(nowSec || 0),
    alive: true,
  };
}

export function buildIdleFarmHeroRoster(heroSlots = [], fallbackRoster = []) {
  const requested = Array.isArray(heroSlots) ? heroSlots.filter(Boolean) : [];
  const fallback = Array.isArray(fallbackRoster) ? fallbackRoster.filter(Boolean) : [];
  const names = requested.length ? requested : fallback;
  const counts = new Map();
  return names.map((name, idx) => {
    const key = String(name || fallback[idx] || `Hero ${idx + 1}`).trim() || `Hero ${idx + 1}`;
    const nextCount = (counts.get(key) || 0) + 1;
    counts.set(key, nextCount);
    const suffix = nextCount > 1 ? ` ${String.fromCharCode(64 + nextCount)}` : '';
    return {
      baseName: key,
      displayName: `${key}${suffix}`,
      instanceId: `idle-hero-${idx + 1}-${nextCount}`,
      attacksPerformed: 0,
    };
  });
}

export function createIdleFarmSessionState({
  config = {},
  heroSlots = [],
  fallbackRoster = [],
  enemyCatalog = [],
  nowSec = 0,
} = {}) {
  const forcedHeroNames = Array.isArray(config.heroNames) ? config.heroNames.filter(Boolean) : [];
  const forcedEnemyNames = Array.isArray(config.enemyNames) ? config.enemyNames.map((name) => String(name || '').trim()) : [];
  const heroes = buildIdleFarmHeroRoster(forcedHeroNames.length ? forcedHeroNames : heroSlots, fallbackRoster);
  const enemySlots = Math.max(1, Number(config.enemySlots || 1));
  const hitsToKill = Math.max(1, Number(config.hitsToKill || 3));
  const laneCount = Math.max(1, heroes.length || enemySlots);
  return {
    status: 'running',
    startedAtSec: Number(nowSec || 0),
    updatedAtSec: Number(nowSec || 0),
    elapsedSec: 0,
    targetDefeats: Math.max(0, Number(config.targetDefeats || 0)),
    loopForever: !!config.loopForever,
    defeats: 0,
    wavesCleared: 0,
    nextActionAtSec: Number(nowSec || 0) + 0.75,
    nextRewardAtSec: Math.max(1, Number(config.rewardCadenceSec || 10)),
    nextEnemySpawnIndex: 1,
    activeHeroIndex: 0,
    heroEnterAtSec: Array.from({ length: Math.max(1, heroes.length) }, (_, idx) => Number(nowSec || 0) + getIdleLaneOffsetSec(idx)),
    laneSides: Array.from({ length: laneCount }, () => 'hero'),
    laneSpawnAtSec: Array.from({ length: enemySlots }, (_, idx) => Number(nowSec || 0) + 1.5 + getIdleLaneOffsetSec(idx)),
    laneNextActionAtSec: Array.from({ length: laneCount }, (_, idx) => Number(nowSec || 0) + 2.4 + getIdleLaneOffsetSec(idx)),
    maxVisibleEnemies: Math.max(1, Number(config.maxVisibleEnemies || 1)),
    lastAction: null,
    currentActions: Array.from({ length: laneCount }, () => null),
    heroes,
    enemies: Array.from({ length: enemySlots }, () => null),
    forcedEnemyNames,
    log: ['Idle farm run started.'],
  };
}

function appendLog(session, text) {
  if (!session) return;
  const next = Array.isArray(session.log) ? session.log.slice(-5) : [];
  next.push(String(text || ''));
  session.log = next.slice(-6);
}

function ensureRewardLedger(layoutState) {
  if (!layoutState.rewardLedger) {
    layoutState.rewardLedger = {
      unclaimedGold: 0,
      claimedGoldTotal: 0,
      unclaimedTokens: {
        [TOKEN.SAND]: 0,
        [TOKEN.BONE_CHIP]: 0,
        [TOKEN.SLIME]: 0,
        [TOKEN.HORN]: 0,
        [TOKEN.SHELL]: 0,
      },
      claimedTokensTotal: {
        [TOKEN.SAND]: 0,
        [TOKEN.BONE_CHIP]: 0,
        [TOKEN.SLIME]: 0,
        [TOKEN.HORN]: 0,
        [TOKEN.SHELL]: 0,
      },
    };
  }
  if (!layoutState.rewardLedger.unclaimedTokens || typeof layoutState.rewardLedger.unclaimedTokens !== 'object') {
    layoutState.rewardLedger.unclaimedTokens = {
      [TOKEN.SAND]: 0,
      [TOKEN.BONE_CHIP]: 0,
      [TOKEN.SLIME]: 0,
      [TOKEN.HORN]: 0,
      [TOKEN.SHELL]: 0,
    };
  }
  if (!layoutState.rewardLedger.claimedTokensTotal || typeof layoutState.rewardLedger.claimedTokensTotal !== 'object') {
    layoutState.rewardLedger.claimedTokensTotal = {
      [TOKEN.SAND]: 0,
      [TOKEN.BONE_CHIP]: 0,
      [TOKEN.SLIME]: 0,
      [TOKEN.HORN]: 0,
      [TOKEN.SHELL]: 0,
    };
  }
  return layoutState.rewardLedger;
}

function getIdleActionGapSec() {
  return 0.24;
}

function getIdleLaneOffsetSec(laneIndex) {
  return Math.max(0, Number(laneIndex || 0)) * 3.0;
}

const IDLE_GOLD_SHARE = 40;
const IDLE_TIER_WEIGHTS = [2, 8, 20, 70];
const IDLE_NON_GOLD_SCALE = (100 - IDLE_GOLD_SHARE) / IDLE_TIER_WEIGHTS.reduce((a, b) => a + b, 0);

function pickIdleDropTier() {
  const weights = IDLE_TIER_WEIGHTS.map((weight) => weight * IDLE_NON_GOLD_SCALE);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 3;
}

function resolveIdleMonsterDrop(monsterName) {
  if ((Math.random() * 100) < IDLE_GOLD_SHARE) return 'ITEM.GOLD';
  const monsterId = MONSTER_KEYS.findIndex((key) => key === monsterName);
  if (monsterId < 0) return EMPTY;
  const tiers = MONSTER_LOOT_TABLE[monsterId] || [];
  return tiers[pickIdleDropTier()] ?? EMPTY;
}

function parseIdleDropId(dropId) {
  if (!dropId || dropId === EMPTY) return { type: 'EMPTY', id: null };
  const raw = String(dropId);
  const parts = raw.split('.');
  if (parts.length === 2) return { type: parts[0], id: parts[1] };
  return { type: 'UNKNOWN', id: raw };
}

function pickIdleEmissionMonster(session, fallbackCatalog = []) {
  const living = Array.isArray(session?.enemies)
    ? session.enemies.filter((enemy) => enemy && enemy.alive).map((enemy) => String(enemy.name || '')).filter(Boolean)
    : [];
  if (living.length) return living[Math.floor(Math.random() * living.length)];
  const fallback = Array.isArray(fallbackCatalog) ? fallbackCatalog.filter(Boolean).map((name) => String(name)) : [];
  if (fallback.length) return fallback[Math.floor(Math.random() * fallback.length)];
  return 'Gobloc';
}

export function ensureIdleFarmSessionState(layoutState, deps = {}) {
  if (!layoutState.session) {
    layoutState.session = createIdleFarmSessionState({
      config: layoutState.config || {},
      heroSlots: deps.heroSlots || [],
      fallbackRoster: deps.fallbackRoster || [],
      enemyCatalog: deps.enemyCatalog || [],
      nowSec: deps.nowSec || 0,
    });
  }
  ensureRewardLedger(layoutState);
  return layoutState.session;
}

export function startIdleFarmEmissionState(layoutState, deps = {}) {
  if (!layoutState || typeof layoutState !== 'object') return null;
  const config = layoutState.config || {};
  const forcedEnemyNames = Array.isArray(config.enemyNames) ? config.enemyNames.map((name) => String(name || '').trim()) : [];
  const nowSec = Number(deps.nowSec || 0);
  if (!layoutState.emissionState) {
    layoutState.emissionState = {
      active: true,
      startedAtSec: nowSec,
      updatedAtSec: nowSec,
      elapsedSec: 0,
      nextRewardAtSec: Math.max(1, Number(config.rewardCadenceSec || 10)),
    };
  }
  ensureRewardLedger(layoutState);
  return layoutState.emissionState;
}

export function resetIdleFarmEmissionCadence(layoutState, deps = {}) {
  const emissionState = startIdleFarmEmissionState(layoutState, deps);
  if (!emissionState) return null;
  const config = layoutState.config || {};
  const nowSec = Number(deps.nowSec || 0);
  emissionState.startedAtSec = nowSec;
  emissionState.updatedAtSec = nowSec;
  emissionState.elapsedSec = 0;
  emissionState.nextRewardAtSec = Math.max(1, Number(config.rewardCadenceSec || 10));
  return emissionState;
}

export function updateIdleFarmEmissionState(layoutState, deps = {}) {
  if (!layoutState || typeof layoutState !== 'object' || !layoutState.emissionState) return null;
  const emissionState = startIdleFarmEmissionState(layoutState, deps);
  const nowSec = Number(deps.nowSec || 0);
  const config = layoutState.config || {};
  const rewardLedger = ensureRewardLedger(layoutState);
  const metaBonuses = layoutState.metaBonuses || {};
  emissionState.elapsedSec = Math.max(0, nowSec - Number(emissionState.startedAtSec || 0));

  while (emissionState.elapsedSec >= Number(emissionState.nextRewardAtSec || 0)) {
    const goldBonus = 1 + Math.max(0, Number(metaBonuses.goldGainPct || 0));
    const resourceBonus = 1 + Math.max(0, Number(metaBonuses.resourceGainPct || 0));
    const monsterName = pickIdleEmissionMonster(layoutState.session || null, deps.enemyCatalog || []);
    const parsed = parseIdleDropId(resolveIdleMonsterDrop(monsterName));
    if (parsed.type === 'ITEM' && parsed.id === 'GOLD') {
      rewardLedger.unclaimedGold += Math.max(1, Math.round(Number(config.goldPerCadence || 1) * goldBonus));
    } else if (parsed.type === 'TOKEN' && parsed.id) {
      const amount = Math.max(1, Math.round(1 * resourceBonus));
      rewardLedger.unclaimedTokens[parsed.id] = Number(rewardLedger.unclaimedTokens[parsed.id] || 0) + amount;
    }
    emissionState.nextRewardAtSec += Math.max(1, Number(config.rewardCadenceSec || 10));
  }
  emissionState.updatedAtSec = nowSec;
  return emissionState;
}

export function restartIdleFarmSessionState(layoutState, deps = {}) {
  layoutState.session = createIdleFarmSessionState({
    config: layoutState.config || {},
    heroSlots: deps.heroSlots || [],
    fallbackRoster: deps.fallbackRoster || [],
    enemyCatalog: deps.enemyCatalog || [],
    nowSec: deps.nowSec || 0,
  });
  ensureRewardLedger(layoutState);
  return layoutState.session;
}

export function updateIdleFarmSessionState(layoutState, deps = {}) {
  const session = ensureIdleFarmSessionState(layoutState, deps);
  const nowSec = Number(deps.nowSec || 0);
  if (!session || session.status !== 'running') {
    if (session) session.updatedAtSec = nowSec;
    return session;
  }
  const config = layoutState.config || {};
  const heroes = Array.isArray(session.heroes) && session.heroes.length ? session.heroes : [];
  session.elapsedSec = Math.max(0, nowSec - Number(session.startedAtSec || 0));

  const livingEnemies = () => session.enemies.filter((enemy) => enemy && enemy.alive);
  const laneCount = Math.max(1, heroes.length || Number(config.enemySlots || 1) || 1);
  const getLaneEnemy = (laneIndex) => {
    const targetSlot = Math.max(0, laneIndex % Math.max(1, session.enemies.length));
    const exact = session.enemies[targetSlot];
    return exact && exact.alive ? exact : null;
  };
  const getCandidateForLane = (laneIndex) => {
    const livingEnemy = getLaneEnemy(laneIndex);
    if (!livingEnemy) return null;
    const heroIndex = laneIndex % Math.max(1, heroes.length);
    const laneSide = String(session.laneSides[laneIndex] || 'hero');
    const actorKey = laneSide === 'enemy'
      ? `enemy:${livingEnemy.enemyId}`
      : `hero:${heroes[heroIndex]?.instanceId || heroIndex}`;
    return { laneIndex, livingEnemy, heroIndex, laneSide, actorKey };
  };
  if (!Array.isArray(session.laneSpawnAtSec) || session.laneSpawnAtSec.length !== session.enemies.length) {
    session.laneSpawnAtSec = Array.from({ length: session.enemies.length }, (_, idx) =>
      Number((session.laneSpawnAtSec?.[idx] ?? (Number(nowSec || 0) + 1.5 + getIdleLaneOffsetSec(idx))) || 0)
    );
  }
  if (!Array.isArray(session.laneNextActionAtSec) || session.laneNextActionAtSec.length !== laneCount) {
    session.laneNextActionAtSec = Array.from({ length: laneCount }, (_, idx) =>
      Number((session.laneNextActionAtSec?.[idx] ?? (Number(nowSec || 0) + 2.4 + getIdleLaneOffsetSec(idx))) || 0)
    );
  }
  if (!Array.isArray(session.currentActions) || session.currentActions.length !== laneCount) {
    session.currentActions = Array.from({ length: laneCount }, (_, idx) => session.currentActions?.[idx] || null);
  }
  const targetVisible = Math.max(1, Number(session.maxVisibleEnemies || 1));
  for (let slotIndex = 0; slotIndex < session.enemies.length; slotIndex += 1) {
    if (session.status !== 'running') break;
    if (livingEnemies().length >= targetVisible) break;
    const resident = session.enemies[slotIndex];
    if (resident && resident.alive) continue;
    if (nowSec < Number(session.laneSpawnAtSec[slotIndex] || 0)) continue;
    if (slotIndex > 0 && livingEnemies().length > 0) {
      const secondEnemyChance = Math.max(0, Math.min(1, Number(config.secondEnemyChance || 0)));
      if (Math.random() > secondEnemyChance) {
        session.laneSpawnAtSec[slotIndex] = nowSec + Math.max(0.5, Number(config.enemySpawnDelaySec || 1.5));
        continue;
      }
    }
    session.enemies[slotIndex] = createEnemy(
      slotIndex,
      session.nextEnemySpawnIndex,
      deps.enemyCatalog || [],
      config.hitsToKill,
      nowSec,
      forcedEnemyNames,
    );
    session.nextEnemySpawnIndex += 1;
    session.laneSpawnAtSec[slotIndex] = nowSec + Math.max(0.5, Number(config.enemySpawnDelaySec || 1.5));
    appendLog(session, `${session.enemies[slotIndex].name} entered the lane.`);
  }

  const resolveAction = (laneIndex, action) => {
    if (!action) return;
    if (action.actorSide === 'hero' && action.killed) {
      const laneIndex = Math.max(0, Number(action.laneIndex || 0));
      const laneEnemy = session.enemies[laneIndex];
      if (laneEnemy && String(laneEnemy.enemyId || '') === String(action.enemyId || '')) {
        laneEnemy.alive = false;
      }
      session.defeats += 1;
      appendLog(session, `${action.enemyName || 'Enemy'} was routed.`);
      if (Array.isArray(session.laneSpawnAtSec)) {
        session.laneSpawnAtSec[laneIndex] = Number(action.endSec || nowSec) + Math.max(0.5, Number(config.enemySpawnDelaySec || 1.5));
      }
      if (!session.loopForever && session.targetDefeats > 0 && session.defeats >= session.targetDefeats) {
        session.status = 'complete';
        appendLog(session, 'Idle farm run complete. Rewards ready to collect.');
      }
    }
    session.lastAction = {
      atSec: Number(action.startSec || nowSec),
      actorSide: action.actorSide,
      laneIndex: action.laneIndex,
      heroIndex: action.heroIndex,
      heroName: action.heroName,
      enemyId: action.enemyId,
      enemyName: action.enemyName,
      hitNumber: action.hitNumber,
      killed: !!action.killed,
    };
    session.currentActions[laneIndex] = null;
    session.laneNextActionAtSec[laneIndex] = Number(action.endSec || nowSec) + getIdleActionGapSec();
  };

  for (let laneIndex = 0; laneIndex < laneCount; laneIndex += 1) {
    const laneAction = session.currentActions[laneIndex];
    if (laneAction && nowSec >= Number(laneAction.endSec || 0)) {
      resolveAction(laneIndex, laneAction);
    }
  }

  if (!Array.isArray(session.laneSides) || session.laneSides.length !== laneCount) {
    session.laneSides = Array.from({ length: laneCount }, (_, idx) => session.laneSides?.[idx] || 'hero');
  }
  for (let laneIndex = 0; laneIndex < laneCount; laneIndex += 1) {
    if (session.status !== 'running') break;
    if (session.currentActions[laneIndex]) continue;
    if (nowSec < Number(session.laneNextActionAtSec[laneIndex] || 0)) continue;
    const livingEnemy = getLaneEnemy(laneIndex);
    if (!livingEnemy) {
      session.laneNextActionAtSec[laneIndex] = nowSec + 0.2;
      continue;
    }
    const heroIndex = laneIndex % Math.max(1, heroes.length);
    session.activeHeroIndex = heroIndex;
    const laneSide = String(session.laneSides[laneIndex] || 'hero');
    if (laneSide === 'enemy') {
      const action = {
        startSec: nowSec,
        endSec: nowSec + 1.3125,
        actorSide: 'enemy',
        laneIndex,
        enemyId: livingEnemy.enemyId,
        enemyName: livingEnemy.name,
        heroIndex,
        heroName: heroes[heroIndex]?.displayName || 'Hero',
        hitNumber: 0,
        killed: false,
      };
      appendLog(session, `${livingEnemy.name} pressed the attack.`);
      session.laneSides[laneIndex] = 'hero';
      session.currentActions[laneIndex] = action;
      continue;
    }

    const hero = heroes[heroIndex] || null;
    if (hero) hero.attacksPerformed = Number(hero.attacksPerformed || 0) + 1;
    livingEnemy.hitsRemaining = Math.max(0, Number(livingEnemy.hitsRemaining || 0) - 1);
    const action = {
      startSec: nowSec,
      endSec: nowSec + 1.3125,
      actorSide: 'hero',
      laneIndex,
      heroIndex,
      heroName: hero ? hero.displayName : 'Hero',
      enemyId: livingEnemy.enemyId,
      enemyName: livingEnemy.name,
      hitNumber: Number(livingEnemy.maxHits || 3) - Number(livingEnemy.hitsRemaining || 0),
      killed: false,
    };
    appendLog(session, `${hero ? hero.displayName : 'Hero'} struck ${livingEnemy.name}.`);

    if (livingEnemy.hitsRemaining <= 0) {
      action.killed = true;
      session.laneSides[laneIndex] = 'hero';
    } else {
      session.laneSides[laneIndex] = 'enemy';
    }

    session.currentActions[laneIndex] = action;
  }

  session.wavesCleared = Math.floor(session.defeats / Math.max(1, Number(config.enemySlots || 1)));
  session.updatedAtSec = nowSec;
  return session;
}

export function claimIdleFarmRewardsFromState(layoutState) {
  const rewardLedger = ensureRewardLedger(layoutState);
  const gold = Math.max(0, Number(rewardLedger.unclaimedGold || 0));
  rewardLedger.claimedGoldTotal = Number(rewardLedger.claimedGoldTotal || 0) + gold;
  const tokens = {};
  for (const tokenId of Object.values(TOKEN)) {
    const amt = Math.max(0, Number(rewardLedger.unclaimedTokens[tokenId] || 0));
    if (amt > 0) tokens[tokenId] = amt;
    rewardLedger.claimedTokensTotal[tokenId] = Number(rewardLedger.claimedTokensTotal[tokenId] || 0) + amt;
    rewardLedger.unclaimedTokens[tokenId] = 0;
  }
  rewardLedger.unclaimedGold = 0;
  return { gold, tokens };
}

export function applyIdleFarmRewardsToGlobals(globals, claimed = {}) {
  if (!globals || typeof globals !== 'object') return { gold: 0, tokens: {} };
  const gold = Math.max(0, Number(claimed.gold || 0));
  const tokens = claimed.tokens && typeof claimed.tokens === 'object' ? claimed.tokens : {};
  const hasAnyTokens = Object.values(tokens).some((amount) => Math.max(0, Number(amount || 0)) > 0);
  if (gold <= 0 && !hasAnyTokens) return { gold: 0, tokens: {} };
  globals.goldTotal = Number(globals.goldTotal || 0) + gold;
  const nextWallet = {
    ...((globals.TokenWallet && typeof globals.TokenWallet === 'object') ? globals.TokenWallet : {}),
  };
  for (const [tokenId, amount] of Object.entries(tokens)) {
    if (!tokenId) continue;
    nextWallet[tokenId] = Number(nextWallet[tokenId] || 0) + Math.max(0, Number(amount || 0));
  }
  globals.TokenWallet = nextWallet;
  globals.IdleFarmLastCollect = {
    gold,
    tokens: { ...tokens },
  };
  return { gold, tokens: { ...tokens } };
}
