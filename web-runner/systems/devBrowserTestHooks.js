import {
  DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID,
  DYNAMIC_INITIATIVE_AUTHORITY_EXPERIMENT_ID,
  DYNAMIC_INITIATIVE_AUTHORITY_MAX_ACTIONS,
  DYNAMIC_INITIATIVE_AUTHORITY_PROOF_DAMAGE_STAT,
  DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP,
  DYNAMIC_INITIATIVE_AUTHORITY_SEED,
} from '../src/core/dynamicInitiativeAuthorityExperiment.mjs';

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
      combatOrientation: {
        orientation: String(state.globals.CombatOrientation || 'left-wise'),
        geometry: state.globals.CombatOrientationGeometry || null,
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
      qaScenario: state.globals.ChainStrikeIITestScenario || null,
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
    async setupDynamicInitiativeAuthorityScenario() {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
      const waitForStartupReady = async () => {
        const deadline = now() + 15000;
        while (now() < deadline) {
          const load = gameState.startupLoad || {};
          if (!load.active && (load.phase === 'ready' || load.phase === 'runtime')) return true;
          if (load.phase === 'error') return false;
          await sleep(100);
        }
        return false;
      };
      const waitForLayout = async (layoutId) => {
        const deadline = now() + 5000;
        while (now() < deadline) {
          if (!layoutState || typeof layoutState.getActiveLayoutId !== 'function') return true;
          if (layoutState.getActiveLayoutId() === layoutId) return true;
          await sleep(50);
        }
        return false;
      };
      if (!(await waitForStartupReady())) {
        return {
          ok: false,
          reason: 'startup_not_ready',
          startupLoad: { ...(gameState.startupLoad || {}) },
        };
      }
      if (layoutState && typeof layoutState.getActiveLayoutId === 'function') {
        if (layoutState.getActiveLayoutId() === 'storyMock') {
          await layoutState.requestLayoutChange('town', 'dynamic-initiative-authority-qa-scenario-story');
          await waitForLayout('town');
        }
        if (layoutState.getActiveLayoutId() !== 'combat') {
          await layoutState.requestLayoutChange('combat', 'dynamic-initiative-authority-qa-scenario-town', { freshStart: true });
          await waitForLayout('combat');
        }
      }
      const proofHeroSlots = ['Falie', 'Huun', 'Runa', 'Kojonn'];
      const proofEnemySlots = ['Skeleton', 'Gobloc', 'Troll'];
      await applyDevToolingConfig({
        heroSlots: proofHeroSlots,
        enemySlots: proofEnemySlots,
        boardGemColor: 1,
        combatSpeed: 1,
      }, { closeModal: false });
      const g = state.globals;
      const authorityEnemyNames = new Set(proofEnemySlots);
      state.entities = state.entities.filter((entity) => (
        !entity
        || entity.kind !== 'enemy'
        || authorityEnemyNames.has(String(entity.name || '').trim())
      ));
      state.entities
        .filter((entity) => entity && (entity.kind === 'hero' || entity.kind === 'enemy'))
        .forEach((actor) => {
          actor.hp = DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP;
          actor.maxHP = DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP;
          actor.isAlive = true;
          actor.pendingDeath = false;
          actor.deathPending = false;
          actor.disabled = false;
          actor.stunned = false;
          actor.stopped = false;
          actor.paralyzed = false;
          actor.ableToAct = true;
          actor.stats = actor.stats && typeof actor.stats === 'object' ? actor.stats : {};
          actor.stats.ATK = DYNAMIC_INITIATIVE_AUTHORITY_PROOF_DAMAGE_STAT;
          actor.stats.MAG = DYNAMIC_INITIATIVE_AUTHORITY_PROOF_DAMAGE_STAT;
          actor.ATK = DYNAMIC_INITIATIVE_AUTHORITY_PROOF_DAMAGE_STAT;
          actor.MAG = DYNAMIC_INITIATIVE_AUTHORITY_PROOF_DAMAGE_STAT;
        });
      state.entities
        .filter((entity) => entity && entity.kind === 'enemy')
        .forEach((enemy, slotIndex) => {
          enemy.slotIndex = slotIndex;
          enemy.isAlive = Number(enemy.hp || 0) > 0;
        });
      const authorityEnemies = state.entities
        .filter((entity) => entity && entity.kind === 'enemy')
        .sort((left, right) => Number(left.slotIndex || 0) - Number(right.slotIndex || 0));
      g.DynamicInitiativeAuthorityEnabled = 1;
      callFunctionWithContext(fnContext, 'InitPartyHPFromHeroes');
      callFunctionWithContext(fnContext, 'UpdateEnemyHPUI');
      callFunctionWithContext(fnContext, 'Update_Bars');
      g.DynamicInitiativeAuthorityExperimentId = DYNAMIC_INITIATIVE_AUTHORITY_EXPERIMENT_ID;
      g.DynamicInitiativeAuthoritySeed = DYNAMIC_INITIATIVE_AUTHORITY_SEED;
      g.DynamicInitiativeAuthorityBattleId = DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID;
      g.DynamicInitiativeAuthorityMaxActions = DYNAMIC_INITIATIVE_AUTHORITY_MAX_ACTIONS;
      g.DynamicInitiativeAuthorityEncounterLocked = 0;
      g.DynamicInitiativeAuthority = null;
      g.DynamicInitiativeAuthorityLastTraceText = '';
      g.BattleId = DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID;
      g.EncounterSeed = DYNAMIC_INITIATIVE_AUTHORITY_SEED;
      g.EncounterSeedExplicit = 1;
      g.EncounterMaxSlots = proofEnemySlots.length;
      g.DevEnemySlots = [...proofEnemySlots];
      g.EnemyIDs = [
        Number(authorityEnemies[0]?.uid || 0),
        Number(authorityEnemies[1]?.uid || 0),
        Number(authorityEnemies[2]?.uid || 0),
      ];
      g.EnemySlots = [
        Number(authorityEnemies[0]?.uid || 0) > 0 ? Number(authorityEnemies[0].uid || 0) + 1 : 0,
        Number(authorityEnemies[1]?.uid || 0) > 0 ? Number(authorityEnemies[1].uid || 0) + 1 : 0,
        Number(authorityEnemies[2]?.uid || 0) > 0 ? Number(authorityEnemies[2].uid || 0) + 1 : 0,
      ];
      g.PendingEnemyRespawnSlots = [0, 0, 0];
      g.PendingEnemyRespawnTimerActive = 0;
      if (g.DevToolingConfig && typeof g.DevToolingConfig === 'object') {
        g.DevToolingConfig.heroSlots = [...proofHeroSlots];
        g.DevToolingConfig.enemySlots = [...proofEnemySlots];
      }
      g.TurnOrderArray = Array.isArray(g.TurnOrderArray)
        ? g.TurnOrderArray.filter((slot) => state.entities.some((entity) => Number(entity?.uid || 0) === Number(slot?.uid || 0)))
        : [];
      g.BattleStartActive = 0;
      g.BattleStartShown = 0;
      g.BattleStartClearedForSession = 1;
      g.BattleStartProcessStarted = 0;
      g.PendingSkillID = '';
      g.PendingActor = 0;
      g.SelectedEnemyUID = 0;
      g.SelectedEnemyUIDOwner = 0;
      g.CanPickGems = true;
      g.IsPlayerBusy = 0;
      g.BoardFillActive = 0;
      g.ActionInProgress = 0;
      g.DeferAdvance = 0;
      g.AdvanceAfterAction = 0;
      g.TurnPhase = 0;
      g.PartyBuff_SPD = 0;
      g.EnemyDebuffs = {};
      g.DynamicInitiativeAuthorityQAScenario = {
        id: 'dynamic-initiative-authority',
        experimentId: g.DynamicInitiativeAuthorityExperimentId,
        battleId: g.BattleId,
        seed: g.DynamicInitiativeAuthoritySeed,
        heroSlots: [...proofHeroSlots],
        enemySlots: [...proofEnemySlots],
        proofHp: DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP,
        proofDamageStat: DYNAMIC_INITIATIVE_AUTHORITY_PROOF_DAMAGE_STAT,
        expectedFlow: 'one hero opener, then visible Speed-driven interleaving: Skeleton 22, Huun 20, Gobloc 17, Kojonn 14, Runa 11, Falie 9, Troll 5',
      };
      drawFrame();
      return { ok: true, ...g.DynamicInitiativeAuthorityQAScenario };
    },
    async setupChainStrikeIIScenario() {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
      const waitForStartupReady = async () => {
        const deadline = now() + 15000;
        while (now() < deadline) {
          const load = gameState.startupLoad || {};
          if (!load.active && (load.phase === 'ready' || load.phase === 'runtime')) return true;
          if (load.phase === 'error') return false;
          await sleep(100);
        }
        return false;
      };
      const waitForLayout = async (layoutId) => {
        const deadline = now() + 5000;
        while (now() < deadline) {
          if (!layoutState || typeof layoutState.getActiveLayoutId !== 'function') return true;
          if (layoutState.getActiveLayoutId() === layoutId) return true;
          await sleep(50);
        }
        return false;
      };
      const chooseAvailable = (preferred, available) => {
        const normalized = new Map((available || []).map(value => [String(value || '').trim().toLowerCase(), String(value || '').trim()]));
        for (const name of preferred) {
          const match = normalized.get(String(name || '').trim().toLowerCase());
          if (match) return match;
        }
        return String((available || []).find(Boolean) || '').trim();
      };
      const heroSlots = ['Falie', 'Huun', 'Runa', 'Kojonn']
        .map(name => chooseAvailable([name], getDevToolHeroOptions()))
        .filter(Boolean);
      const enemyOptions = getDevToolEnemyOptions();
      const enemySlots = [
        chooseAvailable(['Gobloc', 'Goblin', 'Wishless'], enemyOptions),
        chooseAvailable(['Lizardo', 'Lizard', 'Marid'], enemyOptions),
        chooseAvailable(['Djinn', 'Chimerilass', 'Wisp'], enemyOptions),
      ].filter(Boolean);
      if (!(await waitForStartupReady())) {
        return {
          ok: false,
          reason: 'startup_not_ready',
          startupLoad: { ...(gameState.startupLoad || {}) },
        };
      }
      if (layoutState && typeof layoutState.getActiveLayoutId === 'function') {
        if (layoutState.getActiveLayoutId() === 'storyMock') {
          await layoutState.requestLayoutChange('town', 'chain-strike-ii-qa-scenario-story');
          await waitForLayout('town');
        }
        if (layoutState.getActiveLayoutId() !== 'combat') {
          await layoutState.requestLayoutChange('combat', 'chain-strike-ii-qa-scenario-town', { freshStart: true });
          await waitForLayout('combat');
        }
      }
      if (heroSlots.length > 0 || enemySlots.length > 0) {
        await applyDevToolingConfig({
          heroSlots: heroSlots.length ? heroSlots : undefined,
          enemySlots: enemySlots.length ? enemySlots : undefined,
          boardGemColor: 0,
          combatSpeed: 1,
        }, { closeModal: false });
      }
      const g = state.globals;
      const heroes = state.entities.filter(actor => actor && actor.kind === 'hero');
      const enemies = state.entities.filter(actor => actor && actor.kind === 'enemy');
      const hero = heroes.find(actor => Number(actor.hp || 0) > 0) || heroes[0] || null;
      const livingEnemies = enemies.slice(0, 3);
      if (!hero || livingEnemies.length === 0) {
        return { ok: false, reason: 'missing_hero_or_enemy' };
      }

      for (const h of heroes) {
        h.maxHP = Math.max(120, Number(h.maxHP || h.max || h.hp || 0));
        h.hp = h.maxHP;
        h.isAlive = true;
      }
      for (let i = 0; i < livingEnemies.length; i += 1) {
        const enemy = livingEnemies[i];
        enemy.maxHP = Math.max(160, Number(enemy.maxHP || enemy.hp || 0));
        enemy.hp = enemy.maxHP;
        enemy.isAlive = true;
        enemy.slotIndex = i;
      }

      g.SessionSkillsByHeroUID = {
        ...(g.SessionSkillsByHeroUID && typeof g.SessionSkillsByHeroUID === 'object' ? g.SessionSkillsByHeroUID : {}),
        __party_shared__: [
          { id: 'party_chain_strike_i', definitionId: 'party_chain_strike_i', title: 'Chain Strike I', owner: 'Party', selectionCount: 1 },
          { id: 'party_chain_strike_ii', definitionId: 'party_chain_strike_ii', title: 'Chain Strike II', owner: 'Party', selectionCount: 1 },
        ],
      };
      g.Player_maxEnergy = Math.max(150, Number(g.Player_maxEnergy || 0));
      g.Player_Energy = g.Player_maxEnergy;
      g.PartyHPByIndex = heroes.map(h => Number(h.hp || 0));
      g.PartyMaxHPByIndex = heroes.map(h => Number(h.maxHP || h.hp || 0));
      g.PartyHP = g.PartyHPByIndex.reduce((sum, value) => sum + value, 0);
      g.PartyMaxHP = g.PartyMaxHPByIndex.reduce((sum, value) => sum + value, 0);
      g.RoundActive = 0;
      g.RoundGroups = [];
      g.RoundGroupIndex = 0;
      g.RoundMemberIndex = 0;
      g.TurnOrderArray = [
        { uid: Number(hero.uid || 0), type: 0, spd: Number(hero.stats?.SPD ?? hero.SPD ?? 10), name: String(hero.name || '') },
        ...livingEnemies.map(enemy => ({
          uid: Number(enemy.uid || 0),
          type: 1,
          spd: Number(enemy.stats?.SPD ?? enemy.SPD ?? 5),
          name: String(enemy.name || ''),
        })),
      ];
      g.CurrentTurnIndex = 0;
      g.PendingHeroHits = [];
      g.ChainStrikeVisuals = [];
      g.DamageTexts = [];
      g.PendingSkillID = 'HERO_SINGLE';
      g.PendingActor = Number(hero.uid || 0);
      g.SelectedEnemyUID = Number(livingEnemies[0].uid || 0);
      g.SelectedEnemyUIDOwner = Number(hero.uid || 0);
      g.CanPickGems = 0;
      g.IsPlayerBusy = 1;
      g.TurnPhase = 1;
      g.HideHeroSelector = 1;
      g.DeferAdvance = 0;
      g.AdvanceAfterAction = 0;
      g.ActionInProgress = 0;
      g.ActionActorUID = 0;
      g.ActionOwnerUID = 0;
      g.ActionLockUntil = 0;
      g.BattleStartActive = 0;
      g.BattleStartShown = 0;
      g.BattleStartClearedForSession = 1;
      g.ChainStrikeIITestScenario = {
        id: 'chain-strike-ii',
        heroUID: Number(hero.uid || 0),
        heroName: String(hero.name || ''),
        enemyUIDs: livingEnemies.map(enemy => Number(enemy.uid || 0)),
        activeSkills: ['party_chain_strike_i', 'party_chain_strike_ii'],
        expectedBouncePct: 66,
        expectedBounceCount: 2,
        layoutId: layoutState && typeof layoutState.getActiveLayoutId === 'function' ? layoutState.getActiveLayoutId() : '',
        expectedFlow: 'click an enemy, press ATTACK, then pendingHeroHits should contain original hit plus two Chain Strike II bounces',
      };
      drawFrame();
      return { ok: true, ...g.ChainStrikeIITestScenario };
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
  try {
    const params = new URLSearchParams(window.location.search);
    const scenario = String(params.get('scenario') || params.get('qa') || '').trim().toLowerCase();
    if (scenario === 'dynamic-initiative-authority' || scenario === 'dynamic-initiative') {
      void window.__codexGame.setupDynamicInitiativeAuthorityScenario();
    }
    if (scenario === 'chain-strike-ii' || scenario === 'chainstrike2') {
      void window.__codexGame.setupChainStrikeIIScenario();
    }
  } catch (_) {}
  window.__auditBoard = () => assertBoardIntegrity('manual');
}
