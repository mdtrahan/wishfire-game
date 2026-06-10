import { getSuperGemRenderImage, getSuperGemRenderRect } from '../src/core/superGemRender.mjs';

export const GEM_APPEAR_BOUNCE_MIN_RENDER_SEC = 0.14784;
const GEM_APPEAR_BOUNCE_OVERSHOOT_SCALE = 0.56;
const LOCKED_GEM_GRAY = 160;
const LOCKED_GEM_LUMINANCE_MIX = 0.4;
const LOCKED_GEM_GRAY_MIX = 0.6;
const lockedGemGrayCache = new WeakMap();

export const GEM_APPEAR_BOUNCE_POINTS = Object.freeze([
  [0, 0],
  [0.041, 0.307],
  [0.083, 0.578],
  [0.125, 0.809],
  [0.147, 0.914],
  [0.169, 1.01],
  [0.191, 1.096],
  [0.214, 1.175],
  [0.237, 1.246],
  [0.26, 1.307],
  [0.284, 1.361],
  [0.308, 1.406],
  [0.333, 1.444],
  [0.358, 1.473],
  [0.378, 1.491],
  [0.398, 1.503],
  [0.419, 1.511],
  [0.44, 1.514],
  [0.462, 1.513],
  [0.485, 1.507],
  [0.508, 1.496],
  [0.532, 1.48],
  [0.553, 1.463],
  [0.575, 1.443],
  [0.623, 1.389],
  [0.671, 1.328],
  [0.795, 1.158],
  [0.831, 1.114],
  [0.864, 1.077],
  [0.901, 1.043],
  [0.936, 1.019],
  [0.953, 1.01],
  [0.969, 1.005],
  [0.985, 1.001],
  [1, 1],
]);

export function sampleGemAppearBounce(t) {
  const input = Math.max(0, Math.min(1, Number(t || 0)));
  for (let i = 1; i < GEM_APPEAR_BOUNCE_POINTS.length; i += 1) {
    const [x1, y1] = GEM_APPEAR_BOUNCE_POINTS[i - 1];
    const [x2, y2] = GEM_APPEAR_BOUNCE_POINTS[i];
    if (input <= x2) {
      const span = Math.max(1e-6, x2 - x1);
      const alpha = Math.max(0, Math.min(1, (input - x1) / span));
      return y1 + ((y2 - y1) * alpha);
    }
  }
  return GEM_APPEAR_BOUNCE_POINTS[GEM_APPEAR_BOUNCE_POINTS.length - 1][1];
}

export function getGemBounceScale(t, amp = 1) {
  const curveScale = sampleGemAppearBounce(t);
  const intensity = Math.max(0, Number(amp ?? 1));
  if (curveScale <= 1) return 1 + ((curveScale - 1) * intensity);
  return 1 + ((curveScale - 1) * intensity * GEM_APPEAR_BOUNCE_OVERSHOOT_SCALE);
}

function createLockedGemGraySprite(sourceImage) {
  if (typeof document === 'undefined') return null;
  const width = Math.max(0, Math.floor(Number(sourceImage?.naturalWidth || sourceImage?.width || 0)));
  const height = Math.max(0, Math.floor(Number(sourceImage?.naturalHeight || sourceImage?.height || 0)));
  if (!(width > 0) || !(height > 0)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const offscreenCtx = canvas.getContext('2d');
  if (!offscreenCtx) return null;
  offscreenCtx.drawImage(sourceImage, 0, 0, width, height);
  const imageData = offscreenCtx.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= 0) continue;
    const luminance = (0.2126 * data[i]) + (0.7152 * data[i + 1]) + (0.0722 * data[i + 2]);
    const lockedGray = Math.round((luminance * LOCKED_GEM_LUMINANCE_MIX) + (LOCKED_GEM_GRAY * LOCKED_GEM_GRAY_MIX));
    data[i] = lockedGray;
    data[i + 1] = lockedGray;
    data[i + 2] = lockedGray;
  }
  offscreenCtx.putImageData(imageData, 0, 0);
  return canvas;
}

function getLockedGemGraySprite(sourceImage) {
  if (!sourceImage) return null;
  if (lockedGemGrayCache.has(sourceImage)) {
    return lockedGemGrayCache.get(sourceImage);
  }
  let sprite = null;
  try {
    sprite = createLockedGemGraySprite(sourceImage);
  } catch {
    sprite = null;
  }
  lockedGemGrayCache.set(sourceImage, sprite);
  return sprite;
}

function isLockedGem(gem) {
  if (!gem) return false;
  const countdown = Number(gem.lockCountdown ?? gem.LockCountdown ?? 0);
  return countdown > 0 || gem.locked === true || Number(gem.Locked || 0) === 1;
}

function getLockedGemCountdown(gem) {
  return Math.max(0, Math.floor(Number(gem?.lockCountdown ?? gem?.LockCountdown ?? 0)));
}

