"""Mechanical atlas isolation and native neutral bone assembly; no raster painting."""
import json, hashlib, subprocess
from pathlib import Path
S=Path(__file__).resolve().parent
# name, crop x/y/w/h, composition x/y/w/h, pivotY, parent
rows=[('head', (0, 0, 327, 359), (122, 121, 112, 116), 0.86, 'body'), ('torso', (327, 0, 310, 359), (128, 126, 88, 78), 0.12, 'body'), ('pelvis', (637, 0, 323, 359), (128, 177, 94, 49), 0.12, 'body'), ('coat_back', (960, 0, 287, 359), (127, 183, 34, 69), 0.12, 'body'), ('upper_arm_far', (0, 365, 327, 263), (95, 131, 36, 46), 0.12, 'body'), ('forearm_far', (327, 359, 310, 270), (104, 166, 33, 38), 0.12, 'upper_arm_far'), ('hand_far', (637, 359, 323, 270), (111, 197, 35, 30), 0.55, 'forearm_far'), ('upper_arm_near', (960, 365, 287, 259), (162, 131, 36, 46), 0.12, 'body'), ('forearm_near', (0, 645, 327, 279), (156, 166, 33, 38), 0.12, 'upper_arm_near'), ('hand_near', (327, 629, 310, 299), (147, 197, 35, 30), 0.55, 'forearm_near'), ('thigh_far', (637, 629, 323, 299), (147, 203, 46, 36), 0.12, 'body'), ('shin_boot_far', (960, 629, 287, 299), (149, 230, 42, 28), 0.3, 'thigh_far'), ('thigh_near', (0, 928, 327, 333), (109, 204, 47, 35), 0.12, 'body'), ('shin_boot_near', (327, 928, 310, 333), (105, 230, 42, 28), 0.3, 'thigh_near'), ('orb', (637, 928, 323, 333), (171, 183, 37, 37), 0.5, 'hand_near'), ('belt_cord', (960, 928, 287, 333), (158, 174, 24, 76), 0.05, 'pelvis')]
parts={}
for name,crop,comp,pivot,parent in rows:
 x,y,w,h=crop
 subprocess.run(['magick',str(S/'parts-left-v2.png'),'-crop',f'{w}x{h}+{x}+{y}','+repage','-trim','+repage',str(S/f'{name}.png')],check=True)
 if name=='hand_near':subprocess.run(['magick',str(S/f'{name}.png'),'-flop',str(S/f'{name}.png')],check=True)
 dims=subprocess.check_output(['magick','identify','-format','%w %h',str(S/f'{name}.png')],text=True).split(); a,b=map(int,dims)
 px=.87 if name=='hand_far' else .12 if name=='hand_near' and 'djinn' in str(S) else .18 if name=='hand_near' else .26 if name=='belt_cord' else .5
 parts[name]={'file':f'{name}.png','crop':dict(x=x,y=y,width=w,height=h),'sourceDimensions':dict(width=a,height=b),'pivot':dict(x=a*px,y=b*pivot),'composition':dict(zip(('x','y','w','h'),comp),pivotX=px,pivot=pivot,parent=parent)}
(S/'parts.json').write_text(json.dumps(dict(actor='djinn',atlas='parts-left-v2.png',facing='left',sourceFacing='left',oppositeFacing='explicit horizontal mirror; handedness reverses',basePartNames=14,attachments=({'orb':'hand_near','belt_cord':'pelvis'} if 'djinn' in str(S) else {}),nativeCanvas=[256,256],nativeFoot=[128,250],runtimeCanvas=[128,128],runtimeFoot=[64,125],nativeRenderer='/opt/homebrew/bin/synfig 1.5.5',authorRaster=[1024,1024],sampling='native linear import c=1 then Lanczos PNG32',status='source candidate frozen for fresh anonymous neutral/joint critique; no motion acceptance',parts=parts),indent=2)+'\n')
v=lambda x,y:f'<vector><x>{x}</x><y>{y}</y></vector>'
p=lambda n,x:f'<param name="{n}">{x}</param>'
g=lambda n:hashlib.md5(('djinn-neutral/'+n).encode()).hexdigest().upper()
def bone(n,parent,x,y):
 return f'<bone type="bone_object" guid="{g(n)}"><name><string>{n}</string></name><parent><bone_valuenode type="bone_object" guid="{g(parent)}"/></parent><origin>{v(x,y)}</origin><angle><angle value="0"/></angle><scalelx><real value="1"/></scalelx><scalex><real value="1"/></scalex><width><real value=".1"/></width><tipwidth><real value=".1"/></tipwidth><bone_depth><real value="0"/></bone_depth><length><real value="1"/></length></bone>'
