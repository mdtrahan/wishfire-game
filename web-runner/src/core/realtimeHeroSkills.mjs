import { heroDefinition, heroKey, heroSkillUnlocked } from './heroDefinitions.mjs';
import { enemiesInSkillShape } from './realtimeHeroTargeting.mjs';
import { isHeroBasicTargetInRange } from '../../../src/core/heroAttackTargetingRules.mjs';

const nowOf = globals => Number(globals.time || 0);
const living = actor => actor && Number(actor.hp || 0) > 0;
const point = actor => ({ x: Number(actor?.x || 0), y: Number(actor?.y || 0) });
const actors = (ctx, kind) => ctx.state.entities.filter(actor => actor?.kind === kind && living(actor));
const actor = (ctx, uid) => ctx.state.entities.find(entry => Number(entry?.uid || 0) === Number(uid || 0));
const state = globals => globals.RealtimeSkillEffects ||= {};
const effect = (globals, uid, id) => {
  const entry = state(globals)[String(uid)]?.[id];
  return entry && Number(entry.expiresAt || 0) > nowOf(globals) ? entry : null;
};
const grant = (globals, uid, id, seconds, extra = {}) => {
  const effects = state(globals);
  (effects[String(uid)] ||= {})[id] = { expiresAt: nowOf(globals) + seconds, ...extra };
};
const inRangeEnemies = ctx => actors(ctx, 'enemy').filter(enemy => isHeroBasicTargetInRange(enemy));
const skillDamage = (ctx, source, target, pct, mode) => {
  if (!isHeroBasicTargetInRange(target)) return 0;
  const damage = ctx.callFunction('CalculateDamage', source.uid, target.uid, mode, pct);
  return ctx.callFunction('ApplyDamageToTarget', target.uid, damage, { sourceUID: source.uid, suppressPartySkillHitHooks: 1 }) || 0;
};
const hitArea = (ctx, source, shape, pct, mode) => enemiesInSkillShape(actors(ctx, 'enemy'), shape)
  .map(target => ({ target, damage: skillDamage(ctx, source, target, pct, mode) }));
const skillElement = Object.freeze({
  challenge_bolt: 'mark', shield_relay: 'light', brace: 'metal', retaliation_burst: 'earth', shield_slam: 'wind',
  ambush: 'dark', cheap_shot: 'metal', razor_sweep: 'wind', piercing_throw: 'metal', finish_the_job: 'blood',
  frost_reversal: 'ice', hex_beacon: 'dark', burn_sigil: 'fire', null_field: 'void', return_gate: 'arcane',
  wishgrant: 'light', quickload: 'lightning', split_feed: 'wind', patchwork: 'bloom', fortunes_blessing: 'mark',
});

export function realtimeEffect(globals, uid, id) { return effect(globals, uid, id); }

export function realtimeStatMultiplier(globals, target, stat) {
  if (Number(globals.ContinuousCombatStageLoop || 0) !== 1) return 1;
  let multiplier = 1;
  if (target.kind === 'hero' && effect(globals, target.uid, 'fortunes_blessing')?.stat === stat) multiplier *= 1.25;
  if (target.kind === 'enemy' && stat === 'RES' && effect(globals, target.uid, 'hex_beacon')) multiplier *= .75;
  return multiplier;
}

export function realtimeBasicInterval(globals, hero, ordinarySeconds) {
  return effect(globals, hero.uid, 'quickload') ? .4 : ordinarySeconds;
}

export function realtimeProvokeTarget(ctx, enemy, preferred) {
  const globals = ctx.state.globals;
  const provoke = effect(globals, enemy?.uid, 'provoke');
  const fara = provoke && actor(ctx, provoke.heroUID);
  return living(fara) && fara.kind === 'hero' ? fara : preferred;
}

export function realtimeCoverTarget(ctx, target) {
  const globals = ctx.state.globals;
  const cover = target?.kind === 'hero' && effect(globals, target.uid, 'cover');
  const fara = cover && actor(ctx, cover.heroUID);
  if (!living(fara) || fara.uid === target.uid) return target;
  if (--cover.charges <= 0) delete state(globals)[String(target.uid)].cover;
  return fara;
}

export function realtimeIncomingDamage(ctx, target, source, damage) {
  const globals = ctx.state.globals;
  if (Number(globals.ContinuousCombatStageLoop || 0) !== 1 || target?.kind !== 'hero' || source?.kind !== 'enemy') return damage;
  const brace = effect(globals, target.uid, 'brace');
  if (!brace) return damage;
  if (--brace.charges <= 0) delete state(globals)[String(target.uid)].brace;
  return Math.max(0, Math.floor(damage * .5));
}

export function realtimeMagicBlocked(globals, enemy) {
  if (Number(globals.ContinuousCombatStageLoop || 0) !== 1) return false;
  return !!effect(globals, enemy?.uid, 'null_field');
}

