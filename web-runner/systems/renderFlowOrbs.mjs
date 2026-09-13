import {getAstralFlowKoOrbFrame} from './astralFlowKoOrbPresentation.js';
import {FLOW_ORB_TUNING as T} from '../src/core/heroDefinitions.mjs';
import {ASTRAL_FLOW_METER_BLUE} from '../src/core/astralFlowEnemyKoRewards.mjs';

// Canvas-logical positions share the actors' orientation/scale projection.
export function renderFlowOrbs(ctx, globals, actors, project, scale, gemImage) {
 for (const orb of globals.FlowOrbs || []) {
  const hero = actors.find(a => a.uid === orb.recipientUID);
  const destination = hero && globals.HeroPortraitPosByIndex?.[hero.heroDisplaySlot ?? hero.heroIndex];
  if (!destination) continue;
  const source = orb.sourceKind === 'hero' ? globals.HeroPortraitPosByIndex?.[orb.sourceSlot] || orb : orb;
  const start = project(source.x, source.y, orb.sourceKind), end = project(destination.x, destination.y, 'hero');
  const age = Math.max(0, Number(globals.time || 0) - orb.born);
  const radius = 4.6 * scale;
  const frame = getAstralFlowKoOrbFrame({source:start,ground:{x:start.x,y:start.y+orb.groundOffset*scale},target:end,radius,spillX:((orb.id%5)-2)*9*scale},globals.time,orb.born);
  const {x,y} = frame;
  ctx.save();
  ctx.globalAlpha = orb.collected ? Math.max(0, 1 - (age - T.releaseSeconds - T.flightSeconds) / T.collectFlashSeconds) : 1;
  ctx.shadowColor = '#4dc7ff'; ctx.shadowBlur = 8 * scale;
  ctx.strokeStyle = '#bcefff'; ctx.lineWidth = 1.2 * scale;
  if (orb.collected) {
   ctx.beginPath();ctx.arc(end.x,end.y,(7 + (age-T.releaseSeconds-T.flightSeconds)*65)*scale,0,Math.PI*2);ctx.stroke();
  } else {
   const r = frame.radius;
   if (gemImage?.complete && gemImage.naturalWidth) ctx.drawImage(gemImage,x-r,y-r,r*2,r*2);
   else {ctx.fillStyle=ASTRAL_FLOW_METER_BLUE;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.fill();ctx.stroke();}
   ctx.fillStyle='#e9fbff';ctx.fillRect(x-r*.3,y-r*.5,1.5*scale,1.5*scale);
  }
  ctx.restore();
 }
}
