export function isRustCombatStage(globals) {
  const stage = globals.ContinuousCombatStage;
  return Number(globals.ContinuousCombatStageLoop) === 1 && !!stage;
}

// Every encounter uses Rust. Startup failure remains visible and never selects JS.
export function installRustCombat(options, {
  load = () => import('./rustCombatRuntime.mjs'),
  warn = console.warn,
} = {}) {
  options.globals.RustCombatAuthority = true;
  let runtime, disposed = false, failure;
  function routeError(error) {
    failure = error;
    options.globals.RustCombatError = String(error);
    warn('[rustCombat] encounter ended:', error);
  }
  const ready = Promise.resolve().then(load).then(module => module.mountRustCombat(options)).then(value => {
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
