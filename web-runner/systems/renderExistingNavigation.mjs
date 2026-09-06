// One accessible meta menu, positioned in the same reference frame as the Canvas.
let host;
const items = [
  ['DAILY', 'Daily', 'daily'], ['HERO', 'Hero', 'hero'],
  ['QUESTS', 'Quests', 'quests'], ['VAULT', 'Vault', 'vault'],
  ['SHOP', 'Shop', 'shop'], ['FLOW', 'AstralFlow', 'flow'],
];
export function renderExistingNavigation(ctx, { worldToCanvas, layoutScale, gameState, layoutState, eventBus }) {
  gameState.sharedNavHitZones = [];
  if (!host) {
    host = document.createElement('nav');
    host.id = 'game-meta-nav';
    host.setAttribute('aria-label', 'Game navigation');
    const style = document.createElement('style');
    style.textContent = `
      #game-meta-nav{position:fixed;display:flex;width:360px;height:60px;box-sizing:border-box;transform-origin:top left;z-index:19;padding:3px 4px 2px;gap:2px;border-top:3px ridge #c9a359;background:linear-gradient(#414345,#242729);box-shadow:0 -2px 5px #181b1c66}
      #game-meta-nav[hidden]{display:none}
      #game-meta-nav button{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:0;border:1px solid transparent;border-radius:17px 17px 5px 5px;background:transparent;color:#fff7e6;text-shadow:0 1px 2px #000;font:800 9px/11px system-ui;letter-spacing:.25px;cursor:pointer}
      #game-meta-nav img{width:43px;height:40px;object-fit:contain;filter:drop-shadow(0 1px 1px #61442255);pointer-events:none}
      #game-meta-nav button[aria-current=page]{background:radial-gradient(ellipse 25px 23px at 50% 21px,#7cf5e3bb 0%,#52d9c660 40%,transparent 75%);color:#fff}
      #game-meta-nav button[aria-current=page] img{filter:drop-shadow(0 0 4px #70ffdf)}
      #game-meta-nav button:focus-visible{outline:2px solid #247e79;outline-offset:-2px}
      #game-meta-nav button:disabled{cursor:default;color:#bfbcb4}
    `;
    document.head.append(style);
    for (const [text, label, asset] of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `<img src="assets/images/navigation/${asset}.png" alt="" draggable="false"><span>${text}</span>`;
      button.onclick = () => eventBus.emit('nav:clicked', { label });
      if (['Daily', 'Shop'].includes(label)) button.title = `${text} is not available yet`;
      host.append(button);
    }
    document.body.append(host);
  }
  const entry = gameState.storyEntry;
  host.hidden = entry.phase === 'opening';
  host.inert = host.hidden || !!entry.pending || !!entry.modal || entry.phase === 'defeat';
  const canvasRect = ctx.canvas.getBoundingClientRect();
  const pos = worldToCanvas(0, 580);
  host.style.left = `${canvasRect.left + pos.x}px`;
  host.style.top = `${canvasRect.top + pos.y}px`;
  host.style.transform = `scale(${layoutScale})`;
  const active = { heroLayout: 'Hero', chestsLayout: 'Vault', idleFarmLayout: 'AstralFlow', storyMock: 'Quests', combat: 'Quests' }[layoutState.getActiveLayoutId()];
  [...host.children].forEach((button, index) => {
    button.disabled = host.inert || ['Daily', 'Shop'].includes(items[index][1]);
    if (items[index][1] === active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
