//! Owner 2026-11-05 (ORKA-63bf.49): Hondo's burst never leaves him standing while the bar
//! drains. When nothing can be struck the burst ends at once, he goes back to seeking and
//! attacking, and the bar keeps what the burst did not use.
use crate::{tuning::*, *};

/// Hondo with a full bar and sturdy stats, and Goblocs on his line at the given x offsets.
fn scene(offsets: &[f32], hp: f32) -> (Sim, u32, Vec<u32>) {
    let placed: Vec<(f32, f32)> = offsets.iter().map(|dx| (*dx, 0.)).collect();
    scene_at(&placed, hp)
}
/// The same, with each Gobloc at an (x, y) offset from Hondo.
fn scene_at(offsets: &[(f32, f32)], hp: f32) -> (Sim, u32, Vec<u32>) {
    let mut s = Sim::new(SimConfig::default());
    let hondo = s.spawn_actor(Archetype::Hondo, Vec2::new(480., 800.), HERO_STATS[1]);
    let foes: Vec<u32> = offsets.iter().map(|(dx, dy)| s.spawn_actor(Archetype::Gobloc, Vec2::new(480. + dx, 800. + dy), stats(Archetype::Gobloc))).collect();
    for a in &mut s.actors { a.state(ActorState::Idle, 0., 0.); }
    for id in &foes { let i = s.actor_index(*id).unwrap(); s.actors[i].view.max_hp = hp; s.actors[i].view.hp = hp; }
    let h = s.actor_index(hondo).unwrap();
    s.actors[h].view.max_hp = 1e7;
    s.actors[h].view.hp = 1e7;
    s.actors[h].view.meter = 1.;
    (s, hondo, foes)
}
fn hondo(s: &Sim, id: u32) -> &Actor { &s.actors[s.actor_index(id).unwrap()] }
/// Steps until the burst is draining (phase 2); returns the seconds it took.
fn start_burst(s: &mut Sim, id: u32) -> f32 {
    for step in 0..150 {
        s.step();
        if hondo(s, id).combo_phase == 2 { return step as f32 * SIM_DT; }
    }
    panic!("the burst never started (phase {})", hondo(s, id).combo_phase);
}

#[test]
fn a_burst_that_kills_its_only_target_ends_at_once_and_keeps_the_unused_bar() {
    // One weak foe: the first Shadow strike kills it.
    let (mut s, id, _) = scene(&[70.], 1.);
    start_burst(&mut s, id);
    let mut ended = None;
    for step in 0..120 {
        s.step();
        if hondo(&s, id).combo_phase == 0 { ended = Some(step as f32 * SIM_DT); break; }
    }
    let ended = ended.expect("the burst ended");
    assert!(ended < 1., "it ended {ended} s after it began, not after the {COMBO_SECONDS} s drain");
    let kept = hondo(&s, id).view.meter;
    assert!(kept > 0.7 && kept < 1., "the unused bar is kept: {kept}");
    assert_eq!(hondo(&s, id).view.groove_active, 0.);
    // The bar is not drained afterwards; it refills from where it was.
    for _ in 0..60 { s.step(); }
    assert!(hondo(&s, id).view.meter > kept, "refilling: {} after {kept}", hondo(&s, id).view.meter);
    assert_eq!(hondo(&s, id).combo_phase, 0);
}

#[test]
fn a_burst_with_nothing_left_in_reach_ends_and_hondo_goes_after_the_enemy() {
    // A sturdy foe that leaves the burst's reach after the first strike.
    let (mut s, id, foes) = scene(&[70.], 1e7);
    start_burst(&mut s, id);
    let f = s.actor_index(foes[0]).unwrap();
    let far = Vec2::new(480. + COMBO_RADIUS + 260., 800.);
    let mut ended = None;
    for step in 0..150 {
        // Hold the foe far outside COMBO_RADIUS of where the burst began.
        s.actors[f].view.pos = far;
        s.step();
        if ended.is_none() && hondo(&s, id).combo_phase == 0 { ended = Some(step as f32 * SIM_DT); break; }
    }
    let ended = ended.expect("the burst ended without a target");
    assert!(ended < 1.2, "he did not wait out the drain: ended after {ended} s");
    let kept = hondo(&s, id).view.meter;
    assert!(kept > 0.6 && kept < 1., "the unused bar is kept: {kept}");
    // He is free again: within two seconds he has moved toward the enemy instead of standing.
    let from = hondo(&s, id).view.pos;
    for _ in 0..60 { s.actors[f].view.pos = far; s.step(); }
    let now = hondo(&s, id).view.pos;
    assert!(now.distance(far) < from.distance(far) - 20., "he walked toward the foe: {from:?} -> {now:?}");
    assert!(hondo(&s, id).view.meter >= kept, "and the bar did not drain while he walked");
}

