import test from 'node:test';
import assert from 'node:assert/strict';
import { settleDefeat } from '../web-runner/modules/heroCommands.mjs';
import { applyLevelUpBuffCard, createSessionLevelBuffState } from '../src/core/sessionLevelBuffOffers.mjs';
import { SESSION_LEVEL_UP_BUFF_CARDS } from '../src/core/sessionLevelBuffCatalog.mjs';
import { ASTRAL_FLOW_PARTY_SPECIALS } from '../src/core/astralFlowSpecialOffers.mjs';

const dawn = SESSION_LEVEL_UP_BUFF_CARDS.find(card => card.cardId === 'dawn_chorus_4');
function stateWithDawn() { let state=createSessionLevelBuffState(); for (const card of SESSION_LEVEL_UP_BUFF_CARDS.filter(card=>card.effectId==='dawn_chorus').sort((a,b)=>a.stage-b.stage)) state=applyLevelUpBuffCard({state,heroId:'fara',cardId:card.cardId,cards:SESSION_LEVEL_UP_BUFF_CARDS}).state; return state; }
test('Dawn Chorus attempts once, uses strict threshold, and revives every deployed hero at its rank amount', () => {
 const heroes=[{uid:1,kind:'hero',heroInstanceKey:'fara',hp:0,maxHP:100},{uid:2,kind:'hero',heroInstanceKey:'hondo',hp:0,maxHP:80}];
 const calls=[];const globals={SessionLevelBuffState:stateWithDawn(),RuntimeRandom:()=>.049,DamageTexts:[],ProgressionBattle:{}};
 const ctx={state:{globals,entities:heroes},callFunction(name,...args){calls.push([name,...args]);if(name==='SpawnDamageText')globals.DamageTexts.push({amount:args[0],kind:args[3],targetKind:args[4]});}};
 assert.equal(settleDefeat(ctx),false);assert.deepEqual(heroes.map(h=>h.hp),[30,24]);assert.equal(globals.DawnChorusAttempted,1);assert.equal(globals.DawnChorusSucceeded,1);assert.equal(globals.DamageTexts.length,2);assert.ok(calls.some(([name,text])=>name==='LogCombat'&&text==='Dawn Chorus revives the party.'));
 assert.equal(settleDefeat(ctx),true,'a completed attempt cannot recur');
});
test('Dawn Chorus fails when roll equals chance', () => {
 const hero={uid:1,kind:'hero',heroInstanceKey:'fara',hp:0,maxHP:100};const globals={SessionLevelBuffState:stateWithDawn(),RuntimeRandom:()=>.05};
 const ctx={state:{globals,entities:[hero]},callFunction(){}};assert.equal(settleDefeat(ctx),true);assert.equal(hero.hp,0);assert.equal(globals.DawnChorusSucceeded,undefined);
});
test('Chain Strike II copy matches its 396-percent AF payload', () => {
 const card=ASTRAL_FLOW_PARTY_SPECIALS.find(card=>card.specialId==='chain_strike_ii');assert.match(card.description,/396% ATK damage/);
});