bones=bone('body','root',128,112)
for n,a in parts.items():
 c=a['composition']; q=parts[c['parent']]['composition'] if c['parent']!='body' else dict(x=128,y=144)
 bones+=bone(n,c['parent'],c['x']-q['x'],q['y']-c['y'])
# Front-to-back order, emitted in reverse for Synfig. Hand overlays the separate palm-rooted orb; cord stays pelvis-owned.
order=['head', 'hand_near', 'hand_far', 'orb', 'forearm_near', 'forearm_far', 'upper_arm_near', 'upper_arm_far', 'torso', 'pelvis', 'shin_boot_near', 'thigh_near', 'shin_boot_far', 'thigh_far', 'coat_back', 'belt_cord']
layers=''
for n in reversed(order):
 c=parts[n]['composition']; tr=f'<bone_link type="transformation"><bone><bone_valuenode type="bone_object" guid="{g(n)}"/></bone><base_value><composite type="transformation"><offset>{v(0,0)}</offset><angle><angle value="0"/></angle><skew_angle><angle value="0"/></skew_angle><scale>{v(1,1)}</scale></composite></base_value><translate><bool value="true"/></translate><rotate><bool value="true"/></rotate><skew><bool value="true"/></skew><scale_x><bool value="true"/></scale_x><scale_y><bool value="true"/></scale_y></bone_link>'
 image=p('amount','<real value="1"/>')+p('blend_method','<integer value="0"/>')+p('tl',v(-c['w']*c['pivotX'],c['h']*c['pivot']))+p('br',v(c['w']*(1-c['pivotX']),-c['h']*(1-c['pivot'])))+p('c','<integer value="1"/>')+p('filename',f'<string>{n}.png</string>')
 layers+=f'<layer type="group" version="0.2" desc="{n}">'+p('amount','<real value="1"/>')+p('blend_method','<integer value="0"/>')+p('origin',v(0,0))+p('transformation',tr)+p('canvas',f'<canvas><layer type="import" version="0.1">{image}</layer></canvas>')+'</layer>'
skeleton='<layer type="skeleton" active="true" exclude_from_rendering="true" version="0.1" desc="editable native bones">'+p('name','<string>actor skeleton</string>')+p('bones','<static_list type="bone_object">'+''.join(f'<entry><bone type="bone_object" guid="{g(n)}"/></entry>' for n in ['body',*parts])+'</static_list>')+'</layer>'
for face in ['left','right']:
 tr=f'<composite type="transformation"><offset>{v(256 if face=="right" else 0,0)}</offset><angle><angle value="0"/></angle><skew_angle><angle value="0"/></skew_angle><scale>{v(-1 if face=="right" else 1,1)}</scale></composite>'
 sif=f'<?xml version="1.0"?><canvas version="1.0" width="256" height="256" view-box="0 256 256 0" fps="12" begin-time="0f" end-time="1s" bgcolor="0 0 0 0"><name>djinn neutral {face}</name><bones><bone_root type="bone_object" guid="{g("root")}"/>{bones}</bones>{skeleton}<layer type="group" version="0.2">'+p('amount','<real value="1"/>')+p('origin',v(0,0))+p('transformation',tr)+p('canvas',f'<canvas>{layers}</canvas>')+'</layer></canvas>'
 (S/f'neutral-{face}.sif').write_text(sif.replace('><','>\n<')+'\n')
 subprocess.run(['/opt/homebrew/bin/synfig',str(S/f'neutral-{face}.sif'),'-t','png','-w','1024','-h','1024','--time','0f','-o',str(S/f'neutral-{face}-author.png')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 subprocess.run(['magick',str(S/f'neutral-{face}-author.png'),'-filter','Lanczos','-resize','128x128','-strip',f'PNG32:{S/f"neutral-{face}.png"}'],check=True)
print(f'{len(parts)} isolated painted parts, 2 parented native neutral SIFs; native1024 linear sampling to Lanczos128.')
