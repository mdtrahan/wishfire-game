import { validateSkillCondition } from '../../../src/core/skillConditionRules.mjs';
// Canonical hero identities and approved real-time combat kits.
export const PROGRESSION = Object.freeze({ maxLevel: 100, expBase: 100, expExponent: 1.5, enemyEXP: 25, enemyGold: 10 });
export const COMBAT_TUNING = Object.freeze({ criticalHP: 0.25, blindPenalty: 0.35, accuracy: 1, evasion: 0, counterPotency: 1 });

// Retained only while story and QA callers migrate off the retired FLOW path.
export const FLOW_ORB_TUNING = Object.freeze({ flowMax: 100, limitOrbValue: 10, limitOrbDropCount: 1, releaseSeconds: .72, flightSeconds: .52, collectFlashSeconds: .18 });
export const FLOW_MODES = Object.freeze({ Stoic: 'Take hostile HP damage.', Warrior: 'Deal positive enemy HP damage.', Tactician: 'Deal magic damage or apply a new eligible status.', Comrade: 'Another living ally takes hostile HP damage.' });

// Explicit per-skill milestones are independent of display names and array order.
export const ACTIVE_UNLOCK_LEVELS = Object.freeze([1, 5, 10, 15, 25, 35, 50, 60, 75]);
export const heroSkillUnlocked = (hero, skill) => Number(hero?.currentLevel || 1) >= Number(skill?.unlockLevel || 1);
const leaf = (key, args = {}) => ({key,...args});
const all = (...nodes) => ({all:nodes});
const any = (...nodes) => ({any:nodes});
const count = (value, group = 'attackableEnemies', filter) => leaf('actors.count',{group,operator:'gte',value,...(filter?{filter}:{})});
const hp = (subject,value,operator='lt') => leaf('actor.hp_ratio',{subject,operator,value});
const lacks = (id,subject='candidate') => ({not:leaf('actor.effect_active',{subject,effectId:id})});
const rank = (...values) => leaf('actor.trait',{subject:'candidate',field:'combatRank',in:values});
const boss = count(1,'attackableEnemies',rank('boss'));
const useful = id => leaf('modifier.can_improve',{subject:'candidate',effectId:id});
const shapeCount = (shape,value) => leaf('geometry.count',{shape,operator:'gte',value});
const basic = magic => Object.freeze({skillId:'basic_attack',displayName:'Attack',targetType:'enemy',tags:[magic?'magic':'physical'],effects:[{effectType:'damage',potency:1,hits:1}],description:'Attack the first living enemy in range.'});
const conditionLabels = {
 "challenge_bolt": "Unprovoked foe in range",
 "iron_resolve": "Self HP below 45%; a foe in range",
 "brace": "Self HP below 60%; no Brace; a foe in range",
 "retaliation_burst": "An enemy hit damages self; both survive in range",
 "shield_slam": "Boss or two-foe cluster in range",
 "crimson_ward": "Any ally HP below 70%; ward empty; a foe in range",
 "destiny": "Wounded ally below 70% without Destiny; a foe in range",
 "cover": "Any ally HP below 35%; a foe in range",
 "ambush": "Foe HP at least 75%",
 "cheap_shot": "Highest-base-ATK foe in range",
 "razor_sweep": "Two foes in one rectangle",
 "piercing_throw": "A foe in the horizontal path",
 "finish_the_job": "Foe HP below 35%",
 "split": "At least two foes in range",
 "arcane_pulse": "A foe in the forward cone",
 "overrun": "Boss below 50% HP or two-foe cluster",
 "frost_reversal": "Boss or two-foe cluster in range",
 "hex_beacon": "A foe can receive a new RES reduction",
 "burn_sigil": "Boss or two-foe cluster; no active Burn Sigil",
 "null_field": "Magic threat without Null Field in range",
 "return_gate": "Non-boss can move at least 40 units right",
 "faze": "Two foes or boss; at least one qualifying foe lacks Blight",
 "chain_strike": "Basic hit deals HP damage; two other foes in range",
 "cataclysm": "Boss or at least three foes in range",
 "wishgrant": "A foe in range; two living heroes or boss; useful unbuffed ally",
 "quickload": "A foe in range; ally without Quickload can attack faster",
 "shared_tempo": "Two foes in range; ally can gain Tempo",
 "patchwork": "Any living ally HP below 75%; a foe in range",
 "fortunes_blessing": "Boss or three foes; ally can gain the chosen stat buff",
 "magic_fruit": "Living ally HP below 40%; unused this battle; a foe in range",
 "grow": "Boss; all living allies above 80% HP; below stage 3",
 "shrink": "Ordinary foe DEF at least highest living-party DEF; lacks Shrink; reduction can improve",
 "sanctuary": "Two allies below 40% HP or any ally KO; a foe in range"
};
const active = (skillId,displayName,cooldownSeconds,unlockLevel,conditions,targetRule,effectSpec,description,extra={}) => Object.freeze({
 skillId,displayName,cooldownSeconds,unlockLevel,conditions,targetRule,effectSpec,description,conditionLabel:conditionLabels[skillId],
 targetType:targetRule.kind,durationSeconds:extra.durationSeconds||0,trigger:'poll',recipientPolicy:'all',...extra,
});
const enemy = (order='first') => ({kind:'enemy',order});
const party = () => ({kind:'party'});
const self = () => ({kind:'self'});
const area = (radius,min=2) => ({kind:'bestArea',shape:{kind:'circle',radius},minimum:min,bossFirst:true});
const cluster = radius => any(boss,shapeCount({kind:'circle',radius},2));
const kit = (key,name,role,baseStats,growth,actives,magic=false) => Object.freeze({key,name,role,baseStats,growth,maxLevel:PROGRESSION.maxLevel,basic:basic(magic),actives:Object.freeze(actives)});
export const HERO_DEFINITIONS = Object.freeze({
 Falie:kit('Falie','Fara','Tank',{HP:75,ATK:7,DEF:12,MAG:4,RES:8,SPD:8},{HP:8,ATK:.8,DEF:1.8,MAG:.4,RES:1.1,SPD:.15},[
  active('challenge_bolt','Challenge Bolt',7,1,lacks('provoke'),enemy(),{kind:'damageProvoke',damagePct:80},'Hit an unprovoked enemy for 80% physical damage and redirect its single-target attacks for 4 seconds.',{durationSeconds:4,damagePct:80,recipientPolicy:'skip_active'}),
  active('iron_resolve','Iron Resolve',12,5,all(count(1),hp('self',.45)),self(),{kind:'heal',healPctMaxHP:12},'Below 45% HP, restore 12% of own max HP.'),
  active('brace','Brace',15,10,all(count(1),hp('self',.6),lacks('brace','self')),self(),{kind:'brace'},'Below 60% HP, halve the next two hostile hits within 5 seconds.',{durationSeconds:5,charges:2,damageCutPct:50,recipientPolicy:'skip_active'}),
  active('retaliation_burst','Retaliation Burst',19,15,leaf('event.matches',{source:'enemy',recipient:'self',minHpDamage:Number.MIN_VALUE}),{kind:'eventArea',shape:{kind:'circle',radius:75}},{kind:'damage',damagePct:80},'When an enemy damages Fara, hit it and enemies within radius 75 for 80% physical damage.',{trigger:'enemy_hp_damage',damagePct:80,radius:75}),
  active('shield_slam','Shield Slam',23,25,cluster(65),area(65),{kind:'damagePush',damagePct:100},'Hit a cluster or boss for 100% physical damage and push movable foes up to 55 units.',{damagePct:100,radius:65,pushDistance:55}),
  active('crimson_ward','Crimson Ward',50,35,all(count(1),count(1,'livingHeroes',hp('candidate',.7)),leaf('battle.resource',{name:'wardHP',operator:'eq',value:0})),party(),{kind:'ward'},'Create a shared ward worth 18% of living-party max HP when an ally is below 70% HP.'),
  active('destiny','Destiny',80,50,all(count(1),count(1,'livingHeroes',all(hp('candidate',.7),lacks('destiny')))),party(),{kind:'regen',healPctMaxHP:8,intervalSeconds:2,ticks:3},'When an ally is below 70% HP, heal eligible living heroes for 8% max HP every 2 seconds for 6 seconds.',{durationSeconds:6,recipientPolicy:'skip_active'}),
  active('cover','Cover: Awakening',40,75,all(count(1),count(1,'livingHeroes',hp('candidate',.35))),party(),{kind:'cover'},'For 6 seconds, take allies’ eligible single-target hits and reduce all damage received by 40%.',{durationSeconds:6,damageCutPct:40,recipientPolicy:'refresh'}),
 ]),
 Huun:kit('Huun','Hondo','Damage',{HP:60,ATK:16,DEF:5,MAG:3,RES:4,SPD:12},{HP:6,ATK:2.1,DEF:.7,MAG:.3,RES:.6,SPD:.35},[
  active('ambush','Ambush',7,1,hp('candidate',.75,'gte'),enemy(),{kind:'damage',damagePct:160},'Hit a foe at 75% HP or higher for 160% physical damage.',{damagePct:160}),
  active('cheap_shot','Cheap Shot',9,5,count(1),enemy('highestBaseATK'),{kind:'damageDelay',damagePct:150},'Hit the highest-base-ATK foe for 150% damage and delay its next attack by 1 second.',{damagePct:150,attackDelaySeconds:1}),
  active('razor_sweep','Razor Sweep',11,10,shapeCount({kind:'rectangle',width:80,height:110},2),{kind:'bestArea',shape:{kind:'rectangle',width:80,height:110},minimum:2},{kind:'damage',damagePct:70},'Hit the best two-foe rectangle for 70% physical damage.',{damagePct:70,width:80,height:110}),
  active('piercing_throw','Piercing Throw',14,15,shapeCount({kind:'horizontalLine',width:28,toX:290},1),{kind:'horizontalLine',shape:{kind:'horizontalLine',width:28,toX:290}},{kind:'damage',damagePct:130},'Throw horizontally right through a 28-wide path for 130% physical damage.',{damagePct:130,lineWidth:28}),
  active('finish_the_job','Finish the Job',17,25,hp('candidate',.35),enemy('lowestHP'),{kind:'finisher',damagePct:220},'Hit a foe below 35% HP for 220% damage; a kill splashes 80% within radius 50.',{damagePct:220,threshold:.35,splashPct:80,splashRadius:50}),
  active('split','Split',22,35,count(2),{kind:'allEnemies'},{kind:'split',damagePct:100},'Divide one 100% physical damage budget across all attackable foes.'),
  active('arcane_pulse','Arcane Pulse',27,50,shapeCount({kind:'cone',length:120,angleDegrees:60},1),{kind:'cone',shape:{kind:'cone',length:120,angleDegrees:60}},{kind:'damage',damagePct:130},'Sweep a 120-unit, 60-degree cone for 130% physical damage.',{damagePct:130}),
  active('overrun','Overrun: Awakening',36,75,any(all(rank('boss'),hp('candidate',.5)),shapeCount({kind:'circle',radius:90},2)),{...area(90),bossHP:.5},{kind:'damage',damagePct:260},'Hit a wounded boss or two-foe cluster for 260% physical damage.',{damagePct:260,radius:90}),
 ]),
 Runa:kit('Runa','Runa','Mage',{HP:60,ATK:3,DEF:4,MAG:16,RES:10,SPD:11},{HP:5,ATK:.3,DEF:.7,MAG:2.1,RES:1.4,SPD:.3},[
  active('frost_reversal','Frost Reversal',9,1,cluster(75),area(75),{kind:'damageRetreat',damagePct:80},'Hit a cluster or boss for 80% magic damage and retreat movable foes for 1.25 seconds.',{damagePct:80,radius:75,durationSeconds:1.25}),
  active('hex_beacon','Hex Beacon',12,5,count(1),{kind:'firstArea',shape:{kind:'circle',radius:110}},{kind:'modifier',effectId:'hex_beacon'},'Lower RES by 25% for 6 seconds on eligible foes around the first enemy.',{radius:110,durationSeconds:6,recipientPolicy:'skip_active'}),
  active('burn_sigil','Burn Sigil',18,10,all({not:leaf('zone.active',{effectId:'burn_sigil'})},cluster(90)),area(90),{kind:'zone',damagePct:25},'Place one fixed circle dealing 25% magic damage each second for 6 seconds.',{radius:90,damagePctPerSecond:25,durationSeconds:6}),
  active('null_field','Null Field',22,15,all(leaf('actor.trait',{subject:'candidate',field:'magicThreat',in:[true]}),lacks('null_field')),{kind:'firstArea',shape:{kind:'circle',radius:90},anchorFilter:'magicThreat'},{kind:'null'},'Block new standard magic actions for 3 seconds on eligible enemies near a magic threat.',{radius:90,durationSeconds:3,recipientPolicy:'skip_active'}),
  active('return_gate','Return Gate',27,25,all({not:rank('boss')},leaf('target.displacement_room',{subject:'candidate',maxDistance:100,operator:'gte',value:40})),enemy('furthestAdvanced'),{kind:'teleport'},'Teleport a non-boss up to 100 units right when at least 40 units are available.',{teleportDistance:100,minUsefulDistance:40}),
  active('faze','Faze',34,35,any(all(count(2),count(1,'attackableEnemies',lacks('blight'))),count(1,'attackableEnemies',all(rank('boss'),lacks('blight')))),{kind:'allEnemies'},{kind:'blight',rawDamage:1,intervalSeconds:1,ticks:3},'Apply or refresh three 1-damage Blight ticks over 3 seconds on all attackable foes.',{durationSeconds:3,recipientPolicy:'refresh'}),
  active('chain_strike','Chain Strike',56,50,leaf('event.matches',{source:'self',actionKind:'basic',isPrimary:true,minHpDamage:Number.MIN_VALUE}),{kind:'eventChain',minimum:2},{kind:'chain',bouncePct:66},'After a damaging basic, bounce magic to two other foes for 66% of its raw damage.',{trigger:'primary_basic_hp_damage'}),
  active('cataclysm','Cataclysm: Awakening',45,75,any(boss,count(3)),{kind:'allEnemies'},{kind:'damageRetreat',damagePct:200},'Hit all attackable foes for 200% magic damage and retreat movable non-bosses for 2 seconds.',{damagePct:200,durationSeconds:2}),
 ],true),
 Kojonn:kit('Kojonn','Kaja','Support',{HP:65,ATK:4,DEF:7,MAG:9,RES:12,SPD:10},{HP:7,ATK:.4,DEF:1.1,MAG:1.4,RES:1.7,SPD:.25},[
  active('wishgrant','Wishgrant',33,1,all(count(1),any(count(2,'livingHeroes'),boss)),party(),{kind:'modifier',effectId:'wishgrant'},'Raise eligible allies’ ATK and MAG by 35% for 6 seconds.',{durationSeconds:6,recipientPolicy:'skip_active'}),
  active('quickload','Quickload',22,5,all(count(1),lacks('quickload')),{kind:'slowestAlly'},{kind:'quickload'},'Set the slowest eligible ally’s basic interval to 0.4 seconds for 4 seconds.',{durationSeconds:4,recipientPolicy:'skip_active'}),
  active('shared_tempo','Shared Tempo',27,10,count(2),party(),{kind:'tempo'},'Reduce eligible allies’ basic intervals by 25% for 6 seconds.',{durationSeconds:6,recipientPolicy:'skip_active'}),
  active('patchwork','Patchwork',18,15,all(count(1),count(1,'livingHeroes',hp('candidate',.75))),party(),{kind:'heal',healPctMaxHP:8},'Immediately heal living allies for 8% of their max HP.'),
  active('fortunes_blessing','Fortune’s Blessing',40,25,any(boss,count(3)),party(),{kind:'modifier',effectId:'fortunes_blessing'},'Raise one shared seeded ATK/DEF/MAG/RES choice by 25% for 5 seconds.',{durationSeconds:5,recipientPolicy:'skip_active',randomStats:['ATK','DEF','MAG','RES']}),
  active('magic_fruit','Magic Fruit',100,35,all(count(1),hp('candidate',.4),leaf('battle.flag',{name:'magicFruitUsed',operator:'eq',value:0})),{kind:'lowestHPAlly'},{kind:'fruit'},'Once per attempt, raise living-party max HP by 15% and heal the wounded recipient for 32%.'),
  active('grow','Grow',125,50,all(boss,{not:count(1,'livingHeroes',{not:hp('candidate',.8,'gt')})},leaf('battle.flag',{name:'growTier',operator:'lt',value:3})),party(),{kind:'grow'},'Increase party damage and decrease max HP by the next 8/14/20% Grow stage.'),
  active('shrink','Shrink',50,60,all(rank('ordinary'),leaf('actor.stat_compare',{subject:'candidate',stat:'DEF',operator:'gte',referenceGroup:'livingHeroes',aggregate:'max'}),lacks('shrink'),useful('shrink')),enemy('highestDEF'),{kind:'modifier',effectId:'shrink'},'Shrink one ordinary foe to 70% size and lower ATK and DEF by 35% for 6 seconds.',{durationSeconds:6,recipientPolicy:'skip_active'}),
  active('sanctuary','Sanctuary: Awakening',65,75,all(count(1),any(count(2,'livingHeroes',hp('candidate',.4)),count(1,'deployedHeroes',leaf('actor.trait',{subject:'candidate',field:'lifeState',in:['ko']})))),party(),{kind:'sanctuary'},'Heal living allies for 20% max HP and revive the first KO ally at 30% max HP.'),
 ],true),
});

