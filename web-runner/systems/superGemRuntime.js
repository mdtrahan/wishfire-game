const SUPER_GEM_COST = 4;
const SUPER_GEM_HEAL_POTENCY = 6;
const SUPER_GEM_SINGLE_HIT_DELAY = 0.97;
const SUPER_GEM_AOE_HIT_DELAY = 1.07;
const SUPER_GEM_HIT_INTERVAL = 0.2;
const KOJONN_TAINTED_GROUND_DURATION_HERO_TEAM_TURNS = 3;
const KOJONN_TAINTED_GROUND_DAMAGE_SCALE = 0.5;
const FALIE_RED_SUPER_GEM_SHIELD_RATIOS = Object.freeze([0, 0.18, 0.26, 0.34, 0.42, 0.5]);
const FALIE_RED_SUPER_GEM_SHIELD_COLOR = '#6CCBEE';

function getRuntimeRandom(state) {
  const fn = state && state.globals && typeof state.globals.RuntimeRandom === 'function'
    ? state.globals.RuntimeRandom
    : null;
  return fn || Math.random;
}

function randomIntInclusive(min, max, rng) {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  const roll = Number((rng || Math.random)());
  const unit = Number.isFinite(roll) && roll >= 0 && roll < 1 ? roll : Math.random();
  return lower + Math.floor(unit * (upper - lower + 1));
}

function getActorName(callFunctionWithContext, fnContext, actorUID) {
  const actor = callFunctionWithContext(fnContext, 'GetActorByUID', actorUID);
  return String(actor && actor.name || 'Hero');
}

function getNextSuperGemBatchId(state) {
  const next = Math.max(1, Number(state?.globals?.NextSuperGemBatchId || 1));
  state.globals.NextSuperGemBatchId = next + 1;
  return next;
}

function getFalieRedSuperGemShieldRatio(stackCount) {
  const clamped = Math.max(0, Math.min(5, Math.floor(Number(stackCount || 0))));
  return FALIE_RED_SUPER_GEM_SHIELD_RATIOS[clamped] || 0;
}

function grantFalieRedSuperGemPartyShield(state) {
  if (!state?.globals) return false;
  const g = state.globals;
  const nextStacks = Math.max(1, Math.min(5, Math.floor(Number(g.PartyTempHPShieldStacks || 0)) + 1));
  const ratio = getFalieRedSuperGemShieldRatio(nextStacks);
  const maxHP = Math.max(1, Number(g.PartyMaxHP || 1));
  const shieldHP = Math.max(0, Math.round(maxHP * ratio));
  g.PartyTempHPShieldStacks = nextStacks;
  g.PartyTempHPShieldRatio = ratio;
  g.PartyTempHPShieldMax = shieldHP;
  g.PartyTempHPShield = Math.max(Number(g.PartyTempHPShield || 0), shieldHP);
  g.PartyTempHPShieldColor = FALIE_RED_SUPER_GEM_SHIELD_COLOR;
  g.PartyTempHPShieldSource = 'falie_red_super_gem';
  return g.PartyTempHPShield > 0;
}

function buildNormalHitLog(heroName, targetName, finalDmg) {
  return `${heroName} hit ${targetName || '?'} for ${finalDmg}!`;
}

function buildKojonnTaintedGroundLog(heroName, targetName, dotTotalDamage) {
  return `${heroName} corrupted ${targetName || '?'}'s ground with blight for ${dotTotalDamage}!`;
}

function buildHuunGoldstrikeLog(heroName, targetName, roll, finalDmg, branch) {
  if (branch === 'jackpot') return `${heroName} hit a perfect goldstrike for 100 on all enemies!`;
  return `${heroName} rolled ${roll} and goldstruck ${targetName || '?'} for ${finalDmg}!`;
}

