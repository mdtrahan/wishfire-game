import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCompactCount} from '../web-runner/src/core/formatCompactCount.mjs';
import {createLampEconomy,upgradeLamp} from '../web-runner/src/core/lampGear.mjs';
import {renderBagUpgrade} from '../web-runner/systems/bagUpgradePresentation.mjs';

test('compact counts preserve exact small counts and floor every K, M and B boundary',()=>{
 for(const[value,text]of [[0,'0'],[100,'100'],[1525,'1,525'],[9999,'9,999'],[10000,'10K'],[12345,'12.3K'],[999950,'999.9K'],[999999,'999.9K'],[1000000,'1M'],[1400000,'1.4M'],[4770375,'4.7M'],[4770374,'4.7M'],[9999999,'9.9M'],[999999999,'999.9M'],[1000000000,'1B'],[1400000000,'1.4B']])assert.equal(formatCompactCount(value),text,String(value));
});

test('invalid or negative compact counts render zero and fractional counts round down',()=>{
 for(const value of [-0,-1,-.1,NaN,Infinity,-Infinity,undefined,null,'12345',{},[]])assert.equal(formatCompactCount(value),'0');
 assert.equal(formatCompactCount(9999.99),'9,999');assert.equal(formatCompactCount(12399.99),'12.3K');
});

test('compact Bag labels keep exact readiness and full accessibility values near a late requirement',()=>{
 const data=createLampEconomy(42);data.lamp.capacityTier=98;data.lamp.killPoints=4770374;
 const html=renderBagUpgrade(data);
 assert.ok(html.includes('(4.7M/4.7M)'));assert.ok(html.includes('aria-valuenow="4770374"'));assert.ok(html.includes('aria-valuemax="4770375"'));assert.ok(html.includes('title="4,770,374 / 4,770,375"'));assert.match(html,/data-tier="98" disabled/);
 assert.throws(()=>upgradeLamp(data,98),/Need 1 more Bag progress/);
 data.lamp.killPoints=0;assert.throws(()=>upgradeLamp(data,98),/Need 4\.7M more Bag progress/);
});
