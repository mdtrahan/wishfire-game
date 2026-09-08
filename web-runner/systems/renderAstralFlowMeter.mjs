import { getHeroCommandSlots } from '../modules/heroCommands.mjs';

export function renderAstralFlowMeter(ctx, { state, worldToCanvas, layoutScale, heroPortraitImages }) {
  const g = state.globals;
  const heroes = getHeroCommandSlots(state.entities).filter(Boolean)
    .sort((a, b) => Number(b.stats?.SPD || 0) - Number(a.stats?.SPD || 0));
  const pos = worldToCanvas(12, 18);
  const w = 132 * layoutScale, h = 8 * layoutScale;
  const ratio = Math.max(0, Math.min(1, Number(g.AstralFlowAmpPoints || 0) / Math.max(1, Number(g.AstralFlowAmpMax || 18))));
  ctx.save();
  ctx.fillStyle = '#282828'; ctx.fillRect(pos.x, pos.y, w, h);
  ctx.fillStyle = '#1e7bd6'; ctx.fillRect(pos.x, pos.y, w * ratio, h);
  ctx.strokeStyle = '#101010'; ctx.lineWidth = layoutScale; ctx.strokeRect(pos.x, pos.y, w, h);
  heroes.forEach((hero, index) => {
    const x = pos.x + w * (index + 1) / heroes.length, y = pos.y + h / 2, r = 5 * layoutScale;
    ctx.strokeStyle = '#bfbfbf'; ctx.beginPath(); ctx.moveTo(x, pos.y - layoutScale); ctx.lineTo(x, pos.y + h + layoutScale); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.moveTo(x, y-r); ctx.lineTo(x+r, y); ctx.lineTo(x, y+r); ctx.lineTo(x-r, y); ctx.closePath();
    ctx.fillStyle = ratio >= (index + 1) / heroes.length ? '#e4b650' : '#5e5e5e'; ctx.fill();
    ctx.clip();
    const image = heroPortraitImages[hero.baseHeroName || hero.name];
    if (image?.naturalWidth > 0) {
      const size = Math.min(image.naturalWidth, image.naturalHeight) / 1.5;
      ctx.drawImage(image, (image.naturalWidth-size)/2, image.naturalHeight*.08, size, size, x-r, y-r, r*2, r*2);
    }
    ctx.restore(); ctx.strokeStyle = hero.hp > 0 ? '#c6c6c6' : '#535353'; ctx.stroke();
  });
  ctx.restore();
  return { x: pos.x, y: pos.y, w, h, color: '#1e7bd6' };
}
