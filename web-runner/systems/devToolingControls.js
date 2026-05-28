export function getAutoplayButtonLabel(autoplayActive) {
  return autoplayActive ? 'Stop AutoPlay' : 'AutoPlay';
}

export async function handleRestartClick({
  closeDevToolingModal,
  devToolingRefreshHandler,
  updateDevToolingStatus,
}) {
  closeDevToolingModal({ restorePauseSnapshot: true });

  if (typeof devToolingRefreshHandler === 'function') {
    const restarted = await devToolingRefreshHandler({ resetGame: true });
    if (!restarted) {
      updateDevToolingStatus('Game restart unavailable');
    }
  }
}