function splitDamageAcrossHits(totalDamage, hitCount) {
  const total = Math.max(1, Math.floor(Number(totalDamage || 0) || 1));
  const count = Math.max(1, Math.floor(Number(hitCount || 1) || 1));
  const base = Math.floor(total / count);
  let remainder = total % count;
  return Array.from({ length: count }, () => {
    const piece = Math.max(1, base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder -= 1;
    return piece;
  });
}

function queueClusterSingleHits({
  state,
  callFunctionWithContext,
  fnContext,
  actorUID,
  targetUID,
  hitCount,
}) {
  const actor = callFunctionWithContext(fnContext, 'GetActorByUID', actorUID);
  const target = callFunctionWithContext(fnContext, 'GetActorByUID', targetUID);
  if (!actor || !target) return false;
  const mode = actor.attackType === 'magic' ? 'magic' : 'melee';
  const dmg = callFunctionWithContext(fnContext, 'CalculateDamage', actorUID, targetUID, mode);
  let ampMult = Number(callFunctionWithContext(fnContext, 'GetPowerAmpMultiplierForActor', actorUID) || 0);
  if (ampMult > 0) {
    const consumed = Number(callFunctionWithContext(fnContext, 'ConsumePowerAmpForActor', actorUID) || 0);
    if (consumed > 0) ampMult = consumed;
  }
  const finalDmg = ampMult > 0 ? Math.max(1, Math.ceil(Number(dmg || 0) * ampMult)) : Math.max(1, Number(dmg || 0));
  const ampState = state.globals.PowerAmpByUID || {};
  const ampEntry = ampState[actorUID];
  const ampLifecycleId = Number(ampEntry && ampEntry.lifecycleId || 0);
  state.globals.NextHeroActionProfile = 'single';
  callFunctionWithContext(fnContext, 'StartHeroLunge', actorUID);
  state.globals.PendingHeroHits = state.globals.PendingHeroHits || [];
  const now = Number(state.globals.time || 0);
  const applyAt = now + SUPER_GEM_SINGLE_HIT_DELAY;
  const heroName = getActorName(callFunctionWithContext, fnContext, actorUID);
  const targetName = String(target.name || '?');
  const batchId = getNextSuperGemBatchId(state);
  const totalDamage = Math.max(1, Number(finalDmg || 0));
  const shotDamages = splitDamageAcrossHits(totalDamage, hitCount);
  for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
    const shotDamage = Number(shotDamages[hitIndex] || 1);
    state.globals.PendingHeroHits.push({
      at: applyAt + (hitIndex * SUPER_GEM_HIT_INTERVAL),
      heroUID: actorUID,
      targetUID,
      dmg: shotDamage,
      finalDmg: shotDamage,
      powerAmpMultiplier: hitIndex === 0 ? ampMult : 0,
      powerAmpLifecycleId: ampLifecycleId,
      consumePowerAmp: ampMult > 0 && hitIndex === 0 ? 1 : 0,
      damageTextScatter: { radiusX: 14, radiusY: 10 },
      calcPath: mode === 'magic' ? 'magicCalc' : 'meleeCalc',
      heroName,
      heroType: mode,
      superGemClusterBatchId: batchId,
      superGemClusterVisualOnly: hitIndex < (hitCount - 1) ? 1 : 0,
      superGemClusterApplyTotalOnHit: hitIndex === (hitCount - 1) ? totalDamage : 0,
      msg: buildNormalHitLog(heroName, targetName, shotDamage),
    });
  }
  state.globals.ActionLockUntil = Math.max(
    Number(state.globals.ActionLockUntil || 0),
    applyAt + ((hitCount - 1) * SUPER_GEM_HIT_INTERVAL) + 0.26,
  );
  state.globals.DeferAdvance = 1;
  state.globals.AdvanceAfterAction = 1;
  state.globals.ActionOwnerUID = actorUID;
  return true;
}

function getDefaultSingleTargetUID(state) {
  const target = (state?.entities || []).find((entity) => (
    entity &&
    entity.kind === 'enemy' &&
    Number(entity.hp || 0) > 0
  ));
  return Number(target?.uid || 0);
}

function isHuunActor(actor) {
  return String(actor && actor.name || '').trim().toLowerCase() === 'huun';
}

function resolveHuunGoldstrikeActorUID({
  state,
  callFunctionWithContext,
  fnContext,
  actorUID,
}) {
  const currentHeroUID = Number(state?.globals?.CurrentHeroUID || 0);
  if (currentHeroUID > 0) {
    const currentHero = callFunctionWithContext(fnContext, 'GetActorByUID', currentHeroUID);
    if (isHuunActor(currentHero)) return currentHeroUID;
  }
  const actor = callFunctionWithContext(fnContext, 'GetActorByUID', actorUID);
  return isHuunActor(actor) ? Number(actorUID || 0) : 0;
}

