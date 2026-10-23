import { HERO_DEFINITIONS, heroDefinition, heroSkillUnlocked } from '../src/core/heroDefinitions.mjs';
import { heroArtPath } from '../state/heroArtAssets.mjs';
import { runtimeAssetUrl } from './runtimeAssetUrl.mjs';
import { activeCombatEffect } from '../../src/core/combatModifierRules.mjs';
import { BUFF_SIGNAL_FRAMES, BUFF_SIGNAL_SHEET, projectBuffSignals } from '../../src/core/buffSignalRules.mjs';

export const HERO_COOLDOWN_LAYOUT = Object.freeze({ slots: 8, width: 344, height: 41.28, top: 441.6, questTop: 389.6 });

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
    return [{ uid: actor.uid, name: definition.name, path: heroArtPath(actor), status,
      remaining: next?.remaining || 0,
      fraction: status === 'cooldown' ? Math.min(1, next.remaining / next.skill.cooldownSeconds) : 0 }];
  });
  return Array.from({ length: HERO_COOLDOWN_LAYOUT.slots }, (_, index) => heroes[index] || null);
}

const BUFF_SHEET_PATH = 'images/ui/buff-signals.png';
const BUFF_PARTY_ICON = 12, BUFF_PARTY_GAP = 2;
const RATE_EFFECTS = new Set(['shared_tempo', 'quickload']);
const up = channel => ({ channel, direction: 'up' });

// Read-only translation of live combat buffs into signal input; the projection owns the rules.
export function heroBuffSignalInput(entities = [], globals = {}) {
  const now = Number(globals.time || 0), battle = globals.RealtimeSkillBattleState || {};
  const wardUIDs = Number(globals.PartyTempHPShield || 0) > 0 ? (globals.PartyTempHPShieldTargetUIDs || []).map(Number) : [];
  return heroCooldownSlots(entities, globals).filter(Boolean).map(slot => {
    const actor = entities.find(candidate => candidate?.kind === 'hero' && candidate.uid === slot.uid);
    const uid = Number(slot.uid), buffs = [];
    for (const [id, record] of Object.entries(globals.RealtimeSkillEffects?.[String(uid)] || {})) {
      if (!activeCombatEffect(record, now)) continue;
      const modifiers = [...(record.modifiers || [])];
      if (RATE_EFFECTS.has(id)) modifiers.push(up('basicRate'));
      if (Number(record.damageCutPct) > 0) modifiers.push(up('damageReduction'));
      buffs.push({ key: `${record.sourceUID}:${id}`, modifiers });
    }
    if (wardUIDs.includes(uid)) buffs.push({ key: `${globals.PartyTempHPShieldSourceUID}:ward`, modifiers: [up('ward')] });
    for (const stat of ['ATK', 'DEF', 'MAG', 'RES', 'SPD']) if (Number(globals[`PartyBuff_${stat}`] || 0) > 0) buffs.push({ key: `board:${stat}`, modifiers: [up(stat)] });
    if (battle.fruitUIDs?.includes(uid)) buffs.push({ key: 'fruit', modifiers: [up('HP')] });
    if (Number(battle.growTiersByUID?.[String(uid)] || 0) > 0) buffs.push({ key: 'grow', modifiers: [up('damageAmp')] });
    for (const status of actor?.statuses || []) {
      const stat = /^(atk|def|mag|res|spd)Up$/.exec(status?.statusEffect || '')?.[1];
      if (stat && Number(status.duration) > 0) buffs.push({ key: `status:${status.statusEffect}`, modifiers: [up(stat.toUpperCase())] });
    }
    return { uid, alive: slot.status !== 'ko', buffs };
  });
}

function buffIcon(id) {
  const icon = document.createElement('span'); icon.className = 'hero-buff'; icon.dataset.icon = id;
  const { column, row } = BUFF_SIGNAL_FRAMES[id];
  icon.style.backgroundPosition = `${column / (BUFF_SIGNAL_SHEET.columns - 1) * 100}% ${row / (BUFF_SIGNAL_SHEET.rows - 1) * 100}%`;
  return icon;
}

// Rebuild only when the ordered icon list changes so steady frames touch no DOM.
function syncBuffIcons(container, ids) {
  if (container.dataset.icons === ids.join(',')) return;
  container.dataset.icons = ids.join(',');
  container.replaceChildren(...ids.map(buffIcon));
}

