const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function extractExportedFunction(src, name) {
  const marker = `export function ${name}(`;
  const start = src.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const paramsStart = src.indexOf('(', start);
  let paramsDepth = 0;
  let paramsEnd = -1;
  for (let index = paramsStart; index < src.length; index += 1) {
    if (src[index] === '(') paramsDepth += 1;
    if (src[index] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) {
        paramsEnd = index;
        break;
      }
    }
  }
  assert.notEqual(paramsEnd, -1, `unterminated params for ${name}`);
  const bodyStart = src.indexOf('{', paramsEnd);
  let depth = 0;
  for (let index = bodyStart; index < src.length; index += 1) {
    if (src[index] === '{') depth += 1;
    if (src[index] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, index + 1).replace('export function', 'function');
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('compact launchers scale with the Canvas and reserve only their scaled rail', () => {
  const src = read('web-runner/systems/appShellViewport.js');
  const computeScale = new Function(`${extractExportedFunction(src, 'computeAppControlScale')}; return computeAppControlScale;`)();
  const computeRail = new Function(`${extractExportedFunction(src, 'computeCompactControlRailWidth')}; return computeCompactControlRailWidth;`)();

  assert.equal(computeScale({ stageWidth: 162, stageHeight: 289, layoutW: 360, layoutH: 640 }), 0.45);
  assert.equal(computeScale({ stageWidth: 432, stageHeight: 768, layoutW: 360, layoutH: 640 }), 1);
  assert.equal(computeRail({ viewportWidth: 281, viewportHeight: 472, stageWidth: 265, controlScale: 0.736 }), 48);
  assert.equal(computeRail({ viewportWidth: 373, viewportHeight: 387, stageWidth: 217, controlScale: 0.603 }), 0);
  assert.equal(computeRail({ viewportWidth: 1024, viewportHeight: 768, stageWidth: 432, controlScale: 1 }), 0);
});

test('viewport runtime applies scaled rail and launcher metrics with the stage resize', () => {
  const src = read('web-runner/systems/appShellViewport.js');
  assert.match(src, /viewportWidth: viewport\.width - controlRailWidth/);
  assert.match(src, /appShell\.style\.paddingInlineEnd = controlRailWidth > 0/);
  assert.match(src, /--orka-control-scale/);
  assert.match(src, /--orka-dev2-top/);
  assert.match(src, /controlRailWidth,/);
  assert.match(src, /controlScale,/);
});

test('both developer launchers consume the shared compact control scale', () => {
  const html = read('web-runner/index.html');
  const devTooling = read('web-runner/systems/devToolingRuntime.js');
  assert.match(html, /transform:scale\(var\(--orka-control-scale,1\)\)/);
  assert.match(html, /top:var\(--orka-dev2-top,30px\)/);
  assert.match(devTooling, /transform:scale\(var\(--orka-control-scale, 1\)\)/);
  assert.match(devTooling, /top:var\(--orka-dev-top, 10px\)/);
  assert.match(html, /padding:4px 6px;[\s\S]*font:700 8px\/1/);
  assert.match(devTooling, /'padding:4px 6px'/);
  assert.match(devTooling, /'font:700 8px\/1/);
  assert.match(html, /\.dev2-panel\{[\s\S]*transform:scale\(var\(--orka-control-scale,1\)\)/);
  assert.match(devTooling, /'transform:scale\(var\(--orka-control-scale, 1\)\)'/);
  assert.match(read('web-runner/systems/appShellViewport.js'), /--orka-dev2-top', `\$\{30 \* controlScale\}px`/);
});

test('developer panels permit vertical scrolling without horizontal overflow', () => {
  const devTooling = read('web-runner/systems/devToolingRuntime.js');
  const turnQa = read('web-runner/systems/combatTurnQaReadout.mjs');
  const html = read('web-runner/index.html');

  assert.match(devTooling, /'overflow:auto'/);
  assert.match(turnQa, /table-layout:fixed/);
  assert.match(turnQa, /overflow-wrap:anywhere/);
  assert.match(turnQa, /word-break:break-word/);
  assert.match(html, /overflow-wrap:anywhere/);
});

test('fallback text scales or elides against the measured logical Canvas width', () => {
  const src = read('web-runner/systems/renderHarnessFallback.js');
  const computeFont = new Function(`${extractExportedFunction(src, 'computeFittedCanvasFontSize')}; return computeFittedCanvasFontSize;`)();
  const fitText = new Function(`${extractExportedFunction(src, 'fitCanvasText')}; return fitCanvasText;`)();

  assert.equal(computeFont({ preferredPx: 18, minimumPx: 11, measuredWidth: 270, maximumWidth: 201 }), 13.4);
  assert.equal(computeFont({ preferredPx: 18, minimumPx: 11, measuredWidth: 180, maximumWidth: 201 }), 18);
  assert.equal(fitText({ measureText: value => ({ width: value.length * 6 }) }, 'ABCDEFGHIJ', 36), 'ABCDE…');
  assert.match(src, /const layoutScale = Math\.max\(0\.1, Number\(dims\.layoutScale\) \|\| 1\);/);
  assert.match(src, /const headlineMaximumWidth = Math\.max\(1, viewWidth - edgePadding \* 2\);/);
  assert.match(src, /preferredPx: scaledPreferredPx,/);
  assert.match(read('web-runner/systems/surfaceRenderRouter.js'), /layoutScale: typeof getLayoutScale === 'function' \? getLayoutScale\(\) : 1/);
});

test('compact fallback copy wraps inside measured Canvas bounds without truncation', () => {
  const src = read('web-runner/systems/renderHarnessFallback.js');
  const fitFn = extractExportedFunction(src, 'fitCanvasText').replace('function fitCanvasText', 'function fitCanvasTextLocal');
  const wrapFn = extractExportedFunction(src, 'wrapCanvasText').replace(/fitCanvasText\(/g, 'fitCanvasTextLocal(');
  const wrapText = new Function(`${fitFn}; ${wrapFn}; return wrapCanvasText;`)();
  const ctx = { measureText: value => ({ width: String(value).length * 4 }) };
  const result = wrapText(ctx, 'Party restored. Tap to continue back into combat.', 146, 3);
  assert.equal(result.truncated, false);
  assert.deepEqual(result.lines, ['Party restored. Tap to continue back', 'into combat.']);
  assert.ok(result.lines.every(line => ctx.measureText(line).width <= 146));
});

test('combat transient controls and damage text share the compact layout scale', async () => {
  const scaleModule = await import(pathToFileURL(path.join(
    __dirname,
    '..',
    'web-runner',
    'systems',
    'combatPresentationScale.mjs',
  )).href);
  const selector = scaleModule.computeScaledCombatControlSize({
    sourceWidth: 25.98198162828327,
    sourceHeight: 13.510630446707303,
    layoutScale: 0.703,
  });
  const attack = scaleModule.computeScaledCombatControlSize({
    sourceWidth: 49.36675579151819,
    sourceHeight: 24.683377895759094,
    layoutScale: 0.703,
  });

  assert.ok(Math.abs(selector.width - 18.265) < 0.001);
  assert.ok(Math.abs(selector.height - 9.498) < 0.001);
  assert.ok(Math.abs(attack.width - 34.705) < 0.001);
  assert.ok(Math.abs(attack.height - 17.353) < 0.001);
  assert.deepEqual(scaleModule.computeScaledCombatControlSize({
    sourceWidth: 50,
    sourceHeight: 25,
    layoutScale: 1.2,
  }), { width: 60, height: 30 });
  assert.equal(scaleModule.computeCombatDamageFontSize({ amount: 20, partyMaxHP: 147, isCrit: false, damageType: 'damage', layoutScale: 0.703 }), 10);
  assert.equal(scaleModule.computeCombatDamageFontSize({ amount: 4, partyMaxHP: 147, isCrit: false, damageType: 'damage', layoutScale: 0.703 }), 8);
});

test('combat renderer and attack hit target consume shared transient sizing', () => {
  const app = read('web-runner/app.js');
  const render = read('web-runner/systems/renderRuntime.js');
  assert.match(app, /computeScaledCombatControlSize\(\{/);
  assert.match(app, /assetsLayout = runtimeLayouts\.assetsLayout \|\| null;\n\s*refreshCombatOverlayAssetSizes\(\);/);
  assert.match(app, /displayFontSize: computeCombatDamageFontSize\(\{/);
  assert.match(app, /function spawnPendingDamageNumbers\(projectToCanvas = null, presentationScale = 1\)/);
  assert.match(render, /spawnPendingDamageNumbers\(projectCombatDamageWorldToCanvas, layoutScale\);/);
  assert.match(render, /deps\.computeCombatDamageFontSize = computeCombatDamageFontSize/);
  assert.match(render, /selectorAsset \? selectorAsset\.width : 26/);
  assert.match(render, /const fontSize = computeCombatDamageFontSize\(\{/);
});
