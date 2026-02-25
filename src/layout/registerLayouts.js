const { createCombatLayout } = require('./combatLayout');
const { createBaseLayout } = require('./baseLayout');
const { createIntroLayout } = require('./introLayout');
const { createShopLayout } = require('./shopLayout');
const { createAstralOverlayLayout } = require('./astralOverlayLayout');

function registerCoreLayouts(layoutState, deps = {}) {
  const combatLayout = createCombatLayout({ combatGateway: deps.combatGateway });
  const baseLayout = createBaseLayout();
  const introLayout = createIntroLayout();
  const shopLayout = createShopLayout();
  const astralOverlayLayout = createAstralOverlayLayout();

  layoutState.registerLayout(combatLayout);
  layoutState.registerLayout(baseLayout);
  layoutState.registerLayout(introLayout);
  layoutState.registerLayout(shopLayout);
  layoutState.registerLayout(astralOverlayLayout);

  return {
    combatLayout,
    baseLayout,
    introLayout,
    shopLayout,
    astralOverlayLayout,
  };
}

module.exports = {
  registerCoreLayouts,
};
