const { createCombatLayout } = require('./combatLayout');
const { createBaseLayout } = require('./baseLayout');
const { createIntroLayout } = require('./introLayout');
const { createShopLayout } = require('./shopLayout');
const { registerCoreLayouts } = require('./registerLayouts');

module.exports = {
  createCombatLayout,
  createBaseLayout,
  createIntroLayout,
  createShopLayout,
  registerCoreLayouts,
};
