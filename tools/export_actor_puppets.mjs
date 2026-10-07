import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'web-runner/assets/puppets');
const vector = (x,y) => `<vector><x>${x}</x><y>${y}</y></vector>`;
const param = (name,value) => `<param name="${name}">${value}</param>`;
const guid = text => createHash('md5').update(text).digest('hex').toUpperCase();
const frames = values => `<animated type="angle">${values.map(([time,value])=>`<waypoint time="${time}s" before="linear" after="linear"><angle value="${value}"/></waypoint>`).join('')}</animated>`;
const curves={idle:[0,0,0,0,0],walk:[-18,18,-18,18,-18],attack:[0,-35,48,12,0],cast:[0,-40,-55,-40,0],hit:[0,14,-8,0,0],defeated:[0,20,65,80,80],spawn:[0,-8,5,0,0]};
const animatedVector = values => `<animated type="vector">${values.map(([time,x,y])=>`<waypoint time="${time}s" before="linear" after="linear">${vector(x,y)}</waypoint>`).join('')}</animated>`;
const duration={idle:1,walk:1,attack:.75,cast:1,hit:.5,defeated:1,spawn:.75};
const layout={
 head:{x:128,y:134,w:110,h:116,pivot:.86},hair_back:{x:120,y:66,w:93,h:132},coat_back:{x:126,y:150,w:103,h:101},
 torso:{x:128,y:124,w:98,h:87},pelvis:{x:128,y:174,w:89,h:70},
 upper_arm_far:{x:90,y:132,w:38,h:48},forearm_far:{x:89,y:163,w:25,h:43,parent:'upper_arm_far'},hand_far:{x:88,y:188,w:23,h:33,parent:'forearm_far'},
 upper_arm_near:{x:169,y:134,w:38,h:48},forearm_near:{x:172,y:165,w:25,h:43,parent:'upper_arm_near'},hand_near:{x:174,y:190,w:23,h:33,parent:'forearm_near'},
 thigh_far:{x:109,y:190,w:36,h:42},shin_boot_far:{x:110,y:214,w:35,h:41,parent:'thigh_far'},thigh_near:{x:148,y:190,w:36,h:42},shin_boot_near:{x:148,y:214,w:35,h:41,parent:'thigh_near'}
};
const manifest={version:1,sourceTool:'Synfig 1.5.5',fps:12,actors:{}};
for(const actor of ['fara','gobloc']) {
 const source=path.join(output,actor,'source'); const parts=JSON.parse(fs.readFileSync(path.join(source,'parts.json'),'utf8')).parts;
 for (const [name, part] of Object.entries(parts)) { const placement=layout[name]; if (placement) { part.pivot={x:part.crop.width/2,y:part.crop.height*(placement.pivot??.12)}; part.composition={...placement,parent:placement.parent||'body'}; } }
 fs.writeFileSync(path.join(source,'parts.json'),JSON.stringify({actor,atlas:actor==='fara'?'parts-right-v1.png':'parts-left-v1.png',facing:actor==='fara'?'right':'left',status:'neutral-reviewed-by-builder; independent-review-pending',parts},null,2)+'\n');
 const actorManifest={sourceFacing:actor==='fara'?'right':'left',oppositeFacing:'mirrored-source; asymmetric costume reverses sides',clips:{}};
 const names=Object.keys(parts).filter(name=>layout[name]);
 for(const state of Object.keys(curves))for(const facing of ['left','right']){
  const d=duration[state];const poseTimes=state==='attack'?[0,.25,.375,.5625,.75]:[0,d/4,d/2,d*3/4,d];const id=guid(`${actor}/${state}`);const rootId=guid(`${id}/root`);const bodyId=guid(`${id}/body`);
  const directional=['attack','cast','hit'].includes(state);
  const sign=actor==='fara'?1:-1, lead=actor==='fara'?'near':'far';
  const bones=names.map(name=>{const p=layout[name], parentName=p.parent||(directional&&name==='hair_back'?'head':null), parent=parentName?layout[parentName]:{x:128,y:144};const parentId=parentName?guid(`${id}/${parentName}`):bodyId;let curve=curves[state];
   let motion=[0,0,0,0,0];if(name.includes('upper_arm') && state!=='defeated') motion=curve.map(a=>a*(name.endsWith('far')?-1:1));if(name.startsWith('thigh')&&state==='walk')motion=curve.map(a=>a*(name.endsWith('far')?1:-1));if(name.startsWith('shin')&&state==='walk')motion=curve.map(a=>Math.abs(a)*.4);if(name==='head'&&state==='idle')motion=[0,2,0,-2,0];
   let dx=[0,0,0,0,0],dy=[0,0,0,0,0];
   if(directional){
    const isLead=name.endsWith(lead);
    if(state==='attack'){
     if(name.startsWith('upper_arm')) motion=(isLead?[0,-90,65,40,0]:[0,40,10,12,0]).map(a=>a*sign);
     if(name.startsWith('forearm')) motion=(isLead?[0,0,25,15,0]:[0,-85,-50,-25,0]).map(a=>a*sign);
     if(name.startsWith('upper_arm')){dx=[0,-sign*(isLead?48:10),0,0,0];dy=[0,-16,0,0,0];}
     if(name==='torso'){motion=[0,sign*18,-sign*8,-sign*3,0];dx=[0,-sign*10,sign*8,sign*4,0];dy=[0,-16,0,0,0];}
     if(name==='head'){motion=[0,sign*25,-sign*8,-sign*3,0];dx=[0,-sign*17,sign*12,sign*5,0];dy=[0,-25,0,0,0];}
    }
    if(state==='cast'){
     if(name.startsWith('upper_arm')) motion=(isLead?[0,-35,112,90,0]:[0,30,-110,-90,0]).map(a=>a*sign);
     if(name.startsWith('forearm')) motion=(isLead?[0,-90,-15,0,0]:[0,55,0,5,0]).map(a=>a*sign);
     if(name==='torso'){motion=[0,sign*8,-sign*6,-sign*3,0];dx=[0,-sign*3,sign*5,sign*2,0];dy=[0,-5,4,0,0];}
     if(name==='head'){motion=[0,sign*8,-sign*6,-sign*2,0];dx=[0,-sign*4,sign*7,sign*2,0];dy=[0,-5,4,0,0];}
    }
    if(state==='hit'){
     if(name.startsWith('upper_arm')) motion=(isLead?[0,-20,-30,-15,0]:[0,-80,-60,-20,0]).map(a=>a*sign);
     if(name.startsWith('forearm')) motion=(isLead?[0,-60,-50,-20,0]:[0,30,35,10,0]).map(a=>a*sign);
     if(name==='torso'){motion=[0,sign*12,sign*10,sign*4,0];dx=[0,-sign*8,-sign*10,-sign*4,0];dy=[0,0,0,0,0];}
     if(name==='head'){motion=[0,sign*25,sign*20,sign*8,0];dx=[0,-sign*14,-sign*20,-sign*8,0];dy=[0,2,0,0,0];}
    }
   }
   const origin=animatedVector(dx.map((x,i)=>[poseTimes[i],p.x-parent.x+x,parent.y-p.y+dy[i]]));
   return `<bone type="bone_object" guid="${guid(`${id}/${name}`)}"><name><string>${name}</string></name><parent><bone_valuenode type="bone_object" guid="${parentId}"/></parent><origin>${directional?origin:vector(p.x-parent.x,parent.y-p.y)}</origin><angle>${frames(motion.map((v,i)=>[poseTimes[i],v]))}</angle><scalelx><real value="1"/></scalelx><scalex><real value="1"/></scalex><width><real value=".1"/></width><tipwidth><real value=".1"/></tipwidth><bone_depth><real value="0"/></bone_depth><length><real value="1"/></length></bone>`;}).join('');
  const bodyAngle=state==='defeated'?curves[state]:[0,0,0,0,0];
  const boneBody=`<bone type="bone_object" guid="${bodyId}"><name><string>body</string></name><parent><bone_valuenode type="bone_object" guid="${rootId}"/></parent><origin>${state==='defeated'?`<animated type="vector">${[112,105,82,67,67].map((y,i)=>`<waypoint time="${d*i/4}s" before="linear" after="linear">${vector(128,y)}</waypoint>`).join('')}</animated>`:vector(128,112)}</origin><angle>${frames(bodyAngle.map((v,i)=>[d*i/4,v]))}</angle><scalelx><real value="1"/></scalelx><scalex><real value="1"/></scalex><width><real value=".1"/></width><tipwidth><real value=".1"/></tipwidth><bone_depth><real value="0"/></bone_depth><length><real value="1"/></length></bone>`;
  const order=['head','torso','pelvis','upper_arm_near','forearm_near','hand_near','shin_boot_near','thigh_near','upper_arm_far','forearm_far','hand_far','shin_boot_far','thigh_far','hair_back','coat_back'];
  if (directional) { for(const name of [`forearm_${lead}`,`hand_${lead}`])order.splice(order.indexOf(name),1);order.splice(1,0,`forearm_${lead}`,`hand_${lead}`); }
  const layers=order.filter(n=>parts[n]).reverse().map(name=>{const p=layout[name];return `<layer type="group" version="0.2" desc="${name}">${param('amount','<real value="1"/>')}${param('blend_method','<integer value="0"/>')}${param('origin',vector(0,0))}${param('transformation',`<bone_link type="transformation"><bone><bone_valuenode type="bone_object" guid="${guid(`${id}/${name}`)}"/></bone><base_value><composite type="transformation"><offset>${vector(0,0)}</offset><angle><angle value="0"/></angle><skew_angle><angle value="0"/></skew_angle><scale>${vector(1,1)}</scale></composite></base_value><translate><bool value="true"/></translate><rotate><bool value="true"/></rotate><skew><bool value="true"/></skew><scale_x><bool value="true"/></scale_x><scale_y><bool value="true"/></scale_y></bone_link>`)}${param('canvas',`<canvas><layer type="import" version="0.1" desc="${name}.png">${param('amount','<real value="1"/>')}${param('blend_method','<integer value="0"/>')}${param('tl',vector(-p.w/2,p.h*(p.pivot??.12)))}${param('br',vector(p.w/2,-p.h*(1-(p.pivot??.12))))}${param('filename',`<string>${name}.png</string>`)}</layer></canvas>`)}</layer>`;}).join('');
  const mirror=facing!==actorManifest.sourceFacing;const transformation=`<composite type="transformation"><offset>${vector(mirror?256:0,0)}</offset><angle><angle value="0"/></angle><skew_angle><angle value="0"/></skew_angle><scale>${vector(mirror?-1:1,1)}</scale></composite>`;
  const skeleton=`<layer type="skeleton" active="true" exclude_from_rendering="true" version="0.1" desc="editable bones">${param('name','<string>actor skeleton</string>')}${param('bones',`<static_list type="bone_object">${[bodyId,...names.map(name=>guid(`${id}/${name}`))].map(boneId=>`<entry><bone type="bone_object" guid="${boneId}"/></entry>`).join('')}</static_list>`)}</layer>`;
  const sif=`<?xml version="1.0"?><canvas version="1.0" width="256" height="256" view-box="0 256 256 0" fps="12" begin-time="0f" end-time="${d}s" bgcolor="0 0 0 0"><name>${actor} ${state} ${facing}</name><bones><bone_root type="bone_object" guid="${rootId}"/>${boneBody}${bones}</bones>${skeleton}<layer type="group" version="0.2" desc="facing">${param('amount',state==='spawn'?'<animated type="real"><waypoint time="0s" before="linear" after="linear"><real value="0"/></waypoint><waypoint time=".15s" before="linear" after="linear"><real value="1"/></waypoint></animated>':'<real value="1"/>')}${param('origin',vector(0,0))}${param('transformation',transformation)}${param('canvas',`<canvas>${layers}</canvas>`)}</layer></canvas>`;
  const sifName=`${state}-${facing}.sif`;if (!process.argv.includes('--render')) fs.writeFileSync(path.join(source,sifName),sif.replace(/></g, '>\n<')+'\n');
  const holds=Array(Math.ceil(d*12)).fill(1000/12);const clipFrames=holds.map((_,i)=>`${actor}/frames/${state}-${facing}-${String(i).padStart(3,'0')}.png`);
  if(process.argv.includes('--render') && (!process.env.PUPPET_CLIP || process.env.PUPPET_CLIP===state) && (!process.env.PUPPET_ACTOR || process.env.PUPPET_ACTOR===actor)){fs.mkdirSync(path.join(output,actor,'frames'),{recursive:true});for(let i=0;i<holds.length;i++)execFileSync(process.env.SYNFIG_BIN||'synfig',[path.join(source,sifName),'--time',`${i/12}s`,'-w','128','-h','128','-t','png','-o',path.join(output,clipFrames[i])],{stdio:['ignore','pipe','pipe']});}
  const semanticState=({attack:'basic',hit:'hurt',defeated:'ko'})[state]||state;
  actorManifest.clips[semanticState]||={};actorManifest.clips[semanticState][facing]={source:`${actor}/source/${sifName}`,frames:clipFrames,frameHoldMs:holds,loop:['idle','walk'].includes(state),...(state==='attack'?{impactTimeMs:Math.round(d*6)*1000/12}:state==='cast'?{releaseTimeMs:Math.round(d*6)*1000/12}:{}),canvas:{width:128,height:128},footOrigin:{x:64,y:125}};
 }
 manifest.actors[actor]=actorManifest;
}
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Wrote editable bone sources and manifest${process.argv.includes('--render')?' with rendered frames':''}.`);
