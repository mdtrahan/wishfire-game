// Crimson Ward temporary HP: each hero owns a separate ward, so a hit drains only the struck
// hero. Presentation timestamps live beside the pool so the renderer only reads.
const n = value => Math.max(0, Number(value) || 0);
const wards = globals => globals.HeroWardHPByUID ||= {};
const visuals = globals => globals.HeroWardVisualByUID ||= {};

export const heroWardHP = (globals, hero) => n(globals?.HeroWardHPByUID?.[String(hero?.uid)]);
// Share of the ward left since the latest cast (0-1): every cast refills the HP bar strip to full,
// whatever the new total, and hits shrink it from there.
export const heroWardShare = (globals, uid) => Math.min(1, n(globals?.HeroWardHPByUID?.[String(uid)]) / Math.max(1, n(globals?.HeroWardPeakByUID?.[String(uid)])));

// Add ward to one hero up to its cap; returns the amount gained.
export function grantHeroWard(globals, hero, amount, cap) {
  const key = String(hero.uid), before = heroWardHP(globals, hero), after = Math.min(n(cap), before + n(amount));
  if (after <= before) return 0;
  wards(globals)[key] = after;
  (globals.HeroWardPeakByUID ||= {})[key] = after;
  if (!(before > 0)) visuals(globals)[key] = { startedAt: n(globals.time), hitAt: null, endedAt: null };
  return after - before;
}

// Drain the struck hero's own ward first; returns the absorbed amount.
export function absorbHeroWard(globals, hero, damage) {
  const key = String(hero.uid), before = heroWardHP(globals, hero), absorbed = Math.min(before, n(damage));
  if (!(absorbed > 0)) return 0;
  const now = n(globals.time), visual = visuals(globals)[key] ||= { startedAt: now, hitAt: null, endedAt: null };
  wards(globals)[key] = before - absorbed;
  visual.hitAt = now;
  if (!(wards(globals)[key] > 0)) { delete wards(globals)[key]; visual.endedAt = now; }
  return absorbed;
}

export function dropHeroWard(globals, hero) {
  const key = String(hero.uid);
  if (!(heroWardHP(globals, hero) > 0)) return;
  delete wards(globals)[key];
  visuals(globals)[key] = { ...visuals(globals)[key], endedAt: n(globals.time) };
}

export function clearHeroWards(globals) {
  if (!globals) return;
  globals.HeroWardHPByUID = {}; globals.HeroWardVisualByUID = {}; globals.HeroWardPeakByUID = {};
  delete globals.HeroWardSourceUID;
}
