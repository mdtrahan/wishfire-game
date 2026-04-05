import { gsap } from './gsapShim.mjs';

function random(min, max) {
  return Math.random() * (max - min) + min;
}

let damageNumberSeq = 0;
const DAMAGE_TEXT_FONT = '"Rubik Mono One", "Trebuchet MS", "Verdana", sans-serif';
const DAMAGE_TEXT_FONT_SPEC = `28px ${DAMAGE_TEXT_FONT}`;
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
    transformOrigin: 'center bottom',
  });

  const isHeal = String(kind || 'damage') === 'heal';
  const fallbackColor = isHeal ? '#b9ffd7' : '#ffe59d';
  const gradientStops = isHeal
    ? ['#86eb2e', '#9fdfff']
    : ['#fbfdce', '#f7f8d4'];
  const glowColor = isHeal
    ? 'rgba(140, 255, 205, 0.38)'
    : 'rgba(251, 253, 206, 0.28)';
  const seq = ++damageNumberSeq;

  const timelines = [];

  const cleanup = () => {
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
  };

  const wrapperTimeline = gsap.timeline({
    onComplete: cleanup,
  });

  wrapperTimeline.to(wrapper, {
    y: '-=60',
    duration: 0.8,
    ease: 'power2.out',
  });

  wrapperTimeline.to(wrapper, {
    x: '+=4',
    duration: 0.6,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: 1,
  }, 0.26);

  timelines.push(wrapperTimeline);

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
    ctx.save();
    ctx.font = `${fontSize}px ${DAMAGE_TEXT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = glowColor;
    ctx.globalAlpha = 0.7;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillText(value, approxWidth / 2, approxHeight / 2 + 3);
    ctx.restore();

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
    ctx.strokeText(value, approxWidth / 2, approxHeight / 2 + 1);
    ctx.fillStyle = gradient;
    ctx.fillText(value, approxWidth / 2, approxHeight / 2 + 1);
    ctx.restore();
  };
  wrapper.appendChild(numberText);

  const impactScale = isCrit ? 1.35 : 1.25;

  let started = false;
  let killed = false;
  const startAnimation = () => {
    if (started || killed) return;
    started = true;
    drawGlyph();
    wrapper.style.opacity = '1';
    gsap.set(numberText, {
      y: random(-2, 2),
      rotation: random(-3, 3),
      transformOrigin: 'center bottom',
    });

    const tl = gsap.timeline();

    if (isCrit) {
      tl.fromTo(numberText, {
        scaleX: 0.45,
        scaleY: 0.32,
        opacity: 0,
      }, {
        scaleX: 0.82,
        scaleY: 0.62,
        opacity: 1,
        duration: 0.06,
        ease: 'expo.in',
      });
    }

    tl.fromTo(numberText, {
      scaleX: 0.62,
      scaleY: 0.5,
      opacity: 0,
    }, {
      scaleX: impactScale * 1.09,
      scaleY: impactScale * 0.87,
      opacity: 1,
      duration: 0.12,
      ease: 'back.out(1.7)',
    });

    tl.to(numberText, {
      scaleX: 0.97,
      scaleY: 1.02,
      duration: 0.1,
      ease: 'power2.out',
    });

    tl.to(numberText, {
      scaleX: 1.03,
      scaleY: 1.06,
      duration: 0.04,
      ease: 'sine.out',
    });

    tl.to(numberText, {
      scaleX: 1.06,
      scaleY: 1.12,
      duration: 0.44,
      ease: 'sine.inOut',
    }, '<');

    tl.to(numberText, {
      scaleX: 1.14,
      scaleY: 1.2,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
    });

    timelines.push(tl);
  };

  wrapper.style.opacity = '0';
  if (isDamageTextFontReady()) {
    startAnimation();
  } else {
    ensureDamageTextFontReady().then(() => {
      if (!killed) startAnimation();
    });
  }

  container.appendChild(wrapper);
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
