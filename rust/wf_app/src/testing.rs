//! Test-only reference sims. The slice's `Sim::new` spawned the four heroes; WFM combat spawns
//! nothing until the host does, so client tests build that party explicitly.
use wf_combat::{tuning, Archetype, Sim, SimConfig, Vec2};

pub fn sim() -> Sim {
    sim_with(SimConfig::default())
}
pub fn sim_with(cfg: SimConfig) -> Sim {
    let mut sim = Sim::new(cfg);
    let origin = Vec2::new(sim.cfg.arena_size.x * 0.5, sim.cfg.arena_size.y * 0.7);
    for (i, kind) in [Archetype::Fara, Archetype::Hondo, Archetype::Runa, Archetype::Kaja].into_iter().enumerate() {
        let offset = Vec2::new(if i % 2 == 0 { -38. } else { 38. }, if i < 2 { -120. } else { 120. });
        sim.spawn_actor(kind, origin + offset, tuning::stats(kind));
    }
    sim.refresh_snapshot();
    sim
}

/// Slice `composition_trial` lineage: the four heroes plus the listed enemies ahead of them.
pub fn composition(cfg: SimConfig, enemies: &[Archetype]) -> Sim {
    let mut sim = sim_with(cfg);
    let origin = Vec2::new(sim.cfg.arena_size.x * 0.5, sim.cfg.arena_size.y * 0.7 - 320.);
    for (i, kind) in enemies.iter().copied().enumerate() {
        let column = (i % 4) as f32 - 1.5;
        let row = (i / 4) as f32;
        sim.spawn_actor(kind, origin + Vec2::new(column * 60., -row * 60.), tuning::stats(kind));
    }
    sim.refresh_snapshot();
    sim
}
