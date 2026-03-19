id: ORKA-c4s
title: [FEAT] Persist gem counter state + milestone growth hooks
priority: P1
status: done

## Objective
Persist hero gem counter progress across reloads and expose milestone hook surfaces for future progression systems.

## Resolution
- Previously implemented and still verified in the current runtime.
- Current code still provides:
  - durable save/load seam via localStorage
  - stable per-hero and party gem progress snapshots
  - configurable milestone thresholds and milestone state retrieval

## Validation
- `npm test -- tests/heroGemUsageCounterContract.test.js tests/heroGemUsagePersistenceContract.test.js` (5/5 pass)
- Real browser round-trip pass on `http://127.0.0.1:8095/web-runner/index.html`
  - wrote Huun GREEN progress to `6` with milestone thresholds `[3,5]`
  - confirmed dirty-state flush into `orka.hero_gem_progress.v1`
  - reloaded the page, re-entered runtime, and confirmed exact restore from localStorage
