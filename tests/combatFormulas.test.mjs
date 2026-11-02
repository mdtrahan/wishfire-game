import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mitigationMultiplier, cooldownSeconds } from '../web-runner/src/core/combatFormulas.mjs';
import { heroStarSkillMultipliers } from '../web-runner/src/core/heroGrowthRules.mjs';
import { normalizeCombatPowerActor, computeCombatPower } from '../web-runner/src/core/combatPower.mjs';

test('cooldown previews stay positive with diminishing Haste and retain star calibration', () => {
  assert.equal(cooldownSeconds(10), 10);
  assert.equal(cooldownSeconds(10, 100), 5);
  assert.equal(cooldownSeconds(10, -50), 20);
  for (const haste of [1e6, 1e12, Number.MAX_VALUE]) {
    assert.ok(cooldownSeconds(10, haste) > 0);
  }
  assert.equal(heroStarSkillMultipliers(null, 'Falie').specialCooldown, 1);
  assert.equal(heroStarSkillMultipliers({ stars: { Falie: 2 } }, 'Falie').specialCooldown, 0.92);
  assert.ok(cooldownSeconds(10, 100) - cooldownSeconds(10, 200)
    < cooldownSeconds(10, 0) - cooldownSeconds(10, 100));
});

test('CP previews use the same 100-point mitigation for hits and durability', () => {
  assert.equal(mitigationMultiplier(0), 1);
  assert.equal(mitigationMultiplier(100), 0.5);
  assert.ok(mitigationMultiplier(Number.MAX_VALUE) > 0);
  const input = normalizeCombatPowerActor({ level: 1, maxHP: 200, stats: { ATK: 107, MAG: 20, DEF: 100, RES: 300, SPD: 10 } });
  assert.equal(input.expectedDirect, 100);
  assert.equal(input.effectiveHP, 600);
});

test('Rust and browser CP agree across independent defenses and levels', () => {
  const { exports: wasm } = new WebAssembly.Instance(new WebAssembly.Module(
    fs.readFileSync(new URL('../web-runner/assets/simulation_core.wasm', import.meta.url))));
  for (const level of [1, 50, 100]) {
    for (const [def, res] of [[0, 0], [100, 300], [1e6, 2e6]]) {
      const actor = { level, maxHP: 200, stats: { ATK: 107, MAG: 20, DEF: def, RES: res, SPD: 10 } };
      const p = normalizeCombatPowerActor(actor);
      assert.equal(wasm.combat_power_full_shadow(p.atk, p.mag, p.def, p.res, p.hp, p.spd, p.level,
        p.expectedDirect, p.critChance, p.critMultiplier, p.aoeDamage, p.extraTargets, p.sustain,
        p.control, p.proc, p.af, p.sequence), computeCombatPower(actor));
    }
  }
});
