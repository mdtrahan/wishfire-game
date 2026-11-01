import { createCombatCameraProjection, deriveCombatWorldBounds } from '../../src/core/combatOrientation.mjs';

// Temporary outline-only hazard presentation for step 4. Sprites, HP bars and
// damage numbers use the existing WFM renderer and its current .5 projection.
export function createRustHazardOverlay(canvas, globals) {
  const overlay = document.createElement('canvas');
  overlay.id = 'rust-combat-hazards';
  overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2;background:transparent';
  document.body.append(overlay);
  function draw(snapshot) {
    overlay.hidden = !snapshot;
    if (!snapshot) return;
    const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    overlay.style.left = `${rect.left}px`; overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`; overlay.style.height = `${rect.height}px`;
    overlay.width = Math.round(rect.width * dpr); overlay.height = Math.round(rect.height * dpr);
    const ctx = overlay.getContext('2d'), scale = overlay.width / 360;
    ctx.scale(scale, scale); ctx.beginPath(); ctx.rect(0, 95, 360, 383); ctx.clip();
    const world = deriveCombatWorldBounds();
    const projection = createCombatCameraProjection({ centerX: globals.ContinuousCombatStage?.bossCameraCenterX,
      worldWidth: world.worldWidth, orientation: 'left-wise' });
    for (const hazard of snapshot.hazards) {
      const p = projection.project(hazard.origin.x, hazard.origin.y), s = hazard.shape, z = projection.zoom;
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(z, z);
      ctx.strokeStyle = hazard.hostile ? '#ffaf65' : '#69d8ef'; ctx.lineWidth = 1.5 / z;
      ctx.beginPath();
      if (s.kind === 'circle' || s.kind === 'ring') {
        ctx.arc(0, 0, s.radius ?? s.outer, 0, Math.PI * 2);
        if (s.kind === 'ring') { ctx.moveTo(s.inner, 0); ctx.arc(0, 0, s.inner, 0, Math.PI * 2); }
      } else {
        ctx.rotate(Math.atan2(hazard.dir.y, hazard.dir.x));
        if (s.kind === 'line') ctx.rect(0, -s.width / 2, s.length, s.width);
        else { ctx.moveTo(0, 0); ctx.arc(0, 0, s.length, -s.half_angle_rad, s.half_angle_rad); ctx.closePath(); }
      }
      ctx.stroke(); ctx.restore();
    }
  }
  draw(null);
  return { draw, dispose: () => overlay.remove() };
}
