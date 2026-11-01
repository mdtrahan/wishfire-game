use crate::Archetype;
pub use wf_combat::tuning::*;
pub(crate) const ESCALATION_INTERVAL: f32 = 25.;
pub(crate) const ESCALATION_COOLDOWN: f32 = 0.9;
pub(crate) const ESCALATION_RADIUS: f32 = 10.;
pub(crate) const ESCALATION_CAP: u32 = 4;
pub(crate) const STAGE_HP_SCALE: f32 = 1.2;
pub(crate) const STAGE_ATK_SCALE: f32 = 1.4;
pub(crate) const ENEMY_CYCLE_HP: f32 = 1.75;
pub(crate) const ENEMY_CYCLE_ATK: f32 = 5.72;
pub(crate) const ATTACK_BOON_RELATIVE_CAP: f32 = 1.5;
pub(crate) const DEFENSE_BOON_RELATIVE_CAP: f32 = 1.3;
pub(crate) const MINI_WAVES: u32 = crate::stage_script::STAGE_1.len() as u32 - 1;
pub(crate) const TIER_HP: [f32; 3] = [1., 1.20, 1.45];
pub(crate) const TIER_ATK: [f32; 3] = [1., 2.2, 4.847];
pub(crate) const ENEMY_WAVE_RAMP: f32 = 0.03;
pub(crate) const BOSS_BASE_TIER_HP: [f32; 3] = [1., 2.3, 1.70];
pub(crate) const BOSS_BASE_TIER_ATK: [f32; 3] = [1., 2., 1.78];
pub(crate) const BOSS_TIER_HP: [f32; 3] = [1.3, 1.5, 2.5];
pub(crate) const REWARD_BANNER_SECONDS: f32 = 2.;
pub(crate) const CHEST_OPEN: f32 = 0.6;
pub(crate) const CHEST_HALF_WIDTH: f32 = 24.;
pub(crate) const CHEST_HALF_HEIGHT: f32 = 16.;
pub(crate) const CHEST_SIDE_GAP: f32 = 24.;
pub(crate) const CHEST_FRONT_GAP: f32 = 24.;
pub(crate) const CHEST_STAND_TOLERANCE: f32 = 2.;
fn cycle_scales(stage: u32) -> (f32, f32) {
    let (mut hp, mut atk) = (1., 1.);
    for _ in 0..(stage - 1) / 3 {
        hp *= STAGE_HP_SCALE;
        atk *= STAGE_ATK_SCALE;
    }
    (hp, atk)
}
pub(crate) fn stage_scales(stage: u32, tier: u8) -> (f32, f32) {
    let k = (tier - 1) as usize;
    let (mut hp, mut atk) = (TIER_HP[k], TIER_ATK[k]);
    for _ in 0..(stage - 1) / 3 {
        hp *= ENEMY_CYCLE_HP;
        atk *= ENEMY_CYCLE_ATK;
    }
    (hp, atk)
}
pub(crate) fn spawn_scales(stage: u32, tier: u8, outer_wave: usize, kind: Archetype) -> (f32, f32) {
    if is_boss(kind) {
        let (hp, atk) = cycle_scales(stage);
        let k = (tier - 1) as usize;
        return (hp * BOSS_BASE_TIER_HP[k], atk * BOSS_BASE_TIER_ATK[k]);
    }
    let (hp, atk) = stage_scales(stage, tier);
    let ramp = 1. + ENEMY_WAVE_RAMP * outer_wave as f32;
    (hp * ramp, atk * ramp)
}
pub(crate) fn empty_buffs() -> crate::PartyBuffs {
    crate::PartyBuffs {
        attack: 1.,
        defense: 1.,
        range: 1.,
        attack_speed: 1.,
    }
}
pub const HP_BOON_FRACTION: [f32; 3] = [0.10, 0.15, 0.20];
pub const HP_BOON_CAP: f32 = 1.5;
pub const RANGE_BOON_CAP: f32 = 1.8;
pub const ATTACK_SPEED_BOON_CAP: f32 = 1.5;
pub const VICTORY_HOLD: f32 = 2.2;
pub const VICTORY_FADE: f32 = 0.5;
pub const WIPE_FADE: f32 = 0.6;
pub const FADE_IN: f32 = 0.5;
pub const BOSS_RECHARGE_PER_LEVEL: f32 = 0.4;
