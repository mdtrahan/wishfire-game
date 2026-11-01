export function isRustCombatStage(globals) {
  const stage = globals.ContinuousCombatStage;
  return Number(globals.ContinuousCombatStageLoop) === 1 && !!stage;
}

// Flag-off loads no combat bridge/runtime and instantiates no additional WASM.
export function installRustCombat(options, {
  location = globalThis.location,
  load = () => import('./rustCombatRuntime.mjs'),
  warn = console.warn,
} = {}) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(location?.hostname) ||
      new URLSearchParams(location.search).get('rustCombat') !== '1') return undefined;
  options.globals.RustCombatAuthority = true;
  let runtime, disposed = false, failure;
  function routeError(error) {
    failure = error;
    options.globals.RustCombatError = String(error);
    warn('[rustCombat] encounter ended:', error);
  }
  const ready = load().then(module => module.mountRustCombat(options)).then(value => {
    if (disposed) value.dispose();
    else runtime = value;
  }).catch(routeError);
  return {
    ready,
    ownsEncounter: () => !disposed && isRustCombatStage(options.globals),
    tick(args) {
      if (failure) return false;
      return runtime?.tick(args) ?? false;
    },
    stop: () => runtime?.stop(),
    pause: () => runtime?.pause(),
    dispose() { disposed = true; runtime?.dispose(); delete options.globals.RustCombatAuthority; },
  };
}
