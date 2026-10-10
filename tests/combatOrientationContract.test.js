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

test('combat camera presents three screens of world at half battlefield zoom and centers fresh play in B', async () => {
  const rules = await loadRules();
  const bounds = rules.deriveCombatWorldBounds(360, 0.5);
  assert.equal(bounds.visibleWorldWidth, 720);
  assert.equal(bounds.worldWidth, 2160);
  const first = rules.createCombatCameraProjection({ viewportWidth: 360, worldWidth: bounds.worldWidth, zoom: 0.5, centerX: 0 });
  assert.equal(first.cameraX, 0);
  assert.equal(first.project(0, 272.5).x, 0);
  const start = rules.deriveCombatWorldStartFormation(4);
  assert.equal(start.centerX, 1080);
  assert.deepEqual(start.heroX, [1106.4, 1053.6, 1106.4, 1053.6]);
  const middle = rules.createCombatCameraProjection({ viewportWidth: 360, worldWidth: bounds.worldWidth, zoom: 0.5, centerX: start.centerX });
  assert.equal(middle.cameraX, 720);
  assert.equal(middle.project(start.centerX, 272.5).x, 180);
  assert.equal(middle.project(720, 272.5).x, 0);
  assert.equal(middle.project(1440, 272.5).x, 360);
  assert.equal(middle.project(1440, 372.5).y, 322.5);
  const last = rules.createCombatCameraProjection({ viewportWidth: 360, worldWidth: bounds.worldWidth, zoom: 0.5, centerX: bounds.worldWidth });
  assert.equal(last.cameraX, 1440);
  assert.equal(last.project(bounds.worldWidth, 272.5).x, 360);
});

test('world-height bounds invert the half-scale camera only inside measured HUD-safe field', async () => {
  const rules = await import('../src/core/combatOrientation.mjs');
  const bounds = rules.deriveCombatWorldVerticalBounds();
  assert.ok(Math.abs(bounds.minY - (-40.5)) < 1e-9);
  assert.ok(Math.abs(bounds.maxY - 679.5) < 1e-9);
  const projectY = worldY => 272.5 + (worldY - 272.5) * 0.5;
  assert.equal(projectY(bounds.minY - 42), 95);
  assert.equal(projectY(bounds.maxY + 4), 478);
});

