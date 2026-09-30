import { isHeroBasicTargetInRange } from '../../../src/core/heroAttackTargetingRules.mjs';
import { COMBAT_ARENA_BOUNDS } from '../../../src/core/combatOrientation.mjs';
import { realtimeCooldownSeconds } from './realtimeCooldown.mjs';

const value = number => Number.isFinite(Number(number)) ? Number(number) : 0;
const alive = actor => actor && value(actor.hp) > 0;
const boss = enemy => String(enemy?.enemyRole || enemy?.role || '').toLowerCase() === 'boss';
const point = actor => ({ x: value(actor.x), y: value(actor.y) });
const has = (effects, uid, id, now) => value(effects?.[String(uid)]?.[id]?.expiresAt) > now;
const circle = (enemy, center, radius) => (value(enemy.x) - center.x) ** 2 + (value(enemy.y) - center.y) ** 2 <= radius ** 2;
const rectangle = (enemy, center, width, height) => Math.abs(value(enemy.x) - center.x) <= width / 2 && Math.abs(value(enemy.y) - center.y) <= height / 2;

export function enemiesInSkillShape(enemies, shape) {
  const living = (enemies || []).filter(enemy => isHeroBasicTargetInRange(enemy));
  if (shape?.kind === 'circle') return living.filter(enemy => circle(enemy, shape.center, shape.radius));
  if (shape?.kind === 'rectangle') return living.filter(enemy => rectangle(enemy, shape.center, shape.width, shape.height));
  if (shape?.kind === 'line') {
    const { from, to, width } = shape;
    const dx = to.x - from.x, dy = to.y - from.y, lengthSq = dx * dx + dy * dy;
    return living.filter(enemy => {
      const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((value(enemy.x) - from.x) * dx + (value(enemy.y) - from.y) * dy) / lengthSq)) : 0;
      return (value(enemy.x) - from.x - t * dx) ** 2 + (value(enemy.y) - from.y - t * dy) ** 2 <= (width / 2) ** 2;
    });
  }
  return [];
}

export function selectRealtimeHeroSkillTarget({ skill, hero, heroes = [], enemies = [], effects = {}, zones = [], now = 0, damagedByEnemyUID = 0 } = {}) {
  if (!skill || !alive(hero)) return null;
  const inRange = enemies.filter(enemy => isHeroBasicTargetInRange(enemy));
  const livingHeroes = heroes.filter(alive);
  const first = inRange[0];
  const target = enemy => enemy ? { targetUID: Number(enemy.uid), point: point(enemy) } : null;
  const cluster = (radius, minimum = 2) => first && (boss(first) || inRange.filter(enemy => circle(enemy, point(first), radius)).length >= minimum) ? target(first) : null;
  const active = (uid, id) => has(effects, uid, id, now);
  const readyArea = (radius, predicate) => first && inRange.some(enemy => circle(enemy, point(first), radius) && predicate(enemy)) ? target(first) : null;
  switch (skill.skillId) {
    case 'challenge_bolt': return target(inRange.find(enemy => !active(enemy.uid, 'provoke')));
    case 'shield_relay': {
      if (!first) return null;
      const ally = livingHeroes.filter(actor => actor.uid !== hero.uid && value(actor.hp) / Math.max(1, value(actor.maxHP)) < .75 && !active(actor.uid, 'cover'))
        .sort((a, b) => value(a.hp) / Math.max(1, value(a.maxHP)) - value(b.hp) / Math.max(1, value(b.maxHP)) || heroes.indexOf(a) - heroes.indexOf(b))[0];
      return ally ? { targetUID: Number(ally.uid) } : null;
    }
    case 'brace': return first && value(hero.hp) / Math.max(1, value(hero.maxHP)) < .6 && !active(hero.uid, 'brace') ? { targetUID: Number(hero.uid) } : null;
    case 'retaliation_burst': return target(inRange.find(enemy => Number(enemy.uid) === Number(damagedByEnemyUID)));
    case 'shield_slam': return cluster(skill.radius);
    case 'ambush': return target(inRange.find(enemy => !active(enemy.uid, 'ambush')));
    case 'cheap_shot': return target(inRange.reduce((best, enemy) => !best || value(enemy.stats?.ATK ?? enemy.ATK ?? enemy.atk) > value(best.stats?.ATK ?? best.ATK ?? best.atk) ? enemy : best, null));
    case 'razor_sweep': return first && inRange.filter(enemy => rectangle(enemy, point(first), skill.width, skill.height)).length >= 2 ? target(first) : null;
    case 'piercing_throw': return target(first);
    case 'finish_the_job': return target(inRange.filter(enemy => value(enemy.hp) / Math.max(1, value(enemy.maxHP)) < skill.threshold)
      .sort((a, b) => value(a.hp) / Math.max(1, value(a.maxHP)) - value(b.hp) / Math.max(1, value(b.maxHP)) || inRange.indexOf(a) - inRange.indexOf(b))[0]);
    case 'frost_reversal': return cluster(skill.radius);
    case 'hex_beacon': return readyArea(skill.radius, enemy => !active(enemy.uid, 'hex_beacon'));
    case 'burn_sigil': return zones.some(zone => zone.kind === 'burn_sigil' && value(zone.expiresAt) > now) ? null : cluster(skill.radius);
    case 'null_field': return target(inRange.find(enemy => (enemy.attackType === 'magic' || enemy.streamDelivery === 'ranged' && value(enemy.stats?.MAG ?? enemy.MAG) > value(enemy.stats?.ATK ?? enemy.ATK)) && !active(enemy.uid, 'null_field')));
    case 'return_gate': return target(inRange.filter(enemy => Math.min(skill.teleportDistance, COMBAT_ARENA_BOUNDS.attackStartX - value(enemy.x)) >= skill.minUsefulDistance)
      .sort((a, b) => value(a.x) - value(b.x) || inRange.indexOf(a) - inRange.indexOf(b))[0]);
    case 'wishgrant': return first && (livingHeroes.length >= 2 || inRange.some(boss)) && !livingHeroes.every(actor => active(actor.uid, 'wishgrant')) ? { targetUIDs: livingHeroes.map(actor => Number(actor.uid)) } : null;
    case 'quickload': {
      if (!first) return null;
      const ally = livingHeroes.filter(actor => !active(actor.uid, 'quickload'))
        .sort((a, b) => realtimeCooldownSeconds({ ...b, type: 0 }) - realtimeCooldownSeconds({ ...a, type: 0 }) || heroes.indexOf(a) - heroes.indexOf(b))[0];
      return ally ? { targetUID: Number(ally.uid) } : null;
    }
    case 'split_feed': return first && inRange.some(enemy => inRange.some(other => other !== enemy && circle(other, point(enemy), skill.splashRadius))) && !livingHeroes.every(actor => active(actor.uid, 'split_feed')) ? { targetUIDs: livingHeroes.map(actor => Number(actor.uid)) } : null;
    case 'patchwork': return first && livingHeroes.some(actor => value(actor.hp) / Math.max(1, value(actor.maxHP)) < .75) && !livingHeroes.every(actor => active(actor.uid, 'patchwork')) ? { targetUIDs: livingHeroes.map(actor => Number(actor.uid)) } : null;
    case 'fortunes_blessing': return (inRange.some(boss) || inRange.length >= 3) && !livingHeroes.every(actor => active(actor.uid, 'fortunes_blessing')) ? { targetUIDs: livingHeroes.map(actor => Number(actor.uid)) } : null;
    default: return null;
  }
}
