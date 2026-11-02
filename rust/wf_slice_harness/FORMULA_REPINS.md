# ORKA-nspw.12 formula expectations

Only mitigation helper evaluation and Rally applying to DEF/RES changed combat. Outcome/balance assertions remain unchanged.

## baseline_trace_tests::pinned_every_step_hash_and_ordered_events_match
Fixture SHA-256: 90794048a661917a03c9d7240e6d6ef44bc30d9f1aebf06edd4000b17201e3e1 -> c048539d5bfff09a9b2f173d5d95c58e8b9c3a26978424fad2cd7c1e30772a01

Rows: seed spotlight step | state, cumulative state, cumulative events (old -> new).
- 1 false 9000 94a0987448876b0f f9e988684e9f8d2f c8e62bb04228cda6 -> 1 false 9000 99ef63f160599dea dac37618a874cdd3 ca152be9fe86b9b5
- 1 false 27000 9a196903a32cb974 a0b61547b634e069 242347426904189e -> 1 false 27000 4f51e9492669a685 079468a80fad6ee7 2220f1e79c249cfd
- 7 false 9000 ac74651a35943979 7cbd03f794c344a4 3c2ed726cbfe0b27 -> 7 false 9000 b69f5447d1840875 c981e81e36c27d46 a62b06002ce2b22a
- 7 false 27000 a829dc6ebc989269 350a6372a47d3f74 cf78201f04dfdb82 -> 7 false 27000 fcafcce2727ce73c c7f3fd304ee9ad61 e4984427246abba9
- 42 false 3600 d293acd036a06ad1 3155b502cb2dd9c7 4723b96804c95f63 -> 42 false 3600 86e6dd7b82481638 37106013362c2ee4 12ceb48a9db076f2
- 42 false 9000 b1205983d8a01788 ec6d42ce1b640527 98a19381feb57952 -> 42 false 9000 0810c0cef875149f 2662f9c47acbf6a3 a74af7d83574d4d3
- 42 false 27000 c66fb8045aba72dd 9e1a5605939bb2f4 932a63807effed53 -> 42 false 27000 25f9168a1aca33d8 dc21e6f4cd41dc5d 75185588f79eb8bd
- 1 true 9000 f0929176aee01c67 d0c165479e92c6b6 85a2df33b60022a5 -> 1 true 9000 8d78843c9d7731b0 6afc22adf7fad488 c146c5376c807aac
- 1 true 27000 48a3f1f9fb6632fc fe45cd87777e39e9 a41aa65e40481fd6 -> 1 true 27000 e24638fd82cf6bb6 a1fd059c9b3856af d5e88ad3e593ae8d
- 7 true 9000 b2a4534c777e248b 4aa82cbf02e76f7b ca7d373302bb6820 -> 7 true 9000 0cf2a6f47f673afe 34aacb687b8724c3 33f5c3016ef4fe91
- 7 true 27000 e5f5b29106b1d8ff bdc9358b3adec079 d8369d87692d609c -> 7 true 27000 e148d1ae9e554e50 aa302bb8280a7cf0 818d0a911b4d6890
- 42 true 3600 3e84fc6cee7375eb 95bc04febe00ff96 4723b96804c95f63 -> 42 true 3600 c08a8e0b33d6a1f2 b3302bca0dd2a46b 12ceb48a9db076f2
- 42 true 9000 f13cdf907355ad68 287046318f9e7280 85cb87d94a115b98 -> 42 true 9000 4df7108e4911ad3d 0d18577b33921c84 8000f35acc14662a
- 42 true 27000 c0a1cc3cc710b300 56c784e723c06a8e 0b2c3c17c2b19955 -> 42 true 27000 5453a916365cfe80 ccef98d5816f1b5a 724aeb5bc8b42e1e

## spotlight_tests::spotlight_off_clocks_and_hashes_match_current_baseline
- seed 42: d293acd036a06ad1 -> 86e6dd7b82481638

## roster_tests::rally_defense_follows_a_living_visible_owner_does_not_stack_and_ends_immediately_on_death
- Formula expectation: 90*100/(100+DEF)/1.5 -> 90*100/(100+DEF*1.5). Fixture DEF=0: 60 -> 90. Range, nonstacking and owner-death controls retained.

## player-visible cache arrows, item review, Auto receipts and Hero gear agree
- Four-owner gains: [13.6,15,6,11.9] -> [42.8,47.7,50.7,43.2]; strongest recipient Huun -> Runa.
- Kaja-only gain: 15 -> 4. Equal marginal gains: 60 -> 20 for both owners.
- Synthetic full-CP tie setup, Huun body HP: 181 -> 651, restoring exact CP equality at497.
- Synthetic rerank setup, revealed item HP: 794 -> 720, preserving initially-nonpositive then-positive eligibility (-1.5 -> +15); final gain golden29.3 ->15.

## a Kaja-only +4 upgrade survives the real dismantle flow with an early combat copy
- Former +15 fixed golden -> +4. Identical positive-upgrade protection and persistence assertions.

