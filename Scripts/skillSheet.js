import { state } from './state.js';

function getGlobals(ctx) {
  return (ctx && ctx.state ? ctx.state.globals : state.globals);
}

export function Party_DEF_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_DEF = Math.min(g.PartyBuffCap_DEF || 0, (g.PartyBuff_DEF || 0) + amt);
  g.BuffTurns_DEF = 0;
  g.BuffText = `BUFF DEF=${g.PartyBuff_DEF}/${g.PartyBuffCap_DEF}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_SPD_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_SPD = Math.min(g.PartyBuffCap_SPD || 0, (g.PartyBuff_SPD || 0) + amt);
  g.BuffTurns_SPD = 0;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_ATK_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_ATK = Math.min(g.PartyBuffCap_ATK || 0, (g.PartyBuff_ATK || 0) + amt);
  g.BuffTurns_ATK = 0;
  g.BuffText = `BUFF ATK=${g.PartyBuff_ATK}/${g.PartyBuffCap_ATK}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_MAG_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_MAG = Math.min(g.PartyBuffCap_MAG || 0, (g.PartyBuff_MAG || 0) + amt);
  g.BuffTurns_MAG = 0;
  g.BuffText = `BUFF MAG=${g.PartyBuff_MAG}/${g.PartyBuffCap_MAG}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_RES_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_RES = Math.min(g.PartyBuffCap_RES || 0, (g.PartyBuff_RES || 0) + amt);
  g.BuffTurns_RES = 0;
  g.BuffText = `BUFF RES=${g.PartyBuff_RES}/${g.PartyBuffCap_RES}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function ApplyPartyHeal(ctx, healAmount) {
  const g = getGlobals(ctx);
  const before = g.PartyHP || 0;
  const desiredHP = Math.min(g.PartyMaxHP || 0, (g.PartyHP || 0) + (healAmount || 0));
  g.PartyHP = desiredHP;
  ctx.callFunction('SyncPartyHPToHeroes');
  ctx.callFunction('UpdateHeroHPUI');
  // Preserve shared party HP after hero HP normalization
  g.PartyHP = desiredHP;
  ctx.callFunction('UpdatePartyHPText');
  ctx.callFunction('UpdatePartyHPBar');
  const delta = Math.max(0, (g.PartyHP || 0) - before);
  if (delta > 0 && !g.SuppressHeroHealText) {
    const positions = g.HeroIconPosByIndex || [];
    for (const pos of positions) {
      if (pos) ctx.callFunction('SpawnDamageText', delta, pos.x, pos.y, 'heal', 'hero');
    }
  }
}