export function createHeroCooldownStrip() {
  if (!document.getElementById('hero-cooldown-style')) {
    const style = document.createElement('style'); style.id = 'hero-cooldown-style';
    style.textContent = `
      .hero-cooldowns{position:absolute;left:0;width:344px;height:41.28px;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;align-items:center;pointer-events:none}
      .hero-cooldown{position:relative;box-sizing:border-box;width:100%;aspect-ratio:1;overflow:hidden;border:1px solid #c4a775;border-radius:3px;background:radial-gradient(#667277,#253039);box-shadow:inset 0 0 0 1px #151618,0 1px 3px #0008}
      .hero-cooldown img{position:absolute;width:235%;height:auto;max-width:none;left:-67.5%;top:-22%}
      .hero-cooldown::after{content:'';position:absolute;inset:0;background:conic-gradient(from 0deg,#0a10178f 0deg var(--cooldown,0deg),transparent var(--cooldown,0deg) 360deg)}
      .hero-cooldown[data-state=empty]{border-color:#a58d66;background:linear-gradient(#34332d9c,#252722b5);box-shadow:inset 0 0 0 1px #17191955}
      .hero-cooldown[data-state=ko] img,.hero-cooldown[data-state=locked] img{filter:grayscale(1);opacity:.45}
      .hero-buff{display:block;flex:none;background:url('${runtimeAssetUrl(BUFF_SHEET_PATH)}') no-repeat;background-size:${BUFF_SIGNAL_SHEET.columns * 100}% ${BUFF_SIGNAL_SHEET.rows * 100}%;image-rendering:auto}
      .hero-buff-party{position:absolute;left:0;width:344px;height:${BUFF_PARTY_ICON}px;display:flex;justify-content:center;gap:${BUFF_PARTY_GAP}px;pointer-events:none}
      .hero-buff-party .hero-buff{width:${BUFF_PARTY_ICON}px;height:${BUFF_PARTY_ICON}px}
      .hero-buffs{position:absolute;z-index:1;left:4%;right:4%;bottom:3%;display:flex;gap:2%}
      .hero-buffs .hero-buff{width:30%;aspect-ratio:1}
    `;
    document.head.append(style);
  }
  const element = document.createElement('div'); element.className = 'hero-cooldowns';
  element.setAttribute('role', 'group'); element.setAttribute('aria-label', 'Party skill cooldowns');
  const party = document.createElement('div'); party.className = 'hero-buff-party'; party.setAttribute('aria-hidden', 'true');
  const slots = Array.from({ length: HERO_COOLDOWN_LAYOUT.slots }, () => {
    const slot = document.createElement('div'); slot.className = 'hero-cooldown'; slot.setAttribute('role', 'img');
    slot.badges = document.createElement('div'); slot.badges.className = 'hero-buffs'; slot.badges.setAttribute('aria-hidden', 'true');
    element.append(slot); return slot;
  });
  let signals = {};
  return { element, partyElement: party, update(entities, globals, hostOffset) {
    element.style.top = `${HERO_COOLDOWN_LAYOUT.top - hostOffset}px`;
    party.style.top = `${HERO_COOLDOWN_LAYOUT.top - BUFF_PARTY_ICON - BUFF_PARTY_GAP - hostOffset}px`;
    signals = projectBuffSignals(heroBuffSignalInput(entities, globals), signals);
    syncBuffIcons(party, signals.party);
    heroCooldownSlots(entities, globals).forEach((hero, index) => {
      const slot = slots[index];
      slot.dataset.state = hero?.status || 'empty';
      slot.style.setProperty('--cooldown', `${(hero?.fraction || 0) * 360}deg`);
      if (hero && slot.dataset.uid !== String(hero.uid)) {
        const image = document.createElement('img'); image.src = runtimeAssetUrl(hero.path); image.alt = ''; image.draggable = false;
        slot.replaceChildren(image, slot.badges); slot.dataset.uid = String(hero.uid);
      } else if (!hero && slot.dataset.uid) { slot.replaceChildren(); delete slot.dataset.uid; }
      syncBuffIcons(slot.badges, (hero ? signals.heroes[String(hero.uid)] || [] : []).map(group => `hero-${group}`));
      const label = !hero ? `Empty hero slot ${index + 1}` : `${hero.name}: ${hero.status === 'cooldown' ? `next active skill ready in ${Math.ceil(hero.remaining)} seconds` : hero.status === 'ready' ? 'active skill cooldown ready; casting waits for conditions and target' : hero.status === 'ko' ? 'KO' : 'no unlocked active skills'}`;
      slot.setAttribute('aria-label', label);
    });
  } };
}
