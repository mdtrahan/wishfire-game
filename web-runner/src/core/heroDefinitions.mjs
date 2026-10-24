import { validateSkillCondition } from '../../../src/core/skillConditionRules.mjs';
// Canonical hero identities and approved real-time combat kits.
export const PROGRESSION = Object.freeze({ maxLevel: 100, expBase: 100, expExponent: 1.5, enemyEXP: 25, enemyGold: 10 });
export const COMBAT_TUNING = Object.freeze({ criticalHP: 0.25, blindPenalty: 0.35, accuracy: 1, evasion: 0, counterPotency: 1 });

// Retained only while story and QA callers migrate off the retired FLOW path.
export const FLOW_ORB_TUNING = Object.freeze({ flowMax: 100, limitOrbValue: 10, limitOrbDropCount: 1, releaseSeconds: .72, flightSeconds: .52, collectFlashSeconds: .18 });
export const FLOW_MODES = Object.freeze({ Stoic: 'Take hostile HP damage.', Warrior: 'Deal positive enemy HP damage.', Tactician: 'Deal magic damage or apply a new eligible status.', Comrade: 'Another living ally takes hostile HP damage.' });

export const heroSkillUnlocked = (hero, skill) => Number(hero?.currentLevel || 1) >= Number(skill?.unlockLevel || 1);
const leaf = (key, args = {}) => ({key,...args});
const count = (value, group = 'attackableEnemies', filter) => leaf('actors.count',{group,operator:'gte',value,...(filter?{filter}:{})});
const basic = magic => Object.freeze({skillId:'basic_attack',displayName:'Attack',targetType:'enemy',cooldownSeconds:0,tags:[magic?'magic':'physical'],effects:[{effectType:'damage',potency:1,hits:1}],description:'Attack the first living enemy in range.'});
// Accepted kits (owner, 2026-10-23): Basic + Special (the only clock) + Passive (no clock,
// no lingering) + two Resonances. Resonances are late-game scaffolding: data and Hero
// screen only, no runtime. Special cooldowns marked provisional await owner tuning.
export const PROVISIONAL_SPECIAL_COOLDOWNS = Object.freeze(['shadow', 'bubble_pop', 'elevate']);
const special = (skillId,displayName,icon,cooldownSeconds,conditions,conditionLabel,targetRule,effectSpec,description,extra={}) => Object.freeze({
 skillId,slot:'special',displayName,icon,cooldownSeconds,unlockLevel:1,conditions,conditionLabel,targetRule,effectSpec,description,
 targetType:targetRule.kind,durationSeconds:extra.durationSeconds||0,trigger:'poll',recipientPolicy:'all',
 provisionalCooldown:PROVISIONAL_SPECIAL_COOLDOWNS.includes(skillId),...extra,
});
// Passive specs are evaluated live from the holder's current state; nothing is stored.
const passive = (skillId,displayName,icon,conditionLabel,spec,description) => Object.freeze({skillId,slot:'passive',displayName,icon,unlockLevel:1,conditionLabel,passive:Object.freeze(spec),description});
const resonance = (skillId,displayName,icon,conditionLabel,description) => Object.freeze({skillId,slot:'resonance',displayName,icon,conditionLabel,description,scaffold:true});
// Elevate's three party sets; one is rolled at fight start and on every refill of its clock.
export const ELEVATE_SETS = Object.freeze({
 swift:Object.freeze({label:'Swift',icons:['party-spd','party-atk'],modifiers:[{channel:'SPD',direction:'up',magnitude:.05},{channel:'ATK',direction:'up',magnitude:.05}],summary:'SPD +5%, ATK +5%'}),
 vital:Object.freeze({label:'Vital',icons:['party-hp','party-mag'],modifiers:[{channel:'HP',direction:'up',magnitude:.2},{channel:'MAG',direction:'up',magnitude:.05}],summary:'Max HP +20%, MAG +5%'}),
 reach:Object.freeze({label:'Reach',icons:['party-range','party-cd'],modifiers:[{channel:'range',direction:'up',magnitude:.1},{channel:'critDamage',direction:'up',magnitude:.05}],summary:'Attack range +10%, crit damage +5%'}),
});
export const CRIMSON_WARD = Object.freeze({wardPctMaxHP:8,capPctMaxHP:50});
const enemy = (order='first') => ({kind:'enemy',order});
const party = () => ({kind:'party'});
const kit = (key,name,role,baseStats,growth,baseAttackInterval,{special,passive,resonances},magic=false) => Object.freeze({key,name,role,baseStats,growth,baseAttackInterval,maxLevel:PROGRESSION.maxLevel,basic:basic(magic),
 special,passive,resonances:Object.freeze(resonances),skills:Object.freeze([special,passive,...resonances]),actives:Object.freeze([special])});
