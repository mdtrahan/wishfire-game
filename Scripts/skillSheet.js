import { state } from './state.js';

function getGlobals(ctx) {
  return (ctx && ctx.state ? ctx.state.globals : state.globals);
}
function clampBuffDuration(turns) {
  return Math.min(12, Math.max(0, Math.trunc(Number(turns) || 0)));
}

export function Party_DEF_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_DEF = Math.min(g.PartyBuffCap_DEF || 0, (g.PartyBuff_DEF || 0) + amt);
  if ((g.BuffTurns_DEF || 0) <= 0) g.BuffTurns_DEF = clampBuffDuration(turns);
  g.BuffText = `BUFF DEF=${g.PartyBuff_DEF}/${g.PartyBuffCap_DEF}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_SPD_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_SPD = Math.min(g.PartyBuffCap_SPD || 0, (g.PartyBuff_SPD || 0) + amt);
  if ((g.BuffTurns_SPD || 0) <= 0) g.BuffTurns_SPD = clampBuffDuration(turns);
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_ATK_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_ATK = Math.min(g.PartyBuffCap_ATK || 0, (g.PartyBuff_ATK || 0) + amt);
  if ((g.BuffTurns_ATK || 0) <= 0) g.BuffTurns_ATK = clampBuffDuration(turns);
  g.BuffText = `BUFF ATK=${g.PartyBuff_ATK}/${g.PartyBuffCap_ATK}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_MAG_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_MAG = Math.min(g.PartyBuffCap_MAG || 0, (g.PartyBuff_MAG || 0) + amt);
  if ((g.BuffTurns_MAG || 0) <= 0) g.BuffTurns_MAG = clampBuffDuration(turns);
  g.BuffText = `BUFF MAG=${g.PartyBuff_MAG}/${g.PartyBuffCap_MAG}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function Party_RES_UP(ctx, turns, actorUID, actorType, addAmt) {
  const g = getGlobals(ctx);
  const amt = Math.trunc(addAmt || 0);
  g.PartyBuff_RES = Math.min(g.PartyBuffCap_RES || 0, (g.PartyBuff_RES || 0) + amt);
  if ((g.BuffTurns_RES || 0) <= 0) g.BuffTurns_RES = clampBuffDuration(turns);
  g.BuffText = `BUFF RES=${g.PartyBuff_RES}/${g.PartyBuffCap_RES}`;
  ctx.callFunction('Update_Bars');
  ctx.callFunction('RefreshPartyBuffUI');
}

export function ApplyPartyHeal(ctx, healAmount) {
  const g = getGlobals(ctx);
  const before = g.PartyHP || 0;
  const desiredHP = Math.min(g.PartyMaxHP || 0, (g.PartyHP || 0) + (healAmount || 0));
  g.PartyHP = desiredHP;
  console.log(`[REGEN] ApplyPartyHeal amount=${healAmount} before=${before} after=${g.PartyHP} max=${g.PartyMaxHP}`);
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

export function DoHeal(ctx, actorUID) {
  let heal = ctx.callFunction('CalculateHeal', actorUID);
  const g = getGlobals(ctx);
  if (g.ApplyChainToNextHeal === 1) {
    heal = Math.ceil(heal * (g.ChainMultiplier || 1));
    g.ApplyChainToNextHeal = 0;
  }
  const actor = ctx.callFunction('GetActorByUID', actorUID);
  const actorName = actor && actor.name ? actor.name : '?';
  if (actor && actor.name === 'Kojonn') {
    const totalTicks = 8;
    const nowTick = getGlobals(ctx).RegenTickCounter || 0;
    console.log(`[REGEN] start actor=${actorName} totalHeal=${Math.round(heal)} ticks=${totalTicks}`);
    if (!g.PartyRegens) g.PartyRegens = [];
    g.PartyRegens.push({
      remainingFires: totalTicks,
      totalHealRemaining: Math.max(1, Math.floor(heal)),
      firesEveryTicks: 1,
      nextFireTick: nowTick + 1,
      sourceUID: actorUID
    });
    ctx.callFunction('LogCombat', `${actorName} applies Regen over time!`);
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
    ctx.callFunction('LogCombat', `${actorName} heals party for ${totalHeal}`);
  }
  g.ActionLockUntil = (g.time || 0) + (g.DamageTextDurationSec || 1.35);
  g.DeferAdvance = 1;
  g.AdvanceAfterAction = 1;
  g.ActionOwnerUID = actorUID;
}
