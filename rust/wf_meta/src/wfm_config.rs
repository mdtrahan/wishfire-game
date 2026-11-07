//! `web-runner/systems/wfmCombatConfig.mjs` + `createShadowConfig`: the encounter the host sends
//! to Rust combat. `to_json()` yields the exact JSON the JS host produced.
use crate::enemy::{EnemyRow, RawRow, Tier};
use crate::geometry::{self, Point};
use crate::hero::{self, HeroDefinition, PermanentInputs, Training};
use crate::shadow::{self, ShadowEnemy, ShadowStats, Stats6, SummonProfile};
use crate::stage::{self, StageState};
use serde::Serialize;

/// A deployed hero as the host sees it (progression-attached entity).
#[derive(Clone, Debug, PartialEq)]
pub struct HeroHost { pub instance_key: String, pub definition: &'static HeroDefinition, pub hp: f64, pub max_hp: f64, pub combat_base_max_hp: f64, pub stats: Stats6 }
/// A spawned enemy entity after activation.
#[derive(Clone, Debug, PartialEq)]
pub struct EnemyHost { pub uid: u32, pub name: String, pub hp: f64, pub max_hp: f64, pub stats: Stats6, pub boss: bool, pub combat_tier: Tier, pub stream_walk_speed: f64, pub ranged: bool, pub x: f64, pub y: f64, pub boss_interval_seconds: Option<f64> }
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Bounds { pub min: Point, pub max: Point }
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Geometry { pub floor: Bounds, pub viewport_world: Point, pub formation_origin: Point, pub screen_bound: bool, pub contain_bodies: bool }
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct HeroInput { pub stats: ShadowStats, pub host_max_hp: f64, pub skill_modifiers: hero::SkillModifiers, pub instance_id: String, pub definition_id: String, pub slot: u8, pub formation_offset: Point, pub hp: f64 }
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct WfmConfig {
    pub continuous: bool,
    #[serde(skip_serializing_if = "Option::is_none")] pub spawn_markers: Option<bool>,
    pub encounter_id: String,
    pub seed: String,
    pub geometry: Geometry,
    pub heroes: Vec<HeroInput>,
    pub enemies: Vec<ShadowEnemy>,
}
impl WfmConfig { pub fn to_json(&self) -> serde_json::Value { serde_json::to_value(self).expect("config serializes") } }

pub fn geometry() -> Geometry {
    let (min, max) = geometry::slice_floor();
    Geometry { floor: Bounds { min, max }, viewport_world: Point { x: 720., y: max.y - min.y }, formation_origin: geometry::slice_origin(), screen_bound: false, contain_bodies: true }
}
/// `authoredEnemyInterval(actor)`.
pub fn authored_enemy_interval(enemy: &EnemyHost) -> f64 {
    if let Some(boss) = enemy.boss_interval_seconds.filter(|v| v.is_finite() && *v > 0.) { if enemy.boss { return boss; } }
    if enemy.ranged { return 5.; }
    if matches!(enemy.combat_tier, Tier::Fodder | Tier::Routine) { 3.6 } else { 1.6 }
}
fn raw_stats(row: &RawRow) -> Stats6 { Stats6 { hp: row.hp, atk: row.atk, def: row.def, mag: row.mag, res: row.res, spd: row.spd } }
/// `wfmEnemyInput(actor, enemyRows)` + `shadowEnemy`.
pub fn wfm_enemy_input(enemy: &EnemyHost, raw_rows: &[RawRow]) -> Result<ShadowEnemy, String> {
    shadow::enemy_definition(&enemy.name).ok_or_else(|| format!("WFM combat: unmapped enemy \"{}\"", enemy.name))?;
    let reference = raw_rows.iter().find(|r| r.name == enemy.name).ok_or_else(|| format!("Missing authored combat reference: {}", enemy.name))?;
    let resolved = Stats6 { hp: enemy.max_hp, ..enemy.stats };
    shadow::shadow_enemy(&enemy.uid.to_string(), &enemy.name, geometry::slice_pack_position(Point { x: enemy.x, y: enemy.y }, enemy.name == "Troll"), resolved, raw_stats(reference), enemy.hp, enemy.max_hp,
        Some(enemy.stream_walk_speed), Some(authored_enemy_interval(enemy)))
}
pub fn hero_permanent(hero: &HeroHost, training: Option<Training>, stars: u32) -> Result<PermanentInputs, String> {
    hero::wfm_hero_permanent_inputs(hero.definition, &hero.stats, hero.combat_base_max_hp, training, stars)
}
/// `createWfmCombatConfig({ globals, entities, enemyRows, encounterId, checkpointEntry })`.
#[allow(clippy::too_many_arguments)]
pub fn create_wfm_combat_config(state: &StageState, heroes: &[HeroHost], enemies: &[EnemyHost], enemy_data: &[EnemyRow], raw_rows: &[RawRow], encounter_id: &str, checkpoint_entry: bool, training: Option<Training>, stars: &dyn Fn(&str) -> u32) -> Result<WfmConfig, String> {
    for name in stage::get_stage(state).enemy_names {
        shadow::enemy_definition(name).ok_or_else(|| format!("WFM combat: unmapped stage enemy \"{name}\""))?;
        if !raw_rows.iter().any(|r| r.name == name) { return Err(format!("WFM combat: missing authored enemy \"{name}\"")); }
    }
    if heroes.is_empty() || heroes.len() > geometry::COMBAT_PARTY_CAP { return Err("WFM combat: party must contain 1..4 heroes".into()); }
    let origin = geometry::slice_origin();
    let mut hero_inputs = Vec::new();
    for (slot, hero) in heroes.iter().enumerate() {
        let permanent = hero_permanent(hero, training, stars(&hero.instance_key))?;
        let definition = shadow::shadow_definition(hero.definition.key).ok_or("Unsupported shadow combatant")?;
        let position = geometry::slice_hero_position(slot);
        let stats = permanent.stats;
        let mut input = HeroInput { stats, host_max_hp: permanent.host_max_hp, skill_modifiers: permanent.skill_modifiers, instance_id: hero.instance_key.clone(), definition_id: definition.id.into(), slot: slot as u8,
            formation_offset: Point { x: position.x - origin.x, y: position.y - origin.y }, hp: shadow::entry_hp(hero.hp, hero.max_hp, stats.hp)? };
        if checkpoint_entry { input.hp = input.stats.hp; }
        input.formation_offset = geometry::SLICE_TRAVEL_SLOTS[slot];
        hero_inputs.push(input);
    }
    let summon_resolved = enemy_data.iter().find(|r| r.name == "Gobloc").map(|r| Stats6 { hp: r.hp, atk: r.atk, def: r.def, mag: r.mag, res: r.res, spd: r.spd });
    let summon_reference = raw_rows.iter().find(|r| r.name == "Gobloc").map(raw_stats);
    let mut enemy_inputs = Vec::new();
    for enemy in enemies.iter().filter(|e| e.hp > 0.) {
        let mut input = wfm_enemy_input(enemy, raw_rows)?;
        if enemy.name == "Troll" {
            let (Some(resolved), Some(reference)) = (summon_resolved, summon_reference) else { return Err("Missing Gobloc summon template".into()) };
            let gobloc = shadow::enemy_definition("Gobloc").unwrap();
            input.summon_profiles = vec![SummonProfile { definition_id: gobloc.id.into(), stats: shadow::project_shadow_stats(resolved, reference, gobloc)? }];
        }
        enemy_inputs.push(input);
    }
    Ok(WfmConfig { continuous: true, spawn_markers: None, encounter_id: encounter_id.into(), seed: state.seed.to_string(), geometry: geometry(), heroes: hero_inputs, enemies: enemy_inputs })
}
