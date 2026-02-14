const {
  LayoutStateController,
  createLayoutStateSingleton,
  getLayoutStateSingleton,
  resetLayoutStateSingletonForTests,
} = require('./layoutState');
const { InputDomainManager } = require('./inputDomains');
const { CombatRuntimeGateway } = require('./combatRuntimeGateway');

module.exports = {
  LayoutStateController,
  createLayoutStateSingleton,
  getLayoutStateSingleton,
  resetLayoutStateSingletonForTests,
  InputDomainManager,
  CombatRuntimeGateway,
};
