// Read-only damage accounting. No boss, progression or combat-policy ownership.
export const DPS_WINDOW_SECONDS = 5;

export function beginCombatDpsSession(globals) {
  globals.CombatDps = { startedAt: Number(globals.time || 0), totalDamage: 0, hitCount: 0, byHero: {}, hits: [] };
}

export function recordCombatDpsDamage(globals, source, target, damage) {
  if (Number(globals.ContinuousCombatStageLoop) !== 1 || source?.kind !== 'hero' || target?.kind !== 'enemy') return false;
  const amount = Number(damage), uid = Number(source.uid), at = Number(globals.time || 0);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(uid) || uid <= 0 || !Number.isFinite(at)) return false;
  if (!globals.CombatDps) beginCombatDpsSession(globals);
  const ledger = globals.CombatDps;
  ledger.totalDamage += amount;
  ledger.hitCount += 1;
  const hero = ledger.byHero[uid] ||= { total: 0, hits: 0 };
  hero.total += amount;
  hero.hits += 1;
  ledger.hits = ledger.hits.filter(hit => at - hit.at <= DPS_WINDOW_SECONDS);
  ledger.hits.push({ at, uid, damage: amount });
  return true;
}

export function combatDpsSnapshot(globals, roster = []) {
  const ledger = globals.CombatDps;
  const now = Number(globals.time || 0);
  const elapsed = Math.max(0, now - Number(ledger?.startedAt ?? now));
  const window = Math.min(DPS_WINDOW_SECONDS, elapsed);
  const rolling = new Map();
  for (const hit of ledger?.hits || []) {
    if (hit.at <= now && now - hit.at <= DPS_WINDOW_SECONDS) rolling.set(hit.uid, (rolling.get(hit.uid) || 0) + hit.damage);
  }
  const metric = (total, recent, hits) => ({ total, rollingDps: window > 0 ? recent / window : 0, hits });
  return {
    elapsed,
    party: metric(ledger?.totalDamage || 0, [...rolling.values()].reduce((sum, value) => sum + value, 0), ledger?.hitCount || 0),
    heroes: roster.map(hero => ({ uid: hero.uid, name: hero.name, ...metric(ledger?.byHero[hero.uid]?.total || 0, rolling.get(hero.uid) || 0, ledger?.byHero[hero.uid]?.hits || 0) })),
  };
}
