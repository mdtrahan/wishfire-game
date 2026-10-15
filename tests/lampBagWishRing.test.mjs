import test from 'node:test';
import assert from 'node:assert/strict';
import { beginLampBagWishRing } from '../web-runner/systems/lampBagWishRing.mjs';

class FakeNode {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.doc = doc; this.children = []; this.attributes = {};
    this.dataset = {}; this.style = { setProperty(key, value) { this[key] = value; } };
    this.className = ''; this.parentNode = null;
  }
  get isConnected() { return this === this.doc.body || this === this.doc.head || !!this.parentNode?.isConnected; }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  remove() { if (!this.parentNode) return; this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getBoundingClientRect() { return { left: 100, top: 80, width: 78, height: 70 }; }
}

function setup() {
  const doc = {};
  doc.head = new FakeNode('head', doc); doc.body = new FakeNode('body', doc);
  doc.documentElement = { clientWidth: 1280, clientHeight: 800 };
  doc.querySelector = () => null;
  doc.createElement = tag => new FakeNode(tag, doc);
  doc.getElementById = id => doc.head.children.find(node => node.id === id) || null;
  const timers = [];
  const clock = {
    setTimeout(callback, duration) { const timer = { callback, duration, cleared: false }; timers.push(timer); return timer; },
    clearTimeout(timer) { timer.cleared = true; },
  };
  const art = new FakeNode('img', doc);
  return { doc, timers, clock, art };
}

function sequenceRandom() {
  let index = 0;
  return () => ((index++ * 7) % 29) / 29;
}