export function castRealtimeHeroSkill(ctx, heroUID, skill, selection, displacement = {}) {
  const globals = ctx.state.globals, source = actor(ctx, heroUID);
  if (!living(source) || !skill || !selection || !heroSkillUnlocked(source, skill)) return false;
  const now = nowOf(globals), mode = heroKey(source) === 'Runa' ? 'magic' : source.attackType === 'magic' ? 'magic' : 'melee';
  const target = actor(ctx, selection.targetUID);
  if (target?.kind === 'enemy' && !isHeroBasicTargetInRange(target)) return false;
  const targets = (selection.targetUIDs || []).map(uid => actor(ctx, uid)).filter(living);
  const center = selection.point || (target && point(target));
  const circle = radius => ({ kind: 'circle', center, radius });
  const damage = (victim, pct = skill.damagePct) => skillDamage(ctx, source, victim, pct, mode);
  const area = (shape, pct = skill.damagePct) => hitArea(ctx, source, shape, pct, mode);
  let castFeedback = '';
  switch (skill.skillId) {
    case 'challenge_bolt':
      damage(target); grant(globals, target.uid, 'provoke', skill.durationSeconds, { heroUID: source.uid }); break;
    case 'shield_relay':
      grant(globals, target.uid, 'cover', skill.durationSeconds, { heroUID: source.uid, charges: skill.charges }); break;
    case 'brace':
      grant(globals, source.uid, 'brace', skill.durationSeconds, { charges: skill.charges }); break;
    case 'retaliation_burst': area(circle(skill.radius)); break;
    case 'shield_slam':
      for (const hit of area(circle(skill.radius))) displacement.push?.(hit.target, skill.pushDistance, now);
      break;
    case 'ambush':
      damage(target); if (living(target)) grant(globals, target.uid, 'ambush', skill.durationSeconds, { heroUID: source.uid, charges: skill.charges, bonusPct: skill.bonusPct }); break;
    case 'cheap_shot': {
      damage(target);
      const key = String(target.uid), clocks = globals.RealtimeEnemyActionReadyAt ||= {};
      clocks[key] = Math.max(now, Number(clocks[key] || now)) + skill.attackDelaySeconds;
      const ongoing = globals.RealtimeEnemyActionsByUID?.[key];
      if (ongoing?.active) ongoing.nextReadyAt = Math.max(Number(ongoing.nextReadyAt || now), clocks[key]);
      break;
    }
    case 'razor_sweep': area({ kind: 'rectangle', center, width: skill.width, height: skill.height }); break;
    case 'piercing_throw': area({ kind: 'line', from: point(source), to: { x: center.x + skill.beyond, y: center.y }, width: skill.lineWidth }); break;
    case 'finish_the_job': {
      const before = Number(target.hp || 0), dealt = damage(target);
      if (before > 0 && !living(target)) for (const hit of enemiesInSkillShape(actors(ctx, 'enemy'), circle(skill.splashRadius))) damage(hit, skill.splashPct);
      break;
    }
    case 'frost_reversal':
      for (const hit of area(circle(skill.radius))) displacement.reverse?.(hit.target, now, skill.durationSeconds);
      break;
    case 'hex_beacon':
      for (const enemy of enemiesInSkillShape(actors(ctx, 'enemy'), circle(skill.radius))) grant(globals, enemy.uid, 'hex_beacon', skill.durationSeconds);
      break;
    case 'burn_sigil':
      (globals.RealtimeSkillZones ||= []).push({ kind: skill.skillId, sourceUID: source.uid, point: center, radius: skill.radius,
        expiresAt: now + skill.durationSeconds, nextTickAt: now + 1, damagePct: skill.damagePctPerSecond });
      break;
    case 'null_field':
      for (const enemy of enemiesInSkillShape(actors(ctx, 'enemy'), circle(skill.radius))) grant(globals, enemy.uid, 'null_field', skill.durationSeconds);
      break;
    case 'return_gate': displacement.teleport?.(target, skill.teleportDistance, now); break;
    case 'wishgrant':
      for (const ally of targets) grant(globals, ally.uid, 'wishgrant', skill.durationSeconds, { charges: skill.charges, damagePct: skill.basicDamagePct });
      break;
    case 'quickload': {
      grant(globals, target.uid, 'quickload', skill.durationSeconds);
      const clock = globals.RealtimeHeroBasicClocks?.[String(target.uid)];
      if (clock) clock.basicReadyAt = Math.min(Number(clock.basicReadyAt || now + .4), now + .4);
      break;
    }
    case 'split_feed':
    case 'patchwork':
      for (const ally of targets) grant(globals, ally.uid, skill.skillId, skill.durationSeconds,
        skill.skillId === 'split_feed' ? { splashPct: skill.splashPct, splashRadius: skill.splashRadius } : { healPctMaxHP: skill.healPctMaxHP });
      break;
    case 'fortunes_blessing': {
      if (typeof globals.RuntimeRandom !== 'function') return false;
      const random = globals.RuntimeRandom();
      const stat = skill.randomStats[Math.min(skill.randomStats.length - 1, Math.floor(random * skill.randomStats.length))];
      for (const ally of targets) grant(globals, ally.uid, 'fortunes_blessing', skill.durationSeconds, { stat });
      castFeedback = ` (${stat} +25%)`;
      break;
    }
    default: return false;
  }
  globals.LastRealtimeHeroSkill = { heroUID: source.uid, skillId: skill.skillId, at: now, targetUID: target?.uid || 0, feedback: castFeedback };
  for (const recipient of targets.length ? targets : [target || source]) {
    (globals.CombatImpactRequests ||= []).push({ at: now, heroUID: source.uid,
      targetUID: recipient.uid, ...(recipient.kind === 'enemy' ? { point: center } : {}),
      skillId: skill.skillId, elementalSlug: skillElement[skill.skillId], damage: skill.damagePct || 0 });
  }
  ctx.callFunction('LogCombat', `${heroDefinition(source)?.name || source.name}: ${skill.displayName}${castFeedback}`);
  return true;
}

