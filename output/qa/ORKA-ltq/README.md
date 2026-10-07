# Bounded puppet retention, ORKA-ltq

Development base synchronized to KK4 `5d674b0c`, including its `02ea058b` fixture correction and frozen T1M `e2961c0e`. Exact LTQ pre-sync source `d7573e9b8e85e419904a8b676f006b40e6974a49` remains under tag `wishfire-ORKA-ltq-pre-sync-d7573e9b`; the rebase preserved all LTQ changes without conflicts. Integration order remains T1M → KK4 → LTQ. This candidate has not been merged or certified Integration Ready.

The loader admits at most 32 clip records and 25,165,824 logical decoded RGBA bytes, including reservations for started image loads. Native Map insertion order evicts unprotected settled clips. Current display and latest replacement keys remain protected by the production presentation bridge. Full capacity returns null for later render retry; no queue stores superseded requests. Frame failures settle all outstanding frame operations before releasing reservations. Failures and capacity denials remain recoverable.

Per-instance presentation holds the displayed clip while its current replacement loads. Stale completions cannot install a superseded state. The shared renderer calls beginFrame/endFrame around every assembled scene, releasing absent slots and pins even when no supported actor is drawn or time is frozen. Standalone sampling also retires old slots as simulation time advances; a clock reset clears old slots. Frozen clock values continue sampling the same clip age. World-facing projection, simulation markers and foot drawing retain their existing contracts. Opposite-facing fallback stays on static art until its correctly facing puppet is ready.

## Verification

`node --test tests/actorClipPlayback.test.mjs tests/actorPuppetPresentation.test.mjs` passes 12 checks. The deterministic stress uses 196 synthetic keys across fourteen actors and seven states/two facings, 1,000 transitions, concurrent admission, eviction, pinning, a stale replacement, failed image recovery, actor retirement and paused age. It also covers an empty frame, an unsupported-only paused scene and a retired in-flight completion. It reaches exactly 24MiB logical highwater while retaining at most 32 clip records. These synthetic actor images prove cache mechanics; production art in this checkout remains Fara/Gobloc.

`node output/qa/ORKA-ltq/battle-proof.mjs` reuses the existing KK4 CLI proof, targeting localhost:8132. Native IAB returned `IAB visibility is not supported in a subagent thread`; the supported CLI fallback opens an isolated Chromium instance. The test intercepts only the served loader response to expose its existing retention method to QA, without changing shipped source or adding a product QA API. Ordinary START enters the existing battle. PNG HTTP responses, actual Canvas drawImage sources, actor state and logical retention samples are recorded in battle.json; battle-summary.json provides the bounded result. The final screenshot is battle.png and its measured viewport is in battle.json. Screenshot inspection confirms drawn Fara and Gobloc puppets at their semantic feet alongside the existing other hero/enemy art. This proof covers normal battle playback, not full-roster art or final reference comparison.

Logical byte accounting uses manifest frame dimensions × four RGBA channels × frame count and checks loaded image dimensions, rejecting missing, zero or mismatched dimensions. It bounds this loader's and bridge's retained clip references. An external consumer retaining returned clips indefinitely lies outside that accounting; the existing art preview holds a fixed four clips. Browser garbage collection, network cache, decoder backing stores and GPU textures remain browser-owned.

Physical observations sum OS RSS for the isolated Chromium processes enumerated through CDP, starting at the loaded entry page and sampling the ensuing battle. This includes application, Canvas, JS, decoder, utility and GPU-process allocations. It cannot attribute the delta to PNG clips or measure GPU texture residency; 24MiB is never a physical-memory claim. Consult battle-summary.json and battle.json for measured baseline/peak values. Full roster memory still needs a representative fourteen-actor art workload.

Source ownership: actorClipPlayback.mjs, actorPuppetPresentation.mjs, their focused tests and systems DOX only. No art, alias expansion, simulation, app, lamp, editor or dependency changes.

## Lifecycle revision after independent review

Candidate43eb880 required a correction because its last actor slots survived empty/unsupported scenes. renderRuntime now brackets every assembled scene with the bridge lifecycle. The existing adversarial reproduction is preserved as review-regressions.mjs with corrected retirement/reset/zero-dimension expectations; its checks pass. Only the actual-image dimension boundary was additionally tightened.

The lifecycle-proof.mjs test exercises the actual renderer. Clicking ordinary QUESTS shows the existing Battle paused modal on the quest scene, with displayedActors zero. Continue Battle restores four supported puppet instances. A disclosed existing QaScenarioPaused fixture holds simulation time and the identical Fara PNG source across 500ms. lifecycle.json records exact clocks, sources and counts; departure.png and restored-paused.png were visually inspected. No page errors were recorded. This test-specific instrumentation modifies served module responses only.

The required hot-file gate passes34checks. Rendered UI-lock results are recorded in ui-lock.log and the gate-owned test-results directory. Natural parent in-app inspection remains the owner’s final visual gate.

## KO/live boundary revision

A ready clip may remain visible during an ordinary live-state replacement, but its terminal KO state must match current actor HP. Crossing the KO/live boundary now returns null while protecting the previous ready key and current replacement. The focused deferred-load check covers both death and revival at the identical simulation time, then verifies ordinary idle-to-walk retention remains available. Stale request generation handling is unchanged.

Caller inspection traced the assembled renderer fallback through drawCombatActorSprite. Its existing combat art crop has no KO-specific pose or transform; the cold-load death interval therefore uses standing static art until the correct KO clip arrives. Revival immediately stops painting the stale KO clip and uses living static art until its replacement arrives. No renderer or gameplay timing change was made in this revision; this static KO presentation limitation was reported to the coordinating owner.

## Combined four-hero restoration proof

After dependency synchronization, four-hero-restore.mjs enters normal combat, waits for the entry fade, freezes all four heroes at KO and defers Fara’s non-KO PNG requests. Releasing the existing pause allows the game’s ordinary continuous-defeat recovery to restore all four heroes to max HP. Test instrumentation in the served quest session records four real reset calls with absent old action cues and idle locomotion. No restore helper is directly called by this fixture. While non-KO PNGs remain held, the cached KO presentation returns null and no KO PNG draws occur for living Fara. Release installs idle; pause then preserves identical simulation time and PNG source. Ordinary QUESTS departure retires all slots, and Continue Battle reinstates four within the byte/record ceilings. The sole puppet hero remains Fara; the other heroes use current static art.

four-hero-restore.json records the result, with four-ko.png, four-restored-pending.png and four-restored-final.png as captures. The disclosed fixture starts the KO cue two simulation seconds earlier, so Fara’s KO capture shows the completed lying pose at the same frozen foot anchor. The final restored capture was inspected. Coupled helper proof also uses the exact KK4 semantic-reset source at 5d674b0c through restore-boundary-proof.mjs.

Final combined focused checks pass 14 (the 12 clip/presentation checks plus 2 semantic-state checks). Hot-file checks pass 34, and the rendered UI gate passes 120/120 plus 31 static checks. Full-suite results are retained in full-suite.log.

The first combined full-suite run reported 1,010 passes, seven failures and three skips. Every failure came from the lane’s missing esbuild dependency. Installing the exact existing lockfile with npm ci and restoring tracked node_modules metadata resolved all seven focused offline checks. full-suite-before-npm-ci.log preserves the first run; offline-focused.log records 7/7 passing checks, and full-suite.log records the final rerun. No package version or lockfile changed.

The final full suite remains running at handoff. Its eventual result must be read from full-suite.log; this handoff does not claim a passing full suite.
