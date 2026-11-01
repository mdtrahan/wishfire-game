// No bridge/runtime module or WASM is loaded when the flag is off.
export function installRustCombatShadow(options, {
  location = globalThis.location,
  load = () => import('./rustCombatShadowRuntime.mjs'),
  warn = console.warn,
} = {}) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(location?.hostname) ||
      new URLSearchParams(location.search).get('rustShadow') !== '1') return undefined;
  let runtime, disposed = false;
  const ready = load().then(module => module.mountRustCombatShadow(options)).then(value => {
    if (disposed) value.dispose();
    else runtime = value;
  }).catch(error => warn('[rustShadow] disabled for this session:', error));
  return { ready, update: () => runtime?.update(), dispose() { disposed = true; runtime?.dispose(); } };
}
