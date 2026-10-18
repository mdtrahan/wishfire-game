import { resetRealtimeSkillAttempt } from '../src/core/realtimeSkillState.mjs';
import { resetActorPuppetDefeats } from './actorPuppetDefeats.mjs';
// Called only when creating a battle. Resurrection resumes the existing instance.
// A continuing adventure carries its chosen buffs into its next battle; terminal
// callers use the default and clear them with the rest of the session state.
export function resetCombatSessionConditions(globals, gameState, entities = []) {
  resetActorPuppetDefeats(globals);
  resetRealtimeSkillAttempt(globals,entities);
  for (const key of [
    'AstralFlowAmpPoints', 'AstralFlowAmpReady', 'AstralFlowWallet', 'FlowOrbs',
    'FlowOrbSerial', 'FlowThresholdSerial', 'PendingFlowThresholds',
    'AstralFlowKoOrbPresentationActive', 'AstralFlowKoOrbPresentationPending', 'AstralFlowKoOrbQueue',
    'QaLastAstralFlowSpecial', 'LastAstralFlowSpecial', 'FlowOrbAudit',
    'LastAstralFlowChainStrikeII', 'AstralFlowMagicFruitLast', 'AstralFlowDestinyRegensByUID',
  ]) delete globals[key];
  for (const key of Object.keys(globals)) {
    if (/^(PartyBuff_|BuffTurns_|BuffExpire_|BuffRoll|BuffIconPop|BuffProg|PartyTempHPShield|PartyWardBarrier|PowerAmp)/.test(key)) delete globals[key];
  }
  Object.assign(globals, {
    PartyRegens: [], TrackBuffs: [], PartyBuffSlots: [],
    PartyBuffUI: {}, EnemyDebuffs: {}, EnemyDebuffSlots: {}, EnemyDebuffTurns: {},
    EnemyDebuffPop: {}, EnemyDamageOverTime: [], HeroTempSkillStateByUID: {},
    RealtimeSkillEffects: {}, RealtimeSkillZones: [],
    EnemyGemLockActive: 0, EnemyGemLockGroups: {}, TaintedGroundZones: [],
    BlueBuffSequenceActive: 0, PendingDeaths: {}, PendingHeroHits: [],
    // A new encounter may retain selected session buffs, never an outgoing
    // action or its animation gates. BattleStartActive owns its short intro
    // hold after this reset and releases into an otherwise idle scheduler.
    IsPlayerBusy: 0, ActionInProgress: 0, ActionActorUID: 0, ActionOwnerUID: 0,
    ActionLockUntil: 0, DeferAdvance: 0, AdvanceAfterAction: 0, GroupResolving: 0,
    TextAnimEndAt: 0,
    SessionLevelUpSettlement: null,
    PendingSkillID: '', PendingActor: 0, PendingSuperGemAction: null,
    SelectedEnemyUID: 0, SelectedEnemyUIDOwner: 0, PendingManualTargetIntent: null,
    DamageTexts: [], ChainStrikeVisuals: [], ArcanePulseVisuals: [], CombatImpactRequests: [], CombatImpactVisuals: [], CombatProjectileVisuals: [],
    Gems: [], BoardFillActive: 0, TapIndex: 0,
  });
  Object.assign(gameState, {
    gems: [], grid: [], boardCreated: false, selectedGems: [], selectionLocked: false,
    superGems: [], refillBounce: null, gemMergeFx: null, yellowCasino: null,
    heroCommandsMenuOpen: false,
  });
  delete globals.HeroAction;
  delete globals.EnemyAction;
  delete globals.RealtimeHeroBasicReadyAt;
  delete globals.RealtimeHeroBasicClocks;
  delete globals.RealtimeHeroBasicScheduledActions;
  delete globals.RealtimeEnemyActionReadyAt;
  delete globals.RealtimeEnemyActionsByUID;
  // QA readouts mirror live combat state and must never survive abandonment or
  // a fresh session. Encounter continuation deliberately retains session buffs.
  for (const key of [
    'QaFixtureHeal', 'QaEnemyLowHpFixture',
    'LastPartyChainStrike',
    'PartyChainStrikeIIProcs', 'PartyChainStrikeIProcs', 'AstralFlowMagicFruitLast',
    'LastCrimsonWard', 'QaDawnRollArmed',
    'LastPartyWardBarrierAbsorbed', 'LastPartyWardBarrierHitUID',
    'PartyWardBarrierFadeOutUntil', 'PartyTempHPShield',
    'QaScenarioPaused', 'QaScenarioResetCount', 'QaSelectedHeroUID',
  ]) delete globals[key];
  delete gameState.partyHpTextRoll;
  delete gameState.healBlooms;
  gameState._lastPartyRegenTurnSerial = null;
}

// StoryEntry keeps the combat screen masked until its reveal has completed.
// The initializer owns the busy hold during that interval; this is its single
// release point before a fresh scheduler may process its first turn.
export function releaseCombatStartToScheduler(globals) {
  if (globals.BattleStartProcessStarted) return false;
  globals.BattleStartActive = 0;
  globals.BattleStartClearedForSession = 1;
  globals.BattleStartProcessStarted = 1;
  globals.IsPlayerBusy = 0;
  return true;
}
