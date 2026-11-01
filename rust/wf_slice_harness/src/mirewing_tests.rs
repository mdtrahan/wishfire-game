use crate::{tuning::*, *};
use ActorState::{Cast, Downed, Idle, Walk};
use Archetype::{Boss, Gobloc, Mirewing, Orc};
use Vec2 as V;

fn fixture() -> Sim {
    setup(SimConfig::default())
}

fn setup(cfg: SimConfig) -> Sim {
    let mut s = Sim::composition_trial(cfg, &[Mirewing]);
    s.combat.hazards.clear();
    for (i, a) in s.combat.actors.iter_mut().enumerate() {
        a.state(Idle, 0., 0.);
        a.action_done = true;
        a.view.pos = if i == 4 {
            V::new(480., 950.)
        } else {
            V::new(360. + i as f32 * 80., 1300.)
        };
        a.destination = a.view.pos;
        a.stats.evade = 0.;
        a.basic_cd = 1000.;
        a.special_cd = 1000.;
        a.extra_cd = 1000.;
        a.ai_cd = 1000.;
    }
    s.combat.events.clear();
    s
}

fn step(s: &mut Sim) {
    s.combat.timers();
    s.enemy_ai();
    s.combat.action(4);
    s.combat.separate_bodies();
}

fn hover(s: &mut Sim) {
    for _ in 0..(MIREWING_REPOSITION_MAX / SIM_DT).ceil() as usize + 2 {
        step(s);
        if s.combat.actors[4].view.state == Cast {
            return;
        }
    }
    panic!("reposition timeout");
}

fn hovered() -> Sim {
    let mut s = fixture();
    hover(&mut s);
    s
}

fn down(s: &mut Sim, ids: &[usize]) {
    for &i in ids {
        s.combat.actors[i].view.hp = 0.;
        s.combat.actors[i].state(Downed, 0., 0.);
    }
}

fn run(s: &mut Sim, n: u32) {
    for _ in 0..n {
        step(s);
    }
}

fn warning(s: &mut Sim, p: V, dir: V) {
    s.hazard(
        HazardKind::BossSlam,
        s.combat.actors[4].view.id,
        None,
        p,
        dir,
    );
    s.combat.hazards[0].known = [true; 4];
    s.combat.hazards[0].view.phase = HazardPhase::Locked;
}

fn pos(s: &Sim) -> V {
    s.combat.actors[4].view.pos
}

fn empty(s: &Sim) {
    assert!(s.combat.projectiles.is_empty());
}

fn shot(s: &Sim, p: V, aim: V) {
    assert_eq!(s.combat.projectiles.len(), 1);
    assert_eq!(s.combat.projectiles[0].start, p);
    assert_eq!(s.combat.projectiles[0].end, aim);
}

fn release(s: &mut Sim, planted: Option<V>) {
    for _ in 0..92 {
        step(s);
        if let Some(p) = planted {
            assert_eq!(pos(&s), p);
        }
        if !s.combat.projectiles.is_empty() {
            break;
        }
    }
}

fn clear(s: &Sim, reach: f32) {
    let v = &s.combat.actors[4].view;
    for h in &s.combat.actors[..4] {
        assert!(v.pos.distance(h.view.pos) > v.radius + h.view.radius + reach);
    }
}

fn on_floor(a: &actors::Actor) {
    let v = &a.view;
    assert_eq!(v.pos, math::floor_point(v.pos, v.radius));
}

