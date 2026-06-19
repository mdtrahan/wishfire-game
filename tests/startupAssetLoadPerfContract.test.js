const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('startup asset loader preloads all base sprites before combat runtime activation', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'systems', 'runtimeVisualAssetLoader.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /const allTypeNames = Object\.keys\(types\);/);
  assert.match(src, /await loadBaseSprites\(allTypeNames,\s*0\.3,\s*0\.74\);/);
  assert.match(src, /await loadDeferredVisuals\(\);/);
});

test('core visuals load in parallel batch instead of sequential await chain', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'systems', 'runtimeVisualAssetLoader.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /const tasks = \[\];/);
  assert.match(src, /await Promise\.all\(tasks\.map\(async \(task\) => \{/);
  assert.match(src, /const heroPortraitLoads = \['Falie', 'Huun', 'Runa', 'Kojonn'\]\.map/);
  assert.match(src, /const chainStrikeArcLoad = \(async \(\) => \{/);
  assert.match(src, /images\.SkillChainStrikeArc = img;/);
  assert.match(src, /const loadedGemVisuals = await gemVisuals\.loadGemVisuals/);
});
