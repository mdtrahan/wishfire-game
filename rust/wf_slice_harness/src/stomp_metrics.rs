use crate::*;
use std::collections::BTreeMap;
pub use wf_combat::stomp_metrics::*;
#[test]
#[ignore = "20-seed marching stomp attribution"]
fn marching_stomp_twenty_seed_report() {
    let mut spawned = [0u64; 4];
    let mut resolved = [0u64; 4];
    let mut cancelled = [0u64; 4];
    let mut risk = [0u64; 4];
    let mut contact = [0u64; 4];
    let mut landed = [0u64; 4];
    let mut evaded = [0u64; 4];
    let mut damage = [0f64; 4];
    let mut enemy_damage = 0.;
    let mut troll_damage = 0.;
    let mut downs = [0u64; 4];
    let mut censored = [0u64; 4];
    let mut patterns = 0;
    let mut threatened = [0u64; 4];
    let mut stayed = [0u64; 4];
    let mut entered = [0u64; 4];
    for seed in 1..=20 {
        let mut s = Sim::new(SimConfig {
            seed,
            ..Default::default()
        });
        s.drain_events();
        let mut enemies = BTreeMap::new();
        let mut circles = BTreeMap::<u32, (usize, u32, u8)>::new();
        CONTACTS.with(|c| *c.borrow_mut() = Some(Vec::new()));
        for _ in 0..900 * 30 {
            s.step();
            let mut next = BTreeMap::<u32, usize>::new();
            let mut pending = BTreeMap::<u32, (u64, u64, f64)>::new();
            for a in &s.combat.actors {
                if a.view.team == Team::Enemy {
                    enemies.insert(a.view.id, a.view.archetype);
                }
            }
            for e in s.drain_events() {
                match e {
                    Event::HazardSpawned { id, kind }
                        if kind == HazardKind::BossSlam
                            || format!("{kind:?}") == "BossStompStep" =>
                    {
                        if let Some(h) = s.combat.hazards.iter().find(|h| h.view.id == id) {
                            let index = if kind == HazardKind::BossSlam {
                                0
                            } else {
                                let n = next.entry(h.view.owner).or_default();
                                let k = *n;
                                *n += 1;
                                k
                            };
                            if index == 0 {
                                patterns += 1;
                            }
                            spawned[index] += 1;
                            let mut initial = 0u8;
                            for a in &s.combat.actors {
                                if a.alive() && a.view.team == Team::Hero && h.hits(a.view.pos, 0.)
                                {
                                    initial |=
                                        1u8 << crate::actors::hero_index(a.view.archetype).unwrap();
                                }
                            }
                            circles.insert(id, (index, h.view.owner, initial));
                        }
                    }
                    Event::Hit {
                        source,
                        target,
                        amount,
                        ..
                    } if enemies.contains_key(&source)
                        && s.combat
                            .actor_index(target)
                            .is_some_and(|i| s.combat.actors[i].view.team == Team::Hero) =>
                    {
                        enemy_damage += amount as f64;
                        if enemies[&source] == Archetype::Boss {
                            troll_damage += amount as f64;
                        }
                        let p = pending.entry(source).or_default();
                        p.0 += 1;
                        p.2 += amount as f64;
                    }
                    Event::Evaded { source, .. } => {
                        pending.entry(source).or_default().1 += 1;
                    }
                    Event::HazardResolved { id, .. } => {
                        if let Some((k, owner, initial)) = circles.remove(&id) {
                            resolved[k] += 1;
                            if let Some((_, r, c, alive_mask, contact_mask)) = CONTACTS.with(|c| {
                                c.borrow()
                                    .as_ref()
                                    .and_then(|cs| cs.iter().find(|c| c.0 == id).copied())
                            }) {
                                risk[k] += r as u64;
                                contact[k] += c as u64;
                                threatened[k] += (initial & alive_mask).count_ones() as u64;
                                stayed[k] +=
                                    (initial & alive_mask & contact_mask).count_ones() as u64;
                                entered[k] += (!initial & contact_mask).count_ones() as u64;
                            }
                            if let Some(p) = pending.remove(&owner) {
                                landed[k] += p.0;
                                evaded[k] += p.1;
                                damage[k] += p.2;
                            }
                        }
                    }
                    Event::HazardCancelled { id, .. } => {
                        if let Some((k, _, _)) = circles.remove(&id) {
                            cancelled[k] += 1;
                        }
                    }
                    Event::Downed { id } => {
                        if let Some(k) = s.combat.actor_index(id).and_then(|i| {
                            crate::actors::hero_index(s.combat.actors[i].view.archetype)
                        }) {
                            downs[k] += 1;
                        }
                    }
                    Event::SceneReset | Event::StageCleared => {
                        for (k, _, _) in circles.values() {
                            censored[*k] += 1;
                        }
                        circles.clear();
                    }
                    _ => {}
                }
            }
            CONTACTS.with(|c| {
                if let Some(cs) = c.borrow_mut().as_mut() {
                    cs.clear();
                }
            });
        }
        for (k, _, _) in circles.values() {
            censored[*k] += 1;
        }
        CONTACTS.with(|c| *c.borrow_mut() = None);
    }
    println!("STOMP_REPORT patterns={patterns} spawned={spawned:?} resolved={resolved:?} cancelled={cancelled:?} censored={censored:?}");
    println!("STOMP_ESCAPE threatened={threatened:?} stayed={stayed:?} entered={entered:?}");
    println!("STOMP_HITS risk={risk:?} contact={contact:?} landed={landed:?} evaded={evaded:?} damage={damage:?}");
    println!(
        "STOMP_PARTY enemy_damage={enemy_damage:.6} troll_damage={troll_damage:.6} downs={downs:?}"
    );
}
#[test]
#[ignore = "20-seed stage-two summon-removal attribution"]
fn chimera_summons_twenty_seed_report() {
    let mut reached = 0;
    let mut first_kills = 0;
    let mut first_wipes = 0;
    let mut open = 0;
    let mut unreached = 0;
    let mut lengths = Vec::<f64>::new();
    let mut downs = [0u64; 4];
    for seed in 1..=20 {
        let mut s = Sim::new(SimConfig {
            seed,
            ..Default::default()
        });
        s.drain_events();
        let mut active = None;
        let mut finished = false;
        for _ in 0..900 * 30 {
            s.step();
            let now = s.snapshot.combat_time;
            let stage = s.snapshot.stage.wave;
            for e in s.drain_events() {
                match e {
                    Event::BossArrived { id } if stage == 2 && !finished && active.is_none() => {
                        active = Some((id, now));
                        reached += 1;
                    }
                    Event::Downed { id } if active.is_some() => {
                        if let Some(k) = s.combat.actor_index(id).and_then(|i| {
                            crate::actors::hero_index(s.combat.actors[i].view.archetype)
                        }) {
                            downs[k] += 1;
                        }
                    }
                    Event::Died { id } if active.is_some_and(|(boss, _)| id == boss) => {
                        let (_, start) = active.take().unwrap();
                        lengths.push(now - start);
                        first_kills += 1;
                        finished = true;
                    }
                    Event::WaveReset if stage == 2 && !finished => {
                        first_wipes += 1;
                        active = None;
                        finished = true;
                    }
                    _ => {}
                }
            }
        }
        if active.is_some() {
            open += 1;
        } else if !finished {
            unreached += 1;
        }
    }
    lengths.sort_by(f64::total_cmp);
    let mean = lengths.iter().sum::<f64>() / lengths.len().max(1) as f64;
    let median = lengths.get(lengths.len() / 2).copied().unwrap_or(0.);
    println!("CHIMERA_REPORT reached={reached} first_kills={first_kills} first_wipes={first_wipes} open={open} unreached={unreached} mean_kill_s={mean:.6} median_kill_s={median:.6} downs={downs:?}");
}