#[test]
fn mirewing_hover_separates_hondo_dodging_through_its_body() {
    for burst in [false, true] {
        for sign in [-1., 1.] {
            let mut s = hovered();
            if burst {
                release(&mut s, None);
            }
            let p = pos(&s);
            down(&mut s, &[0, 2, 3]);
            let gap = s.combat.actors[1].view.radius + s.combat.actors[4].view.radius;
            let h = &mut s.combat.actors[1];
            h.view.pos = p - V::new(sign * (gap + 0.5), 0.);
            h.heading = V::new(sign, 0.);
            h.velocity = h.heading * h.speed();
            let danger = h.view.pos - V::new(sign * 100., 0.);
            warning(&mut s, danger, V::new(sign, 0.));
            s.combat.hazards[0].view.shape = Shape::Circle { radius: 180. };
            let mut hits = 0;
            for _ in 0..12 {
                s.hero_ai();
                let h = &s.combat.actors[1];
                assert_eq!(h.view.ai_intent, AiIntent::Dodge);
                hits += usize::from(h.view.pos.distance(p) < gap);
                s.combat.separate_bodies();
                assert_eq!(pos(&s), p);
                assert!(s.combat.actors[1].view.pos.distance(p) >= gap - 0.001);
            }
            assert!(hits > 0);
        }
    }
}

#[test]
fn mirewing_fix_preserves_boss_encase_and_spawn_anchors() {
    for anchor in [Boss, Orc, Mirewing] {
        for spawn in [false, true] {
            let mut s = fixture();
            let p = pos(&s);
            s.combat.actors[4].view.archetype = anchor;
            if spawn {
                s.combat.actors[4].begin_spawn();
            } else if !is_boss(anchor) {
                s.combat.encase(4);
            }
            let hero = p + V::new(12., 0.);
            s.combat.actors[1].view.pos = hero;
            warning(&mut s, p, V::new(1., 0.));
            s.combat.separate_bodies();
            assert_eq!(pos(&s), p);
            assert_eq!(s.combat.actors[1].view.pos, hero);
            s.combat.hazards.clear();
            s.combat.separate_bodies();
            assert_eq!(pos(&s), p);
            if is_boss(anchor) {
                assert_eq!(s.combat.actors[1].view.pos, hero);
            } else {
                assert!(
                    s.combat.actors[1].view.pos.distance(p)
                        >= 2. * (BODY_RADIUS + ACTOR_MOAT) - 0.001
                );
            }
        }
    }
}

#[test]
fn mirewing_repeats_bounded_mobile_hover_fire_cycles_without_entering_melee() {
    let mut s = fixture();
    assert!(stats(Mirewing).speed >= 2. * stats(Gobloc).speed);
    let (mut start, mut held, mut shots, mut last, mut moved) = (None, 0, 0, 0, false);
    for frame in 0..45 * SIM_HZ {
        let before = pos(&s);
        let count = s.combat.projectiles.len();
        step(&mut s);
        let a = &s.combat.actors[4];
        let v = &a.view;
        assert_eq!(v.hp, v.max_hp);
        on_floor(a);
        assert!(a.enemy_phase <= MIREWING_BURST_ROUNDS + 1);
        assert_ne!(v.ai_intent, AiIntent::Retreat);

        assert_eq!(a.goal_cd, 0.);
        clear(&s, HERO_STATS[0].reach.max(HERO_STATS[1].reach));
        moved |= before.distance(v.pos) > 0.1;
        if v.state == Cast && start.is_none() {
            let distance = s.combat.actors[..4]
                .iter()
                .map(|h| h.view.pos.distance(v.pos))
                .fold(f32::INFINITY, f32::min);
            assert!((MIREWING_MIN..=MIREWING_MAX).contains(&distance));
            start = Some(v.pos);
            held = 0;
        }
        if let Some(p) = start {
            assert_eq!(v.pos, p);
            held += 1;
        }
        if s.combat.projectiles.len() > count {
            assert_eq!(s.combat.projectiles.len(), count + 1);
            let shot = s.combat.projectiles.last().unwrap();
            assert_eq!(shot.start, start.unwrap());
            assert!(shot.poison_damage > 0.);
            assert_eq!(shot.view.team, Team::Enemy);
            assert!(!shot.visual_only);
            let round = shots % MIREWING_BURST_ROUNDS;
            assert!(
                (held as f32 * SIM_DT - MIREWING_HOVER - round as f32 * MIREWING_BURST_GAP).abs()
                    <= 2. * SIM_DT
            );
            if round == 0 {
                assert!(moved);
                if shots > 0 {
                    assert!(
                        (frame - last) as f32 * SIM_DT
                            <= MIREWING_HOVER + MIREWING_REPOSITION_MAX + 3. * SIM_DT
                    );
                }
            } else {
                assert!(((frame - last) as f32 * SIM_DT - MIREWING_BURST_GAP).abs() <= SIM_DT);
            }
            last = frame;
            shots += 1;
            if shots % MIREWING_BURST_ROUNDS == 0 {
                start = None;
                moved = false;
            }
        }
    }
    assert!(shots >= 8);
}

