import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recordFlowThreshold } from '../web-runner/src/core/personalFlow.mjs';
import { beginFreshSessionBuffQueue, chooseSessionLevelUpBuff, claimSessionBuffQueueResume, getSessionLevelUpBuffPresentation, reconcileSessionFlowThresholds, SESSION_LEVEL_UP_BUFF_CARDS } from '../web-runner/modules/sessionLevelUpBuffPresentation.mjs';
import { COMBAT_CHOICE_MODE, createSessionOfferInputGate, deriveCombatChoiceInput, deriveCombatChoiceMode, hasSessionLevelUpPresentationBarrier, releaseSessionOfferInputGate } from '../web-runner/src/core/turnGateController.mjs';
import { resetCombatSessionConditions } from '../web-runner/systems/combatSessionReset.mjs';

const hooks = readFileSync(new URL('../web-runner/systems/devBrowserTestHooks.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web-runner/app.js', import.meta.url), 'utf8');
const devTooling = readFileSync(new URL('../web-runner/systems/devToolingRuntime.js', import.meta.url), 'utf8');
const renderRuntime = readFileSync(new URL('../web-runner/systems/renderRuntime.js', import.meta.url), 'utf8');
const functionBank = readFileSync(new URL('../web-runner/modules/functionBank.js', import.meta.url), 'utf8');

function extractExportedFunction(source, name) {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `missing ${name}`);
  const braceStart = source.indexOf(') {', start) + 2;
  assert.ok(braceStart > 1, `missing body for ${name}`);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start + 'export '.length, index + 1);
  }
  assert.fail(`unterminated ${name}`);
}

const applyQaEnemyLowHpFixture = new Function(`${extractExportedFunction(hooks, 'applyQaEnemyLowHpFixture')}; return applyQaEnemyLowHpFixture;`)();

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
  assert.match(hooks, /QA live Kaja Destiny/);
});

test('Destiny turn healing cannot block the native command it accompanies', () => {
  const processTurn = extractExportedFunction(functionBank, 'ProcessTurn');
  assert.ok(processTurn.indexOf('HeroTurn(ctx, uid)') < processTurn.indexOf('processAstralFlowDestinyAtHeroTurn(ctx, uid)'));
});

test('app QA entrypoints use canonical threshold, fan selection, and layout navigation', () => {
  assert.match(app, /recordFlowThreshold\(state\.globals, hero, before, hero\.flow\)/);
  assert.match(app, /combatRuntimeGateway\.runCombatStep\(fnContext, 'ProcessTurn'\)/);
  assert.match(app, /const selectHeroTurnCardFan = \(index, offerToken = ''\) =>/);
  assert.match(app, /select: selectHeroTurnCardFan/);
  assert.match(app, /deriveCombatChoiceMode\(state\.globals\) === COMBAT_CHOICE_MODE\.OFFER/);
  assert.match(app, /if \(deriveCombatChoiceMode\(state\.globals\) === COMBAT_CHOICE_MODE\.OFFER\) return;/);
  assert.match(app, /await storyEntry\.navigate\('Quests'\)/);
  assert.match(app, /await storyEntry\.continuePausedCombat\(\)/);
  assert.match(app, /QaPreferredAstralFlowSpecialId/);
  assert.match(app, /const qaResetScenario = async \(\) =>/);
  assert.match(app, /await layoutState\.requestLayoutChange\('combat', 'quest-qa-scenario-reset'\)/);
  assert.match(app, /pauseGameplayForDevTooling\(\)/);
  assert.match(app, /const qaResumeScenario = \(\) =>/);
  assert.match(app, /const qaRunAstralFlowSpecial = \(heroUID, specialId\) =>/);
  assert.match(app, /const scheduledChainHits = \(state\.globals\.PendingHeroHits \|\| \[\]\)\.filter/);
  assert.match(app, /scheduledChainHits\.length === Number\(execution\?\.hitCount \|\| 0\)/);
});

