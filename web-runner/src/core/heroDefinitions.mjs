// Canonical hero identities and approved real-time combat kits.
export const PROGRESSION = Object.freeze({ maxLevel: 100, expBase: 100, expExponent: 1.5, enemyEXP: 25, enemyGold: 10 });
export const COMBAT_TUNING = Object.freeze({ criticalHP: 0.25, blindPenalty: 0.35, accuracy: 1, evasion: 0, counterPotency: 1 });

// Retained only while story and QA callers migrate off the retired FLOW path.
export const FLOW_ORB_TUNING = Object.freeze({ flowMax: 100, limitOrbValue: 10, limitOrbDropCount: 1, releaseSeconds: .72, flightSeconds: .52, collectFlashSeconds: .18 });
export const FLOW_MODES = Object.freeze({ Stoic: 'Take hostile HP damage.', Warrior: 'Deal positive enemy HP damage.', Tactician: 'Deal magic damage or apply a new eligible status.', Comrade: 'Another living ally takes hostile HP damage.' });

export const ACTIVE_UNLOCK_LEVELS = Object.freeze([1, 5, 10, 15, 25]);
export const heroSkillUnlocked = (hero, skill) => Number(hero?.currentLevel || 1) >= Number(skill?.unlockLevel || 1);

const active = (skillId, displayName, cooldownSeconds, durationSeconds, targetType, description, extra = {}) =>
  Object.freeze({ skillId, displayName, cooldownSeconds, durationSeconds, targetType, description, ...extra });
const basic = magic => Object.freeze({ skillId: 'basic_attack', displayName: 'Attack', targetType: 'enemy', tags: [magic ? 'magic' : 'physical'], effects: [{ effectType: 'damage', potency: 1, hits: 1 }], description: 'Attack the first living enemy in range.' });
const kit = (key, name, role, baseStats, growth, actives, magicBasic = false) =>
  Object.freeze({ key, name, role, baseStats, growth, maxLevel: PROGRESSION.maxLevel, basic: basic(magicBasic), actives: Object.freeze(actives.map((skill, i) => Object.freeze({ ...skill, unlockLevel: ACTIVE_UNLOCK_LEVELS[i] }))) });

