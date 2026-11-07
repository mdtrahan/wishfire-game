use super::actors::{body_height, visual_scale, ACTOR_SCALE};
use super::cast_hue::ELEVATE_FADE_SECONDS;
use crate::{assets::{Assets, DrawStats}, camera::WorldCamera};
use macroquad::prelude::*;
use wf_combat::api::{ActorState, ActorView, Archetype, ElevateVariant, Groove, Snapshot, Team};

#[derive(Clone, Copy)]
pub struct Elevate {
    time: f64,
    remaining: f32,
    variant: Option<ElevateVariant>,
}

impl Elevate {
    /// Read the full snapshot before spotlight partitions remove the buff's caster.
    pub fn from_snapshot(s: &Snapshot) -> Self {
        let caster = s.actors.iter().find(|a| {
                a.archetype == Archetype::Kaja && a.hp > 0.
                    && a.groove == Some(Groove::Power) && a.groove_active > 0.
            });
        Self {
            time: s.time,
            remaining: caster.map_or(0., |a| a.groove_active),
            variant: caster.and_then(|a| a.elevate),
        }
    }
}

#[derive(Clone, Copy, Debug)]
struct Sword {
    offset: Vec2,
    front: bool,
    scale: f32,
    alpha: f32,
    brightness: f32,
}

/// Pixel offsets at default hero scale/zoom; positive depth is the near half.
fn orbit(time: f64, id: u32, remaining: f32) -> [Sword; 2] {
    // The eight-second buff remains authoritative; only its opening hue window has swords.
    let age = 8. - remaining;
    let fade = (age / 0.25).clamp(0., 1.)
        * ((ELEVATE_FADE_SECONDS - age) / 0.6).clamp(0., 1.);
    let angle = ((time / 1.6).rem_euclid(1.) * std::f64::consts::TAU) as f32
        + (id as f64 * 2.399963229728653).rem_euclid(std::f64::consts::TAU) as f32;
    let bob = (angle * 2.).sin() * 1.5;
    [0., std::f32::consts::PI].map(|phase| {
        let theta = angle + phase;
        let depth = theta.sin();
        Sword {
            offset: vec2(theta.cos() * 22., depth * (22. / 3.) + bob),
            front: depth >= 0.,
            scale: 0.975 + depth * 0.125,
            alpha: fade,
            brightness: 0.91 + depth * 0.09,
        }
    })
}

fn icon(variant: Option<ElevateVariant>) -> Option<&'static str> {
    variant.map(|v| match v {
        ElevateVariant::Sword => "sword",
        ElevateVariant::Wings => "wings",
        ElevateVariant::WingedBoots => "winged_boots",
    })
}

