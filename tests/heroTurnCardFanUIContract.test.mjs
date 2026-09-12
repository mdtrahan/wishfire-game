import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHeroTurnCardFanUI, computeHeroTurnFanLayout, normalizeHeroTurnCards, RARITY_COLORS } from '../web-runner/systems/heroTurnCardFanUI.mjs';

class FakeNode {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.dataset = {}; this.hidden = false; this.inert = false;
    this.style = { setProperty() {} };
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  append(...nodes) { this.children.push(...nodes.filter(Boolean)); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute() {}
  addEventListener() {}
  removeEventListener() {}
  remove() { this.removed = true; }
}

test('normalizes three distinct hero action cards and excludes Fortune cards', () => {
  const completeEffect = 'Intercept the next attack against one ally, then counterattack its attacker for heavy damage.';
  const cards = normalizeHeroTurnCards([
    { id: 'a', name: 'A', rarity: 'Common', effect: completeEffect },
    { id: 'fortune', name: 'Fortune', kind: 'fortune', effect: 'Passive' },
    { id: 'a-duplicate', name: 'A', rarity: 'Rare', effect: 'Duplicate' },
    { id: 'b', name: 'B', rarity: 'Rare', effect: 'Guard', metadata: { tempo: 'Fast' } },
    { id: 'c', name: 'C', rarity: 'Epic', effect: 'Heal' },
    { id: 'd', name: 'D', rarity: 'Legendary', effect: 'Delay' },
  ]);
  assert.deepEqual(cards.map(card => card.id), ['a', 'b', 'c']);
  assert.equal(cards[1].tempo, 'Fast');
  assert.equal(cards[0].effect, completeEffect);
  assert.equal(cards.length, 3);
});

test('fan layout stays inside measured viewport and retains reference scale', () => {
  const layout = computeHeroTurnFanLayout({
    canvasRect: { left: 10, top: 20, width: 216, height: 384 },
    layoutScale: 0.6,
    viewportWidth: 216,
    viewportHeight: 384,
  });
  assert.ok(layout.scale <= 0.6);
  assert.ok(layout.left >= 8);
  assert.ok(layout.top >= 20 + 8);
  assert.ok(layout.left + layout.width <= 216 - 8 + 0.001);
  assert.ok(layout.top + layout.height <= 384 - 8 + 0.001);
  assert.ok(layout.visualLeft >= 8 - 0.001);
  assert.ok(layout.visualLeft + layout.visualWidth <= 216 - 8 + 0.001);
});

test('eligible reopen cancels a pending close and interrupt clears the DOM marker', async () => {
  const previousDocument = globalThis.document;
  globalThis.document = { head: new FakeNode('head'), body: new FakeNode('body'), createElement: tag => new FakeNode(tag) };
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) };
  const cards = [{ id: 'a', name: 'A', rarity: 'Common', effect: 'Attack.' }, { id: 'b', name: 'B', rarity: 'Rare', effect: 'Guard.' }, { id: 'c', name: 'C', rarity: 'Epic', effect: 'Heal.' }];
  const ui = createHeroTurnCardFanUI({ canvas });
  try {
    ui.update({ open: true, activeHero: { name: 'Hondo' }, cards, layoutScale: 1 });
    ui.close();
    ui.update({ open: true, activeHero: { name: 'Hondo' }, cards, layoutScale: 1 });
    await new Promise(resolve => setTimeout(resolve, 220));
    assert.equal(ui.element.hidden, false);
    assert.equal(ui.element.inert, false);
    assert.equal(ui.element.dataset.open, 'true');
    assert.equal(ui.element.children[0].children.length, 3);
    ui.interrupt();
    assert.equal(ui.element.hidden, true);
    assert.equal(ui.element.inert, true);
    assert.equal(ui.element.dataset.open, 'false');
    ui.update({ open: true, activeHero: { name: 'Hondo' }, cards, layoutScale: 1 });
    assert.equal(ui.element.hidden, false);
    assert.equal(ui.element.inert, false);
    assert.equal(ui.element.children.length, 1);
  } finally {
    ui.destroy();
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('rarity palette remains presentation-only and configurable by card payload', () => {
  assert.deepEqual(Object.keys(RARITY_COLORS), ['Common', 'Rare', 'Epic', 'Legendary']);
  const source = fs.readFileSync(path.join(process.cwd(), 'web-runner/systems/heroTurnCardFanUI.mjs'), 'utf8');
  assert.match(source, /onCardSelect/);
  assert.match(source, /onCancel/);
  assert.match(source, /data-slot="left"/);
  assert.match(source, /fan-card-effect[^}]*white-space:normal/);
  assert.match(source, /fan-card-name[^}]*overflow-wrap:anywhere/);
  assert.match(source, /fan-card:hover,#hero-turn-card-fan \.fan-card:focus-visible\{z-index:6/);
  assert.match(source, /is-selecting/);
  assert.match(source, /hero-turn-card-splash/);
  assert.match(source, /hero-turn-card-shimmer/);
  assert.match(source, /hero-turn-card-fall-left\{0%\{opacity:1;transform:rotate\(-7deg\) translateY\(8px\)\}45%,100%\{opacity:0/);
  assert.match(source, /hero-turn-card-activate\{0%\{transform:rotate\(0\) scale\(\.96\).*18%\{transform:rotate\(0\) scale\(1\.09\).*52%\{transform:rotate\(0\) scale\(1\.035\)/);
  assert.match(source, /prefers-reduced-motion:reduce[^}]*is-selecting \.fan-card\[data-selected="true"\]::before/);
  assert.doesNotMatch(source, /fan-hero(?:-|\{|\s)/);
  assert.doesNotMatch(source, /fan-target|fan-back|is-targeting|validTargets/);
  assert.doesNotMatch(source, /fan-card-effect[^}]*text-overflow/);
  assert.doesNotMatch(source, /fan-card-effect[^}]*overflow:hidden/);
  assert.doesNotMatch(source, /fan-card-tempo|Tempo:/);
  assert.doesNotMatch(source, /\b(Odds|Pity|Energy|cost)\b/i);
});

test('card overlap raises the focused or hovered card without changing its hit area', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'web-runner/systems/heroTurnCardFanUI.mjs'), 'utf8');
  assert.match(source, /fan-card:hover,#hero-turn-card-fan \.fan-card:focus-visible\{z-index:6/);
  assert.doesNotMatch(source, /fan-card:hover[^}]*width|fan-card:focus-visible[^}]*width/);
  assert.doesNotMatch(source, /fan-card:hover[^}]*transform|fan-card:focus-visible[^}]*transform/);
});

