# Sustain test beds: operator runbook

These are fixed **MODEL counterfactuals** over one unchanged Wishfire **OBS** event stream. They do not edit game code, change balance, rerun the game, or infer StoneAge's hidden formulas. The source is [sample/observed.ndjson.gz](sample/observed.ndjson.gz), pinned by SHA-256 in [sustain-cases.json](sustain-cases.json). The main stress trace is recovery-onehp session 1, Fara (internal save identity `Falie`), Stage 1-2 wave 3, simulation time 171.201–422.332, starting at 85/85 HP. The earlier forced one-HP setup is outside this interval. Other declared cases use the first two ordinary waves and a separate first-boss trace. Each case pins its own opening HP and time window.

**Actionable lane:** `S19`–`S25` vary only effective incoming-hit mitigation and passive HP regeneration. `S1`–`S18` include evasion, drain, and four-mechanism probes for diagnosis. Wishfire has no baseline evasion or drain stat; their passing MODEL results do not propose adding either. Effective mitigation here is a fraction of applied hit damage, not a verified conversion from Wishfire DEF points.

## Assignment and one command

Assign each conductor distinct case IDs from this table. A conductor runs exactly one command from the repository root:

```sh
node tools/combat_lab/sustain_tracker.mjs --case S4-high-regen
```

Replace the ID with the assigned one. Agents run CLI cases only; the browser viewer is for owner inspection. Do not edit the case file, source log, model, or gameplay code. If the exact source/case/model combination was already processed, the command prints `SKIPPED` and reuses its immutable report. Report only `PASS`, `FAIL`, or `UNKNOWN`, minimum HP, Hero KO count, and report filename.

| ID | Question put to the fixed trace | Declared check |
| --- | --- | --- |
| `S0-baseline` | What happens with no new sustain? | Zero Hero KOs and minimum HP ≥90% |
| `S1-high-defense` | What if each applied hit is reduced by 95%? | Same ordinary sustain check |
| `S2-high-evasion` | What if 95% of incoming hits are evaded? | Same ordinary sustain check |
| `S3-hp-drain` | What if each assumed successful Hero strike every 3 seconds heals 3 HP? | Same ordinary sustain check |
| `S4-high-regen` | What if passive recovery supplies 0.8 HP/s? | Same ordinary sustain check |
| `S5-mixed-sustain` | What if mitigation, evasion, drain, and regen work together at declared strengths? | Same ordinary sustain check |
| `S6-pressure-break` | Does a tenfold synthetic hit-pressure control overcome the same mix? | Zero Hero KOs and minimum HP ≥90% |

`S7`–`S13` bracket the one-knob HP-floor boundaries. `S14`–`S15` use earlier ordinary waves. `S16`–`S18` transfer a hypothetical four-mechanism mix to farming and a boss. The current design lane uses these fixed cases:

| ID | Declared DEF plus regen condition | Check |
| --- | --- | --- |
| `S19-def-regen-low` | 50% effective mitigation, 0.10 HP/s, hard farming wave | No Hero KO; minimum HP ≥90% |
| `S20-def-regen-floor` | 50% effective mitigation, 0.15 HP/s, same wave | Same |
| `S21-def-regen-95` | 60% effective mitigation, 0.20 HP/s, same wave | No Hero KO; minimum HP ≥95% |
| `S22-def-regen-huun` | Same knobs, Hondo's first ordinary wave | Same 95% floor |
| `S23-def-regen-fara-wave2` | Same knobs, Fara's second ordinary wave | Same 95% floor |
| `S24-def-regen-boss` | Same knobs, recorded first-boss hit schedule | No Hero KO |
| `S25-def-regen-boss-pressure` | Same knobs, artificial eightfold first-boss hit pressure | No Hero KO; failure marks a pressure limit only |

Any Hero KO during ordinary farming is an immediate `FAIL`, including `S6`. Stop that model trace at the first KO and report the failure. The 90% floor is a test-bed target chosen to make results judgeable; it is not a measured StoneAge threshold or approved production value.

## Shared tracker

Each run writes one compact immutable `sustain-runs/<case-id>.<digest>.json`: ID, digest, status, minimum HP, Hero KO count and one reason. It stores no event steps or duplicated source log. The shared [sustain-runs/latest.json](sustain-runs/latest.json) is the current machine index; [sustain-runs/tracker.md](sustain-runs/tracker.md) is its short table. `UNKNOWN` means evidence or a declared check is missing or invalid. `SKIPPED` reuses an identical result.

When all conductors finish, the coordinator runs:

```sh
node tools/combat_lab/sustain_tracker.mjs --index
```

This rebuilds the shared index from the immutable reports. Running `--all` processes every declared case and skips identical completed ones. If the pinned source or model changes, the report digest changes; the old reports remain historical and the index marks the new combination `UNKNOWN` until it is run. Assign new case IDs or a new case declaration before varying parameters. Do not reinterpret an old case as a fresh seed.

## Reading a result

`PASS` means only that the **MODEL** met a case's declared HP and KO checks on its frozen hit schedule. The first farming Hero KO is `FAIL`, even if the rest of a trace is incomplete; invalid evidence without a farming KO is `UNKNOWN`. The report's `OBS` enemy KOs stay observations; mitigation, evasion, regen, drain, resulting HP, and model KO are counterfactuals. Drain's outgoing strikes are assumed. Changed HP could alter targeting, skills, and fight duration in the live game. A passing model case needs an actual Wishfire gameplay run before it supports acceptance. The boss pressure multiplier is artificial and says nothing about StoneAge's special-boss scaling.
