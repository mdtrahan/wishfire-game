const PALETTE = {
  hero: { fill: '#35B9E7', trail: '#177B9F', edge: '#8CE2F5' },
  enemy: { fill: '#E98824', trail: '#A95817', edge: '#FFC47E' },
};

// wardWidth overlays Crimson Ward temporary HP from the left edge (full width = ward at its cap);
// it shrinks leftward as the ward drains.
export function drawCombatHealthBar(ctx, { x, y, width, height, fillWidth, trailWidth, wardWidth = 0, team }) {
  if (!(width > 0 && height > 0)) return;
  const color = PALETTE[team] || PALETTE.enemy;
  const capsule = (w) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, height, Math.min(height / 2, w / 2));
  };
  ctx.save();
  capsule(width);
  ctx.clip();
  ctx.fillStyle = '#292E34';
  ctx.fillRect(x, y, width, height);
  for (const [amount, shade] of [[trailWidth, color.trail], [fillWidth, color.fill]]) {
    const w = Math.max(0, Math.min(width, Number(amount) || 0));
    if (w <= 0) continue;
    capsule(w);
    ctx.fillStyle = shade;
    ctx.fill();
  }
  const ward = Math.max(0, Math.min(width, Number(wardWidth) || 0));
  if (ward > 0) {
    ctx.save();
    capsule(ward);
    ctx.clip();
    ctx.fillStyle = 'rgba(232, 48, 72, 0.9)';
    ctx.fillRect(x, y, ward, height);
    ctx.fillStyle = 'rgba(255, 190, 196, 0.7)';
    ctx.fillRect(x, y, ward, Math.max(1, height * .3));
    ctx.restore();
  }
  ctx.restore();
  ctx.save();
  capsule(width);
  ctx.strokeStyle = color.edge;
  ctx.lineWidth = Math.min(1, height / 3);
  ctx.stroke();
  ctx.restore();
}
