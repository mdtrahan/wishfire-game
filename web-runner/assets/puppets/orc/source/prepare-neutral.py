"""Mechanical atlas isolation and native neutral bone assembly; no raster painting."""
import json, hashlib, subprocess
from pathlib import Path
S=Path(__file__).resolve().parent
# name, crop x/y/w/h, composition x/y/w/h, pivotY, parent
rows=[('head', (0, 0, 347, 367), (120, 126, 118, 115), 0.86, 'body'), ('torso', (347, 0, 293, 367), (128, 124, 100, 85), 0.12, 'body'), ('pelvis', (640, 0, 316, 367), (128, 179, 100, 61), 0.12, 'body'), ('coat_back', (956, 0, 284, 367), (132, 121, 110, 104), 0.12, 'body'), ('upper_arm_far', (0, 367, 347, 282), (89, 129, 46, 53), 0.12, 'body'), ('forearm_far', (347, 367, 293, 282), (77, 164, 36, 43), 0.12, 'upper_arm_far'), ('hand_far', (640, 367, 316, 282), (74, 195, 30, 31), 0.12, 'forearm_far'), ('upper_arm_near', (956, 367, 284, 282), (165, 129, 46, 53), 0.12, 'body'), ('forearm_near', (0, 649, 347, 300), (179, 164, 36, 43), 0.12, 'upper_arm_near'), ('hand_near', (347, 649, 293, 300), (184, 195, 30, 31), 0.12, 'forearm_near'), ('thigh_far', (640, 649, 316, 300), (150, 202, 46, 37), 0.12, 'body'), ('shin_boot_far', (956, 649, 284, 300), (151, 226, 41, 27), 0.12, 'thigh_far'), ('thigh_near', (0, 949, 347, 320), (109, 202, 46, 37), 0.12, 'body'), ('shin_boot_near', (347, 949, 293, 320), (108, 226, 41, 27), 0.12, 'thigh_near')]
parts={}
for name,crop,comp,pivot,parent in rows:
 x,y,w,h=crop
 subprocess.run(['magick',str(S/'parts-left-v1.png'),'-crop',f'{w}x{h}+{x}+{y}','+repage','-trim','+repage',str(S/f'{name}.png')],check=True)
 dims=subprocess.check_output(['magick','identify','-format','%w %h',str(S/f'{name}.png')],text=True).split(); a,b=map(int,dims)
 parts[name]={'file':f'{name}.png','crop':dict(x=x,y=y,width=w,height=h),'sourceDimensions':dict(width=a,height=b),'pivot':dict(x=a*.5,y=b*pivot),'composition':dict(zip(('x','y','w','h'),comp),pivotX=.5,pivot=pivot,parent=parent)}
(S/'parts.json').write_text(json.dumps(dict(actor='orc',atlas='parts-left-v1.png',facing='left',sourceFacing='left',oppositeFacing='explicit horizontal mirror; handedness reverses',status='source candidate frozen for fresh anonymous neutral/joint critique; no motion acceptance',parts=parts),indent=2)+'\n')
v=lambda x,y:f'<vector><x>{x}</x><y>{y}</y></vector>'
p=lambda n,x:f'<param name="{n}">{x}</param>'
g=lambda n:hashlib.md5(('orc-neutral/'+n).encode()).hexdigest().upper()
def bone(n,parent,x,y):
 return f'<bone type="bone_object" guid="{g(n)}"><name><string>{n}</string></name><parent><bone_valuenode type="bone_object" guid="{g(parent)}"/></parent><origin>{v(x,y)}</origin><angle><angle value="0"/></angle><scalelx><real value="1"/></scalelx><scalex><real value="1"/></scalex><width><real value=".1"/></width><tipwidth><real value=".1"/></tipwidth><bone_depth><real value="0"/></bone_depth><length><real value="1"/></length></bone>'
bones=bone('body','root',128,112)
for n,a in parts.items():
 c=a['composition']; q=parts[c['parent']]['composition'] if c['parent']!='body' else dict(x=128,y=144)
 bones+=bone(n,c['parent'],c['x']-q['x'],q['y']-c['y'])
# Front-to-back order, emitted in reverse for Synfig. Hand covers its sword grip.
order=['head','hand_near','forearm_near','torso','pelvis','upper_arm_near','upper_arm_far','shin_boot_near','thigh_near','hand_far','forearm_far','shin_boot_far','thigh_far','coat_back']
layers=''
for n in reversed(order):
 c=parts[n]['composition']; tr=f'<bone_link type="transformation"><bone><bone_valuenode type="bone_object" guid="{g(n)}"/></bone><base_value><composite type="transformation"><offset>{v(0,0)}</offset><angle><angle value="0"/></angle><skew_angle><angle value="0"/></skew_angle><scale>{v(1,1)}</scale></composite></base_value><translate><bool value="true"/></translate><rotate><bool value="true"/></rotate><skew><bool value="true"/></skew><scale_x><bool value="true"/></scale_x><scale_y><bool value="true"/></scale_y></bone_link>'
 image=p('amount','<real value="1"/>')+p('blend_method','<integer value="0"/>')+p('tl',v(-c['w']*.5,c['h']*c['pivot']))+p('br',v(c['w']*.5,-c['h']*(1-c['pivot'])))+p('c','<integer value="1"/>')+p('filename',f'<string>{n}.png</string>')
 layers+=f'<layer type="group" version="0.2" desc="{n}">'+p('amount','<real value="1"/>')+p('blend_method','<integer value="0"/>')+p('origin',v(0,0))+p('transformation',tr)+p('canvas',f'<canvas><layer type="import" version="0.1">{image}</layer></canvas>')+'</layer>'
skeleton='<layer type="skeleton" active="true" exclude_from_rendering="true" version="0.1" desc="editable native bones">'+p('name','<string>actor skeleton</string>')+p('bones','<static_list type="bone_object">'+''.join(f'<entry><bone type="bone_object" guid="{g(n)}"/></entry>' for n in ['body',*parts])+'</static_list>')+'</layer>'
for face in ['left','right']:
 tr=f'<composite type="transformation"><offset>{v(256 if face=="right" else 0,0)}</offset><angle><angle value="0"/></angle><skew_angle><angle value="0"/></skew_angle><scale>{v(-1 if face=="right" else 1,1)}</scale></composite>'
 sif=f'<?xml version="1.0"?><canvas version="1.0" width="256" height="256" view-box="0 256 256 0" fps="12" begin-time="0f" end-time="1s" bgcolor="0 0 0 0"><name>orc neutral {face}</name><bones><bone_root type="bone_object" guid="{g("root")}"/>{bones}</bones>{skeleton}<layer type="group" version="0.2">'+p('amount','<real value="1"/>')+p('origin',v(0,0))+p('transformation',tr)+p('canvas',f'<canvas>{layers}</canvas>')+'</layer></canvas>'
 (S/f'neutral-{face}.sif').write_text(sif.replace('><','>\n<')+'\n')
 subprocess.run(['/opt/homebrew/bin/synfig',str(S/f'neutral-{face}.sif'),'-t','png','-w','1024','-h','1024','--time','0f','-o',str(S/f'neutral-{face}-author.png')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 subprocess.run(['magick',str(S/f'neutral-{face}-author.png'),'-filter','Lanczos','-resize','128x128',f'PNG32:{S/f"neutral-{face}.png"}'],check=True)
print('14 isolated painted parts, 2 parented native neutral SIFs; native1024 linear sampling to Lanczos128.')
