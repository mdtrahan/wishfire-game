function positiveInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function heroId(hero, index) {
  const value = hero?.heroInstanceKey ?? hero?.id ?? hero?.uid;
  return value == null || value === '' ? `hero:${index}` : String(value);
}

function partyOrder(hero, index) {
  const slot = Number(hero?.heroDisplaySlot ?? hero?.displaySlot ?? hero?.heroIndex);
  return Number.isInteger(slot) && slot >= 0 ? slot : index;
}

export function createSessionLevelUpQueue({ heroes = [], progressionResults = [] } = {}) {
  const entries = [];
  const orderedHeroes = (Array.isArray(heroes) ? heroes : [])
    .map((hero, index) => ({ hero, index }))
    .sort((left, right) => partyOrder(left.hero, left.index) - partyOrder(right.hero, right.index) || left.index - right.index);
  const results = Array.isArray(progressionResults) ? progressionResults : [];
  for (const { hero, index } of orderedHeroes) {
    const result = results[index] || {};
    const fromLevel = positiveInteger(result.fromLevel, 1);
    const toLevel = Math.max(fromLevel, positiveInteger(result.toLevel, fromLevel));
    for (let level = fromLevel + 1; level <= toLevel; level += 1) {
      entries.push({
        heroId: heroId(hero, index),
        heroUID: positiveInteger(hero?.uid),
        earnedLevel: level,
        earnedLevelIndex: level - fromLevel,
      });
    }
  }
  return { version: 1, status: entries.length ? 'active' : 'complete', paused: false, currentIndex: 0, entries };
}

export function currentSessionLevelUpEntry(queue = {}) {
  const entries = Array.isArray(queue.entries) ? queue.entries : [];
  const index = Math.max(0, Math.floor(Number(queue.currentIndex) || 0));
  return queue.status === 'active' && !queue.paused ? entries[index] || null : null;
}

export function pauseSessionLevelUpQueue(queue = {}) {
  if (queue.status !== 'active') return { ...queue, paused: false };
  return { ...queue, paused: true };
}

export function resumeSessionLevelUpQueue(queue = {}) {
  if (queue.status !== 'active') return { ...queue, paused: false };
  return { ...queue, paused: false };
}

export function acknowledgeSessionLevelUpEntry(queue = {}) {
  if (queue.status !== 'active' || queue.paused) return queue;
  const entries = Array.isArray(queue.entries) ? queue.entries : [];
  const nextIndex = Math.max(0, Math.floor(Number(queue.currentIndex) || 0)) + 1;
  return {
    ...queue,
    currentIndex: nextIndex,
    status: nextIndex >= entries.length ? 'complete' : 'active',
  };
}

export function clearSessionLevelUpQueue() {
  return { version: 1, status: 'complete', paused: false, currentIndex: 0, entries: [] };
}
