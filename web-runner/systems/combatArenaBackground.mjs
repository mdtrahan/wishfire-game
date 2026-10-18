import { runtimeAssetUrl } from './runtimeAssetUrl.mjs';

const CHAPTER_ART = Object.freeze([
  'chapter-01-oasis-court.webp',
  'chapter-02-garden-ruins.webp',
  'chapter-03-caravan-court.webp',
  'chapter-04-moonlit-terrace.webp',
]);
const images = new Map();

export function arenaBackgroundAsset(region = 1) {
  const chapter = Number(region);
  return Number.isInteger(chapter) && chapter >= 1 && chapter <= CHAPTER_ART.length
    ? 'arenas/' + CHAPTER_ART[chapter - 1] : null;
}

// Ground shares the actors' horizontal camera; HUD and vertical framing stay fixed.
export function drawCombatArenaBackground(ctx, { region, worldWidth, project, worldToCanvas, layoutH }) {
  const asset = arenaBackgroundAsset(region);
  if (!asset) return false;
  let image = images.get(asset);
  if (!image) {
    image = new Image();
    image.src = runtimeAssetUrl(asset);
    images.set(asset, image);
  }
  if (!image.complete || !image.naturalWidth) return false;
  const left = project(0, 0).x;
  const right = project(worldWidth, 0).x;
  const top = worldToCanvas(0, 0).y;
  const bottom = worldToCanvas(0, layoutH).y;
  ctx.save();
  ctx.translate(left, top);
  ctx.scale(right < left ? -1 : 1, 1);
  ctx.drawImage(image, 0, 0, Math.abs(right - left), bottom - top);
  ctx.restore();
  return true;
}