function queueHuunYellowGoldstrike({
  state,
  callFunctionWithContext,
  fnContext,
  actorUID,
  selectedEnemyUID = 0,
  consumedColorGemCount = 0,
}) {
  const actor = callFunctionWithContext(fnContext, 'GetActorByUID', actorUID);
  if (!actor || !isHuunActor(actor)) return false;
  const enemies = (state.entities || []).filter((entity) => entity && entity.kind === 'enemy' && Number(entity.hp || 0) > 0);
  if (!enemies.length) return false;
  const bankedGold = Math.max(0, Math.floor(Number(state.globals.goldTotal || 0)));
  const boardGold = Math.max(0, Math.floor(Number(consumedColorGemCount || 0)));
  const baseDamage = Math.max(1, bankedGold + boardGold);
  const rng = getRuntimeRandom(state);
  const roll = randomIntInclusive(0, 100, rng);
  const isJackpot = roll === 100;
  const branch = isJackpot ? 'jackpot' : (roll <= 50 ? 'low' : 'high');
  const finalDmg = isJackpot ? 100 : baseDamage * (branch === 'high' ? 3 : 1);
  const targetUID = Number(selectedEnemyUID || 0);
  const selectedTarget = targetUID > 0
    ? enemies.find((enemy) => Number(enemy.uid || 0) === targetUID)
    : null;
  const targets = isJackpot ? enemies : [selectedTarget || enemies[0]];
  if (!targets.length) return false;
  state.globals.NextHeroActionProfile = isJackpot ? 'aoe' : 'single';
  callFunctionWithContext(fnContext, 'StartHeroLunge', actorUID);
  state.globals.PendingHeroHits = state.globals.PendingHeroHits || [];
  const now = Number(state.globals.time || 0);
  const applyAt = now + (isJackpot ? SUPER_GEM_AOE_HIT_DELAY : SUPER_GEM_SINGLE_HIT_DELAY);
  const heroName = getActorName(callFunctionWithContext, fnContext, actorUID);
  const batchId = isJackpot ? getNextSuperGemBatchId(state) : 0;
  for (const target of targets) {
    const enemyName = String(target.name || '?');
    state.globals.PendingHeroHits.push({
      at: applyAt,
      heroUID: actorUID,
      targetUID: Number(target.uid || 0),
      dmg: finalDmg,
      finalDmg,
      calcPath: 'goldstrike',
      heroName,
      heroType: 'melee',
      huunGoldstrikeRoll: roll,
      huunGoldstrikeBranch: branch,
      huunGoldstrikeBankedGold: bankedGold,
      huunGoldstrikeBoardGold: boardGold,
      superGemClusterBatchId: batchId,
      superGemClusterVisualOnly: 0,
      msg: buildHuunGoldstrikeLog(heroName, enemyName, roll, finalDmg, branch),
    });
  }
  state.globals.goldTotal = bankedGold + boardGold;
  state.globals.LastHuunYellowSuperGemGoldstrike = {
    roll,
    branch,
    bankedGold,
    boardGold,
    baseDamage,
    finalDmg,
    targetCount: targets.length,
  };
  const logTargetName = isJackpot ? 'all enemies' : String(targets[0]?.name || '?');
  callFunctionWithContext(fnContext, 'LogCombat', buildHuunGoldstrikeLog(heroName, logTargetName, roll, finalDmg, branch));
  state.globals.ActionLockUntil = Math.max(
    Number(state.globals.ActionLockUntil || 0),
    applyAt + 0.42,
  );
  state.globals.DeferAdvance = 1;
  state.globals.AdvanceAfterAction = 1;
  state.globals.ActionOwnerUID = actorUID;
  state.globals.CanPickGems = 0;
  state.globals.IsPlayerBusy = 0;
  return true;
}

function getEnemySlotIndex(enemy) {
  if (!enemy) return -1;
  const direct = Number(enemy.slotIndex);
  if (Number.isFinite(direct) && direct >= 0) return Math.floor(direct);
  const y = Number(enemy.y);
  if (Number.isFinite(y)) return Math.floor(y);
  return Number(enemy.uid || 0);
}

function getHeroTeamTurnSpan(state, zone = null) {
  const zoneSpan = Number(zone?.heroTeamTurnSpan || 0);
  if (zoneSpan > 0) return Math.floor(zoneSpan);
  const globals = state?.globals || {};
  if (Array.isArray(globals.TurnOrderArray) && globals.TurnOrderArray.length > 0) {
    const heroSlots = globals.TurnOrderArray.filter((slot) => Number(slot?.type || 0) === 0);
    if (heroSlots.length > 0) return heroSlots.length;
  }
  if (Array.isArray(globals.RoundRoster) && globals.RoundRoster.length > 0) {
    const heroSlots = globals.RoundRoster.filter((slot) => Number(slot?.type || 0) === 0);
    if (heroSlots.length > 0) return heroSlots.length;
  }
  const aliveHeroes = (state?.entities || []).filter((entity) => (
    entity
    && entity.kind === 'hero'
    && Number(entity.hp ?? 1) > 0
  ));
  return Math.max(1, aliveHeroes.length || 1);
}

function getHeroTeamTurnSerial(state, zone = null) {
  const explicit = Number(state?.globals?.HeroTeamTurnSerial);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.floor(explicit);
  return 0;
}

function getNextTaintedGroundZoneId(state) {
  const next = Math.max(1, Number(state?.globals?.NextTaintedGroundZoneId || 1));
  state.globals.NextTaintedGroundZoneId = next + 1;
  return `tg-${next}`;
}

