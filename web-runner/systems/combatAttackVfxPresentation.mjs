const stat = (actor, key) => Number(actor?.stats?.[key] ?? actor?.[key.toLowerCase()] ?? actor?.[key] ?? 0);
const ARCANE_PULSE_IMPACT_SEC = 0.5;
const IMPACT_VISIBLE_CENTER_X = Object.freeze({
  melee: (31 + 183) / (2 * 192),
  blue: (66 + 144) / (2 * 192),
  purple: (58 + 138) / (2 * 192),
  rose: (45 + 150) / (2 * 192),
  arcanePulse: (406 + 1378) / (2 * 1536),
});
const contactPointTowardSource = (source, target, distance) => ({
  x: target.x + Math.sign(Number(source?.x || 0) - Number(target.x || 0)) * distance,
  y: target.y,
});

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
  const spacing = Number(g.Spacing || (size + Number(g.enemyGAP || 8)));
  const actorX = actor?.originX != null ? actor.originX : (actor?.x != null ? actor.x : Number(g.X0 || 200));
  const actorY = actor?.originY != null ? actor.originY : (actor?.y != null ? actor.y : Number(g.EnemyAreaY0 || 140) + Number(actor?.slotIndex || 0) * spacing);
  return actor ? {
    x: Number(rest?.x ?? actorX),
    y: Number(rest?.y ?? actorY) - size * 0.34,
  } : null;
};

const enemyGroupAnchor = (state) => {
  const anchors = (state.entities || [])
    .filter(entity => entity?.kind === 'enemy' && Number(entity.hp ?? 1) > 0)
    .map(entity => entityAnchor(state, entity.uid))
    .filter(Boolean);
  return anchors.length ? {
    x: anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length,
    y: anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length,
  } : null;
};

const heroGroupAnchor = (state) => {
  const anchors = (state.entities || [])
    .filter(entity => entity?.kind === 'hero' && Number(entity.hp ?? 1) > 0)
    .map(entity => entityAnchor(state, entity.uid))
    .filter(Boolean);
  return anchors.length ? {
    x: anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length,
    y: anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length,
  } : null;
};

export function queueCombatAttackImpactVfx(state, hit, target, now) {
  if ((!hit?.attackVfxKind && !hit?.impactVfxKind) || !target) return;
  const g = state.globals || {};
  const actor = (state.entities || []).find(entity => Number(entity?.uid || 0) === Number(hit.heroUID || hit.actorUID || 0));
  const delivery = String(hit.attackVfxKind || '');
  const kind = String(hit.impactVfxKind
    || (delivery === 'runa_bolt' ? 'blue' : delivery === 'kaja_orb' ? 'purple' : '')
    || combatVfxProfileForActor(actor).impact);
  const damage = Math.max(0, Number(hit.finalDmg ?? hit.dmg ?? hit.damage ?? 0));
  const maxHP = Math.max(0, Number(target.maxHP ?? target.max ?? 0));
  const weak = !hit.didCrit && !hit.isCrit && maxHP > 0 && damage > 0 && damage <= maxHP * 0.05;
  const impactScale = !weak && (delivery === 'runa_bolt' || delivery === 'kaja_orb') ? 1.6 : 1;
  const targetCenter = entityAnchor(state, target.uid) || { x: Number(target.x || 0), y: Number(target.y || 0) };
  const sourcePoint = entityAnchor(state, actor?.uid);
  const targetPoint = sourcePoint
    ? contactPointTowardSource(sourcePoint, targetCenter, Math.max(24, Number(g.EnemySize || 40)) * 0.3)
    : targetCenter;
  const targetRestCenter = target.kind === 'hero' && g.HeroRestBasePosByUID?.[Number(target.uid || 0)];
  const targetVerticalCenter = Number(targetRestCenter?.y
    ?? target.originY
    ?? target.y
    ?? targetPoint.y
    ?? 0);
  const impacts = Array.isArray(g.CombatImpactVisuals) ? g.CombatImpactVisuals : [];
  impacts.push({
    x: targetPoint.x,
    y: weak ? targetVerticalCenter : targetPoint.y,
    kind,
    weak,
    impactScale,
    startAt: Number(now || g.time || 0),
  });
  if (impacts.length > 24) impacts.splice(0, impacts.length - 24);
  g.CombatImpactVisuals = impacts;
}

