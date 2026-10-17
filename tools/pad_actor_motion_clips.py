"""Restore off-canvas limbs with native overscan; retain actor scale and feet."""
from pathlib import Path
import copy, json, subprocess, tempfile
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'web-runner/assets/puppets'
TARGETS = {'fara': ['cast', 'ko'], 'hondo': ['cast', 'ko'], 'kaja': ['cast', 'ko'], 'gobloc': ['ko'], 'highorc': ['ko'], 'djinn': ['ko']}

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--actor', choices=list(TARGETS))
    args = parser.parse_args()
    manifest_path = BASE / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    for actor, states in TARGETS.items():
        if args.actor and actor != args.actor:
            continue
        for state in states:
            for facing, clip in manifest['actors'][actor]['clips'][state].items():
                source = BASE / clip['source']
                root = ET.parse(source).getroot()
                # 64 native pixels on each edge, at the original native texel scale.
                root.set('width', '384'); root.set('height', '384')
                root.set('view-box', '-64 320 320 -64')
                with tempfile.NamedTemporaryFile(prefix='.overscan-', suffix='.sif', dir=source.parent) as native:
                    ET.ElementTree(root).write(native.name, encoding='utf-8', xml_declaration=True)
                    with tempfile.TemporaryDirectory(prefix='puppet-overscan-') as scratch:
                        count=len(clip['frames'])
                        subprocess.run(['/opt/homebrew/bin/synfig',native.name,'--begin-time','0f','--end-time',f'{(count-1)/12}s','--fps','12','-w','1536','-h','1536','-t','png','-o',scratch+'/frame.png'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
                        for i, name in enumerate(clip['frames']):
                            with Image.open(Path(scratch)/f'frame.{i:04}.png') as image:
                                image.convert('RGBA').resize((192,192),Image.Resampling.LANCZOS).save(BASE/name)
                clip['canvas']={'width':192,'height':192,'referenceHeight':128}
                clip['footOrigin']={'x':96,'y':157}
                manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
                print(actor,state,facing,count,flush=True)
