// Crimson Ward presentation: glowing crimson energy rising off each warded hero's own silhouette,
// drawn behind the sprite from the current puppet frame. The WebGL shader (heroWardShader) is the
// production look; the 2D layers below are the fallback when WebGL is unavailable. Glow is a cheap bloom: silhouettes are
// blurred by down/up-sampling. Everything is normal-alpha: additive light turns red to salmon on
// bright sand, so the glow reads from a deep crimson falloff around a hot orange-red core. Pure presentation: it reads the hero's
// ward and timestamps and never changes them. Rim masks are cached per frame image and size in a
// small LRU so memory stays bounded on phones.
import { actorPuppetFrameRect } from './actorPuppetPresentation.mjs';
import { runtimeAssetUrl } from './runtimeAssetUrl.mjs';
import { drawHeroWardShader } from './heroWardShader.mjs';

const FADE_IN = .12, HIT = .15, BREAK = .3, PAD = 14;
const CRIMSON = '#B4001F', HOT = '#FF4A2E', FLASH = '#FFD9A8';
const TILE_PATH = 'images/vfx_crimson_energy_tile.png';
const MASK_CACHE_LIMIT = 64, masks = new Map(), scratch = new Map();
let tile = null, flameMask = null;

// High-contrast flame mask from the authored energy tile (alpha pushed through a steep curve).
function energyMask() {
  if (flameMask) return flameMask;
  if (!tile && typeof Image !== 'undefined') { tile = new Image(); tile.src = runtimeAssetUrl(TILE_PATH); }
  if (!tile?.complete || !tile.naturalWidth) return null;
  const c = canvas(tile.naturalWidth, tile.naturalHeight), x = c.getContext('2d');
  x.drawImage(tile, 0, 0);
  const image = x.getImageData(0, 0, c.width, c.height), d = image.data;
  for (let i = 3; i < d.length; i += 4) { const v = Math.min(1, Math.max(0, (d[i] / 255 - .42) / .3)); d[i] = Math.round(255 * v * v * (3 - 2 * v)); }
  x.putImageData(image, 0, 0);
  return (flameMask = c);
}

const canvas = (w, h) => {
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};
const smooth = x => { x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; return x; };

// Solid silhouette of the frame, tinted, at device resolution.
function tinted(frame, w, h, pad, color) {
  const c = canvas(w + 2 * pad, h + 2 * pad), x = c.getContext('2d');
  x.drawImage(frame, pad, pad, w, h);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}
// Cheap blur: halve repeatedly, then scale back up with smoothing (approximates a Gaussian).
function blur(src, radius) {
  let level = src;
  for (let size = 1; size * 4 <= radius; size *= 2) {
    const next = canvas(level.width / 2, level.height / 2);
    smooth(next.getContext('2d')).drawImage(level, 0, 0, next.width, next.height);
    level = next;
  }
  const out = canvas(src.width, src.height);
  smooth(out.getContext('2d')).drawImage(level, 0, 0, out.width, out.height);
  return out;
}
// Thin ring dilation for the hot edge.
function dilate(src, radius) {
  const c = canvas(src.width, src.height), x = c.getContext('2d');
  for (let i = 0; i < 12; i += 1) {
    const a = i * Math.PI / 6;
    x.drawImage(src, Math.round(Math.cos(a) * radius), Math.round(Math.sin(a) * radius));
  }
  return c;
}

function frameMasks(frame, w, h, k) {
  const key = `${w}x${h}`, cached = masks.get(frame);
  if (cached?.key === key) { masks.delete(frame); masks.set(frame, cached); return cached.entry; }
  const pad = Math.ceil(PAD * k), base = tinted(frame, w, h, pad, CRIMSON), hot = tinted(frame, w, h, pad, HOT);
  const entry = {
    pad, base,
    halo: blur(dilate(base, 2 * k), 5 * k),               // soft crimson falloff
    inner: blur(dilate(base, 1.5 * k), 2 * k),             // dense crimson glow at the body
    bloom: blur(dilate(hot, k), 2 * k),                    // hot orange-red core light
    rim: blur(dilate(hot, Math.max(1, .5 * k)), k),        // soft bright contour, never a hard line
  };
  masks.delete(frame); masks.set(frame, { key, entry });
  if (masks.size > MASK_CACHE_LIMIT) masks.delete(masks.keys().next().value);
  return entry;
}

