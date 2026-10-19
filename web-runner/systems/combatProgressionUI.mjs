import { combatObjectivePresentation, combatObjectiveReward, TRAINING_STATS, trainingCost, TRAINING_BONUS_PER_LEVEL } from '../src/core/combatProgressionRules.mjs';
import { positionRewardReceipt, showRewardReceipt } from './rewardReceiptUI.mjs';

const RESOURCE_ICONS = Object.freeze({
  incense: 'assets/images/progression/incense.png',
  essence: 'assets/images/lamp/essence-orb.png',
  gold: 'assets/gems/coin.png',
});
const TICKET_QUADRANT = Object.freeze({ Fara: '0% 0%', Hondo: '100% 0%', Kaja: '0% 100%', Runa: '100% 100%' });
const STAT_LABELS = Object.freeze({ ATK: 'ATK', DEF: 'DEF', MATK: 'MATK', RES: 'RES' });
const STAT_ICONS = Object.freeze({
  ATK: 'assets/images/progression/stat-atk.png', DEF: 'assets/images/progression/stat-def.png',
  MATK: 'assets/images/progression/stat-matk.png', RES: 'assets/images/progression/stat-res.png',
});
function makeImage(src, alt, size) {
  const image = document.createElement('img');
  image.src = src; image.alt = alt; image.width = size; image.height = size; image.draggable = false;
  return image;
}

export function claimObjectiveWithReceipt(onClaim, objectiveId, canvas, present = showRewardReceipt) {
  const result = onClaim(objectiveId);
  if (result?.ok && result.receipt) present(canvas, result.receipt, 'Reward Obtained', 1500);
  return result;
}

