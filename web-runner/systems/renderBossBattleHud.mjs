import { continuousCombatBossTimeRemaining, CONTINUOUS_COMBAT_BOSS_TIME_LIMIT_SEC } from '../src/core/continuousCombatStage.mjs';
import { computeCombatPower } from '../src/core/combatPower.mjs';
import { runtimeAssetUrl } from './runtimeAssetUrl.mjs';

export const bossHudIcon = name => runtimeAssetUrl(`assets/images/boss-hud/${name}.png`);

// Resolve the encounter's actual actor every frame, including temporary stat changes.
export function activeBossReadout(state, previous = null) {
  const stage = state?.globals?.ContinuousCombatStage;
  if (!stage?.bossActive) return null;
  // Simulation removes defeated actors before the battle's presentation finishes.
  const actor = state.entities?.find(actor => actor.kind === 'enemy' && actor.uid === stage.bossUID)
    || (previous?.stage === stage && previous.uid === stage.bossUID ? previous.actor : null);
  const remaining = continuousCombatBossTimeRemaining(stage, state.globals.time);
  if (!actor) return null;
  const stats = actor.stats || {};
  const format = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—';
  const rows = [
    ['HP', `${format(actor.hp)} / ${format(actor.maxHP)}`],
    ['ATK', format(stats.ATK)], ['MATK', format(stats.MAG)],
    ['DEF', format(stats.DEF)], ['RES', format(stats.RES)], ['SPD', format(stats.SPD)],
    ['Combat Power', format(computeCombatPower(actor))],
  ];
  return { stage, actor, uid: actor.uid, name: actor.name, rows, remaining,
    hpFraction: Math.max(0, Math.min(1, actor.hp / actor.maxHP)),
    timeFraction: Math.max(0, Math.min(1, remaining / CONTINUOUS_COMBAT_BOSS_TIME_LIMIT_SEC)) };
}

export function bossBattlePlacement(rect) {
  const scale = Math.min(rect.width / 360, rect.height / 640);
  return { left: rect.left + (rect.width - 248 * scale) / 2,
    top: rect.top + (rect.height - 640 * scale) / 2 + 86 * scale, scale };
}

let host, panel, inspect, heading, hp, timer, hpText, table, inspectedActor, lastReadout;
function dismiss() {
  inspectedActor = null;
  if (panel) panel.hidden = true;
  inspect?.setAttribute('aria-expanded', 'false');
}

