import {renderHeroGear} from './heroGearUI.mjs';
import {runtimeAssetUrl} from './runtimeAssetUrl.mjs';
import {computeCombatPower} from '../src/core/combatPower.mjs';
import {HERO_DEFINITIONS,heroDefinition,heroSkillUnlocked} from '../src/core/heroDefinitions.mjs';
import {createHeroProgressStore} from '../src/core/heroProgression.mjs';
import {heroTicketLevelCost} from '../src/core/combatProgressionRules.mjs';
import {resolveCombatMovementTuning} from '../src/core/combatMovementTuning.mjs';
import {STAR_MAX,STAR_TIER_SIZE,STAR_STAT_BONUS,STAR_TIER_PARTY_BONUS,RESONANCE_SLOT_STARS,RESONANCE_ECHOES,starUpCost,heroStars,heroGrowthBreakdown,resonanceSlots,resonanceSlotUnlocked,resonanceEcho} from '../src/core/heroGrowthRules.mjs';
import {FORMATION_ROWS,FORMATION_GRIDS,FORMATION_GRID_SIZE,FORMATION_PRESETS,FORMATION_SECOND_GRID_LEVEL,formationCell,formationGridOpen,sanitizeHeroFormation,activeFormationPreset,formationOccupant,placeFormationHero,setFormationLeader,autoFormActive,selectFormationPreset,copyFormationPresetTo,setFormationLocked} from '../src/core/heroFormationRules.mjs';
import {MODAL_CLOSE_MARK,installModalCloseStyles,paintModalClose} from './modalClose.mjs';
import {heroArtKey} from '../state/heroArtAssets.mjs';
import {actorAttackReach} from '../../src/core/arenaCombatRules.mjs';

let host,content,lastKey,currentTab='heroes',subPanel='',activeSkillIndex=-1,activeHeroIndex=-1,ticketNotice='',formationPick='',resonancePick=-1,sheetNotice='';
// Formation modal: edits a draft (committed on Save/Lock), with undo history, roster sort and a return path from the hero screen.
let formationCopyOpen=false,formationCopyTargets=[],formationEscape=null,formationFocus=false,formationDraft=null,formationHistory=[],formationConfirm=false,formationSortOpen=false,formationReturn=false,closeMeasure=null;
const formationSort={key:'level',descending:true,role:''};
const SORT_KEYS=[['level','Level'],['cp','CP'],['HP','HP'],['ATK','ATK'],['DEF','DEF'],['MAG','MATK'],['role','Role']];
const ROLE_ORDER=['Tank','Damage','Mage','Support'];
const TICKET_QUADRANT={Fara:'12% 12%',Hondo:'94% 12%',Kaja:'12% 89%',Runa:'94% 89%'};
const STAT_ICONS={ATK:'stat-atk',DEF:'stat-def',MAG:'stat-matk',RES:'stat-res'};
const SHEET_TITLES={formation:'Formation',star:'Star Up',resonance:'Resonance'};
const STAT_NAMES={HP:'HP',ATK:'ATK',DEF:'DEF',MAG:'MATK',RES:'RES'};
const pct=value=>`${Math.round(value*1000)/10}%`;

// Tiers fill five slots: bronze 1-5, silver 6-10, gold 11-15; grey when incomplete.
const STAR_TIERS=['bronze','silver','gold'];
function starMeter(stars,parent){
 const count=Math.max(0,Math.min(STAR_MAX,Math.floor(Number(stars)||0))),tier=Math.max(0,Math.ceil(count/5)-1),filled=count?count-tier*5:0;
 const meter=document.createElement('div');meter.className='stars';meter.setAttribute('role','img');meter.setAttribute('aria-label',count?`${count} of ${STAR_MAX} stars`:'No stars yet');
 for(let slot=0;slot<5;slot++){const star=document.createElement('span');star.textContent='★';if(slot<filled)star.dataset.tier=STAR_TIERS[tier];else if(tier>0)star.dataset.tier=STAR_TIERS[tier-1];meter.append(star);}
 parent.append(meter);return meter;
}

export function hideHeroScreen(){if(host)host.hidden=true;}

