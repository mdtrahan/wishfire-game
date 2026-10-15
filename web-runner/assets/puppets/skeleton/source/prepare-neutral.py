"""Mechanical atlas isolation and native neutral bone assembly; no raster painting."""
import json, hashlib, subprocess
from pathlib import Path
from PIL import Image
from collections import deque
S=Path(__file__).resolve().parent
# name, crop x/y/w/h, composition x/y/w/h, pivotY, parent
rows=[('head', (36, 63, 237, 274), (122, 136, 108, 109), 0.5, 0.9, 'body'),
 ('torso', (317, 55, 306, 289), (128, 128, 93, 85), 0.5, 0.12, 'body'),
 ('pelvis', (642, 92, 263, 261), (128, 181, 94, 63), 0.5, 0.12, 'body'),
 ('coat_back', (922, 40, 294, 313), (128, 124, 111, 119), 0.5, 0.12, 'body'),
 ('upper_arm_far', (84, 371, 171, 251), (95, 132, 31, 51), 0.6, 0.19, 'body'),
 ('forearm_far', (390, 373, 175, 262), (83, 168, 26, 42), 0.2, 0.2, 'upper_arm_far'),
 ('hand_far', (675, 437, 149, 188), (100, 197, 25, 30), 0.65, 0.1, 'forearm_far'),
 ('upper_arm_near', (997, 376, 169, 252), (161, 132, 31, 51), 0.4, 0.19, 'body'),
 ('forearm_near', (71, 660, 180, 260), (173, 168, 26, 42), 0.8, 0.2, 'upper_arm_near'),
 ('hand_near', (393, 706, 159, 189), (157, 197, 25, 30), 0.35, 0.1, 'forearm_near'),
 ('thigh_far', (649, 669, 210, 248), (150, 202, 44, 38), 0.5, 0.12, 'body'),
 ('shin_boot_far', (987, 650, 160, 285), (151, 225, 39, 28), 0.5, 0.12, 'thigh_far'),
 ('thigh_near', (75, 953, 211, 245), (109, 202, 44, 38), 0.5, 0.12, 'body'),
 ('shin_boot_near', (381, 933, 179, 295), (108, 225, 39, 28), 0.5, 0.12, 'thigh_near')]
parts={}
for name,crop,comp,px,pivot,parent in rows:
 x,y,w,h=crop
 subprocess.run(['magick',str(S/'parts-left-v1.png'),'-crop',f'{w}x{h}+{x}+{y}','+repage','-trim','+repage',str(S/f'{name}.png')],check=True)
# Isolate the atlas part's largest opaque connected component; remove neighboring paint fragments.
 raw=Image.open(S/f'{name}.png').convert('RGBA');ww,hh=raw.size;alpha=raw.getchannel('A').tobytes();seen=bytearray(1 if a>=16 else 0 for a in alpha);best=[]
 for first in range(ww*hh):
  if not seen[first]:continue
  seen[first]=0;todo=deque([first]);component=[]
  while todo:
   k=todo.popleft();yy,xx=divmod(k,ww);component.append(k)
   for neighbor in ([k-1] if xx else [])+([k+1] if xx<ww-1 else [])+([k-ww] if yy else [])+([k+ww] if yy<hh-1 else []):
    if seen[neighbor]:seen[neighbor]=0;todo.append(neighbor)
  if len(component)>len(best):best=component
 keep=set(best)
 for k in best:
  yy,xx=divmod(k,ww)
  for dy in (-1,0,1):
   for dx in (-1,0,1):
    if 0<=xx+dx<ww and 0<=yy+dy<hh:keep.add((yy+dy)*ww+xx+dx)
 raw.putalpha(Image.frombytes('L',(ww,hh),bytes(a if k in keep else 0 for k,a in enumerate(alpha))));raw.save(S/f'{name}.png')
 dims=subprocess.check_output(['magick','identify','-format','%w %h',str(S/f'{name}.png')],text=True).split(); a,b=map(int,dims)
 parts[name]={'file':f'{name}.png','crop':dict(x=x,y=y,width=w,height=h),'sourceDimensions':dict(width=a,height=b),'pivot':dict(x=a*px,y=b*pivot),'composition':dict(zip(('x','y','w','h'),comp),pivotX=px,pivot=pivot,parent=parent)}
