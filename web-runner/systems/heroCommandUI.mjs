import {isAbleToActSlot} from '../src/core/schedulerRules.mjs';
import {heroDefinition} from '../src/core/heroDefinitions.mjs';
import {canUseHeroCommand, executeHeroCommand, getHeroCommandSlots, getHeroFlowState} from '../modules/heroCommands.mjs';
import {LOW_HP_WARNING_RATIO, settlementRowVisual} from '../modules/sessionLevelUpBuffPresentation.mjs';
import {HERO_ART_ASSETS, heroArtKey} from '../state/heroArtAssets.mjs';
import {runtimeAssetUrl} from './runtimeAssetUrl.mjs';

const HERO_NAMES = Object.freeze({Falie: 'Fara', Fara: 'Fara', Huun: 'Hondo', Hondo: 'Hondo', Runa: 'Runa', Kojonn: 'Kaja', Kaja: 'Kaja'});
const HERO_DISPLAY_ROLES = Object.freeze({Fara: 'TANK', Hondo: 'FIGHT', Runa: 'CTRL', Kaja: 'SUP'});
const HERO_PORTRAIT_PATHS = Object.freeze(Object.fromEntries(
  Object.entries(HERO_ART_ASSETS).map(([key, asset]) => [key, runtimeAssetUrl(asset.path)]),
));
const HERO_PORTRAIT_CROPS = Object.freeze({
  Falie: {position: '52% 0%', scale: 4.6, width: '47%'},
  Huun: {position: '60% 0%', scale: 4.8, width: '47%'},
  Runa: {position: '48% 0%', scale: 4.8, width: '47%'},
  Kojonn: {position: '54% 0%', scale: 4.7, width: '47%'},
});
export const HERO_STRIP_VERSION = 'sample-status-v30';
const heroName = hero => HERO_NAMES[hero?.baseHeroName || hero?.name] || hero?.name || 'Hero';
const heroPortraitKey = hero => heroArtKey(hero);
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export const heroStripCardWidth = () => 82;

