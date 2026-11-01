// Headless observer: configs and JS comparisons are copied at the boundary.
export function createCombatShadowDriver({ bridge, warn = console.warn }) {
  let world = null, encounterId = null, snapshot = null, disabled = false;
  let debt = 0, hostTime = null, seen = new Set(), js = null;
  function destroy() {
    const handle = world;
    world = null;
    if (handle !== null) bridge.destroy(handle);
  }
  function fail(error) {
    disabled = true;
    try { destroy(); } catch { /* Original error is reported once. */ }
    warn('[rustShadow] disabled for this session:', error);
  }
  function stop() {
    try { destroy(); } catch (error) { fail(error); }
    encounterId = null; hostTime = null; debt = 0; seen.clear();
  }
  function start(config, time) {
    stop();
    if (disabled) return;
    try {
      const copied = structuredClone(config);
      const result = bridge.create(copied);
      world = result.world; snapshot = result.snapshot; encounterId = copied.encounter_id;
      seen = new Set(copied.enemies.map(enemy => enemy.spawn_key));
      hostTime = time;
    } catch (error) { fail(error); }
  }
  function advance({ time, paused = false, enemies = [], comparison }) {
    if (disabled || world === null) return;
    try {
      js = structuredClone(comparison);
      const additions = enemies.filter(enemy => !seen.has(enemy.spawn_key));
      if (additions.length) {
        snapshot = bridge.spawn(world, encounterId, structuredClone(additions)).snapshot;
        additions.forEach(enemy => seen.add(enemy.spawn_key));
      }
      if (paused) { hostTime = null; debt = 0; return; }
      if (!Number.isFinite(time)) throw new Error('Invalid shadow host clock');
      const elapsed = hostTime === null ? 0 : Math.max(0, time - hostTime);
      hostTime = time;
      debt += Math.min(.25, elapsed);
      for (let budget = 0; debt + 1e-9 >= 1 / 30 && budget < 8 && snapshot.state === 'running'; budget++) {
        snapshot = bridge.step(world, { encounter_id: encounterId, expected_previous_step: snapshot.step }).snapshot;
        debt = Math.max(0, debt - 1 / 30);
      }
      if (snapshot.state !== 'running') debt = 0;
    } catch (error) { fail(error); }
  }
  return Object.freeze({ start, advance, stop,
    read: () => structuredClone({ disabled, active: world !== null, snapshot, js }),
  });
}
