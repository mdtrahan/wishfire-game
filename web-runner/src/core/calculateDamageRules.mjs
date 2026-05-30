function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function unitIntervalOrHalf(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 && normalized < 1 ? normalized : 0.5;
}

function ceilAtLeastOne(value) {
  return Math.max(1, Math.ceil(numberOr(value, 0)));
}

export function calculateDamageFromJs({
  power = 0,
  resist = 0,
  roll01 = 0.5,
  critRoll01 = 0.5,
  sourceIsHero = 0,
  heroAoe = 0,
  chainActive = 0,
  chainMultiplier = 1,
} = {}) {
  const powerValue = numberOr(power, 0);
  const resistValue = numberOr(resist, 0);
  const isHero = Number(sourceIsHero || 0) === 1;
  const isHeroAoe = Number(heroAoe || 0) === 1;
  const roll = 0.8 + (unitIntervalOrHalf(roll01) * 0.4);
  const rawDamage = isHero && !isHeroAoe
    ? (powerValue - (resistValue * 0.35)) * roll
    : (powerValue - (resistValue / 2)) * roll;
  const baseDamage = ceilAtLeastOne(rawDamage);
  const buff = Math.max(0, powerValue);
  let critMultiplierRaw = 1.1;
  if (buff > 0) {
    critMultiplierRaw = Math.min(1 + (buff / 10), 3);
  }
  critMultiplierRaw = Math.min(3, critMultiplierRaw);
  const critMultiplier = isHero
    ? critMultiplierRaw
    : 1 + ((critMultiplierRaw - 1) * 0.1);
  const didCrit = numberOr(critRoll01, 0) <= 0.1;
  const postCritDamage = ceilAtLeastOne(didCrit ? baseDamage * critMultiplier : baseDamage);
  const shouldChain = isHero && Number(chainActive || 0) === 1;
  const multiplier = numberOr(chainMultiplier, 1) || 1;
  const damage = shouldChain ? ceilAtLeastOne(postCritDamage * multiplier) : postCritDamage;

  return {
    damage,
    baseDamage,
    postCritDamage,
    didCrit,
    critMultiplier,
    roll,
  };
}
