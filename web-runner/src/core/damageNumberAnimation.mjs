import { gsap } from './gsapShim.mjs';

const DAMAGE_TEXT_FONT = '"Rubik Mono One", "Trebuchet MS", "Verdana", sans-serif';
const DAMAGE_TEXT_FONT_SPEC = `28px ${DAMAGE_TEXT_FONT}`;
const ENERGY_TEXT_COLOR = '#D87DFF';
let damageTextFontPromise = null;
let damageTextFontReady = false;

export function ensureDamageTextFontReady() {
  if (damageTextFontReady) return Promise.resolve(true);
  if (typeof document === 'undefined' || !document.fonts || typeof document.fonts.load !== 'function') {
    damageTextFontReady = true;
    return Promise.resolve(true);
  }
  if (!damageTextFontPromise) {
    damageTextFontPromise = document.fonts
      .load(DAMAGE_TEXT_FONT_SPEC, '0')
      .then(() => (document.fonts.ready ? document.fonts.ready : null))
      .catch(() => null)
      .then(() => {
        damageTextFontReady = true;
        return true;
      });
  }
  return damageTextFontPromise;
}

export function isDamageTextFontReady() {
  if (damageTextFontReady) return true;
  if (typeof document === 'undefined' || !document.fonts || typeof document.fonts.check !== 'function') {
    return true;
  }
  return document.fonts.check(DAMAGE_TEXT_FONT_SPEC, '0');
}

export function createDamageNumber({
  text,
  x,
  y,
  kind = 'damage',
  targetKind = null,
  isCrit = false,
  container,
}) {
  if (!container || typeof document === 'undefined') return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'damage-number';
  wrapper.style.position = 'absolute';
  wrapper.style.left = `${Number(x || 0)}px`;
  wrapper.style.top = `${Number(y || 0)}px`;
  wrapper.style.transform = 'translate(-50%, -50%)';
  wrapper.style.transformOrigin = 'center bottom';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.whiteSpace = 'nowrap';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'flex-end';
  wrapper.style.justifyContent = 'center';
  wrapper.style.gap = '0px';
  wrapper.style.zIndex = '4';

  gsap.set(wrapper, {
    x: 0,
    y: 0,
    opacity: 0,
    transformOrigin: 'center bottom',
  });

  const normalizedKind = String(kind || 'damage');
  const isHeal = normalizedKind === 'heal';
  const isEnergy = normalizedKind === 'energy';
  const gradientStops = isEnergy
    ? [ENERGY_TEXT_COLOR, ENERGY_TEXT_COLOR]
    : (isHeal
        ? ['#86eb2e', '#9fdfff']
        : ['#fbfdce', '#f7f8d4']);
  const timelines = [];

  const cleanup = () => {
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
  };

  const value = String(text || '');
  const fontSize = 28;
  const approxWidth = Math.max(72, Math.ceil(value.length * 24 + 40));
  const approxHeight = 72;
  const numberText = document.createElement('canvas');
  numberText.width = approxWidth;
  numberText.height = approxHeight;
  numberText.style.width = `${approxWidth}px`;
  numberText.style.height = `${approxHeight}px`;
  numberText.style.position = 'relative';
  numberText.style.display = 'block';
  numberText.style.overflow = 'visible';
  numberText.style.willChange = 'transform, opacity';
  numberText.style.pointerEvents = 'none';
  numberText.style.background = 'transparent';
  numberText.style.backgroundColor = 'transparent';
  numberText.style.border = 'none';
  numberText.style.flex = '0 0 auto';
  numberText.style.outline = 'none';

  const ctx = numberText.getContext('2d');
  const drawGlyph = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, approxWidth, approxHeight);
    const gradient = ctx.createLinearGradient(0, 0, 0, approxHeight);
    gradient.addColorStop(0, gradientStops[0]);
    gradient.addColorStop(1, gradientStops[1]);

    ctx.save();
    ctx.font = `${fontSize}px ${DAMAGE_TEXT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f0f0f';
    ctx.lineWidth = 5;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeText(value, approxWidth / 2, approxHeight / 2 + 1);
    ctx.fillStyle = gradient;
    ctx.fillText(value, approxWidth / 2, approxHeight / 2 + 1);
    ctx.restore();
  };
  wrapper.appendChild(numberText);

  let started = false;
  let killed = false;
  let activeTimeline = null;
  const startAnimation = () => {
    if (started || killed) return;
    started = true;
    drawGlyph();
    gsap.set(numberText, {
      y: 0,
      rotation: 0,
      transformOrigin: 'center bottom',
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
    });

    const tl = activeTimeline = gsap.timeline({
      onComplete: cleanup,
    });
    timelines.push(tl);

    tl.set(wrapper, {
      opacity: 1,
      y: 0,
    });

    const floatY = isEnergy ? -32.2 : -28;

    tl.to(wrapper, {
      y: floatY,
      duration: 0.8,
      ease: 'power2.out',
    }, 0);

    tl.to(wrapper, {
      y: floatY,
      opacity: 1,
      duration: 0.484,
      ease: 'none',
    });

    tl.to(wrapper, {
      opacity: 0,
      duration: 0.16,
      ease: 'sine.out',
    });
  };

  container.appendChild(wrapper);
  if (isDamageTextFontReady()) {
    startAnimation();
  } else {
    ensureDamageTextFontReady().then(() => {
      if (!killed) startAnimation();
    });
  }
  return {
    wrapper,
    timelines,
    kill() {
      killed = true;
      for (const tl of timelines) tl.kill();
      cleanup();
    },
  };
}
