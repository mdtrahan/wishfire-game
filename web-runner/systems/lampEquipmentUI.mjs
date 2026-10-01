import {LAMP_CONFIG,GEAR_STATS,lampStoredCount,lampCooldownRemaining,compareLampItem,selectLampUpgrades,sortedLampItems,lampGearCP,lampAutoUnlocked,lampCapacity,LAMP_CAPACITY_TIERS} from '../src/core/lampGear.mjs';
import {RARITIES,EQUIPMENT_SLOTS,equipmentDefinition} from '../src/core/equipment.mjs';
import {heroDefinition} from '../src/core/heroDefinitions.mjs';
import {expToNextLevel} from '../src/core/heroProgression.mjs';

export function createLampEquipmentUI({canvas,economy,globals,eventBus,isPaused=()=>false}){
 let strip,modal,dialog,helper,lastInteraction=performance.now(),open=false,upgradeOpen=false,batch=false,selectedItem=null,selectedHero=null,reviewed=new Set(),busy=false,opening=false,closeRequested=false,pendingAction=Promise.resolve(),gearReady,feedbacks=new Set(),notice='',rewardBanner,lastRewardTimer,lastKey='',lastAutoCheck=0,lastFocus,previewIds=[],arrivalSequence,emissionId,emissionTimer;
 const fontMeasure=document.createElement('canvas').getContext('2d');
 const heroes=()=>Object.values(globals.HeroProgress?.heroes||{}).slice(0,4);
 const partyProgress=()=>{const hero=heroes().sort((a,b)=>a.currentLevel-b.currentLevel||a.currentEXP-b.currentEXP)[0];return{level:hero?.currentLevel||1,exp:hero?.currentEXP||0,max:hero?.EXPToNextLevel??expToNextLevel(1)};};
 const context=()=>globals.ContinuousCombatStage||{region:1,stage:1};
 const item=id=>economy.data?.items.find(i=>i.instanceId===id);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const atlas=(i,cls='')=>'<span class="lamp-art '+cls+'" style="--col:'+(i.art%3)+';--row:'+Math.floor(i.art/3)+'" aria-hidden="true"><span class="lamp-rarity">'+RARITIES[i.rarity].label[0]+'</span><span class="lamp-level">Lv.'+i.level+'</span></span>';
 const device=(cell,cls='')=>'<span class="lamp-device '+cls+'" style="--col:'+(cell%2)+';--row:'+Math.floor(cell/2)+'" aria-hidden="true"></span>';
 const tile=(i,action='inspect')=>'<button class="lamp-tile'+(action==='inspect'&&i.instanceId===emissionId?' lamp-arriving':'')+'" style="--rarity:'+RARITIES[i.rarity].color+'" data-action="'+action+'" data-cp="'+lampGearCP(i)+'" data-id="'+escape(i.instanceId)+'"'+(action==='queue'&&i.instanceId===selectedItem?' aria-current="true"':'')+' aria-label="Inspect '+escape(i.name)+', '+RARITIES[i.rarity].label+', level '+i.level+'">'+(action==='inspect'&&i.instanceId===emissionId?'<img class="lamp-equip-puff" src="assets/images/lamp/equip-puff.png" alt="">':'')+atlas(i)+(action==='queue'?'<small>CP '+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(lampGearCP(i))+'</small>':'')+'</button>';
 function init(){
  if(strip)return;
  const art=new Image();art.src='assets/images/lamp/gear-atlas.png';gearReady=art.decode();gearReady.catch(()=>{});
  const style=document.createElement('link');style.rel='stylesheet';style.href='assets/lampEquipmentUI.css';document.head.append(style);
  strip=document.createElement('section');strip.id='wishfire-lamp';strip.setAttribute('aria-label','Equipment lamp');strip.hidden=true;
  modal=document.createElement('div');modal.id='lamp-overlay';modal.hidden=true;
  dialog=document.createElement('section');dialog.id='lamp-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Choose a hero for lamp equipment');dialog.tabIndex=-1;modal.append(dialog);
  helper=document.createElement('div');helper.className='lamp-idle-helper';helper.hidden=true;helper.setAttribute('aria-hidden','true');helper.innerHTML='<span></span><span></span><img src="assets/images/lamp/genie-pointer.png" alt="">';
  document.body.append(strip,modal,helper);
  for(const type of ['pointerdown','click','keydown','wheel'])document.addEventListener(type,resetHelper,{capture:true,passive:true});
  document.addEventListener('visibilitychange',resetHelper);
  strip.addEventListener('click',onClick);dialog.addEventListener('click',onClick);
  strip.addEventListener('animationend',e=>{if(e.animationName==='lamp-burp')strip.classList.remove('burping');});
  modal.addEventListener('click',e=>{if(e.target===modal&&!busy)close();});
  dialog.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&!busy){e.preventDefault();close();}
   if(e.key==='Tab'){const buttons=[...dialog.querySelectorAll('button:not(:disabled)')];const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  });
  eventBus?.on('lamp:open',()=>openCollection());
 }
 async function openCollection(id,upgrades=false){
  init();if(opening)return;opening=true;
  try{await pendingAction;await Promise.all([economy.sync(),gearReady]);if(!upgrades&&!lampStoredCount(economy.data))return close();resetHelper();lastFocus=document.activeElement;closeRequested=false;open=true;upgradeOpen=upgrades;batch=!id;reviewed=new Set();selectedItem=upgrades?null:id||sortedLampItems(economy.data)[0]?.instanceId||null;selectedHero=null;notice='';lastKey='';render();dialog.focus();}
  catch(e){notice=e.message;lastKey='';render();}finally{opening=false;}
 }
 function close(){if(feedbacks.size){closeRequested=true;return;}closeRequested=false;resetHelper();open=false;modal.hidden=true;lastKey='';lastFocus?.focus?.();}
 function action(fn){if(busy)return;busy=true;lastKey='';render();return pendingAction=(async()=>{try{await fn();}catch(e){notice=e.message;}finally{busy=false;lastKey='';render();}})();}
 function nextItem(){selectedHero=null;selectedItem=sortedLampItems(economy.data).find(i=>!reviewed.has(i.instanceId))?.instanceId||null;}
 function onClick(e){
  const b=e.target.closest('button[data-action]');if(!b||busy)return;
  const kind=b.dataset.action,id=b.dataset.id;
  if(kind==='close')return close();
  if(kind==='inspect')return openCollection(economy.data.lamp.pending.includes(id)?id:undefined);
  if(kind==='collect')return openCollection();
  if(kind==='lamp-upgrades')return openCollection(null,true);
  if(kind==='hero'){closeRequested=false;selectedHero=id;lastKey='';return render();}
  if(kind==='skip'){reviewed.add(selectedItem);nextItem();batch=true;if(!selectedItem)return void action(async()=>{await economy.finishReview();});lastKey='';return render();}
  if(kind==='queue'&&economy.data.lamp.pending.includes(id)){closeRequested=false;batch=true;selectedItem=id;selectedHero=null;lastKey='';return render();}
  if(kind==='generate')return void action(async()=>{await reveal(()=>economy.generate(context()));});
  if(kind==='auto')return void action(async()=>{await economy.setAuto(!economy.data.lamp.autoEnabled);notice=economy.data.lamp.autoEnabled?'Auto is on. Inspect whenever you like.':'Auto is off.';});
  if(kind==='equip'&&selectedHero&&selectedItem)return void action(async()=>{dialog.scrollTop=0;const result=await economy.equip(selectedHero,selectedItem),name=heroDefinition(heroes().find(h=>h.heroInstanceKey===result.heroId)).name,anchor=dialog.querySelector('[data-action="hero"][data-id="'+result.heroId+'"]').getBoundingClientRect();notice='Equipped to '+name;showEquipFeedback(result,name,anchor);if(batch){nextItem();if(!selectedItem)await economy.finishReview();}else close();});
  if(kind==='auto-equip')return void action(async()=>{dialog.scrollTop=0;const anchors=new Map(heroes().map(h=>[h.heroInstanceKey,dialog.querySelector('[data-action="hero"][data-id="'+h.heroInstanceKey+'"]').getBoundingClientRect()])),results=await economy.autoEquip();results.forEach(r=>showEquipFeedback(r,heroDefinition(heroes().find(h=>h.heroInstanceKey===r.heroId)).name,anchors.get(r.heroId)));selectedItem=null;selectedHero=null;notice='';});
  if(kind==='finish')return void action(async()=>{await economy.finishReview();selectedItem=null;selectedHero=null;notice='';});
  if(kind==='upgrade')return void action(async()=>{await economy.upgrade();notice='Lamp upgraded to Lv. '+(economy.data.lamp.capacityTier+1);});
  if(kind==='dismantle')return void action(async()=>{const r=await economy.dismantle([...previewIds]);document.querySelectorAll('.lamp-party-exp').forEach(n=>n.remove());notice='';selectedItem=null;selectedHero=null;reviewed=new Set();close();showDismantleReward(r);});
 }
 function startEmission(i){
  emissionId=i.instanceId;clearTimeout(emissionTimer);strip.classList.remove('burping');void strip.offsetWidth;strip.classList.add('burping');
  emissionTimer=setTimeout(()=>{emissionId=null;lastKey='';render();},1450);
 }
 function showDismantleReward(result){
  rewardBanner?.remove();clearTimeout(lastRewardTimer);
  rewardBanner=document.createElement('section');rewardBanner.className='lamp-reward-banner';rewardBanner.setAttribute('role','status');
  rewardBanner.innerHTML='<strong>DISMANTLED</strong><div><img src="assets/images/lamp/essence-orb.png" alt="Essence"><b>'+new Intl.NumberFormat('en').format(result.essence)+'</b></div>';
  document.body.append(rewardBanner);position();lastRewardTimer=setTimeout(()=>{rewardBanner.remove();rewardBanner=null;},3250);
 }
 async function reveal(draw){const before=partyProgress().level,i=await draw();if(i){notice='Revealed '+i.name;showPartyEXP(LAMP_CONFIG.drawEXP,before);startEmission(i);}}
 function showPartyEXP(amount,before){
  const feedback=document.createElement('div');feedback.className='lamp-party-exp';feedback.setAttribute('role','status');const level=partyProgress().level;feedback.textContent=level>before?'Party Lv. '+before+' → '+level+' · EXP +'+amount:'Party EXP +'+amount;feedback.dataset.level=level;
  const r=strip.getBoundingClientRect();feedback.style.left=(r.left+r.width/2)+'px';feedback.style.top=(r.top-24)+'px';document.body.append(feedback);setTimeout(()=>feedback.remove(),1500);
 }
 function resetHelper(){lastInteraction=performance.now();if(helper)helper.hidden=true;}
 function updateHelper(){
  if(strip.hidden||!open||upgradeOpen||busy||document.hidden||!selectedItem||performance.now()-lastInteraction<15000){helper.hidden=true;return;}
  const target=dialog.querySelector(selectedHero?'[data-action="auto-equip"]':'[data-action="hero"][data-id="Huun"]');
  if(!target||target.disabled){helper.hidden=true;return;}
  let r=target.getBoundingClientRect();const bounds=dialog.getBoundingClientRect();
  if(r.top<bounds.top||r.bottom>bounds.bottom){target.scrollIntoView({block:'nearest'});r=target.getBoundingClientRect();}
  helper.dataset.target=selectedHero?'auto-equip':'Huun';
  helper.style.left=(r.left+r.width/2)+'px';helper.style.top=(r.top+r.height/2)+'px';helper.style.setProperty('--hand-size',Math.max(48,Math.min(80,bounds.width*.19))+'px');helper.hidden=false;
 }
 function showEquipFeedback(result,name,anchor){
  const feedback=document.createElement('div');feedback.className='lamp-cp-feedback '+(result.cpChange>0?'positive':result.cpChange<0?'negative':'neutral');feedback.setAttribute('role','status');
  feedback.dataset.hero=result.heroId;feedback.dataset.change=result.cpChange;feedback.dataset.before=result.cpBefore;feedback.dataset.after=result.cpAfter;
  feedback.style.width=Math.min(anchor.width,48)+'px';
  feedback.style.left=Math.max(58,Math.min(window.innerWidth-58,anchor.x+anchor.width/2))+'px';feedback.style.top=Math.max(12,Math.min(window.innerHeight-130,anchor.y))+'px';
  feedback.textContent='CP '+(result.cpChange>0?'+':'')+result.cpChange;
  feedback.setAttribute('aria-label',name+' '+feedback.textContent);
  const stacked=[...feedbacks].filter(n=>n.dataset.hero===result.heroId).length;feedback.style.top=(parseFloat(feedback.style.top)-stacked*22)+'px';
  feedbacks.add(feedback);modal.append(feedback);
  setTimeout(()=>{feedback.remove();feedbacks.delete(feedback);lastKey='';if(closeRequested)close();else render();},1800);
 }
 function render(){
  if(!strip||feedbacks.size&&open&&(!selectedItem||closeRequested))return;const data=economy.data;if(!data){strip.innerHTML='<div class="lamp-status">'+escape(globals.LampStorageError||'Preparing the lamp…')+'</div>';return;}
  const l=data.lamp,roster=heroes(),cooling=lampCooldownRemaining(data,economy.time())>0;
  arrivalSequence??=l.sequence;
  if(selectedItem&&!l.pending.includes(selectedItem)&&!l.discarded?.includes(selectedItem))nextItem();
  const key=JSON.stringify([l.pending,l.discarded,l.salvage,l.sequence,l.autoEnabled,data.gold,data.loadouts,l.capacityTier,l.essence,roster.map(h=>[h.currentLevel,h.currentEXP,h.EXPToNextLevel]),selectedItem,selectedHero,open,upgradeOpen,busy,cooling,notice,emissionId,window.innerWidth,window.innerHeight,window.devicePixelRatio]);
  if(key===lastKey)return;lastKey=key;
  const dialogScroll=dialog.scrollTop,queueScroll=dialog.querySelector('.lamp-queue')?.scrollTop||0;
  const focused=document.activeElement,focusAction=focused?.dataset.action,focusId=focused?.dataset.id,focusParent=dialog.contains(focused)?dialog:strip.contains(focused)?strip:null;
  const restoreFocus=()=>{if(focusParent&&focusAction){const target=[...focusParent.querySelectorAll('button')].find(b=>b.dataset.action===focusAction&&b.dataset.id===focusId&&!b.disabled);(target||dialog).focus();}};
  const storedIds=new Set([...l.pending,...(l.discarded||[])]);
  const latest=(l.recent||data.items.filter(i=>Number.isSafeInteger(i.sequence)).sort((a,b)=>a.sequence-b.sequence).slice(-5)).filter(i=>i.sequence>=arrivalSequence&&storedIds.has(i.instanceId));
  const autoUnlocked=lampAutoUnlocked(roster);
  const party=partyProgress(),level=party.level,progress=party.max?Math.min(1,party.exp/party.max):1;
  strip.innerHTML='<div class="lamp-strip-body"><div class="lamp-results">'+latest.map(i=>tile(i)).join('')+Array.from({length:5-latest.length},()=>'<span class="lamp-empty" aria-hidden="true"></span>').join('')+'</div><div class="lamp-side"><button class="lamp-burp" data-action="generate" aria-label="Reveal equipment" '+(busy||cooling||lampStoredCount(data)>=lampCapacity(data)?'disabled':'')+'><img class="lamp-device" src="assets/images/lamp/lamp.png" alt=""></button><button class="lamp-collect" data-action="collect" aria-label="Review collection, '+lampStoredCount(data)+' of '+lampCapacity(data)+'"><span class="lamp-count">'+lampStoredCount(data)+'</span></button><button class="lamp-auto" data-state="'+(!autoUnlocked?'locked':l.autoEnabled?'on':'off')+'" data-action="auto" aria-label="'+(autoUnlocked?'Auto generation':'Auto unlocks when all four heroes reach level 5')+'" aria-pressed="'+(autoUnlocked&&l.autoEnabled)+'" '+(!autoUnlocked||lampStoredCount(data)>=lampCapacity(data)?'disabled':'')+'>AUTO'+(!autoUnlocked?'<span class="lamp-lock" aria-hidden="true"></span>':'')+'</button><button class="lamp-tier-badge" data-action="lamp-upgrades" aria-label="Party level '+level+', '+party.exp+' of '+party.max+' EXP; open lamp upgrades"><span class="lamp-progress" role="progressbar" aria-label="Party EXP toward next level" aria-valuemin="0" aria-valuemax="'+(party.max||1)+'" aria-valuenow="'+(party.max?party.exp:1)+'"><span style="width:'+(progress*100)+'%"></span><small class="lamp-exp-value">'+(party.max?party.exp+' / '+party.max:'MAX')+'</small></span><span class="lamp-level-disc"><b>'+level+'</b><small>Party</small></span></button></div></div>';

  dialog.setAttribute('aria-label',upgradeOpen?'Lamp upgrades':selectedItem?'Choose a hero for lamp equipment':'Dismantle All');
  modal.hidden=!open;if(!open){restoreFocus();return;}
  const candidate=item(selectedItem);
  if(!upgradeOpen&&!candidate&&!lampStoredCount(data)){close();return;}
  let body='<header class="lamp-modal-header"><span>'+(upgradeOpen?'WISH LAMP':selectedItem?'HERO GEAR UPGRADE':'DISMANTLE ALL')+'</span><button data-action="close" aria-label="Close equipment comparison">×</button></header>';
  if(upgradeOpen){
   const tier=LAMP_CAPACITY_TIERS[l.capacityTier],next=LAMP_CAPACITY_TIERS[l.capacityTier+1];
   body+='<div class="lamp-upgrade-summary"><strong>Lamp Lv. '+(l.capacityTier+1)+(next?' → Lv. '+(l.capacityTier+2):' · Max level')+'</strong><p>Storage '+tier.capacity+(next?' → '+next.capacity:'')+'</p></div><table class="lamp-odds"><thead><tr><th>Quality</th><th>Current</th><th>Next</th></tr></thead><tbody>'+Object.entries(RARITIES).map(([key,r])=>'<tr style="--rarity:'+r.color+'"><th>'+r.label+'</th><td>'+tier.rarityWeights[key]+'%</td><td>'+(next?next.rarityWeights[key]+'%':'—')+'</td></tr>').join('')+'</tbody></table><p class="lamp-essence">Essence '+l.essence+(next?' / '+tier.cost:'')+'</p><button class="lamp-upgrade" data-action="upgrade" '+(busy||!next||l.essence<tier.cost?'disabled':'')+'>'+(next?'Upgrade · '+tier.cost+' Essence':'Fully upgraded')+'</button>';
  }else if(candidate){
   const comparisons=roster.map(h=>compareLampItem(data,candidate,h.heroInstanceKey));
   const rows=['HP',...GEAR_STATS.filter(k=>k!=='HP')];
   body+='<table class="lamp-compare"><thead><tr><th scope="col" aria-label="Stat"></th>';
   body+=roster.map((h,index)=>{const d=heroDefinition(h),c=comparisons[index];return '<th scope="col"><button class="lamp-hero lamp-portrait" data-action="hero" data-id="'+escape(h.heroInstanceKey)+'" aria-pressed="'+(selectedHero===h.heroInstanceKey)+'" aria-label="Choose '+d.name+'"><img decoding="sync" src="assets/images/icon_hero'+({Fara:1,Hondo:2,Runa:3,Kaja:4}[d.name])+'-animation%201-000.png" alt=""></button><small>CP '+lampGearCP(c.current)+'</small></th>';}).join('')+'</tr></thead><tbody>';
   body+=rows.map(k=>'<tr><th scope="row">'+k+'</th>'+comparisons.map(c=>{const n=c.deltas[k]||0;return'<td class="'+(n>0?'positive':n<0?'negative':'neutral')+'" aria-label="'+(n>0?'Increase ':n<0?'Decrease ':'No change ')+Math.abs(n)+' '+k+'">'+'<span class="lamp-stat-value"><canvas class="lamp-stat-paint" aria-hidden="true"></canvas><span class="lamp-stat-number" aria-hidden="true">'+Math.abs(n)+'</span>'+(n?' <span class="lamp-stat-arrow '+(n<0?'down':'up')+'" aria-hidden="true">'+(n>0?'↑':'↓')+'</span>':'')+'</span></td>';}).join('')+'</tr>').join('')+'</tbody></table>';
   body+='<div class="lamp-candidate" style="--rarity:'+RARITIES[candidate.rarity].color+';--quality-ink:'+(['common','legendary'].includes(candidate.rarity)?'#211f1b':'#fff9eb')+';--quality-shadow:'+(['common','legendary'].includes(candidate.rarity)?'none':'0 1px 2px #000')+'">'+atlas(candidate)+'<div><div class="lamp-quality-band"><small>'+RARITIES[candidate.rarity].label+' · '+EQUIPMENT_SLOTS[candidate.type]+' · Lv. '+candidate.level+'</small><h2>'+escape(candidate.name)+'</h2><p class="lamp-item-cp">CP '+lampGearCP(candidate)+'</p></div><dl class="lamp-item-stats">'+rows.filter(k=>Object.hasOwn(candidate.stats,k)).map(k=>'<div><dt>'+k+'</dt><dd>'+candidate.stats[k]+'</dd></div>').join('')+'</dl></div></div>';
   body+='<div class="lamp-queue" aria-label="Pending collection">'+sortedLampItems(data).map(i=>tile(i,'queue')).join('')+'</div>';
   body+='<button class="lamp-finish" data-action="finish">Dismantle</button>';
   if(l.discarded?.includes(candidate.instanceId))body+='<p class="lamp-instruction">Replaced gear</p><p class="lamp-selected">Stored for dismantling</p>';
   else if(selectedHero){const c=comparisons.find(c=>c.heroId===selectedHero),h=roster.find(h=>h.heroInstanceKey===selectedHero);body+='<p class="lamp-instruction">Equip to '+heroDefinition(h).name+'?</p><p class="lamp-selected">Replaces '+escape(c.current?.name||'an empty '+EQUIPMENT_SLOTS[candidate.type].toLowerCase()+' position')+'</p>';}
   else body+='<p class="lamp-instruction" aria-hidden="true">&#160;</p><p class="lamp-selected" aria-hidden="true">&#160;</p>';
   body+='<div class="lamp-actions"><button data-action="skip" '+(busy?'disabled':'')+'>Skip</button><button class="primary" data-action="equip" '+(!l.pending.includes(candidate.instanceId)||!selectedHero||busy?'disabled':'')+'>Equip</button><button data-action="auto-equip" '+(busy||!selectLampUpgrades(data,roster).length?'disabled':'')+'>Auto-Equip</button></div>';
  }else{
   previewIds=[...(l.discarded||[]),'salvage:'+l.salvage.count+':'+l.salvage.gold];const salvageCount=(l.discarded?.length||0)+l.salvage.count;
   body+='<div class="lamp-salvage-hero"><h2>'+(salvageCount?salvageCount+' piece'+(salvageCount===1?'':'s'):'Ready for another wish')+'</h2></div>';
   if(salvageCount){
    if(l.discarded?.length)body+='<div class="lamp-queue" aria-label="Dismantling collection">'+sortedLampItems(data,l.discarded).map(i=>'<div class="lamp-tile" style="--rarity:'+RARITIES[i.rarity].color+'" aria-label="'+escape(i.name)+'">'+atlas(i)+'</div>').join('')+'</div>';
    body+='<div class="lamp-actions"><button class="primary" data-action="dismantle" '+(busy?'disabled':'')+'>Dismantle All</button></div>';
   }
  }
  body+='<p class="lamp-modal-notice" role="status">'+(notice?escape(notice):'&#160;')+'</p>';

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
   const height=bottom-top+1,arrowWidth=Math.max(3,Math.ceil(height*.75)),arrowLeft=right-left+1+Math.round(3*dpr),width=arrow?arrowLeft+arrowWidth:right-left+1;
   const paint=value.querySelector('canvas');paint.width=width;paint.height=height;paint.style.width=width/dpr+'px';paint.style.height=height/dpr+'px';paint.dataset.arrowX=arrowLeft;
   const ctx=paint.getContext('2d');ctx.putImageData(pixels,-left,-top);ctx.clearRect(right-left+1,0,width-(right-left+1),height);
   if(arrow){
    ctx.fillStyle=style.color;ctx.save();ctx.translate(arrowLeft,0);
    if(arrow.classList.contains('down')){ctx.translate(arrowWidth,height);ctx.rotate(Math.PI);}
    ctx.beginPath();ctx.moveTo(arrowWidth*.38,0);ctx.lineTo(arrowWidth*.62,0);ctx.lineTo(arrowWidth,height*.45);ctx.lineTo(arrowWidth*.7,height*.45);ctx.lineTo(arrowWidth*.7,height);ctx.lineTo(arrowWidth*.3,height);ctx.lineTo(arrowWidth*.3,height*.45);ctx.lineTo(0,height*.45);ctx.closePath();ctx.fill();ctx.restore();
   }
  }
  restoreFocus();
  const queue=dialog.querySelector('.lamp-queue');
  if(queue){
   const style=getComputedStyle(queue),tile=queue.querySelector('.lamp-tile');
   queue.style.height=(tile.getBoundingClientRect().height*(candidate?1.5:3.5)+parseFloat(style.rowGap)*(candidate?1:3)+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth))+'px';
   queue.scrollTop=candidate?queueScroll:0;
  }
  dialog.scrollTop=dialogScroll;

 }
 function position(){
  const r=canvas.getBoundingClientRect(),s=r.width/360;Object.assign(strip.style,{left:r.left+'px',top:(r.top+488*s)+'px',width:r.width+'px',height:92*s+'px',fontSize:11*s+'px'});
  if(rewardBanner)Object.assign(rewardBanner.style,{left:r.left+'px',top:(r.top+r.height*.38)+'px',width:r.width+'px',fontSize:Math.max(12,18*s)+'px'});
  Object.assign(modal.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
 }
 return{
  draw({layoutId='combat',phase='combat'}={}){init();position();const visible=['combat','storyMock','idleFarmLayout'].includes(layoutId)&&phase==='combat';strip.hidden=!visible;render();updateHelper();
   const data=economy.data,t=economy.time();
   if(visible&&!open&&!opening&&!document.hidden&&!isPaused()&&!busy&&data?.lamp.autoEnabled&&t-lastAutoCheck>=1000){lastAutoCheck=t;if(t-data.lamp.lastActivationAt>=LAMP_CONFIG.autoIntervalMs&&lampStoredCount(data)<lampCapacity(data))void action(async()=>{await reveal(()=>economy.tickAuto(context()));});}
  },
  open:openCollection,
  close(){if(modal)close();},
  state(){return{open,selectedItem,selectedHero,busy,sequence:economy.data?.lamp.sequence,pending:economy.data?.lamp.pending.length,auto:economy.data?.lamp.autoEnabled};},
 };
}
