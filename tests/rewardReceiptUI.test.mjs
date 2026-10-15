import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRewardReceiptPresenter } from '../web-runner/systems/rewardReceiptUI.mjs';

class FakeNode {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.doc = doc; this.children = []; this.style = { setProperty(key, value) { this[key] = value; } }; this.attributes = {}; this.className = ''; this.textContent = ''; this.parentNode = null; }
  get isConnected() { return this === this.doc.body || this === this.doc.head || !!this.parentNode?.isConnected; }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  remove() { if (!this.parentNode) return; this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 56, height: 56 }; }
}

function fakeDocument() {
  const doc = {};
  doc.head = new FakeNode('head', doc); doc.body = new FakeNode('body', doc);
  doc.createElement = tag => new FakeNode(tag, doc);
  doc.getElementById = id => doc.head.children.find(node => node.id === id) || null;
  return doc;
}

test('shared COT and dismantle receipts use correct icons, durations, and replacement-safe auto-dismiss', () => {
  const doc = fakeDocument();
  const timers = [];
  const clock = {
    setTimeout(callback, duration) { const timer = { callback, duration, cleared: false }; timers.push(timer); return timer; },
    clearTimeout(timer) { timer.cleared = true; },
  };
  const presenter = createRewardReceiptPresenter(doc, clock, () => false);
  const canvas = { getBoundingClientRect: () => ({ left: 8, top: 10, width: 360, height: 640 }) };

  const dismantle = presenter.show(canvas, { resource: 'essence', amount: 14 }, 'DISMANTLED', 2000);
  assert.equal(dismantle.getAttribute('role'), 'status');
  assert.equal(dismantle.getAttribute('aria-live'), 'polite');
  assert.equal(dismantle.children[1].children[0].src, 'assets/images/lamp/essence-orb.png');
  assert.equal(dismantle.children[1].children[1].textContent, '14');
  assert.equal(dismantle.children[1].children[2].className, 'reward-fanfare');
  assert.equal(dismantle.children[1].children[2].style.left, '28px', 'receipt fanfare origin is the resource icon center');
  assert.equal(dismantle.children[1].children[2].style.top, '28px');
  assert.equal(dismantle.children[1].children[2].children.length, 12, 'receipt burst uses a compact star and speckle fanfare');
  assert.equal(timers[0].duration, 2000);
  assert.equal(timers[1].duration, 950);
  assert.equal(presenter.isVisible(), true);

  const incense = presenter.show(canvas, { resource: 'incense', amount: 5 }, 'Reward Obtained', 1500);
  assert.equal(dismantle.isConnected, false);
  assert.equal(timers[0].cleared, true);
  assert.equal(timers[1].cleared, true);
  assert.equal(incense.children[1].children[0].src, 'assets/images/progression/incense.png');
  assert.equal(incense.children[0].textContent, 'Reward Obtained');
  assert.equal(incense.getAttribute('aria-label'), 'Reward Obtained: 5 Incense');
  assert.equal(timers[2].duration, 1500);
  timers[0].callback();
  assert.equal(incense.isConnected, true, 'a replaced banner timer cannot remove its successor');
  timers[1].callback();
  assert.equal(incense.children[1].children[2].isConnected, true, 'a replaced fanfare timer cannot remove its successor');

  const ticket = presenter.show(canvas, { resource: 'hero_ticket', amount: 5, heroName: 'Runa' }, 'Reward Obtained', 1500);
  assert.equal(incense.isConnected, false);
  assert.equal(timers[2].cleared, true);
  assert.equal(ticket.children[1].children[0].style.backgroundPosition, '100% 100%');
  assert.match(ticket.getAttribute('aria-label'), /5 Runa Hero tickets/);
  const ticketBurst = ticket.children[1].children[2];
  assert.ok(ticketBurst, 'ticket receipt receives its own burst');
  assert.equal(timers[4].duration, 1500);
  timers[4].callback();
  assert.equal(presenter.isVisible(), false);
  assert.equal(ticket.isConnected, false);
  timers[5].callback();
  assert.equal(ticketBurst.isConnected, false, 'completed fanfare nodes are removed');
});

