"""Native source ownership, sampling, alpha and parent checks."""
from pathlib import Path
import json, hashlib, xml.etree.ElementTree as ET
from PIL import Image
S=Path(__file__).resolve().parent
meta=json.loads((S/'parts.json').read_text());parts=meta['parts'];known={'body'}
assert len(parts)==14
for name,p in parts.items():
 assert p['composition']['parent'] in known,name
 im=Image.open(S/p['file']);assert im.mode=='RGBA' and im.getbbox(),name
 assert (im.width,im.height)==tuple(p['sourceDimensions'].values())
 known.add(name)
records=[]
for face in ('left','right'):
 root=ET.parse(S/f'neutral-{face}.sif').getroot()
 assert (root.get('width'),root.get('height'),root.get('view-box'))==('256','256','0 256 256 0')
 assert len(root.findall('.//layer[@type="skeleton"]'))==1
 assert len(root.findall('./bones/bone'))==15 and len(root.findall('.//bone_link'))==14
 assert len(root.findall('.//layer[@type="import"]/param[@name="c"]/integer[@value="1"]'))==14
 im=Image.open(S/f'neutral-{face}.png');assert im.size==(128,128)
 box=im.getchannel('A').point(lambda a:255 if a>=16 else 0).getbbox();assert box and box[0]>0 and box[1]>0 and box[2]<128 and box[3]<=126,box
 au=Image.open(S/f'neutral-{face}-author.png');assert au.size==(1024,1024)
 records.append(dict(facing=face,alphaBounds=box,semanticFoot=[64,125],decodedRGBABytes=128*128*4))
assert sum(r['decodedRGBABytes'] for r in records)==131072
print(json.dumps(dict(actor=meta['actor'],status='PASS structural; visual verdict separate',parts=14,nativeBoneLinks=14,neutrals=records)))

# Critic-required preservation scope after the arm-only correction.
old=S.parent/'qa/rejected-source-v1/source'
if old.exists():
 prior=json.loads((old/'parts.json').read_text())
 for name in ('head','pelvis','coat_back','thigh_far','thigh_near','shin_boot_far','shin_boot_near'):
  assert parts[name]['composition']==prior['parts'][name]['composition'],name
  assert Image.open(S/f'{name}.png').tobytes()==Image.open(old/f'{name}.png').tobytes(),name
 assert Image.open(S/'torso-base.png').tobytes()==Image.open(old/'torso.png').tobytes()
 print('PASS: accepted head/lower-body paint and geometry and original torso-base pixels preserved.')
