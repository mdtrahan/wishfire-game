# Rust release delivery (B12 / ORKA-eo3h)

`npm run rust:build-wasm` builds locked release wasm, validates the combat ABI and publishes a matched binary/provenance pair. `simulation_core.manifest.json` records all sources and Cargo inputs for both production crates, their combined content digest, ABI/schema/capabilities, WFM source commit, extracted slice commit, compiler versions and build arguments. The retained `output/balance` provenance receipt contains the same identity. A compiler or validation failure preserves the previous shipped pair.

`node tools/build_runtime_release.mjs` verifies that pair against current Rust inputs before staging. Its release manifest includes the wasm identity and SHA-256 of every shipped runtime file, binding host definitions, loader, fonts and VFX assets to the same release. It validates a complete candidate before replacing `dist`. No Cargo installation is needed to package the checked-in, source-matched binary.

`npm run build:offline` embeds wasm bytes, provenance, startup JSON and the Rust presentation manifest in the classic bundle. Runtime images, manifest-referenced puppet frames, the Canvas progress portrait and fonts use embedded data URLs so file-origin WebGL uploads and scene readback remain permitted. `dist-offline/wishfire.html` is standalone: its scripts, font, favicon and runtime payloads are inline. It can be moved into an empty directory. The existing portable entry `dist-offline/index.html` remains available. The offline manifest records the hosted manifest digest, embedded asset names and every emitted file hash. Both builders preserve their last complete output on failure.

`simulationCoreLoader.mjs` resolves hosted or embedded bytes and shares a verified instance across world combat and CP/meta RNG consumers. It rejects binary SHA-256, ABI, schema, clock, content-version or capability mismatch before returning the instance. Rust `describe.content_version`, manifest `content.version` and host `WFM_COMBAT_CONTENT_VERSION` must agree. The manifest derives that value from the binary; its source digest independently proves build provenance. Failure rejects combat readiness and reaches `updateStartupLoadState` with the existing load error. Unsupported or corrupt binaries cannot create a world or allocate presentation resources.

Focused proof:

```
node --test tests/rustWasmRelease.test.mjs tests/runtimeReleaseContract.test.mjs tests/offlineBundleContract.test.js tests/combatBridge.test.mjs tests/simulationCoreShadowContract.test.js
```

Chromium runs disconnected with fetch disabled, copies only the standalone HTML to an empty temporary directory, opens it, rejects every sibling-file/network request, launches the canonical Chapter 1 boss and requires at least 90 real Rust steps, an enemy death receipt and a gameplay hash. Real-wasm teardown proof warms one fight, completes ten more, verifies no live worlds/responses and only the transient describe input, and requires unchanged wasm memory size after every cycle. These counters establish transport ownership and wasm memory reuse; physical-device and whole-process memory remain outside this check.