function ensureTaintedGroundZones(state) {
  if (!state.globals.TaintedGroundZones) state.globals.TaintedGroundZones = [];
  return state.globals.TaintedGroundZones;
}

function refreshTaintedGroundZone({
  state,
  sourceUID,
  enemy,
  dotTotalDamage,
  startsAt = 0,
  durationHeroTeamTurns = 3,
}) {
  const zones = ensureTaintedGroundZones(state);
  const slotIndex = getEnemySlotIndex(enemy);
  const enemyX = Number(enemy?.x);
  const enemyY = Number(enemy?.y);
  const anchorWorldX = Number.isFinite(enemyX) ? enemyX : null;
  const anchorWorldY = Number.isFinite(enemyY) ? enemyY : null;
  const nowTurnSerial = Number(state.globals.TurnSerial || 0);
  const heroTeamTurnSpan = getHeroTeamTurnSpan(state);
  const nowHeroTeamTurnSerial = getHeroTeamTurnSerial(state, { heroTeamTurnSpan });
  const totalHeroTeamTurns = Math.max(1, Math.floor(Number(durationHeroTeamTurns || 3) || 3));
  for (let i = zones.length - 1; i >= 0; i -= 1) {
    const zone = zones[i];
    if (!zone) continue;
    if (Number(zone.sourceUID || 0) !== Number(sourceUID || 0)) continue;
    if (Number(zone.slotIndex || 0) !== slotIndex) continue;
    zone.targetUID = Number(enemy?.uid || 0);
    if (!Number.isFinite(Number(zone.anchorWorldX)) && anchorWorldX != null) zone.anchorWorldX = anchorWorldX;
    if (!Number.isFinite(Number(zone.anchorWorldY)) && anchorWorldY != null) zone.anchorWorldY = anchorWorldY;
    zone.remainingTurns = totalHeroTeamTurns;
    zone.durationHeroTeamTurns = totalHeroTeamTurns;
    zone.heroTeamTurnSpan = heroTeamTurnSpan;
    zone.createdTurnSerial = nowTurnSerial;
    zone.lastSeenTurnSerial = nowTurnSerial;
    zone.createdHeroTeamTurnSerial = nowHeroTeamTurnSerial;
    zone.expiresAtHeroTeamTurnSerial = nowHeroTeamTurnSerial + totalHeroTeamTurns;
    zone.lastSeenHeroTeamTurnSerial = nowHeroTeamTurnSerial;
    zone.visualStartsAt = Number(startsAt || 0);
    zone.activeAt = Number(startsAt || 0);
    zone.fadeStartedAt = null;
    zone.dotTotalDamage = Math.max(1, Math.floor(Number(dotTotalDamage || 1) || 1));
    zone.appliedUIDs = { [Number(enemy?.uid || 0)]: true };
    zone.effectName = 'TaintedGround';
    zone.visual = 'blight_disc';
    return zone;
  }
  const zone = {
    id: getNextTaintedGroundZoneId(state),
    sourceUID: Number(sourceUID || 0),
    slotIndex,
    targetUID: Number(enemy?.uid || 0),
    anchorWorldX,
    anchorWorldY,
    remainingTurns: totalHeroTeamTurns,
    durationHeroTeamTurns: totalHeroTeamTurns,
    heroTeamTurnSpan,
    createdTurnSerial: nowTurnSerial,
    lastSeenTurnSerial: nowTurnSerial,
    createdHeroTeamTurnSerial: nowHeroTeamTurnSerial,
    expiresAtHeroTeamTurnSerial: nowHeroTeamTurnSerial + totalHeroTeamTurns,
    lastSeenHeroTeamTurnSerial: nowHeroTeamTurnSerial,
    visualStartsAt: Number(startsAt || 0),
    activeAt: Number(startsAt || 0),
    dotTotalDamage: Math.max(1, Math.floor(Number(dotTotalDamage || 1) || 1)),
    appliedUIDs: { [Number(enemy?.uid || 0)]: true },
    effectName: 'TaintedGround',
    visual: 'blight_disc',
  };
  zones.push(zone);
  return zone;
}

function removeTaintedGroundOwnedBlight(state, zone) {
  const zoneId = zone && typeof zone === 'object' ? zone.id : zone;
  const id = String(zoneId || '');
  if (!id || !Array.isArray(state?.globals?.EnemyDamageOverTime)) return;
  const dots = state.globals.EnemyDamageOverTime;
  for (let i = dots.length - 1; i >= 0; i -= 1) {
    const dot = dots[i];
    if (!dot) continue;
    const ownedByZone = String(dot.taintedGroundZoneId || '') === id;
    const blightEffect = String(dot.effectName || 'Blight').startsWith('Blight');
    if (!ownedByZone || !blightEffect) continue;
    dots.splice(i, 1);
  }
  if (dots.length === 0) delete state.globals.EnemyDamageOverTime;
}