#[test]
fn mirewing_hover_commitment() {
    for dead in [false, true] {
        let mut s = hovered();
        let a = &s.combat.actors[4];
        let (p, mut aim, target) = (a.view.pos, a.action_target_pos, a.target);
        if dead {
            s.combat.actors[0].view.pos = p + V::new(12., 0.);
            s.combat.taunt(0);
            assert_eq!(s.combat.actors[4].target, target);
            step(&mut s);
            assert_eq!(pos(&s), p);
            down(&mut s, &[0, 1, 2, 3]);
        } else {
            let i = s.combat.actor_index(target.unwrap()).unwrap();
            s.combat.actors[i].view.pos = V::new(480., 2000.);
            aim = s.combat.actors[i].view.pos;
            assert!(p.distance(s.combat.actors[i].view.pos) > MIREWING_MAX);
        }
        release(&mut s, dead.then_some(p));
        shot(&s, p, aim);
        if dead {
            assert_eq!(s.combat.projectiles[0].target, target);
            run(&mut s, SIM_HZ);
            let center = ARENA_CENTRE;
            assert!(pos(&s).distance(center) < p.distance(center));
        }
    }
}

#[test]
fn mirewing_stalled_reposition_times_out_and_repeats_instead_of_fleeing() {
    let mut s = fixture();
    s.combat.actors[4].stats.speed = 0.;
    s.combat.actors[4].view.pos = V::new(480., 500.);
    let mut retries = 0;
    for _ in 0..16 * SIM_HZ {
        let left = s.combat.actors[4].relocate_left;
        step(&mut s);
        retries += usize::from(s.combat.actors[4].relocate_left > left);
        let a = &s.combat.actors[4];
        empty(&s);
        assert_eq!(a.enemy_phase, 0);
        assert!(a.relocate_left <= MIREWING_REPOSITION_MAX);
    }
    assert!(retries >= 7);
    assert_eq!(pos(&s), V::new(480., 500.));
    s.combat.actors[0].view.pos = V::new(480., 850.);
    hover(&mut s);
    let burst_end = MIREWING_HOVER + (MIREWING_BURST_ROUNDS - 1) as f32 * MIREWING_BURST_GAP;
    run(&mut s, (burst_end / SIM_DT).ceil() as u32);
    assert_eq!(s.combat.projectiles.len(), MIREWING_BURST_ROUNDS as usize);
    let shot = &s.combat.projectiles[0];
    assert!(shot.start.distance(shot.end) <= MIREWING_MAX);
}

#[test]
fn mirewing_real_ground_pound_and_revival_pushes_cancel_hover() {
    for revival in [false, true] {
        for burst in [false, true] {
            for impact in [false, true] {
                let mut s = hovered();
                if burst {
                    release(&mut s, None);
                }
                let count = s.combat.projectiles.len();
                let p = pos(&s);
                let a = &mut s.combat.actors[4];
                a.view.hp = 100000.;
                a.view.max_hp = 100000.;
                if impact {
                    a.view.state_age = a.view.impact_at;
                }
                s.combat.actors[0].view.pos = p - V::new(80., 0.);
                if revival {
                    down(&mut s, &[0]);
                    s.combat.revive_hero(0);
                    assert!(s
                        .drain_events()
                        .iter()
                        .any(|e| matches!(e, Event::ReviveBurst { .. })));
                } else {
                    s.combat.start_ground_pound(0, s.combat.actors[4].view.id);
                    s.combat.actors[0].view.state_age = s.combat.actors[0].view.impact_at;
                    s.combat.action(0);
                    let h = s
                        .combat
                        .hazards
                        .iter_mut()
                        .find(|h| h.view.kind == HazardKind::GroundPound)
                        .unwrap();
                    h.phase_age = h.duration;
                    s.resolve_hazards();
                }
                let a = &s.combat.actors[4];
                assert!(a.view.pos.distance(p) > 1.);
                assert!(a.alive());
                assert_eq!(a.view.state, Idle);
                assert!(a.action_done);
                assert_eq!(a.enemy_phase, 0);
                assert_eq!(a.relocate_left, 0.);
                s.combat.action(4);
                assert_eq!(s.combat.projectiles.len(), count);
                step(&mut s);
                assert_eq!(s.combat.actors[4].view.state, Walk);
                assert!(s.combat.actors[4].relocate_left > 0.);
                assert_eq!(s.combat.projectiles.len(), count);
            }
        }
    }
}

