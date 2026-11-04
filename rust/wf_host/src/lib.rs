//! The WFM combat host: translated from `web-runner/systems/rustCombatRuntime.mjs`,
//! `combatAuthorityDriver.mjs`, `questCombatSession.mjs`, the runtime half of
//! `continuousCombatStage.mjs`, `combatRewardOutbox` and `heroCommands.mjs`.
//! The host owns stage pacing, checkpoints and rewards; combat state lives in `World`.
pub mod progress;
pub mod rewards;
pub mod session;
