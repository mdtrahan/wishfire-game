const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

async function rules(){return import(pathToFileURL(path.join(__dirname,'..','src','core','dynamicInitiativeRules.mjs')));}
async function flow(){return import(pathToFileURL(path.join(__dirname,'..','web-runner','src','core','personalFlow.mjs')));}

test('hero-only two-times Speed grants one linked extra action',async()=>{
 const {resolveHeroSpeedMultiattack}=await rules();
 const enemies=[{uid:9,kind:'enemy',hp:1,spd:10}];
 assert.equal(resolveHeroSpeedMultiattack({hero:{uid:1,kind:'hero',hp:1,spd:20},enemies}),true);
 assert.equal(resolveHeroSpeedMultiattack({hero:{uid:1,kind:'hero',hp:1,spd:20},enemies,alreadyLinked:true}),false);
 assert.equal(resolveHeroSpeedMultiattack({hero:{uid:9,kind:'enemy',hp:1,spd:40},enemies}),false);
});

test('role AF awards once from aggregate qualifying action facts',async()=>{
 const {resolveRoleFlowAward}=await flow();
 const fara={uid:1,hp:20,flow:0,flowMode:'Stoic'};
 assert.equal(resolveRoleFlowAward({heroes:[fara],hero:fara,event:{hostileHpDamage:3,hostileTargetUID:1}}).value,10);
 assert.equal(resolveRoleFlowAward({heroes:[fara],hero:fara,event:{hostileHpDamage:3,hostileTargetUID:1,periodic:true}}),null);
 const hondo={uid:2,hp:20,flow:0,flowMode:'Warrior'};
 assert.equal(resolveRoleFlowAward({heroes:[hondo],hero:hondo,event:{enemyHpDamage:4}}).value,10);
 const runa={uid:3,hp:20,flow:0,flowMode:'Tactician'};
 assert.equal(resolveRoleFlowAward({heroes:[runa],hero:runa,event:{newEligibleStatus:true}}).value,10);
 const kaja={uid:4,hp:20,flow:0,flowMode:'Comrade'},ally={uid:5,hp:20};
 assert.equal(resolveRoleFlowAward({heroes:[kaja,ally],hero:kaja,event:{hostileHpDamage:3,hostileTargetUID:5}}).value,10);
});