const drawTravel = (ctx, image, from, to, progress, width, layoutScale, lob = 0) => {
  if (!image || !from || !to) return;
  const eased = 1 - Math.pow(1 - progress, 2);
  const x = from.x + (to.x - from.x) * eased;
  const y = from.y + (to.y - from.y) * eased - Math.sin(progress * Math.PI) * lob * layoutScale;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const frontOffset = width * 0.38 * eased;
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.sin(Math.min(1, progress * 1.35) * Math.PI * 0.5) * 1.15);
  ctx.translate(x - Math.cos(angle) * frontOffset, y - Math.sin(angle) * frontOffset);
  ctx.rotate(angle);
  ctx.drawImage(image, -width * 0.62, -width * 0.33, width, width * 0.66);
  ctx.restore();
};

const drawVerticalReveal = (ctx, image, pos, progress, width, alpha, direction = 'down') => {
  if (!image || !pos) return;
  const reveal = Math.max(0.08, Math.min(1, progress * 1.18));
  const sourceH = Math.max(1, image.height * reveal);
  const sourceY = direction === 'up' ? image.height - sourceH : 0;
  const height = width * (image.height / Math.max(1, image.width));
  const shownH = height * reveal;
  const destY = direction === 'up' ? pos.y - shownH : pos.y - height * 0.72;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(image, 0, sourceY, image.width, sourceH, pos.x - width / 2, destY, width, shownH);
  ctx.restore();
};

const renderGrowVfx = (ctx, { state, images, worldToCanvas, layoutScale }) => {
  if (!images.CombatGrowSpectralHands) return;
  const now = Number(state.globals?.time || 0);
  for (const [uid, visual] of Object.entries(state.globals?.PowerAmpVisualByUID || {})) {
    if (visual?.source !== 'party_grow') continue;
    const age = now - Number(visual.startAt || 0);
    if (age < 0 || age >= 0.75) continue;
    const anchor = entityAnchor(state, uid);
    if (!anchor) continue;
    const progress = Math.min(1, age / 0.5);
    const alpha = age < 0.5 ? 0.82 : 0.82 * (0.75 - age) / 0.25;
    const pos = worldToCanvas(anchor.x, anchor.y);
    drawVerticalReveal(ctx, images.CombatGrowSpectralHands, { x: pos.x, y: pos.y + 28 * layoutScale }, progress, Math.max(76, 92 * layoutScale), alpha, 'up');
  }
};

const renderSessionBuffCombatVfx = (ctx, { state, images, worldToCanvas, layoutScale }) => {
  const now = Number(state.globals?.time || 0);
  const visuals = Array.isArray(state.globals?.SessionBuffCombatVisuals) ? state.globals.SessionBuffCombatVisuals : [];
  state.globals.SessionBuffCombatVisuals = visuals.filter((visual) => {
    const age = now - Number(visual?.startAt || 0);
    if (!visual || age >= 0.58) return false;
    if (age < 0) return true;
    const sourcePoint = entityAnchor(state, visual.sourceUID);
    const targetPoint = entityAnchor(state, visual.targetUID);
    if (!targetPoint) return true;
    const target = worldToCanvas(targetPoint.x, targetPoint.y);
    if (visual.kind === 'venom_sigil' && images.CombatVenomSigil) {
      const progress = Math.min(1, age / 0.38);
      drawVerticalReveal(ctx, images.CombatVenomSigil, { x: target.x, y: target.y + 20 * layoutScale }, progress, Math.max(72, 94 * layoutScale), Math.max(0, 1 - age / 0.58), 'up');
    } else if (visual.kind === 'glass_reprisal' && sourcePoint && images.CombatGlassReprisal) {
      const progress = Math.min(1, age / 0.32);
      const source = worldToCanvas(sourcePoint.x, sourcePoint.y);
      const contactTarget = contactPointTowardSource(source, target, Math.max(24, Number(state.globals?.EnemySize || 40)) * 0.3 * layoutScale);
      drawTravel(ctx, images.CombatGlassReprisal, source, contactTarget, progress, Math.max(54, 76 * layoutScale), layoutScale);
      if (age >= 0.28 && images.CombatImpactBlue) {
        const contact = Math.min(1, (age - 0.28) / 0.3);
        const size = Math.max(44, 60 * layoutScale) * (0.72 + contact * 0.3);
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - contact);
        ctx.drawImage(images.CombatImpactBlue, contactTarget.x - size * IMPACT_VISIBLE_CENTER_X.blue, contactTarget.y - size / 3, size, size * 0.66);
        ctx.restore();
      }
    }
    return true;
  });
};

