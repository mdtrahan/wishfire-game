const RESOURCE_ICONS = Object.freeze({
  incense: 'assets/images/progression/incense.png',
  essence: 'assets/images/lamp/essence-orb.png',
});
const RESOURCE_NAMES = Object.freeze({ incense: 'Incense', essence: 'Essence', hero_ticket: 'Hero tickets' });
const TICKET_QUADRANT = Object.freeze({ Fara: '0% 0%', Hondo: '100% 0%', Kaja: '0% 100%', Runa: '100% 100%' });
const STYLE_ID = 'reward-receipt-style';
const FANFARE_PARTICLES = Object.freeze([
  ['star', -.66, -.24, -.98, -.82, 12, 780], ['star', -.25, -.66, -.48, -1.05, 10, 840],
  ['star', .22, -.66, .55, -1.04, 14, 900], ['star', .66, -.24, .98, -.78, 11, 800],
  ['star', .66, .08, 1.04, -.32, 13, 880], ['star', .62, .50, .98, .12, 10, 820],
  ['star', -.66, .08, -.98, -.34, 11, 860], ['star', -.62, .50, -.96, .14, 10, 760],
  ['speck', -.42, -.68, -.74, -1.06, 4, 790], ['speck', .40, -.68, .78, -1.08, 5, 870],
  ['speck', -.68, .26, -1.04, -.04, 4, 830], ['speck', .68, .28, 1.05, -.06, 5, 890],
]);

function installStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .lamp-reward-banner{position:fixed;z-index:66;box-sizing:border-box;pointer-events:none;color:#fff1bf;text-align:center;font-family:system-ui,sans-serif;background:linear-gradient(90deg,#5e431ab8,#80602cd9,#5e431ab8);border-block:2px solid #d6b770;box-shadow:0 3px 16px #0005;padding:.35em 0 .5em;animation:lamp-reward-out var(--reward-duration,2s) linear forwards}
    .lamp-reward-banner>strong{position:relative;z-index:2;display:block;letter-spacing:.05em;text-shadow:0 2px 3px #211506;font-size:1em}
    .lamp-reward-banner>div{position:relative;isolation:isolate;display:grid;justify-items:center;margin:.2em auto 0;width:3.5em;border:1px solid #d9bc77;border-radius:.3em;background:#183c3dd9}
    .lamp-reward-banner>div>img,.lamp-reward-banner>div>b,.lamp-reward-banner>div>.lamp-reward-ticket-art{position:relative;z-index:1}
    .lamp-reward-banner img{display:block;width:3em;height:3em;object-fit:contain}
    .lamp-reward-banner .lamp-reward-ticket-art{width:3em;height:2em;margin:.5em 0;background-image:url('assets/images/progression/hero-tickets.png');background-size:200% 200%;background-repeat:no-repeat}
    .lamp-reward-banner b{font-size:1.1em;line-height:1.2;padding:0 .15em .15em;text-shadow:0 2px 2px #000}
    .reward-fanfare{position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:0}
    .reward-fanfare-particle{position:absolute;left:calc(50% + var(--fanfare-start-x));top:calc(50% + var(--fanfare-start-y));display:block;width:var(--fanfare-size);height:var(--fanfare-size);opacity:0;animation:reward-fanfare-sweep var(--fanfare-duration) linear both}
    .reward-fanfare-star{background:linear-gradient(135deg,#fffbe0,#f5c54e);clip-path:polygon(50% 0,59% 41%,100% 50%,59% 59%,50% 100%,41% 59%,0 50%,41% 41%);filter:drop-shadow(0 0 2px #ffdc74)}
    .reward-fanfare-speck{border-radius:50%;background:#fff8d5;box-shadow:0 0 3px #f2c64f}
    @keyframes reward-fanfare-sweep{0%{opacity:0;transform:translate(-50%,-50%) scale(.8)}8%{opacity:1;transform:translate(-50%,-50%) scale(1)}65%{opacity:.95;transform:translate(calc(-50% + var(--fanfare-mid-x)),calc(-50% + var(--fanfare-mid-y))) scale(1)}100%{opacity:0;transform:translate(calc(-50% + var(--fanfare-x)),calc(-50% + var(--fanfare-y))) scale(.72)}}
    @keyframes lamp-reward-out{0%,92.3077%{opacity:1}100%{opacity:0}}
  `;
  doc.head.append(style);
}

function resourceLabel(receipt) {
  const name = RESOURCE_NAMES[receipt.resource] || 'Reward';
  return receipt.resource === 'hero_ticket' && receipt.heroName ? `${receipt.heroName} ${name}` : name;
}

export function createRewardReceiptPresenter(doc = globalThis.document, timers = globalThis, reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
  let active = null;
  let timer = null;
  let fanfare = null;
  let fanfareTimer = null;

  function showFanfare(anchor, origin = anchor) {
    if (!anchor || reducedMotion()) return null;
    installStyle(doc);
    const bounds = origin?.getBoundingClientRect?.(), hostBounds = anchor.getBoundingClientRect?.();
    if (!bounds || !hostBounds) return null;
    fanfareTimer !== null && timers.clearTimeout(fanfareTimer);
    fanfare?.remove();
    const node = doc.createElement('span');
    node.className = 'reward-fanfare';
    node.setAttribute('aria-hidden', 'true');
    const spreadScale = 1.15;
    const viewportWidth = doc.documentElement?.clientWidth || doc.body?.clientWidth || 0;
    const edgeRoom = bounds.width * spreadScale * .66 + 10;
    const horizontalBias = viewportWidth && bounds.left + bounds.width / 2 < edgeRoom ? 1
      : viewportWidth && viewportWidth - bounds.right < edgeRoom ? -1 : 0;
    Object.assign(node.style, { left: `${bounds.left - hostBounds.left + bounds.width / 2}px`, top: `${bounds.top - hostBounds.top + bounds.height / 2}px` });
    const scale = Math.min(1.25, Math.max(.85, bounds.width / 48));
    for (const [type, startX, startY, endX, endY, size, duration] of FANFARE_PARTICLES) {
      const particle = doc.createElement('i');
      particle.className = `reward-fanfare-particle reward-fanfare-${type}`;
      particle.setAttribute('aria-hidden', 'true');
      const launchX = horizontalBias ? Math.abs(startX) * horizontalBias : startX;
      const travelX = horizontalBias ? Math.abs(endX - startX) * horizontalBias : endX - startX;
      const x = travelX * bounds.width * spreadScale;
      const y = (endY - startY) * bounds.height * spreadScale;
      particle.style.setProperty('--fanfare-start-x', `${launchX * bounds.width * spreadScale}px`);
      particle.style.setProperty('--fanfare-start-y', `${startY * bounds.height * spreadScale}px`);
      particle.style.setProperty('--fanfare-x', `${x}px`);
      particle.style.setProperty('--fanfare-y', `${y}px`);
      particle.style.setProperty('--fanfare-mid-x', `${x * .82}px`);
      particle.style.setProperty('--fanfare-mid-y', `${y * .82}px`);
      particle.style.setProperty('--fanfare-size', `${size * scale}px`);
      particle.style.setProperty('--fanfare-duration', `${duration}ms`);
      node.append(particle);
    }
    fanfare = node;
    anchor.append(node);
    fanfareTimer = timers.setTimeout(() => {
      if (fanfare !== node) return;
      node.remove(); fanfare = null; fanfareTimer = null;
    }, 950);
    return node;
  }

  function position(canvas) {
    if (!active) return;
    const bounds = canvas?.getBoundingClientRect?.();
    if (!bounds) return;
    const scale = bounds.width / 360;
    Object.assign(active.style, {
      left: `${bounds.left}px`, top: `${bounds.top + bounds.height * .38}px`,
      width: `${bounds.width}px`, fontSize: `${Math.max(12, 18 * scale)}px`,
    });
  }

  function show(canvas, receipt, title = 'REWARD', durationMs = 2000) {
    if (!doc?.body || !receipt || !['incense', 'essence', 'hero_ticket'].includes(receipt.resource)) return null;
    installStyle(doc);
    if (timer !== null) timers.clearTimeout(timer);
    active?.remove();
    const label = resourceLabel(receipt);
    const amount = Math.max(0, Math.floor(Number(receipt.amount) || 0));
    const node = doc.createElement('section');
    node.className = 'lamp-reward-banner';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-label', `${title}: ${amount} ${label}`);
    node.setAttribute('aria-live', 'polite');
    node.style.setProperty('--reward-duration', `${durationMs}ms`);
    const heading = doc.createElement('strong');
    heading.textContent = title;
    const reward = doc.createElement('div');
    const icon = receipt.resource === 'hero_ticket' ? doc.createElement('span') : doc.createElement('img');
    if (receipt.resource === 'hero_ticket') {
      icon.className = 'lamp-reward-ticket-art';
      icon.setAttribute('aria-hidden', 'true');
      icon.style.backgroundPosition = TICKET_QUADRANT[receipt.heroName] || '0% 0%';
    } else {
      icon.src = RESOURCE_ICONS[receipt.resource];
      icon.alt = label;
    }
    const count = doc.createElement('b');
    count.textContent = new Intl.NumberFormat('en').format(amount);
    reward.append(icon, count);
    node.append(heading, reward);
    active = node;
    doc.body.append(node);
    position(canvas);
    timer = timers.setTimeout(() => {
      if (active !== node) return;
      node.remove();
      active = null;
      timer = null;
    }, durationMs);
    showFanfare(reward, icon);
    return node;
  }

  return { show, showFanfare, position, isVisible: () => !!active };
}

const rewardReceiptPresenter = createRewardReceiptPresenter();
export function showRewardReceipt(canvas, receipt, title = 'REWARD', durationMs) { return rewardReceiptPresenter.show(canvas, receipt, title, durationMs); }
export function positionRewardReceipt(canvas) { rewardReceiptPresenter.position(canvas); }
export function isRewardReceiptVisible() { return rewardReceiptPresenter.isVisible(); }
