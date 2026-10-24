// Crimson Ward presentation: restrained crimson energy hugging each warded hero's own silhouette,
// drawn behind the sprite from the current puppet frame. Pure presentation: it reads the hero's
// ward and timestamps and never changes them. Rim masks are cached per frame image and size in a
// small LRU so memory stays bounded on phones.
import { actorPuppetFrameRect } from './actorPuppetPresentation.mjs';
import { runtimeAssetUrl } from './runtimeAssetUrl.mjs';

const FADE_IN = .12, HIT = .15, BREAK = .3, PAD = 7;
const CRIMSON = '#BE122E', HOT = '#EE253E', FLASH = '#FFE6BC', EMBER = 'rgba(255,123,80,';
const TILE_PATH = 'images/vfx_crimson_energy_tile.png';
const MASK_CACHE_LIMIT = 64, masks = new Map(), scratch = new Map();
let tile = null;

function energyTile() {
  if (tile || typeof Image === 'undefined') return tile?.complete && tile.naturalWidth ? tile : null;
  tile = new Image();
  tile.src = runtimeAssetUrl(TILE_PATH);
  return null;
}

const canvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};

// Solid silhouette of the frame, tinted, at device resolution.
function tinted(frame, w, h, pad, color) {
  const c = canvas(w + 2 * pad, h + 2 * pad), x = c.getContext('2d');
  x.drawImage(frame, pad, pad, w, h);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}
// Ring dilation: stamp the silhouette around a circle; alpha per ring gives a soft falloff.
function dilate(src, rings) {
  const c = canvas(src.width, src.height), x = c.getContext('2d');
  for (const [radius, alpha] of rings) {
    x.globalAlpha = alpha;
    for (let i = 0; i < 12; i += 1) {
      const a = i * Math.PI / 6;
      x.drawImage(src, Math.round(Math.cos(a) * radius), Math.round(Math.sin(a) * radius));
    }
  }
  return c;
}
// Upper-facing contour points where wisps rise (top 65% of the body only).
function contourTops(src, pad, h, step) {
  const data = src.getContext('2d').getImageData(0, 0, src.width, src.height).data, tops = [];
  for (let col = 0; col < src.width; col += step) {
    for (let row = 0; row < src.height; row += 1) {
      if (data[(row * src.width + col) * 4 + 3] > 100) { if (row < pad + h * .65) tops.push([col, row]); break; }
    }
  }
  return tops;
}

function frameMasks(frame, w, h, k) {
  const key = `${w}x${h}`, cached = masks.get(frame);
  if (cached?.key === key) { masks.delete(frame); masks.set(frame, cached); return cached.entry; }
  const pad = Math.ceil(PAD * k), base = tinted(frame, w, h, pad, CRIMSON), hotBase = tinted(frame, w, h, pad, HOT);
  const entry = {
    pad,
    glow: dilate(base, [[4 * k / 3, .16], [3 * k / 3, .24], [2 * k / 3, .34]]),
    hot: dilate(hotBase, [[k / 3, .9]]),
    tops: contourTops(base, pad, h, Math.max(2, Math.round(2.3 * k))),
  };
  masks.delete(frame); masks.set(frame, { key, entry });
  if (masks.size > MASK_CACHE_LIMIT) masks.delete(masks.keys().next().value);
  return entry;
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
  const m = frameMasks(puppet.frame, w, h, k), t = state.now;
  const out = scratch.get(uid)?.width === w + 2 * m.pad && scratch.get(uid)?.height === h + 2 * m.pad
    ? scratch.get(uid) : canvas(w + 2 * m.pad, h + 2 * m.pad);
  scratch.set(uid, out);
  const x = out.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  x.clearRect(0, 0, out.width, out.height);

  if (state.phase === 'live') {
    const breathe = .72 + .2 * Math.sin(t * 7), boost = 1 + state.hit * 2.2;
    x.globalAlpha = Math.min(1, breathe * boost); x.drawImage(m.glow, 0, 0);
    // Energy texture drifts upward through the glow, so the rim reads as rising energy.
    const image = energyTile();
    if (image) {
      x.globalCompositeOperation = 'source-atop'; x.globalAlpha = .55;
      const size = 128 * k / 3, offset = ((t * 40 * k / 3) % size + size) % size;
      for (let ty = -offset; ty < out.height; ty += size) for (let tx = 0; tx < out.width; tx += size) x.drawImage(image, tx, ty, size, size);
      x.globalCompositeOperation = 'source-over';
    }
    x.globalAlpha = Math.min(1, (.55 + .25 * Math.sin(t * 9)) * boost); x.drawImage(m.hot, 0, 0);
    // Slender curved wisps lift off the upper contour and flicker.
    m.tops.forEach(([cx, cy], j) => {
      const phase = (t * 2.5 + j * .317) % 1, flicker = .3 + .7 * Math.max(0, Math.sin(t * 9 + j * 2));
      const length = (2 + 2.7 * (.5 + .5 * Math.sin(t * 11 + j * 2.8))) * k * (.65 + .35 * Math.sin(Math.PI * phase));
      const drift = Math.sin(t * 8 + j) * .6 * k, half = .45 * k;
      x.globalAlpha = (.37 + .43 * Math.sin(Math.PI * phase)) * flicker;
      x.fillStyle = CRIMSON; x.beginPath();
      // Rounded, curling tip so wisps read as energy rather than spikes.
      const tipX = cx + drift, tipY = cy - length, tip = half * .55;
      x.moveTo(cx - half, cy + k / 3);
      x.quadraticCurveTo(cx - half * .9 + drift * .3, cy - length * .5, tipX - tip, tipY + tip);
      x.arc(tipX, tipY + tip, tip, Math.PI, 0);
      x.quadraticCurveTo(cx + half * .9 + drift * .3, cy - length * .5, cx + half, cy + k / 3);
      x.closePath(); x.fill();
    });
    if (state.hit > 0) {
      x.globalAlpha = state.hit; x.fillStyle = 'rgba(255,206,142,1)';
      for (let i = 0; i < 3; i += 1) {
        const px = out.width * (.78 + i * .05), py = out.height * (.35 + i * .1) - (1 - state.hit) * 3 * k, r = (.35 + .3 * state.hit) * k;
        x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
      }
    }
  } else {
    const u = state.u;
    if (u < .11) {
      x.drawImage(m.hot, 0, 0);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = FLASH; x.fillRect(0, 0, out.width, out.height);
    } else {
      // The rim peels upward and dissolves, shedding a few embers.
      x.globalAlpha = Math.pow(1 - u, .8); x.drawImage(m.glow, 0, -u * 6.3 * k);
      m.tops.slice(0, 5).forEach(([cx, cy], i) => {
        const r = Math.max(.05, (1 - u) * .27) * k;
        x.globalAlpha = .75 * (1 - u); x.fillStyle = `${EMBER}1)`;
        x.beginPath(); x.ellipse(cx + Math.sin(i + t * 4) * .7 * k, cy - u * (3.3 + i / 3) * k, r, r * 2, 0, 0, Math.PI * 2); x.fill();
      });
    }
  }
  ctx.save();
  ctx.globalAlpha *= state.phase === 'live' ? state.alpha : 1;
  ctx.drawImage(out, rect.drawX - m.pad / k, rect.drawY - m.pad / k, out.width / k, out.height / k);
  ctx.restore();
  return true;
}