const renderArcanePulseVfx = (ctx, { state, images, worldToCanvas, layoutScale }) => {
  const pulses = Array.isArray(state.globals?.ArcanePulseVisuals) ? state.globals.ArcanePulseVisuals : [];
  if (!pulses.length || !images.SkillArcanePulse) return;
  const now = Number(state.globals.time || 0);
  state.globals.ArcanePulseVisuals = pulses.filter((pulse) => {
    const startAt = Number(pulse?.startAt || 0);
    const impactAt = Math.max(startAt + 0.01, Number(pulse?.impactAt || startAt));
    const endAt = impactAt + ARCANE_PULSE_IMPACT_SEC;
    if (!pulse || now > endAt) return false;
    if (now < startAt) return true;
    const source = worldToCanvas(Number(pulse.sourceX || 0), Number(pulse.sourceY || 0));
    const targetCenter = worldToCanvas(Number(pulse.targetX || 0), Number(pulse.targetY || 0));
    const target = contactPointTowardSource(source, targetCenter, Math.max(24, Number(state.globals?.EnemySize || 40)) * 0.3 * layoutScale);
    const travel = Math.max(0, Math.min(1, (now - startAt) / (impactAt - startAt)));
    const charge = Math.min(1, travel / 0.18);
    const move = Math.max(0, Math.min(1, (travel - 0.18) / 0.82));
    const eased = 1 - Math.pow(1 - move, 3);
    const x = source.x + (target.x - source.x) * eased;
    const y = source.y + (target.y - source.y) * eased;
    const angle = Math.atan2(target.y - source.y, target.x - source.x);
    const width = Math.max(81, 114 * layoutScale) * (0.5 + charge * 0.5);
    if (now < impactAt) {
      for (const [trail, opacity] of [[0.13, 0.12], [0.07, 0.22]]) {
        const prior = Math.max(0, eased - trail);
        ctx.save();
        ctx.globalAlpha = opacity * move;
        ctx.translate(source.x + (target.x - source.x) * prior, source.y + (target.y - source.y) * prior);
        ctx.rotate(angle);
        ctx.scale(-1, 1);
        ctx.drawImage(images.SkillArcanePulse, -width * 0.55, -width * 0.36, width, width * 0.72);
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = 0.35 + charge * 0.65;
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(-1, 1);
      ctx.drawImage(images.SkillArcanePulse, -width * 0.55, -width * 0.36, width, width * 0.72);
      ctx.restore();
    } else if (images.CombatArcanePulseImpact) {
      const impact = Math.max(0, Math.min(1, (now - impactAt) / ARCANE_PULSE_IMPACT_SEC));
      const width = Math.max(70, 96 * layoutScale) * (0.82 + impact * 0.18);
      const height = width * 0.64;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - impact);
      ctx.translate(target.x, target.y);
      ctx.rotate(angle);
      ctx.scale(-1, 1);
      ctx.drawImage(images.CombatArcanePulseImpact, -width * IMPACT_VISIBLE_CENTER_X.arcanePulse, -height / 2, width, height);
      ctx.restore();
    }
    return true;
  });
};

