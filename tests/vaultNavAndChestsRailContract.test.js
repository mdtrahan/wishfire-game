const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('combat nav remaps mission text/route to Vault', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');
  const runtimeSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');

  assert.match(src, /if \(label === 'Vault' \|\| label === 'Mission'\)/);
  assert.match(src, /Nav_MissionText:\s*'Vault'/);
  assert.match(runtimeSrc, /Nav_MissionText/);
  assert.match(runtimeSrc, /text = 'Vault';/);
});

test('chests layout includes top-rail retention buttons and routing hit zones', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');
  const chestsSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderChests.js'), 'utf8');
  const stateSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'state', 'gameState.js'), 'utf8');

  assert.match(chestsSrc, /ctx\.fillText\('Vault', panel\.x \+ 14, panel\.y \+ 58\);/);
  assert.match(chestsSrc, /drawHeroStyleCloseControl\(ctx, close, closeWinOvalImage, palette\.ink\);/);
  assert.match(chestsSrc, /close,\s*combatBack,\s*retentionButtons:/);
  assert.match(chestsSrc, /gameState\.chestsLayout\.retentionButtons/);
  assert.match(stateSrc, /title:\s*'Enter Homestead'/);
  assert.match(stateSrc, /title:\s*'Enter Collectibles'/);
  assert.match(stateSrc, /title:\s*'Enter Mounts'/);
  assert.match(stateSrc, /title:\s*'Enter Artifacts'/);
  assert.match(stateSrc, /title:\s*'Enter Tomes'/);
  assert.match(chestsSrc, /retentionButtons:\s*retentionHitZones,/);
  assert.match(src, /requestLayoutChange\('combat', 'chests-close-button'\)/);
  assert.match(src, /layoutState\.requestLayoutChange\(String\(btn\.targetLayout\),\s*`chests-\$\{String\(btn\.id \|\| 'retention'\)\}`\)/);
});

test('map layout no longer exposes retention-locale hit buttons', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'systems', 'runtimeLayoutRegistry.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /mapLayoutState\.setMapLayoutField\('tomesLocaleHit', null\);/);
  assert.match(src, /mapLayoutState\.setMapLayoutField\('artifactsLocaleHit', null\);/);
  assert.match(src, /mapLayoutState\.setMapLayoutField\('mountsLocaleHit', null\);/);
  assert.match(src, /mapLayoutState\.setMapLayoutField\('collectiblesLocaleHit', null\);/);
  assert.match(src, /mapLayoutState\.setMapLayoutField\('homesteadLocaleHit', null\);/);
});

test('retention gallery back routes return to vault home (chestsLayout)', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');
  const registrySrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'runtimeLayoutRegistry.js'), 'utf8');

  assert.match(registrySrc, /const GALLERY_TRANSITIONS = Object\.freeze\(\['chestsLayout', 'combat'\]\);/);
  assert.match(src, /requestLayoutChange\('chestsLayout', 'tomes-back-vault'\)/);
  assert.match(src, /requestLayoutChange\('chestsLayout', 'artifacts-back-vault'\)/);
  assert.match(src, /requestLayoutChange\('chestsLayout', 'mounts-back-vault'\)/);
  assert.match(src, /requestLayoutChange\('chestsLayout', 'collectibles-back-vault'\)/);
  assert.match(src, /requestLayoutChange\('chestsLayout', 'homestead-back-vault'\)/);
  assert.match(src, /isPointInRect\(mx, my, zones\.close\) \|\| isPointInRect\(mx, my, zones\.mapBack\)/);
});

test('hero-style close helper uses injected image reference (no out-of-scope global)', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderSystem.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /export function drawHeroStyleCloseControl\(ctx, closeRect, closeOvalImage = null, ink = '#111'\)/);
  assert.match(src, /if \(closeOvalImage\) \{[\s\S]*ctx\.drawImage\(closeOvalImage, closeRect\.x, closeRect\.y, closeRect\.w, closeRect\.h\);/);
});
