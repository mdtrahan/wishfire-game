import { SliceRng } from './rustCombatBubble.mjs';
import { clamp01 as c } from './rustCombatEffects.mjs';
const TAU=Math.PI*2;
export function createArcaneModel(seed){
 const r=new SliceRng(seed),count=8+Math.floor(r.next()*5),guaranteed=[0,1,2,3,4];for(let i=4;i>0;i--){const j=Math.floor(r.next()*(i+1));[guaranteed[i],guaranteed[j]]=[guaranteed[j],guaranteed[i]];}
 let paths;for(;;){paths=guaranteed.slice();for(let i=5;i<count;i++)paths.push(Math.floor(r.next()*5));const counts=[0,0,0,0,0];for(const p of paths)counts[p]++;if(Math.max(...counts)-Math.min(...counts)>=2)break;}
 const beams=paths.map(path=>{const jitter=path===2?0:(r.next()<.5?-1:1)*(.03+r.next()*.03);return{path,width:1+jitter,flight:(.35+(r.next()-.5)*.025)*2,history:(.16+r.next()*.025)*2,lines:10+Math.floor(r.next()*7),behind:r.next()<.5,angle:r.next()*TAU,launch:0,arrival:0};});
 for(let path=0;path<5;path++){const group=[];for(let i=0;i<count;i++)if(beams[i].path===path)group.push(i);for(let i=group.length-1;i>0;i--){const j=Math.floor(r.next()*(i+1));[group[i],group[j]]=[group[j],group[i]];}const window=1-.08*(group.length-1),launches=group.map(()=>r.next()*window).sort((a,b)=>a-b);for(let i=0;i<group.length;i++){const b=beams[group[i]];b.launch=launches[i]+i*.08;b.arrival=b.launch+b.flight;}}
 let earliest=Infinity,latest=0;for(const b of beams)earliest=Math.min(earliest,b.arrival);const shift=.9-earliest;for(const b of beams){b.launch+=shift;b.arrival+=shift;latest=Math.max(latest,b.arrival);}return{seed,beams,end:latest+.44,latest};
}
const scratch=new Float64Array(28);
function path(b,ax,ay,ex,ey,t,out,offset){const outer=b.path===0||b.path===4,side=b.path<2?1:b.path>2?-1:0,dx=ex-ax,dy=ey-ay,ca=outer?.25226775:.23252791,cb=(outer?-.8622257:-.40975136)*side*b.width,da=outer?.6319342:.63529396,db=(outer?-.15905246:-.07321865)*side*b.width,q=1-t;out[offset]=ax*q*q*q+(ax+dx*ca-dy*cb)*3*q*q*t+(ax+dx*da-dy*db)*3*q*t*t+ex*t*t*t;out[offset+1]=ay*q*q*q+(ay+dy*ca+dx*cb)*3*q*q*t+(ay+dy*da+dx*db)*3*q*t*t+ey*t*t*t;}
function along(b,ax,ay,ex,ey,t,out,offset){if(t<.5)path(b,ax,ay,ex,ey,t*1.2,out,offset);else{path(b,ax,ay,ex,ey,.6,out,offset);const q=(t-.5)*2,a=.25*q+.75*q*q;out[offset]+=(ex-out[offset])*a;out[offset+1]+=(ey-out[offset+1])*a;}}
function pair(b,ax,ay,ex,ey,p,tail,dart,limit,u,out,offset){const t=tail+(p-tail)*u;let x,y,dx,dy;if(dart){x=scratch[0]+(scratch[2]-scratch[0])*(1-u)*limit;y=scratch[1]+(scratch[3]-scratch[1])*(1-u)*limit;path(b,ax,ay,ex,ey,.6,scratch,12);dx=ex-scratch[12];dy=ey-scratch[13];}else{along(b,ax,ay,ex,ey,t,scratch,12);x=scratch[12];y=scratch[13];path(b,ax,ay,ex,ey,Math.min(1,t*1.2+.001),scratch,12);path(b,ax,ay,ex,ey,Math.max(0,t*1.2-.001),scratch,14);dx=scratch[12]-scratch[14];dy=scratch[13]-scratch[15];}const length=Math.hypot(dx,dy)||1,width=(.12+.88*u**.7)*6*scratch[26],nx=-dy/length*width,ny=dx/length*width;out[offset]=x+nx;out[offset+1]=y+ny;out[offset+2]=x-nx;out[offset+3]=y-ny;}
export function drawArcane(g,m,handX,handY,footX,footY,time,z,back){
 const hitX=footX,hitY=footY-58*.48*z;
 if(!back&&time>0&&time<.5){const q=Math.sin(time/.5*Math.PI);g.glow(handX,handY,25*z,0x8a12ff,q*.8);g.glow(handX,handY,12*z,0xe299ff,q*1.4);g.glow(handX,handY,6*z,0xffffff,q*2);for(let i=0;i<7;i++){const a=i*TAU/7+time*.5*12,r=(8+5*Math.sin(time*.5*25+i))*z,dx=Math.cos(a),dy=Math.sin(a);g.line(handX+dx*r,handY+dy*r,handX+dx*(r+3*z),handY+dy*(r+3*z),.9*z,0xe8c8ff,q);}}
 for(const b of m.beams){const age=time-b.launch;if(age>=0&&age<b.flight){const p=c(age/b.flight);if(back!==(b.behind&&p<.48))continue;const dart=p>=.5,tail=dart?Math.max(.5,c((age-b.history*.45)/b.flight)):c((age-b.history*.65)/b.flight);along(b,handX,handY,hitX,hitY,p,scratch,0);along(b,handX,handY,hitX,hitY,tail,scratch,2);let limit=1;
   if(dart){const old=c((age-b.history)/b.flight);path(b,handX,handY,hitX,hitY,old,scratch,4);let length=0;for(let i=1;i<=12;i++){path(b,handX,handY,hitX,hitY,old+(p-old)*i/12,scratch,6);length+=Math.hypot(scratch[6]-scratch[4],scratch[7]-scratch[5]);scratch[4]=scratch[6];scratch[5]=scratch[7];}limit=Math.min(1,.45*length/Math.max(.001,Math.hypot(scratch[0]-scratch[2],scratch[1]-scratch[3])));}
   scratch[26]=z;g.use(1,'additive');for(let i=0;i<28;i++){const u=i/28,v=(i+1)/28;pair(b,handX,handY,hitX,hitY,p,tail,dart,limit,u,scratch,16);pair(b,handX,handY,hitX,hitY,p,tail,dart,limit,v,scratch,20);
    g.vertex(scratch[16],scratch[17],0,u,0,0xffffff,1);g.vertex(scratch[18],scratch[19],0,u,1,0xffffff,1);g.vertex(scratch[20],scratch[21],0,v,0,0xffffff,1);g.vertex(scratch[20],scratch[21],0,v,0,0xffffff,1);g.vertex(scratch[18],scratch[19],0,u,1,0xffffff,1);g.vertex(scratch[22],scratch[23],0,v,1,0xffffff,1);}
   g.glow(scratch[0],scratch[1],18*z,0x008aff,.8);g.glow(scratch[0],scratch[1],11*z,0x60eaff,1.5);path(b,handX,handY,hitX,hitY,.6,scratch,4);g.quad(scratch[0],scratch[1],(dart?5*(1.2+1.1*(p-.5)):5)*z,(dart?4.25:5)*z,Math.atan2(hitY-scratch[5],hitX-scratch[4]),0xffffff,dart?2.6:2);
  }
  const a=time-b.arrival;if(back||a<0||a>=.44)continue;const q=a/.44,fade=(1-q)**1.7,gain=b.arrival===m.latest?1.12:1,rx=(17+10*q)*z*gain;g.ring(footX,footY,rx,rx*.47,1.1*z,0xffd83c,fade*.85,40);
  for(let j=0;j<4;j++){const a=j*TAU/4,vx=Math.cos(a),vy=Math.sin(a);g.line(footX+vx*(rx-3*z),footY+vy*(rx*.47-2*z),footX+vx*(rx+4*z),footY+vy*(rx*.47+4*z),1.1*z,0xfff4a0,fade);}
  g.glow(hitX,hitY,(28+15*q)*gain*z,0xffc92e,.75*fade);g.glow(hitX,hitY,(15+9*q)*gain*z,0xfff1b4,1.5*fade);g.glow(hitX,hitY,(7+4*q)*z,0xffffff,2*fade);
  for(let j=0;j<b.lines;j++){const angle=b.angle+j/b.lines*TAU,vx=Math.cos(angle),vy=Math.sin(angle),inner=(5+18*q)*z,outer=inner+(23+10*Math.sin(j*4.3))*(1-q)*z*gain;g.line(hitX+vx*inner,hitY+vy*inner,hitX+vx*outer,hitY+vy*outer,1.05*z,0xffe36a,fade);}
 }
}
