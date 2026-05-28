export const uiState = {
  overlayVisible: false,
  heroScreenMode: 'details',
  heroScreenSelectedPartySlot: 0,
  heroScreenHitZones: null,
  heroScreenSelectedSkillIndex: 0,
  heroScreenSkillModalOpen: false,
  heroScreenSkillModalSkillIndex: 0,
};

export function getUIState() {
  return uiState;
}

export function setUIStateField(key, value) {
  uiState[key] = value;
}

export function setUIFields(patch) {
  Object.assign(uiState, patch);
}
