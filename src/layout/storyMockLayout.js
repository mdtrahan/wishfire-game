function createStoryMockLayout() {
  return {
    id: 'storyMock',
    allowedTransitions: ['combat'],
    systems: ['harness-story'],
    onEnter({ eventBus }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:storyMock:entered', {});
      }
    },
    onActive({ eventBus }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:storyMock:active', {});
      }
    },
    onExit({ eventBus, to }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:storyMock:exited', { to });
      }
      return null;
    },
  };
}

module.exports = {
  createStoryMockLayout,
};
