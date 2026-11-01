import { smooth as s, clamp01 as c } from './rustCombatEffects.mjs';
const TAU=Math.PI*2,PITCH=42*Math.PI/180,DIST=320/Math.tan(20*Math.PI/180),SP=Math.sin(PITCH),CP=Math.cos(PITCH);
const FACES=[[0,2,1],[0,3,2],[0,4,3],[0,1,4],[1,5,2],[2,5,6],[2,6,3],[3,6,7],[3,7,4],[4,7,8],[4,8,1],[1,8,5],[5,8,6],[6,8,7]];
const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const PALETTE=[0x3a3d3c,0x7a7c78,0xb8b8b0].map(hex=>[linear((hex>>16)/255),linear((hex>>8&255)/255),linear((hex&255)/255)]);
const sortPuffs=(a,b)=>b.depth-a.depth;
function ground(x,y){const depth=DIST/(1+y*.75/DIST/Math.tan(PITCH));return[x*depth/DIST,0,y*.75*depth/DIST/SP];}
export function createPoundModel(h){
 const dx=h.dir.x*h.shape.length*.5,dy=h.dir.y*h.shape.length*.5*.75,rocks=[];
 for(let i=0;i<8;i++){
  let r;if(i<4){const q=i/3,f=.15+i*.21;r={bx:dx*f,bz:dy*f/.75,h:18+27*q,r:8+10*q,lx:-8-8*q,lz:0,born:.73+i*.14,end:false,closing:false,rotation:.58,studyX:-100+120*f,studyY:100-90*f};}
  else{const values=[[-25,-5,86,25,-39,-6,1.3,.42],[27,-8,94,26,31,-9,1.34,.72],[-1,11,78,26,-15,7,1.39,.42],[1,27,69,25,0,0,1.73,-.38]][i-4];const[x,d,height,radius,lx,lz,born,rotation]=values;r={bx:dx+x,bz:dy/.75+d,h:height,r:radius,lx,lz,born,end:true,closing:i===7,rotation,studyX:20+x,studyY:10+d};}
  r.base=ground(r.studyX,r.studyY);r.cluster=ground(r.end?20:r.studyX,r.end?10:r.studyY);r.d=(DIST-r.cluster[2]*CP)/DIST;r.height=r.h*(DIST-r.base[2]*CP)/(DIST*CP+(r.h-r.studyY*.75)*SP);r.radius=r.r*r.d;const radius=r.radius,height=r.height,lx=r.lx*r.d,lz=r.lz*r.d;
  r.vertices=new Float64Array([0,-height*.15,0,-radius,height*.34,-radius*.65,radius*.85,height*.40,-radius*.65,radius,height*.45,radius*.65,-radius*.85,height*.38,radius*.65,-radius*.54+lx,height*.91,-radius*.35+lz,radius*.48+lx,height,-radius*.35+lz,radius*.50+lx,height*.88,radius*.34+lz,-radius*.51+lx,height*.83,radius*.34+lz]);r.world=new Float64Array(27);rocks.push(r);
 }
 const puffs=Array.from({length:92},(_,i)=>{const retreat=i>=40,j=retreat?i-40:i%10;let p;
  if(!retreat){const rock=rocks[Math.floor(i/10)],q=Math.floor(i/10)/3,offset=rock.born;p={base:rock,born:offset+.03+Math.max(0,j-3)*.015,life:.90+j%5*.07,width:50+q*70,height:38+q*28,radius:2+j%4*1.8,drift:10+j%5*2,lift:5+j%3*2,low:j>=8,angle:j*2.399963+offset*.7,seed:j*1.73+offset*13,spin:(j%2===1?1:-1)*(.24+j%5*.11),layer:0,shade:1};}
  else{const ring=j<8,body=j>=8&&j<48,wisp=j>=48,k=body?j-8:j,rock=rocks[4+(body?(k>=20?3:Math.floor(k/7)):j%4)],low=ring||body&&k%10<5,born=wisp?2.02+(j-48)*.035:1.6+j%5*.012;p={base:rock,born,life:2.92-born,width:ring?50:wisp?38:low?64:50+k%4*4,height:ring?34:wisp?42:low?53:48+k%3*4,radius:ring?12:3+k%5*2,drift:ring?37:wisp?30:22+k%4*3,lift:low?8:wisp?35:20+k%4*3,low,angle:j*2.399963,seed:j*1.73+1.28*13,spin:(j%2===1?1:-1)*(.8+j%5*.23),layer:k%5,shade:.83+j%5*.09};}
  return{...p,j,retreat,visible:false,depth:0,x:0,y:0,z:0,growth:0,alpha:0,color:0};
 });return{rocks,puffs,poly:new Float64Array(24),clipped:new Float64Array(24)};
}
function rock(g,m,r,ox,oy,a,z){
 if(a<r.born)return;const rise=s((a-r.born)/(r.end?.15:.12)),release=r.end?0:s((a-r.born-.34)/.5),sinkAt=r.end?(r.closing?2.11:1.9):r.born+.48,sink=r.end?1-(1-c((a-sinkAt)/.25))**3:s((a-sinkAt)/.38);if(sink>=1)return;
 const sy=.72+.28*rise,shift=r.height*(1-rise)+r.height*sink,cr=Math.cos(r.rotation),sr=Math.sin(r.rotation),cx=Math.cos(.035),sx=Math.sin(.035),v=r.vertices,w=r.world;
 for(let i=0;i<9;i++){const x=v[i*3],y=v[i*3+1]*sy,z=v[i*3+2],rx=x*cr+z*sr,rz=-x*sr+z*cr;w[i*3]=rx;w[i*3+1]=y*cx-rz*sx-shift;w[i*3+2]=y*sx+rz*cx;}
 g.quad(ox+r.bx,oy+r.bz*.75,r.r*2.1*z,r.r*1.45*.75*z,0,0x161310,.72*rise*(1-sink)*(1-release),0,'alpha');
 for(const face of FACES){const i0=face[0]*3,i1=face[1]*3,i2=face[2]*3,ax=v[i1]-v[i0],ay=v[i1+1]-v[i0+1],az=v[i1+2]-v[i0+2],bx=v[i2]-v[i0],by=v[i2+1]-v[i0+1],bz=v[i2+2]-v[i0+2],rawX=ay*bz-az*by,rawY=az*bx-ax*bz,rawZ=ax*by-ay*bx;
  let nx=rawX,ny=rawY/sy,nz=rawZ,nn=Math.hypot(nx,ny,nz)||1;nx/=nn;ny/=nn;nz/=nn;const nrx=nx*cr+nz*sr,nrz=-nx*sr+nz*cr,nry=ny*cx-nrz*sx,nrz2=ny*sx+nrz*cx,npy=nry*CP-nrz2*SP,npz=nry*SP+nrz2*CP;
  const midX=(w[i0]+w[i1]+w[i2])/3+r.base[0],midY=(w[i0+1]+w[i1+1]+w[i2+1])/3,midZ=(w[i0+2]+w[i1+2]+w[i2+2])/3+r.base[2],vx=-midX,vy=DIST*SP-midY,vz=DIST*CP-midZ;
  if(nrx*vx+npy*(vy*CP-vz*SP)+npz*(vy*SP+vz*CP)<=0)continue;
  const light=(nrx*-.65+npy*.8+npz*.55)/Math.hypot(.65,.8,.55),shadeT=light<.32?c((light+.25)/.57):c((light-.32)/.48),pa=PALETTE[light<.32?0:1],pb=PALETTE[light<.32?1:2],shadeR=pa[0]+(pb[0]-pa[0])*shadeT,shadeG=pa[1]+(pb[1]-pa[1])*shadeT,shadeB=pa[2]+(pb[2]-pa[2])*shadeT;
  const length=Math.hypot(ax,ay,az)||1,tx=ax/length,ty=ay/length,tz=az/length,nlength=Math.hypot(rawX,rawY,rawZ)||1,btx=(rawY*tz-rawZ*ty)/nlength,bty=(rawZ*tx-rawX*tz)/nlength,btz=(rawX*ty-rawY*tx)/nlength;
  const poly=m.poly,out=m.clipped;for(let j=0;j<3;j++){const index=face[j]*3;for(let k=0;k<3;k++){poly[j*6+k]=v[index+k];poly[j*6+k+3]=w[index+k];}}
  let count=0;for(let j=0;j<3;j++){const ai=j*6,bi=(j+1)%3*6,wa=poly[ai+4],wb=poly[bi+4];if(wa>=0){for(let k=0;k<6;k++)out[count*6+k]=poly[ai+k];count++;}if((wa>=0)!==(wb>=0)){const t=wa/(wa-wb);for(let k=0;k<6;k++)out[count*6+k]=poly[ai+k]+(poly[bi+k]-poly[ai+k])*t;count++;}}
  if(count<3)continue;g.use(3,'solid');const baseScale=DIST/(DIST-r.base[1]*SP-r.base[2]*CP),baseX=r.base[0]*baseScale,baseY=(r.base[2]*SP-r.base[1]*CP)*baseScale;
  const age=a-(r.end?1.28:r.born),heat=s(age/.04)*(1-s((age-(r.end?.3:.08))/.2)),close=s((a-1.75)/.04)*(1-s((a-1.87)/.2));
  for(let k=1;k<count-1;k++)for(let j=0;j<3;j++){const index=(j===0?0:j===1?k:k+1)*6,lx=out[index],ly=out[index+1],lz=out[index+2],wx=out[index+3],wy=out[index+4],wz=out[index+5],px=r.base[0]+wx,py=wy,pz=r.base[2]+wz,ps=DIST/(DIST-py*SP-pz*CP),screenX=ox+r.bx+(px*ps-baseX)*z,screenY=oy+r.bz*.75+((pz*SP-py*CP)*ps-baseY)*z,uvx=((lx-v[i0])*tx+(ly-v[i0+1])*ty+(lz-v[i0+2])*tz)/(2*r.radius),uvy=((lx-v[i0])*btx+(ly-v[i0+1])*bty+(lz-v[i0+2])*btz)/(2*r.radius),gain=.67+.43*c(ly/r.height),color=Math.floor(c(shadeR*gain)*255)<<16|Math.floor(c(shadeG*gain)*255)<<8|Math.floor(c(shadeB*gain)*255),fireZ=r.cluster[2]+(r.end&&close>0?27*r.d:0),dist=Math.hypot(px-r.cluster[0],py-7*r.d,pz-fireZ),hot=Math.max(0,1-dist/(88*r.d))**2*Math.max(heat,r.end?close:0);g.vertex(screenX,screenY,-wy*z*.00001-(r.bz+wz*z)*.000001,uvx,uvy,color,.99*(1-release),hot,0,0,1);}
 }
}
export function drawPound(g,m,h,camera,a,front){
 if(a<0||a>=2.92)return;const z=camera.zoom/.5,ox=camera.x(h.origin.x),oy=camera.y(h.origin.y),ex=camera.x(h.origin.x+h.dir.x*h.shape.length),ey=camera.y(h.origin.y+h.dir.y*h.shape.length),dx=ex-ox,dy=ey-oy;
 if(!front){const fade=s(a/.08)*(1-s((a-.67)/.1)),pulse=.72+.28*Math.sin(a*45);g.quad(ox,oy,106*z,79.5*z,0,0xffb653,fade*.75);g.glow(ox+12*z,oy-31*z,(28+8*pulse)*z,0xffcc64,fade*pulse);g.glow(ox+12*z,oy-31*z,(13+5*pulse)*z,0xffffff,fade);}
 for(let i=0;i<8;i++){const r=m.rocks[i];if(front!==(r.end&&i>=6))continue;rock(g,m,r,ox,oy,a,z);}
 if(!front)return;const u=c((a-.7)/.6);if(a>=.68&&a<1.39){const px=ox+dx*u,py=oy+dy*u-5*z,fade=s((a-.68)/.05)*(1-s((a-1.3)/.09));g.quad(px,py,(48+20*u)*z,(23+8*u)*z,0,0xffffff,fade,8);g.quad(px,py,(28+10*u)*z,14*z,0,0xffffff,fade);}
 for(let j=0;j<5;j++){const last=j===4,q=j/3,born=last?1.28:.73+j*.14,age=a-born,close=last?s((a-1.75)/.04)*(1-s((a-1.87)/.2)):0,bloom=Math.max(s(age/.04)*(1-s((age-(last?.3:.08))/.2)),close),px=last?ex:ox+dx*(.15+j*.21),py=(last?ey:oy+dy*(.15+j*.21))+(close>0?27*.75*z:0);g.quad(px,py-7*z,(last?105:39+q*31)*z,(last?59:23+q*20)*z,0,0xffffff,bloom*.95,8);g.quad(px,py-6*z,(last?68:23+q*22)*z,(last?32:14+q*15)*z,0,0xffffff,bloom*.89);for(let k=0;k<(last?2:1);k++){const t=(age-k*.06)/.45;if(t>=0&&t<1){const rx=(last?31.5:15.5+q*8)*(.55+t*1.7)*z;g.ring(px,py,rx,rx*.75,z,0xffe9b2,(1-t)*.32,32);}}}
 gas(g,m,ox,oy,a,z);
}
function gas(g,m,ox,oy,a,z){
 for(const p of m.puffs){const u=(a-p.born)/p.life;p.visible=u>=0&&u<1;if(!p.visible)continue;const slowed=(1-Math.exp(-2.6*u))/(1-Math.exp(-2.6)),r=(p.radius+p.drift*slowed)*z;
  if(p.retreat){p.x=p.base.bx+Math.cos(p.angle)*r+Math.sin(u*9+p.seed)*4*z;p.y=((p.low?7:17+p.layer*5)+p.lift*(1-Math.exp(-8*u))+Math.sin(u*7+p.seed)*3)*z;p.z=p.base.bz+Math.sin(p.angle)*r+(p.low?38:-12)*z;}
  else{p.x=p.base.bx+Math.cos(p.angle)*r+Math.sin(u*5.4+p.seed)*2.2*z;p.y=(p.low?13:18)*z+p.lift*slowed*z;p.z=p.base.bz+Math.sin(p.angle)*r+12*z+Math.cos(u*4.7+p.seed)*1.7*z;}
  p.growth=p.retreat?.35+.75*s(u/.22)+.28*s((u-.22)/.78):u<.55?.2+.8*s(u/.55):1+.1*s((u-.55)/.45);p.alpha=p.retreat?.36*s(u/.13)*(1-s((u-.43)/.57)):u<.15?.36*s(u/.15):u<.55?.36-.08*s((u-.15)/.4):.28*(1-s((u-.55)/.45));const birth=p.retreat?(p.low?0xa57b4c:0xd1ad73):p.low?0x92704e:0x9a7650,mix=s(p.retreat?u:(u-.15)/.85);p.color=Math.floor(c((((birth>>16)&255)*(1-mix)+215*mix)/255*p.shade)*255)<<16|Math.floor(c((((birth>>8)&255)*(1-mix)+189*mix)/255*p.shade)*255)<<8|Math.floor(c(((birth&255)*(1-mix)+141*mix)/255*p.shade)*255);p.depth=p.z*.6614378+p.y*.75;
 }
 m.puffs.sort(sortPuffs);for(const p of m.puffs)if(p.visible)g.quad(ox+p.x,oy+p.z*.75-p.y,p.width*p.growth*z,p.height*p.growth*z,p.j*.71+p.spin*(a-p.born),p.color,p.alpha,2,'gas',a,p.seed,p.retreat?1:0);
}
