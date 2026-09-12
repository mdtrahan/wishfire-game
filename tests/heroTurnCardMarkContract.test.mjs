import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { applyStatus, hasStatus, resolveSkill, turnEnd } from '../web-runner/src/core/combatRules.mjs';

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

function createRulesHarness() {
  const hero = { uid: 1, kind: 'hero', hp: 20, maxHP: 20, currentLevel: 1, stats: { ATK: 10, MAG: 10 }, statuses: [] };
  const enemy10 = { uid: 10, kind: 'enemy', hp: 20, maxHP: 20, currentLevel: 1, evasion: 0, statuses: [] };
  const enemy9 = { uid: 9, kind: 'enemy', hp: 20, maxHP: 20, currentLevel: 1, evasion: 0, statuses: [] };
  const ctx = {
    actors: [hero, enemy10, enemy9],
    state: { statusOrder: 0 },
    random: () => 0,
    calculateDamage: () => 3,
    applyDamage: (_source, target, amount) => {
      const before = target.hp;
      target.hp = Math.max(0, target.hp - amount);
      return before - target.hp;
    },
    isOver: () => false,
  };
  return { ctx, hero, enemy10, enemy9 };
}

const mark = { effectType: 'status', statusEffect: 'mark', duration: 2, magnitude: 1 };
const singleEnemyHit = {
  skillId: 'test_single_enemy_hit',
  targetType: 'enemy',
  accuracy: 1,
  effects: [{ effectType: 'damage', fixedDamage: 3 }],
};

test('Mark stays on the selected enemy, expires on its own timer, and is consumed by a hit', () => {
  const { ctx, hero, enemy10, enemy9 } = createRulesHarness();
  applyStatus(ctx, hero, enemy10, mark);
  assert.equal(hasStatus(enemy10, 'mark'), true);
  assert.equal(hasStatus(enemy9, 'mark'), false);

  const consumed = resolveSkill(ctx, hero, singleEnemyHit, [enemy10.uid]);
  assert.equal(consumed, true);
  assert.equal(hasStatus(enemy10, 'mark'), false);
  assert.equal(hasStatus(enemy9, 'mark'), false);

  applyStatus(ctx, hero, enemy10, { ...mark, duration: 1 });
  turnEnd(enemy10);
  assert.equal(hasStatus(enemy10, 'mark'), false);
  assert.equal(hasStatus(enemy9, 'mark'), false);
});

test('AoE cards resolve the living enemy group without moving Mark to a fallback enemy', () => {
  const { ctx, hero, enemy10, enemy9 } = createRulesHarness();
  applyStatus(ctx, hero, enemy10, mark);
  const aoe = {
    skillId: 'test_all_enemy_hit',
    targetType: 'allEnemies',
    accuracy: 1,
    effects: [{ effectType: 'damage', fixedDamage: 2 }],
  };
  assert.equal(resolveSkill(ctx, hero, aoe, [enemy10.uid, enemy9.uid]), true);
  assert.equal(enemy10.hp, 18);
  assert.equal(enemy9.hp, 18);
  assert.equal(hasStatus(enemy10, 'mark'), false);
  assert.equal(hasStatus(enemy9, 'mark'), false);
});

test('Mark rendering and card copy name a single enemy at the existing presentation seams', () => {
  const render = read('web-runner/systems/renderRuntime.js');
  assert.match(render, /Persistent Mark uses the existing enemy status-icon seam/);
  assert.match(render, /status\.statusEffect === 'mark'/);
  assert.match(render, /ctx\.arc\(0, 0, radius/);
  assert.match(render, /ctx\.moveTo\(-radius \* 1\.35, 0\)/);

  const cards = read('web-runner/src/core/heroTurnCards.mjs');
  for (const cardId of ['hondo_rooftop_cut', 'hondo_coin_charm_feint', 'runa_cracked_seal']) {
    const cardStart = cards.indexOf(cardId);
    assert.notEqual(cardStart, -1, `missing ${cardId}`);
    const cardText = cards.slice(cardStart, cardStart + 700);
    assert.match(cardText, /one enemy|target/i, `${cardId} must identify its target scope`);
  }
  for (const cardId of ['hondo_borrowed_breath', 'hondo_midnight_verdict']) {
    const cardStart = cards.indexOf(cardId);
    assert.notEqual(cardStart, -1, `missing ${cardId}`);
    const cardText = cards.slice(cardStart, cardStart + 900);
    assert.match(cardText, /target|enemy/i, `${cardId} must identify its target scope`);
  }
});
