"""Mechanical atlas isolation and native neutral bone assembly; no raster painting."""
import json, hashlib, subprocess
from pathlib import Path
from PIL import Image
from collections import deque
S=Path(__file__).resolve().parent
# name, crop x/y/w/h, composition x/y/w/h, pivotY, parent
rows=[('head', (2, 21, 318, 316), (121, 126, 120, 115), 0.5, 0.86, 'body'),
 ('torso', (331, 44, 324, 297), (128, 130, 106, 84), 0.5, 0.12, 'body'),
 ('pelvis', (644, 64, 309, 295), (128, 181, 105, 65), 0.5, 0.12, 'body'),
 ('coat_back', (961, 60, 272, 299), (132, 179, 101, 75), 0.5, 0.12, 'body'),
 ('upper_arm_far', (62, 370, 184, 255), (92, 137, 42, 53), 0.53, 0.28, 'body'),
 ('forearm_far', (379, 361, 164, 279), (83, 167, 38, 42), 0.69, 0.25, 'upper_arm_far'),
 ('hand_far', (676, 444, 194, 189), (83, 194, 31, 31), 0.76, 0.23, 'forearm_far'),
 ('upper_arm_near', (986, 362, 192, 268), (164, 137, 42, 53), 0.36, 0.28, 'body'),
 ('forearm_near', (42, 645, 223, 284), (178, 167, 38, 42), 0.7, 0.16, 'upper_arm_near'),
 ('hand_near', (364, 708, 208, 200), (159, 197, 31, 31), 0.22, 0.12, 'forearm_near'),
 ('thigh_far', (657, 677, 251, 257), (150, 202, 46, 37), 0.5, 0.12, 'body'),
 ('shin_boot_far', (1018, 643, 157, 285), (151, 226, 41, 27), 0.5, 0.12, 'thigh_far'),
 ('thigh_near', (37, 964, 260, 267), (109, 202, 46, 37), 0.5, 0.12, 'body'),
 ('shin_boot_near', (406, 933, 178, 301), (108, 226, 41, 27), 0.5, 0.12, 'thigh_near')]
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
(S/'parts.json').write_text(json.dumps(dict(actor='troll',atlas='parts-left-v1.png',facing='left',sourceFacing='left',oppositeFacing='explicit horizontal mirror; handedness reverses',status='source candidate frozen for fresh anonymous neutral/joint critique; no motion acceptance',parts=parts),indent=2)+'\n')
v=lambda x,y:f'<vector><x>{x}</x><y>{y}</y></vector>'
p=lambda n,x:f'<param name="{n}">{x}</param>'
g=lambda n:hashlib.md5(('troll-neutral/'+n).encode()).hexdigest().upper()
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
 sif=f'<?xml version="1.0"?><canvas version="1.0" width="256" height="256" view-box="0 256 256 0" fps="12" begin-time="0f" end-time="1s" bgcolor="0 0 0 0"><name>troll neutral {face}</name><bones><bone_root type="bone_object" guid="{g("root")}"/>{bones}</bones>{skeleton}<layer type="group" version="0.2">'+p('amount','<real value="1"/>')+p('origin',v(0,0))+p('transformation',tr)+p('canvas',f'<canvas>{layers}</canvas>')+'</layer></canvas>'
 (S/f'neutral-{face}.sif').write_text(sif.replace('><','>\n<')+'\n')
 subprocess.run(['/opt/homebrew/bin/synfig',str(S/f'neutral-{face}.sif'),'-t','png','-w','1024','-h','1024','--time','0f','-o',str(S/f'neutral-{face}-author.png')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 subprocess.run(['magick',str(S/f'neutral-{face}-author.png'),'-filter','Lanczos','-resize','128x128',f'PNG32:{S/f"neutral-{face}.png"}'],check=True)
print('14 isolated painted parts, 2 parented native neutral SIFs; native1024 linear sampling to Lanczos128.')
