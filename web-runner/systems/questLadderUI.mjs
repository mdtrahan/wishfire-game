// HTML controls share the Canvas reference frame; no additional image assets.
export function createQuestLadderUI({ canvas, gameState, layoutState, flow }) {
  const host = document.createElement('div');
  host.id = 'quest-ui';
  const style = document.createElement('style');
  style.textContent = `#quest-ui{position:fixed;width:360px;height:640px;transform-origin:top left;pointer-events:none;z-index:20;color:#423821;font:15px/1.4 system-ui}#quest-ui *{box-sizing:border-box}#quest-ui button{font:inherit;cursor:pointer;color:inherit;border:1px solid #b59456;background:#f2e4c2;border-radius:10px;padding:10px}#quest-ui button:focus-visible{outline:3px solid #71ede1;outline-offset:2px}#quest-ui button:disabled{filter:grayscale(.65);cursor:default}#quest-ui .screen{pointer-events:auto;position:absolute;inset:0 0 78px;background:transparent;padding:20px 20px 0;display:flex;flex-direction:column;gap:12px}#quest-ui h1{font:28px Georgia;margin:0;color:#574222}#quest-ui p{margin:0}#quest-ui .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#276b68}#quest-ui .wallet{display:flex;justify-content:space-between;background:#fff4dd;border-radius:8px;padding:10px;font-size:13px}#quest-ui .cards{width:calc(100% + 16px);overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#a68b54 transparent;min-height:0;flex:1;display:flex;flex-direction:column;gap:10px;padding:0}#quest-ui .cards::-webkit-scrollbar{width:4px}#quest-ui .cards::-webkit-scrollbar-thumb{background:#a68b54;border-radius:3px}#quest-ui .cards::-webkit-scrollbar-track{background:transparent}#quest-ui .card{width:320px;text-align:left;display:flex;gap:12px;align-items:center;height:56px;min-height:56px;padding:4px 10px;background:linear-gradient(130deg,#fff9e9,#e8d7b4);flex-shrink:0}#quest-ui .icon{font:34px Georgia;color:#387f7a;min-width:42px;text-align:center}#quest-ui .portrait{width:44px;height:44px;flex-shrink:0;overflow:hidden;border:1px solid #b59456;border-radius:4px;background:#dac89e}#quest-ui .portrait img{width:100%;height:100%;object-fit:cover;object-position:50% 15%;transform:scale(1.6);transform-origin:50% 15%}#quest-ui .card>span:last-child{line-height:1}#quest-ui .card small{line-height:14px;margin-top:2px}#quest-ui .card .eyebrow{display:block;line-height:11px;font-size:9px;letter-spacing:1px}#quest-ui .chapter{height:150px;min-height:150px;padding:18px;border:1px solid #b59456;border-radius:12px;background:linear-gradient(135deg,#fff8e8,#e4cfa5);display:flex;flex-direction:column;justify-content:center;gap:8px}#quest-ui .chapter h1{font-size:23px}#quest-ui .card strong{display:block;font-size:15px;line-height:1.2;color:#513e26}#quest-ui small{display:block;font-size:12px;color:#655b43;margin-top:3px}#quest-ui .shade{pointer-events:auto;position:absolute;inset:0;background:#070917a8;display:grid;place-items:center;padding:22px}#quest-ui .modal{width:100%;background:#fff4db;border:2px solid #bb995a;border-radius:18px;padding:24px 20px;box-shadow:0 20px 70px #0008}#quest-ui h2{font:27px Georgia;color:#574222;margin:0 0 18px}#quest-ui .actions{display:flex;gap:12px;margin-top:24px}#quest-ui .actions button{flex:1}#quest-ui .primary{background:#a8d1c3;border-color:#497e6e}#quest-ui .error{color:#9c3424;font-size:12px}#quest-ui .screen>.error:empty{display:none}#quest-ui .back{position:absolute;left:0;bottom:8px;margin:0;width:54px;height:38px;padding:3px 9px 3px 3px;border-radius:0 22px 22px 0;border:3px ridge #c3a679;background:linear-gradient(#866149,#432e24);box-shadow:0 2px 3px #0005}`;
  document.head.append(style); document.body.append(host);
  let signature = '';
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
    const key = JSON.stringify([e.phase,e.modal,e.progress,e.error,e.pending,layout]);
    if (key === signature) return;
    signature = key;
    let html = '';
    if (layout === 'storyMock' && e.phase === 'ladder') {
      html += `<section class="screen" aria-label="Quests"><div class="wallet"><span>Energy ${e.progress.energy}/100</span><span>Resources ${e.progress.resources}</span></div><header class="chapter"><div class="eyebrow">Quests</div><h1>Chapter 1</h1></header><div class="cards">`;
      for (let i = e.progress.revealed - 1; i >= 0; i--) {
        const c = e.cards[i], done = e.progress.completed.includes(c.id);
        html += `<button class="card" data-action="card:${i}">${c.thumbnail ? `<span class="portrait"><img src="${c.thumbnail}" alt="${c.enemyName}"></span>` : `<span class="icon" aria-hidden="true">☾</span>`}<span><span class="eyebrow">${done ? 'Complete' : 'New'}</span><strong>${c.title}</strong><small>Energy ${c.cost} · ${done ? 'Reward claimed' : `First clear +${c.reward}`}</small></span></button>`;
      }
      html += `</div><p class="error" role="status">${e.error || ''}</p><button class="back" data-action="nav:Map" aria-label="Back"><svg viewBox="0 0 48 32" width="34" height="26" aria-hidden="true"><path d="M19 5 5 15l14 9v-6h12c9 0 9 9 0 9H18v4h14C50 31 49 11 32 11H19Z" fill="#f6dc80" stroke="#7b5826" stroke-width="1.5"/></svg></button></section>`;
    }
    if (e.modal === 'skip') html += `<div class="shade"><section class="modal" role="dialog" aria-modal="true" aria-label="Skip story"><h2>Skip story?</h2><p>Are you sure you want to skip this story?</p><div class="actions">${button('Cancel','cancel')}${button('Skip','skip','primary')}</div></section></div>`;
    if (e.phase === 'defeat') html += `<div class="shade"><section class="modal" role="dialog" aria-modal="true" aria-label="Continue battle"><h2>Continue?</h2><div class="wallet"><span>Resources ${e.progress.resources}</span><span>Cost 30</span></div><p class="error" role="status">${e.error || ''}</p><div class="actions">${button('Quit','quit')}${button('Continue · 30','continue','primary')}</div></section></div>`;
    if (e.phase === 'defeat' && !host.style.backgroundImage) host.style.backgroundImage = `url(${canvas.toDataURL()})`;
    if (e.phase !== 'defeat') host.style.backgroundImage = '';
    host.style.backgroundSize = '100% 100%';
    host.innerHTML = html;
    if (e.pending) host.querySelectorAll('button').forEach(b => b.disabled = true);
    if (e.modal || e.phase === 'defeat') host.querySelector('button')?.focus({preventScroll:true});
  }
  return { update };
}
