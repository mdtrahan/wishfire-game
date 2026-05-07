import * as renderSystem from './renderSystem.js';

const heroSkillSpriteFocusCache = new WeakMap();
const heroSkillSpriteFocusCanvas = (() => {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      return new OffscreenCanvas(1, 1);
    } catch {}
  }
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const el = document.createElement('canvas');
      el.width = 1;
      el.height = 1;
      return el;
    } catch {}
  }
  return null;
})();

function resolveHeroSkillSpriteFocus(spriteSheetImage, crop) {
  if (!spriteSheetImage || !crop) return { x: 0.5, y: 0.5 };
  const cacheKey = `${Math.round(crop.x)}:${Math.round(crop.y)}:${Math.round(crop.w)}:${Math.round(crop.h)}`;
  let imageCache = heroSkillSpriteFocusCache.get(spriteSheetImage);
  if (!imageCache) {
    imageCache = new Map();
    heroSkillSpriteFocusCache.set(spriteSheetImage, imageCache);
  } else if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }
  if (!heroSkillSpriteFocusCanvas) {
    const fallback = { x: 0.5, y: 0.5 };
    imageCache.set(cacheKey, fallback);
    return fallback;
  }
  const sampleW = Math.max(8, Math.min(128, Math.floor(Number(crop.w) || 0)));
  const sampleH = Math.max(8, Math.min(128, Math.floor(Number(crop.h) || 0)));
  heroSkillSpriteFocusCanvas.width = sampleW;
  heroSkillSpriteFocusCanvas.height = sampleH;
  const sampleCtx = heroSkillSpriteFocusCanvas.getContext('2d', { willReadFrequently: true });
  if (!sampleCtx) {
    const fallback = { x: 0.5, y: 0.5 };
    imageCache.set(cacheKey, fallback);
    return fallback;
  }
  sampleCtx.clearRect(0, 0, sampleW, sampleH);
  sampleCtx.drawImage(spriteSheetImage, crop.x, crop.y, crop.w, crop.h, 0, 0, sampleW, sampleH);
  let alphaData = null;
  try {
    alphaData = sampleCtx.getImageData(0, 0, sampleW, sampleH).data;
  } catch {
    const fallback = { x: 0.5, y: 0.5 };
    imageCache.set(cacheKey, fallback);
    return fallback;
  }
  let minX = sampleW;
  let minY = sampleH;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sampleH; y += 1) {
    for (let x = 0; x < sampleW; x += 1) {
      const a = alphaData[((y * sampleW) + x) * 4 + 3];
      if (a < 8) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) {
    const fallback = { x: 0.5, y: 0.5 };
    imageCache.set(cacheKey, fallback);
    return fallback;
  }
  const focus = {
    x: (minX + maxX + 1) / (sampleW * 2),
    y: (minY + maxY + 1) / (sampleH * 2),
  };
  imageCache.set(cacheKey, focus);
  return focus;
}

function drawHeroSkillSpriteMasked(ctx, spriteSheetImage, crop, innerRect) {
  const focus = resolveHeroSkillSpriteFocus(spriteSheetImage, crop);
  const shiftX = (0.5 - Number(focus.x || 0.5)) * innerRect.w;
  const shiftY = (0.5 - Number(focus.y || 0.5)) * innerRect.h;
  const scaleX = 1 + (Math.abs(0.5 - Number(focus.x || 0.5)) * 2);
  const scaleY = 1 + (Math.abs(0.5 - Number(focus.y || 0.5)) * 2);
  const drawW = innerRect.w * scaleX;
  const drawH = innerRect.h * scaleY;
  const drawX = innerRect.x - ((drawW - innerRect.w) * 0.5) + shiftX;
  const drawY = innerRect.y - ((drawH - innerRect.h) * 0.5) + shiftY;
  ctx.drawImage(spriteSheetImage, crop.x, crop.y, crop.w, crop.h, drawX, drawY, drawW, drawH);
}

