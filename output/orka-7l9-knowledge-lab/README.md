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
- `sample/` — durable evaluator output: `manifest.json`, `claims.json`, `observed.ndjson`, `model.ndjson`, `timeline.md`, `verdict.md`, `verdict.json`.

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

## Limits

- The runtime records applied HP change only. Exact capped-hit share is UNKNOWN; MODEL may bound it under declared assumptions A1/A2.
- Max HP is sampled at polls, so an event-time HP ratio near an Auto-Equip change is marked uncertain.
- Wave clears, boss outcomes and recovery transitions are poll-time records; combat events carry runtime event time.
- Boss-clear restoration is not logged by the runtime; the model applies it as assumption A5.
- Counterfactuals copy observed hits and stop at the first altered KO, Hero-HP skill-guard crossing, clamped heal, unknown raw hit or event gap. Results after the cutoff are UNKNOWN.
- No danger band is approved, so the pressure claim reports measurements and matched gear sensitivity and stays INCONCLUSIVE.
