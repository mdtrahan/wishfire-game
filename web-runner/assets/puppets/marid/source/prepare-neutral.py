"""Mechanical atlas isolation and native neutral bone assembly; no raster painting."""
import json, hashlib, subprocess
from pathlib import Path
S=Path(__file__).resolve().parent
# name, crop x/y/w/h, composition x/y/w/h, pivotY, parent
rows=[('head', (0, 0, 338, 370), (125, 117, 112, 109), 0.86, 'body'), ('torso', (340, 45, 330, 325), (128, 120, 114, 83), 0.12, 'body'), ('pelvis', (674, 70, 286, 301), (128, 178, 114, 49), 0.12, 'body'), ('coat_back', (975, 110, 255, 230), (128, 182, 50, 53), 0.12, 'body'), ('upper_arm_far', (0, 398, 335, 249), (85, 130, 47, 48), 0.12, 'body'), ('forearm_far', (343, 377, 283, 282), (77, 166, 40, 38), 0.12, 'upper_arm_far'), ('hand_far', (640, 401, 296, 230), (96, 193, 32, 29), 0.17, 'forearm_far'), ('upper_arm_near', (952, 368, 278, 272), (169, 130, 47, 48), 0.12, 'body'), ('forearm_near', (0, 651, 323, 278), (173, 166, 40, 38), 0.12, 'upper_arm_near'), ('hand_near', (329, 676, 296, 244), (175, 193, 32, 29), 0.17, 'forearm_near'), ('thigh_far', (630, 637, 309, 298), (154, 204, 55, 34), 0.12, 'body'), ('shin_boot_far', (962, 645, 268, 295), (157, 230, 47, 28), 0.3, 'thigh_far'), ('thigh_near', (0, 938, 330, 339), (104, 204, 55, 34), 0.12, 'body'), ('shin_boot_near', (339, 935, 308, 343), (98, 230, 47, 28), 0.3, 'thigh_near')]
parts={}
for name,crop,comp,pivot,parent in rows:
 x,y,w,h=crop
 subprocess.run(['magick',str(S/'parts-left-v2.png'),'-crop',f'{w}x{h}+{x}+{y}','+repage','-trim','+repage',str(S/f'{name}.png')],check=True)
 # Atlas ownership: disconnected neighboring clothing belongs to another cell.
 if name in ('torso','pelvis'):
  remove='2' if name=='torso' else '2,3'
  mask=S/f'isolation-{name}-mask.png'
  subprocess.run(['magick',str(S/f'{name}.png'),'-alpha','extract','-threshold','10%','-define',f'connected-components:remove={remove}','-define','connected-components:mean-color=true','-connected-components','8','-morphology','Dilate','Disk:3',str(mask)],check=True)
  subprocess.run(['magick',str(S/f'{name}.png'),'(',str(mask),'-alpha','Copy',')','-compose','DstIn','-composite',str(S/f'{name}.png')],check=True)
 dims=subprocess.check_output(['magick','identify','-format','%w %h',str(S/f'{name}.png')],text=True).split(); a,b=map(int,dims)
 px=.87 if name=='hand_far' else .88 if name=='hand_near' and 'djinn' in str(S) else .18 if name=='hand_near' else .5
 parts[name]={'file':f'{name}.png','crop':dict(x=x,y=y,width=w,height=h),'sourceDimensions':dict(width=a,height=b),'pivot':dict(x=a*px,y=b*pivot),'composition':dict(zip(('x','y','w','h'),comp),pivotX=px,pivot=pivot,parent=parent)}
(S/'parts.json').write_text(json.dumps(dict(actor='marid',atlas='parts-left-v2.png',facing='left',sourceFacing='left',oppositeFacing='explicit horizontal mirror; handedness reverses',basePartNames=14,attachments=({'orb':'hand_near','belt_cord':'pelvis'} if 'djinn' in str(S) else {}),nativeCanvas=[256,256],nativeFoot=[128,250],runtimeCanvas=[128,128],runtimeFoot=[64,125],nativeRenderer='/opt/homebrew/bin/synfig 1.5.5',authorRaster=[1024,1024],sampling='native linear import c=1 then Lanczos PNG32',status='source candidate frozen for fresh anonymous neutral/joint critique; no motion acceptance',parts=parts),indent=2)+'\n')
v=lambda x,y:f'<vector><x>{x}</x><y>{y}</y></vector>'
p=lambda n,x:f'<param name="{n}">{x}</param>'
g=lambda n:hashlib.md5(('marid-neutral/'+n).encode()).hexdigest().upper()
def bone(n,parent,x,y):
 return f'<bone type="bone_object" guid="{g(n)}"><name><string>{n}</string></name><parent><bone_valuenode type="bone_object" guid="{g(parent)}"/></parent><origin>{v(x,y)}</origin><angle><angle value="0"/></angle><scalelx><real value="1"/></scalelx><scalex><real value="1"/></scalex><width><real value=".1"/></width><tipwidth><real value=".1"/></tipwidth><bone_depth><real value="0"/></bone_depth><length><real value="1"/></length></bone>'