function removeDirectBlightCoveredByTaintedGround(state, zone) {
  if (!zone || !Array.isArray(state?.globals?.EnemyDamageOverTime)) return;
  const slotIndex = Number(zone.slotIndex || 0);
  const coveredUIDs = new Set((state.entities || [])
    .filter((entity) => (
      entity
      && entity.kind === 'enemy'
      && Number(entity.hp || 0) > 0
      && getEnemySlotIndex(entity) === slotIndex
    ))
    .map((entity) => Number(entity.uid || 0))
    .filter((uid) => uid > 0));
  if (zone.targetUID) coveredUIDs.add(Number(zone.targetUID || 0));
  if (zone.appliedUIDs && typeof zone.appliedUIDs === 'object') {
    for (const uid of Object.keys(zone.appliedUIDs)) {
      const numericUID = Number(uid);
      if (numericUID > 0) coveredUIDs.add(numericUID);
    }
  }
  if (coveredUIDs.size === 0) return;
  const dots = state.globals.EnemyDamageOverTime;
  for (let i = dots.length - 1; i >= 0; i -= 1) {
    const dot = dots[i];
    if (!dot) continue;
    if (!coveredUIDs.has(Number(dot.targetUID || 0))) continue;
    if (String(dot.taintedGroundZoneId || '')) continue;
    if (!String(dot.effectName || 'Blight').startsWith('Blight')) continue;
    dots.splice(i, 1);
  }
  if (dots.length === 0) delete state.globals.EnemyDamageOverTime;
}

function queueKojonnTaintedGroundAoe({
  state,
  callFunctionWithContext,
  fnContext,
  actorUID,
}) {
  const actor = callFunctionWithContext(fnContext, 'GetActorByUID', actorUID);
  if (!actor) return false;
  const enemies = (state.entities || []).filter((entity) => entity && entity.kind === 'enemy' && Number(entity.hp || 0) > 0);
  if (!enemies.length) return false;
  let ampMult = Number(callFunctionWithContext(fnContext, 'GetPowerAmpMultiplierForActor', actorUID) || 0);
  if (ampMult > 0) {
    const consumed = Number(callFunctionWithContext(fnContext, 'ConsumePowerAmpForActor', actorUID) || 0);
    if (consumed > 0) ampMult = consumed;
  }
  const ampState = state.globals.PowerAmpByUID || {};
  const ampEntry = ampState[actorUID];
  const ampLifecycleId = Number(ampEntry && ampEntry.lifecycleId || 0);
  const baseDotDamage = Math.max(1, Math.floor(Number(callFunctionWithContext(fnContext, 'GetEffectiveStat', actor, 'MAG') || actor.MAG || 0) * 0.75));
  const tunedDotDamage = Math.max(1, Math.floor(baseDotDamage * KOJONN_TAINTED_GROUND_DAMAGE_SCALE));
  const dotTotalDamage = ampMult > 0 ? Math.max(1, Math.ceil(tunedDotDamage * ampMult)) : tunedDotDamage;
  state.globals.NextHeroActionProfile = 'aoe';
  callFunctionWithContext(fnContext, 'StartHeroLunge', actorUID);
  state.globals.PendingHeroHits = state.globals.PendingHeroHits || [];
  const now = Number(state.globals.time || 0);
  const applyAt = now + SUPER_GEM_AOE_HIT_DELAY;
  const heroName = getActorName(callFunctionWithContext, fnContext, actorUID);
  let firstHit = true;
  for (const enemy of enemies) {
    const zone = refreshTaintedGroundZone({
      state,
      sourceUID: actorUID,
      enemy,
      dotTotalDamage,
      startsAt: applyAt,
      durationHeroTeamTurns: KOJONN_TAINTED_GROUND_DURATION_HERO_TEAM_TURNS,
    });
    state.globals.PendingHeroHits.push({
      at: applyAt,
      heroUID: actorUID,
      targetUID: Number(enemy.uid || 0),
      dmg: 0,
      finalDmg: 0,
      dotTotalDamage,
      powerAmpMultiplier: firstHit ? ampMult : 0,
      powerAmpLifecycleId: ampLifecycleId,
      consumePowerAmp: ampMult > 0 && firstHit ? 1 : 0,
      effectType: 'dot_apply',
      effectName: 'Blight',
      calcPath: 'magicCalc',
      heroName,
      heroType: 'magic',
      taintedGroundZoneId: zone.id,
      taintedGroundSlotIndex: zone.slotIndex,
      msg: buildKojonnTaintedGroundLog(heroName, String(enemy.name || '?'), dotTotalDamage),
    });
    firstHit = false;
  }
  state.globals.ActionLockUntil = Math.max(
    Number(state.globals.ActionLockUntil || 0),
    applyAt + 0.42,
  );
  state.globals.DeferAdvance = 1;
  state.globals.AdvanceAfterAction = 1;
  state.globals.ActionOwnerUID = actorUID;
  return true;
}

