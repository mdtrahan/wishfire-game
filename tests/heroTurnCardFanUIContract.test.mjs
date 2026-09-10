import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { computeHeroTurnFanLayout, normalizeHeroTurnCards, RARITY_COLORS } from '../web-runner/systems/heroTurnCardFanUI.mjs';

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