test('card selection remains an accessible callback with no extra target controls', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { head: new FakeNode('head'), body: new FakeNode('body'), createElement: tag => new FakeNode(tag) };
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) };
  const selected = [];
  const ui = createHeroTurnCardFanUI({ canvas, select: index => selected.push(index) });
  try {
    ui.update({ open: true, heroUID: 'hondo-1', cards: [
      { id: 'a', name: 'A', rarity: 'Common', effect: 'Attack.' },
      { id: 'b', name: 'B', rarity: 'Rare', effect: 'Guard.' },
      { id: 'c', name: 'C', rarity: 'Epic', effect: 'Heal.' },
    ] });
    const cardsHost = ui.element.children[0];
    assert.equal(cardsHost.children.length, 3);
    cardsHost.children[1].onclick();
    assert.deepEqual(selected, [1]);
    assert.equal(ui.element.children.length, 1);
  } finally {
    ui.destroy();
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('card activation preserves stable nodes while the selected card resolves its presentation', async () => {
  const previousDocument = globalThis.document;
  globalThis.document = { head: new FakeNode('head'), body: new FakeNode('body'), createElement: tag => new FakeNode(tag) };
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) };
  const selected = [];
  const ui = createHeroTurnCardFanUI({ canvas, select: index => selected.push(index) });
  try {
    ui.update({ open: true, heroUID: 'hondo-1', cards: [
      { id: 'a', name: 'A', rarity: 'Common', effect: 'Attack.' },
      { id: 'b', name: 'B', rarity: 'Rare', effect: 'Guard.' },
      { id: 'c', name: 'C', rarity: 'Epic', effect: 'Heal.' },
    ] });
    const cardsHost = ui.element.children[0];
    const selectedNode = cardsHost.children[1];
    selectedNode.onclick();
    ui.update({ open: true, heroUID: 'hondo-1', cards: [
      { id: 'a', name: 'A', rarity: 'Common', effect: 'Attack.' },
      { id: 'b', name: 'B', rarity: 'Rare', effect: 'Guard.' },
      { id: 'c', name: 'C', rarity: 'Epic', effect: 'Heal.' },
    ] });
    assert.deepEqual(selected, [1]);
    assert.equal(cardsHost.children[1], selectedNode);
    assert.equal(cardsHost.children.length, 3);
    assert.equal(selectedNode.dataset.selected, 'true');
    assert.equal(cardsHost.children[0].dataset.selected, 'false');
    assert.equal(ui.element.hidden, false);
    await new Promise(resolve => setTimeout(resolve, 380));
    assert.equal(ui.element.hidden, true);
    assert.equal(ui.element.dataset.open, 'false');
    ui.update({ open: true, heroUID: 'hondo-1', cards: [
      { id: 'a', name: 'A', rarity: 'Common', effect: 'Attack.' },
      { id: 'b', name: 'B', rarity: 'Rare', effect: 'Guard.' },
      { id: 'c', name: 'C', rarity: 'Epic', effect: 'Heal.' },
    ] });
    assert.equal(ui.element.hidden, true);
    ui.reopen({ open: true, heroUID: 'hondo-1', cards: [
      { id: 'a', name: 'A', rarity: 'Common', effect: 'Attack.' },
      { id: 'b', name: 'B', rarity: 'Rare', effect: 'Guard.' },
      { id: 'c', name: 'C', rarity: 'Epic', effect: 'Heal.' },
    ] });
    assert.equal(ui.element.hidden, false);
  } finally {
    ui.destroy();
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('a new level-up offer token replaces a selected prior offer and keeps the new cards clickable', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { head: new FakeNode('head'), body: new FakeNode('body'), createElement: tag => new FakeNode(tag) };
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) };
  const selected = [];
  const ui = createHeroTurnCardFanUI({ canvas, select: index => selected.push(index) });
  try {
    ui.update({ open: true, heroUID: 'hondo-1', offerToken: 'battle-a:0', cards: [
      { id: 'qa_orb_cadence_1', name: 'Spectral Orb', rarity: 'Common', effect: 'Every 3 basics: 4 magic damage' },
      { id: 'qa_speed_1', name: 'Swift Current', rarity: 'Common', effect: 'SPD +10%' },
      { id: 'qa_max_vitality_1', name: 'Max Vitality', rarity: 'Common', effect: 'Max HP +20%' },
    ] });
    ui.element.children[0].children[0].onclick();
    ui.update({ open: true, heroUID: 'hondo-1', offerToken: 'battle-b:0', cards: [
      { id: 'qa_orb_cadence_2', name: 'Spectral Orb II', rarity: 'Rare', effect: 'Every 2 basics: 6 magic damage' },
      { id: 'qa_speed_2', name: 'Swift Current II', rarity: 'Rare', effect: 'SPD +10%' },
      { id: 'qa_max_vitality_2', name: 'Max Vitality II', rarity: 'Rare', effect: 'Max HP +20%' },
    ] });
    const cardsHost = ui.element.children[0];
    assert.deepEqual(cardsHost.children.map(card => card.dataset.cardId), ['qa_orb_cadence_2', 'qa_speed_2', 'qa_max_vitality_2']);
    cardsHost.children[0].onclick();
    assert.deepEqual(selected, [0, 0]);
  } finally {
    ui.destroy();
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('card activation survives the runtime draw being consumed during the cue', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { head: new FakeNode('head'), body: new FakeNode('body'), createElement: tag => new FakeNode(tag) };
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) };
  let ui;
  ui = createHeroTurnCardFanUI({
    canvas,
    select: () => ui.update({ open: false, heroUID: 'hondo-1', cards: [] }),
  });
  try {
    ui.update({ open: true, heroUID: 'hondo-1', cards: [
      { id: 'a', name: 'A', rarity: 'Common', effect: 'Attack.' },
      { id: 'b', name: 'B', rarity: 'Rare', effect: 'Guard.' },
      { id: 'c', name: 'C', rarity: 'Epic', effect: 'Heal.' },
    ] });
    const cardsHost = ui.element.children[0];
    const selectedNode = cardsHost.children[1];
    selectedNode.onclick();
    assert.equal(cardsHost.children[1], selectedNode);
    assert.equal(cardsHost.children.length, 3);
    assert.equal(ui.element.hidden, false);
  } finally {
    ui.destroy();
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