const renderEnemyMagic = (ctx, { state, images, worldToCanvas, layoutScale }) => {
  const action = state.globals?.EnemyAction;
  if (!action?.active || !['LUNGE', 'HIT'].includes(action.state)) return;
  const actor = (state.entities || []).find(entity => entity?.kind === 'enemy' && Number(entity.uid) === Number(action.uid));
  const skillId = String(action.skillId || '');
  if (skillId.startsWith('Enemy_Heal_')) return;
  const profile = skillId === 'Enemy_Scathe' ? { delivery: 'scathe_crackle', impact: 'purple' }
    : skillId === 'Enemy_Sweep' ? { delivery: 'sweep_crescent', impact: 'blue' }
      : skillId === 'Enemy_Wipe' ? { delivery: 'wipe_wash', impact: 'heal' }
        : skillId === 'Enemy_MAG_AOE' ? { delivery: 'magic_aoe_brushfire', impact: 'rose' }
          : skillId === 'Enemy_Drain_Buff' ? { delivery: 'drain_buff_orb', impact: 'none' }
        : combatVfxProfileForActor(actor);
  if (profile.delivery === 'melee') return;
  const sourcePoint = entityAnchor(state, actor?.uid);
  const targetPoint = profile.delivery === 'wipe_wash' ? enemyGroupAnchor(state)
    : profile.delivery === 'magic_aoe_brushfire' ? heroGroupAnchor(state)
      : profile.delivery === 'drain_buff_orb' ? sourcePoint
        : entityAnchor(state, action.targetUID);
  if (!sourcePoint || !targetPoint) return;
  const source = worldToCanvas(sourcePoint.x, sourcePoint.y);
  const target = worldToCanvas(targetPoint.x, targetPoint.y);
  const progress = action.state === 'HIT' ? 1 : Math.max(0, Math.min(1, Number(action.visualProgress || 0)));
  const hitFade = action.state === 'HIT' ? Math.max(0, 1 - Number(action.timer || 0) / 0.22) : 1;
  if (profile.delivery === 'marid_crescent' || profile.delivery === 'magic_orb' || profile.delivery === 'sweep_crescent') {
    const image = profile.delivery === 'sweep_crescent' ? images.CombatSweepCrescent : projectileAsset(images, profile.delivery);
    drawTravel(ctx, image, source, target, progress, Math.max(46, 62 * layoutScale), layoutScale);
    return;
  }
  if (profile.delivery === 'drain_buff_orb') {
    if (!images.CombatDrainBuffOrb) return;
    const size = Math.max(68, 92 * layoutScale) * (1.16 - progress * 0.2);
    ctx.save();
    ctx.globalAlpha = Math.min(1, (0.35 + progress * 0.75) * hitFade);
    ctx.drawImage(images.CombatDrainBuffOrb, target.x - size / 2, target.y - size / 2, size, size);
    ctx.restore();
    return;
  }
  const image = profile.delivery === 'djinn_rain' ? images.CombatDjinnRain
    : profile.delivery === 'scathe_crackle' ? images.CombatScatheCrackle
      : profile.delivery === 'wipe_wash' ? images.CombatWipeWash
        : profile.delivery === 'magic_aoe_brushfire' ? images.CombatMagicAoeBrushfire
        : images.CombatChimerilassEruption;
  if (!image) return;
  const pulse = Math.sin(Math.max(0.05, progress) * Math.PI * 0.72);
  const width = Math.max(70, (profile.delivery === 'magic_aoe_brushfire' ? 210 : profile.delivery === 'wipe_wash' ? 104 : profile.delivery === 'djinn_rain' || profile.delivery === 'scathe_crackle' ? 88 : 78) * layoutScale) * (0.78 + progress * 0.22);
  const direction = profile.delivery === 'chimerilass_eruption' || profile.delivery === 'magic_aoe_brushfire' ? 'up' : 'down';
  const groundedTarget = profile.delivery === 'magic_aoe_brushfire' ? { x: target.x, y: target.y + 18 * layoutScale } : target;
  drawVerticalReveal(ctx, image, groundedTarget, progress, width, pulse * 1.28 * hitFade, direction);
};

export function renderCombatAttackVfx(ctx, { state, images, worldToCanvas, layoutScale = 1 }) {
  const g = state.globals || {};
  const now = Number(g.time || 0);
  const impactRequests = Array.isArray(g.CombatImpactRequests) ? g.CombatImpactRequests : [];
  g.CombatImpactRequests = impactRequests.filter((request) => {
    if (now < Number(request?.at || 0)) return true;
    const target = (state.entities || []).find(entity => Number(entity?.uid || 0) === Number(request?.targetUID || 0));
    queueCombatAttackImpactVfx(state, request, target, now);
    return false;
  });
  renderGrowVfx(ctx, { state, images, worldToCanvas, layoutScale });
  renderSessionBuffCombatVfx(ctx, { state, images, worldToCanvas, layoutScale });
  renderArcanePulseVfx(ctx, { state, images, worldToCanvas, layoutScale });
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
    const flare = impact.weak ? images.CombatWeakGlanceRing : impactAsset(images, impact.kind);
    if (age < 0.32 && flare) {
      const t = Math.max(0, age / 0.32);
      const pos = worldToCanvas(Number(impact.x || 0), Number(impact.y || 0));
      const size = Math.max(impact.weak ? 34 : 42, (impact.weak ? 46 : 62) * layoutScale)
        * (0.62 + Math.min(1, t * 2) * 0.5)
        * Math.max(1, Number(impact.impactScale || 1));
      if (impact.weak) {
        ctx.save();
        ctx.globalAlpha = t < 0.25 ? 0.92 : Math.max(0, (1 - t) / 0.75) * 0.92;
        ctx.drawImage(flare, pos.x - size / 2, pos.y - size / 2, size, size);
        ctx.restore();
        return age < 0.32;
      }
      const visibleCenterX = impact.weak ? IMPACT_VISIBLE_CENTER_X.melee
        : IMPACT_VISIBLE_CENTER_X[impact.kind] || IMPACT_VISIBLE_CENTER_X.melee;
      ctx.save();
      ctx.globalAlpha = t < 0.25 ? 1 : Math.max(0, (1 - t) / 0.75);
      ctx.drawImage(flare, pos.x - size * visibleCenterX, pos.y - size / 3, size, size * 0.66);
      ctx.restore();
    }
    return age < 0.32;
  });
}
