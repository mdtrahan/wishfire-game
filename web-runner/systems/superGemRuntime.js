const SUPER_GEM_COST = 4;
const SUPER_GEM_HEAL_POTENCY = 6;
const SUPER_GEM_SINGLE_HIT_DELAY = 0.97;
const SUPER_GEM_AOE_HIT_DELAY = 1.07;
const SUPER_GEM_HIT_INTERVAL = 0.2;
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

function buildKojonnBlightLog(heroName, targetName, waveIndex, dotTotalDamage) {
  return `${heroName} seeded blight wave ${waveIndex} on ${targetName || '?'} for ${dotTotalDamage}!`;
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

function queueKojonnClusterBlightAoe({
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
  let ampMult = Number(callFunctionWithContext(fnContext, 'GetPowerAmpMultiplierForActor', actorUID) || 0);
  if (ampMult > 0) {
    const consumed = Number(callFunctionWithContext(fnContext, 'ConsumePowerAmpForActor', actorUID) || 0);
    if (consumed > 0) ampMult = consumed;
  }
  const ampState = state.globals.PowerAmpByUID || {};
  const ampEntry = ampState[actorUID];
  const ampLifecycleId = Number(ampEntry && ampEntry.lifecycleId || 0);
  const baseDotDamage = Math.max(1, Math.floor(Number(callFunctionWithContext(fnContext, 'GetEffectiveStat', actor, 'MAG') || actor.MAG || 0) * 0.75));
  const dotTotalDamage = ampMult > 0 ? Math.max(1, Math.ceil(baseDotDamage * ampMult)) : baseDotDamage;
  state.globals.NextHeroActionProfile = 'aoe';
  callFunctionWithContext(fnContext, 'StartHeroLunge', actorUID);
  state.globals.PendingHeroHits = state.globals.PendingHeroHits || [];
  const now = Number(state.globals.time || 0);
  const applyAt = now + SUPER_GEM_AOE_HIT_DELAY;
  const heroName = getActorName(callFunctionWithContext, fnContext, actorUID);
  const batchId = getNextSuperGemBatchId(state);
  let firstHit = true;
  for (let wave = 0; wave < hitCount; wave += 1) {
    for (const enemy of enemies) {
      state.globals.PendingHeroHits.push({
        at: applyAt + (wave * SUPER_GEM_HIT_INTERVAL),
        heroUID: actorUID,
        targetUID: Number(enemy.uid || 0),
        dmg: 0,
        finalDmg: 0,
        dotTotalDamage,
        powerAmpMultiplier: firstHit ? ampMult : 0,
        powerAmpLifecycleId: ampLifecycleId,
        consumePowerAmp: ampMult > 0 && firstHit ? 1 : 0,
        effectType: 'dot_apply',
        effectName: `Blight Wave ${wave + 1}`,
        calcPath: 'magicCalc',
        heroName,
        heroType: 'magic',
        superGemClusterBatchId: batchId,
        msg: buildKojonnBlightLog(heroName, String(enemy.name || '?'), wave + 1, dotTotalDamage),
      });
      firstHit = false;
    }
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
    return queueKojonnClusterBlightAoe({
      state,
      callFunctionWithContext,
      fnContext,
      actorUID,
      hitCount,
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
    const targetUID = Number(state.globals.SelectedEnemyUID || 0);
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
    callFunctionWithContext(fnContext, 'ArmPowerAmpFixed', actorUID, 5);
    state.globals.ActionLockUntil = Math.max(Number(state.globals.ActionLockUntil || 0), Number(state.globals.time || 0) + 0.6);
    state.globals.DeferAdvance = 1;
    state.globals.AdvanceAfterAction = 1;
    state.globals.ActionOwnerUID = actorUID;
    return true;
  }
  return false;
}

export { SUPER_GEM_COST };
