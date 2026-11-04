//! Native combat host for the QA fight: builds the WFM-shaped encounter and drives World.
//! Stage orchestration (waves, checkpoints, rewards) arrives with the vertical slice bead.
use simulation_core::combat_abi::{EncounterConfig, EnemyInput, GeometryInput, HeroInput, Point, Bounds, SkillModifiers, StatInput, SummonProfile, World};
use wf_combat::{api::*, SIM_DT};

/// WFM floor in slice units (rustCombatArena.mjs): 720 wide, full combat band tall.
pub const VIEW_TOP: f32 = 42.;
pub const VIEW_BOTTOM: f32 = 430.;
pub const ZOOM: f32 = 0.5;
pub const SQUASH: f32 = 0.75;
pub const FLOOR_MIN: Point = Point { x: 96., y: 40. };
pub fn floor_height() -> f32 { (VIEW_BOTTOM - VIEW_TOP) / (ZOOM * SQUASH) }
pub fn floor_max() -> Point { Point { x: 816., y: 40. + floor_height() } }
pub fn origin() -> Point {
    Point { x: 456., y: (FLOOR_MIN.y + floor_max().y) / 2. + 80. + 1.5 * 128. * 0.6 / SQUASH }
}
pub const TRAVEL_SLOTS: [Point; 4] = [
    Point { x: -38., y: -120. }, Point { x: 38., y: -120. }, Point { x: -38., y: 120. }, Point { x: 38., y: 120. },
];

fn stats(hp: f32, atk: f32, def: f32, mag: f32, res: f32, speed: f32, reach: f32, interval: f32, evade: f32, special: f32) -> StatInput {
    StatInput { mag: Some(mag), res: Some(res), hp, atk, def, speed, reach, interval, evade, special }
}
const HERO_SPEED: f32 = 78. * 1.6698;
/// Shadow bases from combatShadowAdapter.mjs (ratio 1 = level-1 reference stats).
fn hero(slot: u8, id: &str, instance: &str, st: StatInput) -> HeroInput {
    let hp = st.hp;
    HeroInput { skill_modifiers: SkillModifiers::default(), instance_id: instance.into(), definition_id: id.into(), slot,
        host_max_hp: Some(hp), formation_offset: TRAVEL_SLOTS[slot as usize], stats: st, hp }
}
fn enemy(key: &str, id: &str, position: Point, st: StatInput, summon: Vec<SummonProfile>) -> EnemyInput {
    let hp = st.hp;
    EnemyInput { spawn_key: key.into(), definition_id: id.into(), position, stats: st, hp, summon_profiles: summon, wfm_magic: None }
}
pub fn gobloc_stats() -> StatInput { stats(140., 10., 0., 10., 0., 55., 40., 2.6, 0., 0.) }
pub fn skeleton_stats() -> StatInput { stats(35., 8., 5., 4., 4., 25.2, 46., 3.6, 0., 0.) }
pub fn high_gobloc_stats() -> StatInput { stats(70., 14., 14., 8., 12., 25.2, 46., 3.6, 0., 0.) }
pub fn lizardo_stats() -> StatInput { stats(100., 22., 0., 22., 0., 45., 220., 4.5, 0., 0.) }
pub fn troll_stats() -> StatInput { stats(1500., 165., 0., 165., 0., 40., 100., 4.5, 0., 0.) }

pub fn geometry() -> GeometryInput {
    GeometryInput { floor: Bounds { min: FLOOR_MIN, max: floor_max() }, viewport_world: Point { x: 720., y: floor_height() },
        formation_origin: origin(), screen_bound: false, contain_bodies: true }
}
pub fn heroes() -> Vec<HeroInput> {
    vec![
        hero(0, "slice.hero.fara", "Falie", stats(420., 26.4, 28., 26.4, 28., HERO_SPEED, 100., 1.8, 0.09, 30.)),
        hero(1, "slice.hero.hondo", "Huun", stats(300., 40.8, 14., 40.8, 14., HERO_SPEED * 1.1, 45., 1.2, 0.12, 8.)),
        hero(2, "slice.hero.runa", "Runa", stats(260., 36., 10., 36., 10., HERO_SPEED * 0.95, 270., 1.4, 0.05, 10.)),
        hero(3, "slice.hero.kaja", "Kojonn", stats(280., 21.6, 16., 21.6, 16., HERO_SPEED * 0.95, 235., 1.6, 0.05, 16.)),
    ]
}
/// A chapter-1-shaped opening wave: two packs ahead of the party.
pub fn opening_wave() -> Vec<EnemyInput> {
    let y = FLOOR_MIN.y + 380.;
    vec![
        enemy("e1", "slice.enemy.gobloc", Point { x: 300., y }, gobloc_stats(), vec![]),
        enemy("e2", "wfm.enemy.skeleton", Point { x: 360., y: y + 40. }, skeleton_stats(), vec![]),
        enemy("e3", "slice.enemy.gobloc", Point { x: 420., y: y - 30. }, gobloc_stats(), vec![]),
        enemy("e4", "wfm.enemy.high_gobloc", Point { x: 560., y }, high_gobloc_stats(), vec![]),
        enemy("e5", "slice.enemy.lizardo", Point { x: 620., y: y - 60. }, lizardo_stats(), vec![]),
        enemy("e6", "wfm.enemy.skeleton", Point { x: 500., y: y + 60. }, skeleton_stats(), vec![]),
    ]
}
pub fn boss_wave(serial: u32) -> Vec<EnemyInput> {
    vec![enemy(&format!("boss{serial}"), "slice.boss.troll_brute", Point { x: 456., y: FLOOR_MIN.y + 370. }, troll_stats(),
        vec![SummonProfile { definition_id: "slice.enemy.gobloc".into(), stats: gobloc_stats() }])]
}