#[test]
fn a_full_burst_still_drains_the_whole_bar_and_ends_with_split() {
    // Sturdy foes that stay in reach: the burst runs its full course.
    let (mut s, id, foes) = scene(&[70., -90.], 1e7);
    start_burst(&mut s, id);
    let marks: Vec<(usize, Vec2)> = foes.iter().map(|f| { let i = s.actor_index(*f).unwrap(); (i, s.actors[i].view.pos) }).collect();
    let (mut strikes, mut split, mut ended, mut lowest) = (0, false, None, 1.0f32);
    for step in 0..300 {
        for (i, pos) in &marks { s.actors[*i].view.pos = *pos; s.actors[*i].view.hp = 1e7; }
        s.step();
        for e in s.drain_events() {
            match e {
                Event::SkillStarted { id: hero, skill: Skill::Shadow, .. } if hero == id => strikes += 1,
                Event::SkillStarted { id: hero, skill: Skill::Split, .. } if hero == id => split = true,
                _ => {}
            }
        }
        lowest = lowest.min(hondo(&s, id).view.meter);
        if hondo(&s, id).combo_phase == 0 { ended = Some(step as f32 * SIM_DT); break; }
    }
    let ended = ended.expect("the burst ended");
    assert!(ended >= COMBO_SECONDS - 0.2, "it ran the whole {COMBO_SECONDS} s drain: {ended} s");
    assert!(strikes >= 3 && split, "{strikes} more Shadow strikes, Split: {split}");
    assert!(lowest < 0.02, "a burst that ran to its end used the whole bar: {lowest}");
}

/// Shadow strikes Hondo landed on each foe, in foe order, until the burst ends; foes are held
/// in place so only the burst's own rules decide who is struck.
fn strikes_per_foe(s: &mut Sim, id: u32, foes: &[u32], sturdy: bool) -> (Vec<u32>, f32) {
    let marks: Vec<(u32, Vec2)> = foes.iter().map(|f| (*f, s.actors[s.actor_index(*f).unwrap()].view.pos)).collect();
    let mut hits = vec![0u32; foes.len()];
    for _ in 0..400 {
        for (foe, pos) in &marks {
            if let Some(i) = s.actor_index(*foe) { if s.actors[i].alive() { s.actors[i].view.pos = *pos; if sturdy { s.actors[i].view.hp = 1e7; } } }
        }
        s.step();
        for e in s.drain_events() {
            if let Event::Blink { hero, target, .. } = e { if hero == id { if let Some(k) = foes.iter().position(|f| *f == target) { hits[k] += 1; } } }
        }
        if hondo(s, id).combo_phase == 0 && hits.iter().sum::<u32>() > 0 { break; }
    }
    (hits, hondo(s, id).view.meter)
}

#[test]
fn a_burst_strikes_every_foe_in_its_reach_even_when_they_are_off_hondos_line() {
    // Owner 2026-11-06 (ORKA-63bf.50): one foe on his line to open on, three more well off it
    // (steeper than the 18 degree dash line), all inside the burst's 300-unit reach. Each
    // falls to one strike, so the burst must go on to the next one while the bar lasts.
    let (mut s, id, foes) = scene_at(&[(70., 0.), (40., 150.), (-120., -140.), (-60., 190.)], 1.);
    let (hits, kept) = strikes_per_foe(&mut s, id, &foes, false);
    assert_eq!(hits, vec![1, 1, 1, 1], "every foe in reach was struck once");
    assert!(foes.iter().all(|f| s.actor_index(*f).is_none_or(|i| !s.actors[i].alive())), "and fell");
    // Four strikes: the opening one is free, each later one costs its time on the 4 s bar.
    assert!(kept > 0.3 && kept < 0.6, "the bar paid for three follow-up strikes and kept the rest: {kept}");
}

#[test]
fn a_full_burst_spreads_its_strikes_over_sturdy_foes_off_the_line() {
    let (mut s, id, foes) = scene_at(&[(70., 0.), (40., 150.), (-120., -140.)], 1e7);
    let (hits, kept) = strikes_per_foe(&mut s, id, &foes, true);
    assert!(hits.iter().all(|h| *h >= 1), "each foe was struck: {hits:?}");
    assert!(hits.iter().sum::<u32>() >= 5, "the whole bar was spent on strikes: {hits:?}");
    assert!(kept < 0.02, "a burst with targets to the end uses the whole bar: {kept}");
}

#[test]
fn the_opening_strike_still_needs_hondos_own_line() {
    // Only an off-line foe: no burst starts from here; he lines up first (the AI's job).
    let (s, id, foes) = scene_at(&[(40., 150.)], 1e7);
    let (h, f) = (s.actor_index(id).unwrap(), s.actor_index(foes[0]).unwrap());
    assert!(s.combo_landing(h, f, hondo(&s, id).view.pos).is_none());
}
