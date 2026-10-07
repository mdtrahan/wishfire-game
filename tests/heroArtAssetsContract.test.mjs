import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { heroArtAsset, heroArtPath, resolveHeroArtSourceRect } from '../web-runner/state/heroArtAssets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('one canonical hero-art mapping resolves strip and battlefield names', () => {
  for (const [name, asset] of Object.entries({ Fara: 'Fara', Hondo: 'Hondo', Runa: 'Runa', Kaja: 'Kaja', Falie: 'Fara', Huun: 'Hondo', Kojonn: 'Kaja' })) {
    assert.equal(heroArtAsset(name)?.key, asset);
    assert.equal(heroArtPath(name), `images/${asset}.png`);
    assert.ok(heroArtAsset(name)?.combat);
    assert.ok(heroArtAsset(name)?.strip);
  }
});

test('battlefield consumes each complete canonical hero sprite while enemy sprites keep their source intact', () => {
  const source = read('web-runner/systems/renderRuntime.js');
  const bodyStart = source.indexOf('    const body = [');
  const bodyEnd = source.indexOf('    const effectiveBody = assembleCombatRenderBody(body);', bodyStart);
  const compiledBody = vm.runInNewContext(`(function(){${source.slice(bodyStart, bodyEnd)};return body;})()`);
  assert.match(source, /const heroArt = heroArtAsset\(entry\.portraitName\);/);
  assert.match(source, /const img = heroPortraitImages\[heroArt\?\.key \|\| entry\.portraitName\];/);
  assert.match(source, /resolveHeroArtSourceRect\(img, heroArt\.combat\)/);
  assert.match(source, /drawHeroSprite = \(\) => puppet \? drawActorPuppetFrame\([\s\S]*: drawCombatActorSprite\(ctx, img, \{[\s\S]*\.\.\.sourceRect/);
  assert.match(source, /const scaledW = w \* heroScale \* 1\.55;[\s\S]*const scaledH = h \* heroScale \* 1\.55;/);
  assert.match(compiledBody, /restBaseByUID\[hero\.uid\] = \{ x: baseX, y: yWorld \};/);
  assert.match(compiledBody, /restFeetByUID\[hero\.uid\] = \{ x: baseX, y: yWorld \+ hWorld \* 1\.55 \/ 2 \};/);
  assert.match(compiledBody, /renderHeightByUID\[hero\.uid\] = scaledH \/ layoutScale;/);
  assert.match(compiledBody, /const footAnchor = state\.globals\.HeroRestFeetPosByUID\?\.\[uid\] \|\| anchor;/);
  assert.match(compiledBody, /const barY = Math\.round\(footPos\.y - actorHeight - 10 \* layoutScale\);/);
  assert.match(source, /drawCombatActorSprite\(ctx, sprite, \{ drawX, drawY, width: enemyW, height: enemyH, pivotX: pos\.x, orientation: activeCombatOrientation, facing: enemy\.facing, nativeFacing: 'left', actorUID: enemy\.uid, effects: g\.RealtimeSkillEffects, now: Number\(g\.time \|\| 0\) \}\)/);
  assert.deepEqual(resolveHeroArtSourceRect({ width: 100, height: 200 }, heroArtAsset('Fara').combat), {
    sourceX: 0, sourceY: 0, sourceWidth: 100, sourceHeight: 200,
  });
});
