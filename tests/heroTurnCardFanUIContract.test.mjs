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
  assert.doesNotMatch(source, /fan-target|fan-back|is-targeting|validTargets/);
  assert.doesNotMatch(source, /fan-card-effect[^}]*text-overflow/);
  assert.doesNotMatch(source, /fan-card-effect[^}]*overflow:hidden/);
  assert.doesNotMatch(source, /fan-card-tempo|Tempo:/);
  assert.doesNotMatch(source, /\b(Odds|Pity|Energy|cost)\b/i);
});
