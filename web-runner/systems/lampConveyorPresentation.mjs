import {CONVEYOR_TRAVEL_MS,conveyorItemAge} from '../src/core/lampConveyor.mjs';
import {lampItemCPGain,lampCapacity,lampStoredCount,LAMP_CONFIG,lampUpgradeProgress} from '../src/core/lampGear.mjs';
import {beginLampBagWishRing,watchLampBagBounceCrest} from './lampBagWishRing.mjs';
import {formatCompactCount} from '../src/core/formatCompactCount.mjs';

const passageAnimations=new WeakMap();
const bagEffects=new WeakMap();
const crestWatches=new WeakMap();
const bagRecords=new WeakMap();
const conveyorAnimations=new WeakMap();
function updateBagCount(strip){
 const data=bagRecords.get(strip);if(!data)return;
 const l=data.lamp,stored=lampStoredCount(data),collect=strip.querySelector('.lamp-collect'),count=strip.querySelector('.lamp-count');
 collect.dataset.held=String(!!l.reviewHold);
 collect.setAttribute('aria-label',`Open equipment cache, ${stored} of ${lampCapacity(data)}${l.reviewHold?', one item held for review':''}`);
 count.dataset.storedCount=String(stored);count.dataset.incomingCount='0';
 count.textContent=stored+(l.reviewHold?'+1':'');
}
export function acknowledgeConveyorItem(strip,id,{animate=false}={}){
 const node=[...strip.querySelectorAll('.lamp-conveyor-item')].find(n=>n.dataset.id===id),data=bagRecords.get(strip);
 if(node){
  const received=node.dataset.countReceived==='true';
  if(node.dataset.arrived==='true'){node.hidden=true;node.style.display='none';}
  node.dataset.countReceived='true';delete node.dataset.countPending;
  if(animate&&!received&&node.dataset.collected==='true'&&[...data.lamp.pending,...data.lamp.discarded].includes(id))bounceBag(strip);
 }
 updateBagCount(strip);
}
function bounceBag(strip){
 if(strip.hidden||document.hidden)return;
 const art=strip.querySelector('.lamp-bag-art'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 bagEffects.get(strip)?.cancel();crestWatches.get(strip)?.();
 passageAnimations.get(strip)?.cancel();
 const effect=beginLampBagWishRing(art);bagEffects.set(strip,effect);
 if(reduced)return;
 const animation=art.animate([{transform:'scale(1)'},{transform:'scale(1)',offset:.15},{transform:'scale(1.4375)',offset:.4},{transform:'scale(1.4375)',offset:.6},{transform:'scale(1)',offset:.85},{transform:'scale(1)'}],{duration:800,easing:'cubic-bezier(0.680, -0.550, 0.265, 1.550)'});
 passageAnimations.set(strip,animation);
 crestWatches.set(strip,watchLampBagBounceCrest(art,animation,effect));
}

// Persistent DOM nodes keep CSS motion independent of saves and cache rendering.
export function updateLampConveyor({strip,data,heroes,now,activeMs=data.lamp.conveyorActiveMs,paused=false,tile,gearBounds=[],error=''}){
 strip.dataset.conveyorPaused=String(paused);
 const reconstructing=!strip.querySelector('.lamp-conveyor');
 if(reconstructing)strip.innerHTML='<div class="lamp-strip-body"><div class="lamp-results lamp-conveyor" aria-label="Moving equipment conveyor"></div><div class="lamp-side"><div class="lamp-bag"><button class="lamp-bag-upgrades" data-action="lamp-upgrades" aria-label="Bag upgrades"><img class="lamp-bag-art" src="assets/images/lamp/equipment-bag.png" alt=""><svg class="lamp-bag-level" viewBox="336 25 20 18" aria-hidden="true"><defs><linearGradient id="lamp-level-rim" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff0b5"/><stop offset=".4" stop-color="#d5ab5b"/><stop offset="1" stop-color="#785024"/></linearGradient><linearGradient id="lamp-level-jewel" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8650b0"/><stop offset=".42" stop-color="#602a87"/><stop offset="1" stop-color="#341447"/></linearGradient></defs><path d="M346 25.75L355.5 34L346 42.25L336.5 34Z" fill="url(#lamp-level-rim)" stroke="#382219" stroke-width=".7"/><path d="M346 27.2L353.7 34L346 40.8L338.3 34Z" fill="url(#lamp-level-jewel)"/><path d="M338.5 33.8L346 27.4L353.5 33.8" fill="none" stroke="#c7a3dc" stroke-opacity=".48" stroke-width=".45"/><text x="346" y="34.35" text-anchor="middle" dominant-baseline="central" font-family="Arial,sans-serif" font-size="12" font-weight="900" fill="#fff8dd" stroke="#291035" stroke-width="1.1" paint-order="stroke"></text></svg></button><button class="lamp-collect" data-action="collect" aria-label="Open equipment cache"><span class="lamp-count"></span></button></div></div></div><div class="lamp-progress" role="progressbar" aria-label="Bag progress"><span></span></div>';
 bagRecords.set(strip,data);
 const l=data.lamp,lane=strip.querySelector('.lamp-conveyor'),live=new Set();
 let status=strip.querySelector('.lamp-conveyor-notice');
 if(error&&!status){status=document.createElement('p');status.className='lamp-conveyor-notice';status.setAttribute('role','status');strip.append(status);}
 if(status){status.textContent=error;status.hidden=!error;}
 // One emitter and one fixed speed; the combat creation clock determines emission times.
 const laneWidth=lane.getBoundingClientRect().width;
 if(laneWidth<=0)return;
 const scale=strip.getBoundingClientRect().width/360;
 // Four previews share the reclaimed lane, retaining independent 32px art.
 const width=48*scale,entryWidth=width;
 const speed=78*scale/5;
 lane.style.setProperty('--conveyor-start',-entryWidth+'px');
 const bag=strip.querySelector('.lamp-bag').getBoundingClientRect();
 const destination=bag.left+bag.width/2-lane.getBoundingClientRect().left-width/2;
 const duration=(destination+entryWidth)/speed;
 lane.style.setProperty('--conveyor-tile-width',width+'px');
 lane.style.setProperty('--conveyor-end',destination+'px');
 lane.style.setProperty('--conveyor-duration',duration+'s');
 for(const e of l.emissions||[]){
  const age=conveyorItemAge(l,e,now,activeMs);if(age>=CONVEYOR_TRAVEL_MS||gearBounds.length<9)continue;live.add(e.item.instanceId);
  let node=[...lane.querySelectorAll('.lamp-conveyor-item')].find(n=>n.dataset.id===e.item.instanceId);
  const bestGain=Math.max(0,...heroes.map(h=>lampItemCPGain(data,e.item,h)));
  if(!node){
   const template=document.createElement('template');template.innerHTML=tile(e.item,'conveyor');node=template.content.firstElementChild;node.classList.add('lamp-conveyor-item');
   // Replayed previews already past the bag are hidden without replaying feedback.
   if(age>=duration*1000){node.hidden=true;node.style.display='none';node.dataset.collectionAttempted='true';node.dataset.countReceived='true';}
   node.addEventListener('animationend',event=>{if(event.animationName!=='lamp-conveyor-travel'||event.target!==node||node.hidden)return;node.dataset.arrived='true';node.dataset.countPending='true';if(node.dataset.collected==='true')acknowledgeConveyorItem(strip,node.dataset.id);});lane.append(node);
  }
  // Hiding the strip discards CSS animations even when its DOM nodes survive.
  // Seek replacements and gate transitions from the same active clock as issuance.
  const motion=node.getAnimations().find(a=>a.animationName==='lamp-conveyor-travel');
  if(motion&&(conveyorAnimations.get(node)!==motion||node.dataset.clockPaused!==String(paused))){
   motion.currentTime=age;
   conveyorAnimations.set(node,motion);
  }
  node.dataset.clockPaused=String(paused);
  const target=node.getBoundingClientRect(),clip=lane.getBoundingClientRect();
  // Clipped previews never offer a smaller or overlapping interactive target.
  node.disabled=node.hidden||target.left<clip.left-.01||target.right>clip.right+.01;
  node.dataset.bestGain=bestGain;node.dataset.collected=String(e.collected);
  const arrow=node.querySelector('.lamp-review-arrow');
  if(bestGain>0&&!arrow){const badge=document.createElement('span');badge.className='lamp-review-arrow';badge.setAttribute('aria-hidden','true');badge.innerHTML='<span class="lamp-cp-direction up"></span>';node.querySelector('.lamp-art').append(badge);}else if(bestGain<=0)arrow?.remove();
 }
 for(const node of lane.querySelectorAll('.lamp-conveyor-item'))if(!live.has(node.dataset.id))node.remove();
 updateBagCount(strip);
 const level=l.capacityTier+1,{current,required,max,fraction}=lampUpgradeProgress(data),p=strip.querySelector('.lamp-progress');
 p.setAttribute('aria-valuenow',String(max?1:Math.min(current,required)));p.setAttribute('aria-valuemax',String(required??1));p.setAttribute('aria-valuetext',max?'Maximum bag level':formatCompactCount(current)+' of '+formatCompactCount(required)+' Bag progress');p.title=max?'MAX':current.toLocaleString('en-US')+' / '+required.toLocaleString('en-US');p.firstElementChild.style.width=fraction*100+'%';strip.querySelector('.lamp-bag-level text').textContent=level;strip.querySelector('.lamp-bag-upgrades').setAttribute('aria-label','Bag upgrades, level '+level);
}
