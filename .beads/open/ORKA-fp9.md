id: ORKA-fp9
title: [BUG] Debuff application reliability hardening (Kojonn blocker)
priority: P0
status: done

## Objective
Keep enemy debuff apply/stack/expire behavior deterministic and resilient to invalid state.

## Resolution
- Previously implemented and still verified in the current runtime mirrors.
- Debuff state normalization, apply/decay ownership, and deterministic slot eviction remain intact.

## Validation
- `npm test -- tests/debuffLifecycleReliabilityContract.test.js tests/traitHookFrameworkContract.test.js tests/blueBuffLifecycleContract.test.js` (7/7 pass)