## ORKA-nspw.11: baseline_trace_tests::pinned_every_step_hash_and_ordered_events_match
Fixture SHA-256: c048539d5bfff09a9b2f173d5d95c58e8b9c3a26978424fad2cd7c1e30772a01 -> b444cd29ff0b5e5d694a60335c5c806280640bdffe5127e5ac26dbb46a10a215

Cooldowns use the Haste helper, including additive Haste escalation, combined enrage and the matching revive-safety forecast. Hero refill bases stay unchanged. All536 other checks pass before this re-pin.
- 1 false 27000 4f51e9492669a685 079468a80fad6ee7 2220f1e79c249cfd -> 1 false 27000 4f51e9492669a685 4494127900e30553 2220f1e79c249cfd
- 7 false 27000 fcafcce2727ce73c c7f3fd304ee9ad61 e4984427246abba9 -> 7 false 27000 77f6a5cd3fb0b81a a0efc7b322453f1a f296a603e0e9647f
- 42 false 27000 25f9168a1aca33d8 dc21e6f4cd41dc5d 75185588f79eb8bd -> 42 false 27000 db04b2670dcbf512 9e1070c26374903d cc33dfce2a71638a
- 1 true 27000 e24638fd82cf6bb6 a1fd059c9b3856af d5e88ad3e593ae8d -> 1 true 27000 bdf3a274b5da3d39 447bbcf14e4e2780 e9c21305d4173e74
- 7 true 27000 e148d1ae9e554e50 aa302bb8280a7cf0 818d0a911b4d6890 -> 7 true 27000 fdbcceb3249ad33d 7b3634faf38d29bb 2a6f756d2af038f5
- 42 true 27000 5453a916365cfe80 ccef98d5816f1b5a 724aeb5bc8b42e1e -> 42 true 27000 948a304cc1163b88 52b362227abdcb14 07ebc56dc700187f

## ORKA-nspw.11 formula assertions
- `tests::enraged_refill_is_thirty_percent_shorter_with_the_same_floor` -> `tests::enraged_refill_combines_haste_with_escalation_and_stays_positive`: expected `(5 - level*0.4)*(enraged ? 0.7 : 1)`, floor3.5 -> `5*100/(100 + level*(200/23) + (enraged ? 300/7 : 0))`. Exact equality remains; positivity is added.
- `host_inputs_tests::modifiers_have_neutral_defaults_and_drive_boss_abilities`: cooldown input .81 -> Haste25, expected scale .81 -> .8; recharge subtraction1 -> Haste25, expected5-1 ->5*.8 (both4). Radius assertion unchanged.

## Deferred base-timing mismatch (owner confirmed)
- `web-runner/src/core/heroDefinitions.mjs` authors Fara120s; Hondo/Runa/Kaja20s. Rust `rust/wf_combat/src/tuning.rs` uses Fara/Hondo/Runa10s stock refills, Kaja6.5/1.15 (~5.652174s).
- Apply Haste atop each current base. No base-timing/content alignment belongs to this lane.

## Runtime formula locations

- `rust/wf_combat/src/formulas.rs:2`
- `rust/wf_combat/src/formulas.rs:8`
- `rust/wf_combat/src/combat.rs:70`
- `rust/wf_combat/src/combat.rs:134`
- `rust/wf_combat/src/ai.rs:35`
- `rust/wf_combat/src/ai.rs:43`
- `rust/simulation_core/src/lib.rs:36`
- `web-runner/src/core/combatFormulas.mjs:2`
- `web-runner/src/core/combatFormulas.mjs:7`
- `web-runner/src/core/combatPower.mjs:21`
- `web-runner/src/core/combatPower.mjs:23`
- `rust/wf_combat/src/barrage.rs:4`
- `rust/wf_combat/src/barrage.rs:162`
- `rust/wf_combat/src/enemies.rs:187`
- `rust/wf_combat/src/enemies.rs:331`
- `rust/wf_combat/src/actors.rs:669`
- `rust/wf_combat/src/groove.rs:43`
- `rust/wf_combat/src/lib.rs:48`
- `rust/wf_combat/src/tuning.rs:342`
- `rust/wf_combat/src/tuning.rs:503`
- `rust/wf_combat/src/tuning.rs:672`
- `rust/wf_slice_harness/src/lib.rs:330`
- `rust/wf_slice_harness/src/lib.rs:332`
- `rust/wf_slice_harness/src/tuning.rs:4`
- `rust/wf_slice_harness/src/tuning.rs:70`
- `src/core/combatShadowAdapter.mjs:44`
- `web-runner/src/core/heroGrowthRules.mjs:11`
- `web-runner/src/core/heroGrowthRules.mjs:41`
- `web-runner/src/core/heroGrowthRules.mjs:43`
- `web-runner/systems/renderHeroScreen.js:177`

Mismatch source lines: `web-runner/src/core/heroDefinitions.mjs:39,49,57,65` (120,20,20,20s); `rust/wf_combat/src/tuning.rs:681,686,687,690` (10,10,10,6.5/1.15s). Haste applies independently atop these preserved bases.
