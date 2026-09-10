const FAN_WIDTH = 348;
const FAN_HEIGHT = 190;
const FAN_LEFT = 6;
const FAN_TOP = 208;
const SAFE_GUTTER = 8;

export const HERO_TURN_CARD_FAN_REFERENCE = Object.freeze({
  width: FAN_WIDTH,
  height: FAN_HEIGHT,
  left: FAN_LEFT,
  top: FAN_TOP,
  cardWidth: 116,
  cardHeight: 148,
});

export const RARITY_COLORS = Object.freeze({
  Common: '#737783',
  Rare: '#286ea8',
  Epic: '#8255ad',
  Legendary: '#a76b17',
});

const asText = value => String(value ?? '').trim();

function cardId(card) {
  return asText(card?.id ?? card?.cardId ?? card?.name);
}

function isFortune(card) {
  const kind = asText(card?.kind ?? card?.type ?? card?.cardType).toLowerCase();
  return kind === 'fortune' || kind === 'fortune_card' || asText(card?.category).toLowerCase() === 'fortune';
}

export function normalizeHeroTurnCards(cards = []) {
  const result = [];
  const seen = new Set();
  for (const card of Array.isArray(cards) ? cards : []) {
    const id = cardId(card);
    const name = asText(card?.name ?? card?.displayName ?? id);
    const nameKey = name.toLocaleLowerCase();
    if (!id || !name || isFortune(card) || seen.has(nameKey)) continue;
    seen.add(nameKey);
    result.push({
      ...card,
      id,
      name,
      rarity: asText(card.rarity || 'Common'),
      effect: asText(card.effect ?? card.effectText ?? card.description),
      tempo: asText(card.tempo ?? card.metadata?.tempo),
    });
    if (result.length === 3) break;
  }
  return result;
}

export function computeHeroTurnFanLayout({
  canvasRect = {},
  layoutScale = 1,
  viewportWidth,
  viewportHeight,
} = {}) {
  const requestedScale = Math.max(0.01, Number(layoutScale) || 1);
  const left = Number(canvasRect.left) || 0;
  const top = Number(canvasRect.top) || 0;
  const width = Number(canvasRect.width) || FAN_WIDTH * requestedScale;
  const height = Number(canvasRect.height) || 640 * requestedScale;
  const viewWidth = Number(viewportWidth) || (typeof window !== 'undefined' ? window.innerWidth : left + width);
  const viewHeight = Number(viewportHeight) || (typeof window !== 'undefined' ? window.innerHeight : top + height);
  const availableWidth = Math.max(1, Math.min(width - SAFE_GUTTER * 2, viewWidth - SAFE_GUTTER * 2));
  const scale = Math.min(requestedScale, availableWidth / FAN_WIDTH);
  const renderedWidth = FAN_WIDTH * scale;
  const renderedHeight = FAN_HEIGHT * scale;
  const canvasRight = left + width;
  const canvasBottom = top + height;
  const maxLeft = Math.max(SAFE_GUTTER, Math.min(canvasRight - renderedWidth, viewWidth - renderedWidth - SAFE_GUTTER));
  const minLeft = Math.max(SAFE_GUTTER, Math.min(left + SAFE_GUTTER, maxLeft));
  const preferredTop = top + FAN_TOP * scale;
  const maxTop = Math.min(canvasBottom - renderedHeight - SAFE_GUTTER, viewHeight - renderedHeight - SAFE_GUTTER);
  const minTop = top + SAFE_GUTTER;
  return {
    left: Math.round(minLeft),
    top: Math.round(Math.max(minTop, Math.min(preferredTop, maxTop))),
    width: renderedWidth,
    height: renderedHeight,
    scale,
  };
}