export function tickRealtimeHeroSkillZones(ctx) {
  const globals = ctx.state.globals, now = nowOf(globals), zones = globals.RealtimeSkillZones || [];
  for (const zone of zones) {
    if (zone.kind !== 'burn_sigil' || Number(zone.nextTickAt || 0) > now) continue;
    const source = actor(ctx, zone.sourceUID);
    while (Number(zone.nextTickAt || 0) <= Math.min(now, Number(zone.expiresAt || 0))) {
      if (source) hitArea(ctx, source, { kind: 'circle', center: zone.point, radius: zone.radius }, zone.damagePct, 'magic');
      zone.nextTickAt += 1;
    }
  }
  globals.RealtimeSkillZones = zones.filter(zone => zone.expiresAt > now);
  for (const [uid, effects] of Object.entries(state(globals))) {
    for (const [id, entry] of Object.entries(effects)) if (Number(entry.expiresAt || 0) <= now) delete effects[id];
    if (!Object.keys(effects).length) delete state(globals)[uid];
  }
}

export function realtimeBasicDamageMultiplier(globals, source, target) {
  let multiplier = 1;
  const wish = effect(globals, source.uid, 'wishgrant');
  if (wish) multiplier *= Number(wish.damagePct || 330) / 100;
  const ambush = effect(globals, target.uid, 'ambush');
  if (ambush && Number(ambush.heroUID) === Number(source.uid)) {
    multiplier *= 1 + Number(ambush.bonusPct || 20) / 100;
  }
  return multiplier;
}

export function realtimeBasicFollowups(ctx, source, target, damage) {
  if (damage <= 0) return;
  const globals = ctx.state.globals;
  for (const [uid, id] of [[source.uid, 'wishgrant'], [target.uid, 'ambush']]) {
    const buff = effect(globals, uid, id);
    if (buff && (id !== 'ambush' || Number(buff.heroUID) === Number(source.uid)) && --buff.charges <= 0) delete state(globals)[String(uid)][id];
  }
  const splash = effect(globals, source.uid, 'split_feed');
  if (splash) {
    for (const enemy of enemiesInSkillShape(actors(ctx, 'enemy'), { kind: 'circle', center: point(target), radius: splash.splashRadius })) {
      if (enemy.uid !== target.uid) ctx.callFunction('ApplyDamageToTarget', enemy.uid, Math.max(1, Math.floor(damage * splash.splashPct / 100)), { sourceUID: source.uid, suppressPartySkillHitHooks: 1 });
    }
  }
  const patchwork = effect(globals, source.uid, 'patchwork');
  if (patchwork && living(source)) {
    const before = Number(source.hp || 0);
    source.hp = Math.min(Number(source.maxHP || before), before + Math.max(1, Math.floor(Number(source.maxHP || 0) * patchwork.healPctMaxHP / 100)));
    if (source.hp > before) ctx.callFunction('UpdateHeroHPUI');
  }
}

export function realtimeRetaliation(ctx, damagedHero, attackerUID, displacement = {}) {
  const globals = ctx.state.globals;
  if (heroKey(damagedHero) !== 'Falie' || Number(globals.ContinuousCombatStageLoop || 0) !== 1) return false;
  const skill = heroDefinition(damagedHero)?.actives.find(entry => entry.skillId === 'retaliation_burst');
  const clock = globals.RealtimeHeroBasicClocks?.[String(damagedHero.uid)];
  if (!skill || !clock || Number(clock.skillReadyAt?.retaliation_burst || 0) > nowOf(globals)) return false;
  const attacker = actor(ctx, attackerUID);
  if (!living(attacker) || !isHeroBasicTargetInRange(attacker)) return false;
  const cast = castRealtimeHeroSkill(ctx, damagedHero.uid, skill, { targetUID: attacker.uid, point: point(attacker) }, displacement);
  if (cast) (clock.skillReadyAt ||= {}).retaliation_burst = nowOf(globals) + skill.cooldownSeconds;
  return cast;
}
