import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { heroArtAsset, heroArtPath, resolveHeroArtSourceRect } from '../web-runner/state/heroArtAssets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('one canonical hero-art mapping resolves V9 strip, battlefield, and action-card names', () => {
  for (const [name, asset] of Object.entries({ Fara: 'Falie', Hondo: 'Huun', Runa: 'Runa', Kaja: 'Kojonn' })) {
    assert.equal(heroArtAsset(name)?.key, asset);
    assert.equal(heroArtPath(name), `images/${asset}.png`);
    assert.ok(heroArtAsset(name)?.combat);
    assert.ok(heroArtAsset(name)?.card);
    assert.ok(heroArtAsset(name)?.strip);
  }
});

test('battlefield consumes the cropped canonical hero source while enemy sprites keep their source intact', () => {
  const source = read('web-runner/systems/renderRuntime.js');
  assert.match(source, /const heroArt = heroArtAsset\(entry\.portraitName\);/);
  assert.match(source, /const img = heroPortraitImages\[heroArt\?\.key \|\| entry\.portraitName\];/);
  assert.match(source, /resolveHeroArtSourceRect\(img, heroArt\.combat\)/);
  assert.match(source, /drawHeroSprite = \(\) => drawCombatActorSprite\(ctx, img, \{[\s\S]*\.\.\.sourceRect/);
  assert.match(source, /drawCombatActorSprite\(ctx, sprite, \{ drawX, drawY, width: enemyW, height: enemyH, pivotX: pos\.x, orientation: activeCombatOrientation \}\)/);
  assert.deepEqual(resolveHeroArtSourceRect({ width: 100, height: 200 }, heroArtAsset('Fara').combat), {
    sourceX: 8, sourceY: 0, sourceWidth: 84, sourceHeight: 96,
  });
});

test('action cards resolve the same full asset and apply its card crop', () => {
  const source = read('web-runner/systems/heroTurnCardFanUI.mjs');
  assert.match(source, /import \{ heroArtCrop, heroArtPath \} from '\.\.\/state\/heroArtAssets\.mjs';/);
  assert.match(source, /new URL\(`\.\.\/assets\/\$\{heroArtPath\(activeHero\)\}`/);
  assert.match(source, /heroArtCrop\(activeHero, 'card'\)/);
  assert.match(source, /style\.objectPosition = portraitCrop\.position/);
  assert.match(source, /style\.transform = `scale\(\$\{portraitCrop\.scale\}\)`/);
});
