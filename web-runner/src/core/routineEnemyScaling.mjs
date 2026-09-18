export const ENEMY_COMBAT_TIER_PROFILES = Object.freeze({
  fodder: Object.freeze({ HP: 21, ATK: 1, DEF: 1, MAG: 1, RES: 1, SPD: 8 }),
  routine: Object.freeze({ HP: 30, ATK: 2, DEF: 2, MAG: 2, RES: 2, SPD: 8 }),
  hard: Object.freeze({ HP: 62, ATK: 4, DEF: 5, MAG: 4, RES: 5, SPD: 8 }),
  elite: Object.freeze({ HP: 85, ATK: 5, DEF: 7, MAG: 5, RES: 7, SPD: 9 }),
  boss: Object.freeze({ HP: 130, ATK: 6, DEF: 9, MAG: 6, RES: 9, SPD: 10 }),
});

export const ROUTINE_ENEMY_TEMPLATE = ENEMY_COMBAT_TIER_PROFILES.routine;

export function enemyCombatTier(row = {}) {
  const tier = String(row.combatTier || row.routineTier || 'routine').trim().toLowerCase();
  return ENEMY_COMBAT_TIER_PROFILES[tier] ? tier : 'routine';
}

export function scaleRoutineEnemy(row = {}, level = 1) {
  const tier = enemyCombatTier(row);
  const scale = 1 + (Math.max(1, Number(level) || 1) - 1) * .06;
  const stats = Object.fromEntries(Object.entries(ENEMY_COMBAT_TIER_PROFILES[tier])
    .map(([key, value]) => [key, Math.max(1, Math.floor(value * scale))]));
  return { ...row, ...stats, HP: stats.HP, maxHP: stats.HP, combatTier: tier, routineTier: tier };
}
