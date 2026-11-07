//! `web-runner/src/core/continuousCombatStage.mjs` + `continuousCombatProgressionRules.mjs`:
//! stage state, wave templates, transitions, the seeded spawn plan and enemy activation.
use crate::combat_power::compute_combat_power;
use crate::enemy::{EnemyRow, Tier};
use crate::geometry::{self, footprint_radius, Point};
use crate::jsnum::{hypot, imul, round, to_int32, to_uint32};
use crate::seeded_rng::preview_seeded_rng;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const PACK_INTERVAL_SEC: f64 = 3.;
pub const ORDINARY_CLEAR_HEAL_FRACTION: f64 = 0.15;
pub const PACK_CP_STEP: f64 = 0.06;
pub const BOSS_TIME_LIMIT_SEC: f64 = 30.;
pub const PACKS_PER_WAVE: u32 = 6;
pub const SOLOS_PER_WAVE: u32 = 6;
pub const ALL_PACKS_MASK: u32 = (1 << PACKS_PER_WAVE) - 1;
pub const ENEMIES_PER_WAVE_MAX: u32 = PACKS_PER_WAVE * 6 + SOLOS_PER_WAVE;
const SECTOR_RATIOS: [f64; 6] = [0.12, 0.27, 0.42, 0.57, 0.72, 0.87];
const SOLO_STAT_SCALE: f64 = 0.5;
const SOLO_PACK_CLEARANCE: f64 = 120.;
const SOLO_CLEARANCE: f64 = 150.;
const PACK_BOUNDARY_INSET: f64 = 0.01;
const PACK_COLUMNS: [f64; 3] = [-0.352, 0., 0.352];
pub const BOSS_ENTRY_WIPE_MS: f64 = 440.;
const PACK_WALK_SPEED_SCALE: [f64; 5] = [1., 0.9, 1.12, 0.82, 1.17];
const BOSS_HOME: Point = Point { x: 290., y: 290. };
fn ordinary_level_one_hp_ceiling(tier: Tier) -> Option<f64> {
    match tier { Tier::Fodder => Some(28.), Tier::Routine => Some(45.), Tier::Hard => Some(55.), Tier::Elite => Some(70.), Tier::Boss => None }
}

#[derive(Clone, Debug, PartialEq)]
pub struct WaveTemplate { pub wave: u32, pub boss: bool, pub enemy_names: &'static [&'static str] }
pub const STAGES: [WaveTemplate; 5] = [
    WaveTemplate { wave: 1, boss: false, enemy_names: &["Gobloc", "Skeleton"] },
    WaveTemplate { wave: 2, boss: false, enemy_names: &["Gobloc", "High Gobloc", "Skeleton", "Lizardo"] },
    WaveTemplate { wave: 3, boss: false, enemy_names: &["High Gobloc", "Lizardo", "Orc"] },
    WaveTemplate { wave: 4, boss: false, enemy_names: &["Gobloc", "High Gobloc", "Lizardo", "Orc"] },
    WaveTemplate { wave: 0, boss: true, enemy_names: &["Troll"] },
];

pub fn stages_for_region(_region: u32) -> u32 { 1 }
pub fn waves_for_stage(region: u32) -> u32 {
    let chapter = region.max(1);
    if chapter % 5 == 0 { 5 } else if chapter == 1 { 10 } else if chapter == 2 { 15 } else { 20 }
}
pub fn packs_for_stage(region: u32) -> u32 { if region.max(1) % 5 == 0 { 3 } else { PACKS_PER_WAVE } }
pub fn active_pack_mask(region: u32) -> u32 { if packs_for_stage(region) == PACKS_PER_WAVE { ALL_PACKS_MASK } else { 21 } }
pub fn normalize_pack_mask(value: u32) -> u32 { if value <= ALL_PACKS_MASK { value } else { 0 } }

