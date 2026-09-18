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
