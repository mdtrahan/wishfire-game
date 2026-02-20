const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const GAME_URL = process.env.GAME_URL || 'http://127.0.0.1:8000/web-runner/';

function runAgentBrowser(args, label) {
  const result = spawnSync('agent-browser', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(
      `${label} failed with exit code ${result.status}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }
  return result;
}

test('agent-browser CLI smoke for gem-board page', { timeout: 60000 }, (t) => {
  if (process.env.AGENT_BROWSER_E2E !== '1') {
    t.skip('Set AGENT_BROWSER_E2E=1 to run browser automation smoke test.');
    return;
  }

  // Explicit CLI chain: open -> wait -> snapshot -> close
  runAgentBrowser(['open', GAME_URL], 'open');
  runAgentBrowser(['wait', '#view'], 'wait for canvas');
  const snap = runAgentBrowser(['snapshot', '-i'], 'interactive snapshot');
  assert.ok((snap.stdout || '').length > 0, 'snapshot output must not be empty');
  runAgentBrowser(['close'], 'close');
});
