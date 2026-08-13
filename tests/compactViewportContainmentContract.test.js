const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

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

test('compact portrait viewport reserves a right-side control rail only when its natural gutter is too small', () => {
  const src = read('web-runner/systems/appShellViewport.js');
  const computeRail = new Function(`${extractExportedFunction(src, 'computeCompactControlRailWidth')}; return computeCompactControlRailWidth;`)();

  assert.equal(computeRail({ viewportWidth: 281, viewportHeight: 472, stageWidth: 265 }), 64);
  assert.equal(computeRail({ viewportWidth: 373, viewportHeight: 387, stageWidth: 217 }), 0);
  assert.equal(computeRail({ viewportWidth: 1024, viewportHeight: 768, stageWidth: 432 }), 0);
});

test('viewport runtime applies the rail to both stage sizing and app-shell layout metrics', () => {
  const src = read('web-runner/systems/appShellViewport.js');
  assert.match(src, /viewportWidth: viewport\.width - controlRailWidth/);
  assert.match(src, /appShell\.style\.paddingInlineEnd = controlRailWidth > 0/);
  assert.match(src, /controlRailWidth,/);
});

test('fallback text scales or elides against the measured logical Canvas width', () => {
  const src = read('web-runner/systems/renderHarnessFallback.js');
  const computeFont = new Function(`${extractExportedFunction(src, 'computeFittedCanvasFontSize')}; return computeFittedCanvasFontSize;`)();
  const fitText = new Function(`${extractExportedFunction(src, 'fitCanvasText')}; return fitCanvasText;`)();

  assert.equal(computeFont({ preferredPx: 18, minimumPx: 11, measuredWidth: 270, maximumWidth: 201 }), 13.4);
  assert.equal(computeFont({ preferredPx: 18, minimumPx: 11, measuredWidth: 180, maximumWidth: 201 }), 18);
  assert.equal(fitText({ measureText: value => ({ width: value.length * 6 }) }, 'ABCDEFGHIJ', 36), 'ABCDE…');
  assert.match(src, /maximumWidth: Math\.max\(1, viewWidth - 16\)/);
});
