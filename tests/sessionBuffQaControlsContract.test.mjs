import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recordFlowThreshold } from '../web-runner/src/core/personalFlow.mjs';
import { beginFreshSessionBuffQueue, chooseSessionLevelUpBuff, claimSessionBuffQueueResume, getSessionLevelUpBuffPresentation, reconcileSessionFlowThresholds } from '../web-runner/modules/sessionLevelUpBuffPresentation.mjs';
import { hasSessionLevelUpPresentationBarrier } from '../web-runner/src/core/turnGateController.mjs';

const hooks = readFileSync(new URL('../web-runner/systems/devBrowserTestHooks.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web-runner/app.js', import.meta.url), 'utf8');

test('Quest-QA AF controls are query-gated and use production callback seams', () => {
  assert.match(hooks, /new URLSearchParams\(window\.location\.search\)\.get\('questQA'\) === '1'/);
  assert.match(hooks, /qaSetHeroFlowReady\(Number\(qaHero\(\)\?\.uid \|\| 0\), String\(specialSelect\.value \|\| ''\)\)/);
  assert.match(hooks, /qaChooseAstralFlowSpecial\(String\(specialSelect\.value \|\| ''\)\)/);
  assert.match(hooks, /qaPauseResumeSessionBuffOffer\(\)/);
  assert.match(hooks, /QA set AF 100/);
  assert.match(hooks, /QA choose special/);
  assert.match(hooks, /QA offer pause\/resume/);
});

test('app QA entrypoints use canonical threshold, fan selection, and layout navigation', () => {
  assert.match(app, /recordFlowThreshold\(state\.globals, hero, before, hero\.flow\)/);
  assert.match(app, /combatRuntimeGateway\.runCombatStep\(fnContext, 'ProcessTurn'\)/);
  assert.match(app, /const selectHeroTurnCardFan = \(index, targetUID\) =>/);
  assert.match(app, /select: selectHeroTurnCardFan/);
  assert.match(app, /const result = selectHeroTurnCardFan\(index\);/);
  assert.match(app, /await storyEntry\.navigate\('Quests'\)/);
  assert.match(app, /await storyEntry\.continuePausedCombat\(\)/);
  assert.match(app, /QaPreferredAstralFlowSpecialId/);
});


test('app-boundary QA sequence opens, selects, resets, and resumes Fara’s AF special after the neutral party opening choice', () => {
  const party = [
    { uid: 1, kind: 'hero', heroInstanceKey: 'falie#1', baseHeroName: 'Falie', hp: 40, maxHP: 40, flow: 0, heroDisplaySlot: 0, currentLevel: 1 },
    { uid: 2, kind: 'hero', heroInstanceKey: 'huun#1', baseHeroName: 'Huun', hp: 35, maxHP: 35, flow: 0, heroDisplaySlot: 1, currentLevel: 1 },
    { uid: 3, kind: 'hero', heroInstanceKey: 'runa#1', baseHeroName: 'Runa', hp: 30, maxHP: 30, flow: 0, heroDisplaySlot: 2, currentLevel: 1 },
    { uid: 4, kind: 'hero', heroInstanceKey: 'kojonn#1', baseHeroName: 'Kojonn', hp: 45, maxHP: 45, flow: 0, heroDisplaySlot: 3, currentLevel: 1 },
  ];
  const globals = { CombatSessionId: 7, RuntimeRandom: () => 0, SessionLevelUpTierWeights: { 1: 1, 2: 0, 3: 0, 4: 0 } };
  beginFreshSessionBuffQueue(globals, party);
  const opening = getSessionLevelUpBuffPresentation(globals, party);
  assert.equal(chooseSessionLevelUpBuff(globals, party, opening.cards[0].cardId).status, 'applied');
  assert.equal(globals.SessionLevelUpQueue.status, 'complete');
  claimSessionBuffQueueResume(globals);
  globals.QaPreferredAstralFlowSpecialId = 'chain_strike_ii';
  const fara = party[0];
  const before = Math.min(99, Math.max(0, Number(fara.flow || 0)));
  fara.flow = 100;
  assert.ok(recordFlowThreshold(globals, fara, before, fara.flow));
  reconcileSessionFlowThresholds(globals, party);
  const fan = getSessionLevelUpBuffPresentation(globals, party);
  assert.equal(hasSessionLevelUpPresentationBarrier(globals), true);
  assert.deepEqual(fan.cards.map(card => card.specialId), ['crimson_ward', 'chain_strike_ii', 'magic_fruit']);
  assert.equal(fan.open, true);
  assert.equal(chooseSessionLevelUpBuff(globals, party, fan.cards[0].cardId, 0, () => ({ ok: true, effect: 'ward' })).status, 'applied');
  assert.equal(fara.flow, 0);
  assert.equal(hasSessionLevelUpPresentationBarrier(globals), false);
  assert.equal(claimSessionBuffQueueResume(globals), true);
  assert.equal(claimSessionBuffQueueResume(globals), false);
});

test('Quest-QA rails retain the compact heal, Dawn, and combat diagnostics controls', () => {
  assert.match(hooks, /QA fixture heal/);
  assert.match(hooks, /QA Dawn rank/);
  assert.match(hooks, /QA Dawn success/);
  assert.match(hooks, /QA Dawn equal fail/);
  assert.match(hooks, /QA Dawn defeat/);
  assert.match(hooks, /qaFixtureHeal\(\)/);
  assert.match(hooks, /qaGrantDawnChorus\(Number\(tierSelect\.value \|\| 1\)\)/);
  assert.match(app, /const qaFixtureHeal = \(\) =>/);
  assert.match(app, /const qaGrantDawnChorus = rank =>/);
  assert.match(app, /const qaSetDawnChorusRoll = equality =>/);
  assert.match(app, /const qaTriggerDawnChorusDefeat = \(\) =>/);
  assert.match(app, /ward: \{ remaining:/);
  assert.match(app, /kajaAF: \{/);
  assert.match(app, /dawnChorus: \{/);
});
