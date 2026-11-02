import { getEmbeddedJson, getEmbeddedWasmBytes, runtimeAssetUrl } from './runtimeAssetUrl.mjs';
import { createCombatBridge, WFM_COMBAT_CONTENT_VERSION } from '../src/core/combatBridge.mjs';

const instances = new Map();
const ABI_VERSION = 0x10000;

export function validateSimulationCore(instance, manifest) {
  if (manifest?.format !== 1 || manifest.abiVersion !== ABI_VERSION) throw new Error('SimulationCore ABI/version mismatch; expected release format 1, combat ABI 1.0');
  const description = createCombatBridge(instance).describe();
  if (description.abi_version !== ABI_VERSION || description.schema?.major !== 1 || description.schema?.minor !== 1 ||
      manifest.schema?.major !== description.schema.major || manifest.schema?.minor !== description.schema.minor ||
      manifest.hz !== 30 || description.hz !== manifest.hz) throw new Error('SimulationCore schema/clock mismatch; expected schema 1.1 at 30 Hz');
  if (description.content_version !== WFM_COMBAT_CONTENT_VERSION || manifest.content?.version !== description.content_version || !/^[a-f0-9]{64}$/.test(manifest.content?.sha256 || '') ||
      !Array.isArray(manifest.capabilities) || !Array.isArray(description.capabilities) || manifest.capabilities.join('\n') !== description.capabilities.join('\n')) {
    throw new Error('SimulationCore content/version mismatch; rebuild the matched Rust release');
  }
  return instance;
}

export function loadSimulationCore(wasmUrl = runtimeAssetUrl('simulation_core.wasm')) {
  const url = new URL(wasmUrl, globalThis.document?.baseURI || globalThis.location?.href || 'file:///').href;
  if (!instances.has(url)) {
    const pending = (async () => {
      const manifestUrl = new URL('simulation_core.manifest.json', url).href;
      const read = async resource => {
        const response = await fetch(resource);
        if (!response.ok) throw new Error(`SimulationCore HTTP ${response.status}: ${resource}`);
        return response;
      };
      const manifest = getEmbeddedJson(manifestUrl) ?? await (await read(manifestUrl)).json();
      const bytes = getEmbeddedWasmBytes(url) ?? new Uint8Array(await (await read(url)).arrayBuffer());
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
      if (digest !== manifest.binarySha256) throw new Error('SimulationCore binary hash mismatch; loader and wasm must come from the same release');
      const { instance } = await WebAssembly.instantiate(bytes, {});
      return validateSimulationCore(instance, manifest);
    })();
    instances.set(url, pending);
    pending.catch(() => instances.delete(url));
  }
  return instances.get(url);
}