function ensureHud() {
  if (host) return;
  const style = document.createElement('style');
  style.textContent = `
    #boss-battle-hud{position:fixed;z-index:9998;width:248px;height:66px;transform-origin:top left;color:#fff7e1;font:800 13px/1.2 system-ui,sans-serif;pointer-events:none}
    #boss-battle-hud[hidden],#boss-info-panel[hidden]{display:none}
    #boss-battle-hud .boss-heading{height:25px;display:flex;align-items:center;justify-content:center;padding:0 32px;text-align:center;text-shadow:0 2px 2px #21160e,1px 0 #21160e,-1px 0 #21160e}
    #boss-battle-hud .boss-heading strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px}
    #boss-battle-hud button{position:absolute;right:-5px;top:-7px;width:36px;height:36px;border:0;padding:3px;background:transparent;pointer-events:auto;cursor:pointer}
    #boss-battle-hud button img{width:100%;height:100%;object-fit:contain}
    #boss-battle-hud button:focus-visible{outline:2px solid #ffe29d;border-radius:50%}
    #boss-battle-hud .boss-meter{height:12px;position:relative;margin:5px 0 10px;border:2px solid #281c15;border-radius:7px;background:#181a16;box-shadow:0 0 0 1px #d1ba8e;box-sizing:border-box}
    #boss-battle-hud .boss-fill{height:100%;border-radius:4px;background:linear-gradient(#ff6f7c,#ed3455);max-width:100%}
    #boss-battle-hud .boss-timer .boss-fill{background:linear-gradient(#43efff,#00b6d6)}
    #boss-battle-hud .boss-meter>img{position:absolute;left:-19px;top:-10px;width:26px;height:26px;object-fit:contain;z-index:2}
    #boss-battle-hud .boss-meter span{position:absolute;inset:-3px 0;text-align:center;font-size:12px;line-height:14px;text-shadow:0 1px 2px #21160e,1px 0 #21160e,-1px 0 #21160e}
    #boss-info-panel{position:absolute;pointer-events:auto;top:77px;left:-1px;width:250px;box-sizing:border-box;padding:12px 13px;background:#3d2b21;border:3px solid #aa8960;border-radius:17px;box-shadow:0 0 0 2px #302218,inset 0 0 0 1px #6e5540,0 4px 10px #0007;outline:none}
    #boss-info-panel table{border-collapse:collapse;width:100%;font-size:13px;font-weight:700}
    #boss-info-panel th{text-align:left;color:#d9b88c;font-weight:700;padding:9px 0}
    #boss-info-panel td{text-align:right;color:#fff9ed;white-space:nowrap;padding:9px 0;font-variant-numeric:tabular-nums}
    #boss-info-panel tr:first-child{border-bottom:1px solid #72553b}
  `;
  document.head.append(style);
  host = document.createElement('section');
  host.id = 'boss-battle-hud';
  host.setAttribute('aria-label', 'Boss battle');
  host.innerHTML = `<div class="boss-heading"><strong></strong></div>
    <button type="button" aria-label="Inspect boss stats" aria-expanded="false" aria-controls="boss-info-panel"><img alt="" src="${bossHudIcon('inspect')}"></button>
    <div class="boss-meter boss-hp" role="progressbar" aria-label="Boss HP" aria-valuemin="0" aria-valuemax="100"><div class="boss-fill"></div><img alt="" src="${bossHudIcon('boss')}"><span></span></div>
    <div class="boss-meter boss-timer" role="progressbar" aria-label="Boss time remaining" aria-valuemin="0" aria-valuemax="30"><div class="boss-fill"></div><img alt="" src="${bossHudIcon('clock')}"></div>
    <section id="boss-info-panel" role="dialog" aria-label="Current boss stats" tabindex="-1" hidden><table aria-label="Boss stats"><tbody></tbody></table></section>`;
  [heading, inspect, hp, timer, panel] = [host.querySelector('strong'), host.querySelector('button'), host.querySelector('.boss-hp'), host.querySelector('.boss-timer'), host.querySelector('#boss-info-panel')];
  hpText = hp.querySelector('span');
  table = panel.querySelector('tbody');
  inspect.onclick = () => {
    if (inspectedActor) { dismiss(); return; }
    inspectedActor = host.currentActor;
    panel.hidden = false;
    inspect.setAttribute('aria-expanded', 'true');
    panel.focus({ preventScroll: true });
  };
  document.addEventListener('pointerdown', event => {
    if (inspectedActor && !panel.contains(event.target) && !inspect.contains(event.target)) {
      dismiss();
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && inspectedActor) { dismiss(); inspect.focus(); } });
  document.body.append(host);
}

export function updateBossBattleHud({ canvas, state, layoutId, phase, overlayOpen = false, suppress = false } = {}) {
  if (typeof document === 'undefined') return;
  const readout = activeBossReadout(state, lastReadout);
  lastReadout = readout;
  const otherDialog = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog[open],[aria-modal="true"]')].some(node => node.id !== 'boss-info-panel' && node.getClientRects().length > 0);
  if (!readout || layoutId !== 'combat' || phase !== 'combat' || overlayOpen || suppress || otherDialog) {
    dismiss();
    if (host) { host.hidden = true; host.currentActor = null; }
    return;
  }
  ensureHud();
  if (inspectedActor && inspectedActor !== readout.actor) dismiss();
  host.hidden = false;
  host.currentActor = readout.actor;
  host.dataset.bossUid = String(readout.uid);
  const placement = bossBattlePlacement(canvas.getBoundingClientRect());
  Object.assign(host.style, { left: `${placement.left}px`, top: `${placement.top}px`, transform: `scale(${placement.scale})` });
  if (heading.textContent !== readout.name) heading.textContent = readout.name;
  panel.setAttribute('aria-label', `${readout.name} stats`);
  hp.querySelector('.boss-fill').style.width = `${readout.hpFraction * 100}%`;
  timer.querySelector('.boss-fill').style.width = `${readout.timeFraction * 100}%`;
  hp.setAttribute('aria-valuenow', String(readout.hpFraction * 100));
  timer.setAttribute('aria-valuenow', String(readout.remaining));
  const percent = `${Math.ceil(readout.hpFraction * 100)}%`;
  if (hpText.textContent !== percent) hpText.textContent = percent;
  readout.rows.forEach(([label, value], index) => {
    const row = table.rows[index] || table.insertRow();
    if (!row.cells.length) { const th = document.createElement('th'); th.scope = 'row'; row.append(th); row.insertCell(); }
    if (row.cells[0].textContent !== label) row.cells[0].textContent = label;
    if (row.cells[1].textContent !== value) row.cells[1].textContent = value;
  });
}
