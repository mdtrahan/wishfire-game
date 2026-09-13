import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { HERO_STRIP_VERSION, heroStripCardWidth } from '../web-runner/systems/heroCommandUI.mjs';
import { HERO_ART_ASSETS } from '../web-runner/state/heroArtAssets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'web-runner/systems/heroCommandUI.mjs'), 'utf8');

test('combat hero strip keeps a compact free placed reference status block', () => {
  assert.equal(HERO_STRIP_VERSION, 'sample-status-v30');
  assert.match(source, /host\.dataset\.heroStripVersion = HERO_STRIP_VERSION/);
  assert.match(source, /width:354px;height:104px/);
  assert.match(source, /background:transparent/);
  assert.match(source, /display:flex;flex-wrap:nowrap;justify-content:flex-start;align-items:flex-start;gap:7px;width:349px;height:104px/);
  assert.match(source, /const position = worldToCanvas\(6, 406\)/);
  assert.match(source, /host\.style\.left = `\$\{rect\.left \+ position\.x\}px`/);
  assert.match(source, /host\.style\.top = `\$\{rect\.top \+ position\.y\}px`/);
  assert.match(source, /grid\.replaceChildren\(\)/);
  assert.doesNotMatch(source, /Array\.from\(\{length: 6\}/);
  assert.match(source, /HERO_PORTRAIT_PATHS = Object\.freeze/);
  assert.match(source, /Object\.entries\(HERO_ART_ASSETS\)/);
  assert.deepEqual(Object.fromEntries(Object.entries(HERO_ART_ASSETS).map(([key, asset]) => [key, asset.path])), {
    Falie: 'images/Falie.png', Huun: 'images/Huun.png', Runa: 'images/Runa.png', Kojonn: 'images/Kojonn.png',
  });
  assert.doesNotMatch(source, /cap_/);
  assert.match(source, /HERO_PORTRAIT_CROPS = Object\.freeze/);
  assert.match(source, /Falie: \{position: '52% 0%', scale: 4\.6, width: '47%'\}/);
  assert.match(source, /Huun: \{position: '60% 0%', scale: 4\.8, width: '47%'\}/);
  assert.match(source, /Runa: \{position: '48% 0%', scale: 4\.8, width: '47%'\}/);
  assert.match(source, /Kojonn: \{position: '54% 0%', scale: 4\.7, width: '47%'\}/);
  assert.match(source, /padding:0;font:600 10px/);
  assert.match(source, /flex:0 0 var\(--card-width,82px\)/);
  assert.match(source, /height:104px/);
  assert.match(source, /grid-template-rows:64px 40px/);
  assert.match(source, /className = 'hero-top'/);
  assert.match(source, /\.portrait\{position:absolute;z-index:1;inset:0 auto auto 0;width:47%;height:60px;overflow:hidden;background:transparent\}/);
  assert.match(source, /object-position:50% 0%;transform:scale\(2\.1\)/);
  assert.match(source, /\.hero-top\{grid-row:1;position:relative;min-width:0;overflow:visible;isolation:isolate;background:transparent\}/);
  assert.match(source, /\.readouts\{position:absolute;z-index:2;top:2px;left:42%;width:55%;height:62px;display:flex;flex-direction:column;gap:6px/);
  assert.match(source, /for \(const \[key, label\] of \[\['hp', 'HP'\], \['sp', 'SP'\]\]\)/);
  assert.doesNotMatch(source, /\[\['flow',\s*'FLOW'\]\]/);
  assert.doesNotMatch(source, /data-flow-(?:text|bar)/);
  assert.doesNotMatch(source, /\.flow(?:\s|\{|:)/);
  assert.match(source, /className = 'readout-value'/);
  assert.match(source, /grid-template-rows:19px 8px/);
  assert.match(source, /readout-label\{display:inline-block;font-size:calc\(9px \* var\(--compact-type-scale,1\)\);font-weight:900;transform:scale\(1\.5\);transform-origin:left bottom/);
  assert.match(source, /font-size:calc\(20px \* var\(--compact-type-scale,1\)\)/);
  assert.match(source, /readout-text\{display:flex;align-items:baseline;justify-content:space-between;gap:0;min-width:0;padding:4px 0 0;white-space:nowrap;transform:translateY\(5px\)\}/);
  assert.match(source, /display:inline-block;font-size:calc\(20px \* var\(--compact-type-scale,1\)\);font-weight:900;line-height:\.75;letter-spacing:-1px;transform:scaleX\(\.85\);transform-origin:right bottom;margin-right:0/);
  assert.match(source, /width:100%;height:8px/);
  assert.match(source, /border-radius:3px/);
  assert.match(source, /\.readout\{display:grid;grid-template-rows:19px 8px;gap:0;min-width:0;padding:0 2px;border:0;background:transparent;line-height:1;overflow:hidden/);
  assert.match(source, /\.readout\.hp\{transform:translateY\(11px\)\}/);
  assert.match(source, /text-shadow:2px 0 #05060b,-2px 0 #05060b,0 2px #05060b,0 -2px #05060b/);
  assert.match(source, /box-shadow:inset 0 1px #fff9,inset 0 -2px #000b,0 1px #07090d/);
  assert.match(source, /\.hp progress::-webkit-progress-value/);
  assert.match(source, /\.sp progress::-webkit-progress-value/);
  assert.match(source, /\[data-hp-text\]'\)\.textContent = hp/);
  assert.match(source, /\[data-sp-text\]'\)\.textContent = sp/);
  assert.match(source, /article\[data-low-hp=true\] \.readout-label,#hero-commands article\[data-low-hp=true\] \.readout-value,#hero-commands article\[data-low-hp=true\] footer \.role,#hero-commands article\[data-low-hp=true\] footer \.level,#hero-commands article\[data-low-hp=true\] footer \.hero-name strong\{color:#ff8b37\}/);
  assert.match(source, /card\.dataset\.lowHp = String\(hp > 0 && hp \/ maxHP <= LOW_HP_WARNING_RATIO\)/);
  assert.doesNotMatch(source, /\[data-flow-(?:text|bar)\]/);
  assert.doesNotMatch(source, /FLOW ready/);
  assert.match(source, /className = 'hero-meta'/);
  assert.match(source, /nameBand\.className = 'hero-name'/);
  assert.match(source, /levelLabel\.className = 'level-label'/);
  assert.match(source, /levelValue\.className = 'level-value'/);
  assert.match(source, /levelValue\.dataset\.levelValue = ''/);
  assert.match(source, /className = 'role'/);
  assert.match(source, /HERO_DISPLAY_ROLES = Object\.freeze\(\{Fara: 'TANK', Hondo: 'FIGHT', Runa: 'CTRL', Kaja: 'SUP'\}\)/);
  assert.match(source, /role\.textContent = HERO_DISPLAY_ROLES\[heroName\(hero\)\] \|\| definition\?\.role \|\| 'Hero'/);
  assert.match(source, /role\.title = definition\?\.role \|\| 'Hero'/);
  assert.match(source, /height:40px;display:grid;grid-template-rows:18px minmax\(0,1fr\);gap:1px;padding:0;border:0;background:transparent/);
  assert.match(source, /footer \.hero-meta,#hero-commands footer \.hero-name\{min-width:0;overflow:hidden;border:2px solid #c6c4da/);
  assert.match(source, /footer \.hero-meta\{display:flex;align-items:center;justify-content:center;gap:5px/);
  assert.match(source, /footer \.hero-name\{display:grid;place-items:center/);
  assert.match(source, /footer \.level\{display:flex;align-items:baseline;gap:1px;flex:none/);
  assert.match(source, /footer \.level-label\{font-size:calc\(10px \* var\(--compact-type-scale,1\)\)/);
  assert.match(source, /footer \.level-value\{font-size:calc\(22px \* var\(--compact-type-scale,1\)\);font-weight:1000;line-height:\.68/);
  assert.match(source, /article\[data-current=true\]::before\{content:'';position:absolute;z-index:-1;inset:-3px;border-radius:8px;background:radial-gradient/);
  assert.doesNotMatch(source, /\.hero-top::(?:before|after)/);
  assert.doesNotMatch(source, /(?:className|class)=['"`][^'"`]*(?:stat|backer|slab)/i);
  assert.doesNotMatch(source, /\.(?:stat|backer|slab)\b/i);
  assert.match(source, /card\.dataset\.current = String\(current\)/);
  assert.match(source, /card\.dataset\.ko = String\(hp <= 0\)/);
  assert.match(source, /card\.dataset\.ready = String\(ready\)/);
  assert.match(source, /const ready = !!resourceState\.ready \|\| number\(resourceState\.value\) >= 100/);
  assert.match(source, /portrait\.dataset\.portrait = portraitKey/);
  assert.match(source, /open\.disabled = true/);
  assert.doesNotMatch(source, /onActiveHeroClick\(hero\)/);
  assert.doesNotMatch(source, /\bMP\b/);
});

test('combat hero strip keeps populated 1, 4, and 6 hero rosters in one row', () => {
  for (const [count, expected] of [[1, 82], [4, 82], [6, 82]]) {
    const width = heroStripCardWidth(count);
    assert.equal(width, expected);
    assert.equal(count <= 4, count * width + Math.max(0, count - 1) * 7 <= 349);
  }
  assert.match(source, /overflow-x:auto;overflow-y:hidden/);
  assert.match(source, /card\.scrollIntoView\(\{block: 'nearest', inline: 'nearest'\}\)/);
});

test('combat hero strip protects compact text from transform shrinkage', () => {
  assert.match(source, /--compact-type-scale/);
  assert.match(source, /1 \/ Math\.max\(\.01, Number\(layoutScale\) \|\| 1\)/);
  assert.match(source, /font-size:calc\(20px \* var\(--compact-type-scale,1\)\)/);
  assert.match(source, /font-size:calc\(15px \* var\(--compact-type-scale,1\)\)/);
  assert.match(source, /font-size:calc\(22px \* var\(--compact-type-scale,1\)\)/);
});
