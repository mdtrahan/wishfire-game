const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const MIRRORS = [
  path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'),
  path.join(__dirname, '..', 'Scripts', 'functionBank.js'),
];

for (const filePath of MIRRORS) {
  test(`heal combat text ends with exclamation punctuation in ${path.relative(process.cwd(), filePath)}`, () => {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.match(src, /critically healed for \$\{heal\}!/);
    assert.match(src, /healed for \$\{heal\}!/);
    assert.match(src, /critically heals her allies!/);
    assert.match(src, /heals her allies!/);
    assert.match(src, /critically heals \$\{target\.name \|\| 'ally'\} for \$\{heal\}!/);
    assert.match(src, /heals \$\{target\.name \|\| 'ally'\} for \$\{heal\}!/);
    assert.match(src, /used Wipe and healed allies for \$\{totalHeal\}!/);
  });
}
