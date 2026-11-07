//! `web-runner/assets/enemies.json` rows as `combatSessionInitializer.js` maps them, plus
//! `routineEnemyScaling.mjs`.
use crate::combat_power::{compute_combat_power, CpActor};
use serde::{Deserialize, Serialize};

/// A raw authored row (parseC2ArrayTable). Numeric cells are JSON numbers.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct RawRow {
    pub name: String,
    #[serde(rename = "HP")] pub hp: f64,
    #[serde(rename = "ATK")] pub atk: f64,
    #[serde(rename = "DEF")] pub def: f64,
    #[serde(rename = "MAG")] pub mag: f64,
    #[serde(rename = "RES")] pub res: f64,
    #[serde(rename = "SPD")] pub spd: f64,
    #[serde(default)] pub hp_red: f64,
    #[serde(default)] pub hp_blue: f64,
    #[serde(default)] pub hp_green: f64,
    #[serde(rename = "EncounterCP", default)] pub encounter_cp: f64,
    #[serde(rename = "combatTier", default)] pub combat_tier: String,
}
impl RawRow {
    pub fn cp_actor(&self) -> CpActor { CpActor::new(1., self.atk, self.mag, self.def, self.res, self.hp, self.spd) }
}
/// Parses the Construct `c2array` table (`parseC2ArrayTable` in app.js).
pub fn parse_c2_table(json: &str) -> Result<Vec<RawRow>, String> {
    let value: serde_json::Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
    let cols = value.get("data").and_then(|d| d.as_array()).ok_or("enemies.json: missing data")?;
    if cols.is_empty() { return Ok(Vec::new()); }
    let rows = cols[0].as_array().map_or(0, |c| c.len());
    let headers: Vec<String> = cols.iter().map(|col| col.get(0).and_then(|c| c.get(0)).and_then(|v| v.as_str()).unwrap_or("").to_string()).collect();
    let mut items = Vec::new();
    for y in 1..rows {
        let mut item = serde_json::Map::new();
        for (x, header) in headers.iter().enumerate() {
            let cell = cols[x].get(y).and_then(|c| c.get(0)).cloned().unwrap_or(serde_json::Value::String(String::new()));
            item.insert(header.clone(), cell);
        }
        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("");
        if name.is_empty() { continue; }
        items.push(serde_json::from_value(serde_json::Value::Object(item)).map_err(|e| format!("enemies.json row {y}: {e}"))?);
    }
    Ok(items)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tier { Fodder, Routine, Hard, Elite, Boss }
impl Tier {
    pub fn parse(raw: &str) -> Tier {
        match raw.trim().to_lowercase().as_str() { "fodder" => Tier::Fodder, "hard" => Tier::Hard, "elite" => Tier::Elite, "boss" => Tier::Boss, _ => Tier::Routine }
    }
    pub fn name(self) -> &'static str { match self { Tier::Fodder => "fodder", Tier::Routine => "routine", Tier::Hard => "hard", Tier::Elite => "elite", Tier::Boss => "boss" } }
    fn profile(self) -> [f64; 6] {
        match self {
            Tier::Fodder => [21., 1., 1., 1., 1., 8.],
            Tier::Routine => [30., 2., 2., 2., 2., 8.],
            Tier::Hard => [62., 4., 5., 4., 5., 8.],
            Tier::Elite => [85., 5., 7., 5., 7., 9.],
            Tier::Boss => [130., 6., 9., 6., 9., 10.],
        }
    }
    fn durability(self) -> (f64, f64, f64) {
        match self { Tier::Fodder => (1.4, 8., 8.), Tier::Routine => (1.3, 10., 8.), Tier::Hard => (1.4, 10., 12.), Tier::Elite => (1.6, 11., 9.), Tier::Boss => (2.2, 12., 10.) }
    }
}
/// `enemyCombatTier(row)`.
pub fn enemy_combat_tier(combat_tier: &str) -> Tier {
    let tier = if combat_tier.trim().is_empty() { "routine".to_string() } else { combat_tier.to_string() };
    Tier::parse(&tier)
}

/// One mapped EnemyData row: scaled stats, normalized tags, derived CP.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EnemyRow {
    pub name: String,
    #[serde(rename = "HP")] pub hp: f64,
    #[serde(rename = "ATK")] pub atk: f64,
    #[serde(rename = "DEF")] pub def: f64,
    #[serde(rename = "MAG")] pub mag: f64,
    #[serde(rename = "RES")] pub res: f64,
    #[serde(rename = "SPD")] pub spd: f64,
    #[serde(rename = "maxHP")] pub max_hp: f64,
    #[serde(rename = "combatTier")] pub combat_tier: Tier,
    #[serde(rename = "enemyRole")] pub enemy_role: String,
    #[serde(rename = "CombatPower")] pub combat_power: f64,
    /// Present only on rows the spawn plan scaled.
    #[serde(rename = "streamCpScale", default, skip_serializing_if = "Option::is_none")] pub stream_cp_scale: Option<f64>,
}
impl EnemyRow {
    pub fn cp_actor(&self) -> CpActor { CpActor::new(1., self.atk, self.mag, self.def, self.res, self.hp, self.spd) }
    pub fn stats6(&self) -> [f64; 6] { [self.hp, self.atk, self.def, self.mag, self.res, self.spd] }
    pub fn with_stats6(&self, s: [f64; 6]) -> EnemyRow { EnemyRow { hp: s[0], atk: s[1], def: s[2], mag: s[3], res: s[4], spd: s[5], ..self.clone() } }
}
/// `scaleRoutineEnemy(row, level)` then the initializer's field mapping (`enemyRole` normalizes
/// to fodder; CombatPower from the scaled stats).
pub fn scale_routine_enemy(row: &RawRow, level: f64) -> EnemyRow {
    let tier = enemy_combat_tier(&row.combat_tier);
    let scale = 1. + (level.max(1.) - 1.) * 0.06;
    let (hp_mul, def_cap, res_cap) = tier.durability();
    let profile = tier.profile();
    let authored = [row.hp, row.atk, row.def, row.mag, row.res, row.spd];
    let mut stats = [0.; 6];
    for (i, fallback) in profile.iter().enumerate() {
        let value = if authored[i].is_finite() { authored[i] } else { *fallback };
        let tuned = match i { 0 => value * hp_mul, 2 => value.min(def_cap), 4 => value.min(res_cap), _ => value };
        stats[i] = (tuned * scale).floor().max(1.);
    }
    let mut mapped = EnemyRow { name: row.name.clone(), hp: stats[0], atk: stats[1], def: stats[2], mag: stats[3], res: stats[4], spd: stats[5], max_hp: stats[0],
        combat_tier: tier, enemy_role: "fodder".into(), combat_power: 0., stream_cp_scale: None };
    mapped.combat_power = compute_combat_power(mapped.cp_actor());
    mapped
}
/// The whole EnemyData list the continuous loop uses (routine level 1).
pub fn enemy_data(rows: &[RawRow]) -> Vec<EnemyRow> { rows.iter().map(|r| scale_routine_enemy(r, 1.)).collect() }
