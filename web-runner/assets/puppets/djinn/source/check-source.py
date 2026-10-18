"""Native source ownership, sampling, alpha and parent checks."""
from pathlib import Path
import json, hashlib, xml.etree.ElementTree as ET
from PIL import Image
S=Path(__file__).resolve().parent
meta=json.loads((S/'parts.json').read_text());parts=meta['parts'];known={'body'}
count=16 if meta['actor']=='djinn' else 14
assert len(parts)==count
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
 assert len(root.findall('./bones/bone'))==count+1 and len(root.findall('.//bone_link'))==count
 assert len(root.findall('.//layer[@type="import"]/param[@name="c"]/integer[@value="1"]'))==count
 im=Image.open(S/f'neutral-{face}.png');assert im.size==(128,128)
 box=im.getchannel('A').point(lambda a:255 if a>=16 else 0).getbbox();assert box and box[0]>0 and box[1]>0 and box[2]<128 and box[3]<=126,box
 au=Image.open(S/f'neutral-{face}-author.png');assert au.size==(1024,1024)
 records.append(dict(facing=face,alphaBounds=box,semanticFoot=[64,125],decodedRGBABytes=128*128*4))
assert sum(r['decodedRGBABytes'] for r in records)==131072
print(json.dumps(dict(actor=meta['actor'],status='PASS structural; visual verdict separate',parts=count,nativeBoneLinks=count,neutrals=records)))

# Native parent GUIDs must match every composition parent, including attachments.
for face in ('left','right'):
 root=ET.parse(S/f'neutral-{face}.sif').getroot(); bones={b.findtext('name/string'):b for b in root.findall('./bones/bone')}
 for name,part in parts.items():
  assert bones[name].find('parent/bone_valuenode').get('guid')==bones[part['composition']['parent']].get('guid'),name
 for case in ('coil','release'):
  stress=ET.parse(S.parent/'qa/stress'/f'{case}-{face}.sif').getroot()
  actual={b.findtext('name/string'):float(b.find('angle/angle').get('value')) for b in stress.findall('./bones/bone')}
  assert all(actual[n]!=0 for n in ('upper_arm_near','upper_arm_far','forearm_near','forearm_far','hand_near','hand_far','thigh_near','thigh_far'))
  assert Image.open(S.parent/'qa/stress'/f'{case}-{face}.png').tobytes()!=Image.open(S/f'neutral-{face}.png').tobytes()

# Orb is palm-local, independent from the pelvis-owned long cord.
assert parts['orb']['composition']['parent']=='hand_near'
assert parts['belt_cord']['composition']['parent']=='pelvis'
assert abs(parts['orb']['composition']['x']-parts['hand_near']['composition']['x'])<=25
assert parts['belt_cord']['composition']['h']>=76
