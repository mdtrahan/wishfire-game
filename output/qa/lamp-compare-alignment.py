from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json
root=Path(__file__).resolve().parents[2]; out=root/'test-results/lamp/alignment'; q=root/'test-results/lamp/reveal-feedback'
ref=Image.open(root/'output/qa/lamp-strip-reference.png').convert('RGB'); actual=Image.open(q/'strip-final.png').convert('RGB')
before=Image.open(root/'test-results/lamp/strip-redesign/strip-final.png').convert('RGB')
g=json.loads((out/'geometry.json').read_text())[0]['nodes'];s=360/1424
# Reference painted silhouettes and chrome bounds, measured directly in the source raster.
target={'lamp':(1097*s,0,1400*s,258*s),'disc':(1146*s,269*s,1219*s,343*s),'bubble':(1320*s,22*s,1418*s,101*s),'auto':(30*s,22*s,129*s,76*s),'progress':(1180*s,286*s,1393*s,324*s)}
asset=Image.open(root/'web-runner/assets/images/lamp/lamp.png');bb=asset.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox();r=g['.lamp-device'];sx=r['w']/asset.width;sy=r['h']/asset.height;ox=r['x'];oy=r['y']
paint=(ox+bb[0]*sx,oy+bb[1]*sy,ox+bb[2]*sx,oy+bb[3]*sy)
def rect(sel):
 a=g[sel];return(a['x'],a['y'],a['x']+a['w'],a['y']+a['h'])
bubble=rect('.lamp-collect');bubble=(*bubble[:3],bubble[3]+g['.lamp-collect']['h']*.14)
now={'lamp':paint,'disc':rect('.lamp-level-disc'),'bubble':bubble,'auto':rect('.lamp-auto'),'progress':rect('.lamp-progress')}
colors={'lamp':'#f1a8ff','disc':'#63e8ba','bubble':'#ff86bc','auto':'#fcbb4d','progress':'#69d9ff'}
font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',18)
canvas=Image.new('RGB',(1440,1240),'#f4f0e6');d=ImageDraw.Draw(canvas)
for n,(label,im) in enumerate([('REFERENCE: source pixels, uniform 360 / 1424 normalization',ref),('BEFORE: previous delivered strip',before),('CORRECTED: same scale; solid = reference, dashed = current',actual)]):
 y=32+n*410;d.text((12,y-24),label,font=font,fill='#171717');scale=4
 im=im.resize((1440,round(im.height*1440/im.width)));canvas.paste(im,(0,y))
 for key,box in target.items():
  coords=[box[0]*scale,y+box[1]*scale,box[2]*scale,y+box[3]*scale];d.rectangle(coords,outline=colors[key],width=2)
 if n==2:
  for key,box in now.items():
   x1,y1,x2,y2=box[0]*scale,y+box[1]*scale,box[2]*scale,y+box[3]*scale
   for x in range(round(x1),round(x2),12):
    d.line((x,y1,min(x+6,x2),y1),fill='white',width=2);d.line((x,y2,min(x+6,x2),y2),fill='white',width=2)
   for yy in range(round(y1),round(y2),12):
    d.line((x1,yy,x1,min(yy+6,y2)),fill='white',width=2);d.line((x2,yy,x2,min(yy+6,y2)),fill='white',width=2)
canvas.save(out/'annotated-comparison.png')
report={key:{'reference_bounds':target[key],'current_bounds':now[key],'edge_deltas':[round(b-a,2) for a,b in zip(target[key],now[key])]} for key in now}
report['notes']='Lamp bounds use alpha >=128; source targets are hand-measured painted bounds. Bubble bounds include the CSS tail. Progress left edge deliberately extends under the disc. Dynamic level/count and item rolls differ.'
(out/'pixel-comparison.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
# Same logical crop and magnification for the identical Level 4 glyph.
ref360=ref.resize((360,round(ref.height*360/ref.width)))
fixture=Image.open(out/'level-4-fixture.png').convert('RGB')
comparison=Image.new('RGB',(664,348),'#f4f0e6');d=ImageDraw.Draw(comparison)
for x,label,im in [(10,'REFERENCE 4 / Level',ref360),(342,'CORRECTED 4 / Level fixture',fixture)]:
 d.text((x,8),label,font=font,fill='black');comparison.paste(im.crop((287,65,313,90)).resize((312,300)),(x,40))
comparison.save(out/'level-type-comparison.png')
# Yellow glyph bounds, excluding purple backer and dark outline.
def yellow_bounds(im,box):
 pts=[(x,y) for y in range(box[1],box[3]) for x in range(box[0],box[2]) if (lambda c:c[0]>180 and c[1]>150 and c[2]<c[1]*.9)(im.getpixel((x,y)))];return [min(x for x,y in pts),min(y for x,y in pts),max(x for x,y in pts)+1,max(y for x,y in pts)+1]
painted={}
for key,rb,ab in [('number',(1147,269,1220,315),(289,67,311,80)),('Level',(1147,316,1220,343),(289,80,311,88))]:
 rb=[v*s for v in yellow_bounds(ref,rb)];ab=yellow_bounds(fixture,ab);painted[key]={'reference':rb,'current':ab,'edge_deltas':[round(b-a,2) for a,b in zip(rb,ab)]}
(out/'type-paint-bounds.json').write_text(json.dumps(painted,indent=2))
