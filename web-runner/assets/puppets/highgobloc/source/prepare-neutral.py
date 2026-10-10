"""Mechanical atlas isolation and native neutral bone assembly; no raster painting."""
import json, hashlib, subprocess
from PIL import Image
from pathlib import Path
S=Path(__file__).resolve().parent
# name, crop x/y/w/h, composition x/y/w/h, pivotY, parent
rows=[('head', (0, 0, 315, 345), (120, 126, 118, 115), 0.86, 'body'), ('torso', (315, 0, 300, 345), (128, 124, 100, 85), 0.12, 'body'), ('pelvis', (615, 0, 305, 345), (128, 179, 100, 61), 0.12, 'body'), ('coat_back', (920, 0, 310, 345), (132, 121, 110, 104), 0.12, 'body'), ('upper_arm_far', (0, 345, 315, 295), (89, 129, 46, 53), 0.12, 'body'), ('forearm_far', (315, 345, 300, 295), (77, 164, 36, 43), 0.12, 'upper_arm_far'), ('hand_far', (615, 345, 305, 295), (74, 195, 30, 31), 0.12, 'forearm_far'), ('upper_arm_near', (920, 345, 310, 295), (165, 129, 46, 53), 0.12, 'body'), ('forearm_near', (0, 640, 315, 295), (179, 164, 36, 43), 0.12, 'upper_arm_near'), ('hand_near', (315, 640, 300, 295), (184, 195, 30, 31), 0.12, 'forearm_near'), ('thigh_far', (615, 640, 305, 295), (150, 202, 46, 37), 0.12, 'body'), ('shin_boot_far', (920, 640, 310, 295), (151, 226, 41, 27), 0.12, 'thigh_far'), ('thigh_near', (0, 935, 315, 343), (109, 202, 46, 37), 0.12, 'body'), ('shin_boot_near', (315, 935, 300, 343), (108, 226, 41, 27), 0.12, 'thigh_near')]
arm_rows={
'upper_arm_far':((0,0,615,600),(84,132,40,57),.76,.20),
'upper_arm_near':((615,0,615,600),(172,132,40,57),.24,.20),
'forearm_far':((0,600,615,678),(66,170,32,43),.50,.17),
'forearm_near':((615,600,615,678),(190,170,32,43),.50,.17)}
parts={}
for name,crop,comp,pivot,parent in rows:
 px=.5
 atlas='parts-left-v2.png'
 if name in arm_rows:crop,comp,px,pivot=arm_rows[name];atlas='arms-left-v3.png'
 if name=='hand_far':comp=(65,201,30,31)
 if name=='hand_near':comp=(191,201,30,31)
 x,y,w,h=crop
 subprocess.run(['magick',str(S/atlas),'-crop',f'{w}x{h}+{x}+{y}','+repage','-trim','+repage',str(S/f'{name}.png')],check=True)
 dims=subprocess.check_output(['magick','identify','-format','%w %h',str(S/f'{name}.png')],text=True).split(); a,b=map(int,dims)
 parts[name]={'file':f'{name}.png','atlas':atlas,'crop':dict(x=x,y=y,width=w,height=h),'sourceDimensions':dict(width=a,height=b),'pivot':dict(x=a*px,y=b*pivot),'composition':dict(zip(('x','y','w','h'),comp),pivotX=px,pivot=pivot,parent=parent)}
# Mechanical isolation of generated mantle paint; preserve original torso pixels.
cloth=Image.open(S/'mantle-coverage-v3.png').convert('RGBA');tw,th=parts['torso']['sourceDimensions'].values();overlay=Image.new('RGBA',(tw,th))
for index,cx,cy,w,h in [(0,85,151,22,30),(1,165,151,31,30)]:
 patch=cloth.crop((index*887,0,(index+1)*887,887));patch=patch.crop(patch.getchannel('A').getbbox());patch=patch.resize((round(w*tw/100),round(h*th/85)),Image.Resampling.LANCZOS)
 overlay.alpha_composite(patch,(round((cx-w/2-78)*tw/100),round((cy-h/2-113.8)*th/85)))