function queueClusterAoeHits({
  state,
  callFunctionWithContext,
  fnContext,
  actorUID,
  hitCount,
}) {
  const actor = callFunctionWithContext(fnContext, 'GetActorByUID', actorUID);
  if (!actor) return false;
  const enemies = (state.entities || []).filter((entity) => entity && entity.kind === 'enemy' && Number(entity.hp || 0) > 0);
  if (!enemies.length) return false;
  if (String(actor.name || '') === 'Kojonn') {
    return queueKojonnTaintedGroundAoe({
      state,
      callFunctionWithContext,
      fnContext,
      actorUID,
    });
  }
  const mode = actor.attackType === 'magic' ? 'magic' : 'melee';
  let ampMult = Number(callFunctionWithContext(fnContext, 'GetPowerAmpMultiplierForActor', actorUID) || 0);
  if (ampMult > 0) {
    const consumed = Number(callFunctionWithContext(fnContext, 'ConsumePowerAmpForActor', actorUID) || 0);
    if (consumed > 0) ampMult = consumed;
  }
  const ampState = state.globals.PowerAmpByUID || {};
  const ampEntry = ampState[actorUID];
  const ampLifecycleId = Number(ampEntry && ampEntry.lifecycleId || 0);
  state.globals.NextHeroActionProfile = 'aoe';
  callFunctionWithContext(fnContext, 'StartHeroLunge', actorUID);
  state.globals.PendingHeroHits = state.globals.PendingHeroHits || [];
  const now = Number(state.globals.time || 0);
  const applyAt = now + SUPER_GEM_AOE_HIT_DELAY;
  const heroName = getActorName(callFunctionWithContext, fnContext, actorUID);
  let firstHit = true;
  const targetTotals = new Map();
  const queuedHits = [];
  for (let wave = 0; wave < hitCount; wave += 1) {
    for (const enemy of enemies) {
      const dmg = callFunctionWithContext(fnContext, 'CalculateDamage', actorUID, enemy.uid, mode);
      const finalDmg = ampMult > 0 ? Math.max(1, Math.ceil(Number(dmg || 0) * ampMult)) : Math.max(1, Number(dmg || 0));
      const targetUID = Number(enemy.uid || 0);
      if (!targetTotals.has(targetUID)) targetTotals.set(targetUID, finalDmg);
      const shotDamage = Number(splitDamageAcrossHits(finalDmg, hitCount)[wave] || 1);
      queuedHits.push({
        at: applyAt + (wave * SUPER_GEM_HIT_INTERVAL),
        heroUID: actorUID,
        targetUID,
        dmg: shotDamage,
        finalDmg: shotDamage,
        powerAmpMultiplier: firstHit ? ampMult : 0,
        powerAmpLifecycleId: ampLifecycleId,
        consumePowerAmp: ampMult > 0 && firstHit ? 1 : 0,
        calcPath: mode === 'magic' ? 'magicCalc' : 'meleeCalc',
        heroName,
        heroType: mode,
        msg: buildNormalHitLog(heroName, String(enemy.name || '?'), shotDamage),
      });
      firstHit = false;
    }
  }
  const batchId = getNextSuperGemBatchId(state);
  const pendingByTarget = new Map();
  for (let i = queuedHits.length - 1; i >= 0; i -= 1) {
    const hit = queuedHits[i];
    const targetUID = Number(hit.targetUID || 0);
    const seen = Number(pendingByTarget.get(targetUID) || 0);
    const remaining = seen + 1;
    pendingByTarget.set(targetUID, remaining);
    hit.superGemClusterBatchId = batchId;
    hit.superGemClusterVisualOnly = remaining > 1 ? 1 : 0;
    hit.superGemClusterApplyTotalOnHit = remaining === 1 ? Number(targetTotals.get(targetUID) || hit.finalDmg || 0) : 0;
  }
  for (const hit of queuedHits) {
    state.globals.PendingHeroHits.push(hit);
  }
  state.globals.ActionLockUntil = Math.max(
    Number(state.globals.ActionLockUntil || 0),
    applyAt + ((hitCount - 1) * SUPER_GEM_HIT_INTERVAL) + 0.42,
  );
  state.globals.DeferAdvance = 1;
  state.globals.AdvanceAfterAction = 1;
  state.globals.ActionOwnerUID = actorUID;
  return true;
}

