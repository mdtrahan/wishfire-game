const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('render runtime generated body compiles as JavaScript', () => {
  const source = fs.readFileSync('web-runner/systems/renderRuntime.js', 'utf8');
  const declaration = source.slice(source.indexOf('const body ='), source.indexOf('let renderImpl;'));
  const body = vm.runInNewContext(declaration + '\nbody');
  assert.doesNotThrow(() => new Function('scope', 'dtOverride', body));
});
