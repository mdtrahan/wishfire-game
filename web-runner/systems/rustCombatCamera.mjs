// Slice camera.rs spring, .5 zoom and .75 ground projection. WFM owns the viewport band.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function createSliceCombatCamera() {
  let cx=0,cy=0,vx=0,vy=0,started=false;
  const point={x:0,y:0};
  const camera={ zoom:.5, offsetX:0,offsetY:0,
    update(s,dt) {
      let hx=0,hy=0,count=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const a of s.actors) if(a.team==='hero'&&a.hp>0&&!a.downed){hx+=a.pos.x;hy+=a.pos.y;count++;minX=Math.min(minX,a.pos.x-96);maxX=Math.max(maxX,a.pos.x+96);minY=Math.min(minY,a.pos.y-210);maxY=Math.max(maxY,a.pos.y+30);}
      if(!count){vx=vy=0;return;}hx/=count;hy/=count;
      let nearestX=hx,nearestY=hy,best=Infinity;
      for(const a of s.actors)if(a.team==='enemy'&&a.hp>0){const d=(a.pos.x-hx)**2+(a.pos.y-hy)**2;if(d<best){best=d;nearestX=a.pos.x;nearestY=a.pos.y;}}
      const tx=hx+clamp((nearestX-hx)*.3,-40,40),ty=hy+clamp((nearestY-hy)*.3,-180,180)-50;
      if(!started){cx=tx;cy=ty;started=true;}
      if(dt>0){let off=cx-tx,decay=Math.exp(-3.5*dt),change=(vx+3.5*off)*dt;cx=tx+(off+change)*decay;vx=(vx-3.5*change)*decay;off=cy-ty;decay=Math.exp(-7*dt);change=(vy+7*off)*dt;cy=ty+(off+change)*decay;vy=(vy-7*change)*decay;}
      const floor=s.geometry.floor,halfX=360,halfY=640/(2*.5*.75);
      cx=floor.max.x-floor.min.x<halfX*2?(floor.min.x+floor.max.x)/2:clamp(cx,floor.min.x+halfX,floor.max.x-halfX);
      cy=floor.max.y-floor.min.y<halfY*2?(floor.min.y+floor.max.y)/2:clamp(cy,floor.min.y+halfY,floor.max.y-halfY);
      // The original full-screen 52..576 fit cannot cover WFM's fixed HUD. Preserve its band.
      const lowX=maxX-344,highX=minX+344,lowY=maxY-(478-286.5)/.375,highY=minY+(286.5-95)/.375;
      if(lowX<=highX){const fit=clamp(cx,lowX,highX);if(fit!==cx)vx=0;cx=fit;}
      if(lowY<=highY){const fit=clamp(cy,lowY,highY);if(fit!==cy)vy=0;cy=fit;}
    },
    x(x){return(x-cx)*camera.zoom+180+camera.offsetX;},
    y(y){return(y-cy)*camera.zoom*.75+286.5+camera.offsetY;},
    project(x,y){point.x=camera.x(x);point.y=camera.y(y);return point;},
    reset(){started=false;vx=vy=0;camera.offsetX=camera.offsetY=0;},
  };return camera;
}
