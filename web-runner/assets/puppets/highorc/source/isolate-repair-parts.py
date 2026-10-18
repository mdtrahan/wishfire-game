"""Reproduce only recorded mechanical alpha isolation from preserved generated replacement sheets."""
from pathlib import Path
import json,subprocess
S=Path(__file__).resolve().parent
for name,p in json.loads((S/'parts.json').read_text())['parts'].items():
 r=p.get('replacementSource')
 if not r:continue
 c=r['crop'];subprocess.run(['magick',str(S/r['atlas']),'-crop',f"{c['width']}x{c['height']}+{c['x']}+{c['y']}",'+repage','-trim','+repage','-strip','PNG32:'+str(S/p['file'])],check=True)
print('Recorded generated paint cropped/trimmed; no creative raster paint.')