/// `ContinuousCombatStage` global. Field names follow the JS save/checkpoint shape.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageState {
    pub seed: u32,
    pub region: u32,
    pub stage: u32,
    pub wave: u32,
    pub cleared_pack_mask: u32,
    pub spawned_pack_mask: u32,
    pub boss_available: bool,
    pub boss_summon_required: bool,
    pub boss_armed: bool,
    pub boss_active: bool,
    pub boss_timer_started_at: Option<f64>,
    pub boss_time_limit_sec: Option<f64>,
    pub boss_timeouts: u32,
    pub last_boss_outcome: Option<String>,
    /// Boss timeout receipt (`lastBossTimeout`): opaque record kept for the save.
    #[serde(default)] pub last_boss_timeout: Option<serde_json::Value>,
    #[serde(rename = "bossUID")] pub boss_uid: Option<u32>,
    pub boss_world_x: Option<f64>,
    #[serde(default)] pub boss_camera_center_x: Option<f64>,
    #[serde(default)] pub boss_transition_started_at_ms: Option<f64>,
    #[serde(default)] pub boss_transition_ends_at_ms: Option<f64>,
    pub transitions: u32,
    pub ordinary_wave_clears: u32,
    pub defeat_recoveries: u32,
    pub cleared_bosses: u32,
    pub next_emission_at: f64,
    pub awaiting_pack_arrival: bool,
    pub last_updated_at: f64,
    pub spawn_serial: u32,
}
pub fn create_stage_state(seed: f64, region: u32, stage: u32) -> StageState {
    let normalized_seed = { let s = to_uint32(seed); if s == 0 { 1 } else { s } };
    let region = region.max(1);
    StageState {
        seed: normalized_seed, region, stage: stage.max(1).min(stages_for_region(region)), wave: 1,
        cleared_pack_mask: 0, spawned_pack_mask: 0, boss_available: false, boss_summon_required: false, boss_armed: false, boss_active: false,
        boss_timer_started_at: None, boss_time_limit_sec: None, boss_timeouts: 0, last_boss_outcome: None, last_boss_timeout: None, boss_uid: None, boss_world_x: None,
        boss_camera_center_x: None, boss_transition_started_at_ms: None, boss_transition_ends_at_ms: None,
        transitions: 0, ordinary_wave_clears: 0, defeat_recoveries: 0, cleared_bosses: 0, next_emission_at: 0., awaiting_pack_arrival: false, last_updated_at: 0., spawn_serial: 0,
    }
}
/// `getContinuousCombatStage`: the authored template for the state's wave (or boss).
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct StageView { pub id: String, pub kind: &'static str, pub enemy_names: Vec<&'static str>, pub region: u32, pub stage: u32, pub wave: u32, pub boss: bool }
pub fn get_stage(state: &StageState) -> StageView {
    let region = state.region.max(1);
    let stage = state.stage.max(1).min(stages_for_region(region));
    let wave = state.wave.max(1).min(waves_for_stage(region));
    let template = if state.boss_active { &STAGES[4] } else { &STAGES[((wave - 1) % 4) as usize] };
    StageView { id: format!("{region}-{stage}-{}", if state.boss_active { "boss".to_string() } else { format!("wave-{wave}") }), kind: if template.boss { "boss" } else { "fodder" },
        enemy_names: template.enemy_names.to_vec(), region, stage, wave, boss: template.boss }
}
pub struct Transition { pub stage: StageView, pub state: StageState, pub cleared_boss: Option<String> }
/// `advanceContinuousCombatStage`.
pub fn advance_stage(state: &StageState) -> Transition {
    let current = get_stage(state);
    let transitions = state.transitions + 1;
    if state.boss_active {
        let region = state.region.max(1);
        let current_stage = state.stage.max(1);
        let chapter_complete = current_stage >= stages_for_region(region);
        let next = StageState { region: if chapter_complete { region + 1 } else { region }, stage: if chapter_complete { 1 } else { current_stage + 1 }, wave: 1,
            cleared_pack_mask: 0, spawned_pack_mask: 0, boss_available: false, boss_summon_required: false, boss_armed: false, boss_active: false,
            boss_timer_started_at: None, boss_time_limit_sec: None, last_boss_outcome: Some("clear".into()), boss_uid: None, boss_camera_center_x: None, boss_world_x: None,
            boss_transition_started_at_ms: None, boss_transition_ends_at_ms: None, transitions, cleared_bosses: state.cleared_bosses + 1, ..state.clone() };
        return Transition { stage: get_stage(&next), state: next, cleared_boss: Some(current.id) };
    }
    let waves_per_stage = waves_for_stage(state.region);
    let current_wave = state.wave.max(1).min(waves_per_stage);
    let ordinary_wave_clears = state.ordinary_wave_clears + 1;
    let next = if current_wave >= waves_per_stage {
        StageState { wave: 1, cleared_pack_mask: 0, spawned_pack_mask: 0, boss_available: true, transitions, ordinary_wave_clears, ..state.clone() }
    } else {
        StageState { wave: current_wave + 1, cleared_pack_mask: 0, spawned_pack_mask: 0, transitions, ordinary_wave_clears, ..state.clone() }
    };
    Transition { stage: get_stage(&next), state: next, cleared_boss: None }
}
/// `resetContinuousCombatAfterDefeat`.
pub fn reset_after_defeat(state: &StageState, now: f64) -> StageState {
    let recorded = normalize_pack_mask(state.cleared_pack_mask);
    let active = active_pack_mask(state.region);
    let final_wave_clear = !state.boss_active && state.wave.max(1) >= waves_for_stage(state.region) && (recorded & active) == active;
    let boss_available = state.boss_available || state.boss_active || final_wave_clear;
    StageState { transitions: state.transitions + 1, defeat_recoveries: state.defeat_recoveries + 1, wave: if boss_available { 1 } else { state.wave },
        cleared_pack_mask: if boss_available { 0 } else { recorded }, spawned_pack_mask: 0, boss_available, boss_summon_required: true, boss_armed: false, boss_active: false,
        boss_timer_started_at: None, boss_time_limit_sec: None, boss_camera_center_x: None, boss_world_x: None, boss_transition_started_at_ms: None, boss_transition_ends_at_ms: None,
        boss_uid: None, next_emission_at: now + if boss_available { PACK_INTERVAL_SEC } else { 0. }, awaiting_pack_arrival: false, last_updated_at: now, ..state.clone() }
}
pub fn wave_clear_event_id(state: &StageState) -> String {
    format!("clear:{}-{}-{}-{}-{}", state.region, state.stage, state.transitions, state.wave, if state.boss_active { "boss" } else { "wave" })
}
pub fn boss_time_remaining(state: &StageState, now: f64) -> Option<f64> {
    if !state.boss_active { return None; }
    Some(match state.boss_timer_started_at { None => BOSS_TIME_LIMIT_SEC, Some(started) => (BOSS_TIME_LIMIT_SEC - (now - started)).max(0.) })
}
pub fn boss_control_state(state: &StageState) -> &'static str {
    if state.boss_active { "active" } else if state.boss_armed { "armed" } else if state.boss_available { "available" } else { "locked" }
}