function drawHeroSkillNode(ctx, rect, cardData, selected, ss, sf, spriteSheetImage = null, fallbackImage = null) {
  const shape = String(cardData?.shape || '').toLowerCase();
  const frameFill = String(cardData?.frameFill || '#D9D9D9');
  const frameStroke = cardData?.frameStroke === null ? null : String(cardData?.frameStroke || '');
  const frameStrokeWidth = Math.max(0, Number(cardData?.frameStrokeWidth || 0));
  const frameRadius = Number(cardData?.frameRadius || 8);
  const crop = cardData?.spriteCrop;
  const inset = Math.max(1, Math.min(rect.w, rect.h) * (shape === 'diamond' ? 0.08 : 0.06));
  const innerRect = {
    x: rect.x + inset,
    y: rect.y + inset,
    w: rect.w - (inset * 2),
    h: rect.h - (inset * 2),
  };
  ctx.save();
  ctx.fillStyle = frameFill;
  if (frameStroke && frameStrokeWidth > 0) {
    ctx.strokeStyle = frameStroke;
    ctx.lineWidth = Math.max(1, ss(frameStrokeWidth));
  }
  ctx.beginPath();
  if (shape === 'diamond') {
    const side = Math.min(rect.w, rect.h);
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate(Math.PI / 4);
    ctx.roundRect(-side / 2, -side / 2, side, side, Math.max(1, ss(frameRadius - 2)));
    ctx.fill();
    if (frameStroke && frameStrokeWidth > 0) ctx.stroke();
    ctx.restore();
  } else if (shape === 'circle') {
    ctx.arc(rect.x + (rect.w / 2), rect.y + (rect.h / 2), Math.min(rect.w, rect.h) / 2, 0, Math.PI * 2);
    ctx.fill();
    if (frameStroke && frameStrokeWidth > 0) ctx.stroke();
  } else {
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, Math.max(4, ss(6)));
    ctx.fill();
    if (frameStroke && frameStrokeWidth > 0) ctx.stroke();
  }
  if (
    spriteSheetImage
    && crop
    && Number.isFinite(crop.x)
    && Number.isFinite(crop.y)
    && Number.isFinite(crop.w)
    && Number.isFinite(crop.h)
  ) {
    ctx.save();
    ctx.beginPath();
    if (shape === 'diamond') {
      renderSystem.traceDiamondShapePath(ctx, innerRect);
    } else if (shape === 'circle') {
      ctx.arc(innerRect.x + (innerRect.w / 2), innerRect.y + (innerRect.h / 2), Math.min(innerRect.w, innerRect.h) / 2, 0, Math.PI * 2);
      ctx.closePath();
    } else {
      ctx.roundRect(innerRect.x, innerRect.y, innerRect.w, innerRect.h, Math.max(3, ss(4)));
    }
    ctx.clip();
    drawHeroSkillSpriteMasked(ctx, spriteSheetImage, crop, innerRect);
    ctx.restore();
  } else if (fallbackImage) {
    ctx.save();
    ctx.beginPath();
    if (shape === 'diamond') {
      renderSystem.traceDiamondShapePath(ctx, innerRect);
    } else if (shape === 'circle') {
      ctx.arc(innerRect.x + (innerRect.w / 2), innerRect.y + (innerRect.h / 2), Math.min(innerRect.w, innerRect.h) / 2, 0, Math.PI * 2);
      ctx.closePath();
    } else {
      ctx.roundRect(innerRect.x, innerRect.y, innerRect.w, innerRect.h, Math.max(3, ss(4)));
    }
    ctx.clip();
    const fit = Math.min(innerRect.w / Math.max(1, fallbackImage.width || 1), innerRect.h / Math.max(1, fallbackImage.height || 1));
    const drawW = (fallbackImage.width || innerRect.w) * fit;
    const drawH = (fallbackImage.height || innerRect.h) * fit;
    const drawX = innerRect.x + ((innerRect.w - drawW) * 0.5);
    const drawY = innerRect.y + ((innerRect.h - drawH) * 0.5);
    ctx.drawImage(fallbackImage, drawX, drawY, drawW, drawH);
    ctx.restore();
  }
  if (selected) {
    ctx.save();
    ctx.strokeStyle = '#8f8f8f';
    ctx.lineWidth = Math.max(2, ss(2));
    ctx.beginPath();
    if (shape === 'diamond') {
      renderSystem.traceDiamondShapePath(ctx, { x: rect.x - ss(2), y: rect.y - ss(2), w: rect.w + ss(4), h: rect.h + ss(4) });
    } else {
      ctx.arc(rect.x + (rect.w / 2), rect.y + (rect.h / 2), (Math.min(rect.w, rect.h) / 2) + ss(2), 0, Math.PI * 2);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function renderHeroSkillModal({
  ctx,
  heroName,
  selectedCard,
  selectedNode,
  modalIndex,
  modalRects,
  heroSkillSpriteSheetImage,
  ss,
  sf,
  roundRect,
  viewWidth,
  viewHeight,
  closeWinOvalImage,
  heroSkillIconImage,
  getHeroClassLabel,
}) {
  if (!ctx || !selectedCard || !selectedNode || !modalRects) return null;
  const cardRect = modalRects.card;
  const closeRect = modalRects.close;
  const frameBase = modalRects.frame;
  const iconRect = {
    x: frameBase.x,
    y: frameBase.y,
    w: ss(Number(selectedNode.size || 44)),
    h: ss(Number(selectedNode.size || 44)),
  };
  const title = String(selectedCard.title || selectedNode.title || `Skill ${modalIndex + 1}`);
  const rank = Math.max(0, Math.floor(Number(selectedCard.rank || 0)));
  const maxRank = Math.max(0, Math.floor(Number(selectedCard.maxRank || 0)));
  const costs = Array.isArray(selectedCard.costs) ? selectedCard.costs : [];
  const upcoming = [];
  for (let i = rank; i < Math.min(maxRank, rank + 4); i += 1) {
    upcoming.push({ level: i + 1, cost: Math.max(0, Math.floor(Number(costs[i] || 0))) });
  }

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  roundRect(cardRect.x, cardRect.y, cardRect.w, cardRect.h, ss(10), '#ffffff', '#d8d8d8');
  ctx.save();
  ctx.globalAlpha = 0.38;
  roundRect(cardRect.x, cardRect.y, cardRect.w, ss(28), ss(10), '#d9d9d9', null);
  ctx.restore();

  ctx.fillStyle = '#111111';
  ctx.font = `900 ${sf(20, 12)}px Arial Black`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, modalRects.headerPill.x, modalRects.headerPill.y + modalRects.headerPill.h / 2 + ss(1));

  ctx.fillStyle = '#707070';
  ctx.font = `700 ${sf(12, 9)}px Arial`;
  ctx.fillText(`${getHeroClassLabel(heroName)} skill`, modalRects.classLabel.x, modalRects.classLabel.y + modalRects.classLabel.h / 2);
  drawHeroSkillNode(
    ctx,
    iconRect,
    { ...selectedNode, shape: String(selectedNode.kind || selectedNode.shape || 'circle') },
    false,
    ss,
    sf,
    heroSkillSpriteSheetImage,
    heroSkillIconImage,
  );

  roundRect(modalRects.rankRow.x, modalRects.rankRow.y, modalRects.rankRow.w, modalRects.rankRow.h, ss(6), '#efefef', null);
  ctx.fillStyle = '#737373';
  ctx.font = `900 ${sf(11.5, 8)}px Arial Black`;
  ctx.textAlign = 'left';
  ctx.fillText('RANK', modalRects.rankRow.x + ss(10), modalRects.rankRow.y + modalRects.rankRow.h / 2 + ss(1));
  ctx.fillStyle = '#f87c17';
  ctx.textAlign = 'right';
  ctx.fillText(`${rank}/${Math.max(1, maxRank)}`, modalRects.rankRow.x + modalRects.rankRow.w - ss(10), modalRects.rankRow.y + modalRects.rankRow.h / 2 + ss(1));

  ctx.save();
  ctx.globalAlpha = 0.12;
  roundRect(modalRects.summaryRow.x, modalRects.summaryRow.y, modalRects.summaryRow.w, modalRects.summaryRow.h, ss(8), '#000000', null);
  ctx.restore();
  const skillDescription = String(selectedCard.description || selectedCard.beadDescription || '').trim();
  const summaryWords = skillDescription.split(/\s+/).filter(Boolean);
  const summaryLines = [];
  let summaryCurrent = '';
  for (const word of summaryWords) {
    const candidate = summaryCurrent ? `${summaryCurrent} ${word}` : word;
    if (!summaryCurrent || ctx.measureText(candidate).width <= modalRects.summaryRow.w - ss(20)) {
      summaryCurrent = candidate;
      continue;
    }
    summaryLines.push(summaryCurrent);
    summaryCurrent = word;
    if (summaryLines.length === 1) break;
  }
  if (summaryLines.length < 2 && summaryCurrent) {
    const usedWords = summaryLines.join(' ').split(/\s+/).filter(Boolean).length;
    const summaryRemainder = summaryWords.slice(usedWords).join(' ');
    summaryLines.push(summaryRemainder || summaryCurrent);
  }
  const summaryMaxWidth = Math.max(24, modalRects.summaryRow.w - ss(20));
  for (let guard = 0; summaryLines.length && guard < 80; guard += 1) {
    const lastIdx = summaryLines.length - 1;
    const line = String(summaryLines[lastIdx] || '');
    if (line.length <= 1 || ctx.measureText(line).width <= summaryMaxWidth) break;
    const trimmed = line.endsWith('...') ? line.slice(0, -4).trimEnd() : line.slice(0, -1).trimEnd();
    summaryLines[lastIdx] = `${trimmed || line.slice(0, 1)}...`;
  }
  ctx.fillStyle = '#555555';
  ctx.font = `700 ${sf(10.5, 8)}px Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < Math.min(2, summaryLines.length); i += 1) {
    ctx.fillText(summaryLines[i], modalRects.summaryRow.x + ss(10), modalRects.summaryRow.y + ss(10) + (ss(15) * i));
  }
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#737373';
  ctx.font = `900 ${sf(11, 8)}px Arial Black`;
  ctx.textAlign = 'left';
  ctx.fillText('UPGRADES', modalRects.upgradeList.x, modalRects.upgradeList.y - ss(8));
  const rowGap = ss(28);
  const rowHeight = ss(22);
  for (let i = 0; i < Math.min(4, upcoming.length); i += 1) {
    const rowY = modalRects.upgradeList.y + (rowGap * i);
    roundRect(modalRects.upgradeList.x, rowY, modalRects.upgradeList.w, rowHeight, ss(6), '#f3f3f3', '#dfdfdf');
    ctx.fillStyle = '#555555';
    ctx.font = `900 ${sf(10, 8)}px Arial Black`;
    ctx.textAlign = 'left';
    ctx.fillText(`Lv ${upcoming[i].level}`, modalRects.upgradeList.x + ss(10), rowY + (rowHeight / 2));
    ctx.fillStyle = '#f87c17';
    ctx.textAlign = 'right';
    ctx.fillText(upcoming[i].cost > 0 ? `${upcoming[i].cost}` : '--', modalRects.upgradeList.x + modalRects.upgradeList.w - ss(10), rowY + (rowHeight / 2));
  }

  const canUpgradeSelected = selectedCard.actionable !== false && maxRank > 0 && rank < maxRank;
  roundRect(modalRects.upgradeButton.x, modalRects.upgradeButton.y, modalRects.upgradeButton.w, modalRects.upgradeButton.h, ss(6), canUpgradeSelected ? '#d2d2d2' : '#e4e4e4', '#a9a9a9');
  ctx.fillStyle = canUpgradeSelected ? '#555555' : '#8c8c8c';
  ctx.font = `900 ${sf(15, 10)}px Arial Black`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Upgrade', modalRects.upgradeButton.x + (modalRects.upgradeButton.w / 2), modalRects.upgradeButton.y + (modalRects.upgradeButton.h / 2) + ss(1));

  renderSystem.drawHeroStyleCloseControl(ctx, closeRect, closeWinOvalImage, '#111111');
  ctx.restore();
  return {
    backdrop: { x: 0, y: 0, w: viewWidth, h: viewHeight },
    card: cardRect,
    close: closeRect,
    upgradeButton: modalRects.upgradeButton,
  };
}

export function renderHeroScreen({
  ctx,
  canvas,
  dpr,
  gameState,
  uiState,
  fnContext,
  closeWinOvalImage,
  heroPortraitImages,
  heroSkillSpriteSheetImage,
  heroSkillIconImages = [],
  heroLayoutSpec,
  getHeroClassLabel,
  getHeroScreenRoster,
  normalizeHeroSelectionIndex,
  getHeroUIDByIndex,
  callFunctionWithContext,
  getHeroScreenSkillCards,
}) {
  const roster = getHeroScreenRoster();
  const heroIndex = normalizeHeroSelectionIndex();
  const hero = roster[heroIndex] || roster[0] || {
    name: 'Hero',
    hp: 0,
    maxHP: 0,
    stats: { ATK: 0, DEF: 0, MAG: 0, RES: 0, SPD: 0 },
  };
  const heroName = String(hero.name || 'Hero');
  const heroUID = Number(hero && hero.uid) || getHeroUIDByIndex(Number(hero && hero.heroIndex || 0));
  const heroSkillPoints = Math.max(0, Math.floor(Number(callFunctionWithContext(fnContext, 'GetHeroSkillPointBalance', heroUID) || 0)));
  const skillCards = getHeroScreenSkillCards(hero);
  const totalSpent = skillCards.reduce((sum, card) => {
    const costs = Array.isArray(card.costs) ? card.costs : [];
    const rank = Math.max(0, Math.floor(Number(card.rank || 0)));
    for (let i = 0; i < Math.min(rank, costs.length); i += 1) {
      sum += Math.max(0, Math.floor(Number(costs[i] || 0)));
    }
    return sum;
  }, 0);
  const heroSkillPointsTotal = heroSkillPoints + totalSpent;
  const visibleSkillCards = skillCards.slice(0, Math.max(1, heroLayoutSpec.heroNodes.items.length));
  const selectedSkillIndex = Math.max(0, Math.min(Math.max(0, visibleSkillCards.length - 1), Math.floor(Number(uiState.heroScreenSelectedSkillIndex || 0))));
  const viewWidth = canvas.width / dpr;
  const viewHeight = canvas.height / dpr;
  const artW = heroLayoutSpec.artboard.w;
  const artH = heroLayoutSpec.artboard.h;
  const fitScale = Math.min(viewWidth / artW, viewHeight / artH);
  const artOffsetX = (viewWidth - (artW * fitScale)) * 0.5;
  const artOffsetY = (viewHeight - (artH * fitScale)) * 0.5;
  const sx = (x) => artOffsetX + (x * fitScale);
  const sy = (y) => artOffsetY + (y * fitScale);
  const ss = (v) => v * fitScale;
  const sf = (v, min = 8) => Math.max(min, Math.round(v * fitScale));
  const mapRect = (rect) => ({ x: sx(rect.x), y: sy(rect.y), w: ss(rect.w), h: ss(rect.h) });
  const mapPoint = (x, y) => ({ x: sx(x), y: sy(y) });
  const roundRect = (x, y, w, h, r, fill, stroke) => {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  const closeRadius = ss(heroLayoutSpec.close.r);
  const closeCenter = mapPoint(heroLayoutSpec.close.cx, heroLayoutSpec.close.cy);
  const closeBtn = { x: closeCenter.x - closeRadius, y: closeCenter.y - closeRadius, w: closeRadius * 2, h: closeRadius * 2 };
  const headerPill = mapRect(heroLayoutSpec.heroHeader.namePill);
  const classLabel = mapRect(heroLayoutSpec.heroHeader.classLabel);
  const portraitBox = mapRect(heroLayoutSpec.heroPortrait);
  const leftArrowZone = mapRect(heroLayoutSpec.heroArrows.left);
  const rightArrowZone = mapRect(heroLayoutSpec.heroArrows.right);
  const cpPill = mapRect(heroLayoutSpec.heroCP);
  const statsBar = mapRect(heroLayoutSpec.heroStats.bar);
  const skillPointsRow = mapRect(heroLayoutSpec.heroSkillPoints.row);
  const skillPointsChip = mapRect(heroLayoutSpec.heroSkillPoints.chip);
  const upgradeButton = mapRect(heroLayoutSpec.heroUpgrade);
  const statKeys = ['HP', 'ATK', 'DEF', 'MAG', 'RES'];
  const statIcons = ['❤️', '👊', '🛡️', '💫', '🧿'];
  const heroPortrait = heroPortraitImages[heroName] || null;
  const heroSkillIcons = Array.isArray(heroSkillIconImages) ? heroSkillIconImages : [];
  const skillNodeHitZones = [];

  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const drawArrowTriangle = (zone, direction) => {
    const pad = ss(2.2);
    const ix = zone.x + pad;
    const iy = zone.y + pad;
    const iw = zone.w - (pad * 2);
    const ih = zone.h - (pad * 2);
    const edge = ss(1.1);
    const drawPoly = (tipLeft, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      if (tipLeft) {
        ctx.moveTo(ix + iw, iy);
        ctx.lineTo(ix, iy + (ih * 0.5));
        ctx.lineTo(ix + iw, iy + ih);
      } else {
        ctx.moveTo(ix, iy);
        ctx.lineTo(ix + iw, iy + (ih * 0.5));
        ctx.lineTo(ix, iy + ih);
      }
      ctx.closePath();
      ctx.fill();
    };
    drawPoly(direction === 'left', '#c9c9c9');
    const ox = ix + edge;
    const oy = iy + edge;
    const ow = iw - (edge * 2);
    const oh = ih - (edge * 2);
    ctx.fillStyle = '#c8dd3e';
    ctx.beginPath();
    if (direction === 'left') {
      ctx.moveTo(ox + ow, oy);
      ctx.lineTo(ox, oy + (oh * 0.5));
      ctx.lineTo(ox + ow, oy + oh);
    } else {
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + ow, oy + (oh * 0.5));
      ctx.lineTo(ox, oy + oh);
    }
    ctx.closePath();
    ctx.fill();
  };

  drawArrowTriangle(leftArrowZone, 'left');
  drawArrowTriangle(rightArrowZone, 'right');

  if (heroPortrait) {
    const maxW = portraitBox.w - ss(8);
    const maxH = portraitBox.h - ss(8);
    const scale = Math.min(maxW / heroPortrait.width, maxH / heroPortrait.height);
    const drawW = heroPortrait.width * scale;
    const drawH = heroPortrait.height * scale;
    const drawX = portraitBox.x + (portraitBox.w - drawW) / 2;
    const drawY = portraitBox.y + (portraitBox.h - drawH) / 2;
    ctx.drawImage(heroPortrait, drawX, drawY, drawW, drawH);
  }

  ctx.save();
  ctx.globalAlpha = 0.4;
  roundRect(headerPill.x, headerPill.y, headerPill.w, headerPill.h, ss(5), '#d9d9d9', null);
  ctx.restore();
  ctx.fillStyle = '#111111';
  ctx.font = `900 ${sf(20, 12)}px Arial Black`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(heroName, headerPill.x + ss(10), headerPill.y + headerPill.h / 2 + ss(1));
  ctx.fillStyle = '#6d6d6d';
  ctx.font = `700 ${sf(12, 9)}px Arial`;
  ctx.fillText(getHeroClassLabel(heroName), classLabel.x + ss(2), classLabel.y + classLabel.h / 2);

  ctx.save();
  ctx.globalAlpha = 0.92;
  roundRect(cpPill.x, cpPill.y, cpPill.w, cpPill.h, ss(10), '#d0d0d0', null);
  ctx.restore();
  ctx.font = `900 ${sf(12, 9)}px Arial Black`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#737373';
  ctx.fillText('CP', cpPill.x + ss(24), cpPill.y + cpPill.h / 2);
  ctx.fillStyle = '#f87c17';
  ctx.fillText(String(Math.round(Number(hero.combatPower || 0))), cpPill.x + cpPill.w - ss(20), cpPill.y + cpPill.h / 2);

  roundRect(statsBar.x, statsBar.y, statsBar.w, statsBar.h, ss(10), '#4a4a4a', null);
  for (let i = 0; i < statKeys.length; i += 1) {
    const item = heroLayoutSpec.heroStats.items[i] || heroLayoutSpec.heroStats.items[0];
    if (!item) continue;
    const iconCx = sx(item.iconX);
    const valueCx = sx(item.valueX);
    renderSystem.drawHeroStatGlyph(ctx, statIcons[i], iconCx, statsBar.y + statsBar.h / 2, Math.max(0.55, fitScale * 0.56));
    ctx.fillStyle = '#f87c17';
    ctx.font = `900 ${sf(10.5, 8)}px Arial Black`;
    const statValue = statKeys[i] === 'HP'
      ? Math.max(0, Math.floor(Number(hero.hp || 0)))
      : Math.max(0, Math.floor(Number(hero.stats?.[statKeys[i]] || hero[statKeys[i]] || 0)));
    ctx.fillText(String(statValue), valueCx, statsBar.y + statsBar.h / 2 + ss(1));
  }

  const modalOpen = Boolean(uiState.heroScreenSkillModalOpen);
  const modalSkillIndex = Math.max(0, Math.min(Math.max(0, heroLayoutSpec.heroNodes.items.length - 1), Math.floor(Number(uiState.heroScreenSkillModalSkillIndex || selectedSkillIndex))));
  const modalCard = visibleSkillCards[modalSkillIndex] || visibleSkillCards[0] || null;
  const modalNode = heroLayoutSpec.heroNodes.items[modalSkillIndex] || heroLayoutSpec.heroNodes.items[0] || null;
  let modalHitZones = null;
  for (let idx = 0; idx < visibleSkillCards.length; idx += 1) {
    const nodeItem = heroLayoutSpec.heroNodes.items[idx] || heroLayoutSpec.heroNodes.items[heroLayoutSpec.heroNodes.items.length - 1];
    const size = ss(nodeItem.size);
    const rect = { x: sx(nodeItem.x), y: sy(nodeItem.y), w: size, h: size };
    const cardData = visibleSkillCards[idx] || visibleSkillCards[0] || {};
    drawHeroSkillNode(
      ctx,
      rect,
      { ...cardData, ...nodeItem, shape: nodeItem.kind === 'diamond' ? 'diamond' : 'circle' },
      idx === selectedSkillIndex,
      ss,
      sf,
      heroSkillSpriteSheetImage,
      heroSkillIcons[idx] || null,
    );
    if (nodeItem.levelBacker) {
      const backerRect = mapRect(nodeItem.levelBacker);
      ctx.save();
      ctx.fillStyle = '#49555A';
      ctx.beginPath();
      ctx.arc(backerRect.x + (backerRect.w / 2), backerRect.y + (backerRect.h / 2), Math.min(backerRect.w, backerRect.h) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${sf(10, 7)}px Arial Black`;
      ctx.fillText(String(nodeItem.levelBacker.label || 'N'), backerRect.x + (backerRect.w / 2), backerRect.y + (backerRect.h / 2));
      ctx.restore();
    }
    skillNodeHitZones.push({
      idx,
      skillKey: String(cardData.key || `skill${idx + 1}`),
      rect,
      actionable: cardData.actionable !== false && Number(cardData.maxRank || 0) > 0 && Number(cardData.rank || 0) < Number(cardData.maxRank || 0),
    });
  }

  ctx.save();
  ctx.globalAlpha = 0.4;
  roundRect(skillPointsRow.x, skillPointsRow.y, skillPointsRow.w, skillPointsRow.h, ss(5), '#d9d9d9', null);
  ctx.restore();
  ctx.fillStyle = '#737373';
  ctx.font = `900 ${sf(12, 8)}px Arial Black`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const skillPointsTextY = skillPointsRow.y + (skillPointsRow.h / 2);
  ctx.fillText('SKILL POINTS', skillPointsRow.x + ss(56), skillPointsTextY);
  ctx.fillStyle = '#f87c17';
  ctx.fillText(`${heroSkillPoints}/${heroSkillPointsTotal}`, skillPointsChip.x + skillPointsChip.w / 2, skillPointsTextY);

  const selectedNode = visibleSkillCards[selectedSkillIndex] || visibleSkillCards[0] || null;
  const canUpgradeSelected = Boolean(selectedNode) && selectedNode.actionable !== false && Number(selectedNode.maxRank || 0) > 0 && Number(selectedNode.rank || 0) < Number(selectedNode.maxRank || 0);
  roundRect(upgradeButton.x, upgradeButton.y, upgradeButton.w, upgradeButton.h, ss(6), canUpgradeSelected ? '#d2d2d2' : '#e4e4e4', '#a9a9a9');
  ctx.fillStyle = canUpgradeSelected ? '#555555' : '#8c8c8c';
  ctx.font = `900 ${sf(15, 10)}px Arial Black`;
  ctx.fillText('Upgrade', upgradeButton.x + upgradeButton.w / 2, upgradeButton.y + upgradeButton.h / 2 + ss(1));

  if (modalOpen && modalCard && modalNode) {
    modalHitZones = renderHeroSkillModal({
      ctx,
      heroName,
      selectedCard: modalCard,
      selectedNode: modalNode,
      modalIndex: modalSkillIndex,
      modalRects: {
        card: mapRect(heroLayoutSpec.heroSkillModal.card),
        headerPill: mapRect(heroLayoutSpec.heroSkillModal.headerPill),
        classLabel: mapRect(heroLayoutSpec.heroSkillModal.classLabel),
        frame: mapRect(heroLayoutSpec.heroSkillModal.frame),
        rankRow: mapRect(heroLayoutSpec.heroSkillModal.rankRow),
        summaryRow: mapRect(heroLayoutSpec.heroSkillModal.summaryRow),
        upgradeList: mapRect(heroLayoutSpec.heroSkillModal.upgradeList),
        upgradeButton: mapRect(heroLayoutSpec.heroSkillModal.upgradeButton),
        close: mapRect({
          x: heroLayoutSpec.heroSkillModal.close.cx - heroLayoutSpec.heroSkillModal.close.r,
          y: heroLayoutSpec.heroSkillModal.close.cy - heroLayoutSpec.heroSkillModal.close.r,
          w: heroLayoutSpec.heroSkillModal.close.r * 2,
          h: heroLayoutSpec.heroSkillModal.close.r * 2,
        }),
      },
      heroSkillSpriteSheetImage,
      ss,
      sf,
      roundRect,
      viewWidth,
      viewHeight,
      closeWinOvalImage,
      heroSkillIconImage: heroSkillIcons[modalSkillIndex] || null,
      getHeroClassLabel,
    });
  }

  const hitZones = {
    close: closeBtn,
    prevHero: leftArrowZone,
    nextHero: rightArrowZone,
    skillNodes: skillNodeHitZones,
    upgradeButton,
    modal: modalHitZones,
    selectedSkillIndex,
  };

  if (!modalOpen) renderSystem.drawHeroStyleCloseControl(ctx, closeBtn, closeWinOvalImage, '#111111');

  return {
    mode: 'details',
    selectedSkillIndex,
    hitZones,
  };
}
