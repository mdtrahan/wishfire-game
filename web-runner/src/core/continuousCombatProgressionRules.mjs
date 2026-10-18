export function continuousCombatStagesForRegion() {
  return 1;
}

export function continuousCombatWavesForStage(region) {
  const chapter = Math.max(1, Math.floor(Number(region) || 1));
  if (chapter % 5 === 0) return 5;
  return chapter === 1 ? 10 : chapter === 2 ? 15 : 20;
}
