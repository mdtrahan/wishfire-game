// Headless transport, used by the opt-in developer shadow only.
export function createCombatBridge(instance) {
  const wasm = instance.exports;
  const names = ['wf_combat_abi_version', 'wf_input_alloc', 'wf_input_free',
    'wf_combat_call', 'wf_response_ptr', 'wf_response_len', 'wf_response_free'];
  if (!wasm.memory || names.some(name => typeof wasm[name] !== 'function') ||
      wasm.wf_combat_abi_version() !== 0x10000) {
    throw new Error('Unsupported combat ABI; expected 1.0');
  }
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let nextRequest = 0n;
  function call(operation, requestId = String(++nextRequest)) {
    const input = encoder.encode(JSON.stringify({
      schema: { major: 1, minor: 0 }, request_id: requestId, operation,
    }, (_, value) => typeof value === 'bigint' ? value.toString() : value));
    const ptr = wasm.wf_input_alloc(input.length) >>> 0;
    if (!ptr) throw new Error('Combat input allocation rejected');
    let response = 0;
    try {
      new Uint8Array(wasm.memory.buffer, ptr, input.length).set(input);
      response = wasm.wf_combat_call(ptr, input.length) >>> 0;
      if (!response) throw new Error('Combat response allocation rejected');
      const start = wasm.wf_response_ptr(response) >>> 0;
      const length = wasm.wf_response_len(response) >>> 0;
      if (!start || !length) throw new Error('Invalid combat response handle');
      // Every allocating export can grow memory. Never retain a view across calls.
      const envelope = JSON.parse(decoder.decode(new Uint8Array(wasm.memory.buffer, start, length).slice()));
      if (!envelope.ok) {
        const error = new Error(envelope.error.message);
        Object.assign(error, envelope.error, { request_id: envelope.request_id });
        throw error;
      }
      return envelope.result;
    } finally {
      try {
        if (response && wasm.wf_response_free(response) !== 1) throw new Error('Combat response free failed');
      } finally {
        if (wasm.wf_input_free(ptr, input.length) !== 1) throw new Error('Combat input free failed');
      }
    }
  }
  return Object.freeze({
    call,
    describe: () => call({ kind: 'describe', data: {} }),
    create: config => call({ kind: 'create', data: { config } }),
    step: (world, request) => call({ kind: 'step', data: { world, request } }),
    inspect: (world, events_after = '0') => call({ kind: 'inspect', data: { world, events_after } }),
    spawn: (world, encounter_id, enemies) => call({ kind: 'spawn', data: { world, encounter_id, enemies } }),
    destroy: world => call({ kind: 'destroy', data: { world } }),
  });
}