const targetKinds=new Set(['enemy','self','party','bestArea','firstArea','lowestHPAlly','slowestAlly','horizontalLine','cone','allEnemies','eventArea','eventChain']);
const effectKinds=new Set(['damage','damagePush','damageRetreat','damageDelay','damageProvoke','finisher','split','chain','heal','sanctuary','ward','fruit','grow','brace','cover','modifier','quickload','tempo','null','regen','blight','zone','teleport']);
for (const definition of Object.values(HERO_DEFINITIONS)) for (const skill of definition.actives) {
  validateSkillCondition(skill.conditions);
  if(!skill.conditionLabel)throw new Error(`Missing readable condition for ${skill.skillId}`);
  if(!targetKinds.has(skill.targetRule.kind) || !effectKinds.has(skill.effectSpec.kind))throw new Error('Unknown skill target or effect');
  if(!['poll','enemy_hp_damage','primary_basic_hp_damage'].includes(skill.trigger) || !['all','skip_active','refresh'].includes(skill.recipientPolicy))throw new Error('Unknown skill trigger or recipient policy');
}

export function heroKey(hero) {
  const name = typeof hero === 'string' ? hero : hero?.baseHeroName || hero?.name;
  return ({ Fara: 'Falie', Hondo: 'Huun', Kaja: 'Kojonn' })[name] || name;
}
export function heroDefinition(hero) { return HERO_DEFINITIONS[heroKey(hero)]; }
