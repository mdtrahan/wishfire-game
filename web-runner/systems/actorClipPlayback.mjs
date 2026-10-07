// Exported PNG clips are presentation only. Callers supply frozen-aware simulation age.
const safeName = value => /^[a-z][a-z0-9_-]*$/.test(value);

export function createActorClipLoader({ loadManifest, loadImage, frameUrl }) {
  let manifestPromise;
  const requests = new Map();
  return (actor, state, facing) => {
    if (![actor, state].every(value => typeof value === 'string' && safeName(value)) || !['left', 'right'].includes(facing)) return Promise.resolve(null);
    const key = `${actor}/${state}/${facing}`;
    if (requests.has(key)) return requests.get(key);
    const request = (async () => {
      manifestPromise ||= Promise.resolve().then(loadManifest).catch(() => null);
      const entry = (await manifestPromise)?.actors?.[actor]?.clips?.[state]?.[facing];
      if (!entry || !Array.isArray(entry.frames) || !entry.frames.length || !entry.frames.every(name => typeof name === 'string' && /^[a-z0-9_/-]+\.png$/.test(name) && !name.includes('..'))) return null;
      const holds = entry.frameHoldMs;
      const canvas = entry.canvas;
      const footOrigin = entry.footOrigin;
      if (!Array.isArray(holds) || holds.length !== entry.frames.length || !holds.every(ms => Number.isFinite(ms) && ms > 0)) return null;
      if (!canvas || ![canvas.width, canvas.height].every(size => Number.isFinite(size) && size > 0) || !footOrigin || ![footOrigin.x, footOrigin.y].every(Number.isFinite)) return null;
      const durationMs = holds.reduce((sum, ms) => sum + ms, 0);
      if ([entry.impactTimeMs, entry.releaseTimeMs].some(ms => ms !== undefined && (!Number.isFinite(ms) || ms < 0 || ms >= durationMs))) return null;
      const frames = await Promise.all(entry.frames.map(name => loadImage(frameUrl(name))));
      if (frames.some(frame => !frame)) return null;
      return { frames, frameHoldMs: [...holds], durationMs, impactTimeMs: entry.impactTimeMs, releaseTimeMs: entry.releaseTimeMs, loop: entry.loop === true, canvas: { ...canvas }, footOrigin: { ...footOrigin } };
    })().catch(() => null);
    requests.set(key, request);
    return request;
  };
}

export function sampleActorClip(clip, elapsedMs) {
  if (!clip?.frames?.length || !Number.isFinite(elapsedMs)) return null;
  let age = Math.max(0, elapsedMs);
  if (clip.loop) age %= clip.durationMs;
  for (let index = 0; index < clip.frames.length; index += 1) {
    if (age < clip.frameHoldMs[index]) return clip.frames[index];
    age -= clip.frameHoldMs[index];
  }
  return clip.frames.at(-1);
}
