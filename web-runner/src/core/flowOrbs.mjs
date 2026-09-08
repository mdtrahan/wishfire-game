import {FLOW_ORB_TUNING as T} from './heroDefinitions.mjs';
const clampChance = n => Math.max(0, Math.min(1, Number(n) || 0));
const roll = ctx => (ctx.flowRandom || ctx.random)();
const eligible = (actor, origin) => actor.kind === 'hero' && actor.hp > 0 && actor.flowEligible !== false && actor.uid !== origin.flowOwnerUID && !origin.excludedFlowUIDs?.includes(actor.uid);
const excluded = (actor, origin) => origin.flowOwnerUID === actor.uid || origin.excludedFlowUIDs?.includes(actor.uid);

// One record per orb: assignment happens now; the only charge writer runs at collection.
export function spawnFlowOrbs(ctx, source, count, origin = {}, value = T.limitOrbValue, reason = 'attack') {
 if (!Number.isFinite(count) || !Number.isFinite(value) || count <= 0 || value <= 0) return 0;
 const recipients = ctx.actors.filter(actor => eligible(actor, origin));
 if (!recipients.length) return 0;
 const queue = ctx.state.FlowOrbs ||= [];
 for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
  const recipient = recipients[Math.min(recipients.length - 1, Math.floor(roll(ctx) * recipients.length))];
  const id = ctx.state.FlowOrbSerial = (ctx.state.FlowOrbSerial || 0) + 1;
  queue.push({id, recipientUID:recipient.uid, sourceUID:source.uid, sourceKind:source.kind, x:Number(source.x ?? source.originX ?? 200), y:Number(source.y ?? source.originY ?? 140), sourceSlot:source.heroDisplaySlot ?? source.heroIndex, value:Math.max(0, Number(value) || 0), reason, born:Number(ctx.state.time || 0), sessionId:ctx.state.CombatSessionId});
 }
 return Math.max(0, Math.floor(count));
}

export function procFlowPassive(ctx, actor, mode, source, origin = {}, amount = 1, allowLethal = false) {
 if (!actor || actor.kind !== 'hero' || actor.flowMode !== mode || (actor.hp <= 0 && !allowLethal) || amount <= 0 || origin.periodic || excluded(actor, origin)) return 0;
 const config = T.passives[mode];
 if (!config || config.chance == null || (mode === 'Rook' && amount < config.minimumPrevented)) return 0;
 // Slayer intentionally evaluates each kill; all other triggers are once per actor/action.
 const checks = origin.flowChecks ||= new Set();
 const key = `${actor.uid}:${mode}`;
 if (mode !== 'Slayer' && checks.has(key)) return 0;
 checks.add(key);
 const count = (config.guaranteed || 0) + (roll(ctx) < config.chance ? 1 : 0);
 return spawnFlowOrbs(ctx, source, count, origin, T.limitOrbValue, mode);
}

export function attackFlowOrbs(ctx, actor, enemy, skill, origin) {
 if (actor.kind !== 'hero' || enemy.kind !== 'enemy' || origin.periodic) return 0;
 const checks = origin.flowChecks ||= new Set();
 const config = {...T, ...skill};
 if (config.orbChancePer !== 'hit' && checks.has('attack')) return 0;
 checks.add('attack');
 let chance = Number(config.limitOrbDropChance);
 if (!excluded(actor, origin)) {
  if (actor.flowMode === 'Warrior' && skill.skillId === 'basic_attack') chance += T.passives.Warrior.chanceBonus;
  if (actor.flowMode === 'Daredevil' && actor.hp / actor.maxHP <= T.passives.Daredevil.criticalHP) chance += T.passives.Daredevil.chanceBonus;
  if (actor.flowMode === 'Loner' && ctx.actors.filter(a => a.kind === 'hero' && a.hp > 0).length === 1) chance = T.passives.Loner.chance;
 }
 chance += Number(skill.limitOrbChanceBonus || 0);
 const remaining = Math.max(0, Math.floor(config.maxDropsPerAction) - (origin.baseOrbDrops || 0));
 if (!remaining) return 0;
 const guaranteed = checks.has('guaranteed') ? 0 : Math.max(0, Math.floor(config.guaranteedDrops));
 checks.add('guaranteed');
 const count = Math.min(remaining, guaranteed + (roll(ctx) < clampChance(chance) ? Math.max(0, Math.floor(config.limitOrbDropCount)) : 0));
 origin.baseOrbDrops = (origin.baseOrbDrops || 0) + count;
 return spawnFlowOrbs(ctx, enemy, count, origin, config.limitOrbValue);
}

export function advanceFlowOrbs(state, actors, now = Number(state.time || 0)) {
 const lifetime = T.releaseSeconds + T.flightSeconds;
 state.FlowOrbs = (state.FlowOrbs || []).filter(orb => {
  if (orb.sessionId !== state.CombatSessionId) return false;
  const hero = actors.find(a => a.uid === orb.recipientUID);
  if (!hero || hero.hp <= 0 || hero.flowEligible === false) return false;
  if (!orb.collected && now - orb.born >= lifetime) {
   hero.flow = Math.min(T.flowMax, Math.max(0, hero.flow || 0) + orb.value);
   orb.collected = true;
  }
  return now - orb.born < lifetime + T.collectFlashSeconds;
 });
}