export const HERO_DEFINITIONS = Object.freeze({
  Falie: kit('Falie', 'Fara', 'Tank',
    { HP: 75, ATK: 7, DEF: 12, MAG: 4, RES: 8, SPD: 8 },
    { HP: 8, ATK: .8, DEF: 1.8, MAG: .4, RES: 1.1, SPD: .15 }, [
      active('challenge_bolt', 'Challenge Bolt', 7, 4, 'enemy', 'Hit the first in-range enemy without Provoke for 80% damage and redirect its eligible single-target attacks to Fara.', { damagePct: 80 }),
      active('shield_relay', 'Shield Relay', 12, 5, 'ally', 'Cover the lowest-HP ally below 75% while an enemy is in range. Fara takes that ally’s next two single-target hits.', { charges: 2 }),
      active('brace', 'Brace', 12, 5, 'self', 'Below 60% HP with an enemy in range, halve Fara’s next two incoming hits.', { charges: 2, damageCutPct: 50 }),
      active('retaliation_burst', 'Retaliation Burst', 16, 0, 'area', 'When an in-range enemy damages Fara, deal 80% damage to enemies within radius 75 of the attacker.', { damagePct: 80, radius: 75 }),
      active('shield_slam', 'Shield Slam', 20, 0, 'area', 'Hit a two-enemy cluster or boss within radius 65 for 100% damage and push each hit enemy up to 55 units right.', { damagePct: 100, radius: 65, pushDistance: 55 }),
    ]),
  Huun: kit('Huun', 'Hondo', 'Fighter',
    { HP: 60, ATK: 16, DEF: 5, MAG: 3, RES: 4, SPD: 12 },
    { HP: 6, ATK: 2.1, DEF: .7, MAG: .3, RES: .6, SPD: .35 }, [
      active('ambush', 'Ambush', 7, 6, 'enemy', 'Hit the first unmarked enemy in range for 120% damage. Hondo’s next two basics against it gain 20% damage.', { damagePct: 120, bonusPct: 20, charges: 2 }),
      active('cheap_shot', 'Cheap Shot', 9, 0, 'enemy', 'Hit the highest-ATK enemy in range for 150% damage and delay its next attack by 1 second.', { damagePct: 150, attackDelaySeconds: 1 }),
      active('razor_sweep', 'Razor Sweep', 10, 0, 'area', 'Hit every enemy in an 80 by 110 rectangle centered on the first in-range enemy for 70% damage; needs two enemies.', { damagePct: 70, width: 80, height: 110 }),
      active('piercing_throw', 'Piercing Throw', 12, 0, 'line', 'Hit enemies along a 28-wide line through the first in-range enemy, ending 60 units beyond it, for 130% damage.', { damagePct: 130, lineWidth: 28, beyond: 60 }),
      active('finish_the_job', 'Finish the Job', 16, 0, 'enemy', 'Hit the lowest-HP enemy in range below 35% HP for 220% damage. A kill splashes 80% within radius 50.', { damagePct: 220, threshold: .35, splashPct: 80, splashRadius: 50 }),
    ]),
  Runa: kit('Runa', 'Runa', 'Controller',
    { HP: 60, ATK: 3, DEF: 4, MAG: 16, RES: 10, SPD: 11 },
    { HP: 5, ATK: .3, DEF: .7, MAG: 2.1, RES: 1.4, SPD: .3 }, [
      active('frost_reversal', 'Frost Reversal', 9, 1.25, 'area', 'Hit a two-enemy cluster or boss within radius 75 for 80% magic damage and force a short retreat.', { damagePct: 80, radius: 75 }),
      active('hex_beacon', 'Hex Beacon', 12, 6, 'area', 'Mark enemies within radius 110 of the first in-range enemy, lowering RES by 25%. Later entrants are unaffected.', { radius: 110, resDownPct: 25 }),
      active('burn_sigil', 'Burn Sigil', 18, 6, 'area', 'Place a fixed radius-90 circle at a cluster or boss, dealing 25% magic damage each second inside.', { radius: 90, damagePctPerSecond: 25 }),
      active('null_field', 'Null Field', 18, 3, 'area', 'Block magic-tagged actions for enemies within radius 90 of the first in-range magic attacker.', { radius: 90 }),
      active('return_gate', 'Return Gate', 20, 0, 'enemy', 'Teleport the furthest-advanced in-range enemy up to 100 units right when it can move at least 40 units.', { teleportDistance: 100, minUsefulDistance: 40 }),
    ], true),
  Kojonn: kit('Kojonn', 'Kaja', 'Support',
    { HP: 65, ATK: 4, DEF: 7, MAG: 9, RES: 12, SPD: 10 },
    { HP: 7, ATK: .4, DEF: 1.1, MAG: 1.4, RES: 1.7, SPD: .25 }, [
      active('wishgrant', 'Wishgrant', 22, 10, 'allAllies', 'Give every living ally one charge making its next successful basic hit deal 330% normal damage. Cast for two engaged allies or a boss.', { basicDamagePct: 330, charges: 1 }),
      active('quickload', 'Quickload', 20, 4, 'ally', 'Set the slowest-firing engaged ally’s basic interval to 0.4 seconds and bring its next shot due within 0.4 seconds.', { basicIntervalSeconds: .4 }),
      active('split_feed', 'Split Feed', 20, 6, 'allAllies', 'Give every living ally basic-shot splash for 50% damage within radius 55 when a cluster is available.', { splashPct: 50, splashRadius: 55 }),
      active('patchwork', 'Patchwork', 18, 8, 'allAllies', 'When an ally is below 75% HP, give every living ally healing for 3% max HP on each damaging primary basic hit.', { healPctMaxHP: 3 }),
      active('fortunes_blessing', 'Fortune’s Blessing', 24, 5, 'allAllies', 'When a boss or three enemies are in range, raise one randomly chosen stat from ATK, DEF, MAG or RES by 25% for every living ally.', { statPct: 25, randomStats: ['ATK', 'DEF', 'MAG', 'RES'] }),
    ], true),
});

export function heroKey(hero) {
  const name = typeof hero === 'string' ? hero : hero?.baseHeroName || hero?.name;
  return ({ Fara: 'Falie', Hondo: 'Huun', Kaja: 'Kojonn' })[name] || name;
}
export function heroDefinition(hero) { return HERO_DEFINITIONS[heroKey(hero)]; }
