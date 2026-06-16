const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('chests scaffold defines deterministic tabs/progress/reward model in runtime state', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'state', 'gameState.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /chestsLayout:\s*\{/);
  assert.match(src, /entryPoint:\s*'menu-nav'/);
  assert.match(src, /activeTab:\s*'Common'/);
  assert.match(src, /tabs:\s*\[/);
  assert.match(src, /id:\s*'Legendary'/);
  assert.match(src, /rewardsByTab:\s*\{/);
});

test('chests layout is wired to mission nav and runtime route', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  const registrySrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'runtimeLayoutRegistry.js'), 'utf8');
  assert.match(src, /import \{ createInitialGameState \} from '\.\/state\/gameState\.js';/);
  assert.match(src, /const gameState = createInitialGameState\(\);/);
  assert.match(registrySrc, /id:\s*'chestsLayout'/);
  assert.match(src, /layoutState\.requestLayoutChange\('chestsLayout',\s*'nav-chests'\)/);
  assert.match(src, /case 'chestsLayout':/);
  assert.match(src, /if \(activeLayoutId === 'chestsLayout'\)/);
});