export function syncTaintedGroundZones({
  state,
  callFunctionWithContext,
  fnContext,
}) {
  if (!state?.globals || !Array.isArray(state.globals.TaintedGroundZones)) return 0;
  const zones = state.globals.TaintedGroundZones;
  const currentTurnSerial = Number(state.globals.TurnSerial || 0);
  const now = Number(state.globals.time || 0);
  let applied = 0;
  for (let i = zones.length - 1; i >= 0; i -= 1) {
    const zone = zones[i];
    if (!zone) {
      zones.splice(i, 1);
      continue;
    }
    removeDirectBlightCoveredByTaintedGround(state, zone);
    const currentHeroTeamTurnSerial = getHeroTeamTurnSerial(state, zone);
    if (Number(zone.lastSeenHeroTeamTurnSerial ?? zone.createdHeroTeamTurnSerial ?? -1) < currentHeroTeamTurnSerial) {
      const createdHeroTeamTurnSerial = Number(zone.createdHeroTeamTurnSerial ?? currentHeroTeamTurnSerial);
      const expiresAtHeroTeamTurnSerial = Math.max(
        createdHeroTeamTurnSerial + Math.max(1, Number(zone.durationHeroTeamTurns || 1)),
        Number(zone.expiresAtHeroTeamTurnSerial ?? currentHeroTeamTurnSerial),
      );
      zone.remainingTurns = Math.max(0, expiresAtHeroTeamTurnSerial - currentHeroTeamTurnSerial);
      zone.lastSeenTurnSerial = currentTurnSerial;
      zone.lastSeenHeroTeamTurnSerial = currentHeroTeamTurnSerial;
      if (currentHeroTeamTurnSerial >= expiresAtHeroTeamTurnSerial) {
        zone.fadeStartedAt = zone.fadeStartedAt ?? now;
      }
    }
    if (zone.fadeStartedAt != null) {
      removeDirectBlightCoveredByTaintedGround(state, zone);
      if (now - Number(zone.fadeStartedAt || now) >= 0.75) {
        removeTaintedGroundOwnedBlight(state, zone);
        removeDirectBlightCoveredByTaintedGround(state, zone);
        zones.splice(i, 1);
      }
      continue;
    }
    if (now < Number(zone.activeAt || zone.visualStartsAt || 0)) continue;
    const slotIndex = Number(zone.slotIndex || 0);
    const enemy = (state.entities || []).find((entity) => (
      entity
      && entity.kind === 'enemy'
      && Number(entity.hp || 0) > 0
      && getEnemySlotIndex(entity) === slotIndex
    ));
    if (!enemy) continue;
    const enemyUID = Number(enemy.uid || 0);
    if (!(enemyUID > 0)) continue;
    if (!zone.appliedUIDs || typeof zone.appliedUIDs !== 'object') zone.appliedUIDs = {};
    if (zone.appliedUIDs[enemyUID]) continue;
    zone.appliedUIDs[enemyUID] = true;
    callFunctionWithContext(fnContext, 'QueueEnemyDamageOverTime', zone.sourceUID, enemyUID, Math.max(1, Number(zone.dotTotalDamage || 1)), {
      totalTicks: 3,
      firesEveryTurns: 1,
      startAfterTurns: 0,
      cadence: 'turn',
      effectName: 'Blight',
      taintedGroundZoneId: zone.id,
    });
    applied += 1;
  }
  if (zones.length === 0) delete state.globals.TaintedGroundZones;
  return applied;
}

export function armPendingSuperGemAttack({
  superGem,
  actorUID,
  state,
}) {
  if (!superGem || !state || !state.globals || !(actorUID > 0)) return false;
  const color = Number(superGem.baseColor);
  if (color !== 0 && color !== 1) return false;
  const rng = getRuntimeRandom(state);
  const hitCount = randomIntInclusive(3, 5, rng);
  state.globals.PendingSkillID = color === 1 ? 'HERO_SINGLE' : 'HERO_AOE';
  state.globals.PendingActor = Number(actorUID || 0);
  state.globals.PendingSuperGemAction = {
    kind: 'super_gem_attack',
    color,
    hitCount,
    actorUID: Number(actorUID || 0),
  };
  state.globals.HideHeroSelector = 1;
  state.globals.CanPickGems = false;
  return true;
}

export function clearPendingSuperGemAction(state) {
  if (!state?.globals) return;
  state.globals.PendingSuperGemAction = null;
}

