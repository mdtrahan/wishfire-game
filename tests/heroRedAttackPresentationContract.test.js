const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('retired red-action skill configuration is absent from player hero definitions and runtime presentation', () => {
  const paths = [
    path.join(__dirname, '..', 'web-runner', 'src', 'core', 'heroDefinitions.mjs'),
    path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'),
    path.join(__dirname, '..', 'web-runner', 'modules', 'heroCommands.mjs'),
  ];
  for (const file of paths) {
    const src = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(src, /ConfigureActorRedAttackSkill|INCINERATE/);
  }
});
