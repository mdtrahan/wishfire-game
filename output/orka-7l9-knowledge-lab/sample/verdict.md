# ORKA-7l9 combat knowledge lab verdict

Generated 2026-10-17T06:18:49.063Z. Claims `output/orka-7l9-knowledge-lab/claims/orka-7l9-combat-claims.json` SHA-256 `cbffeed98f7ea18d`, declaration: **committed** at commit `2ca44d0bc329` (2026-10-16T21:55:56-07:00). Candidate runtime baseline `c43f614714fe`. Lab HEAD `0aa06beab0c8` patch `4f53cda1`. Shadow model `orka-7l9-shadow-1`.

A passing parser or shadow model is not proof of good combat design. PASS below certifies only the stated fixture and observable.

## Legend

- `OBS` unchanged-game observation · `MODEL` shadow prediction (never an observation) · `REQ` owner acceptance rule · `REF` direct StoneAge observation · `?` unmeasured or not exposed
- `HIT` applied hostile damage · `HEAL` effective healing · `KO` Hero reached 0 HP · `WAVE_CLEAR` ordinary clear from the runtime counter · `BOSS_START`/`BOSS_CLEAR`/`BOSS_TIMEOUT` boss attempt · `RECOVER` full-party restore event · `GAP` missing event ids · `DEADLOCK` no progress
- `t=` simulation seconds from session start for runtime events; `t≈… (poll)` marks harness-poll time for transitions the runtime does not timestamp
- `W1` event-time wave; `W~1` wave sampled at the poll that read the event
- `raw=?` pre-cap damage is not exposed; `cap=?` whether the cap bound is not exposed. MODEL lines may state a cap bound under declared assumptions A1/A2.
- Enemy KOs are counted per session but omitted from timelines unless requested.

## Design verdict

**NOT PROVEN**

| pillar | claim | verdict |
| --- | --- | --- |
| survival | C1-starter-farming | PASS |
| pressure | C2-pressure | INCONCLUSIVE |
| earned_boss | C5-first-boss | PASS |
| recovery | C6-recovery | FAIL |

## Claims

| claim | verdict | tests | REQ | REF | OBS summary | MODEL summary | UNKNOWN |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1-starter-farming | PASS | fixture | REQ-STARTER, REQ-LAB-STARTER | REF-ORDINARY, REF-PET-KO | starter-l1-nokaja: PASS (5/5 seeds); pinned-starter-l1: INCONCLUSIVE (5/5 seeds) | starter-l1-nokaja: CONSISTENT_WITH_CONTROL; pinned-starter-l1: not_run | StoneAge 20-wave reference (REF-ORDINARY has none); whether surviving is satisfying (see C2) |
| C2-pressure | INCONCLUSIVE | rule | REQ-NO-DANGER-BAND | REF-ORDINARY | outcome sensitivity PASS, margin sensitivity PASS | survival envelope + no-heal counterfactual (see detail) | approved danger band (owner decision); pre-cap damage per hit; enemy hit cadence mechanics |
| C3-cap-share | INCONCLUSIVE | model_assumption | REQ-CAP-UNKNOWN |  | 6181 hits; capped share UNKNOWN | capped share ∈ [0, 0.9638] under A1/A2 | pre-cap damage; raw damage formula inputs at impact |
| C4-kaja-healing | INCONCLUSIVE | rule | REQ-KAJA-UNLOCK |  | L1 zero PASS; L15 occurs INCONCLUSIVE | remove-healer counterfactual (see detail) | causal survival value of Kaja when both parties live |
| C5-first-boss | PASS | fixture | REQ-BOSS, REQ-LAB-BOSS | REF-BOSS-GAUGE | underprepared PASS; progressed PASS; earned PASS; synthetic threshold all-clear L2 | — | StoneAge numeric timer and boss HP band; intermediate StoneAge upgrade effects |
| C6-recovery | FAIL | rule | REQ-RECOVERY, REQ-LAB-RECOVERY |  | recovery-onehp: FAIL (0/5 seeds) | recovery-onehp: CONSISTENT_WITH_CONTROL | recovery behaviour after a boss is summoned (not exercised under hold policy) |

## C1-starter-farming: Starter no-Kaja farming meets the survival gate

Verdict **PASS**. Tests: fixture. Expectation (declared before prospective runs): PASS only if each of seeds 3235774465–3235774469 records ≥20 consecutive ordinary clears from the runtime counter with zero Hero KOs, zero missing event ids, zero ambiguous transitions and zero deadlocks. Any Hero KO, gap or deadlock is FAIL. A harness timeout short of 20 clears without a failure is INCONCLUSIVE.

- REQ REQ-STARTER: Each required farming fixture completes at least 20 consecutive ordinary waves over five seeds; starter has zero Hero KOs. (bd show ORKA-7l9 acceptance 2)
- REQ REQ-LAB-STARTER: Starter farming: five fixed no-Kaja seeds, 20 consecutive ordinary clears each, zero Hero KOs, zero event gaps and deadlocks. (owner lab brief 2026-10-16 PDT)
- REF REF-ORDINARY: Sampled WORLD360 ordinary fights through Chapter 3 kept trainers standing; no counted 20-wave streak, minimum HP or heal formula was measured. (output/orka-7l9-stoneage-world360-direct.md)
- REF REF-PET-KO: Chapter 1-10 showed an apparent pet KO during a boss win while trainers stood; front-line pets may absorb damage. (output/orka-7l9-stoneage-world360-direct.md)

