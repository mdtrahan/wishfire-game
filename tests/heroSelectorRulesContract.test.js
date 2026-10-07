const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('battlefield selectors stay retired while turn identity remains available', () => {
  const repoRoot = path.join(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  const rules = read('web-runner/src/core/heroSelectorRules.mjs');
  const app = read('web-runner/app.js');
  const loader = read('web-runner/systems/runtimeVisualAssetLoader.js');
  const renderer = read('web-runner/systems/renderRuntime.js');

  assert.match(rules, /export function resolveCurrentHeroUID/);
  for (const source of [rules, app, loader, renderer]) {
    assert.doesNotMatch(source, /shouldRenderHeroTurnSelector|heroSelectorImage|images\['Selector'\]|assetSizes\.Selector/);
  }
  assert.match(app, /instance\.type === 'Selector'[\s\S]*instance\.type === 'heroSelect'/);
  assert.doesNotMatch(loader, /selector-animation/);
  assert.doesNotMatch(renderer, /Render attack selectors|Hero turn indicator selector/);
});
