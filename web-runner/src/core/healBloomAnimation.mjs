import { gsap } from './gsapShim.mjs';

const HEAL_BLOOM_WIDTH_SCALE = 0.8;

function random(min, max) {
  return Math.random() * (max - min) + min;
}

export function createHealBloom({
  x,
  y,
  targetUID = 0,
  ownerUID = 0,
  count = 12,
  presentation = 'minor',
}) {
  const total = Math.max(8, Math.min(14, Math.floor(Number(count || 12))));
  const particles = [];
  const timelines = [];
  const animation = {
    x: Number(x || 0),
    y: Number(y || 0),
    targetUID: Number(targetUID || 0),
    ownerUID: Number(ownerUID || targetUID || 0),
    presentation: presentation === 'major' ? 'major' : 'minor',
    particles,
    timelines,
    complete: false,
    kill() {
      for (const tl of timelines) tl.kill();
      animation.complete = true;
    },
  };

  for (let i = 0; i < total; i += 1) {
    const dx = random(-24, 24) * HEAL_BLOOM_WIDTH_SCALE;
    const dy = -random(44, 78);
    const delay = (i / total) * 0.22;
    const riseDuration = 1.05 - delay;
    const rotation = random(-12, 12);
    const particle = {
      glyph: '➕',
      x: 0,
      y: 0,
      opacity: 0,
      scale: 0.4,
      rotation,
      fontSize: random(16, 28),
      fontWeight: 800,
      color: '#A0FE0B',
    };
    particles.push(particle);

    const tl = gsap.timeline();
    tl.to(particle, {
      scale: 0.82,
      opacity: 0.86,
      duration: 0.14,
      ease: 'sine.out',
    }, delay);
    tl.to(particle, {
      x: dx,
      y: dy,
      scale: 1,
      duration: riseDuration,
      ease: 'sine.out',
    });
    tl.to(particle, {
      y: '-=8',
      opacity: 0,
      scale: 0.86,
      duration: 0.3,
      ease: 'sine.inOut',
      onComplete: () => {
        particle.complete = true;
        if (particles.every((entry) => entry.complete)) animation.complete = true;
      },
    });
    timelines.push(tl);
  }

  return animation;
}
