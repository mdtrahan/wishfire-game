import {CONVEYOR_TRAVEL_MS} from '../src/core/lampConveyor.mjs';
import {lampItemCPGain,lampCapacity,lampStoredCount,LAMP_CONFIG} from '../src/core/lampGear.mjs';
import {beginLampBagWishRing,watchLampBagBounceCrest} from './lampBagWishRing.mjs';

const passageAnimations=new WeakMap();
const bagEffects=new WeakMap();
const crestWatches=new WeakMap();
const bagRecords=new WeakMap();
function updateBagCount(strip){
 const data=bagRecords.get(strip);if(!data)return;
 const l=data.lamp,stored=lampStoredCount(data),queued=new Set([...l.pending,...(l.discarded||[])]);
 // Saved gear in transit is safe in inventory, but has not reached this bag yet.
 // Read current queue membership so equipped/dismantled items cannot increment later.
 const incoming=new Set([...strip.querySelectorAll('.lamp-conveyor-item')]
  .filter(node=>(!node.hidden||node.dataset.countPending==='true')&&node.dataset.countReceived!=='true'&&queued.has(node.dataset.id))
  .map(node=>node.dataset.id));
 const collect=strip.querySelector('.lamp-collect'),count=strip.querySelector('.lamp-count');
 collect.dataset.held=String(!!l.reviewHold);
 collect.setAttribute('aria-label',`Open equipment cache, ${stored} of ${lampCapacity(data)}${incoming.size?`, ${incoming.size} arriving`:''}${l.reviewHold?', one item held for review':''}`);
 count.dataset.storedCount=String(stored);count.dataset.incomingCount=String(incoming.size);
 count.textContent=(stored-incoming.size)+(l.reviewHold?'+1':'');
}
export function acknowledgeConveyorItem(strip,id){
 const node=[...strip.querySelectorAll('.lamp-conveyor-item')].find(n=>n.dataset.id===id);
 if(node){node.dataset.countReceived='true';delete node.dataset.countPending;}
 updateBagCount(strip);
}
function bounceBag(strip,node){
 const receive=()=>{node.dataset.countReceived='true';delete node.dataset.countPending;updateBagCount(strip);};
 if(strip.hidden||document.hidden){receive();return;}
 const art=strip.querySelector('.lamp-bag-art'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 bagEffects.get(strip)?.cancel();crestWatches.get(strip)?.();
 passageAnimations.get(strip)?.cancel();
 const effect=beginLampBagWishRing(art);bagEffects.set(strip,effect);
 if(reduced){receive();return;}
 const animation=art.animate([{transform:'scale(1)'},{transform:'scale(1)',offset:.15},{transform:'scale(1.4375)',offset:.4},{transform:'scale(1.4375)',offset:.6},{transform:'scale(1)',offset:.85},{transform:'scale(1)'}],{duration:800,easing:'cubic-bezier(0.680, -0.550, 0.265, 1.550)'});
 passageAnimations.set(strip,animation);
 crestWatches.set(strip,watchLampBagBounceCrest(art,animation,effect));
 // Flat endpoint segments keep the easing anticipation from shrinking below base. Acknowledge one frame after visible
 // expansion, rather than at animate() creation or before the first grown frame.
 const afterExpansion=()=>{
  if(!node.isConnected)return;
  const animation=passageAnimations.get(strip),transform=getComputedStyle(art).transform;
  const scale=transform==='none'?1:new DOMMatrixReadOnly(transform).a;
  if(scale>1.01){requestAnimationFrame(receive);return;}
  if(strip.hidden||document.hidden||!animation||['finished','idle'].includes(animation.playState)){receive();return;}
  requestAnimationFrame(afterExpansion);
 };
 requestAnimationFrame(afterExpansion);
}

// Persistent DOM nodes keep CSS motion independent of saves and cache rendering.
export function updateLampConveyor({strip,data,heroes,now,tile,gearBounds=[],error=''}){
 const reconstructing=!strip.querySelector('.lamp-conveyor');
 if(reconstructing)strip.innerHTML='<div class="lamp-strip-body"><div class="lamp-results lamp-conveyor" aria-label="Moving equipment conveyor"></div><div class="lamp-side"><button class="lamp-collect lamp-bag" data-action="collect" aria-label="Open equipment cache"><img class="lamp-bag-art" src="assets/images/lamp/equipment-bag.png" alt=""><span class="lamp-count"></span></button><button class="lamp-tier-badge" data-action="lamp-upgrades" aria-label="Lamp upgrades"><span class="lamp-progress" role="progressbar" aria-label="Purchased lamp upgrade stages"><span></span><small class="lamp-exp-value"></small></span><span class="lamp-level-disc"><b></b><small>Lamp</small></span></button></div></div>';
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
 // Keep the whole art width; shrink the already-reduced empty gap another 30%.
 // One shared pace still drives the regular off-left emitter, never pair placement.
 const pitch=entryWidth+(30*scale*5-entryWidth)*.6*.7,speed=pitch/5;
 lane.style.setProperty('--conveyor-start',-entryWidth+'px');
 const bag=strip.querySelector('.lamp-bag').getBoundingClientRect();
 const destination=bag.left+bag.width/2-lane.getBoundingClientRect().left-width/2;
 const duration=(destination+entryWidth)/speed;
 lane.style.setProperty('--conveyor-tile-width',width+'px');
 lane.style.setProperty('--conveyor-end',destination+'px');
 lane.style.setProperty('--conveyor-duration',duration+'s');
 for(const e of l.emissions||[]){
  const age=Math.max(0,now-e.issuedAt);if(age>=CONVEYOR_TRAVEL_MS||gearBounds.length<9)continue;live.add(e.item.instanceId);
  let node=[...lane.querySelectorAll('.lamp-conveyor-item')].find(n=>n.dataset.id===e.item.instanceId);
  const bestGain=Math.max(0,...heroes.map(h=>lampItemCPGain(data,e.item,h)));
  if(!node){
   const template=document.createElement('template');template.innerHTML=tile(e.item,'conveyor');node=template.content.firstElementChild;node.classList.add('lamp-conveyor-item');
   node.style.animationDelay=`-${age/1000}s`;
   // Replayed previews already past the bag are hidden without replaying feedback.
   if(age>=duration*1000){node.hidden=true;node.style.display='none';node.dataset.collectionAttempted='true';node.dataset.countReceived='true';}
   node.addEventListener('animationend',event=>{if(event.animationName!=='lamp-conveyor-travel'||event.target!==node||node.hidden)return;node.hidden=true;node.style.display='none';node.dataset.arrived='true';node.dataset.countPending='true';if(node.isConnected)bounceBag(strip,node);});lane.append(node);
  }
  node.dataset.bestGain=bestGain;node.dataset.collected=String(e.collected);
  const arrow=node.querySelector('.lamp-review-arrow');
  if(bestGain>0&&!arrow){const badge=document.createElement('span');badge.className='lamp-review-arrow';badge.setAttribute('aria-hidden','true');badge.innerHTML='<span class="lamp-cp-direction up"></span>';node.querySelector('.lamp-art').append(badge);}else if(bestGain<=0)arrow?.remove();
 }
 for(const node of lane.querySelectorAll('.lamp-conveyor-item'))if(!live.has(node.dataset.id))node.remove();
 updateBagCount(strip);
 const level=l.capacityTier+1,stages=l.upgradeStage||0,max=level===LAMP_CONFIG.lampLevels,p=strip.querySelector('.lamp-progress');
 p.setAttribute('aria-valuenow',String(max?4:stages));p.setAttribute('aria-valuemax','4');p.firstElementChild.style.width=(max?100:stages/4*100)+'%';p.querySelector('small').textContent=max?'MAX':stages+' / 4';strip.querySelector('.lamp-level-disc b').textContent=level;
}
