import { getHeroFlowState } from '../src/core/personalFlow.mjs';
import { chooseSessionLevelUpBuff, getSessionLevelUpBuffOffer, settleVictory } from '../modules/heroCommands.mjs';
import { QA_LEVEL_UP_BUFF_CARDS } from '../modules/sessionLevelUpBuffPresentation.mjs';
import { resetCombatSessionConditions } from './combatSessionReset.mjs';
import {
  DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID,
  DYNAMIC_INITIATIVE_AUTHORITY_EXPERIMENT_ID,
  DYNAMIC_INITIATIVE_AUTHORITY_MAX_ACTIONS,
  DYNAMIC_INITIATIVE_AUTHORITY_PROOF_DAMAGE_STAT,
  DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP,
  DYNAMIC_INITIATIVE_AUTHORITY_SEED,
} from '../src/core/dynamicInitiativeAuthorityExperiment.mjs';

export const QA_STORY_TRANSITION_TIMEOUT_MS = 2400;
export const QA_FIXTURE_RUNTIME_ENCOUNTER_SEED = 3720;
export const QA_LEVEL_UP_FIXTURE_CARD_IDS = Object.freeze({
  ward: 'qa_opening_shield_1',
  stat: 'qa_atk_focus_1',
  maxhp: 'qa_max_vitality_1',
  speed: 'qa_speed_1',
  bargain: 'qa_power_bargain_1',
  pulse: 'qa_pulse_1',
  orb: 'qa_orb_cadence_1',
  venom: 'qa_status_on_basic_1',
  heal: 'qa_heal_on_basic_1',
  bounce: 'qa_bounce_1',
  counter: 'qa_counter_1',
});

