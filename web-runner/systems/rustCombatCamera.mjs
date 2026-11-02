// camera.rs, adapted only to WFM's full-height floor beneath the UI (D13′/D13″).
export const COMBAT_VIEW = Object.freeze({ left: 0, right: 360, top: 42, bottom: 430, zoom: .5, squash: .75 });
// Slice: 1552 world units versus (576 - 52) / (.5 * .75) useful units.
export const ARENA_TO_VIEW_HEIGHT = 1552 / ((576 - 52) / (.5 * .75));
export const CAMERA_MAX_DT = .05;
const MID = (COMBAT_VIEW.top + COMBAT_VIEW.bottom) / 2;
const ZOOM = COMBAT_VIEW.zoom, SQUASH = COMBAT_VIEW.squash;
const OMEGA_X = 3.5, OMEGA_Y = 7, BOSS_ENTRY_Y = 540;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const livingHero = a => a.team === 'hero' && a.hp > 0 && !a.downed && a.state !== 'downed' && a.state !== 'dead';
const livingBoss = a => a.kind.startsWith('boss') && a.hp > 0;
function damp(value, velocity, target, omega, dt) {
  const offset = value - target, decay = Math.exp(-omega * dt), change = (velocity + omega * offset) * dt;
  return [target + (offset + change) * decay, (velocity - omega * change) * decay];
}
function fit(value, low, high, heroLow, heroHigh) {
  return low <= high ? clamp(value, low, high) : heroLow <= heroHigh ? clamp((low + high) / 2, heroLow, heroHigh) : (heroLow + heroHigh) / 2;
}
// Supported UI readers consume the presentation centre, including spotlight framing.
export function resolveCombatCameraCenterX(globals = {}, fallbackX = 0) {
  return globals.RustCombatPresentation?.camera.centreX ?? fallbackX;
}
export function createSliceCombatCamera() {
  let cx = 0, cy = 0, vx = 0, vy = 0, started = false, viewX = null, viewY = null, encounterId = null;
  const point = { x: 0, y: 0 };
  function advance(s, dt) {
    const heroes = s.actors.filter(livingHero);
    if (!heroes.length) { vx = vy = 0; return; }
    const boss = s.actors.find(livingBoss);
    if (boss?.state === 'spawn') { cut(boss); return; }
    const hx = heroes.reduce((sum, a) => sum + a.pos.x, 0) / heroes.length;
    const hy = heroes.reduce((sum, a) => sum + a.pos.y, 0) / heroes.length;
    let nearest = { x: hx, y: hy }, best = Infinity;
    const threats = s.actors.filter(a => a.team === 'enemy' && a.hp > 0).map(a => a.pos)
      .concat(s.hazards.filter(h => h.kind === 'spawn_marker').map(h => h.origin));
    for (const p of threats) { const d = (p.x - hx) ** 2 + (p.y - hy) ** 2; if (d < best) { best = d; nearest = p; } }
    const tx = hx + clamp((nearest.x - hx) * .3, -40, 40), ty = hy + clamp((nearest.y - hy) * .3, -180, 180) - 50;
    [cx, vx] = damp(cx, vx, tx, OMEGA_X, dt); [cy, vy] = damp(cy, vy, ty, OMEGA_Y, dt);
    const floor = s.geometry.floor, halfX = 180 / ZOOM, halfY = (COMBAT_VIEW.bottom - COMBAT_VIEW.top) / (2 * ZOOM * SQUASH);
    cx = floor.max.x - floor.min.x < halfX * 2 ? (floor.min.x + floor.max.x) / 2 : clamp(cx, floor.min.x + halfX, floor.max.x - halfX);
    cy = floor.max.y - floor.min.y < halfY * 2 ? (floor.min.y + floor.max.y) / 2 : clamp(cy, floor.min.y + halfY, floor.max.y - halfY);
    let minX = Math.min(...heroes.map(a => a.pos.x - 96)), maxX = Math.max(...heroes.map(a => a.pos.x + 96));
    let minY = Math.min(...heroes.map(a => a.pos.y - 210)), maxY = Math.max(...heroes.map(a => a.pos.y + 30));
    const heroMinX = minX, heroMaxX = maxX, heroMinY = minY, heroMaxY = maxY;
    if (boss) { minX = Math.min(minX, boss.pos.x - 160); maxX = Math.max(maxX, boss.pos.x + 160); minY = Math.min(minY, boss.pos.y - 370); maxY = Math.max(maxY, boss.pos.y + 40); }
    // Body safety can exceed the floor clamp, as in the slice; ground overscans beneath UI.
    const halfWidth = (180 - 8) / ZOOM, below = (COMBAT_VIEW.bottom - MID) / (ZOOM * SQUASH), above = (MID - COMBAT_VIEW.top) / (ZOOM * SQUASH);
    const x = fit(cx, maxX - halfWidth, minX + halfWidth, heroMaxX - halfWidth, heroMinX + halfWidth);
    const y = fit(cy, maxY - below, minY + above, heroMaxY - below, heroMinY + above);
    if (x !== cx) vx = 0; if (y !== cy) vy = 0; cx = x; cy = y;
  }
  function cut(boss) { cx = boss.pos.x; cy = boss.pos.y + BOSS_ENTRY_Y; vx = vy = 0; camera.zoom = ZOOM; }
  const camera = {
    zoom: ZOOM, offsetX: 0, offsetY: 0,
    get centreX() { return viewX ?? cx; }, get centreY() { return viewY ?? cy; },
    frame(x, y, z) { viewX = x; viewY = y; camera.zoom = z; },
    update(s, dt, events = []) {
      viewX = viewY = null; camera.zoom = ZOOM;
      if (encounterId !== s.encounter_id) { camera.reset(); encounterId = s.encounter_id; }
      if (!started) {
        cx = s.camera_focus.x; cy = s.camera_focus.y; vx = vy = 0; started = true;
        advance(s, 1); // WorldCamera::new performs one second of initial settling.
      }
      const arrival = events.find(e => e.body.kind === 'spawned' && e.body.data.kind.startsWith('boss'));
      if (arrival) { const boss = s.actors.find(a => a.actor_id === arrival.body.data.actor); if (boss) cut(boss); }
      if (dt <= 0 || s.spotlight || s.hit_stop) return;
      advance(s, dt);
    },
    x(x) { return (x - camera.centreX) * camera.zoom + 180 + camera.offsetX; },
    y(y) { return (y - camera.centreY) * camera.zoom * SQUASH + MID + camera.offsetY; },
    project(x, y) { point.x = camera.x(x); point.y = camera.y(y); return point; },
    reset() { viewX = viewY = null; started = false; vx = vy = 0; camera.zoom = ZOOM; camera.offsetX = camera.offsetY = 0; },
  };
  return camera;
}
