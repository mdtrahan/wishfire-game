const test = require('node:test');
const assert = require('node:assert/strict');

async function loadRender() {
  return import('../web-runner/src/core/superGemRender.mjs');
}

async function loadBoardState() {
  return import('../web-runner/src/core/superGemBoardState.mjs');
}

test('super gem render bounds fall back to plain board geometry objects', async () => {
  const mod = await loadRender();
  const bounds = mod.getCellWorldBounds({
    gx: 32,
    gy: 365,
    cellSize: 45,
    gap: 2,
  }, 2, 1);
  assert.deepEqual(bounds, {
    x: 126,
    y: 412,
    w: 45,
    h: 45,
  });
});

test('super gem render image lookup tolerates missing frame arrays', async () => {
  const mod = await loadRender();
  const image = mod.getSuperGemRenderImage({
    superGem: { type: 'uniform', baseColor: 1 },
    gemFrameImages: undefined,
    superGemFrameImages: undefined,
    superGemRainbowImage: null,
  });
  assert.equal(image, null);
});

test('super gem render image does not fall back to the base gem image when super art is unavailable', async () => {
  const mod = await loadRender();
  const fallback = { name: 'base-red' };
  const image = mod.getSuperGemRenderImage({
    superGem: { type: 'uniform', baseColor: 1 },
    gemFrameImages: [null, fallback],
    superGemFrameImages: undefined,
    superGemRainbowImage: null,
  });
  assert.equal(image, null);
});

test('rainbow render image prefers explicit rainbow art before indexed fallback', async () => {
  const mod = await loadRender();
  const rainbow = { name: 'rainbow' };
  const fallback = { name: 'fallback' };
  const image = mod.getSuperGemRenderImage({
    superGem: { type: 'rainbow', baseColor: 2 },
    gemFrameImages: [],
    superGemFrameImages: [null, null, fallback],
    superGemRainbowImage: rainbow,
  });
  assert.equal(image, rainbow);
});

test('super gem render rect spans the live 2x2 gem footprint and stays centered on source gems', async () => {
  const mod = await loadRender();
  const rect = mod.getSuperGemRenderRect({
    superGem: {
      cells: [
        { r: 1, c: 2 },
        { r: 1, c: 3 },
        { r: 2, c: 2 },
        { r: 2, c: 3 },
      ],
    },
    gems: [
      { cellR: 1, cellC: 2, x: 148.5, y: 435.5, width: 45, height: 45 },
      { cellR: 1, cellC: 3, x: 195.5, y: 435.5, width: 45, height: 45 },
      { cellR: 2, cellC: 2, x: 148.5, y: 482.5, width: 45, height: 45 },
      { cellR: 2, cellC: 3, x: 195.5, y: 482.5, width: 45, height: 45 },
    ],
    boardGeometry: {
      gx: 32,
      gy: 365,
      cellSize: 45,
      gap: 2,
    },
    layoutScale: 1,
    worldToCanvas: (x, y) => ({ x, y }),
  });
  assert.deepEqual(rect, {
    x: 126,
    y: 413,
    w: 92,
    h: 92,
  });
});

test('super gem surface hit-testing accepts clicks anywhere inside the transformed 2x2 footprint', async () => {
  const mod = await loadBoardState();
  const gameState = {
    gems: [
      { cellR: 1, cellC: 2, x: 148.5, y: 435.5, width: 45, height: 45 },
      { cellR: 1, cellC: 3, x: 195.5, y: 435.5, width: 45, height: 45 },
      { cellR: 2, cellC: 2, x: 148.5, y: 482.5, width: 45, height: 45 },
      { cellR: 2, cellC: 3, x: 195.5, y: 482.5, width: 45, height: 45 },
    ],
    superGems: [
      {
        id: 'sg-1',
        cells: [
          { r: 1, c: 2 },
          { r: 1, c: 3 },
          { r: 2, c: 2 },
          { r: 2, c: 3 },
        ],
      },
    ],
  };
  const hit = mod.getSuperGemAtCanvasPoint({
    gameState,
    mx: 170,
    my: 460,
    boardGeometry: {
      gx: 32,
      gy: 365,
      cellSize: 45,
      gap: 2,
    },
    layoutScale: 1,
    worldToCanvas: (x, y) => ({ x, y }),
  });
  assert.equal(hit && hit.id, 'sg-1');
});
