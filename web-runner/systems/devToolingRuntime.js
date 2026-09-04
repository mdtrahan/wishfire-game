import * as devToolingControls from './devToolingControls.js';
import { renderCombatTurnQaReadoutHtml } from './combatTurnQaReadout.mjs';
import { normalizeCombatOrientation } from '../../src/core/combatOrientation.mjs';

const DEV_TOOL_HOTKEY_LABEL = 'Ctrl+Shift+P';
const DEV_TOOL_GEM_RANDOM = -1;
const DEV_TOOL_GEM_OPTIONS = Object.freeze([
  { value: DEV_TOOL_GEM_RANDOM, label: 'Random' },
  { value: 1, label: 'RED' },
  { value: 2, label: 'BLUE' },
  { value: 3, label: 'YELLOW' },
  { value: 4, label: 'HEAL' },
  { value: 5, label: 'PURPLE' },
]);
const GEM_SPAWN_COLORS = Object.freeze([1, 2, 3, 4, 5]);
const DEV_TOOL_REWARD_OPTIONS = Object.freeze([
  { value: '', label: 'None' },
  { value: 'GOLD', label: 'Gold' },
  { value: 'ENERGY', label: 'Energy' },
  { value: 'HEAL', label: 'Heal' },
  { value: 'SAND', label: 'Sand' },
  { value: 'BONE_CHIP', label: 'Bone Chip' },
  { value: 'SLIME', label: 'Slime' },
  { value: 'HORN', label: 'Horn' },
  { value: 'SHELL', label: 'Shell' },
]);
const DEV_TOOLING_STORAGE_KEY = 'orka.dev_tooling_config.v1';
const DEV_TOOL_EMPTY_SLOT = '';
const DEV_TOOL_RANDOM_ENEMY_SLOT = '__RANDOM__';
const DEV_TOOL_SKILL_ID_LEGEND = Object.freeze([
  { title: 'Magic Fruit', id: 'party_magic_fruit' },
  { title: 'Crimson Ward', id: 'party_crimson_ward' },
  { title: 'Split', id: 'party_split' },
  { title: 'Faze', id: 'party_faze' },
  { title: 'Destiny', id: 'party_destiny' },
  { title: 'Chain Strike I', id: 'party_chain_strike_i' },
  { title: 'Chain Strike II', id: 'party_chain_strike_ii' },
  { title: 'Grow', id: 'party_grow' },
]);
export {
  DEV_TOOL_HOTKEY_LABEL,
  DEV_TOOL_GEM_RANDOM,
  DEV_TOOL_GEM_OPTIONS,
  DEV_TOOL_REWARD_OPTIONS,
  DEV_TOOL_EMPTY_SLOT,
  DEV_TOOL_RANDOM_ENEMY_SLOT,
  GEM_SPAWN_COLORS,
};

