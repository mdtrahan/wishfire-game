import { gsap } from './gsapShim.mjs';

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function cubicBezierPoint(start, controlA, controlB, end, t) {
  const inv = 1 - t;
  return (
    (inv * inv * inv * start) +
    (3 * inv * inv * t * controlA) +
    (3 * inv * t * t * controlB) +
    (t * t * t * end)
  );
}

export function createGoldCollectAnimation({
  items,
  target,
  onComplete = null,
}) {
  const renderItems = [];
  const timelines = [];
  let remaining = 0;

  const finishOne = () => {
    remaining -= 1;
    if (remaining <= 0 && typeof onComplete === 'function') onComplete();
  };

  for (const item of items || []) {
    if (!item) continue;
    const angle = random(0, Math.PI * 2);
    const distance = random(36, 72);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance * 0.7;
    const delay = random(0, 0.12);
    const hoverDelay = random(0.05, 0.12);
    const state = {
      x: Number(item.x || 0),
      y: Number(item.y || 0),
      scale: 1,
      opacity: 1,
      frameIndex: Number(item.frameIndex || 0),
    };
    renderItems.push(state);
    remaining += 1;

    const tl = gsap.timeline({
      delay,
      onComplete: finishOne,
    });

    tl.to(state, {
      x: state.x + dx,
      y: state.y + dy,
      duration: 0.3,
      ease: 'power2.out',
    });

    tl.to(state, {
      y: '-=10',
      duration: hoverDelay,
      ease: 'sine.out',
    }, '>-0.04');

    const travel = { t: 0 };
    const easeBlend = gsap.parseEase('sine.inOut');
    const easeFinish = gsap.parseEase('expo.in');

    tl.to(travel, {
      t: 1,
      duration: 0.62,
      ease: 'none',
      onStart: () => {
        travel.startX = Number(state.x || 0);
        travel.startY = Number(state.y || 0);
        travel.controlAX = travel.startX + (dx * 0.22);
        travel.controlAY = travel.startY + (dy * 0.22) - 6;
        travel.controlBX = travel.startX + ((Number(target.x || 0) - travel.startX) * 0.42);
        travel.controlBY = travel.startY + ((Number(target.y || 0) - travel.startY) * 0.42) - 12;
      },
      onUpdate: () => {
        const raw = Number(travel.t || 0);
        const curveProgress = raw < 0.68
          ? 0.68 * easeBlend(raw / 0.68)
          : 0.68 + (0.32 * easeFinish((raw - 0.68) / 0.32));
        state.x = cubicBezierPoint(
          travel.startX,
          travel.controlAX,
          travel.controlBX,
          Number(target.x || 0),
          curveProgress,
        );
        state.y = cubicBezierPoint(
          travel.startY,
          travel.controlAY,
          travel.controlBY,
          Number(target.y || 0),
          curveProgress,
        );
        state.scale = 1 - (0.65 * raw);
        state.opacity = 1 - raw;
      },
    });

    timelines.push(tl);
  }

  return {
    items: renderItems,
    timelines,
    kill() {
      for (const tl of timelines) tl.kill();
    },
  };
}