function installStyle() {
  if (document.getElementById('combat-progression-style')) return;
  const style = document.createElement('style'); style.id = 'combat-progression-style';
  style.textContent = `
    #combat-progression-ui{position:fixed;z-index:16;pointer-events:none;color:#F6EEDC;font-family:system-ui,sans-serif}
    #combat-progression-ui[hidden],#training-ground[hidden]{display:none}
    .cot-resources{display:flex;gap:4px}
    .cot-resource{box-sizing:border-box;width:112px;height:22px;display:flex;align-items:center;padding:0 8px 0 0;gap:3px;border-radius:11px;background:rgba(14,12,20,.72);box-shadow:inset 0 0 0 1px rgba(255,255,255,.10);}
    .cot-resource img{height:22px;object-fit:contain;flex:none}
    .cot-resource[data-resource=incense] img,.cot-resource[data-resource=essence] img{width:26px;height:26px;margin-left:-4px}
    .cot-resource[data-resource=gold] img{width:22px;height:22px}
    .cot-resource b{display:block;min-width:0;flex:1;text-align:right;font-size:12px;line-height:1;font-weight:800;font-variant-numeric:tabular-nums;color:#F6EEDC;white-space:nowrap}
    .cot-objective{position:absolute;box-sizing:border-box;width:270px;height:52px;display:flex;align-items:flex-start;color:white;text-align:left;transition:opacity .6s ease}
    .cot-objective::before{content:'';position:absolute;left:20px;right:0;top:2px;height:34px;background:linear-gradient(90deg,#efddb985,#efddb94d 75%,transparent)}
    .cot-text-backer{position:relative;min-width:0;max-width:236px;padding:2px 0 0 4px;white-space:normal;font-weight:700}
    .cot-category{font-size:11px;color:#ffd45c;line-height:14px;text-transform:uppercase}
    .cot-challenge{font-size:13px;line-height:18px}
    .cot-reward{position:relative;width:44px;flex:none;height:52px}
    .cot-reward-count{position:absolute;left:0;top:33px;width:38px;text-align:center;font-size:14px;font-weight:800}
    .cot-reward-count,.cot-text-backer{text-shadow:1px 1px #171208,-1px 1px #171208,1px -1px #171208,-1px -1px #171208}
    .cot-reward-plate{box-sizing:border-box;display:block;width:38px;height:38px;border-radius:50%;background:linear-gradient(#bbbcb7,#737670);border:2px solid #41443f;box-shadow:inset 0 0 0 2px #d6d5cb}
    .cot-reward-plate>div{width:30px;height:30px;margin:2px}
    .cot-reward-plate .cot-ticket-art{width:33px;height:22px;margin:6px auto;background-image:url('assets/images/progression/hero-tickets.png');background-size:200% 200%;background-repeat:no-repeat}
    .cot-objective[data-ready=true]{pointer-events:auto;cursor:pointer}
    .cot-objective[data-ready=true]:focus-visible{outline:2px solid #fff0a7;outline-offset:2px}
    #training-ground{position:fixed;inset:0;z-index:35;background:rgba(8,7,12,.82);display:grid;place-items:center;color:#F6EEDC;font:14px/1.35 system-ui,sans-serif}
    #training-ground .tg-stage{position:relative;width:min(calc(100vw - 24px),56.25dvh);aspect-ratio:9/16;container-type:inline-size;font-family:system-ui,sans-serif;color:#2b2116}
    #training-ground .tg-ribbon{position:absolute;z-index:3;left:17.7778cqw;top:37.7778cqw;width:64.4444cqw;height:7.7778cqw;margin:0;display:grid;place-items:center;border:.2778cqw solid #d0a45b;background:#25454a;color:#ffe0a0;font:700 3.3333cqw/1 Georgia,serif}
    #training-ground .tg-sheet{position:absolute;left:1.6667cqw;top:41.6667cqw;width:96.6667cqw;height:107.2222cqw;border:.5556cqw solid #bd8749;background:linear-gradient(160deg,#f0dfbb,#d7c49e 62%,#c6b189);box-shadow:0 -1.1111cqw 5.5556cqw #07151bcc}
    #training-ground .tg-close{position:absolute;z-index:4;right:2.2222cqw;top:1.9444cqw;width:8.8889cqw;height:8.8889cqw;padding:0;border:.2778cqw solid #7c6543;background:linear-gradient(#f8e9c6,#ddc89e);color:#2b2116;font:700 5.5556cqw/1 system-ui}
    #training-ground .tg-close:focus-visible,#training-ground .tg-train:focus-visible,#training-ground .tg-tab:focus-visible{outline:.8333cqw solid #fff0a7;outline-offset:.5556cqw}
    #training-ground .tg-scene{position:absolute;z-index:2;left:4.4444cqw;top:44.4444cqw;width:91.1111cqw;height:45.5556cqw;object-fit:fill;border:.2778cqw solid #8f6436;display:block}
    #training-ground .tg-balance{position:absolute;left:5cqw;top:91cqw;height:3.4cqw;display:flex;align-items:center;gap:1cqw;color:#2b2116;font-size:2.5cqw;font-weight:850}
    #training-ground .tg-balance img{width:4cqw;height:4cqw}
    #training-ground .tg-status{position:absolute;right:5cqw;top:91cqw;max-width:55cqw;margin:0;color:#513d24;font-size:2.2cqw;text-align:right}
    #training-ground .tg-stats{position:absolute;z-index:3;left:3.8889cqw;top:95cqw;width:92.2222cqw;height:43.3333cqw;display:flex;gap:1.1111cqw}
    #training-ground .tg-stat{position:relative;flex:0 0 22.2222cqw;width:22.2222cqw;height:100%;border:.2778cqw solid #866a44;border-radius:7.5cqw 7.5cqw 2.2222cqw 2.2222cqw;background:linear-gradient(180deg,#fff7df,#ead9b6);box-shadow:0 .5556cqw 1.3889cqw #49351733;color:#2b2116;overflow:hidden}
    #training-ground .tg-stat img{position:absolute;left:6.9444cqw;top:5.5556cqw;width:7.7778cqw;height:7.7778cqw;object-fit:contain}
    #training-ground .tg-stat b{position:absolute;left:1.1111cqw;right:1.1111cqw;top:13.6111cqw;text-align:center;color:#2b1e12;font-size:2.7778cqw;font-weight:850;line-height:3.3333cqw}
    #training-ground .tg-stat small{position:absolute;left:0;right:0;top:18cqw;text-align:center;color:#6c5a3d;font-size:2.1cqw;line-height:2.5cqw}
    #training-ground .tg-train{position:absolute;left:1.6667cqw;right:1.6667cqw;bottom:1.6667cqw;height:6.6667cqw;padding:0;border:.2778cqw solid #a98b5a;background:linear-gradient(#f4dfb5,#ddc18d);color:#5d513c;font:700 2.2cqw/1 system-ui;white-space:nowrap}
    #training-ground .tg-train:disabled{opacity:.55}
    #training-ground .tg-tabs{position:absolute;left:2.2222cqw;top:150.5556cqw;width:95.5556cqw;height:8.3333cqw;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.1111cqw;padding:.5556cqw .8333cqw;border:.2778cqw solid #8b7047;background:linear-gradient(180deg,#183944,#102a35);overflow:hidden}
    #training-ground .tg-tab{min-width:0;padding:.5556cqw .5cqw;border:.2778cqw solid #62634f;background:#17313b;color:#b9ae94;font:700 2.5cqw/1 system-ui;white-space:nowrap}
    #training-ground .tg-tab[aria-selected=true]{color:#2e2417;background:linear-gradient(#ffe49d,#ca984f);border-color:#fff0bc}
    #training-ground .tg-tab:disabled{opacity:1;cursor:default}
  `;
  document.head.append(style);
}

function makeSafeAreaProbe() {
  const node = document.createElement('div');
  node.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px);pointer-events:none';
  document.body.append(node);
  return node;
}

