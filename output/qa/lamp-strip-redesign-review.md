# Lamp strip redesign: visual comparison and player proof

Build: owned `wt-ORKA-0ln-lamp`, branch `codex/ORKA-0ln-lamp`, served at `http://localhost:8027/web-runner/index.html?strip-redesign=1`. Changes remain in the lamp MVP lane; no merge or publication.

The owner's clarification keeps lamp taps as manual emissions and speech-counter taps as storage access. The purple bar measures saved essence toward the next lamp upgrade. Spending essence changes the badge to the exact saved tier and recalculates progress against that tier's cost. Hero EXP, upgrade costs, Auto's all-four-Lv5 gate, emission cooldown, raw arrival ordering, equip, and dismantle rules are preserved.

## Annotated iterations

`test-results/lamp/strip-redesign/annotated-iterations.png` compares the previous player strip, supplied reference, first pass, second pass and final pass at an identical width. Cyan marks the gear region; orange marks the lamp/controls/tier. Component labels stay outside the screenshots. Supplied reference and before images are retained in this folder; `lamp-annotate-strip.py` regenerates the comparison.

Corrections from the comparisons:
- Removed width-derived vertical padding, then enlarged painted gear art without altering atlas cells.
- Increased the supplied lamp's painted footprint; shortened and shifted the level bar beneath it.
- Moved progress fill beyond the level disc so small essence balances remain visible.
- Widened the gear region to match the reference. Scaled strip typography and Auto's border proportionally to avoid compact overflow.

| Measurement, normalized to 360 CSS pixels | Reference | Final | Difference |
|---|---:|---:|---:|
| Strip height | 91.01 | 92 | 0.99 px |
| Gear region width | approximately 261.66 | 261.91 | approximately 0.25 px |
| Lamp painted height | approximately 65.73 | 66.65 | approximately 0.92 px |

Reference component edges are manual estimates. The actual lamp measurement uses the supplied raster's alpha >=128 bounds, excluding faint edge pixels; `painted-metrics.json` preserves inputs. Different rolls, item levels, lamp levels and exact stored counts come from live state. AUTO stays upper-right per the written request; the reference places it upper-left. CSS pills/disc/bar approximate the illustrated chrome, while lamp and puff use the supplied PNGs unchanged. This is a composition match with explicit differences, not a claim that all pixels are identical.

## Video evidence against the active specification

Natural fresh-save recording: `lamp-strip-redesign.webm`, 42.88 seconds, 360×640 CSS pixels, DPR 1, matching bundled Chromium. Ordinary Start, lamp, counter, Skip and Dismantle controls; no injected state. Native in-app browser separately reloaded the same build and exercised the manual lamp and counter. Its natural screenshot is `test-results/lamp/strip-redesign/in-app-final.png`.

Separate disclosed fixture: `lamp-strip-states-fixture.webm`, 15.72 seconds. Four heroes at Lv5 and essence 25 at startup permit the established upgrade and Auto controls to be exercised. No fixture is injected into the user save.

| Criterion | Observed result | Video / playback time | Status |
|---|---|---|---|
| Supplied lamp art, jiggle retained | One new lamp illustration tilts on each manual emission | Natural 00:06–00:24 | Observed |
| Puff precedes item bounce | Blue puff fills the next position, quickly fades, then boots rise and settle | Natural approximately 00:13.9–00:14.5 | Observed |
| Larger five arrivals without rarity initials | Five gear icons retain quality glow and item level; no C/U/R/E/L in the strip | Natural 00:17–00:26 | Observed |
| Exact count in blue speech pill | Counts progress to eight, then zero after conversion and one after the next draw | Natural 00:06–00:26, 00:34–00:40 | Observed |
| Speech counter opens equip storage | Counter opens eight-piece descending CP review | Natural 00:26–00:28 | Observed |
| Manual lamp and existing flow remain | Eight raw emissions, Skip to separate dismantling, essence banner, next-item review | Natural 00:06–00:42 | Observed |
| Locked Auto before level gate | Gray upper-right AUTO with white padlock | Natural throughout combat | Observed |
| Off/on/off Auto states after gate | Gray pill, explicit red ON, explicit gray OFF | Fixture 00:05, 00:09–00:13, 00:14–00:15 | Observed |
| Level and essence progress match saved upgrade | Upgrade spends 20 essence: Level 1 becomes 2; five essence remains against next cost 50 | Fixture 00:06–00:09 | Observed |
| No stale array after dismantling | Zero cache and five empty positions; next burp shows exactly one fresh piece | Natural 00:34–00:40 | Observed |

`puff-timing-annotations.png` samples the final video at approximately 100ms intervals around two emissions, showing puff-only, fade, upward overshoot and settled gear. Whole recordings were inspected through sampled frames; startup loading transitions are included. Timing ranges come from video frames, not script wall-clock logs.

Supplemental checks: 29 core tests, seven offline bundle checks, and the four-phone presentation flow pass. Phone matrix: 360×640/DPR1, 216×384/DPR2, 233×452/DPR2, 316×452/DPR2. The executable lock checks Canvas anchoring, horizontal containment, count-only storage, scaled controls and progress beginning beyond the disc, then runs the existing equip/feedback/dismantle sequence. No captured page errors. This proof covers the redesigned strip and its neighboring flow; it does not certify all game progression or integration with main.
