# Effective Combat Stat Owner

This contract names the current effective-stat owner boundary. It preserves current formulas and does not authorize balance, initiative, or SimulationCore ownership changes.

## Named Owner

`GetEffectiveStat(ctx, actor, stat)` is the browser runtime owner for reading effective combat stats.

- Primary runtime implementation: `web-runner/modules/functionBank.js`
- Construct-style mirror: `Scripts/functionBank.js`
- Rust/shadow boundary: `__ORKA_EFFECTIVE_STAT_OWNER__` and `createEffectiveStatSimulationPacket`

When the Rust owner hook is available, `GetEffectiveStat` submits the JavaScript projection packet and returns the owner value. When the hook is unavailable, it returns the JavaScript projection.

## Current Formula

The current JavaScript projection is:

- hero: base stat plus matching `PartyBuff_*`
- enemy: base stat minus matching `EnemyDebuffs[uid][stat]`
- all actors: clamp final value at zero

This bead did not change those formulas.

## Consumer Rule

Runtime systems, turn logs, debug surfaces, QA readouts, and future combat features should call `GetEffectiveStat(ctx, actor, stat)` when they need an effective stat.

They may display base stats and visible modifier sources separately, but they should not calculate an effective stat by adding party buffs or subtracting enemy debuffs locally.

If a surface cannot call `GetEffectiveStat`, it should report the effective value as unavailable instead of becoming another owner.

## Allowed Exceptions

- Effective-stat fixtures may encode expected formulas so JavaScript and Rust projections can be compared.
- Packet creation may carry base, buff, debuff, and JavaScript projection values as diagnostics for the Rust owner boundary.
- Source maps and planning docs may spell out the formula for human understanding.

## Stop Conditions

Stop and create a separate bead before:

- moving effective-stat ownership out of `GetEffectiveStat`
- changing the formula or clamps
- changing the Rust owner hook behavior
- changing initiative authority as part of stat cleanup

## Validation

Use focused validation:

- `node --test tests/effectiveStatOwnershipContract.test.js`
- `node --test tests/combatTurnQaReadoutContract.test.js tests/devToolingModalContract.test.js`
- `node --test tests/effectiveStatFixtureContract.test.js` when formula or Rust fixture behavior changes
