use crate::{
    assets::{Assets, DrawStats},
    camera::{WorldCamera, SQUASH},
};
use macroquad::prelude::*;
use wf_combat::api::{Event, HazardKind, HazardPhase, Snapshot};

#[derive(Default)]
pub struct Resurrect {
    bursts: Vec<(wf_combat::Vec2, f64, bool)>,
}
// All holy-light sprites use the same additive pass; absent art keeps the authored flash/band.
fn light(
    assets: &Assets,
    names: &[&str],
    fallback: &str,
    p: Vec2,
    size: Vec2,
    color: Color,
    stats: &mut DrawStats,
) {
    let name = names
        .iter()
        .copied()
        .find(|name| assets.decals.contains_key(*name))
        .unwrap_or(fallback);
    assets.decal(name, p, size, 0., color, stats);
}
/// One recipient presentation for both channel sources. Player progress wins when both
/// attempt the same body, preserving the existing art, geometry, layers and sampling.
fn channels(s:&Snapshot)->impl Iterator<Item=(wf_combat::Vec2,f32,Option<u32>)> + '_ {
    let player=s.phoenix_channel.filter(|_|s.phoenix_cooldown<=0.&&s.spotlight.is_none()&&s.hit_stop.is_none())
        .and_then(|c|s.actors.iter().find(|a|a.id==c.hero&&a.state==wf_combat::ActorState::Downed)
            .map(|a|(a.pos,c.progress,None)));
    s.hazards.iter().filter(|h|h.kind==HazardKind::Resurrect&&h.phase!=HazardPhase::Resolved)
        .filter(move |h|player.is_none_or(|(p,_,_)|(p.x-h.origin.x).abs()>4.||(p.y-h.origin.y).abs()>4.))
        .map(|h|(h.origin,h.progress,Some(h.owner))).chain(player)
}
impl Resurrect {
    pub fn busy(&self, time: f64) -> bool {
        self.bursts
            .iter()
            .any(|(_, born, interrupted)| time - born < if *interrupted { 0.28 } else { 0.75 })
    }