function getGemRenderRect({ gem, worldToCanvas, layoutScale, now, gameTime }) {
  const pos = worldToCanvas(gem.x, gem.y);
  let scale = 1;
  if (gem.bounceStart != null && gem.bounceDur != null) {
    const bounceNow = Number(gameTime != null ? gameTime : now);
    const bounceDuration = Math.max(
      0.001,
      Number(gem.bounceDur || 0),
      GEM_APPEAR_BOUNCE_MIN_RENDER_SEC,
    );
    const t = (bounceNow - gem.bounceStart) / bounceDuration;
    if (t >= 0 && t < 1) {
      const amp = Number(gem.bounceAmp ?? 1);
      scale = getGemBounceScale(t, amp);
    }
  }
  const w = gem.width * layoutScale * scale;
  const h = gem.height * layoutScale * scale;
  return {
    x: pos.x - w * 0.5,
    y: pos.y - h * 0.5,
    w,
    h,
    cx: pos.x,
    cy: pos.y,
  };
}

function renderLockedGemOverlay(ctx, rect, countdown, drawGemSprite = null) {
  if (!rect || !(rect.w > 0) || !(rect.h > 0)) return;
  const label = String(Math.max(0, Math.floor(Number(countdown || 0))));
  ctx.save();
  if (typeof drawGemSprite === 'function') {
    drawGemSprite();
  } else {
    const radius = Math.min(rect.w, rect.h) * 0.45;
    ctx.fillStyle = 'rgba(229, 231, 235, 0.42)';
    ctx.beginPath();
    ctx.arc(rect.cx, rect.cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  const fontSize = Math.max(14, Math.floor(Math.min(rect.w, rect.h) * 0.54));
  ctx.font = `700 ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = Math.max(3, Math.floor(fontSize * 0.16));
  ctx.fillStyle = '#fff';
  ctx.strokeText(label, rect.cx, rect.cy);
  ctx.fillText(label, rect.cx, rect.cy);
  ctx.restore();
}

export function renderBoard(ctx, gameState, uiState, animationMath, dims) {
  const {
    boardGeometry,
    worldToCanvas,
    layoutScale,
    gemFrameImages,
    superGemFrameImages,
    superGemRainbowImage,
    now,
    gameTime,
  } = dims;
  const gemFrames = Array.isArray(gemFrameImages) ? gemFrameImages : [];

  if (gameState.boardCreated && gameState.gems) {
    for (let i = 0; i < gameState.gems.length; i += 1) {
      const gem = gameState.gems[i];
      if (gameState.superGemCellMap && gameState.superGemCellMap.size) {
        const key = `${gem.cellR},${gem.cellC}`;
        if (gameState.superGemCellMap.has(key)) continue;
      }
      const pos = worldToCanvas(gem.x, gem.y);

      const frameIndex = (gem.color ?? 0) % 6;
      const gemImg = gemFrames[frameIndex];
      const rect = getGemRenderRect({ gem, worldToCanvas, layoutScale, now, gameTime });
      const gemW = rect.w;
      const gemH = rect.h;
      const gemX = rect.x;
      const gemY = rect.y;

      if (gemImg) {
        ctx.drawImage(gemImg, gemX, gemY, gemW, gemH);
      } else {
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, gemW * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }

      if (gem.selected || (gem.flashUntil && gem.flashUntil > now)) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = gem.flashUntil && gem.flashUntil > now ? 3 : 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, gemW * 0.48, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  if (Array.isArray(gameState.superGems) && gameState.superGems.length) {
    for (const sg of gameState.superGems) {
      const rect = getSuperGemRenderRect({
        superGem: sg,
        gems: gameState.gems || [],
        boardGeometry,
        layoutScale,
        worldToCanvas,
      });
      if (!rect) continue;
      const superGemImg = getSuperGemRenderImage({
        superGem: sg,
        gemFrameImages,
        superGemFrameImages,
        superGemRainbowImage,
      });
      if (superGemImg) {
        ctx.drawImage(superGemImg, rect.x, rect.y, rect.w, rect.h);
      }
    }
  }

  if (gameState.boardCreated && gameState.gems) {
    for (const gem of gameState.gems) {
      if (!isLockedGem(gem)) continue;
      const rect = getGemRenderRect({ gem, worldToCanvas, layoutScale, now, gameTime });
      const frameIndex = Number(gem.color ?? 0) % 6;
      const gemImg = gemFrames[frameIndex] || null;
      const lockedGemImg = gemImg ? getLockedGemGraySprite(gemImg) : null;
      const drawLockedGemSprite = lockedGemImg ? () => ctx.drawImage(lockedGemImg, rect.x, rect.y, rect.w, rect.h) : null;
      renderLockedGemOverlay(ctx, rect, getLockedGemCountdown(gem), drawLockedGemSprite);
    }
  }

  if (gameState.yellowCasino && gameState.yellowCasino.ghost) {
    const ghost = gameState.yellowCasino.ghost;
    const pos = worldToCanvas(ghost.x, ghost.y);
    const frameIndex = (ghost.frame ?? 0) % 6;
    const gemImg = gemFrames[frameIndex];
    const w = ghost.w * layoutScale;
    const h = ghost.h * layoutScale;
    const gemX = pos.x - w * 0.5;
    const gemY = pos.y - h * 0.5;
    if (gemImg) {
      ctx.drawImage(gemImg, gemX, gemY, w, h);
    } else {
      ctx.fillStyle = '#ffa500';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, w * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
