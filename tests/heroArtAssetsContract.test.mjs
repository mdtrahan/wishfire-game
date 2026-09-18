import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { heroArtAsset, heroArtPath, resolveHeroArtSourceRect } from '../web-runner/state/heroArtAssets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('one canonical hero-art mapping resolves V9 strip, battlefield, and action-card names', () => {
  for (const [name, asset] of Object.entries({ Fara: 'Fara', Hondo: 'Hondo', Runa: 'Runa', Kaja: 'Kaja', Falie: 'Fara', Huun: 'Hondo', Kojonn: 'Kaja' })) {
    assert.equal(heroArtAsset(name)?.key, asset);
    assert.equal(heroArtPath(name), `images/${asset}.png`);
    assert.ok(heroArtAsset(name)?.combat);
    assert.ok(heroArtAsset(name)?.card);
    assert.ok(heroArtAsset(name)?.strip);
  }
});

test('battlefield consumes each complete canonical hero sprite while enemy sprites keep their source intact', () => {
  const source = read('web-runner/systems/renderRuntime.js');
  const bodyStart = source.indexOf('    const body = [');
  const bodyEnd = source.indexOf('    renderImpl = new Function', bodyStart);
  const compiledBody = vm.runInNewContext(`(function(){${source.slice(bodyStart, bodyEnd)};return body;})()`);
  assert.match(source, /const heroArt = heroArtAsset\(entry\.portraitName\);/);
  assert.match(source, /const img = heroPortraitImages\[heroArt\?\.key \|\| entry\.portraitName\];/);
  assert.match(source, /resolveHeroArtSourceRect\(img, heroArt\.combat\)/);
  assert.match(source, /drawHeroSprite = \(\) => drawCombatActorSprite\(ctx, img, \{[\s\S]*\.\.\.sourceRect/);
  assert.match(source, /const scaledW = w \* heroScale \* 1\.25;[\s\S]*const scaledH = h \* heroScale \* 1\.25;/);
  assert.match(compiledBody, /restBaseByUID\[hero\.uid\] = \{ x: baseX, y: yWorld \};/);
  assert.match(compiledBody, /restFeetByUID\[hero\.uid\] = \{ x: baseX, y: yWorld \+ hWorld \/ 2 \};/);
  assert.match(compiledBody, /renderHeightByUID\[hero\.uid\] = scaledH \/ layoutScale;/);
  assert.match(source, /drawCombatActorSprite\(ctx, sprite, \{ drawX, drawY, width: enemyW, height: enemyH, pivotX: pos\.x, orientation: activeCombatOrientation \}\)/);
  assert.deepEqual(resolveHeroArtSourceRect({ width: 100, height: 200 }, heroArtAsset('Fara').combat), {
    sourceX: 0, sourceY: 0, sourceWidth: 100, sourceHeight: 200,
  });
});

test('action cards resolve the same full asset and apply its card crop', () => {
  const source = read('web-runner/systems/heroTurnCardFanUI.mjs');
  assert.match(source, /import \{ heroArtCrop, heroArtPath \} from '\.\.\/state\/heroArtAssets\.mjs';/);
  assert.match(source, /import \{ runtimeAssetUrl \} from '\.\/runtimeAssetUrl\.mjs';/);
  assert.match(source, /runtimeAssetUrl\(heroArtPath\(signatureHero\)\)/);
  assert.match(source, /heroArtCrop\(signatureHero, 'card'\)/);
  assert.match(source, /style\.objectPosition = portraitCrop\.position/);
  assert.match(source, /style\.transform = `scale\(\$\{portraitCrop\.scale\}\)`/);
});