// ---- rows ----
fn scale_row(row: &EnemyRow, scale: f64) -> EnemyRow {
    let s = row.stats6().map(|v| round((if v == 0. { 1. } else { v }) * scale).max(1.));
    let mut scaled = row.with_stats6(s);
    scaled.max_hp = scaled.hp;
    scaled.combat_power = compute_combat_power(scaled.cp_actor());
    scaled.stream_cp_scale = Some(scale);
    scaled
}
fn bound_ordinary_wave_hp(row: EnemyRow, progression_scale: f64) -> EnemyRow {
    let Some(ceiling) = ordinary_level_one_hp_ceiling(row.combat_tier) else { return row };
    let hp = row.hp.min(round(ceiling * progression_scale).max(1.));
    let mut next = EnemyRow { hp, max_hp: hp, ..row };
    next.combat_power = compute_combat_power(next.cp_actor());
    next
}
fn toughen_short_chapter_row(row: EnemyRow) -> EnemyRow {
    let hp = (row.hp * 1.5).ceil().max(1.);
    let mut next = EnemyRow { hp, max_hp: hp, ..row };
    next.combat_power = compute_combat_power(next.cp_actor());
    next
}
pub fn scale_pack_row(row: &EnemyRow, cp_step: f64) -> EnemyRow { scale_row(row, 1. + cp_step.max(0.) * PACK_CP_STEP) }
fn total_scaled_cp(rows: &[&EnemyRow], scale: f64) -> f64 { rows.iter().map(|r| scale_row(r, scale).combat_power).sum() }
fn find_pack_scale(rows: &[&EnemyRow], target_cp: f64) -> f64 {
    let (mut low, mut high) = (0.25, 50.);
    for _ in 0..16 {
        let scale = (low + high) / 2.;
        if total_scaled_cp(rows, scale) < target_cp { low = scale } else { high = scale }
    }
    let distance = |scale: f64| (total_scaled_cp(rows, scale) - target_cp).abs();
    if distance(low) < distance(high) { low } else { high }
}
fn expand_wave_rows<'a>(stage: &StageView, by_name: &BTreeMap<&str, &'a EnemyRow>, catalog: &[EnemyRow], composition_seed: Option<u32>) -> Vec<&'a EnemyRow> {
    let pool: Vec<&EnemyRow> = stage.enemy_names.iter().filter_map(|n| by_name.get(n).copied()).collect();
    if stage.boss || pool.is_empty() { return pool; }
    let boss_names: Vec<&str> = STAGES.iter().filter(|s| s.boss).flat_map(|s| s.enemy_names.iter().copied()).collect();
    let catalog_cp: Vec<f64> = catalog.iter().filter(|r| r.combat_tier != Tier::Boss && !boss_names.contains(&r.name.as_str())).map(|r| compute_combat_power(r.cp_actor())).collect();
    let min_cp = catalog_cp.iter().copied().fold(f64::INFINITY, f64::min);
    let max_cp = catalog_cp.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let average_cp = pool.iter().map(|r| compute_combat_power(r.cp_actor())).sum::<f64>() / pool.len() as f64;
    let strength = if max_cp > min_cp { (average_cp - min_cp) / (max_cp - min_cp) } else { 0.5 };
    let pack_size = if strength <= 0.2 { 3 } else { 2 };
    let count = pack_size * PACKS_PER_WAVE as usize;
    match composition_seed {
        None => (0..count).map(|i| pool[i % pool.len()]).collect(),
        Some(seed) => { let seed = if seed == 0 { 1 } else { seed }; (0..count).map(|i| pool[(preview_seeded_rng(seed as f64, i as f64) * pool.len() as f64).floor() as usize]).collect() }
    }
}

