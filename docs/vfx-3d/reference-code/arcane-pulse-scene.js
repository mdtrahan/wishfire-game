/* ORKA-sl7u. Standalone visual proposal. No simulation writes. */
(()=>{
const T=THREE,TAU=Math.PI*2,C=(v)=>Math.max(0,Math.min(1,v)),lerp=(a,b,t)=>a+(b-a)*t;
// Slice gen/assets.json: actors.Kaja.facing = right.
const KAJA_ART_FACING='right',EFFECT_TIME_SCALE=2;
window.SPELL_TIME_SCALE=EFFECT_TIME_SCALE;
const countParam=Number(new URLSearchParams(location.search).get('count'));
const DEBUG_COUNT=Number.isInteger(countParam)&&countParam>=8&&countParam<=12?countParam:undefined;
const textures={},ready=[];
for(const [key,value] of Object.entries(ART)){
 if(key==='refs')continue;
 const load=src=>{const tx=new T.TextureLoader().load(src);tx.magFilter=tx.minFilter=T.NearestFilter;tx.colorSpace=T.SRGBColorSpace;ready.push(tx);return tx;};
 textures[key]=Array.isArray(value)?value.map(load):load(value);
}
textures.lightning.wrapS=textures.lightning.wrapT=T.RepeatWrapping;
const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
function shader(fragment,uniforms){return new T.ShaderMaterial({vertexShader:vertex,fragmentShader:'precision mediump float;varying vec2 vUv;'+fragment,uniforms,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});}
function basic(color,alpha=1,add=true){return new T.MeshBasicMaterial({color,opacity:alpha,transparent:true,depthWrite:false,side:T.DoubleSide,blending:add?T.AdditiveBlending:T.NormalBlending});}
function discMaterial(){return shader('uniform vec3 color;uniform float opacity;void main(){float r=length(vUv-.5)*2.;float a=pow(max(0.,1.-r),1.8);gl_FragColor=vec4(color,a*opacity);}',{color:{value:new T.Color(0xa433ff)},opacity:{value:1}});}
function seeded(s){return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function mesh(g,m,parent){const o=new T.Mesh(g,m);parent.add(o);return o;}
function plane(size,parent,color=0xad45ff){const m=discMaterial();m.uniforms.color.value.set(color).convertLinearToSRGB();return mesh(new T.PlaneGeometry(size,size),m,parent);}
function disposeGroup(g){while(g.children.length){const o=g.children.pop();o.geometry?.dispose();if(o.material)o.material.dispose();o.parent=null;}}
class View{
 constructor(canvas,trace=false){
  this.trace=trace;this.w=trace?450:360;this.h=trace?550:640;this.body=trace?80:58;this.squash=.75;
  this.renderer=new T.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});this.renderer.setPixelRatio(1);this.renderer.setSize(this.w,this.h,false);this.renderer.outputColorSpace=T.SRGBColorSpace;
  this.scene=new T.Scene();this.scene.background=new T.Color(trace?0x252832:0xd8c6a3);
  this.camera=new T.OrthographicCamera(-this.w/2,this.w/2,this.h/2,-this.h/2,1,2500);
  this.camera.position.set(0,this.squash*1000,Math.sqrt(1-this.squash**2)*1000);this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld();
  this.rt=new T.WebGLRenderTarget(this.w/2,this.h/2,{minFilter:T.NearestFilter,magFilter:T.NearestFilter});
  this.post=new T.Scene();this.postCam=new T.OrthographicCamera(-1,1,1,-1,0,1);
  mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({uniforms:{map:{value:this.rt.texture}},vertexShader:vertex,fragmentShader:'precision mediump float;varying vec2 vUv;uniform sampler2D map;void main(){vec3 c=texture2D(map,vUv).rgb;float b=mod(floor(gl_FragCoord.x)+mod(floor(gl_FragCoord.y),2.)*2.,4.)/4.;c=floor(c*31.+b)/31.;gl_FragColor=vec4(c,1.);}',depthTest:false}),this.post);
  this.base=new T.Group();this.scene.add(this.base);
  if(trace)this.traceTerrain();else{
   const backdrop=mesh(new T.PlaneGeometry(this.w,this.h),new T.MeshBasicMaterial({map:textures.arena,depthWrite:false}),this.base);
   backdrop.quaternion.copy(this.camera.quaternion);backdrop.position.copy(this.camera.position).multiplyScalar(-.3);backdrop.renderOrder=-10;
  }
  this.caster=trace?new T.Vector3(0,0,100):new T.Vector3(-20,0,115);
  this.target=trace?new T.Vector3(65,0,-80):new T.Vector3(35,0,-20);
  if(trace){this.actor('kaja',this.caster,80);this.actor('mirewing',this.target,80);}
  else{this.actor('kaja',this.caster,58);this.actor('fara',new T.Vector3(-104,0,-58),58);this.actor('runa',new T.Vector3(101,0,150),58);this.actor('hondo',new T.Vector3(116,0,-130),58);for(const [dx,dz]of [[0,0],[-34,-25],[38,-42]])this.actor('mirewing',this.target.clone().add(new T.Vector3(dx,0,dz)),58);}
  this.dynamic=new T.Group();this.scene.add(this.dynamic);this.stats={};this.setSeed(7404);
 }
 traceTerrain(){
  const r=seeded(339),c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),p=x.createImageData(128,128);
  for(let i=0;i<p.data.length;i+=4){const n=48+r()*12;p.data.set([n*.87,n*.93,n,255],i);}x.putImageData(p,0,0);
  const tx=new T.CanvasTexture(c);tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.repeat.set(7,7);tx.magFilter=tx.minFilter=T.NearestFilter;
  const ground=mesh(new T.PlaneGeometry(2000,2000,12,12),new T.MeshBasicMaterial({map:tx}),this.base);ground.rotation.x=-Math.PI/2;ground.position.y=-1;
  for(let i=0;i<8;i++){const mountain=mesh(new T.ConeGeometry(180+r()*120,100+r()*100,5),new T.MeshBasicMaterial({color:i%2?0x252632:0x30303b}),this.base);mountain.position.set(-800+i*220,35,-850-r()*150);}
 }
 actor(name,pos,h){const a=new T.Sprite(new T.SpriteMaterial({map:textures[name],depthWrite:false,alphaTest:.04}));a.center.set(.5,0);a.position.copy(pos);const image=textures[name].image;if(name==='kaja')a.material.map=textures[name].clone();this.base.add(a);this.actorSprites??=[];this.actorSprites.push({a,name,h});}
 screen(p){const n=p.clone().project(this.camera);return[(n.x+1)*this.w/2,(1-n.y)*this.h/2];}

 point(x,y){return new T.Vector3(x-this.w/2,this.h/2-y,0).applyQuaternion(this.camera.quaternion);}
 setSeed(seed,countOverride=DEBUG_COUNT){
  this.seed=seed>>>0;const r=seeded(this.seed),rolledCount=8+Math.floor(r()*5);this.count=countOverride??rolledCount;
  const start=this.screen(this.caster.clone().add(new T.Vector3(0,this.body*.72,0)));
  const end=this.screen(this.target.clone().add(new T.Vector3(0,this.body*.48,0)));
  const dx=end[0]-start[0],dy=end[1]-start[1];
  // Immutable v4c-b seed-1456 left bows (beams 10 and 6), mirrored on the right.
  const outer=[[.2522677418775857,-.8622257295977709],[.6319342260807751,-.1590524583508562]];
  const inner=[[.23252791421487892,-.40975136041685756],[.6352939597517252,-.07321864887858688]];
  const specs=[['LO',outer,1],['LI',inner,1],['M',inner,0],['RI',inner,-1],['RO',outer,-1]];
  const curve=(controls,side,widthScale=1)=>new T.CubicBezierCurve3(this.point(...start),
   ...controls.map(([f,l])=>this.point(start[0]+dx*f-dy*l*side*widthScale,start[1]+dy*f+dx*l*side*widthScale)),this.point(...end));
  this.paths=specs.map(([id,controls,side])=>({id,curve:curve(controls,side)}));
  const guaranteed=[0,1,2,3,4];
  for(let i=4;i>0;i--){const j=Math.floor(r()*(i+1));[guaranteed[i],guaranteed[j]]=[guaranteed[j],guaranteed[i]];}
  // Reserve one use per path; independent launch times interleave these with extras.
  let chosen,counts;
  do{chosen=[...guaranteed,...Array.from({length:this.count-5},()=>Math.floor(r()*5))];counts=specs.map((_,i)=>chosen.filter(p=>p===i).length);}
  while(Math.max(...counts)-Math.min(...counts)<2);
  this.beams=chosen.map((pathIndex,i)=>{
   const [pathId,controls,side]=specs[pathIndex],widthJitter=side?(r()<.5?-1:1)*(.03+r()*.03):0;
   return {pathId,pathIndex,widthJitter,curve:curve(controls,side,1+widthJitter),flight:.35+(r()-.5)*.025,
    history:.16+r()*.025,lines:10+Math.floor(r()*7),behind:r()<.5,angle:r()*TAU};
  });
  // Sorted random samples leave irregular gaps; .04 authored = .08 real seconds.
  for(let pathIndex=0;pathIndex<5;pathIndex++){
   const group=this.beams.filter(b=>b.pathIndex===pathIndex),gap=.04,window=.5-gap*(group.length-1);
   for(let i=group.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[group[i],group[j]]=[group[j],group[i]];}
   const launches=group.map(()=>r()*window).sort((a,b)=>a-b);
   group.forEach((b,i)=>{b.launch=launches[i]+i*gap;b.arrival=b.launch+b.flight;});
  }
  const shift=.45-Math.min(...this.beams.map(b=>b.arrival));
  for(const b of this.beams){b.launch+=shift;b.arrival+=shift;}
  this.finalBeam=this.beams.reduce((a,b)=>a.arrival>b.arrival?a:b);
  this.end=(this.finalBeam.arrival+.22)*EFFECT_TIME_SCALE;
 }
 billboard(x,y,size,color,alpha,order=4){const o=plane(size,this.dynamic,color);o.position.copy(this.point(x,y));o.quaternion.copy(this.camera.quaternion);o.material.uniforms.opacity.value=alpha;o.material.depthTest=false;o.renderOrder=order;return o;}
 line(a,b,width,color,alpha,order=4){const d=b.clone().sub(a),right=new T.Vector3(0,0,1).applyQuaternion(this.camera.quaternion),n=new T.Vector3().crossVectors(d,right).normalize().multiplyScalar(width/2);const verts=[a.clone().add(n),a.clone().sub(n),b.clone().add(n),b.clone().add(n),a.clone().sub(n),b.clone().sub(n)],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts.flatMap(v=>v.toArray()),3));const m=basic(color,alpha);m.color.convertLinearToSRGB();m.depthTest=false;const o=mesh(g,m,this.dynamic);o.renderOrder=order;}
 trail(b,age){
  const progress=C(age/b.flight),dart=progress>=.5;
  const along=t=>{if(t<.5)return b.curve.getPoint(t*1.2);const q=(t-.5)/.5;return b.curve.getPoint(.6).lerp(b.curve.v3,.25*q+.75*q*q);};
  const direction=dart?b.curve.v3.clone().sub(b.curve.getPoint(.6)).normalize():null;
  const tail=Math.max(dart?.5:0,C((age-b.history*(dart?.45:.65))/b.flight)),pos=[],uv=[],N=28;
  const head=along(progress),tailPoint=along(tail);let tailLimit=1;
  if(dart){const oldTail=C((age-b.history)/b.flight);let length=0,previous=b.curve.getPoint(oldTail);for(let i=1;i<=12;i++){const next=b.curve.getPoint(oldTail+(progress-oldTail)*i/12);length+=previous.distanceTo(next);previous=next;}tailLimit=Math.min(1,.45*length/Math.max(.001,head.distanceTo(tailPoint)));}
  const facing=new T.Vector3(0,0,1).applyQuaternion(this.camera.quaternion);
  const pair=(u)=>{const t=tail+(progress-tail)*u,p=dart?head.clone().lerp(tailPoint,(1-u)*tailLimit):along(t),d=dart?direction:b.curve.getTangent(t*1.2),n=new T.Vector3().crossVectors(d,facing).normalize().multiplyScalar((.12+.88*Math.pow(u,.7))*6*this.body/58);return[p.clone().add(n),p.clone().sub(n)];};
  for(let i=0;i<N;i++){const u=i/N,v=(i+1)/N,[a,c]=pair(u),[d,e]=pair(v);[a,c,d,d,c,e].forEach(p=>pos.push(...p.toArray()));uv.push(u,0,u,1,v,0,v,0,u,1,v,1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  const m=shader(`uniform sampler2D gradient;void main(){vec4 g=texture2D(gradient,vec2(vUv.y,.5));vec3 col=vUv.x<.48?mix(vec3(.55,.07,1.),vec3(.05,.25,1.),vUv.x/.48):mix(vec3(.05,.25,1.),vec3(.03,1.,1.),(vUv.x-.48)/.52);float core=pow(max(0.,1.-abs(vUv.y-.5)*2.),12.);col=mix(col,vec3(1.,.98,1.),core*.98);gl_FragColor=vec4(col,g.a*pow(vUv.x,.65));}`,{gradient:{value:trailTexture}});m.depthTest=false;const ribbon=mesh(g,m,this.dynamic);ribbon.renderOrder=b.behind&&progress<.48?-1:3;
  const h=along(progress),p=this.screen(h),s=this.body/58;
  const order=b.behind&&progress<.48?-1:4;this.billboard(...p,18*s,0x008aff,.8,order);this.billboard(...p,11*s,0x60eaff,1.5,order);const core=this.billboard(...p,5*s,0xffffff,dart?2.6:2,order);
  if(dart){const q=this.screen(h.clone().add(direction)),angle=Math.atan2(-(q[1]-p[1]),q[0]-p[0]);core.rotateZ(angle);core.scale.set(1.2+1.1*(progress-.5),.85,1);}
 }
 render(time){
  time/=EFFECT_TIME_SCALE; // All authored effect clocks share this mapping, including trail history.
  for(const {a,name,h}of this.actorSprites){if(name==='kaja'){const facesLeft=this.screen(this.target)[0]<this.screen(a.position)[0],flip=(KAJA_ART_FACING==='left')!==facesLeft;a.material.map.repeat.x=flip?-1:1;a.material.map.offset.x=flip?1:0;}const im=textures[name].image;if(im)a.scale.set(h*im.width/im.height,h,1);}
  disposeGroup(this.dynamic);const s=this.body/58,hand=this.screen(this.caster.clone().add(new T.Vector3(0,this.body*.72,0))),hit=this.screen(this.target.clone().add(new T.Vector3(0,this.body*.48,0))),foot=this.screen(this.target);
  if(time>0&&time<.25){const q=Math.sin(time/.25*Math.PI);this.billboard(...hand,25*s,0x8a12ff,q*.8);this.billboard(...hand,12*s,0xe299ff,q*1.4);this.billboard(...hand,6*s,0xffffff,q*2);for(let i=0;i<7;i++){const a=i*TAU/7+time*12,r=(8+5*Math.sin(time*25+i))*s;const x=hand[0]+Math.cos(a)*r,y=hand[1]+Math.sin(a)*r;this.line(this.point(x,y),this.point(x+Math.cos(a)*3*s,y+Math.sin(a)*3*s),.9*s,0xe8c8ff,q);}}
  let lift=0,active=0;
  this.beams.forEach((b,i)=>{
   const age=time-b.launch;if(age>=0&&age<b.flight)this.trail(b,age);
   const t=time-b.arrival;if(t<0||t>=.22)return;active++;const f=t/.22,fade=(1-f)**1.7,final=b===this.finalBeam?1.12:1;
   lift=Math.max(lift,.38*(1-C(t/.10)));
   // Ground targeting reticle is independent of the body blast.
   const rx=(17+10*f)*s*final,ry=rx*.47;
   for(let j=0;j<40;j++){const a=j/40*TAU,c=(j+1)/40*TAU;this.line(this.point(foot[0]+Math.cos(a)*rx,foot[1]+Math.sin(a)*ry),this.point(foot[0]+Math.cos(c)*rx,foot[1]+Math.sin(c)*ry),1.1*s,0xffd83c,fade*.85,2);}
   for(let j=0;j<4;j++){const a=j*Math.PI/2;this.line(this.point(foot[0]+Math.cos(a)*(rx-3*s),foot[1]+Math.sin(a)*(ry-2*s)),this.point(foot[0]+Math.cos(a)*(rx+4*s),foot[1]+Math.sin(a)*(ry+4*s)),1.1*s,0xfff4a0,fade,2);}
   this.billboard(...hit,(28+15*f)*s*final,0xffc92e,fade*.75);this.billboard(...hit,(15+9*f)*s*final,0xfff1b4,fade*1.5);this.billboard(...hit,(7+4*f)*s,0xffffff,fade*2);
   for(let j=0;j<b.lines;j++){const a=b.angle+j/b.lines*TAU,inner=(5+18*f)*s,outer=inner+(23+10*Math.sin(j*4.3))*(1-f)*s*final;this.line(this.point(hit[0]+Math.cos(a)*inner,hit[1]+Math.sin(a)*inner),this.point(hit[0]+Math.cos(a)*outer,hit[1]+Math.sin(a)*outer),1.05*s,0xffe36a,fade);}
  });
  if(lift>0){const a=this.actorSprites.find(x=>x.name==='mirewing');const m=new T.SpriteMaterial({map:textures.mirewing,transparent:true,opacity:lift,blending:T.AdditiveBlending,depthTest:false,depthWrite:false});const o=new T.Sprite(m);o.center.copy(a.a.center);o.position.copy(a.a.position);o.scale.copy(a.a.scale);o.renderOrder=1;this.dynamic.add(o);}
  this.renderer.setRenderTarget(this.rt);this.renderer.render(this.scene,this.camera);this.stats={triangles:this.renderer.info.render.triangles,draws:this.renderer.info.render.calls,count:this.count,activeHits:active};this.renderer.setRenderTarget(null);this.renderer.render(this.post,this.postCam);this.time=time;
 }
}
const tc=document.createElement('canvas');tc.width=64;tc.height=2;const ctx=tc.getContext('2d'),grad=ctx.createLinearGradient(0,0,64,0);grad.addColorStop(0,'rgba(255,255,255,0)');grad.addColorStop(.3,'rgba(255,255,255,.6)');grad.addColorStop(.46,'rgba(255,255,255,1)');grad.addColorStop(.54,'rgba(255,255,255,1)');grad.addColorStop(.7,'rgba(255,255,255,.6)');grad.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,2);const trailTexture=new T.CanvasTexture(tc);trailTexture.magFilter=trailTexture.minFilter=T.LinearFilter;
window.SpellView=View;window.spellTextures=textures;
})();
