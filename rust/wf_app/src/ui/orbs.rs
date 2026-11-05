//! Equipment orbs on the battlefield (ORKA-63bf.20/.21). A defeated enemy drops an orb one time
//! in ten: an equipment item rolled and saved by `wf_host::equipment` (`lamp.orbs`), coloured by
//! its rarity. An orb can be picked up once its subwave has completed, by a living hero whose
//! feet come within the pickup circle (a diameter of three hero heights, in world units); the
//! Bag's capacity decides whether it is stored, and an orb that does not fit stays where it fell.
//! When the wave chest is on the field (the wave is cleared), every orb still lying there is
//! swept to the nearest living hero whatever the distance, so none is stranded where the heroes
//! never walked (owner 2026-11-05); the Bag's capacity still decides.
//! The field holds `ORB_LIMIT` orbs: on a full field each new drop displaces the oldest orb of
//! the lowest rarity (decided in the save), which fades out here.
//! This module owns only where the orbs are and how they move: which orbs exist and which enter
//! the Bag is decided in one saved transaction before any animation starts.
use crate::camera::WorldCamera;
use macroquad::prelude::*;
use std::collections::HashSet;
use wf_combat::{ActorView, Event, Snapshot, Team};
use wf_host::equipment::EquipmentStorage;
use wf_host::session::Session;
use wf_meta::equipment::rarity;
use wf_meta::lamp::ORB_DROP_CHANCE;

/// Orb diameter in world units: about 10 px on a 509 px wide viewport (6.9 logical px at the
/// combat zoom), the same for every rarity. The glow scales with it.
const DIAMETER: f32 = 13.8;
/// The pickup circle around a hero's feet: its diameter in hero heights.
pub const PICKUP_DIAMETER_IN_HERO_HEIGHTS: f32 = 3.;
const FLIGHT_SECONDS: f32 = 0.55;
const FLIGHT_STAGGER: f32 = 0.025;
const APPEAR_SECONDS: f32 = 0.18;
const FADE_SECONDS: f32 = 0.3;

struct Flight { hero: u32, start: f32, from: Vec2 }
struct Orb { id: String, color: Color, pos: Vec2, born: f32, /// Its subwave has completed.
    eligible: bool, flight: Option<Flight> }
