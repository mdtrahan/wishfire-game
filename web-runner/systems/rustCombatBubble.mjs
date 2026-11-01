import { clamp01 as c, smooth as s } from './rustCombatEffects.mjs';
const TAU=Math.PI*2;
export class SliceRng {
  constructor(seed){this.value=seed>>>0;}
  next(){this.value=(Math.imul(this.value,1664525)+1013904223)>>>0;return Math.min(Math.fround(this.value/4294967296),.9999999403953552);}
  sphere(){const y=this.next()*2-1,a=this.next()*TAU,r=Math.sqrt(1-y*y);return [r*Math.cos(a),y,r*Math.sin(a)];}
}
const norm=p=>{const l=Math.hypot(...p);return p.map(v=>v/l);};
function surface(n){const p=n.map(v=>v*83),w=Math.sin(p[1]*.12+.35*14+p[0]*.04)*1.8;return[p[0]+n[0]*w,p[1]+n[1]*w+108,p[2]+n[2]*w];}
function position(p,v,a){const t=(1-Math.exp(-6*a))/6;return[p[0]+v[0]*t,p[1]+v[1]*t-48*a-13*a*a,p[2]+v[2]*t];}
export function createBubbleModel(seed){
  const varied=seed!==91731,motion=new SliceRng(seed),bias=varied?motion.sphere().map(x=>x*.075):[0,0,0],turn=varied?motion.next()*TAU:0;
  const directions=Array.from({length:10},(_,i)=>{const a=i/10*TAU+.24+turn+(varied?(motion.next()-.5)*.45:0);return norm([Math.cos(a)+bias[0],.24+Math.sin(i*2.3)*.56+(varied?(motion.next()-.5)*.2:0)+bias[1],Math.sin(a)*.8+bias[2]]);});
  const origins=directions.map(surface),velocities=directions.map((d,i)=>{const speed=varied?300+motion.next()*80:300+i%3*40;return d.map(v=>v*speed);}),style=new SliceRng(91731);
  const particles=Array.from({length:1000},(_,i)=>{
    const n=style.sphere();let p,v,delay,life;
    if(i<760){p=surface(n);const speed=260+style.next()*200;v=n.map(q=>q*speed);delay=0;life=.60+style.next()*.32;}
    else{const orb=i%10,emission=.02+style.next()*.24,base=position(origins[orb],velocities[orb],emission),jitter=style.next()*5,speed=40+style.next()*70;p=base.map((q,k)=>q+n[k]*jitter);v=velocities[orb].map((q,k)=>q*Math.exp(-6*emission)*.55+n[k]*speed);delay=emission;life=.60+style.next()*.18;}
    const drag=varied?5.4+motion.next()*1.2:6,rate=varied?.85+motion.next()*.3:1,amplitude=varied?.85+motion.next()*.3:1;
    if(varied){const direction=motion.sphere(),jitter=motion.sphere(),outward=norm(direction.map((q,k)=>q+jitter[k]*.18+bias[k]));if(i<760){p=surface(direction);const speed=260+motion.next()*200;v=outward.map(q=>q*speed);life=.60+motion.next()*.32;}else{const orb=i%10,base=position(origins[orb],velocities[orb],delay),j=motion.next()*5,speed=40+motion.next()*70;p=base.map((q,k)=>q+direction[k]*j);v=velocities[orb].map((q,k)=>q*Math.exp(-6*delay)*.55+outward[k]*speed);life=.60+motion.next()*.18;}}
    const size=i%37===0?2.6:1+style.next(),phaseStyle=style.next()*TAU,phase=varied?motion.next()*TAU:phaseStyle,colorBase=i%17===0?0xf3b6ed:i%5===0?0xffffff:0x92eaf6,mix=style.next()*.4;
    const channel=shift=>Math.floor(((colorBase>>>shift)&255)*(1-mix)+255*mix),color=channel(16)<<16|channel(8)<<8|channel(0);
    return {p,v,delay,life,drag,rate,amplitude,size,phase,color};
  });return{seed,origins,velocities,particles};
}
export function bubbleSphere(){
 const g=(1+Math.sqrt(5))/2,vertices=[[-1,g,0],[1,g,0],[-1,-g,0],[1,-g,0],[0,-1,g],[0,1,g],[0,-1,-g],[0,1,-g],[g,0,-1],[g,0,1],[-g,0,-1],[-g,0,1]].map(norm),faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]],triangles=[];
 for(const [a,b,d]of faces){const point=(i,j)=>norm(vertices[a].map((v,k)=>v*(1-(i+j)/3)+vertices[b][k]*i/3+vertices[d][k]*j/3));for(let i=0;i<3;i++)for(let j=0;j<3-i;j++){triangles.push([point(i,j),point(i+1,j),point(i,j+1)]);if(i+j<2)triangles.push([point(i+1,j),point(i+1,j+1),point(i,j+1)]);}}
 const transformed=triangles.map(t=>t.map(n=>[n[0],n[1]*.6614378-n[2]*.75,n[1]*.75+n[2]*.6614378]));transformed.sort((a,b)=>a.reduce((sum,n)=>sum+n[2],0)-b.reduce((sum,n)=>sum+n[2],0));return transformed;
}
export function drawBubbleShell(g,triangles,x,y,t,z){
 const scale=(.32+.68*c(t/.35))*z;g.use(4,'alpha',null,t);
 for(let i=0;i<triangles.length;i++){const tri=triangles[i],alpha=tri[0][2]+tri[1][2]+tri[2][2]<0?.28:1;
  for(let j=0;j<3;j++){const n=tri[j],wx=n[0],wy=n[1]*.6614378+n[2]*.75,wz=-n[1]*.75+n[2]*.6614378,px=wx*83,py=wy*83,pz=wz*83,wave=Math.sin(py*.12+t*14+px*.04)*1.8,qx=(px+wx*wave)*scale,qy=(py+wy*wave+108)*scale,qz=(pz+wz*wave)*scale;
   g.vertex(x+qx,y+qz*.75-qy*.6614378,-qz*.00001,Math.atan2(wx,wz)/TAU+.5,Math.asin(wy)/Math.PI+.5,0xffffff,1,n[0],n[1],n[2],alpha);
  }
 }
 g.quad(x,y,157*z,117.75*z,0,0x19dbff,.5);
}
export function drawBubbleRelease(g,m,x,y,a,z){
 if(a<0||a>=.94)return;const centreY=y-108*.6614378*z;
 if(a<.075){const q=(1-a/.075)**2;g.glow(x,centreY,250*(1+a*3)*z,0x48dfee,.5*q);g.glow(x,centreY,130*z,0xc0faff,.28*q);}
 g.glow(x,y-(108-48*a-13*a*a)*.6614378*z,325*(1+a*.26)*z,0x61e3f7,.12*(1-s((a-.2)/.68)));
 for(let i=0;i<10;i++){const duration=.44+i%3*.035;if(a>=duration)continue;const u=c(a/duration),p=m.origins[i],v=m.velocities[i],d=(1-Math.exp(-6*a))/6,px=p[0]+v[0]*d,py=p[1]+v[1]*d-48*a-13*a*a,pz=p[2]+v[2]*d,size=(19+i%3*3)*(1+u*.65)*z;g.quad(x+px*z,y+(pz*.75-py*.6614378)*z,size,size,0,0x0db3e0,.95*(1-u*u)**1.5,10);}
 for(let i=0;i<m.particles.length;i++){const p=m.particles[i],b=a-p.delay;if(b<0||b>=p.life)continue;const u=b/p.life,d=(1-Math.exp(-p.drag*b))/p.drag,qx=p.p[0]+p.v[0]*d+Math.sin(b*11*p.rate+p.phase)*2*b*p.amplitude,qy=p.p[1]+p.v[1]*d-48*b-13*b*b+(Math.sin(b*9*p.rate+p.phase)-Math.sin(p.phase))*1.8*b*p.amplitude,qz=p.p[2]+p.v[2]*d,core=Math.exp(-(qx*qx+(qy-(108-48*a-13*a*a))**2)/16000),alpha=(1-s((u-.38)/.62))*(.75+core*.25)*(.88+.12*Math.sin(b*17+p.phase));g.quad(x+qx*z,y+(qz*.75-qy*.6614378)*z,p.size*z,p.size*z,0,p.color,alpha,7);}
}
