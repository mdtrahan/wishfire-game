# Bounded puppet retention, ORKA-ltq

Development base: KK4 `7b7c23e9`, including frozen T1M `e2961c0e`. Integration order remains T1M → KK4 → LTQ. This candidate has not been merged or certified Integration Ready.

The loader admits at most 32 clip records and 25,165,824 logical decoded RGBA bytes, including reservations for started image loads. Native Map insertion order evicts unprotected settled clips. Current display and latest replacement keys remain protected by the production presentation bridge. Full capacity returns null for later render retry; no queue stores superseded requests. Frame failures settle all outstanding frame operations before releasing reservations. Failures and capacity denials remain recoverable.

Per-instance presentation holds the displayed clip while its current replacement loads. Stale completions cannot install a superseded state. The shared renderer calls beginFrame/endFrame around every assembled scene, releasing absent slots and pins even when no supported actor is drawn or time is frozen. Standalone sampling also retires old slots as simulation time advances; a clock reset clears old slots. Frozen clock values continue sampling the same clip age. World-facing projection, simulation markers and foot drawing retain their existing contracts. Opposite-facing fallback stays on static art until its correctly facing puppet is ready.

## Verification

`node --test tests/actorClipPlayback.test.mjs tests/actorPuppetPresentation.test.mjs` passes 11 checks. The deterministic stress uses 196 synthetic keys across fourteen actors and seven states/two facings, 1,000 transitions, concurrent admission, eviction, pinning, a stale replacement, failed image recovery, actor retirement and paused age. It also covers an empty frame, an unsupported-only paused scene and a retired in-flight completion. It reaches exactly 24MiB logical highwater while retaining at most 32 clip records. These synthetic actor images prove cache mechanics; production art in this checkout remains Fara/Gobloc.

`node output/qa/ORKA-ltq/battle-proof.mjs` reuses the existing KK4 CLI proof, targeting localhost:8132. Native IAB returned `IAB visibility is not supported in a subagent thread`; the supported CLI fallback opens an isolated Chromium instance. The test intercepts only the served loader response to expose its existing retention method to QA, without changing shipped source or adding a product QA API. Ordinary START enters the existing battle. PNG HTTP responses, actual Canvas drawImage sources, actor state and logical retention samples are recorded in battle.json; battle-summary.json provides the bounded result. The final screenshot is battle.png and its measured viewport is in battle.json. Screenshot inspection confirms drawn Fara and Gobloc puppets at their semantic feet alongside the existing other hero/enemy art. This proof covers normal battle playback, not full-roster art or final reference comparison.

Logical byte accounting uses manifest frame dimensions × four RGBA channels × frame count and checks loaded image dimensions, rejecting missing, zero or mismatched dimensions. It bounds this loader's and bridge's retained clip references. An external consumer retaining returned clips indefinitely lies outside that accounting; the existing art preview holds a fixed four clips. Browser garbage collection, network cache, decoder backing stores and GPU textures remain browser-owned.

Physical observations sum OS RSS for the isolated Chromium processes enumerated through CDP, starting at the loaded entry page and sampling the ensuing battle. This includes application, Canvas, JS, decoder, utility and GPU-process allocations. It cannot attribute the delta to PNG clips or measure GPU texture residency; 24MiB is never a physical-memory claim. Consult battle-summary.json and battle.json for measured baseline/peak values. Full roster memory still needs a representative fourteen-actor art workload.

Source ownership: actorClipPlayback.mjs, actorPuppetPresentation.mjs, their focused tests and systems DOX only. No art, alias expansion, simulation, app, lamp, editor or dependency changes.

## Lifecycle revision after independent review

Candidate43eb880 required a correction because its last actor slots survived empty/unsupported scenes. renderRuntime now brackets every assembled scene with the bridge lifecycle. The existing adversarial reproduction is preserved as review-regressions.mjs with corrected retirement/reset/zero-dimension expectations; its checks pass. Only the actual-image dimension boundary was additionally tightened.

The lifecycle-proof.mjs test exercises the actual renderer. Clicking ordinary QUESTS shows the existing Battle paused modal on the quest scene, with displayedActors zero. Continue Battle restores four supported puppet instances. A disclosed existing QaScenarioPaused fixture holds simulation time and the identical Fara PNG source across 500ms. lifecycle.json records exact clocks, sources and counts; departure.png and restored-paused.png were visually inspected. No page errors were recorded. This test-specific instrumentation modifies served module responses only.

The required hot-file gate passes34checks. Rendered UI-lock results are recorded in ui-lock.log and the gate-owned test-results directory. Natural parent in-app inspection remains the owner’s final visual gate.