// ---- placement ----
pub struct StreamGeometry { pub spawn_x: f64, pub y: f64, pub walk_speed: f64, pub enemy_size: f64, pub vertical: geometry::VerticalBounds }
fn stream_geometry(state_seed: u32, enemy_size_global: f64, pack_index: f64, rank: f64, sector_index: f64) -> StreamGeometry {
    let vertical = geometry::vertical_bounds();
    let enemy_size = (if enemy_size_global == 0. { 40. } else { enemy_size_global }).max(20.);
    let first_y = vertical.min_y + enemy_size * 0.8;
    let last_y = vertical.max_y - enemy_size * 0.8;
    let seed_mix = (to_int32(state_seed as f64) ^ to_int32(rank * 2654435761.) ^ to_int32(pack_index * 2246822519.)) as u32;
    let sector_count = PACKS_PER_WAVE as f64;
    let sector_order = ((seed_mix as f64 % sector_count).floor() + sector_index.max(0.) * 5.) % sector_count;
    StreamGeometry { spawn_x: 360. + enemy_size * 1.5, y: first_y.max(last_y.min(first_y + sector_order * ((last_y - first_y) / (sector_count - 1.).max(1.)))),
        walk_speed: (enemy_size * 0.9).max(34.) * 0.7, enemy_size, vertical }
}
#[allow(clippy::too_many_arguments)]
fn seeded_pack_foot(state_seed: u32, pack_index: f64, rank: f64, sector: usize, order: f64, sector_size: f64, center_x: f64, center_y: f64, g: &StreamGeometry) -> Result<Point, String> {
    let normalized_order = order.floor().max(0.);
    let member_count = (if sector_size == 0. { normalized_order + 1. } else { sector_size }).floor().min(6.).max(1.) as usize;
    let pack_seed = (to_int32(state_seed as f64) ^ imul(rank + 1., 2654435761.) ^ imul(pack_index + 1., 2246822519.) ^ imul(sector as f64 + 1., 3266489917.)) as u32;
    let radius = (g.enemy_size * 1.45).max(24.);
    let vertical_radius = radius.min(54.);
    let min_spacing = (g.enemy_size * 0.8).min(34.).max(22.);
    let world = geometry::world_bounds();
    let r = footprint_radius(false);
    let (x_min, x_max) = (world.hero_min_x + r, world.hero_max_x - r);
    let y_inset = (g.enemy_size * 0.8).max(r);
    let (y_min, y_max) = (g.vertical.min_y + y_inset, g.vertical.max_y - y_inset);
    let mut placed: Vec<Point> = Vec::new();
    let mut draw = 0.;
    for _ in 0..member_count {
        let mut best: Option<Point> = None;
        let mut best_clearance = f64::NEG_INFINITY;
        for _ in 0..512 {
            let raw_x = preview_seeded_rng(pack_seed as f64, draw); draw += 1.;
            let raw_y = preview_seeded_rng(pack_seed as f64, draw); draw += 1.;
            let dx = (raw_x * 2. - 1.) * radius;
            let dy = (raw_y * 2. - 1.) * vertical_radius;
            if dx * dx + dy * dy > radius * radius { continue; }
            let candidate = Point { x: center_x + dx, y: center_y + dy };
            if candidate.x < x_min || candidate.x > x_max || candidate.y < y_min || candidate.y > y_max { continue; }
            let clearance = if placed.is_empty() { f64::INFINITY } else { placed.iter().map(|p| hypot(candidate.x - p.x, candidate.y - p.y)).fold(f64::INFINITY, f64::min) };
            if clearance > best_clearance { best = Some(candidate); best_clearance = clearance; }
            if clearance >= min_spacing { best = Some(candidate); break; }
        }
        placed.push(best.unwrap_or(Point { x: x_min.max(x_max.min(center_x)), y: y_min.max(y_max.min(center_y)) }));
    }
    let moat = geometry::spawn_moat();
    let len = placed.len() as f64;
    let pack_center = placed.iter().fold(Point { x: 0., y: 0. }, |sum, p| Point { x: sum.x + p.x / len, y: sum.y + p.y / len });
    let pack_min_y = placed.iter().map(|p| p.y).fold(f64::INFINITY, f64::min);
    let pack_max_y = placed.iter().map(|p| p.y).fold(f64::NEG_INFINITY, f64::max);
    let column = PACK_COLUMNS[sector % PACK_COLUMNS.len()];
    let row = sector / PACK_COLUMNS.len();
    let target = Point { x: moat.center_x + world.world_width * column, y: if row == 0 { y_min + PACK_BOUNDARY_INSET } else { y_max - PACK_BOUNDARY_INSET } };
    let offset = Point { x: target.x - pack_center.x, y: if row == 0 { target.y - pack_min_y } else { target.y - pack_max_y } };
    let fits = placed.iter().all(|p| p.x + offset.x >= x_min && p.x + offset.x <= x_max && p.y + offset.y >= y_min && p.y + offset.y <= y_max);
    let moved: Vec<Point> = placed.iter().map(|p| Point { x: p.x + offset.x, y: p.y + offset.y }).collect();
    let clears_moat = moved.iter().all(|p| hypot(p.x - moat.center_x, p.y - moat.center_y) - r >= moat.minimum_enemy_center_distance);
    if !fits || !clears_moat { return Err("continuous combat pack layout cannot fit this authored cloud outside the recovery moat".into()); }
    Ok(moved.get(normalized_order as usize).copied().unwrap_or(*moved.last().unwrap()))
}
fn seeded_solo_foot(state: &StageState, sector: u32, occupied: &[Point], prior: &[Point], enemy_size: f64) -> Result<Point, String> {
    let world = geometry::world_bounds();
    let vertical = geometry::vertical_bounds();
    let moat = geometry::spawn_moat();
    let radius = footprint_radius(false);
    let side = if sector < PACKS_PER_WAVE / 2 { -1. } else { 1. };
    let x_min = if side < 0. { world.hero_min_x + radius } else { moat.center_x + moat.minimum_enemy_center_distance + radius };
    let x_max = if side < 0. { moat.center_x - moat.minimum_enemy_center_distance - radius } else { world.hero_max_x - radius };
    let y_min = vertical.min_y + (enemy_size * 0.8).max(radius);
    let y_max = vertical.max_y - (enemy_size * 0.8).max(radius);
    let band_height = (y_max - y_min) / (PACKS_PER_WAVE / 2) as f64;
    let band = (sector % (PACKS_PER_WAVE / 2)) as f64;
    let (band_min, band_max) = (y_min + band * band_height, y_min + (band + 1.) * band_height);
    let seed_value = if state.seed == 0 { 1. } else { state.seed as f64 };
    let seed = (to_int32(seed_value) ^ imul(state.transitions as f64 + 1., 2246822519.) ^ imul(sector as f64 + 1., 3266489917.)) as u32;
    let valid = |p: Point| hypot(p.x - moat.center_x, p.y - moat.center_y) >= moat.minimum_enemy_center_distance + radius
        && occupied.iter().all(|o| hypot(p.x - o.x, p.y - o.y) >= SOLO_PACK_CLEARANCE)
        && prior.iter().all(|o| hypot(p.x - o.x, p.y - o.y) >= SOLO_CLEARANCE);
    let mut best: Option<Point> = None;
    let mut best_clearance = f64::NEG_INFINITY;
    for (c_min, c_max) in [(band_min, band_max), (y_min, y_max)] {
        for draw in 0..2048 {
            let p = Point { x: x_min + preview_seeded_rng(seed as f64, draw as f64 * 2.) * (x_max - x_min), y: c_min + preview_seeded_rng(seed as f64, draw as f64 * 2. + 1.) * (c_max - c_min) };
            let clearance = occupied.iter().chain(prior.iter()).map(|o| hypot(p.x - o.x, p.y - o.y)).fold(f64::INFINITY, f64::min);
            if clearance > best_clearance && valid(p) { best = Some(p); best_clearance = clearance; }
        }
        if best.is_some() { break; }
    }
    best.ok_or_else(|| "continuous combat solo placement cannot fit outside the recovery moat and pack clouds".into())
}

