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

/// Owner 2026-11-05: Arcane Pulse is a blast on its target whose radius is the distance the
/// pulse travelled from Kaja (never less than the drawn burst), hitting living enemies only.
#[test]
fn arcane_pulse_hits_every_living_enemy_within_the_distance_it_travelled() {
    let pulse = |kaja_y: f32, near: f32| {
        let mut s = Sim::new(SimConfig::default());
        let centre = Vec2::new(480., 600.);
        s.spawn_actor(Archetype::Kaja, Vec2::new(480., kaja_y), HERO_STATS[3]);
        let ids: Vec<u32> = [0., near, -270.]
            .into_iter()
            .map(|dx| s.spawn_actor(Archetype::Gobloc, centre + Vec2::new(dx, 0.), stats(Archetype::Gobloc)))
            .collect();
        let fallen = s.spawn_actor(Archetype::Gobloc, centre + Vec2::new(-40., 0.), stats(Archetype::Gobloc));
        for a in &mut s.actors {
            a.state(ActorState::Idle, 0., 0.);
        }
        let i = s.actor_index(fallen).unwrap();
        s.actors[i].view.hp = 0.;
        s.actors[i].state(ActorState::Dead, 0., 0.);
        s.start_arcane_pulse(0, ids[0]);
        s.actors[0].view.state_age = s.actors[0].view.impact_at;
        s.action(0);
        let h = s.hazards.iter().find(|h| h.view.kind == HazardKind::ArcanePulse).unwrap();
        assert_eq!(h.view.shape, Shape::Circle { radius: ARCANE_PULSE_RADIUS }, "the drawn burst is unchanged");
        assert_eq!(h.view.origin, centre, "centred on the target");
        // The countdown runs with everyone moving as they would in a fight.
        let mut victims = None;
        for _ in 0..60 {
            s.step();
            victims = s.drain_events().into_iter().find_map(|e| match e {
                Event::HazardResolved { kind: HazardKind::ArcanePulse, victims, .. } => Some(victims),
                _ => None,
            });
            if victims.is_some() { break; }
        }
        (ids, fallen, victims.expect("the pulse resolved"))
    };
    // Cast from 230 away: the blast reaches half of that, 115, past the drawn 95.
    let (ids, fallen, victims) = pulse(830., 108.);
    assert!(victims.contains(&ids[0]) && victims.contains(&ids[1]), "target and the enemy 108 away: {victims:?}");
    // The same cast with an enemy 140 away: outside 115 now (it was inside the old full-distance blast).
    let (ids, _, victims) = pulse(830., 140.);
    assert_eq!(victims, vec![ids[0]]);
    assert_eq!((arcane_pulse_blast_radius(230.), arcane_pulse_blast_radius(120.), ARCANE_PULSE_BLAST_SCALE), (115., ARCANE_PULSE_RADIUS, 0.5));
    assert!(!victims.contains(&ids[2]), "270 away is out of the blast");
    assert!(!victims.contains(&fallen), "the fallen are never hit");
    // Cast from 60 away: the blast is still the drawn burst, so 190 away is safe.
    let (ids, _, victims) = pulse(660., 190.);
    assert_eq!(victims, vec![ids[0]]);
}

