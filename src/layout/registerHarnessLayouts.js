const { createStoryMockLayout } = require('./storyMockLayout');
const { createAstralOverlayLayout } = require('./astralOverlayLayout');

function registerHarnessLayouts(layoutState) {
  const storyMockLayout = createStoryMockLayout();
  const astralOverlayLayout = createAstralOverlayLayout();
  layoutState.registerLayout(storyMockLayout);
  layoutState.registerLayout(astralOverlayLayout);
  return {
    storyMockLayout,
    astralOverlayLayout,
  };
}

module.exports = {
  registerHarnessLayouts,
};
