use crate::{tests::ALLOCATIONS, tuning::*, *};
fn fixture(enraged: bool, kind: HazardKind, dir: Vec2) -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::BossMarksman]);
    s.combat.hazards.clear();
    s.combat.projectiles.clear();
    s.combat.actors[4].view.pos = Vec2::new(480., 900.);
    s.combat.actors[4].view.enraged = enraged;
    s.hazard(
        kind,
        s.combat.actors[4].view.id,
        None,
        s.combat.actors[4].view.pos,
        dir,
    );
    s
}
fn close(a: f32, b: f32) {
    assert!((a - b).abs() < 0.001, "{a} != {b}");
}
#[test]
fn djinn_beam_width_and_wall_distance_set_warning_and_damage() {
    for enraged in [false, true] {
        for dir in [Vec2::new(1., 0.), Vec2::new(0., 1.), Vec2::new(0., -1.)] {
            let mut s = fixture(enraged, HazardKind::BossSnipe, dir);
            for _ in 0..31 {
                s.combat.update_hazards();
            }
            let h = &s.combat.hazards[0];
            assert_eq!(h.view.phase, HazardPhase::Locked);
            let Shape::Line { length, width } = h.view.shape else {
                panic!()
            };
            close(width, 120. * if enraged { 1.5 } else { 1. });
            close(
                length,
                crate::math::floor_ray(h.view.origin, dir, f32::INFINITY),
            );
            let warning = (length / 600.).max(width / 90.).max(1.);
            close(h.duration, warning);
            close(h.damage, h.base_damage * warning);
            close(h.tracking, SNIPER_TRACK);
        }
    }
}
#[test]
fn ordinary_sniper_retains_fixed_warning_and_original_width() {
    let mut s = fixture(false, HazardKind::SniperLine, Vec2::new(0., 1.));
    for _ in 0..31 {
        s.combat.update_hazards();
    }
    let h = &s.combat.hazards[0];
    let Shape::Line { length, width } = h.view.shape else {
        panic!()
    };
    assert!(length > SNIPER_LENGTH);
    close(width, SNIPER_WIDTH);
    close(h.duration, SNIPER_LOCK);
    close(h.damage, h.base_damage);
}
#[test]
fn physical_beam_hits_inside_wide_lane_and_misses_outside() {
    for (offset, hit) in [(59., true), (79., false)] {
        let mut s = fixture(false, HazardKind::BossSnipe, Vec2::new(0., 1.));
        for a in &mut s.combat.actors[..4] {
            a.view.pos = Vec2::new(180., ARENA_MAX.y - 100.);
            a.stats.evade = 0.;
            a.view.ward = 0.;
        }
        s.combat.actors[0].view.pos = Vec2::new(480. + offset, 1100.);
        let hp = s.combat.actors[0].view.hp;
        let h = &mut s.combat.hazards[0];
        h.view.phase = HazardPhase::Locked;
        h.phase_age = h.duration;
        s.resolve_hazards();
        for _ in 0..12 {
            s.combat.move_projectiles();
        }
        assert_eq!(s.combat.actors[0].view.hp < hp, hit, "offset {offset}");
    }
}
#[test]
fn wide_beam_freezes_in_charge_performing_and_tail() {
    let mut s = fixture(true, HazardKind::BossSnipe, Vec2::new(0., 1.));
    for a in &mut s.combat.actors {
        a.view.hp = 100000.;
        a.view.max_hp = 100000.;
    }
    s.combat.cfg.spotlight = SpotlightConfig {
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        auto_release: false,
        tail_cap: 2.,
        ..SpotlightConfig::DEFAULT
    };
    s.combat.start_arcane_pulse(3, s.combat.actors[4].view.id);
    // Inject prepared boss work after admission to exercise an existing window's freeze.
    let beam = s.combat.hazards.pop().unwrap();
    s.combat.select_spotlight();
    s.combat.hazards.push(beam);
    let frozen = format!("{:?}", s.combat.hazards[0]);
    let combat_steps = s.combat.combat_steps;
    for _ in 0..150 {
        s.step();
        s.drain_events();
        assert_eq!(s.combat.combat_steps, combat_steps);
        assert_eq!(
            format!(
                "{:?}",
                s.combat
                    .hazards
                    .iter()
                    .find(|h| h.view.kind == HazardKind::BossSnipe)
                    .unwrap()
            ),
            frozen
        );
        if s.combat
            .spotlight
            .active
            .as_ref()
            .is_some_and(|a| a.phase == SpotlightPhase::Tail)
        {
            return;
        }
    }
    panic!("did not reach Tail");
}
#[test]
fn beam_fights_are_deterministic_and_allocate_nothing_per_step() {
    for spotlight in [
        SpotlightConfig::OFF,
        SpotlightConfig {
            auto_release: true,
            ..SpotlightConfig::DEFAULT
        },
    ] {
        let cfg = SimConfig {
            seed: 17,
            spotlight,
            ..Default::default()
        };
        let mut a = Sim::composition_trial(cfg.clone(), &[Archetype::BossMarksman]);
        let mut b = Sim::composition_trial(cfg, &[Archetype::BossMarksman]);
        let mut beams = 0;
        for _ in 0..3600 {
            ALLOCATIONS.with(|n| n.set(Some(0)));
            a.step();
            let allocations = ALLOCATIONS.with(|n| n.replace(None));
            assert_eq!(allocations, Some(0));
            b.step();
            assert_eq!(a.state_hash(), b.state_hash());
            beams += a
                .drain_events()
                .iter()
                .filter(|e| {
                    matches!(
                        e,
                        Event::HazardSpawned {
                            kind: HazardKind::BossSnipe,
                            ..
                        }
                    )
                })
                .count();
            b.drain_events();
        }
        assert!(beams > 0);
    }
}
