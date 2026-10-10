"""Source hierarchy, sampling, alpha and repeat native render proof."""
import json, subprocess, hashlib, xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image
S=Path(__file__).resolve().parent;Q=S.parent/'qa';Q.mkdir(exist_ok=True)
meta=json.loads((S/'parts.json').read_text());parts=meta['parts'];N=18 if meta['actor']=='chimerilass' else 14
assert len(parts)==N;known={'body'}
for name,p in parts.items():
 assert p['composition']['parent'] in known,name;known.add(name)
 im=Image.open(S/p['file']);assert im.mode=='RGBA' and im.getbbox(),name
 assert (im.width,im.height)==tuple(p['sourceDimensions'].values()),name
for face in ('left','right'):
 root=ET.parse(S/f'neutral-{face}.sif').getroot();assert (root.get('width'),root.get('height'),root.get('view-box'))==('256','256','0 256 256 0')
 assert len(root.findall('./bones/bone'))==N+1 and len(root.findall('.//bone_link'))==N
 assert len(root.findall('.//layer[@type="skeleton"]'))==1
 assert len(root.findall('.//layer[@type="import"]/param[@name="c"]/integer[@value="1"]'))==N
 guids={root.find('./bones/bone_root').get('guid')}
 for b in root.findall('./bones/bone'):
  assert b.find('parent/bone_valuenode').get('guid') in guids;guids.add(b.get('guid'))
 image=Image.open(S/f'neutral-{face}.png');assert image.size==(128,128)
 box=image.getchannel('A').point(lambda a:255 if a>=16 else 0).getbbox();assert box and box[0]>0 and box[1]>0 and box[2]<128 and box[3]<=126,box
if meta['actor']=='chimerilass':
 for side in ('far','near'):assert parts['foot_'+side]['composition']['parent']=='shin_'+side
 assert parts['tail_tip']['composition']['parent']=='tail_base'
# Decode comparison excludes irrelevant PNG metadata; rerender requires installed native Synfig.
receipt=[]
for face in ('left','right'):
 scratch=Q/f'repeat-{face}-author.png'
 subprocess.run(['/opt/homebrew/bin/synfig',str(S/f'neutral-{face}.sif'),'-w','1024','-h','1024','--time','0f','-t','png','-o',str(scratch)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 expected=Image.open(S/f'neutral-{face}-author.png').convert('RGBA');actual=Image.open(scratch).convert('RGBA')
 assert expected.size==actual.size==(1024,1024) and expected.tobytes()==actual.tobytes(),face
 receipt.append(dict(facing=face,nativeRepeatPixelsEqual=True,decodedPixelsSHA256=hashlib.sha256(actual.tobytes()).hexdigest(),battleRGBABytes=65536,semanticFoot=[64,125]))
(Q/'repeat-render-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(meta['actor'],'PASS',N,'native painted links, parent-first, two exact native repeat renders;128RGBA131072bytes neutral total')
