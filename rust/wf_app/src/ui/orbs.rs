//! Equipment orbs on the battlefield (ORKA-63bf.20). Every defeated enemy drops one orb: an
//! equipment item rolled and saved by `wf_host::equipment` (`lamp.orbs`), coloured by its rarity.
//! When a subwave completes, the orbs lying there become eligible and fly to one random hero;
//! the Bag's capacity decides how many are stored, and the rest stay where they fell until room
//! appears. This module owns only where the orbs are and how they move: which orbs exist and
//! which enter the Bag is decided in one saved transaction before any animation starts.
use crate::camera::WorldCamera;
use macroquad::prelude::*;
use std::collections::HashSet;
use wf_combat::{Event, Snapshot, Team};
use wf_host::equipment::EquipmentStorage;
use wf_host::session::Session;
use wf_meta::equipment::rarity;

/// Orb diameter in world units: about 13 px on a 509 px wide viewport (9.2 logical px at the
/// combat zoom), the same for every rarity.
const DIAMETER: f32 = 18.4;
const FLIGHT_SECONDS: f32 = 0.55;
const FLIGHT_STAGGER: f32 = 0.025;
const APPEAR_SECONDS: f32 = 0.18;

struct Flight { hero: u32, start: f32, from: Vec2 }
struct Orb { id: String, color: Color, pos: Vec2, born: f32, flight: Option<Flight> }
#[derive(Default)]
pub struct OrbField {
    orbs: Vec<Orb>,
    /// Kill positions whose orbs are not saved yet (retried until the save succeeds).
    waiting_drops: Vec<Vec2>,
    /// How many of the oldest resting orbs belong to completed subwaves.
    eligible: usize,
    seen_completions: Option<u32>,
    clock: f32,
    seed: u32,
    sprite: Option<Texture2D>,
    pub notice: Option<String>,
}
fn world(p: wf_combat::Vec2) -> Vec2 { vec2(p.x, p.y) }
impl OrbField {
    fn random(&mut self) -> f32 {
        // xorshift32; presentation only (scatter offsets, which hero the orbs fly to).
        if self.seed == 0 { self.seed = crate::platform::random_u32() | 1; }
        self.seed ^= self.seed << 13; self.seed ^= self.seed >> 17; self.seed ^= self.seed << 5;
        (self.seed >> 8) as f32 / (1u32 << 24) as f32
    }
    /// Orbs still in the air: already stored in the Bag, not yet arrived (the bag count waits for them).
    pub fn flying(&self) -> usize { self.orbs.iter().filter(|o| o.flight.is_some()).count() }
    fn resting(&self) -> usize { self.orbs.len() - self.flying() }
    /// Enemy deaths in this frame's events become drop positions.
    pub fn ingest(&mut self, events: &[Event], now: &Snapshot, before: &Snapshot) {
        for event in events {
            let Event::Died { id } = event else { continue };
            let Some(actor) = before.actors.iter().chain(now.actors.iter()).find(|a| a.id == *id) else { continue };
            if actor.team != Team::Enemy { continue; }
            let scatter = vec2((self.random() - 0.5) * 28., (self.random() - 0.5) * 18.);
            if self.waiting_drops.len() < wf_meta::lamp::ORB_LIMIT { self.waiting_drops.push(world(actor.pos) + scatter); }
        }
    }
    /// Saves new drops, makes completed subwaves' orbs eligible, stores as many as the Bag has
    /// room for and advances the flights. `can_collect` is false while a Bag window is open.
    pub fn update(&mut self, economy: &mut EquipmentStorage, session: &mut Session, s: &Snapshot, dt: f32, can_collect: bool) {
        self.clock += dt;
        let (lo, hi) = (world(s.arena_min), world(s.arena_max));
        // Drops: one saved item per kill, in kill order.
        if !self.waiting_drops.is_empty() && economy.data().is_some() {
            let (region, stage) = (session.stage.region as f64, session.stage.stage as f64);
            match economy.drop_orbs(session, region, stage, self.waiting_drops.len()) {
                Ok(items) => {
                    let positions = std::mem::take(&mut self.waiting_drops);
                    for (item, pos) in items.into_iter().zip(positions) {
                        let color = rarity_color(&item.rarity);
                        self.orbs.push(Orb { id: item.instance_id, color, pos: pos.clamp(lo, hi), born: self.clock, flight: None });
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
                self.orbs.retain(|o| o.flight.is_some() || ids.contains(o.id.as_str()));
                let heroes: Vec<Vec2> = s.actors.iter().filter(|a| a.team == Team::Hero).map(|a| world(a.pos)).collect();
                let centre = if heroes.is_empty() { (lo + hi) / 2. } else { heroes.iter().copied().sum::<Vec2>() / heroes.len() as f32 };
                let adopted = missing.len();
                let mut restored: Vec<Orb> = Vec::new();
                for (id, color) in missing {
                    let offset = vec2((self.random() - 0.5) * 360., (self.random() - 0.5) * 260.);
                    restored.push(Orb { id, color, pos: (centre + offset).clamp(lo, hi), born: self.clock, flight: None });
                }
                // Saved order is drop order: older than anything dropped this session.
                restored.append(&mut self.orbs);
                self.orbs = restored;
                self.eligible += adopted;
            }
        }
        // Subwave completion: everything lying on the field now is eligible.
        let completions = session.subwave_completions;
        if self.seen_completions.is_some_and(|seen| seen != completions) { self.eligible = self.resting(); }
        self.seen_completions = Some(completions);
        self.eligible = self.eligible.min(self.resting());
        // Collection: the Bag's free slots are authoritative; the stored set is committed first,
        // then exactly those orbs fly to one hero.
        if can_collect && self.eligible > 0 && economy.data().is_some_and(|d| d.free_slots() > 0) {
            let living: Vec<u32> = s.actors.iter().filter(|a| a.team == Team::Hero && a.hp > 0.).map(|a| a.id).collect();
            if !living.is_empty() {
                match economy.collect_orbs(session, self.eligible) {
                    Ok(items) => {
                        let hero = living[((self.random() * living.len() as f32) as usize).min(living.len() - 1)];
                        let stored: HashSet<&str> = items.iter().map(|i| i.instance_id.as_str()).collect();
                        let mut order = 0;
                        for orb in self.orbs.iter_mut().filter(|o| o.flight.is_none() && stored.contains(o.id.as_str())) {
                            orb.flight = Some(Flight { hero, start: self.clock + order as f32 * FLIGHT_STAGGER, from: orb.pos });
                            order += 1;
                        }
                        self.eligible = self.eligible.saturating_sub(items.len());
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
            orb.pos = flight.from.lerp(target, eased) + vec2(0., -36. * (std::f32::consts::PI * t).sin());
        }
        self.orbs.retain(|o| o.flight.as_ref().is_none_or(|f| clock - f.start < FLIGHT_SECONDS));
    }
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
        if self.orbs.is_empty() { return; }
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
    }
}
#[cfg(test)]
impl OrbField {
    fn flight_heroes(&self) -> Vec<u32> { self.orbs.iter().filter_map(|o| o.flight.as_ref().map(|f| f.hero)).collect() }
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
    /// The real host loop: Chapter 1 from a fresh save, the orb field fed like the frame loop does.
    #[test]
    fn kills_drop_orbs_and_completed_subwaves_fill_the_bag_to_capacity_only() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = economy(&mut run);
        let mut field = OrbField::default();
        let mut before = run.snapshot().clone();
        let (mut kills, mut events_seen, mut blocked_frames, mut resumed, mut used) = (0usize, 0u32, 0, false, 0usize);
        for frame in 0..9000 {
            run.step();
            let events = run.drain_events();
            let s = run.snapshot().clone();
            kills += events.iter().filter(|e| matches!(e, Event::Died { id } if before.actors.iter().chain(s.actors.iter()).any(|a| a.id == *id && a.team == Team::Enemy))).count();
            field.ingest(&events, &s, &before);
            let completions_before = field.seen_completions;
            let stored_before = economy.data().unwrap().stored_count();
            field.update(&mut economy, &mut run.session, &s, 1. / 30., true);
            let data = economy.data().unwrap();
            // Every kill is exactly one item: stored in the Bag or still an orb, never both or lost.
            assert_eq!(data.lamp.sequence as usize, kills, "frame {frame}: one drop per kill");
            assert_eq!(data.items.len() + data.orb_count() + used, kills, "frame {frame}: no orb lost or duplicated");
            assert!(data.stored_count() <= data.capacity(), "frame {frame}: the Bag never exceeds its capacity");
            // Nothing is stored by a kill alone: the stored count moves only with a completed subwave
            // (or, once blocked orbs are eligible, when room appears).
            if data.stored_count() > stored_before {
                let new_event = completions_before.is_some_and(|seen| seen != run.session.subwave_completions);
                assert!(new_event || resumed, "frame {frame}: collection without a completed subwave");
                if new_event { events_seen += 1; }
                let heroes = field.flight_heroes();
                assert!(heroes.windows(2).all(|w| w[0] == w[1]) || field.flying() > data.stored_count() as usize - stored_before as usize, "frame {frame}: one event targets one hero");
            }
            if data.stored_count() == data.capacity() && data.orb_count() > 0 {
                blocked_frames += 1;
                // The player makes room once: equip what helps, dismantle the rest.
                if blocked_frames == 300 {
                    let (orbs_before, items_before) = (data.orb_count(), data.items.len());
                    economy.auto_equip(&mut run.session).unwrap();
                    let preview = economy.disposal_preview(&mut run.session, None).unwrap();
                    economy.dismantle(&mut run.session, &preview).unwrap();
                    // Replaced and dismantled pieces leave the save; they are no longer orbs or items.
                    used += items_before - economy.data().unwrap().items.len();
                    let free = economy.data().unwrap().free_slots();
                    assert!(free > 0);
                    resumed = true;
                    field.update(&mut economy, &mut run.session, &s, 1. / 30., true);
                    let after = economy.data().unwrap();
                    assert_eq!(after.orb_count(), orbs_before - free.min(orbs_before).min(field.flying()), "blocked orbs resume once the Bag has room");
                    assert!(after.orb_count() < orbs_before);
                    assert!(after.stored_count() <= after.capacity());
                    assert_eq!(after.items.len() + after.orb_count() + used, kills);
                }
            }
            before = s;
        }
        assert!(kills > 20, "the run defeats enough enemies to fill a 20-slot Bag ({kills})");
        assert!(events_seen >= 2, "orbs are collected at subwave completions ({events_seen})");
        assert!(blocked_frames >= 300, "the Bag filled up and orbs waited on the field ({blocked_frames} frames)");
    }
    #[test]
    fn a_window_over_the_bag_holds_collection_and_saved_orbs_return_after_a_reload() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = economy(&mut run);
        economy.drop_orbs(&mut run.session, 1., 1., 6).unwrap();
        let s = run.snapshot().clone();
        // A fresh field (a reload): the six saved orbs are placed on the field and are eligible.
        let mut field = OrbField::default();
        field.update(&mut economy, &mut run.session, &s, 0.016, false);
        assert_eq!((field.resting(), field.flying(), economy.data().unwrap().stored_count()), (6, 0, 0.));
        let (lo, hi) = (world(s.arena_min), world(s.arena_max));
        assert!(field.orbs.iter().all(|o| o.pos.x >= lo.x && o.pos.x <= hi.x && o.pos.y >= lo.y && o.pos.y <= hi.y));
        // With the window closed they fly, and they are stored exactly once.
        field.update(&mut economy, &mut run.session, &s, 0.016, true);
        assert_eq!((field.resting(), field.flying(), economy.data().unwrap().stored_count()), (0, 6, 6.));
        for _ in 0..90 { field.update(&mut economy, &mut run.session, &s, 0.016, true); }
        assert_eq!((field.resting(), field.flying(), economy.data().unwrap().stored_count(), economy.data().unwrap().orb_count()), (0, 0, 6., 0));
    }
}
