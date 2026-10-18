import {MODAL_CLOSE_MARK} from './modalClose.mjs';
import {LAMP_CAPACITY_TIERS,lampUpgradeProgress} from '../src/core/lampGear.mjs';
import {RARITIES} from '../src/core/equipment.mjs';
import {runtimeAssetUrl} from './runtimeAssetUrl.mjs';

// Owner PNG's embedded Display profile converted to CSS sRGB; equipment frames keep their own palette.
export const BAG_UPGRADE_PILLS=Object.freeze({common:'#666666',uncommon:'#018a54',rare:'#1c8fa9',epic:'#d7673d',legendary:'#b83241'});
const rate=n=>(Math.ceil(n*10)/10).toFixed(1)+'%';
const exact=n=>new Intl.NumberFormat('en').format(n);
const compact=n=>n>=100000?new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n):String(n);
export const renderBagModalClose=()=>'<button class="game-modal-close bag-modal-close" data-action="close" aria-label="Close bag modal">'+MODAL_CLOSE_MARK+'</button>';

export function renderBagUpgrade(data,{busy=false}={}){
 const level=data.lamp.capacityTier+1,tier=LAMP_CAPACITY_TIERS[data.lamp.capacityTier],next=LAMP_CAPACITY_TIERS[data.lamp.capacityTier+1];
 const {current,required,max,fraction}=lampUpgradeProgress(data);
 const total=max?'MAX':'('+compact(current)+'/'+compact(required)+')';
 const rows=Object.entries(RARITIES).map(([key,r])=>'<tr style="--bag-pill:'+BAG_UPGRADE_PILLS[key]+'"><th scope="row">'+r.label+'</th><td>'+rate(tier.rarityWeights[key])+'</td><td class="bag-odds-arrow" aria-hidden="true"><span class="bag-comparison-arrow"></span></td><td>'+(next?rate(next.rarityWeights[key]):'—')+'</td></tr>').join('');
 return '<section class="bag-upgrade-panel"><header class="bag-window-header">Bag Upgrade Lv.'+level+'</header><div class="bag-upgrade-main"><div class="bag-level-transition"><span class="bag-tier-emblem"><img src="'+runtimeAssetUrl('images/ui/bag-tier-medallion.png')+'" alt=""></span><b>Lv. '+level+'</b><span class="bag-comparison-arrow" aria-hidden="true"></span><b>'+(next?'Lv. '+(level+1):'MAX')+'</b></div><div class="lamp-odds-scroll"><table class="lamp-odds" aria-label="Current and next equipment drop rates"><colgroup><col style="width:38%"><col style="width:27.5%"><col style="width:7%"><col style="width:27.5%"></colgroup><thead class="bag-sr-only"><tr><th>Quality</th><th>Current</th><th></th><th>Next</th></tr></thead><tbody>'+rows+'</tbody></table></div><section class="bag-upgrade-controls"><p class="bag-next-capacity">Bag Capacity '+exact(tier.capacity)+' '+(next?'&gt; '+exact(next.capacity):'(MAX)')+'</p><div class="bag-upgrade-actions"><div class="bag-progress-group"><span class="bag-progress-level '+(level>=100?'long':'')+'"><b>'+level+'</b></span><div class="bag-upgrade-progress" role="progressbar" aria-label="Essence toward next bag level" aria-valuemin="0" aria-valuenow="'+(max?1:Math.min(current,required))+'" aria-valuemax="'+(required??1)+'" aria-valuetext="'+(max?'Maximum bag level':exact(current)+' of '+exact(required)+' Essence')+'" title="'+(max?'MAX':exact(current)+' / '+exact(required))+'"><span style="width:'+fraction*100+'%"></span><b>'+total+'</b></div><span class="bag-progress-level next '+(level>=99?'long':'')+'"><b>'+(next?level+1:'MAX')+'</b></span></div><button class="bag-level-up" data-action="upgrade" data-tier="'+data.lamp.capacityTier+'" '+(busy||max||current<required?'disabled':'')+'>'+(max?'MAX':'Level Up')+'</button></div></section></div></section><p class="bag-upgrade-disclaimer">Probabilities shown are rounded and may not add up to 100%.</p>';
}

export function renderBagUpgradeComplete(receipt){
 return '<section class="bag-upgrade-complete" aria-label="Bag upgrade reward"><h2 class="bag-reward-banner">Upgrade Complete</h2><div class="bag-reward-art"><img src="'+runtimeAssetUrl('images/lamp/equipment-bag.png')+'" alt="Bag"></div><p class="bag-reward-level">Bag Lv. '+receipt.levelAfter+'</p><p class="bag-reward-capacity">Bag Capacity '+exact(receipt.capacityBefore)+' &gt; '+exact(receipt.capacityAfter)+'</p></section>';
}

// Preserve percentage anchors; move only each arrow to the midpoint of the visible gap.
export function alignBagUpgradeArrows(dialog){
 const bounds=node=>{const range=document.createRange();range.selectNodeContents(node);return range.getBoundingClientRect();};
 for(const row of dialog.querySelectorAll('.lamp-odds tbody tr')){
  const arrow=row.children[2],current=bounds(row.children[1]),next=bounds(row.children[3]),r=arrow.querySelector('.bag-comparison-arrow').getBoundingClientRect();
  const offset=(parseFloat(arrow.style.getPropertyValue('--bag-arrow-offset'))||0)+(current.right+next.left-r.left-r.right)/2;
  arrow.style.setProperty('--bag-arrow-offset',offset+'px');
 }
}
