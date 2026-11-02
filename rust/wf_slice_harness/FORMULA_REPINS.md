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
