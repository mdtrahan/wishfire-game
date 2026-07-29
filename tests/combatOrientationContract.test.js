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

test('right-wise geometry reflects and translates formations as whole blocks', async () => {
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
    const rightHeroYs = right.actors.filter((actor) => actor.kind === 'hero').map((actor) => actor.y);
    const rightEnemyYs = right.actors.filter((actor) => actor.kind === 'enemy').map((actor) => actor.y);
    if (rightHeroYs.length && rightEnemyYs.length) {
      const midpoint = (values) => (Math.min(...values) + Math.max(...values)) / 2;
      assert.equal(midpoint(rightEnemyYs), midpoint(rightHeroYs));
    }
  }
  assert.equal(rules.orientCombatWorldOffsetX(18, 'right-wise'), -18);
  assert.equal(rules.orientCombatWorldOffsetX(18, 'left-wise'), 18);
});

test('runtime-shaped formation anchors preserve hero Y and align the enemy block midpoint', async () => {
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
  assert.deepEqual(anchors.enemyYs, [60.791, 115.791, 170.791]);
  assert.ok(Math.abs(projection.enemyTranslateY - 5.515) < 0.001);
  assert.equal(projection.project(68, anchors.heroYs[0], 'hero').y, anchors.heroYs[0]);
  const shiftedEnemyYs = anchors.enemyYs.map((y) => projection.project(290, y, 'enemy').y);
  assert.equal(shiftedEnemyYs[1] - shiftedEnemyYs[0], anchors.enemyYs[1] - anchors.enemyYs[0]);
  assert.equal(shiftedEnemyYs[2] - shiftedEnemyYs[1], anchors.enemyYs[2] - anchors.enemyYs[1]);
  assert.ok(Math.abs(projection.heroMidY - (projection.enemyMidY + projection.enemyTranslateY)) < 1e-9);
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
    assert.deepEqual(snapshot.anchors.enemyYs, [60.791, 115.791, 170.791]);
    assert.ok(Math.abs(snapshot.projection.enemyTranslateY - 5.515) < 0.001);
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
  assert.match(app, /createCombatFormationProjection/);
  assert.match(app, /deriveCombatFormationAnchors/);
  assert.match(app, /const pos = combatActorWorldToCanvas\(x, y, 'enemy'\)/);
  assert.match(app, /worldToCanvas: \(x, y\) => combatActorWorldToCanvas\(x, y, 'enemy'\)/);
  assert.match(app, /orientCombatWorldOffsetX\(Number\(d\.floatVectorX/);

  assert.match(render, /spawnPendingDamageNumbers\(projectCombatDamageWorldToCanvas\)/);
  assert.match(render, /projectCombatActorWorldToCanvas\(xWorld, yWorld, 'hero'\)/);
  assert.match(render, /projectCombatActorWorldToCanvas\(wardWorldX, wardWorldY, 'hero'\)/);
  assert.match(render, /projectCombatActorWorldToCanvas\(Number\(pulse\.sourceX[^\n]*'hero'/);
  assert.match(render, /projectCombatActorWorldToCanvas\(Number\(pulse\.targetX[^\n]*'enemy'/);
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

  const render = fs.readFileSync(path.join(root, 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  assert.match(render, /drawCombatActorSprite\(ctx, sprite/);
  assert.match(render, /drawCombatActorSprite\(ctx, img/);
  assert.match(render, /\.replaceAll\(/);
});
