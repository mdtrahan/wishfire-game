import { serializeQaPauseCombatSnapshot } from '../src/core/qaPauseSnapshot.mjs';
import { canUseHeroCommand, rulesContext, settleVictory } from '../modules/heroCommands.mjs';
import { derivePresentationTurnBarrier } from '../src/core/turnGateController.mjs';
import { isActorRecoveryRevealActive } from '../src/core/actorPresentationState.mjs';

export const QA_STORY_TRANSITION_TIMEOUT_MS = 2400;

export function applyQaEnemyLowHpFixture({ globals = {}, entities = [], choiceActive = false } = {}) {
  if (!(globals.QaScenarioPaused && globals.QaFixtureHoldTurn && globals.DevToolingPaused)) return { ok: false, reason: 'scenarioNotPaused' };
  if (choiceActive) return { ok: false, reason: 'choiceActive' };
  const heroes = entities.filter(actor => actor?.kind === 'hero');
  if (globals.ProgressionBattle?.outcome === 'defeat' || (heroes.length > 0 && heroes.every(hero => Number(hero.hp || 0) <= 0))) return { ok: false, reason: 'defeatAlreadySettled' };
  const enemies = entities.filter(actor => actor?.kind === 'enemy' && Number(actor.hp || 0) > 0 && actor.isAlive !== false && !Number(actor.pendingOfficialDeath || 0));
  if (!enemies.length) return { ok: false, reason: 'noLivingEnemies' };
  const hpChanges = enemies.map(enemy => ({ uid: Number(enemy.uid || 0), beforeHP: Number(enemy.hp || 0), afterHP: 1 }));
  for (const enemy of enemies) enemy.hp = 1;
  const result = { ok: true, affectedUIDs: hpChanges.map(change => change.uid), hpChanges };
  globals.QaEnemyLowHpFixture = result;
  return result;
}

export function deriveQaSettlementReward({ threshold, currentEXP, overflow = false, noLevel = false } = {}) {
  const liveThreshold = Math.max(1, Math.floor(Number(threshold) || 0));
  const liveCurrentEXP = Math.max(0, Math.floor(Number(currentEXP) || 0));
  if (liveCurrentEXP >= liveThreshold) {
    throw new Error(`QA settlement requires EXP below its live threshold: ${liveCurrentEXP}/${liveThreshold}`);
  }
  const remaining = liveThreshold - liveCurrentEXP;
  if (noLevel) {
    if (remaining <= 1) throw new Error(`QA no-level settlement needs room below its live threshold: ${liveCurrentEXP}/${liveThreshold}`);
    return Math.max(1, Math.min(27, remaining - 1));
  }
  return overflow ? remaining + 27 : 80;
}

export function qaSettlementQuiescenceSnapshot(globals = {}) {
  const presentation = derivePresentationTurnBarrier({ globals });
  const observed = {
    actionInProgress: !!globals.ActionInProgress,
    playerBusy: !!globals.IsPlayerBusy,
    pendingHeroHits: Array.isArray(globals.PendingHeroHits) ? globals.PendingHeroHits.length : 0,
    presentationClear: presentation.presentationClear,
    presentationBlocker: presentation.blockingLane,
    turnPhase: Number(globals.TurnPhase || 0),
    deferAdvance: !!globals.DeferAdvance,
    nativeBattleEnded: !!globals.NativeBattleEnded,
    progressionOutcome: String(globals.ProgressionBattle?.outcome || ''),
  };
  return { ok: !observed.actionInProgress && !observed.playerBusy && observed.pendingHeroHits === 0 && observed.presentationClear, observed };
}

