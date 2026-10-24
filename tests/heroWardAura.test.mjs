import test from 'node:test';
import assert from 'node:assert/strict';
import { heroWardAuraState } from '../web-runner/systems/heroWardAura.mjs';
import { absorbHeroWard, grantHeroWard } from '../web-runner/src/core/heroWard.mjs';

test('Crimson Ward aura fades in, flares on an absorbed hit, peels for 0.3 s on break, then stops', () => {
  const g = { time: 10 }, hero = { uid: 7 };
  assert.equal(heroWardAuraState(g, 7), null, 'no ward, no aura');
  grantHeroWard(g, hero, 20, 50);
  assert.deepEqual(heroWardAuraState(g, 7), { phase: 'live', alpha: 0, hit: 0, now: 10 });
  g.time = 10.13; assert.equal(heroWardAuraState(g, 7).alpha, 1);
  absorbHeroWard(g, hero, 5);
  assert.equal(heroWardAuraState(g, 7).hit, 1, 'absorbing a hit starts the flare');
  g.time = 10.29; assert.equal(heroWardAuraState(g, 7).hit, 0, 'the flare lasts 0.15 s');
  absorbHeroWard(g, hero, 99);
  assert.equal(heroWardAuraState(g, 7).phase, 'break');
  g.time = 10.44; assert.ok(Math.abs(heroWardAuraState(g, 7).u - .5) < 1e-9);
  g.time = 10.6; assert.equal(heroWardAuraState(g, 7), null, 'nothing lingers after the break');
});
