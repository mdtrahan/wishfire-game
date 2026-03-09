const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('combat nav remaps mission text/route to Vault', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /if \(label === 'Vault' \|\| label === 'Mission'\)/);
  assert.match(src, /Nav_MissionText:\s*'Vault'/);
  assert.match(src, /r\.inst\.type === 'Nav_MissionText'\) \{\s*text = 'Vault';/s);
});

test('chests layout includes top-rail retention buttons and routing hit zones', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /ctx\.fillText\('Vault', panel\.x \+ 14, panel\.y \+ 58\);/);
  assert.match(src, /drawHeroStyleCloseControl\(ctx, close, closeWinOvalImage, palette\.ink\);/);
  assert.match(src, /close,\s*\n\s*combatBack,\s*\n\s*retentionButtons:/);
  assert.match(src, /retentionButtons:\s*\[/);
  assert.match(src, /title:\s*'Enter Homestead'/);
  assert.match(src, /title:\s*'Enter Collectibles'/);
  assert.match(src, /title:\s*'Enter Mounts'/);
  assert.match(src, /title:\s*'Enter Artifacts'/);
  assert.match(src, /title:\s*'Enter Tomes'/);
  assert.match(src, /retentionButtons:\s*retentionHitZones,/);
  assert.match(src, /requestLayoutChange\('combat', 'chests-close-button'\)/);
  assert.match(src, /layoutState\.requestLayoutChange\(String\(btn\.targetLayout\),\s*`chests-\$\{String\(btn\.id \|\| 'retention'\)\}`\)/);
});

test('map layout no longer exposes retention-locale hit buttons', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /gameState\.mapLayout\.tomesLocaleHit = null;/);
  assert.match(src, /gameState\.mapLayout\.artifactsLocaleHit = null;/);
  assert.match(src, /gameState\.mapLayout\.mountsLocaleHit = null;/);
  assert.match(src, /gameState\.mapLayout\.collectiblesLocaleHit = null;/);
  assert.match(src, /gameState\.mapLayout\.homesteadLocaleHit = null;/);
});

test('retention gallery back routes return to vault home (chestsLayout)', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /allowedTransitions: \['chestsLayout', 'combat'\],/);
  assert.match(src, /requestLayoutChange\('chestsLayout', 'tomes-back-vault'\)/);
  assert.match(src, /requestLayoutChange\('chestsLayout', 'artifacts-back-vault'\)/);
  assert.match(src, /requestLayoutChange\('chestsLayout', 'mounts-back-vault'\)/);
  assert.match(src, /requestLayoutChange\('chestsLayout', 'collectibles-back-vault'\)/);
  assert.match(src, /requestLayoutChange\('chestsLayout', 'homestead-back-vault'\)/);
  assert.match(src, /drawHeroStyleCloseControl\(ctx,\s*close,\s*closeWinOvalImage,\s*palette\.ink\);/);
  assert.match(src, /isPointInRect\(mx, my, zones\.close\) \|\| isPointInRect\(mx, my, zones\.mapBack\)/);
});

test('hero-style close helper uses injected image reference (no out-of-scope global)', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /function drawHeroStyleCloseControl\(ctx, closeRect, closeOvalImage = null, ink = '#111'\)/);
  assert.match(src, /if \(closeOvalImage\) \{\s*ctx\.drawImage\(closeOvalImage, closeRect\.x, closeRect\.y, closeRect\.w, closeRect\.h\);/s);
});