/// A held scene for the totem tests: Kaja 230 below the blast centre (a 115 blast), three sturdy Goblocs that
/// are put back on their marks after every step so only the totem decides who is inside.
struct TotemScene { s: Sim, kaja: u32, marks: Vec<(u32, Vec2)> }
const TOTEM_CENTRE: Vec2 = Vec2 { x: 480., y: 600. };
impl TotemScene {
    fn new(meter: f32) -> Self {
        let mut s = Sim::new(SimConfig::default());
        let kaja = s.spawn_actor(Archetype::Kaja, TOTEM_CENTRE + Vec2::new(0., 230.), HERO_STATS[3]);
        let mut marks = vec![(kaja, TOTEM_CENTRE + Vec2::new(0., 230.))];
        // On the centre, 105 away (inside a 115 blast, outside the drawn 95), and 270 away.
        for dx in [0., 105., -270.] {
            let pos = TOTEM_CENTRE + Vec2::new(dx, 0.);
            marks.push((s.spawn_actor(Archetype::Gobloc, pos, stats(Archetype::Gobloc)), pos));
        }
        for a in &mut s.actors { a.state(ActorState::Idle, 0., 0.); a.view.max_hp = 1e7; a.view.hp = 1e7; }
        s.actors[0].view.meter = meter;
        let mut scene = Self { s, kaja, marks };
        scene.hold();
        scene
    }
    fn hold(&mut self) {
        for (id, pos) in &self.marks {
            let i = self.s.actor_index(*id).unwrap();
            let a = &mut self.s.actors[i];
            a.view.pos = *pos;
            a.basic_cd = 1e9;
            if a.alive() { a.view.hp = 1e7; }
        }
    }
    fn kaja(&self) -> &Actor { &self.s.actors[self.s.actor_index(self.kaja).unwrap()] }
    fn totem(&self) -> Option<&Hazard> { self.s.hazards.iter().find(|h| h.view.kind == HazardKind::ArcaneTotem && h.view.phase != HazardPhase::Resolved) }
    /// Casts on the centre Gobloc and steps until the blast resolves; returns its hit on that Gobloc.
    fn cast(&mut self) -> f32 {
        let target = self.marks[1].0;
        self.s.start_arcane_pulse(0, target);
        self.s.actors[0].view.state_age = self.s.actors[0].view.impact_at;
        self.s.action(0);
        for _ in 0..90 {
            self.s.step();
            self.hold();
            let events = self.s.drain_events();
            if events.iter().any(|e| matches!(e, Event::HazardResolved { kind: HazardKind::ArcanePulse, .. })) {
                return events.iter().find_map(|e| match e { Event::Hit { target: t, amount, element: Element::Arcane, .. } if *t == target => Some(*amount), _ => None }).expect("the blast hit its target");
            }
        }
        panic!("the pulse never resolved");
    }
}

/// Owner 2026-11-05 (ORKA-63bf.41): Arcane Pulse leaves a light totem as wide as its blast. It
/// ticks enemies standing inside it each second (the Faze pool's math, as Arcane damage) and is
/// paid from Kaja's special bar: a full bar lasts 8 s, then the bar refills again.
#[test]
fn arcane_pulse_leaves_a_totem_as_wide_as_the_blast_that_drains_the_bar_and_ticks_enemies_inside() {
    let mut scene = TotemScene::new(3.);
    let blast = scene.cast();
    assert!((scene.kaja().view.meter - 3.).abs() < 0.05, "the cast itself costs no stock: {}", scene.kaja().view.meter);
    let totem = scene.totem().expect("the blast left a totem").clone();
    // The pulse follows its target until it bursts, so the centre is where that Gobloc stood then.
    assert!(totem.view.origin.distance(TOTEM_CENTRE) < 3., "where the pulse burst: {:?}", totem.view.origin);
    let Shape::Circle { radius } = totem.view.shape else { panic!("a circle") };
    assert!((radius - 115.).abs() < 2. && radius > ARCANE_PULSE_RADIUS + 15., "as wide as the blast reached (half of 230), not the drawn 95: {radius}");
    assert_eq!((totem.view.team, totem.view.hostile, totem.view.fill, totem.policy), (Team::Hero, true, FillMode::Loop, crate::hazards::HitPolicy::Continuous));
    assert!((totem.damage - scene.kaja().committed_stats().attack(DamageChannel::Magic) * FAZE_POTENCY).abs() < 1e-4, "the Faze pool's potency");
    assert_eq!((ARCANE_TOTEM_DRAIN, ARCANE_TOTEM_PULSE, ARCANE_TOTEM_POTENCY), (0.375, FAZE_PULSE, FAZE_POTENCY));
    let (centre, inside, outside) = (scene.marks[1].0, scene.marks[2].0, scene.marks[3].0);
    let mut ticks: std::collections::BTreeMap<u32, Vec<f32>> = Default::default();
    let (mut lived, mut before, mut after_two) = (0.0f32, scene.kaja().view.meter, 0.0f32);
    let mut casts = 0;
    while scene.totem().is_some() {
        scene.s.step();
        scene.hold();
        lived += SIM_DT;
        assert!(lived < 12., "the totem never dissolved");
        let meter = scene.kaja().view.meter;
        assert!(meter < before, "the bar only drains while the totem stands: {before} -> {meter}");
        before = meter;
        if (lived - 2.).abs() < SIM_DT / 2. { after_two = meter; }
        assert_eq!(scene.s.hazards.iter().filter(|h| matches!(h.view.kind, HazardKind::ArcaneTotem | HazardKind::ArcanePulse)).count(), 1, "one totem, no second pulse");
        for e in scene.s.drain_events() {
            match e {
                Event::Hit { target, amount, element, .. } => { assert_eq!(element, Element::Arcane); ticks.entry(target).or_default().push(amount); }
                Event::SkillStarted { id, .. } if id == scene.kaja => casts += 1,
                _ => {}
            }
        }
    }
    assert!((lived - ARCANE_TOTEM_FULL_BAR_SECONDS).abs() < 0.1, "a full bar lasted {lived} s");
    assert!((after_two - (3. - 2. * ARCANE_TOTEM_DRAIN)).abs() < 0.03, "0.375 stocks a second: {after_two} after 2 s");
    assert_eq!((scene.kaja().view.meter, casts), (0., 0), "empty when it dissolves, and no other special while it stood");
    // One tick a second on every enemy inside the blast's circle; none outside it.
    for id in [centre, inside] {
        let hits = &ticks[&id];
        assert!((7..=8).contains(&hits.len()), "{} ticks in 8 s", hits.len());
        assert!(hits.iter().all(|h| (*h - hits[0]).abs() < 1e-4) && hits[0] > 0. && hits[0] < blast * 0.25, "weak, even ticks: {} against a {blast} blast", hits[0]);
    }
    assert!(!ticks.contains_key(&outside), "270 away never stood in it");
    // The bar refills again once the totem is gone.
    for _ in 0..30 { scene.s.step(); scene.hold(); }
    assert!(scene.kaja().view.meter > 0.1, "refill resumed: {}", scene.kaja().view.meter);
}