export function renderHeroScreen({equipmentProgress,combatProgression,canvas,gameState,fnContext,heroPortraitImages}){
 const globals=fnContext.state.globals;
 globals.HeroProgress ||= createHeroProgressStore();
 const roster=Object.keys(HERO_DEFINITIONS).map(key=>globals.HeroProgress.heroes[key]).filter(Boolean);
 if(!roster.length)return {mode:'details',selectedSkillIndex:0,hitZones:{skillNodes:[]}};
 const index=((Number(gameState.selectedHero)||0)%roster.length+roster.length)%roster.length;
 const hero=roster[index],definition=heroDefinition(hero),entries=[...definition.actives,null];
 if(activeHeroIndex!==index){activeHeroIndex=index;activeSkillIndex=definition.actives.length-1;ticketNotice='';resonancePick=-1;sheetNotice='';}
 activeSkillIndex=Math.max(0,Math.min(activeSkillIndex,entries.length-1));
 if(!host){
  host=document.createElement('section');host.id='hero-details';host.setAttribute('aria-label','Hero details');
  const style=document.createElement('style');style.textContent=`
   #hero-details{position:fixed;z-index:30;color:#fff1d1;background:linear-gradient(#20385c,#1a2840 60%,#121c2c);box-sizing:border-box;overflow:hidden;font:14px/1.35 system-ui}
   #hero-details[hidden]{display:none} #hero-details *{box-sizing:border-box;min-width:0} #hero-details>div{height:100%;display:flex;flex-direction:column;gap:.4em}
   #hero-details button{background:#192e48;color:inherit;border:1px solid #9eafc2;border-radius:.5em;padding:.3em;font:inherit;cursor:pointer}
   #hero-details button:focus-visible{outline:3px solid #50cfff;outline-offset:2px} #hero-details button:disabled{opacity:.5;cursor:default}
   #hero-details .identity{position:relative;flex:0 0 21em;border-radius:.6em;overflow:hidden;isolation:isolate;background:radial-gradient(ellipse 60% 55% at 28% 52%,#4f7fa8 0%,#2d5079 45%,#1b3150 100%)}
   #hero-details .identity::after{content:'';position:absolute;left:4%;width:48%;bottom:5.3em;height:1.6em;border-radius:50%;background:radial-gradient(#0b1626aa,transparent 70%);z-index:-1}
   #hero-details .hero-portrait{position:absolute;left:2%;width:52%;top:.6em;bottom:5.6em;height:calc(100% - 6.2em);object-fit:contain;object-position:50% 100%;z-index:0;filter:drop-shadow(0 .3em .25em #07172a80)}
   #hero-details .formation-button{position:absolute;left:.4em;top:.4em;z-index:2;width:2.4em;height:2.4em;padding:.35em;display:grid;grid-template-columns:repeat(2,1fr);gap:.15em;background:#132238cc;border-color:#7e93ad}
   #hero-details .formation-button i{display:block;border-radius:.1em;background:#3a4c66} #hero-details .formation-button i.filled{background:#9fb3cc} #hero-details .formation-button i.lead{background:#ffd56e}
   #hero-details .hero-arrows{position:absolute;left:0;width:56%;top:38%;display:flex;justify-content:space-between;pointer-events:none;z-index:2}
   #hero-details .hero-arrows button{pointer-events:auto;min-height:0;padding:0 .25em;border:0;background:transparent;color:#cfe9ff;font-size:2em;font-weight:800;line-height:1;text-shadow:0 1px 4px #07172a}
   #hero-details .hero-name{position:absolute;left:2%;width:52%;bottom:.55em;z-index:1;display:flex;flex-direction:column;align-items:center;gap:.3em}
   #hero-details h1{margin:0;width:100%;padding:.12em .5em;text-align:center;font-size:1.3em;letter-spacing:.04em;color:#2a2010;background:linear-gradient(#fff8e4,#ecd7a4);border:2px solid #b88e3c;border-radius:.6em;box-shadow:0 .15em .3em #07172a80}
   #hero-details .stars{display:flex;justify-content:center;gap:.1em;line-height:1}
   #hero-details .stars span{font-size:1.15em;color:#59667a;text-shadow:0 0 1px #0b1626,0 1px 1px #0b1626}
   #hero-details .stars span[data-tier=bronze]{color:#d0884a} #hero-details .stars span[data-tier=silver]{color:#d9e2ec} #hero-details .stars span[data-tier=gold]{color:#ffcf3f}
   #hero-details .skill-panel{position:absolute;right:.45em;top:2.75em;bottom:.45em;width:43%;z-index:2;display:flex;flex-direction:column;color:#1b2a42;background:#fffdf7;border:2px solid #f2c75c;border-radius:.55em;box-shadow:0 0 0 2px #1b2a42,0 .35em .8em #050b16b0;overflow:hidden}
   #hero-details .skill-panel footer{display:flex;align-items:center;gap:.25em;padding:.3em .35em;background:#1b2a42;color:#fff4d6}
   #hero-details .skill-panel footer button{min-height:0;padding:0 .3em;border:0;background:transparent;color:#ffd56e;font-size:1.1em;font-weight:800;line-height:1.2}
   #hero-details .skill-panel footer small{flex:1;text-align:center;font-size:.72em;color:#c9d6e6}
   #hero-details .skill-panel article{flex:1;overflow:auto;padding:.4em .5em;font-size:.74em;overflow-wrap:anywhere}
   #hero-details .skill-panel h2{margin:0;font-size:1.3em;line-height:1.15;color:#13213a}
   #hero-details .skill-panel article>small{display:inline-block;margin:.25em 0;padding:.05em .45em;border-radius:.6em;font-weight:700;background:#dff3ea;color:#1f6a4f}
   #hero-details .skill-panel article[data-locked=true]>small{background:#eceff3;color:#5b6678}
   #hero-details .skill-panel p{margin:.3em 0} #hero-details .skill-panel p+p{font-size:.92em} #hero-details .skill-meta{font-weight:650;color:#3a4d6a}
   #hero-details .tabs{display:flex;flex:none;gap:.3em} #hero-details .tabs button{flex:1;min-height:2.3em;font-weight:700;border-radius:.45em;background:#1d3150;border-color:#3f5675;color:#c8d5e6}
   #hero-details .tabs button[aria-pressed=true]{background:#fff3d8;color:#163052;border-color:#fff3d8}
   #hero-details .pane{overflow:auto;flex:1;min-height:5em;overflow-wrap:anywhere;background:#fff4df;color:#20304a;border-radius:.45em;padding:.55em .6em}
   #hero-details .pane h2{font-size:1em;margin:0 0 .35em} #hero-details .pane p{margin:.35em 0} #hero-details small{display:block}
   #hero-details .roster{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.45em}
   #hero-details .roster-card{position:relative;display:flex;flex-direction:column}
   #hero-details .card-select{position:relative;z-index:1;display:block;width:100%;aspect-ratio:1/1.05;padding:0;overflow:hidden;border:2px solid #6b8590;border-radius:.4em;background:radial-gradient(ellipse 75% 65% at 50% 38%,#ffffff 0%,#eef2f6 55%,#d5dce5 100%)}
   #hero-details .card-select img{position:absolute;left:-40%;top:-2%;width:180%;height:auto;max-width:none}
   #hero-details .roster-card[data-selected=true] .card-select{border-color:#2fb3a6;box-shadow:0 0 0 2px #2fb3a655}
   #hero-details .leader-badge{position:absolute;left:50%;top:-.15em;transform:translateX(-50%);z-index:1;padding:0 .4em;border-radius:.3em;background:#2d7a5f;color:#fff;font-size:.62em;font-weight:700;white-space:nowrap}
   #hero-details .hero-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4em;margin-top:.6em}
   #hero-details .hero-actions button{min-height:2.2em;font-size:.82em;font-weight:800;background:linear-gradient(#fffaf0,#f1e2bf);color:#1d3150;border:1px solid #b99c66;box-shadow:0 .12em 0 #b99c66}
   #hero-details .hero-actions button:disabled{opacity:1;background:#e3e6ea;color:#7d8794;border-color:#b8bfc8;box-shadow:none}
   #hero-details .ticket-bar{position:relative;display:flex;align-items:center;height:1.3em;width:86%;flex:none;margin-left:0;border-radius:1em;background:#0a0e15;box-shadow:inset 0 .1em .15em #000c}
   #hero-details .ticket-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:1em;background:linear-gradient(#9cecff 0%,#38b8ff 40%,#1a8cff 100%);box-shadow:inset 0 .12em 0 #ffffffb3,0 0 .35em #2aa6ff99}
   #hero-details .ticket-bar span{position:relative;flex:1;padding-left:.5em;text-align:center;white-space:nowrap;font-size:.55em;letter-spacing:-.03em;font-weight:800;color:#fff;text-shadow:-1px -1px 0 #14213a,1px -1px 0 #14213a,-1px 1px 0 #14213a,1px 1px 0 #14213a}
   #hero-details .ticket-strip{position:relative;display:flex;align-items:center;justify-content:center;margin:-1.1em .07em 0;padding:1.65em .25em .6em;border-radius:0 0 .5em .5em;background:linear-gradient(#2a3446,#1c2433);box-shadow:0 .1em .2em #0b162655}
   #hero-details .ticket-strip .hero-ticket-art{position:absolute;z-index:1;left:-.4em;bottom:.77em;width:1.45em;height:.97em;flex:none;background-image:url('assets/images/progression/hero-tickets.png');background-size:240% 240%;background-repeat:no-repeat;filter:drop-shadow(0 1px 1px #14213a)}
   #hero-details .hero-ticket-notice{margin-top:.5em;color:#36465c;font-size:.8em}
   #hero-details .sub-panel header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.4em}
   #hero-details .sub-panel header h2{margin:0;padding:.1em .8em;border-radius:1em;background:#1b2a42;color:#fff4d6}
   #hero-details .sub-panel header button{min-height:0;width:1.9em;height:1.9em;padding:0;background:#5b6678;color:#fff;border:0;font-weight:800}
   #hero-details .pane[data-view=heroes]:has(.sub-panel){display:flex;flex-direction:column}
   #hero-details .sub-panel{display:flex;flex-direction:column;gap:.35em;flex:1;min-height:0;font-size:.85em}
   #hero-details .sub-panel header{margin-bottom:0}
   #hero-details .sheet-row{display:flex;align-items:center;gap:.3em} #hero-details .sheet-row>span{flex:1;font-weight:700}
   #hero-details .sheet-row button,#hero-details .sheet-action{min-height:1.9em;padding:.1em .55em;font-weight:800;background:linear-gradient(#fffaf0,#f1e2bf);color:#1d3150;border:1px solid #b99c66;box-shadow:0 .12em 0 #b99c66}
   #hero-details .sheet-row button[aria-pressed=true]{background:#1b2a42;color:#fff4d6;border-color:#1b2a42;box-shadow:none}
   #hero-details .sheet-action:disabled{opacity:1;background:#e3e6ea;color:#7d8794;border-color:#b8bfc8;box-shadow:none}
   #hero-details .sheet-note{margin:0;color:#36465c;font-size:.9em}
   #hero-details[data-modal=formation]{z-index:40}
   #hero-details .formation-modal{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;gap:.5em;padding:.8em .7em .9em;background:linear-gradient(#20385c,#1a2840 60%,#121c2c);color:#fff1d1}
   #hero-details .formation-modal>header{position:relative;display:flex;justify-content:center;align-items:center;min-height:2.6em}
   #hero-details .formation-modal>header h2{margin:0;padding:.2em 1.6em;font-size:1.3em;letter-spacing:.04em;color:#2a2010;background:linear-gradient(#fff8e4,#ecd7a4);border:2px solid #b88e3c;border-radius:.6em;box-shadow:0 .15em .3em #07172a80}
   #hero-details .formation-modal>header .formation-close{position:absolute;right:0;top:50%;transform:translateY(-50%);display:grid;place-items:center;min-height:0;padding:0;border:0;background:transparent;box-shadow:none}
   #hero-details .formation-return{position:absolute;left:3.2em;top:.55em;z-index:3;min-height:0;padding:.25em .6em;font-size:.8em;font-weight:800;background:#fff3d8;color:#163052;border-color:#fff3d8}
   #hero-details .formation-top{display:flex;align-items:center;justify-content:space-between;gap:.5em}
   #hero-details .formation-power{display:flex;flex-direction:column;padding:.2em 1.4em .25em .7em;border-radius:0 1em 1em 0;margin-left:-.7em;background:linear-gradient(90deg,#b26a2c,#d98a3d);box-shadow:0 .1em .2em #07172a80;line-height:1.1}
   #hero-details .formation-power small{font-size:.75em;font-weight:700;color:#fff1d1} #hero-details .formation-power b{font-size:1.25em;color:#ffe9a8}
   #hero-details .formation-field{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:.5em;padding-top:.6em;border-radius:.8em;border:2px solid #3f5675;background:radial-gradient(ellipse 70% 60% at 50% 55%,#4f7fa8 0%,#2d5079 50%,#1b3150 100%)}
   #hero-details .formation-tools{display:flex;gap:.35em}
   #hero-details .formation-tools button{width:2.4em;height:2.4em;min-height:0;padding:0;border-radius:50%;font-weight:800;background:#192e48;border:2px solid #9eafc2;color:#fff1d1}
   #hero-details .formation-tools button[aria-pressed=true]{background:#fff3d8;color:#163052;border-color:#fff3d8}
   #hero-details .formation-tools button.copy{font-size:.72em;width:3.33em;height:3.33em}
   #hero-details .formation-tools button.lock[aria-pressed=true]{background:#e59a3a;border-color:#ffcf7a}
   #hero-details .formation-field[data-picking=true] .formation-grid:not([data-locked]) .formation-cell:not([aria-pressed=true]){border-color:#50cfff;box-shadow:0 0 0 2px #50cfff88,inset 0 -.25em 0 #cdb98f}
   #hero-details .formation-lock{cursor:pointer;min-height:0}
   #hero-details .formation-sort button:disabled{opacity:.5}
   #hero-details .formation-facing{position:absolute;right:.6em;top:.4em;font-size:.78em;font-weight:800;color:#cfe9ff}
   #hero-details .formation-grid{display:grid;grid-template-columns:repeat(${FORMATION_GRID_SIZE},4.7em);grid-auto-rows:4.7em;gap:1em .3em;padding:.9em .3em .3em;border-radius:.6em;background:#0e1a2c66}
   #hero-details .formation-field[data-locked=true] .formation-grid:not([data-locked]){box-shadow:0 0 0 2px #e59a3a}
   #hero-details .formation-grid[data-locked=true]{position:relative}
   #hero-details .formation-grid[data-locked=true] .formation-cell{opacity:.45;filter:grayscale(.6)}
   #hero-details .formation-lock{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;display:flex;align-items:center;gap:.3em;padding:.25em .7em;border-radius:1em;background:#1b2a42ee;border:1px solid #7e93ad;color:#fff1d1;font-size:.85em;font-weight:800;white-space:nowrap}
   #hero-details .formation-cell{position:relative;min-height:0;padding:0;overflow:visible;border:2px solid #d8c9a6;border-radius:.45em;background:linear-gradient(#fff8ea,#ecdcbc);box-shadow:inset 0 -.25em 0 #cdb98f}
   #hero-details .formation-cell[aria-pressed=true]{border-color:#2fb3a6;box-shadow:0 0 0 3px #2fb3a6aa,inset 0 -.25em 0 #cdb98f}
   #hero-details .formation-cell .cell-face{position:absolute;left:0;right:0;bottom:1.05em;height:118%;display:flex;justify-content:center;align-items:flex-end;pointer-events:none}
   #hero-details .formation-cell img{height:100%;width:auto;max-width:100%;object-fit:contain;filter:drop-shadow(0 .15em .1em #07172a80)}
   #hero-details .formation-cell em{position:absolute;z-index:1;left:.15em;right:.15em;bottom:.15em;font-style:normal;font-size:.7em;font-weight:800;color:#fff;background:#1b2a42e6;border-radius:.3em;white-space:nowrap}
   #hero-details .formation-cell[data-leader=true] em{background:#2d7a5f}
   #hero-details .formation-roster-bar{display:flex;align-items:center;gap:.35em}
   #hero-details .formation-roster-bar .formation-count{flex:1;font-weight:800;color:#ffe9a8}
   #hero-details .formation-roster-bar button{min-height:0;height:2em;min-width:2.6em;padding:0 .6em;border-radius:1em;font-weight:800;background:linear-gradient(#ffcf7a,#e59a3a);color:#2a1a08;border:1px solid #b06a1e}
   #hero-details .formation-roster{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.4em}
   #hero-details .formation-card{position:relative}
   #hero-details .formation-card-pick{position:relative;display:block;width:100%;aspect-ratio:1/1.15;padding:0;overflow:hidden;border:2px solid #6b8590;border-radius:.45em;background:radial-gradient(ellipse 75% 65% at 50% 38%,#fff 0%,#eef2f6 55%,#d5dce5 100%)}
   #hero-details .formation-card[data-selected=true] .formation-card-pick{border-color:#ffcf3f;box-shadow:0 0 0 2px #ffcf3f99}
   #hero-details .formation-card-pick .card-face{position:absolute;inset:0;overflow:hidden}
   #hero-details .formation-card-pick img{position:absolute;left:-40%;top:-2%;width:180%;height:auto;max-width:none}
   #hero-details .formation-card-pick .card-lv{position:absolute;right:.2em;top:.1em;font-size:.68em;color:#fff;text-shadow:0 0 2px #14213a,0 0 2px #14213a}
   #hero-details .formation-card-pick .card-role{position:absolute;left:.2em;bottom:1.45em;padding:0 .3em;border-radius:.5em;font-size:.55em;font-weight:800;background:#1b2a42cc;color:#fff1d1}
   #hero-details .formation-card-pick .card-leader{position:absolute;left:.25em;top:.05em;color:#ffcf3f;font-size:.9em;text-shadow:0 0 2px #14213a}
   #hero-details .formation-card-pick em{position:absolute;left:0;right:0;bottom:0;font-style:normal;font-size:.68em;font-weight:800;color:#fff;background:#1b2a42e6;white-space:nowrap}
   #hero-details .card-zoom{position:absolute;right:-.2em;bottom:1.1em;z-index:1;width:1.7em;height:1.7em;min-height:0;padding:0;border-radius:50%;font-size:.8em;background:#fff3d8;border:1px solid #b99c66}
   #hero-details .formation-sort,#hero-details .formation-confirm{position:absolute;left:1em;right:1em;z-index:6;padding:.8em;border-radius:.7em;background:#fff4df;color:#20304a;border:2px solid #b88e3c;box-shadow:0 .4em 1em #050b16b0}
   #hero-details .formation-sort{top:7em} #hero-details .formation-confirm{top:40%;text-align:center}
   #hero-details .formation-sort h3{margin:.1em 0 .35em;font-size:.95em;text-align:center}
   #hero-details .formation-sort .sort-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.35em;margin-bottom:.5em}
   #hero-details .formation-sort .sort-options button,#hero-details .formation-confirm button{min-height:2.1em;font-weight:800;background:linear-gradient(#fffaf0,#f1e2bf);color:#1d3150;border:1px solid #b99c66}
   #hero-details .formation-sort .sort-options button[aria-pressed=true]{background:#ffd56e;border-color:#b88e3c}
   #hero-details .formation-sort .sort-done{width:100%;min-height:2.2em;font-weight:800;background:#1b2a42;color:#fff4d6}
   #hero-details .formation-confirm p{margin:0 0 .6em;font-weight:800} #hero-details .formation-confirm div{display:grid;grid-template-columns:1fr 1fr;gap:.5em}
   #hero-details .formation-confirm button.primary{background:linear-gradient(#ffcf7a,#e59a3a);color:#2a1a08;border-color:#b06a1e}
   #hero-details .formation-note{margin:0;min-height:1.3em;text-align:center;font-size:.85em;color:#c9d6e6}
   #hero-details .formation-actions{display:grid;grid-template-columns:1fr 1.3fr 1fr;gap:.45em}
   #hero-details .formation-actions button{min-height:2.6em;font-weight:800;background:linear-gradient(#fffaf0,#f1e2bf);color:#1d3150;border:1px solid #b99c66;box-shadow:0 .14em 0 #b99c66}
   #hero-details .formation-actions button.primary{background:linear-gradient(#ffcf7a,#e59a3a);color:#2a1a08;border-color:#b06a1e;box-shadow:0 .14em 0 #b06a1e}
   #hero-details .formation-actions button:disabled{opacity:1;background:#e3e6ea;color:#7d8794;border-color:#b8bfc8;box-shadow:none}
   #hero-details .star-sheet .stars span{font-size:1.5em}
   #hero-details .growth-lines{display:grid;grid-template-columns:auto 1fr;gap:.1em .5em;margin:0;font-size:.92em} #hero-details .growth-lines dt{font-weight:800;color:#36465c} #hero-details .growth-lines dd{margin:0}
   #hero-details .resonance-slots{display:grid;grid-template-columns:1fr 1fr;gap:.4em}
   #hero-details .resonance-slot{display:flex;align-items:center;gap:.35em;min-height:3em;padding:.25em .35em;text-align:left;border:2px dashed #b9c1cc;border-radius:.5em;background:#f7f8fa;color:#36465c}
   #hero-details .resonance-slot[data-linked]{border:2px solid #6b8590;background:#fff}
   #hero-details .resonance-slot[aria-pressed=true]{border-color:#2fb3a6;box-shadow:0 0 0 2px #2fb3a655}
   #hero-details .resonance-slot span{flex:1;font-size:.82em;line-height:1.2}
   #hero-details .resonance-slot .slot-face{position:relative;flex:none;width:2.3em;height:2.3em;overflow:hidden;border-radius:.3em;background:#eef2f6}
   #hero-details .resonance-slot .slot-face img{position:absolute;left:-15%;top:-6%;width:130%;height:auto;max-width:none}
   #hero-details .resonance-picker{display:flex;flex-wrap:wrap;gap:.3em}
   #hero-details .gear-slots{display:flex;gap:.45em;justify-content:center;height:4.1em;margin-bottom:.3em}
   #hero-details .gear-slot{position:relative;flex:0 0 4.1em;aspect-ratio:1;min-height:0;padding:.2em;border:2px solid var(--rarity);border-radius:.55em;background:linear-gradient(145deg,color-mix(in srgb,var(--rarity) 60%,#122241),#182843);box-shadow:inset 0 1px #fff8,0 .2em .2em #07172a50}
   #hero-details button.gear-slot{min-height:0;padding:.2em;border:2px solid var(--rarity);background:linear-gradient(145deg,color-mix(in srgb,var(--rarity) 60%,#122241),#182843)}
   #hero-details .gear-slot[aria-pressed=true]{outline:2px solid #e2a92c;outline-offset:2px} #hero-details .gear-slot small{position:absolute;top:.15em;left:0;width:100%;color:white;font-size:.68em;white-space:nowrap;z-index:1} #hero-details .gear-slot .lamp-art{display:block;width:100%} #hero-details .gear-empty{position:absolute;inset:0;display:grid;place-items:center;font-size:.72em;color:#c3cbd8}
   #hero-details .pane[data-view=gear]{display:flex;flex-direction:column}
   #hero-details .gear-detail{padding:.45em .6em;text-align:center;font-size:.85em;border-radius:.5em;background:#1b2a42;color:#fff4d6;box-shadow:inset 0 1px #ffffff22} #hero-details .gear-detail h2{margin:0;font-size:1.05em;color:#fff4d6} #hero-details .gear-detail small{color:#b9c8da} #hero-details .gear-detail p{margin:.2em 0 0}
   #hero-details .stat-block{margin-top:auto;padding-top:.3em} #hero-details .stat-head{display:flex;justify-content:space-between;font-size:.8em;font-weight:800;color:#36465c}
   #hero-details .stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.3em;margin:.25em 0 0;padding:0}
   #hero-details .stat-grid div{display:flex;align-items:center;gap:.3em;padding:.3em .4em;border-radius:.4em;background:#1b2a42;color:#fff4d6}
   #hero-details .stat-grid img,#hero-details .stat-grid b{width:1.4em;height:1.4em;flex:none;object-fit:contain}
   #hero-details .stat-grid b{display:grid;place-items:center;border-radius:50%;background:#3d5677;font-size:.55em;white-space:nowrap;line-height:1}
   #hero-details .stat-grid dt{font-size:.68em;color:#b9c8da} #hero-details .stat-grid dd{margin:0 0 0 auto;font-weight:800}
   #hero-details .orb-placeholder{display:flex;align-items:center;gap:.6em;padding:.7em;border-radius:.5em;background:#1b2a42;color:#fff4d6}
   #hero-details .orb-placeholder small{color:#b9c8da}
  `;document.head.append(style);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&host&&!host.hidden&&subPanel==='formation'&&formationEscape){event.preventDefault();formationEscape();}});
  content=document.createElement('div');host.append(content);document.body.append(host);
 }
 const rect=canvas.getBoundingClientRect(),scale=rect.width/360;
 Object.assign(host.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,padding:`${(globals.CombatBossFallbackVisible?96:14)*scale}px ${12*scale}px ${66*scale}px`,fontSize:`${14*scale}px`});
 host.hidden=false;host.dataset.tab=currentTab;if(subPanel==='formation')host.dataset.modal='formation';else delete host.dataset.modal;
 const tickets=Object.fromEntries(roster.map(member=>[member.heroInstanceKey,combatProgression?.ticketCount(member.heroInstanceKey)||0]));
 const leaderName=resolveCombatMovementTuning(globals).leaderName;
 const growth=combatProgression?.heroGrowth?.()||null,formationStore=combatProgression?.formation||null,formationState=formationStore?.state()||null;
 const key=JSON.stringify([index,currentTab,subPanel,activeSkillIndex,leaderName,roster.map(member=>[member.currentLevel,member.currentEXP,member.maxHP,member.stats]),hero.hp,globals.Equipment,tickets,ticketNotice,growth,formationState,formationPick,resonancePick,sheetNotice,formationDraft,formationHistory.length,formationConfirm,formationSortOpen,formationSort,formationReturn,formationCopyOpen,formationCopyTargets]);
 if(key!==lastKey){
  lastKey=key;
  const focused=content.contains(document.activeElement)?document.activeElement:null;
  const focusLabel=focused?.getAttribute('aria-label')||focused?.textContent;
  content.replaceChildren();
  const el=(tag,text,parent=content)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;parent.append(node);return node;};
  const button=(parent,text,action)=>{const node=el('button',text,parent);node.type='button';node.onclick=()=>{action();lastKey='';};return node;};
  const portrait=(owner,parent)=>{const image=heroPortraitImages[heroArtKey(owner)];if(image?.src){const img=el('img',null,parent);img.src=image.src;img.alt=heroDefinition(owner).name;return img;}};
  const selectHero=target=>{gameState.selectedHero=(target+roster.length)%roster.length;};

  const identity=el('header');identity.className='identity';
  portrait(hero,identity)?.classList.add('hero-portrait');
  const formation=button(identity,null,()=>openFormation());
  formation.className='formation-button';formation.setAttribute('aria-label','Formation');
  const miniPreset=formationState&&activeFormationPreset(formationState);
  for(let row=0;row<FORMATION_ROWS;row++)for(let column=0;column<FORMATION_GRID_SIZE;column++){const occupant=miniPreset?formationOccupant(miniPreset,formationCell(row,column)):'';el('i',null,formation).className=occupant&&occupant===miniPreset.leader?'lead':occupant?'filled':'';}
  const arrows=el('nav',null,identity);arrows.className='hero-arrows';arrows.setAttribute('aria-label','Choose hero');
  button(arrows,'‹',()=>selectHero(index-1)).setAttribute('aria-label','Previous hero');
  button(arrows,'›',()=>selectHero(index+1)).setAttribute('aria-label','Next hero');
  if(formationReturn){const back=button(identity,'◀ Formation',()=>openFormation());back.className='formation-return';back.setAttribute('aria-label','Back to Formation');}
  const name=el('div',null,identity);name.className='hero-name';
  el('h1',definition.name,name);starMeter(heroStars(growth,hero.heroInstanceKey),name);

  const panel=el('aside',null,identity);panel.className='skill-panel';panel.setAttribute('aria-label','Hero skills');
  const panelNav=document.createElement('footer');
  const previous=button(panelNav,'‹',()=>{activeSkillIndex=(activeSkillIndex-1+entries.length)%entries.length;});previous.setAttribute('aria-label','Previous skill');
  el('small',`${activeSkillIndex+1} / ${entries.length}`,panelNav).setAttribute('aria-label','Skill index');
  const next=button(panelNav,'›',()=>{activeSkillIndex=(activeSkillIndex+1)%entries.length;});next.setAttribute('aria-label','Next skill');
  const ability=entries[activeSkillIndex],detail=el('article',null,panel);
  panel.append(panelNav);
  if(ability){
   const abilities=definition.actives,unlocked=heroSkillUnlocked(hero,ability);detail.dataset.locked=String(!unlocked);detail.dataset.skill=ability.skillId;
   el('h2',ability.displayName,detail);
   el('small',unlocked?'Unlocked · Lv. '+ability.unlockLevel:'Unlocks at Lv. '+ability.unlockLevel,detail);
   el('p',ability.description.replaceAll('magic-tagged actions','magic skills'),detail);
   el('p',`Range: ${heroSkillRange(ability,hero)} · Cooldown: ${ability.cooldownSeconds}s`,detail).className='skill-meta';
   el('p',`When: ${ability.conditionLabel}`,detail);
   detail.setAttribute('aria-label',`Skill ${abilities.indexOf(ability)+1} of ${abilities.length}`);
  }else{detail.dataset.skill='basic';el('h2','Basic Attack',detail);el('small','Always available',detail);el('p',definition.basic.description,detail);}

  function openFormation(){
   if(!formationDraft&&formationStore){formationDraft=structuredClone(formationStore.state());formationHistory=[];}
   subPanel='formation';formationReturn=false;formationPick='';formationConfirm=false;formationSortOpen=false;sheetNotice='';formationFocus=true;
  }
  // Formation opens as a full-screen modal over the hero screen and shared navigation (StoneAge Set Party / Edit Party).
  function renderFormationModal(){
   const modal=document.createElement('section');modal.className='formation-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Formation');
   // The back grid unlocks with hero level; carry that into an open draft without marking it unsaved.
   if(formationDraft&&formationState&&formationDraft.unlockedGrids!==formationState.unlockedGrids)formationDraft=sanitizeHeroFormation(formationDraft,formationStore.roster,formationState.unlockedGrids);
   const saved=formationState,draft=formationDraft||saved,dirty=!!saved&&JSON.stringify(draft)!==JSON.stringify(saved);
   const finish=()=>{subPanel='';formationPick='';sheetNotice='';formationDraft=null;formationHistory=[];formationConfirm=false;formationSortOpen=false;formationCopyOpen=false;};
   const requestClose=()=>{if(formationDraft&&JSON.stringify(formationDraft)!==JSON.stringify(formationStore.state()))formationConfirm=true;else finish();};
   const edit=next=>{if(next===formationDraft||JSON.stringify(next)===JSON.stringify(formationDraft))return false;formationHistory.push(formationDraft);formationHistory=formationHistory.slice(-30);formationDraft=next;return true;};
   const commit=next=>{const result=formationStore.save(next);if(result.ok){formationDraft=structuredClone(formationStore.state());formationHistory=[];sheetNotice='Formation saved.';}else sheetNotice=notice(result.reason);return result.ok;};
   formationEscape=()=>{if(formationConfirm)formationConfirm=false;else if(formationCopyOpen)formationCopyOpen=false;else if(formationSortOpen)formationSortOpen=false;else requestClose();lastKey='';};
   const head=el('header',null,modal);el('h2','Formation',head);
   const close=button(head,null,requestClose);close.className='game-modal-close formation-close';close.innerHTML=MODAL_CLOSE_MARK;close.setAttribute('aria-label','Close Formation');
   const totalCP=Math.round(roster.reduce((sum,member)=>sum+computeCombatPower(member),0));
   const top=el('div',null,modal);top.className='formation-top';
   const power=el('div',null,top);power.className='formation-power';el('small','Total CP',power);el('b',String(totalCP),power).className='formation-total';
   if(!saved){el('p',`Current leader: ${leaderName}.`,modal);content.append(modal);return;}
   const preset=activeFormationPreset(draft),locked=!!preset.locked,nameOf=id=>heroDefinition(globals.HeroProgress.heroes[id]||{baseHeroName:id}).name;
   const tools=el('div',null,top);tools.className='formation-tools';tools.setAttribute('aria-label','Formation presets');
   for(let slot=0;slot<FORMATION_PRESETS;slot++){const tab=button(tools,String(slot+1),()=>{edit(selectFormationPreset(formationDraft,slot));formationPick='';});tab.setAttribute('aria-pressed',String(draft.active===slot));tab.setAttribute('aria-label',`Preset ${slot+1}`);}
   const copy=button(tools,'Copy',()=>{formationCopyOpen=true;formationCopyTargets=[];formationPick='';formationSortOpen=false;});copy.className='copy';copy.setAttribute('aria-label',`Copy preset ${draft.active+1}`);
   const undo=button(tools,'↩',()=>{formationDraft=formationHistory.pop()||formationDraft;formationPick='';sheetNotice='';});undo.className='undo';undo.setAttribute('aria-label','Undo');undo.disabled=!formationHistory.length;
   const lock=button(tools,locked?'🔒':'🔓',()=>{formationPick='';if(commit(setFormationLocked(formationDraft,!locked)))sheetNotice=locked?'Formation unlocked.':'Formation locked.';});
   lock.className='lock';lock.setAttribute('aria-pressed',String(locked));lock.setAttribute('aria-label',locked?'Unlock formation':'Lock formation');
   // Two 2x2 grids in one row; the board faces right, so the rightmost column is the frontline. The right grid opens first.
   const field=el('div',null,modal);field.className='formation-field';field.dataset.locked=String(locked);field.dataset.picking=String(!!formationPick);field.setAttribute('aria-label','Formation board, front on the right');
   el('span','Front ▶',field).className='formation-facing';
   const pick=id=>{if(locked){sheetNotice='Unlock the formation to make changes.';return;}formationPick=formationPick===id?'':id;sheetNotice='';};
   for(let grid=0;grid<FORMATION_GRIDS;grid++){
    const cells=el('div',null,field);cells.className='formation-grid';cells.dataset.grid=String(grid);
    if(!formationGridOpen(grid,draft.unlockedGrids)){
     cells.dataset.locked='true';cells.setAttribute('aria-label',`Back formation grid locked until a hero reaches level ${FORMATION_SECOND_GRID_LEVEL}`);
     for(let slot=0;slot<FORMATION_GRID_SIZE*FORMATION_ROWS;slot++)el('div',null,cells).className='formation-cell';
     const lockBadge=button(cells,`🔒 Lv. ${FORMATION_SECOND_GRID_LEVEL}`,()=>{formationPick='';sheetNotice=`This grid unlocks when a hero reaches Lv. ${FORMATION_SECOND_GRID_LEVEL}.`;});
     lockBadge.className='formation-lock';lockBadge.setAttribute('aria-label',`Locked until a hero reaches level ${FORMATION_SECOND_GRID_LEVEL}`);
     continue;
    }
    for(let row=0;row<FORMATION_ROWS;row++)for(let offset=0;offset<FORMATION_GRID_SIZE;offset++){
     const column=grid*FORMATION_GRID_SIZE+offset,cell=formationCell(row,column),occupant=formationOccupant(preset,cell),line=column===FORMATION_GRIDS*FORMATION_GRID_SIZE-1?'front':'back';
     const node=button(cells,null,()=>{
      if(formationPick&&formationPick!==occupant){edit(placeFormationHero(formationDraft,formationPick,cell));formationPick='';sheetNotice='';}
      else if(occupant)pick(occupant);
     });
     node.className='formation-cell';node.dataset.cell=String(cell);node.setAttribute('aria-pressed',String(!!occupant&&occupant===formationPick));
     if(occupant){
      const member=globals.HeroProgress.heroes[occupant];node.dataset.hero=occupant;node.dataset.leader=String(occupant===preset.leader);
      const face=el('i',null,node);face.className='cell-face';if(member)portrait(member,face);el('em',occupant===preset.leader?`★ ${nameOf(occupant)}`:nameOf(occupant),node);
      node.setAttribute('aria-label',`${nameOf(occupant)}, ${line} line${occupant===preset.leader?', leader':''}`);
     }else node.setAttribute('aria-label',`Empty ${line} slot${formationPick?`; move ${nameOf(formationPick)} here`:''}`);
    }
   }
   // Roster (Edit Party): every owned hero with sort, filter, undo and a magnifier into the hero screen.
   const bar=el('div',null,modal);bar.className='formation-roster-bar';
   const placed=roster.filter(member=>member.heroInstanceKey in preset.cells).length;
   el('span',`${placed}/${roster.length}`,bar).className='formation-count';
   const sortButton=button(bar,'Sort',()=>{formationSortOpen=!formationSortOpen;});sortButton.setAttribute('aria-label','Sort and filter heroes');sortButton.setAttribute('aria-expanded',String(formationSortOpen));
   const direction=button(bar,formationSort.descending?'▼':'▲',()=>{formationSort.descending=!formationSort.descending;});direction.setAttribute('aria-label',formationSort.descending?'Sort descending':'Sort ascending');
   const resetSort=button(bar,'↺',()=>{Object.assign(formationSort,{key:'level',descending:true,role:''});});resetSort.setAttribute('aria-label','Reset sort and filter');
   const stat=(member,key)=>key==='level'?member.currentLevel:key==='cp'?computeCombatPower(member):key==='HP'?member.maxHP:key==='role'?-ROLE_ORDER.indexOf(heroDefinition(member).role):Number(member.stats?.[key])||0;
   const shown=roster.filter(member=>!formationSort.role||heroDefinition(member).role===formationSort.role)
    .map((member,order)=>({member,order})).sort((a,b)=>(stat(b.member,formationSort.key)-stat(a.member,formationSort.key))*(formationSort.descending?1:-1)||a.order-b.order).map(row=>row.member);
   const list=el('div',null,modal);list.className='formation-roster';list.setAttribute('aria-label','Hero roster');
   for(const member of shown){
    const id=member.heroInstanceKey,memberDefinition=heroDefinition(member);
    const card=el('div',null,list);card.className='formation-card';card.dataset.hero=id;card.dataset.selected=String(formationPick===id);
    const choose=button(card,null,()=>pick(id));choose.className='formation-card-pick';choose.setAttribute('aria-pressed',String(formationPick===id));
    choose.setAttribute('aria-label',`${memberDefinition.name}, level ${member.currentLevel}, ${memberDefinition.role}${id===preset.leader?', leader':''}`);
    const face=el('i',null,choose);face.className='card-face';portrait(member,face);
    el('b',`Lv.${member.currentLevel}`,choose).className='card-lv';
    el('small',memberDefinition.role,choose).className='card-role';
    if(id===preset.leader)el('span','★',choose).className='card-leader';
    el('em',memberDefinition.name,choose);
    const zoom=button(card,'🔍',()=>{gameState.selectedHero=roster.indexOf(member);subPanel='';currentTab='heroes';formationReturn=true;formationPick='';formationSortOpen=false;});
    zoom.className='card-zoom';zoom.setAttribute('aria-label',`Open ${memberDefinition.name}'s hero screen`);
   }
   el('p',sheetNotice||(locked?'Formation locked · Unlock to make changes.':formationPick?`Tap a slot to move ${nameOf(formationPick)}.`:dirty?'Unsaved changes.':`Leader ${nameOf(preset.leader)} · Tap a hero, then a slot.`),modal).className='formation-note';
   const actions=el('div',null,modal);actions.className='formation-actions';
   const lead=button(actions,'Set Leader',()=>{edit(setFormationLeader(formationDraft,formationPick));formationPick='';});
   lead.disabled=locked||!formationPick||formationPick===preset.leader;lead.setAttribute('aria-label',formationPick?`Set ${nameOf(formationPick)} as leader`:'Set Leader');
   const auto=button(actions,'Auto-Form',()=>{edit(autoFormActive(formationDraft,formationStore.roster));formationPick='';});auto.disabled=locked;
   const save=button(actions,'Save',()=>commit(formationDraft));save.className='primary';save.disabled=!dirty;save.setAttribute('aria-label',dirty?'Save formation':'Formation saved');
   if(formationSortOpen){
    const sheet=el('div',null,modal);sheet.className='formation-sort';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-label','Sort and filter');
    el('h3','Sort',sheet);const keys=el('div',null,sheet);keys.className='sort-options';
    for(const [key,label] of SORT_KEYS){const option=button(keys,label,()=>{formationSort.key=key;});option.setAttribute('aria-pressed',String(formationSort.key===key));}
    el('h3','Filter',sheet);const roles=el('div',null,sheet);roles.className='sort-options';
    for(const role of ['',...ROLE_ORDER]){const option=button(roles,role||'All',()=>{formationSort.role=role;});option.setAttribute('aria-pressed',String(formationSort.role===role));}
    button(sheet,'Done',()=>{formationSortOpen=false;}).className='sort-done';
   }
   if(formationCopyOpen){
    const sheet=el('div',null,modal);sheet.className='formation-sort formation-copy';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-label','Copy preset');
    el('h3',`Copy preset ${draft.active+1} to`,sheet);const targets=el('div',null,sheet);targets.className='sort-options';
    const others=[...Array(FORMATION_PRESETS).keys()].filter(slot=>slot!==draft.active);
    for(const slot of others){
     const target=draft.presets[slot],option=button(targets,`${target.locked?'🔒 ':''}Preset ${slot+1}`,()=>{formationCopyTargets=formationCopyTargets.includes(slot)?formationCopyTargets.filter(value=>value!==slot):[...formationCopyTargets,slot];});
     option.setAttribute('aria-pressed',String(formationCopyTargets.includes(slot)));option.disabled=!!target.locked;
    }
    const open=others.filter(slot=>!draft.presets[slot].locked);
    button(targets,'Select All',()=>{formationCopyTargets=formationCopyTargets.length===open.length?[]:open;}).setAttribute('aria-pressed',String(open.length>0&&formationCopyTargets.length===open.length));
    const go=button(sheet,'Copy',()=>{const count=formationCopyTargets.length;if(edit(copyFormationPresetTo(formationDraft,formationCopyTargets)))sheetNotice=`Copied to ${count} preset${count===1?'':'s'}.`;formationCopyOpen=false;});
    go.className='sort-done';go.disabled=!formationCopyTargets.length;
   }
   if(formationConfirm){
    const confirm=el('div',null,modal);confirm.className='formation-confirm';confirm.setAttribute('role','alertdialog');confirm.setAttribute('aria-label','Unsaved formation changes');
    el('p','Save your formation changes?',confirm);const row=el('div',null,confirm);
    button(row,'Discard',finish);const keep=button(row,'Save',()=>{if(commit(formationDraft))finish();});keep.className='primary';
   }
   content.append(modal);
   installModalCloseStyles();close.style.setProperty('--modal-close-scale',String(rect.width/360));
   closeMeasure||=document.createElement('canvas').getContext('2d',{willReadFrequently:true});paintModalClose(close,closeMeasure);
   if(formationFocus){formationFocus=false;close.focus({preventScroll:true});}
  }
  const tabs=el('nav');tabs.className='tabs';tabs.setAttribute('aria-label','Hero management');
  for(const [id,label] of [['heroes','Heroes'],['gear','Gear'],['orb','Orb']]){const tab=button(tabs,label,()=>{currentTab=id;subPanel='';});tab.setAttribute('aria-pressed',String(currentTab===id));}
  const pane=el('div');pane.className='pane';pane.dataset.view=currentTab;pane.setAttribute('aria-label',`${currentTab} view`);

  const notice=reason=>reason==='insufficient_tickets'?'Not enough tickets yet.':reason==='slot_locked'?'That slot is still locked.':reason==='max_stars'?'All stars earned.':'The change could not be saved.';
  if(subPanel==='formation')renderFormationModal();
  if(currentTab==='heroes'&&subPanel&&subPanel!=='formation'){
   const sheet=el('section',null,pane);sheet.className='sub-panel';sheet.dataset.panel=subPanel;
   const head=el('header',null,sheet);el('h2',SHEET_TITLES[subPanel],head);button(head,'✕',()=>{subPanel='';sheetNotice='';}).setAttribute('aria-label','Close '+SHEET_TITLES[subPanel]);
   if(subPanel==='star')renderStarSheet(sheet);
   else renderResonanceSheet(sheet);
   if(sheetNotice)el('p',sheetNotice,sheet).className='sheet-note';

   function renderStarSheet(sheet){
    sheet.classList.add('star-sheet');
    const id=hero.heroInstanceKey,stars=heroStars(growth,id),maxed=stars>=STAR_MAX,cost=starUpCost(stars),balance=tickets[id]||0,breakdown=heroGrowthBreakdown(growth,id);
    const top=el('div',null,sheet);top.className='sheet-row';starMeter(stars,top);el('span',`${stars} / ${STAR_MAX}`,top);
    const lines=el('dl',null,sheet);lines.className='growth-lines';
    el('dt','Now',lines);el('dd',`+${pct(breakdown.own)} HP ATK DEF MATK RES`,lines);
    el('dt','Next',lines);el('dd',maxed?'All stars earned':`+${pct(breakdown.own+STAR_STAT_BONUS)}${(stars+1)%STAR_TIER_SIZE===0?` · [All] party +${pct(STAR_TIER_PARTY_BONUS)}`:''}${stars+1===RESONANCE_SLOT_STARS[1]?' · Resonance slot 2':''}`,lines);
    el('dt','[All]',lines);el('dd',`Party +${pct(breakdown.party)} from every hero's completed tiers`,lines);
    const row=el('div',null,sheet);row.className='sheet-row';
    el('span',maxed?'Max stars':`${balance}/${cost} ${definition.name} tickets`,row).className='star-cost';
    const action=button(row,'Star Up',()=>{const result=combatProgression.starUp(id);sheetNotice=result.ok?`${definition.name} reached ★${result.stars}.`:notice(result.reason);});
    action.className='sheet-action star-up';action.disabled=maxed||balance<cost||!combatProgression?.starUp;
    action.setAttribute('aria-label',maxed?'Maximum stars':`Star Up · ${cost} tickets`);
   }

   function renderResonanceSheet(sheet){
    const id=hero.heroInstanceKey,slots=resonanceSlots(growth,id),nameOf=key=>heroDefinition(globals.HeroProgress.heroes[key]||{baseHeroName:key}).name;
    el('p',`Other heroes lend ${definition.name} a passive echo of their signature stat.`,sheet).className='sheet-note';
    const grid=el('div',null,sheet);grid.className='resonance-slots';
    slots.forEach((linked,slot)=>{
     const unlocked=resonanceSlotUnlocked(growth,id,slot),echo=linked&&resonanceEcho(growth,linked);
     const node=button(grid,null,()=>{resonancePick=resonancePick===slot?-1:slot;sheetNotice='';});
     node.className='resonance-slot';node.disabled=!unlocked;node.setAttribute('aria-pressed',String(resonancePick===slot));
     const face=el('i',null,node);face.className='slot-face';
     if(echo){node.dataset.linked=linked;const member=globals.HeroProgress.heroes[linked];if(member)portrait(member,face);}
     const text=!unlocked?`Slot ${slot+1} · Unlocks at ★${RESONANCE_SLOT_STARS[slot]}`:echo?`${nameOf(linked)} · ${echo.label} +${pct(echo.magnitude)} ${STAT_NAMES[echo.stat]}`:`Slot ${slot+1} · Empty`;
     el('span',text,node);node.setAttribute('aria-label',`Resonance slot ${slot+1}: ${text}`);
    });
    if(resonancePick>=0){
     const picker=el('div',null,sheet);picker.className='resonance-picker';picker.setAttribute('aria-label',`Choose a hero for slot ${resonancePick+1}`);
     for(const other of Object.keys(RESONANCE_ECHOES).filter(key=>key!==id&&globals.HeroProgress.heroes[key])){
      const echo=resonanceEcho(growth,other);
      const choice=button(picker,`${nameOf(other)} +${pct(echo.magnitude)} ${STAT_NAMES[echo.stat]}`,()=>{const result=combatProgression.setResonance(id,resonancePick,other);sheetNotice=result.ok?'':notice(result.reason);resonancePick=-1;});
      choice.className='sheet-action';choice.setAttribute('aria-pressed',String(slots[resonancePick]===other));
     }
     if(slots[resonancePick])button(picker,'Clear',()=>{const result=combatProgression.setResonance(id,resonancePick,'');sheetNotice=result.ok?'':notice(result.reason);resonancePick=-1;}).className='sheet-action';
    }else if(!sheetNotice)el('p',`Slot 2 opens at ★${RESONANCE_SLOT_STARS[1]}. Echoes grow with the lending hero's stars.`,sheet).className='sheet-note';
   }
  }else if(currentTab==='heroes'){
   const grid=el('div',null,pane);grid.className='roster';grid.setAttribute('aria-label','Party roster');
   for(const [memberIndex,member] of roster.entries()){
    const memberDefinition=heroDefinition(member),selected=memberIndex===index,balance=tickets[member.heroInstanceKey],cost=heroTicketLevelCost(member.currentLevel),memberMaxed=member.currentLevel>=member.maxLevel;
    const card=el('div',null,grid);card.className='roster-card';card.dataset.hero=member.heroInstanceKey;card.dataset.selected=String(selected);
    const pick=button(card,null,()=>selectHero(memberIndex));pick.className='card-select';pick.setAttribute('aria-label',`Select ${memberDefinition.name}, level ${member.currentLevel}`);pick.setAttribute('aria-pressed',String(selected));
    portrait(member,pick);
    if(memberDefinition.name===leaderName)el('span','Leader',card).className='leader-badge';
    const strip=el('div',null,card);strip.className='ticket-strip';
    const art=el('span',null,strip);art.className='hero-ticket-art';art.style.backgroundPosition=TICKET_QUADRANT[memberDefinition.name]||'0% 0%';
    const bar=el('div',null,strip);bar.className='ticket-bar';bar.setAttribute('role','img');
    bar.setAttribute('aria-label',memberMaxed?`${memberDefinition.name} at maximum level`:`${balance} of ${cost} ${memberDefinition.name} tickets for the next level`);
    el('i',null,bar).style.width=`${memberMaxed?100:Math.min(100,100*balance/cost)}%`;
    el('span',memberMaxed?'MAX':`${balance}/${cost}`,bar);
   }
   const balance=tickets[hero.heroInstanceKey],cost=heroTicketLevelCost(hero.currentLevel),maxedHero=hero.currentLevel>=hero.maxLevel;
   const actions=el('div',null,pane);actions.className='hero-actions';actions.setAttribute('aria-label',`${definition.name} actions`);
   const levelUp=button(actions,'Level Up',()=>{
    const result=combatProgression?.spendLevelUp(hero.heroInstanceKey)||{ok:false,reason:'unavailable'};
    ticketNotice=result.ok?`${definition.name} reached level ${result.level}.`:result.reason==='insufficient_tickets'?`Need ${result.cost} ${definition.name} tickets.`:result.reason==='max_level'?'This hero is at the current level cap.':'Ticket spend could not be saved.';
   });
   levelUp.className='hero-level-up';levelUp.disabled=maxedHero||balance<cost||!combatProgression;
   levelUp.setAttribute('aria-label',maxedHero?'Maximum level':`Level Up · ${cost} tickets`);
   button(actions,'Star Up',()=>{subPanel='star';sheetNotice='';});
   button(actions,'Resonance',()=>{subPanel='resonance';resonancePick=-1;sheetNotice='';});
   if(ticketNotice)el('small',ticketNotice,pane).className='hero-ticket-notice';
  }else if(currentTab==='gear'){
   const slots=el('div',null,pane),itemDetail=el('div',null,pane);itemDetail.className='gear-detail';
   renderHeroGear({stage:slots,pane:itemDetail,hero,economy:equipmentProgress});
   slots.replaceWith(...slots.childNodes);
   const block=el('section',null,pane);block.className='stat-block';
   const head=el('div',null,block);head.className='stat-head';el('span',`Lv. ${hero.currentLevel}`,head);el('span',`CP ${computeCombatPower(hero)}`,head).className='hero-cp';
   const stats=el('dl',null,block);stats.className='stat-grid';stats.setAttribute('aria-label','Hero stats');
   for(const [label,value] of Object.entries({HP:hero.maxHP,...hero.stats})){
    const cell=el('div',null,stats);
    if(STAT_ICONS[label]){const icon=el('img',null,cell);icon.src=runtimeAssetUrl(`images/progression/${STAT_ICONS[label]}.png`);icon.alt='';}else el('b',label.slice(0,2),cell).setAttribute('aria-hidden','true');
    el('dt',label==='MAG'?'MATK':label,cell);el('dd',String(value),cell);
   }
  }else{
   const orb=el('div',null,pane);orb.className='orb-placeholder';orb.setAttribute('aria-label','Orb equipment unavailable');
   const copy=el('div',null,orb);el('h2','Orb slot · Coming soon',copy);el('small','Orb equipment is not available yet.',copy);
  }
  content.append(tabs,pane);
  if(focusLabel){const replacement=[...content.querySelectorAll('button')].find(node=>(node.getAttribute('aria-label')||node.textContent)===focusLabel);replacement?.focus({preventScroll:true});}
 }
 return {mode:'details',selectedSkillIndex:Math.min(activeSkillIndex,definition.actives.length-1),hitZones:{skillNodes:[]}};
}

function heroSkillRange(ability,hero){
 const {kind,shape}=ability.targetRule,reach=actorAttackReach({...hero,kind:'hero'});
 if(shape){
  const extent=shape.kind==='circle'?`radius ${shape.radius} units`:shape.kind==='rectangle'?`${shape.width} × ${shape.height} units`:shape.kind==='horizontalLine'?`${shape.width}-unit line to world X ${shape.toX}`:`${shape.length}-unit cone at ${shape.angleDegrees}°`;
  return `${extent}${['bestArea','firstArea','eventArea'].includes(kind)?`; anchor within ${reach} units`:''}`;
 }
 if(kind==='self')return 'Self';
 if(kind==='party')return `Allies within ${reach} units; foe trigger within ${reach} units`;
 if(kind==='eventChain')return `${ability.targetRule.minimum} other foes after a basic hit`;
 if(kind==='allEnemies')return 'All attackable foes';
 if(kind==='lowestHPAlly'||kind==='slowestAlly')return `Eligible ally within ${reach} units; foe trigger within ${reach} units`;
 return `${reach}-unit actor reach`;
}
