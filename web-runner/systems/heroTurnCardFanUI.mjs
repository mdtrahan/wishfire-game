import { heroArtCrop, heroArtPath } from '../state/heroArtAssets.mjs';
import { runtimeAssetUrl } from './runtimeAssetUrl.mjs';

const FAN_WIDTH = 348;
const FAN_HEIGHT = 190;
const FAN_LEFT = 6;
const FAN_TOP = 208;
const SAFE_GUTTER = 8;
const CARD_WIDTH = 116;
const CARD_HEIGHT = 148;
const CARD_ROTATION_RADIANS = 7 * Math.PI / 180;
const ROTATED_CARD_WIDTH = CARD_WIDTH * Math.cos(CARD_ROTATION_RADIANS) + CARD_HEIGHT * Math.sin(CARD_ROTATION_RADIANS);
const FAN_VISUAL_OVERFLOW = Math.max(0, ((ROTATED_CARD_WIDTH - CARD_WIDTH) / 2) - 4);
const CARD_SELECTION_DURATION = 320;

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

const HERO_DISPLAY_NAMES = Object.freeze({ Falie: 'Fara', Huun: 'Hondo', Runa: 'Runa', Kojonn: 'Kaja', Fara: 'Fara', Hondo: 'Hondo', Kaja: 'Kaja' });

const heroDisplayName = hero => HERO_DISPLAY_NAMES[asText(hero?.displayName ?? hero?.name ?? hero?.baseHeroName ?? hero?.portraitName)] || 'Hero';

const heroSignature = hero => JSON.stringify([
  hero?.uid ?? '',
  hero?.displayName ?? '',
  hero?.name ?? '',
  hero?.baseHeroName ?? '',
  hero?.portraitName ?? '',
  hero?.portrait?.src ?? '',
]);

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
  const scale = Math.min(requestedScale, availableWidth / (FAN_WIDTH + FAN_VISUAL_OVERFLOW * 2));
  const renderedWidth = FAN_WIDTH * scale;
  const renderedHeight = FAN_HEIGHT * scale;
  const visualOverflow = FAN_VISUAL_OVERFLOW * scale;
  const visualWidth = renderedWidth + visualOverflow * 2;
  const canvasRight = left + width;
  const canvasBottom = top + height;
  const maxLeft = Math.max(SAFE_GUTTER + visualOverflow, Math.min(canvasRight - renderedWidth - visualOverflow, viewWidth - visualWidth - SAFE_GUTTER + visualOverflow));
  const minLeft = Math.max(SAFE_GUTTER + visualOverflow, Math.min(left + SAFE_GUTTER + visualOverflow, maxLeft));
  const preferredTop = top + FAN_TOP * scale;
  const maxTop = Math.min(canvasBottom - renderedHeight - SAFE_GUTTER, viewHeight - renderedHeight - SAFE_GUTTER);
  const minTop = top + SAFE_GUTTER;
  return {
    left: Math.round(minLeft),
    top: Math.round(Math.max(minTop, Math.min(preferredTop, maxTop))),
    width: renderedWidth,
    height: renderedHeight,
    visualLeft: minLeft - visualOverflow,
    visualWidth,
    scale,
  };
}

