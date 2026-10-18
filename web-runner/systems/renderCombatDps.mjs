import { combatDpsSnapshot } from '../src/core/combatDps.mjs';
import { computeCombatPower } from '../src/core/combatPower.mjs';
import { heroDefinition, heroKey } from '../src/core/heroDefinitions.mjs';

let overlay;
let table;
export function formatDps(value) {
  const number = Number.isFinite(value) ? Math.max(0, value) : 0;
  return number >= 1_000_000 ? number.toExponential(1) : number.toFixed(1);
}

// Same 360x640 reference frame as the Canvas HUD; sit below its progress rail.
export function combatDpsPlacement(rect, safeBottom = Infinity, height = 96) {
  const scale = Math.min(rect.width / 360, rect.height / 640);
  const left = rect.left + (rect.width - 360 * scale) / 2;
  const top = rect.top + (rect.height - 640 * scale) / 2;
  return { left: left + (360 - 276) * scale, top: Math.max(top + 6 * scale, Math.min(top + 96 * scale, safeBottom - (height + 6) * scale)), scale };
}

export function combatDpsReadout(state) {
  const roster = state.entities.filter(actor => actor.kind === 'hero').map(actor => ({ uid: actor.uid, name: heroDefinition(actor)?.name || actor.name, cp: computeCombatPower(state.globals.HeroProgress?.heroes?.[actor.heroInstanceKey || heroKey(actor)] || actor) }));
  const snapshot = combatDpsSnapshot(state.globals, roster);
  const leader = snapshot.heroes.reduce((best, hero) => hero.total > (best?.total || 0) ? hero : best, null);
  return { party: { ...snapshot.party, cp: roster.reduce((sum, hero) => sum + hero.cp, 0) }, heroes: snapshot.heroes.map((hero, index) => ({ ...hero, cp: roster[index].cp, leading: hero.uid === leader?.uid })) };
}

export function updateCombatDpsOverlay({ canvas, state, layoutId, phase, overlayOpen = false } = {}) {
  if (typeof document === 'undefined') return;
  const modalVisible = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog[open],[aria-modal="true"]')].some(node => node.getClientRects().length > 0);
  const visible = state?.globals?.ShowCombatDpsOverlay === true && Number(state.globals.ContinuousCombatStageLoop) === 1 && layoutId === 'combat' && phase === 'combat' && !overlayOpen && !modalVisible;
  if (!visible) { if (overlay) overlay.hidden = true; return; }
  if (!overlay) {
    overlay = document.createElement('aside');
    overlay.id = 'combat-dps-overlay';
    overlay.className = 'combat-dps-overlay';
    overlay.setAttribute('aria-label', 'Live combat DPS');
    const title = document.createElement('h2');
    title.textContent = 'Combat DPS';
    table = document.createElement('table');
    table.setAttribute('aria-label', 'Damage by hero');
    overlay.append(title, table);
    document.body.append(overlay);
  }
  const snapshot = combatDpsReadout(state);
  const values = [['Hero', 'CP', '5s DPS', 'Hits', 'Damage'], ...[...snapshot.heroes, { name: 'Party', ...snapshot.party }].map(row => [row.name, formatDps(row.cp), formatDps(row.rollingDps), formatDps(row.hits).replace(/\.0$/, ''), formatDps(row.total)])];
  while (table.rows.length > values.length) table.deleteRow(-1);
  values.forEach((cells, rowIndex) => {
    const row = table.rows[rowIndex] || table.insertRow();
    row.dataset.kind = rowIndex === 0 ? 'header' : rowIndex === values.length - 1 ? 'party' : snapshot.heroes[rowIndex - 1].leading ? 'leader' : 'hero';
    cells.forEach((value, cellIndex) => {
      let cell = row.cells[cellIndex];
      if (!cell) { cell = document.createElement(rowIndex === 0 ? 'th' : 'td'); row.append(cell); }
      if (cell.textContent !== value) cell.textContent = value;
    });
  });
  overlay.hidden = false;
  const rect = canvas.getBoundingClientRect();
  const conveyor = document.getElementById('wishfire-lamp');
  const safeBottom = conveyor?.getClientRects().length ? conveyor.getBoundingClientRect().top : Infinity;
  const placement = combatDpsPlacement(rect, safeBottom, overlay.offsetHeight);
  overlay.style.left = `${placement.left}px`;
  overlay.style.top = `${placement.top}px`;
  overlay.style.transform = `scale(${placement.scale})`;
}
