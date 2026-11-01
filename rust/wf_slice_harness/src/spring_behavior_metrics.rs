//! Read-only 20-seed rescue latency and camping attribution.
use crate::*;
#[derive(Default)]
struct Hero {
    episodes: u32,
    landed: Vec<f64>,
    already_covered: u32,
    other_healed: u32,
    downed_before: u32,
    restored: u32,
    open: u32,
    pool_steps: u64,
    camp_distances: Vec<f32>,
    downs: u32,
}
fn quantile(values: &mut [f64], q: f64) -> f64 {
    values.sort_by(f64::total_cmp);
    if values.is_empty() {
        0.
    } else {
        values[((values.len() - 1) as f64 * q).round() as usize]
    }
}
#[test]
#[ignore = "20-seed Healing Spring behavior attribution"]
fn spring_behavior_twenty_seed_report() {
    let mut totals: [Hero; 4] = Default::default();
    let mut casts = 0;
    let mut camp_pair_steps = 0u64;
    let mut close_pair_steps = 0u64;
    let mut pair_distances = Vec::<f64>::new();
    for seed in 1..=20 {
        let mut s = Sim::new(SimConfig {
            seed,
            ..Default::default()
        });
        s.drain_events();
        let mut pending: [Option<f64>; 4] = [None; 4];
        let mut was_low = [false; 4];
        for _ in 0..900 * 30 {
            s.step();
            let es = s.drain_events();
            let now = s.snapshot.combat_time;
            let spawned: Vec<u32> = es
                .iter()
                .filter_map(|e| match e {
                    Event::HazardSpawned {
                        id,
                        kind: HazardKind::HealingSpring,
                    } => Some(*id),
                    _ => None,
                })
                .collect();
            casts += spawned.len();
            let restored = es
                .iter()
                .any(|e| matches!(e, Event::StageCleared | Event::SceneReset));
            for k in 0..4 {
                let Some(a) = s.combat.actors.iter().find(|a| a.view.id == k as u32 + 1) else {
                    continue;
                };
                let low = a.alive() && a.view.hp <= a.view.max_hp * 0.5;
                if !was_low[k] && low {
                    totals[k].episodes += 1;
                    pending[k] = Some(now);
                    if s.combat.hazards.iter().any(|h| {
                        h.view.kind == HazardKind::HealingSpring
                            && h.view.phase == HazardPhase::Active
                            && !spawned.contains(&h.view.id)
                            && h.hits(a.view.pos, 0.)
                    }) {
                        totals[k].already_covered += 1;
                        pending[k] = None;
                    }
                }
                was_low[k] = low;
                if let Some(start) = pending[k] {
                    let landed = s.combat.hazards.iter().any(|h| {
                        spawned.contains(&h.view.id)
                            && (h.target == Some(a.view.id) || h.hits(a.view.pos, 0.))
                    });
                    if landed {
                        totals[k].landed.push(now - start);
                        pending[k] = None;
                    } else if restored {
                        totals[k].restored += 1;
                        pending[k] = None;
                    } else if !a.alive() {
                        totals[k].downed_before += 1;
                        pending[k] = None;
                    } else if !low {
                        totals[k].other_healed += 1;
                        pending[k] = None;
                    }
                }
                if a.alive()
                    && s.combat.hazards.iter().any(|h| {
                        h.view.kind == HazardKind::HealingSpring
                            && matches!(h.view.phase, HazardPhase::Active | HazardPhase::Resolved)
                            && h.hits(a.view.pos, 0.)
                    })
                {
                    totals[k].pool_steps += 1;
                }
                if a.alive() {
                    if let Some(h) = a.spring_camp.and_then(|id| {
                        s.combat.hazards.iter().find(|h| {
                            h.view.id == id
                                && h.view.phase == HazardPhase::Active
                                && h.hits(a.view.pos, 0.)
                        })
                    }) {
                        totals[k]
                            .camp_distances
                            .push(a.view.pos.distance(h.view.origin));
                    }
                }
            }
            for i in 0..4 {
                for j in i + 1..4 {
                    let (a, b) = (&s.combat.actors[i], &s.combat.actors[j]);
                    if a.alive()
                        && b.alive()
                        && a.spring_camp.is_some()
                        && a.spring_camp == b.spring_camp
                        && s.combat.hazards.iter().any(|h| {
                            Some(h.view.id) == a.spring_camp
                                && h.view.phase == HazardPhase::Active
                                && h.hits(a.view.pos, 0.)
                                && h.hits(b.view.pos, 0.)
                        })
                    {
                        let d = a.view.pos.distance(b.view.pos);
                        camp_pair_steps += 1;
                        pair_distances.push(d as f64);
                        close_pair_steps += u64::from(d < crate::tuning::SEPARATION - 0.01);
                    }
                }
            }
            for e in es {
                if let Event::Downed { id } = e {
                    if (1..=4).contains(&id) {
                        totals[id as usize - 1].downs += 1;
                    }
                }
            }
        }
        for k in 0..4 {
            totals[k].open += u32::from(pending[k].is_some());
        }
    }
    println!("SPRING_BEHAVIOR_REPORT casts={casts}\n| Hero | Episodes | New pool landings | Latency median s | p90 s | Already covered | Healed elsewhere | Downed before landing | Victory/reset | Horizon open | Pool seconds | Camp centre p10 u | Median u | p90 u | Downs |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
    let mut all_latency = Vec::new();
    let mut all_distances = Vec::new();
    for (k, h) in totals.iter_mut().enumerate() {
        let mut d: Vec<f64> = h.camp_distances.iter().map(|&x| x as f64).collect();
        all_latency.extend(h.landed.iter().copied());
        all_distances.extend(d.iter().copied());
        let med = quantile(&mut h.landed, 0.5);
        let p90 = quantile(&mut h.landed, 0.9);
        let dp10 = quantile(&mut d, 0.1);
        let dmed = quantile(&mut d, 0.5);
        let dp90 = quantile(&mut d, 0.9);
        println!("| {:?} | {} | {} | {:.3} | {:.3} | {} | {} | {} | {} | {} | {:.3} | {:.3} | {:.3} | {:.3} | {} |",[Archetype::Fara,Archetype::Hondo,Archetype::Runa,Archetype::Kaja][k],h.episodes,h.landed.len(),med,p90,h.already_covered,h.other_healed,h.downed_before,h.restored,h.open,h.pool_steps as f64/30.,dp10,dmed,dp90,h.downs);
    }
    println!("all_latency_median={:.3} p90={:.3} camp_centre_median={:.3} p10={:.3} p90={:.3} camp_pair_seconds={:.3} close_pair_seconds={:.3} camp_pair_p10={:.3} camp_pair_median={:.3}",quantile(&mut all_latency,0.5),quantile(&mut all_latency,0.9),quantile(&mut all_distances,0.5),quantile(&mut all_distances,0.1),quantile(&mut all_distances,0.9),camp_pair_steps as f64/30.,close_pair_steps as f64/30.,quantile(&mut pair_distances,0.1),quantile(&mut pair_distances,0.5));
}
