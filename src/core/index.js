const {
  LayoutStateController,
  createLayoutStateSingleton,
  getLayoutStateSingleton,
  resetLayoutStateSingletonForTests,
} = require('./layoutState');
const { InputDomainManager } = require('./inputDomains');
const { CombatRuntimeGateway } = require('./combatRuntimeGateway.cjs');
const simulationCorePacket = require('./simulationCorePacket.cjs');

module.exports = {
  LayoutStateController,
  createLayoutStateSingleton,
  getLayoutStateSingleton,
  resetLayoutStateSingletonForTests,
  InputDomainManager,
  CombatRuntimeGateway,
  ...simulationCorePacket,
};
