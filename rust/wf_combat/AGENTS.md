# Combat mechanics DOX

- `wf_combat` is a standalone headless rlib extracted from `wf_sim@9c142b5f73294bd5a783e79d3840d0c3386c90a1`. SimulationCore depends on it for the isolated headless bridge; the game has no bridge wiring.
- Host calls `spawn_actor` with final `tuning::Stats`; child spawns use host-resolved `spawn_profiles`. Never apply stage, wave, reward or escalation scaling here.
- `EncounterState`, `EncounterModifiers`, `formation_origin` and actor-keyed `interest_points` are explicit host inputs. Default modifiers are neutral. Enemy AI runs independently of a director.
- Drain `defeats` and `materialized`, and consume `finish_requested` at the caller's orchestration boundaries. These outputs never advance host progression themselves.
- `state_hash` covers combat and explicit inputs. The reference harness uses `hash_with_host` to retain the pinned legacy hash byte order.
- `reference-diagnostics` enables frozen trial controls, observer taps and opaque host observations. Default builds exclude these paths. `bound-diagnostics` is optional measurement support.
- Keep four-hero identity, numeric tuning, RNG consumption, action order and timings unchanged in this extraction. Definition catalogs, eight heroes, the full host protocol belong to later beads; the step-2 bridge exposes only the bounded headless subset.
- Validate with `CARGO_TARGET_DIR=/tmp/<task-target> cargo test --manifest-path rust/wf_combat/Cargo.toml --locked --offline`, then the harness suite. Keep build output outside the repository.

## Child DOX Index
- None.

- `Sim.floor` is per-world host geometry. Movement, ray clipping, hazards and projectile culling use it; default bounds preserve frozen slice hashes. Keep the harness geometry helpers defaulted.