export function DoHeal(ctx, actorUID, potencyMultiplier = 1) {
  const g = getGlobals(ctx);
  const partyMaxHP = Math.max(0, Number(g.PartyMaxHP || 0));
  let heal = Math.max(1, Math.ceil(partyMaxHP * 7 / 100));
  const criticalHealCap = Math.max(1, Math.ceil(partyMaxHP * 40 / 100));
  const potency = Math.max(1, Number(potencyMultiplier || 1));
  if (potency > 1) {
    heal = Math.min(criticalHealCap, Math.max(1, Math.ceil(heal * potency)));
  }
  if (g.ApplyChainToNextHeal === 1) {
    heal = Math.ceil(heal * (g.ChainMultiplier || 1));
    g.ApplyChainToNextHeal = 0;
  }
  const actor = ctx.callFunction('GetActorByUID', actorUID);
  const actorName = actor && actor.name ? actor.name : '?';
  if (actor && actor.name === 'Kojonn') {
    const totalTicks = 3;
    const turnSerialNow = Number(g.TurnSerial || 0);
    const totalHeal = Math.max(1, Math.floor(heal));
    const initialHeal = Math.max(1, Math.floor(totalHeal / totalTicks));
    const remainingHeal = Math.max(0, totalHeal - initialHeal);
    const beforeHP = g.PartyHP || 0;
    const prevSpawn = g.SpawnDamageText;
    const prevHero = g.SuppressHeroHealText;
    g.SpawnDamageText = 0;
    g.SuppressHeroHealText = 1;
    ctx.callFunction('ApplyPartyHeal', initialHeal);
    g.SpawnDamageText = prevSpawn;
    g.SuppressHeroHealText = prevHero;
    const afterHP = g.PartyHP || 0;
    const appliedInitialHeal = Math.max(0, afterHP - beforeHP);
    if (!g.PartyRegens) g.PartyRegens = [];
    for (let i = g.PartyRegens.length - 1; i >= 0; i--) {
      const existing = g.PartyRegens[i];
      if (!existing) continue;
      if (Number(existing.sourceUID || 0) !== Number(actorUID || 0)) continue;
      if (String(existing.effectName || '') !== 'KojonnRegen') continue;
      g.PartyRegens.splice(i, 1);
    }
    if (remainingHeal > 0) {
      g.PartyRegens.push({
        remainingFires: totalTicks - 1,
        totalHealRemaining: remainingHeal,
        cadence: 'turn',
        firesEveryTurns: 1,
        nextFireTurnSerial: turnSerialNow + 1,
        appliedOnTurnSerial: turnSerialNow,
        sourceUID: actorUID,
        effectName: 'KojonnRegen',
        nextFireTick: Number.MAX_SAFE_INTEGER,
      });
    }
    const barPos = g.PartyHPBarPosWorld;
    if (appliedInitialHeal > 0 && barPos && barPos.w > 0 && barPos.h > 0) {
      const left = barPos.x - barPos.w * barPos.ox;
      const barW = barPos.w;
      const barH = barPos.h;
      const ratio = Math.max(0, Math.min(1, (g.PartyHP || 0) / Math.max(1, g.PartyMaxHP || 1)));
      const textX = left + barW * ratio;
      const textY = (barPos.y - barH * barPos.oy) + barH * 0.5;
      ctx.callFunction('SpawnDamageText', appliedInitialHeal, textX, textY, 'heal', 'bar');
    }
    ctx.callFunction('LogCombat', potency > 1 ? `${actorName} applies critical 3-turn Regen!` : `${actorName} applies 3-turn Regen!`);
  } else {
    const beforeHP = g.PartyHP || 0;
    const prevSpawn = g.SpawnDamageText;
    const prevHero = g.SuppressHeroHealText;
    g.SpawnDamageText = 0;
    g.SuppressHeroHealText = 1;
    ctx.callFunction('ApplyPartyHeal', heal);
    g.SpawnDamageText = prevSpawn;
    g.SuppressHeroHealText = prevHero;
    const afterHP = g.PartyHP || 0;
    const totalHeal = Math.max(0, afterHP - beforeHP);
    const barPos = g.PartyHPBarPosWorld;
    if (totalHeal > 0 && barPos && barPos.w > 0 && barPos.h > 0) {
      const left = barPos.x - barPos.w * barPos.ox;
      const barW = barPos.w;
      const barH = barPos.h;
      const ratio = Math.max(0, Math.min(1, (g.PartyHP || 0) / Math.max(1, g.PartyMaxHP || 1)));
      const textX = left + barW * ratio;
      const textY = (barPos.y - barH * barPos.oy) + barH * 0.5;
      ctx.callFunction('SpawnDamageText', totalHeal, textX, textY, 'heal', 'bar');
    }
    ctx.callFunction('LogCombat', potency > 1 ? `${actorName} critically heals party for ${totalHeal}` : `${actorName} heals party for ${totalHeal}`);
  }
  g.ActionLockUntil = (g.time || 0) + (g.DamageTextDurationSec || 1.35);
  g.DeferAdvance = 1;
  g.AdvanceAfterAction = 1;
  g.ActionOwnerUID = actorUID;
}
