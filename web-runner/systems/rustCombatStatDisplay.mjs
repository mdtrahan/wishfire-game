import { SHADOW_DEFINITIONS } from '../../src/core/combatShadowAdapter.mjs';
import { heroDefinition } from '../src/core/heroDefinitions.mjs';

// ATK/MAG/DEF/RES use the snapshot's native Rust units. Convert only the
// permanent comparison value into those units; never resolve combat in JS.
// The ABI has no SPD/cadence readback, so SPD remains a permanent meta value.
export function createRustCombatStatDisplay(state) {
  function getBaseStat(hero, stat) {
    const value = Number(hero.stats?.[stat] ?? 0);
    if (stat === 'SPD') return value;
    const definition = heroDefinition(hero);
    const native = SHADOW_DEFINITIONS[definition.key]?.stats[stat.toLowerCase()];
    return Math.fround(value * native / definition.baseStats[stat]);
  }
  return {
    getBaseStat,
    getEffectiveStat(hero, stat) {
      const snapshot = state.globals.RustCombatPresentation?.state.snapshot;
      const actor = snapshot?.actors.find(actor => actor.team === 'hero' && actor.host_id === String(hero.heroInstanceKey));
      return actor?.stats?.[stat.toLowerCase()] ?? getBaseStat(hero, stat);
    },
  };
}
