const test=require('node:test'),assert=require('node:assert/strict');
const modules=Promise.all([import('../web-runner/src/core/astralMarket.mjs'),import('../web-runner/src/core/equipment.mjs'),import('../web-runner/systems/equipmentStorage.mjs'),import('../web-runner/src/core/heroProgression.mjs')]);
test('four staggered tracks reconstruct deterministically across absence and expire without spending',async()=>{
 const [m]=await modules;const market=m.createMarket(42,100000);const items=[];
 const before=m.marketOffers(market,100000,items);assert.equal(new Set(before.map(o=>o.track)).size,4);assert.ok(new Set(before.map(o=>o.spawnedAt)).size>4);
 assert.deepEqual(m.marketOffers(market,100000,items),before);assert.ok(before.every(o=>o.progress>=0&&o.progress<1));
 const later=m.marketOffers(market,200000,items);assert.ok(later.every(o=>!before.some(b=>b.id===o.id)));assert.equal(items.length,0);
 const year=m.marketOffers(market,100000+365*86400000,items);assert.ok(year.length<20);
});
test('purchases validate live offers, Gold and unique ownership at commit',async()=>{
 const [m]=await modules;const e={market:m.createMarket(5,100000),gold:1500,items:[],loadouts:{}};const offer=m.marketOffers(e.market,100000)[0];
 const paid=m.purchaseOffer(e,offer.id,100000);assert.equal(e.gold,1500-paid.price);assert.equal(e.items[0].equipmentId,offer.equipmentId);assert.throws(()=>m.purchaseOffer(e,offer.id,100000));
 const another=m.marketOffers(e.market,100000,e.items)[0];e.gold=0;assert.throws(()=>m.purchaseOffer(e,another.id,100000),/Gold/);e.gold=1500;assert.throws(()=>m.purchaseOffer(e,another.id,200000),/passed/);
});
test('equipment is unique across heroes and affects canonical stats without compounding',async()=>{
 const [,e,,h]=await modules;const inventory={items:[{instanceId:'sword',equipmentId:'iron-sword'}],loadouts:{}};e.equipItem(inventory,'Falie','weapon','sword');const hero=h.newHeroProgress('Falie');const base=hero.stats.ATK;hero.equipmentStats=e.equipmentStats(inventory.items,inventory.loadouts.Falie);h.refreshHeroStats(hero);h.refreshHeroStats(hero);assert.equal(hero.stats.ATK,base+2);
 e.equipItem(inventory,'Huun','weapon','sword');assert.equal(inventory.loadouts.Falie.weapon,undefined);assert.throws(()=>e.equipItem(inventory,'Falie','head','sword'));
});
test('one durable transaction saves exact equipment and Gold; failures leave both unchanged',async()=>{
 const [m,,s,h]=await modules;const values=new Map();let fail=false;const storage={getItem:k=>values.get(k)??null,setItem(k,v){if(fail)throw Error('disk full');values.set(k,v);}};let chain=Promise.resolve();const locks={request:(k,fn)=>{const p=chain.then(fn);chain=p.catch(()=>{});return p;}};
 const globals={goldTotal:1500,HeroProgress:h.createHeroProgressStore()};const store=s.createEquipmentStorage({globals,storage,locks,seed:()=>3,now:()=>100000});await store.sync();const offer=m.marketOffers(store.data.market,100000)[0];
 fail=true;await assert.rejects(store.purchase(offer.id));assert.equal(globals.goldTotal,1500);assert.equal(store.data.items.length,0);fail=false;
 const results=await Promise.allSettled([store.purchase(offer.id),store.purchase(offer.id)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(store.data.items.length,1);
 const reloaded={goldTotal:0,HeroProgress:h.createHeroProgressStore()};const next=s.createEquipmentStorage({globals:reloaded,storage,locks,seed:()=>99,now:()=>200000});await next.sync();assert.equal(reloaded.goldTotal,1500-offer.price);assert.equal(next.data.items[0].equipmentId,offer.equipmentId);assert.equal(next.data.market.seed,3);
});
test('saved loadouts apply on reload and battle attachment, with KO preserved',async()=>{
 const [,e,s,h]=await modules;const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},locks={request:async(k,fn)=>fn()};const globals={goldTotal:0,HeroProgress:h.createHeroProgressStore()};
 const record={version:1,gold:0,market:{seed:1,epoch:0,lastSeen:0},items:[{instanceId:'ring',equipmentId:'copper-ring'}],loadouts:{Falie:{accessory1:'ring'}}};storage.setItem('wishfire.equipment-economy.v1',JSON.stringify(record));globals.HeroProgress.heroes.Falie.hp=0;
 const store=s.createEquipmentStorage({globals,storage,locks,now:()=>100});await store.sync();const saved=globals.HeroProgress.heroes.Falie;assert.equal(saved.hp,0);const actor={name:'Falie',baseHeroName:'Falie'};h.attachHeroProgress(actor,globals.HeroProgress);assert.equal(actor.maxHP,saved.maxHP);assert.equal(actor.hp,0);
 actor.hp=actor.maxHP;h.saveHeroProgress(actor,globals.HeroProgress);const reloaded=h.createHeroProgressStore(JSON.parse(JSON.stringify(globals.HeroProgress)));assert.equal(reloaded.heroes.Falie.hp,actor.maxHP);
});
test('native victory awards configured enemy Gold once and keeps EXP settlement',async()=>{
 const [,,,h]=await modules;const {rulesContext,settleVictory}=await import('../web-runner/modules/heroCommands.mjs');const hero=h.newHeroProgress('Falie');hero.kind='hero';hero.uid=100;
 const g={goldTotal:5,HeroProgress:h.createHeroProgressStore(),ProgressionBattle:{id:'gold-test',participants:['Falie'],defeated:{}},NativeBattleEnded:true};
 const ctx={state:{globals:g,entities:[hero]},callFunction:()=>{}};const rules=rulesContext(ctx);rules.onKO({kind:'enemy',uid:1,expValue:10,goldValue:17});rules.onKO({kind:'enemy',uid:2,expValue:20});
 settleVictory(ctx);settleVictory(ctx);assert.equal(g.goldTotal,32);assert.equal(hero.currentEXP,30);assert.equal(g.ProgressionBattle.goldReward,27);
});

test('upgrade hints require a strict improvement without stat tradeoffs',async()=>{
 const {isEquipmentUpgrade,EQUIPMENT}=await import('../web-runner/src/core/equipment.mjs');
 assert.equal(isEquipmentUpgrade(EQUIPMENT['ember-blade'],EQUIPMENT['iron-sword']),true);
 assert.equal(isEquipmentUpgrade(EQUIPMENT['moon-staff'],EQUIPMENT['iron-sword']),false);
 assert.equal(isEquipmentUpgrade(EQUIPMENT['iron-sword'],EQUIPMENT['iron-sword']),false);
 assert.equal(isEquipmentUpgrade(EQUIPMENT['iron-sword'],undefined),true);
 assert.equal(isEquipmentUpgrade(EQUIPMENT['iron-sword'],EQUIPMENT['linen-hood']),false);
});
