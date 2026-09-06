function returnToQuest(gameState, layoutState, reason) {
  gameState.storyEntry.phase = 'ladder';
  return layoutState.requestLayoutChange('storyMock', reason);
}

function isPointInRect(mx, my, rect) {
  if (!rect) return false;
  return mx >= rect.x && mx <= (rect.x + rect.w) && my >= rect.y && my <= (rect.y + rect.h);
}

function getPointerPosition({ canvas, dpr, event }) {
  const rect = canvas.getBoundingClientRect();
  const logicalW = canvas.width / Math.max(1, dpr || 1);
  const logicalH = canvas.height / Math.max(1, dpr || 1);
  const scaleX = rect.width > 0 ? logicalW / rect.width : 1;
  const scaleY = rect.height > 0 ? logicalH / rect.height : 1;
  return {
    rect,
    mx: (event.clientX - rect.left) * scaleX,
    my: (event.clientY - rect.top) * scaleY,
  };
}

function routeCardGalleryLayout({
  layoutName,
  gameState,
  layoutState,
  mx,
  my,
  drawFrame,
  selectedField,
}) {
  const layout = gameState[layoutName] || {};
  const zones = layout.hitZones || {};
  const routePrefix = String(layoutName || '').replace(/Layout$/, '');
  if (isPointInRect(mx, my, zones.close) || isPointInRect(mx, my, zones.mapBack)) {
    layoutState.requestLayoutChange('chestsLayout', `${routePrefix}-back-vault`).catch((err) => {
      console.error(`[LAYOUT_PHASE1] ${routePrefix}->vault failed`, err);
    });
    drawFrame();
    return true;
  }
  if (isPointInRect(mx, my, zones.combatBack)) {
    returnToQuest(gameState, layoutState, `${routePrefix}-back-combat`).catch((err) => {
      console.error(`[LAYOUT_PHASE1] ${routePrefix}->combat failed`, err);
    });
    drawFrame();
    return true;
  }
  const cards = Array.isArray(zones.cards) ? zones.cards : [];
  for (let i = 0; i < cards.length; i += 1) {
    if (isPointInRect(mx, my, cards[i])) {
      layout[selectedField] = i;
      drawFrame();
      return true;
    }
  }
  drawFrame();
  return true;
}

