"""Export recovered Djinn/High Orc rigs with existing native motion curves.

Paint, attachment parents, neutral geometry, and existing High Orc actions stay
unchanged. Shared motion channels are relative to the template's opening pose.
"""
from pathlib import Path
import copy
import json
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'web-runner/assets/puppets'
STATES = {'idle': ('idle', 1), 'walk': ('walk', 1), 'basic': ('attack', .75),
          'cast': ('cast', 1), 'hurt': ('hit', .5), 'ko': ('defeated', 1), 'spawn': ('spawn', .75)}


def bones(root):
    return {b.findtext('name/string'): b for b in root.findall('./bones/bone')}


def motion_channel(target, template, channel):
    source = template.find(channel)
    if source is None or source[0].tag != 'animated':
        return
    current = target.find(channel)
    value = copy.deepcopy(source)
    if channel == 'origin':
        first = value.find('animated/waypoint/vector')
        neutral = current.find('vector')
        for axis in ('x', 'y'):
            offset = float(neutral.findtext(axis)) - float(first.findtext(axis))
            for node in value.findall('animated/waypoint/vector/' + axis):
                node.text = str(float(node.text) + offset)
    else:
        offset = float(current.find('angle').get('value')) - float(value.find('animated/waypoint/angle').get('value'))
        for node in value.findall('animated/waypoint/angle'):
            node.set('value', str(float(node.get('value')) + offset))
    target.remove(current)
    target.append(value)


def export(actor, states=None):
    source_dir = BASE / actor / 'source'
    template_actor = 'marid' if actor == 'djinn' else 'orc'
    manifest = json.loads((BASE / 'manifest.json').read_text())['actors'].get(actor, {'sourceFacing': 'left', 'oppositeFacing': 'mirrored-source; asymmetric costume reverses sides', 'clips': {}})
    for semantic, (state, duration) in STATES.items():
        if states and semantic not in states:
            continue
        for facing in ('left', 'right'):
            path = source_dir / f'{state}-{facing}.sif'
            if not path.exists():
                root = ET.parse(source_dir / f'neutral-{facing}.sif').getroot()
                template = ET.parse(BASE / template_actor / 'source' / f'{state}-{facing}.sif').getroot()
                root.set('end-time', f'{duration}s')
                root.find('name').text = f'{actor} {state} {facing}'
                native_bones = bones(root)
                for name, bone in bones(template).items():
                    if name in native_bones:
                        for channel in ('origin', 'angle'):
                            if channel == 'origin' and name != 'body':
                                continue  # Neutral local attachments belong to this actor's anatomy.
                            motion_channel(native_bones[name], bone, channel)
                # Spawn's authored fade is a native group-opacity channel.
                if state == 'spawn':
                    amount = root.find('./layer[@type="group"]/param[@name="amount"]')
                    template_amount = template.find('./layer[@type="group"]/param[@name="amount"]')
                    if amount is not None and template_amount is not None:
                        amount.clear(); amount.set('name', 'amount')
                        amount.extend(copy.deepcopy(list(template_amount)))
                ET.indent(root)
                ET.ElementTree(root).write(path, encoding='utf-8', xml_declaration=True)
            count = round(duration * 12)
            paths = [f'{actor}/frames/{state}-{facing}-{i:03}.png' for i in range(count)]
            (BASE / actor / 'frames').mkdir(exist_ok=True)
            with tempfile.TemporaryDirectory(prefix=f'{actor}-{state}-') as scratch:
                subprocess.run(['/opt/homebrew/bin/synfig', str(path), '--begin-time', '0f', '--end-time', f'{(count-1)/12}s', '--fps', '12', '-w', '1024', '-h', '1024', '-t', 'png', '-o', scratch + '/frame.png'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                for i, destination in enumerate(paths):
                    with Image.open(Path(scratch) / f'frame.{i:04}.png') as image:
                        image.convert('RGBA').resize((128, 128), Image.Resampling.LANCZOS).save(BASE / destination)
            clip = {'source': f'{actor}/source/{path.name}', 'frames': paths, 'frameHoldMs': [1000/12]*count,
                    'loop': state in ('idle', 'walk'), 'canvas': {'width': 128, 'height': 128}, 'footOrigin': {'x': 64, 'y': 125}}
            marker = 'impactTimeMs' if semantic == 'basic' else 'releaseTimeMs' if semantic == 'cast' else None
            if marker:
                clip[marker] = 5000/12 if semantic == 'basic' else 500
            manifest['clips'].setdefault(semantic, {})[facing] = clip
            print(actor, state, facing, count, flush=True)
    return manifest


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--actor', choices=['djinn', 'highorc'])
    parser.add_argument('--states', nargs='+', choices=list(STATES))
    args = parser.parse_args()
    manifest_path = BASE / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    for actor in ([args.actor] if args.actor else ['djinn', 'highorc']):
        manifest['actors'][actor] = export(actor, args.states)
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
