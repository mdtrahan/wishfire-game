function createBaseLayout() {
  return {
    id: 'base',
    allowedTransitions: ['combat', 'shop', 'intro'],
    systems: ['meta-progression', 'retention-surface'],
    onEnter({ eventBus, reason }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:base:entered', { reason });
      }
    },
    onActive({ eventBus }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:base:active', {});
      }
    },
    onExit({ eventBus, to }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:base:exited', { to });
      }
      return null;
    },
  };
}

module.exports = {
  createBaseLayout,
};
