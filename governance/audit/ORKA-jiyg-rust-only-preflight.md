# ORKA-jiyg Rust-only cutover

Owner resumed implementation and retired paid story Continue. The old STOP condition is resolved. Work remains confined to `bead/ORKA-jiyg-rust-only`; no push or merge.

Rust is the default engine without flags. Combat shadow execution, JS scheduling/damage/status/scalar ownership and Scripts combat mirrors are retired. Host meta, economy, saves, CP/meta RNG, UI, authored stage/subwave topology and pacing remain. Equipment, level and Training retain the #229 revision path.

D17′ ordinary AllDown calls `restartAtSubwave(index)`, also exposed as `globals.RustCombatRestartAtSubwave(index)`, matching ORKA-4mz7. It destroys the old world without kill credit, preserves earned receipts, queues the same complete authored subwave and creates healthy heroes at slice origins on the next tick. Bosses retain checkpoint/manual-summon recovery. Tests include actual lethal Rust combat and three retries of a later subwave, with unchanged currency and energy.

Rust damage records effective per-hit `hp_loss`; ward absorption stays outside DPS. The native test separates a ward-only hit, partial absorption, healing and another hit within one step. Frozen public Events, RNG order and hash inputs remain unchanged. The harness passed 537 cases with ten ignored. Core passed seven tests; combat passed 37. Shipped WASM was rebuilt.

The static gate scans runtime, shared source, Scripts, tools and tests, classifies retained writers/fixtures and rejects retired modules, calls, flags, owner hooks and unclassified writes. Its injection cases prove rejection. Runtime spies forbid retired scalar calls through real AllDown/restart. Retired synthetic JS KO controls and target-misfire scripts were removed; handoff probes use no flag.

Focused validation preserves one known baseline failure: `questCombatSessionContract.test.js` expects a four-hero huddle narrower than 60 units. Baseline `0aad6419` uses the same first four fixed slots and identical placement formula, spanning 70.4 units. That assertion remains unchanged. Economy/save assertions were retained; the 15% clear-heal assertion now runs against real WASM (20/40 HP becomes 26/40), rather than expecting JS host healing.

Review URL: `http://localhost:8798/web-runner/index.html`, without flags. Offline build, final hook checks and DEV Chapter 1 verification are recorded at delivery. Full npm/browser suites and `verify_handoff.mjs` are reserved for the separate verifier. This lane does not claim Integration Ready.