bones=bone('body','root',128,112)
for n,a in parts.items():
 c=a['composition']; q=parts[c['parent']]['composition'] if c['parent']!='body' else dict(x=128,y=144)
 bones+=bone(n,c['parent'],c['x']-q['x'],q['y']-c['y'])
# Front-to-back order, emitted in reverse for Synfig. Clothing crops exclude neighboring arm/leg cells.
order=['head', 'hand_near', 'hand_far', 'forearm_near', 'forearm_far', 'upper_arm_near', 'upper_arm_far', 'torso', 'pelvis', 'shin_boot_near', 'thigh_near', 'shin_boot_far', 'thigh_far', 'coat_back']
layers=''
for n in reversed(order):
 c=parts[n]['composition']; tr=f'<bone_link type="transformation"><bone><bone_valuenode type="bone_object" guid="{g(n)}"/></bone><base_value><composite type="transformation"><offset>{v(0,0)}</offset><angle><angle value="0"/></angle><skew_angle><angle value="0"/></skew_angle><scale>{v(1,1)}</scale></composite></base_value><translate><bool value="true"/></translate><rotate><bool value="true"/></rotate><skew><bool value="true"/></skew><scale_x><bool value="true"/></scale_x><scale_y><bool value="true"/></scale_y></bone_link>'
 image=p('amount','<real value="1"/>')+p('blend_method','<integer value="0"/>')+p('tl',v(-c['w']*c['pivotX'],c['h']*c['pivot']))+p('br',v(c['w']*(1-c['pivotX']),-c['h']*(1-c['pivot'])))+p('c','<integer value="1"/>')+p('filename',f'<string>{n}.png</string>')
 layers+=f'<layer type="group" version="0.2" desc="{n}">'+p('amount','<real value="1"/>')+p('blend_method','<integer value="0"/>')+p('origin',v(0,0))+p('transformation',tr)+p('canvas',f'<canvas><layer type="import" version="0.1">{image}</layer></canvas>')+'</layer>'
skeleton='<layer type="skeleton" active="true" exclude_from_rendering="true" version="0.1" desc="editable native bones">'+p('name','<string>actor skeleton</string>')+p('bones','<static_list type="bone_object">'+''.join(f'<entry><bone type="bone_object" guid="{g(n)}"/></entry>' for n in ['body',*parts])+'</static_list>')+'</layer>'
for face in ['left','right']:
 tr=f'<composite type="transformation"><offset>{v(256 if face=="right" else 0,0)}</offset><angle><angle value="0"/></angle><skew_angle><angle value="0"/></skew_angle><scale>{v(-1 if face=="right" else 1,1)}</scale></composite>'
 sif=f'<?xml version="1.0"?><canvas version="1.0" width="256" height="256" view-box="0 256 256 0" fps="12" begin-time="0f" end-time="1s" bgcolor="0 0 0 0"><name>marid neutral {face}</name><bones><bone_root type="bone_object" guid="{g("root")}"/>{bones}</bones>{skeleton}<layer type="group" version="0.2">'+p('amount','<real value="1"/>')+p('origin',v(0,0))+p('transformation',tr)+p('canvas',f'<canvas>{layers}</canvas>')+'</layer></canvas>'
 (S/f'neutral-{face}.sif').write_text(sif.replace('><','>\n<')+'\n')
 subprocess.run(['/opt/homebrew/bin/synfig',str(S/f'neutral-{face}.sif'),'-t','png','-w','1024','-h','1024','--time','0f','-o',str(S/f'neutral-{face}-author.png')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 subprocess.run(['magick',str(S/f'neutral-{face}-author.png'),'-filter','Lanczos','-resize','128x128','-strip',f'PNG32:{S/f"neutral-{face}.png"}'],check=True)
print(f'{len(parts)} isolated painted parts, 2 parented native neutral SIFs; native1024 linear sampling to Lanczos128.')
