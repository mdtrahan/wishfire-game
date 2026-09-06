const GALLERY_LAYOUTS = Object.freeze([
  { id: 'tomesLayout', stateKey: 'tomesLayout', listKey: 'gallery', indexKey: 'selectedIndex' },
  { id: 'artifactsLayout', stateKey: 'artifactsLayout', listKey: 'gallery', indexKey: 'selectedIndex' },
  { id: 'mountsLayout', stateKey: 'mountsLayout', listKey: 'gallery', indexKey: 'selectedIndex' },
  { id: 'collectiblesLayout', stateKey: 'collectiblesLayout', listKey: 'gallery', indexKey: 'selectedIndex' },
  { id: 'relicsLayout', stateKey: 'relicsLayout', listKey: 'gallery', indexKey: 'selectedIndex' },
  { id: 'petsLayout', stateKey: 'petsLayout', listKey: 'gallery', indexKey: 'selectedIndex' },
  { id: 'evolutionLayout', stateKey: 'evolutionLayout', listKey: 'ladder', indexKey: 'selectedLevel' },
]);

const GALLERY_TRANSITIONS = Object.freeze(['chestsLayout', 'combat', 'storyMock', 'heroLayout', 'idleFarmLayout']);

function clampSelection(layoutState, listKey, indexKey) {
  const list = Array.isArray(layoutState?.[listKey]) ? layoutState[listKey] : [];
  layoutState[indexKey] = Math.max(
    0,
    Math.min(
      Math.max(0, list.length - 1),
      Number(layoutState?.[indexKey] || 0),
    ),
  );
}

function clearGalleryHitZones(gameState, stateKey) {
  if (gameState?.[stateKey]) gameState[stateKey].hitZones = null;
}

function registerGalleryLayouts(layoutState, gameState, uiState) {
  for (const descriptor of GALLERY_LAYOUTS) {
    layoutState.registerLayout({
      id: descriptor.id,
      allowedTransitions: GALLERY_TRANSITIONS,
      onEnter() {
        uiState.setUIStateField('overlayVisible', false);
        clearGalleryHitZones(gameState, descriptor.stateKey);
        clampSelection(gameState[descriptor.stateKey], descriptor.listKey, descriptor.indexKey);
      },
      onActive() {},
      onExit() {
        clearGalleryHitZones(gameState, descriptor.stateKey);
        return null;
      },
    });
  }
}

