// Independent overlays in the shared 360x640 reference frame.
export const CHAPTER_ONE_MAP = {
  background: 'assets/narrative/chapter-1-map.png',
  heading: { text: 'QUESTS', x: 0, y: 48, w: 112, h: 24 },
  divider: { x: 64.5, y: 236, w: 240 },
  chapter: { text: 'Chapter 1', x: 184.5, y: 254 },
  token: { asset: 'assets/narrative/chapter-town-token.png', x: 115, y: 270, w: 139, h: 129 },
  start: { x: 111.4, y: 405, w: 146.2, h: 44 },
};

export function drawPageBanner(ctx, heading){
 ctx.save();ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineJoin="round";
    const banner = ctx.createLinearGradient(0, heading.y, 0, heading.y + heading.h);
    banner.addColorStop(0, '#a88d50');
    banner.addColorStop(0.5, '#79643b');
    banner.addColorStop(1, '#54452d');
    ctx.beginPath();
    ctx.moveTo(heading.x, heading.y);
    ctx.lineTo(heading.x + heading.w - 12, heading.y);
    ctx.lineTo(heading.x + heading.w, heading.y + heading.h / 2);
    ctx.lineTo(heading.x + heading.w - 12, heading.y + heading.h);
    ctx.lineTo(heading.x, heading.y + heading.h);
    ctx.closePath();
    ctx.fillStyle = banner;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e2c775';
    ctx.stroke();
    ctx.font = 'bold 13px sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#514021';
    ctx.fillStyle = '#fff4dc';
    ctx.strokeText(heading.text, heading.x + (heading.w - 8) / 2, heading.y + heading.h / 2);
    ctx.fillText(heading.text, heading.x + (heading.w - 8) / 2, heading.y + heading.h / 2);
 ctx.restore();
}
