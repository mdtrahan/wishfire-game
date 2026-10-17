export const PASSIVE_HERO_REGEN_FRACTION = 0.004;

export function fillGearMaxHpGrowth(hp, beforeMaxHp, afterMaxHp) {
  const before = Math.max(0, Math.floor(Number(beforeMaxHp) || 0));
  const after = Math.max(0, Math.floor(Number(afterMaxHp) || 0));
  const current = Math.max(0, Math.floor(Number(hp) || 0));
  return Math.min(after, current > 0 ? current + Math.max(0, after - before) : 0);
}

export function advancePassiveHeroRegen({ now, lastAt, credits = {}, heroes = [], fraction = PASSIVE_HERO_REGEN_FRACTION }) {
  const time = Number(now);
  if (!Number.isFinite(time) || !Number.isFinite(fraction) || fraction < 0) throw new Error('finite time and nonnegative regeneration required');
  const continuing = Number.isFinite(lastAt) && time >= lastAt;
  const elapsed = continuing ? time - lastAt : 0;
  const nextCredits = {};
  const heals = [];
  for (const hero of heroes) {
    const uid = Number(hero?.uid || 0);
    if (!(uid > 0)) continue;
    const key = String(uid);
    const maxHp = Math.max(0, Math.floor(Number(hero.maxHP) || 0));
    const hp = Math.max(0, Math.floor(Number(hero.hp) || 0));
    if (hp <= 0 || hp >= maxHp) { nextCredits[key] = 0; continue; }
    const credit = (continuing ? Math.max(0, Number(credits[key]) || 0) : 0) + maxHp * fraction * elapsed;
    const amount = Math.min(maxHp - hp, Math.floor(credit + 1e-9));
    nextCredits[key] = hp + amount >= maxHp ? 0 : credit - amount;
    if (amount > 0) heals.push({ uid, amount });
  }
  return { lastAt: time, credits: nextCredits, heals };
}