export async function waitForQaSettlementQuiescence({
  globals, timeoutMs = 3500, pollMs = 25,
  now = () => Date.now(), wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  const startedAt = now();
  let latest = qaSettlementQuiescenceSnapshot(globals);
  if (latest.ok) return { ok: true, elapsedMs: now() - startedAt, observed: latest.observed };
  while (now() - startedAt < timeoutMs) {
    await wait(pollMs);
    latest = qaSettlementQuiescenceSnapshot(globals);
    if (latest.ok) return { ok: true, elapsedMs: now() - startedAt, observed: latest.observed };
  }
  latest = qaSettlementQuiescenceSnapshot(globals);
  return { ok: latest.ok, elapsedMs: now() - startedAt, observed: latest.observed };
}

export function qaSettlementHeroHealthSnapshot(entities = []) {
  return Object.fromEntries((entities || [])
    .filter(entity => entity?.kind === 'hero')
    .map(hero => [String(hero.uid), Number(hero.hp || 0)]));
}

export function qaSettlementHeroHealthChanged(entities = [], baseline = {}) {
  return (entities || []).filter(entity => entity?.kind === 'hero')
    .some(hero => Number(hero.hp || 0) !== Number(baseline?.[String(hero.uid)]));
}

export async function waitForQaStoryCombatPhase(entry, {
  timeoutMs = QA_STORY_TRANSITION_TIMEOUT_MS,
  pollMs = 25,
  now = () => Date.now(),
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  const startedAt = now();
  let observed = { phase: entry?.phase, pending: !!entry?.pending };
  while (now() - startedAt < timeoutMs) {
    observed = { phase: entry?.phase, pending: !!entry?.pending };
    if (observed.phase === 'combat' && !observed.pending) return { ok: true, elapsedMs: now() - startedAt, observed };
    await wait(pollMs);
  }
  // A final sample accepts a transition that completed on the deadline poll.
  observed = { phase: entry?.phase, pending: !!entry?.pending };
  if (observed.phase === 'combat' && !observed.pending) return { ok: true, elapsedMs: now() - startedAt, observed };
  return { ok: false, elapsedMs: now() - startedAt, observed };
}

export function qaPlayableBattleSnapshot({ entry, globals = {}, entities = [], currentUID = 0, allowDeferredAdvance = false } = {}) {
  const now = Number(globals.time || 0);
  const presentationBarrier = derivePresentationTurnBarrier({ globals });
  const livingActors = (entities || []).filter(actor => (actor?.kind === 'hero' || actor?.kind === 'enemy') && Number(actor.hp || 0) > 0);
  const currentActor = livingActors.find(actor => Number(actor.uid) === Number(currentUID));
  const enemyActionActive = !!(globals.EnemyAction && globals.EnemyAction.active)
    || Object.values(globals.RealtimeEnemyActionsByUID || {}).some(action => action?.active);
  const actionLocked = Number(globals.ActionLockUntil || 0) > now;
  const observed = {
    phase: entry?.phase, pending: !!entry?.pending, ended: !!globals.NativeBattleEnded,
    enemyActionActive, actionInProgress: !!globals.ActionInProgress,
    playerBusy: !!globals.IsPlayerBusy, battleStartActive: !!globals.BattleStartActive,
    actionLocked, deferAdvance: !!globals.DeferAdvance, presentationClear: presentationBarrier.presentationClear,
    pendingHeroHits: Array.isArray(globals.PendingHeroHits) ? globals.PendingHeroHits.length : 0,
    livingActors: livingActors.map(actor => Number(actor.uid)), currentUID: Number(currentUID || 0),
    currentActorLiving: !!currentActor,
  };
  return { ok: observed.phase === 'combat' && !observed.pending && !observed.ended
    && !observed.enemyActionActive && !observed.actionInProgress && !observed.playerBusy
    && !observed.battleStartActive && !observed.actionLocked && observed.presentationClear && (allowDeferredAdvance || !observed.deferAdvance) && observed.pendingHeroHits === 0
    && observed.livingActors.length > 0 && observed.currentActorLiving, observed };
}

export async function waitForPlayableBattle({
  entry, globals, entities, getCurrentUID = () => 0, timeoutMs = 3500, pollMs = 40,
  now = () => Date.now(), wait = ms => new Promise(resolve => setTimeout(resolve, ms)), allowDeferredAdvance = false,
} = {}) {
  const startedAt = now(); let latest = qaPlayableBattleSnapshot({ entry, globals, entities, currentUID: getCurrentUID(), allowDeferredAdvance });
  while (now() - startedAt < timeoutMs) {
    latest = qaPlayableBattleSnapshot({ entry, globals, entities, currentUID: getCurrentUID(), allowDeferredAdvance });
    if (latest.ok) return { ok: true, elapsedMs: now() - startedAt, observed: latest.observed };
    await wait(pollMs);
  }
  latest = qaPlayableBattleSnapshot({ entry, globals, entities, currentUID: getCurrentUID(), allowDeferredAdvance });
  return { ok: latest.ok, elapsedMs: now() - startedAt, observed: latest.observed };
}

function showLiveHealFrameReport(frames, sourceUrl) {
  document.getElementById('qa-live-heal-report')?.remove();
  const report = document.createElement('section');
  report.id = 'qa-live-heal-report';
  report.style.cssText = 'position:fixed;inset:0;z-index:2147483647;overflow:auto;background:#10131a;color:#f4f7ff;padding:18px;font:14px/1.35 system-ui,sans-serif';
  const elapsed = frames.length > 1 ? frames.at(-1).ms - frames[0].ms : 0;
  report.innerHTML = `<header style="position:sticky;top:0;z-index:1;background:#10131a;padding:0 0 14px"><button type="button" style="float:right;font:inherit;padding:8px 12px">Close report</button><h1 style="margin:0 0 6px;font-size:22px">Live QA heal replay: every browser frame</h1><div>${frames.length} frames captured from the visible game canvas over ${Math.round(elapsed)} ms</div><code style="font-size:11px">${sourceUrl}</code></header><div data-frame-grid style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px"></div>`;
  report.querySelector('button').addEventListener('click', () => report.remove());
  const grid = report.querySelector('[data-frame-grid]');
  frames.forEach((frame, index) => {
    const figure = document.createElement('figure');
    figure.style.cssText = 'margin:0;background:#080a0f;border:1px solid #374052;padding:8px';
    const image = new Image();
    image.src = frame.image;
    image.alt = `Live heal replay frame ${index}`;
    image.style.cssText = 'display:block;width:100%;height:auto;background:#000';
    const yRange = frame.activeParticles ? `${frame.minY.toFixed(1)} to ${frame.maxY.toFixed(1)}` : 'none';
    const caption = document.createElement('figcaption');
    caption.textContent = `Frame ${index}  |  +${Math.round(frame.ms - frames[0].ms)} ms  |  blooms ${frame.activeBlooms}  |  particles ${frame.activeParticles}  |  live Y ${yRange}`;
    caption.style.cssText = 'padding-top:7px;font:12px/1.35 ui-monospace,monospace';
    figure.append(image, caption);
    grid.append(figure);
  });
  document.body.append(report);
}

export function registerDevBrowserTestHooks({
  state,
  gameState,
  storyEntry,
  callFunctionWithContext,
  fnContext,
  ensureDevToolingConfig,
  getDevToolHeroOptions,
  getDevToolEnemyOptions,
  layoutState,
  mapLayoutState,
  uiState,
  deriveEncounterRequestFromMapState,
  getHeroScreenRoster,
  normalizeHeroSelectionIndex,
  normalizePartyFormationSlots,
  getConfiguredHeroSlots,
  layoutHarnessEnabled,
  harnessLayoutState,
  harnessCombatGateway,
  deriveDamageFloatFrameOffset,
  isBoardGemLocked,
  drawFrame,
  installQaFixtureRuntimeRandom,
  toggleDevToolingModal,
  applyDevToolingConfig,
  resumeGameplayFromDevTooling,
  getLatestCombatActionLine,
  getLatestStoryCardActionLine,
  getStoryCardLiveLineState,
  splitStoryCardActorSegment,
  getStoryCardIntentFallbackLine,
  isStoryCardTokenLine,
  ensureTask011Audit,
  getTask015TraceStore,
  assertBoardIntegrity,
  worldToCanvas,
  canvas,
  qaResetScenario,
  qaResumeScenario,
}) {
  if (typeof window === 'undefined') return;

  if (new URLSearchParams(window.location.search).get('questQA') === '1') {
    const pauseSnapshot = document.createElement('div');
    pauseSnapshot.id = 'quest-qa-pause-snapshot';
    pauseSnapshot.hidden = true;
    const pauseSnapshots = { departure: null, current: null, resume: null };
    gameState.publishQaPauseSnapshot = stage => {
      const snapshot = serializeQaPauseCombatSnapshot({
        state,
      });
      if (stage === 'departure') pauseSnapshots.departure = snapshot;
      if (stage === 'resume') pauseSnapshots.resume = snapshot;
      pauseSnapshots.current = snapshot;
      pauseSnapshot.dataset.qaPauseSnapshot = JSON.stringify(pauseSnapshots);
      pauseSnapshot.dataset.qaPauseStage = String(stage || 'current');
    };
    document.body.append(pauseSnapshot);
  }
  window.render_game_to_text = () => {
    const payload = {
      coordSystem: 'origin:top-left, x:right, y:down',
      quest: { canSkip: gameState.storyEntry.phase === 'opening' && !!gameState.narrativeScene?.hitZones?.skip, phase: gameState.storyEntry.phase, activeCard: gameState.storyEntry.activeCard, progress: gameState.storyEntry.progress, modal: gameState.storyEntry.modal },
      time: state.globals.time || 0,
      party: {
        hp: state.globals.PartyHP || 0,
        maxHp: state.globals.PartyMaxHP || 0,
      },
      combatOrientation: {
        orientation: String(state.globals.CombatOrientation || 'left-wise'),
        geometry: state.globals.CombatOrientationGeometry || null,
      },
      continuousProgression: state.globals.ContinuousCombatStage ? {
        region: Number(state.globals.ContinuousCombatStage.region || 1),
        stage: Number(state.globals.ContinuousCombatStage.stage || 1),
        wave: Number(state.globals.ContinuousCombatStage.wave || 1),
        bossAvailable: !!state.globals.ContinuousCombatStage.bossAvailable,
        bossArmed: !!state.globals.ContinuousCombatStage.bossArmed,
        bossActive: !!state.globals.ContinuousCombatStage.bossActive,
        bossUID: Number(state.globals.ContinuousCombatStage.bossUID || 0),
        ordinaryWaveClears: Number(state.globals.ContinuousCombatStage.ordinaryWaveClears || 0),
        defeatRecoveries: Number(state.globals.ContinuousCombatStage.defeatRecoveries || 0),
        clearedBosses: Number(state.globals.ContinuousCombatStage.clearedBosses || 0),
        clearedPackMask: Number(state.globals.ContinuousCombatStage.clearedPackMask || 0),
        spawnedPackMask: Number(state.globals.ContinuousCombatStage.spawnedPackMask || 0),
        transitions: Number(state.globals.ContinuousCombatStage.transitions || 0),
        bossSummonRequired: !!state.globals.ContinuousCombatStage.bossSummonRequired,
      } : null,
      encounterSummary: state.globals.EncounterSummary ? {
        ...state.globals.EncounterSummary,
        selected: (state.globals.EncounterSummary.selected || []).map(row => ({ name: String(row.name || ''), combatPower: Number(row.CombatPower || row.combatPower || 0), enemyRole: String(row.enemyRole || row.role || ''), maxHP: Number(row.HP || row.maxHP || 0) })),
      } : null,
      resources: {
        energy: state.globals.Player_Energy || 0,
        maxEnergy: state.globals.Player_maxEnergy || 0,
        gold: state.globals.goldTotal || 0,
        tokenWallet: state.globals.TokenWallet || {},
        powerAmpTelemetry: Array.isArray(state.globals.PowerAmpTelemetryTrace)
          ? state.globals.PowerAmpTelemetryTrace.slice(-40)
          : [],
      },
      devTools: {
        config: ensureDevToolingConfig(),
        heroSlotOptions: getDevToolHeroOptions(),
        enemySlotOptions: getDevToolEnemyOptions(),
        enemyTypeOptions: getDevToolEnemyOptions(),
      },
      lamp: state.globals.Equipment?.lamp || null,
      items: state.globals.Equipment?.items || [],
      loadouts: state.globals.Equipment?.loadouts || {},
      mapLayout: {
        panX: Number(mapLayoutState.getMapLayoutState().panX || 0),
        panY: Number(mapLayoutState.getMapLayoutState().panY || 0),
        warMeter: Number(mapLayoutState.getMapLayoutState().warMeter || 0),
        encounterNode: mapLayoutState.getMapLayoutState().encounterNode || null,
        render: mapLayoutState.getMapLayoutState().lastRender || null,
        encounterRequestPreview: deriveEncounterRequestFromMapState(),
      },
      heroScreen: {
        mode: String(uiState.getUIState().heroScreenMode || 'details'),
        selectedHero: Number(gameState.selectedHero || 0),
        activeHeroName: (() => {
          const roster = getHeroScreenRoster();
          const idx = normalizeHeroSelectionIndex();
          const hero = roster[idx];
          return hero ? String(hero.name || '') : '';
        })(),
        activePartySlots: normalizePartyFormationSlots(getConfiguredHeroSlots()),
      },
      flags: {
        enemyDeathHoldUIDs: Object.keys(state.globals.EnemyDeathVisualHoldByUID || {}).map(Number),
        overlayVisible: uiState.getUIState().overlayVisible,
        layoutId: layoutState && typeof layoutState.getActiveLayoutId === 'function'
          ? layoutState.getActiveLayoutId()
          : (layoutHarnessEnabled && harnessLayoutState ? harnessLayoutState.getActiveLayoutId() : 'combat'),
        combatAcceptEvents: layoutHarnessEnabled && harnessCombatGateway
          ? harnessCombatGateway.canAcceptEvents()
          : true,
        layout0Ready: !gameState.startupLoad?.active && gameState.startupLoad?.phase !== 'error',
        layout0Failed: gameState.startupLoad?.phase === 'error',
      },
      heroes: state.entities
        .filter(e => e.kind === 'hero')
        .map(e => ({ uid: e.uid, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHP, currentLevel: Number(e.currentLevel || 1), attackType: String(e.attackType || ''), stats: { ...(e.stats || {}) }, combatPower: Number(e.combatPower || 0), recoveryRevealActive: isActorRecoveryRevealActive(e, state.globals.time) })),
      enemies: state.entities
        .filter(e => e.kind === 'enemy')
        .map(e => ({
          uid: e.uid, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHP, slot: e.slotIndex,
          streamState: e.streamState || null, streamEngageX: Number(e.streamEngageX || 0),
          streamStartAt: Number(e.streamStartAt || 0), combatPower: Number(e.combatPower || 0),
        })),
      damageTexts: (state.globals.DamageTexts || []).map(d => {
        const riseSec = Math.max(0.001, Number(d.riseInSec || 0.18));
        const phase = Number(d.phase || 0);
        const phaseAge = Number(d.age || 0);
        let progress = 1;
        if (phase === 0) {
          const riseT = Math.max(0, Math.min(1, phaseAge / riseSec));
          progress = riseT * (2 - riseT);
        }
        const offset = deriveDamageFloatFrameOffset(d, progress);
        const baseX = Number(d.baseX != null ? d.baseX : (d.x || 0));
        const baseY = Number(d.baseY != null ? d.baseY : (d.y || 0));
        return {
          amount: d.amount,
          zIndex: Number(d.zIndex || 0),
          targetUID: Number(d.targetUID || 0),
          hpBefore: Number(d.hpBefore || 0),
          hpAfter: Number(d.hpAfter || 0),
          kind: d.kind,
          targetKind: d.targetKind || null,
          baseX,
          baseY,
          x: Number(d.x || 0),
          y: Number(d.y || 0),
          displayX: baseX + offset.x,
          displayY: baseY + offset.y,
          floatAngleDeg: Number(d.floatAngleDeg || 0),
          floatVectorX: Number(d.floatVectorX || 0),
          floatVectorY: Number(d.floatVectorY || 0),
          phase,
          age: phaseAge,
          domSpawned: !!d.domSpawned,
        };
      }),
      damageEvents: (state.globals.DamageTexts || []).filter(d => d.targetKind === 'hero' && Number(d.targetUID || 0) > 0 && Number(d.hpBefore || 0) > Number(d.hpAfter || 0)).map(d => ({
        id: Number(d.zIndex || 0),
        targetUID: Number(d.targetUID || 0),
        sourceUID: Number(d.sourceUID || 0),
        attackerName: String((state.entities || []).find(e => Number(e.uid || 0) === Number(d.sourceUID || 0))?.name || ''),
        amount: Number(d.amount || 0),
        hpBefore: Number(d.hpBefore || 0),
        hpAfter: Number(d.hpAfter || 0),
      })),
      pendingHeroHits: (state.globals.PendingHeroHits || []).map(hit => ({
        at: Number(hit.at || 0),
        heroUID: Number(hit.heroUID || 0),
        targetUID: Number(hit.targetUID || 0),
        dmg: Number(hit.dmg || 0),
        finalDmg: Number(hit.finalDmg || 0),
        actionName: String(hit.actionName || ''),
        generatedBySkillId: String(hit.generatedBySkillId || ''),
        chainStrikeDamagePct: Number(hit.chainStrikeDamagePct || 0),
        chainStrikeBounceIndex: Number(hit.chainStrikeBounceIndex || 0),
        chainStrikeBounceCount: Number(hit.chainStrikeBounceCount || 0),
        chainStrikeSourceTargetUID: Number(hit.chainStrikeSourceTargetUID || 0),
      })),
      chainStrikeVisuals: (state.globals.ChainStrikeVisuals || []).map(visual => ({
        id: Number(visual.id || 0),
        skillId: String(visual.skillId || ''),
        sourceTargetUID: Number(visual.sourceTargetUID || 0),
        targetUID: Number(visual.targetUID || 0),
        startAt: Number(visual.startAt || 0),
        impactAt: Number(visual.impactAt || 0),
        asset: String(visual.asset || ''),
        visual: String(visual.visual || ''),
      })),
      combatImpacts: (state.globals.CombatImpactVisuals || []).map(impact => ({
        ownerUID: Number(impact.ownerUID || 0),
        targetUID: Number(impact.targetUID || 0),
        targetKind: String(impact.targetKind || ''),
        kind: String(impact.kind || ''),
        weak: !!impact.weak,
        mirrorX: !!impact.mirrorX,
        x: Number(impact.x || 0),
        y: Number(impact.y || 0),
      })),
      arcanePulseVisuals: (state.globals.ArcanePulseVisuals || []).map(pulse => ({
        skillId: String(pulse.skillId || ''),
        visualKey: String(pulse.visualKey || ''),
        heroUID: Number(pulse.heroUID || 0),
        targetUID: Number(pulse.targetUID || 0),
        startAt: Number(pulse.startAt || 0),
        impactAt: Number(pulse.impactAt || 0),
      })),
      gems: (gameState.gems || []).map(g => ({
        uid: g.uid,
        r: g.cellR,
        c: g.cellC,
        color: g.color ?? g.elementIndex,
        x: g.x,
        y: g.y,
        selected: !!(g.selected || g.Selected),
        locked: isBoardGemLocked(g),
        lockCountdown: Number(g.lockCountdown ?? g.LockCountdown ?? 0),
        lockGroupId: String(g.lockGroupId || g.LockGroupId || ''),
      })),
    };
    return JSON.stringify(payload);
  };

  window.advanceTime = (ms) => {
    const step = 1 / 60;
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) drawFrame(step);
  };

  window.__codexGame = {
    get state() { return state; },
    get globals() { return state.globals; },
    get gems() { return gameState.gems; },
    stepFrames(n = 1) {
      for (let i = 0; i < n; i++) drawFrame();
    },
    setEncounterRequest(input = {}) {
      const req = input && typeof input === 'object' ? input : {};
      if (req.targetCP != null) state.globals.EncounterTargetCP = Number(req.targetCP || 0);
      if (req.locale != null) state.globals.EncounterLocale = String(req.locale || 'all').trim().toLowerCase() || 'all';
      if (req.maxSlots != null) state.globals.EncounterMaxSlots = Math.max(1, Number(req.maxSlots || 0));
      if (req.policy != null) state.globals.EncounterPolicy = String(req.policy || 'mixed').trim().toLowerCase() || 'mixed';
      if (req.faction != null) state.globals.EncounterFaction = String(req.faction || '').trim().toLowerCase();
      if (req.seed != null) {
        state.globals.EncounterSeed = Number(req.seed || 0);
        state.globals.EncounterSeedExplicit = 1;
      } else {
        state.globals.EncounterSeedExplicit = 0;
      }
      return {
        targetCP: Number(state.globals.EncounterTargetCP || 0),
        locale: String(state.globals.EncounterLocale || 'all'),
        maxSlots: Number(state.globals.EncounterMaxSlots || 3),
        policy: String(state.globals.EncounterPolicy || 'mixed'),
        faction: String(state.globals.EncounterFaction || ''),
        seed: Number(state.globals.EncounterSeed || 0),
      };
    },
    setMapEncounterNode(input = {}) {
      const node = input && typeof input === 'object' ? input : {};
      const prev = mapLayoutState.getMapLayoutState().encounterNode || {};
      const next = {
        id: String(node.id || prev.id || 'clouds-alpha'),
        locale: String(node.locale || prev.locale || 'clouds').trim().toLowerCase() || 'clouds',
        faction: String(node.faction || prev.faction || 'wishless').trim().toLowerCase() || 'wishless',
      };
      mapLayoutState.setMapLayoutField('encounterNode', next);
      if (node.warMeter != null) {
        mapLayoutState.setMapLayoutField('warMeter', Math.max(0, Math.min(1, Number(node.warMeter || 0))));
      }
      return {
        encounterNode: mapLayoutState.getMapLayoutState().encounterNode,
        warMeter: Number(mapLayoutState.getMapLayoutState().warMeter || 0),
      };
    },
    toggleDevToolingModal(nextOpen = null) {
      return toggleDevToolingModal(nextOpen);
    },
    getDevToolingState() {
      return {
        config: ensureDevToolingConfig(),
        heroSlotOptions: getDevToolHeroOptions(),
        enemySlotOptions: getDevToolEnemyOptions(),
        enemyTypeOptions: getDevToolEnemyOptions(),
      };
    },
    applyDevToolingConfig(input = {}) {
      return applyDevToolingConfig(input);
    },
    callFunction(fnName, ...args) {
      return callFunctionWithContext(fnContext, fnName, ...args);
    },
    getStoryCardDebugLine() {
      const rawLatest = getLatestCombatActionLine();
      const filteredLatest = getLatestStoryCardActionLine();
      const live = getStoryCardLiveLineState();
      const split = splitStoryCardActorSegment(live.text);
      const intentFallback = getStoryCardIntentFallbackLine();
      const g = state.globals || {};
      return {
        rawLatest,
        filteredLatest,
        intentFallback,
        rendered: live.text,
        split,
        battleStart: {
          active: !!g.BattleStartActive,
          clearedForSession: !!g.BattleStartClearedForSession,
          sessionId: Number(g.BattleStartSessionId || 0),
          sessionText: String(g.BattleStartSessionText || ''),
        },
        colors: {
          actor: '#E35822',
          rest: '#314877',
        },
        filteredToken: isStoryCardTokenLine(rawLatest),
      };
    },
    getTask011Audit() {
      return JSON.parse(JSON.stringify(ensureTask011Audit()));
    },
    resetTask011Audit() {
      gameState.task011Audit = null;
      return true;
    },
    getTask015Trace() {
      return JSON.parse(JSON.stringify(getTask015TraceStore()));
    },
    resetTask015Trace() {
      gameState.task015Trace = {
        storycardPlacement: [],
        yellowQueue: [],
        yellowRefillQueue: [],
        yellowWrites: [],
        yellowAnimation: [],
      };
      return true;
    },
  };
  window.__auditBoard = () => assertBoardIntegrity('manual');
}
