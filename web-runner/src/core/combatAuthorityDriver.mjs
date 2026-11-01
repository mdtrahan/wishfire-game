// One world, one exact 30 Hz step at a time. The host observes every completed
// step before another can run, including a deadline's lethal step.
export function createCombatAuthorityDriver({ bridge, consume, onError }) {
  let world = null, encounter = null, snapshot = null, previousNow = null, debt = 0, failed = false;
  let sequence = 0n;
  const receipts = new Map(), pending = new Map(), revisions = new Map(), desired = new Map(), submitted = new Map();
  let commandSequence = 0n;
  function replacePermanentInputs(heroId, inputs) {
    if (world === null || failed) return false;
    const actor = snapshot.actors.find(a => a.team === 'hero' && a.host_id === heroId);
    if (!actor) throw new Error(`Unknown Rust hero: ${heroId}`);
    const value = structuredClone(inputs), signature = JSON.stringify(value);
    if (desired.get(heroId) === signature) return false;
    desired.set(heroId, signature);
    const revision = (revisions.get(heroId)?.issued || BigInt(actor.permanent_revision || '0')) + 1n;
    const acknowledged = revisions.get(heroId)?.acknowledged || BigInt(actor.permanent_revision || '0');
    revisions.set(heroId, { issued: revision, acknowledged });
    pending.set(heroId, { ...value, actor: actor.actor_id, expected_revision: String(acknowledged), revision: String(revision) });
    return true;
  }
  function stop(reason) {
    try {
      if (reason && world !== null && snapshot.state !== 'host_ended') accept(bridge.end(world, encounter, snapshot.step, reason), false);
    } finally {
      const handle = world;
      world = null; previousNow = null; debt = 0; pending.clear(); submitted.clear();
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
      if (event.body.kind === 'permanent_inputs_applied') {
        const { actor, revision, sequence: command } = event.body.data;
        const hero = result.snapshot.actors.find(a => a.actor_id === actor)?.host_id;
        const state = revisions.get(hero), acknowledged = BigInt(revision);
        if (!state || submitted.get(actor)?.revision !== revision || submitted.get(actor)?.sequence !== command || acknowledged > state.issued || acknowledged <= state.acknowledged) throw new Error('Rust revision ack conflict');
        submitted.delete(actor);
        state.acknowledged = acknowledged;
        if (pending.get(hero)?.revision === revision) pending.delete(hero);
      }
    }
    snapshot = result.snapshot;
    // Consumption can stop the world on an outcome. No renderer drains it.
    if (notify) consume(snapshot, fresh);
  }
  function start(config) {
    try {
      stop();
      if (failed) return;
      encounter = config.encounter_id; sequence = 0n; commandSequence = 0n;
      receipts.clear(); revisions.clear(); desired.clear();
      for (const hero of config.heroes || []) desired.set(hero.instance_id, JSON.stringify({ stats: hero.stats, host_max_hp: hero.host_max_hp,
        skill_modifiers: hero.skill_modifiers }));
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
        const commands = [...pending.values()].map((data, index) => ({ encounter_id: encounter,
          step: String(BigInt(snapshot.step) + 1n), sequence: String(commandSequence + BigInt(index) + 1n),
          body: { kind: 'replace_permanent_inputs', data } }));
        for (const command of commands) submitted.set(command.body.data.actor, { revision: command.body.data.revision, sequence: command.sequence });
        const result = bridge.step(world, { encounter_id: encounter, expected_previous_step: snapshot.step,
          ...(commands.length ? { commands } : {}) });
        commandSequence += BigInt(commands.length);
        accept(result);
        if (submitted.size) {
          throw new Error('Missing Rust revision ack');
        }
      }
    } catch (error) { fail(error); }
  }
  function spawn(enemies) {
    if (failed || world === null) return;
    try { accept(bridge.spawn(world, encounter, structuredClone(enemies))); }
    catch (error) { fail(error); }
  }
  return { start, advance, spawn, stop, accept, replacePermanentInputs, waveChest() { accept(bridge.waveChest(world, encounter)); }, ordinaryClear(transitionId) { accept(bridge.ordinaryClear(world, encounter, transitionId)); }, read: () => ({ active: world !== null, failed, snapshot: structuredClone(snapshot), receipts: receipts.size, pendingRevisions: pending.size, revisions: Object.fromEntries([...revisions].map(([id,r]) => [id,{ issued: String(r.issued), acknowledged: String(r.acknowledged) }])) }) };
}
