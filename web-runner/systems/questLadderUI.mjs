import {BACK_ICON,resourceChromeCSS,resourceStrip} from './resourceChrome.mjs';
import { CHAPTER_ONE_MAP } from './chapterMapPresentation.mjs';

// HTML controls share the Canvas reference frame.
export function createQuestLadderUI({ canvas, gameState, layoutState, flow, getGold }) {
  const host = document.createElement('div');
  host.id = 'quest-ui';
  const style = document.createElement('style');
  style.textContent = `#quest-ui{position:fixed;width:360px;height:640px;transform-origin:top left;pointer-events:none;z-index:20;color:#423821;font:15px/1.4 system-ui}#quest-ui *{box-sizing:border-box}#quest-ui button{font:inherit;cursor:pointer;color:inherit;border:1px solid #b59456;background:#f2e4c2;border-radius:10px;padding:10px}#quest-ui button:focus-visible{outline:3px solid #71ede1;outline-offset:2px}#quest-ui button:disabled{filter:grayscale(.65);cursor:default}#quest-ui .screen{pointer-events:auto;position:absolute;inset:0 0 78px;background:transparent;padding:92px 20px 0;display:flex;flex-direction:column;gap:12px}#quest-ui h1{font:28px Georgia;margin:0;color:#574222}#quest-ui p{margin:0}#quest-ui .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#276b68}#quest-ui .wallet{display:flex;justify-content:space-between;background:#fff4dd;border-radius:8px;padding:10px;font-size:13px}#quest-ui .cards{width:calc(100% + 16px);overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#a68b54 transparent;min-height:0;flex:1;display:flex;flex-direction:column;gap:10px;padding:8px 0 0;margin-top:-8px}#quest-ui .cards::-webkit-scrollbar{width:4px}#quest-ui .cards::-webkit-scrollbar-thumb{background:#a68b54;border-radius:3px}#quest-ui .cards::-webkit-scrollbar-track{background:transparent}#quest-ui .card{width:320px;text-align:left;display:flex;gap:12px;align-items:center;height:56px;min-height:56px;position:relative;padding:4px 8px;background:linear-gradient(130deg,#fff9e9,#e8d7b4);border:2px ridge #c6ab65;border-radius:4px;flex-shrink:0}#quest-ui .icon{font:34px Georgia;color:#387f7a;min-width:42px;text-align:center}#quest-ui .portrait{width:44px;height:44px;flex-shrink:0;overflow:hidden;border:1px solid #b59456;border-radius:4px;background:#dac89e}#quest-ui .portrait img{width:100%;height:100%;object-fit:cover;object-position:50% 15%;transform:scale(1.6);transform-origin:50% 15%}#quest-ui .card-copy{line-height:1;flex:1;min-width:0}#quest-ui .card>.eyebrow{position:absolute;left:2px;top:-8px;color:#fff0af;font-size:10px;font-weight:bold;text-shadow:0 1px 2px #4c381b}#quest-ui .reward{position:relative;flex:none;width:44px;height:44px;border:1px solid #a18a5e;border-radius:3px;background:#efe5cc;display:flex;align-items:center;flex-direction:column;justify-content:flex-start;padding-top:1px;font:bold 10px sans-serif}#quest-ui .reward .resource-symbol{font-size:20px;line-height:20px}#quest-ui .reward b{position:absolute;right:2px;top:5px;color:#d52224;font:bold 29px sans-serif;text-shadow:0 1px 1px #fff}#quest-ui .reward.claimed{background:#aba596}#quest-ui .reward small{position:absolute;bottom:-3px;background:#efd181;border:1px solid #9f8045;border-radius:2px;font:9px sans-serif;line-height:11px;white-space:nowrap;padding:0 2px;color:#463717}#quest-ui .reward .quantity{position:relative;top:-1px;line-height:10px}#quest-ui .story-book{width:44px;height:44px;flex:none;display:grid;place-items:center;background:#deca9f;border-radius:3px}#quest-ui .story-book svg{width:34px;height:34px}#quest-ui .card small{line-height:14px;margin-top:2px}#quest-ui .card .eyebrow{display:block;line-height:11px;font-size:9px;letter-spacing:1px}#quest-ui .chapter{position:relative;height:140px;min-height:140px;padding:12px;border:3px ridge #cfb16a;border-radius:4px;background:linear-gradient(135deg,#fff8e8,#e4cfa5);display:flex;flex-direction:column;align-items:center;justify-content:space-between;margin-bottom:8px}#quest-ui .chapter h1{position:relative;z-index:1;font:bold 18px sans-serif;color:#513e26;text-shadow:none;text-align:center}#quest-ui .chapter-progress{z-index:1;width:90%;text-align:center;font:bold 11px sans-serif;color:#48371e}#quest-ui .chapter-progress progress{display:block;width:100%;height:8px;accent-color:#d8ab35}#quest-ui .card strong{display:block;font-size:15px;line-height:1.2;color:#513e26}#quest-ui small{display:block;font-size:12px;color:#655b43;margin-top:3px}#quest-ui .shade{pointer-events:auto;position:absolute;inset:0;background:#070917a8;display:grid;place-items:center;padding:22px}#quest-ui .modal{width:100%;background:#fff4db;border:2px solid #bb995a;border-radius:18px;padding:24px 20px;box-shadow:0 20px 70px #0008}#quest-ui h2{font:27px Georgia;color:#574222;margin:0 0 18px}#quest-ui .actions{display:flex;gap:12px;margin-top:24px}#quest-ui .actions button{flex:1}#quest-ui .primary{background:#a8d1c3;border-color:#497e6e}#quest-ui .error{color:#9c3424;font-size:12px}#quest-ui .screen>.error:empty{display:none}`;
  style.textContent += `#quest-ui .defeat-shade{background:#000;animation:quest-blackout .5s both}#quest-ui .defeat-message{position:absolute;color:#fff;text-align:center;width:100%;font:24px Georgia;animation:quest-defeat-message 2s both}#quest-ui .defeat-shade .modal{animation:quest-continue .3s 2s both}@keyframes quest-blackout{from{background:#0000}to{background:#000}}@keyframes quest-defeat-message{0%,20%{opacity:0}35%,85%{opacity:1}100%{opacity:0;visibility:hidden}}@keyframes quest-continue{from{opacity:0;visibility:hidden}to{opacity:1;visibility:visible}}`;
  style.textContent += resourceChromeCSS("#quest-ui")+"#quest-ui .back{font-size:14px;bottom:-3px}#quest-ui .back svg{width:2.43em;height:1.86em}";
  document.head.append(style); document.body.append(host);
  let signature = '';
  host.addEventListener('animationend', event => {
    if (event.animationName === 'quest-continue') host.querySelector('button')?.focus({preventScroll:true});
  });
  const button = (label, action, className = '') => `<button class="${className}" data-action="${action}">${label}</button>`;
  host.addEventListener('keydown', event => {
    if (!gameState.storyEntry.modal && gameState.storyEntry.phase !== 'defeat') return;
    if (event.key === 'Escape' && gameState.storyEntry.modal === 'skip') { event.preventDefault(); flow.cancelSkip(); update(); }
    if (event.key === 'Tab') {
      const buttons = [...host.querySelectorAll('button:not(:disabled)')];
      const index = buttons.indexOf(document.activeElement);
      if (buttons.length) { event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus(); }
    }
  });
  host.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target || gameState.storyEntry.pending) return;
    const action = target.dataset.action;
    if (action.startsWith('card:')) flow.startCard(Number(action.slice(5)));
    else if (action.startsWith('nav:')) void flow.navigate(action.slice(4));
    else if (action === 'cancel') flow.cancelSkip();
    else if (action === 'skip') flow.confirmSkip();
    else if (action === 'continue') void flow.continueCombat();
    else if (action === 'quit') flow.quit();
    update();
  });
  function update() {
    const e = gameState.storyEntry;
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 360, rect.height / 640);
    host.style.left = `${rect.left + (rect.width - 360 * scale) / 2}px`;
    host.style.top = `${rect.top + (rect.height - 640 * scale) / 2}px`;
    host.style.transform = `scale(${scale})`;
    const layout = layoutState.getActiveLayoutId();
    const gold = getGold();
    const key = JSON.stringify([e.cards.length,gold,e.phase,e.modal,e.progress,e.error,e.pending,layout,CHAPTER_ONE_MAP.chapter.text]);
    if (key === signature) return;
    signature = key;
    let html = '';
    if (layout === 'storyMock' && ['map', 'ladder'].includes(e.phase)) {
      html += resourceStrip({gold,...e.progress});
    }
    if (layout === 'storyMock' && e.phase === 'ladder') {
      html += `<section class="screen" aria-label="Quests"><header class="chapter"><h1>${CHAPTER_ONE_MAP.chapter.text}</h1><div class="chapter-progress"><progress value="${e.progress.completed.length}" max="${e.cards.length}" aria-label="Completed sub-chapters"></progress>${e.progress.completed.length}/${e.cards.length}</div></header><div class="cards">`;
      for (let i = e.progress.revealed - 1; i >= 0; i--) {
        const c = e.cards[i], done = e.progress.completed.includes(c.id);
        html += `<button class="card" data-action="card:${i}">${c.thumbnail ? `<span class="portrait"><img src="${c.thumbnail}" alt="${c.enemyName}"></span>` : `<span class="story-book" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M3 7Q12 4 19 10V34Q12 28 3 31ZM37 7Q28 4 21 10V34Q28 28 37 31Z" fill="#967342"/><path d="M1 10V34Q11 31 20 37Q29 31 39 34V10" fill="none" stroke="#967342" stroke-width="2"/></svg></span>`}<span class="eyebrow">${done ? 'Complete' : 'New'}</span><span class="card-copy"><strong>${c.title}</strong>${c.cost > 0 ? `<small><span class="energy-symbol" aria-hidden="true">ϟ</span> ${c.cost}</small>` : ''}</span><span class="reward ${done ? 'claimed' : ''}" aria-label="${done ? 'Reward claimed' : `First clear +${c.reward}`}"><span class="resource-symbol" aria-hidden="true">◆</span><span class="quantity">×${c.reward}</span>${done ? '<b aria-hidden="true">✓</b>' : ''}<small>1st Clear</small></span></button>`;
      }
      html += `</div><p class="error" role="status">${e.error || ''}</p><button class="back" data-action="nav:Map" aria-label="Back">${BACK_ICON}</button></section>`;
    }
    if (e.modal === 'skip') html += `<div class="shade"><section class="modal" role="dialog" aria-modal="true" aria-label="Skip story"><h2>Skip story?</h2><p>Are you sure you want to skip this story?</p><div class="actions">${button('Cancel','cancel')}${button('Skip','skip','primary')}</div></section></div>`;
    if (e.phase === 'defeat') html += `<div class="shade defeat-shade"><div class="defeat-message" role="status">Heroes were defeated</div><section class="modal" role="dialog" aria-modal="true" aria-label="Continue battle"><h2>Continue?</h2><p>Revive all heroes with full HP. Keep your skills, buffs, and battle progress.</p><div class="wallet"><span>Resources ${e.progress.resources}</span><span>Cost 30</span></div><p class="error" role="status">${e.error || ''}</p><div class="actions">${button('Quit','quit')}${button('Continue · 30','continue','primary')}</div></section></div>`;
    if (e.phase === 'defeat' && !host.style.backgroundImage) host.style.backgroundImage = `url(${canvas.toDataURL()})`;
    if (e.phase !== 'defeat') host.style.backgroundImage = '';
    host.style.backgroundSize = '100% 100%';
    host.innerHTML = html;
    if (e.pending) host.querySelectorAll('button').forEach(b => b.disabled = true);
    if (e.modal || e.phase === 'defeat') host.querySelector('button')?.focus({preventScroll:true});
  }
  return { update };
}
