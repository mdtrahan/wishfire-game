const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');

test('combat boss button loads and renders at its fixed grid position', () => {
  const loader = fs.readFileSync(path.join(root, 'web-runner/systems/runtimeVisualAssetLoader.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'web-runner/systems/renderRuntime.js'), 'utf8');
  const control = fs.readFileSync(path.join(root, 'web-runner/systems/renderCombatBossControl.mjs'), 'utf8');
  const pointer = fs.readFileSync(path.join(root, 'web-runner/systems/pointerRoutingShell.js'), 'utf8');
  assert.match(loader, /images\.CombatBossButton = await loadImage\(assetUrl\('images\/boss_button\.png'\)\)/);
  assert.match(renderer, /drawCombatBossControl\(ctx, \{ state, images \}\)/);
  assert.match(control, /x: 125, y: 25, w: 50, h: 50/);
  assert.match(control, /controlState === 'locked'\) return null/);
  assert.doesNotMatch(control, /shadowBlur/);
  assert.match(control, /'READY'/);
  assert.match(control, /controlState\.toUpperCase\(\)/);
  assert.match(pointer, /import \{ combatBossControlRect \} from '\.\/renderCombatBossControl\.mjs'/);
  assert.match(pointer, /onBossButtonClick\(\)/);
});
