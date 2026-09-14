const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');

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
 const fara={uid:1,name:'Falie',baseHeroName:'Falie',hp:20,flow:0,flowMode:'Stoic'};
 assert.equal(resolveRoleFlowAward({heroes:[fara],hero:fara,event:{hostileHpDamage:3,hostileTargetUID:1}}).value,10);
 assert.equal(resolveRoleFlowAward({heroes:[fara],hero:fara,event:{hostileHpDamage:3,hostileTargetUID:1,periodic:true}}),null);
 const hondo={uid:2,name:'Huun',baseHeroName:'Huun',hp:20,flow:0,flowMode:'Warrior'};
 assert.equal(resolveRoleFlowAward({heroes:[hondo],hero:hondo,event:{enemyHpDamage:4}}).value,10);
 const runa={uid:3,name:'Runa',baseHeroName:'Runa',hp:20,flow:0,flowMode:'Tactician'};
 assert.equal(resolveRoleFlowAward({heroes:[runa],hero:runa,event:{newEligibleStatus:true}}).value,10);
 const kaja={uid:4,name:'Kojonn',baseHeroName:'Kojonn',hp:20,flow:0,flowMode:'Comrade'},ally={uid:5,hp:20};
 assert.equal(resolveRoleFlowAward({heroes:[kaja,ally],hero:kaja,event:{hostileHpDamage:3,hostileTargetUID:5}}).value,10);
});

test('CP balance report runs seeded combat through canonical rules',()=>{
 const root=path.join(__dirname,'..');
 execFileSync(process.execPath,['tools/cp_balance_report.mjs'],{cwd:root,stdio:'pipe'});
 const report=JSON.parse(fs.readFileSync(path.join(root,'output','balance','cp-report.json'),'utf8'));
 assert.equal(report.pass,true);
 assert.deepEqual(report.levels,[1,2,3,4,5,6,7,8,9,91,92,93,94,95,96,97,98,99]);
 assert.deepEqual(report.pairs,[[1,9],[9,1],[91,99],[99,91]]);
 assert.equal(report.seeds,256);
 assert.equal(report.simulations.length,18*4*2);
 assert.equal(report.speed.threshold.atTwoTimes,true);
 assert.equal(report.speed.threshold.belowTwoTimes,true);
 assert.equal(report.speed.linkedSecondActionCount,1);
 assert.equal(report.speed.nonRecursive,true);
 assert.equal(report.speed.latchReset,true);
 assert.equal(report.speed.nextOrdinaryTurnRelinks,true);
 assert.equal(report.speed.afAwardCount,2);
 assert.equal(report.speed.afTotal,20);
 assert.ok(report.simulations.every(row=>row.averageActions>0));
 assert.ok(report.simulations.every(row=>Object.values(row.enemyBurstByHero).every(Number.isFinite)));
 assert.ok(report.damageMatrix.some(row=>row.surface==='cross_level'&&row.heroLevel===91&&row.enemyLevel===99&&row.path==='magic'));
});
