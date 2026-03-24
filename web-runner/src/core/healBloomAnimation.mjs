import { gsap } from '../../../node_modules/gsap/index.js';

function random(min, max) {
  return Math.random() * (max - min) + min;
}

export function createHealBloom({
  x,
  y,
  count = 12,
}) {
  const total = Math.max(8, Math.min(14, Math.floor(Number(count || 12))));
  const particles = [];
  const timelines = [];
  const animation = {
    x: Number(x || 0),
    y: Number(y || 0),
    particles,
    timelines,
    complete: false,
    kill() {
      for (const tl of timelines) tl.kill();
      animation.complete = true;
    },
  };

  for (let i = 0; i < total; i += 1) {
    const angle = random(0, Math.PI * 2);
    const distance = random(40, 90);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance * 0.7;
    const delay = random(0, 0.15);
    const rotation = random(-20, 20);
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
    tl.delay(delay);
    tl.to(particle, {
      scale: 1.2,
      opacity: 1,
      duration: 0.12,
      ease: 'back.out(1.6)',
    });
    tl.to(particle, {
      x: dx,
      y: dy,
      scale: 1,
      duration: 0.28,
      ease: 'power2.out',
    });
    tl.to(particle, {
      y: '-=20',
      duration: 0.5,
      ease: 'sine.out',
    });
    tl.to(particle, {
      opacity: 0,
      scale: 0.8,
      duration: 0.4,
      ease: 'power1.out',
      onComplete: () => {
        particle.complete = true;
        if (particles.every((entry) => entry.complete)) animation.complete = true;
      },
    }, 0.7);
    timelines.push(tl);
  }

  return animation;
}
