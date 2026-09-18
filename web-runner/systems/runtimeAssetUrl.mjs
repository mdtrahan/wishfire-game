const OFFLINE_RUNTIME_KEY = '__ORKA_OFFLINE_RUNTIME__';

function documentBaseHref() {
  if (typeof document !== 'undefined' && document.baseURI) return document.baseURI;
  if (typeof location !== 'undefined' && location.href) return location.href;
  return 'file:///';
}

function decodePath(path) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export function runtimeAssetKey(input) {
  const raw = String(input || '').replaceAll('\\', '/').split('#')[0].split('?')[0];
  let candidate = raw;
  const isAbsoluteUrl = /^(?:https?:|file:)/i.test(candidate) || candidate.startsWith('/');
  if (isAbsoluteUrl) {
    try {
      candidate = new URL(candidate, documentBaseHref()).pathname;
    } catch {
      candidate = raw;
    }
  }
  const assetsMarker = '/assets/';
  const markerIndex = candidate.lastIndexOf(assetsMarker);
  if (markerIndex >= 0) candidate = candidate.slice(markerIndex + assetsMarker.length);
  candidate = candidate
    .replace(/^(?:\.\.\/)+assets\//, '')
    .replace(/^\.\//, '')
    .replace(/^assets\//, '')
    .replace(/^\/+/, '');
  return decodePath(candidate);
}

export function runtimeAssetBaseUrl() {
  return new URL('./assets/', documentBaseHref());
}

export function runtimeAssetUrl(path) {
  const key = runtimeAssetKey(path);
  const offline = globalThis[OFFLINE_RUNTIME_KEY];
  const mapped = offline?.assetUrls?.[key];
  if (typeof mapped === 'string' && mapped) return mapped;
  return new URL(key, runtimeAssetBaseUrl()).toString();
}

export function getEmbeddedJson(url) {
  const payload = globalThis[OFFLINE_RUNTIME_KEY]?.json;
  const key = runtimeAssetKey(url);
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, key)) return undefined;
  return payload[key];
}

export function getEmbeddedWasmBytes(url) {
  const encoded = globalThis[OFFLINE_RUNTIME_KEY]?.wasm?.[runtimeAssetKey(url)];
  if (encoded instanceof Uint8Array) return encoded;
  if (typeof encoded !== 'string' || typeof atob !== 'function') return null;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
