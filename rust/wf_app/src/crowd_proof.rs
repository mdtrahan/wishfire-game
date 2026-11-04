//! Opt-in frozen presentation fixtures; never change Sim or its inputs.
use wf_combat::{ActorState, Archetype, Sim, Snapshot, Vec2};
std::thread_local! {
    static ENABLED: std::cell::Cell<u32> = const { std::cell::Cell::new(0) };
    static SPACING: std::cell::Cell<bool> = const { std::cell::Cell::new(true) };
    static SCENE: std::cell::RefCell<Option<Snapshot>> = const {std::cell::RefCell::new(None)};
}
#[no_mangle]
pub extern "C" fn wf_client_crowd_proof(enabled: u32) {
    ENABLED.with(|p| p.set(enabled));
    SCENE.with(|p| *p.borrow_mut() = None);
}
#[no_mangle]
pub extern "C" fn wf_client_crowd_spacing(enabled: u32) {
    SPACING.with(|p| p.set(enabled != 0));
}
pub fn spacing_enabled() -> bool {
    SPACING.with(|p| p.get())
}

/// Two packed hexagonal rows, at the current 44 u elliptical moat minimum.
/// All 12 centres are within 120 u; original actor stats/scales come from Sim.
/// The fallback measures crowding; it does not reproduce the owner's head-only symptom.
pub fn packed(degrees: f32) -> Snapshot {
    let mut s = crate::testing::composition(Default::default(), &[Archetype::HighOrc; 12])
        .snapshot()
        .clone();
    let mut fara = s
        .actors
        .iter()
        .find(|a| a.archetype == Archetype::Fara)
        .unwrap()
        .clone();
    let mut enemies: Vec<_> = s
        .actors
        .iter()
        .filter(|a| a.team == wf_combat::Team::Enemy)
        .cloned()
        .collect();
    fara.pos = Vec2::new(480., 900.);
    fara.state = ActorState::Idle;
    fara.state_age = 0.2;
    fara.ward = 0.;
    for (i, a) in enemies.iter_mut().enumerate() {
        let row = i / 6;
        let angle =
            degrees.to_radians() + (i as f32 % 6. + row as f32 * 0.5) * std::f32::consts::TAU / 6.;
        let radius = if row == 0 { 44. } else { 44. * 3f32.sqrt() };
        a.pos = fara.pos + Vec2::new(angle.cos() * radius, angle.sin() * radius * 1.4);
        a.state = ActorState::Idle;
        a.state_age = 0.2;
        a.hp = a.max_hp * 0.7;
    }
    s.actors.clear();
    s.actors.push(fara.clone());
    s.actors.extend(enemies);
    s.camera_focus = fara.pos;
    s.time = 0.;
    s.combat_time = 0.;
    s.step = 0;
    s.spotlight = None;
    s.hit_stop = None;
    s.phoenix_channel = None;
    s.hazards.clear();
    s.projectiles.clear();
    s.chests.clear();
    s.enmity.clear();
    s
}
pub fn apply(s: &mut Snapshot) {
    let mode = ENABLED.with(|p| p.get());
    if mode == 0 {
        return;
    }
    SCENE.with(|p| {
        let mut cached = p.borrow_mut();
        if cached.is_none() {
            let mut scene = packed(28.);
            if mode == 2 {
                // One isolated enemy and one HP bar deliberately overlapping Fara's.
                scene.actors.truncate(3);
                let foot = scene.actors[0].pos;
                let scale = scene.actors[1].scale;
                scene.actors[1].pos = foot + Vec2::new(20., 8. * (1. - scale) / (0.5 * 0.75));
                scene.actors[2].pos = foot + Vec2::new(150., -140.);
            }
            *cached = Some(scene);
        }
        *s = cached.as_ref().unwrap().clone();
    });
}
