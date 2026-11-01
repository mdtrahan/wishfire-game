//! Opt-in authored fixture. Normal constructors and combat rules stay shared and unchanged.
use crate::{api::*, Sim};

impl Sim {
    /// Immediate combat fixture for `index.html?qa`; no stage script or boss arrival.
    pub fn qa_showcase(cfg: SimConfig) -> Self {
        let mut sim = Self::composition_trial(cfg, &[]);
        for (a, pos) in sim.combat.actors.iter_mut().zip([
            Vec2::new(360., 940.), // Fara: the rally cluster is inside the Pound gate.
            Vec2::new(510., 900.), // Hondo: in melee/aura reach of Marid.
            Vec2::new(450., 1070.),
            Vec2::new(570., 1040.), // Keep Mend coverage after teleport-driven repositioning.
        ]) {
            a.view.pos = pos;
            a.destination = pos;
            if a.view.archetype != Archetype::Hondo {
                a.view.hp = a.view.max_hp * 0.55;
            }
            if a.view.archetype == Archetype::Fara {
                a.view.meter = 2.;
            }
        }
        // Relocate the existing party aura before publishing the first snapshot.
        for h in &mut sim.combat.hazards {
            if let Some(owner) = sim.combat.actors.iter().find(|a| a.view.id == h.view.owner) {
                h.view.origin = owner.view.pos;
            }
        }
        for (kind, pos, hp) in [
            (Archetype::Marid, Vec2::new(570., 870.), 1.),
            (Archetype::Bastorto, Vec2::new(300., 850.), 1.),
            (Archetype::Gloamink, Vec2::new(355., 830.), 1.),
            (Archetype::Gobloc, Vec2::new(405., 860.), 1.),
            (Archetype::HighOrc, Vec2::new(680., 800.), 0.35),
            (Archetype::Orc, Vec2::new(700., 950.), 0.5),
            // Chimerilass is the slice's only other enemy healer. Direct spawning
            // avoids boss staging, rewards and victory transitions.
            (Archetype::BossBomber, Vec2::new(650., 590.), 1.),
        ] {
            sim.spawn_actor(kind, pos);
            let a = sim.combat.actors.last_mut().unwrap();
            a.view.hp = a.view.max_hp * hp;
            if kind == Archetype::BossBomber {
                // Let Marid's first heal land before Chimerilass chooses a recipient.
                a.extra_cd = 1.5;
            }
        }
        sim.stage.phase = StagePhase::Spike;
        // Give Fara an existing ally-threat reason for the opening Warcry.
        let ally = sim.combat.actors[2].view.id;
        sim.combat
            .actors
            .iter_mut()
            .find(|a| a.view.archetype == Archetype::Gloamink)
            .unwrap()
            .target = Some(ally);
        sim.refresh_snapshot();
        sim
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tuning::*;

    fn actor(sim: &Sim, kind: Archetype) -> &crate::actors::Actor {
        sim.combat
            .actors
            .iter()
            .find(|a| a.view.archetype == kind)
            .unwrap()
    }

    #[test]
    fn lineup_has_every_case_materialized_inside_the_arena() {
        let sim = Sim::qa_showcase(SimConfig::default());
        assert_eq!(sim.combat.actors.len(), 11);
        assert!(sim.director.entry >= crate::stage_script::STAGE_1.len());
        assert_eq!(sim.director.boss, None);
        assert_eq!(sim.stage.phase, StagePhase::Spike);
        assert!(sim.chests.is_empty());
        for a in &sim.combat.actors {
            assert_eq!(a.view.state, ActorState::Idle);
            assert_eq!(
                a.view.pos,
                crate::math::floor_point(a.view.pos, a.view.radius)
            );
        }
        let kaja = actor(&sim, Archetype::Kaja);
        let heroes: Vec<_> = sim
            .combat
            .actors
            .iter()
            .filter(|a| a.view.team == Team::Hero)
            .collect();
        assert_eq!(heroes.len(), 4);
        assert_eq!(
            heroes.iter().filter(|a| a.view.hp < a.view.max_hp).count(),
            3
        );
        for a in heroes {
            if a.view.hp < a.view.max_hp {
                assert!((a.view.hp / a.view.max_hp - 0.55).abs() < 0.0001);
                assert!(a.view.pos.distance(kaja.view.pos) <= kaja.stats.reach);
            }
            assert_eq!(
                a.view.meter,
                if a.view.archetype == Archetype::Fara {
                    2.
                } else {
                    0.
                }
            );
        }
        let marid = actor(&sim, Archetype::Marid);
        assert_eq!(
            marid.stats.speed,
            HERO_STATS
                .iter()
                .map(|s| s.speed)
                .fold(f32::INFINITY, f32::min)
        );
        assert!(sim
            .combat
            .hazards
            .iter()
            .any(|h| h.view.owner == marid.view.id && h.view.kind == HazardKind::KajaAura));
        let hondo = actor(&sim, Archetype::Hondo);
        assert!(hondo.view.pos.distance(marid.view.pos) <= hondo.attack_range(marid));
        assert!(hondo.view.pos.distance(marid.view.pos) <= AURA_RADIUS + hondo.view.radius);
        let fara = actor(&sim, Archetype::Fara);
        for kind in [Archetype::Bastorto, Archetype::Gloamink, Archetype::Gobloc] {
            let a = actor(&sim, kind);
            assert!(
                sim.snapshot()
                    .actors
                    .iter()
                    .find(|v| v.id == a.view.id)
                    .unwrap()
                    .rallied
            );
            assert!(a.view.pos.distance(fara.view.pos) <= 300.);
        }
        let wounded: Vec<_> = sim
            .combat
            .actors
            .iter()
            .enumerate()
            .filter(|(_, a)| {
                a.view.team == Team::Enemy
                    && !is_boss(a.view.archetype)
                    && a.view.hp < a.view.max_hp
            })
            .map(|(i, _)| i)
            .collect();
        assert_eq!(wounded.len(), 2);
        for kind in [Archetype::Marid, Archetype::BossBomber] {
            let i = sim
                .combat
                .actors
                .iter()
                .position(|a| a.view.archetype == kind)
                .unwrap();
            assert!(wounded.contains(&sim.combat.enemy_heal_target(i).unwrap()));
        }
    }

    #[test]
    fn real_opening_shows_healers_aura_mend_and_warcry_shield() {
        for seed in [1, 7, 42] {
            let mut sim = Sim::qa_showcase(SimConfig {
                seed,
                ..Default::default()
            });
            let marid = actor(&sim, Archetype::Marid).view.id;
            let chimera = actor(&sim, Archetype::BossBomber).view.id;
            let hondo = actor(&sim, Archetype::Hondo).view.id;
            let mut marid_healed = false;
            let mut chimera_healed = false;
            let mut poison_hit = false;
            let mut hondo_hit = false;
            let mut shield = false;
            let mut mend_recipients = Vec::new();
            for step in 1..=360 {
                sim.step();
                if step <= 90 {
                    shield |= actor(&sim, Archetype::Fara).view.warcry_shield;
                }
                for event in sim.drain_events() {
                    match event {
                        Event::EnemyHealed { healer, amount, .. } if amount > 0. => {
                            marid_healed |= healer == marid;
                            chimera_healed |= healer == chimera;
                        }
                        Event::Hit {
                            source,
                            target,
                            element,
                            ..
                        } => {
                            poison_hit |= source == marid && element == Element::Nature;
                            hondo_hit |= source == hondo && target == marid;
                        }
                        Event::Healed { target, amount, .. } if step == 90 && amount > 0. => {
                            mend_recipients.push(target);
                        }
                        Event::BossArrived { .. } | Event::WaveIncoming { .. } => {
                            panic!("script ran")
                        }
                        _ => {}
                    }
                }
            }
            assert!(
                marid_healed && chimera_healed,
                "seed {seed}: heals {marid_healed}/{chimera_healed}"
            );
            assert!(
                poison_hit && hondo_hit,
                "seed {seed}: aura/engagement {poison_hit}/{hondo_hit}"
            );
            assert!(shield, "seed {seed}: no Warcry shield");
            assert!(
                mend_recipients.len() >= 2,
                "seed {seed}: Mend recipients {mend_recipients:?}"
            );
        }
    }

    #[test]
    fn showcase_is_deterministic_across_frame_chunking_and_fresh_resets() {
        for seed in [1, 7, 42] {
            let cfg = SimConfig {
                seed,
                ..Default::default()
            };
            let initial = Sim::qa_showcase(cfg.clone());
            let mut direct = Sim::qa_showcase(cfg.clone());
            let mut chunked = Sim::qa_showcase(cfg.clone());
            for _ in 0..1200 {
                direct.step();
                for _ in 0..4 {
                    chunked.advance(1. / 120.);
                }
                assert_eq!(direct.state_hash(), chunked.state_hash());
                assert_eq!(direct.drain_events(), chunked.drain_events());
            }
            let reset = Sim::qa_showcase(cfg);
            assert_eq!(initial.state_hash(), reset.state_hash());
            assert_eq!(initial.snapshot(), reset.snapshot());
        }
    }
}
