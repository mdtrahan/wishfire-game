import { WISHFIRE_WARP_CROSSING_CONTENT } from '../src/core/wishfireWarpCrossingContent.mjs';
import { handleNarrativeScenePointer, restartNarrativeScene, skipNarrativeScene, updateNarrativeSceneAuto } from './narrativeSceneController.mjs';

export function buildSyntheticQuestStages(enemies) {
  return enemies.filter(e => e.name && Number(e.CombatPower) > 0)
    .slice().sort((a, b) => a.CombatPower - b.CombatPower || a.name.localeCompare(b.name))
    .map((enemy, index) => ({
      id: `stage:${enemy.name}`, title: `Stage ${index + 1}`, kind: 'Combat',
      enemyName: enemy.name, cp: Number(enemy.CombatPower), combat: true, cost: 5, reward: 50,
      thumbnail: `assets/images/enemy_sprite-${encodeURIComponent(enemy.name.toLowerCase())}-000.png`,
    }));
}

export function createStoryEntryFlow({ gameState, layoutState, isReady, content = WISHFIRE_WARP_CROSSING_CONTENT, resurrect = () => {}, prepareEncounter = () => {}, getEnemies = () => [] }) {
  const scene = content.scenes[0];
  const handoff = scene.steps.findIndex(step => step.id === scene.combatHandoffStepId);
  if (handoff < 0) throw new Error('Opening scene requires an authored combat handoff step');
  const segment = steps => ({ ...content, scenes: [{ ...scene, steps }] });
  const cards = [
    { id: 'warp-crossing', title: 'Main Story 1', kind: 'Story + combat', cost: 5, reward: 50, combat: true, content: segment(scene.steps.slice(0, handoff)) },
    { id: 'after-the-crossing', title: 'Main Story 2', kind: 'Story', cost: 2, reward: 50, combat: false, content: segment(scene.steps.slice(handoff + 1)) },
  ];
  const entry = gameState.storyEntry = { phase: 'map', pending: false, error: null, combatUnlocked: false, activeCard: null, modal: null, cards,
    progress: { energy: 100, resources: 150, completed: [], revealed: 1 }, content: cards[0].content };
  const contains = (point, rect) => point && rect && point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
  async function go(target, reason, payload = {}) {
    if (entry.pending) return false;
    entry.pending = true;
    entry.error = null;
    try {
      const changed = await layoutState.requestLayoutChange(target, reason, payload);
      if (!changed) entry.error = 'This destination is unavailable.';
      return changed;
    } catch (error) { entry.error = String(error?.message || error); return false; }
    finally { entry.pending = false; }
  }
  function complete() {
    const card = cards[entry.activeCard];
    if (!card) return;
    if (!entry.progress.completed.includes(card.id)) {
      entry.progress.completed.push(card.id);
      entry.progress.resources += card.reward;
      entry.progress.revealed = Math.max(entry.progress.revealed, Math.min(cards.length, entry.activeCard + 2));
    }
    entry.activeCard = null;
    entry.combatUnlocked = false;
    entry.phase = 'ladder';
    entry.modal = null;
    if (layoutState.getActiveLayoutId() !== 'storyMock') void go('storyMock', 'quest-card-complete');
  }
  function finishStory() {
    const card = cards[entry.activeCard];
    if (!card) return;
    if (card.combat) {
      entry.phase = 'combat';
      entry.combatUnlocked = true;
      prepareEncounter();
      void go('combat', 'story-combat-handoff', { freshStart: true });
    } else complete();
  }
  function startCard(index) {
    if (!isReady() || entry.pending || entry.phase !== 'ladder' || !Number.isInteger(index) || index < 0 || index >= entry.progress.revealed) return false;
    const card = cards[index];
    if (entry.progress.energy < card.cost) { entry.error = 'Not enough energy for this card.'; return false; }
    entry.progress.energy -= card.cost;
    entry.activeCard = index;
    entry.content = card.content;
    entry.phase = 'opening';
    entry.error = null;
    if (card.content) restartNarrativeScene(gameState, entry.content, scene.id);
    else finishStory();
    return true;
  }
  function update(nowSec) {
    if (cards.length === 2 && isReady()) {
      const stages = buildSyntheticQuestStages(getEnemies());
      const midpoint = Math.ceil(stages.length / 2);
      cards.splice(1, 0, ...stages.slice(0, midpoint));
      cards.push(...stages.slice(midpoint));
    }
    if (layoutState.getActiveLayoutId() !== 'storyMock' || !isReady() || entry.pending || entry.modal || entry.phase !== 'opening') return;
    updateNarrativeSceneAuto(gameState, entry.content, nowSec);
    if (gameState.narrativeScene?.completed) finishStory();
  }
  function requestSkip() {
    if (entry.phase !== 'opening' || entry.pending || entry.modal) return false;
    entry.modal = 'skip';
    entry.savedAuto = gameState.narrativeScene.auto;
    gameState.narrativeScene.auto = false;
    return true;
  }
  function confirmSkip() {
    if (entry.modal !== 'skip' || entry.pending) return false;
    entry.modal = null;
    skipNarrativeScene(gameState, entry.content);
    finishStory();
    return true;
  }
  function cancelSkip() {
    if (entry.modal !== 'skip') return;
    entry.modal = null;
    gameState.narrativeScene.auto = entry.savedAuto;
    gameState.narrativeScene.pageStartedAtSec = performance.now() / 1000;
  }
  function handlePointer(point) {
    if (!isReady() || entry.pending || entry.modal || layoutState.getActiveLayoutId() !== 'storyMock') return false;
    if (entry.phase === 'map') {
      if (![entry.townHitZone, entry.startHitZone].some(rect => contains(point, rect))) return false;
      entry.phase = 'ladder'; return true;
    }
    if (entry.phase !== 'opening') return false;
    if (contains(point, gameState.narrativeScene?.hitZones?.skip)) return requestSkip();
    handleNarrativeScenePointer(gameState, entry.content, point);
    update(); return true;
  }
  async function navigate(label) {
    if (entry.pending || entry.modal || entry.phase === 'opening' || entry.phase === 'defeat') return false;
    const targets = { Hero: 'heroLayout', Vault: 'chestsLayout', AstralFlow: 'idleFarmLayout', Map: 'storyMock', Quests: 'storyMock' };
    const target = targets[label];
    if (!target) return false;
    if (target === 'storyMock') {
      entry.phase = label === 'Map' ? 'map' : 'ladder';
    }
    return go(target, 'quest-navigation');
  }
  return { enter() {}, update, handlePointer, startCard, requestSkip, confirmSkip, cancelSkip, navigate,
    allowedTransitions: () => entry.pending || (!entry.modal && entry.phase !== 'opening') ? ['combat', 'town', 'heroLayout', 'chestsLayout', 'idleFarmLayout', 'mapLayout'] : [],
    victory() { if (entry.phase === 'combat' && entry.activeCard !== null && !entry.pending) complete(); },
    defeat() {
      if (entry.phase !== 'combat' || entry.activeCard === null || entry.pending) return false;
      entry.phase = 'defeat';
      void go('storyMock', 'quest-defeat');
      return true;
    },
    async continueCombat() {
      if (entry.phase !== 'defeat' || entry.pending) return false;
      if (entry.progress.resources < 30) { entry.error = 'Not enough resources to continue.'; return false; }
      if (!await go('combat', 'quest-resurrection')) return false;
      resurrect();
      entry.progress.resources -= 30;
      entry.phase = 'combat';
      return true;
    },
    quit() { if (entry.phase !== 'defeat' || entry.pending) return; entry.phase = 'ladder'; entry.activeCard = null; entry.combatUnlocked = false; entry.error = null; },
    // Existing developer scenarios intentionally bypass presentation controls.
    skip() {
      if (!isReady() || entry.pending) return false;
      if (entry.phase === 'map') entry.phase = 'ladder';
      if (entry.phase === 'ladder' && !startCard(0)) return false;
      if (!requestSkip()) return false;
      return confirmSkip();
    },
  };
}
