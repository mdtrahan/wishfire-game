export function renderCombatRuntime(ctx, args) {
  const {
    canvas,
    uiState,
    modalPlane,
    closeBtnRender,
    closeXRender,
    navBacker,
    navTopRendered,
    modalRendered,
    drawBasicItem,
  } = args;

  const overlayVisible = Boolean(uiState?.overlayVisible);
  let drewBackdrop = false;
  let drewNavStack = false;

  if (overlayVisible) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drewBackdrop = true;
  }

  if (overlayVisible) {
    if (modalPlane) drawBasicItem(modalPlane);
    if (closeBtnRender) drawBasicItem(closeBtnRender);
    if (closeXRender) drawBasicItem(closeXRender);
    if (navBacker) drawBasicItem(navBacker);
    for (const r of navTopRendered) drawBasicItem(r);
    drewNavStack = true;
  } else {
    for (const r of modalRendered) drawBasicItem(r);
  }

  return {
    overlayData: {
      overlayVisible,
      modalCount: Array.isArray(modalRendered) ? modalRendered.length : 0,
      navCount: Array.isArray(navTopRendered) ? navTopRendered.length : 0,
    },
    visualFlags: {
      drewBackdrop,
      drewNavStack,
    },
  };
}