const STYLE = `
  #hero-turn-card-fan{position:fixed;box-sizing:border-box;width:${FAN_WIDTH}px;height:${FAN_HEIGHT}px;color:#fff;z-index:28;pointer-events:none;transform-origin:top left;font:600 12px/1.15 system-ui,sans-serif;filter:drop-shadow(0 4px 8px #000b)}
  #hero-turn-card-fan[hidden]{display:none}
  #hero-turn-card-fan.is-opening{animation:hero-turn-fan-open 220ms cubic-bezier(.22,.8,.25,1) both}
  #hero-turn-card-fan.is-closing{animation:hero-turn-fan-close 170ms ease-in both;pointer-events:none}
  @keyframes hero-turn-fan-open{from{opacity:0}to{opacity:1}}
  @keyframes hero-turn-fan-close{from{opacity:1}to{opacity:0}}
  #hero-turn-card-fan.is-opening .fan-card[data-slot="left"]{animation:hero-turn-card-left-in 220ms cubic-bezier(.22,.8,.25,1) both}
  #hero-turn-card-fan.is-opening .fan-card[data-slot="center"]{animation:hero-turn-card-center-in 220ms cubic-bezier(.22,.8,.25,1) both}
  #hero-turn-card-fan.is-opening .fan-card[data-slot="right"]{animation:hero-turn-card-right-in 220ms cubic-bezier(.22,.8,.25,1) both}
  #hero-turn-card-fan.is-closing .fan-card{animation:hero-turn-card-out 170ms ease-in both}
  @keyframes hero-turn-card-left-in{from{transform:rotate(0) translateY(30px)}to{transform:rotate(-7deg) translateY(8px)}}
  @keyframes hero-turn-card-center-in{from{transform:rotate(0) translateY(25px)}to{transform:rotate(0)}}
  @keyframes hero-turn-card-right-in{from{transform:rotate(0) translateY(30px)}to{transform:rotate(7deg) translateY(8px)}}
  @keyframes hero-turn-card-out{to{transform:rotate(0) translateY(25px)}}
  #hero-turn-card-fan .fan-card{position:absolute;top:9px;width:116px;height:148px;padding:8px 8px 7px;border:2px solid var(--rarity,#737783);border-radius:9px;color:#fff;background:linear-gradient(155deg,#263345f2,#0b1019f5 65%,#06080c);box-shadow:inset 0 0 0 1px #ffffff22,0 4px 7px #000b;display:flex;flex-direction:column;gap:5px;text-align:left;pointer-events:auto;cursor:pointer;overflow:hidden;transition:filter 120ms ease,box-shadow 120ms ease,transform 120ms ease}
  #hero-turn-card-fan .fan-card[data-slot="left"]{left:4px;transform:rotate(-7deg) translateY(8px);z-index:1}
  #hero-turn-card-fan .fan-card[data-slot="center"]{left:116px;top:2px;transform:rotate(0);z-index:3}
  #hero-turn-card-fan .fan-card[data-slot="right"]{left:228px;transform:rotate(7deg) translateY(8px);z-index:1}
  #hero-turn-card-fan .fan-card:hover,#hero-turn-card-fan .fan-card:focus-visible{filter:brightness(1.18);box-shadow:0 0 0 2px #6ee7f8,0 5px 12px #000d;outline:0}
  #hero-turn-card-fan .fan-card[data-selected="true"]{border-color:#f7e19b;box-shadow:0 0 0 3px #f7e19b,0 0 18px #f7c84a;filter:brightness(1.2);z-index:5}
  #hero-turn-card-fan .fan-card:disabled{cursor:default}
  #hero-turn-card-fan .fan-card-name{display:block;min-height:28px;font-size:13px;line-height:1.05;white-space:normal;overflow:hidden}
  #hero-turn-card-fan .fan-card-rarity{color:var(--rarity);font-size:10px;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
  #hero-turn-card-fan .fan-card-effect{margin-top:auto;min-height:29px;font-size:10px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #hero-turn-card-fan .fan-card-tempo{color:#a9d9df;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #hero-turn-card-fan .fan-hero{position:absolute;left:50%;bottom:0;display:flex;align-items:center;gap:6px;transform:translateX(-50%);padding:3px 8px 3px 3px;border:1px solid #4dd4e9aa;border-radius:24px;background:#07111ce8;pointer-events:none;white-space:nowrap}
  #hero-turn-card-fan .fan-hero-portrait{width:30px;height:30px;border:2px solid #64e6f5;border-radius:50%;background:#12344a;object-fit:cover;animation:hero-turn-fan-pulse 1.3s ease-in-out infinite}
  @keyframes hero-turn-fan-pulse{50%{box-shadow:0 0 0 4px #54e3f444,0 0 13px #54e3f4}}
  #hero-turn-card-fan .fan-hero-name{font-size:10px;text-transform:uppercase}
  #hero-turn-card-fan .fan-targets{position:absolute;left:0;right:0;bottom:-1px;display:flex;justify-content:center;gap:5px;pointer-events:auto}
  #hero-turn-card-fan .fan-targets[hidden]{display:none}
  #hero-turn-card-fan .fan-target{min-height:32px;max-width:108px;padding:5px 8px;border:2px solid #efc76e;border-radius:7px;background:#201a12f5;color:#fff;font:600 11px/1 system-ui,sans-serif;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #hero-turn-card-fan .fan-target:focus-visible{outline:2px solid #64d4ee;outline-offset:2px}
  #hero-turn-card-fan .fan-back{position:absolute;right:4px;bottom:1px;min-height:32px;padding:5px 8px;border:1px solid #a9d9df;border-radius:7px;background:#07111ce8;color:#fff;font:600 11px/1 system-ui,sans-serif;pointer-events:auto;cursor:pointer}
  #hero-turn-card-fan .fan-back[hidden]{display:none}
  @media(prefers-reduced-motion:reduce){#hero-turn-card-fan.is-opening,#hero-turn-card-fan.is-closing,#hero-turn-card-fan .fan-card{animation-duration:1ms}#hero-turn-card-fan .fan-hero-portrait{animation:none}}
`;

