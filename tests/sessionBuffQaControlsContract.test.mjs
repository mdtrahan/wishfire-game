import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recordFlowThreshold } from '../web-runner/src/core/personalFlow.mjs';
import { beginFreshSessionBuffQueue, chooseSessionLevelUpBuff, claimSessionBuffQueueResume, getSessionLevelUpBuffPresentation, reconcileSessionFlowThresholds, SESSION_LEVEL_UP_BUFF_CARDS } from '../web-runner/modules/sessionLevelUpBuffPresentation.mjs';
import { hasSessionLevelUpPresentationBarrier } from '../web-runner/src/core/turnGateController.mjs';
import { resetCombatSessionConditions } from '../web-runner/systems/combatSessionReset.mjs';

const hooks = readFileSync(new URL('../web-runner/systems/devBrowserTestHooks.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web-runner/app.js', import.meta.url), 'utf8');
const devTooling = readFileSync(new URL('../web-runner/systems/devToolingRuntime.js', import.meta.url), 'utf8');
const renderRuntime = readFileSync(new URL('../web-runner/systems/renderRuntime.js', import.meta.url), 'utf8');

test('Quest-QA AF controls are query-gated and use production callback seams', () => {
  assert.match(hooks, /new URLSearchParams\(window\.location\.search\)\.get\('questQA'\) === '1'/);
  assert.match(hooks, /qaSetHeroFlowReady\(Number\(qaHero\(\)\?\.uid \|\| 0\), String\(specialSelect\.value \|\| ''\)\)/);
  assert.match(hooks, /qaChooseAstralFlowSpecial\(String\(specialSelect\.value \|\| ''\)\)/);
  assert.match(hooks, /qaPauseResumeSessionBuffOffer\(\)/);
  assert.match(hooks, /QA set AF 100/);
  assert.match(hooks, /QA choose special/);
  assert.match(hooks, /QA run special/);
  assert.match(hooks, /QA fresh session/);
  assert.match(hooks, /QA resume/);
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
  assert.match(app, /const qaResetScenario = async \(\) =>/);
  assert.match(app, /await layoutState\.requestLayoutChange\('combat', 'quest-qa-scenario-reset'\)/);
  assert.match(app, /pauseGameplayForDevTooling\(\)/);
  assert.match(app, /const qaResumeScenario = \(\) =>/);
  assert.match(app, /const qaRunAstralFlowSpecial = \(heroUID, specialId\) =>/);
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
  assert.match(hooks, /QA Dawn forced success/);
  assert.match(hooks, /QA Dawn forced equal/);
  assert.match(hooks, /QA Dawn defeat/);
  assert.match(hooks, /qaFixtureHeal\(\)/);
  assert.match(hooks, /qaGrantDawnChorus\(Number\(tierSelect\.value \|\| 1\)\)/);
  assert.match(app, /const qaFixtureHeal = \(\) =>/);
  assert.match(app, /const qaGrantDawnChorus = rank =>/);
  assert.match(app, /const qaSetDawnChorusRoll = equality =>/);
  assert.match(app, /const qaTriggerDawnChorusDefeat = \(\) =>/);
  assert.match(app, /ward: \{ remaining:/);
  assert.match(app, /kajaAF: state\.globals\.QaKajaFlowAudit/);
  assert.match(app, /dawnChorus: \{/);
  assert.match(app, /requiredOrder: 'rank → forced roll → defeat'/);
  assert.match(app, /if \(!state\.globals\.QaDawnRollArmed\) return \{ ok: false, reason: 'forcedRollRequired' \}/);
});
test('Quest-QA enemy basic uses the production damage resolver and refuses active card choices', () => {
 const app=readFileSync(new URL('../web-runner/app.js',import.meta.url),'utf8');const hooks=readFileSync(new URL('../web-runner/systems/devBrowserTestHooks.js',import.meta.url),'utf8');
 assert.match(app,/const qaResolveEnemyBasicHit = heroUID =>/);assert.match(app,/const guard = qaScenarioPauseGuard\(\)/);assert.match(app,/reason: 'choiceActive'/);assert.match(app,/ApplyDamageToTarget', target\.uid, requested, \{ sourceUID: enemy\.uid \}/);assert.match(hooks,/QA enemy basic/);assert.doesNotMatch(hooks,/QA choose special failed/);
});

test('AF threshold offers ignore a stale generic QA fixture pool', () => {
  const party = [{ uid: 1, kind: 'hero', heroInstanceKey: 'falie#1', baseHeroName: 'Falie', hp: 40, maxHP: 40, flow: 0, currentLevel: 1 }];
  const globals = { CombatSessionId: 4, RuntimeRandom: () => 0 };
  beginFreshSessionBuffQueue(globals, party);
  const opening = getSessionLevelUpBuffPresentation(globals, party);
  assert.equal(chooseSessionLevelUpBuff(globals, party, opening.cards[0].cardId).status, 'applied');
  claimSessionBuffQueueResume(globals);
  globals.SessionLevelUpQaOfferCards = [SESSION_LEVEL_UP_BUFF_CARDS.find(card => card.cardId === 'dune_edge_1')];
  globals.QaPreferredAstralFlowSpecialId = 'chain_strike_ii';
  party[0].flow = 100;
  recordFlowThreshold(globals, party[0], 99, 100);
  reconcileSessionFlowThresholds(globals, party);
  const offer = getSessionLevelUpBuffPresentation(globals, party);
  assert.equal(offer.cards[0].presentation.kind, 'hero_signature');
  assert.ok(offer.cards.some(card => card.specialId === 'chain_strike_ii'));
  assert.equal(offer.cards.some(card => card.cardId === 'dune_edge_1'), false);
});

test('fresh combat reset clears prior QA effects while a new opening offer remains legitimate', () => {
  const globals = {
    CombatSessionId: 9, QaLastAstralFlowSpecial: { id: 'magic_fruit' }, LastAstralFlowSpecial: { id: 'chain_strike_ii' },
    LastAstralFlowChainStrikeII: { hitCount: 3 }, LastCrimsonWard: { added: 40 }, QaEnemyBasicHit: { applied: 2 },
    FlowOrbAudit: { roleRecipientUID: 2 }, QaKajaFlowAudit: { count: 9 }, QaDawnRollArmed: 1, DawnChorusLastRoll: { chance: .1 },
    PartyTempHPShield: 18, LastPartyWardBarrierAbsorbed: 7, LastPartyWardBarrierHitUID: 4, PartyWardBarrierFadeOutUntil: 91,
  };
  resetCombatSessionConditions(globals, {});
  for (const key of ['QaLastAstralFlowSpecial', 'LastAstralFlowSpecial', 'LastAstralFlowChainStrikeII', 'LastCrimsonWard', 'QaEnemyBasicHit', 'FlowOrbAudit', 'QaKajaFlowAudit', 'QaDawnRollArmed', 'DawnChorusLastRoll', 'PartyTempHPShield', 'LastPartyWardBarrierAbsorbed', 'LastPartyWardBarrierHitUID', 'PartyWardBarrierFadeOutUntil']) assert.equal(globals[key], undefined);
  const party = [{ uid: 1, kind: 'hero', heroInstanceKey: 'falie#1', baseHeroName: 'Falie', hp: 40, maxHP: 40 }];
  globals.RuntimeRandom = () => 0;
  beginFreshSessionBuffQueue(globals, party);
  assert.ok(getSessionLevelUpBuffPresentation(globals, party).cards.length > 0);
});

test('Quest-QA scenario pause preserves the combat presentation and reports isolated Kaja awards', () => {
  assert.match(app, /gameState\.storyEntry\.phase = 'combat'/);
  assert.match(app, /QaKajaFlowAudit = \{ source: 'resolved-action', recipientUID: 4, count: 0/);
  assert.match(app, /count: Number\(priorKajaAudit\.count \|\| 0\) \+ \(kajaDelta > 0 \? 1 : 0\)/);
  assert.match(app, /hondoBefore, hondoAfter/);
  assert.match(app, /roleGainGemCount:/);
  assert.match(app, /enemyDeathGemCount: 0/);
  assert.match(app, /reason: 'combatLayoutRequired'/);
  assert.match(app, /reason: 'choiceRequired'/);
  assert.match(hooks, /result\.reason !== 'choiceActive'/);
  assert.match(hooks, /Promise\.resolve\(\)[\s\S]*\.then\(action\)[\s\S]*\.catch\(error => renderAfReadout/);
  assert.match(devTooling, /else if \(state\.globals\.QaScenarioPaused\)/);
  assert.match(devTooling, /if \(state\.globals\.QaScenarioPaused\) state\.globals\.DevToolingPaused = 1/);
  assert.match(renderRuntime, /DevToolingPaused && !\(state\.globals\.QaScenarioPaused && state\.globals\.QaFixtureHoldTurn\)/);
});

test('transactional QA heal measures the production HP delta before its bloom is emitted', () => {
  const healStart = app.indexOf('const qaFixtureHeal = () =>');
  const healEnd = app.indexOf('const qaGrantDawnChorus = rank =>', healStart);
  const body = app.slice(healStart, healEnd);
  assert.ok(body.indexOf('const before = Number(selected.hp || 0)') < body.indexOf("'DoHeal', selected.uid"));
  assert.ok(body.indexOf("'DoHeal', selected.uid") < body.indexOf('const after = Number(selected.hp || 0)'));
  assert.match(body, /actualDelta: Math\.max\(0, after - before\)/);
  assert.doesNotMatch(body.slice(body.indexOf('const before = Number(selected.hp || 0)')), /selected\.hp\s*=/);
});
