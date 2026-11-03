import { elevateSourceForActor } from './rustCombatEffects.mjs';
import { heroDefinition } from '../src/core/heroDefinitions.mjs';
import { heroArtPath } from '../state/heroArtAssets.mjs';
import { runtimeAssetUrl } from './runtimeAssetUrl.mjs';
import { BUFF_SIGNAL_FRAMES, BUFF_SIGNAL_SHEET, projectBuffSignals } from '../../src/core/buffSignalRules.mjs';
import { partySkillFor } from '../src/core/partySkillCatalog.mjs';

// questTop keeps the mini-quest's whole box above the party buff row (row top = top - 14).
export const HERO_COOLDOWN_LAYOUT = Object.freeze({ slots: 8, width: 344, height: 41.28, top: 487.6, questTop: 416 });

// Party order and meters come directly from the Rust projection.
export function heroCooldownSlots(entities = [], globals = {}) {
  const actors = entities.filter(actor => actor?.kind === 'hero' && heroDefinition(actor));
  const views = globals.RustCombatPresentation?.state.snapshot?.actors || [];
  const heroes = actors.map(actor => {
    const view = views.find(view => view.team === 'hero' && view.host_id === String(actor.heroInstanceKey));
    const definition = heroDefinition(actor);
    const fraction = Math.max(0, Math.min(1, Number(view?.meter || 0)));
    return { uid: actor.uid, heroKey: definition.key, name: definition.name, path: heroArtPath(actor),
      status: view?.downed || Number(actor.hp) <= 0 ? 'ko' : fraction >= 1 ? 'ready' : 'cooldown',
      remaining: 0, fraction: 1 - fraction };
  });
  return Array.from({ length: HERO_COOLDOWN_LAYOUT.slots }, (_, index) => heroes[index] || null);
}

const BUFF_SHEET_PATH = 'images/ui/buff-signals.png';
const BUFF_PARTY_ICON = 12, BUFF_PARTY_GAP = 2;
const up = channel => ({ channel, direction: 'up' });

// Read-only translation of live combat buffs into signal input; the projection owns the rules.
export function heroBuffSignalInput(entities = [], globals = {}) {
  const snapshot = globals.RustCombatPresentation?.state.snapshot;
  const views = snapshot?.actors || [];
  return heroCooldownSlots(entities, globals).filter(Boolean).map(slot => {
    const actor = entities.find(actor => actor.uid === slot.uid);
    const view = views.find(view => view.actor_id === actor.rustActorId);
    const buffs = [];
    if (Number(view?.ward || 0) > 0 || Number(view?.warcry_shield || 0) > 0) buffs.push({ key: 'ward', ref: { effectId: 'ward' }, modifiers: [up('ward')] });
    const elevate = view && elevateSourceForActor(view, snapshot);
    if (elevate) buffs.push({ key: `elevate:${elevate.actor_id}:${view.actor_id}`, ref: { effectId: 'elevate', set: 'power' }, modifiers: [up('ATK')] });
    return { uid: slot.uid, alive: slot.status !== 'ko', buffs };
  });
}

function buffIcon(id, tag = 'span') {
  const icon = document.createElement(tag); icon.className = 'hero-buff'; icon.dataset.icon = id;
  const { column, row } = BUFF_SIGNAL_FRAMES[id];
  icon.style.backgroundPosition = `${column / (BUFF_SIGNAL_SHEET.columns - 1) * 100}% ${row / (BUFF_SIGNAL_SHEET.rows - 1) * 100}%`;
  return icon;
}

// Rebuild only when the ordered icon list changes so steady frames touch no DOM.
function syncBuffIcons(container, ids, make = id => buffIcon(id)) {
  if (container.dataset.icons === ids.join(',')) return false;
  container.dataset.icons = ids.join(',');
  container.replaceChildren(...ids.map(make));
  return true;
}

