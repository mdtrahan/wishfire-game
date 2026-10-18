// Read-only damage accounting. No boss, progression or combat-policy ownership.
export function beginCombatDpsSession(globals) {
  globals.CombatDps = { startedAt: Number(globals.time || 0), totalDamage: 0, hitCount: 0, byHero: {} };
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
  return true;
}

export function combatDpsSnapshot(globals, roster = []) {
  const ledger = globals.CombatDps;
  const now = Number(globals.time || 0);
  const elapsed = Math.max(0, now - Number(ledger?.startedAt ?? now));
  const metric = (total, hits) => ({ total, hits, hitRate: elapsed > 0 ? hits / elapsed : 0 });
  return {
    elapsed,
    party: metric(ledger?.totalDamage || 0, ledger?.hitCount || 0),
    heroes: roster.map(hero => ({ uid: hero.uid, name: hero.name, ...metric(ledger?.byHero[hero.uid]?.total || 0, ledger?.byHero[hero.uid]?.hits || 0) })),
  };
}