export const HERO_DEFINITIONS = Object.freeze({
 Falie:kit('Falie','Fara','Tank',{HP:75,ATK:7,DEF:12,MAG:4,RES:8,SPD:8},{HP:8,ATK:.8,DEF:1.8,MAG:.4,RES:1.1,SPD:.15},1.8,{
  special:special('crimson_ward','Crimson Ward','party-ward',120,count(1),'A foe in range',party(),{kind:'ward'},
   'Every hero gains its own temporary HP worth 8% of its max HP, stacking up to 50% of its original max HP. Hits drain only the struck hero’s ward. Kept between waves, into a boss fight and after a boss clear; cleared when the party falls or a boss attempt fails.',
   {wardPctMaxHP:CRIMSON_WARD.wardPctMaxHP,capPctMaxHP:CRIMSON_WARD.capPctMaxHP,partyWide:true}),
  passive:passive('smoke_form','Smoke Form','party-dr','Own HP below 40%',{hpBelow:.4,incomingCutPct:50},'Below 40% HP, Fara takes 50% less damage.'),
  resonances:[
   resonance('phoenix_soul','Phoenix Soul','party-heal','Own HP below 15%','Below 15% HP, each basic attack heals Fara for 6% of max HP.'),
   resonance('chastise','Chastise','party-reflect','When hit','Reflect 80% of damage taken back to the attacker.'),
  ],
 }),
 Huun:kit('Huun','Hondo','Damage',{HP:60,ATK:16,DEF:5,MAG:3,RES:4,SPD:12},{HP:6,ATK:2.1,DEF:.7,MAG:.3,RES:.6,SPD:.35},1.2,{
  special:special('shadow','Shadow','party-special',20,count(1),'A foe in range',enemy(),{kind:'damageBlink',damagePct:240},'Jump behind a foe and hit it for 240% damage.',{damagePct:240}),
  passive:passive('royalty','Royalty','party-atk','Own HP below 50%',{hpBelow:.5,basicDamageMultiplier:2,targetDebuff:{channel:'DEF',magnitude:.05,durationSeconds:4}},'Below 50% HP, Hondo’s basic attacks deal double damage and lower the struck enemy’s DEF by 5% for 4s (provisional), helping every hero.'),
  resonances:[
   resonance('chase','Chase','party-atk','Exactly one foe in range','Against a lone foe in range, deal +160% damage.'),
   resonance('weaken','Weaken','party-cr','Three or more foes in range','When surrounded by three or more foes, crit rate +5% and crit damage +5%.'),
  ],
 }),
 Runa:kit('Runa','Runa','Mage',{HP:60,ATK:3,DEF:4,MAG:16,RES:10,SPD:11},{HP:5,ATK:.3,DEF:.7,MAG:2.1,RES:1.4,SPD:.3},1.4,{
  special:special('bubble_pop','Bubble Pop','party-mag',20,count(1),'A foe in range',{kind:'inRangeEnemies'},{kind:'damageRetreat',damagePct:180},'Hit every foe in range for 180% magic damage and push them back for 2 seconds.',{damagePct:180,durationSeconds:2}),
  passive:passive('boast','Boast','party-res','Own HP above 80%',{hpAbove:.8,modifiers:[{channel:'MAG',direction:'up',magnitude:.05},{channel:'RES',direction:'up',magnitude:.05}]},'Above 80% HP, Runa gains MAG +5% and RES +5%.'),
  resonances:[
   resonance('vengeance','Vengeance','party-mag','Own HP below 45%','Below 45% HP, MAG rises by the share of HP lost.'),
   resonance('stare','Stare','party-res','Exactly one foe in range','Against a lone foe, add twice RES to MAG.'),
  ],
 },true),
 Kojonn:kit('Kojonn','Kaja','Support',{HP:65,ATK:4,DEF:7,MAG:9,RES:12,SPD:10},{HP:7,ATK:.4,DEF:1.1,MAG:1.4,RES:1.7,SPD:.25},1.6,{
  special:special('elevate','Elevate','party-spd',20,count(1,'livingHeroes'),'Fight start, then each time the clock fills',party(),{kind:'elevate'},
   'Roll one party set until the next roll: SPD +5% and ATK +5%, max HP +20% and MAG +5%, or attack range +10% and crit damage +5%. Ends if Kaja falls.',
   {randomStats:Object.keys(ELEVATE_SETS),partyWide:true}),
  passive:passive('ethereal_aura','Ethereal Aura','party-mag','Foes in range',{aura:{rawDamagePerChapter:1,intervalSeconds:1}},'Foes in Kaja’s range take Faze damage every second, rising with each chapter.'),
  resonances:[
   resonance('cornered','Cornered','party-def','Three or more foes in range','When surrounded by three or more foes, DEF +8% and RES +8%.'),
   resonance('timeless','Timeless','party-special','Own HP below 55%','Below 55% HP, every special deals +20% damage and crit rate rises 1%.'),
  ],
 },true),
});

const targetKinds=new Set(['enemy','party','inRangeEnemies']);
const effectKinds=new Set(['ward','damageBlink','damageRetreat','elevate']);
for (const definition of Object.values(HERO_DEFINITIONS)) for (const skill of definition.actives) {
  validateSkillCondition(skill.conditions);
  if(!skill.conditionLabel)throw new Error(`Missing readable condition for ${skill.skillId}`);
  if(!targetKinds.has(skill.targetRule.kind) || !effectKinds.has(skill.effectSpec.kind))throw new Error('Unknown skill target or effect');
  if(skill.trigger!=='poll' || skill.recipientPolicy!=='all' || !(skill.cooldownSeconds>0))throw new Error('Specials poll, reach every recipient and own a clock');
}
for (const definition of Object.values(HERO_DEFINITIONS)) {
  if(definition.passive.cooldownSeconds!=null || definition.resonances.some(r=>r.cooldownSeconds!=null))throw new Error('Passives and resonances never own a clock');
}

export function heroKey(hero) {
  const name = typeof hero === 'string' ? hero : hero?.baseHeroName || hero?.name;
  return ({ Fara: 'Falie', Hondo: 'Huun', Kaja: 'Kojonn' })[name] || name;
}
export function heroDefinition(hero) { return HERO_DEFINITIONS[heroKey(hero)]; }
