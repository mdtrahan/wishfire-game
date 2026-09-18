import {drawPageBanner} from './chapterMapPresentation.mjs';
import {BACK_ICON,resourceChromeCSS,resourceStrip} from './resourceChrome.mjs';
import {createRainbowBackground} from './rainbowBackground.mjs';
import {EQUIPMENT,RARITIES,equipmentArt} from '../src/core/equipment.mjs';
import {marketOffers,MARKET_CONFIG} from '../src/core/astralMarket.mjs';

export function createAstralMarketUI({canvas,economy,getResources,onBack}){
 let host,tracks,detail,wallet,message,banner,background,resourceKey,drag=null,suppressClick=false,purchasing=false,selected=null,shown=false,refreshing=false,expiredAt=null;
 const cards=new Map();
 const el=(tag,text,parent)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;parent.append(n);return n;};
 function init(){
  host=document.createElement('section');host.id='astral-market';host.setAttribute('aria-label','Astral Flow equipment shop');
  const style=document.createElement('style');style.textContent=`
  #astral-market{position:fixed;z-index:30;color:#f3eee3;background:repeating-linear-gradient(90deg,#fafbff,#e8ebf0 12%,#fff 24%);padding:.8em;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;font:14px/1.35 system-ui}
   #astral-market > *{position:relative;z-index:1} #astral-market .rainbow{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0}
  #astral-market[hidden]{display:none} #astral-market *{box-sizing:border-box;min-width:0}
  #astral-market header{display:flex;align-items:center;justify-content:space-between;gap:.5em;flex:none}
  #astral-market button{font:inherit;color:inherit;border:1px solid #938571;background:#17232d;border-radius:.35em;cursor:pointer;padding:.4em}
  #astral-market button:focus-visible{outline:3px solid #fff;outline-offset:2px} #astral-market button:disabled{opacity:.55;cursor:default}
  #astral-market header strong{white-space:nowrap;margin-right:2em} #astral-market h1{text-shadow:0 2px 4px #37245f,0 0 12px #37245f;font-size:1.15em;letter-spacing:.08em;margin:.5em 0;text-align:center} #astral-market h2{font-size:1em;margin:.2em 0}
  #astral-market .page-banner{position:absolute;left:0;top:3.428571em;background:transparent;width:8em;height:1.714286em;margin:0}
  #astral-market .tracks{position:absolute;inset:0;overflow:hidden;margin:0;background:transparent}
  #astral-market .offer{position:absolute;width:23%;height:7.6em;left:calc(var(--track)*25% + 1%);border:1px solid var(--rarity);background:linear-gradient(#17232f,#10131b);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:.75em;box-shadow:0 -.5em 1.7em -1em var(--rarity);will-change:transform}
  #astral-market .offer[data-special=true]{box-shadow:0 0 1.2em -.3em var(--rarity),0 -2.5em 2em -1.3em var(--rarity)}
  #astral-market .offer[aria-pressed=true]{outline:2px solid #fff}
  #astral-market .offer .art{width:2.7em;height:2.7em;object-fit:contain}
  #astral-market .offer .name{height:2.7em;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.2}
  #astral-market .offer .price{color:#f0cd73} #astral-market .offer[data-affordable=false] .price{color:#ed9b8b}
  #astral-market .offer small{font-size:.7em;color:var(--rarity)}
  #astral-market .inspection{flex:none;min-height:6.5em;border-top:1px solid #615b4d;padding-top:.6em}
  #astral-market .inspection > *{transition:opacity .2s} #astral-market .inspection[data-expired=true] > *{opacity:0} @media(prefers-reduced-motion:reduce){#astral-market .inspection > *{transition:none}}
  #astral-market p{margin:.3em 0} #astral-market .notice{font-size:.85em;min-height:1.4em;color:#ebd39b}
  `;style.textContent+=resourceChromeCSS("#astral-market")+`#astral-market header{position:absolute;left:0;top:0;width:100%;height:0;margin:0} #astral-market .back{position:absolute;left:0;bottom:calc(5.04em + .357143em);width:3.86em;height:2.72em;z-index:2} #astral-market .back svg{width:2.43em;height:1.86em} #astral-market .quest-wallet{left:8.714286em;top:3.428571em;width:16.428571em;height:1.714286em;font-size:inherit;gap:.285714em} #astral-market .balance{height:2em;border-radius:1.2em;font-size:.714286em;gap:.3em} #astral-market .coin-symbol{width:1.3em;height:1.3em;font-size:1em} #astral-market .quest-wallet .resource-symbol,#astral-market .quest-wallet .energy-symbol{font-size:1.6em} #astral-market .inspection{position:absolute;left:.8em;right:.8em;bottom:.8em;height:4.8em;min-height:0;overflow:auto;background:#090e19;padding:.5em;border:2px solid #d9c583;border-radius:.6em;font-size:.9em} #astral-market .inspection[data-drop=true]{border-color:#a2ff62;background:#21472d;box-shadow:0 0 1em #a2ff6280} #astral-market .inspection small{display:none} #astral-market .inspection p{font-size:.85em} #astral-market .inspection:has([data-buy]){display:grid;grid-template-columns:1fr auto;align-items:center;gap:0 .4em} #astral-market .inspection button{grid-column:2;grid-row:1/3} #astral-market .inspection h2{grid-column:1} #astral-market .inspection p{grid-column:1} #astral-market header,#astral-market .page-banner,#astral-market .inspection,#astral-market .notice{z-index:2} #astral-market .notice{position:absolute;left:4.6em;right:.8em;bottom:5.9em} #astral-market .offer{touch-action:none} .flow-drag-ghost{position:fixed;z-index:1000;pointer-events:none;opacity:.9}`;document.head.append(style);document.body.append(host);
  background=createRainbowBackground(host);
  const header=el('header',null,host);const back=el('button',null,host);back.className='back';back.setAttribute('aria-label','Back');back.innerHTML=BACK_ICON;back.onclick=onBack;wallet=el('div',null,header);wallet.style.display='contents';
  banner=el('canvas',null,host);banner.className='page-banner';banner.setAttribute('role','heading');banner.setAttribute('aria-level','1');banner.setAttribute('aria-label','Flow Shop');tracks=el('div',null,host);tracks.className='tracks';tracks.setAttribute('aria-label','Four equipment tracks');
  detail=el('div',null,host);detail.className='inspection';detail.setAttribute('aria-label','Drop equipment here to buy');message=el('p','',host);message.className='notice';message.setAttribute('role','status');
 }
 function inspect(offer){
  selected=offer;expiredAt=null;delete detail.dataset.expired;detail.replaceChildren();const d=EQUIPMENT[offer.equipmentId];
  el('h2',d.name,detail);el('small',`${RARITIES[d.rarity].label} · ${d.type}`,detail);
  el('p',Object.entries(d.stats).map(([k,v])=>`${k} +${v}`).join(' · '),detail);
  const buy=el('button',`BUY · ${offer.price} Gold`,detail);buy.dataset.buy='true';buy.onclick=()=>purchase(offer);

 }
 async function purchase(offer){
  if(purchasing)return;purchasing=true;
  try{await economy.purchase(offer.id);message.textContent=`${EQUIPMENT[offer.equipmentId].name} added to inventory.`;selected=null;detail.replaceChildren();}
  catch(error){message.textContent=error.message;}
  finally{purchasing=false;}
 }
 function finishDrag(event,cancel=false){
  if(!drag||event.pointerId!==drag.pointer)return;
  const active=drag;drag=null;active.ghost?.remove();detail.dataset.drop='false';
  if(active.ghost){suppressClick=true;setTimeout(()=>suppressClick=false,0);const r=detail.getBoundingClientRect();if(!cancel&&event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom)void purchase(active.offer);}
 }
 function enableDrag(card,offer){
  card.onpointerdown=e=>{if(e.button!==0||purchasing||drag)return;drag={pointer:e.pointerId,x:e.clientX,y:e.clientY,offer};card.setPointerCapture(e.pointerId);};
  card.onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId)return;
   if(!drag.ghost&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6){const r=card.getBoundingClientRect();drag.ghost=card.cloneNode(true);drag.ghost.removeAttribute('data-offer');drag.ghost.className='flow-drag-ghost';drag.ghost.setAttribute('aria-hidden','true');drag.ghost.style.cssText=`position:fixed;width:${r.width}px;height:${r.height}px;background:#17232f;border:2px solid #e9cd7d;border-radius:8px;display:grid;place-items:center;color:white;pointer-events:none;z-index:1000`;drag.ghost.querySelector('img').style.cssText='width:40%;height:40%';document.body.append(drag.ghost);}
   if(drag.ghost){drag.ghost.style.left=`${e.clientX-drag.ghost.offsetWidth/2}px`;drag.ghost.style.top=`${e.clientY-drag.ghost.offsetHeight/2}px`;const r=detail.getBoundingClientRect();detail.dataset.drop=String(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom);}
  };
  card.onpointerup=e=>finishDrag(e);card.onpointercancel=e=>finishDrag(e,true);card.onlostpointercapture=e=>finishDrag(e,true);
 }
 return {
  hide(){if(drag)finishDrag({pointerId:drag.pointer},true);if(host)host.hidden=true;if(shown){shown=false;economy.refresh().catch(()=>{});}},
  draw(){
   if(!host)init();host.hidden=false;
   if(!shown){shown=true;selected=null;expiredAt=null;delete detail.dataset.expired;detail.replaceChildren();message.textContent='';refreshing=true;economy.refresh().catch(e=>message.textContent=e.message).finally(()=>refreshing=false);}
   const r=canvas.getBoundingClientRect();Object.assign(host.style,{left:`${r.x}px`,top:`${r.y}px`,width:`${r.width}px`,height:`${r.height}px`,fontSize:`${14*r.width/360}px`});
   const scale=r.width/360,dpr=window.devicePixelRatio||1;
   const bw=Math.round(112*scale*dpr),bh=Math.round(24*scale*dpr);
   if(banner.width!==bw||banner.height!==bh){banner.width=bw;banner.height=bh;const ctx=banner.getContext('2d');ctx.setTransform(bw/112,0,0,bh/24,0,0);drawPageBanner(ctx,{x:0,y:1,w:111,h:22,text:'FLOW SHOP'});}
   if(!economy.data||refreshing)return;
   const data=economy.data,now=economy.time();const resources={gold:data.gold,...getResources()};const key=JSON.stringify(resources);if(key!==resourceKey){wallet.innerHTML=resourceStrip(resources);resourceKey=key;}
   const lights=[];const offers=marketOffers(data.market,now,data.items),ids=new Set(offers.map(o=>o.id));
   for(const [id,card] of cards)if(!ids.has(id)&&drag?.offer.id!==id){card.remove();cards.delete(id);}
   for(const offer of offers){
    const d=EQUIPMENT[offer.equipmentId];let card=cards.get(offer.id);
    if(!card){card=el('button',null,tracks);card.className='offer';card.dataset.offer=offer.id;card.style.setProperty('--track',offer.track);card.style.setProperty('--rarity',RARITIES[d.rarity].color);card.dataset.special=String(Object.keys(RARITIES).indexOf(d.rarity)>=Object.keys(RARITIES).indexOf(MARKET_CONFIG.specialPresentationThreshold));
     const art=el('img',null,card);art.src=equipmentArt(d);art.alt='';art.className='art';el('span',d.name,card).className='name';el('small',RARITIES[d.rarity].label,card);el('strong',`${offer.price} Gold`,card).className='price';card.setAttribute('aria-label',`Inspect ${d.name}, ${RARITIES[d.rarity].label}, ${offer.price} Gold`);card.onclick=()=>{if(!suppressClick)inspect(offer);};enableDrag(card,offer);cards.set(offer.id,card);
    }
    const height=tracks.clientHeight;lights.push({x:(offer.track+.5)/4,y:(offer.progress*(height+card.offsetHeight)-card.offsetHeight)/height,color:RARITIES[d.rarity].color});card.style.top=`${offer.progress*(height+card.offsetHeight)-card.offsetHeight}px`;card.dataset.affordable=String(data.gold>=offer.price);card.setAttribute('aria-pressed',String(selected?.id===offer.id));
   }
   background.draw(r.width,r.height,lights);
   if(selected){
    const live=ids.has(selected.id),buy=detail.querySelector('[data-buy]');
    if(buy)buy.disabled=purchasing||!live||data.gold<selected.price;
    if(!live&&!purchasing){
     expiredAt??=performance.now();detail.dataset.expired='true';
     if(performance.now()-expiredAt>=200){selected=null;expiredAt=null;delete detail.dataset.expired;detail.replaceChildren();}
    }
   }
   if(!selected&&!detail.childNodes.length){
    delete detail.dataset.expired;
    const hint=el('p','Drag equipment here to buy. Tap an item for details.',detail);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)hint.animate([{opacity:0},{opacity:1}],{duration:200});
   }
  }
 };
}
