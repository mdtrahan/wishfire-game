// Approved study reference (three.js), ORKA-sl7u, version v3e;
// not runtime code;
// assets not included.
/* Offline art study. Simulation footprints at zoom .5; presentation height is art-owned. */
(()=>{
const T=THREE,W=360,H=640,TAU=Math.PI*2,clamp=(x)=>Math.max(0,Math.min(1,x));
const flags={low:true,snap:false,affine:false,dither:true,additive:true};
let castSeed=91731;
let current='bubble',time=0,speed=1,playing=false,manual=true,mode='spell',sceneTriangles=0,sceneDraws=0;
const renderer=new T.WebGLRenderer({antialias:false,alpha:false,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(W,H,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor(0xd8c6a3);
const rt=new T.WebGLRenderTarget(180,320,{minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true});
const scene=new T.Scene(),fx=new T.Group();scene.add(fx);
const camera=new T.PerspectiveCamera(40,W/H,1,2600),dist=320/Math.tan(20*Math.PI/180),pitch=42*Math.PI/180;
camera.position.set(0,dist*Math.sin(pitch),dist*Math.cos(pitch));camera.lookAt(0,0,0);camera.updateMatrixWorld();
// Inverse ground projection preserves the source camera's .75 squash and sprite feet.
function groundPoint(x,z){const p=new T.Vector3(x/180,-z*.75/320,.5).unproject(camera);const d=p.sub(camera.position).normalize();return camera.position.clone().addScaledVector(d,-camera.position.y/d.y);}
function anchor(x,z,parent=fx){const p=groundPoint(x,z),dx=groundPoint(x+1,z).sub(p),dz=groundPoint(x,z+1).sub(p),g=new T.Group();g.matrixAutoUpdate=false;g.matrix.makeBasis(dx,new T.Vector3(0,1,0),dz);g.matrix.setPosition(p);parent.add(g);return g;}
scene.add(new T.AmbientLight(0xacc7e1,.85));const light=new T.DirectionalLight(0xffefd2,2.4);light.position.set(-170,320,180);scene.add(light);
const loaded=[];
function texture(src){const t=new T.TextureLoader().load(src);t.colorSpace=T.SRGBColorSpace;t.magFilter=t.minFilter=T.NearestFilter;loaded.push(t);return t;}
const tex={};['fara','kaja','runa','hondo','mirewing','arena'].forEach(n=>tex[n]=texture(ART[n]));
// Slice gen/assets.json: Runa faces right. Caster x=98, target x=15.
const casterFacing={source:"right",actorFacesLeft:true};
const casterFlip=(casterFacing.source==='left')!==casterFacing.actorFacesLeft;
if(casterFlip){tex.runa.wrapS=T.RepeatWrapping;tex.runa.repeat.x=-1;tex.runa.offset.x=1;}
window.CASTER_FACING={...casterFacing,flip:casterFlip};
const snapUniform={value:0};
function patch(m){m.onBeforeCompile=s=>{s.uniforms.uSnap=snapUniform;s.vertexShader='uniform float uSnap;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nif(uSnap>.5){vec2 g=vec2(90.,160.);gl_Position.xy=floor(gl_Position.xy/gl_Position.w*g+.5)/g*gl_Position.w;}');};return m;}
// Camera-facing arena at the far plane is a registered backdrop, never an effect decal.
const ground=new T.Mesh(new T.PlaneGeometry(W,H),new T.MeshBasicMaterial({map:tex.arena,depthWrite:false}));ground.quaternion.copy(camera.quaternion);ground.position.copy(camera.position).multiplyScalar(-.48);ground.scale.setScalar(1.48);ground.renderOrder=-10;scene.add(ground);
const actors=[];
function placeActor(a,x,z){a.position.copy(groundPoint(x,z));const depth=-a.position.clone().applyMatrix4(camera.matrixWorldInverse).z;const f=depth/dist;a.scale.set((a.userData.name==='runa'?36.72:a.userData.name==='mirewing'?52:29.54)*f,58*f,1);}
for(const [name,x,z] of [['fara',-103,80],['kaja',-90,-110],['runa',98,120],['hondo',116,-105],['mirewing',15,-12]]){const a=new T.Sprite(new T.SpriteMaterial({map:tex[name],depthWrite:false,alphaTest:.06}));a.center.set(.5,0);a.userData.name=name;placeActor(a,x,z);scene.add(a);actors.push(a);}
// Deterministic 64² alpha texture: coarse vertical streaks and grain, nearest sampled.
const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(64,64);let seed=471;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const bands=Array.from({length:64},()=>rand());for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,n=rand(),streak=Math.pow(bands[x],3),a=clamp(.08+n*.24+streak*.7+((y+x*3)%23<2?.32:0));pixels.data.set([255,255,255,Math.floor(a*255)],i);}ctx.putImageData(pixels,0,0);
const pattern=new T.CanvasTexture(canvas);pattern.wrapS=pattern.wrapT=T.RepeatWrapping;pattern.magFilter=pattern.minFilter=T.NearestFilter;
const animated=[],shellUniforms=[],energyMaterials=[];
const vertex=`uniform float uSnap;varying vec2 vUv;varying vec2 vAffine;varying float vW;varying vec3 vNormal;void main(){vUv=uv;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);vAffine=uv*gl_Position.w;vW=gl_Position.w;if(uSnap>.5){vec2 g=vec2(90.,160.);gl_Position.xy=floor(gl_Position.xy/gl_Position.w*g+.5)/g*gl_Position.w;}}`;
function shellMat(color,opacity=.8){const uniforms={uTex:{value:pattern},uTime:{value:0},uColor:{value:new T.Color(color)},uOpacity:{value:opacity},uSnap:snapUniform,uAffine:{value:0}};shellUniforms.push(uniforms);const m=new T.ShaderMaterial({uniforms,side:T.DoubleSide,transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexShader:vertex,fragmentShader:`precision mediump float;uniform sampler2D uTex;uniform float uTime,uOpacity,uAffine;uniform vec3 uColor;varying vec2 vUv,vAffine;varying float vW;varying vec3 vNormal;void main(){vec2 uv=mix(vUv,vAffine/vW,uAffine);float grain=texture2D(uTex,uv*vec2(2.,1.)+vec2(0.,-uTime*.72)).a;float lit=.32+.68*max(0.,dot(normalize(vNormal),normalize(vec3(-.5,.8,.6))));float edge=pow(abs(vUv.y-.5)*2.,4.);vec3 c=mix(uColor*lit,vec3(1.),step(.83,grain)*.82);gl_FragColor=vec4(c,(grain*.85+edge*.25)*uOpacity);}`});energyMaterials.push(m);return m;}
function mat(color,opacity=1,add=false){const m=patch(new T.MeshBasicMaterial({color,transparent:opacity<1||add,opacity,side:T.DoubleSide,depthWrite:!add&&opacity===1,blending:add?T.AdditiveBlending:T.NormalBlending}));if(add)energyMaterials.push(m);return m;}
function mesh(geo,material,parent=fx){if(material.isShaderMaterial){if(geo.index){const original=geo;geo=geo.toNonIndexed();original.dispose();}geo.computeVertexNormals();}const m=new T.Mesh(geo,material);parent.add(m);return m;}
function solid(color){return patch(new T.MeshLambertMaterial({color,flatShading:true}));}
function shard(size,color,parent=fx){return mesh(new T.OctahedronGeometry(size,0),solid(color),parent);}
function ring(r,t,color,parent){const m=mesh(new T.TorusGeometry(r,t,4,32),mat(color,1,true),parent);m.rotation.x=-Math.PI/2;m.position.y=1;return m;}
function glow(size,color,parent,ground=false){const m=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{uColor:{value:new T.Color(color)},uOpacity:{value:1},uRing:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'precision mediump float;varying vec2 vUv;uniform vec3 uColor;uniform float uOpacity,uRing;void main(){float r=length(vUv-.5)*2.;float a=pow(max(0.,1.-r),2.2);if(uRing>.5)a=exp(-pow((r-.72)*9.,2.))*.7;gl_FragColor=vec4(uColor,a*uOpacity);}'});energyMaterials.push(m);const o=mesh(new T.PlaneGeometry(size,size),m,parent);if(ground){o.rotation.x=-Math.PI/2;o.position.y=.4;}else o.quaternion.copy(camera.quaternion);return o;}
function beam(height,r,color,parent){const g=new T.Group();parent.add(g);const body=mesh(new T.CylinderGeometry(r*.18,r,height,6,1,true),shellMat(color,.82),g);body.position.y=height/2;const core=mesh(new T.CylinderGeometry(.6,r*.30,height*.96,5),mat(0xffffff,1,true),g);core.position.y=height*.48;const halo=glow(r*7,color,g);halo.position.y=height*.42;halo.scale.y=height/(r*7)*1.2;return g;}
function flash(parent,r,start,duration,color=0xc8e8ff,period=0){const f=glow(r*3,color,parent,true),core=glow(r*2,0xffffff,parent,true);const burst=glow(r*3,0xffffff,parent);burst.position.y=24;animated.push(t=>{const age=period?(t-start)%period:t-start,p=age/duration,on=age>=0&&p<1;f.visible=core.visible=burst.visible=on;if(on){f.material.uniforms.uOpacity.value=2*(1-p);core.material.uniforms.uOpacity.value=2.5*(1-p);burst.material.uniforms.uOpacity.value=1.7*(1-p);burst.scale.setScalar(.7+p*.7);}});}
function clear(){for(const root of [fx,window.AIRY?.scene].filter(Boolean))root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.uniforms?.uSoft?.value.dispose();m.dispose();});});fx.clear();delete window.AIRY;animated.length=shellUniforms.length=energyMaterials.length=0;}
function bubble(){
 const g=anchor(15,-12),soap=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.FrontSide,uniforms:{uTime:{value:0}},vertexShader:'uniform float uTime;varying vec3 n,v;varying vec2 vUv;void main(){vUv=uv;vec3 q=position;q+=normal*sin(position.y*.12+uTime*14.+position.x*.04)*1.8;vec4 p=modelViewMatrix*vec4(q,1.);n=normalize(normalMatrix*normal);v=-p.xyz;gl_Position=projectionMatrix*p;}',fragmentShader:'precision mediump float;varying vec3 n,v;varying vec2 vUv;void main(){vec3 nn=normalize(n);float facing=abs(dot(nn,normalize(v)));float rim=pow(1.-facing,2.);float hue=sin(atan(nn.y,nn.x)*3.+nn.z*4.);vec3 c=mix(vec3(.03,.8,.92),vec3(.95,.16,.7),hue*.5+.5);float spec=pow(max(0.,dot(reflect(-normalize(vec3(-.55,.85,.8)),nn),normalize(v))),14.);c=mix(c,vec3(1.),clamp(spec*2.+rim*.35,0.,1.));float ripple=sin(vUv.y*57.+vUv.x*17.)*.035;gl_FragColor=vec4(c,.14+rim*.77+spec*.8+ripple);}'});
 const sphere=mesh(new T.IcosahedronGeometry(83,2),soap,g);sphere.position.y=108;
 const rim=mesh(new T.TorusGeometry(81,2.4,4,48),shellMat(0xc49cff,.8),g);rim.quaternion.copy(camera.quaternion);
 const shine=glow(39,0xffffff,g);shine.position.set(-32,151,43);shine.scale.set(.8,1.7,1);
 const sheen=mesh(new T.IcosahedronGeometry(12,1),mat(0xffffff,.92,true),g);sheen.position.set(-32,151,43);sheen.scale.set(.48,1.5,.2);sheen.quaternion.copy(camera.quaternion);
 const floor=glow(157,0x19dbff,g,true);floor.material.uniforms.uOpacity.value=.6;
 // Full-resolution release: the shell becomes a Gaussian mist at the pop.
 const airy=new T.Scene(),release=anchor(15,-12,airy);
 const bloom=glow(250,0x48dfee,release);bloom.position.y=108;
 const hot=glow(130,0xc0faff,release);hot.position.y=108;
 const haze=glow(325,0x61e3f7,release);haze.position.y=108;
 const smooth=(a,b,x)=>{const u=clamp((x-a)/(b-a));return u*u*(3-2*u);};
 const varied=castSeed!==91731;
 let motionSeed=castSeed;const motionRandom=()=>{motionSeed=(Math.imul(motionSeed,1664525)+1013904223)>>>0;return motionSeed/4294967296;};
 const sphereSample=()=>{const y=motionRandom()*2-1,a=motionRandom()*TAU;return new T.Vector3(Math.sqrt(1-y*y)*Math.cos(a),y,Math.sqrt(1-y*y)*Math.sin(a));};
 const bias=varied?sphereSample().multiplyScalar(.075):new T.Vector3(),turn=varied?motionRandom()*TAU:0;
 let rng=91731;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
 function surface(n){const p=n.clone().multiplyScalar(83);return p.addScaledVector(n,Math.sin(p.y*.12+.35*14+p.x*.04)*1.8).add(new T.Vector3(0,108,0));}
 const directions=Array.from({length:10},(_,i)=>{const a=i/10*TAU+.24+turn+(varied?(motionRandom()-.5)*.45:0);return new T.Vector3(Math.cos(a),.24+Math.sin(i*2.3)*.56+(varied?(motionRandom()-.5)*.2:0),Math.sin(a)*.8).add(bias).normalize();});
 const origins=directions.map(surface),orbVel=directions.map((n,i)=>n.clone().multiplyScalar(varied?300+motionRandom()*80:300+i%3*40));
 function orbPosition(i,age){return origins[i].clone().addScaledVector(orbVel[i],(1-Math.exp(-6*age))/6).add(new T.Vector3(0,-48*age-13*age*age,0));}
 const orbs=directions.map((n,i)=>{const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,uniforms:{uOpacity:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`precision mediump float;varying vec2 vUv;uniform float uOpacity;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float core=exp(-r*r*65.);float body=exp(-r*r*7.);vec3 c=mix(vec3(.05,.70,.88),vec3(1.),core);float a=(body*.95+exp(-r*r*2.5)*.42)*(1.-smoothstep(.72,1.,r))*uOpacity;gl_FragColor=vec4(c,a);
 }`});const o=mesh(new T.PlaneGeometry(19+i%3*3,19+i%3*3),material,release);o.quaternion.copy(camera.quaternion);o.renderOrder=1;return o;});
 // White RGB with Gaussian alpha; linear sampling keeps sub-pixel motes round.
 const softCanvas=document.createElement('canvas');softCanvas.width=softCanvas.height=64;
 const softCtx=softCanvas.getContext('2d'),softPixels=softCtx.createImageData(64,64);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){const r=Math.hypot((x+.5-32)/32,(y+.5-32)/32);softPixels.data.set([255,255,255,Math.round(255*Math.exp(-r*r*4.5)*(1-clamp((r-.72)/.28)))],(y*64+x)*4);}
 softCtx.putImageData(softPixels,0,0);const soft=new T.CanvasTexture(softCanvas);soft.minFilter=soft.magFilter=T.LinearFilter;soft.generateMipmaps=false;
 const count=1000,surfaceCount=760,positions=new Float32Array(count*3),velocities=new Float32Array(count*3),life=new Float32Array(count),delay=new Float32Array(count),sizes=new Float32Array(count),phases=new Float32Array(count),colors=new Float32Array(count*3),drags=new Float32Array(count),flutterRates=new Float32Array(count),flutterAmplitudes=new Float32Array(count);
 for(let i=0;i<count;i++){
  const y=random()*2-1,a=random()*TAU,n=new T.Vector3(Math.sqrt(1-y*y)*Math.cos(a),y,Math.sqrt(1-y*y)*Math.sin(a));
  let p,v;if(i<surfaceCount){p=surface(n);v=n.clone().multiplyScalar(260+random()*200);delay[i]=0;life[i]=.60+random()*.32;}
  else{const orb=i%10,emission=.02+random()*.24;p=orbPosition(orb,emission).addScaledVector(n,random()*5);v=orbVel[orb].clone().multiplyScalar(Math.exp(-6*emission)*.55).addScaledVector(n,40+random()*70);delay[i]=emission;life[i]=.60+random()*.18;}
  drags[i]=varied?5.4+motionRandom()*1.2:6;flutterRates[i]=varied?.85+motionRandom()*.3:1;flutterAmplitudes[i]=varied?.85+motionRandom()*.3:1;
  if(varied){
   const direction=sphereSample(),outward=direction.clone().addScaledVector(sphereSample(),.18).add(bias).normalize();
   if(i<surfaceCount){p=surface(direction);v=outward.multiplyScalar(260+motionRandom()*200);life[i]=.60+motionRandom()*.32;}
   else{const orb=i%10;p=orbPosition(orb,delay[i]).addScaledVector(direction,motionRandom()*5);v=orbVel[orb].clone().multiplyScalar(Math.exp(-6*delay[i])*.55).addScaledVector(outward,40+motionRandom()*70);life[i]=.60+motionRandom()*.18;}
  }
  positions.set(p.toArray(),i*3);velocities.set(v.toArray(),i*3);sizes[i]=i%37===0?2.6:1+random();phases[i]=random()*TAU;if(varied)phases[i]=motionRandom()*TAU;
  const c=new T.Color(i%17===0?0xf3b6ed:i%5===0?0xffffff:0x92eaf6);
  c.lerp(new T.Color(0xffffff),random()*.4);colors.set(c.toArray(),i*3);
 }
 const geo=new T.BufferGeometry();for(const [name,data,n] of [['position',positions,3],['aVelocity',velocities,3],['aLife',life,1],['aDelay',delay,1],['aSize',sizes,1],['aPhase',phases,1],['aColor',colors,3],['aDrag',drags,1],['aFlutterRate',flutterRates,1],['aFlutterAmplitude',flutterAmplitudes,1]])geo.setAttribute(name,new T.BufferAttribute(data,n));
 const mistMat=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,blending:T.AdditiveBlending,uniforms:{uAge:{value:-1},uScale:{value:1},uSoft:{value:soft}},vertexShader:`
 attribute vec3 aVelocity,aColor;attribute float aLife,aDelay,aSize,aPhase,aDrag,aFlutterRate,aFlutterAmplitude;uniform float uAge,uScale;varying vec3 vColor;varying float vAlpha;
 void main(){float age=max(0.,uAge-aDelay);float u=clamp(age/aLife,0.,1.);vec3 p=position+aVelocity*((1.-exp(-aDrag*age))/aDrag);p.y-=48.*age+13.*age*age;p.x+=sin(age*11.*aFlutterRate+aPhase)*2.*age*aFlutterAmplitude;p.y+=(sin(age*9.*aFlutterRate+aPhase)-sin(aPhase))*1.8*age*aFlutterAmplitude;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=aSize*uScale;float core=exp(-(p.x*p.x+pow(p.y-(108.-48.*uAge-13.*uAge*uAge),2.))/16000.);vAlpha=step(aDelay,uAge)*(1.-smoothstep(.38,1.,u))*(.75+core*.25)*(.88+.12*sin(age*17.+aPhase));vColor=aColor;}`,
 fragmentShader:`precision mediump float;uniform sampler2D uSoft;varying vec3 vColor;varying float vAlpha;void main(){float a=texture2D(uSoft,gl_PointCoord).a*vAlpha;vec2 q=gl_PointCoord-.5;vec3 c=mix(vColor,vec3(1.),exp(-dot(q,q)*180.)*.28);gl_FragColor=vec4(c,a);
 }`});
 const mist=new T.Points(geo,mistMat);mist.frustumCulled=false;mist.renderOrder=2;release.add(mist);
 window.AIRY={seed:castSeed,bias,scene:airy,mist,orbs,bloom,hot,haze,count,surfaceCount,origins,orbPosition,cloudCentre:new T.Vector3()};
 animated.push(t=>{const s=.32+.68*clamp(t/.35),before=t<.35;soap.uniforms.uTime.value=t;[sphere,rim,shine,sheen].forEach(o=>o.visible=before);sphere.scale.setScalar(s);sphere.position.y=108*s;rim.scale.setScalar(s);rim.position.y=108*s;shine.position.set(-32*s,151*s,43*s);sheen.position.copy(shine.position);shine.scale.set(.8*s,1.7*s,1);sheen.scale.set(.48*s,1.5*s,.2*s);
 const age=t-.35;release.visible=age>=0&&age<.94;
 bloom.visible=hot.visible=age>=0&&age<.075;const f=Math.max(0,1-age/.075);bloom.material.uniforms.uOpacity.value=.50*f*f;hot.material.uniforms.uOpacity.value=.28*f*f;bloom.scale.setScalar(1+Math.max(0,age)*3);
 haze.position.set(0,108-48*Math.max(0,age)-13*Math.max(0,age)**2,0);haze.material.uniforms.uOpacity.value=age>=0?.12*(1-smooth(.2,.88,age)):0;haze.scale.setScalar(1+Math.max(0,age)*.26);
 orbs.forEach((o,i)=>{const duration=.44+(i%3)*.035,u=clamp(age/duration);o.visible=age>=0&&age<duration;o.position.copy(orbPosition(i,Math.max(0,age)));o.scale.setScalar(1+u*.65);o.material.uniforms.uOpacity.value=.95*(1-u*u)**1.5;});
 mistMat.uniforms.uAge.value=age;mistMat.uniforms.uScale.value=renderer.domElement.width/W;
 floor.material.uniforms.uOpacity.value=t<.35?.5:.5*(1-clamp(age/.10));});
}
const builds={bubble},lengths={bubble:1.5};
const postScene=new T.Scene(),postCam=new T.OrthographicCamera(-1,1,1,-1,0,1);
const post=new T.ShaderMaterial({uniforms:{uTex:{value:rt.texture},uDither:{value:1},uPixel:{value:new T.Vector2(1/180,1/320)}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}',fragmentShader:`precision mediump float;uniform sampler2D uTex;uniform float uDither;uniform vec2 uPixel;varying vec2 vUv;float bayer(vec2 p){vec2 q=mod(floor(p),4.);float x=q.x,y=q.y;return mod(x,2.)*8.+mod(y,2.)*12.-mod(x,2.)*mod(y,2.)*16.+floor(x/2.)*2.+floor(y/2.)*3.-floor(x/2.)*floor(y/2.)*4.;}vec3 bright(vec2 p){vec3 c=texture2D(uTex,p).rgb;return c*smoothstep(.82,1.,max(c.r,max(c.g,c.b)));}void main(){vec3 c=texture2D(uTex,vUv).rgb;vec3 bloom=vec3(0.);for(int i=0;i<8;i++){float a=float(i)*.785398;bloom+=bright(vUv+vec2(cos(a),sin(a))*uPixel*2.5)*.035;}gl_FragColor=vec4(c+bloom,1.);
#include <colorspace_fragment>
if(uDither>.5){float d=(bayer(gl_FragCoord.xy)/16.-.5)/31.;gl_FragColor.rgb=floor(clamp(gl_FragColor.rgb+d,0.,1.)*31.+.5)/31.;}}`});postScene.add(new T.Mesh(new T.PlaneGeometry(2,2),post));
function build(name){current=name;clear();placeActor(actors[0],name==='charge'?0:-103,name==='charge'?0:80);placeActor(actors[4],name==='charge'?105:15,name==='charge'?0:-12);builds[name]();}
function posScreen(p){const v=groundPoint(p.x,p.z);v.y+=p.y;v.project(camera);return {x:(v.x*.5+.5)*W,y:(-.5*v.y+.5)*H};}
function render(t=time){snapUniform.value=flags.snap?1:0;shellUniforms.forEach(u=>{u.uTime.value=t;u.uAffine.value=flags.affine?1:0;});animated.forEach(f=>f(t));energyMaterials.forEach(m=>{m.blending=flags.additive?T.AdditiveBlending:T.NormalBlending;m.depthWrite=false;});const size=flags.low?180:360;if(rt.width!==size)rt.setSize(size,size*H/W);post.uniforms.uPixel.value.set(1/rt.width,1/rt.height);renderer.setRenderTarget(rt);renderer.render(scene,camera);sceneTriangles=renderer.info.render.triangles;sceneDraws=renderer.info.render.calls;renderer.setRenderTarget(null);post.uniforms.uDither.value=flags.dither?1:0;renderer.render(postScene,postCam);renderer.autoClear=false;renderer.clearDepth();if(window.AIRY)renderer.render(AIRY.scene,camera);renderer.autoClear=true;const label=document.querySelector('.time-label');if(label)label.textContent=t.toFixed(2)+' s / '+lengths[current].toFixed(2)+' s';}
let last=performance.now();function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(playing&&!manual){time+=dt*speed;time%=lengths[current]+(current==='healing'?0:.65);}render();requestAnimationFrame(loop);}requestAnimationFrame(loop);
window.STUDY={cast(seed){if(seed===undefined){do{seed=crypto.getRandomValues(new Uint32Array(1))[0];}while(seed===castSeed);}if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new RangeError('Seed must be an unsigned 32-bit integer');castSeed=seed;build('bubble');render(time);return castSeed;},get seed(){return castSeed;},renderer,flags,lengths,build,render,position:posScreen,get current(){return current;},get time(){return time;},setTime(t){manual=true;time=t;render(t);},play(){manual=false;playing=!playing;return playing;},slow(){speed=speed===1?.25:1;return speed;},mount(el,name,newMode='spell'){mode=newMode;el.appendChild(renderer.domElement);time=0;manual=false;playing=true;build(name);render();},stats(){let allocatedTriangles=0;fx.traverse(o=>{if(o.isMesh)allocatedTriangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;});return {allocatedTriangles,activeSceneTriangles:sceneTriangles,activeSceneDraws:sceneDraws,postPassTriangles:renderer.info.render.triangles,programs:renderer.info.programs.length,webgl:renderer.capabilities.isWebGL2?'WebGL2':'WebGL1',textures:renderer.info.memory.textures,camera:{projection:'perspective',pitchDegrees:42,groundSquash:.75},puppetHeightPx:58,projectedPuppetHeightsPx:actors.map(a=>{const foot=a.position.clone().project(camera),top=a.position.clone().add(new T.Vector3(0,a.scale.y,0).applyQuaternion(camera.quaternion)).project(camera);return Math.abs(top.y-foot.y)*H/2;}),textureSize:[64,64],internalResolution:[rt.width,rt.height]};}};
build('bubble');render(0);window.__STUDY_READY=true;
})();
