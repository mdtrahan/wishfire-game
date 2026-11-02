import { authorSubwaves, bindAuthoredSubwaves, subwaveReady } from '../src/core/continuousCombatSubwaves.mjs';
import { continuousCombatWavesForStage } from '../src/core/continuousCombatProgressionRules.mjs';
import { advanceBattleStartSimulation } from './combatSimulationTick.mjs';
import { createCombatBridge } from '../src/core/combatBridge.mjs';
import { createCombatAuthorityDriver } from '../src/core/combatAuthorityDriver.mjs';
import { createWfmCombatConfig, wfmEnemyInput, wfmHeroPermanentInputs } from './wfmCombatConfig.mjs';
import { shadowEnemy } from '../../src/core/combatShadowAdapter.mjs';
import { consumeCombatKillEvent } from '../modules/heroCommands.mjs';
import { maybeAdvanceContinuousCombatStage, buildChapterOneSubwaveStages, getContinuousCombatPartyCP } from '../src/core/continuousCombatStage.mjs';
import { runtimeAssetUrl, getEmbeddedWasmBytes } from './runtimeAssetUrl.mjs';
import { recordActorPuppetDefeat } from './actorPuppetDefeats.mjs';
import { createRustCombatPresentation } from './rustCombatPresentation.mjs';
import { bindHeroPermanentInputs } from '../src/core/heroPermanentInputs.mjs';
import { saveHeroProgress, validateCombatCheckpoint, WFM_COMBAT_CONTENT_VERSION, WFM_COMBAT_ABI_VERSION } from '../src/core/heroProgression.mjs';
import { isActorRecoveryRevealActive } from '../src/core/actorPresentationState.mjs';
import { isRustCombatStage } from './rustCombat.mjs';

// Pinned slice Boss KO: 12 frames at 12 fps; actors.rs fade and impact_stop.rs camera.
const BOSS_KO_SECONDS = 1, CORPSE_FADE = .42, DEATH_CAMERA_SECONDS = .32;

