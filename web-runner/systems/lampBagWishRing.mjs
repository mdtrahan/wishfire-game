const STYLE_ID = 'lamp-bag-wish-ring-style';
const PARTICLE_KINDS = Object.freeze([
  'star', 'star', 'speck', 'star', 'star', 'speck',
  'star', 'star', 'speck', 'star', 'star', 'speck',
]);
const activeByArt = new WeakMap();

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function installStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .lamp-wish-ring-vfx{position:fixed;left:0;top:0;width:0;height:0;z-index:22;pointer-events:none}
    .lamp-wish-ring-glow,.lamp-wish-ring-star,.lamp-wish-ring-speck,.lamp-wish-ring-ring{position:absolute;left:0;top:0;transform:translate(-50%,-50%);pointer-events:none}
    .lamp-wish-ring-glow{width:var(--wish-glow-size);height:var(--wish-glow-size);border-radius:50%;background:radial-gradient(circle,#fff 0%,#f8f2ff 13%,#d5c0ff 29%,#986cf2 50%,#8157dd55 67%,transparent 78%);filter:blur(2px);mix-blend-mode:screen;animation:lamp-wish-ring-glow 640ms ease-out both}
    .lamp-wish-ring-vfx.lamp-wish-reduced .lamp-wish-ring-glow{opacity:.24;animation:lamp-wish-ring-gentle 300ms ease-out both}
    .lamp-wish-ring-star{clip-path:polygon(50% 0,58% 40%,100% 50%,58% 60%,50% 100%,42% 60%,0 50%,42% 40%);background:radial-gradient(circle,#fff 0 22%,#fcf8ff 24% 38%,#bda0ff 42% 54%,#5730b6 58% 73%,transparent 78%);filter:drop-shadow(0 0 2px #d9c6ff);animation:lamp-wish-ring-burst var(--wish-duration) cubic-bezier(.2,.8,.25,1) 300ms both}
    .lamp-wish-ring-speck{border-radius:50%;background:#fff;box-shadow:0 0 3px 1px #a779ff;animation:lamp-wish-ring-burst var(--wish-duration) cubic-bezier(.2,.8,.25,1) 300ms both}
    .lamp-wish-ring-ring{box-sizing:border-box;width:var(--wish-ring-size);height:var(--wish-ring-size);border:3px solid #9b72ff;border-radius:50%;box-shadow:0 0 6px #be9aff,inset 0 0 4px #e2d3ff;animation:lamp-wish-ring-crest 290ms ease-out both}
    @keyframes lamp-wish-ring-glow{0%{opacity:0;transform:translate(-50%,-50%) scale(.72)}18%{opacity:.5;transform:translate(-50%,-50%) scale(1.08)}42%{opacity:.3;transform:translate(-50%,-50%) scale(1.02)}100%{opacity:0;transform:translate(-50%,-50%) scale(.94)}}
    @keyframes lamp-wish-ring-gentle{0%{opacity:0}25%{opacity:.28}100%{opacity:0}}
    @keyframes lamp-wish-ring-burst{0%{opacity:0;transform:translate(-50%,-50%) scale(0) rotate(0);animation-timing-function:cubic-bezier(.2,.8,.25,1)}9%{opacity:1;transform:translate(calc(-50% + var(--wish-mid-x)),calc(-50% + var(--wish-mid-y))) scale(1.2) rotate(var(--wish-rotation));animation-timing-function:cubic-bezier(.2,.8,.25,1)}18%{opacity:1;transform:translate(calc(-50% + var(--wish-x)),calc(-50% + var(--wish-y))) scale(1) rotate(var(--wish-rotation));animation-timing-function:cubic-bezier(.2,.8,.25,1)}68%{opacity:.95;transform:translate(calc(-50% + var(--wish-x)),calc(-50% + var(--wish-y))) scale(1) rotate(var(--wish-rotation));animation-timing-function:linear}100%{opacity:0;transform:translate(calc(-50% + var(--wish-tail-x)),calc(-50% + var(--wish-tail-y))) scale(.5) rotate(var(--wish-rotation))}}
    @keyframes lamp-wish-ring-crest{0%{opacity:.9;transform:translate(-50%,-50%) scale(1);border-width:3px}100%{opacity:0;transform:translate(-50%,-50%) scale(1.875);border-width:1px}}
  `;
  doc.head.append(style);
}

export function beginLampBagWishRing(art, { doc = art?.ownerDocument || globalThis.document, timers = globalThis, reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches, random = Math.random } = {}) {
  if (!art?.getBoundingClientRect || !doc?.body) return { crest() {}, cancel() {} };
  activeByArt.get(art)?.cancel();
  installStyle(doc);
  const bounds = art.getBoundingClientRect();
  const baseSize = Math.min(bounds.width, bounds.height);
  if (!(baseSize > 0)) return { crest() {}, cancel() {} };
  const scale = Math.min(1.2, Math.max(.65, baseSize / 70));
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const viewportWidth = doc.documentElement?.clientWidth || globalThis.innerWidth || Infinity;
  const viewportHeight = doc.documentElement?.clientHeight || globalThis.innerHeight || Infinity;
  const stage = doc.querySelector?.('canvas')?.getBoundingClientRect?.();
  const left = Math.max(0, stage?.left ?? 0), top = Math.max(0, stage?.top ?? 0);
  const right = Math.min(viewportWidth, stage?.right ?? viewportWidth);
  const bottom = Math.min(viewportHeight, stage?.bottom ?? viewportHeight);
  const availableRadius = Math.max(0, Math.min(centerX - left, right - centerX, centerY - top, bottom - centerY));
  const particleClearance = 12 * scale;
  const initialRadius = Math.min(baseSize * .56, Math.max(0, availableRadius - particleClearance));
  const ringSize = Math.min(baseSize * .4, Math.max(0, availableRadius - 6) * 2 / 1.875);
  const reduced = reducedMotion();
  const node = doc.createElement('span');
  node.className = `lamp-wish-ring-vfx${reduced ? ' lamp-wish-reduced' : ''}`;
  node.setAttribute('aria-hidden', 'true');
  Object.assign(node.style, { left: `${bounds.left + bounds.width / 2}px`, top: `${bounds.top + bounds.height / 2}px` });
  const glow = doc.createElement('i');
  glow.className = 'lamp-wish-ring-glow';
  glow.style.setProperty('--wish-glow-size', `${baseSize * 1.22}px`);
  node.append(glow);
  doc.body.append(node);

  let cancelled = false;
  let ringShown = false;
  const timeouts = new Set();
  const effect = {
    crest(scale, time) {
      if (cancelled || reduced || ringShown || ringSize < 6) return;
      ringShown = true;
      const ring = doc.createElement('i');
      ring.className = 'lamp-wish-ring-ring';
      ring.style.setProperty('--wish-ring-size', `${ringSize}px`);
      ring.dataset.crestScale = String(scale);
      ring.dataset.crestTime = String(time);
      node.append(ring);
    },
    cancel() {
      if (cancelled) return;
      cancelled = true;
      for (const timeout of timeouts) timers.clearTimeout(timeout);
      timeouts.clear();
      node.remove();
      if (activeByArt.get(art) === effect) activeByArt.delete(art);
    },
  };
  activeByArt.set(art, effect);

  if (!reduced) {
    const kinds = shuffled(PARTICLE_KINDS, random);
    const starSizes = shuffled([5, 7, 8, 10, 12, 14, 16, 18], random);
    const speckSizes = shuffled([2.5, 3.5, 4.5, 5], random);
    let starIndex = 0, speckIndex = 0;
    kinds.forEach((kind, index) => {
      const size = (kind === 'star' ? starSizes[starIndex++] : speckSizes[speckIndex++]) * scale;
      const angle = random() * Math.PI * 2;
      const spread = .92 + random() * .16;
      const directionX = Math.cos(angle), directionY = Math.sin(angle);
      const horizontalLimit = directionX > 0 ? (right - centerX - particleClearance) / directionX : directionX < 0 ? (left + particleClearance - centerX) / directionX : Infinity;
      const verticalLimit = directionY > 0 ? (bottom - centerY - particleClearance) / directionY : directionY < 0 ? (top + particleClearance - centerY) / directionY : Infinity;
      const safeTailRadius = Math.max(0, Math.min(horizontalLimit, verticalLimit));
      const startRadius = Math.min(initialRadius * spread, safeTailRadius / 1.25);
      const endRadius = startRadius * 1.25;
      const dx = directionX * startRadius;
      const dy = directionY * startRadius;
      const particle = doc.createElement('i');
      particle.className = kind === 'star' ? 'lamp-wish-ring-star' : 'lamp-wish-ring-speck';
      particle.style.setProperty('--wish-x', `${dx}px`);
      particle.style.setProperty('--wish-y', `${dy}px`);
      particle.style.setProperty('--wish-mid-x', `${dx * .55}px`);
      particle.style.setProperty('--wish-mid-y', `${dy * .55}px`);
      particle.style.setProperty('--wish-tail-x', `${directionX * endRadius}px`);
      particle.style.setProperty('--wish-tail-y', `${directionY * endRadius}px`);
      particle.style.setProperty('--wish-rotation', `${random() * 360}deg`);
      particle.style.setProperty('--wish-duration', `${530 + index * (240 / 11)}ms`);
      particle.style.width = `${size * scale}px`;
      particle.style.height = `${size * scale}px`;
      particle.dataset.angle = String(angle * 180 / Math.PI);
      particle.dataset.travel = String(endRadius / (baseSize * .56));
      node.append(particle);
    });
  }
  const cleanup = timers.setTimeout(() => effect.cancel(), reduced ? 300 : 1200);
  timeouts.add(cleanup);
  return effect;
}

export function watchLampBagBounceCrest(art, animation, effect) {
  let peak = 1;
  let descendingFrames = 0;
  let stopped = false;
  const sample = () => {
    if (stopped || !art?.isConnected || art.ownerDocument?.hidden || !animation || ['finished', 'idle'].includes(animation.playState)) { stopped = true; return; }
    const transform = getComputedStyle(art).transform;
    const scale = transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a;
    const time = Number(animation.currentTime) || 0;
    if (scale > peak + .004) { peak = scale; descendingFrames = 0; }
    else if (peak > 1.05 && scale < peak - .02) descendingFrames += 1;
    else descendingFrames = 0;
    if (descendingFrames >= 2) { stopped = true; effect?.crest(peak, time); return; }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  return () => { stopped = true; };
}
