import { HERO_DEFINITIONS, heroDefinition, heroSkillUnlocked } from '../src/core/heroDefinitions.mjs';
import { heroArtPath } from '../state/heroArtAssets.mjs';
import { runtimeAssetUrl } from './runtimeAssetUrl.mjs';

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
    `;
    document.head.append(style);
  }
  const element = document.createElement('div'); element.className = 'hero-cooldowns';
  element.setAttribute('role', 'group'); element.setAttribute('aria-label', 'Party skill cooldowns');
  const slots = Array.from({ length: HERO_COOLDOWN_LAYOUT.slots }, () => {
    const slot = document.createElement('div'); slot.className = 'hero-cooldown'; slot.setAttribute('role', 'img');
    element.append(slot); return slot;
  });
  return { element, update(entities, globals, hostOffset) {
    element.style.top = `${HERO_COOLDOWN_LAYOUT.top - hostOffset}px`;
    heroCooldownSlots(entities, globals).forEach((hero, index) => {
      const slot = slots[index];
      slot.dataset.state = hero?.status || 'empty';
      slot.style.setProperty('--cooldown', `${(hero?.fraction || 0) * 360}deg`);
      if (hero && slot.dataset.uid !== String(hero.uid)) {
        const image = document.createElement('img'); image.src = runtimeAssetUrl(hero.path); image.alt = ''; image.draggable = false;
        slot.replaceChildren(image); slot.dataset.uid = String(hero.uid);
      } else if (!hero && slot.dataset.uid) { slot.replaceChildren(); delete slot.dataset.uid; }
      const label = !hero ? `Empty hero slot ${index + 1}` : `${hero.name}: ${hero.status === 'cooldown' ? `next active skill ready in ${Math.ceil(hero.remaining)} seconds` : hero.status === 'ready' ? 'active skill cooldown ready; casting waits for conditions and target' : hero.status === 'ko' ? 'KO' : 'no unlocked active skills'}`;
      slot.setAttribute('aria-label', label);
    });
  } };
}