/// The tick follows who is standing inside: it stops when an enemy leaves and returns with it.
#[test]
fn the_totem_ticks_only_enemies_standing_inside_it() {
    let mut scene = TotemScene::new(3.);
    scene.cast();
    let walker = scene.marks[2].0;
    let (inside, outside) = (TOTEM_CENTRE + Vec2::new(105., 0.), TOTEM_CENTRE + Vec2::new(150., 0.));
    let mut hits = Vec::new();
    let mut time = 0.0f32;
    while scene.totem().is_some() {
        // Inside for the first 2.5 s, outside until 5.5 s, back inside to the end.
        scene.marks[2].1 = if (2.5..5.5).contains(&time) { outside } else { inside };
        scene.hold();
        scene.s.step();
        scene.hold();
        time += SIM_DT;
        for e in scene.s.drain_events() { if let Event::Hit { target, .. } = e { if target == walker { hits.push(time); } } }
    }
    assert!(hits.iter().all(|t| !(2.6..5.4).contains(t)), "no tick while it stood outside: {hits:?}");
    assert!(hits.iter().filter(|t| **t < 2.6).count() == 2 && hits.iter().filter(|t| **t > 5.4).count() >= 2, "ticks before and after: {hits:?}");
}

/// A one-stock cast lasts 2.67 s; a fallen Kaja's totem dissolves at once; the 10 s cap holds.
#[test]
fn the_totem_ends_with_the_bar_with_kaja_or_after_ten_seconds() {
    let mut scene = TotemScene::new(1.);
    scene.cast();
    let mut lived = 0.0f32;
    while scene.totem().is_some() { scene.s.step(); scene.hold(); lived += SIM_DT; assert!(lived < 12.); }
    assert!((lived - 1. / ARCANE_TOTEM_DRAIN).abs() < 0.25, "one stock lasted {lived} s");
    let mut scene = TotemScene::new(3.);
    scene.cast();
    for _ in 0..30 { scene.s.step(); scene.hold(); }
    assert!(scene.totem().is_some());
    let k = scene.s.actor_index(scene.kaja).unwrap();
    scene.s.actors[k].view.hp = 0.;
    scene.s.actors[k].state(ActorState::Dead, 0., 0.);
    scene.s.step();
    scene.s.step();
    assert!(scene.totem().is_none(), "the channel broke with Kaja");
    // The clock alone ends it at 10 s even if the bar were kept full.
    let mut scene = TotemScene::new(3.);
    scene.cast();
    let mut lived = 0.0f32;
    while scene.totem().is_some() { let k = scene.s.actor_index(scene.kaja).unwrap(); scene.s.actors[k].view.meter = 3.; scene.s.step(); scene.hold(); lived += SIM_DT; assert!(lived < 12.); }
    assert!((lived - ARCANE_TOTEM_MAX_SECONDS).abs() < 0.1, "capped at {lived} s");
}
