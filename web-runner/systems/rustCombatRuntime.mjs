import { advanceBattleStartSimulation } from './combatSimulationTick.mjs';
import { createCombatBridge } from '../src/core/combatBridge.mjs';
import { createCombatAuthorityDriver } from '../src/core/combatAuthorityDriver.mjs';
import { createWfmCombatConfig, wfmEnemyInput } from './wfmCombatConfig.mjs';
import { shadowEnemy } from '../../src/core/combatShadowAdapter.mjs';
import { consumeCombatKillEvent } from '../modules/heroCommands.mjs';
import { maybeAdvanceContinuousCombatStage } from '../src/core/continuousCombatStage.mjs';
import { runtimeAssetUrl, getEmbeddedWasmBytes } from './runtimeAssetUrl.mjs';
import { recordActorPuppetDefeat } from './actorPuppetDefeats.mjs';
import { createRustCombatPresentation } from './rustCombatPresentation.mjs';
import { isRustCombatStage } from './rustCombat.mjs';

// Kept injectable for headless proof using the real WASM and WFM lifecycle.
export function createRustCombatRuntime({ state, globals: g = state.globals, bridge, session, call,
  progression, getEnemyRows, advanceHostTime, present = () => {}, warn = console.warn }) {
  let attempt = null, serial = 0, baseTime = 0, lastCombatTime = 0, lastPresentationTime = 0;
  let stageOptions, advanced = false, failed = false, introNow = null;
  const hosts = new Map(), seenSpawns = new Set(), hostHeroes = new Map();
  function restoreHostHeroes() {
    for (const [actor, original] of hostHeroes) {
      const ratio = actor.maxHP > 0 ? actor.hp / actor.maxHP : 0;
      actor.maxHP = original.maxHP;
      actor.hp = Math.max(0, Math.min(actor.maxHP, actor.maxHP * ratio));
      actor.isAlive = actor.hp > 0;
      delete actor.rustActorId; delete actor.rustState;
    }
    hostHeroes.clear();
  }
  function stop() {
    driver.stop(); restoreHostHeroes(); attempt = null; introNow = null; hosts.clear(); seenSpawns.clear();
    present(null);
  }
  function finishFailure(error) {
    if (failed) return;
    failed = true; restoreHostHeroes(); attempt = null;
    g.RustCombatError = String(error);
    g.RustCombatReceipt = { ...g.RustCombatReceipt, outcome: 'bridge_error' };
    present(null); warn('[rustCombat] encounter ended:', error);
    session.surrenderBossAttempt('rust_bridge_error');
  }
  function project(snapshot) {
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
      Object.assign(actor, { x: view.pos.x, y: view.pos.y, footX: view.pos.x, footY: view.pos.y,
        originX: view.pos.x, originY: view.pos.y, hp: view.hp, maxHP: view.max_hp,
        isAlive: view.hp > 0, facing: view.facing, rustActorId: view.actor_id, rustState: view.state,
        streamState: 'engaged', locomotion: view.state === 'walk' ? 'walk' : 'idle',
        actionState: view.state, actionFacing: view.facing, actionStateStartedAt: g.time - view.state_age,
        actionStateUntil: g.time - view.state_age + view.state_duration, actionImpactAt: g.time - view.state_age + view.impact_at });
    }
  }
  function consume(snapshot, events) {
    const combatDelta = snapshot.combat_time - lastCombatTime;
    const presentationDelta = snapshot.time - lastPresentationTime;
    advanceHostTime?.({ state, dt: combatDelta, activeSeconds: presentationDelta, presentationSeconds: presentationDelta });
    g.time = baseTime + snapshot.combat_time;
    lastCombatTime = snapshot.combat_time; lastPresentationTime = snapshot.time;
    let bossKilled = false;
    project(snapshot);
    if (g.ContinuousCombatStage?.bossActive) g.ContinuousCombatStage.bossCameraCenterX = snapshot.camera_focus.x;
    for (const event of events) {
      const { kind, data } = event.body;
      if (kind === 'died') {
        const enemy = hosts.get(data.actor);
        if (enemy?.kind === 'enemy') {
          if (Number(enemy.uid) === Number(g.ContinuousCombatStage?.bossUID)) bossKilled = true;
          recordActorPuppetDefeat(g, enemy);
          consumeCombatKillEvent(g.ProgressionBattle, { enemy });
          if (g.HeroProgressStorageError) throw new Error(g.HeroProgressStorageError);
          const index = state.entities.indexOf(enemy);
          if (index >= 0) state.entities.splice(index, 1);
          g.EnemySlots[enemy.slotIndex] = 0;
          if (g.EnemyIDs) g.EnemyIDs[enemy.slotIndex] = 0;
          progression?.recordCommittedEnemyDefeats(g.ProgressionBattle);
        }
      } else if (kind === 'damage') {
        const target = hosts.get(data.target);
        // The slice presentation consumes the same ordered Rust damage event.
      } else if (!['spawned', 'downed', 'revived', 'all_down', 'ended', 'presentation'].includes(kind)) {
        throw new Error(`Unknown Rust gameplay event: ${kind}`);
      }
    }
    call('UpdateHeroHPUI'); call('UpdateEnemyHPUI');
    g.RustCombatReceipt = { encounterId: snapshot.encounter_id, step: snapshot.step, sequence: snapshot.last_event_sequence,
      outcome: bossKilled ? 'ended' : snapshot.state, seconds: snapshot.combat_time, presentationSeconds: snapshot.time,
      kills: Object.keys(g.ProgressionBattle?.defeated || {}).length,
      downed: snapshot.actors.filter(a => a.team === 'hero' && a.downed).length };
    if (!bossKilled && snapshot.state === 'all_down') {
      stop(); session.surrenderBossAttempt('rust_all_down'); return;
    }
    if (bossKilled || snapshot.state === 'ended') {
      // Release the combat world before WFM restores/persists its own stat scale.
      stop();
      // Boss death completes WFM's objective. Remaining summons are despawned
      // after world destruction, with no synthetic kills or rewards.
      if (bossKilled) {
        state.entities.splice(0, state.entities.length, ...state.entities.filter(a => a.kind === 'hero'));
        g.EnemySlots.fill(0); g.EnemyIDs?.fill(0);
      }
    } else present(snapshot, events);
    if (stageOptions) {
      advanced = maybeAdvanceContinuousCombatStage({ ...stageOptions, entities: state.entities, presentationBarrier: { lanes: {} }, combatTick() {},
        onBossTimeout() { g.RustCombatReceipt.outcome = 'timeout'; stop(); stageOptions.onBossTimeout?.(); } }) || advanced;
    }
  }
  const driver = createCombatAuthorityDriver({ bridge, consume, onError: finishFailure });
  function tickFrame(options) {
    stageOptions = options; advanced = false;
    if (failed) { session.surrenderBossAttempt('rust_bridge_error'); return false; }
    if (!isRustCombatStage(g)) { if (attempt) stop(); return false; }
    const stage = g.ContinuousCombatStage;
    if (g.BattleStartActive) {
      const dt = introNow === null ? .001 : Math.max(0, Math.min(.05, (options.nowMs - introNow) / 1000));
      introNow = options.nowMs;
      advanceHostTime({ state, dt });
      advanceBattleStartSimulation({ state, runCombatStep: call });
      return false;
    }
    introNow = null;
    if (g.GamePhase !== 'RUNTIME' || Number(stage.bossTransitionEndsAtMs || 0) > Date.now()) { driver.advance(options.nowMs, true); return false; }
    const key = `${g.CombatSessionId}:${stage.bossUID}`;
    if (attempt !== key) {
      stop(); attempt = key; baseTime = Number(g.time || 0); lastCombatTime = 0; lastPresentationTime = 0;
      for (const hero of state.entities.filter(a => a.kind === 'hero')) hostHeroes.set(hero, { maxHP: hero.maxHP });
      try {
        const config = createWfmCombatConfig({ globals: g, entities: state.entities, enemyRows: getEnemyRows(), encounterId: `rust:1-1-boss:${key}:${++serial}` });
        if (!config.enemies.some(enemy => enemy.spawn_key === String(stage.bossUID))) throw new Error('Missing WFM boss spawn');
        for (const enemy of config.enemies) seenSpawns.add(enemy.spawn_key);
        driver.start(config);
      } catch (error) { finishFailure(error); return false; }
    }
    const additions = state.entities.filter(a => a.kind === 'enemy' && !a.rustActorId && a.hp > 0 && !seenSpawns.has(String(a.uid)));
    if (additions.length) {
      driver.spawn(additions.map(a => shadowEnemy(wfmEnemyInput(a, getEnemyRows()))));
      additions.forEach(a => seenSpawns.add(String(a.uid)));
    }
    driver.advance(options.nowMs);
    return advanced;
  }
  function tick(options) {
    try { return tickFrame(options); }
    catch (error) { try { stop(); } finally { finishFailure(error); } return false; }
  }
  return { tick, stop, pause() { introNow = null; driver.advance(0, true); }, dispose: stop, read: driver.read };
}

export async function mountRustCombat(options) {
  const url = runtimeAssetUrl('simulation_core.wasm');
  const bytes = getEmbeddedWasmBytes(url) || await fetch(url).then(response => {
    if (!response.ok) throw new Error(`Combat WASM HTTP ${response.status}`);
    return response.arrayBuffer();
  });
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const overlay = await createRustCombatPresentation(options.globals);
  const runtime = createRustCombatRuntime({ ...options, bridge: createCombatBridge(instance), present: overlay.present });
  const dispose = () => { runtime.dispose(); overlay.dispose(); window.removeEventListener('pagehide', dispose); };
  window.addEventListener('pagehide', dispose);
  return { ...runtime, dispose };
}