export function createPointerRoutingShell({
  canvas,
  getDpr,
  state,
  gameState,
  uiState,
  layoutState,
  mapLayoutState,
  inputDomains,
  layoutHarnessEnabled,
  harnessLayoutState,
  harnessInputDomains,
  callFunctionWithContext,
  fnContext,
  drawFrame,
  handleMapDragStart,
  deriveEncounterRequestFromMapState,
  restartIdleFarmSession,
  claimIdleFarmRewards,
  getHeroScreenRoster,
  normalizeHeroSelectionIndex,
}) {
  const routePointerDown = (event) => {
    const dpr = typeof getDpr === 'function' ? getDpr() : 1;
    const pointer = getPointerPosition({ canvas, dpr, event });
    const { mx, my, rect } = pointer;

    if (Number(state.globals.SkillDraughtOpen || 0)) {
      const zones = Array.isArray(state.globals.SkillDraughtHitZones) ? state.globals.SkillDraughtHitZones : [];
      const hit = zones.find((zone) => isPointInRect(mx, my, zone));
      if (hit) {
        callFunctionWithContext(fnContext, 'SelectSkillDraughtCard', Number(hit.index || 0));
        drawFrame();
      }
      return { handled: true, mx, my, rect };
    }

    const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
      ? layoutState.getActiveLayoutId()
      : null;

    const navHit = (gameState.sharedNavHitZones || []).find(zone => isPointInRect(mx, my, zone));
    if (navHit) {
      inputDomains.emit(activeLayoutId, 'nav:clicked', { label: navHit.label });
      return { handled: true, mx, my, rect };
    }
    if (activeLayoutId === 'storyMock') {
      inputDomains.emit('storyMock', 'layout:storyMock:click', { x: mx, y: my });
      drawFrame();
      return { handled: true, mx, my, rect };
    }
    if (activeLayoutId === 'town') {
      inputDomains.emit('town', 'layout:town:click', { x: mx, y: my });
      drawFrame();
      return { handled: true, mx, my, rect };
    }
    if (activeLayoutId === 'idleFarmLayout') {
      const zones = (gameState.idleFarmLayout && gameState.idleFarmLayout.hitZones) || {};
      if (isPointInRect(mx, my, zones.restartBtn)) {
        restartIdleFarmSession(performance.now() / 1000);
        drawFrame();
        return { handled: true, mx, my, rect };
      }
      if (isPointInRect(mx, my, zones.collectBtn)) {
        claimIdleFarmRewards();
        drawFrame();
        return { handled: true, mx, my, rect };
      }
      if (isPointInRect(mx, my, zones.combatBack)) {
        returnToQuest(gameState, layoutState, 'idle-farm-back-combat').catch((err) => {
          console.error('[LAYOUT_PHASE1] idleFarm->combat failed', err);
        });
        drawFrame();
        return { handled: true, mx, my, rect };
      }
      if (isPointInRect(mx, my, zones.baseBack)) {
        layoutState.requestLayoutChange('storyMock', 'idle-farm-back-base').catch((err) => {
          console.error('[LAYOUT_PHASE1] idleFarm->storyMock failed', err);
        });
        drawFrame();
        return { handled: true, mx, my, rect };
      }
      drawFrame();
      return { handled: true, mx, my, rect };
    }
    if (activeLayoutId === 'mapLayout') {
      const close = mapLayoutState.getMapLayoutState().closeHit;
      if (isPointInRect(mx, my, close)) {
        const req = deriveEncounterRequestFromMapState();
        state.globals.EncounterTargetCP = Number(req.targetCP || 120);
        state.globals.EncounterLocale = String(req.locale || 'clouds');
        state.globals.EncounterMaxSlots = Number(req.maxSlots || 3);
        state.globals.EncounterPolicy = String(req.policy || 'mixed');
        state.globals.EncounterFaction = String(req.faction || '');
        state.globals.EncounterSeed = Number(req.seed || 1);
        state.globals.EncounterSeedExplicit = 1;
        returnToQuest(gameState, layoutState, 'map-close-button').catch((err) => {
          console.error('[LAYOUT_PHASE1] map return failed', err);
        });
        drawFrame();
        return { handled: true, mx, my, rect };
      }
      if (handleMapDragStart(event, { mx, my })) {
        return { handled: true, mx, my, rect };
      }
    }

    const galleryRoutes = {
      tomesLayout: 'selectedIndex',
      artifactsLayout: 'selectedIndex',
      mountsLayout: 'selectedIndex',
      collectiblesLayout: 'selectedIndex',
      relicsLayout: 'selectedIndex',
      petsLayout: 'selectedIndex',
      evolutionLayout: 'selectedLevel',
    };
    if (galleryRoutes[activeLayoutId]) {
      const handled = routeCardGalleryLayout({
        layoutName: activeLayoutId,
        gameState,
        layoutState,
        mx,
        my,
        drawFrame,
        selectedField: galleryRoutes[activeLayoutId],
      });
      return { handled, mx, my, rect };
    }

    if (activeLayoutId === 'homesteadLayout') {
      const zones = (gameState.homesteadLayout && gameState.homesteadLayout.hitZones) || {};
      if (isPointInRect(mx, my, zones.close) || isPointInRect(mx, my, zones.mapBack)) {
        layoutState.requestLayoutChange('chestsLayout', 'homestead-back-vault').catch((err) => {
          console.error('[LAYOUT_PHASE1] homestead->vault failed', err);
        });
        drawFrame();
        return { handled: true, mx, my, rect };
      }
      if (isPointInRect(mx, my, zones.combatBack)) {
        returnToQuest(gameState, layoutState, 'homestead-back-combat').catch((err) => {
          console.error('[LAYOUT_PHASE1] homestead->combat failed', err);
        });
        drawFrame();
        return { handled: true, mx, my, rect };
      }
      const slots = Array.isArray(zones.slots) ? zones.slots : [];
      for (let i = 0; i < slots.length; i += 1) {
        if (isPointInRect(mx, my, slots[i])) {
          gameState.homesteadLayout.selectedSlot = i;
          drawFrame();
          return { handled: true, mx, my, rect };
        }
      }
      drawFrame();
      return { handled: true, mx, my, rect };
    }

    if (activeLayoutId === 'chestsLayout') {
      const zones = (gameState.chestsLayout && gameState.chestsLayout.hitZones) || {};
      if (isPointInRect(mx, my, zones.close)) {
        returnToQuest(gameState, layoutState, 'chests-close-button').catch((err) => {
          console.error('[LAYOUT_PHASE1] chests close->combat failed', err);
        });
        drawFrame();
        return { handled: true, mx, my, rect };
      }
      if (isPointInRect(mx, my, zones.combatBack)) {
        returnToQuest(gameState, layoutState, 'chests-back-combat').catch((err) => {
          console.error('[LAYOUT_PHASE1] chests->combat failed', err);
        });
        drawFrame();
        return { handled: true, mx, my, rect };
      }
      const retentionButtons = Array.isArray(zones.retentionButtons) ? zones.retentionButtons : [];
      for (let i = 0; i < retentionButtons.length; i += 1) {
        const btn = retentionButtons[i];
        if (isPointInRect(mx, my, btn) && btn.targetLayout) {
          layoutState.requestLayoutChange(String(btn.targetLayout), `chests-${String(btn.id || 'retention')}`).catch((err) => {
            console.error('[LAYOUT_PHASE1] chests->retention failed', err);
          });
          drawFrame();
          return { handled: true, mx, my, rect };
        }
      }
      const tabs = Array.isArray(zones.tabs) ? zones.tabs : [];
      for (let i = 0; i < tabs.length; i += 1) {
        const tab = tabs[i];
        if (isPointInRect(mx, my, tab)) {
          gameState.chestsLayout.activeTab = String(tab.id || gameState.chestsLayout.activeTab || 'Common');
          drawFrame();
          return { handled: true, mx, my, rect };
        }
      }
      drawFrame();
      return { handled: true, mx, my, rect };
    }

    if (activeLayoutId === 'heroLayout') {
      const zones = uiState.getUIState().heroScreenHitZones || {};
      const roster = getHeroScreenRoster();
      const selectedHero = roster[normalizeHeroSelectionIndex()] || null;
      const skillNodes = Array.isArray(zones.skillNodes) ? zones.skillNodes : [];
      const selectedSkillIndex = Math.max(0, Math.floor(Number(zones.selectedSkillIndex || uiState.getUIState().heroScreenSelectedSkillIndex || 0)));
      const modalZones = zones.modal || null;
      let consumedSkillClick = false;
      if (uiState.getUIState().heroScreenSkillModalOpen && modalZones) {
        if (isPointInRect(mx, my, modalZones.close) || !isPointInRect(mx, my, modalZones.card)) {
          uiState.setUIStateField('heroScreenSkillModalOpen', false);
          drawFrame();
          return { handled: true, mx, my, rect };
        }
        if (isPointInRect(mx, my, modalZones.upgradeButton)) {
          const activeNode = skillNodes.find((node) => Number(node?.idx || -1) === Number(uiState.getUIState().heroScreenSkillModalSkillIndex || 0)) || skillNodes[0] || null;
          if (activeNode && activeNode.actionable !== false && selectedHero) {
            callFunctionWithContext(fnContext, 'AttemptHeroSkillUpgrade', selectedHero.uid, activeNode.skillKey, 'hero_skill_modal_upgrade_button');
          }
          drawFrame();
          return { handled: true, mx, my, rect };
        }
        drawFrame();
        return { handled: true, mx, my, rect };
      }
      if (isPointInRect(mx, my, zones.close)) {
        uiState.setUIStateField('heroScreenSkillModalOpen', false);
        const closeHeroLayout = () => returnToQuest(gameState, layoutState, 'hero-close-button').catch((err) => {
          console.error('[LAYOUT_PHASE1] hero return failed', err);
        });
        closeHeroLayout().then((changed) => {
          if (!changed) {
            setTimeout(() => {
              closeHeroLayout();
            }, 24);
          }
        });
      } else if (isPointInRect(mx, my, zones.prevHero)) {
        if (roster.length) {
          gameState.selectedHero = (normalizeHeroSelectionIndex() + roster.length - 1) % roster.length;
          uiState.setUIStateField('heroScreenSelectedSkillIndex', 0);
          uiState.setUIStateField('heroScreenSkillModalOpen', false);
        }
      } else if (isPointInRect(mx, my, zones.nextHero)) {
        if (roster.length) {
          gameState.selectedHero = (normalizeHeroSelectionIndex() + 1) % roster.length;
          uiState.setUIStateField('heroScreenSelectedSkillIndex', 0);
          uiState.setUIStateField('heroScreenSkillModalOpen', false);
        }
      } else {
        for (const node of skillNodes) {
          if (!node) continue;
          if (isPointInRect(mx, my, node.rect)) {
            uiState.setUIStateField('heroScreenSelectedSkillIndex', Math.max(0, Math.floor(Number(node.idx || 0))));
            uiState.setUIStateField('heroScreenSkillModalSkillIndex', Math.max(0, Math.floor(Number(node.idx || 0))));
            uiState.setUIStateField('heroScreenSkillModalOpen', true);
            consumedSkillClick = true;
            break;
          }
        }
        if (!consumedSkillClick && selectedHero && isPointInRect(mx, my, zones.upgradeButton)) {
          const activeNode = skillNodes.find((node) => Number(node?.idx || -1) === selectedSkillIndex) || skillNodes[0] || null;
          if (activeNode && activeNode.actionable !== false) {
            callFunctionWithContext(fnContext, 'AttemptHeroSkillUpgrade', selectedHero.uid, activeNode.skillKey, 'hero_screen_upgrade_button');
          }
        }
      }
      drawFrame();
      return { handled: true, mx, my, rect };
    }

    if (layoutHarnessEnabled && harnessLayoutState && harnessInputDomains) {
      const activeLayout = harnessLayoutState.getActiveLayoutId();
      if (activeLayout === 'storyMock') {
        harnessInputDomains.emit(activeLayout, 'layout:storyMock:click', { x: mx, y: my });
        drawFrame();
        return { handled: true, mx, my, rect };
      }
      if (activeLayout === 'town') {
        harnessInputDomains.emit(activeLayout, 'layout:town:click', { x: mx, y: my });
        drawFrame();
        return { handled: true, mx, my, rect };
      }
      if (activeLayout === 'astralOverlay') {
        harnessInputDomains.emit(activeLayout, 'layout:astralOverlay:click', { x: mx, y: my });
        drawFrame();
        return { handled: true, mx, my, rect };
      }
    }

    return { handled: false, mx, my, rect };
  };

  return {
    routePointerDown,
  };
}
