import { HERO_DEFINITIONS, heroDefinition, heroSkillUnlocked } from '../src/core/heroDefinitions.mjs';
import { heroArtPath } from '../state/heroArtAssets.mjs';
import { runtimeAssetUrl } from './runtimeAssetUrl.mjs';
import { activeCombatEffect } from '../../src/core/combatModifierRules.mjs';
import { BUFF_SIGNAL_FRAMES, BUFF_SIGNAL_SHEET, projectBuffSignals } from '../../src/core/buffSignalRules.mjs';
import { heroPassiveSignals } from '../src/core/realtimeHeroPassives.mjs';
import { partySkillFor } from '../src/core/partySkillCatalog.mjs';

// questTop keeps the mini-quest's whole box above the party buff row (row top = top - 14).
export const HERO_COOLDOWN_LAYOUT = Object.freeze({ slots: 8, width: 344, height: 41.28, top: 441.6, questTop: 370 });

// Read-only projection of active-skill clocks. Readiness does not imply a valid cast condition.
export function heroCooldownSlots(entities = [], globals = {}) {
  const actors = entities.filter(actor => actor?.kind === 'hero');
  const now = Number(globals.time || 0);
  const heroes = Object.values(HERO_DEFINITIONS).flatMap(definition => {
    const actor = actors.find(candidate => heroDefinition(candidate) === definition);
    if (!actor) return [];
    const skills = definition.actives.filter(skill => heroSkillUnlocked(actor, skill));
    const clock = globals.RealtimeHeroBasicClocks?.[String(actor.uid)]?.skillReadyAt || {};
    const next = skills.map(skill => ({ skill, remaining: Math.max(0, Number(clock[skill.skillId] ?? now) - now) }))
      .sort((a, b) => a.remaining - b.remaining)[0];
    const status = Number(actor.hp) <= 0 ? 'ko' : !next ? 'locked' : next.remaining > 0 ? 'cooldown' : 'ready';
    return [{ uid: actor.uid, heroKey: definition.key, name: definition.name, path: heroArtPath(actor), status,
      remaining: next?.remaining || 0,
      fraction: status === 'cooldown' ? Math.min(1, next.remaining / next.skill.cooldownSeconds) : 0 }];
  });
  return Array.from({ length: HERO_COOLDOWN_LAYOUT.slots }, (_, index) => heroes[index] || null);
}

const BUFF_SHEET_PATH = 'images/ui/buff-signals.png';
const BUFF_PARTY_ICON = 12, BUFF_PARTY_GAP = 2;
const up = channel => ({ channel, direction: 'up' });

// Read-only translation of live combat buffs into signal input; the projection owns the rules.
export function heroBuffSignalInput(entities = [], globals = {}) {
  const now = Number(globals.time || 0);
  return heroCooldownSlots(entities, globals).filter(Boolean).map(slot => {
    const actor = entities.find(candidate => candidate?.kind === 'hero' && candidate.uid === slot.uid);
    const uid = Number(slot.uid), buffs = [];
    for (const [id, record] of Object.entries(globals.RealtimeSkillEffects?.[String(uid)] || {})) {
      if (!activeCombatEffect(record, now)) continue;
      const modifiers = [...(record.modifiers || [])];
      if (Number(record.damageCutPct) > 0) modifiers.push(up('damageReduction'));
      buffs.push({ key: `${record.sourceUID}:${id}`, modifiers, ref: { effectId: id, set: record.data?.set } });
    }
    if (Number(globals.HeroWardHPByUID?.[uid] || 0) > 0) buffs.push({ key: `${globals.HeroWardSourceUID}:ward`, modifiers: [up('ward')], ref: { effectId: 'ward' } });
    buffs.push(...heroPassiveSignals(actor));
    for (const stat of ['ATK', 'DEF', 'MAG', 'RES', 'SPD']) if (Number(globals[`PartyBuff_${stat}`] || 0) > 0) buffs.push({ key: `board:${stat}`, modifiers: [up(stat)] });
    for (const status of actor?.statuses || []) {
      const stat = /^(atk|def|mag|res|spd)Up$/.exec(status?.statusEffect || '')?.[1];
      if (stat && Number(status.duration) > 0) buffs.push({ key: `status:${status.statusEffect}`, modifiers: [up(stat.toUpperCase())] });
    }
    return { uid, alive: slot.status !== 'ko', buffs };
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
      .hero-cooldown{position:relative;box-sizing:border-box;pointer-events:auto;cursor:pointer;width:100%;aspect-ratio:1;overflow:hidden;border:1px solid #c4a775;border-radius:3px;background:radial-gradient(#667277,#253039);box-shadow:inset 0 0 0 1px #151618,0 1px 3px #0008}
      .hero-cooldown img{position:absolute;width:235%;height:auto;max-width:none;left:-67.5%;top:-22%}
      .hero-cooldown::after{content:'';position:absolute;inset:0;background:conic-gradient(from 0deg,#0a10178f 0deg var(--cooldown,0deg),transparent var(--cooldown,0deg) 360deg)}
      .hero-cooldown[data-state=empty]{pointer-events:none;cursor:default;border-color:#a58d66;background:linear-gradient(#34332d9c,#252722b5);box-shadow:inset 0 0 0 1px #17191955}
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
        slot.replaceChildren(image, slot.badges); slot.dataset.uid = String(hero.uid); slot.dataset.heroKey = hero.heroKey;
      } else if (!hero && slot.dataset.uid) { slot.replaceChildren(); delete slot.dataset.uid; delete slot.dataset.heroKey; }
      syncBuffIcons(slot.badges, (hero ? signals.heroes[String(hero.uid)] || [] : []).map(group => `hero-${group}`));
      const label = !hero ? `Empty hero slot ${index + 1}` : `${hero.name}: ${hero.status === 'cooldown' ? `special ready in ${Math.ceil(hero.remaining)} seconds` : hero.status === 'ready' ? 'special ready; casting waits for conditions and target' : hero.status === 'ko' ? 'KO' : 'special locked'}. Open hero skills`;
      slot.setAttribute('aria-label', label);
    });
  } };
}