### starter-l1-nokaja (prospective) — PASS

Evidence: [starter-l1-nokaja/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/starter-l1-nokaja/observed_events.ndjson) `d79643711beb`

| seed | verdict | clears | stages cleared | longest event silence s | Hero KOs | gaps | deadlocks | end | reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3235774465 | PASS | 20 | 1-1 | 17.932 | 0 | 0 | 0 | max_waves |  |
| 3235774466 | PASS | 20 | 1-1 | 17.733 | 0 | 0 | 0 | max_waves |  |
| 3235774467 | PASS | 20 | 1-1 | 17.129 | 0 | 0 | 0 | max_waves |  |
| 3235774468 | PASS | 20 | 1-1 | 12.064 | 0 | 0 | 0 | max_waves |  |
| 3235774469 | PASS | 20 | 1-1 | 18 | 0 | 0 | 0 | max_waves |  |

MODEL control replay: CONSISTENT_WITH_CONTROL over 1071 checks.

### pinned-starter-l1 (retrospective) — INCONCLUSIVE

Evidence: [orka-7l9-wave-heal-five-seed-clean/balance_metrics.json](/private/tmp/orka-7l9-wave-heal-five-seed-clean/balance_metrics.json) `102c044ab46a`. retrospective evidence can contradict but not confirm

| seed | verdict | clears | stages cleared | longest event silence s | Hero KOs | gaps | deadlocks | end | reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3235774465 | PASS | 20 | ? | ? | 0 | 0 | 0 | max_waves |  |
| 3235774466 | PASS | 20 | ? | ? | 0 | 0 | 0 | max_waves |  |
| 3235774467 | PASS | 20 | ? | ? | 0 | 0 | 0 | max_waves |  |
| 3235774468 | PASS | 20 | ? | ? | 0 | 0 | 0 | max_waves |  |
| 3235774469 | PASS | 20 | ? | ? | 0 | 0 | 0 | max_waves |  |

MODEL control replay: not_run (aggregate report has no event replay).


## C2-pressure: Cap plus respite leave measurable pressure; defensive gear changes observed results

Verdict **INCONCLUSIVE**. Tests: rule. Expectation (declared before prospective runs): Report event-time HP margins, effective healing by source and hits per wave for the starter run. For matched seeds with Auto-Equip off, compare base gear with +10 DEF and +30 HP on all three Hero bodies. Outcome sensitivity PASS if any matched seed changes Hero KOs, recoveries, consecutive clears, end reason or boss clears; FAIL if none change. Margin sensitivity PASS if hits, applied damage, applied-amount distribution or min-HP ratio change in any matched seed; FAIL otherwise. The overall pressure claim stays INCONCLUSIVE because no danger threshold is approved.

- REQ REQ-NO-DANGER-BAND: No numeric danger or minimum-HP band is approved; report margins and sensitivity only. (output/orka-7l9-claude-review-disposition.md; owner lab brief)
- REF REF-ORDINARY: Sampled WORLD360 ordinary fights through Chapter 3 kept trainers standing; no counted 20-wave streak, minimum HP or heal formula was measured. (output/orka-7l9-stoneage-world360-direct.md)

No owner-approved pressure threshold exists; measurements and sensitivity are reported without a danger band.

### HP margins — starter-l1-nokaja

Evidence: [starter-l1-nokaja/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/starter-l1-nokaja/observed_events.ndjson) `d79643711beb`

