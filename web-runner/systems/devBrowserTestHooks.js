export function registerDevBrowserTestHooks({
  state,
  gameState,
  callFunctionWithContext,
  fnContext,
  ensureDevToolingConfig,
  getDevAutoplayState,
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
  handleGemMatch,
  toggleDevToolingModal,
  applyDevToolingConfig,
  runDevAutoplayUntilDepleted,
  getLatestCombatActionLine,
  getLatestStoryCardActionLine,
  getStoryCardLiveLineState,
  splitStoryCardActorSegment,
  getStoryCardIntentFallbackLine,
  isStoryCardTokenLine,
  ensureTask011Audit,
  getTask015TraceStore,
  assertBoardIntegrity,
}) {
  if (typeof window === 'undefined') return;

  window.render_game_to_text = () => {
    const currentUID = callFunctionWithContext(fnContext, 'GetCurrentTurn');
    const currentActor = callFunctionWithContext(fnContext, 'GetActorByUID', currentUID);
    const turnOrderRaw = Array.isArray(state.globals.TurnOrderArray)
      ? state.globals.TurnOrderArray
      : [];
    const turnOrder = turnOrderRaw.map(entry => {
      const actor = callFunctionWithContext(fnContext, 'GetActorByUID', entry.uid);
      return {
        uid: entry.uid,
        type: entry.type,
        name: actor ? actor.name : null,
        spd: entry.spd ?? null,
      };
    });
    const payload = {
      coordSystem: 'origin:top-left, x:right, y:down',
      time: state.globals.time || 0,
      turn: {
        uid: currentUID,
        type: callFunctionWithContext(fnContext, 'GetCurrentType'),
        name: currentActor ? currentActor.name : null,
      },
      round: {
        active: !!state.globals.RoundActive,
        groupIndex: state.globals.RoundGroupIndex ?? 0,
        memberIndex: state.globals.RoundMemberIndex ?? 0,
      },
      turnOrder,
      party: {
        hp: state.globals.PartyHP || 0,
        maxHp: state.globals.PartyMaxHP || 0,
      },
      resources: {
        energy: state.globals.Player_Energy || 0,
        maxEnergy: state.globals.Player_maxEnergy || 0,
        gold: state.globals.goldTotal || 0,
        tokenWallet: state.globals.TokenWallet || {},
        astralFlowWallet: state.globals.AstralFlowWallet || 0,
        heroGemUsage: state.globals.HeroGemUsage || null,
        heroGemMilestones: state.globals.HeroGemMilestones || null,
        heroGemProgressPersistedAt: state.globals.HeroGemProgressPersistedAt || 0,
        idleFarmLastCollect: state.globals.IdleFarmLastCollect || null,
        powerAmpTelemetry: Array.isArray(state.globals.PowerAmpTelemetryTrace)
          ? state.globals.PowerAmpTelemetryTrace.slice(-40)
          : [],
      },
      devTools: {
        config: ensureDevToolingConfig(),
        autoplay: getDevAutoplayState(),
        heroSlotOptions: getDevToolHeroOptions(),
        enemySlotOptions: getDevToolEnemyOptions(),
        enemyTypeOptions: getDevToolEnemyOptions(),
      },
      idleFarm: {
        active: layoutState && typeof layoutState.getActiveLayoutId === 'function'
          ? layoutState.getActiveLayoutId() === 'idleFarmLayout'
          : false,
        state: gameState.idleFarmLayout || null,
      },
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
        selectedSkillIndex: Number(uiState.getUIState().heroScreenSelectedSkillIndex || 0),
        activeHeroName: (() => {
          const roster = getHeroScreenRoster();
          const idx = normalizeHeroSelectionIndex();
          const hero = roster[idx];
          return hero ? String(hero.name || '') : '';
        })(),
        activePartySlots: normalizePartyFormationSlots(getConfiguredHeroSlots()),
      },
      flags: {
        canPickGems: state.globals.CanPickGems,
        isPlayerBusy: state.globals.IsPlayerBusy,
        turnPhase: state.globals.TurnPhase ?? 0,
        deferAdvance: state.globals.DeferAdvance ?? 0,
        actionLockUntil: state.globals.ActionLockUntil ?? 0,
        pendingSkillId: state.globals.PendingSkillID || null,
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
        .map(e => ({ uid: e.uid, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHP, combatPower: Number(e.combatPower || 0) })),
      enemies: state.entities
        .filter(e => e.kind === 'enemy')
        .map(e => ({ uid: e.uid, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHP, slot: e.slotIndex, combatPower: Number(e.combatPower || 0) })),
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
    get turn() {
      const uid = callFunctionWithContext(fnContext, 'GetCurrentTurn');
      return {
        uid,
        type: callFunctionWithContext(fnContext, 'GetCurrentType'),
        actor: callFunctionWithContext(fnContext, 'GetActorByUID', uid),
      };
    },
    stepFrames(n = 1) {
      for (let i = 0; i < n; i++) drawFrame();
    },
    selectGemByRC(row, col) {
      const idx = gameState.gems.findIndex(g => g.cellR === row && g.cellC === col);
      if (idx === -1) return false;
      const gem = gameState.gems[idx];
      if (isBoardGemLocked(gem)) return false;
      if (gameState.selectedGems.includes(idx)) return true;
      gameState.selectedGems.push(idx);
      gem.selected = true;
      gem.Selected = 1;
      return true;
    },
    clearSelection() {
      gameState.selectedGems = [];
      gameState.selectionLocked = false;
      for (const gm of gameState.gems) {
        gm.selected = false;
        gm.Selected = 0;
      }
      state.globals.TapIndex = 0;
    },
    forceMatch(color) {
      handleGemMatch(color);
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
        autoplay: getDevAutoplayState(),
        heroSlotOptions: getDevToolHeroOptions(),
        enemySlotOptions: getDevToolEnemyOptions(),
        enemyTypeOptions: getDevToolEnemyOptions(),
      };
    },
    applyDevToolingConfig(input = {}) {
      return applyDevToolingConfig(input);
    },
    runDevAutoplayUntilDepleted() {
      return runDevAutoplayUntilDepleted();
    },
    stopDevAutoplay() {
      state.globals.DevAutoplayStopRequested = 1;
      return getDevAutoplayState();
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