export function executePendingSuperGemAction({
  state,
  callFunctionWithContext,
  fnContext,
}) {
  const pending = state?.globals?.PendingSuperGemAction || null;
  if (!pending || pending.kind !== 'super_gem_attack') return false;
  const actorUID = Number(pending.actorUID || 0);
  if (!(actorUID > 0)) return false;
  const color = Number(pending.color);
  const hitCount = Math.max(1, Number(pending.hitCount || 1));
  let activated = false;
  if (color === 1) {
    const targetUID = Number(state.globals.SelectedEnemyUID || 0) || getDefaultSingleTargetUID(state);
    if (!(targetUID > 0)) return false;
    activated = queueClusterSingleHits({
      state,
      callFunctionWithContext,
      fnContext,
      actorUID,
      targetUID,
      hitCount,
    });
  } else if (color === 0) {
    activated = queueClusterAoeHits({
      state,
      callFunctionWithContext,
      fnContext,
      actorUID,
      hitCount,
    });
  }
  if (!activated) return false;
  clearPendingSuperGemAction(state);
  return true;
}

export function activateSuperGemEffect({
  superGem,
  actorUID,
  selectedEnemyUID = 0,
  state,
  callFunctionWithContext,
  fnContext,
  sourceItems = [],
  consumedColorGemCount = 0,
  startGemMergeFx,
  getGoldLabelTargetWorld,
}) {
  if (!superGem || !state || !state.globals) return false;
  const rng = getRuntimeRandom(state);
  const color = Number(superGem.baseColor);
  if (!(actorUID > 0)) return false;
  state.globals.HideHeroSelector = color === 1 ? 0 : 1;
  if (color === 1) {
    const actor = callFunctionWithContext(fnContext, 'GetActorByUID', actorUID);
    if (String(actor && actor.name || '') === 'Falie') {
      grantFalieRedSuperGemPartyShield(state);
      state.globals.CanPickGems = 0;
      state.globals.IsPlayerBusy = 0;
      state.globals.ActionOwnerUID = actorUID;
      state.globals.ActionLockUntil = Math.max(Number(state.globals.ActionLockUntil || 0), Number(state.globals.time || 0) + 0.32);
      state.globals.DeferAdvance = 1;
      state.globals.AdvanceAfterAction = 1;
      return true;
    }
    return armPendingSuperGemAttack({ superGem, actorUID, state });
  }
  if (color === 0) {
    return armPendingSuperGemAttack({ superGem, actorUID, state });
  }
  if (color === 2) {
    if (typeof startGemMergeFx === 'function') {
      startGemMergeFx({ sourceItems });
    }
    const consumedBlue = randomIntInclusive(4, 6, rng);
    callFunctionWithContext(fnContext, 'ResolveGemAction', 2, actorUID, consumedBlue);
    return true;
  }
  if (color === 3) {
    const huunUID = resolveHuunGoldstrikeActorUID({
      state,
      callFunctionWithContext,
      fnContext,
      actorUID,
    });
    if (huunUID > 0) {
      return queueHuunYellowGoldstrike({
        state,
        callFunctionWithContext,
        fnContext,
        actorUID: huunUID,
        selectedEnemyUID,
        consumedColorGemCount,
      });
    }
    const award = randomIntInclusive(8, 16, rng);
    if (typeof startGemMergeFx === 'function') {
      startGemMergeFx({
        target: typeof getGoldLabelTargetWorld === 'function' ? getGoldLabelTargetWorld() : null,
        scaleOut: false,
        sourceItems,
      });
    }
    state.globals.goldTotal = Math.max(0, Number(state.globals.goldTotal || 0)) + award;
    callFunctionWithContext(fnContext, 'LogCombat', `${getActorName(callFunctionWithContext, fnContext, actorUID)} found ${award} gold!`);
    state.globals.CanPickGems = 0;
    state.globals.IsPlayerBusy = 0;
    state.globals.ActionOwnerUID = actorUID;
    state.globals.ActionLockUntil = Math.max(Number(state.globals.ActionLockUntil || 0), Number(state.globals.time || 0) + 0.32);
    state.globals.DeferAdvance = 1;
    state.globals.AdvanceAfterAction = 1;
    return true;
  }
  if (color === 4) {
    if (typeof startGemMergeFx === 'function') {
      startGemMergeFx({ sourceItems });
    }
    callFunctionWithContext(fnContext, 'DoHeal', actorUID, SUPER_GEM_HEAL_POTENCY);
    return true;
  }
  if (color === 5) {
    const purpleGemCost = 1;
    callFunctionWithContext(fnContext, 'ResolvePurpleSuperGemEnergyAction', actorUID, purpleGemCost);
    return true;
  }
  return false;
}

export { SUPER_GEM_COST };
