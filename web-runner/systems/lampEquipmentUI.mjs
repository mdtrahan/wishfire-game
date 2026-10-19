import {conveyorReviewCandidates} from '../src/core/lampConveyor.mjs';
import {updateLampConveyor,acknowledgeConveyorItem} from './lampConveyorPresentation.mjs';
import {LAMP_CONFIG,LAMP_GUIDE,GEAR_STATS,lampStoredCount,compareLampItem,lampGearCP,lampItemCPGain,lampCapacity,lampStageCost,LAMP_CAPACITY_TIERS} from '../src/core/lampGear.mjs';
import {RARITIES,EQUIPMENT_SLOTS,equipmentStats} from '../src/core/equipment.mjs';
import {HERO_ART_ASSETS,heroArtKey} from '../state/heroArtAssets.mjs';
import {computeCombatPower} from '../src/core/combatPower.mjs';
import {refreshHeroStats} from '../src/core/heroProgression.mjs';
import {heroDefinition} from '../src/core/heroDefinitions.mjs';
import {runtimeAssetUrl} from './runtimeAssetUrl.mjs';
import {isRewardReceiptVisible,positionRewardReceipt,showRewardReceipt} from './rewardReceiptUI.mjs';

export function createLampEquipmentUI({canvas,economy,globals,eventBus,isPaused=()=>false,onBeforeOpen=()=>{}}){
 const gearBounds=[];
 let strip,modal,dialog,helper,lastInteraction=performance.now(),open=false,upgradeOpen=false,selectedItem=null,selectedHero=null,busy=false,opening=false,closeRequested=false,pendingAction=Promise.resolve(),gearReady,feedbacks=new Set(),notice='',lastKey='',lastEmissionFrame=null,emissionElapsed=0,creationActive=false,lastFocus,disposalView=false,disposalPreview=null,emissionPending=false,arrivalPending=false,autoTransitionAfterFeedback=false;
 const fontMeasure=document.createElement('canvas').getContext('2d');
 const heroes=()=>Object.values(globals.HeroProgress?.heroes||{}).slice(0,4);

 const otherMenuOpen=()=>[...document.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog[open],[aria-modal="true"]')].some(n=>n!==dialog&&n.getClientRects().length>0);
 const context=()=>globals.ContinuousCombatStage||{region:1,stage:1};
 const canConvey=(data=economy.data)=>!!(strip&&!strip.hidden&&!document.hidden&&!open&&!opening&&!isPaused()&&!otherMenuOpen()&&data&&lampStoredCount(data)<lampCapacity(data));
 const item=id=>economy.data?.items.find(i=>i.instanceId===id)||(economy.data?.lamp.reviewHold?.item.instanceId===id?economy.data.lamp.reviewHold.item:null);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const atlas=(i,cls='',upgrade=false,labels=true)=>'<span class="lamp-art '+cls+'" style="--col:'+(i.art%3)+';--row:'+Math.floor(i.art/3)+';--gear-midpoint:var(--lamp-gear-midpoint-'+i.art+',50%)" aria-hidden="true">'+(labels?'<span class="lamp-level">Lv.'+i.level+'</span>':'')+(upgrade?'<span class="lamp-review-arrow"><span class="lamp-cp-direction up"></span></span>':'')+'</span>';
 const tile=(i,action='inspect',review=null,artOnly=false)=>'<button class="lamp-tile" style="--rarity:'+RARITIES[i.rarity].color+'" data-action="'+action+'" data-cp="'+lampGearCP(i)+'" data-id="'+escape(i.instanceId)+'"'+(review?(' data-queue="'+review.queue+'" data-best-gain="'+review.bestGain+'"'):'')+(i.instanceId===selectedItem?' aria-current="true"':'')+' aria-label="'+(action==='conveyor'?'Collect ':'Inspect ')+escape(i.name)+', '+RARITIES[i.rarity].label+', level '+i.level+'">'+atlas(i,'',review?.bestGain>0,!artOnly)+(action==='queue'&&!artOnly?'<small>CP '+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(lampGearCP(i))+'</small>':'')+'</button>';
 function init(){
  if(strip)return;
  const art=new Image();art.src=runtimeAssetUrl('images/lamp/gear-atlas.png');
  gearReady=art.decode().then(async()=>{
   const centered=document.createElement('canvas');centered.width=art.width;centered.height=art.height;
   const ctx=centered.getContext('2d');ctx.drawImage(art,0,0);const pixels=ctx.getImageData(0,0,art.width,art.height).data,size=art.height/3;ctx.clearRect(0,0,art.width,art.height);
   for(let n=0;n<9;n++){
    const left=n%3*size,row=Math.floor(n/3)*size;let top=size,bottom=-1,xMin=size,xMax=-1;
    // Ignore nearly transparent atlas bleed when locating the visible silhouette.
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(pixels[((row+y)*art.width+left+x)*4+3]>8){top=Math.min(top,y);bottom=Math.max(bottom,y);xMin=Math.min(xMin,x);xMax=Math.max(xMax,x);}
    gearBounds[n]={left:xMin/size,right:(xMax+1)/size,height:Math.max(0,bottom-top+1),midpoint:bottom<0?50:(top+bottom+1)/2/size*100};
    document.documentElement.style.setProperty('--lamp-gear-midpoint-'+n,gearBounds[n].midpoint+'%');
    const offset=bottom<0?0:(size-top-bottom-1)/2;
    ctx.save();ctx.beginPath();ctx.rect(left,row,size,size);ctx.clip();ctx.drawImage(art,left,row,size,size,left,row+offset,size,size);ctx.restore();
   }
   const background=await new Promise(resolve=>centered.toBlob(blob=>resolve(URL.createObjectURL(blob))));
   document.documentElement.style.setProperty('--lamp-gear-atlas','url("'+background+'")');
  });gearReady.catch(()=>{});
  const style=document.createElement('link');style.rel='stylesheet';style.href='assets/lampEquipmentUI.css';document.head.append(style);
  strip=document.createElement('section');strip.id='wishfire-lamp';strip.setAttribute('aria-label','Equipment lamp');strip.hidden=true;
  modal=document.createElement('div');modal.id='lamp-overlay';modal.hidden=true;
  dialog=document.createElement('section');dialog.id='lamp-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Choose a hero for lamp equipment');dialog.tabIndex=-1;modal.append(dialog);
  helper=document.createElement('div');helper.className='lamp-idle-helper';helper.hidden=true;helper.setAttribute('aria-hidden','true');helper.innerHTML='<span></span><span></span><img src="assets/images/lamp/genie-pointer.png" alt="">';
  document.body.append(strip,modal,helper);
  for(const type of ['pointerdown','click','keydown','wheel'])document.addEventListener(type,resetHelper,{capture:true,passive:true});
  const freezeConveyor=()=>{lastEmissionFrame=null;creationActive=false;strip.dataset.conveyorPaused='true';void economy.setConveyorActive(false).catch(e=>{notice=e.message;lastKey='';});};
  document.addEventListener('visibilitychange',()=>{resetHelper();if(document.hidden)freezeConveyor();else lastEmissionFrame=null;});
  window.addEventListener('pagehide',freezeConveyor);
  strip.addEventListener('click',onClick);dialog.addEventListener('click',onClick);
  modal.addEventListener('click',e=>{if(e.target===modal&&!busy)close();});
  dialog.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&!busy){e.preventDefault();close();}
   if(e.key==='Tab'){const buttons=[...dialog.querySelectorAll('button:not(:disabled)')];const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  });
  eventBus?.on('lamp:open',()=>openCollection());
 }
 async function openCollection(id,upgrades=false){
  if(opening)return;opening=true;
  try{onBeforeOpen();init();await pendingAction;await Promise.all([economy.sync(),gearReady]);if(!upgrades&&!lampStoredCount(economy.data)&&!economy.data.lamp.reviewHold)return close();resetHelper();lastFocus=document.activeElement;closeRequested=false;open=true;upgradeOpen=upgrades;disposalView=false;disposalPreview=null;selectedItem=upgrades?null:id||conveyorReviewCandidates(economy.data,heroes()).find(c=>c.bestGain>0)?.item.instanceId||null;selectedHero=null;notice='';lastKey='';if(!upgrades&&!conveyorReviewCandidates(economy.data,heroes()).some(c=>c.bestGain>0))reviewDisposal();render();dialog.focus();const step=upgrades?'preview':'storage';if(!(economy.data.lamp.guide&LAMP_GUIDE[step]))await economy.markGuide(step);}
  catch(e){notice=e.message;lastKey='';render();}finally{opening=false;}
 }
 function close(){if(feedbacks.size){closeRequested=true;return;}closeRequested=false;resetHelper();open=false;modal.hidden=true;lastKey='';lastFocus?.focus?.();}
 function action(fn){if(busy)return;notice='';busy=true;lastKey='';render();return pendingAction=(async()=>{try{await fn();}catch(e){notice=e.message;}finally{busy=false;lastKey='';render();}})();}
 function onClick(e){
  const b=e.target.closest('button[data-action]');if(!b||busy)return;
  const kind=b.dataset.action,id=b.dataset.id;
  if(kind==='close')return close();
  if(kind==='inspect')return openCollection(id);
  if(kind==='conveyor'&&canConvey())return void action(async()=>{const result=await economy.collect(id,canConvey);if(result){render();acknowledgeConveyorItem(strip,id);setTimeout(()=>openCollection(id),0);}});
  if(kind==='disposal'){reviewDisposal();lastKey='';return render();}
  if(kind==='queue-disposal')return void action(async()=>{await economy.queueDisposal(selectedItem);selectedItem=null;selectedHero=null;disposalView=true;disposalPreview=economy.disposalPreview();});
  if(kind==='collect')return openCollection();
  if(kind==='lamp-upgrades')return openCollection(null,true);
  if(kind==='hero'){closeRequested=false;selectedHero=id;lastKey='';render();if(!(economy.data.lamp.guide&LAMP_GUIDE.comparison))return void action(()=>economy.markGuide('comparison'));return;}
  if(kind==='skip'){selectedItem=null;selectedHero=null;lastKey='';return render();}
  if(kind==='queue'&&item(id)){selectedItem=id;selectedHero=null;lastKey='';return render();}
  if(kind==='equip'&&selectedHero&&selectedItem)return void action(async()=>{dialog.scrollTop=0;const result=await economy.equip(selectedHero,selectedItem),name=heroDefinition(heroes().find(h=>h.heroInstanceKey===result.heroId)).name,anchor=dialog.querySelector('[data-action="hero"][data-id="'+result.heroId+'"]').getBoundingClientRect();showEquipFeedback(result,name,anchor);selectedItem=null;selectedHero=null;});
  if(kind==='auto-equip')return void action(async()=>{dialog.scrollTop=0;const anchors=new Map(heroes().flatMap(h=>{const portrait=dialog.querySelector('[data-action="hero"][data-id="'+h.heroInstanceKey+'"]');return portrait?[[h.heroInstanceKey,portrait.getBoundingClientRect()]]:[];})),results=await economy.autoEquip();results.forEach(r=>{const anchor=anchors.get(r.heroId);if(anchor)showEquipFeedback(r,heroDefinition(heroes().find(h=>h.heroInstanceKey===r.heroId)).name,anchor);});selectedItem=null;selectedHero=null;autoTransitionAfterFeedback=feedbacks.size>0;if(!autoTransitionAfterFeedback)reviewDisposal();});
  if(kind==='purchase-stage')return void action(async()=>{await economy.purchaseStage(Number(b.dataset.tier),Number(b.dataset.stage));notice=economy.data.lamp.upgradeEndsAt?'Upgrade construction started.':'Upgrade stage '+economy.data.lamp.upgradeStage+' of '+LAMP_CONFIG.upgradeStages+' purchased.';});
  if(kind==='upgrade')return void action(async()=>{await economy.upgrade(Number(b.dataset.tier));notice='Upgrade construction started.';});
  if(kind==='speed-up')return void action(async()=>{const used=await economy.speedUp(Number(b.dataset.tier));notice=used+' speed-up ticket'+(used===1?'':'s')+' spent.';});
  if(kind==='dismantle')return void action(async()=>{const r=await economy.dismantle(disposalPreview);document.querySelectorAll('.lamp-party-exp').forEach(n=>n.remove());notice='';selectedItem=null;selectedHero=null;close();showDismantleReward(r);});
 }
 function reviewDisposal(){const upgrade=conveyorReviewCandidates(economy.data,heroes()).find(c=>c.bestGain>0);if(upgrade){selectedItem=upgrade.item.instanceId;selectedHero=null;disposalView=false;disposalPreview=null;notice='';return;}selectedItem=null;selectedHero=null;disposalPreview=economy.disposalPreview();notice='';disposalView=!!(disposalPreview.ids.length||economy.data.lamp.salvage.count);if(!disposalView)close();}
 function startEmission(){lastKey='';render();}
 function showDismantleReward(result){
  showRewardReceipt(canvas,{resource:'essence',amount:result.essence},'DISMANTLED',2000);position();
 }
 async function reveal(draw){await gearReady;const i=await draw();if(i)startEmission(i);}
 function resetHelper(){lastInteraction=performance.now();if(helper)helper.hidden=true;}
 function updateHelper(){
  if(strip.hidden||busy||opening||document.hidden||isRewardReceiptVisible()||performance.now()-lastInteraction<15000){helper.hidden=true;return;}
  const data=economy.data,l=data?.lamp;if(!l){helper.hidden=true;return;}
  let selectors;
  if(open)selectors=upgradeOpen?['[data-action="purchase-stage"]','[data-action="speed-up"]','[data-action="upgrade"]','[data-action="close"]']:selectedItem?(selectedHero?['[data-action="auto-equip"]','[data-action="equip"]','[data-action="skip"]']:['[data-action="hero"][data-id="Huun"]','[data-action="hero"]']):(disposalView?['[data-action="dismantle"]','[data-action="close"]']:['[data-action="auto-equip"]','[data-action="disposal"]','[data-action="close"]']);
  else if(l.capacityTier===0)selectors=lampStoredCount(data)?['[data-action="collect"]']:(!(l.guide&LAMP_GUIDE.preview)&&l.essence>0||l.essence>=lampStageCost(data))?['[data-action="lamp-upgrades"]']:['[data-action="collect"]'];
  const scope=open?dialog:strip,target=selectors?.map(s=>scope.querySelector(s+':not(:disabled)')).find(Boolean);
  if(!target){helper.hidden=true;return;}
  let r=target.getBoundingClientRect();const bounds=scope.getBoundingClientRect();
  if(open&&(r.top<bounds.top||r.bottom>bounds.bottom)){target.scrollIntoView({block:'nearest'});r=target.getBoundingClientRect();}
  helper.dataset.target=target.dataset.action==='hero'?target.dataset.id:target.dataset.action;
  helper.dataset.step=upgradeOpen?'upgrade':target.dataset.action;
  const x=r.left+r.width/2,y=r.top+r.height/2,size=Math.max(48,Math.min(80,bounds.width*.19)),rotated=helper.dataset.target==='auto-equip';
  helper.style.left=x+'px';helper.style.top=y+'px';helper.style.setProperty('--hand-size',size+'px');
  helper.style.setProperty('--hand-x',!rotated&&x+size*.82+5>innerWidth-2?'-1':'1');helper.style.setProperty('--hand-y',!rotated&&y+size*.82+5>innerHeight-2?'-1':'1');
  helper.style.setProperty('--ring-size',Math.min(size,Math.max(12,Math.min(x,innerWidth-x,y,innerHeight-y)*4/3-8))+'px');helper.hidden=false;
 }
 function showEquipFeedback(result,name,anchor){
  const feedback=document.createElement('div');feedback.className='lamp-cp-feedback '+(result.cpChange>0?'positive':result.cpChange<0?'negative':'neutral');feedback.setAttribute('role','status');
  feedback.dataset.hero=result.heroId;feedback.dataset.change=result.cpChange;feedback.dataset.before=result.cpBefore;feedback.dataset.after=result.cpAfter;
  feedback.style.width=Math.min(anchor.width,48)+'px';
  const bounds=modal.getBoundingClientRect();feedback.style.left=(anchor.x+anchor.width/2-bounds.left)+'px';
  feedback.textContent='CP '+(result.cpChange>0?'+':'')+result.cpChange;
  feedback.setAttribute('aria-label',name+' '+feedback.textContent);
  feedbacks.add(feedback);modal.append(feedback);
  const column=[...feedbacks].filter(n=>n.dataset.hero===result.heroId),gap=34;
  const height=column.reduce((sum,n)=>sum+n.offsetHeight,0)+gap*(column.length-1);
  let top=Math.max(bounds.top+24,Math.min(anchor.y,bounds.bottom-height-10));
  for(const node of column){node.style.top=(top-bounds.top)+'px';top+=node.offsetHeight+gap;}
  setTimeout(()=>{feedback.remove();feedbacks.delete(feedback);lastKey='';if(!feedbacks.size&&autoTransitionAfterFeedback){autoTransitionAfterFeedback=false;reviewDisposal();}if(closeRequested)close();else render();},1800);
 }
 function render(){
  if(!strip)return;const data=economy.data;if(!data){strip.innerHTML='<div class="lamp-status">'+escape(globals.LampStorageError||'Preparing the lamp…')+'</div>';return;}
  const l=data.lamp,roster=heroes(),reviewCandidates=conveyorReviewCandidates(data,roster);
  const remaining=l.upgradeEndsAt?Math.max(0,Math.ceil((l.upgradeEndsAt-economy.time())/1000)):0;
  updateLampConveyor({strip,data,heroes:roster,now:economy.time(),activeMs:economy.conveyorTime(),paused:!creationActive,tile,gearBounds,error:globals.LampStorageError});
  if(feedbacks.size&&open&&(autoTransitionAfterFeedback||closeRequested))return;
  if(disposalView&&reviewCandidates.some(c=>c.bestGain>0))reviewDisposal();
  if(selectedItem&&!reviewCandidates.some(c=>c.item.instanceId===selectedItem)){selectedItem=null;selectedHero=null;}
  const key=JSON.stringify([l.pending,l.discarded,l.salvage,l.sequence,data.gold,data.loadouts,l.capacityTier,l.upgradeStage,l.essence,l.upgradeEndsAt,l.speedUpTickets,open&&upgradeOpen?remaining:0,roster.map(h=>[h.currentLevel,h.currentEXP,h.EXPToNextLevel]),selectedItem,selectedHero,disposalView,l.reviewHold,l.disposalRequested,open,upgradeOpen,busy,notice,window.innerWidth,window.innerHeight,window.devicePixelRatio]);
  if(key===lastKey)return;lastKey=key;
  const reviewScroll=dialog.querySelector('.lamp-review-body')?.scrollTop||0,dialogScroll=dialog.scrollTop,queueScroll=dialog.querySelector('.lamp-queue')?.scrollTop||0;
  const focused=document.activeElement,focusAction=focused?.dataset.action,focusId=focused?.dataset.id,focusParent=dialog.contains(focused)?dialog:strip.contains(focused)?strip:null;
  const restoreFocus=()=>{if(focusParent&&focusAction){const target=[...focusParent.querySelectorAll('button')].find(b=>b.dataset.action===focusAction&&b.dataset.id===focusId&&!b.disabled);(target||dialog).focus();}};

  dialog.dataset.view=upgradeOpen?'upgrade':selectedItem?'equip':disposalView?'dismantle':'cache';
  dialog.setAttribute('aria-label',upgradeOpen?'Lamp upgrades':selectedItem?'Choose a hero for lamp equipment':disposalView?'Confirm equipment disposal':'Equipment cache');
  modal.hidden=!open;if(!open){restoreFocus();return;}
  const candidate=item(selectedItem);
  const heroRow='<div class="lamp-hero-row" aria-label="Choose equipment recipient">'+roster.map(h=>{
    const d=heroDefinition(h),gain=candidate?lampItemCPGain(data,candidate,h):Math.max(0,...reviewCandidates.map(c=>lampItemCPGain(data,c.item,h))),art=HERO_ART_ASSETS[heroArtKey(h)],currentCP=computeCombatPower(refreshHeroStats({...h,equipmentStats:equipmentStats(data.items,data.loadouts[h.heroInstanceKey]||{})}));
    return '<button '+(!candidate?'disabled ':'')+'class="lamp-hero lamp-portrait" data-action="hero" data-id="'+escape(h.heroInstanceKey)+'" data-cp-change="'+gain+'" aria-pressed="'+(selectedHero===h.heroInstanceKey)+'" aria-label="Choose '+d.name+'" aria-description="'+d.name+' CP change '+(gain>0?'+':'')+gain+'" style="--portrait-position:'+art.strip.position+'"><img decoding="sync" src="assets/'+art.path+'" alt=""><span class="lamp-hero-current-cp"><span>CP</span> <b>'+currentCP+'</b></span>'+(candidate||reviewCandidates.length?'<span class="lamp-cp-direction '+(gain>0?'up':'down')+'" aria-hidden="true"></span>':'')+'</button>';
   }).join('')+'</div>';
  let body='<header class="lamp-modal-header"><span>'+(upgradeOpen?'WISH LAMP':selectedItem?'EQUIPMENT REVIEW':disposalView?'':'EQUIPMENT CACHE')+'</span>'+(!upgradeOpen&&!disposalView?'<button class="lamp-disposal-link" data-action="disposal" '+(reviewCandidates.some(c=>c.bestGain>0)?'disabled':'')+'>Done / Dismantle</button>':'')+'<button data-action="close" aria-label="Close equipment comparison">×</button></header>';
  if(l.reviewHold&&!upgradeOpen&&!candidate&&!disposalView)body+='<p class="lamp-held" role="status">Held: '+escape(l.reviewHold.item.name)+(disposalView?'.':'. Cache full — equip it or review disposal.')+'</p>';
  if(upgradeOpen){
   const level=l.capacityTier+1,stages=l.upgradeStage||0;
   const tier=LAMP_CAPACITY_TIERS[l.capacityTier],next=LAMP_CAPACITY_TIERS[l.capacityTier+1];
   const cost=lampStageCost(data),ready=stages===LAMP_CONFIG.upgradeStages;
   body+='<div class="lamp-upgrade-summary"><strong>Lamp Lv. '+level+(next?' → Lv. '+(level+1):' · MAX')+'</strong><p>Storage '+tier.capacity+(next?' → '+next.capacity:'')+'</p></div><div class="lamp-odds-scroll"><table class="lamp-odds"><thead><tr><th>Quality</th><th>Current</th><th>Next</th></tr></thead><tbody>'+Object.entries(RARITIES).map(([key,r])=>'<tr style="--rarity:'+r.color+'"><th>'+r.label+'</th><td>'+tier.rarityWeights[key].toFixed(3)+'%</td><td>'+(next?next.rarityWeights[key].toFixed(3)+'%':'—')+'</td></tr>').join('')+'</tbody></table></div><p class="lamp-essence">Essence available <strong>'+new Intl.NumberFormat('en').format(l.essence)+'</strong></p>';
   if(next&&l.upgradeEndsAt){
    const countdown=[Math.floor(remaining/3600),Math.floor(remaining/60)%60,remaining%60].map(n=>String(n).padStart(2,'0')).join(':');
    body+='<section class="lamp-upgrade-path constructing" aria-label="Upgrade under construction"><div class="lamp-construction"><time class="lamp-countdown" role="timer" aria-label="Time remaining"><span>Time left: </span>'+countdown+'</time></div><button class="lamp-upgrade speed-up" data-action="speed-up" data-tier="'+l.capacityTier+'" '+(busy||!l.speedUpTickets?'disabled':'')+'>SPD UP ALL<small>'+ (l.speedUpTickets||0)+' tickets · 5m each</small></button></section>';
   }else{
    if(next)body+='<section class="lamp-upgrade-path" aria-label="Purchased upgrade stages"><div><div class="lamp-stage-label"><strong>'+(ready?'Ready':'Stages')+'</strong><span>'+stages+' / '+LAMP_CONFIG.upgradeStages+'</span></div><ol class="lamp-stage-slots">'+Array.from({length:LAMP_CONFIG.upgradeStages},(_,n)=>'<li class="'+(n<stages?'purchased':'')+'" aria-label="Stage '+(n+1)+(n<stages?' purchased':' unpurchased')+'">'+(n<stages?'<img src="assets/images/lamp/essence-orb.png" alt="">':'<span></span>')+'</li>').join('')+'</ol></div>';
    body+='<button class="lamp-upgrade" data-action="'+(ready?'upgrade':'purchase-stage')+'" data-tier="'+l.capacityTier+'" data-stage="'+stages+'" '+(busy||!next||!ready&&l.essence<cost?'disabled':'')+'>'+(next?ready?'LEVEL UP':'Purchase<br><small>'+cost+' Essence</small>':'MAX')+'</button>'+(next?'</section>':'');
   }
   if(next&&!ready&&l.essence<cost)body+='<p class="lamp-modal-notice">Need '+(cost-l.essence)+' more essence</p>';
  }else if(candidate){
   const comparison=selectedHero?compareLampItem(data,candidate,selectedHero):null;
   const rows=['HP',...GEAR_STATS.filter(k=>k!=='HP')];
   body+='<div class="lamp-review-body">';
   if(l.reviewHold)body+='<p class="lamp-held" role="status">Cache full · one item held for review</p>';
   body+=heroRow;
   body+='<div class="lamp-candidate" style="--rarity:'+RARITIES[candidate.rarity].color+'">'+atlas(candidate,'',roster.some(h=>lampItemCPGain(data,candidate,h)>0))+'<div><div class="lamp-quality-band"><small>'+RARITIES[candidate.rarity].label+' · '+EQUIPMENT_SLOTS[candidate.type]+' · Lv. '+candidate.level+'</small><h2>'+escape(candidate.name)+'</h2><p class="lamp-item-cp">CP '+lampGearCP(candidate)+'</p></div><dl class="lamp-item-stats">'+rows.filter(k=>Object.hasOwn(candidate.stats,k)).map(k=>{const delta=comparison?.deltas[k]||0;return '<div><dt>'+k+'</dt><dd data-delta="'+delta+'" aria-label="'+k+' '+candidate.stats[k]+(selectedHero?', '+(delta>0?'increase ':delta<0?'decrease ':'no change ')+Math.abs(delta):'')+'"><span class="lamp-stat-value"><canvas class="lamp-stat-paint" aria-hidden="true"></canvas><span class="lamp-stat-number" aria-hidden="true">'+candidate.stats[k]+'</span>'+(delta?'<span class="lamp-stat-arrow '+(delta>0?'up':'down')+'" aria-hidden="true"></span>':'')+'</span></dd></div>';}).join('')+'</dl></div></div>';
   body+='<div class="lamp-queue" aria-label="'+(disposalView?'Equipment candidates':'Actionable upgrades')+'">'+reviewCandidates.filter(c=>disposalView||c.bestGain>0&&!l.disposalRequested?.includes(c.item.instanceId)).map(c=>tile(c.item,'queue',c)).join('')+'</div>';
   body+='<button class="lamp-disposal-link lamp-item-disposal" data-action="queue-disposal" '+(roster.some(h=>lampItemCPGain(data,candidate,h)>0)?'disabled':'')+'>Send selected item to disposal</button></div>';
   if(notice)body+='<p class="lamp-modal-notice" role="status">'+escape(notice)+'</p>';
   body+='<div class="lamp-actions lamp-review-actions"><button class="primary" data-action="equip" '+(!selectedHero||busy||!roster.some(h=>h.heroInstanceKey===selectedHero&&lampItemCPGain(data,candidate,h)>0)?'disabled':'')+'>Equip</button><button data-action="auto-equip" '+(busy||!reviewCandidates.some(c=>c.bestGain>0)?'disabled':'')+'>Auto-Equip</button></div>';
  }else{
   const useful=reviewCandidates.filter(c=>c.bestGain>0),inferior=reviewCandidates.filter(c=>c.bestGain<=0);
   if(disposalView){
    disposalPreview??=economy.disposalPreview();
    body+='<div class="lamp-disposal-body"><div class="lamp-queue" aria-label="Disposal candidates">'+reviewCandidates.map(c=>tile(c.item,'queue',c,true).replace('class="lamp-tile"','class="lamp-tile" data-disposal-selected="'+disposalPreview.ids.includes(c.item.instanceId)+'"')).join('')+'</div>';
    body+='</div><div class="lamp-actions"><button class="primary" data-action="dismantle" '+(busy||!disposalPreview.ids.length&&!l.salvage.count?'disabled':'')+'>Dismantle all</button></div>';
   }else{
    body+=heroRow;
    body+='<p>'+lampStoredCount(data)+' / '+lampCapacity(data)+' stored</p><div class="lamp-queue" aria-label="Actionable upgrades">'+useful.filter(c=>!l.disposalRequested?.includes(c.item.instanceId)).map(c=>tile(c.item,'queue',c)).join('')+'</div>';
    body+='<div class="lamp-actions"><button data-action="equip" disabled>Equip</button><button class="primary" data-action="auto-equip" '+(busy||!useful.length?'disabled':'')+'>Auto-Equip</button></div>';
   }
  }

  if(notice&&!candidate)body+='<p class="lamp-modal-notice" role="status">'+escape(notice)+'</p>';

  const portraits=new Map([...dialog.querySelectorAll('.lamp-hero img')].map(img=>[img.src,img]));
  dialog.innerHTML=body;
  for(const img of dialog.querySelectorAll('.lamp-hero img')){const previous=portraits.get(img.src);if(previous)img.replaceWith(previous);}
  for(const value of dialog.querySelectorAll('.lamp-stat-value')){
   const number=value.querySelector('.lamp-stat-number'),arrow=value.querySelector('.lamp-stat-arrow'),style=getComputedStyle(value),dpr=window.devicePixelRatio||1;
   const font=style.fontWeight+' '+style.fontSize+' '+style.fontFamily,size=parseFloat(style.fontSize);
   fontMeasure.canvas.width=Math.ceil((number.textContent.length+2)*size*dpr);fontMeasure.canvas.height=Math.ceil(size*2*dpr);
   fontMeasure.setTransform(dpr,0,0,dpr,0,0);fontMeasure.font=font;fontMeasure.fillStyle=style.color;fontMeasure.fillText(number.textContent,2,size);
   const pixels=fontMeasure.getImageData(0,0,fontMeasure.canvas.width,fontMeasure.canvas.height);
   let left=pixels.width,top=pixels.height,right=0,bottom=0;
   for(let y=0;y<pixels.height;y++)for(let x=0;x<pixels.width;x++)if(pixels.data[(y*pixels.width+x)*4+3]>=96){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   const metrics=fontMeasure.measureText('0123456789'),height=Math.ceil((metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent)*dpr),arrowWidth=Math.max(3,Math.ceil(height*.75)),arrowLeft=right-left+1+Math.round(3*dpr),width=arrow?arrowLeft+arrowWidth:right-left+1;
   const paint=value.querySelector('canvas');paint.width=width;paint.height=height;paint.style.width=width/dpr+'px';paint.style.height=height/dpr+'px';paint.dataset.arrowX=arrowLeft;
   const ctx=paint.getContext('2d');ctx.drawImage(fontMeasure.canvas,left,top,right-left+1,bottom-top+1,0,0,right-left+1,height);
   if(arrow){
    ctx.fillStyle=getComputedStyle(arrow).color;ctx.save();ctx.translate(arrowLeft,0);
    if(arrow.classList.contains('down')){ctx.translate(arrowWidth,height);ctx.rotate(Math.PI);}
    ctx.beginPath();ctx.moveTo(arrowWidth*.5,0);ctx.lineTo(arrowWidth,height*.45);ctx.lineTo(arrowWidth*.7,height*.45);ctx.lineTo(arrowWidth*.7,height);ctx.lineTo(arrowWidth*.3,height);ctx.lineTo(arrowWidth*.3,height*.45);ctx.lineTo(0,height*.45);ctx.closePath();ctx.fill();ctx.restore();
   }
  }
  restoreFocus();
  const queue=dialog.querySelector('.lamp-queue');
  if(queue&&queue.querySelector('.lamp-tile')){
   const style=getComputedStyle(queue),tile=queue.querySelector('.lamp-tile');
   queue.style.height=(tile.getBoundingClientRect().height*(candidate?2.5:3.5)+parseFloat(style.rowGap)*(candidate?2:3)+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth))+'px';
   queue.scrollTop=candidate?queueScroll:0;
  }
  dialog.scrollTop=dialogScroll;
  const reviewBody=dialog.querySelector('.lamp-review-body');if(reviewBody)reviewBody.scrollTop=reviewScroll;

 }
 let bossFallbackVisible=false,bossFallbackReservePx=0;
 function position(){
  const r=canvas.getBoundingClientRect(),s=r.width/360;Object.assign(strip.style,{left:r.left+'px',top:(r.top+488*s)+'px',width:r.width+'px',height:92*s+'px',fontSize:11*s+'px'});
  positionRewardReceipt(canvas);
  Object.assign(modal.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:(upgradeOpen?r.height:Math.min(r.height,480*s))+'px'});
  modal.style.setProperty('--boss-fallback-reserve',bossFallbackVisible?`${bossFallbackReservePx}px`:'0px');
 }
 return{
  draw({layoutId='combat',phase='combat',bossFallbackVisible:showBossFallback=false,bossFallbackReservePx:reservePx=0}={}){init();bossFallbackVisible=showBossFallback===true;bossFallbackReservePx=Math.max(0,Number(reservePx)||0);modal.dataset.bossFallback=String(bossFallbackVisible);position();const visible=['combat','storyMock'].includes(layoutId)&&phase==='combat';strip.hidden=!visible;
   creationActive=canConvey();
   void economy.setConveyorActive(creationActive).catch(e=>{notice=e.message;lastKey='';});
   render();updateHelper();
   const data=economy.data,t=economy.time();
   // CSS reports arrivals; the controller requests an idempotent locked save.
   // Cache review never collects approaching equipment or acknowledges it in bulk.
   if(canConvey()&&!arrivalPending){
    const arrivals=[...strip.querySelectorAll('.lamp-conveyor-item')].filter(n=>n.dataset.arrived==='true'&&n.dataset.collectionAttempted!=='true');
    if(arrivals.length){
     for(const node of arrivals)node.dataset.collectionAttempted='true';
     arrivalPending=true;
     void economy.collectAvailable(arrivals.map(n=>n.dataset.id),canConvey)
      .then(results=>{creationActive=canConvey();void economy.setConveyorActive(creationActive).catch(e=>{notice=e.message;});render();for(const result of results)if(result.saved&&!result.held)acknowledgeConveyorItem(strip,result.item.instanceId,{animate:true});})
      .catch(e=>{notice=e.message;lastKey='';}).finally(()=>{for(const node of arrivals)if(node.dataset.collected!=='true')delete node.dataset.collectionAttempted;arrivalPending=false;});
    }
   }
   // Every modal and full cache freeze emission, movement, aging and capture together.
   creationActive=canConvey();
   if(!creationActive){lastEmissionFrame=null;return;}
   if(lastEmissionFrame!==null)emissionElapsed+=Math.max(0,t-lastEmissionFrame);
   lastEmissionFrame=t;
   const issuedActiveMs=data?.lamp.emissions?.at(-1)?.issuedActiveMs;
   if(issuedActiveMs!==undefined)emissionElapsed=Math.max(0,economy.conveyorTime()-issuedActiveMs);
   if(data&&!emissionPending&&emissionElapsed>=LAMP_CONFIG.autoIntervalMs&&t-data.lamp.lastActivationAt>=LAMP_CONFIG.autoIntervalMs){
    emissionElapsed=0;emissionPending=true;
    void reveal(()=>canConvey()?economy.tickConveyor(context(),canConvey,{deferCollection:true}):null)
     .catch(e=>{notice=e.message;lastKey='';}).finally(()=>{emissionPending=false;});
   }
  },
  open:openCollection,
  close(){if(modal)close();},
  state(){return{open,selectedItem,selectedHero,busy,opening,settling:feedbacks.size>0,canLeave:!busy&&!opening&&!feedbacks.size&&!closeRequested,sequence:economy.data?.lamp.sequence,pending:economy.data?.lamp.pending.length,creationActive};},
 };
}
