export function renderIdleFarm(ctx, gameState, deps, dims) {
  const {
    nowSec,
    animationMath,
    updateIdleFarmEmissions,
    startIdleFarmEmissions,
    updateIdleFarmSession,
    ensureIdleFarmSession,
    heroCapsuleImages,
    enemySpriteImages,
  } = deps;
  const { viewWidth, viewHeight } = dims;
  const layout = gameState.idleFarmLayout || {};
  const emissionState = updateIdleFarmEmissions(nowSec) || startIdleFarmEmissions(nowSec);
  const session = updateIdleFarmSession(nowSec) || ensureIdleFarmSession(nowSec);
  const rewards = layout.rewardLedger || {
    unclaimedEnergy: 0,
    claimedEnergyTotal: 0,
    unclaimedTokens: { SAND: 0, BONE_CHIP: 0, SLIME: 0, HORN: 0, SHELL: 0 },
    claimedTokensTotal: { SAND: 0, BONE_CHIP: 0, SLIME: 0, HORN: 0, SHELL: 0 },
  };
  const palette = {
    bg0: '#120f0d', bg1: '#302117', panel: '#efe2cb', panelEdge: '#b99b6b', ink: '#2d1d12', muted: '#715642',
    accent: '#d86d2f', ally: '#8ecf78', enemy: '#da7c6f', battle0: '#3c2a1f', battle1: '#7d5838', ground: '#c39a63',
  };
  const roundRect = (x, y, w, h, r, fill, stroke) => {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y); ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius); ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h); ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius); ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  };
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
  grad.addColorStop(0, palette.bg0); grad.addColorStop(1, palette.bg1);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, viewWidth, viewHeight);

  const panel = { x: 14, y: 16, w: Math.max(280, viewWidth - 28), h: Math.max(360, viewHeight - 34) };
  roundRect(panel.x, panel.y, panel.w, panel.h, 16, palette.panel, palette.panelEdge);

  const restartBtn = { x: panel.x + 12, y: panel.y + 12, w: 92, h: 28 };
  const combatBack = { x: panel.x + panel.w - 232, y: panel.y + 12, w: 108, h: 28 };
  const baseBack = { x: panel.x + panel.w - 116, y: panel.y + 12, w: 104, h: 28 };
  roundRect(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h, 8, '#efe5cf', '#b89b68');
  roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 8, '#e6dcc8', '#a78f65');
  roundRect(baseBack.x, baseBack.y, baseBack.w, baseBack.h, 8, '#e6dcc8', '#a78f65');
  ctx.fillStyle = palette.ink; ctx.font = '700 11px Arial'; ctx.textAlign = 'center';
  ctx.fillText('Restart Run', restartBtn.x + restartBtn.w / 2, restartBtn.y + 18);
  ctx.fillText('To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);
  ctx.fillText('To Camp', baseBack.x + baseBack.w / 2, baseBack.y + 18);

  ctx.textAlign = 'left'; ctx.fillStyle = palette.ink; ctx.font = '700 20px Arial';
  ctx.fillText('Idle War Effort', panel.x + 14, panel.y + 60);

  const battleFrame = { x: panel.x + 12, y: panel.y + 88, w: panel.w - 24, h: Math.min(panel.h - 178, Math.floor((panel.w - 24) * 9 / 16)) };
  roundRect(battleFrame.x, battleFrame.y, battleFrame.w, battleFrame.h, 14, '#1e1510', '#7c5a37');
  const battleGrad = ctx.createLinearGradient(0, battleFrame.y, 0, battleFrame.y + battleFrame.h);
  battleGrad.addColorStop(0, palette.battle0); battleGrad.addColorStop(1, palette.battle1);
  ctx.fillStyle = battleGrad; ctx.fillRect(battleFrame.x + 2, battleFrame.y + 2, battleFrame.w - 4, battleFrame.h - 4);
  ctx.fillStyle = palette.ground; ctx.globalAlpha = 0.55; ctx.fillRect(battleFrame.x + 2, battleFrame.y + battleFrame.h * 0.72, battleFrame.w - 4, battleFrame.h * 0.26); ctx.globalAlpha = 1;

  const heroes = Array.isArray(session.heroes) ? session.heroes : [];
  const easeInCubic = (t) => t * t * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const getLaneAction = (laneIndex) => {
    const actions = Array.isArray(session.currentActions) ? session.currentActions : [];
    const action = actions[laneIndex] || null;
    if (!action) return { action: null, t: 0 };
    const age = Math.max(0, nowSec - Number(action.startSec || 0));
    const duration = Math.max(0.001, Number((action.endSec - action.startSec) || 1.05));
    return { action, t: Math.max(0, Math.min(1, age / duration)) };
  };
  const heroBaseW = battleFrame.w * 0.18;
  const heroBaseH = heroBaseW * 0.7;
  const battleMidpointX = battleFrame.x + battleFrame.w * 0.5;
  const computeLungeOffset = (t, direction, lungeDist = animationMath.LUNGE_FORWARD_DIST_PX) => {
    if (!(t >= 0 && t <= 1)) return 0;
    const anticipationEnd = animationMath.LUNGE_ANTICIPATION_SEC / animationMath.LUNGE_TOTAL_SEC;
    const forwardEnd = (animationMath.LUNGE_ANTICIPATION_SEC + animationMath.LUNGE_FORWARD_SEC) / animationMath.LUNGE_TOTAL_SEC;
    const holdEnd = (animationMath.LUNGE_ANTICIPATION_SEC + animationMath.LUNGE_FORWARD_SEC + animationMath.LUNGE_HOLD_SEC) / animationMath.LUNGE_TOTAL_SEC;
    if (t < anticipationEnd) return -direction * 6 * easeInCubic(t / anticipationEnd);
    if (t < forwardEnd) {
      const forwardT = (t - anticipationEnd) / (forwardEnd - anticipationEnd);
      return (-direction * 6) + (direction * (lungeDist + 6) * animationMath.easeLungeForward(forwardT));
    }
    if (t < holdEnd) return direction * lungeDist;
    return direction * lungeDist * (1 - easeInOutCubic((t - holdEnd) / (1 - holdEnd)));
  };
  const computeIntroOffset = (elapsedSec, direction, distance, durationSec = 1.2) => {
    const t = Math.max(0, Math.min(1, Number(elapsedSec || 0) / Math.max(0.001, durationSec)));
    return direction * distance * (1 - easeOutCubic(t));
  };
  const heroEntryTimes = Array.isArray(session.heroEnterAtSec) ? session.heroEnterAtSec : [];
  const heroSlots = [
    { x: battleFrame.x + battleFrame.w * 0.12, y: battleFrame.y + battleFrame.h * 0.4 - heroBaseH + heroBaseH / 3 },
    { x: battleFrame.x + battleFrame.w * 0.18, y: battleFrame.y + battleFrame.h * 0.68 + heroBaseH / 10 },
  ];
  heroes.slice(0, 2).forEach((hero, idx) => {
    const heroEnterAtSec = Number(heroEntryTimes[idx] ?? session.startedAtSec ?? nowSec);
    if (nowSec < heroEnterAtSec) return;
    const lane = getLaneAction(idx);
    const currentAction = lane.action;
    const actionT = lane.t;
    const slot = heroSlots[idx];
    const portrait = heroCapsuleImages[String(hero.baseName || hero.displayName || '')] || null;
    const isStriking = !!currentAction && String(currentAction.actorSide || '') === 'hero' && Number(currentAction.heroIndex || 0) === idx;
    const isHit = !!currentAction && String(currentAction.actorSide || '') === 'enemy' && Number(currentAction.heroIndex || 0) === idx
      && actionT >= ((animationMath.LUNGE_ANTICIPATION_SEC + animationMath.LUNGE_FORWARD_SEC + animationMath.LUNGE_IMPACT_HANDOFF_SEC) / animationMath.LUNGE_TOTAL_SEC)
      && actionT <= ((animationMath.LUNGE_ANTICIPATION_SEC + animationMath.LUNGE_FORWARD_SEC + animationMath.LUNGE_IMPACT_HANDOFF_SEC + 0.18) / animationMath.LUNGE_TOTAL_SEC);
    const heroW = heroBaseW;
    const heroH = heroBaseH;
    const heroIntroOffset = computeIntroOffset(nowSec - heroEnterAtSec, -1, Math.max(48, heroBaseW * 0.75), 1.25);
    const heroMaxLungeDist = Math.max(0, Math.min(animationMath.HERO_LUNGE_FORWARD_DIST_PX, battleMidpointX - slot.x));
    const offsetX = isStriking ? computeLungeOffset(actionT, 1, heroMaxLungeDist) : 0;
    const drawX = slot.x - heroW / 2 + heroIntroOffset + offsetX;
    const drawY = slot.y - heroH / 2;
    if (portrait) {
      ctx.drawImage(portrait, drawX, drawY, heroW, heroH);
      if (isHit) {
        ctx.save(); ctx.globalAlpha = 0.3; ctx.filter = 'brightness(0)'; ctx.drawImage(portrait, drawX, drawY, heroW, heroH); ctx.restore();
      }
    } else {
      roundRect(drawX, drawY, heroW, heroH, 12, '#d7ead0', '#95b48a');
      if (isHit) {
        ctx.save(); ctx.globalAlpha = 0.32; roundRect(drawX, drawY, heroW, heroH, 12, '#ffffff', '#ffffff'); ctx.restore();
      }
    }
  });

  const enemySlotsState = Array.isArray(session.enemies) ? session.enemies.slice(0, 2) : [];
  const enemyAnchors = [
    { x: battleFrame.x + battleFrame.w * 0.76, y: heroSlots[0].y },
    { x: battleFrame.x + battleFrame.w * 0.81, y: heroSlots[1].y },
  ];
  if (enemySlotsState.length) {
    enemySlotsState.forEach((enemy, idx) => {
      if (!enemy || !enemy.alive) return;
      const lane = getLaneAction(idx);
      const currentAction = lane.action;
      const actionT = lane.t;
      const enemySprite = enemy ? enemySpriteImages[String(enemy.name || '').toLowerCase()] : null;
      const anchor = enemyAnchors[idx] || enemyAnchors[enemyAnchors.length - 1];
      const enemyW = battleFrame.w * (idx === 0 ? 0.16 : 0.14);
      const enemyH = enemyW * 1.05;
      const isAttacking = !!currentAction && String(currentAction.actorSide || '') === 'enemy' && String(currentAction.enemyId || '') === String(enemy.enemyId || '');
      const isHit = !!currentAction && String(currentAction.actorSide || '') === 'hero' && String(currentAction.enemyId || '') === String(enemy.enemyId || '')
        && actionT >= ((animationMath.LUNGE_ANTICIPATION_SEC + animationMath.LUNGE_FORWARD_SEC + animationMath.LUNGE_IMPACT_HANDOFF_SEC) / animationMath.LUNGE_TOTAL_SEC)
        && actionT <= ((animationMath.LUNGE_ANTICIPATION_SEC + animationMath.LUNGE_FORWARD_SEC + animationMath.LUNGE_IMPACT_HANDOFF_SEC + 0.18) / animationMath.LUNGE_TOTAL_SEC);
      const enemyMaxLungeDist = Math.max(0, Math.min(animationMath.LUNGE_FORWARD_DIST_PX, anchor.x - battleMidpointX));
      const shiftX = isAttacking ? computeLungeOffset(actionT, -1, enemyMaxLungeDist) : 0;
      const enemyIntroOffset = computeIntroOffset(nowSec - Number(enemy.spawnedAtSec || nowSec), 1, Math.max(52, enemyW * 0.8), 0.95);
      const drawX = anchor.x - enemyW / 2 + enemyIntroOffset + shiftX;
      const drawY = anchor.y - enemyH / 2;
      if (enemySprite) {
        ctx.drawImage(enemySprite, drawX, drawY, enemyW, enemyH);
        if (isHit) {
          ctx.save(); ctx.globalAlpha = 0.3; ctx.filter = 'brightness(0)'; ctx.drawImage(enemySprite, drawX, drawY, enemyW, enemyH); ctx.restore();
        }
      } else {
        roundRect(drawX, drawY, enemyW, enemyH, 12, '#f0cbc3', '#b97d72');
        if (isHit) {
          ctx.save(); ctx.globalAlpha = 0.32; roundRect(drawX, drawY, enemyW, enemyH, 12, '#ffffff', '#ffffff'); ctx.restore();
        }
      }
    });
  }

  const rewardStrip = { x: panel.x + 12, y: battleFrame.y + battleFrame.h + 14, w: panel.w - 24, h: panel.h - ((battleFrame.y + battleFrame.h + 14) - panel.y) - 12 };
  roundRect(rewardStrip.x, rewardStrip.y, rewardStrip.w, rewardStrip.h, 12, '#f7efdf', '#d2bea0');
  const chipGap = 10;
  const chipColumns = 3;
  const chipW = Math.max(84, Math.floor((rewardStrip.w - 24 - chipGap * (chipColumns - 1)) / chipColumns));
  const chipH = 34;
  const chipY = rewardStrip.y + 14;
  const chips = [
    { label: 'Energy', value: Number(rewards.unclaimedEnergy || 0), fill: '#f4d38d' },
    { label: 'Sand', value: Number(rewards.unclaimedTokens?.SAND || 0), fill: '#e9d1a8' },
    { label: 'Bone Chips', value: Number(rewards.unclaimedTokens?.BONE_CHIP || 0), fill: '#e4d9cc' },
    { label: 'Slime', value: Number(rewards.unclaimedTokens?.SLIME || 0), fill: '#d4ebc9' },
    { label: 'Horn', value: Number(rewards.unclaimedTokens?.HORN || 0), fill: '#e7cfaa' },
    { label: 'Shell', value: Number(rewards.unclaimedTokens?.SHELL || 0), fill: '#d6e3ea' },
  ];
  chips.forEach((chip, idx) => {
    const col = idx % chipColumns;
    const row = Math.floor(idx / chipColumns);
    const rect = { x: rewardStrip.x + 12 + col * (chipW + chipGap), y: chipY + row * (chipH + 8), w: chipW, h: chipH };
    roundRect(rect.x, rect.y, rect.w, rect.h, 10, chip.fill, '#b89b68');
    ctx.fillStyle = palette.ink; ctx.font = '700 11px Arial'; ctx.textAlign = 'center'; ctx.fillText(String(chip.label || ''), rect.x + rect.w / 2, rect.y + 14);
    ctx.font = '700 14px Arial'; ctx.fillText(String(chip.value || 0), rect.x + rect.w / 2, rect.y + 28);
  });
  const collectBtn = { x: rewardStrip.x + rewardStrip.w - 118, y: rewardStrip.y + rewardStrip.h - 38, w: 104, h: 24 };
  const hasUnclaimedRewards = Number(rewards.unclaimedEnergy || 0) > 0 || Object.values(rewards.unclaimedTokens || {}).some((value) => Number(value || 0) > 0);
  roundRect(collectBtn.x, collectBtn.y, collectBtn.w, collectBtn.h, 8, hasUnclaimedRewards ? '#f8ddb0' : '#efe5cf', '#b89b68');
  ctx.fillStyle = palette.ink; ctx.font = '700 10px Arial'; ctx.textAlign = 'center'; ctx.fillText('Collect', collectBtn.x + collectBtn.w / 2, collectBtn.y + 16);
  ctx.textAlign = 'left'; ctx.fillStyle = palette.muted; ctx.font = '600 10px Arial';
  const emissionElapsedSec = Math.floor(Number(emissionState?.elapsedSec || 0));
  ctx.fillText(`Elapsed ${emissionElapsedSec}s · idle emission every ~18s`, rewardStrip.x + 12, rewardStrip.y + rewardStrip.h - 12);

  return {
    hitZones: { restartBtn, collectBtn, combatBack, baseBack },
    uiPatches: {},
    drawHudAfter: true,
  };
}
