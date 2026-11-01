// WFM-owned authoring format: stages -> waves -> subwaves -> {key, count}.
// Resolve from the seeded stage plans so existing compositions, CP extras and
// checkpoint exclusions stay exact. Each list can be edited independently.
export const SUBWAVE_MAX_SECONDS = 10;
export const SUBWAVE_REMAINING = 1;
export function authorSubwaves(keys) {
  const count = Math.max(1, Math.floor((keys.length + 1) / 4));
  const size = Math.floor(keys.length / count), extra = keys.length % count;
  let offset = 0;
  return Array.from({ length: count }, (_, i) => {
    const entries = new Map();
    for (const key of keys.slice(offset, offset += size + (i < extra ? 1 : 0))) entries.set(key, (entries.get(key) || 0) + 1);
    return [...entries].map(([key, count]) => ({ key, count }));
  }).filter(subwave => subwave.length);
}
export function authorSubwaveStages(stages) {
  return stages.map(stage => ({ ...stage, waves: stage.waves.map(wave => ({ subwaves: authorSubwaves(wave) })) }));
}
export function bindAuthoredSubwaves(subwaves, actors) {
  const remaining = [...actors];
  const groups = subwaves.map(subwave => subwave.flatMap(({ key, count }) => {
    if (!Number.isInteger(count) || count < 1) throw new Error('Invalid subwave count');
    return Array.from({ length: count }, () => {
      const index = remaining.findIndex(actor => actor.name === key);
      if (index < 0) throw new Error(`Subwave enemy missing: ${key}`);
      return remaining.splice(index, 1)[0];
    });
  }));
  if (remaining.length) throw new Error('Subwave authoring omitted enemies');
  return groups;
}
export function subwaveReady(previous, livingHostIds, elapsed) {
  return previous.filter(actor => livingHostIds.has(String(actor.uid))).length <= SUBWAVE_REMAINING
    || elapsed + 1e-6 >= SUBWAVE_MAX_SECONDS;
}