const STYLE = `
  #hero-turn-card-fan{position:fixed;box-sizing:border-box;width:${FAN_WIDTH}px;height:${FAN_HEIGHT}px;color:#fff;z-index:28;pointer-events:none;transform-origin:top left;font:600 12px/1.15 system-ui,sans-serif;filter:drop-shadow(0 4px 8px #000b)}
  #hero-turn-card-fan[hidden]{display:none}
  #hero-turn-card-fan.is-opening{opacity:1;animation:none}
  #hero-turn-card-fan.is-closing{animation:hero-turn-fan-close 170ms ease-in both;pointer-events:none}
  @keyframes hero-turn-fan-open{from{opacity:0}to{opacity:1}}
  @keyframes hero-turn-fan-close{from{opacity:1}to{opacity:0}}
  #hero-turn-card-fan.is-opening .fan-card[data-slot="left"]{animation:hero-turn-card-left-in 220ms cubic-bezier(.22,.8,.25,1) both;animation-delay:0ms;animation-fill-mode:both}
  #hero-turn-card-fan.is-opening .fan-card[data-slot="center"]{animation:hero-turn-card-center-in 220ms cubic-bezier(.22,.8,.25,1) both;animation-delay:40ms;animation-fill-mode:both}
  #hero-turn-card-fan.is-opening .fan-card[data-slot="right"]{animation:hero-turn-card-right-in 220ms cubic-bezier(.22,.8,.25,1) both;animation-delay:80ms;animation-fill-mode:both}
  #hero-turn-card-fan.is-closing .fan-card{animation:hero-turn-card-out 170ms ease-in both}
  #hero-turn-card-fan.is-selecting .fan-card{pointer-events:none;animation-duration:${CARD_SELECTION_DURATION}ms;animation-fill-mode:both}
  #hero-turn-card-fan.is-selecting .fan-card:not([data-selected="true"])[data-slot="left"]{animation-name:hero-turn-card-fall-left}
  #hero-turn-card-fan.is-selecting .fan-card:not([data-selected="true"])[data-slot="center"]{animation-name:hero-turn-card-fall-center}
  #hero-turn-card-fan.is-selecting .fan-card:not([data-selected="true"])[data-slot="right"]{animation-name:hero-turn-card-fall-right}
  #hero-turn-card-fan.is-selecting .fan-card[data-selected="true"]{z-index:10;animation-name:hero-turn-card-activate}
  @keyframes hero-turn-card-left-in{from{opacity:0;transform:rotate(0) translateY(30px) scale(.94);filter:blur(2px)}to{opacity:1;transform:rotate(-7deg) translateY(8px) scale(1);filter:blur(0)}}
  @keyframes hero-turn-card-center-in{from{opacity:0;transform:rotate(0) translateY(25px) scale(.94);filter:blur(2px)}to{opacity:1;transform:rotate(0) scale(1);filter:blur(0)}}
  @keyframes hero-turn-card-right-in{from{opacity:0;transform:rotate(0) translateY(30px) scale(.94);filter:blur(2px)}to{opacity:1;transform:rotate(7deg) translateY(8px) scale(1);filter:blur(0)}}
  @keyframes hero-turn-card-out{to{transform:rotate(0) translateY(25px)}}
  @keyframes hero-turn-card-fall-left{0%{opacity:1;transform:rotate(-7deg) translateY(8px)}45%,100%{opacity:0;transform:rotate(-13deg) translate(-26px,48px)}}
  @keyframes hero-turn-card-fall-center{0%{opacity:1;transform:rotate(0) translateY(0)}45%,100%{opacity:0;transform:rotate(0) translateY(48px)}}
  @keyframes hero-turn-card-fall-right{0%{opacity:1;transform:rotate(7deg) translateY(8px)}45%,100%{opacity:0;transform:rotate(13deg) translate(26px,48px)}}
  @keyframes hero-turn-card-activate{0%{transform:rotate(0) scale(.96);filter:brightness(1.2)}18%{transform:rotate(0) scale(1.09);filter:brightness(1.55) saturate(1.15)}52%{transform:rotate(0) scale(1.035);filter:brightness(1.3) saturate(1.05)}100%{transform:rotate(0) scale(1);filter:brightness(1.2)}}
  #hero-turn-card-fan .fan-card{position:absolute;top:9px;width:116px;height:148px;padding:8px 8px 7px;border:2px solid var(--rarity,#737783);border-radius:9px;color:#fff;background:linear-gradient(155deg,#263345f2,#0b1019f5 65%,#06080c);box-shadow:inset 0 0 0 1px #ffffff22,0 4px 7px #000b;display:flex;flex-direction:column;gap:3px;text-align:left;pointer-events:auto;cursor:pointer;overflow:visible;transition:filter 120ms ease,box-shadow 120ms ease,transform 120ms ease}
  #hero-turn-card-fan .fan-card[data-slot="left"]{left:4px;transform:rotate(-7deg) translateY(8px);z-index:3}
  #hero-turn-card-fan .fan-card[data-slot="center"]{left:116px;top:2px;transform:rotate(0);z-index:2}
  #hero-turn-card-fan .fan-card[data-slot="right"]{left:228px;transform:rotate(7deg) translateY(8px);z-index:1}
  #hero-turn-card-fan .fan-card:hover,#hero-turn-card-fan .fan-card:focus-visible{z-index:6;filter:brightness(1.18);box-shadow:0 0 0 2px #6ee7f8,0 5px 12px #000d;outline:0}
  #hero-turn-card-fan .fan-card[data-selected="true"]{border-color:#f7e19b;box-shadow:0 0 0 3px #f7e19b,0 0 18px #f7c84a;filter:brightness(1.2);z-index:5}
  #hero-turn-card-fan .fan-card[data-selected="true"]::before{content:"";position:absolute;inset:-15px;border:2px solid #fff4ad;border-radius:14px;opacity:0;pointer-events:none;animation:hero-turn-card-splash ${CARD_SELECTION_DURATION}ms ease-out both}
  #hero-turn-card-fan .fan-card[data-selected="true"]::after{content:"";position:absolute;top:-22%;left:-55%;width:18%;height:144%;background:linear-gradient(90deg,transparent,#fffbd0ee,transparent);opacity:0;pointer-events:none;mix-blend-mode:screen;transform:rotate(16deg) translateX(-220%);animation:hero-turn-card-shimmer ${CARD_SELECTION_DURATION}ms ease-out both}
  @keyframes hero-turn-card-splash{0%{opacity:0;transform:scale(.72)}14%{opacity:1;transform:scale(.88)}34%{opacity:.55;transform:scale(1.06)}100%{opacity:0;transform:scale(1.24)}}
  @keyframes hero-turn-card-shimmer{0%{opacity:0;transform:rotate(16deg) translateX(-220%)}14%{opacity:1;transform:rotate(16deg) translateX(-70%)}38%{opacity:.65;transform:rotate(16deg) translateX(80%)}100%{opacity:0;transform:rotate(16deg) translateX(480%)}}
  #hero-turn-card-fan .fan-card:disabled{cursor:default}
  #hero-turn-card-fan .fan-card-portrait{position:relative;display:flex;align-items:center;justify-content:center;flex:0 0 64px;height:64px;margin:0 8px;border:1px solid #ffffff33;border-radius:6px;background:linear-gradient(160deg,#28435c,#101723);color:#d9f8ff;font-size:9px;line-height:1.05;text-align:center;overflow:hidden}
  #hero-turn-card-fan .fan-card-portrait img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 24%;transform:scale(1.08);transform-origin:50% 24%;pointer-events:none}
  #hero-turn-card-fan .fan-card-portrait-fallback{padding:2px;overflow-wrap:anywhere}
  #hero-turn-card-fan .fan-card-name{display:block;flex:0 0 27px;min-height:27px;margin:0;font-size:13px;line-height:1.05;white-space:normal;overflow-wrap:anywhere}
  #hero-turn-card-fan .fan-card-rarity{position:absolute;top:4px;right:5px;z-index:2;padding:1px 3px;border:1px solid var(--rarity);border-radius:3px;background:#080d16d9;color:var(--rarity);font-size:9px;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
  #hero-turn-card-fan .fan-card-effect{flex:1 1 auto;min-height:0;margin:0;font-size:9px;line-height:1.08;white-space:normal;overflow-wrap:anywhere}
  @media(prefers-reduced-motion:reduce){#hero-turn-card-fan.is-opening,#hero-turn-card-fan.is-closing,#hero-turn-card-fan.is-selecting,#hero-turn-card-fan .fan-card,#hero-turn-card-fan.is-selecting .fan-card,#hero-turn-card-fan.is-selecting .fan-card[data-selected="true"]::before,#hero-turn-card-fan.is-selecting .fan-card[data-selected="true"]::after{animation-duration:1ms;animation-delay:0ms!important}}
`;

