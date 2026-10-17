"""Verify native editable ownership, geometry, roots and mirror; no gameplay state."""
import json, subprocess, xml.etree.ElementTree as ET
from pathlib import Path
S=Path(__file__).resolve().parent
meta=json.loads((S/'parts.json').read_text()); parts=meta['parts']; known={'body'}
assert len(parts)==15 and parts['sword']['composition']['parent']=='hand_near'
for name,p in parts.items():
 assert p['composition']['parent'] in known, name
 assert (S/p['file']).is_file()
 known.add(name)
for facing in ('left','right'):
 tree=ET.parse(S/f'neutral-{facing}.sif'); root=tree.getroot()
 assert (root.attrib['width'],root.attrib['height'])==('256','256')
 assert len(root.findall('./bones/bone'))==16
 assert len(root.findall('.//bone_link'))==15
 pixels=subprocess.check_output(['magick',str(S/f'neutral-{facing}.png'),'-depth','8','rgba:-'])
 points=[(i%128,i//128) for i in range(128*128) if pixels[i*4+3]>16]
 bounds=(min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points))
 assert 0<bounds[0]<bounds[2]<127 and 0<bounds[1]<bounds[3]<=125, bounds
A=S.parent/'qa/repaired-sequence'
# Compare the native1024 proof before offline reduction; native pixel-centre reflection adds one author pixel.
subprocess.run(['magick',str(A/'neutral-left-0000-author.png'),'-flop','-roll','+1+0',str(S/'mirror-check.png')],check=True)
r=subprocess.run(['magick','compare','-metric','AE',str(S/'mirror-check.png'),str(A/'neutral-right-0000-author.png'),'null:'],capture_output=True,text=True)
ae=float(r.stderr.split()[0]);assert ae<1, r.stderr
(S/'mirror-check.png').unlink()
print(f'PASS:15parent-ordered layers, actual hand-child sword,16native bones, meaningful-alpha foot bottom<=125; native1024 mirror fractional AE={ae:.6f}<1author pixel. Offline128 sampling has expected subpixel reflection rounding.')
