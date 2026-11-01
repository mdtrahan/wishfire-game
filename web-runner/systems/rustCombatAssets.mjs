import { runtimeAssetUrl } from './runtimeAssetUrl.mjs';

// Loaded exclusively by the localhost rustCombat runtime. Source pixels are unchanged.
export async function preloadRustCombatAssets({ fetchAsset = fetch, ImageClass = Image, FontClass = FontFace, fonts = document.fonts } = {}) {
  const root = runtimeAssetUrl('rust-combat/');
  const response = await fetchAsset(`${root}manifest.json`);
  if (!response.ok) throw new Error(`Rust VFX manifest HTTP ${response.status}`);
  const manifest = await response.json(), files = new Map(), entries = new Map();
  const load = file => {
    if (!files.has(file)) files.set(file, (async () => {
      const image = new ImageClass(); image.src = root + file;
      await image.decode(); return image;
    })());
    return files.get(file);
  };
  await Promise.all(Object.entries(manifest.effects).map(async ([id, entry]) => {
    const image = await load(entry.file);
    if (image.width !== entry.frame_size[0] * entry.frame_count || image.height !== entry.frame_size[1]) throw new Error(`Rust VFX sheet dimensions: ${id}`);
    const canvas=document.createElement('canvas');canvas.width=entry.frame_size[0];canvas.height=entry.frame_size[1];const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;let x0=canvas.width,x1=0;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(rgba[(y*canvas.width+x)*4+3]>12){x0=Math.min(x0,x);x1=Math.max(x1,x);}
    const centered=entry.file.startsWith('telegraph/')||entry.file.startsWith('projectiles/')||entry.file.startsWith('elevate/')||entry.file.startsWith('vfx/resurrect/');
    entries.set(id, { ...entry, image, centered, duration:entry.frame_ms.reduce((a,b)=>a+b,0)/1000, boundsX:x0+.5,boundsWidth:Math.max(1,x1-x0) });
  }));
  const font = new FontClass('SliceBungee', `url("${root}${manifest.font}")`);
  await font.load(); fonts.add(font);
  return { manifest, entries, dispose() { fonts.delete(font); files.clear(); entries.clear(); } };
}

export function sampleRustVfx(entry, age) {
  if (age < 0) return -1;
  if (entry.frame_count === 1) return 0;
  let ms = age * 1000;
  for (let i = 0; i < entry.frame_ms.length; i++) {
    if (ms < entry.frame_ms[i]) return i;
    ms -= entry.frame_ms[i];
  }
  return -1;
}

export function rustVfxFrameAlpha(entry, age, frame) {
  if (entry.frame_count === 1 || frame + 1 < entry.frame_count) return 1;
  let ms = age * 1000;
  for (let i = 0; i < frame; i++) ms -= entry.frame_ms[i];
  return Math.max(0, 1 - ms / entry.frame_ms[frame]);
}
