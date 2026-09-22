const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');

test('combat boss button loads and renders at its fixed grid position', () => {
  const loader = fs.readFileSync(path.join(root, 'web-runner/systems/runtimeVisualAssetLoader.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'web-runner/systems/renderRuntime.js'), 'utf8');
  assert.match(loader, /images\.CombatBossButton = await loadImage\(assetUrl\('images\/boss_button\.png'\)\)/);
  assert.match(renderer, /ctx\.drawImage\(images\.CombatBossButton, 150, 50, 50, 50\)/);
});
