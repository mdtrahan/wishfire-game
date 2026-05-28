function createShopLayout() {
  return {
    id: 'shop',
    allowedTransitions: ['base', 'combat'],
    systems: ['iap', 'offers', 'economy'],
    onEnter({ eventBus, payload }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:shop:entered', { source: payload.source || null });
      }
    },
    onActive({ eventBus }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:shop:active', {});
      }
    },
    onExit({ eventBus, to }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:shop:exited', { to });
      }
      return null;
    },
  };
}

module.exports = {
  createShopLayout,
};
