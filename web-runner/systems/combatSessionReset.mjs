// Called only when creating a battle. Resurrection resumes the existing instance.
// A continuing adventure carries its chosen buffs into its next battle; terminal
// callers use the default and clear them with the rest of the session state.
export function resetCombatSessionConditions(globals, gameState, { preserveSessionLevelBuffs = false } = {}) {
  const retainedSessionLevelBuffState = preserveSessionLevelBuffs
    ? globals.SessionLevelBuffState
    : { heroes: {} };
  for (const key of Object.keys(globals)) {
    if (/^(PartyBuff_|BuffTurns_|BuffExpire_|BuffRoll|BuffIconPop|BuffProg|PartyTempHPShield|PartyWardBarrier|PowerAmp)/.test(key)) delete globals[key];
  }
  Object.assign(globals, {
    AstralFlowAmpPoints: 0, AstralFlowAmpReady: 0,
    FlowOrbs: [], FlowOrbSerial: 0, FlowThresholdSerial: 0, PendingFlowThresholds: [], NativeCommandSequence: null, SessionSkillsByHeroUID: {},
    HeroTurnCardFanOpen: 0, HeroTurnCardFanHeroUID: 0, HeroTurnCardFanCards: [],
    HeroTurnCardFanStateByHeroName: {}, HeroTurnCardFanSessionId: Number(globals.CombatSessionId || 0),
    HeroTurnCardFanTurnSerial: 0, HeroTurnCardFanSelectedCardId: '', HeroTurnCardFanTargetUID: 0,
    HeroTurnCardFanPendingCardIndex: -1, HeroTurnCardFanPendingCardId: '', HeroTurnCardFanPendingTarget: 0, HeroTurnCardFanPendingTargetKind: '', HeroTurnCardFanPendingExcludeSelf: 0, HeroTurnCardFanBlockedCardId: '',
    SkillDraughtOpen: 0, SkillDraughtPendingOpen: 0, SkillDraughtCandidates: [], SkillDraughtHitZones: [],
    AstralFlowKoOrbPresentationActive: 0, AstralFlowKoOrbPresentationPending: 0,
    AstralFlowKoOrbQueue: [], PartyRegens: [], TrackBuffs: [], PartyBuffSlots: [],
    PartyBuffUI: {}, EnemyDebuffs: {}, EnemyDebuffSlots: {}, EnemyDebuffTurns: {},
    EnemyDebuffPop: {}, EnemyDamageOverTime: [], HeroTempSkillStateByUID: {},
    EnemyGemLockActive: 0, EnemyGemLockGroups: {}, TaintedGroundZones: [],
    BlueBuffSequenceActive: 0, PendingDeaths: {}, PendingHeroHits: [],
    // A new encounter may retain selected session buffs, never an outgoing
    // action or its animation gates. BattleStartActive owns its short intro
    // hold after this reset and releases into an otherwise idle scheduler.
    IsPlayerBusy: 0, ActionInProgress: 0, ActionActorUID: 0, ActionOwnerUID: 0,
    ActionLockUntil: 0, DeferAdvance: 0, AdvanceAfterAction: 0, GroupResolving: 0,
    TextAnimEndAt: 0,
    SessionLevelUpQueue: { version: 1, status: 'complete', paused: false, currentIndex: 0, entries: [] },
    SessionLevelBuffState: retainedSessionLevelBuffState || { heroes: {} }, SessionLevelUpOffersByQueueIndex: {}, SessionLevelUpSettlement: null, SessionLevelUpQueuedFlowThresholdTokens: [], SessionLevelUpQueueResumeRequested: 0,
    PendingSkillID: '', PendingActor: 0, PendingSuperGemAction: null,
    SelectedEnemyUID: 0, SelectedEnemyUIDOwner: 0, PendingManualTargetIntent: null,
    DamageTexts: [], ChainStrikeVisuals: [], ArcanePulseVisuals: [], CombatImpactVisuals: [], SessionBuffCombatVisuals: [],
    Gems: [], BoardFillActive: 0, TapIndex: 0,
  });
  Object.assign(gameState, {
    gems: [], grid: [], boardCreated: false, selectedGems: [], selectionLocked: false,
    superGems: [], refillBounce: null, gemMergeFx: null, yellowCasino: null,
    heroCommandsMenuOpen: false,
  });
  delete globals.HeroAction;
  delete globals.EnemyAction;
  delete globals.SessionLevelBuffCombatSessionId;
  // QA readouts mirror live combat state and must never survive abandonment or
  // a fresh session. Encounter continuation deliberately retains session buffs.
  for (const key of [
    'QaLastAstralFlowSpecial', 'LastAstralFlowSpecial', 'QaFixtureHeal', 'QaEnemyLowHpFixture', 'QaEnemyBasicHit',
    'FlowOrbAudit', 'QaKajaFlowAudit', 'LastPartyChainStrike', 'LastAstralFlowChainStrikeII',
    'PartyChainStrikeIIProcs', 'PartyChainStrikeIProcs', 'AstralFlowMagicFruitLast',
    'AstralFlowDestinyRegensByUID', 'LastCrimsonWard', 'QaDawnRollArmed',
    'LastPartyWardBarrierAbsorbed', 'LastPartyWardBarrierHitUID',
    'PartyWardBarrierFadeOutUntil', 'PartyTempHPShield',
    'QaScenarioPaused', 'QaScenarioResetCount', 'QaSelectedHeroUID',
  ]) delete globals[key];
  if (!preserveSessionLevelBuffs) {
    for (const key of ['DawnChorusAttempted', 'DawnChorusSucceeded', 'DawnChorusLastRoll', 'DawnChorusOwnedRank', 'QaPreferredAstralFlowSpecialId']) delete globals[key];
  }
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
