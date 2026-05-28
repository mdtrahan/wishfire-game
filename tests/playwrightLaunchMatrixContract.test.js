const test = require('node:test');
const assert = require('node:assert/strict');

const { buildChromeSpawnArgs } = require('../tools/playwright_launch_matrix.js');

test('playwright launch matrix builds minimal Chrome spawn args for UI and headless probes', () => {
  assert.deepEqual(
    buildChromeSpawnArgs({ port: 9331, profileDir: '/tmp/ui', headless: false }),
    [
      '--remote-debugging-port=9331',
      '--user-data-dir=/tmp/ui',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
  );

  assert.deepEqual(
    buildChromeSpawnArgs({ port: 9332, profileDir: '/tmp/headless', headless: true }),
    [
      '--remote-debugging-port=9332',
      '--user-data-dir=/tmp/headless',
      '--no-first-run',
      '--no-default-browser-check',
      '--headless=new',
      'about:blank',
    ],
  );
});
