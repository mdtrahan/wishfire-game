const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = process.cwd();
const OUTPUT_DIR = path.join(REPO_ROOT, 'output', 'playwright', 'browser-battery');
const AGENT_BROWSER_HOME = path.join(OUTPUT_DIR, 'home');
const AGENT_BROWSER_SOCKET_DIR = path.join('/tmp', 'ab-battery');
const AGENT_BROWSER_EXECUTABLE_PATH = process.env.AGENT_BROWSER_EXECUTABLE_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const GAME_URL = process.env.BROWSER_BATTERY_URL || process.env.GAME_URL || 'http://127.0.0.1:8000/web-runner/';
const BROWSER_BATTERY_CDP_URL = process.env.BROWSER_BATTERY_CDP_URL || process.env.AGENT_BROWSER_CDP_URL || '';
const BROWSER_BATTERY_DIRECT = process.env.BROWSER_BATTERY_DIRECT === '1';
const E2E_ENABLED = process.env.BROWSER_BATTERY_E2E === '1';

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function writeArtifact(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function runAgentBrowser(args, label) {
  const result = spawnSync('agent-browser', args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: AGENT_BROWSER_HOME,
      AGENT_BROWSER_SOCKET_DIR,
      AGENT_BROWSER_SESSION: 'bb',
      AGENT_BROWSER_EXECUTABLE_PATH,
    },
  });
  if (result.status !== 0) {
    const stdout = (result.stdout || '').trim();
    const stderr = (result.stderr || '').trim();
    throw new Error(
      `${label} failed with exit code ${result.status}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

test('agent-browser CLI is installed and reachable', () => {
  const help = spawnSync('agent-browser', ['--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, 'agent-browser --help must succeed');
  assert.match(help.stdout || '', /agent-browser/i);
  assert.match(help.stdout || '', /open <url>/i);
});

test('browser battery: boot, render hook, and artifacts', { timeout: 120000 }, (t) => {
  if (!E2E_ENABLED) {
    t.skip('Set BROWSER_BATTERY_E2E=1 to run the browser battery.');
    return;
  }
  if (!BROWSER_BATTERY_CDP_URL && !BROWSER_BATTERY_DIRECT) {
    t.skip('Set BROWSER_BATTERY_CDP_URL for an attached Chrome session or BROWSER_BATTERY_DIRECT=1 to attempt a local launch.');
    return;
  }

  ensureOutputDir();
  const paths = {
    renderProbe: path.join(OUTPUT_DIR, 'render-probe.json'),
    renderState: path.join(OUTPUT_DIR, 'render-state.json'),
    snapshot: path.join(OUTPUT_DIR, 'snapshot.txt'),
    screenshot: path.join(OUTPUT_DIR, 'browser-battery.png'),
    console: path.join(OUTPUT_DIR, 'console.txt'),
    errors: path.join(OUTPUT_DIR, 'errors.txt'),
  };

  let browserOpened = false;
  try {
    fs.mkdirSync(AGENT_BROWSER_HOME, { recursive: true });
    fs.mkdirSync(AGENT_BROWSER_SOCKET_DIR, { recursive: true });
    runAgentBrowser(['set', 'viewport', '1200', '900'], 'set viewport');
    runAgentBrowser(['console', '--clear'], 'clear console');
    runAgentBrowser(['errors', '--clear'], 'clear errors');
    if (BROWSER_BATTERY_CDP_URL) {
      runAgentBrowser(['connect', BROWSER_BATTERY_CDP_URL], 'connect browser');
    }
    runAgentBrowser(['open', GAME_URL], 'open game url');
    browserOpened = true;
    runAgentBrowser(['wait', '#view'], 'wait for app shell');
    runAgentBrowser(['wait', '750'], 'settle after boot');

    const renderProbe = runAgentBrowser(
      ['eval', 'JSON.stringify({ hook: typeof window.render_game_to_text, text: window.render_game_to_text ? window.render_game_to_text() : null })'],
      'probe render hook',
    );
    writeArtifact(paths.renderProbe, renderProbe.stdout);

    const probePayload = JSON.parse(renderProbe.stdout.trim());
    assert.equal(probePayload.hook, 'function', 'render_game_to_text must be available');
    assert.equal(typeof probePayload.text, 'string');
    assert.ok(probePayload.text.trim().length > 0, 'render_game_to_text must return a JSON string');

    const renderState = JSON.parse(probePayload.text);
    writeArtifact(paths.renderState, JSON.stringify(renderState, null, 2));
    assert.equal(typeof renderState, 'object');
    assert.ok(renderState && Object.keys(renderState).length > 0, 'rendered state must not be empty');

    const snapshot = runAgentBrowser(['snapshot', '-i', '-c'], 'capture snapshot');
    writeArtifact(paths.snapshot, snapshot.stdout);
    assert.ok(snapshot.stdout.trim().length > 0, 'interactive snapshot must not be empty');

    const screenshot = runAgentBrowser(['screenshot', paths.screenshot], 'capture screenshot');
    assert.ok(screenshot.stdout.length >= 0, 'screenshot command should complete');
    assert.ok(fs.existsSync(paths.screenshot), 'screenshot artifact must exist');

    const consoleLogs = runAgentBrowser(['console'], 'capture console');
    writeArtifact(paths.console, consoleLogs.stdout);

    const pageErrors = runAgentBrowser(['errors'], 'capture errors');
    writeArtifact(paths.errors, pageErrors.stdout);

    const consoleText = (consoleLogs.stdout || '').trim();
    const errorText = (pageErrors.stdout || '').trim();
    if (consoleText) {
      console.warn(`[browser-battery] console output captured in ${paths.console}`);
    }
    if (errorText) {
      console.warn(`[browser-battery] page errors captured in ${paths.errors}`);
    }
  } finally {
    if (browserOpened) {
      try {
        runAgentBrowser(['close'], 'close browser');
      } catch (error) {
        console.warn(`[browser-battery] close failed: ${error.message}`);
      }
    }
  }
});
