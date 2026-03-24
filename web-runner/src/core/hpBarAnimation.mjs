import { gsap } from '../../../node_modules/gsap/index.js';

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

export function updateHP({
  current,
  max,
  frontBar,
  lagBar,
}) {
  const safeMax = Math.max(1, Number(max || 1));
  const targetPercent = clampPercent((Number(current || 0) / safeMax) * 100);
  const previousLag = clampPercent(lagBar.percent);
  const isDamage = targetPercent < previousLag;
  const lagDelay = isDamage ? 0.15 : 0.05;
  const lagDuration = isDamage ? 0.6 : 0.45;
  const lagEase = isDamage ? 'power2.out' : 'sine.out';

  gsap.killTweensOf([frontBar, lagBar]);

  gsap.to(frontBar, {
    percent: targetPercent,
    duration: 0.2,
    ease: 'power2.out',
  });

  gsap.fromTo(frontBar, {
    scaleY: 1,
  }, {
    scaleY: 1.05,
    duration: 0.08,
    yoyo: true,
    repeat: 1,
    ease: 'power1.out',
  });

  gsap.to(lagBar, {
    percent: targetPercent,
    delay: lagDelay,
    duration: lagDuration,
    ease: lagEase,
  });

  return {
    targetPercent,
    isDamage,
    lagDelay,
    lagDuration,
    lagEase,
  };
}
