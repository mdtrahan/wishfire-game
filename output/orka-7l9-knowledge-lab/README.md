# ORKA-7l9 combat knowledge lab

Standalone checker for the ORKA-7l9 combat claims. It runs the unchanged candidate through the existing balance harness, retains an ordered event log, replays that log through a small independent shadow model, and grades predeclared claims as PASS, FAIL or INCONCLUSIVE with evidence links. It changes no Wishfire gameplay code or balance value. The candidate stays unmerged; this is not QA PASS or Integration Ready.

A passing parser or shadow model is not proof of good combat design. The design verdict stays **NOT PROVEN** whenever survival, meaningful pressure, earned boss progression or recovery evidence is missing.

## Evidence classes

| Label | Meaning | Where it comes from |
| --- | --- | --- |
| `REQ` | owner acceptance rule | live Bead ORKA-7l9 and the owner lab brief, cited in the claim file |
| `REF` | direct StoneAge observation | [WORLD360 direct log](../orka-7l9-stoneage-world360-direct.md); qualitative only |
| `OBS` | unchanged-game observation | `tools/balance_harness.js --eventLog`, or a pinned aggregate report (retrospective) |
| `MODEL` | shadow prediction | `tools/combat_lab/model.mjs`; never counted as an observation |
| `?` / UNKNOWN | not measured or not exposed | e.g. pre-cap damage and whether the cap bound |

## Layout

