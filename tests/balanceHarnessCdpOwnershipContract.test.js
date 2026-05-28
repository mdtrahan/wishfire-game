const test = require('node:test');
const assert = require('node:assert/strict');

const { buildConfig } = require('../tools/balance_harness.js');

test('balance harness keeps CDP-attached Chrome externally owned by default', () => {
  const config = buildConfig(['--cdpUrl', 'http://127.0.0.1:9222'], {});
  assert.equal(config.cdpUrl, 'http://127.0.0.1:9222');
  assert.equal(config.closeAttachedBrowser, false);
});

test('balance harness allows explicit opt-in to close the attached Chrome session', () => {
  const config = buildConfig(['--cdpUrl', 'http://127.0.0.1:9222', '--closeAttachedBrowser', 'true'], {});
  assert.equal(config.closeAttachedBrowser, true);
});
