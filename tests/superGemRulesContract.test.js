const test = require('node:test');
const assert = require('node:assert/strict');

async function loadRules() {
  return import('../web-runner/src/core/superGemRules.mjs');
}

function makeGem(cellR, cellC, color) {
  return { cellR, cellC, color };
}

test('super gem detection is limited to 2x2 squares', async () => {
  const mod = await loadRules();
  const gems = [];
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      gems.push(makeGem(r, c, 1));
    }
  }
  const grid = mod.buildColorGrid(gems, 4, 4);
  const clusters = mod.detectSuperGemClusters(grid, 4, 4);
  assert.equal(clusters.length, 4);
  for (const cluster of clusters) {
    assert.equal(cluster.size, 2);
    assert.equal(cluster.area, 4);
  }
});

test('3x3 same-color square does not become a super gem', async () => {
  const mod = await loadRules();
  const gems = [];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      gems.push(makeGem(r, c, 1));
    }
  }
  const grid = mod.buildColorGrid(gems, 3, 3);
  const clusters = mod.detectSuperGemClusters(grid, 3, 3);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].size, 2);
  assert.equal(clusters[0].area, 4);
});

test('red blue yellow and purple 2x2 squares become super gems', async () => {
  const mod = await loadRules();
  const allowedColors = [1, 2, 3, 5];
  for (const color of allowedColors) {
    const gems = [
      makeGem(0, 0, color),
      makeGem(0, 1, color),
      makeGem(1, 0, color),
      makeGem(1, 1, color),
    ];
    const grid = mod.buildColorGrid(gems, 2, 2);
    const clusters = mod.detectSuperGemClusters(grid, 2, 2);
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].type, 'uniform');
    assert.equal(clusters[0].baseColor, color);
  }
});

test('retired green 2x2 squares do not become super gems', async () => {
  const mod = await loadRules();
  for (const retiredColor of [0, 4]) {
    const gems = [
      makeGem(0, 0, retiredColor),
      makeGem(0, 1, retiredColor),
      makeGem(1, 0, retiredColor),
      makeGem(1, 1, retiredColor),
    ];
    const grid = mod.buildColorGrid(gems, 2, 2);
    const clusters = mod.detectSuperGemClusters(grid, 2, 2);
    assert.equal(clusters.length, 0, `color ${retiredColor} should be retired`);
  }
});

test('non-super colors do not form super gems', async () => {
  const mod = await loadRules();
  const gems = [
    makeGem(0, 0, 99),
    makeGem(0, 1, 99),
    makeGem(1, 0, 99),
    makeGem(1, 1, 99),
  ];
  const grid = mod.buildColorGrid(gems, 2, 2);
  const clusters = mod.detectSuperGemClusters(grid, 2, 2);
  assert.equal(clusters.length, 0);
});

test('uniform 2x2 square still becomes a super gem', async () => {
  const mod = await loadRules();
  const gems = [
    makeGem(0, 0, 1),
    makeGem(0, 1, 1),
    makeGem(1, 0, 1),
    makeGem(1, 1, 1),
  ];
  const grid = mod.buildColorGrid(gems, 2, 2);
  const clusters = mod.detectSuperGemClusters(grid, 2, 2);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].size, 2);
  assert.equal(clusters[0].type, 'uniform');
  assert.equal(clusters[0].baseColor, 1);
});

test('rainbow 2x2 is intentionally disabled for now', async () => {
  const mod = await loadRules();
  const gems = [
    makeGem(0, 0, 0),
    makeGem(0, 1, 1),
    makeGem(1, 0, 2),
    makeGem(1, 1, 3),
  ];
  const grid = mod.buildColorGrid(gems, 2, 2);
  const clusters = mod.detectSuperGemClusters(grid, 2, 2);
  assert.equal(clusters.length, 0);
});

test('uniform decomposition preserves original color family', async () => {
  const mod = await loadRules();
  const sg = {
    type: 'uniform',
    baseColor: 1,
    cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
  };
  const out = mod.decomposeSuperGem(sg, sg.cells);
  assert.deepEqual(out.map((x) => x.color), [1, 1]);
});
