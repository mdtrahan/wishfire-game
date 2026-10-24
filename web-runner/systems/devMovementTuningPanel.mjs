// Dev-panel sliders for leader-anchored movement and camera (bd-ORKA-6i3).
// Changes apply live to state.globals.DevMovementTuning and persist in a
// dev-only localStorage key; they never enter save data.
import {
  COMBAT_LEADER_NAMES,
  COMBAT_MOVEMENT_TUNING_FIELDS,
  COMBAT_MOVEMENT_TUNING_STORAGE_KEY,
  defaultCombatMovementTuning,
  sanitizeCombatMovementTuning,
} from '../src/core/combatMovementTuning.mjs';

export function loadCombatMovementTuning(storage) {
  try {
    const raw = storage?.getItem(COMBAT_MOVEMENT_TUNING_STORAGE_KEY);
    return raw ? sanitizeCombatMovementTuning(JSON.parse(raw)) : null;
  } catch { return null; }
}

function persist(storage, tuning) {
  try { storage?.setItem(COMBAT_MOVEMENT_TUNING_STORAGE_KEY, JSON.stringify(tuning)); } catch { /* dev-only convenience */ }
}

const formatValue = (field, value) => (field.step >= 1 ? String(Math.round(value)) : Number(value).toFixed(2));

export function mountCombatMovementTuningPanel({ container, state, storage = null } = {}) {
  if (!container || typeof document === 'undefined') return null;
  const fieldset = document.createElement('fieldset');
  fieldset.dataset.devtoolMovementTuning = '';
  fieldset.style.cssText = 'grid-column:1/-1;border:1px solid #94a3b8;border-radius:8px;padding:8px;min-width:0;display:flex;flex-direction:column;gap:6px;';
  const legend = document.createElement('legend');
  legend.textContent = 'Movement & camera lab (live)';
  fieldset.appendChild(legend);

  const leaderLabel = document.createElement('label');
  leaderLabel.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
  leaderLabel.textContent = 'Leader';
  const leaderSelect = document.createElement('select');
  leaderSelect.dataset.devtoolMovementLeader = '';
  for (const name of COMBAT_LEADER_NAMES) leaderSelect.add(new Option(name, name));
  leaderLabel.appendChild(leaderSelect);
  // Off by default so the player's Formation leader applies; the select only matters when ticked.
  const overrideLabel = document.createElement('label');
  overrideLabel.style.cssText = 'display:flex;align-items:center;gap:6px;';
  const overrideToggle = document.createElement('input');
  overrideToggle.type = 'checkbox';
  overrideToggle.dataset.devtoolMovementLeaderOverride = '';
  overrideLabel.append(overrideToggle, 'Override Formation leader');
  fieldset.append(overrideLabel, leaderLabel);

  const inputs = new Map();
  for (const field of COMBAT_MOVEMENT_TUNING_FIELDS) {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
    const caption = document.createElement('span');
    const readout = document.createElement('b');
    caption.textContent = `${field.label}${field.confidence === 'loose' ? ' · loose' : ''}: `;
    caption.appendChild(readout);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    input.dataset.devtoolMovementKey = field.key;
    label.append(caption, input);
    fieldset.appendChild(label);
    inputs.set(field.key, { field, input, readout });
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.dataset.devtoolMovementReset = '';
  reset.textContent = 'Reset movement defaults';
  reset.style.cssText = 'align-self:flex-start;border:1px solid #475569;background:#fff;padding:6px 10px;border-radius:8px;font-weight:700;cursor:pointer;';
  fieldset.appendChild(reset);

  const sync = tuning => {
    overrideToggle.checked = tuning.leaderOverride;
    leaderSelect.value = tuning.leaderName;
    leaderSelect.disabled = !tuning.leaderOverride;
    for (const { field, input, readout } of inputs.values()) {
      input.value = String(tuning[field.key]);
      readout.textContent = formatValue(field, tuning[field.key]);
    }
  };
  const apply = tuning => {
    const next = sanitizeCombatMovementTuning(tuning);
    state.globals.DevMovementTuning = next;
    persist(storage, next);
    sync(next);
  };
  const readDom = () => ({
    leaderName: leaderSelect.value,
    leaderOverride: overrideToggle.checked,
    ...Object.fromEntries([...inputs].map(([key, { input }]) => [key, Number(input.value)])),
  });
  leaderSelect.addEventListener('change', () => apply(readDom()));
  overrideToggle.addEventListener('change', () => apply(readDom()));
  for (const { input } of inputs.values()) input.addEventListener('input', () => apply(readDom()));
  reset.addEventListener('click', () => apply(defaultCombatMovementTuning()));
  sync(sanitizeCombatMovementTuning(state.globals.DevMovementTuning));
  container.prepend(fieldset);
  return { fieldset, sync };
}
