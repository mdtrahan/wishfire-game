// One world, one exact 30 Hz step at a time. The host observes every completed
// step before another can run, including a deadline's lethal step.
export function createCombatAuthorityDriver({ bridge, consume, onError }) {
  let world = null, encounter = null, snapshot = null, previousNow = null, debt = 0, failed = false;
  let sequence = 0n;
  const receipts = new Map();
  function stop(reason) {
    try {
      if (reason && world !== null && snapshot.state !== 'host_ended') accept(bridge.end(world, encounter, snapshot.step, reason), false);
    } finally {
      const handle = world;
      world = null; previousNow = null; debt = 0;
      if (handle !== null) bridge.destroy(handle);
    }
  }
  function fail(error) {
    failed = true;
    try { stop(); } catch { /* Preserve the original transport failure. */ }
    onError(error);
  }
  function accept(result, notify = true) {
    if (result.snapshot.encounter_id !== encounter) throw new Error('Rust encounter mismatch');
    const fresh = [];
    for (const event of result.events) {
      if (event.encounter_id !== encounter) throw new Error('Rust event encounter mismatch');
      const key = `${encounter}:${event.sequence}`, body = JSON.stringify(event);
      if (receipts.has(key)) {
        if (receipts.get(key) !== body) throw new Error('Rust event sequence collision');
        continue;
      }
      if (BigInt(event.sequence) !== sequence + 1n) throw new Error('Rust event sequence gap');
      sequence++;
      receipts.set(key, body); fresh.push(event);
    }
    snapshot = result.snapshot;
    // Consumption can stop the world on an outcome. No renderer drains it.
    if (notify) consume(snapshot, fresh);
  }
  function start(config) {
    try {
      stop();
      if (failed) return;
      encounter = config.encounter_id; sequence = 0n; receipts.clear();
      const result = bridge.create(structuredClone(config));
      world = result.world;
      accept(result);
    } catch (error) { fail(error); }
  }
  function advance(nowMs, paused = false) {
    if (failed || world === null) return;
    try {
      if (paused) { previousNow = null; debt = 0; return; }
      if (!Number.isFinite(nowMs)) throw new Error('Invalid Rust foreground clock');
      debt += previousNow === null ? 0 : Math.min(.25, Math.max(0, (nowMs - previousNow) / 1000));
      previousNow = nowMs;
      for (let budget = 0; world !== null && snapshot.state === 'running' && debt + 1e-9 >= 1 / 30 && budget < 8; budget++) {
        debt = Math.max(0, debt - 1 / 30);
        accept(bridge.step(world, { encounter_id: encounter, expected_previous_step: snapshot.step }));
      }
    } catch (error) { fail(error); }
  }
  function spawn(enemies) {
    if (failed || world === null) return;
    try { accept(bridge.spawn(world, encounter, structuredClone(enemies))); }
    catch (error) { fail(error); }
  }
  return { start, advance, spawn, stop, accept, ordinaryClear(transitionId) { accept(bridge.ordinaryClear(world, encounter, transitionId)); }, read: () => ({ active: world !== null, failed, snapshot: structuredClone(snapshot), receipts: receipts.size }) };
}
