import { clamp01 } from './rustCombatEffects.mjs';
const TAU=Math.PI*2;
const nonHostileKinds=new Set(['spawn_marker','kaja_aura','bubble_aura','ground_pound','arcane_pulse','faze_pool','healing_spring','resurrect','sniper_line','boss_snipe']);
export const hostileSliceHazard = h => h.hostile && h.team==='enemy' && !nonHostileKinds.has(h.kind);
const segments=r=>Math.max(12,Math.min(128,Math.ceil(Math.PI/Math.acos(1-1/Math.max(2,r)))));
export class SliceGround {
  constructor(gpu,camera) {this.gpu=gpu;this.camera=camera;this.points=new Float64Array(520);this.other=new Float64Array(520);this.count=0;
    const e=gpu.assets.get('telegraph-edge'), canvas=document.createElement('canvas');canvas.width=e.image.width;canvas.height=e.image.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(e.image,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,rows=new Uint32Array(canvas.height);
    let x0=canvas.width,x1=0,peak=0;
    for(let y=0;y<canvas.height;y++){for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>12){rows[y]++;x0=Math.min(x0,x);x1=Math.max(x1,x);}if(rows[y]>=rows[peak])peak=y;}
    let y0=peak,y1=peak,threshold=Math.max(1,Math.floor(rows[peak]/4));while(y0>0&&rows[y0-1]>=threshold)y0--;while(y1+1<canvas.height&&rows[y1+1]>=threshold)y1++;
    this.edgeU0=(x0+.5)/canvas.width;this.edgeU1=(x1+.5)/canvas.width;this.edgeV0=(y0+.5)/canvas.height;this.edgeV1=(y1+.5)/canvas.height;
  }
  polygon(h,progress) {
    const s=h.shape,c=this.camera,p=this.points,x=c.x(h.origin.x),y=c.y(h.origin.y),z=c.zoom,dx=h.dir.x,dy=h.dir.y;
    let count=0;
    if(s.kind==='circle'){const r=s.radius*progress,n=segments(r*z);for(let i=0;i<n;i++){const a=i/n*TAU;p[count++]=x+Math.cos(a)*r*z;p[count++]=y+Math.sin(a)*r*z*.75;}}
    else if(s.kind==='cone'){const n=Math.max(16,segments(s.length*z));p[count++]=x;p[count++]=y;for(let i=0;i<=n;i++){const a=(2*i/n-1)*s.half_angle_rad,co=Math.cos(a),si=Math.sin(a);p[count++]=x+(dx*co-dy*si)*s.length*progress*z;p[count++]=y+(dy*co+dx*si)*s.length*progress*z*.75;}}
    else if(s.kind==='line'){const w=s.width*(h.kind==='boss_charge'?1:Math.max(1/3,h.width_scale??1))/2;const sx=-dy*w,sy=dx*w,l=s.length*progress;for(let i=0;i<4;i++){const sign=i===0||i===1?-1:1,at=i===1||i===2?l:0;p[count++]=x+(dx*at+sx*sign)*z;p[count++]=y+(dy*at+sy*sign)*z*.75;}}
    this.count=count/2;return this.count;
  }
  texture(id){const e=this.gpu.assets.get(id);this.gpu.use(-1,'alpha',this.gpu.textures.get(e.image));}
  fill(h,progress,alpha,color=0xff374b) {
    if(progress<=0||alpha<=0)return;const g=this.gpu,c=this.camera,s=h.shape;
    this.texture('telegraph-fill');
    if(s.kind==='ring'){
      const outer=s.inner+(s.outer-s.inner)*progress,n=segments(outer*c.zoom),x=c.x(h.origin.x),y=c.y(h.origin.y);
      for(let i=0;i<n;i++){const a=i/n*TAU,b=(i+1)/n*TAU,ax=Math.cos(a),ay=Math.sin(a),bx=Math.cos(b),by=Math.sin(b),inner=s.inner,oz=outer*c.zoom,iz=inner*c.zoom;
        g.vertex(x+ax*iz,y+ay*iz*.75,0,.5+ax*.08,.5+ay*.08,color,alpha);g.vertex(x+ax*oz,y+ay*oz*.75,0,.5+ax*.08,.5+ay*.08,color,alpha);g.vertex(x+bx*iz,y+by*iz*.75,0,.5+bx*.08,.5+by*.08,color,alpha);
        g.vertex(x+ax*oz,y+ay*oz*.75,0,.5+ax*.08,.5+ay*.08,color,alpha);g.vertex(x+bx*oz,y+by*oz*.75,0,.5+bx*.08,.5+by*.08,color,alpha);g.vertex(x+bx*iz,y+by*iz*.75,0,.5+bx*.08,.5+by*.08,color,alpha);
      }return;
    }
    this.polygon(h,progress);this.fillPolygon(alpha,color);
  }
  fillPolygon(alpha,color=0xff374b,flatUV=false) {
    const g=this.gpu,p=this.points,n=this.count;if(n<3)return;let x=0,y=0,span=1;
    for(let i=0;i<n;i++){x+=p[i*2];y+=p[i*2+1];}x/=n;y/=n;
    for(let i=0;i<n;i++)span=Math.max(span,Math.hypot(p[i*2]-x,p[i*2+1]-y));
    for(let i=0;i<n;i++){const j=(i+1)%n;g.vertex(x,y,0,.5,.5,color,alpha);g.vertex(p[i*2],p[i*2+1],0,.5+(flatUV?0:(p[i*2]-x)/span*.12),.5+(flatUV?0:(p[i*2+1]-y)/span*.12),color,alpha);g.vertex(p[j*2],p[j*2+1],0,.5+(flatUV?0:(p[j*2]-x)/span*.12),.5+(flatUV?0:(p[j*2+1]-y)/span*.12),color,alpha);}
  }
  boundary(alpha,color=0xff374b) {
    const g=this.gpu,p=this.points,n=this.count,w=1.5*this.camera.zoom/.5/2;this.texture('telegraph-edge');
    for(let i=0;i<n;i++){const j=(i+1)%n,ax=p[i*2],ay=p[i*2+1],bx=p[j*2],by=p[j*2+1],length=Math.hypot(bx-ax,by-ay),nx=-(by-ay)/length*w,ny=(bx-ax)/length*w;
      g.vertex(ax-nx,ay-ny,0,this.edgeU0,this.edgeV0,color,alpha);g.vertex(bx-nx,by-ny,0,this.edgeU1,this.edgeV0,color,alpha);g.vertex(bx+nx,by+ny,0,this.edgeU1,this.edgeV1,color,alpha);
      g.vertex(ax-nx,ay-ny,0,this.edgeU0,this.edgeV0,color,alpha);g.vertex(bx+nx,by+ny,0,this.edgeU1,this.edgeV1,color,alpha);g.vertex(ax+nx,ay+ny,0,this.edgeU0,this.edgeV1,color,alpha);
    }
  }
  clipped(h,progress,t){
    this.polygon(h,1);const x=this.camera.x(h.origin.x),y=this.camera.y(h.origin.y),length=Math.hypot(h.dir.x,h.dir.y*.75)||1,dx=h.dir.x/length,dy=h.dir.y*.75/length;let far=0;
    for(let i=0;i<this.count;i++)far=Math.max(far,(this.points[i*2]-x)*dx+(this.points[i*2+1]-y)*dy);
    this.polygon(h,progress);const p=this.points,out=this.other,n=this.count;let count=0;for(let i=0;i<n;i++){const j=(i+1)%n,ax=p[i*2],ay=p[i*2+1],bx=p[j*2],by=p[j*2+1],da=(ax-x)*dx+(ay-y)*dy-far*t,db=(bx-x)*dx+(by-y)*dy-far*t;if(da>=0){out[count++]=ax;out[count++]=ay;}if((da>=0)!==(db>=0)){const f=da/(da-db);out[count++]=ax+(bx-ax)*f;out[count++]=ay+(by-ay)*f;}}
    for(let i=0;i<count;i++)p[i]=out[i];this.count=count/2;
  }
  cancelled(f,now){
    const h=f.data.hazard,t=(now-f.born)/.12;if(t<0||t>=1||!hostileSliceHazard(h))return;const alpha=(1-t)**2,shape=h.shape;
    if(shape.kind==='circle'||shape.kind==='ring'){
      const inner=shape.inner??0,radius=shape.radius??shape.outer,cut=inner+(radius-inner)*t,shell=f.data.shell,rim=f.data.rim;shell.shape.inner=cut;shell.shape.outer=radius;this.fill(shell,1,.12*alpha);const occupied=inner+(radius-inner)*clamp01(h.progress);if(h.phase!=='tracking'&&occupied>cut){shell.shape.outer=occupied;this.fill(shell,1,.34*alpha);}rim.shape.radius=radius;this.polygon(rim,1);this.boundary(.9*alpha);
    }else{this.clipped(h,1,t);this.texture('telegraph-fill');this.fillPolygon(.12*alpha,0xff374b,true);if(h.phase!=='tracking'){this.clipped(h,h.progress,t);this.fillPolygon(.34*alpha,0xff374b,true);}this.clipped(h,1,t);this.boundary(.9*alpha);}
  }
  pulse(h,state){if(h.phase!=='locked'||!state.previous)return 0;let old;for(const o of state.previous.hazards)if(o.id===h.id&&o.phase===h.phase){old=o;break;}if(!old)return 0;const dt=state.snapshot.time-state.previous.time;if(dt<=0||h.progress<=old.progress)return 0;const remaining=(1-h.progress)/((h.progress-old.progress)/dt);return remaining>.15?0:Math.sin(Math.PI*clamp01(1-remaining/.15));}
  hostile(state) {
    const now=state.snapshot.time;
    for(const h of state.snapshot.hazards)if(hostileSliceHazard(h)&&h.phase!=='resolved'){this.fill(h,1,.12);if(h.phase!=='tracking')this.fill(h,clamp01(h.progress),.34+.05*this.pulse(h,state));}
    for(const f of state.effects)if(f.type==='resolved'&&hostileSliceHazard(f.data.hazard))this.fill(f.data.hazard,1,.18*(1-(now-f.born)/.08));
    for(const h of state.snapshot.hazards)if(hostileSliceHazard(h)&&h.phase!=='resolved'){this.polygon(h,1);const pulse=this.pulse(h,state),color=0xff0000|(Math.floor(55+90*pulse)<<8)|Math.floor(75+75*pulse);this.boundary(.9,color);}
    for(const f of state.effects)if(f.type==='resolved'&&hostileSliceHazard(f.data.hazard)){this.polygon(f.data.hazard,1);this.boundary(.18*(1-(now-f.born)/.08));}
    for(const f of state.effects)if(f.type==='cancelled')this.cancelled(f,now);
    for(const h of state.snapshot.hazards)if(h.kind==='boss_charge'&&h.phase!=='resolved'&&h.shape.kind==='line'){
      const size=Math.min(18,h.shape.width*.25),c=this.camera,x=c.x(h.origin.x),y=c.y(h.origin.y),dx=h.dir.x,dy=h.dir.y,z=c.zoom;
      for(let i=1;i<=Math.floor(h.shape.length/70);i++){const tx=dx*i*70,ty=dy*i*70;this.gpu.solidLine(x+(tx-dx*size+dy*size)*z,y+(ty-dy*size-dx*size)*z*.75,x+tx*z,y+ty*z*.75,1.2,0xff374b,.5);this.gpu.solidLine(x+tx*z,y+ty*z*.75,x+(tx-dx*size-dy*size)*z,y+(ty-dy*size+dx*size)*z*.75,1.2,0xff374b,.5);}
    }
  }
}