pub fn draw(
    assets: &Assets,
    camera: &WorldCamera,
    a: &ActorView,
    foot: Vec2,
    elevate: Elevate,
    front: bool,
    stats: &mut DrawStats,
) {
    if a.team != Team::Hero || a.hp <= 0.
        || matches!(a.state, ActorState::Dead | ActorState::Downed)
    {
        return;
    }
    let Some(name) = icon(elevate.variant) else { return };
    let Some(texture) = assets.decals.get(name) else { return };
    let scale = visual_scale(a) * camera.zoom / (ACTOR_SCALE * 0.5);
    let centre = foot - vec2(0., body_height(assets, a, camera.zoom) * 0.5);
    for sword in orbit(elevate.time, a.id, elevate.remaining) {
        if sword.front != front || sword.alpha <= 0. { continue; }
        // The painted blade occupies ~84% of its transparent-padded canvas.
        let height = 24. * scale * sword.scale;
        let at = centre + sword.offset * scale;
        let size = vec2(height * texture.width() / texture.height(), height);
        assets.decal(
            name, at, size, 0.,
            Color::new(sword.brightness, sword.brightness, sword.brightness, sword.alpha),
            stats,
        );
        // Owner: a slight glow from the painted blade itself, added over a wider copy.
        gl_use_material(&assets.additive);
        assets.decal(name, at, size * 1.3, 0., Color::new(1., 1., 1., 0.35 * sword.alpha), stats);
        gl_use_default_material();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn variants_share_orbit_timing_and_select_their_painted_art() {
        let mut s = crate::testing::sim().snapshot().clone();
        let kaja = s.actors.iter_mut().find(|a| a.archetype == Archetype::Kaja).unwrap();
        kaja.groove_active = 7.;
        for (variant, name) in [(ElevateVariant::Sword, "sword"), (ElevateVariant::Wings, "wings"), (ElevateVariant::WingedBoots, "winged_boots")] {
            s.actors.iter_mut().find(|a| a.archetype == Archetype::Kaja).unwrap().elevate = Some(variant);
            let context = Elevate::from_snapshot(&s);
            assert_eq!(icon(context.variant), Some(name));
            assert_eq!(orbit(context.time, 1, context.remaining)[0].alpha, 1.);
        }
        assert_eq!(icon(None), None);
    }

    #[test]
    fn depth_orders_and_scales_back_and_front() {
        let [front, back] = orbit(0.4, 0, 4.);
        assert!(front.front && !back.front);
        assert!((front.scale - 1.1).abs() < 0.00001);
        assert!((back.scale - 0.85).abs() < 0.00001);
        assert!(back.offset.y < front.offset.y);
        assert!(back.brightness < front.brightness);
    }

    #[test]
    fn swords_stay_opposite_and_heroes_have_different_phases() {
        for id in 0..8 {
            for tick in 0..160 {
                let time = tick as f64 / 100.;
                let [a, b] = orbit(time, id, 4.);
                assert!((a.offset.x + b.offset.x).abs() < 0.0001);
                assert!((a.scale + b.scale - 1.95).abs() < 0.0001);
                // Both swords share the gentle lift, while their floor offsets oppose.
                let bob = (a.offset.y + b.offset.y) * 0.5;
                assert!(bob.abs() <= 1.5001);
                let radius_a = vec2(a.offset.x / 22., (a.offset.y - bob) / (22. / 3.));
                let radius_b = vec2(b.offset.x / 22., (b.offset.y - bob) / (22. / 3.));
                assert!((radius_a + radius_b).length() < 0.0001);
                assert!((radius_a.length() - 1.).abs() < 0.0001);
            }
        }
        assert_ne!(orbit(0., 1, 4.)[0].offset, orbit(0., 2, 4.)[0].offset);
    }

    #[test]
    fn fades_are_bounded_and_zero_outside_elevate() {
        for remaining in [-1., 0., 0.1, 0.3, 0.6, 4., 7.75, 7.875, 8., 9.] {
            for sword in orbit(1., 1, remaining) {
                assert!((0. ..=1.).contains(&sword.alpha));
            }
        }
        for remaining in [-1., 0., 8., 9.] {
            assert_eq!(orbit(1., 1, remaining)[0].alpha, 0.);
        }
        assert!((orbit(1., 1, 7.875)[0].alpha - 0.5).abs() < 0.00001);
        assert!((orbit(1., 1, 8. - ELEVATE_FADE_SECONDS + 0.3)[0].alpha - 0.5).abs() < 0.00001);
        assert_eq!(orbit(1., 1, 7.)[0].alpha, 1.);
        assert_eq!(orbit(1., 1, 4.)[0].alpha, 0.);
    }

    #[test]
    fn swords_fade_to_zero_with_the_release_hue_while_buff_remains_active() {
        use super::super::cast_hue::CastHue;
        use wf_combat::{Event, Skill};
        let mut s = crate::testing::sim().snapshot().clone();
        let kaja = s.actors.iter().position(|a| a.archetype == Archetype::Kaja).unwrap();
        let hero = s.actors[kaja].id;
        s.actors[kaja].state = ActorState::Cast;
        s.actors[kaja].impact_at = ELEVATE_FADE_SECONDS;
        let mut hue = CastHue::default();
        hue.observe(&s, &[Event::SkillStarted { id: hero, skill: Skill::Elevate, target: None }]);
        s.actors[kaja].groove = Some(Groove::Power);
        s.actors[kaja].groove_active = 8.;
        s.actors[kaja].elevate = Some(ElevateVariant::Sword);
        hue.observe(&s, &[Event::GrooveActivated { hero, groove: Groove::Power, seconds: 8. }]);
        let mut previous_alpha = 1.;
        for age in [ELEVATE_FADE_SECONDS - 0.3, ELEVATE_FADE_SECONDS - 0.01, ELEVATE_FADE_SECONDS, ELEVATE_FADE_SECONDS + 0.1] {
            s.time = age as f64;
            s.combat_time = s.time;
            s.actors[kaja].groove_active = 8. - age;
            hue.observe(&s, &[]);
            let elevate = Elevate::from_snapshot(&s);
            assert!(elevate.remaining > 0.);
            for a in &s.actors {
                for sword in orbit(elevate.time, a.id, elevate.remaining) {
                    assert_eq!(sword.alpha > 0., age < ELEVATE_FADE_SECONDS);
                    assert_eq!(sword.alpha > 0., hue.active(a));
                    assert!(sword.alpha <= previous_alpha);
                }
            }
            previous_alpha = orbit(elevate.time, hero, elevate.remaining)[0].alpha;
        }
    }

    #[test]
    fn detection_requires_living_power_kaja_in_the_full_snapshot() {
        let mut s = crate::testing::sim().snapshot().clone();
        let kaja = s.actors.iter().position(|a| a.archetype == Archetype::Kaja).unwrap();
        s.actors[kaja].groove = Some(Groove::Power);
        s.actors[kaja].groove_active = 7.;
        s.actors[kaja].elevate = Some(ElevateVariant::Sword);
        let elevate = Elevate::from_snapshot(&s);
        assert_eq!(elevate.remaining, 7.);
        s.actors.remove(kaja);
        assert_eq!(Elevate::from_snapshot(&s).remaining, 0.);
        // The context passed to both drawing layers survives removal of Kaja.
        assert_eq!(orbit(elevate.time, s.actors[0].id, elevate.remaining)[0].alpha, 1.);
        let mut kaja = s.actors[0].clone();
        kaja.groove_active = 4.;
        s.actors = vec![kaja];
        assert_eq!(Elevate::from_snapshot(&s).remaining, 0.);
        s.actors[0].archetype = Archetype::Kaja;
        s.actors[0].groove = Some(Groove::Super);
        assert_eq!(Elevate::from_snapshot(&s).remaining, 0.);
        s.actors[0].groove = Some(Groove::Power);
        s.actors[0].hp = 0.;
        assert_eq!(Elevate::from_snapshot(&s).remaining, 0.);
    }
}