function safeText(parent, className, value) {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = value;
  parent.append(node);
  return node;
}

export function createHeroTurnCardFanUI({
  canvas,
  getState = () => ({}),
  select,
  cancel,
  reopen,
  getTargets,
  onCardSelect = () => undefined,
  onTargetSelect = () => undefined,
  onCancel = () => undefined,
} = {}) {
  if (!canvas || typeof document === 'undefined') throw new Error('Hero turn card fan needs a canvas and document');
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);
  const host = document.createElement('section');
  host.id = 'hero-turn-card-fan';
  host.hidden = true;
  host.tabIndex = -1;
  host.setAttribute('aria-label', 'Hero action cards');
  const hero = document.createElement('div');
  hero.className = 'fan-hero';
  const portrait = document.createElement('img');
  portrait.className = 'fan-hero-portrait';
  portrait.alt = '';
  portrait.draggable = false;
  const heroName = document.createElement('span');
  heroName.className = 'fan-hero-name';
  hero.append(portrait, heroName);
  const cardsHost = document.createElement('div');
  cardsHost.className = 'fan-cards';
  const targetsHost = document.createElement('div');
  targetsHost.className = 'fan-targets';
  targetsHost.hidden = true;
  const back = document.createElement('button');
  back.type = 'button'; back.className = 'fan-back'; back.textContent = 'Back'; back.hidden = true;
  host.append(cardsHost, hero, targetsHost, back);
  document.body.append(host);

  let state = { visible: false, blocked: false, cards: [], targeting: false, validTargets: [], selectedCard: null };
  let closeTimer = 0;

  const clearCloseTimer = () => { if (closeTimer) { clearTimeout(closeTimer); closeTimer = 0; } };
  const interrupt = () => {
    clearCloseTimer();
    host.classList.remove('is-opening', 'is-closing');
    host.hidden = true;
    host.inert = true;
    state = { ...state, visible: false, targeting: false, selectedCard: null };
    targetsHost.replaceChildren();
    targetsHost.hidden = true;
    back.hidden = true;
  };
  const close = (reason = 'close') => {
    clearCloseTimer();
    host.classList.remove('is-opening');
    host.classList.add('is-closing');
    host.inert = true;
    clearCloseTimer();
    closeTimer = setTimeout(interrupt, 175);
    return reason;
  };
  const renderTargets = () => {
    targetsHost.replaceChildren();
    const targets = Array.isArray(state.validTargets) ? state.validTargets : [];
    targetsHost.hidden = !state.targeting || !targets.length;
    back.hidden = !state.targeting;
    for (const target of targets) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'fan-target';
      const targetId = target?.uid ?? target?.id;
      button.dataset.uid = String(targetId ?? '');
      button.textContent = asText(target?.name ?? target?.displayName ?? `Target ${targetId ?? ''}`);
      button.setAttribute('aria-label', `Target ${button.textContent}`);
      button.onclick = () => {
        const index = state.cards.findIndex(card => card.id === state.selectedCard?.id);
        if (typeof select === 'function') select(index, target?.uid ?? target?.id);
        else onTargetSelect(target, state.selectedCard);
      };
      targetsHost.append(button);
    }
  };
  const renderCards = () => {
    cardsHost.replaceChildren();
    for (const [index, card] of state.cards.entries()) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'fan-card';
      button.dataset.slot = index === 0 ? 'left' : index === 1 ? 'center' : 'right';
      button.dataset.cardId = card.id;
      button.dataset.selected = String(state.selectedCard?.id === card.id);
      button.style.setProperty('--rarity', RARITY_COLORS[card.rarity] || RARITY_COLORS.Common);
      button.setAttribute('aria-label', `${card.name}, ${card.rarity}: ${card.effect}`);
      safeText(button, 'fan-card-name', card.name);
      safeText(button, 'fan-card-rarity', card.rarity);
      safeText(button, 'fan-card-effect', card.effect || 'Action');
      if (card.tempo) safeText(button, 'fan-card-tempo', `Tempo: ${card.tempo}`);
      button.onclick = () => {
        if (state.targeting || state.blocked) return;
        state = { ...state, selectedCard: card };
        renderCards();
        const index = state.cards.findIndex(item => item.id === card.id);
        const result = typeof select === 'function' ? select(index) : onCardSelect(card);
        const targets = typeof getTargets === 'function' ? getTargets(card) : result?.validTargets;
        if (result?.targeting || targets?.length) {
          state = { ...state, targeting: true, validTargets: targets || state.validTargets };
          renderTargets();
        }
      };
      cardsHost.append(button);
    }
  };
  const onKeyDown = event => {
    if (event.key !== 'Escape' || host.hidden) return;
    event.preventDefault(); event.stopPropagation();
    if (state.targeting) {
      const card = state.selectedCard;
      state = { ...state, targeting: false, selectedCard: null };
      renderCards(); renderTargets();
      if (typeof cancel === 'function') cancel();
      onCancel({ reason: 'target-cancel', card });
    } else {
      const card = state.selectedCard;
      if (typeof cancel === 'function') cancel();
      onCancel({ reason: 'escape', card });
      close('escape');
    }
  };
  host.addEventListener('keydown', onKeyDown);
  back.onclick = () => {
    if (!state.targeting) return;
    const card = state.selectedCard;
    state = { ...state, targeting: false, selectedCard: null };
    renderCards(); renderTargets();
    if (typeof cancel === 'function') cancel();
    onCancel({ reason: 'back', card });
  };

  return {
    update(next = {}) {
      const source = Object.keys(next).length ? next : (getState() || {});
      const visible = (source.visible ?? source.open ?? true) !== false && !source.blocked;
      if (!visible) { interrupt(); return false; }
      const wasHidden = host.hidden;
      state = {
        ...state,
        ...source,
        visible: true,
        blocked: false,
        cards: normalizeHeroTurnCards(source.cards ?? source.cardFan ?? source.HeroTurnCardFanCards ?? state.cards),
        validTargets: Array.isArray(source.validTargets ?? source.targets) ? (source.validTargets ?? source.targets) : state.validTargets,
        selectedCard: source.selectedCard ?? (Number.isInteger(source.selectedIndex) ? state.cards[source.selectedIndex] : state.selectedCard),
        targeting: source.targeting ?? source.targetSelection ?? state.targeting,
      };
      const rect = canvas.getBoundingClientRect();
      const layout = computeHeroTurnFanLayout({ canvasRect: rect, layoutScale: source.layoutScale, viewportWidth: source.viewportWidth, viewportHeight: source.viewportHeight });
      Object.assign(host.style, { left: `${layout.left}px`, top: `${layout.top}px`, transform: `scale(${layout.scale})` });
      host.hidden = false; host.inert = false; host.classList.remove('is-closing');
      host.dataset.open = 'true';
      host.dataset.heroUid = asText(source.heroUID ?? source.activeHeroUID ?? state.activeHeroUID);
      if (wasHidden) { host.classList.remove('is-opening'); void host.offsetWidth; host.classList.add('is-opening'); }
      const active = source.activeHero ?? source.activeHeroName ?? source.heroUID ?? state.activeHero ?? {};
      const activeRecord = typeof active === 'object' ? active : { name: active };
      heroName.textContent = asText(activeRecord.name ?? activeRecord.displayName ?? activeRecord.baseHeroName ?? activeRecord.heroName ?? 'Active hero');
      const src = activeRecord.portraitSrc ?? activeRecord.portraitUrl ?? activeRecord.portrait;
      if (src) portrait.src = typeof src === 'string' ? src : asText(src.src);
      portrait.alt = `${heroName.textContent} active`;
      renderCards(); renderTargets();
      return true;
    },
    setTargeting(validTargets = [], selectedCard = state.selectedCard) {
      state = { ...state, targeting: true, validTargets, selectedCard };
      renderCards(); renderTargets();
      return true;
    },
    reopen(next) {
      if (typeof reopen === 'function') reopen();
      return this.update(next || getState());
    },
    cancel(reason = 'cancel') {
      if (state.targeting) {
        const card = state.selectedCard;
        state = { ...state, targeting: false, selectedCard: null };
        renderCards(); renderTargets();
        if (typeof cancel === 'function') cancel();
        onCancel({ reason, card });
        return true;
      }
      if (typeof cancel === 'function') cancel();
      onCancel({ reason, card: state.selectedCard });
      close(reason);
      return true;
    },
    close,
    interrupt,
    destroy() { clearCloseTimer(); host.removeEventListener('keydown', onKeyDown); host.remove(); style.remove(); },
    get element() { return host; },
    get state() { return { ...state, cards: [...state.cards], validTargets: [...state.validTargets] }; },
  };
}