// Clicks stay on the strip: a hero clock opens that hero's Special, a party icon its Party Skills entry.
export function createHeroCooldownStrip({ onHero = () => {}, onPartySkill = () => {} } = {}) {
  if (!document.getElementById('hero-cooldown-style')) {
    const style = document.createElement('style'); style.id = 'hero-cooldown-style';
    style.textContent = `
      .hero-cooldowns{position:absolute;left:0;width:344px;height:41.28px;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;align-items:center;pointer-events:none}
      .hero-cooldown{position:relative;box-sizing:border-box;pointer-events:auto;cursor:pointer;width:40px;height:40px;justify-self:center}
      .hero-cooldown-face{position:absolute;inset:.25px;box-sizing:border-box;overflow:hidden;border:1px solid #c4a775;border-radius:3px;background:radial-gradient(#667277,#253039);box-shadow:inset 0 0 0 1px #151618,0 1px 3px #0008}
      .hero-cooldown img{position:absolute;width:235%;height:auto;max-width:none;left:-67.5%;top:-22%}
      .hero-cooldown-face::after{content:'';position:absolute;inset:0;background:#1010108f;backdrop-filter:grayscale(1);mask-image:conic-gradient(from 0deg,transparent 0deg calc(360deg - var(--cooldown,0deg)),#000 calc(360deg - var(--cooldown,0deg)) 360deg)}
      .hero-cooldown[data-state=empty]{pointer-events:none;cursor:default}
      .hero-cooldown[data-state=empty] .hero-cooldown-face{border-color:#a58d66;background:linear-gradient(#34332d9c,#252722b5);box-shadow:inset 0 0 0 1px #17191955}
      .hero-cooldown[data-state=ko] img,.hero-cooldown[data-state=locked] img{filter:grayscale(1);opacity:.45}
      .hero-buff{display:block;flex:none;background:url('${runtimeAssetUrl(BUFF_SHEET_PATH)}') no-repeat;background-size:${BUFF_SIGNAL_SHEET.columns * 100}% ${BUFF_SIGNAL_SHEET.rows * 100}%;image-rendering:auto}
      .hero-buff-party{position:absolute;left:0;width:344px;height:${BUFF_PARTY_ICON}px;display:flex;justify-content:center;gap:${BUFF_PARTY_GAP}px;pointer-events:none}
      .hero-buff-party .hero-buff{box-sizing:border-box;width:${BUFF_PARTY_ICON}px;height:${BUFF_PARTY_ICON}px;padding:0;border:0;border-radius:2px;pointer-events:auto;cursor:pointer;touch-action:manipulation}
      .hero-buff-party .hero-buff:focus-visible{outline:1px solid #ffd971;outline-offset:1px}
      .hero-buffs{position:absolute;z-index:1;left:4%;right:4%;bottom:3%;display:flex;gap:2%}
      .hero-buffs .hero-buff{width:30%;aspect-ratio:1}
    `;
    document.head.append(style);
  }
  const element = document.createElement('div'); element.className = 'hero-cooldowns';
  element.setAttribute('role', 'group'); element.setAttribute('aria-label', 'Party skill cooldowns');
  const party = document.createElement('div'); party.className = 'hero-buff-party'; party.setAttribute('role', 'group'); party.setAttribute('aria-label', 'Party buffs');
  const stop = event => event.stopPropagation();
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) { party.addEventListener(type, stop); element.addEventListener(type, stop); }
  let signals = {};
  const partyButton = id => {
    const button = buffIcon(id, 'button'); button.type = 'button';
    const entry = partySkillFor(signals.partyRefs?.[id]);
    button.setAttribute('aria-label', entry ? `${entry.name} details` : 'Party buff details');
    button.addEventListener('click', event => { event.stopPropagation(); onPartySkill(entry?.id || null, signals.partyRefs?.[id] || null); });
    return button;
  };
  const slots = Array.from({ length: HERO_COOLDOWN_LAYOUT.slots }, () => {
    const slot = document.createElement('div'); slot.className = 'hero-cooldown'; slot.setAttribute('role', 'button'); slot.tabIndex = -1;
    slot.face = document.createElement('div'); slot.face.className = 'hero-cooldown-face'; slot.append(slot.face);
    slot.badges = document.createElement('div'); slot.badges.className = 'hero-buffs'; slot.badges.setAttribute('aria-hidden', 'true');
    slot.addEventListener('click', event => { event.stopPropagation(); if (slot.dataset.heroKey) onHero(slot.dataset.heroKey); });
    element.append(slot); return slot;
  });
  return { element, partyElement: party, update(entities, globals, hostOffset) {
    element.style.top = `${HERO_COOLDOWN_LAYOUT.top - hostOffset}px`;
    party.style.top = `${HERO_COOLDOWN_LAYOUT.top - BUFF_PARTY_ICON - BUFF_PARTY_GAP - hostOffset}px`;
    signals = projectBuffSignals(heroBuffSignalInput(entities, globals), signals);
    // Refs can change without the icon list changing (for example a new Elevate roll), so key on both.
    syncBuffIcons(party, signals.party.map(id => `${id}|${JSON.stringify(signals.partyRefs[id] || null)}`), key => partyButton(key.split('|')[0]));
    heroCooldownSlots(entities, globals).forEach((hero, index) => {
      const slot = slots[index];
      slot.dataset.state = hero?.status || 'empty';
      slot.style.setProperty('--cooldown', `${(hero?.fraction || 0) * 360}deg`);
      if (hero && slot.dataset.uid !== String(hero.uid)) {
        const image = document.createElement('img'); image.alt = ''; image.draggable = false;
        // Retry transient failures so a dropped request never leaves a blank clock.
        let attempts = 0; image.addEventListener('error', () => { if (++attempts < 3) setTimeout(() => { image.src = runtimeAssetUrl(hero.path) + `${runtimeAssetUrl(hero.path).includes('?') ? '&' : '?'}retry=${attempts}`; }, 400 * attempts); });
        image.src = runtimeAssetUrl(hero.path);
        slot.face.replaceChildren(image, slot.badges); slot.dataset.uid = String(hero.uid); slot.dataset.heroKey = hero.heroKey;
      } else if (!hero && slot.dataset.uid) { slot.face.replaceChildren(); delete slot.dataset.uid; delete slot.dataset.heroKey; }
      syncBuffIcons(slot.badges, (hero ? signals.heroes[String(hero.uid)] || [] : []).map(group => `hero-${group}`));
      const label = !hero ? `Empty hero slot ${index + 1}` : `${hero.name}: ${hero.status === 'cooldown' ? `special meter ${Math.round((1 - hero.fraction) * 100)} percent` : hero.status === 'ready' ? 'special ready; casting waits for conditions and target' : hero.status === 'ko' ? 'KO' : 'special locked'}. Open hero skills`;
      slot.setAttribute('aria-label', label);
    });
  } };
}
