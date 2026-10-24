// Fixed world-space geometry. Inherited full four-column span:
// (front 22.4 - rear (-22.4 - 2 * 12.8)) * travelSpacing 1.5.
export const HERO_FORMATION_WIDTH = 105.6;
export const HERO_FORMATION_PITCH = HERO_FORMATION_WIDTH / 3;
export const HERO_FORMATION_SLOT_DIAMETER = 32;
export const HERO_FORMATION_LEASH_RADIUS = 0.05 * HERO_FORMATION_SLOT_DIAMETER;
export const HERO_FORMATION_SLOTS = Object.freeze([
  [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2], [2, 2],
].map(([column, row], cell) => Object.freeze({
  cell, column, row,
  x: Number(((column - 1.5) * HERO_FORMATION_PITCH).toFixed(6)),
  y: Number(((row - 1) * HERO_FORMATION_PITCH).toFixed(6)),
})));

// Constrain a proposed foot drift without moving any ally. Oversized bodies
// keep their slot instead of triggering footprint-separation snap-backs.
export function constrainHeroSlotDrift(slot, desired, allies = [], diameter = HERO_FORMATION_SLOT_DIAMETER) {
  const dx = Number(desired.x) - slot.x, dy = Number(desired.y) - slot.y;
  const distance = Math.hypot(dx, dy);
  const radius = Math.min(HERO_FORMATION_LEASH_RADIUS, Math.max(0, diameter) * 0.05);
  const scale = distance > radius ? radius / distance : 1;
  const point = { x: slot.x + (Number.isFinite(dx) ? dx * scale : 0), y: slot.y + (Number.isFinite(dy) ? dy * scale : 0) };
  for (const ally of allies) {
    const required = (diameter + Number(ally.diameter || HERO_FORMATION_SLOT_DIAMETER)) / 2;
    if (Math.hypot(point.x - ally.x, point.y - ally.y) < required - 1e-9) return { ...slot };
  }
  return point;
}
