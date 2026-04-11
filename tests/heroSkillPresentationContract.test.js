const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('hero skill presentation data defines three skills per hero with CS/JS slot identities', async () => {
  const modulePath = pathToFileURL(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'heroSkillPresentation.mjs')).href;
  const presentation = await import(modulePath);

  assert.equal(presentation.HERO_SKILL_SPRITE_SHEET_PATH, 'images/Fantasy RPG skill icon showcase.png');

  const requiredHeroes = ['Falie', 'Huun', 'Runa', 'Kojonn'];
  for (const hero of requiredHeroes) {
    const entries = presentation.getHeroSkillPresentationEntries(hero);
    assert.equal(entries.length, 3, `${hero} should expose exactly 3 presentation skills`);
    assert.equal(entries[0].badge, 'CS');
    assert.equal(entries[1].badge, 'CS');
    assert.equal(entries[2].badge, 'JS');
    assert.equal(entries[0].iconShape, 'circle');
    assert.equal(entries[1].iconShape, 'circle');
    assert.equal(entries[2].iconShape, 'diamond');
    for (const entry of entries) {
      assert.ok(entry.title.length > 0);
      assert.ok(entry.description.length > 0);
      assert.ok(entry.spriteCrop && Number.isFinite(entry.spriteCrop.x) && Number.isFinite(entry.spriteCrop.y));
    }
  }

  const falie = presentation.getHeroSkillPresentationEntries('Falie');
  assert.equal(falie[0].title, 'Block');
  assert.equal(falie[1].title, 'Shield Bash');
  assert.equal(falie[2].title, 'Bounce');

  const huun = presentation.getHeroSkillPresentationEntries('Huun');
  assert.equal(huun[0].title, 'Steal');
  assert.equal(huun[1].title, 'Lift');
  assert.equal(huun[2].title, 'Assault');

  const runa = presentation.getHeroSkillPresentationEntries('Runa');
  assert.equal(runa[0].title, 'Burn');
  assert.equal(runa[1].title, 'Inspire');
  assert.equal(runa[2].title, 'Destiny');

  const kojonn = presentation.getHeroSkillPresentationEntries('Kojonn');
  assert.equal(kojonn[0].title, 'Avoid');
  assert.equal(kojonn[1].title, 'Enhance');
  assert.equal(kojonn[2].title, 'Gift');
});

test('hero screen app routes through the presentation module and sprite-sheet tile renderer', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /getHeroSkillPresentationEntries/);
  assert.match(src, /HERO_SKILL_SPRITE_SHEET_PATH/);
  assert.match(src, /return getHeroSkillPresentationEntries\(heroName\)\.slice\(0, 3\);/);
  assert.match(src, /function drawHeroSkillIconTile\(/);
  assert.match(src, /drawHeroSkillIconTile\(ctx, iconTile, cardData, heroSkillSpriteSheetImage\);/);
  assert.match(src, /heroSkillSpriteSheetImage = await heroSkillSheetPromise;/);
  assert.match(src, /function drawHeroSkillNode\(ctx, rect, cardData, selected, ss, sf, spriteSheetImage = null\)/);
  assert.match(src, /drawHeroSkillNode\(ctx, rect, \{\s*\.\.\.cardData,\s*\.\.\.nodeItem,\s*shape: isDiamond \? 'diamond' : 'circle',\s*\}, selected, ss, sf, heroSkillSpriteSheetImage\);/s);
  assert.match(src, /heroSkillSpriteSheetImage,/);
  assert.match(src, /cardData\.badge/);
});
