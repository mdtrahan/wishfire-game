import { gsap } from '../../../node_modules/gsap/index.js';

function random(min, max) {
  return Math.random() * (max - min) + min;
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
  const isBarHeal = isHeal && String(targetKind || '') === 'bar';
  const hueStyle = isHeal
    ? (isBarHeal ? '0 0 10px rgba(5,253,27,0.85)' : '0 0 10px rgba(102,204,255,0.85)')
    : '0 2px 0 rgba(0,0,0,0.55)';

  const chars = Array.from(String(text || ''));
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

  chars.forEach((char, index) => {
    const digit = document.createElement('span');
    digit.textContent = char;
    digit.style.position = 'relative';
    digit.style.display = 'inline-block';
    digit.style.font = '700 28px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    digit.style.lineHeight = '1';
    digit.style.color = isHeal
      ? (isBarHeal ? '#05FD1B' : '#66CCFF')
      : '#FFFFFF';
    digit.style.textShadow = hueStyle;
    digit.style.willChange = 'transform, opacity, filter';
    wrapper.appendChild(digit);

    const initialY = random(-2, 2);
    const initialRotation = random(-3, 3);
    const delay = index * 0.02;
    const impactScale = isCrit ? 1.35 : 1.25;

    gsap.set(digit, {
      y: initialY,
      rotation: initialRotation,
      transformOrigin: 'center bottom',
    });

    const tl = gsap.timeline({
      delay,
    });

    if (isCrit) {
      tl.fromTo(digit, {
        scale: 0.4,
        opacity: 0,
      }, {
        scale: 0.7,
        opacity: 1,
        duration: 0.06,
        ease: 'expo.in',
      });
    }

    tl.fromTo(digit, {
      scale: 0.6,
      opacity: 0,
    }, {
      scale: impactScale,
      opacity: 1,
      duration: 0.12,
      ease: 'back.out(1.7)',
    });

    tl.to(digit, {
      scale: 0.95,
      duration: 0.1,
      ease: 'power2.out',
    });

    tl.to(digit, {
      scale: 1,
      duration: 0.04,
      ease: 'sine.out',
    });

    tl.to(digit, {
      scale: 0.9,
      duration: 0.44,
      ease: 'sine.inOut',
    }, '<');

    tl.to(digit, {
      scale: 0.75,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
    });

    timelines.push(tl);
  });

  container.appendChild(wrapper);
  return {
    wrapper,
    timelines,
    kill() {
      for (const tl of timelines) tl.kill();
      cleanup();
    },
  };
}