pub struct Host {
    pub world: World,
    pub seed: u64,
    debt: f32,
    serial: u32,
    pub boss_sent: bool,
    pub stage: StageView,
    pub pending: Vec<Event>,
}
impl Host {
    pub fn new(seed: u64) -> Result<Self, String> {
        let config = EncounterConfig { continuous: true, spawn_markers: true, encounter_id: format!("qa:{seed}"), seed: seed.to_string(),
            geometry: geometry(), heroes: heroes(), enemies: opening_wave() };
        let mut world = World::create(config).map_err(|e| e.to_string())?;
        world.retain_typed_events = true;
        let stage = StageView { phase: StagePhase::Lull, wave: 1, mini_waves_total: 2, mini_wave: 1, tier: 1, ..Default::default() };
        world.set_stage(stage.clone());
        Ok(Self { world, seed, debt: 0., serial: 0, boss_sent: false, stage, pending: Vec::new() })
    }
    pub fn snapshot(&self) -> &Snapshot { self.world.snapshot() }
    /// Interpolation fraction between the previous and current fixed step.
    pub fn alpha(&self) -> f32 { (self.debt / SIM_DT).clamp(0., 1.) }
    /// Advances by whole fixed steps like the JS authority driver; `observe` sees each completed step.
    pub fn advance(&mut self, dt: f32, mut observe: impl FnMut(&Snapshot, &Snapshot)) -> u32 {
        self.debt += dt.clamp(0., 0.25);
        let mut steps = 0;
        while self.world.state() == "running" && self.debt + 1e-9 >= SIM_DT && steps < 8 {
            self.debt = (self.debt - SIM_DT).max(0.);
            let before = self.world.snapshot().clone();
            if let Err(error) = self.world.step_now() { eprintln!("combat step failed: {error}"); break; }
            observe(&before, self.world.snapshot());
            steps += 1;
        }
        self.stage.elapsed = self.world.snapshot().combat_time as f32;
        self.world.set_stage(self.stage.clone());
        self.orchestrate();
        steps
    }
    /// QA pacing: once the opening wave is gone, the boss walks in; a dead boss re-arms a new wave.
    fn orchestrate(&mut self) {
        if self.world.state() != "running" { return; }
        if self.world.live_enemies() > 0 { return; }
        let s = self.world.snapshot();
        if s.chests.is_empty() { let _ = self.world.wave_chest(&self.world.encounter_id().to_string()); return; }
        if !self.world.chest().is_some_and(|(_, ready)| ready) { return; }
        self.serial += 1;
        let id = self.world.encounter_id().to_string();
        let batch = if self.boss_sent { self.stage.wave += 1; self.stage.phase = StagePhase::Lull; self.pending.push(Event::StageCleared); self.boss_sent = false; opening_wave().into_iter().map(|mut e| { e.spawn_key = format!("{}-{}", e.spawn_key, self.serial); e }).collect() }
            else { self.boss_sent = true; self.stage.phase = StagePhase::Boss; boss_wave(self.serial) };
        if let Err(error) = self.world.spawn_batch(&id, batch) { eprintln!("spawn failed: {error}"); }
        if self.boss_sent {
            if let Some(boss) = self.world.snapshot().actors.iter().find(|a| wf_combat::tuning::is_boss(a.archetype)) { self.pending.push(Event::BossArrived { id: boss.id }); }
        }
    }
    pub fn drain_events(&mut self) -> Vec<Event> {
        let mut events = self.world.drain_typed_events();
        events.append(&mut self.pending);
        events
    }
}
