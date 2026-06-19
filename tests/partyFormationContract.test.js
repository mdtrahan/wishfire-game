const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('party formation slot assignment swaps duplicate heroes instead of cloning them into two slots', async () => {
  const runtimeRules = await import(path.join('file://', __dirname, '..', 'web-runner', 'src', 'core', 'partyFormationRules.mjs'));
  const sharedRules = await import(path.join('file://', __dirname, '..', 'src', 'core', 'partyFormationRules.mjs'));

  for (const mod of [runtimeRules, sharedRules]) {
    assert.deepEqual(
      mod.assignHeroToPartySlot(['Falie', 'Huun', 'Runa', 'Kojonn'], 'Runa', 0),
      ['Runa', 'Huun', 'Falie', 'Kojonn'],
    );
    assert.deepEqual(
      mod.assignHeroToPartySlot(['Falie', '', 'Runa', ''], 'Kojonn', 1),
      ['Falie', 'Kojonn', 'Runa', ''],
    );
    assert.deepEqual(
      mod.normalizePartyFormationSlots(['Falie'], 4),
      ['Falie', '', '', ''],
    );
  }
});

test('party slot assignment writes active party slots through the existing dev-tooling config path', () => {
  const appSrc = read('web-runner/app.js');
  assert.match(appSrc, /assignHeroToPartySlot,/);
  assert.match(appSrc, /normalizePartyFormationSlots,/);
  assert.match(appSrc, /async function assignSelectedHeroToPartySlot\(slotIndex = 0\)/);
  assert.match(appSrc, /const currentSlots = normalizePartyFormationSlots\(getConfiguredHeroSlots\(\)\);/);
  assert.match(appSrc, /const nextSlots = assignHeroToPartySlot\(currentSlots, hero\.name, slotIndex\);/);
  assert.match(appSrc, /uiState\.setUIStateField\('heroScreenSelectedPartySlot'/);
  assert.match(appSrc, /applyDevToolingConfig\(\{ heroSlots: nextSlots \}, \{ closeModal: false \}\)/);

  const hookSrc = read('web-runner/systems/devBrowserTestHooks.js');
  assert.match(hookSrc, /activePartySlots: normalizePartyFormationSlots\(getConfiguredHeroSlots\(\)\)/);
});
