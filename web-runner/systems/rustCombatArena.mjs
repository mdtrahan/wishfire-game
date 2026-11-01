import { deriveCombatWorldBounds, deriveCombatWorldVerticalBounds } from '../../src/core/combatOrientation.mjs';
// Slice camera.rs pixel scale fitted to WFM's unobstructed combat viewport.
export const COMBAT_VIEW = Object.freeze({ left: 0, right: 360, top: 155, bottom: 366, zoom: .5, squash: .75 });
const authoredX = deriveCombatWorldBounds(), authoredY = deriveCombatWorldVerticalBounds();
const height = (COMBAT_VIEW.bottom - COMBAT_VIEW.top) / (COMBAT_VIEW.zoom * COMBAT_VIEW.squash);
export const SLICE_FLOOR = Object.freeze({ min: Object.freeze({ x: 96, y: 40 }), max: Object.freeze({ x: 816, y: 40 + height }) });
export const SLICE_ORIGIN = Object.freeze({ x: 456, y: (SLICE_FLOOR.min.y + SLICE_FLOOR.max.y) / 2 + 80 });
export const SLICE_TRAVEL_SLOTS = Object.freeze([
  { x: -38, y: -120 }, { x: 38, y: -120 }, { x: -38, y: 120 }, { x: 38, y: 120 },
]);
export const COMBAT_PARTY_CAP = 4;
export function sliceHeroPosition(slot) {
  const offset = SLICE_TRAVEL_SLOTS[slot];
  if (!offset) throw new Error('WFM combat: party cap is 4');
  return { x: SLICE_ORIGIN.x + offset.x, y: SLICE_ORIGIN.y + offset.y };
}
// Same source body bounds used by Rust movement, including eight screen pixels at each side.
export function clampSliceSpawn(position, boss = false) {
  const half = boss ? 176 : 112, top = boss ? 370 : 210, bottom = boss ? 40 : 30;
  return { x: Math.max(SLICE_FLOOR.min.x + half, Math.min(SLICE_FLOOR.max.x - half, position.x)),
    y: Math.max(SLICE_FLOOR.min.y + top, Math.min(SLICE_FLOOR.max.y - bottom, position.y)) };
}
// Preserve WFM's seeded pack identities, count, sector receipts and emission time.
export function slicePackPosition(position, boss = false) {
  const x = Math.max(0, Math.min(1, (position.x - authoredX.minX) / (authoredX.maxX - authoredX.minX)));
  const y = Math.max(0, Math.min(1, (position.y - authoredY.minY) / (authoredY.maxY - authoredY.minY)));
  return clampSliceSpawn({ x: SLICE_FLOOR.min.x + x * 720, y: SLICE_FLOOR.min.y + y * height }, boss);
}