#[derive(Default)]
pub struct OrbField {
    orbs: Vec<Orb>,
    /// Orbs that left the save without being collected (displaced on a full field): position,
    /// colour and when they left, drawn fading out.
    fading: Vec<(Vec2, Color, f32)>,
    /// Drop positions whose orbs are not saved yet (retried until the save succeeds).
    waiting_drops: Vec<Vec2>,
    seen_completions: Option<u32>,
    clock: f32,
    seed: u32,
    sprite: Option<Texture2D>,
    pub notice: Option<String>,
    /// Dev Tools: a drop chance for this page session instead of `ORB_DROP_CHANCE`.
    pub dev_drop_chance: Option<f32>,
    /// Dev Tools drops are ready to pick up at once (no subwave to wait for).
    dev_eligible: bool,
}
fn world(p: wf_combat::Vec2) -> Vec2 { vec2(p.x, p.y) }
impl OrbField {
    fn random(&mut self) -> f32 {
        // xorshift32; presentation and drop chance only, never the item roll.
        if self.seed == 0 { self.seed = crate::platform::random_u32() | 1; }
        self.seed ^= self.seed << 13; self.seed ^= self.seed >> 17; self.seed ^= self.seed << 5;
        (self.seed >> 8) as f32 / (1u32 << 24) as f32
    }
    /// One kill: does it drop an orb?
    fn rolls_drop(&mut self) -> bool { self.random() < self.dev_drop_chance.unwrap_or(ORB_DROP_CHANCE) }
    pub fn drop_chance(&self) -> f32 { self.dev_drop_chance.unwrap_or(ORB_DROP_CHANCE) }
    pub fn count(&self) -> usize { self.orbs.len() }
    /// Dev Tools: `count` drops scattered around the party, eligible as soon as they are saved.
    pub fn dev_drop(&mut self, count: usize, s: &Snapshot) {
        let heroes: Vec<Vec2> = s.actors.iter().filter(|a| a.team == Team::Hero).map(|a| world(a.pos)).collect();
        let centre = if heroes.is_empty() { (world(s.arena_min) + world(s.arena_max)) / 2. } else { heroes.iter().copied().sum::<Vec2>() / heroes.len() as f32 };
        for _ in 0..count { let offset = vec2((self.random() - 0.5) * 420., (self.random() - 0.5) * 300.); self.waiting_drops.push(centre + offset); }
        self.dev_eligible = true;
    }
    /// Orbs still in the air: already stored in the Bag, not yet arrived (the bag count waits for them).
    pub fn flying(&self) -> usize { self.orbs.iter().filter(|o| o.flight.is_some()).count() }
    fn resting(&self) -> usize { self.orbs.len() - self.flying() }
    /// Enemy deaths in this frame's events: each has `ORB_DROP_CHANCE` to leave a drop position.
    pub fn ingest(&mut self, events: &[Event], now: &Snapshot, before: &Snapshot) {
        for event in events {
            let Event::Died { id } = event else { continue };
            let Some(actor) = before.actors.iter().chain(now.actors.iter()).find(|a| a.id == *id) else { continue };
            if actor.team != Team::Enemy || !self.rolls_drop() { continue; }
            let scatter = vec2((self.random() - 0.5) * 28., (self.random() - 0.5) * 18.);
            if self.waiting_drops.len() < wf_meta::lamp::ORB_LIMIT { self.waiting_drops.push(world(actor.pos) + scatter); }
        }
    }
    /// Saves new drops, makes completed subwaves' orbs eligible, and stores the eligible orbs
    /// inside a living hero's pickup circle while the Bag has room. `hero_height` is a hero's
    /// body height in world units; `can_collect` is false while a Bag window is open.
    pub fn update(&mut self, economy: &mut EquipmentStorage, session: &mut Session, s: &Snapshot, dt: f32, can_collect: bool, hero_height: &dyn Fn(&ActorView) -> f32) {
        self.clock += dt;
        let (lo, hi) = (world(s.arena_min), world(s.arena_max));
        // Drops: one saved item per dropping kill, in kill order.
        if !self.waiting_drops.is_empty() && economy.data().is_some() {
            let (region, stage) = (session.stage.region as f64, session.stage.stage as f64);
            match economy.drop_orbs(session, region, stage, self.waiting_drops.len()) {
                Ok(items) => {
                    let positions = std::mem::take(&mut self.waiting_drops);
                    for (item, pos) in items.into_iter().zip(positions) {
                        let color = rarity_color(&item.rarity);
                        self.orbs.push(Orb { id: item.instance_id, color, pos: pos.clamp(lo, hi), born: self.clock, eligible: false, flight: None });
                    }
                    self.notice = None;
                }
                Err(error) => self.notice = Some(error),
            }
        }
        // The save is the truth about which orbs exist: adopt saved orbs this field has no place
        // for yet (a reload, or leftovers of the old conveyor) and forget any that left the save.
        if let Some(data) = economy.data() {
            if data.orb_count() != self.resting() {
                let saved = data.orbs();
                let known: HashSet<&str> = self.orbs.iter().map(|o| o.id.as_str()).collect();
                let missing: Vec<(String, Color)> = saved.iter().filter(|i| !known.contains(i.instance_id.as_str())).map(|i| (i.instance_id.clone(), rarity_color(&i.rarity))).collect();
                let ids: HashSet<&str> = saved.iter().map(|i| i.instance_id.as_str()).collect();
                let clock = self.clock;
                self.fading.extend(self.orbs.iter().filter(|o| o.flight.is_none() && !ids.contains(o.id.as_str())).map(|o| (o.pos, o.color, clock)));
                self.orbs.retain(|o| o.flight.is_some() || ids.contains(o.id.as_str()));
                let heroes: Vec<Vec2> = s.actors.iter().filter(|a| a.team == Team::Hero).map(|a| world(a.pos)).collect();
                let centre = if heroes.is_empty() { (lo + hi) / 2. } else { heroes.iter().copied().sum::<Vec2>() / heroes.len() as f32 };
                let mut restored: Vec<Orb> = Vec::new();
                for (id, color) in missing {
                    let offset = vec2((self.random() - 0.5) * 360., (self.random() - 0.5) * 260.);
                    // Saved drops predate this session: their subwaves are long complete.
                    restored.push(Orb { id, color, pos: (centre + offset).clamp(lo, hi), born: self.clock, eligible: true, flight: None });
                }
                // Saved order is drop order: older than anything dropped this session.
                restored.append(&mut self.orbs);
                self.orbs = restored;
            }
        }
        if std::mem::take(&mut self.dev_eligible) { for orb in &mut self.orbs { orb.eligible = true; } }
        // Subwave completion: everything lying on the field now is eligible.
        let completions = session.subwave_completions;
        if self.seen_completions.is_some_and(|seen| seen != completions) { for orb in &mut self.orbs { orb.eligible = true; } }
        self.seen_completions = Some(completions);
        // Pickup: an eligible orb inside a living hero's circle goes to the nearest such hero.
        // The Bag's free slots are authoritative: the stored set is committed first, then exactly
        // those orbs fly. During the wave chest pause the circle does not apply: every orb goes
        // to its nearest living hero.
        let sweep = !s.chests.is_empty() && !s.actors.iter().any(|a| a.team == Team::Enemy && a.hp > 0.);
        if can_collect && economy.data().is_some_and(|d| d.free_slots() > 0) {
            let heroes: Vec<(u32, Vec2, f32)> = s.actors.iter().filter(|a| a.team == Team::Hero && a.hp > 0.).map(|a| (a.id, world(a.pos), hero_height(a) * PICKUP_DIAMETER_IN_HERO_HEIGHTS / 2.)).collect();
            let reach: Vec<(String, u32)> = self.orbs.iter().filter(|o| (o.eligible || sweep) && o.flight.is_none()).filter_map(|o| {
                heroes.iter().filter(|(_, feet, radius)| sweep || o.pos.distance(*feet) <= *radius).min_by(|a, b| o.pos.distance(a.1).total_cmp(&o.pos.distance(b.1))).map(|(hero, _, _)| (o.id.clone(), *hero))
            }).collect();
            if !reach.is_empty() {
                let ids: Vec<String> = reach.iter().map(|(id, _)| id.clone()).collect();
                match economy.collect_orbs(session, &ids) {
                    Ok(items) => {
                        let stored: HashSet<&str> = items.iter().map(|i| i.instance_id.as_str()).collect();
                        let mut order = 0;
                        for orb in self.orbs.iter_mut().filter(|o| o.flight.is_none() && stored.contains(o.id.as_str())) {
                            let hero = reach.iter().find(|(id, _)| *id == orb.id).map_or(0, |(_, hero)| *hero);
                            orb.flight = Some(Flight { hero, start: self.clock + order as f32 * FLIGHT_STAGGER, from: orb.pos });
                            order += 1;
                        }
                        self.notice = None;
                    }
                    Err(error) => self.notice = Some(error),
                }
            }
        }
        // Flights home in on the hero's current position.
        let clock = self.clock;
        for orb in &mut self.orbs {
            let Some(flight) = &orb.flight else { continue };
            let t = ((clock - flight.start) / FLIGHT_SECONDS).clamp(0., 1.);
            let target = s.actors.iter().find(|a| a.id == flight.hero).map_or(flight.from, |a| world(a.pos) + vec2(0., -44.));
            let eased = t * t;
            orb.pos = flight.from.lerp(target, eased) + vec2(0., -24. * (std::f32::consts::PI * t).sin());
        }
        self.orbs.retain(|o| o.flight.as_ref().is_none_or(|f| clock - f.start < FLIGHT_SECONDS));
        self.fading.retain(|f| clock - f.2 < FADE_SECONDS);
    }
    /// A fresh field keeps the orb sprite of the one it replaces: a dropped texture that is still
    /// bound makes the next texture upload log a WebGL error.
    pub fn adopt_art(&mut self, from: &mut OrbField) { self.sprite = from.sprite.take(); }
    /// One white sprite sheet (glow left, body right) tinted per rarity: a soft halo, a shaded
    /// body with a darker rim and a small highlight. No pulsing and no particles.
    fn sprite(&mut self) -> Texture2D {
        if let Some(t) = &self.sprite { return t.clone(); }
        const N: u16 = 64;
        let mut image = Image::gen_image_color(N * 2, N, Color::new(1., 1., 1., 0.));
        for y in 0..N as u32 {
            for x in 0..N as u32 {
                let r = vec2(x as f32 + 0.5 - N as f32 / 2., y as f32 + 0.5 - N as f32 / 2.).length() / (N as f32 / 2.);
                let halo = (1. - r).clamp(0., 1.);
                image.set_pixel(x, y, Color::new(1., 1., 1., halo * halo));
                let shade = if r > 0.8 { 0.62 } else { 1. - 0.22 * r * r };
                image.set_pixel(x + N as u32, y, Color::new(shade, shade, shade, ((1. - r) * N as f32 / 2.).clamp(0., 1.)));
            }
        }
        let texture = Texture2D::from_image(&image);
        texture.set_filter(FilterMode::Linear);
        self.sprite = Some(texture.clone());
        texture
    }
    /// Resting orbs lie on the ground under the actors; flying orbs pass over them.
    pub fn draw(&mut self, camera: &WorldCamera, flying: bool) {
        if self.orbs.is_empty() && self.fading.is_empty() { return; }
        let sprite = self.sprite();
        let half = sprite.width() / 2.;
        let (glow, body) = (Rect::new(0., 0., half, sprite.height()), Rect::new(half, 0., half, sprite.height()));
        let d = DIAMETER * camera.zoom;
        let quad = |source: Rect, centre: Vec2, size: f32, color: Color| draw_texture_ex(&sprite, centre.x - size / 2., centre.y - size / 2., color, DrawTextureParams { dest_size: Some(vec2(size, size)), source: Some(source), ..Default::default() });
        for orb in self.orbs.iter().filter(|o| o.flight.is_some() == flying) {
            let p = camera.project(wf_combat::Vec2::new(orb.pos.x, orb.pos.y));
            if p.x < -d || p.x > crate::camera::WIDTH + d || p.y < -d || p.y > crate::camera::HEIGHT + d { continue; }
            let grow = ((self.clock - orb.born) / APPEAR_SECONDS).clamp(0., 1.);
            let size = d * (0.4 + 0.6 * grow);
            quad(glow, p, size * 2.1, Color::new(orb.color.r, orb.color.g, orb.color.b, 0.34));
            quad(body, p, size, orb.color);
            quad(glow, p - vec2(size * 0.16, size * 0.18), size * 0.42, Color::new(1., 1., 1., 0.85));
        }
        if flying { return; }
        // A displaced orb shrinks and fades where it lay.
        for (pos, color, left) in &self.fading {
            let p = camera.project(wf_combat::Vec2::new(pos.x, pos.y));
            let k = 1. - ((self.clock - left) / FADE_SECONDS).clamp(0., 1.);
            quad(glow, p, d * 2.1 * k, Color::new(color.r, color.g, color.b, 0.34 * k));
            quad(body, p, d * k, Color::new(color.r, color.g, color.b, k));
        }
    }
}
fn rarity_color(key: &str) -> Color {
    let hex = rarity(key).map_or(0xf3f3ee, |r| r.color);
    Color::from_rgba((hex >> 16) as u8, (hex >> 8 & 255) as u8, (hex & 255) as u8, 255)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::BTreeMap;
    use std::rc::Rc;
    use wf_host::equipment::Storage;
    #[derive(Default)]
    pub(crate) struct MemStore(pub Rc<RefCell<BTreeMap<String, String>>>);
    impl Storage for MemStore {
        fn get(&self, key: &str) -> Option<String> { self.0.borrow().get(key).cloned() }
        fn set(&mut self, key: &str, value: &str) -> Result<(), String> { self.0.borrow_mut().insert(key.into(), value.into()); Ok(()) }
        fn remove(&mut self, key: &str) { self.0.borrow_mut().remove(key); }
    }
    pub(crate) fn economy(run: &mut crate::testing::HostRun) -> EquipmentStorage {
        let mut economy = EquipmentStorage::new(Box::new(MemStore::default()), None, Box::new(|| 1000.), Box::new(|| 42));
        economy.sync(&mut run.session).unwrap();
        economy
    }
    /// A hero's body height in world units for the tests (the packed idle art is 107 px at 0.7).
    pub(crate) const HERO_HEIGHT: f32 = 75.;
    fn height(_: &ActorView) -> f32 { HERO_HEIGHT }
    const RADIUS: f32 = HERO_HEIGHT * PICKUP_DIAMETER_IN_HERO_HEIGHTS / 2.;
    fn hero(s: &Snapshot) -> &ActorView { s.actors.iter().find(|a| a.team == Team::Hero && a.hp > 0.).unwrap() }
    fn stored(economy: &EquipmentStorage) -> f64 { economy.data().unwrap().stored_count() }
    /// Lays `count` saved drops at `offset` from the first living hero (the drop roll is bypassed).
    fn lay(field: &mut OrbField, economy: &mut EquipmentStorage, run: &mut crate::testing::HostRun, s: &Snapshot, count: usize, offset: Vec2) {
        let feet = world(hero(s).pos);
        for _ in 0..count { field.waiting_drops.push(feet + offset); }
        field.update(economy, &mut run.session, s, 0.016, false, &height);
    }
    /// A snapshot where only the first living hero remains, so distances are to one hero.
    fn solo(s: &Snapshot) -> Snapshot { let keep = hero(s).id; let mut s = s.clone(); s.actors.retain(|a| a.team != Team::Hero || a.id == keep); s }

    /// The real host loop: Chapter 1 from a fresh save, the orb field fed like the frame loop does.
    #[test]
    fn on_the_host_loop_orbs_drop_rarely_and_are_stored_in_reach_or_swept_at_the_wave_chest() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = economy(&mut run);
        let mut field = OrbField { seed: 20261104, ..Default::default() };
        let mut before = run.snapshot().clone();
        let (mut kills, mut picked, mut swept) = (0usize, 0usize, 0usize);
        for frame in 0..9000 {
            run.step();
            let events = run.drain_events();
            let s = run.snapshot().clone();
            kills += events.iter().filter(|e| matches!(e, Event::Died { id } if before.actors.iter().chain(s.actors.iter()).any(|a| a.id == *id && a.team == Team::Enemy))).count();
            field.ingest(&events, &s, &before);
            let resting: Vec<(String, Vec2, bool)> = field.orbs.iter().filter(|o| o.flight.is_none()).map(|o| (o.id.clone(), o.pos, o.eligible)).collect();
            let _ = resting.iter().map(|r| r.1).count();
            let completed = field.seen_completions.is_some_and(|seen| seen != run.session.subwave_completions);
            field.update(&mut economy, &mut run.session, &s, 1. / 30., true, &height);
            let data = economy.data().unwrap();
            let drops = data.lamp.sequence as usize;
            assert!(drops <= kills, "frame {frame}: an orb needs a kill");
            assert_eq!(data.items.len() + data.orb_count(), drops, "frame {frame}: every drop is stored or still an orb");
            assert!(data.stored_count() <= data.capacity());
            // Each orb that started flying this frame had completed its subwave and lay inside
            // the pickup circle of the hero it flies to, or the wave chest was on a cleared field.
            let sweep = !s.chests.is_empty() && !s.actors.iter().any(|a| a.team == Team::Enemy && a.hp > 0.);
            for orb in field.orbs.iter().filter(|o| o.flight.as_ref().is_some_and(|f| f.start >= field.clock - 1e-4)) {
                let flight = orb.flight.as_ref().unwrap();
                // An orb dropped in this very update can only fly if the subwave completed with it.
                let eligible = resting.iter().find(|(id, _, _)| *id == orb.id).is_some_and(|(_, _, eligible)| *eligible);
                let from = &flight.from;
                assert!(eligible || completed || sweep, "frame {frame}: picked up before its subwave completed");
                let feet = world(s.actors.iter().find(|a| a.id == flight.hero).expect("the collecting hero").pos);
                assert!(sweep || from.distance(feet) <= RADIUS + 0.01, "frame {frame}: picked up from {} units away", from.distance(feet));
                if from.distance(feet) > RADIUS + 0.01 { swept += 1; }
                assert!(s.actors.iter().filter(|a| a.team == Team::Hero && a.hp > 0.).all(|a| from.distance(world(a.pos)) >= from.distance(feet) - 0.01), "frame {frame}: the nearest hero collects");
                picked += 1;
            }
            before = s;
        }
        let drops = economy.data().unwrap().lamp.sequence as usize;
        assert!(kills >= 150, "the run defeats plenty of enemies ({kills})");
        assert!(drops >= kills / 25 && drops <= kills / 5, "about a tenth of {kills} kills drop an orb ({drops})");
        assert!(picked >= 1, "heroes walked onto some orbs ({picked} of {drops})");
        assert!(swept >= 1, "the wave chest swept in orbs no hero walked onto ({swept} of {picked})");
        println!("orbs: {kills} kills, {drops} drops, {picked} collected, {swept} of them swept at a wave chest, {} left on the field", field.resting());
    }
    #[test]
    fn one_kill_in_ten_drops_an_orb() {
        // The frequency and the dry spells of the 10% roll, over a million kills.
        let mut field = OrbField { seed: 0x9E37_79B9, ..Default::default() };
        let (mut drops, mut dry, mut longest, mut over_30, mut over_50) = (0u32, 0u32, 0u32, 0u32, 0u32);
        let kills = 1_000_000;
        for _ in 0..kills {
            if field.rolls_drop() { drops += 1; if dry >= 30 { over_30 += 1; } if dry >= 50 { over_50 += 1; } dry = 0; } else { dry += 1; longest = longest.max(dry); }
        }
        let rate = drops as f64 / kills as f64;
        assert!((rate - 0.1).abs() < 0.002, "drop rate {rate}");
        // A 10% roll goes 30 kills without a drop about 4.2% of the time, 50 kills about 0.5%.
        let (p30, p50) = (over_30 as f64 / drops as f64, over_50 as f64 / drops as f64);
        assert!((p30 - 0.9f64.powi(30)).abs() < 0.005 && (p50 - 0.9f64.powi(50)).abs() < 0.003, "dry spells: {p30} over 30, {p50} over 50, longest {longest}");
    }
    #[test]
    fn pickup_needs_a_completed_subwave_and_a_hero_within_one_and_a_half_heights() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = economy(&mut run);
        let s = solo(run.snapshot());
        let mut field = OrbField::default();
        field.update(&mut economy, &mut run.session, &s, 0.016, true, &height);
        // Two drops: one just inside the circle, one just outside (world units from the feet).
        lay(&mut field, &mut economy, &mut run, &s, 1, vec2(RADIUS - 1., 0.));
        lay(&mut field, &mut economy, &mut run, &s, 1, vec2(0., RADIUS + 1.));
        // In reach but the subwave is still running: nothing is collected.
        for _ in 0..30 { field.update(&mut economy, &mut run.session, &s, 0.016, true, &height); }
        assert_eq!((stored(&economy), field.resting()), (0., 2));
        // The subwave completes: only the orb inside the circle is stored.
        run.session.subwave_completions += 1;
        field.update(&mut economy, &mut run.session, &s, 0.016, true, &height);
        assert_eq!((stored(&economy), field.resting(), field.flying()), (1., 1, 1));
        for _ in 0..60 { field.update(&mut economy, &mut run.session, &s, 0.016, true, &height); }
        assert_eq!((stored(&economy), field.resting(), field.flying()), (1., 1, 0), "the far orb waits however long");
        // The hero walks two units closer: now the far orb is within the circle.
        let mut near = s.clone();
        let id = hero(&s).id;
        near.actors.iter_mut().find(|a| a.id == id).unwrap().pos.y += 2.;
        field.update(&mut economy, &mut run.session, &near, 0.016, true, &height);
        assert_eq!((stored(&economy), field.resting(), field.flying()), (2., 0, 1));
        // The circle is measured in world units: the same distances at any camera zoom.
        assert_eq!(RADIUS, 112.5);
        // Orbs and their glow are three quarters of the first version's 18.4 units.
        assert!((DIAMETER - 18.4 * 0.75).abs() < 1e-4);
    }
    #[test]
    fn the_wave_chest_sweeps_stranded_orbs_to_the_nearest_hero_while_the_bag_has_room() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = economy(&mut run);
        let mut s = solo(run.snapshot());
        s.actors.retain(|a| a.team == Team::Hero);
        let mut field = OrbField::default();
        field.update(&mut economy, &mut run.session, &s, 0.016, true, &height);
        // 24 drops far outside the pickup circle, their subwave complete: stranded.
        lay(&mut field, &mut economy, &mut run, &s, 24, vec2(RADIUS * 3., RADIUS * 2.));
        run.session.subwave_completions += 1;
        for _ in 0..120 { field.update(&mut economy, &mut run.session, &s, 0.016, true, &height); }
        assert_eq!((stored(&economy), field.resting()), (0., 24), "out of reach, they wait");
        // The wave chest drops: they fly to the hero, up to the Bag's 20 slots.
        let mut chest = s.clone();
        chest.chests.push(wf_combat::ChestView { id: 9001, pos: wf_combat::Vec2 { x: 0., y: 0. }, state: wf_combat::ChestState::Closed, state_age: 0., age: 0., reward: None });
        field.update(&mut economy, &mut run.session, &chest, 0.016, true, &height);
        assert_eq!((stored(&economy), field.resting(), field.flying()), (20., 4, 20));
        for _ in 0..120 { field.update(&mut economy, &mut run.session, &chest, 0.016, true, &height); }
        assert_eq!((stored(&economy), field.resting(), field.flying(), economy.data().unwrap().orb_count()), (20., 4, 0, 4), "a full Bag leaves the rest on the field");
        // A chest still listed while an enemy is alive is no sweep.
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = self::economy(&mut run);
        let mut fight = chest.clone();
        let mut foe = hero(&s).clone();
        foe.id = 9002;
        foe.team = Team::Enemy;
        foe.pos.x -= RADIUS * 4.;
        fight.actors.push(foe);
        let mut field = OrbField::default();
        field.update(&mut economy, &mut run.session, &fight, 0.016, true, &height);
        lay(&mut field, &mut economy, &mut run, &fight, 3, vec2(RADIUS * 3., RADIUS * 2.));
        run.session.subwave_completions += 1;
        for _ in 0..30 { field.update(&mut economy, &mut run.session, &fight, 0.016, true, &height); }
        assert_eq!((stored(&economy), field.resting()), (0., 3), "the circle rule holds during combat");
    }
    #[test]
    fn a_full_bag_leaves_orbs_in_reach_on_the_field_until_room_appears() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = economy(&mut run);
        let s = solo(run.snapshot());
        let mut field = OrbField::default();
        field.update(&mut economy, &mut run.session, &s, 0.016, true, &height);
        lay(&mut field, &mut economy, &mut run, &s, 26, vec2(10., 0.));
        run.session.subwave_completions += 1;
        field.update(&mut economy, &mut run.session, &s, 0.016, true, &height);
        assert_eq!((stored(&economy), field.resting(), economy.data().unwrap().capacity()), (20., 6, 20.));
        for _ in 0..120 { field.update(&mut economy, &mut run.session, &s, 0.016, true, &height); }
        assert_eq!((stored(&economy), field.resting(), field.flying(), economy.data().unwrap().orb_count()), (20., 6, 0, 6), "a full Bag takes nothing and loses nothing");
        // The player equips and dismantles in the equipment screen (collection holds meanwhile).
        economy.auto_equip(&mut run.session).unwrap();
        let preview = economy.disposal_preview(&mut run.session, None).unwrap();
        field.update(&mut economy, &mut run.session, &s, 0.016, false, &height);
        economy.dismantle(&mut run.session, &preview).unwrap();
        field.update(&mut economy, &mut run.session, &s, 0.016, false, &height);
        assert_eq!(field.resting(), 6, "nothing is collected while a Bag window is open");
        let free = economy.data().unwrap().free_slots();
        assert!(free >= 6);
        field.update(&mut economy, &mut run.session, &s, 0.016, true, &height);
        assert_eq!((field.resting(), field.flying(), economy.data().unwrap().orb_count()), (0, 6, 0), "blocked orbs resume once there is room");
        assert!(stored(&economy) <= economy.data().unwrap().capacity());
    }
    #[test]
    fn a_full_field_keeps_dropping_and_stays_bounded() {
        use wf_meta::lamp::ORB_LIMIT;
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = economy(&mut run);
        let s = solo(run.snapshot());
        let mut field = OrbField::default();
        field.update(&mut economy, &mut run.session, &s, 0.016, false, &height);
        // Far out of reach, a Bag window open: nothing is collected for 300 kills' worth of drops.
        for round in 0..30 {
            lay(&mut field, &mut economy, &mut run, &s, 10, vec2(400. + round as f32, 0.));
            assert!(field.resting() <= ORB_LIMIT && economy.data().unwrap().orb_count() == field.resting(), "round {round}: the field shows exactly the saved orbs");
        }
        assert_eq!((field.resting(), economy.data().unwrap().orb_count()), (ORB_LIMIT, ORB_LIMIT));
        // The newest drop is on the field; displaced orbs fade and are gone a moment later.
        assert_eq!(field.orbs.last().map(|o| o.id.clone()), economy.data().unwrap().orbs().last().map(|o| o.instance_id.clone()));
        assert!(!field.fading.is_empty());
        for _ in 0..30 { field.update(&mut economy, &mut run.session, &s, 0.016, false, &height); }
        assert!(field.fading.is_empty());
        assert_eq!(stored(&economy), 0.);
    }
    #[test]
    fn saved_orbs_return_after_a_reload_and_are_stored_once() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = economy(&mut run);
        economy.drop_orbs(&mut run.session, 1., 1., 6).unwrap();
        let s = run.snapshot().clone();
        // A fresh field (a reload): the six saved orbs are placed on the field inside the arena.
        let mut field = OrbField::default();
        field.update(&mut economy, &mut run.session, &s, 0.016, false, &height);
        assert_eq!((field.resting(), field.flying(), stored(&economy)), (6, 0, 0.));
        let (lo, hi) = (world(s.arena_min), world(s.arena_max));
        assert!(field.orbs.iter().all(|o| o.eligible && o.pos.x >= lo.x && o.pos.x <= hi.x && o.pos.y >= lo.y && o.pos.y <= hi.y));
        // A reach that covers the arena collects them all, each exactly once.
        let wide = |_: &ActorView| 10_000.;
        field.update(&mut economy, &mut run.session, &s, 0.016, true, &wide);
        assert_eq!((field.resting(), field.flying(), stored(&economy)), (0, 6, 6.));
        for _ in 0..90 { field.update(&mut economy, &mut run.session, &s, 0.016, true, &wide); }
        assert_eq!((field.resting(), field.flying(), stored(&economy), economy.data().unwrap().orb_count()), (0, 0, 6., 0));
    }
}
