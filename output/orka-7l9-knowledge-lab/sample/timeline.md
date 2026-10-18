# ORKA-7l9 combat timeline

- `OBS` unchanged-game observation · `MODEL` shadow prediction (never an observation) · `REQ` owner acceptance rule · `REF` direct StoneAge observation · `?` unmeasured or not exposed
- `HIT` applied hostile damage · `HEAL` effective healing · `KO` Hero reached 0 HP · `WAVE_CLEAR` ordinary clear from the runtime counter · `BOSS_START`/`BOSS_CLEAR`/`BOSS_TIMEOUT` boss attempt · `RECOVER` full-party restore event · `GAP` missing event ids · `DEADLOCK` no progress
- `t=` simulation seconds from session start for runtime events; `t≈… (poll)` marks harness-poll time for transitions the runtime does not timestamp
- `W1` event-time wave; `W~1` wave sampled at the poll that read the event
- `raw=?` pre-cap damage is not exposed; `cap=?` whether the cap bound is not exposed. MODEL lines may state a cap bound under declared assumptions A1/A2.
- Enemy KOs are counted per session but omitted from timelines unless requested.

## starter-l1-nokaja session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/starter-l1-nokaja/observed_events.ndjson (SHA-256 d79643711bebf713f071971ba394afda57402570eb2b057127bbd180a53c9b16). Enemy KOs omitted: 641. Lines 400/549 (truncated; rerun with --fullTimelines).

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L1 85/85, Huun L1 60/60, Runa L1 69/69 autoEquip=true bossPolicy=hold
OBS t≈0.726 (poll) Huun state L1 maxHP 70 CP 69.8
OBS t=11.282 W1 Skeleton → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=11.282 #4 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=11.818 W1 Skeleton → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=11.818 #5 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=20.348 W1 Skeleton → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=20.348 #12 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t≈84.193 (poll) WAVE_CLEAR stage 1-1 next W2 clears=1
OBS t=84.193 W1 wave-clear respite → Huun HEAL ordinary_wave_clear HP 60→70 applied=10
MODEL t=84.193 #38 wave heal predicted 10 ✓ (A3)
OBS t=84.193 W1 wave-clear respite → Runa HEAL ordinary_wave_clear HP 66→69 applied=3
MODEL t=84.193 #39 wave heal predicted 3 ✓ (A3)
OBS t=85.992 W2 Lizardo → Falie HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=85.992 #40 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=86.127 W2 Lizardo → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=86.127 #41 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=87.526 W2 Lizardo → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=87.526 #42 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=90.525 W2 Lizardo → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=90.525 #44 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=91.124 W2 Lizardo → Huun HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=91.124 #45 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=95.192 W2 Gobloc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=95.192 #47 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=95.931 W2 Gobloc → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=95.931 #49 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=99.593 W2 Gobloc → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=99.593 #52 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=99.992 W2 Gobloc → Runa HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=99.992 #54 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=103.199 W2 Gobloc → Runa HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=103.199 #56 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=103.599 W2 Gobloc → Runa HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=103.599 #57 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t≈104.934 (poll) Falie state L1 maxHP 91 CP 58.6
OBS t=115.13 W2 Lizardo → Falie HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=115.13 #64 cap≤1 (routine tier, maxHP 91; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=118.332 W2 Lizardo → Falie HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=118.332 #66 cap≤1 (routine tier, maxHP 91; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=119.84 W2 Lizardo → Falie HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=119.84 #68 cap≤1 (routine tier, maxHP 91; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=134.816 W2 Lizardo → Falie HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=134.816 #73 cap≤1 (routine tier, maxHP 91; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=138.416 W2 Lizardo → Falie HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=138.416 #75 cap≤1 (routine tier, maxHP 91; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=142.816 W2 Lizardo → Falie HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=142.816 #77 cap≤1 (routine tier, maxHP 91; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t≈145.216 (poll) Falie state L1 maxHP 97 CP 68.7
OBS t=163.149 W2 Lizardo → Falie HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=163.149 #84 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=164.016 W2 Lizardo → Falie HIT physical HP 77→76 applied=1 raw=? cap=?
MODEL t=164.016 #86 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=164.615 W2 Gobloc → Huun HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=164.615 #87 cap≤1 (fodder tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=164.946 W2 Gobloc → Huun HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=164.946 #88 cap≤1 (fodder tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=168.545 W2 Gobloc → Huun HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=168.545 #91 cap≤1 (fodder tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t≈170.813 (poll) WAVE_CLEAR stage 1-1 next W3 clears=2
OBS t=170.813 W2 wave-clear respite → Falie HEAL ordinary_wave_clear HP 76→91 applied=15
MODEL t=170.813 #93 wave heal predicted 15 ✓ (A3)
OBS t=170.813 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 63→70 applied=7
MODEL t=170.813 #94 wave heal predicted 7 ✓ (A3)
OBS t=170.813 W2 wave-clear respite → Runa HEAL ordinary_wave_clear HP 63→69 applied=6
MODEL t=170.813 #95 wave heal predicted 6 ✓ (A3)
OBS t=174.281 W3 Orc → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=174.281 #97 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=174.346 W3 Lizardo → Falie HIT physical HP 91→90 applied=1 raw=? cap=?
MODEL t=174.346 #98 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 91 ✓
OBS t=178.015 W3 Lizardo → Falie HIT physical HP 90→89 applied=1 raw=? cap=?
MODEL t=178.015 #100 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 90 ✓
OBS t=185.012 W3 Orc → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=185.012 #104 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=187.748 W3 Lizardo → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=187.748 #105 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=189.015 W3 Lizardo → Falie HIT physical HP 89→88 applied=1 raw=? cap=?
MODEL t=189.015 #107 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 89 ✓
OBS t=191.748 W3 Lizardo → Huun HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=191.748 #109 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=192.681 W3 Lizardo → Falie HIT physical HP 88→87 applied=1 raw=? cap=?
MODEL t=192.681 #110 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 88 ✓
OBS t≈194.417 (poll) Huun state L1 maxHP 74 CP 75.6
OBS t=195.41 W3 Lizardo → Huun HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=195.41 #111 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=196.278 W3 Lizardo → Falie HIT physical HP 87→86 applied=1 raw=? cap=?
MODEL t=196.278 #112 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 87 ✓
OBS t=211.147 W3 Lizardo → Falie HIT physical HP 86→85 applied=1 raw=? cap=?
MODEL t=211.147 #116 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 86 ✓
OBS t=211.41 W3 Lizardo → Falie HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=211.41 #117 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=227.812 W3 High Gobloc → Huun HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=227.812 #123 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=229.546 W3 High Gobloc → Huun HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=229.546 #125 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=231.477 W3 High Gobloc → Huun HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=231.477 #126 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=233.211 W3 High Gobloc → Huun HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=233.211 #128 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t≈239.413 (poll) Runa state L1 maxHP 75 CP 80.8
OBS t=244.012 W3 Orc → Huun HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=244.012 #132 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=244.479 W3 Lizardo → Falie HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=244.479 #133 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=248.142 W3 Lizardo → Falie HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=248.142 #135 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=251.811 W3 Lizardo → Falie HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=251.811 #137 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=258.212 W3 Lizardo → Falie HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=258.212 #140 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=260.811 W3 Lizardo → Falie HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=260.811 #143 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=260.947 W3 Lizardo → Falie HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=260.947 #144 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=264.612 W3 Lizardo → Falie HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=264.612 #146 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t≈266.212 (poll) WAVE_CLEAR stage 1-1 next W4 clears=3
OBS t=266.011 W3 wave-clear respite → Falie HEAL ordinary_wave_clear HP 77→92 applied=15
MODEL t=266.011 #148 wave heal predicted 15 ✓ (A3)
OBS t=266.011 W3 wave-clear respite → Huun HEAL ordinary_wave_clear HP 60→72 applied=12
MODEL t=266.011 #149 wave heal predicted 12 ✓ (A3)
OBS t=266.011 W3 wave-clear respite → Runa HEAL ordinary_wave_clear HP 69→75 applied=6
MODEL t=266.011 #150 wave heal predicted 6 ✓ (A3)
OBS t=270.14 W4 Orc → Falie HIT physical HP 92→91 applied=1 raw=? cap=?
MODEL t=270.14 #152 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 92 ✓
OBS t=270.675 W4 Orc → Huun HIT physical HP 72→71 applied=1 raw=? cap=?
MODEL t=270.675 #153 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 72 ✓
OBS t=273.745 W4 Orc → Falie HIT physical HP 91→90 applied=1 raw=? cap=?
MODEL t=273.745 #154 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 91 ✓
OBS t=274.277 W4 Orc → Huun HIT physical HP 71→70 applied=1 raw=? cap=?
MODEL t=274.277 #155 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 71 ✓
OBS t=276.68 W4 Gobloc → Runa HIT physical HP 75→74 applied=1 raw=? cap=?
MODEL t=276.68 #158 cap≤1 (fodder tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 75 ✓
OBS t=277.943 W4 Orc → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=277.943 #160 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=280.41 W4 Orc → Runa HIT physical HP 74→73 applied=1 raw=? cap=?
MODEL t=280.41 #161 cap≤1 (routine tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 74 ✓
OBS t=281.543 W4 Orc → Falie HIT physical HP 90→89 applied=1 raw=? cap=?
MODEL t=281.543 #162 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 90 ✓
OBS t=284.074 W4 Orc → Runa HIT physical HP 73→72 applied=1 raw=? cap=?
MODEL t=284.074 #164 cap≤1 (routine tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 73 ✓
OBS t=285.208 W4 Orc → Falie HIT physical HP 89→88 applied=1 raw=? cap=?
MODEL t=285.208 #165 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 89 ✓
OBS t=288.411 W4 Orc → Runa HIT physical HP 72→71 applied=1 raw=? cap=?
MODEL t=288.411 #168 cap≤1 (routine tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 72 ✓
OBS t=288.874 W4 Orc → Falie HIT physical HP 88→87 applied=1 raw=? cap=?
MODEL t=288.874 #170 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 88 ✓
OBS t=290.073 W4 Gobloc → Runa HIT physical HP 71→70 applied=1 raw=? cap=?
MODEL t=290.073 #171 cap≤1 (fodder tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 71 ✓
OBS t≈301.41 (poll) Huun state L1 maxHP 80 CP 85.8
OBS t=302.94 W4 Orc → Falie HIT physical HP 87→86 applied=1 raw=? cap=?
MODEL t=302.94 #179 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 87 ✓
OBS t=317.74 W4 Orc → Falie HIT physical HP 86→85 applied=1 raw=? cap=?
MODEL t=317.74 #183 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 86 ✓
OBS t=318.408 W4 Orc → Falie HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=318.408 #185 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=318.473 W4 Orc → Falie HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=318.473 #186 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=321.074 W4 Orc → Falie HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=321.074 #187 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=322.006 W4 Orc → Falie HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=322.006 #188 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=322.074 W4 Orc → Falie HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=322.074 #189 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=327.339 W4 Orc → Falie HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=327.339 #192 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=327.674 W4 Orc → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=327.674 #193 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t≈334.208 (poll) Falie state L1 maxHP 97 CP 71
OBS t=336.673 W4 Lizardo → Falie HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=336.673 #197 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=336.939 W4 Orc → Falie HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=336.939 #198 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=340.345 W4 Lizardo → Falie HIT physical HP 77→76 applied=1 raw=? cap=?
MODEL t=340.345 #199 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=340.54 W4 Orc → Falie HIT physical HP 76→75 applied=1 raw=? cap=?
MODEL t=340.54 #200 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 76 ✓
OBS t=342.339 W4 Lizardo → Falie HIT physical HP 75→74 applied=1 raw=? cap=?
MODEL t=342.339 #203 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 75 ✓
OBS t=342.339 W4 Orc → Falie HIT physical HP 74→73 applied=1 raw=? cap=?
MODEL t=342.339 #204 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 74 ✓
OBS t=352.274 W4 Lizardo → Falie HIT physical HP 73→72 applied=1 raw=? cap=?
MODEL t=352.274 #209 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 73 ✓
OBS t=355.542 W4 Orc → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=355.542 #211 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=355.605 W4 Orc → Huun HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=355.605 #212 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=355.806 W4 Orc → Falie HIT physical HP 72→71 applied=1 raw=? cap=?
MODEL t=355.806 #213 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 72 ✓
OBS t=359.275 W4 Orc → Falie HIT physical HP 71→70 applied=1 raw=? cap=?
MODEL t=359.275 #216 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 71 ✓
OBS t≈362.474 (poll) WAVE_CLEAR stage 1-1 next W1 clears=4
OBS t=362.279 W4 wave-clear respite → Falie HEAL ordinary_wave_clear HP 70→85 applied=15
MODEL t=362.279 #218 wave heal predicted 15 ✓ (A3)
OBS t=362.279 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 66→78 applied=12
MODEL t=362.279 #219 wave heal predicted 12 ✓ (A3)
OBS t=362.279 W4 wave-clear respite → Runa HEAL ordinary_wave_clear HP 70→75 applied=5
MODEL t=362.279 #220 wave heal predicted 5 ✓ (A3)
OBS t≈362.939 (poll) Runa state L1 maxHP 80 CP 90.2
OBS t≈395.562 (poll) Falie state L1 maxHP 99 CP 75.7
OBS t≈420.277 (poll) WAVE_CLEAR stage 1-1 next W2 clears=5
OBS t=420.006 W1 wave-clear respite → Falie HEAL ordinary_wave_clear HP 85→99 applied=14
MODEL t=420.006 #259 wave heal predicted 14 ✓ (A3)
OBS t=420.006 W1 wave-clear respite → Huun HEAL ordinary_wave_clear HP 78→80 applied=2
MODEL t=420.006 #260 wave heal predicted 2 ✓ (A3)
OBS t=420.006 W1 wave-clear respite → Runa HEAL ordinary_wave_clear HP 75→80 applied=5
MODEL t=420.006 #261 wave heal predicted 5 ✓ (A3)
OBS t=421.205 W2 Lizardo → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=421.205 #262 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=422.87 W2 Lizardo → Huun HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=422.87 #265 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=429.004 W2 Lizardo → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=429.004 #270 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=430.134 W2 Lizardo → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=430.134 #272 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=430.204 W2 Lizardo → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=430.204 #273 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t=433.804 W2 Lizardo → Falie HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=433.804 #275 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=462.273 W2 Lizardo → Falie HIT physical HP 94→93 applied=1 raw=? cap=?
MODEL t=462.273 #288 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 94 ✓
OBS t=471.668 W2 Lizardo → Falie HIT physical HP 93→92 applied=1 raw=? cap=?
MODEL t=471.668 #292 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 93 ✓
OBS t=472.336 W2 Lizardo → Falie HIT physical HP 92→91 applied=1 raw=? cap=?
MODEL t=472.336 #294 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 92 ✓
OBS t=473.199 W2 Lizardo → Falie HIT physical HP 91→90 applied=1 raw=? cap=?
MODEL t=473.199 #295 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 91 ✓
OBS t≈486.602 (poll) WAVE_CLEAR stage 1-1 next W3 clears=6
OBS t=486.466 W2 wave-clear respite → Falie HEAL ordinary_wave_clear HP 90→99 applied=9
MODEL t=486.466 #304 wave heal predicted 9 ✓ (A3)
OBS t=486.466 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 79→80 applied=1
MODEL t=486.466 #305 wave heal predicted 1 ✓ (A3)
OBS t=489.668 W3 Lizardo → Huun HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=489.668 #307 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=490.732 W3 Lizardo → Huun HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=490.732 #309 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=494.332 W3 Lizardo → Huun HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=494.332 #311 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=497.066 W3 High Gobloc → Runa HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=497.066 #313 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=497.868 W3 Orc → Runa HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=497.868 #314 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=497.932 W3 Lizardo → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=497.932 #315 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=500.735 W3 High Gobloc → Runa HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=500.735 #317 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=501.598 W3 Lizardo → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=501.598 #321 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=504.202 W3 Orc → Runa HIT physical HP 77→76 applied=1 raw=? cap=?
MODEL t=504.202 #323 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=505.268 W3 Lizardo → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=505.268 #324 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=506.533 W3 High Gobloc → Runa HIT physical HP 76→75 applied=1 raw=? cap=?
MODEL t=506.533 #326 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 76 ✓
OBS t=508.932 W3 Lizardo → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=508.932 #328 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t=522.601 W3 Lizardo → Falie HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=522.601 #333 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=523.001 W3 Lizardo → Falie HIT physical HP 94→93 applied=1 raw=? cap=?
MODEL t=523.001 #334 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 94 ✓
OBS t=523.333 W3 Lizardo → Falie HIT physical HP 93→92 applied=1 raw=? cap=?
MODEL t=523.333 #335 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 93 ✓
OBS t=526.198 W3 Lizardo → Falie HIT physical HP 92→91 applied=1 raw=? cap=?
MODEL t=526.198 #336 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 92 ✓
OBS t=526.6 W3 Lizardo → Falie HIT physical HP 91→90 applied=1 raw=? cap=?
MODEL t=526.6 #337 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 91 ✓
OBS t=526.932 W3 Lizardo → Falie HIT physical HP 90→89 applied=1 raw=? cap=?
MODEL t=526.932 #338 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 90 ✓
OBS t=543.465 W3 Lizardo → Falie HIT physical HP 89→88 applied=1 raw=? cap=?
MODEL t=543.465 #345 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 89 ✓
OBS t=544.866 W3 Lizardo → Huun HIT physical HP 77→76 applied=1 raw=? cap=?
MODEL t=544.866 #346 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=556.998 W3 Lizardo → Falie HIT physical HP 88→87 applied=1 raw=? cap=?
MODEL t=556.998 #353 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 88 ✓
OBS t=569.199 W3 Lizardo → Falie HIT physical HP 87→86 applied=1 raw=? cap=?
MODEL t=569.199 #359 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 87 ✓
OBS t≈573.999 (poll) WAVE_CLEAR stage 1-1 next W4 clears=7
OBS t=573.999 W3 wave-clear respite → Falie HEAL ordinary_wave_clear HP 86→99 applied=13
MODEL t=573.999 #363 wave heal predicted 13 ✓ (A3)
OBS t=573.999 W3 wave-clear respite → Huun HEAL ordinary_wave_clear HP 76→80 applied=4
MODEL t=573.999 #364 wave heal predicted 4 ✓ (A3)
OBS t=573.999 W3 wave-clear respite → Runa HEAL ordinary_wave_clear HP 75→80 applied=5
MODEL t=573.999 #365 wave heal predicted 5 ✓ (A3)
OBS t=575.532 W4 Lizardo → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=575.532 #366 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=584.794 W4 High Gobloc → Huun HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=584.794 #374 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=588.265 W4 High Gobloc → Huun HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=588.265 #376 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=590.664 W4 High Gobloc → Huun HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=590.664 #379 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=612.663 W4 Lizardo → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=612.663 #388 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=612.794 W4 Lizardo → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=612.794 #390 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=613.73 W4 Lizardo → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=613.73 #391 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t=617.395 W4 Lizardo → Falie HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=617.395 #393 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=625.927 W4 Orc → Falie HIT physical HP 94→93 applied=1 raw=? cap=?
MODEL t=625.927 #396 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 94 ✓
OBS t=626.462 W4 Lizardo → Falie HIT physical HP 93→92 applied=1 raw=? cap=?
MODEL t=626.462 #398 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 93 ✓
OBS t≈636.927 (poll) WAVE_CLEAR stage 1-1 next W1 clears=8
OBS t=636.796 W4 wave-clear respite → Falie HEAL ordinary_wave_clear HP 92→99 applied=7
MODEL t=636.796 #405 wave heal predicted 7 ✓ (A3)
OBS t=636.796 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 77→80 applied=3
MODEL t=636.796 #406 wave heal predicted 3 ✓ (A3)
OBS t≈639.527 (poll) Huun state L1 maxHP 80 CP 87
OBS t≈659.996 (poll) Runa state L1 maxHP 81 CP 90.6
OBS t≈680.527 (poll) Runa state L1 maxHP 82 CP 91
OBS t≈689.258 (poll) WAVE_CLEAR stage 1-1 next W2 clears=9
OBS t=689.258 W1 wave-clear respite → Runa HEAL ordinary_wave_clear HP 80→82 applied=2
MODEL t=689.258 #445 wave heal predicted 2 ✓ (A3)
OBS t=699.726 W2 High Gobloc → Huun HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=699.726 #455 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=720.458 W2 Lizardo → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=720.458 #465 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=721.859 W2 Lizardo → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=721.859 #467 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=732.126 W2 Lizardo → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=732.126 #472 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=733.459 W2 Lizardo → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=733.459 #474 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t≈733.993 (poll) Huun state L1 maxHP 81 CP 89.5
OBS t≈749.323 (poll) WAVE_CLEAR stage 1-1 next W3 clears=10
OBS t=749.193 W2 wave-clear respite → Falie HEAL ordinary_wave_clear HP 95→99 applied=4
MODEL t=749.193 #483 wave heal predicted 4 ✓ (A3)
OBS t=749.193 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 79→81 applied=2
MODEL t=749.193 #484 wave heal predicted 2 ✓ (A3)
OBS t=753.125 W3 Lizardo → Huun HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=753.125 #487 cap≤1 (routine tier, maxHP 81; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=753.924 W3 Orc → Huun HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=753.924 #488 cap≤1 (routine tier, maxHP 81; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=754.925 W3 Orc → Huun HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=754.925 #489 cap≤1 (routine tier, maxHP 81; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=756.788 W3 Lizardo → Huun HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=756.788 #491 cap≤1 (routine tier, maxHP 81; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=757.525 W3 Orc → Huun HIT physical HP 77→76 applied=1 raw=? cap=?
MODEL t=757.525 #492 cap≤1 (routine tier, maxHP 81; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=758.859 W3 Orc → Runa HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=758.859 #493 cap≤1 (routine tier, maxHP 82; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=760.396 W3 Lizardo → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=760.396 #496 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=761.19 W3 Orc → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=761.19 #497 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=763.125 W3 Orc → Runa HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=763.125 #498 cap≤1 (routine tier, maxHP 82; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=764.056 W3 Lizardo → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=764.056 #500 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=764.858 W3 Orc → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=764.858 #502 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t=766.724 W3 Orc → Runa HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=766.724 #503 cap≤1 (routine tier, maxHP 82; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=767.391 W3 High Gobloc → Runa HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=767.391 #504 cap≤1 (routine tier, maxHP 82; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=767.662 W3 Lizardo → Falie HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=767.662 #506 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=768.458 W3 Orc → Falie HIT physical HP 94→93 applied=1 raw=? cap=?
MODEL t=768.458 #507 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 94 ✓
OBS t=771.324 W3 Lizardo → Falie HIT physical HP 93→92 applied=1 raw=? cap=?
MODEL t=771.324 #510 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 93 ✓
OBS t=780.924 W3 Orc → Falie HIT physical HP 92→91 applied=1 raw=? cap=?
MODEL t=780.924 #515 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 92 ✓
OBS t=782.793 W3 Orc → Falie HIT physical HP 91→90 applied=1 raw=? cap=?
MODEL t=782.793 #518 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 91 ✓
OBS t=796.59 W3 High Gobloc → Huun HIT physical HP 76→75 applied=1 raw=? cap=?
MODEL t=796.59 #524 cap≤1 (routine tier, maxHP 81; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 76 ✓
OBS t=806.254 W3 Orc → Falie HIT physical HP 90→89 applied=1 raw=? cap=?
MODEL t=806.254 #529 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 90 ✓
OBS t=821.454 W3 Lizardo → Falie HIT physical HP 89→88 applied=1 raw=? cap=?
MODEL t=821.454 #537 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 89 ✓
OBS t≈824.589 (poll) WAVE_CLEAR stage 1-1 next W4 clears=11
OBS t=824.589 W3 wave-clear respite → Falie HEAL ordinary_wave_clear HP 88→99 applied=11
MODEL t=824.589 #539 wave heal predicted 11 ✓ (A3)
OBS t=824.589 W3 wave-clear respite → Huun HEAL ordinary_wave_clear HP 75→81 applied=6
MODEL t=824.589 #540 wave heal predicted 6 ✓ (A3)
OBS t=824.589 W3 wave-clear respite → Runa HEAL ordinary_wave_clear HP 78→82 applied=4
MODEL t=824.589 #541 wave heal predicted 4 ✓ (A3)
OBS t=826.986 W4 Orc → Huun HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=826.986 #543 cap≤1 (routine tier, maxHP 81; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=836.921 W4 Orc → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=836.921 #549 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=837.988 W4 Lizardo → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=837.988 #551 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=838.79 W4 Orc → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=838.79 #552 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=841.655 W4 Lizardo → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=841.655 #554 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t≈851.197 (poll) Huun state L1 maxHP 84 CP 90.7
OBS t=868.976 W4 Lizardo → Falie HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=868.976 #568 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=869.846 W4 Lizardo → Huun HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=869.846 #570 cap≤1 (routine tier, maxHP 84; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=879.979 W4 Orc → Falie HIT physical HP 94→93 applied=1 raw=? cap=?
MODEL t=879.979 #574 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 94 ✓
OBS t≈888.312 (poll) Huun state L1 maxHP 85 CP 91
OBS t=889.442 W4 Orc → Falie HIT physical HP 93→92 applied=1 raw=? cap=?
MODEL t=889.442 #579 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 93 ✓
OBS t=889.712 W4 High Gobloc → Huun HIT physical HP 79→78 applied=1 raw=? cap=?
```

## kaja-l1-four session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/kaja-l1-four/observed_events.ndjson (SHA-256 dc4e701d02bb98373c8a8da1502298b116e19edd8c2d30a472e6641d865d62de). Enemy KOs omitted: 641. Lines 400/401 (truncated; rerun with --fullTimelines).

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L1 85/85, Huun L1 60/60, Runa L1 69/69, Kojonn L1 73/73 autoEquip=true bossPolicy=hold
OBS t≈3.931 (poll) Huun state L1 maxHP 70 CP 69.8
OBS t=12.664 W1 Skeleton → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=12.664 #10 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t≈68.262 (poll) WAVE_CLEAR stage 1-1 next W2 clears=1
OBS t=68.262 W1 wave-clear respite → Huun HEAL ordinary_wave_clear HP 60→70 applied=10
MODEL t=68.262 #36 wave heal predicted 10 ✓ (A3)
OBS t=68.262 W1 wave-clear respite → Runa HEAL ordinary_wave_clear HP 68→69 applied=1
MODEL t=68.262 #37 wave heal predicted 1 ✓ (A3)
OBS t=70.131 W2 Lizardo → Falie HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=70.131 #38 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=70.196 W2 Lizardo → Falie HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=70.196 #39 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=70.729 W2 Lizardo → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=70.729 #40 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=81.396 W2 Gobloc → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=81.396 #49 cap≤1 (fodder tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=84.998 W2 Gobloc → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=84.998 #50 cap≤1 (fodder tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=97.062 W2 Lizardo → Falie HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=97.062 #56 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=97.129 W2 Lizardo → Falie HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=97.129 #57 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=98.999 W2 Lizardo → Falie HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=98.999 #60 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t≈110.352 (poll) Falie state L1 maxHP 91 CP 58.6
OBS t=111.625 W2 Lizardo → Falie HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=111.625 #65 cap≤1 (routine tier, maxHP 91; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=114.152 W2 Lizardo → Falie HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=114.152 #68 cap≤1 (routine tier, maxHP 91; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=124.819 W2 High Gobloc → Falie HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=124.819 #71 cap≤1 (routine tier, maxHP 91; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=125.087 W2 High Gobloc → Falie HIT physical HP 77→76 applied=1 raw=? cap=?
MODEL t=125.087 #72 cap≤1 (routine tier, maxHP 91; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t≈131.023 (poll) Kojonn state L1 maxHP 78 CP 63.3
OBS t=135.353 W2 Lizardo → Falie HIT physical HP 76→75 applied=1 raw=? cap=?
MODEL t=135.353 #77 cap≤1 (routine tier, maxHP 91; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 76 ✓
OBS t=137.354 W2 Gobloc → Huun HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=137.354 #80 cap≤1 (fodder tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=137.686 W2 Gobloc → Huun HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=137.686 #81 cap≤1 (fodder tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t≈140.153 (poll) WAVE_CLEAR stage 1-1 next W3 clears=2
OBS t=140.153 W2 wave-clear respite → Falie HEAL ordinary_wave_clear HP 75→89 applied=14
MODEL t=140.153 #84 wave heal predicted 14 ✓ (A3)
OBS t=140.153 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 65→70 applied=5
MODEL t=140.153 #85 wave heal predicted 5 ✓ (A3)
OBS t=140.153 W2 wave-clear respite → Kojonn HEAL ordinary_wave_clear HP 73→78 applied=5
MODEL t=140.153 #86 wave heal predicted 5 ✓ (A3)
OBS t=142.356 W3 Orc → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=142.356 #88 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=142.818 W3 Lizardo → Falie HIT physical HP 89→88 applied=1 raw=? cap=?
MODEL t=142.818 #90 cap≤1 (routine tier, maxHP 91; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 89 ✓
OBS t=150.286 W3 Orc → Falie HIT physical HP 88→87 applied=1 raw=? cap=?
MODEL t=150.286 #94 cap≤1 (routine tier, maxHP 91; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 88 ✓
OBS t≈151.754 (poll) Falie state L1 maxHP 97 CP 68.7
OBS t=151.62 W3 Lizardo → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=151.62 #95 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=156.686 W3 Lizardo → Falie HIT physical HP 87→86 applied=1 raw=? cap=?
MODEL t=156.686 #99 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 87 ✓
OBS t=167.485 W3 Lizardo → Falie HIT physical HP 86→85 applied=1 raw=? cap=?
MODEL t=167.485 #102 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 86 ✓
OBS t=167.621 W3 Lizardo → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=167.621 #103 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t≈172.221 (poll) Kojonn state L1 maxHP 84 CP 72
OBS t=184.881 W3 High Gobloc → Huun HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=184.881 #110 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=186.417 W3 High Gobloc → Huun HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=186.417 #111 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=200.282 W3 Orc → Huun HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=200.282 #116 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=200.349 W3 Lizardo → Falie HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=200.349 #117 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t≈201.082 (poll) Huun state L1 maxHP 74 CP 75.6
OBS t=203.95 W3 Lizardo → Falie HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=203.95 #120 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=212.28 W3 Lizardo → Falie HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=212.28 #124 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=213.148 W3 Lizardo → Huun HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=213.148 #125 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=214.347 W3 Lizardo → Falie HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=214.347 #127 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=218.015 W3 Lizardo → Falie HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=218.015 #129 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t≈219.15 (poll) WAVE_CLEAR stage 1-1 next W4 clears=3
OBS t=219.081 W3 wave-clear respite → Falie HEAL ordinary_wave_clear HP 80→95 applied=15
MODEL t=219.081 #131 wave heal predicted 15 ✓ (A3)
OBS t=219.081 W3 wave-clear respite → Huun HEAL ordinary_wave_clear HP 63→74 applied=11
MODEL t=219.081 #132 wave heal predicted 11 ✓ (A3)
OBS t=219.081 W3 wave-clear respite → Kojonn HEAL ordinary_wave_clear HP 78→84 applied=6
MODEL t=219.081 #133 wave heal predicted 6 ✓ (A3)
OBS t=221.748 W4 Orc → Falie HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=221.748 #134 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=222.013 W4 Orc → Huun HIT physical HP 74→73 applied=1 raw=? cap=?
MODEL t=222.013 #135 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 74 ✓
OBS t=223.613 W4 Orc → Falie HIT physical HP 94→93 applied=1 raw=? cap=?
MODEL t=223.613 #137 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 94 ✓
OBS t=225.613 W4 Orc → Huun HIT physical HP 73→72 applied=1 raw=? cap=?
MODEL t=225.613 #138 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 73 ✓
OBS t=227.28 W4 Orc → Falie HIT physical HP 93→92 applied=1 raw=? cap=?
MODEL t=227.28 #139 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 93 ✓
OBS t=229.282 W4 Orc → Huun HIT physical HP 72→71 applied=1 raw=? cap=?
MODEL t=229.282 #141 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 72 ✓
OBS t=230.881 W4 Orc → Falie HIT physical HP 92→91 applied=1 raw=? cap=?
MODEL t=230.881 #142 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 92 ✓
OBS t=232.216 W4 Gobloc → Kojonn HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=232.216 #143 cap≤1 (fodder tier, maxHP 84; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=232.88 W4 Gobloc → Kojonn HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=232.88 #144 cap≤1 (fodder tier, maxHP 84; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=232.88 W4 Orc → Huun HIT physical HP 71→70 applied=1 raw=? cap=?
MODEL t=232.88 #145 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 71 ✓
OBS t=234.02 W4 Orc → Kojonn HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=234.02 #146 cap≤1 (routine tier, maxHP 84; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=234.546 W4 Orc → Falie HIT physical HP 91→90 applied=1 raw=? cap=?
MODEL t=234.546 #147 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 91 ✓
OBS t=235.815 W4 Gobloc → Kojonn HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=235.815 #149 cap≤1 (fodder tier, maxHP 84; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=236.547 W4 Orc → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=236.547 #151 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t≈246.016 (poll) Runa state L1 maxHP 75 CP 80.8
OBS t=250.346 W4 Orc → Falie HIT physical HP 90→89 applied=1 raw=? cap=?
MODEL t=250.346 #162 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 90 ✓
OBS t=251.152 W4 Orc → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=251.152 #163 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=254.754 W4 Orc → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=254.754 #165 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=262.545 W4 Orc → Falie HIT physical HP 89→88 applied=1 raw=? cap=?
MODEL t=262.545 #168 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 89 ✓
OBS t=263.413 W4 Orc → Huun HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=263.413 #170 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=264.279 W4 Orc → Falie HIT physical HP 88→87 applied=1 raw=? cap=?
MODEL t=264.279 #171 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 88 ✓
OBS t=264.279 W4 Orc → Falie HIT physical HP 87→86 applied=1 raw=? cap=?
MODEL t=264.279 #172 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 87 ✓
OBS t=267.152 W4 Orc → Huun HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=267.152 #173 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=267.879 W4 Orc → Falie HIT physical HP 86→85 applied=1 raw=? cap=?
MODEL t=267.879 #174 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 86 ✓
OBS t=267.879 W4 Orc → Falie HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=267.879 #175 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t≈278.683 (poll) Kojonn state L1 maxHP 87 CP 73.3
OBS t=283.014 W4 Lizardo → Falie HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=283.014 #183 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=284.018 W4 Orc → Huun HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=284.018 #184 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=285.28 W4 Orc → Falie HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=285.28 #186 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=287.615 W4 Orc → Huun HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=287.615 #187 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=288.883 W4 Orc → Falie HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=288.883 #188 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=296.481 W4 Orc → Falie HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=296.481 #192 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=296.678 W4 Orc → Falie HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=296.678 #193 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=296.678 W4 Lizardo → Falie HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=296.678 #194 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=297.944 W4 Lizardo → Falie HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=297.944 #196 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=298.146 W4 Lizardo → Huun HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=298.146 #197 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=300.944 W4 Lizardo → Falie HIT physical HP 77→76 applied=1 raw=? cap=?
MODEL t=300.944 #199 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=301.078 W4 Orc → Huun HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=301.078 #200 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=301.617 W4 Lizardo → Huun HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=301.617 #202 cap≤1 (routine tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=304.614 W4 Lizardo → Falie HIT physical HP 76→75 applied=1 raw=? cap=?
MODEL t=304.614 #204 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 76 ✓
OBS t≈306.21 (poll) WAVE_CLEAR stage 1-1 next W1 clears=4
OBS t=306.079 W4 wave-clear respite → Falie HEAL ordinary_wave_clear HP 75→90 applied=15
MODEL t=306.079 #206 wave heal predicted 15 ✓ (A3)
OBS t=306.079 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 60→72 applied=12
MODEL t=306.079 #207 wave heal predicted 12 ✓ (A3)
OBS t=306.079 W4 wave-clear respite → Runa HEAL ordinary_wave_clear HP 69→75 applied=6
MODEL t=306.079 #208 wave heal predicted 6 ✓ (A3)
OBS t=306.079 W4 wave-clear respite → Kojonn HEAL ordinary_wave_clear HP 80→87 applied=7
MODEL t=306.079 #209 wave heal predicted 7 ✓ (A3)
OBS t≈307.547 (poll) Huun state L1 maxHP 80 CP 85.8
OBS t≈340.342 (poll) Falie state L1 maxHP 97 CP 71
OBS t≈362.348 (poll) WAVE_CLEAR stage 1-1 next W2 clears=5
OBS t=362.279 W1 wave-clear respite → Falie HEAL ordinary_wave_clear HP 90→97 applied=7
MODEL t=362.279 #248 wave heal predicted 7 ✓ (A3)
OBS t=362.279 W1 wave-clear respite → Huun HEAL ordinary_wave_clear HP 72→80 applied=8
MODEL t=362.279 #249 wave heal predicted 8 ✓ (A3)
OBS t=363.676 W2 Lizardo → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=363.676 #250 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=364.874 W2 Lizardo → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=364.874 #252 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t≈372.741 (poll) Runa state L1 maxHP 80 CP 90.2
OBS t=397.21 W2 Lizardo → Falie HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=397.21 #270 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=397.343 W2 Lizardo → Falie HIT physical HP 94→93 applied=1 raw=? cap=?
MODEL t=397.343 #271 cap≤1 (routine tier, maxHP 97; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 94 ✓
OBS t≈401.5 (poll) Falie state L1 maxHP 99 CP 75.7
OBS t=401.341 W2 Lizardo → Huun HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=401.341 #275 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=401.675 W2 Lizardo → Huun HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=401.675 #276 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t≈431.407 (poll) WAVE_CLEAR stage 1-1 next W3 clears=6
OBS t=431.407 W2 wave-clear respite → Falie HEAL ordinary_wave_clear HP 93→99 applied=6
MODEL t=431.407 #288 wave heal predicted 6 ✓ (A3)
OBS t=431.407 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 78→80 applied=2
MODEL t=431.407 #289 wave heal predicted 2 ✓ (A3)
OBS t=431.407 W2 wave-clear respite → Runa HEAL ordinary_wave_clear HP 75→80 applied=5
MODEL t=431.407 #290 wave heal predicted 5 ✓ (A3)
OBS t=433.34 W3 Lizardo → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=433.34 #292 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=434.606 W3 Lizardo → Huun HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=434.606 #294 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=442.54 W3 Orc → Runa HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=442.54 #298 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=458.073 W3 Lizardo → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=458.073 #308 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=458.141 W3 Lizardo → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=458.141 #309 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=473.806 W3 High Gobloc → Huun HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=473.806 #318 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=496.137 W3 Lizardo → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=496.137 #330 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t≈498.736 (poll) WAVE_CLEAR stage 1-1 next W4 clears=7
OBS t=498.736 W3 wave-clear respite → Falie HEAL ordinary_wave_clear HP 95→99 applied=4
MODEL t=498.736 #333 wave heal predicted 4 ✓ (A3)
OBS t=498.736 W3 wave-clear respite → Huun HEAL ordinary_wave_clear HP 78→80 applied=2
MODEL t=498.736 #334 wave heal predicted 2 ✓ (A3)
OBS t=498.736 W3 wave-clear respite → Runa HEAL ordinary_wave_clear HP 79→80 applied=1
MODEL t=498.736 #335 wave heal predicted 1 ✓ (A3)
OBS t=501.603 W4 Orc → Huun HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=501.603 #338 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=501.74 W4 Orc → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=501.74 #339 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=508.805 W4 Lizardo → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=508.805 #345 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=510.67 W4 Orc → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=510.67 #347 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=510.737 W4 Lizardo → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=510.737 #348 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t=532.602 W4 Lizardo → Falie HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=532.602 #357 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=532.67 W4 Lizardo → Falie HIT physical HP 94→93 applied=1 raw=? cap=?
MODEL t=532.67 #358 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 94 ✓
OBS t≈533.738 (poll) Kojonn state L1 maxHP 88 CP 79.1
OBS t≈556.334 (poll) WAVE_CLEAR stage 1-1 next W1 clears=8
OBS t=556.334 W4 wave-clear respite → Falie HEAL ordinary_wave_clear HP 93→99 applied=6
MODEL t=556.334 #372 wave heal predicted 6 ✓ (A3)
OBS t=556.334 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 79→80 applied=1
MODEL t=556.334 #373 wave heal predicted 1 ✓ (A3)
OBS t=556.334 W4 wave-clear respite → Kojonn HEAL ordinary_wave_clear HP 87→88 applied=1
MODEL t=556.334 #374 wave heal predicted 1 ✓ (A3)
OBS t≈606.199 (poll) WAVE_CLEAR stage 1-1 next W2 clears=9
OBS t=608.537 W2 Lizardo → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=608.537 #415 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=609.332 W2 Lizardo → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=609.332 #417 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t≈648.942 (poll) Huun state L1 maxHP 80 CP 87
OBS t≈658.663 (poll) WAVE_CLEAR stage 1-1 next W3 clears=10
OBS t=658.532 W2 wave-clear respite → Falie HEAL ordinary_wave_clear HP 97→99 applied=2
MODEL t=658.532 #447 wave heal predicted 2 ✓ (A3)
OBS t=660.131 W3 Orc → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=660.131 #449 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=661.397 W3 Orc → Huun HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=661.397 #451 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=661.733 W3 Orc → Huun HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=661.733 #452 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t≈665.468 (poll) Runa state L1 maxHP 81 CP 90.6
OBS t=679.862 W3 Orc → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=679.862 #465 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=680.132 W3 Lizardo → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=680.132 #467 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=681.595 W3 Lizardo → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=681.595 #469 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t≈685.929 (poll) Runa state L1 maxHP 82 CP 91
OBS t=689.995 W3 Orc → Huun HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=689.995 #473 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=703.729 W3 Lizardo → Falie HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=703.729 #481 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=704.197 W3 Orc → Huun HIT physical HP 77→76 applied=1 raw=? cap=?
MODEL t=704.197 #482 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t≈716.596 (poll) WAVE_CLEAR stage 1-1 next W4 clears=11
OBS t=716.465 W3 wave-clear respite → Falie HEAL ordinary_wave_clear HP 94→99 applied=5
MODEL t=716.465 #490 wave heal predicted 5 ✓ (A3)
OBS t=716.465 W3 wave-clear respite → Huun HEAL ordinary_wave_clear HP 76→80 applied=4
MODEL t=716.465 #491 wave heal predicted 4 ✓ (A3)
OBS t=716.465 W3 wave-clear respite → Runa HEAL ordinary_wave_clear HP 80→82 applied=2
MODEL t=716.465 #492 wave heal predicted 2 ✓ (A3)
OBS t=719.196 W4 Orc → Huun HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=719.196 #494 cap≤1 (routine tier, maxHP 80; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=719.529 W4 Orc → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=719.529 #495 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=727.663 W4 Orc → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=727.663 #501 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=730.996 W4 Orc → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=730.996 #504 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=734.596 W4 Orc → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=734.596 #507 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t≈739.064 (poll) Huun state L1 maxHP 81 CP 89.5
OBS t=743.328 W4 Lizardo → Falie HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=743.328 #510 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=772.992 W4 Lizardo → Huun HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=772.992 #528 cap≤1 (routine tier, maxHP 81; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=773.064 W4 Orc → Falie HIT physical HP 94→93 applied=1 raw=? cap=?
MODEL t=773.064 #529 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 94 ✓
OBS t=774.725 W4 Lizardo → Falie HIT physical HP 93→92 applied=1 raw=? cap=?
MODEL t=774.725 #532 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 93 ✓
OBS t≈776.659 (poll) WAVE_CLEAR stage 1-1 next W1 clears=12
OBS t=776.659 W4 wave-clear respite → Falie HEAL ordinary_wave_clear HP 92→99 applied=7
MODEL t=776.659 #534 wave heal predicted 7 ✓ (A3)
OBS t=776.659 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 78→81 applied=3
MODEL t=776.659 #535 wave heal predicted 3 ✓ (A3)
OBS t≈829.927 (poll) WAVE_CLEAR stage 1-1 next W2 clears=13
OBS t=831.324 W2 Lizardo → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=831.324 #574 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=832.196 W2 Lizardo → Huun HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=832.196 #577 cap≤1 (routine tier, maxHP 81; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t≈859.392 (poll) Huun state L1 maxHP 84 CP 90.7
OBS t=863.456 W2 Lizardo → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=863.456 #595 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=863.658 W2 High Gobloc → Huun HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=863.658 #596 cap≤1 (routine tier, maxHP 84; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t≈885.992 (poll) WAVE_CLEAR stage 1-1 next W3 clears=14
OBS t=885.858 W2 wave-clear respite → Falie HEAL ordinary_wave_clear HP 97→99 applied=2
MODEL t=885.858 #610 wave heal predicted 2 ✓ (A3)
OBS t=885.858 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 79→84 applied=5
MODEL t=885.858 #611 wave heal predicted 5 ✓ (A3)
OBS t=888.725 W3 Lizardo → Huun HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=888.725 #614 cap≤1 (routine tier, maxHP 84; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t≈895.187 (poll) Huun state L1 maxHP 85 CP 91
OBS t=923.586 W3 Lizardo → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=923.586 #629 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=925.921 W3 Lizardo → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=925.921 #632 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=935.586 W3 Lizardo → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=935.586 #638 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=944.321 W3 Lizardo → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=944.321 #643 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t=945.454 W3 Lizardo → Huun HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=945.454 #644 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=946.122 W3 Orc → Huun HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=946.122 #645 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=949.121 W3 Lizardo → Falie HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=949.121 #648 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t≈950.254 (poll) WAVE_CLEAR stage 1-1 next W4 clears=15
OBS t=950.254 W3 wave-clear respite → Falie HEAL ordinary_wave_clear HP 94→99 applied=5
MODEL t=950.254 #650 wave heal predicted 5 ✓ (A3)
OBS t=950.254 W3 wave-clear respite → Huun HEAL ordinary_wave_clear HP 81→85 applied=4
MODEL t=950.254 #651 wave heal predicted 4 ✓ (A3)
OBS t=955.452 W4 Lizardo → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=955.452 #654 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=956.055 W4 Lizardo → Huun HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=956.055 #655 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=959.654 W4 Lizardo → Huun HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=959.654 #659 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t≈965.19 (poll) Huun state L1 maxHP 85 CP 93.7
OBS t=975.45 W4 Lizardo → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=975.45 #667 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=975.785 W4 Orc → Huun HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=975.785 #669 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=999.648 W4 Lizardo → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=999.648 #680 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t≈1010.584 (poll) WAVE_CLEAR stage 1-1 next W1 clears=16
OBS t=1010.449 W4 wave-clear respite → Falie HEAL ordinary_wave_clear HP 96→99 applied=3
MODEL t=1010.449 #686 wave heal predicted 3 ✓ (A3)
OBS t=1010.449 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 82→85 applied=3
MODEL t=1010.449 #687 wave heal predicted 3 ✓ (A3)
OBS t≈1062.516 (poll) WAVE_CLEAR stage 1-1 next W2 clears=17
OBS t=1065.247 W2 Lizardo → Huun HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=1065.247 #724 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=1065.781 W2 Lizardo → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=1065.781 #725 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=1072.313 W2 High Gobloc → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=1072.313 #731 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=1072.648 W2 High Gobloc → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=1072.648 #733 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t≈1087.912 (poll) Huun state L1 maxHP 83 CP 99.4
OBS t=1112.314 W2 Lizardo → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=1112.314 #753 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t≈1113.713 (poll) WAVE_CLEAR stage 1-1 next W3 clears=18
OBS t=1113.582 W2 wave-clear respite → Falie HEAL ordinary_wave_clear HP 95→99 applied=4
MODEL t=1113.582 #755 wave heal predicted 4 ✓ (A3)
OBS t=1117.646 W3 Lizardo → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=1117.646 #760 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=1123.047 W3 Orc → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=1123.047 #763 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=1149.645 W3 Lizardo → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=1149.645 #775 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=1149.977 W3 Orc → Falie HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=1149.977 #776 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t=1159.846 W3 Lizardo → Falie HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=1159.846 #782 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t≈1170.911 (poll) WAVE_CLEAR stage 1-1 next W4 clears=19
OBS t=1170.778 W3 wave-clear respite → Falie HEAL ordinary_wave_clear HP 94→99 applied=5
MODEL t=1170.778 #789 wave heal predicted 5 ✓ (A3)
OBS t=1173.312 W4 Lizardo → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=1173.312 #791 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=1181.642 W4 Lizardo → Huun HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=1181.642 #798 cap≤1 (routine tier, maxHP 83; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t≈1223.375 (poll) WAVE_CLEAR stage 1-1 next W1 clears=20
OBS t=1223.375 W4 wave-clear respite → Falie HEAL ordinary_wave_clear HP 98→99 applied=1
MODEL t=1223.375 #819 wave heal predicted 1 ✓ (A3)
OBS t=1223.375 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 82→83 applied=1
MODEL t=1223.375 #820 wave heal predicted 1 ✓ (A3)
```