test('reward fanfare skips reduced motion and replacement removes active particles', () => {
  const doc = fakeDocument();
  const timers = [];
  const clock = { setTimeout(callback, duration) { const timer = { callback, duration, cleared: false }; timers.push(timer); return timer; }, clearTimeout(timer) { timer.cleared = true; } };
  const canvas = { getBoundingClientRect: () => ({ left: 8, top: 10, width: 360, height: 640 }) };
  const reduced = createRewardReceiptPresenter(doc, clock, () => true);
  const reducedReceipt = reduced.show(canvas, { resource: 'essence', amount: 2 }, 'Reward Obtained', 1500);
  assert.equal(reducedReceipt.children[1].children.length, 2, 'reduced motion omits decorative particles');
  assert.equal(timers.length, 1, 'receipt dismissal remains timed');

  const presenter = createRewardReceiptPresenter(doc, clock, () => false);
  const first = presenter.show(canvas, { resource: 'essence', amount: 2 }, 'Reward Obtained', 1500);
  const burst = first.children[1].children[2];
  const second = presenter.show(canvas, { resource: 'incense', amount: 3 }, 'Reward Obtained', 1500);
  assert.equal(burst.isConnected, false, 'replacing a receipt also clears its fanfare');
  assert.equal(first.isConnected, false);
  assert.equal(second.children[1].children.length, 3);
  const successorBurst = second.children[1].children[2];
  assert.equal(successorBurst.children[0].style['--fanfare-duration'], '780ms');
  timers.at(-1).callback();
  assert.equal(successorBurst.isConnected, false, 'completed bursts are removed promptly');
  const localReceipt = presenter.show(canvas, { resource: 'incense', amount: 1 }, 'Reward Obtained', 1500);
  const localBurst = localReceipt.children[1].children[2];
  assert.ok(Math.abs(parseFloat(localBurst.children[0].style['--fanfare-start-x']) + 42.504) < .01, 'approved receipt spread stays unchanged');
  assert.equal(localBurst.isConnected, true);
  const replacementReceipt = presenter.show(canvas, { resource: 'essence', amount: 2 }, 'Reward Obtained', 1500);
  assert.equal(localBurst.isConnected, false, 'same-source receipt replacement clears its particles');
  assert.equal(replacementReceipt.children[1].children[2].isConnected, true);
});

test('shared reward presentation keeps the dismantle style and exact cell crop without a focusable modal', () => {
  const presenter = readFileSync(new URL('../web-runner/systems/rewardReceiptUI.mjs', import.meta.url), 'utf8');
  const cotUI = readFileSync(new URL('../web-runner/systems/combatProgressionUI.mjs', import.meta.url), 'utf8');
  const lampUI = readFileSync(new URL('../web-runner/systems/lampEquipmentUI.mjs', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../web-runner/assets/lampEquipmentUI.css', import.meta.url), 'utf8');
  assert.match(presenter, /linear-gradient\(90deg,#5e431ab8,#80602cd9,#5e431ab8\)/);
  assert.match(presenter, /background-size:200% 200%/);
  assert.match(presenter, /role', 'status'/);
  assert.match(presenter, /showFanfare\(reward, icon\)/);
  assert.match(cotUI, /present\(canvas, result\.receipt, 'Reward Obtained', 1500\)/);
  assert.match(presenter, /reward-fanfare-sweep/);
  assert.match(presenter, /65%\{opacity:\.95/);
  assert.match(presenter, /z-index:0/);
  assert.match(presenter, /\.lamp-reward-banner>strong\{position:relative;z-index:2/);
  assert.doesNotMatch(presenter, /showRewardFanfare|reward-fanfare-fixed/);
  assert.match(presenter, /prefers-reduced-motion: reduce/);
  assert.match(presenter, /pointer-events:none/);
  assert.doesNotMatch(presenter, /tabIndex|addEventListener\('keydown'/);
  assert.match(lampUI, /'DISMANTLED',2000/);
  assert.doesNotMatch(css, /lamp-reward-out|lamp-reward-banner[^\n]*animation:/);
});
