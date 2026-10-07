const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');

test('combat boss button is centered on the game grid for drawing and pointer input', async () => {
  const loader = fs.readFileSync(path.join(root, 'web-runner/systems/runtimeVisualAssetLoader.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'web-runner/systems/renderRuntime.js'), 'utf8');
  const control = fs.readFileSync(path.join(root, 'web-runner/systems/renderCombatBossControl.mjs'), 'utf8');
  const pointer = fs.readFileSync(path.join(root, 'web-runner/systems/pointerRoutingShell.js'), 'utf8');
  assert.match(loader, /images\.CombatBossButton = await loadImage\(assetUrl\('images\/boss_button\.png'\)\)/);
  assert.match(renderer, /drawCombatBossControl\(ctx, \{ state, images, worldToCanvas \}\)/);
  assert.match(control, /centerX: 180, centerY: 50, w: 50, h: 50/);
  assert.match(control, /controlState === 'locked'\) return null/);
  assert.doesNotMatch(control, /shadowBlur/);
  assert.match(control, /'READY'/);
  assert.match(control, /controlState\.toUpperCase\(\)/);
  assert.match(pointer, /import \{ combatBossControlRect \} from '\.\/renderCombatBossControl\.mjs'/);
  assert.match(pointer, /onBossButtonClick\(\)/);
  assert.match(pointer, /bossStage\?\.bossActive === true[\s\S]*bossTransitionEndsAtMs[\s\S]*return \{ handled: true/,
    'pointer actions are consumed throughout the fixed-camera entry wipe');
  const { combatBossControlRect } = await import(pathToFileURL(path.join(root, 'web-runner/systems/renderCombatBossControl.mjs')));
  const rect = combatBossControlRect((x, y) => ({ x: x * 1.5 + 10, y: y * 1.5 + 4 }));
  assert.deepEqual(rect, { x: 255, y: 54, w: 50, h: 50 });
});
