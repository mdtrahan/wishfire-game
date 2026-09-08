import {selectionBudget, battlefieldTargets} from '../src/core/actionSelection.mjs';
import {heroDefinition} from '../src/core/heroDefinitions.mjs';
import {legalSkill} from '../src/core/combatRules.mjs';
import { buildCommandActions, canUseHeroCommand, executeHeroCommand, getHeroCommandSlots, getHeroSkillOptions, getHeroFlowState } from '../modules/heroCommands.mjs';

const names = { Falie: 'Fara', Huun: 'Hondo', Runa: 'Runa', Kojonn: 'Kaja' };
const heroName = hero => names[hero.baseHeroName || hero.name] || hero.name;
const copyCommand = command => ({ ...command, queue: command?.queue ? command.queue.map(action => ({...action, targetIds:[...action.targetIds]})) : undefined });

export function createHeroCommandUI({ ctx, gameState, canvas }) {
  const host = document.createElement('section');
  host.id = 'hero-commands';
  host.setAttribute('aria-label', 'Party commands');
  const style = document.createElement('style');
  style.textContent = `
    #hero-commands{position:fixed;transform-origin:top left;width:348px;height:226px;box-sizing:border-box;background:#080808;color:#fff;z-index:18;padding:4px;font:12px/1.2 system-ui}
    #hero-commands[hidden],#hero-commands [hidden]{display:none}
    #hero-commands *{box-sizing:border-box}
    #hero-commands button{font:inherit;color:inherit;background:#141414;border:2px ridge #9f9f9f;border-radius:4px;min-width:0;cursor:pointer}
    #hero-commands button:disabled{color:#858585;cursor:default;border-color:#555}
    #hero-commands button:focus-visible{outline:2px solid #64d4ee;outline-offset:1px}
    #hero-commands button[aria-pressed=true]{border-color:#64d4ee;background:#203035}
    #hero-commands .party-grid{display:grid;grid-auto-flow:column;grid-template:repeat(3,58px)/repeat(2,minmax(0,1fr));gap:4px}
    #hero-commands article{min-width:0;border:2px ridge #3e3e3e;border-radius:5px;background:linear-gradient(#151515,#050505)}
    #hero-commands article:has(button){border:0}
    #hero-commands .hero-card{width:100%;height:100%;text-align:left;padding:4px 5px;border:3px ridge #aaa;background:linear-gradient(#151515,#050505)}
    #hero-commands article[data-current=true] .hero-card{color:white;border-color:#8ef5ff;background:radial-gradient(ellipse at center,#007aca,#003c70);box-shadow:inset 0 0 12px #16bfff,0 0 7px #27d4ff}
    #hero-commands article[data-ready=true] .flow{filter:drop-shadow(0 0 3px #ffd873);color:#ffe08b}
    #hero-commands article[data-ready=true] .flow progress::-webkit-progress-value{background:#ef4444}
    #hero-commands article[data-ready=true] .flow progress::-moz-progress-bar{background:#ef4444}
    #hero-commands article[data-ko=true]{filter:grayscale(1);opacity:.6}
    #hero-commands header{display:flex;align-items:center;gap:4px;height:22px;overflow:hidden}
    #hero-commands strong{font-size:10px;min-width:0;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #hero-commands .face{width:18px;height:18px;flex:none;overflow:hidden}
    #hero-commands .face img{width:100%;height:100%;object-fit:cover;object-position:50% 18%;transform:scale(1.5);transform-origin:50% 15%;pointer-events:none}
    #hero-commands .vitals{display:grid;grid-template-columns:minmax(0,1fr) 55px;gap:7px;margin-top:2px}
    #hero-commands .health,#hero-commands .sp{display:flex;flex-direction:column;gap:2px;font-size:10px;min-width:0}
    #hero-commands progress{height:5px;width:100%;appearance:none;display:block;border:0;background:#303030}
    #hero-commands progress::-webkit-progress-bar{background:#303030}
    #hero-commands progress::-webkit-progress-value{background:#99d638}
    #hero-commands progress::-moz-progress-bar{background:#99d638}
    #hero-commands .health span{white-space:nowrap}
    #hero-commands .sp span{white-space:nowrap;text-align:right}
    #hero-commands .flow{display:flex;flex-direction:column;gap:2px;width:48px;flex:none;margin-left:auto;font-size:10px;font-weight:700;font-style:italic;text-align:right}
    #hero-commands .flow progress{height:4px}
    #hero-commands .flow progress::-webkit-progress-value{background:#ef4444}
    #hero-commands .flow progress::-moz-progress-bar{background:#ef4444}
    #hero-commands .sp progress::-webkit-progress-value{background:#3b82f6}
    #hero-commands .sp progress::-moz-progress-bar{background:#3b82f6}
    #hero-commands .commands{display:flex;flex-wrap:wrap;gap:4px}
    #hero-commands footer{display:flex;gap:4px;height:32px;margin-top:4px}
    #hero-commands footer button{flex:1;font-size:11px;text-transform:uppercase}
    #hero-commands .editor{position:absolute;inset:4px;background:#080808;display:flex;flex-direction:column;gap:5px;padding:7px;border:3px ridge #aaa}
    #hero-commands .editor h2{font-size:13px;margin:0;display:flex;justify-content:space-between;gap:8px}
    #hero-commands .editor h2 span{font-size:10px;font-weight:400;white-space:nowrap}
    #hero-commands .editor button{min-height:30px;padding:4px 6px;font-size:11px}
    #hero-commands .editor-body{display:flex;flex-direction:column;gap:6px;min-height:0;overflow:auto;flex:1;padding:2px}
    #hero-commands .skills{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}
    #hero-commands .skills button{display:flex;justify-content:space-between;gap:3px;text-align:left}
    #hero-commands .queue{display:flex;flex-wrap:wrap;gap:4px;flex-shrink:0}
    #hero-commands .queue:empty{display:none}
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
  let auto = false, repeat = null, available = false, returnFocusUID = null, refreshEditor = null, commitFullDraft = null;
  const button = (parent, text, action) => {
    const el = document.createElement('button');
    el.type = 'button'; el.textContent = text; el.onclick = action; parent.append(el); return el;
  };
  const autoButton = button(footer, 'Auto', () => { auto = !auto; repeat = null; });
  const repeatButton = button(footer, 'Repeat', () => {
    auto = false;
    repeat = repeat ? null : new Set(members.filter(hero => hero && hero.hp > 0 && previous.has(hero.uid)).map(hero => hero.uid));
  });
  button(footer, 'Reload', () => { prepared = new Map([...previous].map(([uid, command]) => [uid, copyCommand(command)])); });
  const menuButton = button(footer, 'Menu', () => { gameState.heroCommandsMenuOpen = !gameState.heroCommandsMenuOpen; auto = false; repeat = null; });
  function closeEditor() {
    returnFocusUID = draft?.actorUID ?? returnFocusUID;
    editor?.remove(); editor = null; draft = null; refreshEditor = null; commitFullDraft = null;
    grid.inert = false; footer.inert = false;
  }
  function validCommand(hero, command) {
    return !!buildCommandActions(ctx, hero, command);
  }
  function openEditor(hero) {
    if (!available || Number(hero.hp) <= 0) return;
    auto = false; repeat = null;
    grid.inert = true; footer.inert = true;
    draft = { actorUID: hero.uid, skillId: 'HERO_SINGLE', ...copyCommand(prepared.get(hero.uid)) };
    editor?.remove(); editor = document.createElement('div'); editor.className = 'editor';
    editor.setAttribute('role', 'group'); editor.setAttribute('aria-label', `${heroName(hero)} actions`);
    const title = document.createElement('h2'); title.textContent = heroName(hero);
    const budget = document.createElement('span'); title.append(budget); editor.append(title);
    const targetLabel = document.createElement('div'); editor.append(targetLabel);
    const body = document.createElement('div'); body.className = 'editor-body'; editor.append(body);
    const choices = document.createElement('div'); choices.className = 'commands'; body.append(choices);
    const definition = heroDefinition(hero);
    const options = getHeroSkillOptions(hero);
    function selectSkill(skill) {
      const targetIds = battlefieldTargets(ctx.state.entities, hero, skill, ctx.state.globals);
      const action = {skillId:skill.skillId,targetIds};
      const exclusive = skill.isFlowSpecial || skill === definition.basic;
      const candidate = {...draft, flow:!!skill.isFlowSpecial, queue:exclusive || draft.flow || draft.queue?.some(a => a.skillId === definition.basic.skillId) ? [action] : [...(draft.queue||[]),action]};
      if (!validCommand(hero,candidate)) return;
      draft=candidate;
      save();
      if (selectionBudget(hero,draft.queue).remainingActionSlots === 0 && canUseHeroCommand(ctx,hero.uid)) commit();
    }
    const attack = button(choices, 'Attack', () => selectSkill(definition.basic));
    const flowButton = button(choices, 'FLOW', () => selectSkill(definition.special)); flowButton.dataset.flowAction = '';
    const skills = document.createElement('div'); skills.className = 'skills'; body.append(skills);
    const skillButtons = options.map(skill => {
      const el = button(skills, `${skill.displayName} · ${skill.spCost} SP`, () => selectSkill(skill));
      el.title = skill.description; el.dataset.skill = skill.skillId; return {el,skill};
    });
    const queue = document.createElement('div'); queue.className = 'queue'; queue.setAttribute('aria-label', 'Queued skills'); editor.append(queue);
    const controls = document.createElement('footer'); editor.append(controls);
    button(controls, 'Back', closeEditor);
    function commit() {
      if (!draft?.queue?.length || !canUseHeroCommand(ctx, hero.uid) || !validCommand(hero, draft)) return;
      const command = copyCommand(draft); closeEditor(); execute(hero, command);
    }
    const act = button(controls, 'Act', commit);
    act.dataset.act = '';
    function save() {
      prepared.set(hero.uid, copyCommand(draft));
      const selection = selectionBudget(hero,draft.queue);
      hero.remainingActionSlots=selection.remainingActionSlots;
      hero.reservedSP=selection.reservedSP;
      queue.replaceChildren();
      (draft.queue || []).forEach((action, index) => {
        const skillName = [definition.basic,...options,definition.special].find(skill => skill.skillId === action.skillId)?.displayName || action.skillId;
        const targetNames = action.targetIds.map(uid => ctx.state.entities.find(a => a.uid === uid)).filter(Boolean).map(heroName).join(', ');
        const name = `${skillName} → ${targetNames}`;
        const remove = button(queue, `${index + 1}. ${name} ×`, () => { draft.queue.splice(index, 1); save(); });
        remove.setAttribute('aria-label', `Remove queued ${name}, position ${index + 1}`);
      });
      refreshEditor?.();
    }
    refreshEditor = () => {
      const flow = getHeroFlowState(hero);
      const cost = (draft.queue || []).reduce((sum, action) => sum + (options.find(skill => skill.skillId === action.skillId)?.spCost || 0), 0);
      const selection = selectionBudget(hero,draft.queue);
      const target = ctx.state.entities.find(actor => actor.uid === ctx.state.globals.SelectedEnemyUID && actor.hp > 0);
      budget.textContent = `${selection.queuedActions}/${selection.capacity} actions · ${selection.remainingActionSlots} left · ${selection.availableSP} SP`;
      targetLabel.textContent = target ? `Target: ${target.name}` : 'No living enemy target';
      attack.setAttribute('aria-pressed', String(draft.queue?.some(a=>a.skillId===definition.basic.skillId)||false));
      flowButton.setAttribute('aria-pressed', String(!!draft.flow && !!draft.queue?.length)); flowButton.disabled = !flow.ready || !legalSkill(hero,definition.special);
      for (const {el,skill} of skillButtons) {
        el.disabled = selection.remainingActionSlots === 0 || !legalSkill(hero,skill) || cost + skill.spCost > flow.sp || (!skill.multiCast && draft.queue?.some(a => a.skillId === skill.skillId));
        el.setAttribute('aria-pressed',String(draft.queue?.some(a=>a.skillId===skill.skillId)||false));
      }
      act.disabled = !available || !canUseHeroCommand(ctx, hero.uid) || !draft.queue?.length || !validCommand(hero, draft);
    };
    save();
    commitFullDraft=()=>{if(draft?.queue?.length && selectionBudget(hero,draft.queue).remainingActionSlots===0 && canUseHeroCommand(ctx,hero.uid))commit();};
    editor.onkeydown = event => { if (event.key === 'Escape') { event.stopPropagation(); closeEditor(); } };
    host.append(editor); attack.focus();
  }
  function execute(hero, command = prepared.get(hero.uid)) {
    if (!available || draft || gameState.heroCommandsMenuOpen) return false;
    const enemies = ctx.state.entities.filter(actor => actor.kind === 'enemy' && actor.hp > 0);
    const targetUID = command?.targetUID ?? ctx.state.globals.SelectedEnemyUID ?? enemies[0]?.uid;
    const next = { actorUID: hero.uid, skillId: 'HERO_SINGLE', ...copyCommand(command), targetUID };
    if (!validCommand(hero, next)) { auto = false; repeat = null; openEditor(hero); return false; }
    if (!executeHeroCommand(ctx, next)) { auto = false; repeat = null; return false; }
    previous.set(hero.uid, copyCommand(next)); prepared.delete(hero.uid); return true;
  }
  return {
    selectBattlefieldActor(actor) {
      if (!available || !actor || (actor.kind === 'enemy' && actor.hp <= 0)) return false;
      ctx.state.globals[actor.kind === 'enemy' ? 'SelectedEnemyUID' : 'SelectedAllyUID'] = actor.uid;
      refreshEditor?.();
      return true;
    },
    selectBattlefieldAlly(mx, my, project, scale) {
      const hero = members.find(actor => {
        if (!actor) return false;
        const point = ctx.state.globals.HeroPortraitPosByIndex?.[actor.heroDisplaySlot ?? actor.heroIndex];
        if (!point) return false;
        const pos = project(point.x, point.y, 'hero');
        return Math.abs(mx-pos.x)<=20*scale && Math.abs(my-pos.y)<=25*scale;
      });
      return hero ? this.selectBattlefieldActor(hero) : false;
    },
    playCurrent() {
      const actor = members.find(hero => hero && canUseHeroCommand(ctx, hero.uid));
      return actor ? execute(actor, { skillId: 'HERO_SINGLE' }) : false;
    },
    update({ visible, blocked, worldToCanvas, layoutScale, portraits }) {
      host.hidden = !visible;
      available = visible && !blocked;
      host.inert = !available;
      if (!visible) { auto = false; repeat = null; closeEditor(); gameState.heroCommandsMenuOpen = false; return; }
      const pos = worldToCanvas(6, 406), rect = canvas.getBoundingClientRect();
      host.style.left = `${rect.left + pos.x}px`; host.style.top = `${rect.top + pos.y}px`;
      host.style.transform = `scale(${layoutScale})`;
      const enemies = ctx.state.entities.filter(a => a.kind === 'enemy' && a.hp > 0);
      if (!enemies.some(a => a.uid === ctx.state.globals.SelectedEnemyUID)) ctx.state.globals.SelectedEnemyUID = enemies[0]?.uid || 0;
      const slots = getHeroCommandSlots(ctx.state.entities);
      if (sessionId !== ctx.state.globals.CombatSessionId || slots.some((hero, slot) => hero !== members[slot])) {
        closeEditor(); auto = false; repeat = null;
        if (sessionId !== ctx.state.globals.CombatSessionId || slots.some((hero, slot) => hero?.uid !== members[slot]?.uid)) { prepared.clear(); previous.clear(); }
        sessionId = ctx.state.globals.CombatSessionId;
        members = slots;
        cards.forEach((card, slot) => {
          card.replaceChildren(); for (const key of Object.keys(card.dataset)) delete card.dataset[key];
          const hero = slots[slot]; if (!hero) return;
          card.dataset.uid = hero.uid;
          const open = button(card, '', () => openEditor(hero)); open.className = 'hero-card'; open.dataset.open = ''; open.setAttribute('aria-label', `${heroName(hero)} actions`);
          const header = document.createElement('header');
          const face = document.createElement('span'); face.className = 'face';
          const image = document.createElement('img'); image.alt = ''; image.draggable = false; face.append(image);
          const name = document.createElement('strong'); name.textContent = heroName(hero); header.append(face, name);
          const health = document.createElement('div'); health.className = 'health';
          const hp = document.createElement('span'); hp.dataset.hp = ''; health.append(hp);
          const bar = document.createElement('progress'); bar.dataset.hpBar = ''; bar.setAttribute('aria-label', `${heroName(hero)} HP`); health.append(bar);
          const flow = document.createElement('div'); flow.className = 'flow'; flow.textContent = 'FLOW';
          const meter = document.createElement('progress'); meter.dataset.flow = ''; meter.setAttribute('aria-label', `${heroName(hero)} FLOW`); flow.append(meter);
          const sp = document.createElement('div'); sp.className = 'sp';
          const spText = document.createElement('span'); spText.dataset.sp = '';
          const spBar = document.createElement('progress'); spBar.dataset.spBar = ''; spBar.setAttribute('aria-label', `${heroName(hero)} SP`); sp.append(spText, spBar);
          header.append(flow);
          const vitals = document.createElement('div'); vitals.className = 'vitals'; vitals.append(health, sp);
          open.append(header, vitals);
        });
      }
      const scheduledUID = Number(ctx.callFunction('GetCurrentTurn'));
      cards.forEach((card, slot) => {
        const hero = slots[slot]; if (!hero) return;
        const current = hero.hp > 0 && scheduledUID === hero.uid, flow = getHeroFlowState(hero);
        card.dataset.current = String(current); card.dataset.ko = String(hero.hp <= 0); card.dataset.ready = String(flow.ready);
        const hpText = `HP ${Math.max(0, hero.hp)}/${hero.maxHP}`;
        const hpLabel = card.querySelector('[data-hp]'); if (hpLabel.textContent !== hpText) hpLabel.textContent = hpText;
        const bar = card.querySelector('[data-hp-bar]'); bar.max = Math.max(1, hero.maxHP); bar.value = Math.max(0, hero.hp);
        const flowBar = card.querySelector('[data-flow]'); flowBar.max = flow.max; flowBar.value = flow.value;
        card.querySelector('[data-sp]').textContent = `SP ${flow.sp}`;
        const spBar = card.querySelector('[data-sp-bar]'); spBar.max = flow.spMax; spBar.value = flow.sp;
        const image = portraits[hero.portraitName || hero.baseHeroName || hero.name];
        if (image?.src && card.querySelector('img').src !== image.src) card.querySelector('img').src = image.src;
        const open = card.querySelector('[data-open]'); open.setAttribute('aria-current', String(current)); open.disabled = !available || hero.hp <= 0 || !!draft || !!gameState.heroCommandsMenuOpen;
        open.setAttribute('aria-label', `${heroName(hero)} actions${current ? ', active' : ''}${flow.ready ? ', FLOW ready' : ''}`);
      });
      if (draft) {
        if (!members.some(hero => hero?.uid === draft.actorUID && hero.hp > 0)) closeEditor();
        else { refreshEditor?.(); commitFullDraft?.(); }
      }
      if (returnFocusUID && !draft) {
        cards.find(card => Number(card.dataset.uid) === returnFocusUID)?.querySelector('[data-open]')?.focus(); returnFocusUID = null;
      }
      autoButton.setAttribute('aria-pressed', String(auto)); repeatButton.setAttribute('aria-pressed', String(!!repeat));
      repeatButton.disabled = !previous.size || members.some(hero => hero?.hp > 0 && !previous.has(hero.uid));
      menuButton.setAttribute('aria-expanded', String(!!gameState.heroCommandsMenuOpen));
      if (repeat) for (const uid of repeat) if (!members.some(hero => hero?.uid === uid && hero.hp > 0)) repeat.delete(uid);
      if (available && !draft && (auto || repeat?.size)) {
        const actor = members.find(hero => hero && canUseHeroCommand(ctx, hero.uid));
        if (actor && (auto || repeat.has(actor.uid)) && execute(actor, repeat ? previous.get(actor.uid) : { skillId: 'HERO_SINGLE' })) repeat?.delete(actor.uid);
      }
      if (repeat && !repeat.size) repeat = null;
    },
    destroy() { host.remove(); style.remove(); },
  };
}
