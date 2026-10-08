import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoryEntryFlow } from '../web-runner/systems/storyEntryFlow.mjs';
import { bossFallbackPresentation, bossFallbackRect, drawCombatProgressHud } from '../web-runner/systems/renderCombatBossControl.mjs';

function bossState(overrides = {}) {
  return { globals: { ContinuousCombatStage: { region: 5, stage: 27, wave: 4, bossAvailable: true, bossArmed: false, bossActive: false, ...overrides } } };
}

test('fallback replaces the rail only for an interrupted ready or active boss and fits the compact top band', () => {
  const ready = bossState();
  const page = bossFallbackPresentation({ state: ready, layoutId: 'heroLayout' });
  assert.deepEqual(page, { visible: true, enabled: true, label: 'Chapter 5-27', bossActive: false });
  assert.equal(bossFallbackPresentation({ state: ready, layoutId: 'combat' }).visible, false);
  assert.equal(bossFallbackPresentation({ state: ready, layoutId: 'combat', overlayOpen: true, suppress: true }).visible, false, 'developer modal keeps its existing close path');
  assert.equal(drawCombatProgressHud({}, { state: { globals: { ...ready.globals, CombatBossFallbackVisible: true } } }), null, 'the Canvas rail is suppressed under the shared fallback');
  assert.equal(bossFallbackPresentation({ state: ready, layoutId: 'combat', overlayOpen: true, canLeave: false }).enabled, false);
  const active = bossFallbackPresentation({ state: bossState({ bossAvailable: false, bossArmed: true, bossActive: true }), layoutId: 'combat', overlayOpen: true });
  assert.deepEqual(active, { visible: true, enabled: true, label: 'Chapter 5-27', bossActive: true });
  assert.equal(bossFallbackPresentation({ state: ready, layoutId: 'storyMock', phase: 'defeat' }).visible, false);

  const rect = bossFallbackRect({ left: 0, top: 0, width: 216, height: 384 });
  assert.equal(rect.x, 0);
  assert.equal(rect.width, 216);
  assert.equal(rect.scale, 0.6);
  assert.ok(Math.abs(rect.y - 1.2) < 1e-9 && Math.abs(rect.height - 49.2) < 1e-9);
  assert.ok(rect.y + rect.height < 92 * rect.scale, 'the fallback stays above the Quests chapter header');
  const letterboxed = bossFallbackRect({ left: 0, top: 0, width: 233, height: 452 });
  assert.ok(letterboxed.y > 18 && letterboxed.y < 22, 'the fallback follows the centered 360x640 reference frame');
});

test('fallback button gates unsafe transactions and resumes the same combat snapshot once', async () => {
  let activeLayout = 'heroLayout';
  let canLeave = false;
  let releaseTransition;
  const requests = [];
  let closes = 0;
  let prepares = 0;
  let revives = 0;
  const gameState = {};
  const activeBoss = bossState({ bossAvailable: false, bossArmed: true, bossActive: true });
  const activeBossBefore = structuredClone(activeBoss.globals.ContinuousCombatStage);
  const flow = createStoryEntryFlow({
    gameState,
    isReady: () => true,
    canCloseTransientSurface: () => canLeave,
    closeTransientSurface: () => { closes += 1; },
    prepareEncounter: () => { prepares += 1; },
    resurrect: () => { revives += 1; },
    layoutState: {
      getActiveLayoutId: () => activeLayout,
      requestLayoutChange(target, reason, payload) {
        requests.push({ target, reason, payload });
        return new Promise(resolve => { releaseTransition = () => { activeLayout = target; resolve(true); }; });
      },
    },
  });
  gameState.storyEntry.phase = 'combat';
  gameState.storyEntry.combatPaused = true;
  gameState.storyEntry.modal = 'combat-pause';

  assert.equal(await flow.resumeBossActivity(), false, 'receipt/busy state prevents closing the overlay');
  assert.equal(requests.length, 0);
  assert.equal(closes, 0);

  canLeave = true;
  const first = flow.resumeBossActivity();
  const repeated = flow.resumeBossActivity();
  assert.equal(await repeated, false, 'a rapid repeated click cannot enqueue another return');
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], { target: 'combat', reason: 'boss-fallback-return', payload: {} });
  releaseTransition();
  assert.equal(await first, true);
  assert.equal(activeLayout, 'combat');
  assert.equal(gameState.storyEntry.phase, 'combat');
  assert.equal(gameState.storyEntry.modal, null);
  assert.equal(gameState.storyEntry.combatPaused, false);
  assert.equal(closes, 1);
  assert.equal(prepares, 0, 'resume does not reinitialize the encounter');
  assert.equal(revives, 0, 'resume does not restore or reset party HP');
  assert.deepEqual(activeBoss.globals.ContinuousCombatStage, activeBossBefore, 'resuming an active boss preserves its stage state');
});

test('production fallback surface is a reachable DOM button above the modal scrim', async () => {
  class Element {
    constructor(tag) {
      this.tag = tag;
      const style = {};
      Object.defineProperty(style, 'cssText', {
        set(value) { for (const rule of value.split(';')) { const [key, entry] = rule.split(':'); if (key && entry) style[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = entry; } },
      });
      this.style = style;
      this.children = [];
      this.hidden = false;
      this.attributes = {};
    }
    append(...children) { this.children.push(...children); }
    setAttribute(name, value) { this.attributes[name] = value; }
  }
  const priorDocument = globalThis.document;
  const body = new Element('body');
  globalThis.document = { createElement: tag => new Element(tag), body };
  try {
    const control = await import(`../web-runner/systems/renderCombatBossControl.mjs?fixture=${Date.now()}`);
    const state = bossState();
    const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 216, height: 384 }) };
    let summons = 0;
    let redraws = 0;
    const result = control.updateBossSummonFallback({ canvas, state, layoutId: 'combat', overlayOpen: true, onSummonBoss: () => { summons += 1; }, redraw: () => { redraws += 1; } });
    assert.equal(result.visible, true);
    const host = body.children[0], button = host.children[1];
    assert.equal(host.style.zIndex, '10002');
    assert.equal(host.children[0].textContent, 'Chapter 5-27');
    assert.equal(button.attributes['aria-label'], 'Summon Boss for Chapter 5-27');
    button.onclick();
    button.onclick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(summons, 1);
    assert.equal(redraws, 1);
    assert.equal(state.globals.CombatBossFallbackVisible, true);
    assert.equal(control.updateBossSummonFallback({ canvas, state, layoutId: 'heroLayout', phase: 'defeat' }).visible, false);
    assert.equal(state.globals.CombatBossFallbackVisible, false, 'production update forwards the terminal phase guard');
  } finally {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
  }
});
