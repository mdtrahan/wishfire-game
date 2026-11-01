// Approved study reference (three.js), ORKA-sl7u, version v4g;
// not runtime code;
// assets not included.
/* ORKA-sl7u · owner-reference study; no runtime integration. */
(()=>{'use strict';
const T=THREE,clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);},TAU=Math.PI*2;
const views={},ready=[],line={from:[-100,100],to:[20,10],length:300,width:80,burstRadius:80};
const assets={};
function texture(src){const t=new T.TextureLoader().load(src,()=>{});t.colorSpace=T.SRGBColorSpace;t.magFilter=t.minFilter=T.NearestFilter;t.generateMipmaps=false;return t;}
for(const [k,v] of Object.entries(ART)) assets[k]=Array.isArray(v)?v.map(texture):texture(v);
function mesh(g,m,p){const o=new T.Mesh(g,m);p.add(o);return o;}
function basic(color,opacity=1){return new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,depthTest:false,side:T.DoubleSide});}
// Fourteen large faces, nine vertices; broad shoulders and a blunt crown.
function spireGeometry(h,r,n,leanX,leanZ){
 const verts=[[0,-h*.15,0],[-r,h*.34,-r*.65],[r*.85,h*.40,-r*.65],[r,h*.45,r*.65],[-r*.85,h*.38,r*.65],[-r*.54+leanX,h*.91,-r*.35+leanZ],[r*.48+leanX,h,-r*.35+leanZ],[r*.50+leanX,h*.88,r*.34+leanZ],[-r*.51+leanX,h*.83,r*.34+leanZ]];
 const faces=[[0,2,1],[0,3,2],[0,4,3],[0,1,4],[1,5,2],[2,5,6],[2,6,3],[3,6,7],[3,7,4],[4,7,8],[4,8,1],[1,8,5],[5,8,6],[6,8,7]],palette=[0x3d403f,0x50534f,0x5f625e,0x70736c,0x80827a,0x8a8b85],positions=[],colors=[],uvs=[],light=new T.Vector3(-.6,.8,.5).normalize();
 for(const f of faces){const [a,b,c]=f.map(i=>new T.Vector3(...verts[i])),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize(),k=Math.max(0,Math.min(5,Math.round((normal.dot(light)*.5+.5)*5))),col=new T.Color(palette[k]);for(const i of f){positions.push(...verts[i]);colors.push(col.r,col.g,col.b);}const tangent=b.clone().sub(a).normalize(),bitangent=normal.clone().cross(tangent),span=2*r;for(const i of f){const q=new T.Vector3(...verts[i]).sub(a);uvs.push(q.dot(tangent)/span,q.dot(bitangent)/span);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.computeVertexNormals();return geo;
}
// Three broad value-noise octaves, quantised to seven warm stone pigments.
const stoneMap=(()=>{const size=64,data=new Uint8Array(size*size*4),palette=[0x4a3020,0x634027,0x7d502e,0xa07040,0xb3844d,0xbf965c,0xc9a46a];
 const hash=(x,y)=>{const v=Math.sin(x*127.1+y*311.7+19.17)*43758.5453;return v-Math.floor(v);};
 const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const n=.65*noise(x/15,y/15)+.25*noise(x/7+13,y/7+9)+.10*noise(x/3+27,y/3+31),c=palette[Math.round(clamp((n-.25)/.50)*6)],i=(y*size+x)*4;data[i]=c>>16;data[i+1]=(c>>8)&255;data[i+2]=c&255;data[i+3]=255;}
 const map=new T.DataTexture(data,size,size);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=map.minFilter=T.NearestFilter;map.generateMipmaps=false;map.needsUpdate=true;return map;
})();
function stoneMaterial(W,H,height,radius){
 const m=new T.MeshBasicMaterial({map:stoneMap,vertexColors:true,transparent:true,depthWrite:true,depthTest:true,side:T.FrontSide,clippingPlanes:[new T.Plane(new T.Vector3(0,1,0),0)]});
 const fire={position:{value:new T.Vector3()},strength:{value:0}};m.userData.fire=fire;
 m.onBeforeCompile=shader=>{
 Object.assign(shader.uniforms,{uStoneHeight:{value:height},uFireRadius:{value:radius},uFirePosition:fire.position,uFireStrength:fire.strength,uLit:{value:new T.Color('#b8b8b0')},uMid:{value:new T.Color('#7a7c78')},uShadow:{value:new T.Color('#3a3d3c')}});
 shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
 varying vec3 vStoneUv;
 varying float vStoneHeat;
 uniform float uStoneHeight,uFireRadius,uFireStrength;
 uniform vec3 uFirePosition,uLit,uMid,uShadow;`).replace('#include <color_vertex>',`#include <color_vertex>
 // Face normals remain split; only vertex height and fire interpolate within a facet.
 vec3 faceNormal=normalize(normalMatrix*normal);
 float key=dot(faceNormal,normalize(vec3(-.65,.8,.55)));
 vec3 slate=key<.32?mix(uShadow,uMid,clamp((key+.25)/.57,0.0,1.0)):mix(uMid,uLit,clamp((key-.32)/.48,0.0,1.0));
 float top=clamp(position.y/uStoneHeight,0.0,1.0);
 vColor=slate*mix(.67,1.10,top);
 vec3 worldVertex=(modelMatrix*vec4(position,1.0)).xyz;
 float heat=pow(max(0.0,1.0-distance(worldVertex,uFirePosition)/uFireRadius),2.0)*uFireStrength;
 vStoneHeat=heat;`).replace('#include <project_vertex>',`#include <project_vertex>
 vStoneUv=vec3(uv,1.0)*gl_Position.w;
 vec2 grid=vec2(${W/2}.0,${H/2}.0);gl_Position.xy=(floor((gl_Position.xy/gl_Position.w*.5+.5)*grid)+.5)/grid*2.0*gl_Position.w-gl_Position.w;`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 varying vec3 vStoneUv;
 varying float vStoneHeat;`).replace('#include <map_fragment>',`diffuseColor*=texture2D(map,vStoneUv.xy/vStoneUv.z);
 // Calibrate pigment reflectance against the existing 0.48-linear lit face.
 diffuseColor.rgb*=2.0;`).replace('#include <color_fragment>',`#include <color_fragment>
 diffuseColor.rgb+=vec3(.75,.32,.055)*vStoneHeat;`);
 };return m;
}
// Soft small sand contact, below actors and stones.
const contactMap=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(16,16,2,16,16,16);g.addColorStop(0,'rgba(22,19,16,.8)');g.addColorStop(.45,'rgba(22,19,16,.55)');g.addColorStop(1,'rgba(22,19,16,0)');ctx.fillStyle=g;ctx.fillRect(0,0,32,32);return new T.CanvasTexture(c);})();
// Continuous additive light, with eight unequal blurred rays baked into the falloff.
function impactTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),im=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const dx=(x-63.5)/63.5,dy=(y-63.5)/63.5,r=Math.hypot(dx,dy);let rays=0;
 for(let i=0;i<8;i++){const a=i*TAU/8+[.04,-.09,.07,.12,-.05,.08,-.12,.03][i],along=dx*Math.cos(a)+dy*Math.sin(a),across=-dx*Math.sin(a)+dy*Math.cos(a),len=.47+(i%3)*.12;const q=(along-.16)/len;if(q>0&&q<1)rays+=Math.exp(-across*across/(.0018+(i%3)*.0007))*Math.sin(q*Math.PI)*.32;}
 const body=Math.exp(-r*r*14)*.72,core=Math.exp(-r*r*100)*.35,alpha=clamp((body+core+rays)*(1-smooth((r-.72)/.28))),white=Math.exp(-r*r*30),k=(y*128+x)*4;im.data[k]=255;im.data[k+1]=198+57*white;im.data[k+2]=85+170*white;im.data[k+3]=Math.round(alpha*255);}
 ctx.putImageData(im,0,0);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.generateMipmaps=false;map.minFilter=map.magFilter=T.LinearFilter;return map;
}
const impactMap=impactTexture();
// Broad white-hot fire bed with a few large orange tongues, separate from flash rays.
function fireTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,15,0,102);g.addColorStop(0,'rgba(255,122,20,0)');g.addColorStop(.22,'rgba(255,156,35,.8)');g.addColorStop(.65,'rgba(255,239,153,1)');g.addColorStop(1,'white');ctx.fillStyle=g;
 for(let i=0;i<7;i++){const x=19+i*15,y=17+(i*19)%32;ctx.beginPath();ctx.moveTo(x-14,98);ctx.quadraticCurveTo(x-15,53,x+5,y);ctx.quadraticCurveTo(x-1,59,x+16,98);ctx.closePath();ctx.fill();}
 const core=ctx.createRadialGradient(64,86,3,64,82,55);core.addColorStop(0,'white');core.addColorStop(.38,'rgba(255,255,234,1)');core.addColorStop(.64,'rgba(255,214,112,.96)');core.addColorStop(.82,'rgba(255,139,25,.65)');core.addColorStop(1,'rgba(255,109,10,0)');ctx.fillStyle=core;ctx.beginPath();ctx.ellipse(64,83,61,39,0,0,TAU);ctx.fill();const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.generateMipmaps=false;map.minFilter=map.magFilter=T.NearestFilter;return map;}
