import { createCombatBridge } from '../src/core/combatBridge.mjs';
import { createCombatShadowDriver } from '../src/core/combatShadowDriver.mjs';
import { createShadowConfig, shadowEnemy } from '../../src/core/combatShadowAdapter.mjs';
import { heroDefinition } from '../src/core/heroDefinitions.mjs';
import { permanentHeroModifiers } from '../src/core/realtimeSkillState.mjs';
import { projectCombatStat } from '../../src/core/combatModifierRules.mjs';
import { deriveCombatWorldBounds, deriveCombatWorldVerticalBounds } from '../../src/core/combatOrientation.mjs';
import { runtimeAssetUrl, getEmbeddedWasmBytes } from './runtimeAssetUrl.mjs';

export async function mountRustCombatShadow({ state, gameState, getLayout, getEnemyRows }) {
  const url = runtimeAssetUrl('simulation_core.wasm');
  const bytes = getEmbeddedWasmBytes(url) || await fetch(url).then(response => {
    if (!response.ok) throw new Error(`Shadow WASM HTTP ${response.status}`);
    return response.arrayBuffer();
  });
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const bridge = createCombatBridge(instance);
  if (!bridge.describe().capabilities.includes('spawn_enemies')) throw new Error('Shadow requires spawn_enemies');
  const driver = createCombatShadowDriver({ bridge });
  const panel = document.createElement('pre');
  panel.id = 'rust-shadow-readout';
  panel.style.cssText = 'position:fixed;left:4px;top:4px;margin:0;padding:5px;max-width:calc(100vw - 18px);white-space:pre-wrap;background:#111e;color:#eee;font:10px/1.35 monospace;z-index:9999;pointer-events:none';
  panel.textContent = 'rustShadow: waiting for Chapter 1 boss';
  document.body.append(panel);
  let attempt = null, endedAttempt = null, failed = false, startedAt = 0;
  const point = actor => ({ x: Number(actor.x), y: Number(actor.y) });
  const enemyInput = actor => {
    const key = actor.name;
    const reference = getEnemyRows().find(row => row.name === key);
    if (!reference) throw new Error(`Missing authored shadow reference: ${key}`);
    return { identity: String(actor.uid), key, position: point(actor), reference,
      resolved: { ...actor.stats, HP: actor.maxHP }, hp: actor.hp, hostMaxHP: actor.maxHP };
  };
  function comparison(outcome) {
    const heroes = state.entities.filter(a => a.kind === 'hero');
    const liveEnemies = state.entities.filter(a => a.kind === 'enemy' && a.hp > 0).length;
    return { tick: Math.floor((Number(state.globals.time || 0) - startedAt) * 30 + 1e-6),
      heroes: heroes.map(a => ({ name: heroDefinition(a).name, hp: a.hp })), liveEnemies,
      outcome: outcome || (state.globals.ProgressionBattle?.outcome !== 'active' && state.globals.ProgressionBattle?.outcome) ||
        (!heroes.some(a => a.hp > 0) ? 'all_down' : !liveEnemies ? 'ended' : 'running') };
  }
  function render() {
    const result = driver.read();
    failed = result.disabled;
    if (failed) { panel.textContent = 'rustShadow: disabled (see console)'; return; }
    const rust = result.snapshot;
    panel.textContent = `1-1-boss | primary-channel projection\nRust tick ${rust.step} | JS tick ${result.js.tick}\n` +
      `Rust HP ${rust.actors.filter(a => a.team === 'hero').map(a => `${a.kind}:${Math.ceil(a.hp)}`).join(' ')}\n` +
      `JS HP ${result.js.heroes.map(a => `${a.name}:${Math.ceil(a.hp)}`).join(' ')}\n` +
      `Enemies Rust ${rust.live_enemies} | JS ${result.js.liveEnemies}\nOutcome Rust ${rust.state} | JS ${result.js.outcome}`;
  }
  function update() {
    if (failed) return;
    try {
      const g = state.globals, stage = g.ContinuousCombatStage;
      const selected = Number(g.ContinuousCombatStageLoop) === 1 && stage?.region === 1 && stage.stage === 1 && stage.bossActive;
      const inCombat = getLayout() === 'combat' && gameState.storyEntry?.phase === 'combat';
      const key = selected ? `${g.CombatSessionId}:${stage.bossUID}` : null;
      if (!selected || !inCombat) {
        if (attempt !== null) {
          // WFM may already have spawned the next chapter and restored HP.
          // Retain the last in-encounter actor sample and its terminal outcome.
          const last = driver.read().js;
          driver.advance({ time: Number(g.time || 0), paused: document.hidden,
            comparison: { ...last, tick: comparison().tick,
              liveEnemies: selected ? last.liveEnemies : 0, outcome: stage?.lastBossOutcome || 'exit' } });
          render(); driver.stop(); endedAttempt = attempt; attempt = null;
        }
        return;
      }
      if (key === endedAttempt) return;
      const heroes = state.entities.filter(actor => actor.kind === 'hero');
      const enemies = state.entities.filter(actor => actor.kind === 'enemy' && actor.hp > 0);
      const time = Number(g.time || 0);
      if (attempt !== key) {
        if (!enemies.length) return;
        const x = deriveCombatWorldBounds(), y = deriveCombatWorldVerticalBounds();
        const origin = { x: heroes.reduce((sum, a) => sum + a.x, 0) / heroes.length,
          y: heroes.reduce((sum, a) => sum + a.y, 0) / heroes.length };
        const gobloc = g.EnemyData.find(row => row.name === 'Gobloc');
        driver.start(createShadowConfig({ encounterId: `shadow:1-1-boss:${key}`, seed: stage.seed,
          // WFM world units map 1:1. No viewport/camera transform touches actor feet.
          geometry: { floor: { min: { x: x.minX, y: y.minY }, max: { x: x.maxX, y: y.maxY } },
            viewport_world: { x: x.visibleWorldWidth, y: y.safeViewportBottom / y.zoom - y.safeViewportTop / y.zoom },
            formation_origin: origin, screen_bound: false },
          heroes: heroes.map((actor, slot) => {
            const definition = heroDefinition(actor);
            const modifiers = permanentHeroModifiers(g, actor);
            // Level/gear are already in actor.stats and combatBaseMaxHP. Only
            // the existing permanent owner projects training/stars, once.
            const resolved = Object.fromEntries(Object.keys(definition.baseStats).map(stat => [stat,
              projectCombatStat(stat === 'HP' ? actor.combatBaseMaxHP : actor.stats[stat], stat, modifiers)]));
            return { identity: String(actor.heroInstanceKey), key: definition.key, slot, position: point(actor),
              resolved, reference: definition.baseStats, hp: actor.hp, hostMaxHP: actor.maxHP };
          }),
          enemies: enemies.map(enemyInput),
          summon: { resolved: gobloc, reference: getEnemyRows().find(row => row.name === 'Gobloc') },
        }), time);
        attempt = key;
        startedAt = time;
      }
      driver.advance({ time, paused: document.hidden || gameState.storyEntry.combatPaused,
        enemies: enemies.map(actor => shadowEnemy(enemyInput(actor))),
        comparison: comparison() });
      render();
    } catch (error) {
      failed = true; driver.stop(); panel.textContent = 'rustShadow: disabled (see console)';
      console.warn('[rustShadow] disabled for this session:', error);
    }
  }
  function dispose() { driver.stop(); panel.remove(); window.removeEventListener('pagehide', dispose); }
  window.addEventListener('pagehide', dispose);
  return { update, dispose };
}
