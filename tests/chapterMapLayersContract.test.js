const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

test('map overlays move independently and the ladder retains the page banner with the same world token', async () => {
  const file = path.resolve(__dirname, '../web-runner/systems/renderNarrativeScene.js');
  const source = fs.readFileSync(file, 'utf8')
    .replace(/from '(\.[^']+)'/g, (_, ref) => `from '${new URL(ref, pathToFileURL(file)).href}'`)
    .replaceAll('import.meta.url', JSON.stringify(pathToFileURL(file).href));
  const { renderStoryChapterMap } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const { CHAPTER_ONE_MAP } = await import('../web-runner/systems/chapterMapPresentation.mjs');
  const originalImage = global.Image;
  global.Image = class { set src(value) { this.url = value; this.onload(); } };
  try {
    const calls = [];
    const ctx = new Proxy({}, { get: (_, name) => name === 'createLinearGradient'
      ? () => ({ addColorStop() {} }) : (...args) => calls.push([name, ...args]) });
    const state = { storyEntry: { phase: 'map' } };
    const map = { ...CHAPTER_ONE_MAP, chapter: { text: 'Chapter 7', x: 170, y: 200 },
      token: { ...CHAPTER_ONE_MAP.token, x: 40, y: 300 } };
    renderStoryChapterMap(ctx, state, { viewWidth: 216, viewHeight: 384, map });
    assert.ok(calls.some(c => c[0] === 'fillText' && c[1] === 'QUESTS'));
    assert.ok(calls.some(c => c[0] === 'fillText' && c[1] === 'Chapter 7' && c[2] === 170 && c[3] === 200));
    const draws = calls.filter(c => c[0] === 'drawImage');
    assert.equal(draws.length, 2);
    assert.notEqual(draws[0][1].url, draws[1][1].url);
    assert.deepEqual(draws[1].slice(2), [40, 300, map.token.w, map.token.h]);
    assert.deepEqual(state.storyEntry.townHitZone, { x: 24, y: 180, w: map.token.w * .6, h: map.token.h * .6 });
    calls.length = 0;
    state.storyEntry.phase = 'ladder';
    renderStoryChapterMap(ctx, state, { viewWidth: 360, viewHeight: 640, map });
    assert.deepEqual(calls.filter(c => c[0] === 'drawImage').map(c => c.slice(2)), draws.map(c => c.slice(2)));
    assert.deepEqual(calls.filter(c => c[0] === 'fillText').map(c => c[1]), ['QUESTS']);
    assert.equal(state.storyEntry.townHitZone, null);
    assert.equal(state.storyEntry.startHitZone, null);
  } finally { global.Image = originalImage; }
});

test('map and ladder share identical resource markup and dialogue hides it', async () => {
  const { createQuestLadderUI } = await import('../web-runner/systems/questLadderUI.mjs');
  const originalDocument = global.document;
  let host;
  global.document = {
    createElement: () => ({ style: {}, addEventListener() {} }),
    head: { append() {} }, body: { append(element) { host = element; } },
  };
  try {
    const gameState = { storyEntry: { phase: 'map', cards: [], progress: { energy: 95, resources: 200, completed: [], revealed: 0 } } };
    let gold = 12345;
    const ui = createQuestLadderUI({ canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) },
      gameState, layoutState: { getActiveLayoutId: () => 'storyMock' }, flow: {}, getGold: () => gold });
    ui.update();
    const mapHeader = host.innerHTML;
    assert.match(mapHeader, /Quest resources/);
    assert.match(mapHeader, /Gold 12345/);
    assert.match(mapHeader, /12,345/);
    gameState.storyEntry.phase = 'ladder';
    ui.update();
    assert.equal(host.innerHTML.slice(0, host.innerHTML.indexOf('<section')), mapHeader);
    gameState.storyEntry.cards.push({id:'story-1'}, {id:'story-2'});
    ui.update();
    assert.match(host.innerHTML, /0\/2/);
    gameState.storyEntry.cards.push(...Array.from({length:10}, (_, i) => ({id:`stage-${i + 1}`})));
    ui.update();
    assert.match(host.innerHTML, /0\/12/);
    gameState.storyEntry.progress.completed.push('story-1', 'stage-1');
    ui.update();
    assert.match(host.innerHTML, /value="2" max="12"/);
    assert.match(host.innerHTML, /2\/12/);
    gold = 12000;
    ui.update();
    assert.match(host.innerHTML, /Gold 12000/);
    assert.match(host.innerHTML, /12,000/);
    gameState.storyEntry.phase = 'opening';
    ui.update();
    assert.equal(host.innerHTML, '');
  } finally { global.document = originalDocument; }
});
