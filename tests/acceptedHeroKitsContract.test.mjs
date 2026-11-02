import { BUFF_SIGNAL_FRAMES } from '../src/core/buffSignalRules.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_DEFINITIONS, PROVISIONAL_SPECIAL_COOLDOWNS } from '../web-runner/src/core/heroDefinitions.mjs';
const ACCEPTED = {
  Falie: ['crimson_ward', 'smoke_form', 'phoenix_soul', 'chastise'],
  Huun: ['shadow', 'royalty', 'chase', 'weaken'],
  Runa: ['bubble_pop', 'boast', 'vengeance', 'stare'],
  Kojonn: ['elevate', 'ethereal_aura', 'cornered', 'timeless'],
};

test('every hero carries exactly Special, Passive and two Resonances from the accepted list', () => {
  for (const [key, ids] of Object.entries(ACCEPTED)) {
    const definition = HERO_DEFINITIONS[key];
    assert.deepEqual(definition.skills.map(skill => skill.skillId), ids);
    assert.deepEqual(definition.skills.map(skill => skill.slot), ['special', 'passive', 'resonance', 'resonance']);
    assert.deepEqual(definition.actives, [definition.special], 'only the Special owns a clock');
    assert.ok(definition.special.cooldownSeconds > 0 && definition.special.unlockLevel === 1);
    assert.equal(definition.basic.cooldownSeconds, 0, 'Basic has an explicit zero skill cooldown; attack cadence remains separate');
    assert.equal(definition.passive.cooldownSeconds, undefined);
    assert.ok(definition.resonances.every(skill => skill.scaffold && skill.cooldownSeconds === undefined && !skill.passive), 'resonances are display-only scaffolding');
    assert.ok(definition.skills.every(skill => BUFF_SIGNAL_FRAMES[skill.icon] && skill.description && skill.conditionLabel));
  }
  assert.equal(HERO_DEFINITIONS.Falie.special.cooldownSeconds, 120);
  assert.deepEqual(PROVISIONAL_SPECIAL_COOLDOWNS, ['shadow', 'bubble_pop', 'elevate']);
  assert.ok(Object.values(HERO_DEFINITIONS).every(d => d.special.provisionalCooldown === PROVISIONAL_SPECIAL_COOLDOWNS.includes(d.special.skillId)));
});
