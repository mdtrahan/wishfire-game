const projectileAsset = (images, kind) => (
  kind === 'runa_bolt' ? images.CombatRunaBolt
    : kind === 'kaja_orb' ? images.CombatKajaOrb
      : null
);

const actorAnchor = (state, uid) => {
  const g = state.globals || {};
  const actor = (state.entities || []).find(entity => entity && Number(entity.uid || 0) === Number(uid || 0));
  const rest = g.HeroRestBasePosByUID && g.HeroRestBasePosByUID[Number(uid || 0)];
  const size = Math.max(24, Number(g.EnemySize || 40));
  return {
    x: Number(rest?.x ?? actor?.originX ?? actor?.x ?? 0) + size * 0.16,
    y: Number(rest?.y ?? actor?.originY ?? actor?.y ?? 0) - size * 0.46,
  };
};

const targetAnchor = (state, uid) => {
  const target = (state.entities || []).find(entity => entity && Number(entity.uid || 0) === Number(uid || 0));
  const size = Math.max(24, Number(state.globals?.EnemySize || 40));
  return target ? { x: Number(target.x || 0), y: Number(target.y || 0) - size * 0.34 } : null;
};

export function queueCombatAttackImpactVfx(state, hit, target, now) {
  if (!hit?.attackVfxKind || !target) return;
  const g = state.globals || {};
  const impacts = Array.isArray(g.CombatImpactVisuals) ? g.CombatImpactVisuals : [];
  impacts.push({
    x: Number(target.x || 0),
    y: Number(target.y || 0) - Math.max(8, Number(g.EnemySize || 40) * 0.34),
    startAt: Number(now || g.time || 0),
  });
  if (impacts.length > 24) impacts.splice(0, impacts.length - 24);
  g.CombatImpactVisuals = impacts;
}

export function renderCombatAttackVfx(ctx, { state, images, worldToCanvas, layoutScale = 1 }) {
  const g = state.globals || {};
  const now = Number(g.time || 0);
  const pending = Array.isArray(g.PendingHeroHits) ? g.PendingHeroHits : [];
  for (const hit of pending) {
    const kind = String(hit?.attackVfxKind || '');
    if (!kind || hit.followUpAwaitTextClear) continue;
    const impactAt = Number(hit.at || 0);
    const lead = kind === 'split' ? 0.44 : 0.52;
    const progress = Math.max(0, Math.min(1, (now - (impactAt - lead)) / lead));
    if (progress <= 0 || progress >= 1) continue;
    const target = targetAnchor(state, hit.targetUID);
    if (!target) continue;
    if (kind === 'split') {
      if (!hit.attackVfxPrimary || !images.CombatSplitSlash) continue;
      const group = pending.filter(item => item?.attackVfxKind === 'split' && Math.abs(Number(item.at || 0) - impactAt) < 0.02);
      const anchors = group.map(item => targetAnchor(state, item.targetUID)).filter(Boolean);
      const center = anchors.length ? {
        x: anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length,
        y: anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length,
      } : target;
      const pos = worldToCanvas(center.x, center.y);
      const pulse = Math.sin(progress * Math.PI);
      const width = Math.max(92, 128 * layoutScale) * (0.72 + progress * 0.28);
      ctx.save();
      ctx.globalAlpha = Math.min(1, pulse * 1.3);
      ctx.drawImage(images.CombatSplitSlash, pos.x - width / 2, pos.y - width * 0.33, width, width * 0.66);
      ctx.restore();
      continue;
    }
    const image = projectileAsset(images, kind);
    if (!image) continue;
    const source = actorAnchor(state, hit.heroUID);
    const from = worldToCanvas(source.x, source.y);
    const to = worldToCanvas(target.x, target.y);
    const eased = 1 - Math.pow(1 - progress, 2);
    const x = from.x + (to.x - from.x) * eased;
    const y = from.y + (to.y - from.y) * eased - Math.sin(progress * Math.PI) * 7 * layoutScale;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const width = Math.max(34, (kind === 'kaja_orb' ? 50 : 46) * layoutScale);
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.sin(Math.min(1, progress * 1.35) * Math.PI * 0.5) * 1.15);
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(image, -width * 0.62, -width * 0.33, width, width * 0.66);
    ctx.restore();
  }

  const flare = images.CombatHitFlare;
  const impacts = Array.isArray(g.CombatImpactVisuals) ? g.CombatImpactVisuals : [];
  g.CombatImpactVisuals = impacts.filter((impact) => {
    const age = now - Number(impact.startAt || 0);
    if (age < 0.32 && flare) {
      const t = Math.max(0, age / 0.32);
      const pos = worldToCanvas(Number(impact.x || 0), Number(impact.y || 0));
      const size = Math.max(42, 62 * layoutScale) * (0.62 + Math.min(1, t * 2) * 0.5);
      ctx.save();
      ctx.globalAlpha = t < 0.25 ? 1 : Math.max(0, (1 - t) / 0.75);
      ctx.drawImage(flare, pos.x - size / 2, pos.y - size / 3, size, size * 0.66);
      ctx.restore();
    }
    return age < 0.32;
  });
}
