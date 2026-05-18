export function createRuntimeEnvironment() {
  const harnessMode = typeof window !== 'undefined' && window.location.search.includes('harness=true');
  const debugLayout = (() => {
    let enabled = false;
    try {
      if (typeof process !== 'undefined' && process && process.env && process.env.DEBUG_LAYOUT === 'true') {
        enabled = true;
      }
    } catch {}
    try {
      if (typeof window !== 'undefined' && window && window.DEBUG_LAYOUT === true) {
        enabled = true;
      }
    } catch {}
    return enabled;
  })();
  const debugGemsQuery = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (
        params.has('devtest') ||
        params.get('devtest') === 'true' ||
        params.has('debug_gems') ||
        params.get('debug_gems') === 'true'
      );
    } catch {
      return false;
    }
  })();
  const gemDebugLevel = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('gemlog') || 'minimal';
    } catch {
      return 'minimal';
    }
  })();
  const bootstrapSeed = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('bootstrap_seed') || params.get('gem_seed');
      if (raw == null || raw === '') return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  })();
  const startupDebug = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.has('startup_debug') || params.get('startup_debug') === 'true';
    } catch {
      return false;
    }
  })();
  return {
    HARNESS_MODE: harnessMode,
    DEBUG_LAYOUT: debugLayout,
    DEBUG_GEMS_QUERY: debugGemsQuery,
    GEM_DEBUG_LEVEL: gemDebugLevel,
    BOOTSTRAP_SEED: bootstrapSeed,
    STARTUP_DEBUG: startupDebug,
  };
}

export function exposeRuntimeDebugFlags(flags) {
  if (typeof window === 'undefined') return;
  window.DEBUG_LAYOUT = flags.DEBUG_LAYOUT;
  window.STARTUP_DEBUG = flags.STARTUP_DEBUG;
  window.DEBUG_GEMS_QUERY = flags.DEBUG_GEMS_QUERY;
}

export function createRuntimeFingerprint() {
  const source = (typeof window !== 'undefined' && window.__ORKA_RUNTIME_FINGERPRINT__)
    ? window.__ORKA_RUNTIME_FINGERPRINT__
    : {};
  const params = (typeof window !== 'undefined')
    ? new URLSearchParams(window.location.search)
    : null;
  const qaTaskOverride = params
    ? (params.get('qa_task') || params.get('task') || '').trim()
    : '';
  const worktree = source.worktree || 'unknown-worktree';
  const branch = source.branch || 'unknown-branch';
  const issueId = qaTaskOverride || source.issueId || 'ORKA-UNKNOWN';
  const orka69rReady = Boolean(source.contracts && source.contracts.ORKA69R_READY);
  return {
    worktree,
    branch,
    issueId,
    orka69rReady,
    label: `WT:${worktree} BR:${branch} TASK:${issueId} 69R:${orka69rReady ? 'READY' : 'MISSING'}`,
  };
}