// Kept injectable for headless proof using the real WASM and WFM lifecycle.
export function createRustCombatRuntime({ state, globals: g = state.globals, bridge, session, call,
  progression, getEnemyRows, advanceHostTime, present = () => {}, warn = console.warn, persistCheckpoint }) {
  let attempt = null, baseTime = 0, lastCombatTime = 0, lastPresentationTime = 0;
  g.RustCombatAuthority = true;
  let hostTransition = false, subwaves = [], previousSubwave = [], subwaveStarted = 0;
  let stageOptions, advanced = false, failed = false, introNow = null, tail = null;
  const hosts = new Map(), seenSpawns = new Set(), hostHeroes = new Map();
  function queuePermanentInputs(heroId) {
    if (!driver.isActive()) return;
    for (const [actor, original] of hostHeroes) {
      if (heroId && String(actor.heroInstanceKey) !== heroId) continue;
      const source = g.HeroProgress?.heroes?.[actor.heroInstanceKey];
      if (source) for (const key of ['currentLevel', 'currentEXP', 'equipmentStats', 'lampEXPClaimed', 'EXPToNextLevel']) actor[key] = source[key];
      const inputs = wfmHeroPermanentInputs(g, actor);
      original.maxHP = inputs.host_max_hp;
      driver.replacePermanentInputs(String(actor.heroInstanceKey), inputs);
    }
  }
  g.RustCombatPermanentInputs = queuePermanentInputs;
  function restoreHostHeroes(keepVisuals = false) {
    for (const [actor, original] of hostHeroes) {
      const ratio = actor.maxHP > 0 ? actor.hp / actor.maxHP : 0;
      original.unbind?.();
      const source = g.HeroProgress?.heroes?.[actor.heroInstanceKey];
      if (source) Object.assign(actor, { stats: { ...source.stats }, combatBaseMaxHP: source.maxHP });
      actor.maxHP = original.maxHP;
      actor.hp = Math.max(0, Math.min(actor.maxHP, actor.maxHP * ratio));
      actor.isAlive = actor.hp > 0;
      if (!keepVisuals) { delete actor.rustActorId; delete actor.rustState; }
    }
    if (!keepVisuals) hostHeroes.clear();
  }
  function stop(reason = 'host_stage_transition') {
    subwaves = []; previousSubwave = [];
    driver.stop(reason); restoreHostHeroes(); attempt = null; introNow = null; tail = null; hosts.clear(); seenSpawns.clear();
    present(null);
  }
  function finishFailure(error) {
    if (failed) return;
    failed = true; restoreHostHeroes(); attempt = null;
    g.RustCombatError = String(error);
    g.RustCombatReceipt = { ...g.RustCombatReceipt, outcome: 'bridge_error' };
    present(null); warn('[rustCombat] encounter ended:', error);
    if (error.code?.startsWith('WFM_CHECKPOINT_') || g.HeroProgressStorageError) return;
    if (g.ContinuousCombatStage?.bossActive) session.surrenderBossAttempt('rust_bridge_error');
    else session.recoverContinuousDefeat('rust_bridge_error');
  }
  function project(snapshot, visualOnly = false) {
    for (const pending of snapshot.pending_spawns || []) {
      const actor = state.entities.find(a => a.kind === 'enemy' && String(a.uid) === pending.host_id);
      if (actor) Object.assign(actor, { hp: 0, isAlive: false });
    }
    for (const view of snapshot.actors) {
      let actor = hosts.get(view.actor_id);
      if (!actor && view.host_id != null) {
        actor = state.entities.find(a => view.team === 'hero' ? String(a.heroInstanceKey) === view.host_id : String(a.uid) === view.host_id);
      }
      if (!actor && view.team === 'enemy') {
        if (view.kind !== 'gobloc') throw new Error(`Unsupported Rust summon: ${view.kind}`);
        const row = g.EnemyData.find(row => row.name === 'Gobloc');
        const uid = Math.max(Number(g.NextUID || 0), ...state.entities.map(a => Number(a.uid) + 1));
        g.NextUID = uid + 1;
        actor = { uid, kind: 'enemy', name: 'Gobloc', key: 'Gobloc', enemyRole: 'fodder', stats: { ...row }, slotIndex: g.EnemySlots.length };
        state.entities.push(actor); g.EnemySlots.push(uid + 1); (g.EnemyIDs ||= []).push(uid);
      }
      if (!actor) continue;
      hosts.set(view.actor_id, actor);
      const heldCharge=snapshot.spotlight?.phase==='charge'&&snapshot.spotlight.caster===view.actor_id;
      const visual=g.RustCombatPresentation?.pose(view);
      const shownState=heldCharge?'cast':visual?.poseState??view.state,shownAge=heldCharge?0:visual?.poseState?visual.poseAge:view.state_age;
      const shownFacing=g.RustCombatPresentation?.motion.records.get(view.actor_id)?.facing??view.facing;
      if (!visualOnly) Object.assign(actor, { hp: view.hp, maxHP: view.max_hp, isAlive: view.hp > 0 });
      Object.assign(actor, { x: view.pos.x, y: view.pos.y, footX: view.pos.x, footY: view.pos.y,
        originX: view.pos.x, originY: view.pos.y, facing: shownFacing, rustActorId: view.actor_id, rustState: view.state,
        streamState: 'engaged', locomotion: view.state === 'walk' ? 'walk' : 'idle',
        actionState: shownState, actionFacing: shownFacing, actionStateStartedAt: g.time - shownAge,
        actionStateUntil: g.time - shownAge + (visual?.poseState ? visual.poseDuration : view.state_duration), actionImpactAt: g.time - shownAge + (visual?.poseState ? visual.poseImpact : view.impact_at) });
    }
  }
  function consume(snapshot, events) {
    const combatDelta = snapshot.combat_time - lastCombatTime;
    const presentationDelta = snapshot.time - lastPresentationTime;
    advanceHostTime?.({ state, dt: combatDelta, activeSeconds: presentationDelta, presentationSeconds: presentationDelta });
    g.time = baseTime + snapshot.combat_time;
    lastCombatTime = snapshot.combat_time; lastPresentationTime = snapshot.time;
    let bossKilled = false, bossPicture;
    present(snapshot, events);
    project(snapshot);
    if (g.ContinuousCombatStage?.bossActive) g.ContinuousCombatStage.bossCameraCenterX = snapshot.camera_focus.x;
    for (const event of events) {
      const { kind, data } = event.body;
      if (kind === 'died') {
        const enemy = hosts.get(data.actor);
        if (enemy?.kind === 'enemy') {
          if (Number(enemy.uid) === Number(g.ContinuousCombatStage?.bossUID)) bossKilled = true;
          const picture = recordActorPuppetDefeat(g, enemy);
          if (bossKilled && Number(enemy.uid) === Number(g.ContinuousCombatStage?.bossUID)) bossPicture = picture;
          consumeCombatKillEvent(g.ProgressionBattle, { enemy });
            const index = state.entities.indexOf(enemy);
          if (index >= 0) state.entities.splice(index, 1);
          g.EnemySlots[enemy.slotIndex] = 0;
          if (g.EnemyIDs) g.EnemyIDs[enemy.slotIndex] = 0;
          progression?.recordCommittedEnemyDefeats(g.ProgressionBattle);
        }
      } else if (kind === 'damage') {
        const target = hosts.get(data.target);
        // The slice presentation consumes the same ordered Rust damage event.
      } else if (!['spawned', 'downed', 'revived', 'all_down', 'ended', 'despawned', 'presentation', 'permanent_inputs_applied'].includes(kind)) {
        throw new Error(`Unknown Rust gameplay event: ${kind}`);
      }
    }
    call('UpdateHeroHPUI'); call('UpdateEnemyHPUI');
    g.RustCombatReceipt = { encounterId: snapshot.encounter_id, step: snapshot.step, sequence: snapshot.last_event_sequence,
      outcome: bossKilled ? 'ended' : snapshot.state, seconds: snapshot.combat_time, presentationSeconds: snapshot.time,
      kills: Object.keys(g.ProgressionBattle?.defeated || {}).length,
      downed: snapshot.actors.filter(a => a.team === 'hero' && a.downed).length };
    if (snapshot.state === 'all_down') {
      const boss = g.ContinuousCombatStage?.bossActive;
      stop('all_down_routed');
      if (boss) session.surrenderBossAttempt('rust_all_down');
      else session.recoverContinuousDefeat('rust_all_down');
      return;
    }
    if (bossKilled) {
      // Rewards and world destruction happen at death. Only the visual transition waits.
      driver.stop('host_stage_transition'); restoreHostHeroes(true);
      state.entities.splice(0, state.entities.length, ...state.entities.filter(a => a.kind === 'hero'));
      g.EnemySlots.fill(0); g.EnemyIDs?.fill(0);
      stageOptions.onBossClear?.();
      call('SettleContinuousCombatRewards');
      const freeze = Math.max(0, snapshot.hit_stop?.remaining || 0);
      const visual = structuredClone(snapshot);
      visual.hit_stop = null;
      visual.hazards = []; visual.projectiles = [];
      for (const actor of visual.actors) { actor.encased = 0; actor.slowed = 0; }
      tail = { visual, spare: structuredClone(visual), ages: snapshot.actors.map(a => a.state_age), freeze, elapsed: 0, previousNow: stageOptions.nowMs,
        born: snapshot.time, combatBorn: snapshot.combat_time, picture: bossPicture,
        // actors.rs: 12 KO frames at 12 fps + .42 fade; impact_stop.rs: .32 camera.
        duration: freeze + Math.max(BOSS_KO_SECONDS + CORPSE_FADE, DEATH_CAMERA_SECONDS) };
      present(visual, []); project(visual, true);
      return;
    }
    if (!hostTransition && subwaves.length) {
      const living = new Set(snapshot.actors.filter(a => a.team === 'enemy' && a.hp > 0).map(a => a.host_id).concat((snapshot.pending_spawns || []).map(a => a.host_id)));
      if (subwaveReady(previousSubwave, living, snapshot.combat_time - subwaveStarted)) {
        hostTransition = true;
        try { releaseSubwave(snapshot.combat_time); } finally { hostTransition = false; }
      }
      return;
    }
    if (snapshot.pending_spawns?.length) return;
    const stage = g.ContinuousCombatStage;
    if (!hostTransition && !stage?.bossActive && snapshot.live_enemies === 0
        && Number(stage?.wave || 1) < continuousCombatWavesForStage(stage?.region, stage?.stage)) {
      if (!snapshot.chest) {
        hostTransition = true;
        try { driver.waveChest(); } finally { hostTransition = false; }
        return;
      }
      if (!snapshot.chest.ready) return;
    }
    if (stageOptions && !hostTransition) {
      const stage = g.ContinuousCombatStage;
      hostTransition = true;
      try {
        const moved = maybeAdvanceContinuousCombatStage({ ...stageOptions, allowDowned: true, entities: state.entities,
          presentationBarrier: { lanes: {} }, combatTick() {},
          onOrdinaryClear(cleared) {
            driver.ordinaryClear(`${cleared.region}:${cleared.stage}:${cleared.wave}:${cleared.transitions}`);
            if (g.HeroProgress) {
              for (const hero of hostHeroes.keys()) saveHeroProgress(hero, g.HeroProgress);
              g.HeroProgressDirty = true;
            }
          },
          onBossTimeout() { g.RustCombatReceipt.outcome = 'timeout'; stop('host_timeout'); stageOptions.onBossTimeout?.(); } });
        if (moved) {
          advanced = true;
          if (g.ContinuousCombatStage.bossActive !== stage.bossActive || g.ContinuousCombatStage.region !== stage.region) stop();
          else spawnAdditions();
        }
      } finally { hostTransition = false; }
    }
  }
  function advanceTail(options) {
    const dt = tail.previousNow === null ? 0 : Math.max(0, (options.nowMs - tail.previousNow) / 1000);
    tail.previousNow = options.nowMs;
    tail.elapsed += dt;
    // Host clocks, Bag accrual and receipts keep their normal timing during presentation.
    advanceHostTime?.({ state, dt, activeSeconds: dt, presentationSeconds: dt });
    const age = Math.max(0, Math.min(tail.duration, tail.elapsed) - tail.freeze);
    const visual = tail.spare; tail.spare = tail.visual; tail.visual = visual;
    visual.time = tail.born + age; visual.combat_time = tail.combatBorn + age;
    for (let i = 0; i < visual.actors.length; i++) visual.actors[i].state_age = tail.ages[i] + age;
    present(visual, []); project(visual, true);
    if (tail.picture) {
      tail.picture.actionStateStartedAt = g.time - age;
      tail.picture.actionStateUntil = g.time - age + BOSS_KO_SECONDS;
      tail.picture.puppetDefeatEndsAt = g.time + Math.max(0, tail.duration - tail.elapsed);
    }
    if (tail.elapsed + 1e-9 < tail.duration) return false;
    stop();
    return maybeAdvanceContinuousCombatStage({ ...options, entities: state.entities,
      presentationBarrier: { lanes: {} }, combatTick() {}, onBossClear: undefined,
      call(name, ...args) { if (name !== 'SettleContinuousCombatRewards') return options.call(name, ...args); } });
  }
  const driver = createCombatAuthorityDriver({ bridge, consume, onError: finishFailure });
  function showSubwave(batch) {
    for (const actor of batch) {
      if (!state.entities.includes(actor)) state.entities.push(actor);
      g.EnemySlots[actor.slotIndex] = actor.uid + 1;
      if (g.EnemyIDs) g.EnemyIDs[actor.slotIndex] = actor.uid;
    }
  }
  function prepareSubwaves(enemies) {
    if (!enemies.length) return [];
    const stage = g.ContinuousCombatStage;
    if (!g.RustCombatSubwaveAuthoring || g.RustCombatSubwaveAuthoring.seed !== stage.seed || g.RustCombatSubwaveAuthoring.region !== stage.region) {
      g.RustCombatSubwaveAuthoring = { seed: stage.seed, region: stage.region,
        stages: stage.region === 1 ? buildChapterOneSubwaveStages(getEnemyRows(), { seed: stage.seed, partyCP: getContinuousCombatPartyCP(state.entities) }) : [] };
    }
    const stages = g.RustCombatSubwaveAuthoring.stages;
    let authored = stages.find(s => s.stage === stage.stage);
    if (!authored) { authored = { stage: stage.stage, waves: [] }; stages.push(authored); }
    // Resolve the current checkpoint/CP against the exact host plan, retaining every identity.
    const wave = { subwaves: authorSubwaves(enemies.map(a => a.name)) };
    if (!stage.bossActive) authored.waves[stage.wave - 1] = wave;
    const groups = stage.bossActive ? [enemies] : bindAuthoredSubwaves(wave.subwaves, enemies);
    subwaves = groups.slice(1); previousSubwave = groups[0]; subwaveStarted = lastCombatTime;
    const hidden = new Set(subwaves.flat());
    state.entities.splice(0, state.entities.length, ...state.entities.filter(a => !hidden.has(a)));
    for (const actor of hidden) { g.EnemySlots[actor.slotIndex] = 0; if (g.EnemyIDs) g.EnemyIDs[actor.slotIndex] = 0; }
    enemies.forEach(a => seenSpawns.add(String(a.uid)));
    return previousSubwave;
  }
  function releaseSubwave(now) {
    previousSubwave = subwaves.shift(); subwaveStarted = now;
    showSubwave(previousSubwave);
    driver.spawn(previousSubwave.map(a => shadowEnemy(wfmEnemyInput(a, getEnemyRows()))));
  }
  function spawnAdditions() {
    const additions = state.entities.filter(a => a.kind === 'enemy' && !a.rustActorId && a.hp > 0 && !seenSpawns.has(String(a.uid)));
    if (additions.length) {
      const batch = prepareSubwaves(additions);
      driver.spawn(batch.map(a => shadowEnemy(wfmEnemyInput(a, getEnemyRows()))));
    }
  }
  function tickFrame(options) {
    stageOptions = options; advanced = false;
    if (failed) return false;
    if (g.HeroProgressStorageError) throw new Error(g.HeroProgressStorageError);
    if (!isRustCombatStage(g)) { if (attempt) stop(); return false; }
    const stage = g.ContinuousCombatStage;
    if (tail) return advanceTail(options);
    if (g.BattleStartActive || state.entities.some(a => a.kind === 'hero' && isActorRecoveryRevealActive(a, g.time || 0))) {
      const dt = introNow === null ? .001 : Math.max(0, Math.min(.05, (options.nowMs - introNow) / 1000));
      introNow = options.nowMs;
      advanceHostTime({ state, dt });
      if (g.BattleStartActive) advanceBattleStartSimulation({ state, runCombatStep: call });
      return false;
    }
    introNow = null;
    if (g.GamePhase !== 'RUNTIME' || Number(stage.bossTransitionEndsAtMs || 0) > Date.now()) { driver.advance(options.nowMs, true); return false; }
    const key = `${g.CombatSessionId}:${stage.region}:${stage.stage}:${stage.bossActive}:${stage.bossUID}:${stage.defeatRecoveries || 0}`;
    if (attempt !== key) {
      stop(); attempt = key; baseTime = Number(g.time || 0); lastCombatTime = 0; lastPresentationTime = 0;
      for (const hero of state.entities.filter(a => a.kind === 'hero')) hostHeroes.set(hero, { maxHP: hero.maxHP });
      try {
        if (!stage.combatCheckpoint) stage.combatCheckpoint = {
          version: 1, id: crypto.randomUUID(), generation: 1,
          rewardLineage: String(g.ProgressionBattle?.id || crypto.randomUUID()),
          contentVersion: WFM_COMBAT_CONTENT_VERSION, abiVersion: WFM_COMBAT_ABI_VERSION,
        };
        validateCombatCheckpoint({ ...stage, transitions: Number(stage.transitions || 0) }, bridge.describe().abi_version);
        if (typeof persistCheckpoint !== 'function' || persistCheckpoint() !== true) {
          const error = new Error('WFM checkpoint: save failed before Rust attempt creation');
          error.code = 'WFM_CHECKPOINT_SAVE_FAILED';
          throw error;
        }
        if (g.WfmCheckpointReload) stage.bossTimerStartedAt = null;
        prepareSubwaves(state.entities.filter(a => a.kind === 'enemy' && a.hp > 0));
        const config = createWfmCombatConfig({ globals: g, entities: state.entities, enemyRows: getEnemyRows(), encounterId: `rust:${stage.combatCheckpoint.id}:${crypto.randomUUID()}`, checkpointEntry: g.WfmCheckpointReload === true });
        config.spawn_markers = !stage.bossActive;
        if (stage.bossActive && !config.enemies.some(enemy => enemy.spawn_key === String(stage.bossUID))) throw new Error('Missing WFM boss spawn');
        for (const enemy of config.enemies) seenSpawns.add(enemy.spawn_key);
        driver.start(config);
        if (driver.isActive()) g.WfmCheckpointReload = false;
        if (driver.isActive()) for (const [hero, original] of hostHeroes) {
          const fallback = structuredClone(hero);
          original.unbind = bindHeroPermanentInputs(hero, {
            read: () => g.HeroProgress?.heroes?.[hero.heroInstanceKey] || fallback,
            commit(draft) {
              if (g.HeroProgress) { saveHeroProgress(draft, g.HeroProgress); g.HeroProgressDirty = true; }
              else Object.assign(fallback, draft);
              queuePermanentInputs(String(hero.heroInstanceKey));
            },
          });
        }
      } catch (error) { finishFailure(error); return false; }
    }
    spawnAdditions();
    driver.advance(options.nowMs);
    return advanced;
  }
  function tick(options) {
    try { return tickFrame(options); }
    catch (error) { try { stop(); } finally { finishFailure(error); } return false; }
  }
  return { tick, stop, pause() { introNow = null; if (tail) tail.previousNow = null; driver.advance(0, true); }, dispose() { stop(); delete g.RustCombatAuthority; delete g.RustCombatPermanentInputs; }, read: driver.read };
}

export async function mountRustCombat(options) {
  const url = runtimeAssetUrl('simulation_core.wasm');
  const bytes = getEmbeddedWasmBytes(url) || await fetch(url).then(response => {
    if (!response.ok) throw new Error(`Combat WASM HTTP ${response.status}`);
    return response.arrayBuffer();
  });
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const overlay = await createRustCombatPresentation(options.globals);
  const { persistHeroProgressIfDirty } = await import('./heroProgressStorage.js');
  const persistCheckpoint = () => {
    options.globals.HeroProgressDirty = true;
    return persistHeroProgressIfDirty({ stateGlobals: options.globals });
  };
  const runtime = createRustCombatRuntime({ ...options, persistCheckpoint, bridge: createCombatBridge(instance), present: overlay.present });
  const dispose = () => { runtime.dispose(); overlay.dispose(); window.removeEventListener('pagehide', dispose); };
  window.addEventListener('pagehide', dispose);
  return { ...runtime, dispose };
}
