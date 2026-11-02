import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCombatBridge } from '../web-runner/src/core/combatBridge.mjs';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { heroStarSkillMultipliers } from '../web-runner/src/core/heroGrowthRules.mjs';
import { heroSpecialCooldown, formatHeroSpecialCooldown } from '../web-runner/src/core/heroSpecialCooldown.mjs';
import { SPECIAL_CLOCKS } from '../web-runner/src/core/specialClockContent.mjs';
import { PARTY_SKILLS, partySkillClock } from '../web-runner/src/core/partySkillCatalog.mjs';
import { SHADOW_DEFINITIONS } from '../src/core/combatShadowAdapter.mjs';

test('all displayed Special clocks match Rust refill timing at zero and earned Haste', () => {
  const bridge = createCombatBridge(new WebAssembly.Instance(new WebAssembly.Module(
    readFileSync(new URL('../web-runner/assets/simulation_core.wasm', import.meta.url)))));
  assert.deepEqual(SPECIAL_CLOCKS, bridge.describe().special_clocks, 'generated content matches shipped Rust');
  for (const stars of [0, 2]) {
    const growth = { stars: Object.fromEntries(Object.keys(HERO_DEFINITIONS).map(key => [key, stars])) };
    const heroes = Object.values(HERO_DEFINITIONS).map((hero, slot) => ({
      instance_id: hero.key, definition_id: SHADOW_DEFINITIONS[hero.key].id, slot,
      formation_offset: { x: slot * 40, y: 0 },
      stats: SHADOW_DEFINITIONS[hero.key].stats, hp: SHADOW_DEFINITIONS[hero.key].stats.hp,
      skill_modifiers: { special_potency: 1, meter_rate: 1 / heroStarSkillMultipliers(growth, hero.key).specialCooldown },
    }));
    const encounter_id = `cooldown-${stars}`;
    const created = bridge.create({ encounter_id, seed: '7', continuous: true,
      geometry: { floor: { min: { x: 0, y: 0 }, max: { x: 1200, y: 1200 } },
        viewport_world: { x: 720, y: 1280 }, formation_origin: { x: 480, y: 600 }, screen_bound: false },
      heroes, enemies: [] });
    try {
      const next = bridge.step(created.world, { encounter_id, expected_previous_step: created.snapshot.step });
      for (const hero of Object.values(HERO_DEFINITIONS)) {
        const before = created.snapshot.actors.find(actor => actor.host_id === hero.key);
        const after = next.snapshot.actors.find(actor => actor.host_id === hero.key);
        const seconds = heroSpecialCooldown(hero.key, growth);
        assert.equal(after.meter - before.meter, Math.fround(Math.fround(1 / bridge.describe().hz) / seconds), `${hero.name}, stars ${stars}`);
        const displayed = formatHeroSpecialCooldown(hero.key, growth);
        assert.equal(displayed, Number(seconds.toFixed(2)));
        for (const entry of PARTY_SKILLS.filter(entry => entry.hero === hero.name)) {
          assert.equal(partySkillClock(entry, growth), `${entry.clockLabel} ${displayed}s`);
        }
      }
    } finally { bridge.destroy(created.world); }
  }
});