test('enemy health bars follow puppet feet and fallback sprite bounds', () => {
  const renderer = fs.readFileSync(path.join(root, 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  assert.match(renderer, /const enemyFootY = puppet \? Number\(pos\.y\) : Number\(drawY \+ enemyH\)/);
  assert.match(renderer, /const barY = Math\.round\(enemyFootY \+ \(4 \* layoutScale\)\)/);
  assert.match(renderer, /const drawY = pos\.y - \(enemy\.combatRank === 'boss' \? enemyH : enemyH \/ 2\)/);
});

test('right-wise camera keeps hero footprints inside both world edges', async () => {
  const rules = await loadRules();
  const arenaRules = await import(pathToFileURL(path.join(root, 'src', 'core', 'arenaCombatRules.mjs')).href);
  const bounds = rules.deriveCombatWorldBounds(360, 0.5);
  const heroRadiusPx = arenaRules.actorFootprintRadius({ kind: 'hero' }) * 0.5;
  const camera = (orientation, centerX) => rules.createCombatCameraProjection({
    viewportWidth: 360,
    worldWidth: bounds.worldWidth,
    zoom: 0.5,
    centerX,
    orientation,
  });
  const leftWiseNear = camera('left-wise', bounds.heroMinX).project(bounds.heroMinX, 272.5).x;
  const rightWiseFar = camera('right-wise', bounds.heroMaxX).project(bounds.heroMaxX, 272.5).x;
  const leftWiseFar = camera('left-wise', bounds.heroMaxX).project(bounds.heroMaxX, 272.5).x;
  const rightWiseNear = camera('right-wise', bounds.heroMinX).project(bounds.heroMinX, 272.5).x;

  assert.equal(leftWiseNear, bounds.heroMinX * bounds.zoom);
  assert.equal(rightWiseFar, leftWiseNear);
  assert.equal(leftWiseFar, 360 - leftWiseNear);
  assert.equal(rightWiseNear, leftWiseFar);
  for (const x of [leftWiseNear, rightWiseFar]) assert.ok(x >= heroRadiusPx);
  for (const x of [leftWiseFar, rightWiseNear]) assert.ok(x + heroRadiusPx <= 360);
});

test('three-screen world grid keeps numbered major lines inside the camera view while it pans', async () => {
  const rules = await loadRules();
  const grid = rules.deriveCombatReferenceGrid(2160, 640);
  assert.equal(grid.centerX, 1080);
  assert.equal(grid.vertical.at(-1).value, 2160);
  const camera = rules.createCombatCameraProjection({ viewportWidth: 360, worldWidth: 2160, zoom: 0.5, centerX: 1000 });
  const visibleMajorLabels = grid.vertical.filter(line => line.major)
    .map(line => ({ value: line.value, x: camera.project(line.value, 0).x }))
    .filter(line => line.x >= 0 && line.x <= 360);
  assert.ok(visibleMajorLabels.length > 0);
  assert.ok(visibleMajorLabels.some(line => line.value > 350));
  const renderer = fs.readFileSync(path.join(root, 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  assert.match(renderer, /grid\.vertical\.filter\(line => line\.major && line\.value < combatWorldBounds\.worldWidth\)/);
  assert.match(renderer, /const point = vertical \? projectCombatActorWorldToCanvas\(line\.value, 0\)/);
});

test('right-wise geometry reflects X while preserving shared Y homes', async () => {
  const rules = await loadRules();
  const layoutW = 960;
  const actorSets = [
    [
      { uid: 1, kind: 'hero', slot: 0, x: 170, y: 220 },
      { uid: 101, kind: 'enemy', slot: 0, x: 740, y: 200 },
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
    assert.equal(left.translateX, 0);
    assert.equal(right.translateX, rules.RIGHT_WISE_FORMATION_TRANSLATE_X);
    assert.equal(left.actors.length, right.actors.length);
    for (let i = 0; i < actors.length; i += 1) {
      assert.equal(
        left.actors[i].x + right.actors[i].x,
        layoutW + rules.RIGHT_WISE_FORMATION_TRANSLATE_X,
      );
      assert.equal(left.actors[i].uid, right.actors[i].uid);
      assert.equal(left.actors[i].kind, right.actors[i].kind);
      assert.equal(left.actors[i].slot, right.actors[i].slot);
      if (left.actors[i].kind === 'enemy') {
        assert.equal(right.actors[i].y, left.actors[i].y + right.enemyTranslateY);
      } else {
        assert.equal(left.actors[i].y, right.actors[i].y);
      }
    }
    assert.equal(right.enemyTranslateY, 0);
  }
  assert.equal(rules.orientCombatWorldOffsetX(18, 'right-wise'), -18);
  assert.equal(rules.orientCombatWorldOffsetX(18, 'left-wise'), 18);
});

test('runtime-shaped hero anchors reserve a status-icon row above HP bars', async () => {
  const rules = await loadRules();
  const globals = {
    EnemyAreaRect: { minY: 38.638, maxY: 203.974 },
    EnemySize: 40,
    enemyGAP: 8,
    Spacing: 55,
    EnemyAreaY0: 60.791,
    Slots: 3,
  };
  const entities = [
    { kind: 'enemy', slotIndex: 0, originY: 60.791 },
    { kind: 'enemy', slotIndex: 1, originY: null, y: 115.791 },
    { kind: 'enemy', slotIndex: 2, originY: 170.791 },
  ];
  const anchors = rules.deriveCombatFormationAnchors({ globals, entities, heroCount: 4 });
  const projection = rules.createCombatFormationProjection({
    orientation: 'right-wise',
    layoutW: 360,
    ...anchors,
  });

  assert.equal(anchors.heroYs.length, 4);
  assert.deepEqual(rules.deriveCombatArenaBounds(360), {
    heroBackCenterX: 40,
    heroRightEdgeX: 106,
    meleeLeftEdgeX: 130,
    rangedMinX: 225,
    rangedMaxX: 283,
    attackStartX: 290,
    visibleTopY: 170,
    visibleBottomY: 375,
  });
  assert.deepEqual(anchors.enemyYs, [190, 272.5, 355]);
  assert.equal(anchors.arenaBounds.visibleTopY - 10, 160);
  const heroHalfHeight = anchors.heroH * 1.55 / 2;
  const heroTop = anchors.heroYs[0] - heroHalfHeight;
  const heroBottom = anchors.heroYs.at(-1) + heroHalfHeight;
  const heroBarTop = heroTop - 10;
  const buffRowBottom = heroBarTop - rules.HERO_BUFF_ICON_ROW_GAP;
  const buffRowTop = buffRowBottom - rules.HERO_BUFF_ICON_ROW_HEIGHT;
  const buffRowReserve = rules.HERO_BUFF_ICON_ROW_HEIGHT + rules.HERO_BUFF_ICON_ROW_GAP;
  assert.equal(heroTop, anchors.arenaBounds.visibleTopY + buffRowReserve);
  assert.equal(heroBarTop, 180);
  assert.equal(buffRowTop, 160);
  assert.equal(buffRowBottom, 178);
  assert.equal(heroBottom, anchors.arenaBounds.visibleBottomY + buffRowReserve);
  assert.ok(heroBottom <= 420);
  assert.equal(anchors.enemyYs[0] - globals.EnemySize / 2, anchors.arenaBounds.visibleTopY);
  assert.equal(anchors.enemyYs.at(-1) + globals.EnemySize / 2, anchors.arenaBounds.visibleBottomY);
  assert.equal(projection.enemyTranslateY, 0);
  assert.equal(projection.project(68, anchors.heroYs[0], 'hero').y, anchors.heroYs[0]);
  const shiftedEnemyYs = anchors.enemyYs.map((y) => projection.project(290, y, 'enemy').y);
  assert.equal(shiftedEnemyYs[1] - shiftedEnemyYs[0], anchors.enemyYs[1] - anchors.enemyYs[0]);
  assert.equal(shiftedEnemyYs[2] - shiftedEnemyYs[1], anchors.enemyYs[2] - anchors.enemyYs[1]);
  assert.equal(shiftedEnemyYs[1], anchors.enemyYs[1]);
  const renderer = fs.readFileSync(path.join(root, 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  assert.match(renderer, /const footY = pos\.y \+ h \* 1\.55 \* COMBAT_BATTLEFIELD_ZOOM \/ 2/);
  assert.match(renderer, /restFeetByUID\[hero\.uid\] = \{ x: baseX, y: yWorld \+ hWorld \* 1\.55 \/ 2 \}/);
  assert.match(renderer, /const cameraCenterX = bossPresentationActive \? Number\(state\.globals\.ContinuousCombatStage\?\.bossCameraCenterX \?\? squadCenterX\) : squadCenterX/);
  assert.match(renderer, /createCombatCameraProjection\(\{ viewportWidth: layoutW, worldWidth: combatWorldBounds\.worldWidth, zoom: COMBAT_BATTLEFIELD_ZOOM, centerX: cameraCenterX, orientation: activeCombatOrientation \}\)/);
});

test('combat reference grid covers the logical canvas in ten-pixel increments', async () => {
  const rules = await loadRules();
  const grid = rules.deriveCombatReferenceGrid(360, 640);
  assert.equal(grid.vertical.length, 37);
  assert.equal(grid.horizontal.length, 65);
  assert.equal(grid.centerX, 180);
  assert.deepEqual(grid.vertical.filter(line => line.major).map(line => line.value), [0, 50, 100, 150, 200, 250, 300, 350]);
  assert.equal(grid.vertical.at(-1).value, 360);
  assert.equal(grid.horizontal.at(-1).value, 640);
});

test('enemy death and refill never change surviving right-wise slot projections', async () => {
  const rules = await loadRules();
  const globals = {
    EnemyAreaRect: { minY: 38.638, maxY: 203.974 },
    EnemySize: 40,
    enemyGAP: 8,
    Spacing: 55,
    EnemyAreaY0: 60.791,
    Slots: 3,
    EnemySlots: [7, 8, 9],
  };
  const fullRoster = [
    { uid: 6, kind: 'enemy', slotIndex: 0, originX: 273, originY: 60.791 },
    { uid: 7, kind: 'enemy', slotIndex: 1, originX: 249, originY: 115.791 },
    { uid: 8, kind: 'enemy', slotIndex: 2, originX: 273, originY: 170.791 },
  ];
  const afterTopDeath = fullRoster.slice(1);
  const afterBottomDeath = fullRoster.slice(0, 2);
  const replacementRoster = [
    { uid: 9, kind: 'enemy', slotIndex: 0, originX: 273, originY: 60.791 },
    ...afterTopDeath,
  ];
  const snapshots = [fullRoster, afterTopDeath, afterBottomDeath, replacementRoster].map((entities) => {
    const anchors = rules.deriveCombatFormationAnchors({ globals, entities, heroCount: 4 });
    const projection = rules.createCombatFormationProjection({
      orientation: 'right-wise',
      layoutW: 360,
      ...anchors,
    });
    return {
      anchors,
      projection,
      positions: new Map(entities.map((enemy) => [
        enemy.uid,
        projection.project(enemy.originX, enemy.originY, 'enemy'),
      ])),
    };
  });

  for (const snapshot of snapshots) {
    assert.deepEqual(snapshot.anchors.enemyYs, [190, 272.5, 355]);
    assert.equal(snapshot.projection.enemyTranslateY, 0);
  }
  assert.deepEqual(snapshots[1].positions.get(7), snapshots[0].positions.get(7));
  assert.deepEqual(snapshots[1].positions.get(8), snapshots[0].positions.get(8));
  assert.deepEqual(snapshots[2].positions.get(6), snapshots[0].positions.get(6));
  assert.deepEqual(snapshots[2].positions.get(7), snapshots[0].positions.get(7));
  assert.deepEqual(snapshots[3].positions.get(9), snapshots[0].positions.get(6));

  const survivorGeometry = rules.createCombatOrientationGeometry({
    orientation: 'right-wise',
    layoutW: 360,
    actors: afterTopDeath.map((enemy) => ({
      uid: enemy.uid,
      kind: enemy.kind,
      slot: enemy.slotIndex,
      canonicalX: enemy.originX,
      y: enemy.originY,
    })),
    ...snapshots[1].anchors,
  });
  assert.equal(survivorGeometry.actors.find((actor) => actor.uid === 7).y, snapshots[0].positions.get(7).y);
  assert.equal(survivorGeometry.actors.find((actor) => actor.uid === 8).y, snapshots[0].positions.get(8).y);
});

test('runtime projects actor visuals, hit regions, and action anchors without mutating combat state', () => {
  const app = fs.readFileSync(path.join(root, 'web-runner', 'app.js'), 'utf8');
  const render = fs.readFileSync(path.join(root, 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  const hooks = fs.readFileSync(path.join(root, 'web-runner', 'systems', 'devBrowserTestHooks.js'), 'utf8');

  assert.match(app, /CombatOrientation = readCombatOrientationFromSearch\(window\.location\.search\)/);
  assert.match(app, /function combatActorWorldToCanvas/);
  assert.match(app, /createCombatCameraProjection/);
  assert.match(app, /deriveCombatWorldBounds/);
  assert.match(app, /const pos = combatActorWorldToCanvas\(x, y, 'enemy'\)/);
  assert.doesNotMatch(app, /prepareAstralFlowKoOrbPresentation/);
  assert.match(app, /orientCombatWorldOffsetX\(Number\(d\.floatVectorX/);

  assert.match(render, /spawnPendingDamageNumbers\(projectCombatDamageWorldToCanvas, layoutScale\)/);
  assert.match(render, /projectCombatActorWorldToCanvas\(xWorld, yWorld, 'hero'\)/);
  assert.match(render, /projectCombatActorWorldToCanvas\(Number\(anchor\.x \|\| 0\) \+ offsetX, Number\(anchor\.y \|\| 0\), 'hero'\)/);
  assert.match(render, /projectCombatActorWorldToCanvas\(Number\(footAnchor\.x \|\| 0\) \+ offsetX, Number\(footAnchor\.y \|\| 0\), 'hero'\)/);
  assert.match(render, /projectCombatActorWorldToCanvas\(wardWorldX, wardWorldY, 'hero'\)/);
  assert.match(render, /projectCombatActorWorldToCanvas\(Number\(pulse\.sourceX[^\n]*'hero'/);
  assert.match(render, /projectCombatActorWorldToCanvas\(Number\(pulse\.targetX[^\n]*'enemy'/);
  assert.match(render, /targetActor\.footX \?\? targetActor\.x \?\? targetActor\.originX/);
  assert.match(render, /targetActor\.footY \?\? targetActor\.y \?\? targetActor\.originY/);
  assert.match(render, /projectCombatActorWorldToCanvas\(Number\(targetFeet\.x[^\n]*targetActor\?\.kind/);
  assert.match(render, /viewportLeft: layoutOffsetX, viewportRight: layoutOffsetX \+ layoutW \* layoutScale/);
  assert.match(render, /projectCombatActorWorldToCanvas\(x, y, 'enemy'\)/);
  assert.match(render, /CombatOrientationGeometry = createCombatOrientationGeometry\([^\n]*\.\.\.combatFormationAnchors/);
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

  assert.equal(presentation.shouldMirrorCombatActorSprite('left-wise', 'left', 'right'), true, 'fallback turns a right-facing hero toward a leftward world target');
  assert.equal(presentation.shouldMirrorCombatActorSprite('right-wise', 'left', 'right'), false, 'camera reflection already turns leftward world travel to screen right');
  assert.equal(presentation.shouldMirrorCombatActorSprite('right-wise', 'right', 'right'), true, 'right-wise projection reverses a right-facing hero');
  assert.equal(presentation.shouldMirrorCombatActorSprite('left-wise', 'left', 'left'), false, 'left-facing enemy art keeps native facing');
  assert.equal(presentation.shouldMirrorCombatActorSprite('right-wise', 'left', 'left'), true, 'right-wise projection mirrors native left-facing enemy art');
  assert.equal(presentation.shouldMirrorCombatActorSprite('right-wise', 'right', 'left'), false, 'right-wise projection presents rightward-facing enemy art without another flip');

  const render = fs.readFileSync(path.join(root, 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  assert.match(render, /drawCombatActorSprite\(ctx, sprite/);
  assert.match(render, /drawCombatActorSprite\(ctx, img/);
  assert.match(render, /facing: hero\.facing, nativeFacing: 'right'/);
  assert.match(render, /facing: enemy\.facing, nativeFacing: 'left'/);
  assert.match(render, /\.replaceAll\(/);
});