| seed | Hero | start | lowest event-time HP/maxHP | lowest ratio | min absolute HP | hits | applied | applied amounts | healing by source | hits/wave mean · max | MODEL max survivable uniform hits/wave (no heal) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3235774465 | Falie | 85/85 | 70/97 t=359.275 | 0.722 | 70 | 125 | 125 | {"1":125} | {"ordinary_wave_clear":139} | 6.25 · 22 | 16 (4) |
| 3235774465 | Huun | 60/60 | 60/74 t=244.012 | 0.811 | 60 | 58 | 58 | {"1":58} | {"ordinary_wave_clear":81} | 2.9 · 10 | 11 (2) |
| 3235774465 | Runa | 69/69 | 63/69 t=103.599 | 0.913 | 63 | 28 | 28 | {"1":28} | {"ordinary_wave_clear":41} | 1.4 · 6 | 13 (3) |
| 3235774466 | Falie | 85/85 | 75/97 t=153.536 | 0.773 | 75 | 86 | 86 | {"1":86} | {"ordinary_wave_clear":100} | 4.3 · 12 | 16 (4) |
| 3235774466 | Huun | 60/60 | 61/74 t=242.564 | 0.824 | 60 | 48 | 48 | {"1":48} | {"ordinary_wave_clear":71} | 2.4 · 9 | 11 (2) |
| 3235774466 | Runa | 69/69 | 57/75 t=244.566 | 0.76 | 57 | 35 | 35 | {"1":35} | {"ordinary_wave_clear":48} | 1.75 · 12 | 13 (3) |
| 3235774467 | Falie | 85/85 | 77/97 t=152.26 | 0.794 | 77 | 83 | 83 | {"1":83} | {"ordinary_wave_clear":97} | 4.15 · 11 | 16 (4) |
| 3235774467 | Huun | 60/60 | 59/74 t=252.589 | 0.797 | 59 | 39 | 39 | {"1":39} | {"ordinary_wave_clear":64} | 1.95 · 11 | 11 (2) |
| 3235774467 | Runa | 69/69 | 66/75 t=246.396 | 0.88 | 66 | 12 | 12 | {"1":12} | {"ordinary_wave_clear":25} | 0.6 · 3 | 13 (3) |
| 3235774468 | Falie | 85/85 | 86/99 t=1065.545 | 0.869 | 83 | 99 | 99 | {"1":99} | {"ordinary_wave_clear":113} | 4.95 · 13 | 16 (4) |
| 3235774468 | Huun | 60/60 | 48/80 t=360.162 | 0.6 | 48 | 58 | 58 | {"1":58} | {"ordinary_wave_clear":81} | 2.9 · 26 | 11 (2) |
| 3235774468 | Runa | 69/69 | 61/75 t=245.164 | 0.813 | 61 | 17 | 17 | {"1":17} | {"ordinary_wave_clear":30} | 0.85 · 8 | 13 (3) |
| 3235774469 | Falie | 85/85 | 74/97 t=152.766 | 0.763 | 74 | 115 | 115 | {"1":115} | {"ordinary_wave_clear":129} | 5.75 · 20 | 16 (4) |
| 3235774469 | Huun | 60/60 | 50/80 t=370.878 | 0.625 | 50 | 56 | 56 | {"1":56} | {"ordinary_wave_clear":79} | 2.8 · 18 | 11 (2) |
| 3235774469 | Runa | 69/69 | 63/75 t=246.225 | 0.84 | 63 | 14 | 14 | {"1":14} | {"ordinary_wave_clear":27} | 0.7 · 6 | 13 (3) |

MODEL no-heal counterfactual over the frozen trace (stops when altered HP could change later events):

| seed | complete | cutoff | Hero altered min HP before cutoff |
| --- | --- | --- | --- |
| 3235774465 | false | t=771.324 ko_state_differs: Falie observed 92, altered 0; KO changes targeting, actions and wave flow (A8) | Falie 0 (obs 70), Huun 23 (obs 60), Runa 46 (obs 63) |
| 3235774466 | false | t=1326.524 ko_state_differs: Falie observed 96, altered 0; KO changes targeting, actions and wave flow (A8) | Falie 0 (obs 75), Huun 13 (obs 60), Runa 34 (obs 57) |
| 3235774467 | true | none (trace end) | Falie 2 (obs 77), Huun 21 (obs 59), Runa 57 (obs 66) |
| 3235774468 | false | t=1113.472 ko_state_differs: Falie observed 90, altered 0; KO changes targeting, actions and wave flow (A8) | Falie 0 (obs 83), Huun 9 (obs 48), Runa 52 (obs 61) |
| 3235774469 | false | t=991.877 ko_state_differs: Falie observed 97, altered 0; KO changes targeting, actions and wave flow (A8) | Falie 0 (obs 74), Huun 13 (obs 50), Runa 55 (obs 63) |

### Matched defensive-gear sensitivity (OBS)

- gear-def10 (same three bodies with +10 DEF each): outcome change **PASS**, margin change **PASS**
  - seed 3235774465: base {"heroKOs":1,"recoveries":1,"clears":3,"endReason":"max_waves","bossClears":0} hits=550 applied=550 min ratios {"Falie":0.012,"Huun":0.657,"Runa":0.623} | variant {"heroKOs":1,"recoveries":1,"clears":3,"endReason":"max_waves","bossClears":0} hits=187 applied=187 min ratios {"Falie":1,"Huun":0.014,"Runa":0.768}
  - seed 3235774466 (candidate stall: base 4387.856s / variant 17.263s without combat events; clear counts confounded): base {"heroKOs":0,"recoveries":0,"clears":4,"endReason":"timeout","bossClears":0} hits=117 applied=117 min ratios {"Falie":0.541,"Huun":0.671,"Runa":0.884} | variant {"heroKOs":0,"recoveries":0,"clears":20,"endReason":"max_waves","bossClears":0} hits=84 applied=84 min ratios {"Falie":1,"Huun":0.857,"Runa":0.855}
  - seed 3235774467: base {"heroKOs":2,"recoveries":2,"clears":5,"endReason":"max_waves","bossClears":0} hits=647 applied=647 min ratios {"Falie":0.012,"Huun":0.014,"Runa":0.014} | variant {"heroKOs":0,"recoveries":0,"clears":20,"endReason":"max_waves","bossClears":0} hits=72 applied=72 min ratios {"Falie":1,"Huun":0.857,"Runa":0.884}
  - seed 3235774468 (candidate stall: base 17.13s / variant 4467.727s without combat events; clear counts confounded): base {"heroKOs":1,"recoveries":1,"clears":15,"endReason":"max_waves","bossClears":0} hits=589 applied=589 min ratios {"Falie":0.012,"Huun":0.571,"Runa":0.667} | variant {"heroKOs":0,"recoveries":0,"clears":3,"endReason":"timeout","bossClears":0} hits=29 applied=29 min ratios {"Falie":1,"Huun":0.857,"Runa":0.768}
  - seed 3235774469: base {"heroKOs":1,"recoveries":1,"clears":15,"endReason":"max_waves","bossClears":0} hits=492 applied=492 min ratios {"Falie":0.012,"Huun":0.786,"Runa":0.812} | variant {"heroKOs":0,"recoveries":0,"clears":20,"endReason":"max_waves","bossClears":0} hits=83 applied=83 min ratios {"Falie":1,"Huun":0.857,"Runa":0.884}