    pub fn ingest(&mut self, event: &Event, s: &Snapshot, previous: &Snapshot) {
        self.bursts.retain(|(_, born, _)| s.time - born < 0.8);
        let (id, interrupted) = match *event {
            Event::ResurrectInterrupted { target, .. } => (target, true),
            Event::PhoenixCancelled { hero } => (hero, true),
            Event::Revived { id } => (id, false),
            _ => return,
        };
        if let Some(a) = s
            .actors
            .iter()
            .chain(previous.actors.iter())
            .find(|a| a.id == id)
        {
            self.bursts.push((a.pos, s.time, interrupted));
        }
    }
    pub fn ground(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        stats: &mut DrawStats,
    ) {
        gl_use_material(&assets.additive);
        for (origin,progress,_owner) in channels(s) {
            let p = camera.project(origin);
            let t = progress.clamp(0., 1.);
            let breath = 0.92 + 0.08 * (s.time as f32 * 3.).sin();
            light(
                assets,
                &["resurrect/light-column"],
                "flash",
                p - vec2(0., 76.25),
                vec2(40., 160.),
                Color::new(1., 0.78, 0.3, 0.32 * breath),
                stats,
            );
            light(
                assets,
                &["resurrect/ground-ring"],
                "wave_band",
                p,
                vec2(52., 52. * SQUASH),
                Color::new(1., 0.78, 0.28, 0.26),
                stats,
            );
            // Clockwise, golden arc fills once over the authoritative five-second channel.
            let n = (80. * t).ceil() as usize;
            for i in 0..n {
                let angle = |j: usize| {
                    -std::f32::consts::FRAC_PI_2 + (j as f32 / 80.).min(t) * std::f32::consts::TAU
                };
                let a = angle(i);
                let b = angle(i + 1);
                draw_line(
                    p.x + a.cos() * 23.,
                    p.y + a.sin() * 23. * SQUASH,
                    p.x + b.cos() * 23.,
                    p.y + b.sin() * 23. * SQUASH,
                    1.8,
                    Color::new(1., 0.83, 0.38, 0.85),
                );
                stats.calls += 1;
            }
        }
        gl_use_default_material();
    }
    /// Live presentation records (debug/QA probe).
    pub fn records(&self) -> usize {
        self.bursts.len()
    }
    pub fn draw(&self, assets: &Assets, camera: &WorldCamera, s: &Snapshot, stats: &mut DrawStats) {
        gl_use_material(&assets.additive);
        for (origin,_progress,owner) in channels(s) {
            let p = camera.project(origin);
            let breath = 0.92 + 0.08 * (s.time as f32 * 3.).sin();
            for i in 0..9 {
                let phase = (s.time as f32 * 0.36 + i as f32 * 0.113).fract();
                let x = (i as f32 * 2.4 + phase * 3.).sin() * (10. + phase * 8.);
                let centre = p + vec2(x, -10. - phase * 115.);
                let size = vec2(15., 15.) * (1. - phase * 0.4);
                let tint = Color::new(1., 0.84, 0.4, (1. - phase) * 0.85);
                if let Some(tex) = assets.decals.get("resurrect/motes") {
                    let side = tex.height();
                    let frames = (tex.width() / side).max(1.) as u32;
                    let frame = ((s.time as f32 * 8.) as u32 + i) % frames;
                    draw_texture_ex(
                        tex,
                        centre.x - size.x * 0.5,
                        centre.y - size.y * 0.5,
                        tint,
                        DrawTextureParams {
                            source: Some(Rect::new(frame as f32 * side, 0., side, side)),
                            dest_size: Some(size),
                            ..Default::default()
                        },
                    );
                    stats.calls += 1;
                } else {
                    light(assets, &[], "flash", centre, vec2(5., 8.), tint, stats);
                }
            }
            if let Some(owner) = s.actors.iter().find(|a| Some(a.id) == owner && a.hp > 0.) {
                light(
                    assets,
                    &["resurrect/channel-glow"],
                    "flash",
                    camera.project(owner.pos) - vec2(0., 19.),
                    vec2(43., 58.),
                    Color::new(1., 0.73, 0.22, 0.3 * breath),
                    stats,
                );
            }
        }
        for &(pos, born, interrupted) in &self.bursts {
            let life = if interrupted { 0.28 } else { 0.75 };
            let t = ((s.time - born) as f32 / life).clamp(0., 1.);
            if t >= 1. {
                continue;
            }
            let p = camera.project(pos);
            light(
                assets,
                if interrupted {
                    &["resurrect/channel-glow"]
                } else {
                    &["resurrect/burst"]
                },
                "flash",
                p - vec2(0., 23.),
                vec2(85., 112.) * if interrupted { 1. - t * 0.65 } else { 0.65 + t },
                Color::new(
                    1.,
                    0.82,
                    0.35,
                    (1. - t) * if interrupted { 0.3 } else { 0.95 },
                ),
                stats,
            );
            if !interrupted {
                light(
                    assets,
                    &["resurrect/ground-ring"],
                    "wave_band",
                    p,
                    vec2(86., 86. * SQUASH) * (0.3 + t),
                    Color::new(1., 0.8, 0.32, (1. - t) * 0.9),
                    stats,
                );
            }
        }
        gl_use_default_material();
    }
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn phoenix_uses_existing_channels_and_revive_result_and_freezes_without_a_cue() {
        let mut s=crate::testing::sim().snapshot().clone();
        s.actors[0].state=wf_combat::ActorState::Downed;let id=s.actors[0].id;
        assert_eq!(channels(&s).count(),0);
        s.phoenix_channel=Some(wf_combat::PhoenixChannelView{hero:id,progress:0.4});
        assert_eq!(channels(&s).collect::<Vec<_>>(),vec![(s.actors[0].pos,0.4,None)]);
        s.phoenix_cooldown=30.;assert_eq!(channels(&s).count(),0);s.phoenix_cooldown=0.;
        s.hit_stop=Some(wf_combat::HitStopView{actor:id,cause:wf_combat::HitStopCause::HeroDowned,remaining:0.1});assert_eq!(channels(&s).count(),0);
        s.hit_stop=None;let mut fx=Resurrect::default();fx.ingest(&Event::Revived{id},&s,&s);
        assert_eq!(fx.records(),1);assert!(fx.busy(s.time));assert!(!fx.busy(s.time+0.8));
    }
}
