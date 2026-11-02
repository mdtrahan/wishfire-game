const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
test('combat renderer omits the retired tracker backdrop', () => {
 const source=fs.readFileSync(path.join(__dirname,'../web-runner/systems/renderRuntime.js'),'utf8');
 assert.doesNotMatch(source,/drawRadiatorPanel\(radiatorPanels\.track\)/);
});
