# Frozen slice reference harness DOX

- Reference-only consumer of `../wf_combat`; production must never depend on this crate.
- Own director, reward/chest policy, authored formations, wave generation, stage scaling, escalation, showcase and trial setup. `fixtures/waves.json` and `fixtures/arena.json` are pinned source data, not production content.
- The facade preserves the current frozen client/bench public API. It forwards final stats, neutral-or-resolved modifiers, transition/position gates and per-actor goals, then consumes combat outputs at the original tick boundaries.
- Goal evaluation occurs immediately before each hero's AI update, after earlier heroes moved. Preserve this ordering and the exact floating-point scaling order.
- Host events share the combat event buffer through reference-only opaque observations. Translate only at drain, preserving event order and zero allocations during steps.
- Compose snapshot vectors using their retained capacities and cache spotlight vectors. Derived snapshot cloning on every step breaks allocation assertions.
- `fixtures/baseline-trace.tsv` comes from pristine `9c142b5f`. `baseline_trace_tests` covers every step and ordered event stream for seeds 1/7/42, spotlight off/on, through 27,000 steps. Never re-pin to hide drift.
- `TEST_DESTINATIONS.tsv` records all 551 original test functions; `EXTRACTION.md` records source ownership and provenance. Preserve assertions and ignored measurement tests.
- Validate `CARGO_TARGET_DIR=/tmp/<task-target> cargo test --manifest-path rust/wf_slice_harness/Cargo.toml --locked --offline`. Also compile `--features bound-diagnostics --no-run` after changing diagnostic seams.

## Child DOX Index
- None.
