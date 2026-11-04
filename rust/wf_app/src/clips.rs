use crate::assets::{Clip, Frame};
use wf_combat::api::{ActorState, ActorView};
pub fn name(state: ActorState) -> &'static str {
    match state {
        ActorState::Spawn => "spawn",
        ActorState::Idle => "idle",
        ActorState::Walk => "walk",
        ActorState::Basic => "basic",
        ActorState::Cast => "cast",
        ActorState::Hurt => "hurt",
        ActorState::Downed | ActorState::Dead => "ko",
    }
}
pub fn duration(frames: &[Frame]) -> f32 {
    frames.iter().map(|f| f.hold_ms.max(0.01)).sum()
}
pub fn sample(frames: &[Frame], age_ms: f32, looping: bool) -> Option<&Frame> {
    if frames.is_empty() {
        return None;
    }
    let total = duration(frames);
    let mut time = if looping {
        age_ms.max(0.).rem_euclid(total)
    } else {
        age_ms.max(0.)
    };
    for f in frames {
        let hold = f.hold_ms.max(0.01);
        if time < hold {
            return Some(f);
        }
        time -= hold;
    }
    frames.last()
}
pub fn actor<'a>(clip: &'a Clip, a: &ActorView) -> Option<&'a Frame> {
    if a.state == ActorState::Downed {
        return clip.frames.last();
    }
    let age = a.state_age.max(0.) * 1000.;
    let total = duration(&clip.frames);
    // Death plays naturally, then fades. Idle/walk preserve recorded per-frame holds.
    if matches!(a.state, ActorState::Idle | ActorState::Walk) {
        return sample(&clip.frames, age, clip.looping);
    }
    let mut time = age;
    if a.state_duration > 0. && a.state != ActorState::Dead {
        let end = a.state_duration * 1000.;
        let hit = a.impact_at * 1000.;
        if let Some(marker) = clip
            .impact_ms
            .or(clip.release_ms)
            .filter(|m| *m > 0. && *m < total && hit > 0. && hit <= end)
        {
            time = if age <= hit {
                age * marker / hit
            } else if end > hit {
                marker + (age - hit) * (total - marker) / (end - hit)
            } else {
                total
            };
        } else {
            time = age * total / end;
        }
    }
    sample(&clip.frames, time, false)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn frame(ms: f32) -> Frame {
        Frame {
            page: 0,
            x: 0.,
            y: 0.,
            w: 1.,
            h: 1.,
            offset_x: 0.,
            offset_y: 0.,
            hold_ms: ms,
        }
    }
    #[test]
    fn recorded_holds_loop_and_hold_last() {
        let frames = vec![frame(40.), frame(200.), frame(60.)];
        assert!(std::ptr::eq(
            sample(&frames, 100., false).unwrap(),
            &frames[1]
        ));
        assert!(std::ptr::eq(
            sample(&frames, 310., true).unwrap(),
            &frames[0]
        ));
        assert!(std::ptr::eq(
            sample(&frames, 999., false).unwrap(),
            &frames[2]
        ));
    }
    fn actor_view() -> ActorView {
        let mut a = crate::testing::sim().snapshot().actors[0].clone();
        a.state = ActorState::Basic;
        a.state_age = 0.;
        a.state_duration = 2.;
        a.impact_at = 0.5;
        a
    }
    #[test]
    fn impact_and_release_markers_align_and_finish_without_looping() {
        for cast in [false, true] {
            let clip = Clip {
                frames: vec![frame(100.), frame(100.), frame(100.)],
                looping: false,
                foot_origin: [0., 0.],
                impact_ms: if cast { None } else { Some(100.) },
                release_ms: if cast { Some(100.) } else { None },
            };
            let mut a = actor_view();
            if cast {
                a.state = ActorState::Cast;
            }
            a.state_age = 0.49;
            assert!(std::ptr::eq(actor(&clip, &a).unwrap(), &clip.frames[0]));
            a.state_age = 0.5;
            assert!(std::ptr::eq(actor(&clip, &a).unwrap(), &clip.frames[1]));
            a.state_age = 3.;
            assert!(std::ptr::eq(actor(&clip, &a).unwrap(), &clip.frames[2]));
            a.state_duration = 0.;
            a.state_age = 0.11;
            assert!(std::ptr::eq(actor(&clip, &a).unwrap(), &clip.frames[1]));
            a.state = ActorState::Downed;
            a.state_age = 0.;
            assert!(std::ptr::eq(actor(&clip, &a).unwrap(), &clip.frames[2]));
        }
    }
}