export function createDevToolingRuntime(deps = {}) {
  const {
    state,
    gameState,
    CANONICAL_HERO_ROSTER,
    callFunctionWithContext,
    fnContext,
    getLayoutState = () => null,
    resetSuperGemBoardState,
    superGemRuntime,
    setGemArray,
    rebuildGridFromGems,
    restartIdleFarmSession,
    hasEmptySlots,
    getPresentationTurnBarrier,
    getEnemyRosterStabilitySnapshot,
    applyTurnGateGlobals,
    createCombatTurnRefreshBaseline,
  } = deps;

  let devToolingDom = null;
  let devToolingRefreshHandler = null;
  let devToolingAutoplayHandler = null;
  let devToolingPauseSnapshot = null;

  const layoutState = {
    getActiveLayoutId() {
      const current = getLayoutState();
      return current && typeof current.getActiveLayoutId === 'function'
        ? current.getActiveLayoutId()
        : null;
    },
  };

  function createDefaultDevToolingConfig() {
    return {
      open: false,
      hotkey: DEV_TOOL_HOTKEY_LABEL,
      heroSlots: CANONICAL_HERO_ROSTER.map((hero) => String(hero.name || '')),
      enemySlots: Array.from({ length: 3 }, () => DEV_TOOL_RANDOM_ENEMY_SLOT),
      boardGemColor: DEV_TOOL_GEM_RANDOM,
      goldAmount: 0,
      combatSpeed: 1,
      combatOrientation: normalizeCombatOrientation(state.globals.CombatOrientation),
      rewardDrops: '',
      rewardCount: 1,
      doubleAttackHeroName: '',
      doubleAttackChance: 1,
      lastAppliedAt: 0,
    };
  }

  function sanitizeDevToolingConfig(input = {}) {
    const base = createDefaultDevToolingConfig();
    const next = { ...base, ...(input && typeof input === 'object' ? input : {}) };
    next.open = !!next.open;
    next.hotkey = DEV_TOOL_HOTKEY_LABEL;
    const allowedHeroNames = new Set(base.heroSlots);
    const rawHeroSlots = Array.isArray(next.heroSlots) ? next.heroSlots : base.heroSlots;
    next.heroSlots = Array.from({ length: 4 }, (_, idx) => {
      const value = String(rawHeroSlots[idx] || '').trim();
      return value && allowedHeroNames.has(value) ? value : DEV_TOOL_EMPTY_SLOT;
    });
    if (!next.heroSlots.some(Boolean)) next.heroSlots[0] = base.heroSlots[0];
    const rawEnemySlots = Array.isArray(next.enemySlots) ? next.enemySlots : base.enemySlots;
    next.enemySlots = Array.from({ length: 3 }, (_, idx) => {
      const value = String(rawEnemySlots[idx] || '').trim();
      return value || DEV_TOOL_EMPTY_SLOT;
    });
    const colorValue = Number(next.boardGemColor);
    next.boardGemColor = DEV_TOOL_GEM_OPTIONS.some((row) => row.value === colorValue) ? colorValue : base.boardGemColor;
    next.goldAmount = Math.max(0, Math.floor(Number(next.goldAmount || 0)));
    next.combatSpeed = Math.max(0.25, Math.min(4, Number(next.combatSpeed || 1)));
    next.combatOrientation = normalizeCombatOrientation(next.combatOrientation);
    const rewardDrop = String(next.rewardDrops || '').trim().toUpperCase();
    next.rewardDrops = DEV_TOOL_REWARD_OPTIONS.some((row) => row.value === rewardDrop) ? rewardDrop : '';
    next.rewardCount = Math.max(0, Math.min(99, Math.floor(Number(next.rewardCount || base.rewardCount))));
    const doubleAttackHeroName = String(next.doubleAttackHeroName || '').trim();
    next.doubleAttackHeroName = !doubleAttackHeroName || allowedHeroNames.has(doubleAttackHeroName) ? doubleAttackHeroName : '';
    next.doubleAttackChance = 1;
    next.lastAppliedAt = Number(next.lastAppliedAt || 0);
    return next;
  }

  function syncConfiguredDoubleAttackHarness(cfg = ensureDevToolingConfig()) {
    const heroNames = getDevToolHeroOptions();
    for (const heroName of heroNames) {
      const actor = state.entities.find((entity) => entity && entity.kind === 'hero' && String(entity.name || '') === heroName);
      if (!actor) continue;
      callFunctionWithContext(fnContext, 'RemoveActorExtraTurnSkill', actor.uid);
    }
    const holderName = String(cfg.doubleAttackHeroName || '').trim();
    state.globals.DevDoubleAttackChance = Number(cfg.doubleAttackChance || 1);
    if (!holderName) {
      state.globals.DevDoubleAttackHolderName = '';
      state.globals.DevDoubleAttackHolderUID = 0;
      return null;
    }
    const actor = state.entities.find((entity) => entity && entity.kind === 'hero' && String(entity.name || '') === holderName);
    if (!actor) {
      state.globals.DevDoubleAttackHolderName = '';
      state.globals.DevDoubleAttackHolderUID = 0;
      return null;
    }
    callFunctionWithContext(fnContext, 'ConfigureActorExtraTurnSkill', actor.uid, {
      chance: Number(cfg.doubleAttackChance || 1),
      traitId: 'double_attack',
      skillId: 'DOUBLE_ATTACK',
    });
    state.globals.DevDoubleAttackHolderName = holderName;
    state.globals.DevDoubleAttackHolderUID = Number(actor.uid || 0);
    return Number(actor.uid || 0);
  }

  function readPersistedDevToolingConfig() {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return null;
      const raw = window.sessionStorage.getItem(DEV_TOOLING_STORAGE_KEY);
      if (!raw) return null;
      return sanitizeDevToolingConfig(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function persistDevToolingConfig(cfg) {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      window.sessionStorage.setItem(DEV_TOOLING_STORAGE_KEY, JSON.stringify(sanitizeDevToolingConfig(cfg)));
    } catch {}
  }

  function clearPersistedDevToolingConfig() {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      window.sessionStorage.removeItem(DEV_TOOLING_STORAGE_KEY);
    } catch {}
  }

  function hardRestartRuntimeFromDevTooling() {
    if (typeof window === 'undefined' || !window.location) return false;
    clearPersistedDevToolingConfig();
    try {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.search = '';
      cleanUrl.hash = '';
      if (window.location.href !== cleanUrl.href && typeof window.location.replace === 'function') {
        window.location.replace(cleanUrl.href);
        return true;
      }
    } catch {}
    if (typeof window.location.reload === 'function') {
      window.location.reload();
      return true;
    }
    return false;
  }

  function ensureDevToolingConfig() {
    const persisted = readPersistedDevToolingConfig();
    const live = (state.globals.DevToolingConfig && typeof state.globals.DevToolingConfig === 'object')
      ? state.globals.DevToolingConfig
      : {};
    const next = sanitizeDevToolingConfig({
      ...(persisted || {}),
      ...live,
      open: !!live.open,
    });
    state.globals.DevToolingConfig = next;
    return next;
  }

  function getConfiguredHeroCount() {
    return sanitizeDevToolingConfig(state.globals.DevToolingConfig || {}).heroSlots.filter(Boolean).length;
  }

  function getConfiguredEnemyCount() {
    return sanitizeDevToolingConfig(state.globals.DevToolingConfig || {}).enemySlots
      .filter((value) => String(value || '').trim() !== DEV_TOOL_EMPTY_SLOT)
      .length;
  }

  function getDevToolHeroOptions() {
    return CANONICAL_HERO_ROSTER.map((hero) => String(hero.name || '')).filter(Boolean);
  }

  function getDevToolEnemyOptions() {
    const pool = Array.isArray(state.globals.DevToolEnemyCatalog) ? state.globals.DevToolEnemyCatalog : [];
    return [...new Set(pool.map((name) => String(name || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function getConfiguredHeroSlots() {
    return sanitizeDevToolingConfig(state.globals.DevToolingConfig || {}).heroSlots.slice(0, 4);
  }

  function getConfiguredEnemySlots() {
    return sanitizeDevToolingConfig(state.globals.DevToolingConfig || {}).enemySlots.slice(0, 3);
  }

  function resolveDevToolingSkillHeroUID(rawValue = '') {
    const heroes = state.entities.filter(actor => actor?.kind === 'hero');
    const requested = Number(rawValue || 0);
    if (Number.isFinite(requested) && requested > 0) {
      const requestedUID = Math.floor(requested);
      const exactActor = heroes.find(actor => Number(actor?.uid || 0) === requestedUID) || null;
      if (exactActor) return requestedUID;
      const slotActor = heroes.find((actor, index) => {
        const displaySlot = Number(actor?.heroDisplaySlot);
        const heroIndex = Number(actor?.heroIndex);
        return (Number.isInteger(displaySlot) && displaySlot + 1 === requestedUID)
          || (Number.isInteger(heroIndex) && heroIndex + 1 === requestedUID)
          || index + 1 === requestedUID;
      }) || null;
      if (slotActor) return Number(slotActor.uid || 0);
    }
    const currentUID = Number(callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0);
    const currentActor = heroes.find(actor => Number(actor?.uid || 0) === currentUID) || null;
    if (currentActor) return currentUID;
    const fallbackHero = heroes.find(actor => Number(actor?.hp || 0) > 0) || heroes[0] || null;
    return Number(fallbackHero?.uid || 0);
  }

  function escapeDevToolingHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function collectDevToolSkillLegendRows() {
    return DEV_TOOL_SKILL_ID_LEGEND.map(row => ({ ...row }));
  }

  function renderDevToolSkillLegendHtml() {
    const rows = collectDevToolSkillLegendRows();
    const rowHtml = rows.length
      ? rows.map(row => `
        <div data-devtool-skill-legend-row style="display:grid;grid-template-columns:minmax(88px,1fr) minmax(128px,1.2fr);gap:6px;align-items:center;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;padding:6px;font-size:11px;line-height:1.25;">
          <span style="font-weight:700;color:#111827;overflow-wrap:anywhere;">${escapeDevToolingHtml(row.title)}</span>
          <code data-devtool-skill-id-label style="font:700 11px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;color:#312e81;overflow-wrap:anywhere;">${escapeDevToolingHtml(row.id)}</code>
        </div>
      `).join('')
      : '<div style="font-size:11px;color:#475569;">No skill IDs available.</div>';
    return `
      <section data-devtool-skill-legend style="display:flex;flex-direction:column;gap:8px;margin-top:14px;border-top:1px solid #e2e8f0;padding-top:12px;">
        <div style="font-weight:800;">Skill ID Legend</div>
        <div style="display:grid;grid-template-columns:minmax(0,1fr);gap:6px;max-height:150px;overflow:auto;padding-right:4px;">
          ${rowHtml}
        </div>
      </section>
    `;
  }

  function syncIdleFarmDevLoadoutConfig(cfg = ensureDevToolingConfig()) {
    const layout = gameState.idleFarmLayout || (gameState.idleFarmLayout = {});
    const currentConfig = (layout.config && typeof layout.config === 'object') ? layout.config : {};
    const heroNames = Array.isArray(cfg.heroSlots) ? cfg.heroSlots.map((value) => String(value || '').trim()).filter(Boolean) : [];
    const rawEnemySlots = Array.isArray(cfg.enemySlots) ? cfg.enemySlots.map((value) => String(value || '').trim()) : [];
    const activeEnemySlots = rawEnemySlots.filter((value) => value !== DEV_TOOL_EMPTY_SLOT);
    layout.config = {
      ...currentConfig,
      heroNames,
      enemySlots: Math.max(1, activeEnemySlots.length || Number(currentConfig.enemySlots || 1)),
      enemyNames: rawEnemySlots.map((value) => (value === DEV_TOOL_RANDOM_ENEMY_SLOT ? '' : value)),
    };
    return layout.config;
  }

  function readEscortPartyConfig() {
    const raw = state.globals && state.globals.EscortPartyConfig;
    if (!raw || typeof raw !== 'object' || !raw.enabled) return null;
    const heroName = String(raw.activeHeroName || raw.heroName || '').trim();
    const escortName = String(raw.escortName || raw.name || 'Escort').trim() || 'Escort';
    const portraitName = String(raw.escortPortraitName || raw.portraitName || heroName || 'Falie').trim() || 'Falie';
    const heroDisplaySlot = Math.max(0, Math.min(3, Math.floor(Number(raw.heroDisplaySlot ?? 0) || 0)));
    let escortDisplaySlot = Math.max(0, Math.min(3, Math.floor(Number(raw.escortDisplaySlot ?? (heroDisplaySlot + 1)) || 0)));
    if (escortDisplaySlot === heroDisplaySlot) escortDisplaySlot = Math.min(3, heroDisplaySlot + 1);
    const hp = Math.max(1, Math.floor(Number(raw.hp || raw.maxHP || 30) || 30));
    const maxHP = Math.max(hp, Math.floor(Number(raw.maxHP || hp) || hp));
    return {
      activeHeroName: heroName,
      heroDisplaySlot,
      escortName,
      escortDisplaySlot,
      portraitName,
      hp,
      maxHP,
    };
  }

  function buildConfiguredCombatPartyMembers(configuredHeroSlots, escortConfig = null) {
    const requestedSlots = Array.from({ length: 4 }, (_, idx) => String(configuredHeroSlots?.[idx] || '').trim());
    const resolvedSlots = escortConfig
      ? Array.from({ length: 4 }, () => DEV_TOOL_EMPTY_SLOT)
      : requestedSlots.slice();
    if (escortConfig) {
      const heroName = String(escortConfig.activeHeroName || '').trim();
      if (heroName) resolvedSlots[escortConfig.heroDisplaySlot] = heroName;
    }
    const heroCloneCounts = {};
    const heroMembers = resolvedSlots.map((heroName, displaySlot) => {
      const name = String(heroName || '').trim();
      if (!name) return null;
      const canonicalIndex = CANONICAL_HERO_ROSTER.findIndex((hero) => String(hero?.name || '') === name);
      if (canonicalIndex === -1) return null;
      heroCloneCounts[name] = Number(heroCloneCounts[name] || 0) + 1;
      const cloneOrdinal = heroCloneCounts[name];
      const cloneLabel = String.fromCharCode(64 + Math.min(26, cloneOrdinal));
      const duplicateCount = resolvedSlots.filter((slotName) => String(slotName || '').trim() === name).length;
      return {
        ...CANONICAL_HERO_ROSTER[canonicalIndex],
        canonicalIndex,
        baseHeroName: name,
        cloneOrdinal,
        cloneLabel,
        instanceName: duplicateCount > 1 ? `${name} ${cloneLabel}` : name,
        heroInstanceKey: `${name.toLowerCase()}#${cloneOrdinal}`,
        displaySlot,
      };
    });
    const escortMember = escortConfig ? {
      uid: 0,
      kind: 'escort',
      name: escortConfig.escortName,
      baseHeroName: escortConfig.portraitName,
      portraitName: escortConfig.portraitName,
      hp: escortConfig.hp,
      maxHP: escortConfig.maxHP,
      heroDisplaySlot: escortConfig.escortDisplaySlot,
      escortDisplaySlot: escortConfig.escortDisplaySlot,
      nonActingEscort: true,
      isAlive: true,
      stats: { ATK: 0, DEF: 0, MAG: 0, RES: 0, SPD: 0 },
      attackType: 'none',
    } : null;
    return {
      heroMembers,
      escortMember,
      renderSlots: heroMembers
        .map((member) => member ? { ...member, kind: 'hero', heroDisplaySlot: member.displaySlot } : null)
        .concat(escortMember ? [escortMember] : [])
        .filter(Boolean)
        .sort((a, b) => Number(a.heroDisplaySlot || 0) - Number(b.heroDisplaySlot || 0)),
    };
  }

  function applyBoardGemColor(colorValue) {
    const color = Number(colorValue);
    if (!Number.isFinite(color) || color === DEV_TOOL_GEM_RANDOM) return 0;
    if (!Array.isArray(gameState.gems)) return 0;
    resetSuperGemBoardState(gameState);
    superGemRuntime.clearPendingSuperGemAction(state);
    gameState.selectedGems = [];
    gameState.selectionLocked = false;
    gameState.gemMergeFx = null;
    state.globals.BoardFillActive = 0;
    state.globals.TapIndex = 0;
    let changed = 0;
    for (const gem of gameState.gems) {
      if (!gem) continue;
      gem.color = color;
      gem.elementIndex = color;
      gem.selected = false;
      gem.Selected = 0;
      gem.flashUntil = 0;
      changed += 1;
    }
    setGemArray(gameState.gems);
    rebuildGridFromGems();
    return changed;
  }

  function updateDevToolingStatus(message = '') {
    if (!devToolingDom) return;
    const autoplayActive = !!state.globals.DevAutoplayActive;
    if (devToolingDom.autoplay) {
      devToolingDom.autoplay.textContent = devToolingControls.getAutoplayButtonLabel(autoplayActive);
    }
    if (!devToolingDom.status) return;
    const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
      ? layoutState.getActiveLayoutId()
      : 'unknown';
    const skillDraught = getSkillDraughtDevSummary();
    const suffix = message ? `\n${message}` : '';
    devToolingDom.status.textContent =
      `Hotkey: ${DEV_TOOL_HOTKEY_LABEL}\nActive Layout: ${activeLayoutId}\nIdle Mode: ${autoplayActive ? 'ACTIVE' : 'idle'}\nSkill Draw: ${skillDraught}\nApply: writes only the selected condition; no combat reset, turn advance, or loadout refresh${suffix}`;
  }

  function refreshCombatTurnQaReadout() {
    if (!devToolingDom?.turnOrderQaSlot) return;
    devToolingDom.turnOrderQaSlot.innerHTML = renderCombatTurnQaReadoutHtml({
      state,
      callFunctionWithContext,
      fnContext,
    });
  }

  function getSkillDraughtDevSummary() {
    const draught = callFunctionWithContext(fnContext, 'GetSkillDraughtState') || {};
    const sessionSkills = draught.sessionSkillsByHeroUID || {};
    const learnedCount = Object.values(sessionSkills).reduce((total, row) => total + (Array.isArray(row) ? row.length : 0), 0);
    const open = Number(draught.open || 0) ? 'open' : 'closed';
    return `${open}, hero ${Number(draught.heroUID || 0)}, candidates ${(draught.candidates || []).length}, session ${learnedCount}`;
  }

  function populateDevToolSlotSelect(selectEl, { choices = [], includeRandom = false, selected = '' } = {}) {
    if (!selectEl) return;
    const value = String(selected || '');
    selectEl.innerHTML = '';
    if (includeRandom) {
      const randomOpt = document.createElement('option');
      randomOpt.value = DEV_TOOL_RANDOM_ENEMY_SLOT;
      randomOpt.textContent = 'Current pool/random';
      selectEl.appendChild(randomOpt);
    }
    const emptyOpt = document.createElement('option');
    emptyOpt.value = DEV_TOOL_EMPTY_SLOT;
    emptyOpt.textContent = 'Empty slot';
    selectEl.appendChild(emptyOpt);
    for (const name of choices) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      selectEl.appendChild(opt);
    }
    const fallback = includeRandom ? DEV_TOOL_RANDOM_ENEMY_SLOT : DEV_TOOL_EMPTY_SLOT;
    selectEl.value = Array.from(selectEl.options).some((opt) => opt.value === value) ? value : fallback;
  }

  function syncDevToolingDomFromConfig() {
    if (!devToolingDom) return;
    const cfg = ensureDevToolingConfig();
    const heroChoices = getDevToolHeroOptions();
    const enemyChoices = getDevToolEnemyOptions();
    devToolingDom.heroSlots.forEach((selectEl, idx) => {
      populateDevToolSlotSelect(selectEl, { choices: heroChoices, includeRandom: false, selected: cfg.heroSlots[idx] || '' });
    });
    devToolingDom.enemySlots.forEach((selectEl, idx) => {
      populateDevToolSlotSelect(selectEl, { choices: enemyChoices, includeRandom: true, selected: cfg.enemySlots[idx] || DEV_TOOL_RANDOM_ENEMY_SLOT });
    });
    devToolingDom.boardGemColor.value = String(cfg.boardGemColor);
    devToolingDom.goldAmount.value = String(cfg.goldAmount);
    devToolingDom.combatSpeed.value = String(cfg.combatSpeed);
    devToolingDom.combatOrientation.value = String(cfg.combatOrientation);
    devToolingDom.rewardDrops.value = String(cfg.rewardDrops || '');
    devToolingDom.rewardCount.value = String(cfg.rewardCount);
    populateDevToolSlotSelect(devToolingDom.doubleAttackHero, { choices: getDevToolHeroOptions(), includeRandom: false, selected: cfg.doubleAttackHeroName || DEV_TOOL_EMPTY_SLOT });
    if (devToolingDom.skillHero && !devToolingDom.skillHero.value) {
      devToolingDom.skillHero.value = String(callFunctionWithContext(fnContext, 'GetCurrentTurn') || '');
    }
    updateDevToolingStatus();
  }

  function readDevToolingDomConfigPatch() {
    if (!devToolingDom) return {};
    return {
      heroSlots: devToolingDom.heroSlots.map((selectEl) => String(selectEl?.value || '')),
      enemySlots: devToolingDom.enemySlots.map((selectEl) => String(selectEl?.value || DEV_TOOL_RANDOM_ENEMY_SLOT)),
      boardGemColor: Number(devToolingDom.boardGemColor.value || 0),
      goldAmount: Number(devToolingDom.goldAmount.value || 0),
      combatSpeed: Number(devToolingDom.combatSpeed.value || 1),
      combatOrientation: String(devToolingDom.combatOrientation.value || 'left-wise'),
      rewardDrops: String(devToolingDom.rewardDrops.value || ''),
      rewardCount: Number(devToolingDom.rewardCount.value || 1),
      doubleAttackHeroName: String(devToolingDom.doubleAttackHero?.value || ''),
    };
  }

  async function applyDevToolingConfig(patch = {}, { closeModal = true } = {}) {
    const prev = ensureDevToolingConfig();
    const next = sanitizeDevToolingConfig({
      ...prev,
      ...(patch && typeof patch === 'object' ? patch : {}),
      lastAppliedAt: Number(state.globals.time || 0),
    });
    state.globals.DevToolingConfig = next;
    state.globals.DevHeroSlots = [...next.heroSlots];
    state.globals.DevHeroCount = next.heroSlots.filter(Boolean).length;
    state.globals.DevEnemySlots = [...next.enemySlots];
    state.globals.EncounterMaxSlots = next.enemySlots.filter((value) => String(value || '').trim() !== DEV_TOOL_EMPTY_SLOT).length;
    state.globals.DevForcedEnemyType = '';
    state.globals.DevForcedBoardColor = next.boardGemColor;
    state.globals.goldTotal = next.goldAmount;
    state.globals.DevCombatSpeedMultiplier = next.combatSpeed;
    state.globals.CombatOrientation = next.combatOrientation;
    state.globals.DevRewardDropId = next.rewardDrops;
    state.globals.DevRewardDrops = next.rewardDrops
      ? Array.from({ length: next.rewardCount }, () => next.rewardDrops)
      : [];
    state.globals.DevRewardCount = next.rewardCount;
    state.globals.DevDoubleAttackHolderName = '';
    state.globals.DevDoubleAttackHolderUID = 0;
    state.globals.DevDoubleAttackChance = Number(next.doubleAttackChance || 1);
    persistDevToolingConfig(next);
    syncIdleFarmDevLoadoutConfig(next);
    gameState.selectedHero = Math.min(gameState.selectedHero || 0, Math.max(0, next.heroSlots.filter(Boolean).length - 1));
    gameState.selectedEnemy = Math.min(gameState.selectedEnemy || 0, Math.max(0, next.enemySlots.filter((value) => String(value || '').trim() !== DEV_TOOL_EMPTY_SLOT).length - 1));
    const recolored = applyBoardGemColor(next.boardGemColor);
    const doubleAttackUID = syncConfiguredDoubleAttackHarness(next);
    const heroSlotsChanged = JSON.stringify(prev.heroSlots || []) !== JSON.stringify(next.heroSlots || []);
    const enemySlotsChanged = JSON.stringify(prev.enemySlots || []) !== JSON.stringify(next.enemySlots || []);
    const loadoutChanged = heroSlotsChanged || enemySlotsChanged;
    const orientationChanged = prev.combatOrientation !== next.combatOrientation;
    const combatSetupChanged = loadoutChanged || orientationChanged;
    const activeLayoutId = layoutState && typeof layoutState.getActiveLayoutId === 'function'
      ? layoutState.getActiveLayoutId()
      : '';
    let appliedSessionChange = 'none';
    if (combatSetupChanged) {
      if (activeLayoutId === 'combat' && typeof devToolingRefreshHandler === 'function') {
        await devToolingRefreshHandler({ forceCombat: false, resetGame: false });
        appliedSessionChange = 'combat_refresh';
      } else if (activeLayoutId === 'idleFarmLayout') {
        restartIdleFarmSession(performance.now() / 1000);
        appliedSessionChange = 'idle_restart';
      }
    }
    syncDevToolingDomFromConfig();
    if (closeModal) closeDevToolingModal({ restorePauseSnapshot: appliedSessionChange !== 'combat_refresh' });
    updateDevToolingStatus(
      `Applied\n` +
      `Board recolor count: ${recolored}\n` +
      `Hero slots (staged): ${next.heroSlots.map((value) => value || 'Empty').join(', ')}\n` +
      `Enemy slots (staged): ${next.enemySlots.map((value) => value === DEV_TOOL_RANDOM_ENEMY_SLOT ? 'Random' : (value || 'Empty')).join(', ')}\n` +
      `Combat orientation: ${next.combatOrientation}\n` +
      `Double Attack: ${next.doubleAttackHeroName || 'Off'}${doubleAttackUID ? ` (uid ${doubleAttackUID})` : ''}\n` +
      `Reward (staged): ${next.rewardDrops || 'None'} x${next.rewardCount}\n` +
      `${combatSetupChanged ? `Combat setup applied: ${appliedSessionChange}` : 'Combat state unchanged'}`
    );
    return {
      ...next,
      rewardDrops: [...(state.globals.DevRewardDrops || [])],
      boardRecolored: recolored,
      doubleAttackUID,
      loadoutChanged,
      orientationChanged,
      appliedSessionChange,
      refreshed: false,
    };
  }

  function ensureDevToolingModal() {
    if (devToolingDom || typeof document === 'undefined') return devToolingDom;
    const root = document.createElement('div');
    root.id = 'orka-dev-tooling-modal';
    root.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'background:rgba(0,0,0,0.58)',
      'z-index:9999',
      'padding:16px',
      'box-sizing:border-box',
    ].join(';');
    const panel = document.createElement('div');
    panel.style.cssText = [
      'flex:none',
      'width:min(520px, var(--orka-control-viewport-width, calc(100vw - 32px)))',
      'max-height:var(--orka-control-viewport-height, 88dvh)',
      'overflow:auto',
      'padding:18px',
      'border-radius:14px',
      'border:2px solid #1f2937',
      'background:#f7f2e8',
      'box-shadow:0 18px 48px rgba(0,0,0,0.4)',
      'font:12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'color:#111827',
      'transform:scale(var(--orka-control-scale, 1))',
      'transform-origin:center',
    ].join(';');
    panel.innerHTML = `
      <style>
        #orka-dev-tooling-modal * { box-sizing:border-box; }
        #orka-dev-tooling-modal button {
          appearance:none;
          -webkit-appearance:none;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-height:28px;
          line-height:1;
          white-space:nowrap;
          text-align:center;
          user-select:none;
          pointer-events:auto;
          text-decoration:none;
        }
        #orka-dev-tooling-modal input,
        #orka-dev-tooling-modal select { width:100%; box-sizing:border-box; }
        @media (max-width: 560px) {
          #orka-dev-tooling-modal [data-devtool-control-grid] { grid-template-columns:1fr !important; }
        }
      </style>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
        <div>
          <div data-devtool-title style="font-size:18px;font-weight:800;white-space:nowrap;">Dev Tooling Modal</div>
        </div>
        <button type="button" data-devtool-close style="border:1px solid #334155;background:#ffffff;padding:6px 10px;border-radius:8px;font-weight:700;cursor:pointer;">Close</button>
      </div>
      <div data-devtool-button-row style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:14px;">
        <button type="button" data-devtool-apply style="border:1px solid #14532d;background:#1f8f4a;color:#fff;padding:6px 10px;border-radius:8px;font-weight:800;cursor:pointer;">Apply</button>
        <button type="button" data-devtool-refresh style="border:1px solid #475569;background:#fff;padding:6px 10px;border-radius:8px;font-weight:700;cursor:pointer;">Save Staged</button>
        <button type="button" data-devtool-autoplay style="border:1px solid #1d4ed8;background:#eff6ff;color:#1e3a8a;padding:6px 10px;border-radius:8px;font-weight:700;cursor:pointer;">AutoPlay</button>
        <button type="button" data-devtool-restart style="border:1px solid #92400e;background:#fff7ed;color:#9a3412;padding:6px 10px;border-radius:8px;font-weight:700;cursor:pointer;">Restart</button>
        <button type="button" data-devtool-force-skill-draught style="border:1px solid #4c1d95;background:#f5f3ff;color:#4c1d95;padding:6px 10px;border-radius:8px;font-weight:700;cursor:pointer;">Force Draw</button>
        <button type="button" data-devtool-clear-session-skills style="border:1px solid #7f1d1d;background:#fef2f2;color:#7f1d1d;padding:6px 10px;border-radius:8px;font-weight:700;cursor:pointer;">Clear Skills</button>
      </div>
      <div data-devtool-control-grid style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px;">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="font-weight:700;">Hero Slots</div>
          <label style="display:flex;flex-direction:column;gap:4px;">Hero Slot 1
            <select data-devtool-hero-slot="0"></select>
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;">Hero Slot 2
            <select data-devtool-hero-slot="1"></select>
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;">Hero Slot 3
            <select data-devtool-hero-slot="2"></select>
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;">Hero Slot 4
            <select data-devtool-hero-slot="3"></select>
          </label>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="font-weight:700;">Enemy Slots</div>
          <label style="display:flex;flex-direction:column;gap:4px;">Enemy Slot 1
            <select data-devtool-enemy-slot="0"></select>
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;">Enemy Slot 2
            <select data-devtool-enemy-slot="1"></select>
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;">Enemy Slot 3
            <select data-devtool-enemy-slot="2"></select>
          </label>
        </div>
        <label style="display:flex;flex-direction:column;gap:4px;">Board Gem Color
          <select data-devtool-board-color>
            ${DEV_TOOL_GEM_OPTIONS.map((row) => `<option value="${row.value}">${row.label}</option>`).join('')}
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">Gold Amount
          <input data-devtool-gold-amount type="number" min="0" step="1">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">Combat Speed
          <input data-devtool-combat-speed type="number" min="0.25" max="4" step="0.25">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">Combat Orientation
          <select data-devtool-combat-orientation>
            <option value="left-wise">Left-wise</option>
            <option value="right-wise">Right-wise</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">Reward Drop
          <select data-devtool-reward-drops>
            ${DEV_TOOL_REWARD_OPTIONS.map((row) => `<option value="${row.value}">${row.label}</option>`).join('')}
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">Reward Count
          <input data-devtool-reward-count type="number" min="0" max="99" step="1">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">Double Attack
          <select data-devtool-double-attack-hero></select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">Skill Draw Hero UID / Slot
          <input data-devtool-skill-hero type="number" min="0" step="1">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;">Skill Draw Skill ID
          <input data-devtool-skill-id type="text" placeholder="optional">
        </label>
      </div>
      <div data-devtool-turn-order-qa-slot></div>
      ${renderDevToolSkillLegendHtml()}
    `;
    root.appendChild(panel);
    document.body.appendChild(root);
    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.textContent = 'DEV';
    launcher.setAttribute('aria-label', 'Open developer tooling modal');
    launcher.style.cssText = [
      'position:fixed',
      'top:var(--orka-dev-top, 10px)',
      'right:var(--orka-control-right, 10px)',
      'z-index:10000',
      'border:1px solid #1f2937',
      'background:#f8fafc',
      'color:#111827',
      'padding:4px 6px',
      'border-radius:999px',
      'font:700 8px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'cursor:pointer',
      'box-shadow:0 4px 12px rgba(0,0,0,0.18)',
      'transform:scale(var(--orka-control-scale, 1))',
      'transform-origin:top right',
    ].join(';');
    document.body.appendChild(launcher);
    devToolingDom = {
      root,
      panel,
      launcher,
      close: panel.querySelector('[data-devtool-close]'),
      apply: panel.querySelector('[data-devtool-apply]'),
      refresh: panel.querySelector('[data-devtool-refresh]'),
      restart: panel.querySelector('[data-devtool-restart]'),
      autoplay: panel.querySelector('[data-devtool-autoplay]'),
      heroSlots: Array.from(panel.querySelectorAll('[data-devtool-hero-slot]')),
      enemySlots: Array.from(panel.querySelectorAll('[data-devtool-enemy-slot]')),
      boardGemColor: panel.querySelector('[data-devtool-board-color]'),
      goldAmount: panel.querySelector('[data-devtool-gold-amount]'),
      combatSpeed: panel.querySelector('[data-devtool-combat-speed]'),
      combatOrientation: panel.querySelector('[data-devtool-combat-orientation]'),
      rewardDrops: panel.querySelector('[data-devtool-reward-drops]'),
      rewardCount: panel.querySelector('[data-devtool-reward-count]'),
      doubleAttackHero: panel.querySelector('[data-devtool-double-attack-hero]'),
      skillHero: panel.querySelector('[data-devtool-skill-hero]'),
      skillId: panel.querySelector('[data-devtool-skill-id]'),
      forceSkillDraught: panel.querySelector('[data-devtool-force-skill-draught]'),
      clearSessionSkills: panel.querySelector('[data-devtool-clear-session-skills]'),
      turnOrderQaSlot: panel.querySelector('[data-devtool-turn-order-qa-slot]'),
      status: null,
    };
    devToolingDom.launcher.addEventListener('click', () => toggleDevToolingModal(true));
    devToolingDom.close.addEventListener('click', () => toggleDevToolingModal(false));
    devToolingDom.refresh.addEventListener('click', () => applyDevToolingConfig(readDevToolingDomConfigPatch(), { closeModal: false }));
    devToolingDom.apply.addEventListener('click', () => applyDevToolingConfig(readDevToolingDomConfigPatch(), { closeModal: true }));
    devToolingDom.restart.addEventListener('click', async () => devToolingControls.handleRestartClick({
      closeDevToolingModal,
      devToolingRefreshHandler,
      updateDevToolingStatus,
    }));
    devToolingDom.autoplay.addEventListener('click', async () => {
      if (state.globals.DevAutoplayActive) {
        state.globals.DevAutoplayStopRequested = 1;
        updateDevToolingStatus('AutoPlay stop requested');
        return;
      }
      closeDevToolingModal({ restorePauseSnapshot: true });
      if (typeof devToolingAutoplayHandler === 'function') {
        await devToolingAutoplayHandler();
      }
    });
    devToolingDom.forceSkillDraught.addEventListener('click', () => {
      const heroUID = resolveDevToolingSkillHeroUID(devToolingDom.skillHero?.value || '');
      const skillId = String(devToolingDom.skillId?.value || '').trim();
      callFunctionWithContext(fnContext, 'ForceAstralFlowSkillDraught', heroUID, skillId);
      closeDevToolingModal({ restorePauseSnapshot: true });
    });
    devToolingDom.clearSessionSkills.addEventListener('click', () => {
      callFunctionWithContext(fnContext, 'ClearSessionSkillDraught');
      updateDevToolingStatus('Session skill draw cleared');
    });
    root.addEventListener('click', (ev) => {
      if (ev.target === root) toggleDevToolingModal(false);
    });
    syncDevToolingDomFromConfig();
    refreshCombatTurnQaReadout();
    return devToolingDom;
  }

  function pauseGameplayForDevTooling() {
    if (devToolingPauseSnapshot) return;
    devToolingPauseSnapshot = {
      CanPickGems: Number(state.globals.CanPickGems || 0),
      IsPlayerBusy: Number(state.globals.IsPlayerBusy || 0),
      DeferAdvance: Number(state.globals.DeferAdvance || 0),
      PendingSkillID: String(state.globals.PendingSkillID || ''),
      CombatSessionId: Number(state.globals.CombatSessionId || 0),
      TurnSerial: Number(state.globals.TurnSerial || 0),
    };
    applyTurnGateGlobals({
      CanPickGems: 0,
      IsPlayerBusy: 1,
    });
    state.globals.DevToolingPaused = 1;
  }

  function isDev2DiagnosticsOpen() {
    const panel = document.getElementById('dev2-diagnostics');
    return !!panel && !panel.hidden;
  }

  function clearDevToolingPauseSnapshot() {
    devToolingPauseSnapshot = null;
  }

  function restorePlayableHeroInputAfterDevToolingResume() {
    const heroInputBarrier = getPresentationTurnBarrier({
      hasEmpty: hasEmptySlots(),
      enemyLineClearPressureActive: !!state.globals.EnemyLineClearPressureActive,
    });
    const combatIdleHeroInputReady = (
      state.globals.GamePhase === 'RUNTIME' &&
      callFunctionWithContext(fnContext, 'GetCurrentType') === 0 &&
      state.globals.TurnPhase === 0 &&
      !(gameState.refillBounce && gameState.refillBounce.active) &&
      !(gameState.yellowCasino && gameState.yellowCasino.active) &&
      !hasEmptySlots() &&
      heroInputBarrier.canRestoreHeroInput &&
      getEnemyRosterStabilitySnapshot().stable
    );
    if (!combatIdleHeroInputReady) return false;
    gameState.selectedGems = [];
    gameState.selectionLocked = false;
    for (const gem of (gameState.gems || [])) {
      if (!gem) continue;
      gem.selected = false;
      gem.Selected = 0;
    }
    state.globals.TapIndex = 0;
    state.globals.CanPickGems = true;
    state.globals.IsPlayerBusy = 0;
    state.globals.DeferAdvance = 0;
    state.globals.BoardFillActive = 0;
    return true;
  }

  function resumeGameplayFromDevTooling() {
    if (!devToolingPauseSnapshot) {
      state.globals.DevToolingPaused = 0;
      return;
    }
    const sameCombatSession =
      Number(devToolingPauseSnapshot.CombatSessionId || 0) === Number(state.globals.CombatSessionId || 0);
    const sameTurnSerial =
      Number(devToolingPauseSnapshot.TurnSerial || 0) === Number(state.globals.TurnSerial || 0);
    if (sameCombatSession && sameTurnSerial) {
      applyTurnGateGlobals(devToolingPauseSnapshot);
      restorePlayableHeroInputAfterDevToolingResume();
    }
    state.globals.DevToolingPaused = 0;
    clearDevToolingPauseSnapshot();
  }

  function closeDevToolingModal({ restorePauseSnapshot = true } = {}) {
    const cfg = ensureDevToolingConfig();
    const root = ensureDevToolingModal()?.root;
    cfg.open = false;
    state.globals.DevToolingConfig = cfg;
    if (root) root.style.display = 'none';
    if (restorePauseSnapshot) {
      if (isDev2DiagnosticsOpen()) {
        state.globals.DevToolingPaused = 1;
      } else {
        resumeGameplayFromDevTooling();
      }
    } else {
      devToolingPauseSnapshot = null;
      state.globals.DevToolingPaused = 0;
    }
    return cfg;
  }

  function resetCombatRuntimeForFreshSession(reason = 'combat-refresh', options = {}) {
    const refill = gameState.refillBounce || (gameState.refillBounce = {});
    refill.active = false;
    refill.queue = [];
    refill.index = 0;
    refill.current = null;
    refill.speedScale = 1;

    const yellowCasino = gameState.yellowCasino || (gameState.yellowCasino = {});
    yellowCasino.active = false;
    yellowCasino.phase = 'idle';
    yellowCasino.queue = [];
    yellowCasino.index = 0;
    yellowCasino.current = null;
    yellowCasino.telegraphUntil = 0;
    yellowCasino.ghost = null;
    yellowCasino.pendingGoldAward = 0;

    gameState.selectedGems = [];
    gameState.selectionLocked = false;
    gameState.gemMergeFx = null;
    gameState.lastTurnPhase = null;
    gameState.enemyTurnKicked = false;
    gameState.buffRollTimer = 0;
    gameState._lastBuffRollActive = 0;
    state.globals.BoardFillActive = Number(options.boardFillActive || 0);
    state.globals.HeroLungeOffsetByUID = {};
    state.globals.DamageTexts = [];
    state.globals.TextAnimEndAt = 0;
    state.globals.TextAnimating = 0;
    state.globals.BlueBuffSequenceActive = 0;
    state.globals.BuffRollActive = 0;
    state.globals.BuffRollFrame = 0;
    state.globals.BuffRollSlot = -1;
    state.globals.BuffRollEndsAt = 0;
    state.globals.BuffRollApplyStat = 0;
    state.globals.BuffRollSkillID = '';
    state.globals.BuffRollActor = 0;
    state.globals.BuffRollType = 0;
    delete state.globals.HeroAction;
    delete state.globals.EnemyAction;
    delete state.globals.PendingHeroHits;
    delete state.globals.DoubleAttackLungeStarted;
    delete state.globals.DoubleAttackBatchAnchors;
    delete state.globals.NextHeroActionProfile;

    applyTurnGateGlobals(createCombatTurnRefreshBaseline(state.globals, {
      currentTurnType: Number(options.currentTurnType || 0),
      boardFillActive: Number(state.globals.BoardFillActive || 0),
      boardHasEmptySlots: !!options.boardHasEmptySlots,
    }));

    clearDevToolingPauseSnapshot();
    state.globals.DevToolingPaused = (ensureDevToolingConfig().open || isDev2DiagnosticsOpen()) ? 1 : 0;
    console.log(
      `[TURN] reset combat runtime baseline reason=${reason} ` +
      `turnType=${Number(options.currentTurnType || 0)} ` +
      `boardFill=${Number(state.globals.BoardFillActive || 0)} ` +
      `hasEmpty=${options.boardHasEmptySlots ? 1 : 0}`,
    );
  }

  function toggleDevToolingModal(nextOpen = null) {
    const cfg = ensureDevToolingConfig();
    const root = ensureDevToolingModal()?.root;
    if (!root) return cfg;
    const open = nextOpen == null ? !cfg.open : !!nextOpen;
    cfg.open = open;
    state.globals.DevToolingConfig = cfg;
    root.style.display = open ? 'flex' : 'none';
    if (open) {
      pauseGameplayForDevTooling();
      syncDevToolingDomFromConfig();
      refreshCombatTurnQaReadout();
      devToolingDom.heroSlots[0]?.focus();
    } else {
      closeDevToolingModal({ restorePauseSnapshot: true });
    }
    return cfg;
  }

  window.addEventListener('orka:dev2-diagnostics-open-change', (ev) => {
    const open = !!ev?.detail?.open;
    if (open) {
      pauseGameplayForDevTooling();
      return;
    }
    if (!ensureDevToolingConfig().open) {
      resumeGameplayFromDevTooling();
    }
  });
  if (isDev2DiagnosticsOpen()) {
    pauseGameplayForDevTooling();
  }

  function isDevToolingHotkey(ev) {
    if (!ev) return false;
    const key = String(ev.key || '').toLowerCase();
    const code = String(ev.code || '');
    return !!((ev.ctrlKey || ev.metaKey) && ev.shiftKey && (code === 'KeyP' || key === 'p'));
  }

  function isEditableDomTarget(target) {
    const tag = String(target?.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  return {
    createDefaultDevToolingConfig,
    sanitizeDevToolingConfig,
    ensureDevToolingConfig,
    getConfiguredHeroCount,
    getConfiguredEnemyCount,
    getDevToolHeroOptions,
    getDevToolEnemyOptions,
    getConfiguredHeroSlots,
    getConfiguredEnemySlots,
    readEscortPartyConfig,
    buildConfiguredCombatPartyMembers,
    syncIdleFarmDevLoadoutConfig,
    updateDevToolingStatus,
    applyDevToolingConfig,
    ensureDevToolingModal,
    pauseGameplayForDevTooling,
    resumeGameplayFromDevTooling,
    closeDevToolingModal,
    resetCombatRuntimeForFreshSession,
    hardRestartRuntimeFromDevTooling,
    toggleDevToolingModal,
    isDevToolingHotkey,
    isEditableDomTarget,
    setRefreshHandler(handler) {
      devToolingRefreshHandler = typeof handler === 'function' ? handler : null;
    },
    setAutoplayHandler(handler) {
      devToolingAutoplayHandler = typeof handler === 'function' ? handler : null;
    },
  };
}