export function createCombatProgressionUI({ canvas, onClaim = () => {} }) {
  installStyle();
  const host = document.createElement('div'); host.id = 'combat-progression-ui'; host.hidden = true;
  const resourceRow = document.createElement('div'); resourceRow.className = 'cot-resources';
  const resourceValues = {};
  for (const key of ['incense', 'essence', 'gold']) {
    const pill = document.createElement('div'); pill.className = 'cot-resource'; pill.dataset.resource = key;
    pill.append(makeImage(RESOURCE_ICONS[key], key === 'gold' ? 'Gold' : key === 'essence' ? 'Essence' : 'Incense', key === 'gold' ? 22 : 26));
    const amount = document.createElement('b'); amount.textContent = '0'; pill.append(amount);
    resourceValues[key] = amount; resourceRow.append(pill);
  }
  const objective = document.createElement('div'); objective.className = 'cot-objective';
  let readyClaimId = '';
  objective.addEventListener('click', () => { if (readyClaimId) claimObjectiveWithReceipt(onClaim, readyClaimId, canvas); });
  objective.addEventListener('keydown', event => {
    if (!readyClaimId || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    claimObjectiveWithReceipt(onClaim, readyClaimId, canvas);
  });
  const text = document.createElement('div'); text.className = 'cot-text-backer';
  const category = document.createElement('div'); category.className = 'cot-category';
  const challenge = document.createElement('div'); challenge.className = 'cot-challenge';
  text.append(category, challenge);
  const reward = document.createElement('div'); reward.className = 'cot-reward';
  const plate = document.createElement('div'); plate.className = 'cot-reward-plate';
  const rewardImage = document.createElement('div'); rewardImage.setAttribute('role', 'img'); plate.append(rewardImage);
  const rewardCount = document.createElement('div'); rewardCount.className = 'cot-reward-count'; reward.append(plate, rewardCount);
  objective.append(reward, text); host.append(resourceRow, objective); document.body.append(host);
  const safeProbe = makeSafeAreaProbe();

  function update({ layoutId, phase, scale = 1, progression, equipmentProgress, goldFixture = 999999999 } = {}) {
    positionRewardReceipt(canvas);
    const visible = layoutId === 'combat' && phase === 'combat';
    host.hidden = !visible;
    if (!visible) return;
    const rect = canvas.getBoundingClientRect();
    const safeTop = Number.parseFloat(getComputedStyle(safeProbe).paddingTop) || 0;
    const size = 344 * scale;
    host.style.left = `${rect.left + Math.max(0, (rect.width - size) / 2)}px`;
    host.style.top = `${Math.max(rect.top, safeTop) + 8 * scale}px`;
    host.style.transform = `scale(${scale})`; host.style.transformOrigin = 'top left';
    host.style.width = '344px';
    resourceValues.incense.textContent = String(progression?.wallet?.incense || 0);
    resourceValues.essence.textContent = String(equipmentProgress?.essence ?? 0);
    resourceValues.gold.textContent = '999,999,999';
    resourceValues.gold.setAttribute('aria-label', `Gold display fixture ${goldFixture.toLocaleString('en-US')}`);
    const view = combatObjectivePresentation(progression?.objective);
    const ready = !!progression?.objective && progression.objective.progress >= progression.objective.target;
    readyClaimId = ready ? String(progression.objective.id || '') : '';
    objective.dataset.ready = String(ready);
    objective.setAttribute('role', ready ? 'button' : 'group');
    objective.tabIndex = ready ? 0 : -1;
    objective.setAttribute('aria-disabled', String(!ready));
    category.textContent = ready ? 'Claim reward' : view.category;
    challenge.textContent = `${view.challenge} ${view.count}`;
    challenge.style.color = view.color || '';
    challenge.title = ['equip_level', 'equip_rarity'].includes(progression?.objective?.type) ? 'Every deployed hero needs qualifying gear in Hat, Body and Boots. Higher levels and rarities count.' : '';
    const rewardPreview = combatObjectiveReward(progression?.objective);
    const rewardResource = rewardPreview?.resource;
    reward.hidden = !rewardPreview;
    rewardImage.className = rewardResource === 'hero_ticket' ? 'cot-ticket-art' : '';
    if (rewardResource === 'hero_ticket') { rewardImage.style.backgroundImage = ''; rewardImage.style.backgroundSize = ''; rewardImage.style.backgroundRepeat = ''; rewardImage.style.backgroundPosition = TICKET_QUADRANT[rewardPreview?.heroName] || '0% 0%'; }
    else if (rewardResource) { rewardImage.style.backgroundImage = `url('${RESOURCE_ICONS[rewardResource]}')`; rewardImage.style.backgroundSize = 'contain'; rewardImage.style.backgroundRepeat = 'no-repeat'; rewardImage.style.backgroundPosition = 'center'; }
    rewardCount.textContent = rewardPreview?.amount ? rewardPreview.amount.toLocaleString('en-US') : '';
    const rewardName = rewardResource === 'hero_ticket' ? `${rewardPreview?.heroName || 'Hero'} tickets` : rewardResource;
    reward.setAttribute('aria-label', rewardPreview ? `${rewardPreview.amount} ${rewardName}` : 'COT reward unavailable');
    objective.setAttribute('aria-label', ready ? `Claim ${rewardPreview?.amount || 0} ${rewardName || ''}`.trim() : `${view.challenge} ${view.count}`);
    const hostOffset = Math.max(0, safeTop - rect.top) / scale + 8;
    objective.style.left = '8px'; objective.style.top = `${426 - hostOffset}px`;
  }

  return { update, destroy() { safeProbe.remove(); host.remove(); } };
}

export function createTrainingGroundUI({ progression }) {
  installStyle();
  const host = document.createElement('section'); host.id = 'training-ground'; host.hidden = true;
  host.setAttribute('role', 'dialog'); host.setAttribute('aria-modal', 'true'); host.setAttribute('aria-labelledby', 'training-ground-title');
  const panel = document.createElement('div'); panel.className = 'tg-stage'; host.append(panel);
  const title = document.createElement('h1'); title.className = 'tg-ribbon'; title.id = 'training-ground-title'; title.textContent = 'Training Ground'; panel.append(title);
  const sheet = document.createElement('section'); sheet.className = 'tg-sheet'; sheet.setAttribute('aria-label', 'Training Ground'); panel.append(sheet);
  const close = document.createElement('button'); close.className = 'tg-close'; close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close Growth'); close.onclick = () => { host.hidden = true; }; sheet.append(close);
  const scene = makeImage('assets/images/progression/training-scene.png', 'Approved training courtyard with four training stations', 328); scene.className = 'tg-scene'; panel.append(scene);
  const tabs = document.createElement('nav'); tabs.className = 'tg-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Growth sections');
  for (const [label, active] of [['Training Ground', true], ['Strengthen', false], ['Aquafarm', false], ['Hatchery', false]]) {
    const tab = document.createElement('button'); tab.className = 'tg-tab'; tab.type = 'button'; tab.textContent = label; tab.setAttribute('role', 'tab');
    tab.disabled = !active; tab.setAttribute('aria-selected', String(active)); tabs.append(tab);
  }
  panel.append(tabs);
  const balance = document.createElement('div'); balance.className = 'tg-balance';
  balance.append(makeImage(RESOURCE_ICONS.incense, 'Incense', 22));
  const balanceValue = document.createElement('span'); balanceValue.setAttribute('aria-label', 'Incense balance'); balance.append(balanceValue); panel.append(balance);
  const status = document.createElement('p'); status.className = 'tg-status'; status.setAttribute('role', 'status'); panel.append(status);
  const stats = document.createElement('div'); stats.className = 'tg-stats'; stats.setAttribute('aria-label', 'Party stat upgrades'); panel.append(stats);
  const controls = {};
  for (const stat of TRAINING_STATS) {
    const row = document.createElement('article'); row.className = 'tg-stat'; row.setAttribute('aria-label', `${STAT_LABELS[stat]} party upgrade`);
    row.append(makeImage(STAT_ICONS[stat], `${STAT_LABELS[stat]} icon`, 28));
    const name = document.createElement('b'); name.textContent = STAT_LABELS[stat];
    const detail = document.createElement('small');
    const button = document.createElement('button'); button.className = 'tg-train'; button.type = 'button';
    button.addEventListener('click', () => {
      const result = progression.train(stat);
      status.textContent = result.ok ? `${STAT_LABELS[stat]} training increased.` : result.reason === 'insufficient_incense' ? 'Not enough Incense.' : 'Training is at its current limit.';
    });
    row.append(name, detail, button); stats.append(row); controls[stat] = { detail, button };
  }
  function refresh() {
    const state = progression.state();
    balanceValue.textContent = String(state.wallet.incense);
    for (const stat of TRAINING_STATS) {
      const level = state.training[stat] || 0, cost = trainingCost(state, stat);
      controls[stat].detail.textContent = `Permanent party bonus +${(level * TRAINING_BONUS_PER_LEVEL * 100).toFixed(0)}%`;
      controls[stat].button.textContent = `Train · ${cost}`;
      controls[stat].button.disabled = state.wallet.incense < cost || level >= 100;
    }
  }
  progression.subscribe?.(() => { if (!host.hidden) refresh(); });
  function open() { refresh(); host.hidden = false; close.focus(); }
  document.body.append(host);
  return { open, close() { host.hidden = true; }, refresh, isOpen: () => !host.hidden };
}