- gear-hp30 (same three bodies with +30 HP each): outcome change **PASS**, margin change **PASS**
  - seed 3235774465 (candidate stall: base 17.936s / variant 3165.941s without combat events; clear counts confounded): base {"heroKOs":1,"recoveries":1,"clears":3,"endReason":"max_waves","bossClears":0} hits=550 applied=550 min ratios {"Falie":0.012,"Huun":0.657,"Runa":0.623} | variant {"heroKOs":3,"recoveries":3,"clears":3,"endReason":"timeout","bossClears":0} hits=462 applied=801 min ratios {"Falie":0.009,"Huun":0.6,"Runa":0.667}
  - seed 3235774466 (candidate stall: base 4387.856s / variant 17.601s without combat events; clear counts confounded): base {"heroKOs":0,"recoveries":0,"clears":4,"endReason":"timeout","bossClears":0} hits=117 applied=117 min ratios {"Falie":0.541,"Huun":0.671,"Runa":0.884} | variant {"heroKOs":3,"recoveries":3,"clears":6,"endReason":"max_waves","bossClears":0} hits=483 applied=870 min ratios {"Falie":0.009,"Huun":0.57,"Runa":0.677}
  - seed 3235774467: base {"heroKOs":2,"recoveries":2,"clears":5,"endReason":"max_waves","bossClears":0} hits=647 applied=647 min ratios {"Falie":0.012,"Huun":0.014,"Runa":0.014} | variant {"heroKOs":1,"recoveries":1,"clears":11,"endReason":"max_waves","bossClears":0} hits=430 applied=758 min ratios {"Falie":0.009,"Huun":0.5,"Runa":0.677}
  - seed 3235774468: base {"heroKOs":1,"recoveries":1,"clears":15,"endReason":"max_waves","bossClears":0} hits=589 applied=589 min ratios {"Falie":0.012,"Huun":0.571,"Runa":0.667} | variant {"heroKOs":2,"recoveries":2,"clears":10,"endReason":"max_waves","bossClears":0} hits=543 applied=949 min ratios {"Falie":0.009,"Huun":0.33,"Runa":0.667}
  - seed 3235774469: base {"heroKOs":1,"recoveries":1,"clears":15,"endReason":"max_waves","bossClears":0} hits=492 applied=492 min ratios {"Falie":0.012,"Huun":0.786,"Runa":0.812} | variant {"heroKOs":2,"recoveries":2,"clears":7,"endReason":"max_waves","bossClears":0} hits=510 applied=916 min ratios {"Falie":0.009,"Huun":0.45,"Runa":0.646}

## C3-cap-share: Share of Hero hits bound by the hostile-hit cap

Verdict **INCONCLUSIVE**. Tests: model_assumption. Expectation (declared before prospective runs): Observed capped-hit share is UNKNOWN unless an event carries pre-cap damage; none is expected because telemetry records applied HP only. A MODEL interval may be reported under A1/A2 and never as an observation. Verdict INCONCLUSIVE by rule.

- REQ REQ-CAP-UNKNOWN: Report exact capped-hit share as UNKNOWN unless an existing read-only surface exposes pre-cap values; model estimates carry MODEL labels. (owner lab brief 2026-10-16 PDT)

OBS: 6181 Hero hits; pre-cap values observed: 0. Capped-hit share: **UNKNOWN** — no read-only surface exposes pre-cap damage; an applied one-damage hit does not show the cap bound.

OBS actor tier → EnemyData (cap input) tier: {"routine→fodder":45,"routine→routine":5681,"fodder→fodder":434,"boss→boss":21}

MODEL (A1, A2): {"at_bound":5950,"at_bound_or_hp_floor":7,"hp_floor":10,"below_bound":214}; capped share interval [0,0.9638]; definitely uncapped share 0.0346. Hits at the model bound may be capped or may have raw damage equal to the bound; hits below the bound were not capped if A1/A2 and the poll max HP hold.

Retained maximum-hit samples from pinned aggregate reports:

