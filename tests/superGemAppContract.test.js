const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('render runtime generated body does not contain raw string newlines', () => {
  const renderRuntimeSrc = fs.readFileSync('web-runner/systems/renderRuntime.js', 'utf8');
  let inString = false;
  let quote = '';
  let escaped = false;
  for (let i = 0; i < renderRuntimeSrc.length; i += 1) {
    const char = renderRuntimeSrc[i];
    if (!inString) {
      if (char === '"' || char === "'") {
        inString = true;
        quote = char;
      }
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === quote) {
      inString = false;
      quote = '';
      continue;
    }
    assert.notEqual(char, '\n', `raw newline inside renderRuntime string near index ${i}`);
  }
});

test('app wires super gem hooks for settle, spend, and decomposition', () => {
  const src = fs.readFileSync('web-runner/app.js', 'utf8');
  const runtimeSrc = fs.readFileSync('web-runner/systems/superGemRuntime.js', 'utf8');
  const renderRuntimeSrc = fs.readFileSync('web-runner/systems/renderRuntime.js', 'utf8');
  const boardStateSrc = fs.readFileSync('web-runner/src/core/superGemBoardState.mjs', 'utf8');
  const renderBoardSrc = fs.readFileSync('web-runner/systems/renderBoard.js', 'utf8');
  assert.match(src, /import\s+\{[\s\S]*getSuperGemAtCanvasPoint[\s\S]*getSuperGemAtCell[\s\S]*spendSuperGem[\s\S]*syncSuperGemShapes[\s\S]*\}\s+from\s+'\.\/src\/core\/superGemBoardState\.mjs';/);
  assert.match(src, /import \* as superGemRuntime from '\.\/systems\/superGemRuntime\.js';/);
  assert.match(src, /superGems:\s*\[\],/);
  assert.match(src, /superGemCellMap:\s*new Map\(\),/);
  assert.doesNotMatch(src, /function settleSuperGemShapes\(reason = 'unknown'\)/);
  assert.doesNotMatch(src, /function resolveSuperGemDecomposition\(reason = 'unknown'\)/);
  assert.doesNotMatch(src, /function spendSuperGem\(superGem, reason = 'tap'\)/);
  assert.match(src, /const tappedSuperGem = getSuperGemAtCanvasPoint\(\{\s*gameState,\s*mx,\s*my,/s);
  assert.match(src, /const tappedSuperGem = getSuperGemAtCell\(gameState, gem\.cellR, gem\.cellC\);/);
  assert.match(src, /if \(tappedSuperGem\) \{\s*spendSuperGem\(\{/s);
  assert.match(src, /resolveSuperGemDecomposition\(\{ gameState, state, reason: 'pre-refill' }\);/);
  assert.match(src, /settleSuperGemShapes\(\{ gameState, state, boardGeometry, reason: 'immediate-fill' }\);/);
  assert.match(src, /settleSuperGemShapes\(\{ gameState, state, boardGeometry, reason: 'refill-gem-board' }\);/);
  assert.match(src, /syncSuperGemShapes\(\{ gameState, state, boardGeometry, reason: 'draw-frame' }\);/);
  assert.match(boardStateSrc, /export function getSuperGemAtCanvasPoint\(/);
  assert.match(boardStateSrc, /export function settleSuperGemShapes\(/);
  assert.match(boardStateSrc, /export function resolveSuperGemDecomposition\(/);
  assert.match(boardStateSrc, /export function spendSuperGem\(/);
  assert.match(boardStateSrc, /const resolvedSuperGemCost = Number\(superGem\?\.baseColor\) === 5 \? 1 : Number\(superGemCost \|\| 0\);/);
  assert.match(boardStateSrc, /const afterEnergy = Math\.max\(0, beforeEnergy - resolvedSuperGemCost\);/);
  assert.match(renderBoardSrc, /import \{ getSuperGemRenderImage, getSuperGemRenderRect \} from '\.\.\/src\/core\/superGemRender\.mjs';/);
  assert.match(renderRuntimeSrc, /renderBoard\.renderBoard\(ctx, gameState, uiState\.getUIState\(\), animationMath, \{\\n      boardGeometry,\\n      worldToCanvas,\\n      layoutScale,\\n      gemFrameImages,\\n      superGemFrameImages,\\n      superGemRainbowImage,\\n      now,/);
  assert.match(runtimeSrc, /const SUPER_GEM_COST = 4;/);
  assert.match(runtimeSrc, /randomIntInclusive\(3, 5, rng\)/);
  assert.match(runtimeSrc, /randomIntInclusive\(4, 6, rng\)/);
  assert.match(runtimeSrc, /randomIntInclusive\(8, 16, rng\)/);
  assert.match(runtimeSrc, /superGemClusterVisualOnly/);
  assert.match(runtimeSrc, /superGemClusterApplyTotalOnHit/);
  assert.match(runtimeSrc, /function queueKojonnTaintedGroundAoe\(/);
  assert.match(runtimeSrc, /export function syncTaintedGroundZones\(/);
  assert.match(src, /superGemRuntime\.syncTaintedGroundZones\(\{/);
  assert.match(src, /function isActiveTaintedGroundZone\(zone\) \{/);
  assert.match(src, /function enemyOccupiesTaintedGroundZone\(enemy, zone\) \{/);
  assert.match(src, /function hasPersistentEnemyTaintedGroundOverlay\(uid\) \{/);
  assert.match(src, /enemyOccupiesTaintedGroundZone\(enemy, zone\)/);
  assert.match(src, /if \(hasPersistentEnemyTaintedGroundOverlay\(uid\)\) return true;/);
  assert.match(src, /function getPersistentTaintedGroundOverlays\(\) \{/);
  assert.match(src, /anchorWorldX: Number\(zone\.anchorWorldX\),/);
  assert.match(src, /anchorWorldY: Number\(zone\.anchorWorldY\),/);
  assert.match(src, /getPersistentTaintedGroundOverlays,\s+hasPersistentEnemyTaintedGroundOverlay,\s+hasPersistentEnemyBlightOverlay,/);
  assert.match(renderRuntimeSrc, /const renderEnemyTaintedGround = \(drawX, drawY, enemyW, enemyH, seed = 0, alphaScale = 1\) => \{/);
  assert.match(renderRuntimeSrc, /const taintedGroundFieldOverlays = typeof getPersistentTaintedGroundOverlays === 'function' \? getPersistentTaintedGroundOverlays\(\) : \[\];/);
  assert.match(renderRuntimeSrc, /const getTaintedGroundOverlayPosition = \(overlay, fallbackEnemy = null\) => \{/);
  assert.match(renderRuntimeSrc, /const enemyStandsInRenderedTaintedGround = \(enemy\) => \{/);
  assert.match(renderRuntimeSrc, /const renderTaintedGroundFieldZones = \(\) => \{/);
  assert.match(renderRuntimeSrc, /const anchoredX = Number\(overlay && overlay\.anchorWorldX\);/);
  assert.match(renderRuntimeSrc, /x: Number\.isFinite\(anchoredX\) \? anchoredX : \(slotEnemy && slotEnemy\.x != null \? slotEnemy\.x : \(g\.X0 \|\| 200\)\),/);
  assert.match(renderRuntimeSrc, /hasPersistentEnemyBlightOverlay\(enemy\.uid\) \|\| enemyStandsInRenderedTaintedGround\(enemy\)/);
  assert.match(renderRuntimeSrc, /renderTaintedGroundFieldZones\(\);[\s\S]*const enemiesToDraw = state\.entities\.filter/);
  assert.doesNotMatch(renderRuntimeSrc, /hasPersistentEnemyTaintedGroundOverlay\(enemy\.uid\)[\s\S]{0,120}renderEnemyTaintedGround\(drawX, drawY, enemyW, enemyH, enemy\.uid\);/);
  assert.match(runtimeSrc, /effectType: 'dot_apply'/);
  assert.match(runtimeSrc, /effectName: 'TaintedGround'/);
  assert.doesNotMatch(runtimeSrc, /effectName: `Blight Wave \$\{wave \+ 1\}`/);
  assert.match(renderRuntimeSrc, /effectName: String\(hit\.effectName \|\| 'Blight'\)/);
  assert.match(renderRuntimeSrc, /taintedGroundZoneId: String\(hit\.taintedGroundZoneId \|\| ''\)/);
  assert.match(runtimeSrc, /export function armPendingSuperGemAttack\(/);
  assert.match(runtimeSrc, /export function executePendingSuperGemAction\(/);
  assert.match(runtimeSrc, /PendingSuperGemAction/);
  assert.match(renderRuntimeSrc, /SpawnDamageText', finalDmg, targetX, targetY, 'damage', targetKind/);
  assert.match(renderRuntimeSrc, /ApplyDamageToTarget', hit\.targetUID, clusterApplyTotal/);
  assert.match(runtimeSrc, /const purpleGemCost = 1;/);
  assert.match(runtimeSrc, /ResolvePurpleSuperGemEnergyAction', actorUID, purpleGemCost/);
  assert.doesNotMatch(runtimeSrc, /ResolveGemAction', 5, actorUID, purpleGemCost/);
  assert.match(src, /import \{ resolvePendingSuperGemHandoff \} from '\.\/src\/core\/pendingSuperGemHandoff\.mjs';/);
  assert.match(src, /function resolvePendingTargetHandoff\(\{ actorUID, source \}\)/);
  assert.match(src, /executePendingSuperGemAction: \(\) => superGemRuntime\.executePendingSuperGemAction\(\{/);
});
