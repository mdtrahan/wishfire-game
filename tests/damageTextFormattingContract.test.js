const test = require('node:test');
const assert = require('node:assert/strict');

test('formatDamageValue leaves signless values and appends crit emphasis only', async () => {
  const mod = await import('../src/core/damageTextFormatting.mjs');
  assert.equal(mod.formatDamageValue({ value: 150, type: 'damage' }), '150');
  assert.equal(mod.formatDamageValue({ value: 320, type: 'heal' }), '320');
  assert.equal(mod.formatDamageValue({ value: 180, type: 'damage', isCrit: true }), '180!!');
  assert.equal(mod.formatDamageValue({ value: 45, type: 'heal', isCrit: true }), '45!!');
});
