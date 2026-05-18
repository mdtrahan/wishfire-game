import {
  applyIdleFarmRewardsToGlobals,
  claimIdleFarmRewardsFromState,
  ensureIdleFarmSessionState,
  resetIdleFarmEmissionCadence,
  restartIdleFarmSessionState,
  startIdleFarmEmissionState,
  updateIdleFarmEmissionState,
  updateIdleFarmSessionState,
} from '../src/core/idleFarmRuntime.mjs';

export function createIdleFarmAppRuntime({
  gameState,
  state,
  getDevToolingConfig,
  getFallbackRoster,
  getNowSec,
}) {
  const getDeps = (nowSec = 0) => ({
    nowSec,
    heroSlots: getDevToolingConfig().heroSlots,
    fallbackRoster: getFallbackRoster(),
    enemyCatalog: Array.isArray(state.globals.DevToolEnemyCatalog) ? state.globals.DevToolEnemyCatalog : [],
  });

  const getLayout = () => gameState.idleFarmLayout || null;

  function ensureIdleFarmSession(nowSec = 0) {
    const layout = getLayout() || {};
    return ensureIdleFarmSessionState(layout, getDeps(nowSec));
  }

  function startIdleFarmEmissions(nowSec = 0) {
    const layout = getLayout();
    if (!layout) return null;
    return startIdleFarmEmissionState(layout, getDeps(nowSec));
  }

  function updateIdleFarmEmissions(nowSec = 0) {
    const layout = getLayout();
    if (!layout) return null;
    return updateIdleFarmEmissionState(layout, getDeps(nowSec));
  }

  function updateIdleFarmSession(nowSec = 0) {
    const layout = getLayout();
    if (!layout) return null;
    return updateIdleFarmSessionState(layout, getDeps(nowSec));
  }

  function restartIdleFarmSession(nowSec = 0) {
    const layout = getLayout();
    if (!layout) return null;
    return restartIdleFarmSessionState(layout, getDeps(nowSec));
  }

  function claimIdleFarmRewards() {
    const layout = getLayout();
    if (!layout) return { energy: 0, tokens: {} };
    const nowSec = getNowSec();
    updateIdleFarmEmissions(nowSec);
    const claimed = claimIdleFarmRewardsFromState(layout);
    const applied = applyIdleFarmRewardsToGlobals(state.globals, claimed);
    if ((applied.energy > 0) || Object.values(applied.tokens || {}).some((amount) => Number(amount || 0) > 0)) {
      resetIdleFarmEmissionCadence(layout, getDeps(getNowSec()));
    }
    return applied;
  }

  return {
    ensureIdleFarmSession,
    startIdleFarmEmissions,
    updateIdleFarmEmissions,
    updateIdleFarmSession,
    restartIdleFarmSession,
    claimIdleFarmRewards,
  };
}
