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

/// The WFM host loop for client scenarios: a real `wf_host::Session` (Chapter 1 from the saved
/// opening, level-1 party, seeded) stepped one fixed 30 Hz step at a time.
pub struct HostRun { pub session: wf_host::session::Session, now_ms: f64, last: Option<wf_combat::Snapshot> }
impl HostRun {
    pub fn new(seed: u32) -> Self {
        let rows = wf_meta::enemy::parse_c2_table(&std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../web-runner/assets/enemies.json")).unwrap()).unwrap();
        let party = [("Falie", "falie#1"), ("Huun", "huun#1"), ("Runa", "runa#1"), ("Kojonn", "kojonn#1")];
        let mut session = wf_host::session::Session::new(seed, rows, wf_host::progress::HeroProgressStore::fresh(), &party, "client-test", 90, Box::new(|_| true), Box::new(|_, _| {}));
        session.stage.next_emission_at = 3.;
        // The host paces from the first wall time it sees; one real step produces the first snapshot.
        let mut run = Self { session, now_ms: 1000., last: None };
        run.session.tick(run.now_ms);
        run.step();
        run
    }
    /// One fixed step of wall time (the host paces one 30 Hz step per 1000/30 ms).
    pub fn step(&mut self) {
        self.now_ms += 1000. / 30.;
        self.session.tick(self.now_ms);
        assert!(self.session.failed.is_none(), "host failed: {:?}", self.session.failed);
        // Between attempts (boss timeout tail, stage transition) the world is gone; the client keeps
        // drawing the previous frame, so the harness does too.
        if let Some(s) = self.session.world().map(|w| w.snapshot()).or(self.session.last_snapshot.as_ref()) { self.last = Some(s.clone()); }
    }
    pub fn snapshot(&self) -> &wf_combat::Snapshot { self.session.world().map(|w| w.snapshot()).or(self.session.last_snapshot.as_ref()).or(self.last.as_ref()).expect("host snapshot after the first step") }
    pub fn drain_events(&mut self) -> Vec<wf_combat::Event> { std::mem::take(&mut self.session.presentation_events) }
    pub fn observations(&mut self) -> Vec<(wf_combat::Snapshot, wf_combat::Snapshot)> { std::mem::take(&mut self.session.step_observations) }
}
