function createAstralOverlayLayout() {
  return {
    id: 'astralOverlay',
    allowedTransitions: ['combat'],
    systems: ['harness-astral'],
    onEnter({ eventBus }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:astralOverlay:entered', {});
      }
    },
    onActive({ eventBus }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:astralOverlay:active', {});
      }
    },
    onExit({ eventBus, to }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:astralOverlay:exited', { to });
      }
      return null;
    },
  };
}

module.exports = {
  createAstralOverlayLayout,
};