export function createHeroCommandUI({ctx, gameState, canvas, onActiveHeroClick = () => undefined}) {
  const host = document.createElement('section');
  host.id = 'hero-commands';
  host.dataset.heroStripVersion = HERO_STRIP_VERSION;
  host.setAttribute('aria-label', 'Party status');
  const style = document.createElement('style');
  style.textContent = `
    #hero-commands{position:fixed;transform-origin:top left;width:354px;height:104px;box-sizing:border-box;background:transparent;color:#fff;z-index:18;padding:0;font:600 10px/1.05 system-ui,sans-serif;pointer-events:none}
    #hero-commands[hidden],#hero-commands [hidden]{display:none}
    #hero-commands *{box-sizing:border-box}
    #hero-commands .party-grid{display:flex;flex-wrap:nowrap;justify-content:flex-start;align-items:flex-start;gap:7px;width:349px;height:104px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
    #hero-commands .party-grid::-webkit-scrollbar{display:none}
    #hero-commands .party-grid[data-count="1"],#hero-commands .party-grid[data-count="2"],#hero-commands .party-grid[data-count="3"]{justify-content:center}
    #hero-commands article{position:relative;isolation:isolate;flex:0 0 var(--card-width,82px);width:var(--card-width,82px);height:104px;min-width:0;overflow:visible;border:0;background:transparent}
    #hero-commands .hero-card{position:relative;width:100%;height:100%;display:grid;grid-template-rows:64px 40px;padding:0;border:0;background:transparent;color:#fff;text-align:left;pointer-events:auto;overflow:visible}
    #hero-commands article[data-ko=true]{filter:grayscale(1);opacity:.6}
    #hero-commands button:disabled{cursor:default}
    #hero-commands button:focus-visible{outline:2px solid #64d4ee;outline-offset:1px}
    #hero-commands article[data-current=true]::before{content:'';position:absolute;z-index:-1;inset:-3px;border-radius:8px;background:radial-gradient(ellipse at center,#21dfff3d 0%,#21dfff15 42%,transparent 74%);filter:blur(3px);opacity:.85;pointer-events:none}
    #hero-commands article[data-level-up=true]::after{content:'';position:absolute;z-index:5;left:50%;top:-9px;width:14px;height:14px;border-left:2px solid #7df5ff;border-top:2px solid #7df5ff;transform:translateX(-50%) rotate(45deg);animation:level-up-owner-bounce .48s ease-in-out infinite alternate;pointer-events:none}
    @keyframes level-up-owner-bounce{from{margin-top:0;opacity:.55}to{margin-top:-5px;opacity:1}}
    #hero-commands .exp-row{position:absolute;z-index:6;left:0;top:-20px;width:100%;height:17px;display:grid;grid-template-rows:9px 5px;gap:2px;color:#fff;font-size:7px;line-height:1;pointer-events:none;transform-origin:left bottom}
    #hero-commands .exp-row[hidden]{display:none}
    #hero-commands .exp-text{display:flex;justify-content:space-between;gap:2px;white-space:nowrap;font-weight:900;text-shadow:1px 1px #000}
    #hero-commands .exp-row progress{height:5px;border-color:#1b1205;background:#282018;box-shadow:inset 0 1px #fff5,0 1px #0008}
    #hero-commands .exp-row progress::-webkit-progress-value{background:linear-gradient(#fff28a,#ffb12c 48%,#d96a08);border-radius:2px}
    #hero-commands .exp-row progress::-moz-progress-bar{background:linear-gradient(#fff28a,#ffb12c 48%,#d96a08)}
    #hero-commands article[data-low-hp=true] .readout-label,#hero-commands article[data-low-hp=true] .readout-value,#hero-commands article[data-low-hp=true] footer .role,#hero-commands article[data-low-hp=true] footer .level,#hero-commands article[data-low-hp=true] footer .hero-name strong{color:#ff8b37}
    #hero-commands .hero-top{grid-row:1;position:relative;min-width:0;overflow:visible;isolation:isolate;background:transparent}
    #hero-commands .portrait{position:absolute;z-index:1;inset:0 auto auto 0;width:47%;height:60px;overflow:hidden;background:transparent}
    #hero-commands .portrait img{width:100%;height:100%;display:block;object-fit:cover;object-position:50% 0%;transform:scale(2.1);transform-origin:50% 0%;pointer-events:none}
    #hero-commands .portrait-fallback{display:grid;place-items:center;height:100%;padding:2px;color:#d9f8ff;font-size:8px;overflow-wrap:anywhere;text-align:center}
    #hero-commands .readouts{position:absolute;z-index:2;top:2px;left:42%;width:55%;height:62px;display:flex;flex-direction:column;gap:6px;min-width:0}
    #hero-commands .readout{display:grid;grid-template-rows:19px 8px;gap:0;min-width:0;padding:0 2px;border:0;background:transparent;line-height:1;overflow:hidden}
    #hero-commands .readout.hp{transform:translateY(11px)}
    #hero-commands .readout-text{display:flex;align-items:baseline;justify-content:space-between;gap:0;min-width:0;padding:4px 0 0;white-space:nowrap;transform:translateY(5px)}
    #hero-commands .readout-label{display:inline-block;font-size:calc(9px * var(--compact-type-scale,1));font-weight:900;transform:scale(1.5);transform-origin:left bottom;text-shadow:1px 1px 0 #05060b,-1px 0 0 #05060b,0 -1px 0 #05060b,0 1px 0 #05060b}
    #hero-commands .readout-value{display:inline-block;font-size:calc(20px * var(--compact-type-scale,1));font-weight:900;line-height:.75;letter-spacing:-1px;transform:scaleX(.85);transform-origin:right bottom;margin-right:0;text-shadow:2px 0 #05060b,-2px 0 #05060b,0 2px #05060b,0 -2px #05060b,1px 1px 0 #05060b,-1px -1px 0 #05060b}
    #hero-commands progress{display:block;justify-self:stretch;width:100%;height:8px;appearance:none;border:1px solid #090a10;border-radius:3px;background:linear-gradient(#30323b,#11131a);box-shadow:inset 0 1px #fff9,inset 0 -2px #000b,0 1px #07090d;overflow:hidden}
    #hero-commands progress::-webkit-progress-bar{background:linear-gradient(#30323b,#11131a);border-radius:3px}
    #hero-commands .hp progress::-webkit-progress-value{background:linear-gradient(#eaff9c 0%,#a8ed52 30%,#559e17 70%,#245c08 100%);border-radius:2px}
    #hero-commands .hp progress::-moz-progress-bar{background:linear-gradient(#eaff9c,#559e17 70%,#245c08);border-radius:2px}
    #hero-commands .sp progress::-webkit-progress-value{background:linear-gradient(#c5f4ff 0%,#60d2ff 30%,#2274d4 70%,#123d8c 100%);border-radius:2px}
    #hero-commands .sp progress::-moz-progress-bar{background:linear-gradient(#c5f4ff,#2274d4 70%,#123d8c);border-radius:2px}
    #hero-commands footer{position:relative;z-index:3;grid-row:2;height:40px;display:grid;grid-template-rows:18px minmax(0,1fr);gap:1px;padding:0;border:0;background:transparent;color:#fff;overflow:visible}
    #hero-commands footer .hero-meta,#hero-commands footer .hero-name{min-width:0;overflow:hidden;border:2px solid #c6c4da;border-radius:4px;background:linear-gradient(#3a3a45,#111119);box-shadow:inset 0 0 0 1px #252632,0 1px #07080d}
    #hero-commands footer .hero-meta{display:flex;align-items:center;justify-content:center;gap:5px;padding:0 4px;border-bottom-color:#89899e;box-shadow:inset 0 -1px #20212c,0 1px #07080d}
    #hero-commands footer .hero-name{display:grid;place-items:center;padding:0 4px;border-top-color:#eeedfc}
    #hero-commands footer .role{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:calc(10px * var(--compact-type-scale,1));font-weight:900;text-shadow:1px 1px #000,-1px -1px #000;text-transform:uppercase}
    #hero-commands footer .level{display:flex;align-items:baseline;gap:1px;flex:none;white-space:nowrap;text-shadow:1px 1px #000,-1px -1px #000}
    #hero-commands footer .level-label{font-size:calc(10px * var(--compact-type-scale,1));font-weight:900}
    #hero-commands footer .level-value{font-size:calc(22px * var(--compact-type-scale,1));font-weight:1000;line-height:.68;text-shadow:2px 0 #05060b,-2px 0 #05060b,0 2px #05060b,0 -2px #05060b;}
    #hero-commands footer .hero-name strong{display:grid;place-items:center;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:calc(15px * var(--compact-type-scale,1));font-weight:900;line-height:1;text-shadow:1px 1px 0 #05060b,-1px 0 0 #05060b,0 -1px 0 #05060b,0 1px 0 #05060b;text-transform:uppercase}
  `;
  document.head.append(style);
  const grid = document.createElement('div');
  grid.className = 'party-grid';
  host.append(grid);
  document.body.append(host);
  let members = [];
  let slotMembers = [];
  let cards = [];
  let sessionId = null;
  let available = false;

  const button = (parent, action) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.onclick = action;
    parent.append(element);
    return element;
  };

  const selectActor = actor => {
    if (!available || !actor || Number(actor.hp || 0) <= 0) return false;
    ctx.state.globals[actor.kind === 'enemy' ? 'SelectedEnemyUID' : 'SelectedAllyUID'] = actor.uid;
    return true;
  };

  function playCurrent() {
    const actor = members.find(hero => hero && canUseHeroCommand(ctx, hero.uid));
    if (!actor) return false;
    const target = ctx.state.entities.find(entity => entity.kind === 'enemy' && entity.hp > 0);
    const definition = heroDefinition(actor);
    if (!target || !definition?.basic) return false;
    return executeHeroCommand(ctx, {
      actorUID: actor.uid,
      queue: [{skillId: definition.basic.skillId, targetIds: [target.uid]}],
    });
  }

  function rebuildCard(card, hero) {
    card.replaceChildren();
    for (const key of Object.keys(card.dataset)) delete card.dataset[key];
    if (!hero) return;
    card.dataset.uid = hero.uid;
    const open = button(card, () => undefined);
    open.className = 'hero-card';
    open.dataset.open = '';
    const expRow = document.createElement('div');
    expRow.className = 'exp-row'; expRow.hidden = true;
    const expText = document.createElement('span'); expText.className = 'exp-text';
    const expGain = document.createElement('span'); expGain.dataset.expGain = '';
    const expValue = document.createElement('span'); expValue.dataset.expValue = '';
    expText.append(expGain, expValue);
    const expBar = document.createElement('progress'); expBar.dataset.expBar = ''; expBar.max = 1; expBar.value = 0;
    expRow.append(expText, expBar);
    const top = document.createElement('div');
    top.className = 'hero-top';
    const portrait = document.createElement('div');
    portrait.className = 'portrait';
    const image = document.createElement('img');
    image.alt = '';
    image.draggable = false;
    const fallback = document.createElement('span');
    fallback.className = 'portrait-fallback';
    fallback.textContent = heroName(hero);
    portrait.append(image, fallback);
    const readouts = document.createElement('div');
    readouts.className = 'readouts';
    for (const [key, label] of [['hp', 'HP'], ['sp', 'SP']]) {
      const readout = document.createElement('div');
      readout.className = `readout ${key}`;
      const text = document.createElement('span');
      text.className = 'readout-text';
      const readoutLabel = document.createElement('span');
      readoutLabel.className = 'readout-label';
      readoutLabel.textContent = label;
      const value = document.createElement('strong');
      value.className = 'readout-value';
      value.dataset[`${key}Text`] = '';
      text.append(readoutLabel, value);
      const bar = document.createElement('progress');
      bar.dataset[`${key}Bar`] = '';
      bar.setAttribute('aria-label', `${heroName(hero)} ${label}`);
      readout.append(text, bar);
      readouts.append(readout);
    }
    top.append(portrait, readouts);
    const footer = document.createElement('footer');
    const meta = document.createElement('div');
    meta.className = 'hero-meta';
    const role = document.createElement('span');
    role.className = 'role';
    role.dataset.role = '';
    const nameBand = document.createElement('div');
    nameBand.className = 'hero-name';
    const name = document.createElement('strong');
    name.dataset.name = '';
    const level = document.createElement('span');
    level.className = 'level';
    level.dataset.level = '';
    const levelLabel = document.createElement('span');
    levelLabel.className = 'level-label';
    levelLabel.textContent = 'Lv';
    const levelValue = document.createElement('strong');
    levelValue.className = 'level-value';
    levelValue.dataset.levelValue = '';
    level.append(levelLabel, levelValue);
    meta.append(role, level);
    nameBand.append(name);
    footer.append(meta, nameBand);
    card.append(expRow); open.append(top, footer);
  }

  return {
    selectBattlefieldActor: selectActor,
    selectBattlefieldAlly(mx, my, project, scale) {
      const hero = members.find(actor => {
        if (!actor || Number(actor.hp || 0) <= 0) return false;
        const point = ctx.state.globals.HeroPortraitPosByIndex?.[actor.heroDisplaySlot ?? actor.heroIndex];
        if (!point) return false;
        const position = project(point.x, point.y, 'hero');
        return Math.abs(mx - position.x) <= 20 * scale && Math.abs(my - position.y) <= 25 * scale;
      });
      return hero ? selectActor(hero) : false;
    },
    playCurrent,
    update({visible, blocked, worldToCanvas, layoutScale, portraits}) {
      host.hidden = !visible;
      available = !!visible && !blocked;
      host.inert = !available;
      if (!visible) return;
      const position = worldToCanvas(6, 406);
      const rect = canvas.getBoundingClientRect();
      host.style.left = `${rect.left + position.x}px`;
      host.style.top = `${rect.top + position.y}px`;
      host.style.transform = `scale(${layoutScale})`;
      host.style.setProperty('--compact-type-scale', String(1 / Math.max(.01, Number(layoutScale) || 1)));
      const slots = getHeroCommandSlots(ctx.state.entities);
      const rosterChanged = sessionId !== ctx.state.globals.CombatSessionId || slots.some((hero, slot) => hero !== slotMembers[slot]);
      if (rosterChanged) {
        sessionId = ctx.state.globals.CombatSessionId;
        slotMembers = slots;
        members = slots.filter(Boolean);
        grid.replaceChildren();
        cards = members.map(hero => {
          const card = document.createElement('article');
          grid.append(card);
          rebuildCard(card, hero);
          return card;
        });
      }
      const count = members.length;
      grid.dataset.count = String(count);
      grid.style.setProperty('--card-width', `${heroStripCardWidth()}px`);
      const scheduledUID = Number(ctx.callFunction('GetCurrentTurn') || 0);
      const settlement = ctx.state.globals.SessionLevelUpSettlement;
      const queue = ctx.state.globals.SessionLevelUpQueue;
      const queueEntry = queue?.status === 'active' && !queue?.paused ? queue.entries?.[queue.currentIndex] : null;
      cards.forEach((card, slot) => {
        const hero = members[slot];
        if (!hero) return;
        const eligible = isAbleToActSlot(hero);
        const current = eligible && scheduledUID === Number(hero.uid);
        const resourceState = getHeroFlowState(hero);
        const maxHP = Math.max(1, number(hero.maxHP ?? hero.HP, 1));
        const hp = Math.max(0, Math.min(maxHP, number(hero.hp ?? hero.HP)));
        const spMax = Math.max(1, number(resourceState.spMax, 1));
        const sp = Math.max(0, Math.min(spMax, number(resourceState.sp)));
        const ready = !!resourceState.ready || number(resourceState.value) >= 100;
        card.dataset.current = String(current);
        card.dataset.ko = String(hp <= 0);
        card.dataset.lowHp = String(hp > 0 && hp / maxHP <= LOW_HP_WARNING_RATIO);
        card.dataset.levelUp = String(String(queueEntry?.heroId || '') === String(hero.heroInstanceKey || hero.uid || ''));
        card.dataset.ready = String(ready);
        card.querySelector('[data-hp-text]').textContent = hp;
        const bar = card.querySelector('[data-hp-bar]'); bar.max = maxHP; bar.value = hp; bar.setAttribute('aria-valuetext', `${hp} of ${maxHP} HP`);
        card.querySelector('[data-sp-text]').textContent = sp;
        const spBar = card.querySelector('[data-sp-bar]'); spBar.max = spMax; spBar.value = sp; spBar.setAttribute('aria-valuetext', `${sp} of ${spMax} SP`);
        const row = (settlement?.rows || []).find(candidate => String(candidate.heroId || '') === String(hero.heroInstanceKey || hero.uid || ''));
        const expRow = card.querySelector('.exp-row');
        expRow.hidden = !row;
        if (row) {
          const visual = settlementRowVisual(row, Number(ctx.state.globals.time || 0), settlement);
          const max = Math.max(1, Number(row.expToNext || 1));
          expRow.style.opacity = String(visual.opacity);
          card.querySelector('[data-exp-gain]').textContent = `EXP +${Math.max(0, Number(row.gainedEXP || 0))}`;
          card.querySelector('[data-exp-value]').textContent = `${Math.floor(visual.progress * max)}/${max}`;
          const expBar = card.querySelector('[data-exp-bar]'); expBar.max = 1; expBar.value = visual.progress;
        }
        const definition = heroDefinition(hero);
        const role = card.querySelector('[data-role]');
        role.textContent = HERO_DISPLAY_ROLES[heroName(hero)] || definition?.role || 'Hero';
        role.title = definition?.role || 'Hero';
        card.querySelector('[data-name]').textContent = heroName(hero);
        card.querySelector('[data-level-value]').textContent = Math.max(1, Math.floor(number(hero.currentLevel, 1)));
        const portraitKey = heroPortraitKey(hero);
        const portraitCrop = HERO_PORTRAIT_CROPS[portraitKey] || {position: '50% 0%', scale: 4.7, width: '47%'};
        const image = portraits?.[portraitKey];
        const portraitSrc = HERO_PORTRAIT_PATHS[portraitKey] || image?.src;
        const portrait = card.querySelector('.portrait');
        portrait.dataset.portrait = portraitKey || '';
        portrait.style.width = portraitCrop.width;
        const portraitImage = portrait.querySelector('img');
        portraitImage.style.objectPosition = portraitCrop.position;
        portraitImage.style.transformOrigin = portraitCrop.position;
        portraitImage.style.transform = `scale(${portraitCrop.scale})`;
        const fallback = card.querySelector('.portrait-fallback');
        portraitImage.onerror = () => { portraitImage.hidden = true; fallback.hidden = false; };
        if (portraitSrc) { portraitImage.hidden = false; fallback.hidden = true; if (portraitImage.src !== portraitSrc) portraitImage.src = portraitSrc; }
        else { portraitImage.hidden = true; fallback.hidden = false; }
        const open = card.querySelector('[data-open]');
        open.disabled = true;
        open.setAttribute('aria-current', String(current));
        open.setAttribute('aria-label', `${heroName(hero)} ${definition?.role || 'Hero'} status, level ${Math.max(1, Math.floor(number(hero.currentLevel, 1)))}${current ? ', active, reopen hero cards' : ''}${ready ? ', special ready' : ''}`);
        if (current && grid.scrollWidth > grid.clientWidth) card.scrollIntoView({block: 'nearest', inline: 'nearest'});
      });
    },
    destroy() { host.remove(); style.remove(); },
  };
}
