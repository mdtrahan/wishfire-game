// Exported PNG clips are presentation only. Callers supply frozen-aware simulation age.
const safeName = value => /^[a-z][a-z0-9_-]*$/.test(value);

export function createActorClipLoader({ loadManifest, loadImage, frameUrl, maxDecodedBytes = 24 * 1024 * 1024 }) {
  let manifestPromise;
  if (!Number.isSafeInteger(maxDecodedBytes) || maxDecodedBytes <= 0) throw new RangeError('Invalid puppet retention budget');
  const requests = new Map();
  let protectedKeys = new Set();
  let retainedBytes = 0;
  let evictions = 0;
  const load = (actor, state, facing) => {
    if (![actor, state].every(value => typeof value === 'string' && safeName(value)) || !['left', 'right'].includes(facing)) return Promise.resolve(null);
    const key = `${actor}/${state}/${facing}`;
    if (requests.has(key)) {
      const cached = requests.get(key);
      requests.delete(key);
      requests.set(key, cached);
      return cached.promise;
    }
    // Fourteen displayed keys plus fourteen replacements fit the 32-clip ceiling.
    if (requests.size >= 32) {
      const victim = [...requests].find(([oldKey, old]) => !old.pending && !protectedKeys.has(oldKey));
      if (!victim) return Promise.resolve(null);
      requests.delete(victim[0]);
      retainedBytes -= victim[1].bytes;
      evictions++;
    }
    const record = { bytes: 0, pending: true, promise: null };
    const request = (async () => {
      manifestPromise ||= Promise.resolve().then(loadManifest).catch(() => { manifestPromise = null; return null; });
      const manifest = await manifestPromise;
      if (!manifest) manifestPromise = null;
      const entry = manifest?.actors?.[actor]?.clips?.[state]?.[facing];
      if (!entry || !Array.isArray(entry.frames) || !entry.frames.length || !entry.frames.every(name => typeof name === 'string' && /^[a-z0-9_/-]+\.png$/.test(name) && !name.includes('..'))) return null;
      const holds = entry.frameHoldMs;
      const canvas = entry.canvas;
      const footOrigin = entry.footOrigin;
      if (!Array.isArray(holds) || holds.length !== entry.frames.length || !holds.every(ms => Number.isFinite(ms) && ms > 0)) return null;
      if (!canvas || ![canvas.width, canvas.height].every(size => Number.isSafeInteger(size) && size > 0) || !footOrigin || ![footOrigin.x, footOrigin.y].every(Number.isFinite)) return null;
      const durationMs = holds.reduce((sum, ms) => sum + ms, 0);
      if ([entry.impactTimeMs, entry.releaseTimeMs].some(ms => ms !== undefined && (!Number.isFinite(ms) || ms < 0 || ms >= durationMs))) return null;
      const bytes = canvas.width * canvas.height * 4 * entry.frames.length;
      if (!Number.isSafeInteger(bytes) || bytes > maxDecodedBytes) return null;
      for (const [oldKey, old] of requests) {
        if (retainedBytes + bytes <= maxDecodedBytes) break;
        if (old.pending || protectedKeys.has(oldKey)) continue;
        requests.delete(oldKey);
        retainedBytes -= old.bytes;
        evictions++;
      }
      if (retainedBytes + bytes > maxDecodedBytes) return null;
      record.bytes = bytes;
      retainedBytes += bytes;
      const results = await Promise.allSettled(entry.frames.map(name => Promise.resolve().then(() => loadImage(frameUrl(name)))));
      const frames = results.map(result => result.status === 'fulfilled' ? result.value : null);
      if (frames.some(frame => !frame || ((frame.naturalWidth || frame.width) && (frame.naturalWidth || frame.width) !== canvas.width) || ((frame.naturalHeight || frame.height) && (frame.naturalHeight || frame.height) !== canvas.height))) return null;
      return { frames, frameHoldMs: [...holds], durationMs, impactTimeMs: entry.impactTimeMs, releaseTimeMs: entry.releaseTimeMs, loop: entry.loop === true, canvas: { ...canvas }, footOrigin: { ...footOrigin } };
    })().catch(() => null);
    record.promise = request.then(clip => {
      record.pending = false;
      if (!clip) {
        requests.delete(key);
        retainedBytes -= record.bytes;
      }
      return clip;
    });
    requests.set(key, record);
    return record.promise;
  };
  load.protect = keys => { protectedKeys = new Set(keys); };
  load.retention = () => ({ maxDecodedBytes, retainedBytes, reservedBytes: [...requests.values()].filter(entry => entry.pending).reduce((sum, entry) => sum + entry.bytes, 0), entries: requests.size, pending: [...requests.values()].filter(entry => entry.pending).length, evictions });
  return load;
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
