import { COMBAT_VIEW } from './rustCombatArena.mjs';
// Slice spring and pixel scale; WFM supplies the unobstructed viewport.
const MID=(COMBAT_VIEW.top+COMBAT_VIEW.bottom)/2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function createSliceCombatCamera() {
  let cx=0,cy=0,vx=0,vy=0,started=false,viewX=null,viewY=null;
  const point={x:0,y:0};
  const camera={ zoom:.5, offsetX:0,offsetY:0,
    get centreX(){return cx;},get centreY(){return cy;},
    frame(x,y,z){viewX=x;viewY=y;camera.zoom=z;},
    update(s,dt) {
      viewX=viewY=null;camera.zoom=.5;
      let hx=0,hy=0,count=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const a of s.actors) if(a.team==='hero'&&a.hp>0&&!a.downed){hx+=a.pos.x;hy+=a.pos.y;count++;minX=Math.min(minX,a.pos.x-96);maxX=Math.max(maxX,a.pos.x+96);minY=Math.min(minY,a.pos.y-210);maxY=Math.max(maxY,a.pos.y+30);}
      if(!count){vx=vy=0;return;}hx/=count;hy/=count;
      let nearestX=hx,nearestY=hy,best=Infinity;
      for(const a of s.actors)if(a.team==='enemy'&&a.hp>0){const d=(a.pos.x-hx)**2+(a.pos.y-hy)**2;if(d<best){best=d;nearestX=a.pos.x;nearestY=a.pos.y;}}
      const tx=hx+clamp((nearestX-hx)*.3,-40,40),ty=hy+clamp((nearestY-hy)*.3,-180,180)-50;
      if(!started){cx=tx;cy=ty;started=true;}
      if(dt>0){let off=cx-tx,decay=Math.exp(-3.5*dt),change=(vx+3.5*off)*dt;cx=tx+(off+change)*decay;vx=(vx-3.5*change)*decay;off=cy-ty;decay=Math.exp(-7*dt);change=(vy+7*off)*dt;cy=ty+(off+change)*decay;vy=(vy-7*change)*decay;}
      const floor=s.geometry.floor,halfX=360,halfY=(COMBAT_VIEW.bottom-COMBAT_VIEW.top)/(2*.5*.75);
      cx=floor.max.x-floor.min.x<halfX*2?(floor.min.x+floor.max.x)/2:clamp(cx,floor.min.x+halfX,floor.max.x-halfX);
      cy=floor.max.y-floor.min.y<halfY*2?(floor.min.y+floor.max.y)/2:clamp(cy,floor.min.y+halfY,floor.max.y-halfY);
      // Source body bounds keep the party and boss inside the phone frame.
      const heroMinX=minX,heroMaxX=maxX,heroMinY=minY,heroMaxY=maxY;
      for(const a of s.actors)if(a.team==='enemy'&&a.hp>0&&a.kind.startsWith('boss')){minX=Math.min(minX,a.pos.x-160);maxX=Math.max(maxX,a.pos.x+160);minY=Math.min(minY,a.pos.y-370);maxY=Math.max(maxY,a.pos.y+40);break;}
      const lowX=maxX-344,highX=minX+344,lowY=maxY-(COMBAT_VIEW.bottom-MID)/.375,highY=minY+(MID-COMBAT_VIEW.top)/.375;
      {const lo=heroMaxX-344,hi=heroMinX+344,fit=lowX<=highX?clamp(cx,lowX,highX):lo<=hi?clamp((lowX+highX)/2,lo,hi):(lo+hi)/2;if(fit!==cx)vx=0;cx=fit;}
      {const lo=heroMaxY-(COMBAT_VIEW.bottom-MID)/.375,hi=heroMinY+(MID-COMBAT_VIEW.top)/.375,fit=lowY<=highY?clamp(cy,lowY,highY):lo<=hi?clamp((lowY+highY)/2,lo,hi):(lo+hi)/2;if(fit!==cy)vy=0;cy=fit;}
    },
    x(x){return(x-(viewX??cx))*camera.zoom+180+camera.offsetX;},
    y(y){return(y-(viewY??cy))*camera.zoom*.75+MID+camera.offsetY;},
    project(x,y){point.x=camera.x(x);point.y=camera.y(y);return point;},
    reset(){viewX=viewY=null;started=false;vx=vy=0;camera.offsetX=camera.offsetY=0;},
  };return camera;
}
