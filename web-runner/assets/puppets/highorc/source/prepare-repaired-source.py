"""Rebuild native repaired cutout sources from painted parts and explicit actor-local pose controls."""
from pathlib import Path
import json,xml.etree.ElementTree as ET
S=Path(__file__).resolve().parent
P=json.loads((S/'parts.json').read_text())['parts']
V=lambda x,y:f'<vector><x>{x}</x><y>{y}</y></vector>'
def replace(parent,tag,text):
 old=parent.find(tag)
 if old is not None:parent.remove(old)
 parent.append(ET.fromstring(text))
def angle(node,values,times):
 replace(node,'angle','<angle><animated type="angle">'+''.join(f'<waypoint time="{t}s" before="linear" after="linear"><angle value="{v}"/></waypoint>'for t,v in zip(times,values))+'</animated></angle>')
controls={
 'attack':{'times':[0,.25,5/12,7/12,8/12],'angles':{'upper_arm_near':[0,50,85,35,0],'forearm_near':[0,-65,10,-10,0],'hand_near':[0,-15,-35,-5,0],'upper_arm_far':[0,-15,-20,-8,0],'forearm_far':[0,45,50,20,0],'hand_far':[0,-15,-20,-5,0]}},
 'cast':{'times':[0,.25,.5,.625,.75,11/12],'angles':{'upper_arm_near':[0,60,85,85,45,0],'forearm_near':[0,-60,-10,-10,-5,0],'hand_near':[0,-25,45,-15,-10,0],'upper_arm_far':[0,-12,-20,-20,-10,0],'forearm_far':[0,40,65,65,25,0],'hand_far':[0,-10,-25,-25,-8,0]}},
 'walk':{'times':[0,.25,.5,.75,1],'angles':{'upper_arm_near':[-22,22,-22,22,-22],'upper_arm_far':[22,-22,22,-22,22],'forearm_near':[5,5,5,5,5],'forearm_far':[-5,-5,-5,-5,-5]}},
 'movement':{'times':[0,.2,.4,.6,.725,.85,1],'angles':{'upper_arm_near':[0,50,85,85,85,45,0],'forearm_near':[0,-65,10,-10,-10,-5,0],'hand_near':[0,-15,-35,45,-15,-10,0],'upper_arm_far':[0,-15,-20,-20,-20,-10,0],'forearm_far':[0,45,50,65,65,25,0],'hand_far':[0,-15,-20,-25,-25,-8,0]}}
}
(S/'movement-controls.json').write_text(json.dumps({'canvas':256,'footOrigin':[128,250],'sourceFacing':'left','swordHand':'near','swordLocalAngle':0,'swordGlobalBasicContact':60,'swordGlobalCastRelease':120,'states':controls,'scope':'native source envelope diagnostics; no runtime timing/effects'},indent=2)+'\n')
for state in ['neutral',*controls]:
 for face in ['left','right']:
  tree=ET.parse(S.parent/'qa/accepted-c4c8b97d-source'/f'neutral-{face}.sif');canvas=tree.getroot()
  canvas.find('name').text=f'HighOrc repaired {state} {face}'
  canvas.set('end-time','1s')
  bones={b.find('name/string').text:b for b in canvas.findall('bones/bone')}
  for name,part in P.items():
   c=part['composition'];parent=P[c['parent']]['composition']if c['parent']!='body'else{'x':128,'y':144}
   replace(bones[name],'origin','<origin>'+V(c['x']-parent['x'],parent['y']-c['y'])+'</origin>')
   if state in controls:angle(bones[name],controls[state]['angles'].get(name,[0]*len(controls[state]['times'])),controls[state]['times'])
  for group in canvas.findall('.//layer[@type="group"]'):
   name=group.get('desc')
   if name not in P:continue
   c=P[name]['composition'];img=group.find('param[@name="canvas"]/canvas/layer[@type="import"]')
   for tag,value in [('tl',V(-c['w']*c['pivotX'],c['h']*c['pivot'])),('br',V(c['w']*(1-c['pivotX']),-c['h']*(1-c['pivot'])))]:replace(img.find(f'param[@name="{tag}"]'),'vector',value)
   img.find('param[@name="filename"]/string').text=P[name]['file']
   if img.find('param[@name="c"]')is None:img.append(ET.fromstring('<param name="c"><integer value="1"/></param>'))
  skeleton=ET.Element('layer',{'type':'skeleton','active':'true','exclude_from_rendering':'true','version':'0.1','desc':'editable anatomy bones'})
  skeleton.append(ET.fromstring('<param name="bones"><static_list type="bone_object">'+''.join('<entry><bone type="bone_object" guid="'+b.get('guid')+'"/></entry>'for b in bones.values())+'</static_list></param>'));canvas.insert(2,skeleton)
  ET.indent(tree,space=' ');tree.write(S/f'{state}-{face}.sif',encoding='utf-8',xml_declaration=True)
print('Repaired native neutral/movement/action envelope SIFs prepared; source paint unchanged.')
