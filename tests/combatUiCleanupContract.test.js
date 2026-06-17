const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('combat UI cleanup suppresses inactive buff placeholder icons from the runtime layout', () => {
  const appSrc = read('web-runner/app.js');
  assert.match(appSrc, /function shouldSuppressCombatLayoutInstance\(instance\) \{/);
  assert.match(appSrc, /instance\.type === 'buffIcon1'/);
  assert.match(appSrc, /instance\.type === 'buffIcon2'/);
  assert.match(appSrc, /instance\.type === 'buffIcon3'/);
  assert.match(appSrc, /instance\.type === 'buffIcon4'/);
  assert.match(appSrc, /instances = tryGetInstances\(layout\)\.filter\(\(instance\) => !shouldSuppressCombatLayoutInstance\(instance\)\);/);
});

test('combat story card layout anchors to the HP bar when buff placeholders are removed', () => {
  const appSrc = read('web-runner/app.js');
  const storyCardSrc = read('web-runner/systems/storyCardPresentation.js');
  assert.match(appSrc, /initializeStoryCardPresentationLayout\(\{/);
  assert.doesNotMatch(appSrc, /const hpBarInstance = \(instances \|\| \[\]\)\.find\(ins => ins && ins\.type === 'PartyHP_Bar' && ins\.world\);/);
  assert.match(storyCardSrc, /const hpBarInstance = \(instances \|\| \[\]\)\.find\(ins => ins && ins\.type === 'PartyHP_Bar' && ins\.world\);/);
  assert.match(storyCardSrc, /const hpBarBottom = hpBarInstance/);
  assert.match(storyCardSrc, /const layoutAnchorBottom = buffInstances\.length/);
  assert.match(storyCardSrc, /: \(ampBarBottom \|\| hpBarBottom \|\| \(viewTop \+ Math\.max\(240, Math\.round\(250 \* scale\)\)\)\);/);
  assert.match(storyCardSrc, /const slotY = layoutAnchorBottom \+ topMargin;/);
});

test('combat story card layout is recomputed after browser resize', () => {
  const appSrc = read('web-runner/app.js');
  const viewportSrc = read('web-runner/systems/appShellViewport.js');
  assert.match(appSrc, /createAppViewportRuntime\(\{[\s\S]*onResize\(\) \{[\s\S]*initializeStoryCardLayout\('window-resize'\);[\s\S]*if \(typeof drawFrame === 'function'\) drawFrame\(\);[\s\S]*\}/);
  assert.doesNotMatch(appSrc, /const handleWindowResize = \(\) => \{/);
  assert.match(viewportSrc, /const handleWindowResize = \(\) => \{[\s\S]*const metrics = resizeCanvas\(\);[\s\S]*if \(typeof onResize === 'function'\) onResize\(metrics\);[\s\S]*\};/);
});

test('combat renderer removes the four buff slot boxes from combat entirely', () => {
  const runtimeSrc = read('web-runner/systems/renderRuntime.js');
  assert.match(runtimeSrc, /Remove the legacy buff-slot placeholder row from combat/);
  assert.match(runtimeSrc, /r\.inst && r\.inst\.type === 'Sprite5' && r\.layerName === 'BoardBG'/);
  assert.match(runtimeSrc, /return false;/);
});
