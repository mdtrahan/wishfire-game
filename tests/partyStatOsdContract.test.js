const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');
const osdPath = path.join(repoRoot, 'web-runner', 'systems', 'partyStatOsd.js');
const appPath = path.join(repoRoot, 'web-runner', 'app.js');

async function loadOsdModule() {
  const source = fs.readFileSync(osdPath, 'utf8');
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function makeState() {
  return {
    globals: {
      PartyBuff_ATK: 3,
      PartyBuff_DEF: -2,
      PartyBuff_RES: 0,
      PartyBuff_SPD: 0,
    },
    entities: [
      {
        kind: 'hero',
        uid: 102,
        name: 'Huun',
        heroDisplaySlot: 1,
        stats: { ATK: 9, MAG: 5, DEF: 7, RES: 4, SPD: 11 },
      },
      {
        kind: 'enemy',
        uid: 200,
        name: 'Djinn',
        stats: { ATK: 50, DEF: 50, RES: 50, SPD: 50 },
      },
      {
        kind: 'hero',
        uid: 101,
        name: 'Falie',
        heroDisplaySlot: 0,
        attackType: 'melee',
        stats: { ATK: 9, MAG: 3, DEF: 10, RES: 5, SPD: 9 },
      },
    ],
  };
}

function makeFakeDocument() {
  const nodes = [];
  const documentRef = {
    body: {
      appendChild(node) {
        nodes.push(node);
      },
    },
    createElement(tagName) {
      return {
        tagName: String(tagName || '').toUpperCase(),
        attributes: {},
        children: [],
        dataset: {},
        style: { cssText: '' },
        hidden: false,
        textContent: '',
        innerHTML: '',
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
        appendChild(child) {
          this.children.push(child);
        },
        querySelector(selector) {
          if (selector === '[data-party-stat-osd-body]') {
            return this.children.find(child => Object.hasOwn(child.attributes || {}, 'data-party-stat-osd-body')) || null;
          }
          return null;
        },
      };
    },
    querySelector(selector) {
      if (selector === '[data-party-stat-osd]') {
        return nodes.find(node => Object.hasOwn(node.attributes || {}, 'data-party-stat-osd')) || null;
      }
      return null;
    },
  };
  return { documentRef, nodes };
}

test('party stat OSD hotkey is Cmd/Ctrl+Shift+Y and ignores editable targets', async () => {
  const osd = await loadOsdModule();

  assert.equal(osd.isPartyStatOsdHotkey({ metaKey: true, shiftKey: true, code: 'KeyY', key: 'y' }), true);
  assert.equal(osd.isPartyStatOsdHotkey({ ctrlKey: true, shiftKey: true, code: 'KeyY', key: 'y' }), true);
  assert.equal(osd.isPartyStatOsdHotkey({ metaKey: true, shiftKey: true, code: 'KeyP', key: 'p' }), false);
  assert.equal(osd.isPartyStatOsdHotkey({
    metaKey: true,
    shiftKey: true,
    code: 'KeyY',
    key: 'y',
    target: { tagName: 'INPUT' },
  }), false);
});

test('party stat rows show effective stats with signed modifiers in party order', async () => {
  const osd = await loadOsdModule();
  const state = makeState();
  const text = osd.formatPartyStatOsdText({
    stateEntities: state.entities,
    stateGlobals: state.globals,
    getEffectiveStat(hero, stat) {
      const base = Number(hero.stats?.[stat] || 0);
      if (hero.name === 'Falie' && stat === 'DEF') return base - 2;
      return base;
    },
    getPowerMultiplier(hero) {
      return hero.name === 'Falie' ? 1.34 : 1;
    },
  });

  assert.equal(text.split('\n')[0], 'Falie ATK 13 +4, MAG 3, DEF 8 -2, RES 5, SPD 9');
  assert.equal(text.split('\n')[1], 'Huun ATK 9, MAG 5, DEF 7, RES 4, SPD 11');
  assert.equal(text.includes('Djinn'), false);
});

test('party stat OSD runtime creates dark read-only overlay and toggles visibility', async () => {
  const osd = await loadOsdModule();
  const state = makeState();
  const { documentRef, nodes } = makeFakeDocument();

  const runtime = osd.createPartyStatOsdRuntime({
    state,
    document: documentRef,
    getEffectiveStat(hero, stat) {
      return Number(hero.stats?.[stat] || 0);
    },
  });

  assert.equal(nodes.length, 1);
  assert.match(runtime.root.style.cssText, /background:rgba\(8, 13, 24, 0\.94\)/);
  assert.match(runtime.root.style.cssText, /color:#f8fafc/);
  assert.match(runtime.root.style.cssText, /width:min\(560px, calc\(100vw - 24px\)\)/);
  assert.match(runtime.root.style.cssText, /padding:10px 32px 10px 12px/);
  assert.match(runtime.root.style.cssText, /font:700 11px\/1\.45 .*monospace/);
  assert.match(runtime.root.style.cssText, /font-variant-numeric:tabular-nums/);
  assert.match(runtime.root.style.cssText, /letter-spacing:0/);
  assert.match(runtime.root.style.cssText, /pointer-events:none/);
  assert.equal(runtime.root.hidden, true);

  runtime.toggle();
  assert.equal(runtime.root.hidden, false);
  assert.equal(runtime.root.dataset.visible, 'true');
  assert.match(runtime.root.querySelector('[data-party-stat-osd-body]').innerHTML, /Falie ATK 9, MAG 3/);
});

test('party stat OSD colors buffs bright yellow and debuffs pure red', async () => {
  const osd = await loadOsdModule();
  const state = makeState();

  const html = osd.formatPartyStatOsdHtml({
    stateEntities: state.entities,
    stateGlobals: state.globals,
    getEffectiveStat(hero, stat) {
      const base = Number(hero.stats?.[stat] || 0);
      if (hero.name === 'Falie' && stat === 'ATK') return base + 3;
      if (hero.name === 'Falie' && stat === 'DEF') return base - 2;
      return base;
    },
  });

  assert.match(html, /data-party-stat-modifier="buff" style="color:#ffff00;font-weight:900"> \+3<\/span>/);
  assert.match(html, /data-party-stat-modifier="debuff" style="color:#ff0000;font-weight:900"> -2<\/span>/);
});

test('app wires party stat OSD without adding app-owned stat formatting', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');

  assert.match(appSrc, /import \* as partyStatOsd from '\.\/systems\/partyStatOsd\.js';/);
  assert.match(appSrc, /partyStatOsd\.createPartyStatOsdRuntime\(\{/);
  assert.match(appSrc, /callFunctionWithContext\(fnContext, 'GetEffectiveStat', hero, stat\)/);
  assert.match(appSrc, /callFunctionWithContext\(fnContext, 'GetPowerAmpMultiplierForActor', Number\(hero\?\.uid \|\| 0\)\)/);
  assert.match(appSrc, /partyStatOsd\.isPartyStatOsdHotkey\(ev\)/);
  assert.match(appSrc, /partyStatOsdRuntime\.refresh\(\);/);
  assert.doesNotMatch(appSrc, /PartyBuff_ATK[\s\S]{0,160}PartyBuff_DEF[\s\S]{0,160}PartyBuff_RES[\s\S]{0,160}PartyBuff_SPD/);
});
