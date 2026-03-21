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

test('hero layout formation mode writes active party slots through the existing dev-tooling config seam', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /modeToggle/);
  assert.match(src, /gameState\.heroScreen\.mode === 'formation'/);
  assert.match(src, /activePartySlots: normalizePartyFormationSlots\(getConfiguredHeroSlots\(\)\)/);
  assert.match(src, /assignSelectedHeroToPartySlot\(slotIndex = 0\)[\s\S]*applyDevToolingConfig\(\{ heroSlots: nextSlots \}, \{ closeModal: false \}\)/);
  assert.match(src, /formation assign failed/);
  assert.match(src, /AVAILABLE ROSTER/);
  assert.match(src, /ACTIVE PARTY/);
});