export function registerRuntimeLayouts(layoutState, {
  combatLayout,
  storyEntry,
  uiState,
  mapLayoutState,
  gameState,
  normalizeHeroSelectionIndex,
  restorePartyToFullHP,
  startIdleFarmEmissions,
  restartIdleFarmSession,
  getNowSec,
} = {}) {
  if (combatLayout) layoutState.registerLayout(combatLayout);

  layoutState.registerLayout({
    id: 'mapLayout',
    allowedTransitions: ['storyMock', 'heroLayout', 'chestsLayout', 'idleFarmLayout', 'combat', 'tomesLayout', 'artifactsLayout', 'mountsLayout', 'collectiblesLayout', 'relicsLayout', 'petsLayout', 'homesteadLayout'],
    onEnter() {
      uiState.setUIStateField('overlayVisible', false);
      mapLayoutState.setMapPanY(0);
      mapLayoutState.setMapLayoutField('tomesLocaleHit', null);
      mapLayoutState.setMapLayoutField('artifactsLocaleHit', null);
      mapLayoutState.setMapLayoutField('mountsLocaleHit', null);
      mapLayoutState.setMapLayoutField('collectiblesLocaleHit', null);
      mapLayoutState.setMapLayoutField('relicsLocaleHit', null);
      mapLayoutState.setMapLayoutField('homesteadLocaleHit', null);
      mapLayoutState.setMapLayoutField('closeHit', null);
      mapLayoutState.setMapDragState({
        active: false,
        pointerId: null,
        lastX: 0,
        lastY: 0,
        moved: 0,
      });
      console.log('[LAYOUT_PHASE1]', { stage: 'onEnter', transition: '1->map', trigger: 'map-click' });
    },
    onActive() {},
    onExit() { return null; },
  });

  registerGalleryLayouts(layoutState, gameState, uiState);

  layoutState.registerLayout({
    id: 'homesteadLayout',
    allowedTransitions: ['chestsLayout', 'combat', 'storyMock', 'heroLayout', 'idleFarmLayout'],
    onEnter() {
      uiState.setUIStateField('overlayVisible', false);
      gameState.homesteadLayout.hitZones = null;
      gameState.homesteadLayout.selectedSlot = Math.max(
        0,
        Math.min(
          Math.max(0, ((gameState.homesteadLayout.scene && gameState.homesteadLayout.scene.slots) || []).length - 1),
          Number(gameState.homesteadLayout.selectedSlot || 0),
        ),
      );
    },
    onActive() {},
    onExit() {
      gameState.homesteadLayout.hitZones = null;
      return null;
    },
  });

  layoutState.registerLayout({
    id: 'chestsLayout',
    allowedTransitions: ['storyMock', 'heroLayout', 'chestsLayout', 'idleFarmLayout', 'combat', 'tomesLayout', 'artifactsLayout', 'mountsLayout', 'collectiblesLayout', 'relicsLayout', 'petsLayout', 'evolutionLayout', 'homesteadLayout'],
    onEnter() {
      uiState.setUIStateField('overlayVisible', false);
      gameState.chestsLayout.hitZones = null;
      const tabs = Array.isArray(gameState.chestsLayout.tabs) ? gameState.chestsLayout.tabs : [];
      const allowed = new Set(tabs.map((t) => String(t.id || '')));
      if (!allowed.has(String(gameState.chestsLayout.activeTab || ''))) {
        gameState.chestsLayout.activeTab = tabs.length ? String(tabs[0].id || 'Common') : 'Common';
      }
    },
    onActive() {},
    onExit() {
      gameState.chestsLayout.hitZones = null;
      return null;
    },
  });

  layoutState.registerLayout({
    id: 'heroLayout',
    allowedTransitions: ['combat', 'storyMock', 'heroLayout', 'chestsLayout', 'idleFarmLayout'],
    onEnter() {
      uiState.setUIStateField('overlayVisible', false);
      uiState.setUIStateField('heroScreenHitZones', null);
      normalizeHeroSelectionIndex();
    },
    onActive() {},
    onExit() {
      uiState.setUIStateField('heroScreenHitZones', null);
      return null;
    },
  });

  layoutState.registerLayout({
    id: 'base',
    allowedTransitions: ['combat', 'shop', 'intro'],
    onEnter() {},
    onActive() {},
    onExit() { return null; },
  });
  layoutState.registerLayout({
    id: 'intro',
    allowedTransitions: ['base', 'combat'],
    onEnter() {},
    onActive() {},
    onExit() { return null; },
  });
  layoutState.registerLayout({
    id: 'shop',
    allowedTransitions: ['base', 'combat'],
    onEnter() {},
    onActive() {},
    onExit() { return null; },
  });
  layoutState.registerLayout({
    id: 'storyMock',
    get allowedTransitions() { return storyEntry?.allowedTransitions() || []; },
    onEnter() {
      gameState.combatFailExitRequested = false;
      storyEntry?.enter();
    },
    onActive() {},
    onExit() { return null; },
  });
  layoutState.registerLayout({
    id: 'town',
    allowedTransitions: ['combat', 'storyMock', 'heroLayout', 'chestsLayout', 'idleFarmLayout'],
    onEnter() {
      uiState.setUIStateField('overlayVisible', false);
      restorePartyToFullHP();
    },
    onActive() {},
    onExit() { return null; },
  });
  layoutState.registerLayout({
    id: 'idleFarmLayout',
    allowedTransitions: ['combat', 'storyMock', 'heroLayout', 'chestsLayout'],
    onEnter() {
      uiState.setUIStateField('overlayVisible', false);
      const nowSec = typeof getNowSec === 'function' ? getNowSec() : performance.now() / 1000;
      startIdleFarmEmissions(nowSec);
      restartIdleFarmSession(nowSec);
    },
    onActive() {},
    onExit() { return null; },
  });
}
