const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyPlaywrightFailure,
  normalizeCdpUrl,
  readBool,
} = require('../tools/playwright_support.js');
const { buildChromeLaunchArgs } = require('../tools/chrome_cdp_bootstrap.js');

test('playwright support classifies Codex sandbox startup failures separately from CDP reachability', () => {
  const sandboxFailure = classifyPlaywrightFailure(
    'FATAL:base/apple/mach_port_rendezvous_mac.cc:155 bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.59843: Permission denied (1100)',
  );
  const transformFailure = classifyPlaywrightFailure(
    'Application Specific Information: abort() called Thread 0 Crashed ___RegisterApplication_block_invoke TransformProcessType HIServices',
  );
  const cdpFailure = classifyPlaywrightFailure('browserType.connectOverCDP: connect ECONNREFUSED 127.0.0.1:9222');

  assert.equal(sandboxFailure.code, 'sandbox_browser_startup_denied');
  assert.equal(transformFailure.code, 'sandbox_browser_startup_denied');
  assert.equal(cdpFailure.code, 'cdp_unreachable');
});

test('playwright support preserves explicit boolean env parsing and normalizes CDP urls', () => {
  assert.equal(readBool('true', false), true);
  assert.equal(readBool('0', true), false);
  assert.equal(normalizeCdpUrl('http://127.0.0.1:9222/'), 'http://127.0.0.1:9222');
});

test('chrome CDP bootstrap launches a fresh profile with the requested debug port', () => {
  const args = buildChromeLaunchArgs({
    port: 9227,
    profileDir: '/tmp/orka-profile',
    startUrl: 'about:blank',
  });

  assert.deepEqual(args, [
    '--remote-debugging-port=9227',
    '--user-data-dir=/tmp/orka-profile',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);
});