/// One spawn-plan entry (`buildContinuousCombatSpawnPlan` output).
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanEntry {
    pub row: EnemyRow,
    pub lane: u32,
    pub rank: u32,
    pub pack_index: u32,
    pub entry_order: u32,
    pub sector_index: u32,
    pub slot_index: u32,
    pub sector_size: u32,
    pub is_solo: bool,
    pub solo_foot_x: Option<f64>,
    pub solo_foot_y: Option<f64>,
}
/// Fields `activateContinuousCombatSpawnedEnemy` writes onto an enemy entity.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Activation {
    pub combat_rank: &'static str,
    pub stream_lane: u32,
    pub stream_rank: u32,
    pub stream_pack_index: u32,
    pub stream_sector_index: u32,
    pub stream_engagement_group_id: u32,
    pub stream_solo: u32,
    pub stream_solo_anchor_x: Option<f64>,
    pub stream_solo_anchor_y: Option<f64>,
    pub stream_solo_phase: Option<f64>,
    pub stream_entry_order: u32,
    pub stream_delivery: &'static str,
    pub stream_melee_line: u32,
    pub stream_engage_x: f64,
    pub stream_walk_speed: f64,
    pub x: f64,
    pub y: f64,
}
pub fn is_ranged_enemy(name: &str) -> bool { matches!(name.trim().to_lowercase().as_str(), "marid" | "djinn" | "chimerilass") }
/// `activateContinuousCombatSpawnedEnemy(globals, enemy, entry)` for an enemy of `name`/`role`.
#[allow(clippy::too_many_arguments)]
pub fn activate(state: &StageState, enemy_size: f64, name: &str, boss: bool, lane: u32, rank: u32, pack_index: u32, entry_order: u32, sector_index: Option<u32>, sector_size: u32, boss_x: Option<f64>, is_solo: bool, solo_foot: Option<Point>) -> Result<Activation, String> {
    let order = entry_order;
    let normalized_sector_size = sector_size.max(1);
    let sector = sector_index.map_or(pack_index % PACKS_PER_WAVE, |s| s.min(PACKS_PER_WAVE - 1)) as usize;
    let g = stream_geometry(state.seed, enemy_size, pack_index as f64, rank as f64, sector as f64);
    let delivery = if is_ranged_enemy(name) { "ranged" } else { "melee" };
    let world = geometry::world_bounds();
    let sector_x = world.world_width * SECTOR_RATIOS[sector];
    let engage_x = if boss { boss_x.unwrap_or(BOSS_HOME.x) } else { sector_x };
    let pack_foot = if boss { None } else if let (true, Some(foot)) = (is_solo, solo_foot) { Some(foot) } else {
        Some(seeded_pack_foot(state.seed, pack_index as f64, rank as f64, sector, order as f64, if is_solo { 1. } else { normalized_sector_size as f64 }, sector_x, g.y, &g)?)
    };
    let home = if boss { Point { x: engage_x, y: BOSS_HOME.y } } else { pack_foot.unwrap() };
    let seed_value = if state.seed == 0 { 1. } else { state.seed as f64 };
    Ok(Activation {
        combat_rank: if boss { "boss" } else { "ordinary" },
        stream_lane: lane, stream_rank: rank, stream_pack_index: pack_index,
        stream_sector_index: sector as u32 + pack_index * PACKS_PER_WAVE,
        stream_engagement_group_id: sector as u32 + pack_index * PACKS_PER_WAVE + if is_solo { PACKS_PER_WAVE } else { 0 },
        stream_solo: u32::from(is_solo),
        stream_solo_anchor_x: is_solo.then_some(home.x), stream_solo_anchor_y: is_solo.then_some(home.y),
        stream_solo_phase: is_solo.then(|| preview_seeded_rng(seed_value, (state.transitions * PACKS_PER_WAVE + sector as u32 + 4096) as f64) * std::f64::consts::PI * 2.),
        stream_entry_order: order, stream_delivery: delivery, stream_melee_line: order % 2,
        stream_engage_x: home.x, stream_walk_speed: g.walk_speed * PACK_WALK_SPEED_SCALE[(order % 5) as usize],
        x: home.x, y: home.y,
    })
}
pub fn activate_entry(state: &StageState, enemy_size: f64, entry: &PlanEntry, boss: bool, boss_x: Option<f64>) -> Result<Activation, String> {
    activate(state, enemy_size, &entry.row.name, boss, entry.lane, entry.rank, entry.pack_index, entry.entry_order, Some(entry.sector_index), entry.sector_size, boss_x, entry.is_solo,
        match (entry.solo_foot_x, entry.solo_foot_y) { (Some(x), Some(y)) => Some(Point { x, y }), _ => None })
}

