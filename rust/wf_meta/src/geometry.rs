//! `src/core/combatOrientation.mjs`, `arenaCombat.mjs`, `arenaCombatRules.mjs`,
//! `heroFormationGeometry.mjs` and `web-runner/systems/rustCombatArena.mjs`.
use serde::Serialize;

pub const COMBAT_ARENA_REFERENCE_WIDTH: f64 = 360.;
pub const COMBAT_BATTLEFIELD_ZOOM: f64 = 0.5;
pub const COMBAT_ARENA_VISIBLE_SCREEN_WIDTHS: f64 = 3.;
pub const SAFE_VIEWPORT_TOP: f64 = 95.;
pub const SAFE_VIEWPORT_BOTTOM: f64 = 478.;
pub const VISIBLE_TOP_Y: f64 = 170.;
pub const VISIBLE_BOTTOM_Y: f64 = 375.;
pub const HERO_BACK_CENTER_X: f64 = 40.;
pub const HERO_RIGHT_EDGE_X: f64 = 106.;

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct WorldBounds { #[serde(rename = "minX")] pub min_x: f64, #[serde(rename = "maxX")] pub max_x: f64, #[serde(rename = "heroMinX")] pub hero_min_x: f64, #[serde(rename = "heroMaxX")] pub hero_max_x: f64, #[serde(rename = "visibleWorldWidth")] pub visible_world_width: f64, #[serde(rename = "worldWidth")] pub world_width: f64, pub zoom: f64 }
pub fn world_bounds() -> WorldBounds {
    let visible = COMBAT_ARENA_REFERENCE_WIDTH / COMBAT_BATTLEFIELD_ZOOM;
    let width = visible * COMBAT_ARENA_VISIBLE_SCREEN_WIDTHS;
    WorldBounds { min_x: 0., max_x: width, hero_min_x: 40., hero_max_x: width - 40., visible_world_width: visible, world_width: width, zoom: COMBAT_BATTLEFIELD_ZOOM }
}
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct VerticalBounds { #[serde(rename = "minY")] pub min_y: f64, #[serde(rename = "maxY")] pub max_y: f64, #[serde(rename = "safeViewportTop")] pub safe_viewport_top: f64, #[serde(rename = "safeViewportBottom")] pub safe_viewport_bottom: f64, pub zoom: f64 }
pub fn vertical_bounds() -> VerticalBounds {
    let y_center = (VISIBLE_TOP_Y + VISIBLE_BOTTOM_Y) / 2.;
    let zoom = COMBAT_BATTLEFIELD_ZOOM;
    VerticalBounds { min_y: y_center + (SAFE_VIEWPORT_TOP - y_center) / zoom + 42., max_y: y_center + (SAFE_VIEWPORT_BOTTOM - y_center) / zoom - 4., safe_viewport_top: SAFE_VIEWPORT_TOP, safe_viewport_bottom: SAFE_VIEWPORT_BOTTOM, zoom }
}
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct Patrol { #[serde(rename = "minX")] pub min_x: f64, #[serde(rename = "maxX")] pub max_x: f64, #[serde(rename = "minY")] pub min_y: f64, #[serde(rename = "maxY")] pub max_y: f64 }
pub fn ordinary_patrol_bounds() -> Patrol { let w = world_bounds(); Patrol { min_x: 520., max_x: w.world_width - 520., min_y: 290., max_y: 450. } }
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct StartFormation { #[serde(rename = "centerX")] pub center_x: f64, #[serde(rename = "halfSpreadX")] pub half_spread_x: f64, #[serde(rename = "worldWidth")] pub world_width: f64, #[serde(rename = "heroX")] pub hero_x: Vec<f64> }
pub fn start_formation(hero_count: usize) -> StartFormation {
    let world = world_bounds();
    let half = (HERO_RIGHT_EDGE_X - HERO_BACK_CENTER_X) * 0.8 / 2.;
    StartFormation { center_x: world.world_width / 2., half_spread_x: half, world_width: world.world_width,
        hero_x: (0..hero_count).map(|i| world.world_width / 2. + if i % 2 == 0 { half } else { -half }).collect() }
}
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct Moat { #[serde(rename = "centerX")] pub center_x: f64, #[serde(rename = "centerY")] pub center_y: f64, #[serde(rename = "minimumEnemyCenterDistance")] pub minimum_enemy_center_distance: f64 }
pub fn spawn_moat() -> Moat {
    let f = start_formation(0);
    let v = ordinary_patrol_bounds();
    Moat { center_x: f.center_x, center_y: (v.min_y + v.max_y) / 2., minimum_enemy_center_distance: 150. / (2. * COMBAT_BATTLEFIELD_ZOOM) }
}
/// `actorFootprintRadius`: bosses 72, everyone else 18.
pub fn footprint_radius(boss: bool) -> f64 { if boss { 72. } else { 18. } }

pub const HERO_FORMATION_WIDTH: f64 = 105.6;
pub const HERO_FORMATION_PITCH: f64 = HERO_FORMATION_WIDTH / 3.;
/// `HERO_FORMATION_SLOTS` (x, y) after the source's six-decimal rounding.
pub fn hero_formation_slots() -> [(f64, f64); 8] {
    let cells = [(1., 0.), (2., 0.), (0., 1.), (1., 1.), (2., 1.), (3., 1.), (1., 2.), (2., 2.)];
    cells.map(|(column, row)| (fixed6((column - 1.5) * HERO_FORMATION_PITCH), fixed6((row - 1.) * HERO_FORMATION_PITCH)))
}
fn fixed6(v: f64) -> f64 { format!("{v:.6}").parse().unwrap() }

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct Point { pub x: f64, pub y: f64 }
pub const COMBAT_VIEW_TOP: f64 = 42.;
pub const COMBAT_VIEW_BOTTOM: f64 = 430.;
pub const COMBAT_VIEW_ZOOM: f64 = 0.5;
pub const COMBAT_VIEW_SQUASH: f64 = 0.75;
pub const SLICE_ACTOR_HEIGHT: f64 = 128.;
pub fn slice_floor_height() -> f64 { (COMBAT_VIEW_BOTTOM - COMBAT_VIEW_TOP) / (COMBAT_VIEW_ZOOM * COMBAT_VIEW_SQUASH) }
pub fn slice_floor() -> (Point, Point) { (Point { x: 96., y: 40. }, Point { x: 816., y: 40. + slice_floor_height() }) }
pub fn slice_origin() -> Point {
    let (min, max) = slice_floor();
    Point { x: 456., y: (min.y + max.y) / 2. + 80. + 1.5 * SLICE_ACTOR_HEIGHT * 0.6 / COMBAT_VIEW_SQUASH }
}
pub const SLICE_TRAVEL_SLOTS: [Point; 4] = [Point { x: -38., y: -120. }, Point { x: 38., y: -120. }, Point { x: -38., y: 120. }, Point { x: 38., y: 120. }];
pub const COMBAT_PARTY_CAP: usize = 4;
pub fn slice_hero_position(slot: usize) -> Point { let o = slice_origin(); let s = SLICE_TRAVEL_SLOTS[slot]; Point { x: o.x + s.x, y: o.y + s.y } }
pub fn clamp_slice_spawn(p: Point, boss: bool) -> Point {
    let (min, max) = slice_floor();
    let (half, top, bottom) = if boss { (176., 370., 40.) } else { (112., 210., 30.) };
    Point { x: (min.x + half).max((max.x - half).min(p.x)), y: (min.y + top).max((max.y - bottom).min(p.y)) }
}
/// `slicePackPosition`: WFM world foot -> slice floor, preserving seeded pack identities.
pub fn slice_pack_position(p: Point, boss: bool) -> Point {
    let w = world_bounds();
    let v = vertical_bounds();
    let (min, _) = slice_floor();
    let x = 0f64.max(1f64.min((p.x - w.min_x) / (w.max_x - w.min_x)));
    let y = 0f64.max(1f64.min((p.y - v.min_y) / (v.max_y - v.min_y)));
    clamp_slice_spawn(Point { x: min.x + x * 720., y: min.y + y * slice_floor_height() }, boss)
}