export function resolveQaLevelUpFixtureKey(value) {
  const normalized = String(value || '');
  if (Object.prototype.hasOwnProperty.call(QA_LEVEL_UP_FIXTURE_CARD_IDS, normalized)) return normalized;
  return Object.entries(QA_LEVEL_UP_FIXTURE_CARD_IDS).find(([, cardId]) => cardId === normalized)?.[0] || null;
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

export function registerDevBrowserTestHooks({
  state,
  gameState,
  storyEntry,
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
  installQaFixtureRuntimeRandom,
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
  getAttackButtonBounds,
  worldToCanvas,
  canvas,
}) {
  if (typeof window === 'undefined') return;

  if (new URLSearchParams(window.location.search).get('questQA') === '1') {
    const controls = document.createElement('div');
    controls.setAttribute('aria-label', 'Quest QA');
    controls.style.cssText = 'position:fixed;top:4px;left:4px;z-index:10001;display:flex;gap:4px';
    const heroSelect = document.createElement('select');
    heroSelect.setAttribute('aria-label', 'QA level-up hero');
    const tierSelect = document.createElement('select');
    tierSelect.setAttribute('aria-label', 'QA offer tier');
    for (const tier of [1, 2, 3, 4]) tierSelect.append(new Option(`Tier ${tier}`, String(tier)));
    const cardSelect = document.createElement('select');
    cardSelect.setAttribute('aria-label', 'QA preferred eligible card');
    const fixtureSelect = document.createElement('select');
    fixtureSelect.setAttribute('aria-label', 'QA production fixture');
    Object.keys(QA_LEVEL_UP_FIXTURE_CARD_IDS).forEach(name => fixtureSelect.append(new Option(name, name)));
    const qaHero = () => {
      const heroes = state.entities.filter(entity => entity.kind === 'hero');
      if (!heroSelect.options.length) heroes.forEach(hero => heroSelect.append(new Option(hero.name || hero.baseHeroName || String(hero.uid), String(hero.uid))));
      return heroes.find(hero => Number(hero.uid) === Number(heroSelect.value)) || heroes[0] || null;
    };
    const setTierAndCard = () => {
      const tier = Number(tierSelect.value || 1);
      state.globals.SessionLevelUpTierWeights = { 1: tier === 1 ? 1 : 0, 2: tier === 2 ? 1 : 0, 3: tier === 3 ? 1 : 0, 4: tier === 4 ? 1 : 0 };
      state.globals.SessionLevelUpPreferredCardId = String(cardSelect.value || '');
      state.globals.RuntimeRandom = () => 0;
    };
    const seedProductionEncounter = () => {
      // combatSessionInitializer consumes this normal encounter input and installs
      // its own seeded production RuntimeRandom for the next battle.
      state.globals.EncounterSeed = 7969171;
      state.globals.EncounterSeedExplicit = 1;
      state.globals.EncounterMaxSlots = 3;
    };
    const statusSnapshot = actor => (actor?.statuses || []).map(status => ({
      effect: String(status.statusEffect || ''),
      magnitude: Number(status.magnitude || 0),
      snapshotPotency: Number(status.snapshotPotency || 0),
    }));
    const snapshotFixtureBaseline = (owner, target) => ({
      ownerId: String(owner?.heroInstanceKey ?? owner?.uid ?? ''),
      ownerMaxHP: Number(owner?.maxHP || 0),
      ownerHP: Number(owner?.hp || 0),
      ownerAtkUp: Number(owner?.statuses?.find(status => status.statusEffect === 'atkUp')?.magnitude || 0),
      ownerSpdUp: Number(owner?.statuses?.find(status => status.statusEffect === 'spdUp')?.magnitude || 0),
      ownerBarrier: Number(owner?.statuses?.find(status => status.statusEffect === 'barrier')?.magnitude || 0),
      targetId: Number(target?.uid || 0),
      targetHP: Number(target?.hp || 0),
      targetStatuses: statusSnapshot(target),
      enemies: Object.fromEntries(state.entities.filter(entity => entity.kind === 'enemy').map(enemy => [Number(enemy.uid), {
        hp: Number(enemy.hp || 0),
        statuses: statusSnapshot(enemy),
      }])),
      wardVisualCount: Object.keys(state.globals.PartyWardBarrierVisualsByUID || {}).length,
      pulseCount: (state.globals.ArcanePulseVisuals || []).length,
      chainCount: (state.globals.ChainStrikeVisuals || []).length,
      damageTextCount: (state.globals.DamageTexts || []).length,
    });
    const arrangeOwnerTurn = (owner, target) => {
      const turnIndex = (state.globals.TurnOrderArray || []).findIndex(entry => Number(entry.uid) === Number(owner?.uid));
      if (turnIndex < 0) throw new Error('QA fixture owner is absent from the production turn order');
      // Dynamic initiative owns GetCurrentTurn in this build. Arrange its normal
      // scheduler inputs alongside the legacy queue index, then ProcessTurn
      // remains the only action-producing production seam.
      const scheduledOwner = { uid: Number(owner.uid), type: 0, name: String(owner.name || owner.uid) };
      const initiative = state.globals.DynamicInitiative && typeof state.globals.DynamicInitiative === 'object'
        ? state.globals.DynamicInitiative
        : (state.globals.DynamicInitiative = {});
      initiative.active = 1;
      initiative.current = scheduledOwner;
      state.globals.InitiativeCurrentUID = scheduledOwner.uid;
      state.globals.CurrentTurnIndex = turnIndex;
      state.globals.SelectedEnemyUID = Number(target?.uid || 0);
      if (Number(callFunctionWithContext(fnContext, 'GetCurrentTurn')) !== Number(owner.uid)) throw new Error('QA fixture could not arrange the selected owner as current actor');
    };
    const beginRewardSettlement = ({ overflow = false, multiHero = false } = {}) => {
      const selected = qaHero(); if (!selected) return;
      setTierAndCard();
      const participants = multiHero ? state.entities.filter(entity => entity.kind === 'hero') : [selected];
      for (const hero of participants) {
        hero.currentEXP = overflow ? 0 : 47;
        hero.EXPToNextLevel = 100;
      }
      const reward = overflow ? 280 : 80;
      const battleId = `quest-qa-level-up-${Date.now()}`;
      state.globals.NativeBattleEnded = true;
      state.globals.ProgressionBattle = { id: battleId, participants: participants.map(hero => hero.heroInstanceKey || hero.baseHeroName || hero.name), defeated: { qa_reward: reward }, defeatedGold: {}, settled: false };
      // This is the production EXP settlement path. Controls only seed its battle input.
      settleVictory(fnContext);
      if (typeof drawFrame === 'function') drawFrame();
    };
    for (const [label, action] of [
      ['QA start combat', () => {
        if (typeof storyEntry.startCombatForQA !== 'function') return;
        void storyEntry.startCombatForQA().then(started => {
          if (started && typeof drawFrame === 'function') drawFrame();
        });
      }],
      ['QA defeat', () => {
        if (gameState.storyEntry.phase !== 'combat') return;
        for (const hero of state.entities.filter(e => e.kind === 'hero')) hero.hp = 0;
        callFunctionWithContext(fnContext, 'UpdateHeroHPUI');
        delete state.globals.QaFixtureBattleBaseline;
        delete state.globals.QaFixtureHoldTurn;
      }],
      ['QA clear monsters', () => {
        if (gameState.storyEntry.phase !== 'combat') return;
        for (const enemy of state.entities.filter(e => e.kind === 'enemy')) callFunctionWithContext(fnContext, 'KillEnemyByUID', enemy.uid);
      }],
      ['QA low HP', () => {
        const hero = state.entities.find(e => e.kind === 'hero'); if (!hero) return;
        hero.hp = Math.floor(Number(hero.maxHP || 1) * .25); callFunctionWithContext(fnContext, 'UpdateHeroHPUI');
      }],
      ['QA EXP 47+80', () => beginRewardSettlement()],
      ['QA fixture offer', () => { cardSelect.value = QA_LEVEL_UP_FIXTURE_CARD_IDS[resolveQaLevelUpFixtureKey(fixtureSelect.value)] || ''; tierSelect.value = '1'; beginRewardSettlement(); }],
      ['QA overflow EXP', () => beginRewardSettlement({ overflow: true })],
      ['QA multi-hero EXP', () => beginRewardSettlement({ multiHero: true })],
      ['QA choose preferred', () => {
        const offer = getSessionLevelUpBuffOffer(fnContext);
        const selected = offer.cards?.find(card => card.cardId === cardSelect.value) || offer.cards?.[0];
        if (selected) chooseSessionLevelUpBuff(fnContext, selected.cardId);
        if (typeof drawFrame === 'function') drawFrame();
      }],
      ['QA native basic', () => callFunctionWithContext(fnContext, 'ProcessTurn')],
      ['QA advance turn', () => { callFunctionWithContext(fnContext, 'AdvanceTurn'); callFunctionWithContext(fnContext, 'ProcessTurn'); }],
      ['QA incoming hit', () => {
        const hero = qaHero();
        const enemy = state.entities.find(entity => entity.kind === 'enemy' && Number(entity.hp || 0) > 0);
        if (hero && enemy) callFunctionWithContext(fnContext, 'ExecuteEnemyJobSkill', enemy.uid, 'Enemy_ATK_Single', hero.uid);
      }],
      ['QA run fixture', async () => {
        const fixture = resolveQaLevelUpFixtureKey(fixtureSelect.value);
        const owner = qaHero();
        const livingEnemies = () => state.entities.filter(entity => entity.kind === 'enemy' && Number(entity.hp || 0) > 0);
        const statusMagnitude = (actor, effect) => Number(actor?.statuses?.find(status => status.statusEffect === effect)?.magnitude || 0);
        const battleBaseline = state.globals.QaFixtureBattleBaseline;
        const targetForAttempt = () => livingEnemies().slice().sort((left, right) => Number(right.hp || 0) - Number(left.hp || 0))[0] || null;
        const target = targetForAttempt();
        // Heal and counter need room to produce a real current-run recovery delta.
        // This mirrors the low-HP QA control: it arranges input state, then the
        // production turn or incoming-hit seam owns every result.
        if ((fixture === 'heal' || fixture === 'counter') && owner) {
          owner.hp = Math.max(1, Math.floor(Number(owner.maxHP || 1) * .5));
          callFunctionWithContext(fnContext, 'UpdateHeroHPUI');
        }
        const baseline = snapshotFixtureBaseline(owner, target);
        const newPulses = () => (state.globals.ArcanePulseVisuals || []).slice(baseline.pulseCount);
        const newChains = () => (state.globals.ChainStrikeVisuals || []).slice(baseline.chainCount);
        const newDamageTexts = () => (state.globals.DamageTexts || []).slice(baseline.damageTextCount);
        const enemyChangedSinceRun = () => state.entities.filter(entity => entity.kind === 'enemy').some(enemy => Number(enemy.hp || 0) < Number(baseline.enemies?.[enemy.uid]?.hp ?? enemy.hp));
        const enemyHPLoweredSinceRun = uid => {
          const enemy = state.entities.find(entity => Number(entity.uid) === Number(uid));
          return !!enemy && Number(enemy.hp || 0) < Number(baseline.enemies?.[enemy.uid]?.hp ?? enemy.hp);
        };
        const enemyMarkedSinceRun = () => livingEnemies().some(enemy => {
          const before = baseline.enemies?.[enemy.uid]?.statuses || [];
          const after = statusSnapshot(enemy);
          const hadMarkAndDot = before.some(status => status.effect === 'mark') && before.some(status => status.effect === 'dot');
          return after.some(status => status.effect === 'mark' && status.magnitude === 1)
            && after.some(status => status.effect === 'dot' && status.magnitude === 1 && status.snapshotPotency === 3)
            && !hadMarkAndDot;
        });
        const ownerWasHitSinceRun = () => Number(owner?.hp || 0) < baseline.ownerHP;
        const scenarios = {
          ward: { attempts: 1, observed: () => battleBaseline.ownerBarrier === 0 && statusMagnitude(owner, 'barrier') === .25 && Object.keys(state.globals.PartyWardBarrierVisualsByUID || {}).length > battleBaseline.wardVisualCount && !!state.globals.PartyWardBarrierVisualsByUID?.[owner?.uid] },
          stat: { attempts: 1, observed: () => battleBaseline.ownerAtkUp === 0 && statusMagnitude(owner, 'atkUp') === .10 },
          maxhp: { attempts: 1, observed: () => Number(owner?.maxHP || 0) === Math.round(battleBaseline.ownerMaxHP * 1.20) },
          speed: { attempts: 1, observed: () => battleBaseline.ownerSpdUp === 0 && statusMagnitude(owner, 'spdUp') === .10 },
          bargain: { attempts: 1, observed: () => statusMagnitude(owner, 'atkUp') === .15 && Number(owner?.maxHP || 0) === Math.round(battleBaseline.ownerMaxHP * .90) },
          pulse: { attempts: 2, observed: () => newPulses().some(visual => Number(visual.sourceUID) === Number(owner?.uid) && Number(visual.amount) === 6 && enemyHPLoweredSinceRun(visual.targetUID)) },
          orb: { attempts: 3, observed: () => newPulses().some(visual => Number(visual.sourceUID) === Number(owner?.uid) && Number(visual.amount) === 4 && enemyHPLoweredSinceRun(visual.targetUID)) },
          venom: { attempts: 1, observed: enemyMarkedSinceRun },
          heal: { attempts: 1, observed: () => newDamageTexts().some(text => text.kind === 'heal' && Number(text.targetUID) === Number(owner?.uid) && Number(text.amount) === Math.floor(baseline.ownerMaxHP * .05)) },
          bounce: { attempts: 1, observed: () => newChains().some(visual => Number(visual.sourceUID) === Number(owner?.uid) && Number(visual.damagePercent) === .5 && Number(visual.targetUID) !== Number(visual.sourceTargetUID) && enemyHPLoweredSinceRun(visual.targetUID)) },
          counter: { attempts: 1, observed: () => ownerWasHitSinceRun() && newDamageTexts().some(text => text.kind === 'heal' && Number(text.targetUID) === Number(owner?.uid) && Number(text.amount) === Math.floor(baseline.ownerMaxHP * .03)) && enemyChangedSinceRun() },
        };
        const scenario = scenarios[fixture];
        const fixtureCard = QA_LEVEL_UP_BUFF_CARDS.find(card => card.cardId === QA_LEVEL_UP_FIXTURE_CARD_IDS[fixture]);
        const activeStages = state.globals.SessionLevelBuffState?.heroes?.[String(owner?.heroInstanceKey ?? owner?.uid ?? '')]?.activeStageByEffectId || {};
        if (!owner || !scenario || !fixtureCard || !battleBaseline) throw new Error(`QA fixture ${fixture || fixtureSelect.value} has no selected owner, Battle B baseline, or scenario`);
        if (battleBaseline.fixture !== fixture || battleBaseline.ownerId !== String(owner.heroInstanceKey ?? owner.uid)) throw new Error(`QA fixture ${fixture} does not match the selected Battle B owner`);
        if (Number(activeStages[fixtureCard.effectId] || 0) !== Number(fixtureCard.stage || 1)) throw new Error(`QA fixture ${fixture} requires its selected production offer before Battle B`);
        const enemies = livingEnemies();
        if (fixture === 'bounce' && enemies.length < 2) throw new Error('QA fixture bounce requires two distinct living enemies');
        if (typeof installQaFixtureRuntimeRandom !== 'function') throw new Error('QA fixture requires the production current-battle RNG seam');
        delete state.globals.QaFixtureHoldTurn;
        // The held current battle has not received its first production turn.
        // Re-arm that battle-start sentinel so ProcessTurn below owns the card
        // application after all QA inputs are arranged.
        delete state.globals.SessionLevelBuffCombatSessionId;
        for (let attempt = 0; attempt < scenario.attempts && !scenario.observed(); attempt += 1) {
          if (fixture === 'counter') {
            const enemy = livingEnemies()[0];
            if (!enemy) throw new Error('QA fixture counter has no living enemy');
            installQaFixtureRuntimeRandom(QA_FIXTURE_RUNTIME_ENCOUNTER_SEED);
            callFunctionWithContext(fnContext, 'ExecuteEnemyJobSkill', enemy.uid, 'Enemy_ATK_Single', owner.uid);
          } else {
            const currentTarget = targetForAttempt();
            if (!currentTarget) throw new Error(`QA fixture ${fixture} has no living target`);
            arrangeOwnerTurn(owner, currentTarget);
            installQaFixtureRuntimeRandom(QA_FIXTURE_RUNTIME_ENCOUNTER_SEED);
            callFunctionWithContext(fnContext, 'ProcessTurn');
          }
          await new Promise(resolve => window.setTimeout(resolve, 1100));
        }
        if (!scenario.observed()) throw new Error(`QA fixture ${fixture} did not produce its required observable production result: ${JSON.stringify({ ownerUID: owner.uid, enemies: livingEnemies().map(enemy => ({ uid: enemy.uid, hp: enemy.hp, statuses: enemy.statuses?.map(status => status.statusEffect) || [] })), pulses: state.globals.ArcanePulseVisuals?.length || 0, chains: state.globals.ChainStrikeVisuals?.length || 0 })}`);
        if (typeof drawFrame === 'function') drawFrame();
      }],
      ['QA next battle', async () => {
        const fixture = resolveQaLevelUpFixtureKey(fixtureSelect.value);
        const owner = qaHero();
        const target = state.entities.find(entity => entity.kind === 'enemy' && Number(entity.hp || 0) > 0);
        if (!fixture || !owner) throw new Error('QA continuation requires a selected fixture and owner');
        state.globals.QaFixtureBattleBaseline = { fixture, ...snapshotFixtureBaseline(owner, target) };
        state.globals.QaFixtureHoldTurn = 1;
        seedProductionEncounter();
        storyEntry.victory();
        const cardIndex = gameState.storyEntry.cards.findIndex((card, index) => card.combat && index < gameState.storyEntry.progress.revealed);
        if (!storyEntry.startCard(cardIndex) || !storyEntry.requestSkip() || !storyEntry.confirmSkip()) throw new Error('QA continuation could not enter the production StoryEntry combat transition');
        const transition = await waitForQaStoryCombatPhase(gameState.storyEntry, { wait: ms => new Promise(resolve => window.setTimeout(resolve, ms)) });
        if (!transition.ok || state.globals.NativeBattleEnded) throw new Error(`QA continuation timed out after ${transition.elapsedMs}ms phase=${transition.observed.phase} pending=${transition.observed.pending}`);
        if (typeof drawFrame === 'function') drawFrame();
      }],
      ['QA fresh session', () => { delete state.globals.QaFixtureBattleBaseline; delete state.globals.QaFixtureHoldTurn; resetCombatSessionConditions(state.globals, {}); if (typeof drawFrame === 'function') drawFrame(); }],
      ['QA abandon', async () => {
        const navigated = await storyEntry.navigate('Quests');
        const quit = navigated && storyEntry.quitPausedCombat();
        if (!navigated || !quit) throw new Error('QA abandon requires the production Quests pause and Quit Battle flow');
        if (Object.keys(state.globals.SessionLevelBuffState?.heroes || {}).length || state.globals.SessionLevelUpSettlement || state.globals.SessionLevelUpQueue?.status === 'active' || state.globals.SessionLevelBuffCombatSessionId != null) throw new Error('QA abandon did not clear owned session level buffs');
        delete state.globals.QaFixtureBattleBaseline;
        delete state.globals.QaFixtureHoldTurn;
        if (typeof drawFrame === 'function') drawFrame();
      }],
    ]) {
      const button = document.createElement('button'); button.textContent = label;
      button.addEventListener('click', action); controls.append(button);
    }
    controls.prepend(fixtureSelect); controls.prepend(cardSelect); controls.prepend(tierSelect); controls.prepend(heroSelect);
    const updateQaOptions = () => {
      if (!heroSelect.options.length) qaHero();
      const cards = QA_LEVEL_UP_BUFF_CARDS;
      if (!cardSelect.options.length && cards.length) cards.forEach(card => cardSelect.append(new Option(card.name || card.cardId, card.cardId)));
    };
    updateQaOptions();
    document.body.append(controls);
  }
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
      quest: { canSkip: gameState.storyEntry.phase === 'opening' && !!gameState.narrativeScene?.hitZones?.skip, phase: gameState.storyEntry.phase, activeCard: gameState.storyEntry.activeCard, progress: gameState.storyEntry.progress, modal: gameState.storyEntry.modal },
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
      astralMarket: {
        active: layoutState && typeof layoutState.getActiveLayoutId === 'function'
          ? layoutState.getActiveLayoutId() === 'idleFarmLayout'
          : false,
        state: state.globals.Equipment?.market || null,
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
        .map(e => ({ uid: e.uid, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHP, flow: getHeroFlowState(e), combatPower: Number(e.combatPower || 0) })),
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
    getTargetDebugGeometry() {
      const button = typeof getAttackButtonBounds === 'function' ? getAttackButtonBounds() : null;
      const g = state.globals;
      const enemySize = Number(g.EnemySize || 40);
      return {
        canvas: (() => {
          const view = document.getElementById('view');
          const rect = view ? view.getBoundingClientRect() : null;
          return rect ? { width: rect.width, height: rect.height } : null;
        })(),
        attackButton: button ? {
          x: Number(button.dx || 0),
          y: Number(button.dy || 0),
          w: Number(button.w || 0),
          h: Number(button.h || 0),
        } : null,
        enemies: state.entities
          .filter((entity) => entity?.kind === 'enemy' && Number(entity.hp || 0) > 0)
          .map((enemy) => {
            const pos = typeof combatActorWorldToCanvas === 'function'
              ? combatActorWorldToCanvas(Number(enemy.x || 0), Number(enemy.y || 0), 'enemy')
              : { x: Number(enemy.x || 0), y: Number(enemy.y || 0) };
            return {
              uid: Number(enemy.uid || 0),
              name: String(enemy.name || ''),
              slotIndex: Number(enemy.slotIndex || 0),
              x: Number(pos.x || 0),
              y: Number(pos.y || 0),
              enemySize,
            };
          }),
      };
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
          storyEntry.skip();
          await waitForLayout('combat');
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
          storyEntry.skip();
          await waitForLayout('combat');
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
