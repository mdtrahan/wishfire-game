import { CRIMSON_WARD, ELEVATE_SETS, HERO_DEFINITIONS } from './heroDefinitions.mjs';
// Party Skills: every skill that can raise a party-wide buff icon. One shared source feeds
// the HUD icon navigation and the Training Ground list so their text never drifts.
const owner = skillId => Object.values(HERO_DEFINITIONS).find(definition => definition.special.skillId === skillId);

export const PARTY_SKILLS = Object.freeze([
  Object.freeze({
    id: 'crimson_ward', skillId: 'crimson_ward', hero: owner('crimson_ward').name, name: 'Crimson Ward', icons: Object.freeze(['party-ward']),
    effect: owner('crimson_ward').special.description,
    values: Object.freeze([`Each hero: temporary HP +${CRIMSON_WARD.wardPctMaxHP}% of own max HP per cast`, `Stacks to ${CRIMSON_WARD.capPctMaxHP}% of own original max HP`, `Cooldown ${owner('crimson_ward').special.cooldownSeconds}s`]),
  }),
  ...Object.entries(ELEVATE_SETS).map(([set, entry]) => Object.freeze({
    id: `elevate:${set}`, skillId: 'elevate', set, hero: owner('elevate').name, name: `Elevate · ${entry.label}`, icons: Object.freeze([...entry.icons]),
    effect: `One of Elevate’s three party rolls. While rolled, every hero gains ${entry.summary}. Replaced by the next roll; ends if ${owner('elevate').name} falls.`,
    values: Object.freeze([entry.summary, `Rerolls every ${owner('elevate').special.cooldownSeconds}s`]),
  })),
]);

// Resolve a live party buff (effect id plus optional set) to its catalog entry.
export function partySkillFor(ref = {}) {
  const id = ref.effectId === 'ward' || ref.skillId === 'crimson_ward' ? 'crimson_ward'
    : (ref.effectId === 'elevate' || ref.skillId === 'elevate') && ref.set ? `elevate:${ref.set}` : null;
  return PARTY_SKILLS.find(entry => entry.id === id) || null;
}
