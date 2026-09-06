// Called only when creating a battle. Resurrection resumes the existing instance.
export function resetCombatSessionConditions(globals, gameState) {
  for (const key of Object.keys(globals)) {
    if (/^(PartyBuff_|BuffTurns_|BuffExpire_|BuffRoll|BuffIconPop|BuffProg|PartyTempHPShield|PartyWardBarrier|PowerAmp)/.test(key)) delete globals[key];
  }
  Object.assign(globals, {
    AstralFlowAmpPoints: 0, AstralFlowAmpReady: 0,
    AstralFlowKoOrbPresentationActive: 0, AstralFlowKoOrbPresentationPending: 0,
    AstralFlowKoOrbQueue: [], PartyRegens: [], TrackBuffs: [], PartyBuffSlots: [],
    PartyBuffUI: {}, EnemyDebuffs: {}, EnemyDebuffSlots: {}, EnemyDebuffTurns: {},
    EnemyDebuffPop: {}, EnemyDamageOverTime: [], HeroTempSkillStateByUID: {},
    EnemyGemLockActive: 0, EnemyGemLockGroups: {}, TaintedGroundZones: [],
    BlueBuffSequenceActive: 0, PendingDeaths: {}, PendingHeroHits: [],
    PendingSkillID: '', PendingActor: 0, PendingSuperGemAction: null,
    SelectedEnemyUID: 0, SelectedEnemyUIDOwner: 0, PendingManualTargetIntent: null,
    DamageTexts: [], ChainStrikeVisuals: [], ArcanePulseVisuals: [],
  });
  delete globals.HeroAction;
  delete globals.EnemyAction;
  delete gameState.partyHpTextRoll;
  delete gameState.healBlooms;
  gameState._lastPartyRegenTurnSerial = null;
}