- `OBS t=11.058 W1 Skeleton → Runa HIT physical HP 69→68 applied=1 raw=? cap=?`
- `OBS t=7.602 W1 Skeleton → Runa HIT physical HP 69→68 applied=1 raw=? cap=?`
- `OBS t=10.328 W1 Gobloc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?`
- `OBS t=11.398 W1 Gobloc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?`
- `OBS t=9.253 W1 Gobloc → Runa HIT physical HP 69→68 applied=1 raw=? cap=?`
- `OBS t=9.202 W1 Skeleton → Huun HIT physical HP 1→0 applied=1 raw=? cap=?`
- `OBS t=6.598 W1 Gobloc → Huun HIT physical HP 1→0 applied=1 raw=? cap=?`
- `OBS t=10.117 W1 Gobloc → Runa HIT physical HP 1→0 applied=1 raw=? cap=?`
- `OBS t=11.581 W1 Gobloc → Runa HIT physical HP 1→0 applied=1 raw=? cap=?`
- `OBS t=8.129 W1 Skeleton → Huun HIT physical HP 1→0 applied=1 raw=? cap=?`


## C4-kaja-healing: Kaja skill healing: zero at level 1, possible at level 15

Verdict **INCONCLUSIVE**. Tests: rule. Expectation (declared before prospective runs): Level-1 four-Hero run: Kojonn skill healing is exactly 0 in every seed (FAIL otherwise). Level-15 four-Hero run: PASS if any seed records Kojonn skill healing > 0; INCONCLUSIVE if none occurs. Outcome change versus the matched three-Hero party is reported separately and is confounded by party size.

- REQ REQ-KAJA-UNLOCK: Kaja is Support; Patchwork healing unlocks at level 15. Approved unlocks are not changed by this lab. (web-runner/src/core/heroDefinitions.mjs; governance/planning/conditional-skill-catalog.md)

- l1 (kaja-l1-four, healer level 1): [kaja-l1-four/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/kaja-l1-four/observed_events.ndjson) `dc4e701d02bb`
  - seed 3235774465: healer skill healing 0, wave-clear healing 206, Hero KOs 0, clears 20
  - seed 3235774466: healer skill healing 0, wave-clear healing 158, Hero KOs 0, clears 20
  - seed 3235774467: healer skill healing 0, wave-clear healing 171, Hero KOs 0, clears 20
  - seed 3235774468: healer skill healing 0, wave-clear healing 170, Hero KOs 0, clears 20
  - seed 3235774469: healer skill healing 0, wave-clear healing 189, Hero KOs 0, clears 20
- l1Control (starter-l1-nokaja, healer level ?): [starter-l1-nokaja/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/starter-l1-nokaja/observed_events.ndjson) `d79643711beb`
  - seed 3235774465: healer skill healing 0, wave-clear healing 261, Hero KOs 0, clears 20
  - seed 3235774466: healer skill healing 0, wave-clear healing 219, Hero KOs 0, clears 20
  - seed 3235774467: healer skill healing 0, wave-clear healing 186, Hero KOs 0, clears 20
  - seed 3235774468: healer skill healing 0, wave-clear healing 224, Hero KOs 0, clears 20
  - seed 3235774469: healer skill healing 0, wave-clear healing 235, Hero KOs 0, clears 20
- l15 (kaja-l15-four, healer level 15): [kaja-l15-four/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/kaja-l15-four/observed_events.ndjson) `f8871b366563`
  - seed 3235774465: healer skill healing 0, wave-clear healing 31, Hero KOs 0, clears 20
  - seed 3235774466: healer skill healing 0, wave-clear healing 29, Hero KOs 0, clears 20
  - seed 3235774467: healer skill healing 0, wave-clear healing 29, Hero KOs 0, clears 20
  - seed 3235774468: healer skill healing 0, wave-clear healing 35, Hero KOs 0, clears 20
  - seed 3235774469: healer skill healing 0, wave-clear healing 29, Hero KOs 0, clears 20
- l15Control (kaja-l15-three, healer level ?): [kaja-l15-three/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/kaja-l15-three/observed_events.ndjson) `c6803ac7ef49`
  - seed 3235774465: healer skill healing 0, wave-clear healing 23, Hero KOs 0, clears 20
  - seed 3235774466: healer skill healing 0, wave-clear healing 25, Hero KOs 0, clears 20
  - seed 3235774467: healer skill healing 0, wave-clear healing 28, Hero KOs 0, clears 20
  - seed 3235774468: healer skill healing 0, wave-clear healing 33, Hero KOs 0, clears 20
  - seed 3235774469: healer skill healing 0, wave-clear healing 25, Hero KOs 0, clears 20

Outcome change (OBS, confounded by party size): L1 NO_OUTCOME_DIFFERENCE; L15 NO_OUTCOME_DIFFERENCE.

## C5-first-boss: First boss: underprepared timeouts, progressed wins, earned arrival clears

Verdict **PASS**. Tests: fixture. Expectation (declared before prospective runs): Fixed-gear synthetic sweep at levels 1–5 (one first attempt per seed): level 1 attempts mostly (>50%) time out with ≥1 living Hero; level 5 clears in every seed; report the lowest level with any clear and with all clears. Fresh-save earned run (lamp seed 4242, Auto-Equip on, summon after 4 ordinary clears following a failed attempt): PASS per seed if a boss clear occurs before 3 timeouts; FAIL if 3 timeouts occur first; INCONCLUSIVE on harness timeout.

