export const ENEMY_COMBAT_TIER_PROFILES = Object.freeze({
  fodder: Object.freeze({ HP: 21, ATK: 1, DEF: 1, MAG: 1, RES: 1, SPD: 8 }),
  routine: Object.freeze({ HP: 30, ATK: 2, DEF: 2, MAG: 2, RES: 2, SPD: 8 }),
  hard: Object.freeze({ HP: 62, ATK: 4, DEF: 5, MAG: 4, RES: 5, SPD: 8 }),
  elite: Object.freeze({ HP: 85, ATK: 5, DEF: 7, MAG: 5, RES: 7, SPD: 9 }),
  boss: Object.freeze({ HP: 130, ATK: 6, DEF: 9, MAG: 6, RES: 9, SPD: 10 }),
});

export const ROUTINE_ENEMY_TEMPLATE = ENEMY_COMBAT_TIER_PROFILES.routine;

const MAX_HOSTILE_HIT_FRACTION = Object.freeze({ fodder: 0.05, routine: 0.05, hard: 0.08, elite: 0.12, boss: 0.18 });

export function capContinuousHostileHit(amount, targetMaxHP, enemyRow = {}) {
  const damage = Math.max(0, Number(amount) || 0);
  const maxHP = Number(targetMaxHP);
  if (!Number.isFinite(maxHP) || maxHP <= 0) return damage;
  return Math.min(damage, Math.max(1, Math.floor(maxHP * MAX_HOSTILE_HIT_FRACTION[enemyCombatTier(enemyRow)])));
}

const DURABILITY_BY_TIER = Object.freeze({
  fodder: { hp: 1.4, def: 8, res: 8 },
  routine: { hp: 1.3, def: 10, res: 8 },
  hard: { hp: 1.4, def: 10, res: 12 },
  elite: { hp: 1.6, def: 11, res: 9 },
  boss: { hp: 2.2, def: 12, res: 10 },
});

export function enemyCombatTier(row = {}) {
  const tier = String(row.combatTier || row.routineTier || 'routine').trim().toLowerCase();
  return ENEMY_COMBAT_TIER_PROFILES[tier] ? tier : 'routine';
}

export function scaleRoutineEnemy(row = {}, level = 1) {
  const tier = enemyCombatTier(row);
  const scale = 1 + (Math.max(1, Number(level) || 1) - 1) * .06;
  const durability = DURABILITY_BY_TIER[tier];
  const stats = Object.fromEntries(Object.entries(ENEMY_COMBAT_TIER_PROFILES[tier])
    .map(([key, fallback]) => {
      const authored = Number(row[key] ?? fallback);
      const tuned = key === 'HP' ? authored * durability.hp
        : key === 'DEF' ? Math.min(authored, durability.def)
        : key === 'RES' ? Math.min(authored, durability.res)
        : authored;
      return [key, Math.max(1, Math.floor(tuned * scale))];
    }));
  return { ...row, ...stats, HP: stats.HP, maxHP: stats.HP, combatTier: tier, routineTier: tier };
}