## kaja-l15-three session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/kaja-l15-three/observed_events.ndjson (SHA-256 c6803ac7ef4912cccad866c74ffcb69e806ec0fcc6642c83ff5eb1ee465ce6d3). Enemy KOs omitted: 646. Lines 56/56.

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L15 187/197, Huun L15 144/144, Runa L15 130/139 autoEquip=false bossPolicy=hold
OBS t≈52.398 (poll) WAVE_CLEAR stage 1-1 next W2 clears=1
OBS t=52.398 W1 wave-clear respite → Falie HEAL ordinary_wave_clear HP 187→197 applied=10
MODEL t=52.398 #35 wave heal predicted 10 ✓ (A3)
OBS t=52.398 W1 wave-clear respite → Runa HEAL ordinary_wave_clear HP 130→139 applied=9
MODEL t=52.398 #36 wave heal predicted 9 ✓ (A3)
OBS t≈100.931 (poll) WAVE_CLEAR stage 1-1 next W3 clears=2
OBS t≈147.661 (poll) WAVE_CLEAR stage 1-1 next W4 clears=3
OBS t≈199.326 (poll) WAVE_CLEAR stage 1-1 next W1 clears=4
OBS t≈199.326 (poll) BOSS_START Troll HP 231/231 limit=18s party Falie L15 197/197, Huun L15 144/144, Runa L15 139/139
OBS t=200.598 W1 Troll → Runa HIT physical HP 139→134 applied=5 raw=? cap=?
MODEL t=200.598 #130 cap≤25 (boss tier, maxHP 139; A1/A2) below bound → cap did not bind; HP before predicted 139 ✓
OBS t≈204.063 (poll) BOSS_CLEAR last sampled boss HP 30 (sample precedes the clear; not settlement HP)
MODEL t=204.063 boss-clear restore applied (unlogged; A5)
OBS t≈250.46 (poll) WAVE_CLEAR stage 1-2 next W2 clears=5
OBS t≈296.328 (poll) WAVE_CLEAR stage 1-2 next W3 clears=6
OBS t≈347.658 (poll) WAVE_CLEAR stage 1-2 next W4 clears=7
OBS t≈399.006 (poll) WAVE_CLEAR stage 1-2 next W1 clears=8
OBS t≈399.006 (poll) BOSS_START Troll HP 427/427 limit=18s party Falie L15 197/197, Huun L15 144/144, Runa L15 139/139
OBS t≈404.556 (poll) BOSS_CLEAR last sampled boss HP 18 (sample precedes the clear; not settlement HP)
MODEL t=404.556 boss-clear restore applied (unlogged; A5)
OBS t≈455.206 (poll) WAVE_CLEAR stage 1-3 next W2 clears=9
OBS t≈504.54 (poll) WAVE_CLEAR stage 1-3 next W3 clears=10
OBS t≈557.869 (poll) WAVE_CLEAR stage 1-3 next W4 clears=11
OBS t≈605.338 (poll) WAVE_CLEAR stage 1-3 next W1 clears=12
OBS t≈605.338 (poll) BOSS_START Troll HP 440/440 limit=18s party Falie L15 197/197, Huun L15 144/144, Runa L15 139/139
OBS t=606.409 W1 Troll → Huun HIT physical HP 144→119 applied=25 raw=? cap=?
MODEL t=606.409 #395 cap≤25 (boss tier, maxHP 144; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 144 ✓
OBS t=608.008 W1 Troll → Huun HIT physical HP 119→95 applied=24 raw=? cap=?
MODEL t=608.008 #396 cap≤25 (boss tier, maxHP 144; A1/A2) below bound → cap did not bind; HP before predicted 119 ✓
OBS t≈609.872 (poll) BOSS_CLEAR last sampled boss HP 42 (sample precedes the clear; not settlement HP)
MODEL t=609.872 boss-clear restore applied (unlogged; A5)
OBS t≈657.138 (poll) WAVE_CLEAR stage 1-4 next W2 clears=13
OBS t≈706.003 (poll) WAVE_CLEAR stage 1-4 next W3 clears=14
OBS t≈754.132 (poll) WAVE_CLEAR stage 1-4 next W4 clears=15
OBS t=756.735 W4 Orc → Huun HIT physical HP 144→142 applied=2 raw=? cap=?
MODEL t=756.735 #489 cap≤2 (routine tier, maxHP 144; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 144 ✓
OBS t≈808.534 (poll) WAVE_CLEAR stage 1-4 next W1 clears=16
OBS t≈808.534 (poll) BOSS_START Troll HP 458/458 limit=18s party Falie L15 197/197, Huun L15 144/144, Runa L15 139/139
OBS t=808.534 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 142→144 applied=2
MODEL t=808.534 #519 wave heal predicted 2 ✓ (A3)
OBS t=809.672 W1 Troll → Runa HIT physical HP 139→114 applied=25 raw=? cap=?
MODEL t=809.672 #520 cap≤25 (boss tier, maxHP 139; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 139 ✓
OBS t≈814.87 (poll) BOSS_CLEAR last sampled boss HP 8 (sample precedes the clear; not settlement HP)
MODEL t=814.87 boss-clear restore applied (unlogged; A5)
OBS t≈864.669 (poll) WAVE_CLEAR stage 1-5 next W2 clears=17
OBS t≈921.33 (poll) WAVE_CLEAR stage 1-5 next W3 clears=18
OBS t≈972.264 (poll) WAVE_CLEAR stage 1-5 next W4 clears=19
OBS t=976.53 W4 High Gobloc → Huun HIT physical HP 144→142 applied=2 raw=? cap=?
MODEL t=976.53 #627 cap≤2 (routine tier, maxHP 144; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 144 ✓
OBS t≈1023.529 (poll) WAVE_CLEAR stage 1-5 next W1 clears=20
OBS t≈1023.529 (poll) BOSS_START Troll HP 479/479 limit=18s party Falie L15 197/197, Huun L15 144/144, Runa L15 139/139
OBS t=1023.529 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 142→144 applied=2
MODEL t=1023.529 #656 wave heal predicted 2 ✓ (A3)
OBS t≈1023.529 (poll) BOSS_EXIT outcome=max_waves
OBS t≈1023.529 (poll) SESSION_END max_waves clears=20 recoveries=0 gaps=0 deadlocks=0
```

## kaja-l15-four session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/kaja-l15-four/observed_events.ndjson (SHA-256 f8871b3665634ca0c56f1ceaf0a23578f580c700568e8ead90b1ca1d33825cbc). Enemy KOs omitted: 646. Lines 58/58.

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L15 187/197, Huun L15 144/144, Runa L15 130/139, Kojonn L15 163/171 autoEquip=false bossPolicy=hold
OBS t≈55.128 (poll) WAVE_CLEAR stage 1-1 next W2 clears=1
OBS t=55.128 W1 wave-clear respite → Falie HEAL ordinary_wave_clear HP 187→197 applied=10
MODEL t=55.128 #35 wave heal predicted 10 ✓ (A3)
OBS t=55.128 W1 wave-clear respite → Runa HEAL ordinary_wave_clear HP 130→139 applied=9
MODEL t=55.128 #36 wave heal predicted 9 ✓ (A3)
OBS t=55.128 W1 wave-clear respite → Kojonn HEAL ordinary_wave_clear HP 163→171 applied=8
MODEL t=55.128 #37 wave heal predicted 8 ✓ (A3)
OBS t≈101.126 (poll) WAVE_CLEAR stage 1-1 next W3 clears=2
OBS t≈147.459 (poll) WAVE_CLEAR stage 1-1 next W4 clears=3
OBS t≈195.526 (poll) WAVE_CLEAR stage 1-1 next W1 clears=4
OBS t≈195.526 (poll) BOSS_START Troll HP 231/231 limit=18s party Falie L15 197/197, Huun L15 144/144, Runa L15 139/139, Kojonn L15 171/171
OBS t=196.595 W1 Troll → Runa HIT physical HP 139→134 applied=5 raw=? cap=?
MODEL t=196.595 #131 cap≤25 (boss tier, maxHP 139; A1/A2) below bound → cap did not bind; HP before predicted 139 ✓
OBS t≈200.194 (poll) BOSS_CLEAR last sampled boss HP 28 (sample precedes the clear; not settlement HP)
MODEL t=200.194 boss-clear restore applied (unlogged; A5)
OBS t≈245.595 (poll) WAVE_CLEAR stage 1-2 next W2 clears=5
OBS t≈289.592 (poll) WAVE_CLEAR stage 1-2 next W3 clears=6
OBS t≈336.057 (poll) WAVE_CLEAR stage 1-2 next W4 clears=7
OBS t=385.256 W4 High Gobloc → Huun HIT physical HP 144→142 applied=2 raw=? cap=?
MODEL t=385.256 #265 cap≤2 (routine tier, maxHP 144; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 144 ✓
OBS t≈386.521 (poll) WAVE_CLEAR stage 1-2 next W1 clears=8
OBS t≈386.521 (poll) BOSS_START Troll HP 427/427 limit=18s party Falie L15 197/197, Huun L15 144/144, Runa L15 139/139, Kojonn L15 171/171
OBS t=386.521 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 142→144 applied=2
MODEL t=386.521 #268 wave heal predicted 2 ✓ (A3)
OBS t=387.526 W1 Troll → Huun HIT physical HP 144→121 applied=23 raw=? cap=?
MODEL t=387.526 #269 cap≤25 (boss tier, maxHP 144; A1/A2) below bound → cap did not bind; HP before predicted 144 ✓
OBS t≈390.725 (poll) BOSS_CLEAR last sampled boss HP 27 (sample precedes the clear; not settlement HP)
MODEL t=390.725 boss-clear restore applied (unlogged; A5)
OBS t≈436.123 (poll) WAVE_CLEAR stage 1-3 next W2 clears=9
OBS t≈483.119 (poll) WAVE_CLEAR stage 1-3 next W3 clears=10
OBS t≈532.052 (poll) WAVE_CLEAR stage 1-3 next W4 clears=11
OBS t≈579.379 (poll) WAVE_CLEAR stage 1-3 next W1 clears=12
OBS t≈579.379 (poll) BOSS_START Troll HP 440/440 limit=18s party Falie L15 197/197, Huun L15 144/144, Runa L15 139/139, Kojonn L15 171/171
OBS t=580.382 W1 Troll → Runa HIT physical HP 139→116 applied=23 raw=? cap=?
MODEL t=580.382 #399 cap≤25 (boss tier, maxHP 139; A1/A2) below bound → cap did not bind; HP before predicted 139 ✓
OBS t≈584.112 (poll) BOSS_CLEAR last sampled boss HP 105 (sample precedes the clear; not settlement HP)
MODEL t=584.112 boss-clear restore applied (unlogged; A5)
OBS t≈630.715 (poll) WAVE_CLEAR stage 1-4 next W2 clears=13
OBS t≈675.446 (poll) WAVE_CLEAR stage 1-4 next W3 clears=14
OBS t≈723.108 (poll) WAVE_CLEAR stage 1-4 next W4 clears=15
OBS t≈772.576 (poll) WAVE_CLEAR stage 1-4 next W1 clears=16
OBS t≈772.576 (poll) BOSS_START Troll HP 458/458 limit=18s party Falie L15 197/197, Huun L15 144/144, Runa L15 139/139, Kojonn L15 171/171
OBS t=773.583 W1 Troll → Kojonn HIT physical HP 171→151 applied=20 raw=? cap=?
MODEL t=773.583 #521 cap≤30 (boss tier, maxHP 171; A1/A2) below bound → cap did not bind; HP before predicted 171 ✓
OBS t≈777.446 (poll) BOSS_CLEAR last sampled boss HP 13 (sample precedes the clear; not settlement HP)
MODEL t=777.446 boss-clear restore applied (unlogged; A5)
OBS t≈824.846 (poll) WAVE_CLEAR stage 1-5 next W2 clears=17
OBS t≈869.376 (poll) WAVE_CLEAR stage 1-5 next W3 clears=18
OBS t≈918.374 (poll) WAVE_CLEAR stage 1-5 next W4 clears=19
OBS t=920.838 W4 High Gobloc → Huun HIT physical HP 144→142 applied=2 raw=? cap=?
MODEL t=920.838 #628 cap≤2 (routine tier, maxHP 144; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 144 ✓
OBS t≈973.171 (poll) WAVE_CLEAR stage 1-5 next W1 clears=20
OBS t≈973.171 (poll) BOSS_START Troll HP 479/479 limit=18s party Falie L15 197/197, Huun L15 144/144, Runa L15 139/139, Kojonn L15 171/171
OBS t=973.171 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 142→144 applied=2
MODEL t=973.171 #657 wave heal predicted 2 ✓ (A3)
OBS t≈973.171 (poll) BOSS_EXIT outcome=max_waves
OBS t≈973.171 (poll) SESSION_END max_waves clears=20 recoveries=0 gaps=0 deadlocks=0
```

