const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');

async function loadRules() {
  return import(pathToFileURL(path.join(root, 'src', 'core', 'combatOrientation.mjs')).href);
}

test('combat orientation input is defensive and defaults left-wise', async () => {
  const rules = await loadRules();
  assert.equal(rules.normalizeCombatOrientation('right-wise'), 'right-wise');
  assert.equal(rules.normalizeCombatOrientation(' RIGHT-WISE '), 'right-wise');
  for (const value of [undefined, null, '', ' ', 'right', 'left-wise-ish']) {
    assert.equal(rules.normalizeCombatOrientation(value), 'left-wise');
  }
  assert.equal(rules.readCombatOrientationFromSearch('?combat_orientation=right-wise'), 'right-wise');
  assert.equal(rules.readCombatOrientationFromSearch('?combat_orientation=invalid'), 'left-wise');
  assert.equal(rules.readCombatOrientationFromSearch(''), 'left-wise');
});

test('right-wise geometry is an exact logical-world reflection', async () => {
  const rules = await loadRules();
  const layoutW = 960;
  const actorSets = [
    [
      { uid: 1, kind: 'hero', slot: 0, x: 170, y: 240 },
      { uid: 101, kind: 'enemy', slot: 0, x: 740, y: 240 },
    ],
    [
      { uid: 1, kind: 'hero', slot: 0, x: 145, y: 130 },
      { uid: 2, kind: 'hero', slot: 1, x: 170, y: 210 },
      { uid: 3, kind: 'hero', slot: 2, x: 145, y: 290 },
      { uid: 4, kind: 'hero', slot: 3, x: 170, y: 370 },
      { uid: 101, kind: 'enemy', slot: 0, x: 735, y: 160 },
      { uid: 102, kind: 'enemy', slot: 1, x: 760, y: 250 },
      { uid: 103, kind: 'enemy', slot: 2, x: 735, y: 340 },
    ],
    [
      { uid: 1, kind: 'hero', slot: 0, x: 145, y: 130 },
      { uid: 4, kind: 'hero', slot: 3, x: 170, y: 370 },
      { uid: 102, kind: 'enemy', slot: 1, x: 760, y: 250 },
    ],
  ];

  for (const actors of actorSets) {
    const left = rules.createCombatOrientationGeometry({ orientation: 'left-wise', layoutW, actors });
    const right = rules.createCombatOrientationGeometry({ orientation: 'right-wise', layoutW, actors });
    assert.equal(left.axis, layoutW / 2);
    assert.equal(right.axis, layoutW / 2);
    assert.equal(left.actors.length, right.actors.length);
    for (let i = 0; i < actors.length; i += 1) {
      assert.equal(left.actors[i].x + right.actors[i].x, layoutW);
      assert.equal(left.actors[i].uid, right.actors[i].uid);
      assert.equal(left.actors[i].kind, right.actors[i].kind);
      assert.equal(left.actors[i].slot, right.actors[i].slot);
      assert.equal(left.actors[i].y, right.actors[i].y);
    }
  }
  assert.equal(rules.orientCombatWorldOffsetX(18, 'right-wise'), -18);
  assert.equal(rules.orientCombatWorldOffsetX(18, 'left-wise'), 18);
});

test('runtime projects actor visuals, hit regions, and action anchors without mutating combat state', () => {
  const app = fs.readFileSync(path.join(root, 'web-runner', 'app.js'), 'utf8');
  const render = fs.readFileSync(path.join(root, 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  const hooks = fs.readFileSync(path.join(root, 'web-runner', 'systems', 'devBrowserTestHooks.js'), 'utf8');

  assert.match(app, /CombatOrientation = readCombatOrientationFromSearch\(window\.location\.search\)/);
  assert.match(app, /function combatActorWorldToCanvas/);
  assert.match(app, /const pos = combatActorWorldToCanvas\(x, y\)/);
  assert.match(app, /worldToCanvas: combatActorWorldToCanvas/);
  assert.match(app, /orientCombatWorldOffsetX\(Number\(d\.floatVectorX/);

  assert.match(render, /spawnPendingDamageNumbers\(projectCombatDamageWorldToCanvas\)/);
  assert.match(render, /projectCombatActorWorldToCanvas\(xWorld, yWorld\)/);
  assert.match(render, /projectCombatActorWorldToCanvas\(wardWorldX, wardWorldY\)/);
  assert.match(render, /projectCombatActorWorldToCanvas\(Number\(pulse\.sourceX/);
  assert.match(render, /projectCombatActorWorldToCanvas\(Number\(pulse\.targetX/);
  assert.match(render, /CombatOrientationGeometry = createCombatOrientationGeometry/);
  assert.match(hooks, /combatOrientation:/);

  assert.doesNotMatch(app, /localStorage[^\n]*CombatOrientation|CombatOrientation[^\n]*localStorage/);
});

test('developer panel stages orientation and refreshes combat instead of flipping a live frame', () => {
  const devTooling = fs.readFileSync(path.join(root, 'web-runner', 'systems', 'devToolingRuntime.js'), 'utf8');
  assert.match(devTooling, /combatOrientation: normalizeCombatOrientation\(state\.globals\.CombatOrientation\)/);
  assert.match(devTooling, /data-devtool-combat-orientation/);
  assert.match(devTooling, /state\.globals\.CombatOrientation = next\.combatOrientation/);
  assert.match(devTooling, /const orientationChanged = prev\.combatOrientation !== next\.combatOrientation/);
  assert.match(devTooling, /const combatSetupChanged = loadoutChanged \|\| orientationChanged/);
  assert.match(devTooling, /await devToolingRefreshHandler\(\{ forceCombat: false, resetGame: false \}\)/);
});

test('right-wise actor sprites mirror about their oriented pivot while left-wise stays byte-compatible', async () => {
  const presentation = await import(pathToFileURL(path.join(
    root,
    'web-runner',
    'systems',
    'combatActorSpritePresentation.mjs',
  )).href);
  const makeContext = () => {
    const calls = [];
    return {
      calls,
      save: () => calls.push(['save']),
      translate: (x, y) => calls.push(['translate', x, y]),
      scale: (x, y) => calls.push(['scale', x, y]),
      drawImage: (...args) => calls.push(['drawImage', ...args]),
      restore: () => calls.push(['restore']),
    };
  };
  const image = { id: 'actor-sprite' };
  const draw = { drawX: 280, drawY: 40, width: 80, height: 60, pivotX: 320 };

  const leftCtx = makeContext();
  const left = presentation.drawCombatActorSprite(leftCtx, image, { ...draw, orientation: 'left-wise' });
  assert.equal(left.mirrored, false);
  assert.deepEqual(leftCtx.calls, [['drawImage', image, 280, 40, 80, 60]]);

  const rightCtx = makeContext();
  const right = presentation.drawCombatActorSprite(rightCtx, image, { ...draw, orientation: 'right-wise' });
  assert.equal(right.mirrored, true);
  assert.deepEqual(rightCtx.calls, [
    ['save'],
    ['translate', 320, 0],
    ['scale', -1, 1],
    ['translate', -320, 0],
    ['drawImage', image, 280, 40, 80, 60],
    ['restore'],
  ]);

  const render = fs.readFileSync(path.join(root, 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  assert.match(render, /drawCombatActorSprite\(ctx, sprite/);
  assert.match(render, /drawCombatActorSprite\(ctx, img/);
  assert.match(render, /\.replaceAll\(/);
});