#[test]
fn mirewing_burst_locks_aim_at_first_round_and_retargets_after_last() {
    for taunt in [false, true] {
        let mut s = hovered();
        let p = pos(&s);
        let t = s
            .combat
            .actor_index(s.combat.actors[4].target.unwrap())
            .unwrap();
        run(&mut s, (MIREWING_HOVER / SIM_DT).ceil() as u32 - 1);
        empty(&s);
        let aim = p + V::new(0., 350.);
        s.combat.actors[t].view.pos = aim;
        step(&mut s);
        shot(&s, p, aim);
        let first = s.combat.actors[4].view.state_age;
        assert!((first - MIREWING_HOVER).abs() < SIM_DT);
        let (near, far, dead) = ((t + 1) % 4, (t + 2) % 4, (t + 3) % 4);
        s.combat.actors[near].view.pos = p + V::new(180., 0.);
        s.combat.actors[far].view.pos = p + V::new(-250., 0.);
        down(&mut s, &[dead]); // A closer corpse cannot win retargeting.
        s.combat.actors[dead].view.pos = p + V::new(0., 80.);
        if taunt {
            s.combat.actors[4].taunted_by = Some(s.combat.actors[far].view.id);
            s.combat.actors[4].taunt_left = 10.;
        }
        let burst_end = MIREWING_HOVER + (MIREWING_BURST_ROUNDS - 1) as f32 * MIREWING_BURST_GAP;
        for frame in 1..=((burst_end - first) / SIM_DT).ceil() as u32 {
            s.combat.actors[t].view.pos = aim + V::new(frame as f32 * 2., 0.);
            step(&mut s);
            assert_eq!(pos(&s), p);
            let elapsed = s.combat.actors[4].view.state_age - MIREWING_HOVER;
            let expected = 1 + ((elapsed + 0.00001) / MIREWING_BURST_GAP).floor() as usize;
            assert_eq!(
                s.combat.projectiles.len(),
                expected.min(MIREWING_BURST_ROUNDS as usize)
            );
        }
        for shot in &s.combat.projectiles {
            assert_eq!(shot.start, p);
            assert_eq!(shot.end, aim);
            assert_eq!(shot.view.dir, (aim - p).normalized());
            assert_eq!(shot.damage, 7.);
            assert_eq!(shot.poison_damage, 4.);
            assert_eq!(shot.speed, PROJECTILE_SPEED);
        }
        assert!(s.combat.actors[4].action_done);
        assert_eq!(
            s.combat.actors[4].target,
            Some(s.combat.actors[if taunt { far } else { near }].view.id)
        );
        step(&mut s);
        assert_eq!(s.combat.actors[4].view.state, Walk);
    }
}

#[test]
fn mirewing_mid_burst_interrupt_or_death_cancels_remaining_rounds() {
    for dead in [false, true] {
        let mut s = hovered();
        release(&mut s, None);
        run(&mut s, 8);
        let count = s.combat.projectiles.len();
        assert_eq!(count, 3);
        if dead {
            s.combat.actors[4].view.hp = 0.;
        } else {
            s.combat.bubble_interrupt(4);
        }
        step(&mut s);
        if !dead {
            assert_eq!(s.combat.actors[4].view.state, Walk);
        }
        run(&mut s, SIM_HZ - 1);
        assert_eq!(s.combat.projectiles.len(), count);
    }
}

