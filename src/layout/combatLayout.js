function createCombatLayout({ combatGateway } = {}) {
  if (!combatGateway) {
    throw new Error('Combat layout requires a combatGateway');
  }

  return {
    id: 'combat',
    allowedTransitions: ['base', 'shop', 'intro'],
    systems: ['combat-core', 'gem-input', 'turn-order'],
    onEnter({ resumeSnapshot, payload, eventBus }) {
      const snapshot = resumeSnapshot || payload.combatSnapshot || null;
      combatGateway.resume(snapshot);
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:combat:entered', { restored: Boolean(snapshot) });
      }
    },
    onActive({ eventBus }) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:combat:active', {});
      }
    },
    onExit({ eventBus }) {
      const snapshot = combatGateway.suspend();
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('layout:combat:exited', { snapshot });
      }
      return snapshot;
    },
  };
}

module.exports = {
  createCombatLayout,
};
