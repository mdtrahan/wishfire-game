const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('retired turn-order and AF readout is absent from the player shell', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /data-devtool-turn-order-qa|Combat Turn QA|Role AF immediate|Pending 100-AF signals/);
});
