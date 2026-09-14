import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  assert.match(app, /heroTurnCardFanUI\.select\(index\)/);
  assert.match(app, /await storyEntry\.navigate\('Quests'\)/);
  assert.match(app, /await storyEntry\.continuePausedCombat\(\)/);
  assert.match(app, /QaPreferredAstralFlowSpecialId/);
});