test('a session offer owns input, rejects stale selection, and preserves its existing scheduler handoff', () => {
  const party = [
    { uid: 1, kind: 'hero', heroInstanceKey: 'fara-1', heroDisplaySlot: 0, hp: 40, maxHP: 40, flow: 0 },
    { uid: 2, kind: 'hero', heroInstanceKey: 'hondo-2', heroDisplaySlot: 1, hp: 35, maxHP: 35, flow: 0 },
  ];
  const globals = {
    RuntimeRandom: () => 0,
    SessionLevelUpTierWeights: { 1: 1, 2: 0, 3: 0, 4: 0 },
    IsPlayerBusy: 1,
    DeferAdvance: 1,
    AdvanceAfterAction: 1,
    ActionLockUntil: 999,
    ActionOwnerUID: 2,
    ActionInProgress: 1,
    ActionActorUID: 2,
    HeroTurnCardFanOpen: 1,
    HeroTurnCardFanCards: [{ cardId: 'retired' }],
    HeroTurnCardFanPendingTarget: 1,
    HeroTurnCardFanPendingTargetKind: 'enemy',
    PendingSkillID: 'retired_attack',
    SelectedAllyUID: 2,
    SelectedEnemyUIDOwner: 1,
  };
  beginFreshSessionBuffQueue(globals, party);
  const offer = getSessionLevelUpBuffPresentation(globals, party);
  assert.equal(deriveCombatChoiceMode(globals), COMBAT_CHOICE_MODE.OFFER);
  assert.equal(deriveCombatChoiceInput(globals).acceptsBattlefieldTarget, false);
  assert.equal(globals.HeroTurnCardFanOpen, 0);
  assert.deepEqual(globals.HeroTurnCardFanCards, []);
  assert.equal(globals.PendingSkillID, '');
  assert.equal(globals.IsPlayerBusy, 0);
  assert.equal(globals.ActionInProgress, 0);
  assert.equal(globals.ActionActorUID, 0);
  assert.equal(globals.ActionLockUntil, 0);
  assert.equal(globals.DeferAdvance, 1);
  assert.equal(globals.AdvanceAfterAction, 1);
  assert.equal(globals.ActionOwnerUID, 2);
  const before = JSON.stringify(globals.SessionLevelUpQueue);
  assert.deepEqual(chooseSessionLevelUpBuff(globals, party, offer.cards[0].cardId, 0, null, 'stale-token'), { status: 'rejected', reason: 'staleOffer' });
  assert.equal(JSON.stringify(globals.SessionLevelUpQueue), before);
  assert.equal(chooseSessionLevelUpBuff(globals, party, offer.cards[0].cardId, 0, null, offer.offerToken).status, 'applied');
  assert.equal(claimSessionBuffQueueResume(globals), false);
  assert.equal(globals.IsPlayerBusy, 0);
  assert.equal(globals.ActionInProgress, 0);
  assert.equal(deriveCombatChoiceMode(globals), COMBAT_CHOICE_MODE.AUTOCOMBAT);
  assert.equal(deriveCombatChoiceInput({ PendingSkillID: 'native_skill', TurnPhase: 1 }).acceptsBattlefieldTarget, true);
  const isolated = createSessionOfferInputGate({ HeroTurnCardFanOpen: 1 }, 'current');
  assert.equal(isolated.SessionOfferInputToken, 'current');
  const resumed = releaseSessionOfferInputGate({
    IsPlayerBusy: 1, ActionInProgress: 1, ActionActorUID: 2, ActionLockUntil: 999,
    DeferAdvance: 1, AdvanceAfterAction: 1, ActionOwnerUID: 2,
  });
  assert.equal(resumed.IsPlayerBusy, 0);
  assert.equal(resumed.ActionInProgress, 0);
  assert.equal(resumed.ActionActorUID, 0);
  assert.equal(resumed.ActionLockUntil, 0);
  assert.equal(resumed.DeferAdvance, 1);
  assert.equal(resumed.AdvanceAfterAction, 1);
  assert.equal(resumed.ActionOwnerUID, 2);
  const qaResume = app.slice(app.indexOf('const qaResumeScenario = () =>'), app.indexOf('const qaSetHeroFlowReady', app.indexOf('const qaResumeScenario = () =>')));
  assert.ok(qaResume.indexOf('resumeGameplayFromDevTooling()') < qaResume.indexOf('releaseSessionOfferInputGate(state.globals)'));
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
  assert.match(hooks, /QA enemies 1 HP/);
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
  assert.match(app, /kajaAF: \{ \.\.\.kajaAudit, enemyDeathGemCount:/);
  assert.match(app, /dawnChorus: \{/);
  assert.match(app, /requiredOrder: 'rank → forced roll → defeat'/);
  assert.match(app, /if \(!state\.globals\.QaDawnRollArmed\) return \{ ok: false, reason: 'forcedRollRequired' \}/);
});

test('Quest-QA enemy low-HP fixture refuses invalid states without mutation', () => {
  const entities = [{ uid: 1, kind: 'hero', hp: 20 }, { uid: 11, kind: 'enemy', hp: 30, maxHP: 30 }];
  const snapshot = JSON.parse(JSON.stringify(entities));
  assert.equal(applyQaEnemyLowHpFixture({ globals: {}, entities }).reason, 'scenarioNotPaused');
  const paused = { QaScenarioPaused: 1, QaFixtureHoldTurn: 1, DevToolingPaused: 1 };
  assert.equal(applyQaEnemyLowHpFixture({ globals: paused, entities, choiceActive: true }).reason, 'choiceActive');
  assert.equal(applyQaEnemyLowHpFixture({ globals: { ...paused, ProgressionBattle: { outcome: 'defeat' } }, entities }).reason, 'defeatAlreadySettled');
  assert.equal(applyQaEnemyLowHpFixture({ globals: paused, entities: [entities[0]] }).reason, 'noLivingEnemies');
  assert.deepEqual(entities, snapshot);
});

test('Quest-QA enemy low-HP fixture changes only living enemy current HP and records evidence', () => {
  const globals = {
    QaScenarioPaused: 1, QaFixtureHoldTurn: 1, DevToolingPaused: 1,
    FlowOrbs: [{ id: 8 }], FlowOrbAudit: { queuedEnemyDeathCount: 1 },
    DamageTexts: [{ amount: 4 }], ChainStrikeVisuals: [{ id: 3 }], goldTotal: 12,
  };
  const entities = [
    { uid: 1, kind: 'hero', hp: 20, maxHP: 20, flow: 40 },
    { uid: 11, kind: 'enemy', hp: 30, maxHP: 30, x: 100, y: 40, name: 'A', isAlive: true, pendingOfficialDeath: 0 },
    { uid: 12, kind: 'enemy', hp: 7, maxHP: 50, x: 120, y: 60, name: 'B', isAlive: true, pendingOfficialDeath: 0 },
    { uid: 13, kind: 'enemy', hp: 0, maxHP: 80, x: 140, y: 80, name: 'C', isAlive: false, pendingOfficialDeath: 1 },
  ];
  const sideEffectsBefore = JSON.parse(JSON.stringify({
    FlowOrbs: globals.FlowOrbs, FlowOrbAudit: globals.FlowOrbAudit, DamageTexts: globals.DamageTexts,
    ChainStrikeVisuals: globals.ChainStrikeVisuals, goldTotal: globals.goldTotal,
  }));
  const result = applyQaEnemyLowHpFixture({ globals, entities });
  assert.deepEqual(result, {
    ok: true,
    affectedUIDs: [11, 12],
    hpChanges: [{ uid: 11, beforeHP: 30, afterHP: 1 }, { uid: 12, beforeHP: 7, afterHP: 1 }],
  });
  assert.deepEqual(entities, [
    { uid: 1, kind: 'hero', hp: 20, maxHP: 20, flow: 40 },
    { uid: 11, kind: 'enemy', hp: 1, maxHP: 30, x: 100, y: 40, name: 'A', isAlive: true, pendingOfficialDeath: 0 },
    { uid: 12, kind: 'enemy', hp: 1, maxHP: 50, x: 120, y: 60, name: 'B', isAlive: true, pendingOfficialDeath: 0 },
    { uid: 13, kind: 'enemy', hp: 0, maxHP: 80, x: 140, y: 80, name: 'C', isAlive: false, pendingOfficialDeath: 1 },
  ]);
  assert.deepEqual({
    FlowOrbs: globals.FlowOrbs, FlowOrbAudit: globals.FlowOrbAudit, DamageTexts: globals.DamageTexts,
    ChainStrikeVisuals: globals.ChainStrikeVisuals, goldTotal: globals.goldTotal,
  }, sideEffectsBefore);
  assert.deepEqual(globals.QaEnemyLowHpFixture, result);
  assert.match(app, /enemyLowHp: state\.globals\.QaEnemyLowHpFixture \|\| null/);
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
    LastAstralFlowChainStrikeII: { hitCount: 3 }, LastCrimsonWard: { added: 40 }, QaEnemyLowHpFixture: { affectedUIDs: [11] }, QaEnemyBasicHit: { applied: 2 },
    FlowOrbAudit: { roleRecipientUID: 2 }, QaKajaFlowAudit: { count: 9 }, QaDawnRollArmed: 1, DawnChorusLastRoll: { chance: .1 },
    PartyTempHPShield: 18, LastPartyWardBarrierAbsorbed: 7, LastPartyWardBarrierHitUID: 4, PartyWardBarrierFadeOutUntil: 91,
  };
  resetCombatSessionConditions(globals, {});
  for (const key of ['QaLastAstralFlowSpecial', 'LastAstralFlowSpecial', 'LastAstralFlowChainStrikeII', 'LastCrimsonWard', 'QaEnemyLowHpFixture', 'QaEnemyBasicHit', 'FlowOrbAudit', 'QaKajaFlowAudit', 'QaDawnRollArmed', 'DawnChorusLastRoll', 'PartyTempHPShield', 'LastPartyWardBarrierAbsorbed', 'LastPartyWardBarrierHitUID', 'PartyWardBarrierFadeOutUntil']) assert.equal(globals[key], undefined);
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
  assert.match(app, /queuedEnemyDeathCount/);
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
