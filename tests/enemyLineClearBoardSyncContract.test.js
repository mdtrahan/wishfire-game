const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

test('app gem context rebuilds board occupancy when runtime modules replace the gem array', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');

  assert.match(
    src,
    /const fnContext = createContext\(\{\s+getGems: \(\) => \(state\.globals\.Gems \|\| gameState\.gems\),\s+setGems: \(gems\) => \{\s+setGemArray\(gems\);\s+rebuildGridFromGems\(\);/s
  );
});

test('app gem context rebuild exposes empty slots after a line-clear style gem replacement', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const setGemArraySrc = src.match(/function setGemArray\(arr\) \{[\s\S]*?\n\}/);
  const rebuildGridSrc = src.match(/function rebuildGridFromGems\(\) \{[\s\S]*?\n\}/);
  const setGemsBody = src.match(/setGems: \(gems\) => \{([\s\S]*?)\n  \},\n  getSelectedGemIndices:/);

  assert.ok(setGemArraySrc, 'setGemArray source should exist');
  assert.ok(rebuildGridSrc, 'rebuildGridFromGems source should exist');
  assert.ok(setGemsBody, 'fnContext.setGems body should exist');

  const sandbox = {
    state: { globals: {} },
    gameState: { gems: [], grid: [] },
    boardGeometry: { cols: 3, rows: 3 },
    createContext(spec) { return spec; },
  };
  vm.createContext(sandbox);
  vm.runInContext(`${setGemArraySrc[0]}\n${rebuildGridSrc[0]}`, sandbox);
  vm.runInContext(
    `globalThis.fnContext = createContext({
      getGems: () => (state.globals.Gems || gameState.gems),
      setGems: (gems) => {${setGemsBody[1]}
      },
      getSelectedGemIndices: () => [],
      setSelectedGemIndices: () => {},
    });`,
    sandbox
  );

  sandbox.gameState.gems = [
    { uid: 1, cellC: 0, cellR: 0 },
    { uid: 2, cellC: 1, cellR: 0 },
    { uid: 3, cellC: 2, cellR: 0 },
    { uid: 4, cellC: 0, cellR: 1 },
    { uid: 5, cellC: 1, cellR: 1 },
    { uid: 6, cellC: 2, cellR: 1 },
    { uid: 7, cellC: 0, cellR: 2 },
    { uid: 8, cellC: 1, cellR: 2 },
    { uid: 9, cellC: 2, cellR: 2 },
  ];
  sandbox.state.globals.Gems = sandbox.gameState.gems;
  sandbox.rebuildGridFromGems();
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.gameState.grid)), [
    [1, 4, 7],
    [2, 5, 8],
    [3, 6, 9],
  ]);

  sandbox.fnContext.setGems([
    { uid: 1, cellC: 0, cellR: 0 },
    { uid: 3, cellC: 2, cellR: 0 },
    { uid: 4, cellC: 0, cellR: 1 },
    { uid: 6, cellC: 2, cellR: 1 },
    { uid: 7, cellC: 0, cellR: 2 },
    { uid: 9, cellC: 2, cellR: 2 },
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.gameState.grid)), [
    [1, 4, 7],
    [0, 0, 0],
    [3, 6, 9],
  ]);
});