- REQ REQ-BOSS: Repeated underprepared boss attempts mostly time out with living parties and progressed attempts win across five seeds; Wishfire keeps its authored 18-second timer. (bd show ORKA-7l9 acceptance 3)
- REQ REQ-LAB-BOSS: Separate synthetic level-1/level-5 results from a fresh-save earned arrival; support a fixed-gear level-1–5 sweep. (owner lab brief 2026-10-16 PDT)
- REF REF-BOSS-GAUGE: Underprepared early chapter bosses exhausted the blue gauge with trainers standing (Chapter 2-20 failed at 42% boss HP with four green portraits); earned changes preceded later wins. Numeric timer unknown. (output/orka-7l9-stoneage-world360-direct.md)

| scenario | level | class | timing | first-attempt clears | timeouts | seeds | attempt detail | admissible |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| boss-sweep-l1 | 1 | synthetic | prospective | 0 | 5 | 5 | 3235774465:BOSS_TIMEOUT 23/231 living 3; 3235774466:BOSS_TIMEOUT 40/231 living 3; 3235774467:BOSS_TIMEOUT 34/231 living 3; 3235774468:BOSS_TIMEOUT 40/231 living 3; 3235774469:BOSS_TIMEOUT 27/231 living 3 | yes |
| boss-sweep-l2 | 2 | synthetic | prospective | 5 | 0 | 5 | 3235774465:BOSS_CLEAR; 3235774466:BOSS_CLEAR; 3235774467:BOSS_CLEAR; 3235774468:BOSS_CLEAR; 3235774469:BOSS_CLEAR | yes |
| boss-sweep-l3 | 3 | synthetic | prospective | 5 | 0 | 5 | 3235774465:BOSS_CLEAR; 3235774466:BOSS_CLEAR; 3235774467:BOSS_CLEAR; 3235774468:BOSS_CLEAR; 3235774469:BOSS_CLEAR | yes |
| boss-sweep-l4 | 4 | synthetic | prospective | 5 | 0 | 5 | 3235774465:BOSS_CLEAR; 3235774466:BOSS_CLEAR; 3235774467:BOSS_CLEAR; 3235774468:BOSS_CLEAR; 3235774469:BOSS_CLEAR | yes |
| boss-sweep-l5 | 5 | synthetic | prospective | 5 | 0 | 5 | 3235774465:BOSS_CLEAR; 3235774466:BOSS_CLEAR; 3235774467:BOSS_CLEAR; 3235774468:BOSS_CLEAR; 3235774469:BOSS_CLEAR | yes |
| pinned-boss-l1 | 1 | synthetic | retrospective | 0 | 5 | 5 | 3235774465:BOSS_TIMEOUT 39/231 living 3; 3235774465:BOSS_TIMEOUT 57/231 living 3; 3235774466:BOSS_TIMEOUT 27/231 living 3; 3235774466:BOSS_TIMEOUT 51/231 living 3; 3235774467:BOSS_TIMEOUT 47/231 living 3; 3235774467:BOSS_TIMEOUT 54/231 living 3; 3235774468:BOSS_TIMEOUT 39/231 living 3; 3235774468:BOSS_TIMEOUT 40/231 living 3; 3235774469:BOSS_TIMEOUT 40/231 living 3; 3235774469:BOSS_TIMEOUT 66/231 living 3 | yes |
| pinned-boss-l5 | 5 | synthetic | retrospective | 5 | 0 | 5 | 3235774465:BOSS_CLEAR; 3235774466:BOSS_CLEAR; 3235774467:BOSS_CLEAR; 3235774468:BOSS_CLEAR; 3235774469:BOSS_CLEAR | yes |

Synthetic fixed-gear threshold (OBS): lowest level with any first-attempt clear L2; all seeds clear L2; levels measured 1, 2, 3, 4, 5.

Earned arrival: **PASS** [earned-fresh/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/earned-fresh/observed_events.ndjson) `445eb1c02f30`
- seed 3235774465: PASS; ordinary clears before first boss 4; arrival Falie L1 61/94 CP 64.3, Huun L1 66/69 CP 74.1, Runa L1 75/75 CP 76, Kojonn L1 85/86 CP 69.3; outcomes BOSS_CLEAR; surrenders excluded 0 (lamp actions during boss 1); end max_bosses
- seed 3235774466: PASS; ordinary clears before first boss 4; arrival Falie L1 70/89 CP 60.9, Huun L1 67/76 CP 81.8, Runa L1 69/69 CP 70.4, Kojonn L1 84/84 CP 71.4; outcomes BOSS_CLEAR; surrenders excluded 0 (lamp actions during boss 0); end max_bosses
- seed 3235774467: PASS; ordinary clears before first boss 4; arrival Falie L1 74/89 CP 60.9, Huun L1 70/70 CP 69.8, Runa L1 69/69 CP 70.4, Kojonn L1 84/84 CP 71.4; outcomes BOSS_CLEAR; surrenders excluded 0 (lamp actions during boss 0); end max_bosses
- seed 3235774468: PASS; ordinary clears before first boss 4; arrival Falie L1 81/89 CP 60.9, Huun L1 69/70 CP 69.8, Runa L1 69/69 CP 70.4, Kojonn L1 84/84 CP 71.4; outcomes BOSS_CLEAR; surrenders excluded 0 (lamp actions during boss 1); end max_bosses
- seed 3235774469: PASS; ordinary clears before first boss 4; arrival Falie L1 81/89 CP 60.9, Huun L1 62/76 CP 81.8, Runa L1 69/69 CP 70.4, Kojonn L1 82/84 CP 71.4; outcomes BOSS_CLEAR; surrenders excluded 0 (lamp actions during boss 0); end max_bosses

