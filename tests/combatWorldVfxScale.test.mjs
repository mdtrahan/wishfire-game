import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function assembledCombatRenderBody() {
  const source = fs.readFileSync(new URL('../web-runner/systems/renderRuntime.js', import.meta.url), 'utf8');
  const bodyStart = source.indexOf('const body = ') + 'const body = '.length;
  const bodyEnd = source.indexOf(';\n    const effectiveBody = assembleCombatRenderBody(body);', bodyStart);
  assert.ok(bodyStart >= 0 && bodyEnd > bodyStart);
  const body = vm.runInNewContext(source.slice(bodyStart, bodyEnd));
  const helperStart = source.indexOf('export function assembleCombatRenderBody(body) {');
  const helperEnd = source.indexOf('\n}\n\nlet renderImpl', helperStart) + 2;
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helper = source.slice(helperStart, helperEnd).replace('export function', 'function');
  return new Function(`${helper}; return assembleCombatRenderBody;`)()(body);
}

function extractFunction(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing ${marker}`);
  const open = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index], next = source[index + 1];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '/' && next === '/') { index = source.indexOf('\n', index); if (index < 0) break; continue; }
    if (char === '/' && next === '*') { const end = source.indexOf('*/', index + 2); if (end < 0) break; index = end + 1; continue; }
    if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`unterminated ${marker}`);
}
