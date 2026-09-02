const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const renderRuntimeSource = fs.readFileSync(
  path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'),
  'utf8',
);

test('combat strips the legacy outlined tracker backdrop from the generated renderer', () => {
  assert.match(
    renderRuntimeSource,
    /\.replace\(\s*"    if \(!movedRadiatorsToSidebar\) \{\\n      drawRadiatorPanel\(radiatorPanels\.track\);\\n    \}\\n",\s*"",\s*\)/,
  );
});