#[test]
fn mirewing_targetless_cases() {
    for wide in [false, true] {
        let mut cfg = SimConfig::default();
        if wide {
            cfg.arena_size = V::new(2160., 900.);
        }
        let mut s = setup(cfg);
        down(&mut s, &[0, 1, 2, 3]);
        let center = if wide {
            math::floor_point(
                (ARENA_MIN + ARENA_MAX) * 0.5,
                s.combat.actors[4].view.radius,
            )
        } else {
            ARENA_CENTRE
        };
        for _ in 0..if wide { 20 * SIM_HZ } else { 120 } {
            step(&mut s);
            if wide {
                on_floor(&s.combat.actors[4]);
            }
        }
        let a = &s.combat.actors[4];
        assert_eq!(a.view.state, Idle);
        assert!(a.view.pos.distance(center) < MIREWING_ARRIVAL);
        empty(&s);
        if wide {
            assert_eq!(a.velocity, V::default());
        } else {
            s.combat.actors[0].view.hp = s.combat.actors[0].view.max_hp;
            s.combat.actors[0].state(Idle, 0., 0.);
            run(&mut s, 6 * SIM_HZ);
            assert!(!s.combat.projectiles.is_empty());
        }
    }
}

#[test]
fn mirewing_wall_routes_and_bystanders_stay_clear_and_inside_floor() {
    for p in [
        V::new(112., 56.),
        V::new(848., 56.),
        V::new(112., 2144.),
        V::new(848., 2144.),
        V::new(480., 1100.),
    ] {
        let mut s = fixture();
        let target = s.combat.actors[3].view.id;
        let a = &mut s.combat.actors[4];
        a.view.pos = p;
        a.taunted_by = Some(target);
        a.taunt_left = 100.;
        for _ in 0..20 * SIM_HZ {
            step(&mut s);
            let a = &s.combat.actors[4];
            on_floor(a);
            clear(&s, HERO_STATS[0].reach);
        }
        assert!(s.combat.projectiles.len() >= 3);
    }
}

#[test]
fn mirewing_hero_interrupt_cancels_hover_and_death_prevents_release() {
    let mut s = hovered();
    s.combat.bubble_interrupt(4);
    assert!(s.combat.actors[4].action_done);
    assert_eq!(s.combat.actors[4].view.state, Idle);
    hover(&mut s);
    empty(&s);
    s.combat.actors[4].view.hp = 0.;
    run(&mut s, 100);
    empty(&s);
}

#[test]
fn mirewing_full_sim_is_deterministic_across_step_chunking() {
    let (mut a, mut b) = (fixture(), fixture());
    for _ in 0..30 * SIM_HZ {
        a.advance(SIM_DT);
    }
    for _ in 0..60 * SIM_HZ {
        b.advance(SIM_DT * 0.5);
    }
    assert_eq!(a.state_hash(), b.state_hash());
}

#[test]
fn mirewing_hit_stop_freezes_reposition_hover_and_burst_clocks() {
    let mut s = fixture();
    for phase in 0..3 {
        if phase > 0 {
            hover(&mut s);
        } else {
            step(&mut s);
        }
        if phase == 2 {
            release(&mut s, None);
        }
        let count = s.combat.projectiles.len();
        let a = s.combat.actors[4].clone();
        s.combat.hit_stop_steps = 12;
        for _ in 0..12 {
            s.advance(SIM_DT);
        }
        let b = &s.combat.actors[4];
        assert_eq!(b.view.pos, a.view.pos);
        assert_eq!(b.view.state_age, a.view.state_age);
        assert_eq!(b.relocate_left, a.relocate_left);
        assert_eq!(b.enemy_phase, a.enemy_phase);
        assert_eq!(s.combat.projectiles.len(), count);
    }
}
