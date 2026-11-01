// Approved study reference (three.js), ORKA-sl7u, version v2d;
// not runtime code;
// assets not included.
/* ORKA-sl7u visual proposal only. No simulation, timers or production assets changed. */
(()=>{
const T=THREE,TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
let seed=137;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const ready=[];
function tex(src){const t=new T.TextureLoader().load(src,()=>{});t.magFilter=t.minFilter=T.NearestFilter;t.generateMipmaps=false;t.colorSpace=T.SRGBColorSpace;ready.push(t);return t;}
const art={};for(const k of ['fara','kaja','runa','hondo','mirewing','arena'])art[k]=tex(ART[k]);
art.cast=ART['runa-cast'].map(tex);art.land=ART['spring-land'].map(tex);art.heal=ART['spring-heal'].map(tex);
function paint(n,fn){const c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d');fn(x,n);const t=new T.CanvasTexture(c);t.magFilter=t.minFilter=T.NearestFilter;t.generateMipmaps=false;t.colorSpace=T.SRGBColorSpace;return t;}
const streak=paint(64,(c,n)=>{let im=c.createImageData(n,n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){let v=x/(n-1),core=Math.exp(-Math.pow((v-.5)*4.2,2)),stripe=.62+.38*Math.pow(Math.cos(v*42+y*.065),12),a=core*stripe;let i=(y*n+x)*4;im.data.set([255,239+16*core,148+107*core,Math.round(a*255)],i);}c.putImageData(im,0,0);});
streak.wrapS=streak.wrapT=T.RepeatWrapping;
const glint=paint(32,(c,n)=>{const a=c.createRadialGradient(16,16,0,16,16,15);a.addColorStop(0,'rgba(255,255,255,1)');a.addColorStop(.15,'rgba(255,255,235,.8)');a.addColorStop(1,'rgba(255,195,40,0)');c.fillStyle=a;c.fillRect(0,0,n,n);c.fillStyle='#fffef2';c.beginPath();c.moveTo(16,0);c.lineTo(18.3,13.7);c.lineTo(32,16);c.lineTo(18.3,18.3);c.lineTo(16,32);c.lineTo(13.7,18.3);c.lineTo(0,16);c.lineTo(13.7,13.7);c.closePath();c.fill();});
const dot=paint(16,(c,n)=>{const g=c.createRadialGradient(8,8,0,8,8,8);g.addColorStop(0,'#fffff8');g.addColorStop(.25,'#fff5b0');g.addColorStop(1,'rgba(255,183,38,0)');c.fillStyle=g;c.fillRect(0,0,n,n);});
const halo=paint(64,(c,n)=>{const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,240,174,.6)');g.addColorStop(.55,'rgba(255,202,59,.32)');g.addColorStop(1,'rgba(255,163,21,0)');c.fillStyle=g;c.fillRect(0,0,n,n);});
const ringVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const ringFragment=`varying vec2 vUv;uniform float time;uniform float alpha;void main(){float r=length(vUv-.5);float expansion=1.-exp(-max(0.,time)*.55);float aa=max(fwidth(r),.001);float outer=.425+.035*expansion;float inner=.29+.045*expansion;float distance=min(abs(r-outer),abs(r-inner));float band=1.-smoothstep(.005,.005+aa,distance);float white=1.-smoothstep(.001,.001+aa,min(abs(r-(outer-.004)),abs(r-(inner-.004))));vec3 col=mix(vec3(1.,.66,.13),vec3(1.,.98,.87),white);gl_FragColor=vec4(col,alpha*band);}`;
function basic(map,color=0xffffff,opacity=1,add=true){return new T.MeshBasicMaterial({forceSinglePass:true,map,color,transparent:true,opacity,blending:add?T.AdditiveBlending:T.NormalBlending,depthWrite:false,side:T.DoubleSide});}
function heroMaterial(map){
 const material=basic(map,0xffffff,1,false),lift={value:0};material.userData.healLift=lift;
 // Add illumination without clipping channels or washing out source chroma.
 // Zero bypasses the conversion, preserving the exact ordinary sprite path.
 material.onBeforeCompile=shader=>{shader.uniforms.healLift=lift;shader.fragmentShader='uniform float healLift;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 if(healLift>0.){
  float peak=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b));
  float low=min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));
  // Add light along the sprite's own chroma, keeping its minimum channel fixed.
  // Monotonic channels survive the 8-bit PS1 pass without darkening or bleaching.
  vec3 light=peak>low?(diffuseColor.rgb-low)/(peak-low):vec3(1.);
  diffuseColor.rgb+=light*healLift*(1.-peak);
 }`);};return material;
}
function makeShaft(curtain=false){return new T.ShaderMaterial({forceSinglePass:true,transparent:true,depthWrite:false,side:T.DoubleSide,blending:curtain?T.NormalBlending:T.AdditiveBlending,uniforms:{map:{value:streak},time:{value:0},alpha:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform sampler2D map;uniform float time;uniform float alpha;void main(){vec4 c=texture2D(map,vec2(vUv.x,fract(vUv.y+time*.16)));float edge=smoothstep(0.,.10,vUv.y)*(1.-smoothstep(.72,1.,vUv.y));${curtain?'float core=exp(-pow((vUv.x-.5)*3.8,2.));float flow=.64+.24*c.a+.12*sin(vUv.y*29.+time*8.+vUv.x*17.);vec3 col=mix(vec3(1.,.58,.045),vec3(.96,.99,1.),pow(core,1.7));gl_FragColor=vec4(col,core*flow*edge*alpha);':'gl_FragColor=vec4(c.rgb,c.a*edge*alpha);'}}`});}
class Scene {
 constructor(host,mode='game',old=false){
  this.mode=mode;this.old=old;this.w=mode==='trace'?546:360;this.h=mode==='trace'?704:640;this.anim=[];this.actors=[];
  this.renderer=new T.WebGLRenderer({antialias:false,alpha:false,preserveDrawingBuffer:true});this.renderer.setPixelRatio(1);this.renderer.setSize(this.w,this.h,false);this.renderer.outputColorSpace=T.SRGBColorSpace;host.appendChild(this.renderer.domElement);
  this.renderer.domElement.setAttribute('aria-label',mode==='trace'?'Live reference construction trace':old?'Current 2D Healing Spring reconstruction':'Proposed WebGL healing on light sand');
  this.scene=new T.Scene();this.scene.background=new T.Color(mode==='trace'?0x82716f:0xd4ba85);
  const pitch=(mode==='trace'?18:42)*Math.PI/180;this.dist=(this.h/2)/Math.tan(20*Math.PI/180);this.camera=new T.PerspectiveCamera(40,this.w/this.h,1,6000);this.camera.position.set(0,this.dist*Math.sin(pitch),this.dist*Math.cos(pitch));this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld();
  this.rt=new T.WebGLRenderTarget(Math.round(this.w/2),this.h/2,{minFilter:T.NearestFilter,magFilter:T.NearestFilter});this.postScene=new T.Scene();this.postCam=new T.OrthographicCamera(-1,1,1,-1,0,1);this.postScene.add(new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({map:this.rt.texture})));
  this.bg();
  if(mode==='trace'){
   this.actor('fara',-125,242,270);this.actor('hondo',59,119,250);this.cast=this.anchor(-125,242);this.targets=[this.anchor(59,119)];this.unit=2.3;
  }else{
   this.actor('kaja',-95,0,58);this.actor('hondo',76,-122,58);this.actor('fara',-42,35,58);this.actor('runa',98,120,58);this.actor('mirewing',7,-8,58);this.cast=this.anchor(98,120);this.targets=[this.anchor(-42,35),this.anchor(-95,0)];this.unit=1;
   // gen/assets.json: Runa art faces right; her target-locked ally is left.
   const runa=this.actors.find(a=>a.name==='runa').a,sourceLeft=false,facesLeft=-42<98;
   if(sourceLeft!==facesLeft)runa.scale.x*=-1;
  }
  if(old)this.oldFX();else this.fx();this.render(0);
 }
 point(x,y){const p=new T.Vector3(x/(this.w/2),-y/(this.h/2),.5).unproject(this.camera);const d=p.sub(this.camera.position).normalize();return this.camera.position.clone().addScaledVector(d,-this.camera.position.y/d.y);}
 anchor(x,z){const y=this.mode==='trace'?z:z*.75,p=this.point(x,y),dx=this.point(x+1,y).sub(p),dz=this.point(x,y+(this.mode==='trace'?.23:.75)).sub(p),g=new T.Group();g.matrixAutoUpdate=false;g.matrix.makeBasis(dx,new T.Vector3(0,dx.length(),0),dz);g.matrix.setPosition(p);this.scene.add(g);return g;}
 bg(){
  const plane=new T.Mesh(new T.PlaneGeometry(this.w,this.h),basic(this.mode==='game'?art.arena:null,0xffffff,1,false));plane.quaternion.copy(this.camera.quaternion);plane.position.copy(this.camera.position).multiplyScalar(-.6);plane.scale.setScalar(1.6);plane.renderOrder=-100;
  if(this.mode==='trace'){
   const c=document.createElement('canvas');c.width=273;c.height=352;const x=c.getContext('2d');const sky=x.createLinearGradient(0,0,0,190);sky.addColorStop(0,'#8c8093');sky.addColorStop(1,'#beb09b');x.fillStyle=sky;x.fillRect(0,0,273,352);
   for(let i=0;i<16;i++){x.fillStyle=i%2?'#98928a':'#a79b8e';x.beginPath();let cx=i*23-20;x.moveTo(cx,190);x.lineTo(cx+25,112+rnd()*50);x.lineTo(cx+60,190);x.fill();}
   x.fillStyle='#625e3c';x.fillRect(0,185,273,167);for(let i=0;i<7000;i++){const y=185+rnd()*167;x.fillStyle=['#827049','#706443','#535a39','#9b8354'][i%4];x.fillRect(rnd()*273,y,1+rnd()*3,1);}
   const t=new T.CanvasTexture(c);t.magFilter=t.minFilter=T.NearestFilter;t.colorSpace=T.SRGBColorSpace;plane.material.map=t;
  }this.scene.add(plane);
 }
 actor(name,x,z,h){
  const a=new T.Mesh(new T.PlaneGeometry(1,1),heroMaterial(art[name]));a.material.alphaTest=.12;a.geometry.translate(0,.5,0);a.quaternion.copy(this.camera.quaternion);const p=this.point(x,this.mode==='trace'?z:z*.75);a.position.copy(p);const depth=-p.clone().applyMatrix4(this.camera.matrixWorldInverse).z,f=depth/this.dist;const aspect=name==='runa'?.633:name==='mirewing'?.89:.51;a.scale.set(h*aspect*f,h*f,1);a.renderOrder=2;this.scene.add(a);this.actors.push({a,h,name});
  const shadow=new T.Mesh(new T.CircleGeometry(h*.19,16),basic(null,0x312917,.22,false));shadow.rotation.x=-Math.PI/2;shadow.position.copy(p);shadow.position.y=.2;this.scene.add(shadow);
 }
 flat(g,r,inner,color,opacity=1,add=true){const o=new T.Mesh(inner?new T.RingGeometry(inner,r,24):new T.CircleGeometry(r,24),basic(null,color,opacity,add));o.rotation.x=-Math.PI/2;o.position.y=.5;g.add(o);return o;}
 face(g,map,x,y,z,w,h,material){const m=new T.Mesh(new T.PlaneGeometry(w,h),material||basic(map));m.quaternion.copy(this.camera.quaternion);m.position.set(x,y,z);m.renderOrder=4;g.add(m);return m;}
 disc(g,r){
  const ripple=new T.Mesh(new T.PlaneGeometry(r*2,r*2),new T.ShaderMaterial({forceSinglePass:true,uniforms:{time:{value:0},alpha:{value:0}},vertexShader:ringVertex,fragmentShader:ringFragment,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));ripple.rotation.x=-Math.PI/2;ripple.position.y=.8;g.add(ripple);
  const inner=new T.Mesh(new T.PlaneGeometry(r*2.25,r*2.25),basic(halo,0xffd77b,0));inner.rotation.x=-Math.PI/2;inner.position.y=.5;g.add(inner);return{ripple,inner};
 }
 fx(){
  const u=this.unit;this.castDisc=this.disc(this.cast,(this.mode==='trace'?78:45)*u);
  this.risers=Array.from({length:56},(_,i)=>{let angle=rnd()*TAU,r=(8+rnd()*(this.mode==='trace'?68:36))*u;let o=this.face(this.cast,null,Math.cos(angle)*r,0,Math.sin(angle)*r,1,1,makeShaft());return{o,x:Math.cos(angle)*r,z:Math.sin(angle)*r,h:(110+rnd()*130)*u,w:(.55+rnd()*.8)*u,phase:rnd(),speed:.7+rnd()*.7};});
  this.wisps=Array.from({length:6},(_,i)=>{const m=new T.Mesh(new T.RingGeometry((this.mode==='trace'?7.8:3.8)*u,(this.mode==='trace'?9.5:5.1)*u,12),basic(null,0x9470e2,0,false));m.quaternion.copy(this.camera.quaternion);this.cast.add(m);return{m,phase:i/6,a:rnd()*TAU};});
  this.blessings=this.targets.map((g,j)=>{
   const trace=this.mode==='trace',haloCard=this.face(g,halo,0,70*u,0,(trace?94:47)*u,195*u);haloCard.material.opacity=0;
   const disc=this.disc(g,(trace?43:23)*u);
   // Each curtain has six separated soft cards; its recipient occludes their light.
   const shafts=Array.from({length:6},(_,i)=>{const x=((i/5-.5)*2+(rnd()-.5)*.09)*(trace?40:17)*u;const h=((trace?177:137)+rnd()*54)*u;const o=this.face(g,null,x,h/2,0,1,1,makeShaft(true));return{o,x,h,w:((trace?16:9)+rnd()*(trace?10:6))*u,phase:rnd()};});
   const motes=Array.from({length:32},(_,i)=>{const phase=rnd(),end=3.5+phase*.65,star=i<28,hero=i<2,tier=hero?'hero':i<8?'medium':star?'small':'dot';
    // Preserve the approved random stream, positions and all later shaft construction.
    const sizeSeed=i<4?phase:rnd(),s=(hero?16+sizeSeed*6:i<8?8+sizeSeed*4:3+sizeSeed*2)*u*(trace&&star?1.65:1);
    const x=((i%7)/6-.5)*(trace?104:66)*u,y=(8+Math.floor(i/7)*(trace?31:24)+rnd()*13)*u;const o=this.face(g,star?glint:dot,x,y,(rnd()-.5)*8*u,s,s);o.renderOrder=8;o.material.opacity=0;
    o.updateWorldMatrix(true,false);const left=new T.Vector3(-s/2,0,0).applyMatrix4(o.matrixWorld).project(this.camera),right=new T.Vector3(s/2,0,0).applyMatrix4(o.matrixWorld).project(this.camera),pixelScale=s/(Math.abs(right.x-left.x)*this.w/2);
    const start=1.35+rnd()*.6,freq=1.4+rnd()*2;return{o,s,star,hero,tier,phase,end,start:hero?1.2+phase*.1+i*.2:start,y,freq,pixelScale,lifetime:hero?.32+phase*.15:end-start,peak:hero?.85+phase*.15:star?.5+phase*.5:1};});
   const actor=this.actors[trace?1:j===0?2:0].a;actor.renderOrder=6;
   const rim=new T.Mesh(actor.geometry,new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{map:{value:actor.material.map},alpha:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D map;uniform float alpha;void main(){vec2 d=vec2(.013,.006);float a=texture2D(map,vUv).a;float n=max(max(texture2D(map,vUv+vec2(d.x,0.)).a,texture2D(map,vUv-vec2(d.x,0.)).a),max(texture2D(map,vUv+vec2(0.,d.y)).a,texture2D(map,vUv-vec2(0.,d.y)).a));gl_FragColor=vec4(1.,.88,.53,max(0.,n-a)*alpha);}'}));rim.position.copy(actor.position);rim.quaternion.copy(actor.quaternion);rim.scale.copy(actor.scale);rim.renderOrder=7;this.scene.add(rim);
   return{g,disc,shafts,motes,haloCard,actor,rim,delay:j*.16};
  });
  if(this.mode==='game'){
   // Retained hazard shape: radius 138 world units, zoom .5, ground squash .75.
   this.pool=this.anchor(-42,35);this.poolDisc=this.disc(this.pool,69);
   // The retained pool carries the broad wash; each recipient owns its two rings.
   this.poolDisc.ripple.material.visible=false;
   this.tickGlints=this.targets.flatMap(g=>Array.from({length:6},(_,i)=>{const o=this.face(g,glint,(i%3-1)*12,12+Math.floor(i/3)*28,0,5,5);return o;}));
  }
 }
 oldFX(){
  this.oldLand=this.face(this.targets[0],art.land[0],0,0,0,48,36);this.oldLand.renderOrder=3;this.oldHeal=this.face(this.targets[0],art.heal[0],0,25,0,12,12);this.oldLand.material.opacity=this.oldHeal.material.opacity=0;
 }
 setDisc(d,a,t){d.ripple.material.uniforms.alpha.value=a*.78;d.ripple.material.uniforms.time.value=t;d.inner.material.opacity=a*.62;}
 update(t){
  if(this.old){let dt=t-1.2;this.oldLand.material.opacity=dt>=0&&dt<.3?1:0;this.oldHeal.material.opacity=dt>=0&&dt<.25?1:0;this.oldLand.material.map=art.land[Math.min(art.land.length-1,Math.max(0,Math.floor(dt*20)))];this.oldHeal.material.map=art.heal[Math.min(art.heal.length-1,Math.max(0,Math.floor(dt*20)))];return;}
  const u=this.unit,ct=this.anatomy?.65:t,cast=smooth(ct/.5)*(1-smooth((ct-.65)/.55));if(this.mode==='game'){const runa=this.actors.find(a=>a.name==='runa').a;runa.material.map=t<1.4?art.cast[Math.min(art.cast.length-1,Math.floor(t/1.4*art.cast.length))]:art.runa;}this.setDisc(this.castDisc,cast,ct);this.castDisc.ripple.material.uniforms.alpha.value=cast*.95;
  this.risers.forEach(({o,x,z,h,w,phase,speed})=>{const rise=((ct*speed+phase)%1);const onset=smooth((ct-phase*.3)/.45);o.scale.set(w,Math.max(.01,h*(.4+.6*Math.sin(rise*Math.PI))),1);o.position.set(x,((rise*.22)*h)+o.scale.y/2,z);o.material.uniforms.alpha.value=cast*onset*.85;o.material.uniforms.time.value=ct+phase*6;});
  this.wisps.forEach(({m,phase,a})=>{const age=ct-phase*.5,q=clamp(age/1.2);m.position.set(Math.cos(a)*27*u,(8+q*190)*u,Math.sin(a)*10*u);m.material.opacity=smooth(age/.32)*(1-smooth((age-.75)/.35))*.82;m.rotation.z=t*.22+phase;});
  this.blessings.forEach(b=>{
   const q=t-b.delay,on=smooth((q-1.2)/.5),ret=smooth((q-2.6)/1.2),energy=on*(1-ret);
   this.setDisc(b.disc,on*(1-smooth((q-2.6)/1.1))*.7,q-1.2);
   b.haloCard.material.opacity=energy*.18*(1-ret);
   b.actor.material.userData.healLift.value=energy*.2;b.rim.material.uniforms.alpha.value=energy*.85;
   b.shafts.forEach(({o,x,h,w,phase},i)=>{
    // Lower ends descend gently during emergence, then lift above the recipient.
    const retreat=smooth((q-2.6-phase*.15)/1.0);const lower=(1-on)*80*u+retreat*220*u;const height=h*(1-retreat*.56);o.position.set(x,lower+height/2,0);o.scale.set(Math.max(.005,w*(1-retreat*.97)),height,1);
    o.material.uniforms.alpha.value=on*(1-retreat)*(.64+.20*Math.sin(q*(2.2+phase*3)+phase*TAU));o.material.uniforms.time.value=q+phase*6;
   });
   b.motes.forEach(m=>{
    const tw=Math.pow(.5+.5*Math.sin(q*m.freq*TAU+m.phase*TAU),1.2),birth=smooth((q-m.start)/.3),tail=1-smooth((q-(m.end-.35))/.35);
    const age=(q-m.start)%(.8+m.freq*.015),heroPulse=q>=m.start&&q<3.65&&age<m.lifetime?Math.pow(Math.sin(age/m.lifetime*Math.PI),1.5):0;
    const scale=m.star?m.pixelScale:.58+tw*.42;m.o.scale.setScalar(scale);m.o.position.y=m.y+clamp(q-2.6)*7*u;m.o.material.opacity=m.peak*(m.hero?heroPulse:birth*tail*(.06+.94*tw));
   });
  });
  if(this.pool){const a=smooth((t-.2)/.5)*(1-smooth((t-10.2)/.8));this.setDisc(this.poolDisc,a*.23,t*.4);this.tickGlints.forEach((o,i)=>{const dt=(t-1.2)%1;const gate=t>4&&t<10&&dt>=0&&dt<.24;const e=gate?Math.sin(dt/.24*Math.PI):0;o.material.opacity=e*.55;o.scale.setScalar(.5+.5*e);});}
 }
 render(t){this.update(t);this.scene.traverse(o=>{if(o.isMesh&&o.material.transparent)o.visible=(o.material.uniforms?.alpha?.value??o.material.opacity)>.0001;});this.renderer.setRenderTarget(this.rt);this.renderer.render(this.scene,this.camera);this.drawCalls=this.renderer.info.render.calls;this.triangles=this.renderer.info.render.triangles;this.renderer.setRenderTarget(null);this.renderer.render(this.postScene,this.postCam);}
 stats(){return{mode:this.mode,old:this.old,internal:[this.rt.width,this.rt.height],triangles:this.triangles,drawCalls:this.drawCalls,textures:this.renderer.info.memory.textures,projectedActors:this.actors.map(({a,h,name})=>{const p=a.position.clone().project(this.camera),p2=a.position.clone().add(new T.Vector3(0,a.scale.y,0).applyQuaternion(this.camera.quaternion)).project(this.camera);return{name,height:Math.abs(p.y-p2.y)*this.h/2};}),pool:{worldRadius:138,screenRadius:69,squash:.75,duration:10},clock:{regen:.5,spring:1}};}
}
window.HealScene=Scene;
})();
