# US36 focused verification

Lane: codex/ORKA-5af.1-lamp-upgrades. Foundation: 8cd3900ecc868514d7aba4afaec392c5f6feee9e. Player URL: http://localhost:8031/web-runner/index.html. Full progression goal remains open; this receipt certifies the scoped upgrade seam.

## Behavior

Upgrade confirmation carries the previewed tier into the durable transaction. A stale confirmation cannot buy the next tier. The modal shows current/next rarity weights, capacity, balance, cost and shortfall. Higher next weights have an arrow. MAX cannot spend. This lane retains provisional prices 20/50/100 and foundation weights; approved party rarity gates and income calibration are pending.

## Checks

- node --test tests/lampEquipment.test.mjs: 30/30 PASS. Save rejection, concurrent stale-tier confirmation, insufficient essence, MAX, reload, exact deductions, unchanged gear and hero EXP covered.
- node --test tests/lampPresentation.test.mjs: PASS at 360x640 DPR1, 216x384 DPR2, 233x452 DPR2 and 316x452 DPR2. Repeated clicks, each tier, odds totals, MAX and viewport containment verified. These upgrade cases use disclosed essence200/tier0 fixtures, excluded from natural timing.
- Native in-app Browser: 1280x720 DPR2; CSS zoom1; game canvas405x720, backing810x1440; modal389x588.5; no horizontal overflow. Existing strip geometry remains unchanged.

## Earned-flow recording

lamp-upgrade-earned-flow.webm uses a fresh save with normal inputs, no injected EXP/gear or clock changes. Baseline cadence is manual2s/Auto5s. This recording cannot certify the eight-second trial or 150-draw Lv5 timing hypothesis. upgrade-events.json records snapshots and elapsed wall time from first input; the video clock starts approximately two seconds earlier.

| Event seconds | Event | Observed video frame |
|---|---|---|
| 2.225 | Shortfall preview | 4s |
| 47.300 | Complete descending-CP twenty-item review | 49s |
| 51.411 | 16 dismantled items produce18 essence | 54s |
| 63.238 | Two additional dismantles bring balance22; affordable preview | 66s |
| 66.844 | Repeated confirmation buys tier1 once:20 spent,2 remain; capacity30, next cost50 | 70s |
| 74.308 | Reload preserves tier, balance, four equipped items and cumulativeEXP550 | 77s |

Actual video frames4/49/54/66/70/77 were visually reviewed. Text, controls and complete modal remain readable. The first system-Chrome capture clipped the lower UI and was rejected; the final capture uses installed Playwright Chromium. Earlier video-*.png and upgrade-failure.png are rejected-run artifacts. Reviewed-video-*.png belong to the accepted final recording. Continuous full-goal Lv1-to-Lv5 proof and annotated reference comparison remain outstanding.

## Resource receipt

One ordinary baseline batch:20 draws,4 equipped,16 dismantled,18 essence earned,0 spent. Two further draws were dismantled for4 essence, then20 spent once. Detailed qualities/levels and timings are retained in upgrade-events.json. This sample establishes an affordable player flow; unlucky/upgrade-heavy batches and an owner-selected upgrade frequency are still required for pricing.

## Preservation and limits

The original root and ORKA-0ln lane remain untouched. The foundation receipt identifies the snapshot and divergence. No merge, publication or hook bypass occurred. This foundation has unrelated commits versus current main and is not Integration Ready. EXP policy, Auto review policy, rarity gates, gear level band and legacy handling remain owner decisions.
