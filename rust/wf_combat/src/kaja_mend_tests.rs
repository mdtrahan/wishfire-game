use crate::{tuning::*, *};
fn fixture() -> Sim {
    let mut s = Sim::new(SimConfig::default());
    for (i, kind) in HEROES.into_iter().enumerate() {
        s.spawn_actor(kind, TRIAL_ORIGIN + TRAVEL_SLOTS[i], stats(kind));
    }
    s.hazard(
        HazardKind::BubbleAura,
        3,
        None,
        s.actors[2].view.pos,
        Vec2::new(1., 0.),
    );
    s.hazards.clear();
    for a in &mut s.actors {
        a.view.pos = Vec2::new(480., 1100.);
        a.view.hp = a.view.max_hp * 0.5;
        a.view.state = ActorState::Idle;
        a.undamaged = -1000.;
        a.mend_cd = MEND_INTERVAL;
    }
    s.events.clear();
    s
}
fn tick(s: &mut Sim, steps: usize) {
    for _ in 0..steps {
        s.timers();
        s.actions();
    }
}
fn heals(s: &mut Sim) -> usize {
    s.drain_events()
        .iter()
        .filter(|e| {
            if let Event::Healed { source, .. } = e {
                assert_eq!(*source, HealSource::Mend);
                true
            } else {
                false
            }
        })
        .count()
}
#[test]
fn ninety_step_cadence_and_three_percent_to_every_hero_including_self() {
    let mut s = fixture();
    let before: Vec<_> = s.actors.iter().map(|a| a.view.hp).collect();
    tick(&mut s, 89);
    assert_eq!(heals(&mut s), 0);
    tick(&mut s, 1);
    for (a, hp) in s.actors.iter().zip(&before) {
        assert!((a.view.hp - hp - a.view.max_hp * 0.03).abs() < 0.0001);
    }
    assert_eq!(heals(&mut s), 4);
    tick(&mut s, 89);
    assert_eq!(heals(&mut s), 0);
    tick(&mut s, 1);
    assert_eq!(heals(&mut s), 4);
}
#[test]
fn range_edge_uses_live_kaja_reach_without_body_padding() {
    for reach in [235., 235. * 1.8] {
        let mut s = fixture();
        s.actors[3].stats.reach = reach;
        s.actors[0].view.pos.x += reach;
        s.actors[1].view.pos.x += reach + 0.01;
        let hp = [s.actors[0].view.hp, s.actors[1].view.hp];
        s.actors[3].mend_cd = 0.;
        s.actions();
        assert!(s.actors[0].view.hp > hp[0]);
        assert_eq!(s.actors[1].view.hp, hp[1]);
    }
}
#[test]
fn dead_or_spawning_kaja_stops_and_restarts_a_full_interval() {
    for state in [ActorState::Downed, ActorState::Dead, ActorState::Spawn] {
        let mut s = fixture();
        s.actors[3].view.state = state;
        if state != ActorState::Spawn {
            s.actors[3].view.hp = 0.;
        }
        // Keep the spawn clip pending throughout this isolated timer check.
        s.actors[3].view.state_duration = 100.;
        s.actors[3].mend_cd = 0.;
        s.actions();
        assert_eq!(heals(&mut s), 0);
        tick(&mut s, 90);
        assert_eq!(heals(&mut s), 0);
        s.actors[3].view.state = ActorState::Idle;
        s.actors[3].view.hp = 100.;
        s.events.clear();
        tick(&mut s, 89);
        assert_eq!(heals(&mut s), 0);
        tick(&mut s, 1);
        assert_eq!(heals(&mut s), 4);
    }
}
#[test]
fn caps_hp_excludes_dead_spawning_and_enemies_and_spends_empty_ticks() {
    let mut s = fixture();
    s.actors[0].view.hp = s.actors[0].view.max_hp - 1.;
    s.actors[1].view.hp = 0.;
    s.actors[1].view.state = ActorState::Downed;
    s.actors[2].view.state = ActorState::Spawn;
    let enemy = s.spawn_actor(Archetype::Orc, s.actors[3].view.pos, stats(Archetype::Orc));
    let ei = s.actor_index(enemy).unwrap();
    s.actors[ei].view.hp = 1.;
    s.actors[3].mend_cd = 0.;
    s.actions();
    assert_eq!(s.actors[0].view.hp, s.actors[0].view.max_hp);
    assert_eq!(s.actors[1].view.hp, 0.);
    assert_eq!(s.actors[2].view.hp, s.actors[2].view.max_hp * 0.5);
    assert_eq!(s.actors[ei].view.hp, 1.);
    for a in &mut s.actors[..4] {
        a.view.hp = a.view.max_hp;
    }
    s.actors[3].mend_cd = 0.;
    s.actions();
    assert_eq!(s.actors[3].mend_cd, MEND_INTERVAL);
}