## C6-recovery: Forced-KO recovery resumes productive farming

Verdict **FAIL**. Tests: rule. Expectation (declared before prospective runs): Per seed: an initial Hero KO, a recovery event restoring every deployed Hero to its event-time max HP, the same region/stage/wave across the recovery transition, then ≥20 consecutive ordinary clears with no additional Hero KO, gap, ambiguous transition or deadlock. The boss is held (no summon) so ordinary farming continues at readiness. Timeout short of 20 without a failure is INCONCLUSIVE.

- REQ REQ-RECOVERY: Forced any-Hero-KO recovery restores the full party on the current stage/wave and productive retry occurs without a softlock or hidden cumulative HP loss. (bd show ORKA-7l9 acceptance 4)
- REQ REQ-LAB-RECOVERY: Initial forced Hero KO, full-party restore on the same stage/wave, then five seeds with 20 consecutive later ordinary clears and no additional KO, gap, ambiguous transition, or deadlock. (owner lab brief 2026-10-16 PDT)

### recovery-onehp (prospective) — FAIL

Evidence: [recovery-onehp/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/recovery-onehp/observed_events.ndjson) `05ed50c0992f`

| seed | verdict | initial KO | restored | same stage/wave | post-recovery clears | stages cleared | longest event silence s | extra KOs | boss attempts | end | reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3235774465 | FAIL | Huun t=8.666 | Falie 85/85, Huun 60/60, Runa 69/69 | true | 2 | 1-2 | 20.004 | Falie t=422.332 1-2 W3; Falie t=2274.144 1-2 W4 |  | max_waves | 2 additional Hero KO(s) |
| 3235774466 | FAIL | Huun t=6.599 | Falie 85/85, Huun 60/60, Runa 69/69 | true | 11 | 1-2 | 17.871 | Falie t=1246.902 1-2 W4 |  | max_waves | 1 additional Hero KO(s) |
| 3235774467 | INCONCLUSIVE | Huun t=7.652 | Falie 85/85, Huun 60/60, Runa 69/69 | true | 1 | 1-2 | 7088.788 | 0 |  | timeout | 1 post-recovery clears < 20 (end timeout); candidate softlock: no combat event or clear for 7088.788s from t=107.428 (harness deadlock detector did not fire) |
| 3235774468 | FAIL | Runa t=10.928 | Falie 85/85, Huun 60/60, Runa 69/69 | true | 11 | 1-2 | 17.266 | Huun t=1200.602 1-2 W4 |  | max_waves | 1 additional Hero KO(s) |
| 3235774469 | FAIL | Huun t=7.465 | Falie 85/85, Huun 60/60, Runa 69/69 | true | 7 | 1-2 | 17.732 | Falie t=800.743 1-2 W4 |  | max_waves | 1 additional Hero KO(s) |

MODEL control replay: CONSISTENT_WITH_CONTROL over 2940 checks.


## Scenario provenance

