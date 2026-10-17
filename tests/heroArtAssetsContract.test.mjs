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

test('battlefield uses puppet frames independently of static hero portraits', () => {
  const source = read('web-runner/systems/renderRuntime.js');
  const bodyStart = source.indexOf('    const body = [');
  const bodyEnd = source.indexOf('    const effectiveBody = assembleCombatRenderBody(body);', bodyStart);
  const compiledBody = vm.runInNewContext(`(function(){${source.slice(bodyStart, bodyEnd)};return body;})()`);
  const helperStart = source.indexOf('export function assembleCombatRenderBody(body) {');
  const helperEnd = source.indexOf('\nlet renderImpl = null;', helperStart);
  const assemble = new Function(`${source.slice(helperStart, helperEnd).replace('export function', 'function')};return assembleCombatRenderBody;`)();
  const assembledBody = assemble(compiledBody);
  assert.doesNotThrow(() => new Function('scope', 'dtOverride', `with (scope) { ${assembledBody} }`));
  assert.doesNotMatch(assembledBody, /drawCombatActorSprite\(|heroPortraitImages/);
  assert.match(assembledBody, /drawHeroSprite = \(\) => puppet \? drawActorPuppetFrame/);
  assert.match(source, /const scaledW = w \* heroScale \* 1\.55;[\s\S]*const scaledH = h \* heroScale \* 1\.55;/);
  assert.match(compiledBody, /restBaseByUID\[hero\.uid\] = \{ x: baseX, y: yWorld \};/);
  assert.match(compiledBody, /restFeetByUID\[hero\.uid\] = \{ x: baseX, y: yWorld \+ hWorld \* 1\.55 \/ 2 \};/);
  assert.match(compiledBody, /renderHeightByUID\[hero\.uid\] = scaledH \/ layoutScale;/);
  assert.match(compiledBody, /const footAnchor = state\.globals\.HeroRestFeetPosByUID\?\.\[uid\] \|\| anchor;/);
  assert.match(compiledBody, /const barY = Math\.round\(footPos\.y \+ 4 \* layoutScale\);/);
  assert.match(compiledBody, /addActorPaint\(uid, \(\) => paintWithActivationAlpha\(ctx, heroBarFadeAlpha, \(\) => drawCombatHealthBar/);
  assert.doesNotMatch(assembledBody, /buffStyle|RealtimeSkillEffects\?\.\[uid\]/);
  assert.doesNotMatch(assembledBody, /ampShowsBadge|badgeBottomY/);
  assert.match(assembledBody, /drawCombatHealthBar\(ctx, \{ x: barX, y: barY,[^}]*team: 'hero' \}\)/);
  assert.match(assembledBody, /drawImage\(wardBarrierImage/);
  assert.match(assembledBody, /renderHeroRegenShimmer\(drawX, drawY, scaledW, scaledH, hero\.uid\)/);
  assert.deepEqual(resolveHeroArtSourceRect({ width: 100, height: 200 }, heroArtAsset('Fara').combat), {
    sourceX: 0, sourceY: 0, sourceWidth: 100, sourceHeight: 200,
  });
});
