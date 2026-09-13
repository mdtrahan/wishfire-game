#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { computeCombatPower } from '../web-runner/src/core/combatPower.mjs';
import { calculateDamageFromJs } from '../src/core/calculateDamageRules.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'output','balance');
const levels=[1,2,3,4,5,6,7,8,9,91,92,93,94,95,96,97,98,99];
const archetypes=[
 {id:'routine',tier:'routine',HP:45,ATK:3,DEF:4,MAG:3,RES:4,SPD:7},
 {id:'hard',tier:'hard',HP:62,ATK:4,DEF:5,MAG:4,RES:5,SPD:8},
 {id:'elite',tier:'elite',HP:85,ATK:5,DEF:7,MAG:5,RES:7,SPD:9},
 {id:'boss',tier:'boss',HP:130,ATK:6,DEF:9,MAG:6,RES:9,SPD:10},
];
const n=v=>Number.isFinite(Number(v))?Number(v):0;
function stats(def,level){return Object.fromEntries(Object.entries(def.baseStats).map(([key,base])=>[key,Math.max(1,Math.floor(n(base)+n(def.growth[key])*(level-1)))]));}
function enemy(base,level){const scale=1+(level-1)*.12;return Object.fromEntries(Object.entries(base).map(([key,value])=>[key,key==='id'||key==='tier'?value:Math.max(1,Math.floor(n(value)*scale))]));}
function damage(attacker,defender,magic=false,crit=false){return calculateDamageFromJs({power:magic?n(attacker.MAG):n(attacker.ATK),resist:magic?n(defender.RES):n(defender.DEF),roll01:.5,critRoll01:crit?.005:.5}).damage;}
function row(id,kind,role,level,baseStats,kit={}){const cp=computeCombatPower({stats:baseStats,currentLevel:level,kit});return {id,kind,role,level,stats:baseStats,baseCP:cp,currentCP:cp};}
const rows=[];
for(const level of levels){for(const def of Object.values(HERO_DEFINITIONS)){const s=stats(def,level);rows.push(row(def.name,'hero',def.role,level,s,{afValue:2,control:def.role==='Controller'?2:0,sustain:def.role==='Support'?2:0}));}for(const base of archetypes){const s=enemy(base,level);rows.push(row(`${base.id}-${level}`,'enemy',base.tier,level,s));}}
rows.sort((a,b)=>a.baseCP-b.baseCP||a.id.localeCompare(b.id));
const checks=[];
for(const level of levels){const heroes=rows.filter(r=>r.kind==='hero'&&r.level===level);const enemies=rows.filter(r=>r.kind==='enemy'&&r.level===level);for(const hero of heroes){for(const foe of enemies){for(const magic of [false,true]){checks.push({level,hero:hero.id,enemy:foe.id,kind:magic?'magic':'physical',heroDamage:damage(hero.stats,foe.stats,magic),enemyDamage:damage(foe.stats,hero.stats,magic),heroHP:hero.stats.HP,enemyHP:foe.stats.HP});}}}}
const failures=[];
for(const check of checks){if(check.level===1&&check.heroDamage>9)failures.push(`L1 player damage ${check.hero}/${check.kind}=${check.heroDamage}`);if(check.level===1&&check.enemy.includes('routine')&&check.enemyDamage>Math.ceil(check.heroHP*.05))failures.push(`routine burst ${check.enemy}->${check.hero}=${check.enemyDamage}`);}
for(const id of Object.keys(HERO_DEFINITIONS)){const series=rows.filter(row=>row.kind==='hero'&&row.id===HERO_DEFINITIONS[id].name).sort((a,b)=>a.level-b.level);for(let i=1;i<series.length;i++)if(series[i].baseCP<series[i-1].baseCP)failures.push(`CP inversion ${series[i].id} ${series[i-1].level}-${series[i].level}`);}
const report={levels,rows,checks,failures,pass:failures.length===0,generatedAt:new Date().toISOString()};
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'cp-report.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(out,'cp-report.csv'),'id,kind,role,level,baseCP,currentCP\n'+rows.map(r=>[r.id,r.kind,r.role,r.level,r.baseCP,r.currentCP].join(',')).join('\n')+'\n');
fs.writeFileSync(path.join(out,'scaling-drift.json'),JSON.stringify({levels,checks,failures},null,2)+'\n');
fs.writeFileSync(path.join(out,'scaling-drift.md'),`# CP scaling drift\n\n${failures.length?'FAIL\n'+failures.map(v=>`- ${v}`).join('\n'):'PASS'}\n`);
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(`PASS ${rows.length} CP rows, ${checks.length} bidirectional checks`);
