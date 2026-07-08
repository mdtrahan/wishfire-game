const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
}

function readPngRgba(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === 'IHDR') {
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
      bitDepth = bytes.readUInt8(dataStart + 8);
      colorType = bytes.readUInt8(dataStart + 9);
    } else if (type === 'IDAT') {
      idat.push(bytes.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  assert.equal(bitDepth, 8);
  assert.equal(colorType, 6);

  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const bytesPerPixel = 4;
  const rgba = Buffer.alloc(width * height * 4);
  let src = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src];
    src += 1;
    const rowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[src + x];
      const left = x >= bytesPerPixel ? rgba[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? rgba[rowStart + x - stride] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? rgba[rowStart + x - stride - bytesPerPixel] : 0;
      let value = raw;
      if (filter === 0) {
        value = raw;
      } else if (filter === 1) {
        value = raw + left;
      } else if (filter === 2) {
        value = raw + up;
      } else if (filter === 3) {
        value = raw + Math.floor((left + up) / 2);
      } else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = raw + (pa <= pb && pa <= pc ? left : (pb <= pc ? up : upLeft));
      } else {
        assert.fail(`unsupported PNG filter ${filter}`);
      }
      rgba[rowStart + x] = value & 0xff;
    }
    src += stride;
  }

  return { width, height, rgba };
}

function pixel(image, x, y) {
  const offset = ((y * image.width) + x) * 4;
  return {
    r: image.rgba[offset],
    g: image.rgba[offset + 1],
    b: image.rgba[offset + 2],
    a: image.rgba[offset + 3],
  };
}

function luminance({ r, g, b }) {
  return (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
}

test('world map warp portal asset is a 46x52 light-burst transparent PNG', () => {
  const imagePath = path.join(
    repoRoot,
    'web-runner',
    'assets',
    'images',
    'map_warp_portal_46x52.png',
  );
  const image = readPngRgba(imagePath);

  assert.equal(image.width, 46);
  assert.equal(image.height, 52);
  assert.equal(pixel(image, 0, 0).a, 0);
  assert.equal(pixel(image, 45, 0).a, 0);
  assert.equal(pixel(image, 0, 51).a, 0);
  assert.equal(pixel(image, 45, 51).a, 0);

  const center = pixel(image, 23, 26);
  assert.ok(center.a >= 245, 'portal center must be opaque light, not a transparent void');
  assert.ok(luminance(center) >= 220, 'portal center must read as a bright light burst');

  for (let y = 22; y <= 30; y += 1) {
    for (let x = 19; x <= 27; x += 1) {
      const sample = pixel(image, x, y);
      if (sample.a >= 220) {
        assert.ok(luminance(sample) >= 135, `portal center must not contain dark opaque pixels at ${x},${y}`);
      }
    }
  }
});

test('world map warp portal instances resolve requested grid coordinates', async () => {
  const portals = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'worldMapPortalInstances.mjs'));
  const coordinates = await import(path.join(repoRoot, 'src', 'core', 'worldMapCoordinates.mjs'));

  assert.equal(portals.WORLD_MAP_PORTAL_IMAGE_WIDTH, 46);
  assert.equal(portals.WORLD_MAP_PORTAL_IMAGE_HEIGHT, 52);
  assert.equal(portals.WORLD_MAP_PORTAL_GLOW.periodSec, 3.6);
  assert.equal(portals.WORLD_MAP_PORTAL_GLOW.alphaMin, 0.30);
  assert.equal(portals.WORLD_MAP_PORTAL_GLOW.alphaMax, 0.58);
  assert.equal(portals.WORLD_MAP_PORTAL_GLOW.burstRadiusMaxScale, 0.72);
  assert.equal(portals.WORLD_MAP_PORTAL_GLOW.rayLengthMaxScale, 1.06);
  assert.equal(portals.WORLD_MAP_PORTAL_GLOW.rays.length, 4);
  assert.equal(portals.WORLD_MAP_PORTAL_GLOW.rays[0].angleDeg, 0);
  assert.equal(portals.WORLD_MAP_PORTAL_GLOW.rays[1].angleDeg, -47);
  assert.equal(portals.WORLD_MAP_PORTAL_GLOW.innerAlphaMax, 0.52);
  assert.equal(portals.WORLD_MAP_PORTAL_SHADOW.blur, 8);
  assert.equal(portals.WORLD_MAP_PORTAL_SHADOW.offsetY, 3);
  assert.equal(portals.WORLD_MAP_PORTAL_SHADOW.floorColor, 'rgba(8, 22, 34, 0.30)');
  assert.equal(portals.WORLD_MAP_PORTAL_SHADOW.floorBlur, 2.4);
  assert.deepEqual(portals.WORLD_MAP_PORTAL_INSTANCES.map((portal) => portal.coordinate), [
    'C11',
    'K05',
  ]);
  assert.deepEqual(portals.WORLD_MAP_PORTAL_INSTANCES.map((portal) => portal.visible), [
    true,
    true,
  ]);
  assert.equal(new Set(portals.WORLD_MAP_PORTAL_INSTANCES.map((portal) => portal.coordinate)).size, 2);
  for (const portal of portals.WORLD_MAP_PORTAL_INSTANCES) {
    assert.ok(coordinates.getWorldMapCellBounds(portal.coordinate), `${portal.coordinate} resolves to a map cell`);
  }
});

test('world map warp portal rendering is owned by map modules', () => {
  const loaderSrc = readRepoFile('web-runner', 'systems', 'runtimeVisualAssetLoader.js');
  const routerSrc = readRepoFile('web-runner', 'systems', 'surfaceRenderRouter.js');
  const renderMapSrc = readRepoFile('web-runner', 'systems', 'renderMap.js');
  const appSrc = readRepoFile('web-runner', 'app.js');

  assert.match(loaderSrc, /mapPortalImage = await loadImage\(assetUrl\('images\/map_warp_portal_46x52\.png'\)\);/);
  assert.match(routerSrc, /getMapPortalImage/);
  assert.match(renderMapSrc, /WORLD_MAP_PORTAL_INSTANCES/);
  assert.match(renderMapSrc, /WORLD_MAP_PORTAL_GLOW/);
  assert.match(renderMapSrc, /Math\.sin\(radians - \(Math\.PI \/ 2\)\)/);
  assert.match(renderMapSrc, /ctx\.globalCompositeOperation = 'lighter';/);
  assert.match(renderMapSrc, /ctx\.createRadialGradient/);
  assert.match(renderMapSrc, /ctx\.createLinearGradient/);
  assert.match(renderMapSrc, /ctx\.moveTo\(startX, startY\);/);
  assert.match(renderMapSrc, /drawWorldMapPortalInnerBurst/);
  assert.doesNotMatch(renderMapSrc, /for \(let i = 0; i < rayCount; i \+= 1\)/);
  assert.doesNotMatch(renderMapSrc, /ringAlpha/);
  assert.match(renderMapSrc, /WORLD_MAP_PORTAL_SHADOW/);
  assert.match(renderMapSrc, /ctx\.shadowColor = shadow\?\.color/);
  assert.match(renderMapSrc, /ctx\.filter = floorBlur > 0 \? `blur\(\$\{floorBlur\}px\)` : 'none';/);
  assert.match(renderMapSrc, /ctx\.ellipse\(/);
  assert.match(renderMapSrc, /drawWorldMapPortals/);
  assert.match(appSrc, /getMapPortalImage: \(\) => mapPortalImage/);
  assert.doesNotMatch(appSrc, /WORLD_MAP_PORTAL_INSTANCES/);
});
