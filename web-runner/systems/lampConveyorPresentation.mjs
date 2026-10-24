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
 if(reconstructing)strip.innerHTML='<div class="lamp-strip-body"><div class="lamp-results lamp-conveyor" aria-label="Moving equipment conveyor"></div><div class="lamp-side"><button class="lamp-collect lamp-bag" data-action="collect" aria-label="Open equipment cache"><img class="lamp-bag-art" src="assets/images/lamp/equipment-bag.png" alt=""><span class="lamp-count"></span></button><button class="lamp-tier-badge" data-action="lamp-upgrades" aria-label="Bag upgrades"><span class="lamp-progress" role="progressbar" aria-label="Bag progress"><span></span><small class="lamp-exp-value"></small></span><span class="lamp-level-disc"><b></b><small>Bag</small></span></button></div></div>';
 bagRecords.set(strip,data);
 const l=data.lamp,lane=strip.querySelector('.lamp-conveyor'),live=new Set();
 let status=strip.querySelector('.lamp-conveyor-notice');
 if(error&&!status){status=document.createElement('p');status.className='lamp-conveyor-notice';status.setAttribute('role','status');strip.append(status);}
 if(status){status.textContent=error;status.hidden=!error;}
 // One emitter and one fixed speed; the combat creation clock determines emission times.
 const laneWidth=lane.getBoundingClientRect().width;
 if(laneWidth<=0)return;
 const scale=strip.getBoundingClientRect().width/360;
 // The lane now extends behind the bag; retain the accepted art size and pace.
 const width=(strip.getBoundingClientRect().width*.7275-4.2*parseFloat(getComputedStyle(strip).fontSize))*.228;
 const entryWidth=width*1.121;
 // Keep full art size; reduce the previous visible empty gap by exactly 40%.
 // One shared pace still drives the regular off-left emitter, never pair placement.
 const gap=(30*scale*5-entryWidth)*.6*.7;
 const pitch=entryWidth+gap*.6,speed=pitch/5;
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
  node.dataset.bestGain=bestGain;node.dataset.collected=String(e.collected);
  const arrow=node.querySelector('.lamp-review-arrow');
  if(bestGain>0&&!arrow){const badge=document.createElement('span');badge.className='lamp-review-arrow';badge.setAttribute('aria-hidden','true');badge.innerHTML='<span class="lamp-cp-direction up"></span>';node.querySelector('.lamp-art').append(badge);}else if(bestGain<=0)arrow?.remove();
 }
 for(const node of lane.querySelectorAll('.lamp-conveyor-item'))if(!live.has(node.dataset.id))node.remove();
 updateBagCount(strip);
 const level=l.capacityTier+1,{current,required,max,fraction}=lampUpgradeProgress(data),p=strip.querySelector('.lamp-progress');
 p.setAttribute('aria-valuenow',String(max?1:Math.min(current,required)));p.setAttribute('aria-valuemax',String(required??1));p.setAttribute('aria-valuetext',max?'Maximum bag level':formatCompactCount(current)+' of '+formatCompactCount(required)+' Bag progress');p.title=max?'MAX':current.toLocaleString('en-US')+' / '+required.toLocaleString('en-US');p.firstElementChild.style.width=fraction*100+'%';p.querySelector('small').textContent=max?'MAX':formatCompactCount(Math.floor(fraction*100))+'%';strip.querySelector('.lamp-level-disc b').textContent=level;
}