const fireMap=fireTexture();
// Neutral 64px density field: broad feather, low-frequency breakup, no solid core.
function puffTexture(){const size=64,data=new Uint8Array(size*size*4);
 const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7+8.4)*43758.5453;return n-Math.floor(n);};
 const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=(x-31.5)/31.5,dy=(y-31.5)/31.5,r=Math.hypot(dx,dy),n=.7*noise(x/18,y/18)+.3*noise(x/8+9,y/8+5),density=Math.min(1,1.20*Math.exp(-r*r*2.0)*(1-smooth((r-.16)/.84))*(.68+.32*n)),k=(y*size+x)*4;data[k]=data[k+1]=data[k+2]=data[k+3]=Math.round(255*density);}
 const map=new T.DataTexture(data,size,size);map.magFilter=map.minFilter=T.NearestFilter;map.generateMipmaps=false;map.needsUpdate=true;return map;
}
const dustMap=puffTexture();
// One instanced draw for all dust, with per-frame global back-to-front ordering.
function dustSystem(scene,camera,actors,W,H){
 const capacity=92,particles=[],quad=new T.PlaneGeometry(1,1),g=new T.InstancedBufferGeometry();g.index=quad.index;g.attributes.position=quad.attributes.position;g.attributes.uv=quad.attributes.uv;
 const fields={aCenter:3,aSize:2,aRotation:1,aTint:3,aAlpha:1,aSeed:1,aFeather:1,aRetreat:1};for(const [name,n] of Object.entries(fields))g.setAttribute(name,new T.InstancedBufferAttribute(new Float32Array(capacity*n),n).setUsage(T.DynamicDrawUsage));
 const enemies=actors.filter(a=>a.userData.name==='mirewing'),enemyRects=Array.from({length:3},()=>new T.Vector4());
 enemies.forEach((a,i)=>{const p=a.position.clone().project(camera),z=-a.position.clone().applyMatrix4(camera.matrixWorldInverse).z,w=a.scale.x*camera.projectionMatrix.elements[0]/z/2,h=a.scale.y*camera.projectionMatrix.elements[5]/z/2;enemyRects[i].set((p.x+1)/2-w/2,(p.y+1)/2,w,h);});
 const material=new T.ShaderMaterial({transparent:true,blending:T.NormalBlending,depthTest:true,depthWrite:false,uniforms:{uPuff:{value:dustMap},uTime:{value:0},uEnemy:{value:enemies[0].material.map},uEnemies:{value:enemyRects},uEnemyCount:{value:enemies.length},uViewport:{value:new T.Vector2(W,H)}},
 vertexShader:`attribute vec3 aCenter,aTint;attribute vec2 aSize;attribute float aRotation,aAlpha,aSeed,aFeather,aRetreat;
 varying vec2 vUv;varying vec3 vTint;varying float vAlpha,vSeed,vHeight,vFeather,vRetreat,vVertical;
 void main(){vUv=uv;vTint=aTint;vAlpha=aAlpha;vSeed=aSeed;vFeather=aFeather;vRetreat=aRetreat;
 vec2 q=position.xy*aSize;float c=cos(aRotation),s=sin(aRotation);q=mat2(c,-s,s,c)*q;
 vec4 center=modelViewMatrix*vec4(aCenter,1.0);
 // Each billboard samples the near half of the cloud volume. Keep the ground
 // feather anchored at emission height; transparent rock depth cannot carve it.
 center.z+=aFeather*14.0;center.xy+=q;vVertical=q.y/aSize.y+.5;
 vHeight=aCenter.y+q.x*viewMatrix[0][1]+q.y*viewMatrix[1][1];gl_Position=projectionMatrix*center;
 // Project volume depth separately so coverage never moves the approved anchors.
 vec4 nearSurface=projectionMatrix*vec4(center.xyz+vec3(0,0,aFeather*14.0),1.0);
 gl_Position.z=nearSurface.z/nearSurface.w*gl_Position.w;}`,
 fragmentShader:`uniform sampler2D uPuff,uEnemy;uniform float uTime;uniform vec4 uEnemies[3];uniform int uEnemyCount;uniform vec2 uViewport;
 varying vec2 vUv;varying vec3 vTint;varying float vAlpha,vSeed,vHeight,vFeather,vRetreat,vVertical;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 float fbm(vec2 p){return .65*noise(p)+.35*noise(p*2.03+7.1);}
 void main(){vec2 p=vUv*3.2+vSeed;float t=uTime;
 vec2 warp=vec2(fbm(p+vec2(t*.72,-t*.38)),fbm(p+vec2(-t*.43,t*.61)+13.7))-.5;
 vec2 uv=vUv+warp*.18;float density=texture2D(uPuff,uv).a;
 density*=.84+.16*fbm(p*1.4+vec2(t*.83,t*.46));
 // Feather the billboard where it meets the ground, without another depth pass.
 float ground=smoothstep(0.0,vFeather,vHeight);float border=smoothstep(0.0,.22,vUv.y)*(1.0-smoothstep(.82,1.0,max(abs(vUv.x-.5),abs(vUv.y-.5))*2.0));
 vec3 tint=vTint;
 if(vRetreat>.5){
 // Rounded billboards roll above ground; feather below it over a full puff radius.
 // The original travel particles keep their approved sampling and ground feather.
 ground=smoothstep(-vFeather*5.0,vFeather*2.0,vHeight);density=min(1.0,density*2.1);
 border=smoothstep(0.0,.18,vUv.y)*(1.0-smoothstep(.72,1.0,max(abs(vUv.x-.5),abs(vUv.y-.5))*2.0));
 vec2 sphere=(vUv-.5)*2.0;float dome=sqrt(max(0.0,1.0-dot(sphere,sphere)));
 float light=clamp(dot(normalize(vec3(sphere,dome)),normalize(vec3(-.5,.75,.6))),0.0,1.0);
 tint*=mix(.42,1.48,light)*mix(.85,1.05,smoothstep(.15,.85,vVertical));
 // A maximum of 52 retreat puffs can affect an enemy pixel. At .015 density
 // each, their combined alpha is bounded by 1-(1-.36*.015)^52 = .2454.
 float enemy=0.0;for(int i=0;i<3;i++){if(i>=uEnemyCount)break;vec2 uv=(gl_FragCoord.xy/uViewport-uEnemies[i].xy)/uEnemies[i].zw;if(min(uv.x,uv.y)>=0.0&&max(uv.x,uv.y)<=1.0)enemy=max(enemy,step(.15,texture2D(uEnemy,uv).a));}
 density*=mix(1.0,.015,enemy);
 }
 gl_FragColor=vec4(tint,vAlpha*density*ground*border);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const batch=new T.Mesh(g,material);batch.renderOrder=31;batch.frustumCulled=false;batch.userData.effect='dust';scene.add(batch);
 const birth=new T.Color('#9a7650'),pale=new T.Color('#d7bd8d'),lowBirth=new T.Color('#92704e');
 function add(base,d,size,isEnd,offset,trace){if(isEnd){
 // Ten small, overlapping puffs per rock. Taller back puffs crest first; low
 // front puffs conceal the sink without spreading a brown wash over the sprites.
 for(let i=0;i<52;i++){const kind=i<8?'ring':i<48?'body':'wisp',j=kind==='body'?i-8:i,anchor=base[kind==='body'?(j>=20?3:Math.floor(j/7)):i%4],angle=i*2.399963;
 const born=kind==='wisp'?2.02+(i-48)*.035:1.60+(i%5)*.012,life=2.92-born;
 const low=kind==='ring'||kind==='body'&&j%10<5;
 particles.push({base:anchor.clone(),d,kind,angle,born,life,seed:i*1.73+offset*13,rotation:i*.71,spin:((i%2)?1:-1)*(.80+(i%5)*.23),radius:(kind==='ring'?12:3+(j%5)*2)*d,drift:(kind==='ring'?37:kind==='wisp'?30:22+(j%4)*3)*d,lift:(low?8:kind==='wisp'?35:20+(j%4)*3)*d,width:(kind==='ring'?50:kind==='wisp'?38:low?64:50+(j%4)*4)*(trace?1.25:1)*d,height:(kind==='ring'?34:kind==='wisp'?42:low?53:48+(j%3)*4)*(trace?1.15:1)*d,low,retreat:true,layer:j%5,shade:.83+(i%5)*.09,center:new T.Vector3()});
 }return;}
 const count=10;for(let i=0;i<count;i++){
 const kind=isEnd?(i<8?'ring':i<24?'body':'wisp'):'travel',anchor=isEnd?base[(i<8?Math.floor(i/2):i<24?Math.floor((i-8)/4):i-24)]:base[0],angle=i*2.399963+offset*.7;
 const born=isEnd?(kind==='ring'?1.60:kind==='body'?1.60+(i-8)/15*.18:1.78+(i-24)*.02):offset+.03+(i>3?(i-3)*.015:0),life=isEnd?(kind==='ring'?.96+(i%3)*.05:Math.min(1.14+(i%3)*.04,2.92-born)):.90+(i%5)*.07;
 particles.push({base:anchor.clone(),d,kind,angle,born,life,seed:i*1.73+offset*13,rotation:i*.71,spin:((i%2)?1:-1)*(.24+(i%5)*.11),radius:(kind==='ring'?5:2+(i%4)*1.8)*d,drift:(kind==='ring'?24+(i%3)*5:kind==='wisp'?16:10+(i%5)*2)*d,lift:(kind==='ring'?3:kind==='wisp'?11:5+(i%3)*2)*d,width:(isEnd?(kind==='ring'?110:kind==='wisp'?105:124+(i%4)*6)*(trace?1.25:1):50+size*70)*d,height:(isEnd?(kind==='ring'?54:kind==='wisp'?75:76+(i%3)*6):38+size*28)*d,low:kind==='ring'||!isEnd&&i>=8,center:new T.Vector3()});
 }if(particles.length>capacity)throw Error('Dust capacity exceeded');}
 function update(time){material.uniforms.uTime.value=time;const live=[];
 for(const p of particles){const u=(time-p.born)/p.life;if(u<=0||u>=1)continue;const slowed=(1-Math.exp(-2.6*u))/(1-Math.exp(-2.6)),r=p.radius+p.drift*slowed,curl=Math.sin(u*5.4+p.seed)*2.2*p.d;
 p.center.copy(p.base);p.center.x+=Math.cos(p.angle)*r+curl;p.center.z+=Math.sin(p.angle)*r+12*p.d+Math.cos(u*4.7+p.seed)*1.7*p.d;p.center.y+=(p.low?13:18)*p.d+p.lift*slowed;
 if(p.retreat){const rise=1-Math.exp(-8*u);p.center.copy(p.base);p.center.x+=Math.cos(p.angle)*r+Math.sin(u*9+p.seed)*4*p.d;p.center.z+=Math.sin(p.angle)*r+(p.low?38:-12)*p.d;p.center.y+=(p.low?7:17+p.layer*5)*p.d+p.lift*rise+Math.sin(u*7+p.seed)*3*p.d;}
 p.u=u;p.depth=p.center.clone().applyMatrix4(camera.matrixWorldInverse).z+196*p.d;live.push(p);}
 live.sort((a,b)=>a.depth-b.depth);g.instanceCount=live.length;batch.visible=live.length>0;
 live.forEach((p,i)=>{const u=p.u;let growth=u<.55?.2+.8*smooth(u/.55):1+.1*smooth((u-.55)/.45),alpha=u<.15?.36*smooth(u/.15):u<.55?.36-.08*smooth((u-.15)/.40):.28*(1-smooth((u-.55)/.45)),tint=(p.low?lowBirth:birth).clone().lerp(pale,smooth((u-.15)/.85));
 if(p.retreat){growth=.35+.75*smooth(u/.22)+.28*smooth((u-.22)/.78);alpha=.36*smooth(u/.13)*(1-smooth((u-.43)/.57));tint=new T.Color(p.low?'#a57b4c':'#d1ad73').lerp(pale,smooth(u)).multiplyScalar(p.shade);}
 g.attributes.aCenter.setXYZ(i,...p.center.toArray());g.attributes.aSize.setXY(i,p.width*growth,p.height*growth);g.attributes.aRotation.setX(i,p.rotation+p.spin*(time-p.born));g.attributes.aTint.setXYZ(i,tint.r,tint.g,tint.b);g.attributes.aAlpha.setX(i,alpha);g.attributes.aSeed.setX(i,p.seed);g.attributes.aFeather.setX(i,7*p.d);g.attributes.aRetreat.setX(i,p.retreat?1:0);});
 for(const name of Object.keys(fields))g.attributes[name].needsUpdate=true;
 }
 return {add,update,particles,batch};
}
function makeView(id,mode){const trace=mode==='trace',W=trace?480:360,H=trace?480:640,pitch=(trace?19:42)*Math.PI/180,dist=H/2/Math.tan(20*Math.PI/180),scene=new T.Scene(),fx=new T.Group();scene.add(fx);
 const renderer=new T.WebGLRenderer({alpha:false,antialias:false,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(W/2,H/2,false);renderer.domElement.style.width=W+'px';renderer.domElement.style.height=H+'px';renderer.outputColorSpace=T.SRGBColorSpace;renderer.localClippingEnabled=true;renderer.setClearColor(trace?0x707755:0xd4be90);
 document.getElementById(id).appendChild(renderer.domElement);
 const camera=new T.PerspectiveCamera(40,W/H,1,4000);camera.position.set(0,dist*Math.sin(pitch),dist*Math.cos(pitch));camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const groundPoint=(x,z)=>{const v=new T.Vector3(x/(W/2),-z*(trace?1:.75)/(H/2),.5).unproject(camera).sub(camera.position).normalize();return camera.position.clone().addScaledVector(v,-camera.position.y/v.y);};
 const screenPoint=(x,y)=>groundPoint(x-W/2,(y-H/2)/(trace?1:.75));
 const worldHeight=(pixels,p)=>{const foot=p.clone().project(camera).y;let lo=0,hi=2000;for(let i=0;i<24;i++){const m=(lo+hi)/2,v=p.clone();v.y+=m;const h=(v.project(camera).y-foot)*H/2;if(h<pixels)lo=m;else hi=m;}return (lo+hi)/2;};
 const depthScale=p=>-p.clone().applyMatrix4(camera.matrixWorldInverse).z/dist;
 scene.add(new T.AmbientLight(0xaeb9cb,1.6));const sun=new T.DirectionalLight(0xfff0cd,2.5);sun.position.set(-200,500,250);scene.add(sun);
 // Registered backdrop and billboard puppets retain source feet and 0.75 ground squash.
 const bg=new T.Sprite(new T.SpriteMaterial({map:assets.arena,depthTest:false,depthWrite:false}));bg.scale.set(W,H,1);bg.renderOrder=-100;scene.add(bg);
 const actors=[];
 function actor(name,x,z,height=58){const a=new T.Sprite(new T.SpriteMaterial({map:assets[name],depthTest:false,depthWrite:false,alphaTest:.15}));a.userData.name=name;a.userData.gold={value:0};a.material.onBeforeCompile=shader=>{shader.uniforms.uGold=a.userData.gold;shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uGold;').replace('#include <colorspace_fragment>','#include <colorspace_fragment>\ngl_FragColor.rgb+=vec3(1.0,.73,.28)*uGold*(vec3(1.0)-gl_FragColor.rgb);');};a.center.set(.5,0);a.position.copy(groundPoint(x,z));const d=depthScale(a.position),im=assets[name].image,ratio=name==='trace-target'?.4:name==='mirewing'?.90:name==='runa'?.63:.51;a.scale.set(height*ratio*d,height*d,1);a.renderOrder=10;scene.add(a);actors.push(a);return a;}
 let target;
 if(trace){actor('fara',-160,130,74);target=actor('mirewing',60,30,74);}
 else {actor('fara',...line.from);actor('kaja',-111,175);actor('runa',95,145);actor('hondo',112,25);target=actor('mirewing',20,10);actor('mirewing',-4,24);actor('mirewing',45,32);}
 const updates=[],clusters=[],cloud=mode==='current'?null:dustSystem(scene,camera,actors,W/2,H/2);
 // Buildup precedes every eruption. Reference clock × 6/13 is the study's sim clock.
 const to=trace?[60,30]:line.to,from=trace?[-160,130]:line.from;
 const canonical=time=>trace?time:time*13/6;
 function glow(parent,width,height,order=26){const o=new T.Sprite(new T.SpriteMaterial({map:impactMap,transparent:true,blending:T.AdditiveBlending,depthWrite:false,depthTest:false}));o.scale.set(width,height,1);o.renderOrder=order;parent.add(o);return o;}
 if(mode!=='current'){
 const caster=actors.find(a=>a.userData.name==='fara'),d=depthScale(caster.position),prep=new T.Group();scene.add(prep);prep.position.copy(caster.position);
 const disc=mesh(new T.CircleGeometry(53*d,24),new T.MeshBasicMaterial({map:impactMap,color:0xffb653,transparent:true,blending:T.AdditiveBlending,depthWrite:false,depthTest:false,side:T.DoubleSide}),prep);disc.rotation.x=-Math.PI/2;disc.position.y=.6;disc.renderOrder=3;
 const hand=glow(prep,31*d,31*d,29);hand.position.copy(new T.Vector3(12*d,31*d,0).applyQuaternion(camera.quaternion));
 const core=glow(prep,14*d,14*d,30);core.position.copy(hand.position);
 updates.push(time=>{const a=canonical(time),fade=smooth(a/.08)*(1-smooth((a-.67)/.10)),pulse=.72+.28*Math.sin(a*45);prep.visible=fade>0;disc.material.opacity=fade*.75;disc.scale.setScalar(.9+.2*smooth(a/.65));hand.material.opacity=fade*pulse;hand.scale.setScalar((28+8*pulse)*d);core.material.opacity=fade;core.scale.setScalar((13+5*pulse)*d);});
 // A broad low burst races along the same line; static rocks emerge behind its head.
 const runner=new T.Group();scene.add(runner);const fire=glow(runner,60,25,28),hot=glow(runner,33,14,29);fire.material.map=fireMap;
 updates.push(time=>{const a=canonical(time),u=clamp((a-.70)/.60);runner.visible=a>=.68&&a<1.39;runner.position.copy(groundPoint(from[0]+(to[0]-from[0])*u,from[1]+(to[1]-from[1])*u));const d=depthScale(runner.position);runner.position.y+=5*d;fire.scale.set((48+20*u)*d,(23+8*u)*d,1);hot.scale.set((28+10*u)*d,14*d,1);fire.material.opacity=hot.material.opacity=smooth((a-.68)/.05)*(1-smooth((a-1.30)/.09));});
 }
 function cluster(x,z,size,offset,isEnd){
 const p=groundPoint(x,z),d=depthScale(p),root=new T.Group();root.position.copy(p);fx.add(root);
 const spires=[],rings=[],blooms=[];
 const layout=isEnd?[
 [-25,-5,86,25,-39,-6,1.30,false],
 [27,-8,94,26,31,-9,1.34,false],
 [-1,11,78,26,-15,7,1.39,false],
 [1,27,69,25,0,0,1.73,true]
 ]:[[0,0,18+27*size,8+10*size,-8-8*size,0,offset,false]];
 for(const [px,pz,height,r,lx,lz,born,closing] of layout){const base=groundPoint(x+px,z+pz),sh=worldHeight(trace?height*1.22:height,base),o=mesh(spireGeometry(sh,r*d*(trace?1.2:1),4,lx*d,lz*d),stoneMaterial(W,H,sh,88*d),root);o.rotation.set(.035,closing?-.38:px<0?.42:px>0?.72:.58,0);o.position.copy(base).sub(p);o.renderOrder=closing?20:isEnd?(pz>0?15:7):12;o.userData={kind:closing?'closing':isEnd?'prong':'travel',faces:14,born,projectedDesignHeight:height};const shadow=mesh(new T.PlaneGeometry(r*d*2.1,r*d*1.45),new T.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false,depthTest:false}),root);shadow.rotation.x=-Math.PI/2;shadow.position.copy(o.position);shadow.position.y=.5;shadow.renderOrder=5;spires.push({o,sh,born,closing,base:o.position.clone(),shadow});}
 const burst=glow(root,(isEnd?105:39+size*31)*d,(isEnd?59:23+size*20)*d,27);burst.position.y=7*d;blooms.push(burst);burst.material.map=fireMap;const core=glow(root,(isEnd?68:23+size*22)*d,(isEnd?32:14+size*15)*d,28);core.position.y=6*d;blooms.push(core);
 if(isEnd)for(const o of blooms){const feather={value:0};o.material.userData.retreatFeather=feather;o.material.onBeforeCompile=s=>{s.uniforms.uRetreatFeather=feather;s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uRetreatFeather;').replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.a*=mix(1.0,smoothstep(0.0,.30,vMapUv.y)*smoothstep(0.0,.12,vMapUv.x)*(1.0-smoothstep(.88,1.0,vMapUv.x)),uRetreatFeather);');};}
 for(let j=0;j<(isEnd?2:1);j++){const ring=mesh(new T.RingGeometry((isEnd?31:15+size*8)*d,(isEnd?32:16+size*8)*d,32),basic(0xffe9b2),root);ring.rotation.x=-Math.PI/2;ring.position.y=.8+j*.2;ring.renderOrder=4;rings.push(ring);}
 cloud.add(spires.map(({base})=>p.clone().add(base)),d,size,isEnd,offset,trace);
 updates.push(time=>{const a=canonical(time),age=a-(isEnd?1.28:offset);root.visible=a>=0&&a<2.95;
 spires.forEach(({o,sh,born,closing,base,shadow})=>{const rise=smooth((a-born)/(closing?.15:isEnd?.15:.12)),fadeAt=isEnd?(closing?2.33:2.12):offset+.34,sinkAt=isEnd?(closing?2.11:1.90):offset+.48,release=isEnd?0:smooth((a-fadeAt)/.50),sink=isEnd?1-Math.pow(1-clamp((a-sinkAt)/.25),3):smooth((a-sinkAt)/.38);o.visible=a>=born&&sink<1;o.position.copy(base);o.position.y-=sh*(1-rise)+sh*sink;o.scale.set(1,.72+.28*rise,1);o.material.opacity=(1-release)*.99;shadow.visible=o.visible;shadow.material.opacity=rise*(1-sink)*(1-release)*.72;});
 const bloom=smooth(age/.04)*(1-smooth((age-(isEnd?.30:.08))/.20)),close=isEnd?smooth((a-1.75)/.04)*(1-smooth((a-1.87)/.20)):0;
 spires.forEach(({o})=>{o.material.userData.fire.position.value.copy(p);o.material.userData.fire.position.value.y=7*d;o.material.userData.fire.position.value.z+=isEnd&&close>0?27*d:0;o.material.userData.fire.strength.value=Math.max(bloom,close);});
 blooms.forEach((o,i)=>{o.visible=bloom>0||close>0;o.material.opacity=Math.max(bloom,close)*(.95-i*.06);o.position.z=isEnd&&close>0?27*d:0;if(isEnd)o.material.userData.retreatFeather.value=smooth((a-1.60)/.12);});
 rings.forEach((o,i)=>{const u=(age-i*.06)/.45;o.visible=u>=0&&u<1;o.scale.setScalar(.55+clamp(u)*1.7);o.material.opacity=(1-clamp(u))*.32;});
 if(isEnd){const gold=smooth((a-1.75)/.04)*(1-smooth((a-1.93)/.24));for(const hit of actors.filter(o=>o.userData.name==='mirewing'))hit.userData.gold.value=gold*.86;}

 });
 clusters.push({x,z,offset,size,isEnd,facesPerRock:14,prongs:isEnd?3:0,closing:isEnd?1:0,travel:isEnd?0:1});
 }
 if(mode!=='current'){
 for(let i=0;i<4;i++){const u=.15+i*.21;cluster(from[0]+(to[0]-from[0])*u,from[1]+(to[1]-from[1])*u,i/3,.73+i*.14,false);}
 cluster(...to,1,1.28,true);
 }
 // Current 2D reconstruction follows pound.rs: source strips, fixed slab anchors, source frame schedule.
 const current=new T.Group();scene.add(current);
 if(mode==='current'){
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d'),map=new T.CanvasTexture(canvas);map.magFilter=map.minFilter=T.NearestFilter;map.colorSpace=T.SRGBColorSpace;
 const overlay=new T.Sprite(new T.SpriteMaterial({map,depthTest:false,depthWrite:false}));overlay.scale.set(W,H,1);overlay.renderOrder=40;current.add(overlay);
 function draw(key,frame,x,y,w,h,alpha=1){const a=assets[key];if(!a)return;const tex=Array.isArray(a)?a[Math.min(a.length-1,Math.max(0,frame))]:a;if(!tex.image)return;ctx.globalAlpha=alpha;ctx.drawImage(tex.image,x-w/2,y-h,w,h);ctx.globalAlpha=1;}
 updates.push(t=>{ctx.clearRect(0,0,W,H);const a=t<.6?t/.6:1+t-.6,fade=1-clamp((t-.6)/.50),from=[180+line.from[0],320+line.from[1]*.75],to=[180+line.to[0],320+line.to[1]*.75];
 if(t<.6&&a/1.2<.21)draw('pound-fist',Math.floor(a/1.2/.035),from[0],from[1]+14,64,48);
 const crack=clamp((a-.1)/.35);if(t<1.24&&crack>0){ctx.save();const dx=(to[0]-from[0])*crack,dy=(to[1]-from[1])*crack,tex=assets['pound-crack']?.[0];if(tex?.image){const im=tex.image,sx=7.2,sy=7.2;ctx.transform(dx/im.width,dy/im.width,sx*2/im.height,sy*2/im.height,from[0]-sx,from[1]-sy);ctx.globalAlpha=.8*fade;ctx.drawImage(im,0,0);}ctx.restore();}
 if(a>=.10&&a<.50)for(let i=1;i<=4;i++){const u=i/4;if(u<=crack)draw('blast-smoke',0,from[0]+(to[0]-from[0])*u,from[1]+(to[1]-from[1])*u+6,24,12,.18*(1-clamp((a-.35)/.15)));}
 for(let i=0;i<8;i++){const u=i/7,dist=(i+1)/8,scale=.5+.8*u,born=.4+.45*u;if(a<born||a>=1.5)continue;const frame=a<1?Math.min(3,Math.floor((a-born)/.07)):Math.min(6,3+Math.floor((a-1)/.09));draw(i%2?'pound-eruption-b':'pound-eruption',frame,from[0]+(to[0]-from[0])*dist,from[1]+(to[1]-from[1])*dist+2.5*scale,48*scale,64*scale,fade);}
 if(t>=.6&&t<1.24)draw('pound-finale',Math.floor((t-.6)*.03/.08/.03),to[0],to[1]+5,128,128,1);
 if(t>=.6&&t<.72){ctx.fillStyle=`rgba(255,247,219,${Math.pow(1-(t-.6)/.12,2)*.92})`;ctx.fillRect(0,0,W,H);}map.needsUpdate=true;});
 }
 const enemyRects=cloud?.batch.material.uniforms.uEnemies.value,enemyOrigins=enemyRects?.map(r=>[r.x,r.y]);
 function render(time){
 updates.forEach(f=>f(time));if(cloud)cloud.update(canonical(time));
 // One closing-impact thump, at the existing gold flash. Snap to render pixels.
 const u=(time-(trace?1.75:1.75*6/13))/.22;
 const pulse=mode!=='current'&&u>=0&&u<1?Math.sin(u*TAU*2.5)*Math.exp(-1.6*u):0;
 const y=Math.round(6*pulse*H/640/2)*2,x=Math.round(1.5*pulse*W/360/2)*2;
 const projection=camera.projectionMatrix.elements,px=projection[8],py=projection[9];
 projection[8]=px-2*x/W;projection[9]=py+2*y/H;
 // Keep the dust's screen-space enemy silhouettes registered to the same view.
 enemyRects?.forEach((r,i)=>{r.x=enemyOrigins[i][0]+x/W;r.y=enemyOrigins[i][1]-y/H;});
 renderer.render(scene,camera);
 projection[8]=px;projection[9]=py;
 enemyRects?.forEach((r,i)=>{r.x=enemyOrigins[i][0];r.y=enemyOrigins[i][1];});
 }
 views[id]={render,renderer,scene,camera,clusters,W,H,mode,actors,cloud};return views[id];
}
window.Study={views,makeView,render(time){Object.values(views).forEach(v=>v.render(time));},stats(){const out={};for(const [id,v] of Object.entries(views)){let tris=0;v.scene.traverse(o=>{if(o.isSprite&&o.userData.effect)tris+=2;if(o.isMesh)tris+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});out[id]={triangles:tris,draws:v.renderer.info.render.calls,internal:[v.W/2,v.H/2],clusters:v.clusters,puppetHeight:v.mode==='trace'?112:58,groundSquash:v.mode==='trace'?1:.75,projection:'perspective',pitch:v.mode==='trace'?19:42};}return out;},clamp};
})();
