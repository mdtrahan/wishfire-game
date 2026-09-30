const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('retired turn-based autoplay controls are absent from the player runtime', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const hooks = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'devBrowserTestHooks.js'), 'utf8');
  const tooling = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'devToolingRuntime.js'), 'utf8');
  assert.doesNotMatch(src, /runDevAutoplayUntilDepleted|playScheduledHeroCommand/);
  assert.doesNotMatch(hooks, /runDevAutoplayUntilDepleted|stopDevAutoplay/);
  assert.doesNotMatch(tooling, /data-devtool-autoplay|setAutoplayHandler/);
});