overlay.save(S/'torso-coverage.png')
body=Image.open(S/'torso.png').convert('RGBA');body.save(S/'torso-base.png');body.alpha_composite(overlay);body.save(S/'torso.png')
parts['torso']['coveragePaintSource']='torso-coverage.png'
(S/'parts.json').write_text(json.dumps(dict(actor='highgobloc',atlas='parts-left-v2.png',facing='left',sourceFacing='left',oppositeFacing='explicit horizontal mirror; handedness reverses',status='source candidate frozen for fresh anonymous neutral/joint critique; no motion acceptance',parts=parts),indent=2)+'\n')
v=lambda x,y:f'<vector><x>{x}</x><y>{y}</y></vector>'
p=lambda n,x:f'<param name="{n}">{x}</param>'
g=lambda n:hashlib.md5(('highgobloc-neutral/'+n).encode()).hexdigest().upper()
def bone(n,parent,x,y):
 return f'<bone type="bone_object" guid="{g(n)}"><name><string>{n}</string></name><parent><bone_valuenode type="bone_object" guid="{g(parent)}"/></parent><origin>{v(x,y)}</origin><angle><angle value="0"/></angle><scalelx><real value="1"/></scalelx><scalex><real value="1"/></scalex><width><real value=".1"/></width><tipwidth><real value=".1"/></tipwidth><bone_depth><real value="0"/></bone_depth><length><real value="1"/></length></bone>'
bones=bone('body','root',128,112)
for n,a in parts.items():
 c=a['composition']; q=parts[c['parent']]['composition'] if c['parent']!='body' else dict(x=128,y=144)
 bones+=bone(n,c['parent'],c['x']-q['x'],q['y']-c['y'])
# Front-to-back; forearm painted elbow overlap covers upper-arm end. Mantle sleeves share shoulder bones.
order=['head','hand_near','forearm_near','hand_far','forearm_far','upper_arm_near','upper_arm_far','torso','pelvis','shin_boot_near','thigh_near','shin_boot_far','thigh_far','coat_back']
layers=''
for n in reversed(order):
 c=parts[n]['composition']; tr=f'<bone_link type="transformation"><bone><bone_valuenode type="bone_object" guid="{g(n)}"/></bone><base_value><composite type="transformation"><offset>{v(0,0)}</offset><angle><angle value="0"/></angle><skew_angle><angle value="0"/></skew_angle><scale>{v(1,1)}</scale></composite></base_value><translate><bool value="true"/></translate><rotate><bool value="true"/></rotate><skew><bool value="true"/></skew><scale_x><bool value="true"/></scale_x><scale_y><bool value="true"/></scale_y></bone_link>'
 image=p('amount','<real value="1"/>')+p('blend_method','<integer value="0"/>')+p('tl',v(-c['w']*c['pivotX'],c['h']*c['pivot']))+p('br',v(c['w']*(1-c['pivotX']),-c['h']*(1-c['pivot'])))+p('c','<integer value="1"/>')+p('filename',f'<string>{n}.png</string>')
 layers+=f'<layer type="group" version="0.2" desc="{n}">'+p('amount','<real value="1"/>')+p('blend_method','<integer value="0"/>')+p('origin',v(0,0))+p('transformation',tr)+p('canvas',f'<canvas><layer type="import" version="0.1">{image}</layer></canvas>')+'</layer>'
skeleton='<layer type="skeleton" active="true" exclude_from_rendering="true" version="0.1" desc="editable native bones">'+p('name','<string>actor skeleton</string>')+p('bones','<static_list type="bone_object">'+''.join(f'<entry><bone type="bone_object" guid="{g(n)}"/></entry>' for n in ['body',*parts])+'</static_list>')+'</layer>'
for face in ['left','right']:
 tr=f'<composite type="transformation"><offset>{v(256 if face=="right" else 0,0)}</offset><angle><angle value="0"/></angle><skew_angle><angle value="0"/></skew_angle><scale>{v(-1 if face=="right" else 1,1)}</scale></composite>'
 sif=f'<?xml version="1.0"?><canvas version="1.0" width="256" height="256" view-box="0 256 256 0" fps="12" begin-time="0f" end-time="1s" bgcolor="0 0 0 0"><name>highgobloc neutral {face}</name><bones><bone_root type="bone_object" guid="{g("root")}"/>{bones}</bones>{skeleton}<layer type="group" version="0.2">'+p('amount','<real value="1"/>')+p('origin',v(0,0))+p('transformation',tr)+p('canvas',f'<canvas>{layers}</canvas>')+'</layer></canvas>'
 (S/f'neutral-{face}.sif').write_text(sif.replace('><','>\n<')+'\n')
 subprocess.run(['/opt/homebrew/bin/synfig',str(S/f'neutral-{face}.sif'),'-t','png','-w','1024','-h','1024','--time','0f','-o',str(S/f'neutral-{face}-author.png')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 subprocess.run(['magick',str(S/f'neutral-{face}-author.png'),'-filter','Lanczos','-resize','128x128',f'PNG32:{S/f"neutral-{face}.png"}'],check=True)
print('14 isolated painted parts, 2 parented native neutral SIFs; native1024 linear sampling to Lanczos128.')
