const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// CP is derived capability, never authored data.  It deliberately accepts the
// former positional shape while runtime callers move to a full stat projection.
export function computeCombatPower(actorOrAtk = {}, legacyDef = 0, legacyHp = 0) {
  const actor = actorOrAtk && typeof actorOrAtk === 'object'
    ? actorOrAtk
    : { ATK: actorOrAtk, DEF: legacyDef, HP: legacyHp };
  const stats = actor.stats || actor;
  const level = Math.max(1, Math.floor(number(actor.level ?? actor.currentLevel ?? 1)));
  const atk = Math.max(0, number(stats.ATK ?? actor.atk));
  const mag = Math.max(0, number(stats.MAG ?? actor.mag));
  const def = Math.max(0, number(stats.DEF ?? actor.def));
  const res = Math.max(0, number(stats.RES ?? actor.res));
  const hp = Math.max(1, number(stats.HP ?? actor.maxHP ?? actor.hp));
  const spd = Math.max(0, number(stats.SPD ?? actor.spd));
  const guard = 20 + (1.5 * (level - 1));
  const benchmark = 7 + (0.9 * (level - 1));
  const offense = Math.max(atk, mag);
  const neutralHit = (2 + (0.48 * offense)) * guard / (guard + benchmark);
  const actionRate = clamp(spd / 10, 0.6, 1.8);
  const effectiveHP = hp * (1 + (((def + res) / 2) / guard));
  const kit = actor.kit || {};
  const expectedDirect = number(kit.directDamage ?? neutralHit);
  const crit = expectedDirect * clamp(number(kit.critChance ?? 0.01), 0, 1) * (clamp(number(kit.critMultiplier ?? 1.25), 1, 3) - 1);
  const aoe = Math.max(0, number(kit.aoeDamage)) * Math.max(0, number(kit.extraTargets));
  const sustain = 0.6 * Math.max(0, number(kit.heal) + number(kit.shield));
  const control = Math.max(0, number(kit.control));
  const proc = Math.max(0, number(kit.proc));
  const af = Math.max(0, number(kit.afValue));
  const sequence = clamp(Math.floor(number(kit.sequenceActions ?? 1)), 1, 2);
  const value = (5 * actionRate * ((expectedDirect + crit + aoe + sustain + control + proc + af) * sequence)) + (effectiveHP / 4);
  return Math.round(value * 10) / 10;
}

export function computeEncounterCombatPower(actors = []) {
  const values = (Array.isArray(actors) ? actors : []).map(computeCombatPower);
  return Math.round(values.reduce((total, value) => total + value, 0) * (1 + (0.05 * Math.max(0, values.length - 1))) * 10) / 10;
}
