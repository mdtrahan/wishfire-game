// Pinned slice render/groove.rs and render/rewards.rs. Read-only presentation.
const clamp = v => Math.max(0, Math.min(1, v));
export function drawSliceHeroBars(ctx, snapshot, camera, scale, ox, oy) {
  const z = camera.zoom / .5;
  ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale);
  for (const a of snapshot.actors) {
    if (a.team !== 'hero' || a.hp <= 0 || a.downed) continue;
    const x = camera.x(a.pos.x) - 17*z/2, y = camera.y(a.pos.y);
    ctx.fillStyle = '#090e12'; ctx.fillRect(x,y+8*z,17*z,1.5*z);
    ctx.fillStyle = '#45d487'; ctx.fillRect(x,y+8*z,17*z*clamp(a.hp/Math.max(1,a.max_hp)),1.5*z);
    if (!a.groove) continue;
    const segments = a.groove === 'combo' ? 1 : 3, value = Number.isFinite(a.meter) ? clamp(a.meter/segments) : 0;
    if (value === 1) for (const [pad,alpha] of [[2,.07],[1,.14]]) {
      ctx.fillStyle = `rgba(255,184,51,${alpha})`;ctx.fillRect(x-pad*z,y+(10.5-pad)*z,(17+2*pad)*z,(1+2*pad)*z);
    }
    ctx.fillStyle = '#090e12';ctx.fillRect(x,y+10.5*z,17*z,z);
    ctx.fillStyle = '#ffc745';ctx.fillRect(x,y+10.5*z,17*z*value,z);
  }
  ctx.restore();
}
export function sliceChestPose(chest, now) {
  const t=clamp(chest.age/.35),bounce=Math.sin(t*Math.PI),e=clamp((chest.age-.41)/.4),lift=e*e*(3-2*e)*(6+3*(.5+.5*Math.sin(now*Math.PI*2/1.8+chest.id*.7)));
  return { lift: bounce*12+lift, rise:(bounce*12+lift)/21,
    squash:chest.age>=.35&&chest.age<.41?1-.08*Math.sin(Math.PI*(chest.age-.35)/.06):1,
    rotation:chest.state==='opening'?Math.sin(chest.state_age*35)*.025:0,
    opacity:chest.state==='open'?clamp((2-chest.state_age)/.6):1 };
}
export function drawSliceChest(ctx,snapshot,camera,assets,gpu,s,ox,oy) {
  const chest=snapshot?.chest;if(!chest)return;
  const pose=sliceChestPose(chest,snapshot.time),x=camera.x(chest.pos.x),y=camera.y(chest.pos.y),id=chest.state==='open'?'chest-open':'chest-closed';
  gpu.begin((window.devicePixelRatio||1)*s,ctx,s,ox,oy);
  gpu.bitmap('shadow',0,x,y,31*(1-pose.rise*.3),10*(1-pose.rise*.3),0,.55*pose.opacity*(1-pose.rise*.35),0x1a1208);
  gpu.bitmap(id,0,x,y-pose.lift,32/pose.squash,32*pose.squash,pose.rotation,pose.opacity);
  if(chest.state==='open')gpu.once('chest-sparkle',chest.state_age,x,y-23.5,44*camera.zoom/.5,44*camera.zoom/.5);
  gpu.composite();
}