| scenario | timing | fixture class | evidence | game source | admissible | problems |
| --- | --- | --- | --- | --- | --- | --- |
| starter-l1-nokaja | prospective | synthetic | [starter-l1-nokaja/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/starter-l1-nokaja/observed_events.ndjson) `d79643711beb` | unchanged | yes |  |
| kaja-l1-four | prospective | synthetic | [kaja-l1-four/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/kaja-l1-four/observed_events.ndjson) `dc4e701d02bb` | unchanged | yes |  |
| kaja-l15-three | prospective | synthetic | [kaja-l15-three/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/kaja-l15-three/observed_events.ndjson) `c6803ac7ef49` | unchanged | yes |  |
| kaja-l15-four | prospective | synthetic | [kaja-l15-four/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/kaja-l15-four/observed_events.ndjson) `f8871b366563` | unchanged | yes |  |
| gear-base | prospective | synthetic | [gear-base/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/gear-base/observed_events.ndjson) `970f5f45ef3e` | unchanged | yes |  |
| gear-def10 | prospective | synthetic | [gear-def10/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/gear-def10/observed_events.ndjson) `d2895bfa2628` | unchanged | yes |  |
| gear-hp30 | prospective | synthetic | [gear-hp30/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/gear-hp30/observed_events.ndjson) `26be56b7c918` | unchanged | yes |  |
| boss-sweep-l1 | prospective | synthetic | [boss-sweep-l1/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/boss-sweep-l1/observed_events.ndjson) `e04a525f3123` | unchanged | yes |  |
| boss-sweep-l2 | prospective | synthetic | [boss-sweep-l2/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/boss-sweep-l2/observed_events.ndjson) `8dc4466ed517` | unchanged | yes |  |
| boss-sweep-l3 | prospective | synthetic | [boss-sweep-l3/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/boss-sweep-l3/observed_events.ndjson) `38efbce1d820` | unchanged | yes |  |
| boss-sweep-l4 | prospective | synthetic | [boss-sweep-l4/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/boss-sweep-l4/observed_events.ndjson) `0b05921a27e1` | unchanged | yes |  |
| boss-sweep-l5 | prospective | synthetic | [boss-sweep-l5/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/boss-sweep-l5/observed_events.ndjson) `efc80a1ab9ea` | unchanged | yes |  |
| earned-fresh | prospective | earned | [earned-fresh/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/earned-fresh/observed_events.ndjson) `445eb1c02f30` | unchanged | yes |  |
| recovery-onehp | prospective | forced | [recovery-onehp/observed_events.ndjson](/private/tmp/orka-7l9-lab/runs/recovery-onehp/observed_events.ndjson) `05ed50c0992f` | unchanged | yes |  |
| pinned-starter-l1 | retrospective | synthetic | [orka-7l9-wave-heal-five-seed-clean/balance_metrics.json](/private/tmp/orka-7l9-wave-heal-five-seed-clean/balance_metrics.json) `102c044ab46a` | unchanged | yes |  |
| pinned-fourhero-l1 | retrospective | synthetic | [orka-7l9-wave-heal-healer-five-seed-clean/balance_metrics.json](/private/tmp/orka-7l9-wave-heal-healer-five-seed-clean/balance_metrics.json) `7da25408db8c` | unchanged | yes |  |
| pinned-boss-l1 | retrospective | synthetic | [orka-7l9-current-boss-level1-five/balance_metrics.json](/private/tmp/orka-7l9-current-boss-level1-five/balance_metrics.json) `df4ce7e76cf7` | unchanged | yes |  |
| pinned-boss-l5 | retrospective | synthetic | [orka-7l9-current-boss-level5-five/balance_metrics.json](/private/tmp/orka-7l9-current-boss-level5-five/balance_metrics.json) `86035a857cee` | unchanged | yes |  |
| pinned-onehp-oneway | retrospective | forced | [orka-7l9-current-stage2-onehp-five/balance_metrics.json](/private/tmp/orka-7l9-current-stage2-onehp-five/balance_metrics.json) `41e162615742` | unchanged | yes |  |

## Model assumptions

| id | name | statement | basis |
| --- | --- | --- | --- |
| A1 | hostile-hit cap | In continuous combat an enemy hit on a Hero applies at most max(1, floor(maxHP × fraction[tier])) HP, with fractions fodder/routine 0.02, hard 0.08, elite 0.12, boss 0.18. Applied HP may be lower than the bound (raw below bound or HP floor). | transcribed from candidate web-runner/src/core/routineEnemyScaling.mjs and web-runner/modules/heroCommands.mjs; not imported |
| A2 | cap tier input | The cap tier is the EnemyData row tier looked up by enemy name (combatTier, then routineTier, default routine), not the spawned actor tier. | code reading of heroCommands.mjs applyDamage; the harness logs both tiers so disagreement stays visible |
| A3 | ordinary wave-clear respite | Each living Hero below max HP gains min(maxHP, hp + ceil(0.15 × maxHP)) − hp when an ordinary wave clears. | governance/product/player-living-guide.md (15% respite) |
| A4 | defeat recovery | Ordinary-defeat and boss-timeout recovery restore every deployed Hero to full max HP. | player-living-guide.md recovery rules |
| A5 | boss-clear restore | Boss victory restores every Hero to full HP. The runtime does not log this restore, so the model applies it at the observed boss-clear poll and accepts either pre- or post-restore HP for the next Hero event in that poll window. | player-living-guide.md; unlogged HP assignment observed by code reading |
| A6 | HP continuity | Current HP changes only through logged damage, heal and recovery events, A5, and max-HP decreases that clamp current HP. Max-HP increases (level-up, gear) do not change current HP. | player-living-guide.md level-up rule; equipmentStorage clamp |
| A7 | boss timer | A boss attempt times out once 18 game seconds elapse with the boss alive; a timeout records elapsed ≥ 18. | player-living-guide.md authored 18-second gauge |
| A8 | enemy targeting | Enemy target choice reads Hero HP only through living/KO status (provoke, preferred, stable nearest). | code reading of selectContinuousEnemyTarget in web-runner/src/core/arenaCombat.mjs |
| A9 | Hero HP guards | Unlocked Hero skills whose conditions read Hero HP ratios are listed in HP_GUARDS; other unlocked skills do not read Hero HP. | transcribed from heroDefinitions.mjs condition labels and unlock levels |
| A10 | cadence unknown | Hits per wave are not modeled from mechanics. The survival envelope sweeps a declared integer range instead of fitting one value. | declared ignorance |
| A11 | envelope worst case | For the survival envelope every hit applies the A1 bound at opening max HP, and max HP stays constant. | declared simplification |

Timeline: [timeline.md](timeline.md)
