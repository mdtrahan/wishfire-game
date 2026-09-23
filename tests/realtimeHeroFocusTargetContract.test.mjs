import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveHeroAttackTarget } from '../src/core/heroAttackTargetingRules.mjs';

test('continuous hero basics keep one focus until death, then follow encounter order', () => {
  const enemies = [11, 12, 13].map(uid => ({ uid, hp: 10 }));
  const neverRandom = () => { throw new Error('continuous basics must not draw a random target'); };
  const choose = focusUID => resolveHeroAttackTarget({ enemies, focusUID, randomPick: neverRandom });

  assert.equal(choose(0), enemies[0]);
  enemies.push({ uid: 14, hp: 10 });
  assert.equal(choose(11), enemies[0]);
  enemies[0].hp = 0;
  assert.equal(choose(11), enemies[1]);
  enemies[1].hp = 0;
  assert.equal(choose(12), enemies[2]);
  enemies[2].hp = 0;
  enemies[3].hp = 0;
  assert.equal(choose(13), null);
});

test('runtime stores the shared focus and leaves legacy automatic targeting intact', () => {
  const source = readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');
  const basics = source.slice(source.indexOf('export function TickRealtimeHeroBasics('), source.indexOf('function HeroAttackSplit('));
  assert.match(basics, /focusUID: Number\(g\.RealtimeHeroFocusTargetUID \|\| 0\)/);
  assert.match(basics, /g\.RealtimeHeroFocusTargetUID = Number\(focusTarget\?\.uid \|\| 0\)/);
  assert.match(basics, /HeroAttackSingle\(ctx, hero\.uid, focusTarget\.uid\)/);
  assert.doesNotMatch(basics, /randomPick/);
  const enemies = [{ uid: 11, hp: 10 }, { uid: 12, hp: 10 }];
  assert.equal(resolveHeroAttackTarget({ enemies, randomPick: living => living[1] }), enemies[1]);
});