/// `buildContinuousCombatSpawnPlan(enemyRows, stageState, { slotBase, partyCP, enemySize })`.
pub fn build_spawn_plan(rows: &[EnemyRow], state: &StageState, slot_base: u32, party_cp: f64, enemy_size: f64) -> Result<Vec<PlanEntry>, String> {
    if state.boss_available && !state.boss_active && !state.boss_summon_required { return Ok(Vec::new()); }
    let stage = get_stage(state);
    if rows.is_empty() { return Ok(Vec::new()); }
    let by_name: BTreeMap<&str, &EnemyRow> = rows.iter().map(|r| (r.name.trim(), r)).collect();
    let seed_value = if state.seed == 0 { 1. } else { state.seed as f64 };
    let composition_seed = (to_int32(seed_value) ^ imul(state.transitions as f64 + 1., 2654435761.) ^ imul(stage.wave.max(1) as f64, 2246822519.)) as u32;
    let selected = expand_wave_rows(&stage, &by_name, rows, Some(composition_seed));
    let baseline_stage = StageView { id: String::new(), kind: "fodder", enemy_names: STAGES[0].enemy_names.to_vec(), region: 1, stage: 1, wave: 1, boss: false };
    let baseline = expand_wave_rows(&baseline_stage, &by_name, rows, None);
    let total_cp = |entries: &[&EnemyRow]| entries.iter().map(|r| compute_combat_power(r.cp_actor())).sum::<f64>();
    let stage_ordinal = (stage.region.max(1) - 1) as f64;
    let wave_step = if stage.boss { (waves_for_stage(stage.region) - 1) as f64 } else { (stage.wave.max(1) - 1) as f64 };
    let progression_scale = 1. + stage_ordinal * 0.08 + wave_step * 0.04;
    let baseline_cp = total_cp(&baseline) / if stage.boss { PACKS_PER_WAVE as f64 } else { 1. };
    let linear_target = baseline_cp * progression_scale * if stage.boss { 1.35 } else { 1. };
    let introductory_boss = stage.boss && stage_ordinal == 0.;
    let pack_scale = if introductory_boss { 1. } else if !selected.is_empty() { find_pack_scale(&selected, linear_target) } else { 1. };
    let pack_size = if stage.boss { 1 } else { selected.len() / PACKS_PER_WAVE as usize };
    let short_chapter = packs_for_stage(stage.region) == 3;
    let active_mask = active_pack_mask(stage.region);
    struct Entry { row: EnemyRow, lane: u32, rank: u32, pack_index: u32, entry_order: u32, sector_index: u32, is_solo: bool, solo_foot: Option<Point> }
    let mut entries: Vec<Entry> = Vec::new();
    for (index, row) in selected.iter().enumerate() {
        let scaled = if stage.boss { scale_row(row, pack_scale) } else if short_chapter { toughen_short_chapter_row(bound_ordinary_wave_hp(scale_row(row, pack_scale), progression_scale)) } else { bound_ordinary_wave_hp(scale_row(row, pack_scale), progression_scale) };
        let sector_index = if stage.boss { 1 } else { (index / pack_size) as u32 };
        if !(stage.boss || active_mask & (1 << sector_index) != 0) { continue; }
        entries.push(Entry { row: scaled, lane: (index % pack_size) as u32, rank: slot_base / PACKS_PER_WAVE, pack_index: state.transitions, entry_order: (index % pack_size) as u32, sector_index, is_solo: false, solo_foot: None });
    }
    let deployed_party_cp = party_cp.max(0.);
    if !stage.boss && deployed_party_cp > 0. {
        let count_draw_base = state.transitions * PACKS_PER_WAVE;
        for sector in 0..PACKS_PER_WAVE {
            let pack: Vec<usize> = entries.iter().enumerate().filter(|(_, e)| e.sector_index == sector).map(|(i, _)| i).collect();
            if pack.is_empty() || pack.iter().map(|&i| compute_combat_power(entries[i].row.cp_actor())).sum::<f64>() >= deployed_party_cp { continue; }
            let extra_count = 1 + (preview_seeded_rng(seed_value, (count_draw_base + sector) as f64) * 3.).floor() as usize;
            for index in 0..extra_count {
                let source = &entries[pack[index % pack.len()]];
                let extra = Entry { row: source.row.clone(), lane: source.lane, rank: source.rank, pack_index: source.pack_index, entry_order: (pack.len() + index) as u32, sector_index: source.sector_index, is_solo: false, solo_foot: None };
                entries.push(extra);
            }
        }
    }
    let cleared = normalize_pack_mask(state.cleared_pack_mask);
    let mut remaining: Vec<Entry> = if stage.boss { entries } else { entries.into_iter().filter(|e| cleared & (1 << e.sector_index) == 0).collect() };
    if !stage.boss && !remaining.is_empty() {
        let solo_rows: Vec<&EnemyRow> = ["Gobloc", "Skeleton"].iter().filter_map(|n| by_name.get(n).copied()).collect();
        let solo_target_cp = remaining.iter().map(|e| compute_combat_power(e.row.cp_actor())).fold(f64::INFINITY, f64::min) * SOLO_STAT_SCALE;
        let mut sector_sizes: BTreeMap<u32, u32> = BTreeMap::new();
        for e in &remaining { *sector_sizes.entry(e.sector_index).or_insert(0) += 1; }
        let mut sector_orders: BTreeMap<u32, u32> = BTreeMap::new();
        let mut occupied = Vec::new();
        for e in &remaining {
            let order = *sector_orders.get(&e.sector_index).unwrap_or(&0);
            sector_orders.insert(e.sector_index, order + 1);
            let a = activate(state, enemy_size, &e.row.name, false, e.lane, e.rank, e.pack_index, order, Some(e.sector_index), sector_sizes[&e.sector_index], None, e.is_solo, e.solo_foot)?;
            occupied.push(Point { x: a.x, y: a.y });
        }
        let mut solo_feet = Vec::new();
        for sector in 0..SOLOS_PER_WAVE {
            if solo_rows.is_empty() { break; }
            if active_mask & (1 << sector) == 0 || cleared & (1 << sector) != 0 { continue; }
            let solo_row = solo_rows[(preview_seeded_rng(seed_value, (state.transitions * SOLOS_PER_WAVE + sector) as f64) * solo_rows.len() as f64).floor() as usize];
            let foot = seeded_solo_foot(state, sector, &occupied, &solo_feet, enemy_size)?;
            solo_feet.push(foot);
            let mut scaled = scale_row(solo_row, find_pack_scale(&[solo_row], solo_target_cp));
            scaled.hp = (scaled.hp * 0.5).ceil().max(1.);
            scaled.max_hp = scaled.hp;
            scaled.combat_power = compute_combat_power(scaled.cp_actor());
            let first = &remaining[0];
            let (rank, pack_index) = (first.rank + 1, first.pack_index);
            remaining.push(Entry { row: scaled, lane: 0, rank, pack_index, entry_order: 0, sector_index: sector, is_solo: true, solo_foot: Some(foot) });
        }
    }
    let mut sector_sizes: BTreeMap<u32, u32> = BTreeMap::new();
    for e in &remaining { if !e.is_solo { *sector_sizes.entry(e.sector_index).or_insert(0) += 1; } }
    let mut sector_orders: BTreeMap<u32, u32> = BTreeMap::new();
    Ok(remaining.into_iter().enumerate().map(|(index, e)| {
        let entry_order = if e.is_solo { 0 } else { *sector_orders.get(&e.sector_index).unwrap_or(&0) };
        if !e.is_solo { sector_orders.insert(e.sector_index, entry_order + 1); }
        PlanEntry { sector_size: if e.is_solo { 1 } else { sector_sizes[&e.sector_index] }, slot_index: slot_base + index as u32, entry_order,
            row: e.row, lane: e.lane, rank: e.rank, pack_index: e.pack_index, sector_index: e.sector_index, is_solo: e.is_solo,
            solo_foot_x: e.solo_foot.map(|p| p.x), solo_foot_y: e.solo_foot.map(|p| p.y) }
    }).collect())
}