test('bag Wish Ring scatters asymmetrically and fades while traveling 25 percent beyond its initial spread', () => {
  const { doc, timers, clock, art } = setup();
  const effect = beginLampBagWishRing(art, { doc, timers: clock, reducedMotion: () => false, random: sequenceRandom() });
  const burst = doc.body.children[0];
  assert.equal(burst.className, 'lamp-wish-ring-vfx');
  assert.equal(burst.children.length, 13, 'arrival glow plus twelve radial particles');
  const particles = burst.children.slice(1);
  assert.equal(particles.filter(node => node.className.includes('star')).length, 8);
  assert.equal(particles.filter(node => node.className.includes('speck')).length, 4);
  const radial = particles.map(node => {
    const x = parseFloat(node.style['--wish-x']), y = parseFloat(node.style['--wish-y']);
    const tailX = parseFloat(node.style['--wish-tail-x']), tailY = parseFloat(node.style['--wish-tail-y']);
    const startRadius = Math.hypot(x, y), tailRadius = Math.hypot(tailX, tailY);
    assert.ok(Number(node.dataset.angle) >= 0 && Number(node.dataset.angle) < 360);
    assert.ok(startRadius >= 39.2 * .92 - .01 && startRadius <= 39.2 * 1.08 + .01, 'each start radius varies around the prior spread');
    assert.ok(Math.abs(tailRadius / startRadius - 1.25) < .001, 'each particle travels another 25 percent');
    assert.ok(tailRadius / 39.2 >= 1.15 - .001 && tailRadius / 39.2 <= 1.35 + .001, 'random radii vary the final distance around the 25 percent extension');
    const size = parseFloat(node.style.width);
    return { node, size, duration: parseFloat(node.style['--wish-duration']), x, y, angle: Number(node.dataset.angle) };
  });
  const starSizes = radial.filter(p => p.node.className.includes('star')).map(p => p.size);
  assert.equal(new Set(starSizes).size, 8, 'every star has its own size within the burst');
  assert.ok(Math.min(...starSizes) <= 5.1 && Math.max(...starSizes) >= 17.9, 'stars span tiny sparks through bold flashes');
  assert.notDeepEqual(starSizes, [...starSizes].sort((a, b) => a - b), 'size scale is scattered across the radial directions');
  assert.equal(new Set(radial.map(p => p.node.style['--wish-rotation'])).size, 12, 'each particle gets a different spin');
  assert.ok(new Set(radial.map(p => p.angle)).size === 12, 'every particle gets a fresh direction');
  assert.ok(Math.hypot(radial.reduce((sum, p) => sum + p.x, 0), radial.reduce((sum, p) => sum + p.y, 0)) > 5, 'the emission has no symmetric balance point');
  assert.equal(Math.min(...radial.map(p => p.duration)), 530);
  assert.equal(Math.max(...radial.map(p => p.duration)), 770);
  assert.ok(particles.some(node => node.className === 'lamp-wish-ring-speck'));
  assert.equal(timers[0].duration, 1200);
  assert.equal(burst.children.filter(node => node.className === 'lamp-wish-ring-ring').length, 0, 'crest ring is absent before measured callback');
  effect.crest(1.46, 263);
  const ring = burst.children.at(-1);
  assert.equal(ring.className, 'lamp-wish-ring-ring');
  assert.equal(ring.dataset.crestScale, '1.46');
  assert.equal(ring.dataset.crestTime, '263');
  assert.equal(ring.style['--wish-ring-size'], '28px', 'crest ring begins at forty percent of smaller glyph dimension');
  const style = doc.head.children[0].textContent;
  assert.match(style, /translate\(calc\(-50% \+ var\(--wish-x\)\),calc\(-50% \+ var\(--wish-y\)\)\)/, 'all particle endpoints retain center anchoring');
  assert.match(style, /68%\{opacity:\.95;transform:translate\(calc\(-50% \+ var\(--wish-x\)\),calc\(-50% \+ var\(--wish-y\)\)\).*100%\{opacity:0;transform:translate\(calc\(-50% \+ var\(--wish-tail-x\)\),calc\(-50% \+ var\(--wish-tail-y\)\)\)/, 'the final quarter of travel is the fade-out distance');
  assert.match(style, /scale\(1\.875\);border-width:1px/, 'crest ring expands to seventy-five percent of smaller glyph dimension');
  assert.match(style, /\.lamp-wish-ring-ring\{box-sizing:border-box/, 'ring border is included in its measured diameter');
  timers[0].callback();
  assert.equal(burst.isConnected, false, 'the complete wish ring cleans up without lingering elements');
});

test('random radial paths use spare directional space and stay inside stage bounds', () => {
  const { doc, clock, art } = setup();
  doc.documentElement = { clientWidth: 360, clientHeight: 640 };
  doc.querySelector = () => ({ getBoundingClientRect: () => ({ left: 40, top: 20, right: 160, bottom: 200 }) });
  const effect = beginLampBagWishRing(art, { doc, timers: clock, reducedMotion: () => false, random: sequenceRandom() });
  const particles = doc.body.children[0].children.slice(1);
  const radii = particles.map(node => {
    const x = 139 + parseFloat(node.style['--wish-tail-x']), y = 115 + parseFloat(node.style['--wish-tail-y']);
    assert.ok(x >= 52 && x <= 148 && y >= 32 && y <= 188, 'each tail point leaves twelve pixels inside the stage edge');
    return Math.hypot(x - 139, y - 115);
  });
  assert.ok(radii.some(radius => radius > 9.1), 'directions with more room travel farther than the tight edge limit');
  effect.crest(1.4, 220);
  const ring = doc.body.children[0].children.at(-1);
  assert.equal(ring.style['--wish-ring-size'], '16px', 'ring scales down to fit its six-pixel halo inside a tight stage');
  effect.cancel();
});

test('rapid arrivals replace one ring; reduced motion keeps only a short gentle glow', () => {
  const { doc, timers, clock, art } = setup();
  const first = beginLampBagWishRing(art, { doc, timers: clock, reducedMotion: () => false });
  const firstNode = doc.body.children[0];
  const second = beginLampBagWishRing(art, { doc, timers: clock, reducedMotion: () => false });
  const secondNode = doc.body.children[0];
  assert.equal(firstNode.isConnected, false);
  assert.equal(timers[0].cleared, true);
  assert.equal(doc.body.children.length, 1, 'rapid arrivals cannot stack full celebrations');
  first.crest(1.4, 200);
  assert.equal(doc.body.children[0].children.filter(node => node.className === 'lamp-wish-ring-ring').length, 0, 'a replaced arrival cannot reveal a stale crest ring');
  const reduced = beginLampBagWishRing(art, { doc, timers: clock, reducedMotion: () => true });
  const reducedNode = doc.body.children[0];
  assert.equal(secondNode.isConnected, false);
  assert.equal(timers[1].cleared, true);
  assert.equal(reducedNode.className, 'lamp-wish-ring-vfx lamp-wish-reduced');
  assert.equal(reducedNode.children.length, 1, 'reduced motion removes stars and ring');
  assert.equal(timers.at(-1).duration, 300);
  reduced.crest(1.45, 260);
  assert.equal(reducedNode.children.length, 1);
  timers.at(-1).callback();
  assert.equal(reducedNode.isConnected, false);
});
