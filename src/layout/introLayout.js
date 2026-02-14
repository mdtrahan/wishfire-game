function createIntroLayout() {
  return {
    id: 'intro',
    allowedTransitions: ['base', 'combat'],
    systems: ['story-timeline'],
    onEnter({ eventBus, payload }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:intro:entered', { chapter: payload.chapter || null });
      }
    },
    onActive({ eventBus }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:intro:active', {});
      }
    },
    onExit({ eventBus, to }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:intro:exited', { to });
      }
      return null;
    },
  };
}

module.exports = {
  createIntroLayout,
};
