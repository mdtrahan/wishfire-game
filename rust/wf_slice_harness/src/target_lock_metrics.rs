use crate::*;
use std::collections::BTreeSet;
pub use wf_combat::target_lock_metrics::*;
pub fn observe(s: &Sim, events: &[Event]) {
    LOG.with_borrow_mut(|l| {
        let Some(l) = l else { return };
        l.scope = None;
        if s.snapshot.stage.fade == 0.
            && s.combat
                .actors
                .iter()
                .any(|a| a.alive() && a.view.team == Team::Enemy)
        {
            l.active_steps += 1;
        }
        for i in 0..4 {
            if let Some(k) = l.current[i] {
                if !l.casts[k].closed
                    && !l.casts[k].linked
                    && !s.combat.actors.get(i).is_some_and(|a| {
                        a.alive()
                            && !a.action_done
                            && matches!(a.view.state, ActorState::Basic | ActorState::Cast)
                    })
                {
                    l.casts[k].cancelled = true;
                    close(l, k, s);
                }
            }
        }
        let done: Vec<_> = l
            .hazards
            .iter()
            .filter(|(id, _)| {
                s.combat
                    .hazards
                    .iter()
                    .find(|h| h.view.id == **id)
                    .is_none_or(|h| h.view.phase == HazardPhase::Resolved)
            })
            .map(|(&id, &k)| (id, k))
            .collect();
        for (id, k) in done {
            close(l, k, s);
            l.hazards.remove(&id);
        }
        let done: Vec<_> = l
            .shots
            .iter()
            .filter(|(id, _)| !s.combat.projectiles.iter().any(|p| p.view.id == **id))
            .map(|(&id, &k)| (id, k))
            .collect();
        for (id, k) in done {
            close(l, k, s);
            l.shots.remove(&id);
        }
        for e in events {
            match e {
                Event::Downed { id } if (1..=4).contains(id) => l.downs[*id as usize - 1] += 1,
                _ => {}
            }
        }
    });
}
#[test]
#[ignore = "20-seed target-only before/after attribution"]
pub fn target_lock_twenty_seed_report() {
    LOG.with_borrow_mut(|l| *l = Some(Log::default()));
    let mut combat = 0.;
    for seed in 1..=20 {
        let mut s = Sim::new(SimConfig {
            seed,
            ..Default::default()
        });
        s.drain_events();
        let mut boss: Option<(u32, usize, f64)> = None;
        for _ in 0..900 * 30 {
            s.step();
            let events = s.drain_events();
            observe(&s, &events);
            if boss.is_none() {
                if let Some(a) = s
                    .combat
                    .actors
                    .iter()
                    .find(|a| a.alive() && crate::tuning::is_boss(a.view.archetype))
                {
                    let t = match a.view.archetype {
                        Archetype::Boss => 0,
                        Archetype::BossBomber => 1,
                        _ => 2,
                    };
                    boss = Some((a.view.id, t, s.snapshot.combat_time));
                    LOG.with_borrow_mut(|l| l.as_mut().unwrap().fights[t] += 1);
                }
            }
            if let Some((id, t, start)) = boss {
                let killed = events
                    .iter()
                    .any(|e| matches!(e, Event::StageCleared { .. }));
                let wiped = events.iter().any(|e| matches!(e, Event::WaveReset));
                if killed || wiped {
                    LOG.with_borrow_mut(|l| {
                        let l = l.as_mut().unwrap();
                        l.kills[t] += u32::from(killed);
                        l.wipes[t] += u32::from(wiped);
                        l.duration[t] += (s.snapshot.combat_time - start) as f64;
                    });
                    boss = None;
                } else if s.combat.actor_index(id).is_none() {
                    boss = None;
                }
            }
        }
        combat += s.snapshot.combat_time as f64;
        LOG.with_borrow_mut(|l| {
            let l = l.as_mut().unwrap();
            l.current = [None; 4];
            l.hazards.clear();
            l.shots.clear();
        });
    }
    let l = LOG.with_borrow_mut(|l| l.take().unwrap());
    let mut names = BTreeSet::new();
    for c in &l.casts {
        names.insert(c.name.clone());
    }
    println!("TARGET_LOCK_REPORT\n| Attack | Casts | Closed | Target hit % | Zero target % | Target died | Cancelled | Live executed hit % | Extra victims/closed | Censored |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
    for name in names {
        let a: Vec<_> = l.casts.iter().filter(|c| c.name == name).collect();
        let c: Vec<_> = a.iter().filter(|c| c.closed).collect();
        let hits = c.iter().filter(|c| c.hit).count();
        let n = c.len().max(1) as f64;
        println!(
            "| {name} | {} | {} | {:.2} | {:.2} | {} | {} | {:.2} | {:.3} | {} |",
            a.len(),
            c.len(),
            hits as f64 * 100. / n,
            (c.len() - hits) as f64 * 100. / n,
            c.iter().filter(|c| c.died).count(),
            c.iter().filter(|c| c.cancelled).count(),
            hits as f64 * 100.
                / (hits
                    + c.iter()
                        .filter(|c| !c.hit && !c.died && !c.cancelled)
                        .count())
                .max(1) as f64,
            c.iter().map(|c| c.others.len()).sum::<usize>() as f64 / n,
            a.len() - c.len()
        );
    }
    println!(
        "boss_lizardo_throws={} boss_interrupts={:?}",
        l.boss_throws, l.boss_interrupts
    );
    println!(
        "active_seconds={:.3} active_dps={:?} lizardo_throws={}",
        l.active_steps as f64 / 30.,
        l.damage.map(|d| d / (l.active_steps as f64 / 30.)),
        l.throws
    );
    println!("combat_seconds={combat:.3} downs={:?} dps={:?} fights={:?} kills={:?} wipes={:?} fight_seconds={:?} interrupts={:?}",l.downs,l.damage.map(|x|x/combat),l.fights,l.kills,l.wipes,l.duration,l.interrupts);
}
