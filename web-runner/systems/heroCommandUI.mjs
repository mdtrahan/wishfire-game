import { canUseHeroCommand, executeHeroCommand, getHeroCommandSlots } from '../modules/heroCommands.mjs';

const names = { Falie: 'Fara', Huun: 'Hondo', Runa: 'Runa', Kojonn: 'Kaja' };
const heroName = hero => names[hero.baseHeroName || hero.name] || hero.name;

export function createHeroCommandUI({ ctx, gameState, canvas }) {
  const host = document.createElement('section');
  host.id = 'hero-commands';
  host.setAttribute('aria-label', 'Party commands');
  const style = document.createElement('style');
  style.textContent = `
    #hero-commands{position:fixed;transform-origin:top left;width:348px;height:280px;box-sizing:border-box;background:#080808;color:#fff;z-index:18;padding:4px;font:12px/1.2 system-ui}
    #hero-commands[hidden],#hero-commands [hidden]{display:none}
    #hero-commands *{box-sizing:border-box}
    #hero-commands button{font:inherit;color:inherit;background:#141414;border:2px ridge #9f9f9f;border-radius:4px;min-width:0;cursor:pointer}
    #hero-commands button:disabled{color:#858585;cursor:default;border-color:#555}
    #hero-commands button:focus-visible{outline:2px solid #64d4ee;outline-offset:1px}
    #hero-commands button[aria-pressed=true]{border-color:#64d4ee;background:#203035}
    #hero-commands .party-grid{display:grid;grid-auto-flow:column;grid-template:repeat(3,76px)/repeat(2,minmax(0,1fr));gap:4px}
    #hero-commands article{border:3px ridge #aaa;border-radius:5px;padding:3px;background:linear-gradient(#151515,#050505);min-width:0}
    #hero-commands article:empty{border-color:#3e3e3e}
    #hero-commands article[data-current=true]{border-color:#eee;box-shadow:inset 0 0 5px #8cd0da}
    #hero-commands article[data-ko=true]{filter:grayscale(1)}
    #hero-commands header{display:flex;align-items:center;gap:4px;height:20px;overflow:hidden}
    #hero-commands strong{font-size:11px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #hero-commands .face{width:20px;height:20px;flex:none;overflow:hidden}
    #hero-commands .face img{width:100%;height:100%;object-fit:cover;object-position:50% 18%;transform:scale(1.5);transform-origin:50% 15%;pointer-events:none}
    #hero-commands .health{display:flex;align-items:center;gap:4px;font-size:10px;margin:2px 0}
    #hero-commands progress{height:5px;width:100%;appearance:none;display:block;border:0;background:#303030}
    #hero-commands progress::-webkit-progress-bar{background:#303030}
    #hero-commands progress::-webkit-progress-value{background:#99d638}
    #hero-commands .commands{display:flex;gap:4px;margin-top:4px}
    #hero-commands .commands button{height:24px;flex:1;font-size:10px}
    #hero-commands footer{display:flex;gap:4px;height:32px;margin-top:4px}
    #hero-commands footer button{flex:1;font-size:11px;text-transform:uppercase}
    #hero-commands .editor{position:absolute;inset:4px;background:#080808;display:flex;flex-direction:column;gap:8px;padding:8px;border:3px ridge #aaa}
    #hero-commands .editor h2{font-size:14px;margin:0}
    #hero-commands .editor button{min-height:32px;padding:5px 8px}
    #hero-commands .targets{display:flex;flex-direction:column;gap:4px;min-height:0;overflow:auto;flex:1}
    #hero-commands .targets[hidden]{display:none}
    #hero-commands .editor footer{flex:none}
  `;
  document.head.append(style);
  const grid = document.createElement('div');
  grid.className = 'party-grid';
  const cards = Array.from({ length: 6 }, () => grid.appendChild(document.createElement('article')));
  const footer = document.createElement('footer');
  host.append(grid, footer);
  document.body.append(host);
  let members = [], prepared = new Map(), previous = new Map(), draft = null, editor = null, sessionId = null;
  let auto = false, repeat = null, available = false, returnFocusUID = null;
  const button = (parent, text, action) => {
    const el = document.createElement('button');
    el.type = 'button'; el.textContent = text; el.onclick = action; parent.append(el); return el;
  };
  const autoButton = button(footer, 'Auto', () => { auto = !auto; repeat = null; });
  const repeatButton = button(footer, 'Repeat', () => {
    auto = false;
    repeat = repeat ? null : new Set(members.filter(hero => hero && hero.hp > 0 && previous.has(hero.uid)).map(hero => hero.uid));
  });
  button(footer, 'Reload', () => { prepared = new Map(previous); });
  const menuButton = button(footer, 'Menu', () => { gameState.heroCommandsMenuOpen = !gameState.heroCommandsMenuOpen; auto = false; repeat = null; });
  function closeEditor() {
    returnFocusUID = draft?.actorUID ?? returnFocusUID;
    editor?.remove(); editor = null; draft = null;
    grid.inert = false; footer.inert = false;
  }
  function openEditor(hero) {
    if (!available || Number(hero.hp) <= 0) return;
    auto = false; repeat = null;
    grid.inert = true; footer.inert = true;
    draft = { actorUID: hero.uid, skillId: 'HERO_SINGLE', ...prepared.get(hero.uid) };
    editor?.remove(); editor = document.createElement('div'); editor.className = 'editor';
    editor.setAttribute('role', 'group'); editor.setAttribute('aria-label', `${heroName(hero)} actions`);
    const title = document.createElement('h2'); title.textContent = heroName(hero); editor.append(title);
    const choices = document.createElement('div'); choices.className = 'commands'; editor.append(choices);
    const attack = button(choices, 'Attack', () => choose('HERO_SINGLE'));
    const heal = button(choices, 'Heal 7%', () => choose('HERO_HEAL'));
    const targets = document.createElement('div'); targets.className = 'targets'; editor.append(targets);
    function choose(skillId) {
      draft.skillId = skillId;
      attack.setAttribute('aria-pressed', String(skillId === 'HERO_SINGLE'));
      heal.setAttribute('aria-pressed', String(skillId === 'HERO_HEAL'));
      targets.hidden = skillId === 'HERO_HEAL';
    }
    choose(draft.skillId);
    const enemies = ctx.state.entities.filter(actor => actor.kind === 'enemy' && actor.hp > 0);
    if (!enemies.some(enemy => enemy.uid === draft.targetUID)) draft.targetUID = enemies[0]?.uid;
    for (const enemy of enemies) {
      const targetButton = button(targets, `${enemy.name} ${enemy.hp}/${enemy.maxHP}`, () => {
        draft.targetUID = enemy.uid;
        for (const child of targets.children) child.setAttribute('aria-pressed', String(child === targetButton));
      });
      targetButton.dataset.target = enemy.uid;
      targetButton.setAttribute('aria-pressed', String(enemy.uid === draft.targetUID));
    }
    const controls = document.createElement('footer'); editor.append(controls);
    button(controls, 'Back', closeEditor);
    const set = button(controls, 'Set Action', () => {
      if (draft.skillId !== 'HERO_HEAL' && !ctx.state.entities.some(enemy => enemy.uid === draft.targetUID && enemy.kind === 'enemy' && enemy.hp > 0)) return;
      prepared.set(hero.uid, { ...draft }); closeEditor();
    });
    set.dataset.set = '';
    editor.onkeydown = event => { if (event.key === 'Escape') { event.stopPropagation(); closeEditor(); } };
    host.append(editor); attack.focus();
  }
  function execute(hero, command = prepared.get(hero.uid)) {
    if (!available || draft || gameState.heroCommandsMenuOpen) return false;
    const enemies = ctx.state.entities.filter(actor => actor.kind === 'enemy' && actor.hp > 0);
    if (command?.skillId !== 'HERO_HEAL' && command?.targetUID && !enemies.some(enemy => enemy.uid === command.targetUID)) {
      auto = false; repeat = null; openEditor(hero); return false;
    }
    const targetUID = command?.targetUID ?? enemies[0]?.uid;
    const next = { actorUID: hero.uid, skillId: 'HERO_SINGLE', ...command, targetUID };
    if (!executeHeroCommand(ctx, next)) return false;
    previous.set(hero.uid, next); prepared.set(hero.uid, next); return true;
  }
  return {
    playCurrent() {
      const actor = members.find(hero => hero && canUseHeroCommand(ctx, hero.uid));
      return actor ? execute(actor) : false;
    },
    update({ visible, blocked, worldToCanvas, layoutScale, portraits }) {
      host.hidden = !visible;
      available = visible && !blocked;
      host.inert = !available;
      if (!visible) { auto = false; repeat = null; closeEditor(); gameState.heroCommandsMenuOpen = false; return; }
      const pos = worldToCanvas(6, 350), rect = canvas.getBoundingClientRect();
      host.style.left = `${rect.left + pos.x}px`; host.style.top = `${rect.top + pos.y}px`;
      host.style.transform = `scale(${layoutScale})`;
      const slots = getHeroCommandSlots(ctx.state.entities);
      if (sessionId !== ctx.state.globals.CombatSessionId || slots.some((hero, slot) => hero !== members[slot])) {
        closeEditor(); auto = false; repeat = null;
        if (sessionId !== ctx.state.globals.CombatSessionId || slots.some((hero, slot) => hero?.uid !== members[slot]?.uid)) {
          prepared.clear(); previous.clear();
        }
        sessionId = ctx.state.globals.CombatSessionId;
        members = slots;
        cards.forEach((card, slot) => {
          card.replaceChildren(); delete card.dataset.uid;
          const hero = slots[slot]; if (!hero) return;
          card.dataset.uid = hero.uid;
          const header = document.createElement('header');
          const face = document.createElement('span'); face.className = 'face';
          const image = document.createElement('img'); image.alt = ''; image.draggable = false; face.append(image);
          const name = document.createElement('strong'); name.textContent = heroName(hero); header.append(face, name);
          const health = document.createElement('div'); health.className = 'health';
          const hp = document.createElement('span'); hp.dataset.hp = ''; health.append(hp);
          const bar = document.createElement('progress'); bar.setAttribute('aria-label', `${heroName(hero)} HP`); health.append(bar);
          const commands = document.createElement('div'); commands.className = 'commands';
          const attack = button(commands, 'Attack', () => execute(hero)); attack.dataset.attack = ''; attack.setAttribute('aria-label', `${heroName(hero)} Attack`);
          const actions = button(commands, 'Actions', () => openEditor(hero)); actions.dataset.actions = ''; actions.setAttribute('aria-label', `${heroName(hero)} Actions`);
          card.append(header, health, commands);
        });
      }
      cards.forEach((card, slot) => {
        const hero = slots[slot]; if (!hero) return;
        const current = canUseHeroCommand(ctx, hero.uid);
        card.dataset.current = String(current); card.dataset.ko = String(hero.hp <= 0);
        const hpText = `${Math.max(0, hero.hp)}/${hero.maxHP}`;
        const hpLabel = card.querySelector('[data-hp]');
        if (hpLabel.textContent !== hpText) hpLabel.textContent = hpText;
        const bar = card.querySelector('progress'); bar.max = Math.max(1, hero.maxHP); bar.value = Math.max(0, hero.hp);
        const image = portraits[hero.portraitName || hero.baseHeroName || hero.name];
        if (image?.src && card.querySelector('img').src !== image.src) card.querySelector('img').src = image.src;
        card.querySelector('[data-attack]').disabled = !available || !current || !!draft || !!gameState.heroCommandsMenuOpen;
        const actionName = prepared.get(hero.uid)?.skillId === 'HERO_HEAL' ? 'Heal' : 'Attack';
        card.querySelector('[data-attack]').textContent = actionName;
        card.querySelector('[data-attack]').setAttribute('aria-label', `${heroName(hero)} ${actionName}`);
        card.querySelector('[data-actions]').disabled = !available || hero.hp <= 0 || !!draft || !!gameState.heroCommandsMenuOpen;
      });
      if (draft) {
        if (!members.some(hero => hero?.uid === draft.actorUID && hero.hp > 0)) closeEditor();
        else {
          for (const target of editor.querySelectorAll('[data-target]')) target.disabled = !ctx.state.entities.some(enemy => enemy.uid === Number(target.dataset.target) && enemy.hp > 0);
          editor.querySelector('[data-set]').disabled = draft.skillId !== 'HERO_HEAL' && !ctx.state.entities.some(enemy => enemy.uid === draft.targetUID && enemy.kind === 'enemy' && enemy.hp > 0);
        }
      }
      if (returnFocusUID && !draft) {
        cards.find(card => Number(card.dataset.uid) === returnFocusUID)?.querySelector('[data-actions]')?.focus();
        returnFocusUID = null;
      }
      autoButton.setAttribute('aria-pressed', String(auto)); repeatButton.setAttribute('aria-pressed', String(!!repeat));
      repeatButton.disabled = !previous.size || members.some(hero => hero?.hp > 0 && !previous.has(hero.uid));
      menuButton.setAttribute('aria-expanded', String(!!gameState.heroCommandsMenuOpen));
      if (repeat) for (const uid of repeat) if (!members.some(hero => hero?.uid === uid && hero.hp > 0)) repeat.delete(uid);
      if (available && !draft && (auto || repeat?.size)) {
        const actor = members.find(hero => hero && canUseHeroCommand(ctx, hero.uid));
        if (actor && (auto || repeat.has(actor.uid)) && execute(actor, repeat ? previous.get(actor.uid) : null)) repeat?.delete(actor.uid);
      }
      if (repeat && !repeat.size) repeat = null;
    },
    destroy() { host.remove(); style.remove(); },
  };
}
