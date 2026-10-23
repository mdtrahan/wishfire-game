import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function assembledCombatRenderBody() {
  const source = fs.readFileSync(new URL('../web-runner/systems/renderRuntime.js', import.meta.url), 'utf8');
  const bodyStart = source.indexOf('const body = ') + 'const body = '.length;
  const bodyEnd = source.indexOf(';\n    const effectiveBody = assembleCombatRenderBody(body);', bodyStart);
  assert.ok(bodyStart >= 0 && bodyEnd > bodyStart);
  const body = vm.runInNewContext(source.slice(bodyStart, bodyEnd));
  const helperStart = source.indexOf('export function assembleCombatRenderBody(body) {');
  const helperEnd = source.indexOf('\n}\n\nlet renderImpl', helperStart) + 2;
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helper = source.slice(helperStart, helperEnd).replace('export function', 'function');
  return new Function(`${helper}; return assembleCombatRenderBody;`)()(body);
}

function extractFunction(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing ${marker}`);
  const open = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index], next = source[index + 1];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '/' && next === '/') { index = source.indexOf('\n', index); if (index < 0) break; continue; }
    if (char === '/' && next === '*') { const end = source.indexOf('*/', index + 2); if (end < 0) break; index = end + 1; continue; }
    if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`unterminated ${marker}`);
}

test('runtime scales heal blooms once through the battlefield zoom seam; retired skill ground cues stay gone', () => {
  const body = assembledCombatRenderBody();
  assert.match(body, /const combatWorldVfxScale = layoutScale \* COMBAT_BATTLEFIELD_ZOOM;/);
  assert.doesNotMatch(body, /renderRealtimeSkillGroundVfx\(/);

  const healBloomSource = extractFunction(body, "const renderHealBlooms = (layer = 'back') => {");
  assert.doesNotMatch(healBloomSource, /layoutScale/);
  const particles = [{ x: 20, y: -68, opacity: 1, complete: false }];
  const blooms = [17, 18].map(targetUID => ({ x: 100, y: 200, targetUID, presentation: 'major', particles: structuredClone(particles), complete: false }));
  const state = { globals: {
    HeroRestFeetPosByUID: { 17: { x: 100, y: 200 }, 18: { x: 120, y: 220 } },
    HeroRenderHeightByUID: { 17: 40, 18: 40 }, HeroRenderWidthByUID: { 17: 32, 18: 32 }, EnemySize: 40,
  }, entities: [17, 18].map(uid => ({ uid, kind: 'hero', hp: 100 })) };
  const gameState = { healBlooms: blooms };
  const images = Object.fromEntries([
    ['CombatGroupHealRain', 116, 58], ['CombatHealSigil', 46, 20],
    ['CombatHealFountain', 48, 24], ['CombatHealSwirl', 100, 100], ['CombatHealBurst', 40, 20],
  ].map(([id, width, height]) => [id, { id, width, height }]));
  const drawCalls = [], frontCalls = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {}, arc(...args) { frontCalls.push(['arc', ...args]); },
    fill() {}, stroke() {}, translate(...args) { frontCalls.push(['translate', ...args]); },
    drawImage(...args) { drawCalls.push(args); },
  };
  const zoom = 0.5;
  const render = new Function('state', 'gameState', 'images', 'worldToCanvas', 'layoutScale', 'COMBAT_BATTLEFIELD_ZOOM', 'projectCombatActorWorldToCanvas', 'ctx',
    `const combatWorldVfxScale = layoutScale * COMBAT_BATTLEFIELD_ZOOM;\n${healBloomSource}\nreturn renderHealBlooms;`)(
    state, gameState, images, (x, y) => ({ x: x * zoom, y: y * zoom }), 1, zoom,
    (x, y) => ({ x: x * zoom, y: y * zoom }), ctx,
  );
  render('back');
  const destinationWidth = call => call.length === 5 ? call[3] : call[7];
  const widthFor = id => destinationWidth(drawCalls.find(call => call[0].id === id));
  assert.equal(widthFor('CombatGroupHealRain'), 58, 'group rain uses projected-world width');
  assert.equal(widthFor('CombatHealSigil'), 23, 'ground sigil uses projected-world width');
  assert.equal(widthFor('CombatHealFountain'), 24, 'fountain uses projected-world width');
  assert.equal(widthFor('CombatHealSwirl'), 38, 'actor-relative swirl uses projected-world width');

  render('front');
  assert.ok(frontCalls.some(call => call[0] === 'translate' && call[1] === 68), 'particle offsets use the same world-effect scale');
});
