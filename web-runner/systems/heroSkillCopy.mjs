// Player-facing copy for the accepted four-skill kits. Combat definitions own effects.
export const heroBasicSkill = definition => ({...definition.basic, displayName: 'Basic Attack', slot: 'basic', icon: definition.basic.tags.includes('magic') ? 'party-mag' : 'party-atk', targetRule: {kind: 'enemy'}});

export function heroSkillCopy(skill) {
 if (skill.slot === 'basic') {
  const damage = skill.effects.find(effect => effect.effectType === 'damage');
  const percent = Math.round(Number(damage.potency) * 10000) / 100;
  return {lines: [`Deals ${percent}% of ${skill.tags.includes('magic') ? 'MAG' : 'ATK'} to the current target.`]};
 }
 const copy = {
  crimson_ward: {
   lines: [`Grants each hero temporary HP equal to ${skill.wardPctMaxHP}% of max HP.`, `Stacks to ${skill.capPctMaxHP}% of original max HP.`],
   rules: ['Each hero has a separate ward. Hits drain only the struck hero’s ward.', 'Persists between waves and after boss clears.', 'Clears when a boss enters or the party falls. A fallen hero loses its ward.'],
  },
  smoke_form: {lines: ['Below 40% HP, takes 50% less damage.']},
  phoenix_soul: {lines: ['Below 15% HP, each basic attack heals 6% of max HP.']},
  chastise: {lines: ['Reflects 80% of damage taken to the attacker.']},
  shadow: {lines: ['Jumps behind a foe and deals 240% damage.']},
  royalty: {lines: ['Below 50% HP: basic damage ×2.', 'Hits: target DEF −5% for 4s.'], rules: ['The DEF reduction benefits every hero. Duration is provisional.']},
  chase: {lines: ['Against a lone foe in range, deals +160% damage.']},
  weaken: {lines: ['Surrounded by 3+ foes: crit rate +5% and crit damage +5%.']},
  bubble_pop: {lines: ['Deals 180% magic damage to every foe in range.', 'Pushes them back for 2s.']},
  boast: {lines: ['Above 80% HP: MAG +5% and RES +5%.']},
  vengeance: {lines: ['Below 45% HP, MAG rises by the share of HP lost.']},
  stare: {lines: ['Against a lone foe, adds twice RES to MAG.']},
  elevate: {lines: ['Rolls one party bonus set:'], rules: ['SPD +5% and ATK +5%.', 'Max HP +20% and MAG +5%.', 'Attack range +10% and crit damage +5%.', 'Rolls at fight start, then on cooldown. Lasts until the next roll; ends if Kaja falls.']},
  ethereal_aura: {lines: ['Foes in range take Faze damage every second.'], rules: ['Damage rises with each chapter.']},
  cornered: {lines: ['Surrounded by 3+ foes: DEF +8% and RES +8%.']},
  timeless: {lines: ['Below 55% HP, specials deal +20% damage.', 'Crit rate rises 1%.']},
 };
 return copy[skill.skillId] || {lines: [skill.description]};
}
