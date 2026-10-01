from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
root=Path(__file__).resolve().parents[2];out=root/'test-results/lamp/strip-redesign';qa=root/'output/qa'
ref=Image.open(qa/'lamp-strip-reference.png').convert('RGB');font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',21)
panels=[('BEFORE: previous strip, rarity letters and cache preview',Image.open(qa/'lamp-strip-before.png').convert('RGB')),('TARGET: owner reference; dynamic level/count and AUTO placement are separate',ref),('ITERATION 1: undersized painted gear/lamp and flattened pill',Image.open(out/'strip-v1.png').convert('RGB')),('ITERATION 2: enlarged gear/lamp; level bar still too long',Image.open(out/'strip-v2.png').convert('RGB')),('FINAL: reference-sized row; bar under lamp; AUTO upper-right per request',Image.open(out/'strip-final.png').convert('RGB'))]
canvas=Image.new('RGB',(1424,len(panels)*440),'#f4f0e6');d=ImageDraw.Draw(canvas)
for n,(label,im) in enumerate(panels):
 y=n*440;d.text((12,y+8),label,font=font,fill='#151515');d.text((12,y+34),'A cyan = five arrivals / quality glow    B orange = lamp / controls / tier',font=font,fill='#514a40');canvas.paste(im.resize(ref.size),(0,y+68));d.rectangle((6,y+68,1035,y+426),outline='#00bcd4',width=3);d.rectangle((1050,y+68,1420,y+426),outline='#ff8a32',width=3)
canvas.save(out/'annotated-iterations.png')
g=json.loads((out/'geometry.json').read_text());lamp=next(n['rect'] for n in g['nodes'] if n['class']=='lamp-burp');im=Image.open(root/'web-runner/assets/images/lamp/lamp.png');bb=im.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox();scale=min(lamp['width']/im.width,lamp['height']/im.height)
m={'reference_crop':[1424,360],'reference_at_360_css_width':{'strip_height':360*360/1424,'gear_region_width_approx':1035*360/1424,'lamp_painted_height_approx':260*360/1424},'actual_css_pixels':{'strip_height':g['strip']['height'],'gear_region_width':g['nodes'][0]['rect']['width'],'lamp_alpha_bounds':bb,'lamp_painted_width':(bb[2]-bb[0])*scale,'lamp_painted_height':(bb[3]-bb[1])*scale},'limits':'Reference bounds are approximate manual painted-edge measurements. Actual lamp uses alpha >=128. Dynamic rolls, item level, lamp tier, cache count, and requested upper-right AUTO intentionally vary.'};(out/'painted-metrics.json').write_text(json.dumps(m,indent=2));print(json.dumps(m['actual_css_pixels']))