function textNode(className, value) {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = value;
  return node;
}

const cardsSignature = cards => JSON.stringify((Array.isArray(cards) ? cards : []).map(card => [card.id, card.name, card.rarity, card.effect]));

export function createHeroTurnCardFanUI({
  canvas,
  getState = () => ({}),
  select,
  cancel,
  reopen,
  onCardSelect = () => undefined,
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
  const cardsHost = document.createElement('div');
  cardsHost.className = 'fan-cards';
  host.append(cardsHost);
  document.body.append(host);

  let state = { visible: false, blocked: false, cards: [], selectedCard: null, activeHero: null };
  let closeTimer = 0;
  let selectionTimer = 0;
  let selectionActive = false;
  let selectionSuppressed = false;
  let selectionHeroUID = '';
  let selectionCardsSignature = '';
  let selectionOfferToken = '';
  let renderedCardsSignature = '';

  const clearCloseTimer = () => { if (closeTimer) { clearTimeout(closeTimer); closeTimer = 0; } };
  const clearSelectionTimer = () => { if (selectionTimer) { clearTimeout(selectionTimer); selectionTimer = 0; } };
  const finishSelection = () => {
    clearSelectionTimer();
    selectionActive = false;
    selectionSuppressed = true;
    host.classList.remove('is-selecting');
    host.hidden = true;
    host.inert = true;
    host.dataset.open = 'false';
    state = { ...state, visible: false, selectedCard: null };
  };
  const interrupt = () => {
    clearCloseTimer();
    clearSelectionTimer();
    selectionActive = false;
    selectionSuppressed = false;
    selectionHeroUID = '';
    selectionCardsSignature = '';
    selectionOfferToken = '';
    host.classList.remove('is-opening', 'is-closing');
    host.classList.remove('is-selecting');
    host.hidden = true;
    host.inert = true;
    host.dataset.open = 'false';
    state = { ...state, visible: false, selectedCard: null };
  };
  const close = (reason = 'close') => {
    clearCloseTimer();
    clearSelectionTimer();
    selectionActive = false;
    selectionSuppressed = false;
    selectionHeroUID = '';
    selectionCardsSignature = '';
    selectionOfferToken = '';
    host.classList.remove('is-opening');
    host.classList.remove('is-selecting');
    host.classList.add('is-closing');
    host.inert = true;
    clearCloseTimer();
    closeTimer = setTimeout(interrupt, 175);
    return reason;
  };
  const renderCards = () => {
    const needsRebuild = cardsHost.children.length !== state.cards.length
      || state.cards.some((card, index) => cardsHost.children[index]?.dataset.cardId !== card.id);
    if (needsRebuild) cardsHost.replaceChildren();
    for (const [index, card] of state.cards.entries()) {
      const button = cardsHost.children[index] || document.createElement('button');
      if (!cardsHost.children[index]) cardsHost.append(button);
      button.type = 'button'; button.className = 'fan-card';
      button.disabled = state.blocked;
      button.dataset.slot = index === 0 ? 'left' : index === 1 ? 'center' : 'right';
      button.dataset.cardId = card.id;
      button.dataset.selected = String(state.selectedCard?.id === card.id);
      button.style.setProperty('--rarity', RARITY_COLORS[card.rarity] || RARITY_COLORS.Common);
      button.setAttribute('aria-label', `${card.name}, ${card.rarity}: ${card.effect}`);
      if (!button._fanCardPortrait) {
        const portrait = document.createElement('span');
        portrait.className = 'fan-card-portrait';
        const image = document.createElement('img');
        image.alt = '';
        image.draggable = false;
        const fallback = textNode('fan-card-portrait-fallback', 'Hero');
        portrait.append(image, fallback);
        button._fanCardPortrait = portrait;
        button._fanCardPortraitImage = image;
        button._fanCardPortraitFallback = fallback;
        button._fanCardName = textNode('fan-card-name', card.name);
        button._fanCardEffect = textNode('fan-card-effect', card.effect || 'Action');
        button._fanCardRarity = textNode('fan-card-rarity', card.rarity);
        button.append(portrait, button._fanCardName, button._fanCardEffect, button._fanCardRarity);
      }
      const signatureHero = card.presentation?.kind === 'hero_signature' ? (state.activeHero || {}) : null;
      const portraitSrc = signatureHero && heroArtPath(signatureHero)
        ? runtimeAssetUrl(heroArtPath(signatureHero))
        : asText(signatureHero?.portrait?.src);
      const portraitCrop = signatureHero ? (heroArtCrop(signatureHero, 'card') || { position: '50% 24%', scale: 1.08 }) : null;
      button._fanCardPortraitFallback.textContent = signatureHero ? heroDisplayName(signatureHero) : 'Power';
      button._fanCardPortraitImage.onerror = () => {
        button._fanCardPortraitImage.hidden = true;
        button._fanCardPortraitFallback.hidden = false;
      };
      if (portraitSrc) {
        button._fanCardPortraitImage.style.objectPosition = portraitCrop.position;
        button._fanCardPortraitImage.style.transformOrigin = portraitCrop.position;
        button._fanCardPortraitImage.style.transform = `scale(${portraitCrop.scale})`;
        button._fanCardPortraitImage.hidden = false;
        button._fanCardPortraitFallback.hidden = true;
        if (button._fanCardPortraitImage.src !== portraitSrc) button._fanCardPortraitImage.src = portraitSrc;
      } else {
        button._fanCardPortraitImage.hidden = true;
        button._fanCardPortraitFallback.hidden = false;
      }
      button._fanCardName.textContent = card.name;
      button._fanCardRarity.textContent = card.rarity;
      button._fanCardEffect.textContent = card.effect || 'Action';
      button.onclick = () => {
        if (state.blocked || selectionActive) return;
        state = { ...state, selectedCard: card };
        renderCards();
        selectionActive = true;
        selectionSuppressed = false;
        selectionHeroUID = asText(host.dataset.heroUid);
        selectionCardsSignature = cardsSignature(state.cards);
        selectionOfferToken = asText(state.offerToken);
        host.classList.remove('is-opening', 'is-closing');
        host.classList.add('is-selecting');
        host.inert = true;
        clearSelectionTimer();
        selectionTimer = setTimeout(finishSelection, CARD_SELECTION_DURATION + 24);
        const index = state.cards.findIndex(item => item.id === card.id);
        if (typeof select === 'function') select(index);
        else onCardSelect(card);
      };
    }
    renderedCardsSignature = JSON.stringify({
      cards: state.cards.map(card => [card.id, card.name, card.rarity, card.effect]),
      selected: state.selectedCard?.id || '',
      blocked: !!state.blocked,
      hero: heroSignature(state.activeHero),
    });
  };
  return {
    update(next = {}) {
      const source = Object.keys(next).length ? next : (getState() || {});
      const visible = (source.visible ?? source.open ?? true) !== false && !source.blocked;
      if (!visible) {
        if (selectionActive && !source.blocked) return true;
        selectionSuppressed = false;
        selectionHeroUID = '';
        selectionCardsSignature = '';
        interrupt(); return false;
      }
      clearCloseTimer();
      const incomingCards = normalizeHeroTurnCards(source.cards ?? source.cardFan ?? source.HeroTurnCardFanCards ?? state.cards);
      const incomingHeroUID = asText(source.heroUID ?? source.activeHeroUID ?? state.activeHeroUID);
      const incomingOfferToken = asText(source.offerToken);
      const sameSelectedDraw = incomingHeroUID === selectionHeroUID
        && incomingOfferToken === selectionOfferToken
        && cardsSignature(incomingCards) === selectionCardsSignature;
      if (selectionSuppressed && sameSelectedDraw) return true;
      if (selectionActive) {
        // The native handoff consumes the runtime draw immediately. Keep the
        // stable DOM cue alive until its presentation timer finishes.
        if (sameSelectedDraw || (incomingHeroUID === selectionHeroUID && incomingCards.length === 0 && source.open === false)) return true;
        clearSelectionTimer();
        selectionActive = false;
        selectionSuppressed = false;
        host.classList.remove('is-selecting');
        state = { ...state, selectedCard: null };
      }
      const wasHidden = host.hidden;
      state = {
        ...state,
        ...source,
        visible: true,
        blocked: false,
        cards: incomingCards,
        activeHero: source.activeHero ?? state.activeHero,
        offerToken: incomingOfferToken,
        selectedCard: source.selectedCard ?? (Number.isInteger(source.selectedIndex) ? state.cards[source.selectedIndex] : state.selectedCard),
      };
      const nextCardsSignature = JSON.stringify({
        cards: state.cards.map(card => [card.id, card.name, card.rarity, card.effect]),
        selected: state.selectedCard?.id || '',
        blocked: !!state.blocked,
        hero: heroSignature(state.activeHero),
        offerToken: state.offerToken,
      });
      // Mount the cards while the host is still hidden. This lets the opening
      // animation see all three nodes from its first painted frame, including
      // the faster startup path of the offline classic bundle.
      if (nextCardsSignature !== renderedCardsSignature) renderCards();
      const rect = canvas.getBoundingClientRect();
      const layout = computeHeroTurnFanLayout({ canvasRect: rect, layoutScale: source.layoutScale, viewportWidth: source.viewportWidth, viewportHeight: source.viewportHeight });
      Object.assign(host.style, { left: `${layout.left}px`, top: `${layout.top}px`, transform: `scale(${layout.scale})` });
      host.hidden = false; host.inert = false; host.classList.remove('is-closing');
      host.dataset.open = 'true';
      host.dataset.heroUid = asText(source.heroUID ?? source.activeHeroUID ?? state.activeHeroUID);
      if (wasHidden) { host.classList.remove('is-opening'); void host.offsetWidth; host.classList.add('is-opening'); }
      return true;
    },
    reopen(next) {
      if (typeof reopen === 'function') reopen();
      selectionSuppressed = false;
      selectionActive = false;
      clearSelectionTimer();
      host.classList.remove('is-selecting');
      return this.update(next || getState());
    },
    cancel(reason = 'cancel') {
      if (typeof cancel === 'function') cancel();
      onCancel({ reason, card: state.selectedCard });
      close(reason);
      return true;
    },
    close,
    interrupt,
    destroy() { clearCloseTimer(); host.remove(); style.remove(); },
    get element() { return host; },
    get state() { return { ...state, cards: [...state.cards] }; },
  };
}
