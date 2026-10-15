const { createCombatLayout } = require('./combatLayout');
const { createBaseLayout } = require('./baseLayout');
const { createIntroLayout } = require('./introLayout');
const { createShopLayout } = require('./shopLayout');

function registerCoreLayouts(layoutState, deps = {}) {
  const combatLayout = createCombatLayout({ combatGateway: deps.combatGateway });
  const baseLayout = createBaseLayout();
  const introLayout = createIntroLayout();
  const shopLayout = createShopLayout();

  layoutState.registerLayout(combatLayout);
  layoutState.registerLayout(baseLayout);
  layoutState.registerLayout(introLayout);
  layoutState.registerLayout(shopLayout);

  return {
    combatLayout,
    baseLayout,
    introLayout,
    shopLayout,
  };
}

module.exports = {
  registerCoreLayouts,
};
