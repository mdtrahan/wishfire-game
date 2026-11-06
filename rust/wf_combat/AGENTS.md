# Combat mechanics DOX

- `wf_combat` is a standalone headless rlib extracted from `wf_sim@9c142b5f73294bd5a783e79d3840d0c3386c90a1`. SimulationCore depends on it for the production headless combat bridge.
- Host calls `spawn_actor` with final `tuning::Stats`; child spawns use host-resolved `spawn_profiles`. Never apply stage, wave, reward or escalation scaling here.
- `EncounterState`, `EncounterModifiers`, `formation_origin` and actor-keyed `interest_points` are explicit host inputs. Default modifiers are neutral. Enemy AI runs independently of a director.
- Drain `defeats` and `materialized`, and consume `finish_requested` at the caller's orchestration boundaries. These outputs never advance host progression themselves.
- `state_hash` covers combat and explicit inputs. The reference harness uses `hash_with_host` to retain the pinned legacy hash byte order.
- `reference-diagnostics` enables frozen trial controls, observer taps and opaque host observations. Default builds exclude these paths. `bound-diagnostics` is optional measurement support.
- Keep four-hero identity, numeric tuning, RNG consumption, action order and timings unchanged in this extraction. Eight heroes and the full host protocol belong to later beads; the bridge retains its bounded four-hero subset.
- Validate with `CARGO_TARGET_DIR=/tmp/<task-target> cargo test --manifest-path rust/wf_combat/Cargo.toml --locked --offline`, then the harness suite. Keep build output outside the repository.

## Child DOX Index
- None.

- `formulas::mitigation_multiplier` owns `100/(100+defense)` for physical DEF and magic RES. Apply defense buffs before mitigation; positive attack power remains positive at finite defenses. SimulationCore CP uses the same helper; browser estimates mirror it in `combatFormulas.mjs`.
- Rally divides mitigated damage by 1.5 independently of DEF/RES, including zero-defense allies. Preserve range, nonstacking and living-owner gates.

- `formulas::cooldown_seconds` owns `CD*100/(100+Haste)`. Boss escalation/recharge, enrage, barrage and interrupted revival use Haste inputs. R6 meter refill derives Haste from existing `meter_rate` (default1 gives Haste0); no Haste stat catalog or ABI field is added. Existing positive rates below1 encode slowdown. Enrage preserves earned refill fraction, including barrage shortening.

- `Sim.floor` is per-world host geometry. Movement, ray clipping, hazards and projectile culling use it; default bounds preserve frozen slice hashes. Keep the harness geometry helpers defaulted.

- `wfm.rs` owns distinct WFM High Gobloc/Skeleton melee and ordinary Chimerilass/Djinn ranged definitions. Chimerilass retains half-HP weighted healing; Djinn retains magic/physical single-target choices with absent-board fallback. Their independent MAG/RES bases retain the authored WFM values, including Djinn 28/14 and Chimerilass 26/16. Host supplies final stats; never alias these identities to slice enemies/bosses.

- Production `contain_bodies` constrains actor spawn, planning, travel, separation and displacement through `actor_floor`/`spawn_floor`, reserving the slice camera body bounds plus side gutters. Default false preserves the frozen reference hash and behaviour; include the enabled constraint in gameplay hashes. Hazard/ray geometry still uses the actual world floor.

- `chest.rs` ports the slice side approach, footprint avoidance, nearest living opener, 0.6-second open and 2-second post-open beat. The footprint blocks heroes for as long as the chest exists, the opened chest's fade included (owner 2026-11-05, ORKA-63bf.29; the slice released it at open). The host decides admission; chest code grants no rewards and imports no director. Default-empty chest state preserves frozen harness hashes.

- `permanent.rs` owns atomic hero input replacement with expected/current revisions and R1 HP growth/clamp; downed HP stays zero. Preserve clocks, targets, ward, statuses and RNG. Committed action stats, source/recipient maximum HP and potency survive revisions; later actions use the replacement. Hash revision state without changing unrevised harness hashes. R6 changes passive meter refill only, preserving earned meter and hit gains.

- Select offence and mitigation by the action/hit damage channel; impact elements remain presentation facts. Projectiles retain their launch channel. Phoenix and actor revival retain the recipient maximum from channel commitment, with the current maximum as the healing cap. Hazard construction reads live transient Elevate; Shadow landing combines committed permanent reach with live Wings. Passive aura/Mend ticks and incoming mitigation remain live.

- Committed permanent inputs are consumed unconditionally for Basic/Cast actions after admission; revision equality never selects live permanent values. Elevate is transient and read live at impact, including damage and Wings reach. A mid-wind-up revision preserves source damage parameters while a newly gained Elevate applies immediately.

- Pending hit telemetry carries effective HP loss separately from the original slice Event. Ward absorption stays in presentation amount; ABI DPS reads only HP loss. This sidecar must not affect frozen hashes, RNG, event order or drained Event payloads.

- `prd.rs` owns renewal-calibrated binary damage/heal crit, evade, encase and boss push resistance. Each actor/check starts at N=1 per battle; failures increment and success resets. Retain actor-keyed `Sim.prd` after actor removal for in-flight attacks; native/ABI snapshots carry it and both hashes include all counters. Calibration caches are derived and omitted from serialized state. Nominal stat changes preserve N; categorical RNG paths and one-draw eligibility stay unchanged. `prd_tests::hondo_ab_built_combat -- --nocapture` prints the built-code A/B proof; its independent-roll arm is test-only.

- SimulationCore and wf_combat share `rust/Cargo.toml` and `rust/Cargo.lock` so Cargo crate identities stay relative across checkouts. The reference harness retains its separate lock/workspace. Release profile settings live at the workspace root.

- Host presentation additions (ORKA-63bf): `api::StageView`/`StagePhase`/`Reward`/`PartyBuffs`, `Snapshot.stage` and `Snapshot.chests`, `ChestView.reward`, and the host-observation `Event` variants (`WaveReset`, `BossArrived`, `Escalated`, `StageCleared`, `WaveIncoming`, `ChestDropped`, `ChestOpened`, `SceneReset`) are presentation data the host fills; combat never emits or reads them and `state_hash` excludes them. `chest` types re-export through `api`.
- Passive special refill (owner 2026-11-05, ORKA-63bf.30): Fara 10 s per stock, Hondo and Runa 20 s (`COMBO_FILL_SECONDS`, `SUPER_FILL_SECONDS`), Kaja unchanged; landed-basic gains are unchanged. `wf_meta::hero::special_clock` and the `hero_progress.json` cooldown cases carry the same numbers and change together.
- Fodder bombs (owner 2026-11-05, ORKA-63bf.37): a Lizardo's bomb resolves at `LIZARDO_BOMB_TIME` (2.28 s, half of `BOMB_TIME`): `lizardo_throw` sets the hazard's `duration` and `base_duration` and the thrower's cast to it. Radius and damage are unchanged, and the thrower's cycle is 2.28 s shorter because it waits out its own bomb. Chimerilass's barrage starts from the table's `BOMB_TIME` and `CHIMERA_BOMB_FUSE` and is unchanged. Do not route this hazard through `countdown()` again: the fixed fill speed would stretch it back to 4.56 s.
- Arcane Pulse blast (owner 2026-11-05, ORKA-63bf.29): at resolution every living enemy within the distance from Kaja to the blast centre is hit, never fewer than the drawn `ARCANE_PULSE_RADIUS` circle covers. The hazard's shape, centre tracking, countdown and damage scaling are unchanged, so the presentation is too; only the hit test in `update_hazards` widened.
