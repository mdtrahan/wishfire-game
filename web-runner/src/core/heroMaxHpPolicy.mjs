export function fillGearMaxHpGrowth(hp, beforeMaxHp, afterMaxHp) {
  const before = Math.max(0, Math.floor(Number(beforeMaxHp) || 0));
  const after = Math.max(0, Math.floor(Number(afterMaxHp) || 0));
  const current = Math.max(0, Math.floor(Number(hp) || 0));
  return Math.min(after, current > 0 ? current + Math.max(0, after - before) : 0);
}