(S/'parts.json').write_text(json.dumps(dict(actor='skeleton',atlas='parts-left-v1.png',facing='left',sourceFacing='left',oppositeFacing='explicit horizontal mirror; handedness reverses',status='source candidate frozen for fresh anonymous neutral/joint critique; no motion acceptance',parts=parts),indent=2)+'\n')
v=lambda x,y:f'<vector><x>{x}</x><y>{y}</y></vector>'
p=lambda n,x:f'<param name="{n}">{x}</param>'
g=lambda n:hashlib.md5(('skeleton-neutral/'+n).encode()).hexdigest().upper()
def bone(n,parent,x,y):
 return f'<bone type="bone_object" guid="{g(n)}"><name><string>{n}</string></name><parent><bone_valuenode type="bone_object" guid="{g(parent)}"/></parent><origin>{v(x,y)}</origin><angle><angle value="0"/></angle><scalelx><real value="1"/></scalelx><scalex><real value="1"/></scalex><width><real value=".1"/></width><tipwidth><real value=".1"/></tipwidth><bone_depth><real value="0"/></bone_depth><length><real value="1"/></length></bone>'
bones=bone('body','root',128,112)
for n,a in parts.items():
 c=a['composition']; q=parts[c['parent']]['composition'] if c['parent']!='body' else dict(x=128,y=144)
 bones+=bone(n,c['parent'],c['x']-q['x'],q['y']-c['y'])
# Front-to-back order, emitted in reverse for Synfig. Children overlap their painted anatomical joint roots.
order=['head', 'hand_near', 'forearm_near', 'hand_far', 'forearm_far', 'upper_arm_near', 'upper_arm_far', 'torso', 'pelvis', 'shin_boot_near', 'thigh_near', 'shin_boot_far', 'thigh_far', 'coat_back']
layers=''
for n in reversed(order):
 c=parts[n]['composition']; tr=f'<bone_link type="transformation"><bone><bone_valuenode type="bone_object" guid="{g(n)}"/></bone><base_value><composite type="transformation"><offset>{v(0,0)}</offset><angle><angle value="0"/></angle><skew_angle><angle value="0"/></skew_angle><scale>{v(1,1)}</scale></composite></base_value><translate><bool value="true"/></translate><rotate><bool value="true"/></rotate><skew><bool value="true"/></skew><scale_x><bool value="true"/></scale_x><scale_y><bool value="true"/></scale_y></bone_link>'
 image=p('amount','<real value="1"/>')+p('blend_method','<integer value="0"/>')+p('tl',v(-c['w']*c['pivotX'],c['h']*c['pivot']))+p('br',v(c['w']*(1-c['pivotX']),-c['h']*(1-c['pivot'])))+p('c','<integer value="1"/>')+p('filename',f'<string>{n}.png</string>')
 layers+=f'<layer type="group" version="0.2" desc="{n}">'+p('amount','<real value="1"/>')+p('blend_method','<integer value="0"/>')+p('origin',v(0,0))+p('transformation',tr)+p('canvas',f'<canvas><layer type="import" version="0.1">{image}</layer></canvas>')+'</layer>'
skeleton='<layer type="skeleton" active="true" exclude_from_rendering="true" version="0.1" desc="editable native bones">'+p('name','<string>actor skeleton</string>')+p('bones','<static_list type="bone_object">'+''.join(f'<entry><bone type="bone_object" guid="{g(n)}"/></entry>' for n in ['body',*parts])+'</static_list>')+'</layer>'
for face in ['left','right']:
 tr=f'<composite type="transformation"><offset>{v(256 if face=="right" else 0,0)}</offset><angle><angle value="0"/></angle><skew_angle><angle value="0"/></skew_angle><scale>{v(-1 if face=="right" else 1,1)}</scale></composite>'
 sif=f'<?xml version="1.0"?><canvas version="1.0" width="256" height="256" view-box="0 256 256 0" fps="12" begin-time="0f" end-time="1s" bgcolor="0 0 0 0"><name>skeleton neutral {face}</name><bones><bone_root type="bone_object" guid="{g("root")}"/>{bones}</bones>{skeleton}<layer type="group" version="0.2">'+p('amount','<real value="1"/>')+p('origin',v(0,0))+p('transformation',tr)+p('canvas',f'<canvas>{layers}</canvas>')+'</layer></canvas>'
 (S/f'neutral-{face}.sif').write_text(sif.replace('><','>\n<')+'\n')
 subprocess.run(['/opt/homebrew/bin/synfig',str(S/f'neutral-{face}.sif'),'-t','png','-w','1024','-h','1024','--time','0f','-o',str(S/f'neutral-{face}-author.png')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 subprocess.run(['magick',str(S/f'neutral-{face}-author.png'),'-filter','Lanczos','-resize','128x128',f'PNG32:{S/f"neutral-{face}.png"}'],check=True)
print('14 isolated painted parts, 2 parented native neutral SIFs; native1024 linear sampling to Lanczos128.')