// Flame tongues: the silhouette smeared upward at low resolution, cut by the scrolling energy
// texture, then upscaled so the tongues come out soft and glowing.
function flames(uid, m, k, t, rise, strength) {
  const q = 4, wq = Math.ceil(m.base.width / q), hq = Math.ceil(m.base.height / q);
  let small = scratch.get(uid);
  if (small?.width !== wq || small?.height !== hq) { small = canvas(wq, hq); scratch.set(uid, small); }
  const x = smooth(small.getContext('2d'));
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, wq, hq);
  for (let i = 1; i <= 10; i += 1) {
    x.globalAlpha = Math.min(1, strength * (1.15 - i / 11));
    x.drawImage(m.base, 0, -(i * rise * k) / q, small.width, small.height);
  }
  const mask = energyMask();
  if (mask) {
    x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in';
    const size = 40 * k / q, offset = ((t * 30 * k / q) % size + size) % size, sway = Math.sin(t * 1.7) * size * .2;
    for (let ty = -offset - size; ty < small.height; ty += size) for (let tx = -size + sway; tx < small.width + size; tx += size) x.drawImage(mask, tx, ty, size, size);
  }
  return small;
}

// 0..1 ward visibility and state for this hero right now.
export function heroWardAuraState(globals, uid) {
  const visual = globals?.HeroWardVisualByUID?.[String(uid)];
  if (!visual) return null;
  const now = Number(globals.time || 0), live = Number(globals.HeroWardHPByUID?.[String(uid)] || 0) > 0;
  if (live) {
    const hit = visual.hitAt == null ? 0 : Math.max(0, 1 - (now - Number(visual.hitAt)) / HIT);
    return { phase: 'live', alpha: Math.min(1, Math.max(0, (now - Number(visual.startedAt || 0)) / FADE_IN)), hit, now };
  }
  if (visual.endedAt == null) return null;
  const u = (now - Number(visual.endedAt)) / BREAK;
  return u >= 0 && u < 1 ? { phase: 'break', u, now } : null;
}

export function drawHeroWardAura(ctx, { globals, uid, puppet, footX, footY, height }) {
  const state = heroWardAuraState(globals, uid);
  const rect = state && puppet?.frame ? actorPuppetFrameRect(puppet, { footX, footY, height }) : null;
  if (!rect) return false;
  const k = Math.max(1, Math.abs(ctx.getTransform?.().a || 1));
  const w = Math.max(1, Math.round(rect.width * k)), h = Math.max(1, Math.round(rect.height * k));
  const live = state.phase === 'live', u = live ? 0 : state.u;
  if (drawHeroWardShader(ctx, { frame: puppet.frame, rect, k, pad: Math.ceil(PAD * k), time: state.now, hit: live ? state.hit : 0, breakU: u, alpha: live ? state.alpha : 1 })) return true;
  const m = frameMasks(puppet.frame, w, h, k), t = state.now;
  const boost = live ? 1 + state.hit * 1.5 : 0, breathe = .85 + .15 * Math.sin(t * 6);
  const fade = live ? state.alpha : Math.pow(1 - u, .7);
  const at = (layer, dy = 0) => ctx.drawImage(layer, rect.drawX - m.pad / k, rect.drawY - m.pad / k + dy, layer.width / k, layer.height / k);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  // 1. Wide crimson falloff, then the rising flame tongues, then a dense crimson glow.
  ctx.globalAlpha = fade * .6 * breathe;
  at(m.halo, -u * 4);
  const fl = flames(uid, m, k, t, live ? 1.4 : 1.4 + u * 3, live ? Math.min(1.5, boost) : 1);
  ctx.globalAlpha = fade;
  ctx.drawImage(fl, rect.drawX - m.pad / k, rect.drawY - m.pad / k - u * 4, m.base.width / k, m.base.height / k);
  ctx.globalAlpha = fade * Math.min(1, .7 * boost);
  at(m.inner, -u * 4);
  // 2. Hot core: soft orange-red light and a thin bright contour; both pulse and flare on a hit.
  ctx.globalAlpha = fade * Math.min(1, (.6 + .2 * Math.sin(t * 9)) * boost);
  at(m.bloom, -u * 4);
  ctx.globalAlpha = fade * Math.min(1, (live ? .45 : .9) * boost || .9);
  at(m.rim);
  if (!live && u < .2) {
    // Break: one hot flash along the contour before the energy peels away.
    ctx.globalAlpha = 1 - u / .2;
    const flash = canvas(m.rim.width, m.rim.height), fx = flash.getContext('2d');
    fx.drawImage(m.rim, 0, 0); fx.globalCompositeOperation = 'source-in'; fx.fillStyle = FLASH; fx.fillRect(0, 0, flash.width, flash.height);
    at(flash);
  }
  ctx.restore();
  return true;
}
