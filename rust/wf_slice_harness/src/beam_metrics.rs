use crate::*;
use std::collections::BTreeMap;
pub use wf_combat::beam_metrics::*;
#[test]
#[ignore = "20-seed Djinn beam lane report"]
fn djinn_beam_twenty_seed_report() {
    let (
        mut spawned,
        mut resolved,
        mut cancelled,
        mut censored,
        mut threatened,
        mut escaped,
        mut opportunities,
        mut contacts,
        mut hits,
    ) = (
        [0u64; 2], [0u64; 2], [0u64; 2], [0u64; 2], [0u64; 2], [0u64; 2], [0u64; 2], [0u64; 2],
        [0u64; 2],
    );
    let mut damage = [0f64; 2];
    let mut widths: [Vec<f32>; 2] = Default::default();
    let mut locks: [Vec<f32>; 2] = Default::default();
    let mut lengths: [Vec<f32>; 2] = Default::default();
    let mut raw: [Vec<f32>; 2] = Default::default();
    let mut target_distances = Vec::new();
    let mut twin_gaps = Vec::new();
    let mut twin_overlaps = 0;
    let (mut reached, mut first_kills, mut first_wipes, mut open, mut unreached) = (0, 0, 0, 0, 0);
    let mut first_lengths = Vec::<f32>::new();
    let mut fight_downs = [0u64; 4];
    let mut downs = [0u64; 4];
    for seed in 1..=20 {
        let mut s = Sim::new(SimConfig {
            seed,
            ..Default::default()
        });
        s.drain_events();
        let mut pending = BTreeMap::<u32, Line>::new();
        let mut first = None;
        let mut finished = false;
        DAMAGE.with(|d| *d.borrow_mut() = Some(BTreeMap::new()));
        for _ in 0..900 * 30 {
            s.step();
            let now = s.snapshot.combat_time;
            for h in &s.combat.hazards {
                if h.view.kind != HazardKind::BossSnipe {
                    continue;
                }
                if let Some(p) = pending.get_mut(&h.view.id) {
                    if !p.locked && h.view.phase == HazardPhase::Locked {
                        p.locked = true;
                        let Shape::Line { width, length } = h.view.shape else {
                            unreachable!()
                        };
                        widths[p.kind].push(width);
                        lengths[p.kind].push(length);
                        locks[p.kind].push(h.duration);
                        raw[p.kind].push(h.damage);
                        if h.aim_offset > 0. {
                            if let Some(t) = h.target.and_then(|id| s.combat.actor_index(id)) {
                                target_distances
                                    .push(h.view.origin.distance(s.combat.actors[t].view.pos));
                                let distance = h.view.origin.distance(s.combat.actors[t].view.pos);
                                let angle = h.aim_offset.abs();
                                let gap = 2. * distance * libm::tanf(angle)
                                    - (width + 2. * crate::tuning::BODY_RADIUS) / libm::cosf(angle);
                                twin_overlaps += usize::from(gap <= 0.);
                                twin_gaps.push(gap);
                            }
                        }
                    }
                    if !p.launched && h.view.phase == HazardPhase::Active {
                        p.launched = true;
                        let living = s
                            .combat
                            .actors
                            .iter()
                            .filter(|a| a.alive() && a.view.team == Team::Hero)
                            .fold(0u8, |m, a| {
                                m | (1 << crate::actors::hero_index(a.view.archetype).unwrap())
                            });
                        let initial = p.initial & living;
                        threatened[p.kind] += initial.count_ones() as u64;
                        escaped[p.kind] += (initial & !mask(&s, h)).count_ones() as u64;
                        opportunities[p.kind] += living.count_ones() as u64;
                    }
                }
            }
            for e in s.drain_events() {
                match e {
                    Event::HazardSpawned {
                        id,
                        kind: HazardKind::BossSnipe,
                    } => {
                        if let Some(h) = s.combat.hazards.iter().find(|h| h.view.id == id) {
                            let kind = usize::from(h.aim_offset.abs() > 0.00001);
                            spawned[kind] += 1;
                            pending.insert(
                                id,
                                Line {
                                    kind,
                                    initial: mask(&s, h),
                                    locked: false,
                                    launched: false,
                                },
                            );
                        }
                    }
                    Event::HazardResolved {
                        id,
                        kind: HazardKind::BossSnipe,
                        ..
                    } => {
                        if let Some(p) = pending.remove(&id) {
                            resolved[p.kind] += 1;
                            if let Some(h) = s.combat.hazards.iter().find(|h| h.view.id == id) {
                                contacts[p.kind] +=
                                    h.front_hit.iter().filter(|&&b| b).count() as u64;
                                hits[p.kind] +=
                                    h.front_damaged.iter().filter(|&&b| b).count() as u64;
                            }
                            damage[p.kind] += DAMAGE.with(|d| {
                                d.borrow_mut().as_mut().unwrap().remove(&id).unwrap_or(0.)
                            });
                        }
                    }
                    Event::HazardCancelled {
                        id,
                        kind: HazardKind::BossSnipe,
                    } => {
                        if let Some(p) = pending.remove(&id) {
                            cancelled[p.kind] += 1;
                        }
                    }
                    Event::BossArrived { id } if s.stage.wave == 3 && !finished => {
                        reached += 1;
                        first = Some((id, now));
                    }
                    Event::Died { id } if first.is_some_and(|(boss, _)| boss == id) => {
                        let (_, start) = first.take().unwrap();
                        first_lengths.push((now - start) as f32);
                        first_kills += 1;
                        finished = true;
                    }
                    Event::WaveReset if s.stage.wave == 3 && !finished => {
                        first_wipes += 1;
                        first = None;
                        finished = true;
                    }
                    Event::Downed { id } => {
                        if let Some(k) = s.combat.actor_index(id).and_then(|i| {
                            crate::actors::hero_index(s.combat.actors[i].view.archetype)
                        }) {
                            downs[k] += 1;
                            if first.is_some() {
                                fight_downs[k] += 1;
                            }
                        }
                    }
                    Event::SceneReset => {
                        for p in pending.values() {
                            censored[p.kind] += 1;
                        }
                        pending.clear();
                    }
                    _ => {}
                }
            }
        }
        for p in pending.values() {
            censored[p.kind] += 1;
        }
        if first.is_some() {
            open += 1;
        } else if !finished {
            unreached += 1;
        }
        DAMAGE.with(|d| *d.borrow_mut() = None);
    }
    println!("BEAM_COUNTS spawned={spawned:?} resolved={resolved:?} cancelled={cancelled:?} censored={censored:?} threatened={threatened:?} escaped={escaped:?} opportunities={opportunities:?} contacts={contacts:?} hits={hits:?} damage={damage:?}");
    for k in 0..2 {
        println!("BEAM_SIZE kind={k} locked={} width_median={:.6} length_median={:.6} lock_p10={:.6} lock_median={:.6} lock_max={:.6} raw_median={:.6}",widths[k].len(),quantile(&mut widths[k],0.5),quantile(&mut lengths[k],0.5),quantile(&mut locks[k],0.1),quantile(&mut locks[k],0.5),quantile(&mut locks[k],1.),quantile(&mut raw[k],0.5));
    }
    println!(
        "BEAM_TWIN pairs={} overlaps={twin_overlaps} distance_p10={:.6} distance_median={:.6} gap_min={:.6} gap_p10={:.6} gap_median={:.6}",
        twin_gaps.len(),
        quantile(&mut target_distances, 0.1),
        quantile(&mut target_distances, 0.5),
        quantile(&mut twin_gaps, 0.),
        quantile(&mut twin_gaps, 0.1),
        quantile(&mut twin_gaps, 0.5)
    );
    let mean = first_lengths.iter().sum::<f32>() / first_lengths.len().max(1) as f32;
    let median = quantile(&mut first_lengths, 0.5);
    println!("BEAM_FIGHT reached={reached} first_kills={first_kills} first_wipes={first_wipes} open={open} unreached={unreached} mean_kill_s={mean:.6} median_kill_s={median:.6} fight_downs={fight_downs:?} downs={downs:?}");
}