## gear-base session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/gear-base/observed_events.ndjson (SHA-256 970f5f45ef3e6a105562d44fb531f1870c7f2e7fc3b69e36ba3cb2da4d378a3a). Enemy KOs omitted: 671. Lines 400/1232 (truncated; rerun with --fullTimelines).

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L1 85/85, Huun L1 60/70, Runa L1 69/69 autoEquip=false bossPolicy=hold
OBS t=9.95 W1 Skeleton → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=9.95 #4 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=10.666 W1 Skeleton → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=10.666 #5 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=11.14 W1 Skeleton → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=11.14 #6 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t≈82.136 (poll) WAVE_CLEAR stage 1-1 next W2 clears=1
OBS t=81.204 W1 wave-clear respite → Huun HEAL ordinary_wave_clear HP 60→70 applied=10
MODEL t=81.204 #38 wave heal predicted 10 ✓ (A3)
OBS t=81.204 W1 wave-clear respite → Runa HEAL ordinary_wave_clear HP 66→69 applied=3
MODEL t=81.204 #39 wave heal predicted 3 ✓ (A3)
OBS t=86.469 W2 Lizardo → Falie HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=86.469 #41 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=87.002 W2 Lizardo → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=87.002 #43 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=96.203 W2 Gobloc → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=96.203 #51 cap≤1 (fodder tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=108.066 W2 Lizardo → Falie HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=108.066 #56 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=110.002 W2 Lizardo → Falie HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=110.002 #58 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=110.202 W2 Lizardo → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=110.202 #59 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=113.601 W2 Lizardo → Falie HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=113.601 #61 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=117.199 W2 Lizardo → Falie HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=117.199 #62 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=123.268 W2 Lizardo → Falie HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=123.268 #65 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=123.334 W2 Lizardo → Falie HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=123.334 #66 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=127 W2 Lizardo → Falie HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=127 #68 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=142.87 W2 Lizardo → Falie HIT physical HP 77→76 applied=1 raw=? cap=?
MODEL t=142.87 #77 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=146.531 W2 Lizardo → Falie HIT physical HP 76→75 applied=1 raw=? cap=?
MODEL t=146.531 #78 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 76 ✓
OBS t=153.735 W2 High Gobloc → Falie HIT physical HP 75→74 applied=1 raw=? cap=?
MODEL t=153.735 #82 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 75 ✓
OBS t=153.878 W2 High Gobloc → Falie HIT physical HP 74→73 applied=1 raw=? cap=?
MODEL t=153.878 #84 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 74 ✓
OBS t=157.537 W2 High Gobloc → Falie HIT physical HP 73→72 applied=1 raw=? cap=?
MODEL t=157.537 #85 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 73 ✓
OBS t≈164.122 (poll) WAVE_CLEAR stage 1-1 next W3 clears=2
OBS t=160.065 W2 wave-clear respite → Falie HEAL ordinary_wave_clear HP 72→85 applied=13
MODEL t=160.065 #87 wave heal predicted 13 ✓ (A3)
OBS t=160.065 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 67→70 applied=3
MODEL t=160.065 #88 wave heal predicted 3 ✓ (A3)
OBS t=163.808 W3 Lizardo → Falie HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=163.808 #89 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=167.388 W3 Lizardo → Falie HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=167.388 #91 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=168.522 W3 Lizardo → Falie HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=168.522 #93 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=174.123 W3 Lizardo → Falie HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=174.123 #97 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=174.189 W3 Orc → Falie HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=174.189 #98 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=177.189 W3 Lizardo → Falie HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=177.189 #100 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=177.79 W3 Orc → Falie HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=177.79 #101 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=181.523 W3 Lizardo → Falie HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=181.523 #103 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=193.719 W3 Lizardo → Falie HIT physical HP 77→76 applied=1 raw=? cap=?
MODEL t=193.719 #107 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=193.719 W3 Lizardo → Falie HIT physical HP 76→75 applied=1 raw=? cap=?
MODEL t=193.719 #108 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 76 ✓
OBS t=197.323 W3 Lizardo → Falie HIT physical HP 75→74 applied=1 raw=? cap=?
MODEL t=197.323 #109 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 75 ✓
OBS t=197.323 W3 Lizardo → Falie HIT physical HP 74→73 applied=1 raw=? cap=?
MODEL t=197.323 #110 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 74 ✓
OBS t=200.988 W3 Lizardo → Falie HIT physical HP 73→72 applied=1 raw=? cap=?
MODEL t=200.988 #112 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 73 ✓
OBS t=208.055 W3 Orc → Falie HIT physical HP 72→71 applied=1 raw=? cap=?
MODEL t=208.055 #114 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 72 ✓
OBS t=209.056 W3 High Gobloc → Falie HIT physical HP 71→70 applied=1 raw=? cap=?
MODEL t=209.056 #115 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 71 ✓
OBS t=210.786 W3 High Gobloc → Falie HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=210.786 #117 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=210.786 W3 Orc → Falie HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=210.786 #118 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=212.723 W3 High Gobloc → Falie HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=212.723 #119 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=214.386 W3 High Gobloc → Falie HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=214.386 #120 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=214.386 W3 Orc → Falie HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=214.386 #121 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=217.989 W3 High Gobloc → Falie HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=217.989 #123 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=217.989 W3 Orc → Falie HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=217.989 #124 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=233.456 W3 Lizardo → Falie HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=233.456 #130 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=234.255 W3 Lizardo → Falie HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=234.255 #132 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=234.722 W3 Lizardo → Falie HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=234.722 #133 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=237.854 W3 Lizardo → Falie HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=237.854 #134 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=241.52 W3 Lizardo → Falie HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=241.52 #136 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=249.385 W3 Lizardo → Falie HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=249.385 #140 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=249.385 W3 Orc → Falie HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=249.385 #141 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=252.118 W3 Orc → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=252.118 #142 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=252.988 W3 Orc → Falie HIT physical HP 56→55 applied=1 raw=? cap=?
MODEL t=252.988 #143 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 56 ✓
OBS t=258.852 W3 Orc → Falie HIT physical HP 55→54 applied=1 raw=? cap=?
MODEL t=258.852 #146 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 55 ✓
OBS t=259.186 W3 Lizardo → Falie HIT physical HP 54→53 applied=1 raw=? cap=?
MODEL t=259.186 #147 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 54 ✓
OBS t=262.854 W3 Lizardo → Falie HIT physical HP 53→52 applied=1 raw=? cap=?
MODEL t=262.854 #149 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 53 ✓
OBS t≈264.126 (poll) WAVE_CLEAR stage 1-1 next W4 clears=3
OBS t=263.985 W3 wave-clear respite → Falie HEAL ordinary_wave_clear HP 52→65 applied=13
MODEL t=263.985 #151 wave heal predicted 13 ✓ (A3)
OBS t=263.985 W3 wave-clear respite → Huun HEAL ordinary_wave_clear HP 69→70 applied=1
MODEL t=263.985 #152 wave heal predicted 1 ✓ (A3)
OBS t=265.117 W4 Gobloc → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=265.117 #153 cap≤1 (fodder tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=268.388 W4 Orc → Falie HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=268.388 #155 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=268.653 W4 Orc → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=268.653 #157 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=272.05 W4 Orc → Falie HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=272.05 #158 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=272.253 W4 Orc → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=272.253 #159 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=275.652 W4 Orc → Falie HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=275.652 #160 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=275.915 W4 Orc → Falie HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=275.915 #161 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=277.986 W4 Orc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=277.986 #162 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=278.05 W4 Orc → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=278.05 #163 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=279.318 W4 Orc → Falie HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=279.318 #165 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=279.514 W4 Orc → Falie HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=279.514 #166 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=281.648 W4 Orc → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=281.648 #167 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=282.58 W4 Orc → Runa HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=282.58 #168 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=282.981 W4 Orc → Falie HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=282.981 #169 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=283.182 W4 Orc → Falie HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=283.182 #170 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=286.65 W4 Orc → Falie HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=286.65 #172 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=286.85 W4 Orc → Falie HIT physical HP 56→55 applied=1 raw=? cap=?
MODEL t=286.85 #173 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 56 ✓
OBS t=287.917 W4 Orc → Runa HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=287.917 #174 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=290.314 W4 Orc → Falie HIT physical HP 55→54 applied=1 raw=? cap=?
MODEL t=290.314 #175 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 55 ✓
OBS t=290.514 W4 Orc → Falie HIT physical HP 54→53 applied=1 raw=? cap=?
MODEL t=290.514 #176 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 54 ✓
OBS t=291.582 W4 Orc → Runa HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=291.582 #177 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=293.984 W4 Orc → Falie HIT physical HP 53→52 applied=1 raw=? cap=?
MODEL t=293.984 #178 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 53 ✓
OBS t=294.113 W4 Orc → Falie HIT physical HP 52→51 applied=1 raw=? cap=?
MODEL t=294.113 #179 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 52 ✓
OBS t=295.714 W4 Orc → Runa HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=295.714 #180 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=295.781 W4 Orc → Runa HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=295.781 #181 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=297.58 W4 Orc → Falie HIT physical HP 51→50 applied=1 raw=? cap=?
MODEL t=297.58 #182 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 51 ✓
OBS t=297.718 W4 Orc → Falie HIT physical HP 50→49 applied=1 raw=? cap=?
MODEL t=297.718 #183 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 50 ✓
OBS t=299.317 W4 Orc → Runa HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=299.317 #184 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=299.449 W4 Orc → Runa HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=299.449 #185 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=301.248 W4 Orc → Falie HIT physical HP 49→48 applied=1 raw=? cap=?
MODEL t=301.248 #186 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 49 ✓
OBS t=301.38 W4 Orc → Falie HIT physical HP 48→47 applied=1 raw=? cap=?
MODEL t=301.38 #187 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 48 ✓
OBS t=304.58 W4 Orc → Runa HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=304.58 #188 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=304.781 W4 Orc → Runa HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=304.781 #189 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=304.849 W4 Orc → Falie HIT physical HP 47→46 applied=1 raw=? cap=?
MODEL t=304.849 #190 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 47 ✓
OBS t=304.98 W4 Orc → Falie HIT physical HP 46→45 applied=1 raw=? cap=?
MODEL t=304.98 #191 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 46 ✓
OBS t=308.18 W4 Orc → Runa HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=308.18 #192 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=308.384 W4 Orc → Runa HIT physical HP 56→55 applied=1 raw=? cap=?
MODEL t=308.384 #193 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 56 ✓
OBS t=308.447 W4 Orc → Falie HIT physical HP 45→44 applied=1 raw=? cap=?
MODEL t=308.447 #194 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 45 ✓
OBS t=308.651 W4 Orc → Falie HIT physical HP 44→43 applied=1 raw=? cap=?
MODEL t=308.651 #195 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 44 ✓
OBS t=312.117 W4 Orc → Falie HIT physical HP 43→42 applied=1 raw=? cap=?
MODEL t=312.117 #196 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 43 ✓
OBS t=312.313 W4 Orc → Falie HIT physical HP 42→41 applied=1 raw=? cap=?
MODEL t=312.313 #197 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 42 ✓
OBS t=313.58 W4 Orc → Runa HIT physical HP 55→54 applied=1 raw=? cap=?
MODEL t=313.58 #198 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 55 ✓
OBS t=313.85 W4 Orc → Runa HIT physical HP 54→53 applied=1 raw=? cap=?
MODEL t=313.85 #199 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 54 ✓
OBS t=315.783 W4 Orc → Falie HIT physical HP 41→40 applied=1 raw=? cap=?
MODEL t=315.783 #200 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 41 ✓
OBS t=315.916 W4 Orc → Falie HIT physical HP 40→39 applied=1 raw=? cap=?
MODEL t=315.916 #201 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 40 ✓
OBS t=317.18 W4 Orc → Runa HIT physical HP 53→52 applied=1 raw=? cap=?
MODEL t=317.18 #202 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 53 ✓
OBS t=317.514 W4 Orc → Runa HIT physical HP 52→51 applied=1 raw=? cap=?
MODEL t=317.514 #203 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 52 ✓
OBS t=319.45 W4 Orc → Falie HIT physical HP 39→38 applied=1 raw=? cap=?
MODEL t=319.45 #204 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 39 ✓
OBS t=319.579 W4 Orc → Falie HIT physical HP 38→37 applied=1 raw=? cap=?
MODEL t=319.579 #205 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 38 ✓
OBS t=322.783 W4 Orc → Runa HIT physical HP 51→50 applied=1 raw=? cap=?
MODEL t=322.783 #206 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 51 ✓
OBS t=322.913 W4 Orc → Runa HIT physical HP 50→49 applied=1 raw=? cap=?
MODEL t=322.913 #207 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 50 ✓
OBS t=323.116 W4 Orc → Falie HIT physical HP 37→36 applied=1 raw=? cap=?
MODEL t=323.116 #208 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 37 ✓
OBS t=323.183 W4 Orc → Falie HIT physical HP 36→35 applied=1 raw=? cap=?
MODEL t=323.183 #209 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 36 ✓
OBS t=326.449 W4 Orc → Runa HIT physical HP 49→48 applied=1 raw=? cap=?
MODEL t=326.449 #210 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 49 ✓
OBS t=326.579 W4 Orc → Runa HIT physical HP 48→47 applied=1 raw=? cap=?
MODEL t=326.579 #211 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 48 ✓
OBS t=326.783 W4 Orc → Falie HIT physical HP 35→34 applied=1 raw=? cap=?
MODEL t=326.783 #212 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 35 ✓
OBS t=326.849 W4 Orc → Falie HIT physical HP 34→33 applied=1 raw=? cap=?
MODEL t=326.849 #213 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 34 ✓
OBS t=330.446 W4 Orc → Falie HIT physical HP 33→32 applied=1 raw=? cap=?
MODEL t=330.446 #214 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 33 ✓
OBS t=330.512 W4 Orc → Falie HIT physical HP 32→31 applied=1 raw=? cap=?
MODEL t=330.512 #215 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 32 ✓
OBS t=331.845 W4 Orc → Runa HIT physical HP 47→46 applied=1 raw=? cap=?
MODEL t=331.845 #216 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 47 ✓
OBS t=331.98 W4 Orc → Runa HIT physical HP 46→45 applied=1 raw=? cap=?
MODEL t=331.98 #217 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 46 ✓
OBS t=334.116 W4 Orc → Falie HIT physical HP 31→30 applied=1 raw=? cap=?
MODEL t=334.116 #218 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 31 ✓
OBS t=334.116 W4 Orc → Falie HIT physical HP 30→29 applied=1 raw=? cap=?
MODEL t=334.116 #219 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 30 ✓
OBS t=335.448 W4 Orc → Runa HIT physical HP 45→44 applied=1 raw=? cap=?
MODEL t=335.448 #220 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 45 ✓
OBS t=335.578 W4 Orc → Runa HIT physical HP 44→43 applied=1 raw=? cap=?
MODEL t=335.578 #221 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 44 ✓
OBS t=337.783 W4 Orc → Falie HIT physical HP 29→28 applied=1 raw=? cap=?
MODEL t=337.783 #225 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 29 ✓
OBS t=337.783 W4 Orc → Falie HIT physical HP 28→27 applied=1 raw=? cap=?
MODEL t=337.783 #226 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 28 ✓
OBS t=341.446 W4 Orc → Falie HIT physical HP 27→26 applied=1 raw=? cap=?
MODEL t=341.446 #227 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 27 ✓
OBS t=341.446 W4 Orc → Falie HIT physical HP 26→25 applied=1 raw=? cap=?
MODEL t=341.446 #228 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 26 ✓
OBS t=345.112 W4 Orc → Falie HIT physical HP 25→24 applied=1 raw=? cap=?
MODEL t=345.112 #229 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 25 ✓
OBS t=345.112 W4 Orc → Falie HIT physical HP 24→23 applied=1 raw=? cap=?
MODEL t=345.112 #230 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 24 ✓
OBS t=348.845 W4 Orc → Falie HIT physical HP 23→22 applied=1 raw=? cap=?
MODEL t=348.845 #231 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 23 ✓
OBS t=348.845 W4 Orc → Falie HIT physical HP 22→21 applied=1 raw=? cap=?
MODEL t=348.845 #232 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 22 ✓
OBS t=352.511 W4 Orc → Falie HIT physical HP 21→20 applied=1 raw=? cap=?
MODEL t=352.511 #233 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 21 ✓
OBS t=352.511 W4 Orc → Falie HIT physical HP 20→19 applied=1 raw=? cap=?
MODEL t=352.511 #234 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 20 ✓
OBS t=356.115 W4 Orc → Falie HIT physical HP 19→18 applied=1 raw=? cap=?
MODEL t=356.115 #235 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 19 ✓
OBS t=358.779 W4 Orc → Falie HIT physical HP 18→17 applied=1 raw=? cap=?
MODEL t=358.779 #237 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 18 ✓
OBS t=371.979 W4 Orc → Falie HIT physical HP 17→16 applied=1 raw=? cap=?
MODEL t=371.979 #243 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 17 ✓
OBS t=373.178 W4 Orc → Falie HIT physical HP 16→15 applied=1 raw=? cap=?
MODEL t=373.178 #245 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 16 ✓
OBS t=381.178 W4 Orc → Falie HIT physical HP 15→14 applied=1 raw=? cap=?
MODEL t=381.178 #249 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 15 ✓
OBS t=381.847 W4 Orc → Huun HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=381.847 #250 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=382.913 W4 Orc → Falie HIT physical HP 14→13 applied=1 raw=? cap=?
MODEL t=382.913 #252 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 14 ✓
OBS t=382.913 W4 Orc → Falie HIT physical HP 13→12 applied=1 raw=? cap=?
MODEL t=382.913 #253 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 13 ✓
OBS t=385.514 W4 Orc → Huun HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=385.514 #254 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=386.512 W4 Orc → Falie HIT physical HP 12→11 applied=1 raw=? cap=?
MODEL t=386.512 #255 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 12 ✓
OBS t=386.512 W4 Orc → Falie HIT physical HP 11→10 applied=1 raw=? cap=?
MODEL t=386.512 #256 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 11 ✓
OBS t=390.177 W4 Orc → Falie HIT physical HP 10→9 applied=1 raw=? cap=?
MODEL t=390.177 #258 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 10 ✓
OBS t=390.38 W4 Orc → Huun HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=390.38 #259 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=393.846 W4 Orc → Falie HIT physical HP 9→8 applied=1 raw=? cap=?
MODEL t=393.846 #260 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 9 ✓
OBS t=393.979 W4 Orc → Huun HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=393.979 #261 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=409.776 W4 Lizardo → Falie HIT physical HP 8→7 applied=1 raw=? cap=?
MODEL t=409.776 #267 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 8 ✓
OBS t=409.846 W4 Orc → Falie HIT physical HP 7→6 applied=1 raw=? cap=?
MODEL t=409.846 #268 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 7 ✓
OBS t=411.85 W4 Orc → Huun HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=411.85 #271 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=412.176 W4 Orc → Falie HIT physical HP 6→5 applied=1 raw=? cap=?
MODEL t=412.176 #272 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 6 ✓
OBS t=415.776 W4 Orc → Falie HIT physical HP 5→4 applied=1 raw=? cap=?
MODEL t=415.776 #274 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 5 ✓
OBS t=419.448 W4 Orc → Falie HIT physical HP 4→3 applied=1 raw=? cap=?
MODEL t=419.448 #275 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 4 ✓
OBS t=427.043 W4 Orc → Falie HIT physical HP 3→2 applied=1 raw=? cap=?
MODEL t=427.043 #278 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 3 ✓
OBS t=427.18 W4 Lizardo → Falie HIT physical HP 2→1 applied=1 raw=? cap=?
MODEL t=427.18 #280 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 2 ✓
OBS t=427.312 W4 Orc → Huun HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=427.312 #281 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t≈430.912 (poll) RECOVERY_TRANSITION observed stage 1-1 W4 → 1-1 W1
OBS t=430.78 W4 Lizardo → Falie HIT physical HP 1→0 applied=1 raw=? cap=?
MODEL t=430.78 #282 cap≤1 (routine tier, maxHP 85; A1/A2) at bound or HP floor; HP before predicted 1 ✓
OBS t=430.78 W4 Falie KO (event #282)
OBS t=430.78 Falie RECOVER continuous_defeat #1 HP 0→85
MODEL t=430.78 #283 recovery predicted full 85 ✓ (A4)
OBS t=430.78 Huun RECOVER continuous_defeat #1 HP 61→70
MODEL t=430.78 #284 recovery predicted full 70 ✓ (A4)
OBS t=430.78 Runa RECOVER continuous_defeat #1 HP 43→69
MODEL t=430.78 #285 recovery predicted full 69 ✓ (A4)
OBS t=440.484 W1 Gobloc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=440.484 #289 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=444.153 W1 Gobloc → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=444.153 #291 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=447.684 W1 Gobloc → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=447.684 #293 cap≤1 (fodder tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t≈514.218 (poll) WAVE_CLEAR stage 1-1 next W2 clears=4
OBS t=514.085 W1 wave-clear respite → Huun HEAL ordinary_wave_clear HP 69→70 applied=1
MODEL t=514.085 #327 wave heal predicted 1 ✓ (A3)
OBS t=514.085 W1 wave-clear respite → Runa HEAL ordinary_wave_clear HP 67→69 applied=2
MODEL t=514.085 #328 wave heal predicted 2 ✓ (A3)
OBS t=517.683 W2 Lizardo → Falie HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=517.683 #330 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=517.683 W2 Lizardo → Falie HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=517.683 #331 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=517.819 W2 Lizardo → Falie HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=517.819 #332 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=517.884 W2 Lizardo → Falie HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=517.884 #333 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=521.348 W2 Lizardo → Falie HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=521.348 #334 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=521.348 W2 Lizardo → Falie HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=521.348 #335 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=521.483 W2 Lizardo → Falie HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=521.483 #336 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=521.548 W2 Lizardo → Falie HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=521.548 #337 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=523.747 W2 Gobloc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=523.747 #339 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=525.017 W2 Lizardo → Falie HIT physical HP 77→76 applied=1 raw=? cap=?
MODEL t=525.017 #342 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=525.147 W2 Lizardo → Falie HIT physical HP 76→75 applied=1 raw=? cap=?
MODEL t=525.147 #343 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 76 ✓
OBS t=525.216 W2 Lizardo → Falie HIT physical HP 75→74 applied=1 raw=? cap=?
MODEL t=525.216 #344 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 75 ✓
OBS t=527.348 W2 Skeleton → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=527.348 #345 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=527.348 W2 Gobloc → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=527.348 #346 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=528.217 W2 Gobloc → Runa HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=528.217 #347 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=528.684 W2 Lizardo → Falie HIT physical HP 74→73 applied=1 raw=? cap=?
MODEL t=528.684 #348 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 74 ✓
OBS t=528.748 W2 Lizardo → Falie HIT physical HP 73→72 applied=1 raw=? cap=?
MODEL t=528.748 #349 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 73 ✓
OBS t=528.817 W2 Lizardo → Falie HIT physical HP 72→71 applied=1 raw=? cap=?
MODEL t=528.817 #350 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 72 ✓
OBS t=531.017 W2 Gobloc → Runa HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=531.017 #352 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=532.282 W2 Lizardo → Falie HIT physical HP 71→70 applied=1 raw=? cap=?
MODEL t=532.282 #354 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 71 ✓
OBS t=532.348 W2 Lizardo → Falie HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=532.348 #355 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=535.948 W2 Lizardo → Falie HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=535.948 #359 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=537.552 W2 Gobloc → Runa HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=537.552 #360 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=537.552 W2 Gobloc → Runa HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=537.552 #361 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=551.282 W2 Lizardo → Falie HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=551.282 #368 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=565.082 W2 High Gobloc → Falie HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=565.082 #373 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=568.683 W2 High Gobloc → Falie HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=568.683 #374 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=582.08 W2 Lizardo → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=582.08 #382 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=593.414 W2 Lizardo → Falie HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=593.414 #387 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=594.08 W2 Lizardo → Falie HIT physical HP 64→63 applied=1 raw=? cap=?
```

## gear-def10 session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/gear-def10/observed_events.ndjson (SHA-256 d2895bfa26285b095e3da355b63f18a62c161110d5186320f5625d05577b37ee). Enemy KOs omitted: 664. Lines 400/446 (truncated; rerun with --fullTimelines).

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L1 85/85, Huun L1 60/70, Runa L1 69/69 autoEquip=false bossPolicy=hold
OBS t≈77 (poll) WAVE_CLEAR stage 1-1 next W2 clears=1
OBS t=77 W1 wave-clear respite → Huun HEAL ordinary_wave_clear HP 60→70 applied=10
MODEL t=77 #35 wave heal predicted 10 ✓ (A3)
OBS t=90.541 W2 Lizardo → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=90.541 #42 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=94.2 W2 Lizardo → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=94.2 #44 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=126.73 W2 Lizardo → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=126.73 #57 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=130.401 W2 Lizardo → Huun HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=130.401 #59 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=154.595 W2 Lizardo → Huun HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=154.595 #69 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=158.264 W2 Lizardo → Huun HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=158.264 #71 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t≈160.464 (poll) WAVE_CLEAR stage 1-1 next W3 clears=2
OBS t=160.464 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 64→70 applied=6
MODEL t=160.464 #73 wave heal predicted 6 ✓ (A3)
OBS t=163.665 W3 Lizardo → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=163.665 #75 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=174.329 W3 Orc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=174.329 #79 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=174.927 W3 Lizardo → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=174.927 #80 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=177.926 W3 Orc → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=177.926 #82 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=178.796 W3 Orc → Runa HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=178.796 #83 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=181.597 W3 Orc → Runa HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=181.597 #84 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=185.73 W3 Lizardo → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=185.73 #86 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=202.66 W3 Lizardo → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=202.66 #95 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t≈257.06 (poll) WAVE_CLEAR stage 1-1 next W4 clears=3
OBS t=257.06 W3 wave-clear respite → Huun HEAL ordinary_wave_clear HP 67→70 applied=3
MODEL t=257.06 #110 wave heal predicted 3 ✓ (A3)
OBS t=257.06 W3 wave-clear respite → Runa HEAL ordinary_wave_clear HP 64→69 applied=5
MODEL t=257.06 #111 wave heal predicted 5 ✓ (A3)
OBS t=270.791 W4 Orc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=270.791 #113 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=270.791 W4 Orc → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=270.791 #114 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=274.46 W4 Orc → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=274.46 #116 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=274.46 W4 Orc → Runa HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=274.46 #117 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=278.527 W4 Orc → Runa HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=278.527 #121 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=278.527 W4 Orc → Runa HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=278.527 #122 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=282.194 W4 Orc → Runa HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=282.194 #124 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=283.789 W4 Lizardo → Runa HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=283.789 #125 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=284.06 W4 Lizardo → Runa HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=284.06 #126 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=288.657 W4 Lizardo → Runa HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=288.657 #129 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=289.122 W4 Orc → Runa HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=289.122 #130 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=292.26 W4 Lizardo → Runa HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=292.26 #132 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=334.654 W4 Orc → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=334.654 #145 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=336.062 W4 Orc → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=336.062 #146 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=338.258 W4 Orc → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=338.258 #148 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=342.324 W4 Orc → Huun HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=342.324 #149 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=345.992 W4 Orc → Huun HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=345.992 #151 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=349.656 W4 Orc → Huun HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=349.656 #152 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=353.254 W4 Orc → Huun HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=353.254 #153 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=356.923 W4 Orc → Huun HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=356.923 #154 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=360.588 W4 Orc → Huun HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=360.588 #155 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=364.189 W4 Orc → Huun HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=364.189 #156 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=367.856 W4 Orc → Huun HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=367.856 #157 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=371.453 W4 Orc → Huun HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=371.453 #158 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=375.196 W4 Orc → Huun HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=375.196 #159 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=378.76 W4 Orc → Huun HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=378.76 #160 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=382.425 W4 Orc → Huun HIT physical HP 56→55 applied=1 raw=? cap=?
MODEL t=382.425 #161 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 56 ✓
OBS t=386.024 W4 Orc → Huun HIT physical HP 55→54 applied=1 raw=? cap=?
MODEL t=386.024 #162 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 55 ✓
OBS t=389.692 W4 Orc → Huun HIT physical HP 54→53 applied=1 raw=? cap=?
MODEL t=389.692 #163 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 54 ✓
OBS t=393.291 W4 Orc → Huun HIT physical HP 53→52 applied=1 raw=? cap=?
MODEL t=393.291 #164 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 53 ✓
OBS t=396.956 W4 Orc → Huun HIT physical HP 52→51 applied=1 raw=? cap=?
MODEL t=396.956 #165 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 52 ✓
OBS t=400.624 W4 Orc → Huun HIT physical HP 51→50 applied=1 raw=? cap=?
MODEL t=400.624 #166 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 51 ✓
OBS t=404.292 W4 Orc → Huun HIT physical HP 50→49 applied=1 raw=? cap=?
MODEL t=404.292 #167 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 50 ✓
OBS t=407.957 W4 Orc → Huun HIT physical HP 49→48 applied=1 raw=? cap=?
MODEL t=407.957 #168 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 49 ✓
OBS t=411.625 W4 Orc → Huun HIT physical HP 48→47 applied=1 raw=? cap=?
MODEL t=411.625 #169 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 48 ✓
OBS t=415.225 W4 Orc → Huun HIT physical HP 47→46 applied=1 raw=? cap=?
MODEL t=415.225 #170 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 47 ✓
OBS t=418.89 W4 Orc → Huun HIT physical HP 46→45 applied=1 raw=? cap=?
MODEL t=418.89 #171 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 46 ✓
OBS t=422.492 W4 Orc → Huun HIT physical HP 45→44 applied=1 raw=? cap=?
MODEL t=422.492 #172 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 45 ✓
OBS t=426.106 W4 Orc → Huun HIT physical HP 44→43 applied=1 raw=? cap=?
MODEL t=426.106 #173 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 44 ✓
OBS t=429.755 W4 Orc → Huun HIT physical HP 43→42 applied=1 raw=? cap=?
MODEL t=429.755 #174 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 43 ✓
OBS t=433.42 W4 Orc → Huun HIT physical HP 42→41 applied=1 raw=? cap=?
MODEL t=433.42 #175 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 42 ✓
OBS t=437.031 W4 Orc → Huun HIT physical HP 41→40 applied=1 raw=? cap=?
MODEL t=437.031 #176 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 41 ✓
OBS t=440.694 W4 Orc → Huun HIT physical HP 40→39 applied=1 raw=? cap=?
MODEL t=440.694 #177 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 40 ✓
OBS t=444.352 W4 Orc → Huun HIT physical HP 39→38 applied=1 raw=? cap=?
MODEL t=444.352 #178 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 39 ✓
OBS t=448.02 W4 Orc → Huun HIT physical HP 38→37 applied=1 raw=? cap=?
MODEL t=448.02 #179 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 38 ✓
OBS t=451.619 W4 Orc → Huun HIT physical HP 37→36 applied=1 raw=? cap=?
MODEL t=451.619 #180 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 37 ✓
OBS t=455.172 W4 Orc → Huun HIT physical HP 36→35 applied=1 raw=? cap=?
MODEL t=455.172 #181 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 36 ✓
OBS t=458.89 W4 Orc → Huun HIT physical HP 35→34 applied=1 raw=? cap=?
MODEL t=458.89 #182 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 35 ✓
OBS t=462.489 W4 Orc → Huun HIT physical HP 34→33 applied=1 raw=? cap=?
MODEL t=462.489 #183 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 34 ✓
OBS t=466.154 W4 Orc → Huun HIT physical HP 33→32 applied=1 raw=? cap=?
MODEL t=466.154 #184 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 33 ✓
OBS t=469.815 W4 Orc → Huun HIT physical HP 32→31 applied=1 raw=? cap=?
MODEL t=469.815 #185 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 32 ✓
OBS t=473.419 W4 Orc → Huun HIT physical HP 31→30 applied=1 raw=? cap=?
MODEL t=473.419 #186 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 31 ✓
OBS t=477.088 W4 Orc → Huun HIT physical HP 30→29 applied=1 raw=? cap=?
MODEL t=477.088 #187 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 30 ✓
OBS t=480.688 W4 Orc → Huun HIT physical HP 29→28 applied=1 raw=? cap=?
MODEL t=480.688 #188 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 29 ✓
OBS t=484.285 W4 Orc → Huun HIT physical HP 28→27 applied=1 raw=? cap=?
MODEL t=484.285 #189 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 28 ✓
OBS t=487.952 W4 Orc → Huun HIT physical HP 27→26 applied=1 raw=? cap=?
MODEL t=487.952 #190 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 27 ✓
OBS t=491.549 W4 Orc → Huun HIT physical HP 26→25 applied=1 raw=? cap=?
MODEL t=491.549 #191 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 26 ✓
OBS t=495.15 W4 Orc → Huun HIT physical HP 25→24 applied=1 raw=? cap=?
MODEL t=495.15 #192 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 25 ✓
OBS t=498.752 W4 Orc → Huun HIT physical HP 24→23 applied=1 raw=? cap=?
MODEL t=498.752 #193 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 24 ✓
OBS t=502.418 W4 Orc → Huun HIT physical HP 23→22 applied=1 raw=? cap=?
MODEL t=502.418 #194 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 23 ✓
OBS t=506.081 W4 Orc → Huun HIT physical HP 22→21 applied=1 raw=? cap=?
MODEL t=506.081 #195 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 22 ✓
OBS t=509.683 W4 Orc → Huun HIT physical HP 21→20 applied=1 raw=? cap=?
MODEL t=509.683 #196 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 21 ✓
OBS t=513.349 W4 Orc → Huun HIT physical HP 20→19 applied=1 raw=? cap=?
MODEL t=513.349 #197 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 20 ✓
OBS t=517.016 W4 Orc → Huun HIT physical HP 19→18 applied=1 raw=? cap=?
MODEL t=517.016 #198 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 19 ✓
OBS t=520.615 W4 Orc → Huun HIT physical HP 18→17 applied=1 raw=? cap=?
MODEL t=520.615 #199 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 18 ✓
OBS t=524.282 W4 Orc → Huun HIT physical HP 17→16 applied=1 raw=? cap=?
MODEL t=524.282 #200 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 17 ✓
OBS t=527.951 W4 Orc → Huun HIT physical HP 16→15 applied=1 raw=? cap=?
MODEL t=527.951 #201 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 16 ✓
OBS t=531.616 W4 Orc → Huun HIT physical HP 15→14 applied=1 raw=? cap=?
MODEL t=531.616 #202 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 15 ✓
OBS t=535.216 W4 Orc → Huun HIT physical HP 14→13 applied=1 raw=? cap=?
MODEL t=535.216 #203 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 14 ✓
OBS t=538.816 W4 Orc → Huun HIT physical HP 13→12 applied=1 raw=? cap=?
MODEL t=538.816 #204 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 13 ✓
OBS t=542.486 W4 Orc → Huun HIT physical HP 12→11 applied=1 raw=? cap=?
MODEL t=542.486 #205 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 12 ✓
OBS t=546.082 W4 Orc → Huun HIT physical HP 11→10 applied=1 raw=? cap=?
MODEL t=546.082 #206 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 11 ✓
OBS t=549.684 W4 Orc → Huun HIT physical HP 10→9 applied=1 raw=? cap=?
MODEL t=549.684 #207 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 10 ✓
OBS t=553.354 W4 Orc → Huun HIT physical HP 9→8 applied=1 raw=? cap=?
MODEL t=553.354 #208 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 9 ✓
OBS t=556.972 W4 Orc → Huun HIT physical HP 8→7 applied=1 raw=? cap=?
MODEL t=556.972 #209 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 8 ✓
OBS t=560.689 W4 Orc → Huun HIT physical HP 7→6 applied=1 raw=? cap=?
MODEL t=560.689 #210 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 7 ✓
OBS t=564.282 W4 Orc → Huun HIT physical HP 6→5 applied=1 raw=? cap=?
MODEL t=564.282 #211 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 6 ✓
OBS t=567.952 W4 Orc → Huun HIT physical HP 5→4 applied=1 raw=? cap=?
MODEL t=567.952 #212 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 5 ✓
OBS t=571.614 W4 Orc → Huun HIT physical HP 4→3 applied=1 raw=? cap=?
MODEL t=571.614 #213 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 4 ✓
OBS t=575.216 W4 Orc → Huun HIT physical HP 3→2 applied=1 raw=? cap=?
MODEL t=575.216 #214 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 3 ✓
OBS t=578.891 W4 Orc → Huun HIT physical HP 2→1 applied=1 raw=? cap=?
MODEL t=578.891 #215 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 2 ✓
OBS t≈582.8 (poll) RECOVERY_TRANSITION observed stage 1-1 W4 → 1-1 W1
OBS t=582.48 W4 Orc → Huun HIT physical HP 1→0 applied=1 raw=? cap=?
MODEL t=582.48 #216 cap≤1 (routine tier, maxHP 70; A1/A2) at bound or HP floor; HP before predicted 1 ✓
OBS t=582.48 W4 Huun KO (event #216)
OBS t=582.48 Falie RECOVER continuous_defeat #1 HP 85→85
MODEL t=582.48 #217 recovery predicted full 85 ✓ (A4)
OBS t=582.48 Huun RECOVER continuous_defeat #1 HP 0→70
MODEL t=582.48 #218 recovery predicted full 70 ✓ (A4)
OBS t=582.48 Runa RECOVER continuous_defeat #1 HP 57→69
MODEL t=582.48 #219 recovery predicted full 69 ✓ (A4)
OBS t≈665.264 (poll) WAVE_CLEAR stage 1-1 next W2 clears=4
OBS t=669.596 W2 Lizardo → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=669.596 #259 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=675.397 W2 Lizardo → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=675.397 #261 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=675.662 W2 Lizardo → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=675.662 #262 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=678.746 W2 Lizardo → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=678.746 #264 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=679.013 W2 Lizardo → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=679.013 #265 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=682.612 W2 Lizardo → Runa HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=682.612 #270 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=686.216 W2 Lizardo → Runa HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=686.216 #273 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t≈751.846 (poll) WAVE_CLEAR stage 1-1 next W3 clears=5
OBS t=750.478 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 68→70 applied=2
MODEL t=750.478 #297 wave heal predicted 2 ✓ (A3)
OBS t=750.478 W2 wave-clear respite → Runa HEAL ordinary_wave_clear HP 64→69 applied=5
MODEL t=750.478 #298 wave heal predicted 5 ✓ (A3)
OBS t=754.323 W3 Lizardo → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=754.323 #300 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=758.066 W3 Lizardo → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=758.066 #302 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=761.656 W3 Lizardo → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=761.656 #304 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=764.123 W3 High Gobloc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=764.123 #305 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=764.927 W3 Lizardo → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=764.927 #306 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=765.326 W3 Lizardo → Huun HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=765.326 #307 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=767.792 W3 High Gobloc → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=767.792 #309 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=768.459 W3 Lizardo → Runa HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=768.459 #310 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=772.13 W3 High Gobloc → Runa HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=772.13 #312 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=772.188 W3 Lizardo → Runa HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=772.188 #313 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=775.192 W3 High Gobloc → Runa HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=775.192 #316 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=791.058 W3 Lizardo → Huun HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=791.058 #324 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=811.389 W3 Lizardo → Huun HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=811.389 #329 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t≈866.908 (poll) WAVE_CLEAR stage 1-1 next W4 clears=6
OBS t=866.908 W3 wave-clear respite → Huun HEAL ordinary_wave_clear HP 64→70 applied=6
MODEL t=866.908 #347 wave heal predicted 6 ✓ (A3)
OBS t=866.908 W3 wave-clear respite → Runa HEAL ordinary_wave_clear HP 62→69 applied=7
MODEL t=866.908 #348 wave heal predicted 7 ✓ (A3)
OBS t=882.435 W4 Orc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=882.435 #353 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=885.106 W4 Lizardo → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=885.106 #354 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=889.168 W4 Lizardo → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=889.168 #356 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=919.504 W4 Lizardo → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=919.504 #369 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t≈961.967 (poll) WAVE_CLEAR stage 1-1 next W1 clears=7
OBS t=961.967 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 69→70 applied=1
MODEL t=961.967 #382 wave heal predicted 1 ✓ (A3)
OBS t=961.967 W4 wave-clear respite → Runa HEAL ordinary_wave_clear HP 66→69 applied=3
MODEL t=961.967 #383 wave heal predicted 3 ✓ (A3)
OBS t≈1038.578 (poll) WAVE_CLEAR stage 1-1 next W2 clears=8
OBS t=1052.364 W2 Lizardo → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=1052.364 #429 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=1056.028 W2 Lizardo → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=1056.028 #431 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=1060.896 W2 Lizardo → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=1060.896 #434 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t≈1128.6 (poll) WAVE_CLEAR stage 1-1 next W3 clears=9
OBS t=1128.6 W2 wave-clear respite → Runa HEAL ordinary_wave_clear HP 66→69 applied=3
MODEL t=1128.6 #457 wave heal predicted 3 ✓ (A3)
OBS t=1132.464 W3 Lizardo → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=1132.464 #459 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=1136.064 W3 Lizardo → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=1136.064 #460 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=1139.734 W3 Lizardo → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=1139.734 #462 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=1141.932 W3 Orc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=1141.932 #463 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=1142.465 W3 High Gobloc → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=1142.465 #464 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=1143.399 W3 Lizardo → Huun HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=1143.399 #465 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=1146.023 W3 High Gobloc → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=1146.023 #467 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=1147.004 W3 Lizardo → Huun HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=1147.004 #468 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=1150.664 W3 Lizardo → Huun HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=1150.664 #470 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=1152.931 W3 Orc → Runa HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=1152.931 #471 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=1154.264 W3 Lizardo → Huun HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=1154.264 #472 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=1157.864 W3 Lizardo → Huun HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=1157.864 #474 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=1159.594 W3 High Gobloc → Runa HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=1159.594 #475 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=1160.466 W3 Orc → Runa HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=1160.466 #476 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=1161.464 W3 Lizardo → Huun HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=1161.464 #477 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=1163.264 W3 High Gobloc → Runa HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=1163.264 #478 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=1164.064 W3 Orc → Runa HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=1164.064 #479 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=1165.131 W3 Lizardo → Huun HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=1165.131 #480 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=1168.73 W3 Lizardo → Huun HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=1168.73 #482 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=1168.93 W3 Orc → Runa HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=1168.93 #483 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=1172.397 W3 Lizardo → Huun HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=1172.397 #484 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=1172.532 W3 Orc → Runa HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=1172.532 #485 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=1176.067 W3 Lizardo → Huun HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=1176.067 #486 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=1177.665 W3 High Gobloc → Runa HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=1177.665 #487 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=1178.064 W3 Orc → Runa HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=1178.064 #488 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=1179.664 W3 Lizardo → Huun HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=1179.664 #489 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=1181.332 W3 High Gobloc → Runa HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=1181.332 #490 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=1181.73 W3 Orc → Runa HIT physical HP 56→55 applied=1 raw=? cap=?
MODEL t=1181.73 #491 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 56 ✓
OBS t=1183.331 W3 Lizardo → Huun HIT physical HP 56→55 applied=1 raw=? cap=?
MODEL t=1183.331 #492 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 56 ✓
OBS t=1186.996 W3 Orc → Runa HIT physical HP 55→54 applied=1 raw=? cap=?
MODEL t=1186.996 #493 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 55 ✓
OBS t=1186.996 W3 Lizardo → Huun HIT physical HP 55→54 applied=1 raw=? cap=?
MODEL t=1186.996 #494 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 55 ✓
OBS t=1190.598 W3 Orc → Runa HIT physical HP 54→53 applied=1 raw=? cap=?
MODEL t=1190.598 #495 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 54 ✓
OBS t=1190.598 W3 Lizardo → Huun HIT physical HP 54→53 applied=1 raw=? cap=?
MODEL t=1190.598 #496 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 54 ✓
OBS t=1194.261 W3 Lizardo → Huun HIT physical HP 53→52 applied=1 raw=? cap=?
MODEL t=1194.261 #500 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 53 ✓
OBS t=1197.862 W3 Lizardo → Huun HIT physical HP 52→51 applied=1 raw=? cap=?
MODEL t=1197.862 #501 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 52 ✓
OBS t=1201.47 W3 Lizardo → Huun HIT physical HP 51→50 applied=1 raw=? cap=?
MODEL t=1201.47 #502 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 51 ✓
OBS t≈1278.565 (poll) WAVE_CLEAR stage 1-1 next W4 clears=10
OBS t=1278.363 W3 wave-clear respite → Huun HEAL ordinary_wave_clear HP 50→61 applied=11
MODEL t=1278.363 #527 wave heal predicted 11 ✓ (A3)
OBS t=1278.363 W3 wave-clear respite → Runa HEAL ordinary_wave_clear HP 53→64 applied=11
MODEL t=1278.363 #528 wave heal predicted 11 ✓ (A3)
OBS t=1291.996 W4 Orc → Runa HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=1291.996 #532 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=1291.996 W4 Orc → Runa HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=1291.996 #533 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=1295.65 W4 Orc → Runa HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=1295.65 #534 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=1295.65 W4 Orc → Runa HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=1295.65 #535 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=1300.386 W4 Orc → Runa HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=1300.386 #538 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=1304.052 W4 Orc → Runa HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=1304.052 #539 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t≈1391.783 (poll) WAVE_CLEAR stage 1-1 next W1 clears=11
OBS t=1391.783 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 61→70 applied=9
MODEL t=1391.783 #567 wave heal predicted 9 ✓ (A3)
OBS t=1391.783 W4 wave-clear respite → Runa HEAL ordinary_wave_clear HP 58→69 applied=11
MODEL t=1391.783 #568 wave heal predicted 11 ✓ (A3)
OBS t≈1460.847 (poll) WAVE_CLEAR stage 1-1 next W2 clears=12
OBS t=1462.446 W2 Lizardo → Huun HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=1462.446 #606 cap≤1 (routine tier, maxHP 70; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=1471.646 W2 Lizardo → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=1471.646 #610 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=1472.913 W2 High Gobloc → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=1472.913 #612 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=1477.578 W2 Lizardo → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=1477.578 #617 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=1481.11 W2 Lizardo → Runa HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=1481.11 #619 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=1484.861 W2 Lizardo → Runa HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=1484.861 #620 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t≈1553.986 (poll) WAVE_CLEAR stage 1-1 next W3 clears=13
OBS t=1553.855 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 69→70 applied=1
MODEL t=1553.855 #645 wave heal predicted 1 ✓ (A3)
OBS t=1553.855 W2 wave-clear respite → Runa HEAL ordinary_wave_clear HP 64→69 applied=5
MODEL t=1553.855 #646 wave heal predicted 5 ✓ (A3)
OBS t≈1662.283 (poll) WAVE_CLEAR stage 1-1 next W4 clears=14
OBS t=1676.35 W4 Lizardo → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
```

## gear-hp30 session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/gear-hp30/observed_events.ndjson (SHA-256 26be56b7c918ada3a6b289ebfd6fd0c843ddb76ef0a3c2f85a4cf9808c48c3f2). Enemy KOs omitted: 543. Lines 400/1037 (truncated; rerun with --fullTimelines).

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L1 85/115, Huun L1 60/100, Runa L1 69/99 autoEquip=false bossPolicy=hold
OBS t=9.93 W1 Skeleton → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=9.93 #4 cap≤1 (fodder tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=10.531 W1 Skeleton → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=10.531 #5 cap≤1 (fodder tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=10.932 W1 Skeleton → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=10.932 #6 cap≤1 (fodder tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t≈76.331 (poll) WAVE_CLEAR stage 1-1 next W2 clears=1
OBS t=76.331 W1 wave-clear respite → Falie HEAL ordinary_wave_clear HP 85→103 applied=18
MODEL t=76.331 #38 wave heal predicted 18 ✓ (A3)
OBS t=76.331 W1 wave-clear respite → Huun HEAL ordinary_wave_clear HP 60→75 applied=15
MODEL t=76.331 #39 wave heal predicted 15 ✓ (A3)
OBS t=76.331 W1 wave-clear respite → Runa HEAL ordinary_wave_clear HP 66→81 applied=15
MODEL t=76.331 #40 wave heal predicted 15 ✓ (A3)
OBS t=78.798 W2 Lizardo → Falie HIT physical HP 103→101 applied=2 raw=? cap=?
MODEL t=78.798 #41 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 103 ✓
OBS t=78.947 W2 Lizardo → Falie HIT physical HP 101→99 applied=2 raw=? cap=?
MODEL t=78.947 #42 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 101 ✓
OBS t=81.062 W2 Lizardo → Huun HIT physical HP 75→73 applied=2 raw=? cap=?
MODEL t=81.062 #43 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 75 ✓
OBS t=101.995 W2 Lizardo → Falie HIT physical HP 99→97 applied=2 raw=? cap=?
MODEL t=101.995 #57 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=105.996 W2 Lizardo → Falie HIT physical HP 97→95 applied=2 raw=? cap=?
MODEL t=105.996 #60 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=109.662 W2 Lizardo → Falie HIT physical HP 95→93 applied=2 raw=? cap=?
MODEL t=109.662 #61 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=121.463 W2 Lizardo → Falie HIT physical HP 93→91 applied=2 raw=? cap=?
MODEL t=121.463 #66 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 93 ✓
OBS t=123.925 W2 Lizardo → Falie HIT physical HP 91→89 applied=2 raw=? cap=?
MODEL t=123.925 #68 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 91 ✓
OBS t=127.528 W2 Lizardo → Falie HIT physical HP 89→87 applied=2 raw=? cap=?
MODEL t=127.528 #70 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 89 ✓
OBS t=136.926 W2 High Gobloc → Falie HIT physical HP 87→85 applied=2 raw=? cap=?
MODEL t=136.926 #73 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 87 ✓
OBS t=137.791 W2 High Gobloc → Falie HIT physical HP 85→83 applied=2 raw=? cap=?
MODEL t=137.791 #74 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=141.461 W2 High Gobloc → Falie HIT physical HP 83→81 applied=2 raw=? cap=?
MODEL t=141.461 #76 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=150.191 W2 Lizardo → Falie HIT physical HP 81→79 applied=2 raw=? cap=?
MODEL t=150.191 #80 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=151.591 W2 Lizardo → Falie HIT physical HP 79→77 applied=2 raw=? cap=?
MODEL t=151.591 #82 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=152.127 W2 Gobloc → Huun HIT physical HP 73→71 applied=2 raw=? cap=?
MODEL t=152.127 #83 cap≤2 (fodder tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 73 ✓
OBS t=155.192 W2 Lizardo → Falie HIT physical HP 77→75 applied=2 raw=? cap=?
MODEL t=155.192 #85 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=155.728 W2 Gobloc → Huun HIT physical HP 71→69 applied=2 raw=? cap=?
MODEL t=155.728 #86 cap≤2 (fodder tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 71 ✓
OBS t≈159.69 (poll) WAVE_CLEAR stage 1-1 next W3 clears=2
OBS t=159.591 W2 wave-clear respite → Falie HEAL ordinary_wave_clear HP 75→93 applied=18
MODEL t=159.591 #89 wave heal predicted 18 ✓ (A3)
OBS t=159.591 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 69→84 applied=15
MODEL t=159.591 #90 wave heal predicted 15 ✓ (A3)
OBS t=159.591 W2 wave-clear respite → Runa HEAL ordinary_wave_clear HP 81→96 applied=15
MODEL t=159.591 #91 wave heal predicted 15 ✓ (A3)
OBS t=163.26 W3 Lizardo → Falie HIT physical HP 93→91 applied=2 raw=? cap=?
MODEL t=163.26 #93 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 93 ✓
OBS t=163.327 W3 Orc → Falie HIT physical HP 91→89 applied=2 raw=? cap=?
MODEL t=163.327 #94 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 91 ✓
OBS t=166.924 W3 Lizardo → Falie HIT physical HP 89→87 applied=2 raw=? cap=?
MODEL t=166.924 #96 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 89 ✓
OBS t=173.46 W3 Orc → Falie HIT physical HP 87→85 applied=2 raw=? cap=?
MODEL t=173.46 #99 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 87 ✓
OBS t=177.461 W3 Lizardo → Falie HIT physical HP 85→83 applied=2 raw=? cap=?
MODEL t=177.461 #101 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=177.461 W3 Lizardo → Falie HIT physical HP 83→81 applied=2 raw=? cap=?
MODEL t=177.461 #102 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=181.06 W3 Lizardo → Falie HIT physical HP 81→79 applied=2 raw=? cap=?
MODEL t=181.06 #106 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=192.326 W3 Lizardo → Falie HIT physical HP 79→77 applied=2 raw=? cap=?
MODEL t=192.326 #109 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=192.523 W3 Lizardo → Falie HIT physical HP 77→75 applied=2 raw=? cap=?
MODEL t=192.523 #110 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=196.126 W3 Lizardo → Falie HIT physical HP 75→73 applied=2 raw=? cap=?
MODEL t=196.126 #112 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 75 ✓
OBS t=208.593 W3 High Gobloc → Falie HIT physical HP 73→71 applied=2 raw=? cap=?
MODEL t=208.593 #117 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 73 ✓
OBS t=209.925 W3 High Gobloc → Huun HIT physical HP 84→82 applied=2 raw=? cap=?
MODEL t=209.925 #118 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=210.592 W3 Orc → Falie HIT physical HP 71→69 applied=2 raw=? cap=?
MODEL t=210.592 #119 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 71 ✓
OBS t=212.194 W3 High Gobloc → Falie HIT physical HP 69→67 applied=2 raw=? cap=?
MODEL t=212.194 #120 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=213.592 W3 High Gobloc → Falie HIT physical HP 67→65 applied=2 raw=? cap=?
MODEL t=213.592 #122 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=214.193 W3 Orc → Falie HIT physical HP 65→63 applied=2 raw=? cap=?
MODEL t=214.193 #123 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=218.058 W3 Orc → Falie HIT physical HP 63→61 applied=2 raw=? cap=?
MODEL t=218.058 #125 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=227.125 W3 Orc → Falie HIT physical HP 61→59 applied=2 raw=? cap=?
MODEL t=227.125 #128 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=228.39 W3 Orc → Falie HIT physical HP 59→57 applied=2 raw=? cap=?
MODEL t=228.39 #130 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=228.458 W3 Orc → Huun HIT physical HP 82→80 applied=2 raw=? cap=?
MODEL t=228.458 #131 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=228.458 W3 Lizardo → Falie HIT physical HP 57→55 applied=2 raw=? cap=?
MODEL t=228.458 #132 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=232.054 W3 Orc → Falie HIT physical HP 55→53 applied=2 raw=? cap=?
MODEL t=232.054 #133 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 55 ✓
OBS t=232.122 W3 Lizardo → Falie HIT physical HP 53→51 applied=2 raw=? cap=?
MODEL t=232.122 #135 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 53 ✓
OBS t=236.191 W3 Orc → Huun HIT physical HP 80→78 applied=2 raw=? cap=?
MODEL t=236.191 #136 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=236.191 W3 Lizardo → Falie HIT physical HP 51→49 applied=2 raw=? cap=?
MODEL t=236.191 #137 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 51 ✓
OBS t=239.854 W3 Orc → Huun HIT physical HP 78→76 applied=2 raw=? cap=?
MODEL t=239.854 #139 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=247.054 W3 Lizardo → Falie HIT physical HP 49→47 applied=2 raw=? cap=?
MODEL t=247.054 #143 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 49 ✓
OBS t=247.989 W3 Lizardo → Huun HIT physical HP 76→74 applied=2 raw=? cap=?
MODEL t=247.989 #144 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 76 ✓
OBS t=248.389 W3 Lizardo → Huun HIT physical HP 74→72 applied=2 raw=? cap=?
MODEL t=248.389 #145 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 74 ✓
OBS t=250.72 W3 Lizardo → Falie HIT physical HP 47→45 applied=2 raw=? cap=?
MODEL t=250.72 #147 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 47 ✓
OBS t=252.054 W3 Lizardo → Huun HIT physical HP 72→70 applied=2 raw=? cap=?
MODEL t=252.054 #148 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 72 ✓
OBS t=256.121 W3 Lizardo → Falie HIT physical HP 45→43 applied=2 raw=? cap=?
MODEL t=256.121 #150 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 45 ✓
OBS t≈257.19 (poll) WAVE_CLEAR stage 1-1 next W4 clears=3
OBS t=257.19 W3 wave-clear respite → Falie HEAL ordinary_wave_clear HP 43→61 applied=18
MODEL t=257.19 #152 wave heal predicted 18 ✓ (A3)
OBS t=257.19 W3 wave-clear respite → Huun HEAL ordinary_wave_clear HP 70→85 applied=15
MODEL t=257.19 #153 wave heal predicted 15 ✓ (A3)
OBS t=257.19 W3 wave-clear respite → Runa HEAL ordinary_wave_clear HP 96→99 applied=3
MODEL t=257.19 #154 wave heal predicted 3 ✓ (A3)
OBS t=258.591 W4 Orc → Falie HIT physical HP 61→59 applied=2 raw=? cap=?
MODEL t=258.591 #155 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=258.859 W4 Orc → Huun HIT physical HP 85→83 applied=2 raw=? cap=?
MODEL t=258.859 #156 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=259.12 W4 Orc → Falie HIT physical HP 59→57 applied=2 raw=? cap=?
MODEL t=259.12 #157 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=262.257 W4 Orc → Falie HIT physical HP 57→55 applied=2 raw=? cap=?
MODEL t=262.257 #158 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=262.456 W4 Orc → Huun HIT physical HP 83→81 applied=2 raw=? cap=?
MODEL t=262.456 #159 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=262.79 W4 Orc → Falie HIT physical HP 55→53 applied=2 raw=? cap=?
MODEL t=262.79 #160 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 55 ✓
OBS t=266.12 W4 Orc → Huun HIT physical HP 81→79 applied=2 raw=? cap=?
MODEL t=266.12 #162 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=267.721 W4 Orc → Falie HIT physical HP 53→51 applied=2 raw=? cap=?
MODEL t=267.721 #163 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 53 ✓
OBS t=267.922 W4 Gobloc → Runa HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=267.922 #164 cap≤1 (fodder tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=268.922 W4 Gobloc → Runa HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=268.922 #165 cap≤1 (fodder tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=271.054 W4 Orc → Runa HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=271.054 #167 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=271.32 W4 Orc → Falie HIT physical HP 51→49 applied=2 raw=? cap=?
MODEL t=271.32 #168 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 51 ✓
OBS t=272.654 W4 Orc → Huun HIT physical HP 79→77 applied=2 raw=? cap=?
MODEL t=272.654 #170 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=274.719 W4 Orc → Runa HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=274.719 #172 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t=274.987 W4 Orc → Falie HIT physical HP 49→47 applied=2 raw=? cap=?
MODEL t=274.987 #173 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 49 ✓
OBS t=276.458 W4 Orc → Huun HIT physical HP 77→75 applied=2 raw=? cap=?
MODEL t=276.458 #174 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=278.323 W4 Orc → Runa HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=278.323 #175 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=278.592 W4 Orc → Falie HIT physical HP 47→45 applied=2 raw=? cap=?
MODEL t=278.592 #176 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 47 ✓
OBS t=279.989 W4 Orc → Huun HIT physical HP 75→73 applied=2 raw=? cap=?
MODEL t=279.989 #177 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 75 ✓
OBS t=282.259 W4 Orc → Falie HIT physical HP 45→43 applied=2 raw=? cap=?
MODEL t=282.259 #181 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 45 ✓
OBS t=283.192 W4 Orc → Runa HIT physical HP 94→93 applied=1 raw=? cap=?
MODEL t=283.192 #183 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 94 ✓
OBS t=283.591 W4 Orc → Huun HIT physical HP 73→71 applied=2 raw=? cap=?
MODEL t=283.591 #184 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 73 ✓
OBS t=297.258 W4 Orc → Falie HIT physical HP 43→41 applied=2 raw=? cap=?
MODEL t=297.258 #189 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 43 ✓
OBS t=299.592 W4 Orc → Falie HIT physical HP 41→39 applied=2 raw=? cap=?
MODEL t=299.592 #190 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 41 ✓
OBS t=303.26 W4 Orc → Falie HIT physical HP 39→37 applied=2 raw=? cap=?
MODEL t=303.26 #192 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 39 ✓
OBS t=306.923 W4 Orc → Falie HIT physical HP 37→35 applied=2 raw=? cap=?
MODEL t=306.923 #194 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 37 ✓
OBS t=310.589 W4 Orc → Falie HIT physical HP 35→33 applied=2 raw=? cap=?
MODEL t=310.589 #195 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 35 ✓
OBS t=315.391 W4 Orc → Falie HIT physical HP 33→31 applied=2 raw=? cap=?
MODEL t=315.391 #197 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 33 ✓
OBS t=326.324 W4 Orc → Falie HIT physical HP 31→29 applied=2 raw=? cap=?
MODEL t=326.324 #201 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 31 ✓
OBS t=326.91 W4 Orc → Falie HIT physical HP 29→27 applied=2 raw=? cap=?
MODEL t=326.91 #203 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 29 ✓
OBS t=327.857 W4 Orc → Falie HIT physical HP 27→25 applied=2 raw=? cap=?
MODEL t=327.857 #204 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 27 ✓
OBS t=328.321 W4 Orc → Falie HIT physical HP 25→23 applied=2 raw=? cap=?
MODEL t=328.321 #205 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 25 ✓
OBS t=328.454 W4 Orc → Falie HIT physical HP 23→21 applied=2 raw=? cap=?
MODEL t=328.454 #206 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 23 ✓
OBS t=330.525 W4 Orc → Falie HIT physical HP 21→19 applied=2 raw=? cap=?
MODEL t=330.525 #207 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 21 ✓
OBS t=331.525 W4 Orc → Falie HIT physical HP 19→17 applied=2 raw=? cap=?
MODEL t=331.525 #208 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 19 ✓
OBS t=331.924 W4 Orc → Falie HIT physical HP 17→15 applied=2 raw=? cap=?
MODEL t=331.924 #209 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 17 ✓
OBS t=332.123 W4 Orc → Falie HIT physical HP 15→13 applied=2 raw=? cap=?
MODEL t=332.123 #210 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 15 ✓
OBS t=334.19 W4 Orc → Falie HIT physical HP 13→11 applied=2 raw=? cap=?
MODEL t=334.19 #211 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 13 ✓
OBS t=335.324 W4 Orc → Falie HIT physical HP 11→9 applied=2 raw=? cap=?
MODEL t=335.324 #213 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 11 ✓
OBS t=335.724 W4 Orc → Falie HIT physical HP 9→7 applied=2 raw=? cap=?
MODEL t=335.724 #214 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 9 ✓
OBS t=336.004 W4 Orc → Falie HIT physical HP 7→5 applied=2 raw=? cap=?
MODEL t=336.004 #215 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 7 ✓
OBS t=338.99 W4 Orc → Falie HIT physical HP 5→3 applied=2 raw=? cap=?
MODEL t=338.99 #216 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 5 ✓
OBS t=339.324 W4 Orc → Falie HIT physical HP 3→1 applied=2 raw=? cap=?
MODEL t=339.324 #217 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 3 ✓
OBS t≈339.653 (poll) RECOVERY_TRANSITION observed stage 1-1 W4 → 1-1 W1
OBS t=339.653 W4 Orc → Falie HIT physical HP 1→0 applied=1 raw=? cap=?
MODEL t=339.653 #218 cap≤2 (routine tier, maxHP 115; A1/A2) HP floor; HP before predicted 1 ✓
OBS t=339.653 W4 Falie KO (event #218)
OBS t=339.653 Falie RECOVER continuous_defeat #1 HP 0→115
MODEL t=339.653 #219 recovery predicted full 115 ✓ (A4)
OBS t=339.653 Huun RECOVER continuous_defeat #1 HP 71→100
MODEL t=339.653 #220 recovery predicted full 100 ✓ (A4)
OBS t=339.653 Runa RECOVER continuous_defeat #1 HP 93→99
MODEL t=339.653 #221 recovery predicted full 99 ✓ (A4)
OBS t=350.984 W1 Gobloc → Runa HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=350.984 #225 cap≤1 (fodder tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=355.052 W1 Gobloc → Huun HIT physical HP 100→98 applied=2 raw=? cap=?
MODEL t=355.052 #229 cap≤2 (fodder tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 100 ✓
OBS t≈423.914 (poll) WAVE_CLEAR stage 1-1 next W2 clears=4
OBS t=423.781 W1 wave-clear respite → Huun HEAL ordinary_wave_clear HP 98→100 applied=2
MODEL t=423.781 #262 wave heal predicted 2 ✓ (A3)
OBS t=423.781 W1 wave-clear respite → Runa HEAL ordinary_wave_clear HP 98→99 applied=1
MODEL t=423.781 #263 wave heal predicted 1 ✓ (A3)
OBS t=425.044 W2 Lizardo → Falie HIT physical HP 115→113 applied=2 raw=? cap=?
MODEL t=425.044 #264 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 115 ✓
OBS t=428.981 W2 Lizardo → Falie HIT physical HP 113→111 applied=2 raw=? cap=?
MODEL t=428.981 #267 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 113 ✓
OBS t=433.512 W2 Gobloc → Huun HIT physical HP 100→98 applied=2 raw=? cap=?
MODEL t=433.512 #269 cap≤2 (fodder tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 100 ✓
OBS t=433.847 W2 Lizardo → Runa HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=433.847 #270 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=437.181 W2 Gobloc → Huun HIT physical HP 98→96 applied=2 raw=? cap=?
MODEL t=437.181 #272 cap≤2 (fodder tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=440.6 W2 Lizardo → Runa HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=440.6 #273 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=440.71 W2 Lizardo → Runa HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=440.71 #274 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=440.846 W2 Gobloc → Huun HIT physical HP 96→94 applied=2 raw=? cap=?
MODEL t=440.846 #275 cap≤2 (fodder tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t=444.311 W2 Lizardo → Runa HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=444.311 #277 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t=447.111 W2 Gobloc → Huun HIT physical HP 94→92 applied=2 raw=? cap=?
MODEL t=447.111 #279 cap≤2 (fodder tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 94 ✓
OBS t=462.711 W2 High Gobloc → Falie HIT physical HP 111→109 applied=2 raw=? cap=?
MODEL t=462.711 #289 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 111 ✓
OBS t=466.379 W2 High Gobloc → Falie HIT physical HP 109→107 applied=2 raw=? cap=?
MODEL t=466.379 #290 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 109 ✓
OBS t=480.721 W2 Lizardo → Falie HIT physical HP 107→105 applied=2 raw=? cap=?
MODEL t=480.721 #296 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 107 ✓
OBS t=491.184 W2 Lizardo → Falie HIT physical HP 105→103 applied=2 raw=? cap=?
MODEL t=491.184 #299 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 105 ✓
OBS t=491.386 W2 Lizardo → Falie HIT physical HP 103→101 applied=2 raw=? cap=?
MODEL t=491.386 #300 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 103 ✓
OBS t=494.119 W2 Lizardo → Huun HIT physical HP 92→90 applied=2 raw=? cap=?
MODEL t=494.119 #302 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 92 ✓
OBS t=495.188 W2 Lizardo → Falie HIT physical HP 101→99 applied=2 raw=? cap=?
MODEL t=495.188 #304 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 101 ✓
OBS t=497.786 W2 Lizardo → Huun HIT physical HP 90→88 applied=2 raw=? cap=?
MODEL t=497.786 #305 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 90 ✓
OBS t=501.452 W2 Lizardo → Falie HIT physical HP 99→97 applied=2 raw=? cap=?
MODEL t=501.452 #307 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=511.119 W2 Gobloc → Huun HIT physical HP 88→86 applied=2 raw=? cap=?
MODEL t=511.119 #313 cap≤2 (fodder tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 88 ✓
OBS t≈514.786 (poll) WAVE_CLEAR stage 1-1 next W3 clears=5
OBS t=514.786 W2 wave-clear respite → Falie HEAL ordinary_wave_clear HP 97→115 applied=18
MODEL t=514.786 #316 wave heal predicted 18 ✓ (A3)
OBS t=514.786 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 86→100 applied=14
MODEL t=514.786 #317 wave heal predicted 14 ✓ (A3)
OBS t=514.786 W2 wave-clear respite → Runa HEAL ordinary_wave_clear HP 95→99 applied=4
MODEL t=514.786 #318 wave heal predicted 4 ✓ (A3)
OBS t=516.186 W3 Orc → Falie HIT physical HP 115→113 applied=2 raw=? cap=?
MODEL t=516.186 #319 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 115 ✓
OBS t=516.186 W3 Orc → Falie HIT physical HP 113→111 applied=2 raw=? cap=?
MODEL t=516.186 #320 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 113 ✓
OBS t=519.252 W3 Lizardo → Huun HIT physical HP 100→98 applied=2 raw=? cap=?
MODEL t=519.252 #322 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 100 ✓
OBS t=519.72 W3 Lizardo → Huun HIT physical HP 98→96 applied=2 raw=? cap=?
MODEL t=519.72 #323 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=519.805 W3 Orc → Falie HIT physical HP 111→109 applied=2 raw=? cap=?
MODEL t=519.805 #324 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 111 ✓
OBS t=522.186 W3 Orc → Falie HIT physical HP 109→107 applied=2 raw=? cap=?
MODEL t=522.186 #326 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 109 ✓
OBS t=522.915 W3 Lizardo → Huun HIT physical HP 96→94 applied=2 raw=? cap=?
MODEL t=522.915 #327 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t=523.386 W3 Lizardo → Falie HIT physical HP 107→105 applied=2 raw=? cap=?
MODEL t=523.386 #328 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 107 ✓
OBS t=524.517 W3 High Gobloc → Runa HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=524.517 #329 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=524.586 W3 High Gobloc → Runa HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=524.586 #330 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 98 ✓
OBS t=525.785 W3 Orc → Falie HIT physical HP 105→103 applied=2 raw=? cap=?
MODEL t=525.785 #332 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 105 ✓
OBS t=526.518 W3 Lizardo → Falie HIT physical HP 103→101 applied=2 raw=? cap=?
MODEL t=526.518 #333 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 103 ✓
OBS t=526.982 W3 Lizardo → Falie HIT physical HP 101→99 applied=2 raw=? cap=?
MODEL t=526.982 #334 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 101 ✓
OBS t=528.385 W3 High Gobloc → Runa HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=528.385 #335 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=528.918 W3 High Gobloc → Runa HIT physical HP 96→95 applied=1 raw=? cap=?
MODEL t=528.918 #336 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 96 ✓
OBS t=528.987 W3 Orc → Runa HIT physical HP 95→94 applied=1 raw=? cap=?
MODEL t=528.987 #337 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=529.449 W3 Orc → Falie HIT physical HP 99→97 applied=2 raw=? cap=?
MODEL t=529.449 #339 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 99 ✓
OBS t=530.116 W3 Lizardo → Falie HIT physical HP 97→95 applied=2 raw=? cap=?
MODEL t=530.116 #340 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 97 ✓
OBS t=530.648 W3 Lizardo → Falie HIT physical HP 95→93 applied=2 raw=? cap=?
MODEL t=530.648 #341 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 95 ✓
OBS t=532.585 W3 High Gobloc → Runa HIT physical HP 94→93 applied=1 raw=? cap=?
MODEL t=532.585 #342 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 94 ✓
OBS t=532.652 W3 Orc → Runa HIT physical HP 93→92 applied=1 raw=? cap=?
MODEL t=532.652 #343 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 93 ✓
OBS t=533.787 W3 Lizardo → Huun HIT physical HP 94→92 applied=2 raw=? cap=?
MODEL t=533.787 #344 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 94 ✓
OBS t=535.248 W3 Lizardo → Runa HIT physical HP 92→91 applied=1 raw=? cap=?
MODEL t=535.248 #348 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 92 ✓
OBS t=535.848 W3 Orc → Runa HIT physical HP 91→90 applied=1 raw=? cap=?
MODEL t=535.848 #350 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 91 ✓
OBS t=537.052 W3 Orc → Runa HIT physical HP 90→89 applied=1 raw=? cap=?
MODEL t=537.052 #351 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 90 ✓
OBS t=537.319 W3 High Gobloc → Huun HIT physical HP 92→90 applied=2 raw=? cap=?
MODEL t=537.319 #352 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 92 ✓
OBS t=538.118 W3 High Gobloc → Runa HIT physical HP 89→88 applied=1 raw=? cap=?
MODEL t=538.118 #353 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 89 ✓
OBS t=538.851 W3 Lizardo → Falie HIT physical HP 93→91 applied=2 raw=? cap=?
MODEL t=538.851 #354 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 93 ✓
OBS t=539.516 W3 Orc → Falie HIT physical HP 91→89 applied=2 raw=? cap=?
MODEL t=539.516 #356 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 91 ✓
OBS t=540.714 W3 Orc → Runa HIT physical HP 88→87 applied=1 raw=? cap=?
MODEL t=540.714 #357 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 88 ✓
OBS t=541.784 W3 High Gobloc → Runa HIT physical HP 87→86 applied=1 raw=? cap=?
MODEL t=541.784 #358 cap≤1 (routine tier, maxHP 99; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 87 ✓
OBS t=542.448 W3 Lizardo → Falie HIT physical HP 89→87 applied=2 raw=? cap=?
MODEL t=542.448 #359 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 89 ✓
OBS t=543.118 W3 Orc → Falie HIT physical HP 87→85 applied=2 raw=? cap=?
MODEL t=543.118 #360 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 87 ✓
OBS t=546.114 W3 Lizardo → Falie HIT physical HP 85→83 applied=2 raw=? cap=?
MODEL t=546.114 #362 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=546.784 W3 Orc → Falie HIT physical HP 83→81 applied=2 raw=? cap=?
MODEL t=546.784 #363 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=558.251 W3 Lizardo → Falie HIT physical HP 81→79 applied=2 raw=? cap=?
MODEL t=558.251 #368 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=558.799 W3 Lizardo → Huun HIT physical HP 90→88 applied=2 raw=? cap=?
MODEL t=558.799 #370 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 90 ✓
OBS t=559.248 W3 Lizardo → Falie HIT physical HP 79→77 applied=2 raw=? cap=?
MODEL t=559.248 #371 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=559.514 W3 Lizardo → Falie HIT physical HP 77→75 applied=2 raw=? cap=?
MODEL t=559.514 #372 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=562.514 W3 Lizardo → Huun HIT physical HP 88→86 applied=2 raw=? cap=?
MODEL t=562.514 #373 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 88 ✓
OBS t=562.915 W3 Lizardo → Falie HIT physical HP 75→73 applied=2 raw=? cap=?
MODEL t=562.915 #374 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 75 ✓
OBS t=563.184 W3 Lizardo → Falie HIT physical HP 73→71 applied=2 raw=? cap=?
MODEL t=563.184 #375 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 73 ✓
OBS t=567.314 W3 Lizardo → Falie HIT physical HP 71→69 applied=2 raw=? cap=?
MODEL t=567.314 #376 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 71 ✓
OBS t=567.314 W3 Lizardo → Huun HIT physical HP 86→84 applied=2 raw=? cap=?
MODEL t=567.314 #377 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 86 ✓
OBS t=567.448 W3 Lizardo → Falie HIT physical HP 69→67 applied=2 raw=? cap=?
MODEL t=567.448 #378 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=570.916 W3 Lizardo → Falie HIT physical HP 67→65 applied=2 raw=? cap=?
MODEL t=570.916 #379 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=570.916 W3 Lizardo → Huun HIT physical HP 84→82 applied=2 raw=? cap=?
MODEL t=570.916 #380 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=571.05 W3 Lizardo → Falie HIT physical HP 65→63 applied=2 raw=? cap=?
MODEL t=571.05 #381 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=574.714 W3 Lizardo → Falie HIT physical HP 63→61 applied=2 raw=? cap=?
MODEL t=574.714 #382 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=577.18 W3 Lizardo → Huun HIT physical HP 82→80 applied=2 raw=? cap=?
MODEL t=577.18 #385 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=589.114 W3 Lizardo → Falie HIT physical HP 61→59 applied=2 raw=? cap=?
MODEL t=589.114 #390 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=589.314 W3 High Gobloc → Falie HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=589.314 #391 cap≤2 (routine tier, maxHP 115; A1/A2) below bound → cap did not bind; HP before predicted 59 ✓
OBS t=590.446 W3 Lizardo → Huun HIT physical HP 80→78 applied=2 raw=? cap=?
MODEL t=590.446 #393 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=592.114 W3 High Gobloc → Huun HIT physical HP 78→76 applied=2 raw=? cap=?
MODEL t=592.114 #394 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=592.983 W3 High Gobloc → Falie HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=592.983 #395 cap≤2 (routine tier, maxHP 115; A1/A2) below bound → cap did not bind; HP before predicted 58 ✓
OBS t=594.048 W3 Lizardo → Huun HIT physical HP 76→74 applied=2 raw=? cap=?
MODEL t=594.048 #397 cap≤2 (routine tier, maxHP 100; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 76 ✓
OBS t=597.715 W3 Lizardo → Falie HIT physical HP 57→55 applied=2 raw=? cap=?
MODEL t=597.715 #398 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=598.646 W3 High Gobloc → Falie HIT physical HP 55→54 applied=1 raw=? cap=?
MODEL t=598.646 #400 cap≤2 (routine tier, maxHP 115; A1/A2) below bound → cap did not bind; HP before predicted 55 ✓
OBS t=608.515 W3 Lizardo → Falie HIT physical HP 54→52 applied=2 raw=? cap=?
MODEL t=608.515 #404 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 54 ✓
OBS t=609.046 W3 Lizardo → Falie HIT physical HP 52→50 applied=2 raw=? cap=?
MODEL t=609.046 #405 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 52 ✓
OBS t=612.115 W3 Lizardo → Falie HIT physical HP 50→48 applied=2 raw=? cap=?
MODEL t=612.115 #407 cap≤2 (routine tier, maxHP 115; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 50 ✓
```

## boss-sweep-l1 session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/boss-sweep-l1/observed_events.ndjson (SHA-256 e04a525f3123b2188d8eeb41610979ce5cbd9e7c2078fe94c7d5f1027e587375). Enemy KOs omitted: 2. Lines 36/36.

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L1 85/85, Huun L1 60/60, Runa L1 69/69 autoEquip=false bossPolicy=auto
OBS t≈3.614 (poll) SUMMON boss (policy auto)
OBS t≈3.883 (poll) BOSS_START Troll HP 231/231 limit=18s party Falie L1 85/85, Huun L1 60/60, Runa L1 69/69
OBS t=4.886 W1 Troll → Runa HIT physical HP 69→57 applied=12 raw=? cap=?
MODEL t=4.886 #3 cap≤12 (boss tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=6.552 W1 Troll → Huun HIT physical HP 60→50 applied=10 raw=? cap=?
MODEL t=6.552 #4 cap≤10 (boss tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=8.151 W1 Troll → Falie HIT physical HP 85→81 applied=4 raw=? cap=?
MODEL t=8.151 #5 cap≤15 (boss tier, maxHP 85; A1/A2) below bound → cap did not bind; HP before predicted 85 ✓
OBS t=9.817 W1 Troll → Falie HIT physical HP 81→77 applied=4 raw=? cap=?
MODEL t=9.817 #6 cap≤15 (boss tier, maxHP 85; A1/A2) below bound → cap did not bind; HP before predicted 81 ✓
OBS t=11.485 W1 Troll → Falie HIT physical HP 77→73 applied=4 raw=? cap=?
MODEL t=11.485 #7 cap≤15 (boss tier, maxHP 85; A1/A2) below bound → cap did not bind; HP before predicted 77 ✓
OBS t=13.086 W1 Troll → Falie HIT physical HP 73→69 applied=4 raw=? cap=?
MODEL t=13.086 #8 cap≤15 (boss tier, maxHP 85; A1/A2) below bound → cap did not bind; HP before predicted 73 ✓
OBS t=14.75 W1 Troll → Falie HIT physical HP 69→65 applied=4 raw=? cap=?
MODEL t=14.75 #9 cap≤15 (boss tier, maxHP 85; A1/A2) below bound → cap did not bind; HP before predicted 69 ✓
OBS t=16.417 W1 Troll → Falie HIT physical HP 65→61 applied=4 raw=? cap=?
MODEL t=16.417 #10 cap≤15 (boss tier, maxHP 85; A1/A2) below bound → cap did not bind; HP before predicted 65 ✓
OBS t=18.085 W1 Troll → Falie HIT physical HP 61→57 applied=4 raw=? cap=?
MODEL t=18.085 #11 cap≤15 (boss tier, maxHP 85; A1/A2) below bound → cap did not bind; HP before predicted 61 ✓
OBS t=19.687 W1 Troll → Falie HIT physical HP 57→53 applied=4 raw=? cap=?
MODEL t=19.687 #12 cap≤15 (boss tier, maxHP 85; A1/A2) below bound → cap did not bind; HP before predicted 57 ✓
OBS t=21.353 W1 Troll → Falie HIT physical HP 53→49 applied=4 raw=? cap=?
MODEL t=21.353 #13 cap≤15 (boss tier, maxHP 85; A1/A2) below bound → cap did not bind; HP before predicted 53 ✓
OBS t≈21.952 (poll) RECOVERY_TRANSITION observed stage 1-1 W1 → 1-1 W1
OBS t≈21.952 (poll) BOSS_TIMEOUT boss 23/231 elapsed=18.065200000047707s living=3
MODEL t=21.952 boss timer consistent elapsed 18.065200000047707s ≥ 18s (A7)
OBS t≈21.952 (poll) SUMMON boss (policy auto)
OBS t=21.952 Falie RECOVER boss_timeout #1 HP 49→85
MODEL t=21.952 #14 recovery predicted full 85 ✓ (A4)
OBS t=21.952 Huun RECOVER boss_timeout #1 HP 50→60
MODEL t=21.952 #15 recovery predicted full 60 ✓ (A4)
OBS t=21.952 Runa RECOVER boss_timeout #1 HP 57→69
MODEL t=21.952 #16 recovery predicted full 69 ✓ (A4)
OBS t≈21.952 (poll) SESSION_END max_boss_timeouts clears=0 recoveries=1 gaps=0 deadlocks=0
```

## boss-sweep-l2 session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/boss-sweep-l2/observed_events.ndjson (SHA-256 8dc4466ed517947fd9cf348a2c9c97c3aa4cdc5be1d7adb5121adbdcfc63025f). Enemy KOs omitted: 3. Lines 24/24.

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L2 93/93, Huun L2 66/66, Runa L2 74/74 autoEquip=false bossPolicy=auto
OBS t≈5.802 (poll) SUMMON boss (policy auto)
OBS t≈8.134 (poll) BOSS_START Troll HP 231/231 limit=18s party Falie L2 93/93, Huun L2 66/66, Runa L2 74/74
OBS t=9.202 W1 Troll → Runa HIT physical HP 74→61 applied=13 raw=? cap=?
MODEL t=9.202 #3 cap≤13 (boss tier, maxHP 74; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 74 ✓
OBS t=10.804 W1 Troll → Huun HIT physical HP 66→55 applied=11 raw=? cap=?
MODEL t=10.804 #4 cap≤11 (boss tier, maxHP 66; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=12.404 W1 Troll → Falie HIT physical HP 93→90 applied=3 raw=? cap=?
MODEL t=12.404 #5 cap≤16 (boss tier, maxHP 93; A1/A2) below bound → cap did not bind; HP before predicted 93 ✓
OBS t=14.068 W1 Troll → Falie HIT physical HP 90→87 applied=3 raw=? cap=?
MODEL t=14.068 #6 cap≤16 (boss tier, maxHP 93; A1/A2) below bound → cap did not bind; HP before predicted 90 ✓
OBS t=15.738 W1 Troll → Falie HIT physical HP 87→84 applied=3 raw=? cap=?
MODEL t=15.738 #7 cap≤16 (boss tier, maxHP 93; A1/A2) below bound → cap did not bind; HP before predicted 87 ✓
OBS t=17.338 W1 Troll → Falie HIT physical HP 84→81 applied=3 raw=? cap=?
MODEL t=17.338 #8 cap≤16 (boss tier, maxHP 93; A1/A2) below bound → cap did not bind; HP before predicted 84 ✓
OBS t=18.993 W1 Troll → Falie HIT physical HP 81→78 applied=3 raw=? cap=?
MODEL t=18.993 #9 cap≤16 (boss tier, maxHP 93; A1/A2) below bound → cap did not bind; HP before predicted 81 ✓
OBS t=20.661 W1 Troll → Falie HIT physical HP 78→75 applied=3 raw=? cap=?
MODEL t=20.661 #10 cap≤16 (boss tier, maxHP 93; A1/A2) below bound → cap did not bind; HP before predicted 78 ✓
OBS t=22.323 W1 Troll → Falie HIT physical HP 75→72 applied=3 raw=? cap=?
MODEL t=22.323 #11 cap≤16 (boss tier, maxHP 93; A1/A2) below bound → cap did not bind; HP before predicted 75 ✓
OBS t≈25.122 (poll) BOSS_CLEAR last sampled boss HP 3 (sample precedes the clear; not settlement HP)
MODEL t=25.122 boss-clear restore applied (unlogged; A5)
OBS t≈25.122 (poll) SESSION_END max_bosses clears=0 recoveries=0 gaps=0 deadlocks=0
```

## boss-sweep-l3 session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/boss-sweep-l3/observed_events.ndjson (SHA-256 38efbce1d820f05996baeb471fe04355f7570be53d1adb80d57028b756954be7). Enemy KOs omitted: 2. Lines 22/22.

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L3 101/101, Huun L3 72/72, Runa L3 79/79 autoEquip=false bossPolicy=auto
OBS t≈4.733 (poll) SUMMON boss (policy auto)
OBS t≈4.932 (poll) BOSS_START Troll HP 231/231 limit=18s party Falie L3 101/101, Huun L3 72/72, Runa L3 79/79
OBS t=5.938 W1 Troll → Runa HIT physical HP 79→66 applied=13 raw=? cap=?
MODEL t=5.938 #2 cap≤14 (boss tier, maxHP 79; A1/A2) below bound → cap did not bind; HP before predicted 79 ✓
OBS t=7.536 W1 Troll → Runa HIT physical HP 66→53 applied=13 raw=? cap=?
MODEL t=7.536 #3 cap≤14 (boss tier, maxHP 79; A1/A2) below bound → cap did not bind; HP before predicted 66 ✓
OBS t=9.202 W1 Troll → Runa HIT physical HP 53→40 applied=13 raw=? cap=?
MODEL t=9.202 #4 cap≤14 (boss tier, maxHP 79; A1/A2) below bound → cap did not bind; HP before predicted 53 ✓
OBS t=10.871 W1 Troll → Falie HIT physical HP 101→100 applied=1 raw=? cap=?
MODEL t=10.871 #5 cap≤18 (boss tier, maxHP 101; A1/A2) below bound → cap did not bind; HP before predicted 101 ✓
OBS t=12.539 W1 Troll → Falie HIT physical HP 100→99 applied=1 raw=? cap=?
MODEL t=12.539 #6 cap≤18 (boss tier, maxHP 101; A1/A2) below bound → cap did not bind; HP before predicted 100 ✓
OBS t=14.136 W1 Troll → Falie HIT physical HP 99→98 applied=1 raw=? cap=?
MODEL t=14.136 #7 cap≤18 (boss tier, maxHP 101; A1/A2) below bound → cap did not bind; HP before predicted 99 ✓
OBS t=15.805 W1 Troll → Falie HIT physical HP 98→97 applied=1 raw=? cap=?
MODEL t=15.805 #8 cap≤18 (boss tier, maxHP 101; A1/A2) below bound → cap did not bind; HP before predicted 98 ✓
OBS t=17.402 W1 Troll → Falie HIT physical HP 97→96 applied=1 raw=? cap=?
MODEL t=17.402 #9 cap≤18 (boss tier, maxHP 101; A1/A2) below bound → cap did not bind; HP before predicted 97 ✓
OBS t≈19.135 (poll) BOSS_CLEAR last sampled boss HP 7 (sample precedes the clear; not settlement HP)
MODEL t=19.135 boss-clear restore applied (unlogged; A5)
OBS t≈19.135 (poll) SESSION_END max_bosses clears=0 recoveries=0 gaps=0 deadlocks=0
```

## boss-sweep-l4 session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/boss-sweep-l4/observed_events.ndjson (SHA-256 0b05921a27e10aa1cd3ea7db5b89621b0fbe8d91466fdec533d1238e4e883289). Enemy KOs omitted: 4. Lines 8/8.

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L4 109/109, Huun L4 78/78, Runa L4 84/84 autoEquip=false bossPolicy=auto
OBS t≈4.866 (poll) SUMMON boss (policy auto)
OBS t≈4.934 (poll) BOSS_START Troll HP 231/231 limit=18s party Falie L4 109/109, Huun L4 78/78, Runa L4 84/84
OBS t=5.939 W1 Troll → Runa HIT physical HP 84→72 applied=12 raw=? cap=?
MODEL t=5.939 #4 cap≤15 (boss tier, maxHP 84; A1/A2) below bound → cap did not bind; HP before predicted 84 ✓
OBS t≈16.736 (poll) BOSS_CLEAR last sampled boss HP 1 (sample precedes the clear; not settlement HP)
MODEL t=16.736 boss-clear restore applied (unlogged; A5)
OBS t≈16.736 (poll) SESSION_END max_bosses clears=0 recoveries=0 gaps=0 deadlocks=0
```

## boss-sweep-l5 session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/boss-sweep-l5/observed_events.ndjson (SHA-256 efc80a1ab9eaa2921633644d74cc773ce1168bdf1bf53dbd3962d581c4122c69). Enemy KOs omitted: 2. Lines 12/12.

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L5 117/117, Huun L5 84/84, Runa L5 89/89 autoEquip=false bossPolicy=auto
OBS t≈0.942 (poll) SUMMON boss (policy auto)
OBS t≈2.67 (poll) BOSS_START Troll HP 231/231 limit=18s party Falie L5 117/117, Huun L5 84/84, Runa L5 89/89
OBS t=3.675 W1 Troll → Runa HIT physical HP 89→77 applied=12 raw=? cap=?
MODEL t=3.675 #2 cap≤16 (boss tier, maxHP 89; A1/A2) below bound → cap did not bind; HP before predicted 89 ✓
OBS t=5.276 W1 Troll → Runa HIT physical HP 77→65 applied=12 raw=? cap=?
MODEL t=5.276 #3 cap≤16 (boss tier, maxHP 89; A1/A2) below bound → cap did not bind; HP before predicted 77 ✓
OBS t=6.94 W1 Troll → Huun HIT physical HP 84→71 applied=13 raw=? cap=?
MODEL t=6.94 #4 cap≤15 (boss tier, maxHP 84; A1/A2) below bound → cap did not bind; HP before predicted 84 ✓
OBS t≈12.003 (poll) BOSS_CLEAR last sampled boss HP 10 (sample precedes the clear; not settlement HP)
MODEL t=12.003 boss-clear restore applied (unlogged; A5)
OBS t≈12.003 (poll) SESSION_END max_bosses clears=0 recoveries=0 gaps=0 deadlocks=0
```

## earned-fresh session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/earned-fresh/observed_events.ndjson (SHA-256 445eb1c02f30fbbf3548b489a843d519b39f19758d5fd7f307ba4b026c03d4aa). Enemy KOs omitted: 128. Lines 250/250.

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L1 75/75, Huun L1 60/60, Runa L1 60/60, Kojonn L1 65/65 autoEquip=true bossPolicy=farm:4
OBS t=7.297 W1 Skeleton → Huun HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=7.297 #6 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=37.917 W1 Gobloc → Huun HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=37.917 #23 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t≈73.424 (poll) WAVE_CLEAR stage 1-1 next W2 clears=1
OBS t=71.849 W1 wave-clear respite → Huun HEAL ordinary_wave_clear HP 58→60 applied=2
MODEL t=71.849 #37 wave heal predicted 2 ✓ (A3)
OBS t=74.287 W2 Lizardo → Falie HIT physical HP 75→74 applied=1 raw=? cap=?
MODEL t=74.287 #38 cap≤1 (routine tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 75 ✓
OBS t=74.287 W2 Lizardo → Falie HIT physical HP 74→73 applied=1 raw=? cap=?
MODEL t=74.287 #39 cap≤1 (routine tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 74 ✓
OBS t=82.555 W2 Gobloc → Falie HIT physical HP 73→72 applied=1 raw=? cap=?
MODEL t=82.555 #45 cap≤1 (fodder tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 73 ✓
OBS t=82.644 W2 Gobloc → Falie HIT physical HP 72→71 applied=1 raw=? cap=?
MODEL t=82.644 #47 cap≤1 (fodder tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 72 ✓
OBS t=86.453 W2 Gobloc → Falie HIT physical HP 71→70 applied=1 raw=? cap=?
MODEL t=86.453 #51 cap≤1 (fodder tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 71 ✓
OBS t=87.052 W2 Gobloc → Falie HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=87.052 #52 cap≤1 (fodder tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t≈88.918 (poll) EQUIPMENT collect
OBS t≈95.572 (poll) EQUIPMENT auto_equip
OBS t≈96.306 (poll) Falie state L1 maxHP 83 CP 51.1
OBS t≈96.306 (poll) Kojonn state L1 maxHP 75 CP 55.7
OBS t=99.041 W2 Lizardo → Falie HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=99.041 #57 cap≤1 (routine tier, maxHP 83; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t≈99.908 (poll) EQUIPMENT close
OBS t=100.039 W2 Lizardo → Huun HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=100.039 #59 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=100.571 W2 Lizardo → Falie HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=100.571 #60 cap≤1 (routine tier, maxHP 83; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=104.173 W2 Lizardo → Falie HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=104.173 #62 cap≤1 (routine tier, maxHP 83; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=112.038 W2 Lizardo → Falie HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=112.038 #65 cap≤1 (routine tier, maxHP 83; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=112.038 W2 Lizardo → Falie HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=112.038 #66 cap≤1 (routine tier, maxHP 83; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=114.108 W2 Gobloc → Huun HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=114.108 #68 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=115.639 W2 Lizardo → Falie HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=115.639 #69 cap≤1 (routine tier, maxHP 83; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=117.706 W2 Gobloc → Huun HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=117.706 #70 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=119.372 W2 Lizardo → Falie HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=119.372 #73 cap≤1 (routine tier, maxHP 83; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t≈121.306 (poll) EQUIPMENT collect
OBS t≈127.306 (poll) EQUIPMENT auto_equip
OBS t≈127.506 (poll) Runa state L1 maxHP 69 CP 70.4
OBS t≈130.571 (poll) EQUIPMENT close
OBS t=133.906 W2 Lizardo → Falie HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=133.906 #78 cap≤1 (routine tier, maxHP 83; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=134.437 W2 Gobloc → Huun HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=134.437 #80 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=135.172 W2 Lizardo → Falie HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=135.172 #81 cap≤1 (routine tier, maxHP 83; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t≈141.837 (poll) EQUIPMENT collect
OBS t=146.839 W2 High Gobloc → Huun HIT physical HP 56→55 applied=1 raw=? cap=?
MODEL t=146.839 #86 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 56 ✓
OBS t≈146.839 (poll) EQUIPMENT auto_equip
OBS t≈148.901 (poll) Huun state L1 maxHP 70 CP 69.8
OBS t=150.436 W2 High Gobloc → Falie HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=150.436 #88 cap≤1 (routine tier, maxHP 83; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t≈152.57 (poll) EQUIPMENT close
OBS t≈180.961 (poll) WAVE_CLEAR stage 1-1 next W3 clears=2
OBS t=152.666 W2 wave-clear respite → Falie HEAL ordinary_wave_clear HP 59→72 applied=13
MODEL t=152.666 #90 wave heal predicted 13 ✓ (A3)
OBS t=152.666 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 55→66 applied=11
MODEL t=152.666 #91 wave heal predicted 11 ✓ (A3)
OBS t=152.666 W2 wave-clear respite → Runa HEAL ordinary_wave_clear HP 60→69 applied=9
MODEL t=152.666 #92 wave heal predicted 9 ✓ (A3)
OBS t=152.666 W2 wave-clear respite → Kojonn HEAL ordinary_wave_clear HP 65→75 applied=10
MODEL t=152.666 #93 wave heal predicted 10 ✓ (A3)
OBS t=156.64 W3 Lizardo → Falie HIT physical HP 72→71 applied=1 raw=? cap=?
MODEL t=156.64 #95 cap≤? (? tier, maxHP 83; A1/A2) cap bound unknown (EnemyData tier not observed for source); HP before predicted 72 ✓
OBS t=157.773 W3 Lizardo → Huun HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=157.773 #96 cap≤? (? tier, maxHP 70; A1/A2) cap bound unknown (EnemyData tier not observed for source); HP before predicted 66 ✓
OBS t=161.533 W3 Lizardo → Huun HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=161.533 #98 cap≤? (? tier, maxHP 70; A1/A2) cap bound unknown (EnemyData tier not observed for source); HP before predicted 65 ✓
OBS t=167.64 W3 Lizardo → Falie HIT physical HP 71→70 applied=1 raw=? cap=?
MODEL t=167.64 #102 cap≤? (? tier, maxHP 83; A1/A2) cap bound unknown (EnemyData tier not observed for source); HP before predicted 71 ✓
OBS t=167.903 W3 Orc → Falie HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=167.903 #103 cap≤? (? tier, maxHP 83; A1/A2) cap bound unknown (EnemyData tier not observed for source); HP before predicted 70 ✓
OBS t=170.039 W3 Lizardo → Falie HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=170.039 #105 cap≤? (? tier, maxHP 83; A1/A2) cap bound unknown (EnemyData tier not observed for source); HP before predicted 69 ✓
OBS t=171.44 W3 Orc → Falie HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=171.44 #106 cap≤? (? tier, maxHP 83; A1/A2) cap bound unknown (EnemyData tier not observed for source); HP before predicted 68 ✓
OBS t≈180.961 (poll) EQUIPMENT collect
OBS t=183.957 W3 Lizardo → Falie HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=183.957 #111 cap≤1 (routine tier, maxHP 83; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=184.16 W3 Lizardo → Falie HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=184.16 #112 cap≤1 (routine tier, maxHP 83; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t≈185.692 (poll) EQUIPMENT auto_equip
OBS t≈186.294 (poll) Falie state L1 maxHP 88 CP 57.3
OBS t≈189.826 (poll) EQUIPMENT auto_equip
OBS t≈190.226 (poll) Huun state L1 maxHP 69 CP 74.1
OBS t≈194.092 (poll) EQUIPMENT close
OBS t=200.826 W3 High Gobloc → Huun HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=200.826 #118 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=201.162 W3 Orc → Falie HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=201.162 #119 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=201.291 W3 High Gobloc → Falie HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=201.291 #120 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=204.492 W3 High Gobloc → Huun HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=204.492 #121 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=204.826 W3 Orc → Falie HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=204.826 #122 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=204.892 W3 High Gobloc → Falie HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=204.892 #123 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=219.426 W3 Lizardo → Falie HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=219.426 #129 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=219.492 W3 Orc → Huun HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=219.492 #130 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=220.76 W3 Orc → Huun HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=220.76 #131 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=223.089 W3 Orc → Falie HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=223.089 #133 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=224.36 W3 Orc → Falie HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=224.36 #134 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=234.89 W3 Lizardo → Falie HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=234.89 #139 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=238.556 W3 Lizardo → Falie HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=238.556 #141 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t≈250.023 (poll) WAVE_CLEAR stage 1-1 next W4 clears=3
OBS t=240.823 W3 wave-clear respite → Falie HEAL ordinary_wave_clear HP 56→70 applied=14
MODEL t=240.823 #144 wave heal predicted 14 ✓ (A3)
OBS t=240.823 W3 wave-clear respite → Huun HEAL ordinary_wave_clear HP 60→69 applied=9
MODEL t=240.823 #145 wave heal predicted 9 ✓ (A3)
OBS t=244.623 W4 Orc → Huun HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=244.623 #146 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=244.756 W4 Orc → Falie HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=244.756 #147 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=245.29 W4 Orc → Falie HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=245.29 #148 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=248.221 W4 Orc → Huun HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=248.221 #149 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=248.422 W4 Orc → Falie HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=248.422 #150 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=248.954 W4 Orc → Falie HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=248.954 #151 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=251.889 W4 Orc → Huun HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=251.889 #152 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=252.088 W4 Orc → Falie HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=252.088 #153 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=252.556 W4 Orc → Falie HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=252.556 #154 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=254.086 W4 Gobloc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=254.086 #155 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=254.956 W4 Orc → Kojonn HIT physical HP 75→74 applied=1 raw=? cap=?
MODEL t=254.956 #156 cap≤1 (routine tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 75 ✓
OBS t=255.487 W4 Orc → Huun HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=255.487 #157 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=255.556 W4 Gobloc → Kojonn HIT physical HP 74→73 applied=1 raw=? cap=?
MODEL t=255.556 #158 cap≤1 (fodder tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 74 ✓
OBS t=255.756 W4 Orc → Falie HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=255.756 #159 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t≈256.354 (poll) EQUIPMENT collect
OBS t=258.552 W4 Orc → Kojonn HIT physical HP 73→72 applied=1 raw=? cap=?
MODEL t=258.552 #163 cap≤1 (routine tier, maxHP 75; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 73 ✓
OBS t≈261.552 (poll) EQUIPMENT auto_equip
OBS t≈262.757 (poll) Kojonn state L1 maxHP 81 CP 63.7
OBS t≈266.354 (poll) EQUIPMENT close
OBS t=274.819 W4 Orc → Falie HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=274.819 #173 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=275.688 W4 Orc → Falie HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=275.688 #176 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=276.686 W4 Orc → Huun HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=276.686 #177 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=279.352 W4 Orc → Falie HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=279.352 #178 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t≈283.552 (poll) EQUIPMENT collect
OBS t=286.42 W4 Orc → Falie HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=286.42 #181 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=286.42 W4 Orc → Falie HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=286.42 #182 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=287.485 W4 Orc → Huun HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=287.485 #184 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t≈287.686 (poll) EQUIPMENT auto_equip
OBS t≈288.019 (poll) Kojonn state L1 maxHP 86 CP 69.3
OBS t=289.088 W4 Orc → Falie HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=289.088 #186 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=289.088 W4 Orc → Falie HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=289.088 #187 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=291.085 W4 Orc → Huun HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=291.085 #188 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t≈291.82 (poll) EQUIPMENT close
OBS t=292.753 W4 Orc → Falie HIT physical HP 56→55 applied=1 raw=? cap=?
MODEL t=292.753 #189 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 56 ✓
OBS t=292.753 W4 Orc → Falie HIT physical HP 55→54 applied=1 raw=? cap=?
MODEL t=292.753 #190 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 55 ✓
OBS t=295.417 W4 Orc → Huun HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=295.417 #192 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=296.418 W4 Orc → Falie HIT physical HP 54→53 applied=1 raw=? cap=?
MODEL t=296.418 #193 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 54 ✓
OBS t=296.753 W4 Orc → Falie HIT physical HP 53→52 applied=1 raw=? cap=?
MODEL t=296.753 #195 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 53 ✓
OBS t=299.018 W4 Orc → Huun HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=299.018 #196 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=300.35 W4 Orc → Falie HIT physical HP 52→51 applied=1 raw=? cap=?
MODEL t=300.35 #197 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 52 ✓
OBS t=302.616 W4 Orc → Huun HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=302.616 #198 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t≈308.35 (poll) EQUIPMENT collect
OBS t≈312.351 (poll) EQUIPMENT auto_equip
OBS t≈312.55 (poll) Runa state L1 maxHP 75 CP 76
OBS t=315.617 W4 Lizardo → Falie HIT physical HP 51→50 applied=1 raw=? cap=?
MODEL t=315.617 #204 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 51 ✓
OBS t≈316.354 (poll) EQUIPMENT close
OBS t=316.553 W4 Orc → Huun HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=316.553 #206 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=317.817 W4 Orc → Falie HIT physical HP 50→49 applied=1 raw=? cap=?
MODEL t=317.817 #208 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 50 ✓
OBS t=327.684 W4 Orc → Huun HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=327.684 #212 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=328.284 W4 Lizardo → Falie HIT physical HP 49→48 applied=1 raw=? cap=?
MODEL t=328.284 #214 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 49 ✓
OBS t≈328.684 (poll) EQUIPMENT collect
OBS t=329.019 W4 Lizardo → Huun HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=329.019 #215 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=332.016 W4 Lizardo → Falie HIT physical HP 48→47 applied=1 raw=? cap=?
MODEL t=332.016 #217 cap≤1 (routine tier, maxHP 88; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 48 ✓
OBS t=332.683 W4 Lizardo → Huun HIT physical HP 56→55 applied=1 raw=? cap=?
MODEL t=332.683 #218 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 56 ✓
OBS t≈333.284 (poll) EQUIPMENT auto_equip
OBS t≈333.686 (poll) Falie state L1 maxHP 94 CP 64.3
OBS t=335.683 W4 Lizardo → Falie HIT physical HP 47→46 applied=1 raw=? cap=?
MODEL t=335.683 #220 cap≤1 (routine tier, maxHP 94; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 47 ✓
OBS t≈336.752 (poll) WAVE_CLEAR stage 1-1 next W1 clears=4
OBS t≈336.752 (poll) BOSS_START Troll HP 231/231 limit=18s party Falie L1 61/94, Huun L1 66/69, Runa L1 75/75, Kojonn L1 85/86
OBS t=336.752 W4 wave-clear respite → Falie HEAL ordinary_wave_clear HP 46→61 applied=15
MODEL t=336.752 #222 wave heal predicted 15 ✓ (A3)
OBS t=336.752 W4 wave-clear respite → Huun HEAL ordinary_wave_clear HP 55→66 applied=11
MODEL t=336.752 #223 wave heal predicted 11 ✓ (A3)
OBS t=336.752 W4 wave-clear respite → Runa HEAL ordinary_wave_clear HP 68→75 applied=7
MODEL t=336.752 #224 wave heal predicted 7 ✓ (A3)
OBS t=336.752 W4 wave-clear respite → Kojonn HEAL ordinary_wave_clear HP 72→85 applied=13
MODEL t=336.752 #225 wave heal predicted 13 ✓ (A3)
OBS t≈336.752 (poll) EQUIPMENT close during active boss
OBS t=337.755 W1 Troll → Kojonn HIT physical HP 85→79 applied=6 raw=? cap=?
MODEL t=337.755 #226 cap≤15 (boss tier, maxHP 86; A1/A2) below bound → cap did not bind; HP before predicted 85 ✓
OBS t=339.423 W1 Troll → Huun HIT physical HP 66→54 applied=12 raw=? cap=?
MODEL t=339.423 #227 cap≤12 (boss tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=341.089 W1 Troll → Falie HIT physical HP 61→59 applied=2 raw=? cap=?
MODEL t=341.089 #228 cap≤16 (boss tier, maxHP 94; A1/A2) below bound → cap did not bind; HP before predicted 61 ✓
OBS t=342.758 W1 Troll → Falie HIT physical HP 59→57 applied=2 raw=? cap=?
MODEL t=342.758 #229 cap≤16 (boss tier, maxHP 94; A1/A2) below bound → cap did not bind; HP before predicted 59 ✓
OBS t=344.422 W1 Troll → Falie HIT physical HP 57→55 applied=2 raw=? cap=?
MODEL t=344.422 #230 cap≤16 (boss tier, maxHP 94; A1/A2) below bound → cap did not bind; HP before predicted 57 ✓
OBS t≈347.022 (poll) BOSS_CLEAR last sampled boss HP 18 (sample precedes the clear; not settlement HP)
MODEL t=347.022 boss-clear restore applied (unlogged; A5)
OBS t≈347.022 (poll) SESSION_END max_bosses clears=4 recoveries=0 gaps=0 deadlocks=0
```

## recovery-onehp session 1 seed 3235774465

Evidence: /private/tmp/orka-7l9-lab/runs/recovery-onehp/observed_events.ndjson (SHA-256 05ed50c0992f067cc0c5397a82aa7d00aeb8a140d8bbc535a214ac7a147f54db). Enemy KOs omitted: 687. Lines 400/1639 (truncated; rerun with --fullTimelines).

```text
OBS t=0 SESSION_START seed 3235774465 party Falie L1 1/85, Huun L1 1/60, Runa L1 1/69 autoEquip=false bossPolicy=hold
OBS t≈8.666 (poll) RECOVERY_TRANSITION observed stage 1-2 W1 → 1-2 W1
OBS t=8.666 W1 Skeleton → Huun HIT physical HP 1→0 applied=1 raw=? cap=?
MODEL t=8.666 #3 cap≤1 (fodder tier, maxHP 60; A1/A2) at bound or HP floor; HP before predicted 1 ✓
OBS t=8.666 W1 Huun KO (event #3)
OBS t=8.666 Falie RECOVER continuous_defeat #1 HP 1→85
MODEL t=8.666 #4 recovery predicted full 85 ✓ (A4)
OBS t=8.666 Huun RECOVER continuous_defeat #1 HP 0→60
MODEL t=8.666 #5 recovery predicted full 60 ✓ (A4)
OBS t=8.666 Runa RECOVER continuous_defeat #1 HP 1→69
MODEL t=8.666 #6 recovery predicted full 69 ✓ (A4)
OBS t=18.139 W1 Skeleton → Huun HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=18.139 #10 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=19.938 W1 Gobloc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=19.938 #12 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=23.605 W1 Gobloc → Huun HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=23.605 #14 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=24.272 W1 Gobloc → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=24.272 #15 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=24.537 W1 Skeleton → Huun HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=24.537 #16 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=24.537 W1 Skeleton → Huun HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=24.537 #17 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=25.806 W1 Skeleton → Huun HIT physical HP 56→55 applied=1 raw=? cap=?
MODEL t=25.806 #19 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 56 ✓
OBS t=27.203 W1 Gobloc → Huun HIT physical HP 55→54 applied=1 raw=? cap=?
MODEL t=27.203 #23 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 55 ✓
OBS t=27.872 W1 Gobloc → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=27.872 #25 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=44.538 W1 Skeleton → Huun HIT physical HP 54→53 applied=1 raw=? cap=?
MODEL t=44.538 #35 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 54 ✓
OBS t=77.869 W1 Gobloc → Huun HIT physical HP 53→52 applied=1 raw=? cap=?
MODEL t=77.869 #47 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 53 ✓
OBS t≈89.469 (poll) WAVE_CLEAR stage 1-2 next W2 clears=1
OBS t=89.402 W1 wave-clear respite → Huun HEAL ordinary_wave_clear HP 52→60 applied=8
MODEL t=89.402 #55 wave heal predicted 8 ✓ (A3)
OBS t=89.402 W1 wave-clear respite → Runa HEAL ordinary_wave_clear HP 66→69 applied=3
MODEL t=89.402 #56 wave heal predicted 3 ✓ (A3)
OBS t=91.269 W2 Gobloc → Huun HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=91.269 #57 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=92.407 W2 Gobloc → Huun HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=92.407 #59 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=99.669 W2 Gobloc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=99.669 #63 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=104.735 W2 Gobloc → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=104.735 #67 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=105.735 W2 Skeleton → Huun HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=105.735 #69 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=108.602 W2 Gobloc → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=108.602 #72 cap≤1 (fodder tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=118.069 W2 Lizardo → Falie HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=118.069 #76 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=119.536 W2 Lizardo → Falie HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=119.536 #78 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=134.87 W2 High Gobloc → Falie HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=134.87 #83 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=135.336 W2 High Gobloc → Falie HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=135.336 #84 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=136.135 W2 Skeleton → Huun HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=136.135 #85 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=138.535 W2 High Gobloc → Falie HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=138.535 #86 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=139 W2 High Gobloc → Falie HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=139 #87 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=139.801 W2 Skeleton → Huun HIT physical HP 56→55 applied=1 raw=? cap=?
MODEL t=139.801 #89 cap≤1 (fodder tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 56 ✓
OBS t=142.6 W2 High Gobloc → Falie HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=142.6 #91 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=146.202 W2 High Gobloc → Falie HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=146.202 #92 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=157.934 W2 Lizardo → Falie HIT physical HP 77→76 applied=1 raw=? cap=?
MODEL t=157.934 #95 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=161.536 W2 Lizardo → Falie HIT physical HP 76→75 applied=1 raw=? cap=?
MODEL t=161.536 #96 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 76 ✓
OBS t≈171.201 (poll) WAVE_CLEAR stage 1-2 next W3 clears=2
OBS t=171.201 W2 wave-clear respite → Falie HEAL ordinary_wave_clear HP 75→85 applied=10
MODEL t=171.201 #102 wave heal predicted 10 ✓ (A3)
OBS t=171.201 W2 wave-clear respite → Huun HEAL ordinary_wave_clear HP 55→60 applied=5
MODEL t=171.201 #103 wave heal predicted 5 ✓ (A3)
OBS t=171.201 W2 wave-clear respite → Runa HEAL ordinary_wave_clear HP 66→69 applied=3
MODEL t=171.201 #104 wave heal predicted 3 ✓ (A3)
OBS t=172.467 W3 Lizardo → Huun HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=172.467 #105 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=172.535 W3 High Gobloc → Falie HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=172.535 #106 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=172.802 W3 Lizardo → Huun HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=172.802 #107 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=175.332 W3 High Gobloc → Falie HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=175.332 #109 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=175.332 W3 High Gobloc → Falie HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=175.332 #110 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=176.132 W3 High Gobloc → Falie HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=176.132 #111 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=176.401 W3 Lizardo → Huun HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=176.401 #112 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=178.997 W3 High Gobloc → Falie HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=178.997 #113 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=179.398 W3 High Gobloc → Falie HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=179.398 #114 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=179.801 W3 High Gobloc → Falie HIT physical HP 79→78 applied=1 raw=? cap=?
MODEL t=179.801 #115 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 79 ✓
OBS t=182.466 W3 Lizardo → Runa HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=182.466 #117 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=182.599 W3 Lizardo → Runa HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=182.599 #118 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=182.665 W3 High Gobloc → Falie HIT physical HP 78→77 applied=1 raw=? cap=?
MODEL t=182.665 #119 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 78 ✓
OBS t=183.064 W3 High Gobloc → Falie HIT physical HP 77→76 applied=1 raw=? cap=?
MODEL t=183.064 #120 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 77 ✓
OBS t=183.402 W3 High Gobloc → Falie HIT physical HP 76→75 applied=1 raw=? cap=?
MODEL t=183.402 #121 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 76 ✓
OBS t=186.264 W3 High Gobloc → Falie HIT physical HP 75→74 applied=1 raw=? cap=?
MODEL t=186.264 #122 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 75 ✓
OBS t=186.666 W3 High Gobloc → Falie HIT physical HP 74→73 applied=1 raw=? cap=?
MODEL t=186.666 #123 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 74 ✓
OBS t=186.997 W3 High Gobloc → Falie HIT physical HP 73→72 applied=1 raw=? cap=?
MODEL t=186.997 #125 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 73 ✓
OBS t=188.732 W3 Lizardo → Runa HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=188.732 #126 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=189.934 W3 High Gobloc → Falie HIT physical HP 72→71 applied=1 raw=? cap=?
MODEL t=189.934 #127 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 72 ✓
OBS t=190.334 W3 High Gobloc → Falie HIT physical HP 71→70 applied=1 raw=? cap=?
MODEL t=190.334 #128 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 71 ✓
OBS t=190.666 W3 High Gobloc → Falie HIT physical HP 70→69 applied=1 raw=? cap=?
MODEL t=190.666 #129 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 70 ✓
OBS t=192.335 W3 Lizardo → Runa HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=192.335 #130 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=193.597 W3 High Gobloc → Falie HIT physical HP 69→68 applied=1 raw=? cap=?
MODEL t=193.597 #132 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 69 ✓
OBS t=193.998 W3 High Gobloc → Falie HIT physical HP 68→67 applied=1 raw=? cap=?
MODEL t=193.998 #133 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 68 ✓
OBS t=194.265 W3 High Gobloc → Falie HIT physical HP 67→66 applied=1 raw=? cap=?
MODEL t=194.265 #134 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 67 ✓
OBS t=197.599 W3 High Gobloc → Falie HIT physical HP 66→65 applied=1 raw=? cap=?
MODEL t=197.599 #138 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 66 ✓
OBS t=197.934 W3 High Gobloc → Falie HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=197.934 #139 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=198.534 W3 High Gobloc → Runa HIT physical HP 65→64 applied=1 raw=? cap=?
MODEL t=198.534 #140 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 65 ✓
OBS t=198.597 W3 High Gobloc → Runa HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=198.597 #141 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=201.198 W3 High Gobloc → Falie HIT physical HP 64→63 applied=1 raw=? cap=?
MODEL t=201.198 #142 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 64 ✓
OBS t=201.598 W3 High Gobloc → Falie HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=201.598 #143 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=202.134 W3 High Gobloc → Runa HIT physical HP 63→62 applied=1 raw=? cap=?
MODEL t=202.134 #144 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 63 ✓
OBS t=202.267 W3 High Gobloc → Runa HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=202.267 #145 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=204.864 W3 High Gobloc → Falie HIT physical HP 62→61 applied=1 raw=? cap=?
MODEL t=204.864 #148 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 62 ✓
OBS t=205.266 W3 High Gobloc → Falie HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=205.266 #150 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=206.998 W3 High Gobloc → Runa HIT physical HP 61→60 applied=1 raw=? cap=?
MODEL t=206.998 #151 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 61 ✓
OBS t=208.531 W3 High Gobloc → Falie HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=208.531 #152 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=208.931 W3 High Gobloc → Falie HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=208.931 #153 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=210.667 W3 High Gobloc → Runa HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=210.667 #154 cap≤1 (routine tier, maxHP 69; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=212.131 W3 High Gobloc → Falie HIT physical HP 58→57 applied=1 raw=? cap=?
MODEL t=212.131 #157 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 58 ✓
OBS t=221.197 W3 High Gobloc → Falie HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=221.197 #160 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=221.997 W3 High Gobloc → Huun HIT physical HP 57→56 applied=1 raw=? cap=?
MODEL t=221.997 #162 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 57 ✓
OBS t=222.664 W3 High Gobloc → Falie HIT physical HP 56→55 applied=1 raw=? cap=?
MODEL t=222.664 #163 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 56 ✓
OBS t=224.329 W3 High Gobloc → Falie HIT physical HP 55→54 applied=1 raw=? cap=?
MODEL t=224.329 #165 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 55 ✓
OBS t=226.263 W3 High Gobloc → Falie HIT physical HP 54→53 applied=1 raw=? cap=?
MODEL t=226.263 #166 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 54 ✓
OBS t=227.929 W3 High Gobloc → Falie HIT physical HP 53→52 applied=1 raw=? cap=?
MODEL t=227.929 #167 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 53 ✓
OBS t=230.275 W3 High Gobloc → Falie HIT physical HP 52→51 applied=1 raw=? cap=?
MODEL t=230.275 #169 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 52 ✓
OBS t=244.732 W3 Lizardo → Falie HIT physical HP 51→50 applied=1 raw=? cap=?
MODEL t=244.732 #174 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 51 ✓
OBS t=245.931 W3 Lizardo → Huun HIT physical HP 56→55 applied=1 raw=? cap=?
MODEL t=245.931 #175 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 56 ✓
OBS t=248.129 W3 Orc → Falie HIT physical HP 50→49 applied=1 raw=? cap=?
MODEL t=248.129 #177 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 50 ✓
OBS t=248.396 W3 Orc → Huun HIT physical HP 55→54 applied=1 raw=? cap=?
MODEL t=248.396 #178 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 55 ✓
OBS t=249.529 W3 Lizardo → Falie HIT physical HP 49→48 applied=1 raw=? cap=?
MODEL t=249.529 #179 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 49 ✓
OBS t=253.732 W3 Lizardo → Falie HIT physical HP 48→47 applied=1 raw=? cap=?
MODEL t=253.732 #180 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 48 ✓
OBS t=254.538 W3 Orc → Falie HIT physical HP 47→46 applied=1 raw=? cap=?
MODEL t=254.538 #182 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 47 ✓
OBS t=254.732 W3 Orc → Huun HIT physical HP 54→53 applied=1 raw=? cap=?
MODEL t=254.732 #183 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 54 ✓
OBS t=258.13 W3 Orc → Falie HIT physical HP 46→45 applied=1 raw=? cap=?
MODEL t=258.13 #184 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 46 ✓
OBS t=258.33 W3 Orc → Huun HIT physical HP 53→52 applied=1 raw=? cap=?
MODEL t=258.33 #185 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 53 ✓
OBS t=261.798 W3 Orc → Falie HIT physical HP 45→44 applied=1 raw=? cap=?
MODEL t=261.798 #186 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 45 ✓
OBS t=261.995 W3 Orc → Huun HIT physical HP 52→51 applied=1 raw=? cap=?
MODEL t=261.995 #187 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 52 ✓
OBS t=265.464 W3 Orc → Falie HIT physical HP 44→43 applied=1 raw=? cap=?
MODEL t=265.464 #188 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 44 ✓
OBS t=265.598 W3 Orc → Huun HIT physical HP 51→50 applied=1 raw=? cap=?
MODEL t=265.598 #189 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 51 ✓
OBS t=269.064 W3 Orc → Falie HIT physical HP 43→42 applied=1 raw=? cap=?
MODEL t=269.064 #190 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 43 ✓
OBS t=269.261 W3 Orc → Huun HIT physical HP 50→49 applied=1 raw=? cap=?
MODEL t=269.261 #191 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 50 ✓
OBS t=272.732 W3 Orc → Falie HIT physical HP 42→41 applied=1 raw=? cap=?
MODEL t=272.732 #192 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 42 ✓
OBS t=272.863 W3 Orc → Huun HIT physical HP 49→48 applied=1 raw=? cap=?
MODEL t=272.863 #193 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 49 ✓
OBS t=276.398 W3 Orc → Falie HIT physical HP 41→40 applied=1 raw=? cap=?
MODEL t=276.398 #194 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 41 ✓
OBS t=276.533 W3 Orc → Huun HIT physical HP 48→47 applied=1 raw=? cap=?
MODEL t=276.533 #195 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 48 ✓
OBS t=279.994 W3 Orc → Falie HIT physical HP 40→39 applied=1 raw=? cap=?
MODEL t=279.994 #196 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 40 ✓
OBS t=280.195 W3 Orc → Huun HIT physical HP 47→46 applied=1 raw=? cap=?
MODEL t=280.195 #197 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 47 ✓
OBS t=283.666 W3 Orc → Falie HIT physical HP 39→38 applied=1 raw=? cap=?
MODEL t=283.666 #198 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 39 ✓
OBS t=283.861 W3 Orc → Huun HIT physical HP 46→45 applied=1 raw=? cap=?
MODEL t=283.861 #199 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 46 ✓
OBS t=287.33 W3 Orc → Falie HIT physical HP 38→37 applied=1 raw=? cap=?
MODEL t=287.33 #200 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 38 ✓
OBS t=287.531 W3 Orc → Huun HIT physical HP 45→44 applied=1 raw=? cap=?
MODEL t=287.531 #201 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 45 ✓
OBS t=290.932 W3 Orc → Falie HIT physical HP 37→36 applied=1 raw=? cap=?
MODEL t=290.932 #202 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 37 ✓
OBS t=291.197 W3 Orc → Huun HIT physical HP 44→43 applied=1 raw=? cap=?
MODEL t=291.197 #203 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 44 ✓
OBS t=294.53 W3 Orc → Falie HIT physical HP 36→35 applied=1 raw=? cap=?
MODEL t=294.53 #204 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 36 ✓
OBS t=294.864 W3 Orc → Huun HIT physical HP 43→42 applied=1 raw=? cap=?
MODEL t=294.864 #205 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 43 ✓
OBS t=298.262 W3 Orc → Falie HIT physical HP 35→34 applied=1 raw=? cap=?
MODEL t=298.262 #206 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 35 ✓
OBS t=298.46 W3 Orc → Huun HIT physical HP 42→41 applied=1 raw=? cap=?
MODEL t=298.46 #207 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 42 ✓
OBS t=301.932 W3 Orc → Falie HIT physical HP 34→33 applied=1 raw=? cap=?
MODEL t=301.932 #208 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 34 ✓
OBS t=302.127 W3 Orc → Huun HIT physical HP 41→40 applied=1 raw=? cap=?
MODEL t=302.127 #209 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 41 ✓
OBS t=305.529 W3 Orc → Falie HIT physical HP 33→32 applied=1 raw=? cap=?
MODEL t=305.529 #210 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 33 ✓
OBS t=305.728 W3 Orc → Huun HIT physical HP 40→39 applied=1 raw=? cap=?
MODEL t=305.728 #211 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 40 ✓
OBS t=309.194 W3 Orc → Falie HIT physical HP 32→31 applied=1 raw=? cap=?
MODEL t=309.194 #212 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 32 ✓
OBS t=309.394 W3 Orc → Huun HIT physical HP 39→38 applied=1 raw=? cap=?
MODEL t=309.394 #213 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 39 ✓
OBS t=312.794 W3 Orc → Falie HIT physical HP 31→30 applied=1 raw=? cap=?
MODEL t=312.794 #214 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 31 ✓
OBS t=313.062 W3 Orc → Huun HIT physical HP 38→37 applied=1 raw=? cap=?
MODEL t=313.062 #215 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 38 ✓
OBS t=316.395 W3 Orc → Falie HIT physical HP 30→29 applied=1 raw=? cap=?
MODEL t=316.395 #216 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 30 ✓
OBS t=316.727 W3 Orc → Huun HIT physical HP 37→36 applied=1 raw=? cap=?
MODEL t=316.727 #217 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 37 ✓
OBS t=320.127 W3 Orc → Falie HIT physical HP 29→28 applied=1 raw=? cap=?
MODEL t=320.127 #218 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 29 ✓
OBS t=320.394 W3 Orc → Huun HIT physical HP 36→35 applied=1 raw=? cap=?
MODEL t=320.394 #219 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 36 ✓
OBS t=323.794 W3 Orc → Falie HIT physical HP 28→27 applied=1 raw=? cap=?
MODEL t=323.794 #220 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 28 ✓
OBS t=323.995 W3 Orc → Huun HIT physical HP 35→34 applied=1 raw=? cap=?
MODEL t=323.995 #221 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 35 ✓
OBS t=327.459 W3 Orc → Falie HIT physical HP 27→26 applied=1 raw=? cap=?
MODEL t=327.459 #222 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 27 ✓
OBS t=327.593 W3 Orc → Huun HIT physical HP 34→33 applied=1 raw=? cap=?
MODEL t=327.593 #223 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 34 ✓
OBS t=331.059 W3 Orc → Falie HIT physical HP 26→25 applied=1 raw=? cap=?
MODEL t=331.059 #224 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 26 ✓
OBS t=331.259 W3 Orc → Huun HIT physical HP 33→32 applied=1 raw=? cap=?
MODEL t=331.259 #225 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 33 ✓
OBS t=334.728 W3 Orc → Falie HIT physical HP 25→24 applied=1 raw=? cap=?
MODEL t=334.728 #226 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 25 ✓
OBS t=334.928 W3 Orc → Huun HIT physical HP 32→31 applied=1 raw=? cap=?
MODEL t=334.928 #227 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 32 ✓
OBS t=338.392 W3 Orc → Falie HIT physical HP 24→23 applied=1 raw=? cap=?
MODEL t=338.392 #228 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 24 ✓
OBS t=338.593 W3 Orc → Huun HIT physical HP 31→30 applied=1 raw=? cap=?
MODEL t=338.593 #229 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 31 ✓
OBS t=342.059 W3 Orc → Falie HIT physical HP 23→22 applied=1 raw=? cap=?
MODEL t=342.059 #230 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 23 ✓
OBS t=342.261 W3 Orc → Huun HIT physical HP 30→29 applied=1 raw=? cap=?
MODEL t=342.261 #231 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 30 ✓
OBS t=345.725 W3 Orc → Falie HIT physical HP 22→21 applied=1 raw=? cap=?
MODEL t=345.725 #232 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 22 ✓
OBS t=345.925 W3 Orc → Huun HIT physical HP 29→28 applied=1 raw=? cap=?
MODEL t=345.925 #233 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 29 ✓
OBS t=349.394 W3 Orc → Falie HIT physical HP 21→20 applied=1 raw=? cap=?
MODEL t=349.394 #234 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 21 ✓
OBS t=349.594 W3 Orc → Huun HIT physical HP 28→27 applied=1 raw=? cap=?
MODEL t=349.594 #235 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 28 ✓
OBS t=353.057 W3 Orc → Falie HIT physical HP 20→19 applied=1 raw=? cap=?
MODEL t=353.057 #236 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 20 ✓
OBS t=353.194 W3 Orc → Huun HIT physical HP 27→26 applied=1 raw=? cap=?
MODEL t=353.194 #237 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 27 ✓
OBS t=356.659 W3 Orc → Falie HIT physical HP 19→18 applied=1 raw=? cap=?
MODEL t=356.659 #238 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 19 ✓
OBS t=356.795 W3 Orc → Huun HIT physical HP 26→25 applied=1 raw=? cap=?
MODEL t=356.795 #239 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 26 ✓
OBS t=360.327 W3 Orc → Falie HIT physical HP 18→17 applied=1 raw=? cap=?
MODEL t=360.327 #240 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 18 ✓
OBS t=360.458 W3 Orc → Huun HIT physical HP 25→24 applied=1 raw=? cap=?
MODEL t=360.458 #241 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 25 ✓
OBS t=363.924 W3 Orc → Falie HIT physical HP 17→16 applied=1 raw=? cap=?
MODEL t=363.924 #242 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 17 ✓
OBS t=364.058 W3 Orc → Huun HIT physical HP 24→23 applied=1 raw=? cap=?
MODEL t=364.058 #243 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 24 ✓
OBS t=367.591 W3 Orc → Falie HIT physical HP 16→15 applied=1 raw=? cap=?
MODEL t=367.591 #244 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 16 ✓
OBS t=367.724 W3 Orc → Huun HIT physical HP 23→22 applied=1 raw=? cap=?
MODEL t=367.724 #245 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 23 ✓
OBS t=371.19 W3 Orc → Falie HIT physical HP 15→14 applied=1 raw=? cap=?
MODEL t=371.19 #246 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 15 ✓
OBS t=371.39 W3 Orc → Huun HIT physical HP 22→21 applied=1 raw=? cap=?
MODEL t=371.39 #247 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 22 ✓
OBS t=374.858 W3 Orc → Falie HIT physical HP 14→13 applied=1 raw=? cap=?
MODEL t=374.858 #248 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 14 ✓
OBS t=375.126 W3 Orc → Huun HIT physical HP 21→20 applied=1 raw=? cap=?
MODEL t=375.126 #249 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 21 ✓
OBS t=378.467 W3 Orc → Falie HIT physical HP 13→12 applied=1 raw=? cap=?
MODEL t=378.467 #250 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 13 ✓
OBS t=378.6 W3 Orc → Huun HIT physical HP 20→19 applied=1 raw=? cap=?
MODEL t=378.6 #251 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 20 ✓
OBS t=382.134 W3 Orc → Falie HIT physical HP 12→11 applied=1 raw=? cap=?
MODEL t=382.134 #252 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 12 ✓
OBS t=382.266 W3 Orc → Huun HIT physical HP 19→18 applied=1 raw=? cap=?
MODEL t=382.266 #253 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 19 ✓
OBS t=385.8 W3 Orc → Falie HIT physical HP 11→10 applied=1 raw=? cap=?
MODEL t=385.8 #254 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 11 ✓
OBS t=385.933 W3 Orc → Huun HIT physical HP 18→17 applied=1 raw=? cap=?
MODEL t=385.933 #255 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 18 ✓
OBS t=389.4 W3 Orc → Falie HIT physical HP 10→9 applied=1 raw=? cap=?
MODEL t=389.4 #256 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 10 ✓
OBS t=389.6 W3 Orc → Huun HIT physical HP 17→16 applied=1 raw=? cap=?
MODEL t=389.6 #257 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 17 ✓
OBS t=393.066 W3 Orc → Falie HIT physical HP 9→8 applied=1 raw=? cap=?
MODEL t=393.066 #258 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 9 ✓
OBS t=393.266 W3 Orc → Huun HIT physical HP 16→15 applied=1 raw=? cap=?
MODEL t=393.266 #259 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 16 ✓
OBS t=396.735 W3 Orc → Falie HIT physical HP 8→7 applied=1 raw=? cap=?
MODEL t=396.735 #260 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 8 ✓
OBS t=396.867 W3 Orc → Huun HIT physical HP 15→14 applied=1 raw=? cap=?
MODEL t=396.867 #261 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 15 ✓
OBS t=400.4 W3 Orc → Falie HIT physical HP 7→6 applied=1 raw=? cap=?
MODEL t=400.4 #262 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 7 ✓
OBS t=400.532 W3 Orc → Huun HIT physical HP 14→13 applied=1 raw=? cap=?
MODEL t=400.532 #263 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 14 ✓
OBS t=404.066 W3 Orc → Falie HIT physical HP 6→5 applied=1 raw=? cap=?
MODEL t=404.066 #264 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 6 ✓
OBS t=404.2 W3 Orc → Huun HIT physical HP 13→12 applied=1 raw=? cap=?
MODEL t=404.2 #265 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 13 ✓
OBS t=407.732 W3 Orc → Falie HIT physical HP 5→4 applied=1 raw=? cap=?
MODEL t=407.732 #266 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 5 ✓
OBS t=407.869 W3 Orc → Huun HIT physical HP 12→11 applied=1 raw=? cap=?
MODEL t=407.869 #267 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 12 ✓
OBS t=411.399 W3 Orc → Falie HIT physical HP 4→3 applied=1 raw=? cap=?
MODEL t=411.399 #268 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 4 ✓
OBS t=411.534 W3 Orc → Huun HIT physical HP 11→10 applied=1 raw=? cap=?
MODEL t=411.534 #269 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 11 ✓
OBS t=415.001 W3 Orc → Falie HIT physical HP 3→2 applied=1 raw=? cap=?
MODEL t=415.001 #270 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 3 ✓
OBS t=415.134 W3 Orc → Huun HIT physical HP 10→9 applied=1 raw=? cap=?
MODEL t=415.134 #271 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 10 ✓
OBS t=418.666 W3 Orc → Falie HIT physical HP 2→1 applied=1 raw=? cap=?
MODEL t=418.666 #272 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 2 ✓
OBS t=418.8 W3 Orc → Huun HIT physical HP 9→8 applied=1 raw=? cap=?
MODEL t=418.8 #273 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 9 ✓
OBS t≈422.332 (poll) RECOVERY_TRANSITION observed stage 1-2 W3 → 1-2 W3
OBS t=422.332 W3 Orc → Falie HIT physical HP 1→0 applied=1 raw=? cap=?
MODEL t=422.332 #274 cap≤1 (routine tier, maxHP 85; A1/A2) at bound or HP floor; HP before predicted 1 ✓
OBS t=422.332 W3 Falie KO (event #274)
OBS t=422.332 Falie RECOVER continuous_defeat #2 HP 0→85
MODEL t=422.332 #275 recovery predicted full 85 ✓ (A4)
OBS t=422.332 Huun RECOVER continuous_defeat #2 HP 8→60
MODEL t=422.332 #276 recovery predicted full 60 ✓ (A4)
OBS t=422.332 Runa RECOVER continuous_defeat #2 HP 59→69
MODEL t=422.332 #277 recovery predicted full 69 ✓ (A4)
OBS t=429.625 W3 Lizardo → Falie HIT physical HP 85→84 applied=1 raw=? cap=?
MODEL t=429.625 #279 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 85 ✓
OBS t=429.956 W3 High Gobloc → Huun HIT physical HP 60→59 applied=1 raw=? cap=?
MODEL t=429.956 #280 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 60 ✓
OBS t=431.692 W3 Lizardo → Falie HIT physical HP 84→83 applied=1 raw=? cap=?
MODEL t=431.692 #282 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 84 ✓
OBS t=432.292 W3 High Gobloc → Falie HIT physical HP 83→82 applied=1 raw=? cap=?
MODEL t=432.292 #283 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 83 ✓
OBS t=433.558 W3 High Gobloc → Huun HIT physical HP 59→58 applied=1 raw=? cap=?
MODEL t=433.558 #284 cap≤1 (routine tier, maxHP 60; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 59 ✓
OBS t=435.358 W3 Lizardo → Falie HIT physical HP 82→81 applied=1 raw=? cap=?
MODEL t=435.358 #285 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 82 ✓
OBS t=435.958 W3 High Gobloc → Falie HIT physical HP 81→80 applied=1 raw=? cap=?
MODEL t=435.958 #286 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 81 ✓
OBS t=439.026 W3 Lizardo → Falie HIT physical HP 80→79 applied=1 raw=? cap=?
MODEL t=439.026 #288 cap≤1 (routine tier, maxHP 85; A1/A2) applied equals bound (capped or raw=bound; unknown which); HP before predicted 80 ✓
OBS t=439.626 W3 High Gobloc → Falie HIT physical HP 79→78 applied=1 raw=? cap=?
```
