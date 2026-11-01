//! Read-only matched attribution; decision hooks are test-only and disabled by default.
use crate::*;
thread_local! { static TAUNTS:std::cell::Cell<Option<[u64;4]>>=const{std::cell::Cell::new(None)}; }
pub(crate) fn taunt_started(reason: u8) {
    TAUNTS.with(|n| {
        if let Some(mut counts) = n.get() {
            counts[reason as usize] += 1;
            n.set(Some(counts));
        }
    });
}
#[allow(dead_code)] // Shared with exact-commit baseline source, which has no enmity table.
pub(crate) fn legacy_taunt(s: &Sim, f: usize) {
    let mut reason = 3;
    for j in 0..s.combat.actors.len() {
        if !s.combat.taunt_recipient(f, j) {
            continue;
        }
        let ally = s
            .combat
            .enemy_target(j)
            .filter(|&t| s.combat.actors[t].view.id != s.combat.actors[f].view.id);
        if crate::tuning::is_boss(s.combat.actors[j].view.archetype) {
            if ally
                .is_some_and(|t| s.combat.actors[t].view.hp < s.combat.actors[t].view.max_hp * 0.5)
            {
                reason = reason.min(1);
            }
        } else if ally.is_some() {
            reason = reason.min(2);
        }
    }
    taunt_started(reason);
}
fn boss_kind(a: Archetype) -> Option<usize> {
    match a {
        Archetype::Boss => Some(0),
        Archetype::BossBomber => Some(1),
        Archetype::BossMarksman => Some(2),
        _ => None,
    }
}
#[test]
#[ignore = "20-seed boss enmity attribution"]
fn enmity_twenty_seed_report() {
    let mut basics = [[0u64; 4]; 3];
    let mut telegraphs = [[0u64; 4]; 3];
    let mut packages = [[0u64; 4]; 3];
    let mut downs = [0u64; 4];
    let mut boss_steps = [0u64; 3];
    let mut ally_top = [0u64; 3];
    let mut ally_target = [0u64; 3];
    let mut switches = [0u64; 3];
    let mut decisions = [0u64; 3];
    let mut engagements = [0u64; 3];
    let mut taunts = [0u64; 4];
    let mut table_steps = 0u64;
    crate::enmity_attribution::start();
    for seed in 1..=20 {
        crate::enmity_attribution::seed();
        let mut s = Sim::new(SimConfig {
            seed,
            ..Default::default()
        });
        s.drain_events();
        let mut previous = Vec::<(u32, Option<u32>)>::new();
        TAUNTS.with(|n| n.set(Some([0; 4])));
        for _ in 0..900 * 30 {
            s.step();
            crate::enmity_attribution::observe(&s);
            for (i, a) in s.combat.actors.iter().enumerate() {
                let Some(tier) = boss_kind(a.view.archetype) else {
                    continue;
                };
                if !a.alive() || a.view.state == ActorState::Spawn {
                    continue;
                }
                boss_steps[tier] += 1;
                let chosen = s.combat.enemy_target(i).map(|t| s.combat.actors[t].view.id);
                if chosen.is_some_and(|id| {
                    s.combat
                        .actor_index(id)
                        .is_some_and(|t| s.combat.actors[t].view.archetype != Archetype::Fara)
                }) {
                    ally_target[tier] += 1;
                }
                if let Some((_, old)) = previous.iter_mut().find(|(id, _)| *id == a.view.id) {
                    if old.is_some() && chosen.is_some() && *old != chosen {
                        decisions[tier] += 1;
                    }
                    *old = chosen;
                } else {
                    previous.push((a.view.id, chosen));
                }
                if let Some(row) = s.snapshot.enmity.iter().find(|r| r.boss == a.view.id) {
                    table_steps += 1;
                    let top = (0..4)
                        .max_by(|&i, &j| {
                            row.values[i]
                                .total_cmp(&row.values[j])
                                .then_with(|| j.cmp(&i))
                        })
                        .unwrap();
                    if top != 0 && row.values[top] > 0. {
                        ally_top[tier] += 1;
                    }
                }
                if matches!(a.view.state, ActorState::Basic | ActorState::Cast)
                    && a.view.state_age < SIM_DT * 0.5
                {
                    if let Some(k) = a
                        .target
                        .and_then(|id| s.combat.actor_index(id))
                        .and_then(|t| crate::actors::hero_index(s.combat.actors[t].view.archetype))
                    {
                        packages[tier][k] += 1;
                        if a.view.state == ActorState::Basic {
                            basics[tier][k] += 1;
                        }
                    }
                }
            }
            for e in s.drain_events() {
                match e {
                    Event::Downed { id } => {
                        if let Some(k) = s.combat.actor_index(id).and_then(|i| {
                            crate::actors::hero_index(s.combat.actors[i].view.archetype)
                        }) {
                            downs[k] += 1;
                        }
                    }
                    Event::AggroChanged { enemy, from, .. } => {
                        if let Some(k) = s
                            .combat
                            .actor_index(enemy)
                            .and_then(|i| boss_kind(s.combat.actors[i].view.archetype))
                        {
                            if from.is_some() {
                                switches[k] += 1;
                            } else {
                                engagements[k] += 1;
                            }
                        }
                    }
                    Event::HazardSpawned { id, .. } => {
                        if let Some(h) = s.combat.hazards.iter().find(|h| h.view.id == id) {
                            if let Some(k) = s
                                .combat
                                .actor_index(h.view.owner)
                                .and_then(|i| boss_kind(s.combat.actors[i].view.archetype))
                            {
                                if let Some(t) = h
                                    .target
                                    .and_then(|id| s.combat.actor_index(id))
                                    .and_then(|i| {
                                        crate::actors::hero_index(s.combat.actors[i].view.archetype)
                                    })
                                {
                                    telegraphs[k][t] += 1;
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
        TAUNTS.with(|n| {
            if let Some(c) = n.replace(None) {
                for k in 0..4 {
                    taunts[k] += c[k];
                }
            }
        });
    }
    crate::enmity_attribution::finish();
    let mut attacks = basics;
    for k in 0..3 {
        for h in 0..4 {
            attacks[k][h] += telegraphs[k][h];
        }
    }
    println!("ENMITY_REPORT attacks={attacks:?} basics={basics:?} telegraphs={telegraphs:?} packages={packages:?} downs={downs:?}");
    println!("ENMITY_CLOCKS boss_steps={boss_steps:?} ally_top={ally_top:?} ally_target={ally_target:?} switches={switches:?} decisions={decisions:?} engagements={engagements:?} table_steps={table_steps} taunts={taunts:?}");
}