- `claims/orka-7l9-combat-claims.json` — expectations, scenario inputs, fixture SHA-256 values and result rules. It was committed before the prospective runs; the evaluator rejects prospective evidence that started before that commit or a claim file edited after it.
- `fixtures/` — synthetic level-2–4 sweep saves (the game's own developer level preset, checked against the tracked level-5 fixture byte for byte first) and matched gear lamps (base, +10 DEF, +30 HP on three bodies), validated by the game's conveyor validator. `fixtures-manifest.json` pins their hashes.
- `sample/` — durable evaluator output: `manifest.json`, `claims.json`, `observed.ndjson.gz`, `model.ndjson.gz`, `timeline.md`, `verdict.md`, `verdict.json`.
- [`sample/index.html`](sample/index.html) — light-theme combat run viewer. It plays the complete recorded OBS stream for any scenario and seed at selectable speed, updates Hero HP and progression as events arrive, and can show aligned MODEL checks. Play, pause, step, seek, and jump to the next key event are available. [`sample/report.html`](sample/report.html) retains the claim tables and filtered text view.
- [`sample/sustain.html`](sample/sustain.html) — light-theme live MODEL event stream and test tracker. The current DEF plus regen cases are S19–S25; [casebook](sustain-cases.json), [compact verdicts](sustain-runs/tracker.md), and [runbook](SUSTAIN-RUNBOOK.md) pin conditions and results. Any farming Hero KO is FAIL. Evasion and drain cases are hypothetical diagnostics.

From the repository root, run `python3 -m http.server 8765 --bind 127.0.0.1`, then open `http://localhost:8765/output/orka-7l9-knowledge-lab/sample/` in the Codex in-app browser. This is playback of saved unchanged-game evidence, not a new simulation or a live harness run. The viewer labels poll-time events, missing raw/cap values, and unknown boss HP between samples.

Tool code: [`tools/combat_knowledge_lab.mjs`](../../tools/combat_knowledge_lab.mjs) and [`tools/combat_lab/`](../../tools/combat_lab/). Focused proof: `node --test tests/combatKnowledgeLabContract.test.mjs`.

## Rerun

Print the exact harness command for every prospective scenario, run them from a clean lane, then evaluate:

```sh
node tools/combat_knowledge_lab.mjs commands --claims output/orka-7l9-knowledge-lab/claims/orka-7l9-combat-claims.json
node tools/combat_knowledge_lab.mjs evaluate --claims output/orka-7l9-knowledge-lab/claims/orka-7l9-combat-claims.json --out output/orka-7l9-knowledge-lab/sample
```

Regenerate the synthetic fixtures (refuses if the level preset no longer reproduces the level-5 control):

```sh
node tools/combat_knowledge_lab.mjs fixtures --out output/orka-7l9-knowledge-lab/fixtures
```

Raw harness reports and event logs live under `/private/tmp/orka-7l9-lab/runs/<scenario>/` like earlier ORKA-7l9 reports; `sample/manifest.json` pins their SHA-256 values and source fingerprints.

## Results — 2026-10-17 UTC (2026-10-16 PDT)

Claims were committed at `2ca44d0b` (04:55:56Z). All 14 prospective runs started afterwards and all 19 scenarios served runtime trees identical to candidate `c43f6147`. Full report: [`sample/verdict.md`](sample/verdict.md); timeline: [`sample/timeline.md`](sample/timeline.md); streams: `sample/observed.ndjson.gz`, `sample/model.ndjson.gz`.

**Design verdict: NOT PROVEN** — pressure is INCONCLUSIVE (no approved threshold) and recovery FAILS.

| Claim | Verdict | Observed (OBS) | Model (MODEL) |
| --- | --- | --- | --- |
| C1 starter farming | PASS | 5/5 seeds × 20 clears, 0 KOs, gaps or deadlocks; every clear is a looped Stage 1-1 ready wave; every hit applied 1 HP | replay consistent over 1,071 checks |
| C2 pressure | INCONCLUSIVE by rule | Matched gear, Auto-Equip off: base 5 Hero KOs over 5 seeds; +10 DEF → 1 KO and fewer applied hits in every seed (550→187, 117→84, 647→72, 589→29, 492→83; two pairs truncated by stalls); **+30 HP → 11 KOs and 1.73–1.80 applied HP per hit** (max HP ≥ 100 lifts the cap bound from 1 to 2). Starter per-Hero lowest event-time ratios 0.60–0.91 | no-heal counterfactual reaches an altered Fara KO in 4/5 seeds before its cutoff; envelope: sustained 11–16 capped hits/wave survivable with respite, 2–4 without |
| C3 cap share | INCONCLUSIVE by rule | 6,181 hits; pre-cap values exposed 0; capped share **UNKNOWN**. Actor tier `routine` vs cap-input EnemyData tier `fodder` disagree on 45 of 6,181 hits | capped share ∈ [0, 0.964] under A1/A2 |
| C4 Kaja healing | INCONCLUSIVE | level 1: 0 skill healing in 5/5 seeds (PASS); level 15: 0 in 5/5 — no Hero fell below Patchwork's 75% guard (not triggered) | remove-healer counterfactual not needed (no heals) |
| C5 first boss | PASS (fixture-scoped) | fixed-gear 3-Hero sweep: L1 5/5 timeouts with 3 living Heroes (boss 23–40/231), L2–L5 5/5 clears. Fresh save (4 Heroes, still L1, Auto-Equip gear) clears on the first attempt in 5/5 — the underprepared gate never occurs in earned play | timer checks consistent (A7) |
| C6 recovery | **FAIL** | every forced KO restored all Heroes to full on the same Stage 1-2 wave, but 4/5 seeds took 1–2 further KOs (mostly Stage 1-2 W4) after 2–11 clears; seed 3 stalled | replay consistent over 2,940 checks |

Additional observations:
- **Candidate softlock:** 4 of 70 prospective sessions (recovery s3, gear-base s2, +10 DEF s4, +30 HP s1) went 3,166–7,089 simulated seconds without any combat event or clear until the harness wall timeout; the harness deadlock detector did not fire. In recovery s3 all Heroes targeted an engaged in-reach Gobloc at 6 HP with ready basics while two Goblocs sat in `LUNGE`. Normal maximum silence is about 18 s.
- **Harness artifact fixed during the run:** Auto-Equip opened the Lamp during an earned boss fight, which the game treats as surrender. That run is kept at `/private/tmp/orka-7l9-lab/superseded/earned-fresh-lamp-surrender/` and excluded; `77cdc7d9` pauses Lamp actions during bosses. `97effdf8` closes boss attempts when runtime counters move; sweep levels 1–2 were rerun with it after a load-induced fixture-verification abort (kept under `superseded/`). Sweep levels 3–5 ran at `77cdc7d9`; all their first attempts cleared, so the counter fix does not change them.
- The shadow model's first full pass diverged once (kaja-l1-four seed 3235774467, event #247): an Auto-Equip max-HP rise read in the same poll as a respite heal. That was a model ordering bug, fixed at `7a9cca4c`; after it the model reproduces every observed HP change, respite, recovery and timeout in all 70 traces. That shows the event log accounts for HP, not that the combat is good.

Open measurements: pre-cap damage per hit; an owner-approved pressure band; Kaja level-15 healing under a fixture that drops an ally below 75%; earned progression past Stage 1-1; recovery endurance after the softlock is understood; StoneAge numeric references remain unknown by design.

## Limits

- The runtime records applied HP change only. Exact capped-hit share is UNKNOWN; MODEL may bound it under declared assumptions A1/A2.
- Max HP is sampled at polls, so an event-time HP ratio near an Auto-Equip change is marked uncertain.
- Wave clears, boss outcomes and recovery transitions are poll-time records; combat events carry runtime event time.
- Boss-clear restoration is not logged by the runtime; the model applies it as assumption A5.
- Counterfactuals copy observed hits and stop at the first altered KO, Hero-HP skill-guard crossing, clamped heal, unknown raw hit or event gap. Results after the cutoff are UNKNOWN.
- No danger band is approved, so the pressure claim reports measurements and matched gear sensitivity and stays INCONCLUSIVE.
