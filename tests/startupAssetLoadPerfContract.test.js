const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('startup asset loader preloads base sprites and queues extended visuals before combat runtime activation', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'systems', 'runtimeVisualAssetLoader.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /const allTypeNames = Object\.keys\(types\);/);
  assert.match(src, /await loadBaseSprites\(allTypeNames,\s*0\.3,\s*0\.74\);/);
  assert.match(src, /const deferredVisualsPromise = loadDeferredVisuals\(\)/);
  assert.doesNotMatch(src, /await loadDeferredVisuals\(\);/);
  assert.match(src, /deferredVisualsPromise,/);
});

test('core visuals load in parallel batch instead of sequential await chain', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'systems', 'runtimeVisualAssetLoader.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /const tasks = \[\];/);
  assert.match(src, /await Promise\.all\(tasks\.map\(async \(task\) => \{/);
  assert.match(src, /const heroPortraitLoads = \['Falie', 'Huun', 'Runa', 'Kojonn'\]\.map/);
  assert.match(src, /const chainStrikeArcLoad = \(async \(\) => \{/);
  assert.match(src, /images\.SkillChainStrikeArc = img;/);
  assert.match(src, /const chainStrikeArcLoad = \(async \(\) => \{/);
  assert.match(src, /images\.SkillChainStrikeArc = img;/);
  assert.match(src, /images\.SkillArcanePulse = await loadImage\(assetUrl\('images\/skill_arcane_pulse_96x96\.png'\)\);/);
  assert.match(src, /const loadedGemVisuals = await gemVisuals\.loadGemVisuals/);
});

test('favicon is a local root asset and is not redirected away on Netlify', () => {
  const repoRoot = path.join(__dirname, '..');
  const iconPath = path.join(repoRoot, 'favicon.ico');
  const html = fs.readFileSync(path.join(repoRoot, 'web-runner', 'index.html'), 'utf8');
  const netlify = fs.readFileSync(path.join(repoRoot, 'netlify.toml'), 'utf8');

  assert.ok(fs.statSync(iconPath).size > 0);
  assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="any">/);
  assert.match(netlify, /for = "\/favicon\.ico"/);
  assert.doesNotMatch(netlify, /from = "\/favicon\.ico"[\s\S]*?status = 30[12]/);
});
