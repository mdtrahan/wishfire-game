# ORKA-bnny Hero Target/Selector Sync Eval Goal

## Goal
Prove the hero target bug stays fixed by validating the three layers together: automatic target choice, queued `PendingHeroHits[].targetUID`, and the rendered enemy selector.

## Diff Review
- `0088665` fixed automatic `HERO_SINGLE` to ignore stale `SelectedEnemyUID` unless the current actor owns a pending manual target.
- `7fa6322` fixed dev autoplay pending target resolution to use `RuntimeRandom` instead of `livingEnemies[0]`.
- `5c69232` fixed the visible selector to prefer queued hit target before stale selected enemy fallback.

## Eval Command
Run `npm run eval:target-selector-sync`.

## Passing Means
- Automatic hero single attacks choose a fresh living enemy through runtime RNG when no pending manual target owns selection.
- Manual pending `HERO_SINGLE` still preserves the explicitly selected enemy.
- Dev autoplay pending resolution spreads target selection across living enemies instead of first-enemy fallback.
- The selector displays the queued hit target before falling back to selected enemy state.
- Existing supergem/pending handoff contracts still pass.

## Failure Classes
- Way off: stale selected-enemy ownership returns, first-enemy fallback returns, selector reads only `SelectedEnemyUID`, or any focused behavior contract fails.
- Slightly off: the behavior still appears correct but the eval command, package shortcut, or focused coverage is missing.

## Rollback
This goal adds validation only. If it breaks unexpectedly, revert the eval/doc/script commit and keep the already-merged runtime fix intact.
