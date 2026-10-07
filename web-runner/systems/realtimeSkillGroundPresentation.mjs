import { activeCombatEffect } from '../../src/core/combatModifierRules.mjs';

const cues = { cover: '#e2bc64', destiny: '#57ae80', blight: '#9a62b3' };
const feet = actor => Number.isFinite(actor?.footX) && Number.isFinite(actor?.footY)
  ? { x: actor.footX, y: actor.footY } : null;
const living = actor => Number(actor?.hp || 0) > 0;

// Pure presentation: the combat clock and committed records own every lifetime.
export function renderRealtimeSkillGroundVfx(ctx, { state, worldToCanvas, layoutScale = 1 }) {
  const g = state.globals || {}, now = Number(g.time || 0);
  if (Number(g.ContinuousCombatStageLoop) !== 1) return;
  const actors = new Map((state.entities || []).filter(Boolean).map(actor => [Number(actor.uid), actor]));
  ctx.save();
  ctx.lineWidth = Math.max(.75, 1.4 * layoutScale);
  for (const zone of g.RealtimeSkillZones || []) {
    if (zone.kind !== 'burn_sigil' || !activeCombatEffect(zone, now)
      || !living(actors.get(Number(zone.sourceUID))) || !Number.isFinite(zone.point?.x)
      || !Number.isFinite(zone.point?.y) || !(zone.radius > 0)) continue;
    const p = worldToCanvas(zone.point.x, zone.point.y, 'enemy'), r = zone.radius * layoutScale;
    ctx.strokeStyle = '#cc704b'; ctx.fillStyle = 'rgba(213,104,55,0.06)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r * .8, r * .8, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * r * .83, p.y + Math.sin(a) * r * .83);
      ctx.lineTo(p.x + Math.cos(a) * r * .95, p.y + Math.sin(a) * r * .95); ctx.stroke();
    }
  }
  for (const [uid, effects] of Object.entries(g.RealtimeSkillEffects || {})) {
    const target = actors.get(Number(uid)), point = feet(target);
    if (!living(target) || !point) continue;
    const active = Object.entries(effects).filter(([id, effect]) => cues[id] && activeCombatEffect(effect, now)
      && (id !== 'cover' || living(actors.get(Number(effect.sourceUID)))));
    if (!active.length) continue;
    const p = worldToCanvas(point.x, point.y, target.kind);
    for (const [id, effect] of active) {
      const source = actors.get(Number(effect.sourceUID)), origin = feet(source);
      if (id !== 'cover' || source === target || !origin) continue;
      const from = worldToCanvas(origin.x, origin.y, source.kind);
      ctx.strokeStyle = 'rgba(193,149,61,0.75)'; ctx.lineWidth = 2 * layoutScale; ctx.setLineDash([3 * layoutScale, 4 * layoutScale]);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
    }
    active.forEach(([id]) => {
      const radius = (id === 'destiny' ? 22 : 18) * layoutScale;
      ctx.lineWidth = Math.max(.75, 1.4 * layoutScale);
      ctx.strokeStyle = cues[id]; ctx.globalAlpha = .75;
      ctx.beginPath();
      if (id === 'cover') {
        ctx.moveTo(p.x - radius, p.y - 3 * layoutScale); ctx.lineTo(p.x + radius, p.y - 3 * layoutScale);
        ctx.lineTo(p.x + radius, p.y + layoutScale); ctx.lineTo(p.x, p.y + 7 * layoutScale);
        ctx.lineTo(p.x - radius, p.y + layoutScale); ctx.closePath();
      } else ctx.ellipse(p.x, p.y, radius, (id === 'destiny' ? 6 : 5) * layoutScale, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (id === 'destiny') {
        const x = p.x + radius + 4 * layoutScale;
        ctx.beginPath(); ctx.moveTo(x - 3 * layoutScale, p.y); ctx.lineTo(x + 3 * layoutScale, p.y);
        ctx.moveTo(x, p.y - 3 * layoutScale); ctx.lineTo(x, p.y + 3 * layoutScale); ctx.stroke();
      }
      if (id === 'blight') {
        for (const direction of [-1, 1]) {
          const x = p.x + direction * radius;
          ctx.beginPath(); ctx.moveTo(x - 3 * layoutScale, p.y + 2 * layoutScale);
          ctx.lineTo(x, p.y - 4 * layoutScale); ctx.lineTo(x + 3 * layoutScale, p.y + 2 * layoutScale); ctx.stroke();
        }
      }
    });
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
