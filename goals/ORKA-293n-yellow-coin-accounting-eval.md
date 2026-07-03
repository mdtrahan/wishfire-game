# ORKA-293n Yellow Coin Accounting Eval Goal

## Goal
Prove the yellow coin accounting bug is fixed without relying on a single happy-path contract.

## Bead
- `ORKA-293n`: Yellow gem matches award yellow supergem coin-sweep value.
- GitHub mirror: https://github.com/mdtrahan/wishfire-game/issues/139

## Eval Command
Run `npm run eval:yellow-coin-accounting`.

## Passing Means
- Normal non-supergem yellow matches pass only the matched yellow count into `Add_Gold`.
- Normal yellow matches do not count unrelated yellow gems elsewhere on the board.
- Yellow supergem activation uses the board-wide consumed yellow count.
- Yellow supergem coin payout bypasses the normal random gold roll.
- Existing yellow and Huun yellow-supergem focused contracts still pass.

## Multipass Coverage
- Normal yellow match cases cover match counts `0`, `3`, `4`, and `5` against partial and full yellow boards.
- Yellow supergem cases cover consumed counts `0`, `1`, `9`, and `24`.

## Failure Classes
- Way off: normal yellow uses board-wide yellow count, yellow supergem uses normal random gold, or a focused yellow contract fails.
- Slightly off: runtime behavior appears correct but the eval shortcut or supporting focused coverage is missing.

## Rollback
This goal adds validation only. If it breaks unexpectedly, revert the eval/doc/package change and keep the already-merged runtime fix intact.
