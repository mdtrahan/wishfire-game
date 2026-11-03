use crate::*;

const WARNINGS: [HazardKind; 9] = [
    HazardKind::BossSlam,
    HazardKind::BossCone,
    HazardKind::BossCharge,
    HazardKind::BossStompStep,
    HazardKind::BossNova,
    HazardKind::BossSnipe,
    HazardKind::SniperLine,
    HazardKind::LizardoDrop,
    HazardKind::FizzmiteBlast,
];

fn fixture(seed: u64, kind: HazardKind, inside: bool, ward: f32) -> Sim {
    let owner = match kind {
        HazardKind::LizardoDrop => Archetype::Lizardo,
        HazardKind::FizzmiteBlast => Archetype::Fizzmite,
        HazardKind::BossSnipe => Archetype::BossMarksman,
        HazardKind::SniperLine => Archetype::Sniper,
        HazardKind::BossNova => Archetype::BossBomber,
        _ => Archetype::Boss,
    };
    let mut s = Sim::composition_trial(
        SimConfig {
            seed,
            ..SimConfig::default()
        },
        &[owner],
    );
    s.combat.hazards.clear();
    s.combat.projectiles.clear();
    for a in &mut s.combat.actors[..4] {
        a.view.pos = Vec2::new(150., 1500.);
        a.stats.evade = 1.;
        a.view.ward = 0.;
        a.view.hp = 10000.;
        a.view.max_hp = 10000.;
    }
    s.combat.actors[4].view.pos = Vec2::new(480., 900.);
    s.hazard(
        kind,
        s.combat.actors[4].view.id,
        None,
        s.combat.actors[4].view.pos,
        Vec2::new(0., 1.),
    );
    let h = &mut s.combat.hazards[0];
    h.view.phase = HazardPhase::Locked;
    h.phase_age = h.duration;
    // An outside hero moves off the warning before resolution.
    s.combat.actors[0].view.pos = h.view.origin
        + match h.view.shape {
            Shape::Circle { .. } => Vec2::new(0., 0.),
            _ => h.view.dir * 100.,
        };
    if !inside {
        s.combat.actors[0].view.pos = Vec2::new(150., 1500.);
    }
    s.combat.actors[0].view.ward = ward;
    s.drain_events();
    s
}

fn resolve(s: &mut Sim) {
    s.resolve_hazards();
    for _ in 0..90 {
        s.combat.update_hazards();
        s.resolve_hazards();
        s.combat.move_projectiles();
    }
}

#[test]
fn spatial_warnings_hit_inside_and_miss_outside_across_seeds() {
    for kind in WARNINGS {
        for seed in 0..128 {
            for inside in [true, false] {
                let mut s = fixture(seed, kind, inside, 0.);
                let hp = s.combat.actors[0].view.hp;
                let target = s.combat.actors[0].view.id;
                resolve(&mut s);
                assert_eq!(
                    s.combat.actors[0].view.hp < hp,
                    inside,
                    "{kind:?} seed={seed} inside={inside}"
                );
                let mut hits = 0;
                for e in s.drain_events() {
                    match e {
                        Event::Hit { target: t, .. } if t == target => hits += 1,
                        Event::Evaded { target: t, .. } if t == target => {
                            panic!("evaded {kind:?} seed={seed}")
                        }
                        _ => {}
                    }
                }
                assert_eq!(hits, usize::from(inside), "{kind:?} seed={seed}");
            }
        }
    }
}

#[test]
fn spatial_warnings_preserve_armor_crit_and_partial_or_full_ward() {
    let mut crits = 0;
    for kind in WARNINGS {
        for seed in 0..32 {
            let mut bare = fixture(seed, kind, true, 0.);
            bare.actors[0].stats.evade = 0.;
            // Include a guaranteed PRD crit alongside the fresh-counter seed cases.
            if seed == 0 {
                let source = bare.actors[4].view.id;
                wf_combat::prd::state(&mut bare.prd, source).damage_crit.next = 68;
            }
            let hp = bare.actors[0].view.hp;
            let mut expected_rng = bare.combat_rng;
            expected_rng.next(); // Exactly one crit draw, with no evade draw.
            resolve(&mut bare);
            assert_eq!(bare.combat_rng.0, expected_rng.0, "{kind:?} seed={seed}");
            let damage = hp - bare.actors[0].view.hp;
            assert!(damage > 0.);
            for ward in [damage * 0.5, 10000.] {
                let mut shielded = fixture(seed, kind, true, ward);
                if seed == 0 {
                    let source = shielded.actors[4].view.id;
                    wf_combat::prd::state(&mut shielded.prd, source).damage_crit.next = 68;
                }
                resolve(&mut shielded);
                let loss = hp - shielded.actors[0].view.hp;
                assert!(
                    (loss - (damage - ward).max(0.)).abs() < 0.001,
                    "{kind:?} seed={seed}"
                );
                assert!((shielded.actors[0].view.ward - (ward - damage).max(0.)).abs() < 0.002);
                assert_eq!(bare.combat_rng.0, shielded.combat_rng.0);
            }
            crits += bare
                .drain_events()
                .into_iter()
                .filter(|e| matches!(e, Event::Hit { crit: true, .. }))
                .count();
        }
    }
    assert!(crits > 0, "spatial attacks still roll crits");
}

#[test]
fn direct_fire_projectile_still_rolls_evade() {
    for seed in 0..128 {
        let mut s = fixture(seed, HazardKind::SniperLine, true, 0.);
        s.combat.hazards.clear();
        let target = s.combat.actors[0].view.id;
        let pos = s.combat.actors[0].view.pos;
        let hp = s.combat.actors[0].view.hp;
        s.combat.projectile(4, Some(target), pos, false, 100., None);
        for _ in 0..30 {
            s.combat.move_projectiles();
        }
        assert_eq!(s.combat.actors[0].view.hp, hp);
        assert_eq!(
            s.drain_events()
                .into_iter()
                .filter(|e| matches!(e, Event::Evaded { target: t, .. } if *t == target))
                .count(),
            1
        );
    }
}

#[test]
fn spatial_warnings_preserve_revive_immunity() {
    for kind in WARNINGS {
        let mut s = fixture(1, kind, true, 0.);
        s.combat.actors[0].revive_immunity_steps = 60;
        let hp = s.combat.actors[0].view.hp;
        let rng = s.combat.combat_rng.0;
        resolve(&mut s);
        assert_eq!(s.combat.actors[0].view.hp, hp, "{kind:?}");
        assert_eq!(s.combat.combat_rng.0, rng, "{kind:?}");
    }
}
