const stat = (actor, key) => Number(actor?.stats?.[key] ?? actor?.[key.toLowerCase()] ?? actor?.[key] ?? 0);

export function combatVfxProfileForActor(actor) {
  const name = String(actor?.name || '').trim().toLowerCase();
  if (name === 'runa') return { delivery: 'runa_bolt', impact: 'blue' };
  if (name === 'kojonn' || name === 'kaja') return { delivery: 'kaja_orb', impact: 'purple' };
  if (stat(actor, 'MAG') > stat(actor, 'ATK')) {
    if (name === 'djinn') return { delivery: 'djinn_rain', impact: 'purple' };
    if (name === 'marid') return { delivery: 'marid_crescent', impact: 'blue' };
    if (name === 'chimerilass') return { delivery: 'chimerilass_eruption', impact: 'rose' };
    return { delivery: 'magic_orb', impact: 'purple' };
  }
  return { delivery: 'melee', impact: 'melee' };
}

const projectileAsset = (images, kind) => (
  kind === 'runa_bolt' ? images.CombatRunaBolt
    : kind === 'kaja_orb' || kind === 'magic_orb' ? images.CombatKajaOrb
      : kind === 'marid_crescent' ? images.CombatMaridCrescent
        : null
);

const impactAsset = (images, kind) => (
  kind === 'blue' ? images.CombatImpactBlue
    : kind === 'purple' ? images.CombatImpactPurple
      : kind === 'rose' ? images.CombatImpactRose
        : images.CombatHitFlare
);

const entityAnchor = (state, uid) => {
  const g = state.globals || {};
  const actor = (state.entities || []).find(entity => entity && Number(entity.uid || 0) === Number(uid || 0));
  const rest = actor?.kind === 'hero' && g.HeroRestBasePosByUID?.[Number(uid || 0)];
  const size = Math.max(24, Number(g.EnemySize || 40));
  return actor ? {
    x: Number(rest?.x ?? actor.originX ?? actor.x ?? 0),
    y: Number(rest?.y ?? actor.originY ?? actor.y ?? 0) - size * 0.34,
  } : null;
};

export function queueCombatAttackImpactVfx(state, hit, target, now) {
  if ((!hit?.attackVfxKind && !hit?.impactVfxKind) || !target) return;
  const g = state.globals || {};
  const actor = (state.entities || []).find(entity => Number(entity?.uid || 0) === Number(hit.heroUID || hit.actorUID || 0));
  const kind = String(hit.impactVfxKind || combatVfxProfileForActor(actor).impact);
  const targetPoint = entityAnchor(state, target.uid) || { x: Number(target.x || 0), y: Number(target.y || 0) };
  const impacts = Array.isArray(g.CombatImpactVisuals) ? g.CombatImpactVisuals : [];
  impacts.push({ x: targetPoint.x, y: targetPoint.y, kind, startAt: Number(now || g.time || 0) });
  if (impacts.length > 24) impacts.splice(0, impacts.length - 24);
  g.CombatImpactVisuals = impacts;
}

const drawTravel = (ctx, image, from, to, progress, width, layoutScale, lob = 0) => {
  if (!image || !from || !to) return;
  const eased = 1 - Math.pow(1 - progress, 2);
  const x = from.x + (to.x - from.x) * eased;
  const y = from.y + (to.y - from.y) * eased - Math.sin(progress * Math.PI) * lob * layoutScale;
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.sin(Math.min(1, progress * 1.35) * Math.PI * 0.5) * 1.15);
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(to.y - from.y, to.x - from.x));
  ctx.drawImage(image, -width * 0.62, -width * 0.33, width, width * 0.66);
  ctx.restore();
};

const renderEnemyMagic = (ctx, { state, images, worldToCanvas, layoutScale }) => {
  const action = state.globals?.EnemyAction;
  if (!action?.active || !['LUNGE', 'HIT'].includes(action.state)) return;
  const actor = (state.entities || []).find(entity => entity?.kind === 'enemy' && Number(entity.uid) === Number(action.uid));
  const profile = combatVfxProfileForActor(actor);
  if (profile.delivery === 'melee') return;
  const sourcePoint = entityAnchor(state, actor?.uid);
  const targetPoint = entityAnchor(state, action.targetUID);
  if (!sourcePoint || !targetPoint) return;
  const source = worldToCanvas(sourcePoint.x, sourcePoint.y);
  const target = worldToCanvas(targetPoint.x, targetPoint.y);
  const progress = action.state === 'HIT' ? 1 : Math.max(0, Math.min(1, Number(action.visualProgress || 0)));
  const hitFade = action.state === 'HIT' ? Math.max(0, 1 - Number(action.timer || 0) / 0.22) : 1;
  if (profile.delivery === 'marid_crescent' || profile.delivery === 'magic_orb') {
    drawTravel(ctx, projectileAsset(images, profile.delivery), source, target, progress, Math.max(46, 62 * layoutScale), layoutScale);
    return;
  }
  const image = profile.delivery === 'djinn_rain' ? images.CombatDjinnRain : images.CombatChimerilassEruption;
  if (!image) return;
  const pulse = Math.sin(Math.max(0.05, progress) * Math.PI * 0.72);
  const width = Math.max(70, (profile.delivery === 'djinn_rain' ? 88 : 78) * layoutScale) * (0.78 + progress * 0.22);
  const height = width * (image.height / Math.max(1, image.width));
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, pulse * 1.28 * hitFade));
  ctx.drawImage(image, target.x - width / 2, target.y - height * 0.72, width, height);
  ctx.restore();
};

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
    const targetPoint = entityAnchor(state, hit.targetUID);
    if (!targetPoint) continue;
    if (kind === 'split') {
      if (!hit.attackVfxPrimary || !images.CombatSplitSlash) continue;
      const group = pending.filter(item => item?.attackVfxKind === 'split' && Math.abs(Number(item.at || 0) - impactAt) < 0.02);
      const anchors = group.map(item => entityAnchor(state, item.targetUID)).filter(Boolean);
      const center = anchors.length ? {
        x: anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length,
        y: anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length,
      } : targetPoint;
      const pos = worldToCanvas(center.x, center.y);
      const width = Math.max(92, 128 * layoutScale) * (0.72 + progress * 0.28);
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.sin(progress * Math.PI) * 1.3);
      ctx.drawImage(images.CombatSplitSlash, pos.x - width / 2, pos.y - width * 0.33, width, width * 0.66);
      ctx.restore();
      continue;
    }
    const sourcePoint = entityAnchor(state, hit.heroUID);
    if (!sourcePoint) continue;
    drawTravel(
      ctx,
      projectileAsset(images, kind),
      worldToCanvas(sourcePoint.x, sourcePoint.y),
      worldToCanvas(targetPoint.x, targetPoint.y),
      progress,
      Math.max(34, (kind === 'kaja_orb' ? 50 : 46) * layoutScale),
      layoutScale,
      kind === 'kaja_orb' ? 7 : 0,
    );
  }

  renderEnemyMagic(ctx, { state, images, worldToCanvas, layoutScale });

  const impacts = Array.isArray(g.CombatImpactVisuals) ? g.CombatImpactVisuals : [];
  g.CombatImpactVisuals = impacts.filter((impact) => {
    const age = now - Number(impact.startAt || 0);
    const flare = impactAsset(images, impact.kind);
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
