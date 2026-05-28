let runtimeRef = null;

export function initRuntimeAdapter(runtime) {
  runtimeRef = runtime;
  console.log('runtimeAdapter: initialized');
}

export function getRuntime() {
  return runtimeRef;
}

// Placeholder: map neutral names to runtime object types and create instances.
export function createInstance(typeName, x = 0, y = 0) {
  if (!runtimeRef) {
    console.warn('createInstance: runtime not initialized');
    return null;
  }
  // Construct-specific creation may vary; this is a conservative placeholder.
  if (typeof runtimeRef.createInstance === 'function') {
    try {
      return runtimeRef.createInstance(typeName, x, y);
    } catch (e) {
      console.warn('createInstance failed:', e.message);
      return null;
    }
  }
  console.warn('createInstance: no runtime creation API available');
  return null;
}

export default { initRuntimeAdapter, getRuntime, createInstance };
