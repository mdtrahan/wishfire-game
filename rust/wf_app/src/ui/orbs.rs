//! Equipment orbs on the battlefield (ORKA-63bf.20/.21). A defeated enemy drops an orb about
//! one time in eight (`ORB_DROP_CHANCE`, 13.3%): an equipment item rolled and saved by `wf_host::equipment` (`lamp.orbs`), coloured by
//! its rarity. An orb can be picked up once its subwave has completed, by a living hero whose
//! feet come within the pickup circle (a diameter of three hero heights, in world units). The
//! item is judged at that moment (owner 2026-11-05, ORKA-63bf.34): one that raises a hero's CP is
//! stored in the Bag, and stays where it fell if the Bag is full; any other is dismantled at
//! once for Essence. Both kinds fly to the hero.
//! When the wave chest is on the field (the wave is cleared), every orb still lying there is
//! swept to the nearest living hero whatever the distance, so none is stranded where the heroes
//! never walked (owner 2026-11-05); the Bag's capacity still decides.
//! The field holds `ORB_LIMIT` orbs: on a full field each new drop displaces the oldest orb of
//! the lowest rarity (decided in the save), which fades out here.
//! Resource drops (owner 2026-11-05, temporary until a hero EXP system exists): a kill that
//! leaves no orb may leave a little Gold, a little Essence or a single hero ticket instead
//! (`wf_meta::lamp::field_drop`). They are picked up like orbs, need no Bag slot, are drawn with
//! the HUD's own icons, and are not saved while they lie on the field: `collected` hands each one
//! to `Game::award_loot` the moment its flight starts.
//! This module owns only where the orbs are and how they move: which orbs exist and which enter
//! the Bag is decided in one saved transaction before any animation starts.
use crate::camera::WorldCamera;
use macroquad::prelude::*;
use std::collections::HashSet;
use wf_combat::{ActorView, Event, Snapshot, Team};
use wf_host::equipment::EquipmentStorage;
use wf_host::session::Session;
use wf_meta::equipment::rarity;
use wf_meta::lamp::{field_drop, FieldDrop, ESSENCE_DROP_AMOUNT, GOLD_DROP_AMOUNT, LOOT_LIMIT, ORB_DROP_CHANCE};
use wf_meta::progression::TicketHero;

/// Orb diameter in world units: about 10 px on a 509 px wide viewport (6.9 logical px at the
/// combat zoom), the same for every rarity. The glow scales with it.
const DIAMETER: f32 = 13.8;
/// The pickup circle around a hero's feet: its diameter in hero heights.
pub const PICKUP_DIAMETER_IN_HERO_HEIGHTS: f32 = 3.;
const FLIGHT_SECONDS: f32 = 0.55;
const FLIGHT_STAGGER: f32 = 0.025;
const APPEAR_SECONDS: f32 = 0.18;
const FADE_SECONDS: f32 = 0.3;

struct Flight { hero: u32, start: f32, from: Vec2, /// It was stored in the Bag (not dismantled, not a resource).
    stored: bool }
struct Orb { id: String, color: Color, pos: Vec2, born: f32, /// Its subwave has completed.
    eligible: bool, /// An upgrade the full Bag turned away: asked again only when a slot is free.
    blocked: bool, flight: Option<Flight> }
/// A resource drop: what the party gains when a hero picks it up.
#[derive(Clone, Debug, PartialEq)]
pub enum Loot { Gold(f64), Essence(f64), Ticket { hero_id: String, hero_name: String } }
struct Pickup { loot: Loot, pos: Vec2, born: f32, eligible: bool, flight: Option<Flight> }
/// Icon height on the field in world units (a little larger than an orb, so the art reads).
const LOOT_SIZE: f32 = 22.;
#[derive(Default)]
pub struct OrbField {
    orbs: Vec<Orb>,
    loot: Vec<Pickup>,
    /// Resource drops whose flight started this frame: the caller awards and clears them.
    pub collected: Vec<Loot>,
    /// Rarity colours of the stored orbs whose flight ended since the bag last looked: each is
    /// one item going into the bag (the bag bounces and splashes for it).
    pub arrived: Vec<Color>,
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
    /// One kill: what does it drop?
    fn rolls_drop(&mut self) -> Option<FieldDrop> { let roll = self.random(); field_drop(roll, self.drop_chance()) }
    /// Dev Tools "clear the field": the resource drops go with the orbs.
    pub fn clear_loot(&mut self) { self.loot.clear(); }
    pub fn loot_count(&self) -> usize { self.loot.len() }
    pub fn drop_chance(&self) -> f32 { self.dev_drop_chance.unwrap_or(ORB_DROP_CHANCE) }
    pub fn count(&self) -> usize { self.orbs.len() }
    /// Dev Tools: `count` drops scattered around the party, eligible as soon as they are saved.
    pub fn dev_drop(&mut self, count: usize, s: &Snapshot) {
        let heroes: Vec<Vec2> = s.actors.iter().filter(|a| a.team == Team::Hero).map(|a| world(a.pos)).collect();
        let centre = if heroes.is_empty() { (world(s.arena_min) + world(s.arena_max)) / 2. } else { heroes.iter().copied().sum::<Vec2>() / heroes.len() as f32 };
        for _ in 0..count { let offset = vec2((self.random() - 0.5) * 420., (self.random() - 0.5) * 300.); self.waiting_drops.push(centre + offset); }
        self.dev_eligible = true;
    }
    /// Dev Tools: two Gold drops, two Essence drops and one ticket per hero around the party,
    /// ready to pick up at once.
    pub fn dev_loot(&mut self, s: &Snapshot, ticket_heroes: &[TicketHero]) {
        let heroes: Vec<Vec2> = s.actors.iter().filter(|a| a.team == Team::Hero).map(|a| world(a.pos)).collect();
        let centre = if heroes.is_empty() { (world(s.arena_min) + world(s.arena_max)) / 2. } else { heroes.iter().copied().sum::<Vec2>() / heroes.len() as f32 };
        let mut drops = vec![Loot::Gold(GOLD_DROP_AMOUNT), Loot::Gold(GOLD_DROP_AMOUNT), Loot::Essence(ESSENCE_DROP_AMOUNT), Loot::Essence(ESSENCE_DROP_AMOUNT)];
        drops.extend(ticket_heroes.iter().map(|h| Loot::Ticket { hero_id: h.id.clone(), hero_name: h.name.clone() }));
        for loot in drops {
            let offset = vec2((self.random() - 0.5) * 420., (self.random() - 0.5) * 300.);
            if self.loot.len() < LOOT_LIMIT { self.loot.push(Pickup { loot, pos: centre + offset, born: self.clock, eligible: true, flight: None }); }
        }
    }
    /// Orbs still in the air that are already stored in the Bag (the bag count waits for them);
    /// orbs dismantled at pickup fly too but were never stored.
    pub fn flying(&self) -> usize { self.orbs.iter().filter(|o| o.flight.as_ref().is_some_and(|f| f.stored)).count() }
    fn resting(&self) -> usize { self.orbs.iter().filter(|o| o.flight.is_none()).count() }
    /// Enemy deaths in this frame's events: each has `ORB_DROP_CHANCE` to leave an orb's drop
    /// position, or else a small chance of a resource drop. `ticket_heroes`: who a ticket can be for.
    pub fn ingest(&mut self, events: &[Event], now: &Snapshot, before: &Snapshot, ticket_heroes: &[TicketHero]) {
        for event in events {
            let Event::Died { id } = event else { continue };
            let Some(actor) = before.actors.iter().chain(now.actors.iter()).find(|a| a.id == *id) else { continue };
            if actor.team != Team::Enemy { continue; }
            let Some(drop) = self.rolls_drop() else { continue };
            let scatter = vec2((self.random() - 0.5) * 28., (self.random() - 0.5) * 18.);
            let pos = world(actor.pos) + scatter;
            let loot = match drop {
                FieldDrop::Equipment => { if self.waiting_drops.len() < wf_meta::lamp::ORB_LIMIT { self.waiting_drops.push(pos); } continue }
                FieldDrop::Gold => Loot::Gold(GOLD_DROP_AMOUNT),
                FieldDrop::Essence => Loot::Essence(ESSENCE_DROP_AMOUNT),
                FieldDrop::Ticket => {
                    // One ticket, for one hero chosen evenly among those that can still level.
                    if ticket_heroes.is_empty() { continue; }
                    let hero = &ticket_heroes[((self.random() * ticket_heroes.len() as f32) as usize).min(ticket_heroes.len() - 1)];
                    Loot::Ticket { hero_id: hero.id.clone(), hero_name: hero.name.clone() }
                }
            };
            if self.loot.len() < LOOT_LIMIT { self.loot.push(Pickup { loot, pos, born: self.clock, eligible: false, flight: None }); }
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
                        self.orbs.push(Orb { id: item.instance_id, color, pos: pos.clamp(lo, hi), born: self.clock, eligible: false, blocked: false, flight: None });
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
                    restored.push(Orb { id, color, pos: (centre + offset).clamp(lo, hi), born: self.clock, eligible: true, blocked: false, flight: None });
                }
                // Saved order is drop order: older than anything dropped this session.
                restored.append(&mut self.orbs);
                self.orbs = restored;
            }
        }
        for drop in &mut self.loot { if drop.flight.is_none() { drop.pos = drop.pos.clamp(lo, hi); } }
        if std::mem::take(&mut self.dev_eligible) { for orb in &mut self.orbs { orb.eligible = true; } }
        // Subwave completion: everything lying on the field now is eligible.
        let completions = session.subwave_completions;
        if self.seen_completions.is_some_and(|seen| seen != completions) { for orb in &mut self.orbs { orb.eligible = true; } for drop in &mut self.loot { drop.eligible = true; } }
        self.seen_completions = Some(completions);
        // Pickup: an eligible orb inside a living hero's circle goes to the nearest such hero.
        // The save is authoritative: one transaction judges every orb in reach (an upgrade is
        // stored while the Bag has a free slot, anything else is dismantled for Essence), then
        // exactly the settled orbs fly. An upgrade the full Bag turned away is not asked about
        // again until a slot is free. During the wave chest pause the circle does not apply:
        // every orb goes to its nearest living hero.
        let sweep = !s.chests.is_empty() && !s.actors.iter().any(|a| a.team == Team::Enemy && a.hp > 0.);
        let room = economy.data().is_some_and(|d| d.free_slots() > 0);
        if can_collect && economy.data().is_some() {
            let heroes: Vec<(u32, Vec2, f32)> = s.actors.iter().filter(|a| a.team == Team::Hero && a.hp > 0.).map(|a| (a.id, world(a.pos), hero_height(a) * PICKUP_DIAMETER_IN_HERO_HEIGHTS / 2.)).collect();
            let reach: Vec<(String, u32)> = self.orbs.iter().filter(|o| (o.eligible || sweep) && o.flight.is_none() && (room || !o.blocked)).filter_map(|o| {
                heroes.iter().filter(|(_, feet, radius)| sweep || o.pos.distance(*feet) <= *radius).min_by(|a, b| o.pos.distance(a.1).total_cmp(&o.pos.distance(b.1))).map(|(hero, _, _)| (o.id.clone(), *hero))
            }).collect();
            if !reach.is_empty() {
                let ids: Vec<String> = reach.iter().map(|(id, _)| id.clone()).collect();
                match economy.collect_orbs(session, &ids) {
                    Ok(pickup) => {
                        let stored: HashSet<&str> = pickup.stored.iter().map(|i| i.instance_id.as_str()).collect();
                        let dismantled: HashSet<&str> = pickup.dismantled.iter().map(|i| i.instance_id.as_str()).collect();
                        let mut order = 0;
                        for orb in self.orbs.iter_mut().filter(|o| o.flight.is_none()) {
                            let Some((_, hero)) = reach.iter().find(|(id, _)| *id == orb.id) else { continue };
                            let kept = stored.contains(orb.id.as_str());
                            if !kept && !dismantled.contains(orb.id.as_str()) { orb.blocked = true; continue; }
                            orb.flight = Some(Flight { hero: *hero, start: self.clock + order as f32 * FLIGHT_STAGGER, from: orb.pos, stored: kept });
                            order += 1;
                        }
                        self.notice = None;
                    }
                    Err(error) => self.notice = Some(error),
                }
            }
        }
        // Resource drops follow the same reach rule and need no Bag slot: the flight starts and
        // the gain is handed to the caller in the same frame.
        if can_collect && self.loot.iter().any(|d| (d.eligible || sweep) && d.flight.is_none()) {
            let heroes: Vec<(u32, Vec2, f32)> = s.actors.iter().filter(|a| a.team == Team::Hero && a.hp > 0.).map(|a| (a.id, world(a.pos), hero_height(a) * PICKUP_DIAMETER_IN_HERO_HEIGHTS / 2.)).collect();
            let mut order = 0;
            for drop in self.loot.iter_mut().filter(|d| (d.eligible || sweep) && d.flight.is_none()) {
                let Some((hero, _, _)) = heroes.iter().filter(|(_, feet, radius)| sweep || drop.pos.distance(*feet) <= *radius).min_by(|a, b| drop.pos.distance(a.1).total_cmp(&drop.pos.distance(b.1))) else { continue };
                drop.flight = Some(Flight { hero: *hero, start: self.clock + order as f32 * FLIGHT_STAGGER, from: drop.pos, stored: false });
                self.collected.push(drop.loot.clone());
                order += 1;
            }
        }
        // Flights home in on the hero's current position.
        let clock = self.clock;
        for drop in &mut self.loot {
            let Some(flight) = &drop.flight else { continue };
            let t = ((clock - flight.start) / FLIGHT_SECONDS).clamp(0., 1.);
            let target = s.actors.iter().find(|a| a.id == flight.hero).map_or(flight.from, |a| world(a.pos) + vec2(0., -44.));
            drop.pos = flight.from.lerp(target, t * t) + vec2(0., -24. * (std::f32::consts::PI * t).sin());
        }
        self.loot.retain(|d| d.flight.as_ref().is_none_or(|f| clock - f.start < FLIGHT_SECONDS));
        for orb in &mut self.orbs {
            let Some(flight) = &orb.flight else { continue };
            let t = ((clock - flight.start) / FLIGHT_SECONDS).clamp(0., 1.);
            let target = s.actors.iter().find(|a| a.id == flight.hero).map_or(flight.from, |a| world(a.pos) + vec2(0., -44.));
            let eased = t * t;
            orb.pos = flight.from.lerp(target, eased) + vec2(0., -24. * (std::f32::consts::PI * t).sin());
        }
        let landed = |o: &Orb| o.flight.as_ref().is_some_and(|f| clock - f.start >= FLIGHT_SECONDS);
        self.arrived.extend(self.orbs.iter().filter(|o| landed(o) && o.flight.as_ref().is_some_and(|f| f.stored)).map(|o| o.color));
        self.orbs.retain(|o| !landed(o));
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
    pub fn draw(&mut self, assets: &crate::assets::Assets, camera: &WorldCamera, flying: bool) {
        if self.orbs.is_empty() && self.fading.is_empty() && self.loot.is_empty() { return; }
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
        // Resource drops: the HUD's own icon for the resource, over the orb halo in its colour.
        for drop in self.loot.iter().filter(|d| d.flight.is_some() == flying) {
            let p = camera.project(wf_combat::Vec2::new(drop.pos.x, drop.pos.y));
            let h = LOOT_SIZE * camera.zoom * (0.4 + 0.6 * ((self.clock - drop.born) / APPEAR_SECONDS).clamp(0., 1.));
            if p.x < -h || p.x > crate::camera::WIDTH + h || p.y < -h || p.y > crate::camera::HEIGHT + h { continue; }
            let tint = match drop.loot { Loot::Gold(_) => 0xf2c94c, Loot::Essence(_) => super::chrome::TIMER_BLUE, Loot::Ticket { .. } => 0xfff0af };
            quad(glow, p, h * 1.9, super::chrome::rgba(tint, 0.42));
            match &drop.loot {
                Loot::Gold(_) => super::chrome::resource_icon(assets, "gold", p.x - h / 2., p.y - h / 2., h),
                Loot::Essence(_) => super::chrome::resource_icon(assets, "essence", p.x - h / 2., p.y - h / 2., h),
                Loot::Ticket { hero_name, .. } => super::chrome::ticket_art(assets, wf_meta::hero::hero_definition(hero_name).map_or(hero_name.as_str(), |d| d.name), p.x - h * 0.75, p.y - h / 2., h * 1.5, h),
            }
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
            field.ingest(&events, &s, &before, &[]);
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
        assert!(drops >= kills / 25 && drops <= kills / 5, "about 13% of {kills} kills drop an orb ({drops})");
        assert!(picked >= 1, "heroes walked onto some orbs ({picked} of {drops})");
        assert!(swept >= 1, "the wave chest swept in orbs no hero walked onto ({swept} of {picked})");
        println!("orbs: {kills} kills, {drops} drops, {picked} collected, {swept} of them swept at a wave chest, {} left on the field", field.resting());
    }
    #[test]
    fn the_equipment_roll_drops_at_its_rate_and_its_dry_spells_are_the_expected_ones() {
        // The frequency and the dry spells of the 13.3% roll (10% before ORKA-63bf.43), over a
        // million kills.
        let mut field = OrbField { seed: 0x9E37_79B9, ..Default::default() };
        let (mut drops, mut dry, mut longest, mut over_30, mut over_50) = (0u32, 0u32, 0u32, 0u32, 0u32);
        let kills = 1_000_000;
        for _ in 0..kills {
            if field.rolls_drop() == Some(FieldDrop::Equipment) { drops += 1; if dry >= 30 { over_30 += 1; } if dry >= 50 { over_50 += 1; } dry = 0; } else { dry += 1; longest = longest.max(dry); }
        }
        let rate = drops as f64 / kills as f64;
        assert!((rate - ORB_DROP_CHANCE as f64).abs() < 0.002, "drop rate {rate}");
        // Kills in a row without a drop: 30 or more after 1.4% of drops (4.2% at the old 10%),
        // 50 or more after 0.08% (0.5%).
        let (p30, p50) = (over_30 as f64 / drops as f64, over_50 as f64 / drops as f64);
        let miss = 1. - ORB_DROP_CHANCE as f64;
        assert!((p30 - miss.powi(30)).abs() < 0.003 && (p50 - miss.powi(50)).abs() < 0.001, "dry spells: {p30} over 30, {p50} over 50, longest {longest}");
        assert!((miss.powi(30) - 0.0138).abs() < 0.0005 && (miss.powi(50) - 0.0008).abs() < 0.0001 && (0.9f64.powi(30) - 0.0424).abs() < 0.0005);
        println!("equipment roll {rate:.4}: {:.2}% of drops follow 30+ dry kills, {:.3}% follow 50+, longest dry spell {longest}", p30 * 100., p50 * 100.);
    }
    /// Owner 2026-11-05 (temporary): Gold, Essence and single hero tickets drop in low quantities.
    #[test]
    fn kills_also_drop_a_little_gold_essence_or_one_ticket_beside_the_equipment_roll() {
        let mut run = crate::testing::HostRun::new(1);
        for _ in 0..600 { if run.snapshot().actors.iter().any(|a| a.team == Team::Enemy) { break; } run.step(); }
        let s = run.snapshot().clone();
        let enemy = s.actors.iter().find(|a| a.team == Team::Enemy).expect("an enemy on the first wave").id;
        let heroes: Vec<TicketHero> = ["falie#1", "huun#1", "kojonn#1", "runa#1"].iter().zip(["Falie", "Huun", "Kojonn", "Runa"]).map(|(id, name)| TicketHero { id: id.to_string(), name: name.into() }).collect();
        let mut field = OrbField { seed: 0x9E37_79B9, ..Default::default() };
        let (mut orbs, mut gold, mut essence, mut tickets) = (0u32, 0u32, 0u32, std::collections::BTreeMap::<String, u32>::new());
        let kills = 200_000;
        for _ in 0..kills {
            field.ingest(&[Event::Died { id: enemy }], &s, &s, &heroes);
            orbs += field.waiting_drops.len() as u32; field.waiting_drops.clear();
            for drop in field.loot.drain(..) {
                match drop.loot {
                    Loot::Gold(amount) => { assert_eq!(amount, GOLD_DROP_AMOUNT); gold += 1; }
                    Loot::Essence(amount) => { assert_eq!(amount, ESSENCE_DROP_AMOUNT); essence += 1; }
                    Loot::Ticket { hero_id, hero_name } => { assert!(heroes.iter().any(|h| h.id == hero_id && h.name == hero_name)); *tickets.entry(hero_id).or_default() += 1; }
                }
            }
        }
        let rate = |n: u32| n as f64 / kills as f64;
        let ticket_total: u32 = tickets.values().sum();
        assert!((rate(orbs) - ORB_DROP_CHANCE as f64).abs() < 0.003 && (rate(gold) - 0.05).abs() < 0.003 && (rate(essence) - 0.04).abs() < 0.003 && (rate(ticket_total) - 0.03).abs() < 0.003, "orbs {orbs} gold {gold} essence {essence} tickets {ticket_total}");
        // One ticket at a time, spread evenly across all four heroes.
        assert_eq!(tickets.len(), 4);
        for (hero, count) in &tickets { assert!((*count as f64 / ticket_total as f64 - 0.25).abs() < 0.03, "{hero}: {count} of {ticket_total}"); }
        // Nobody can use a ticket: that roll drops nothing. A hero death drops nothing.
        let mut none = OrbField { seed: 0x9E37_79B9, ..Default::default() };
        for _ in 0..5000 { none.ingest(&[Event::Died { id: enemy }], &s, &s, &[]); }
        assert!(!none.loot.is_empty() && none.loot.iter().all(|d| !matches!(d.loot, Loot::Ticket { .. })));
        assert!(none.loot.len() <= LOOT_LIMIT, "the field holds a bounded number of resource drops");
        let hero_id = hero(&s).id;
        let mut quiet = OrbField { seed: 7, ..Default::default() };
        for _ in 0..2000 { quiet.ingest(&[Event::Died { id: hero_id }], &s, &s, &heroes); }
        assert!(quiet.loot.is_empty() && quiet.waiting_drops.is_empty());
    }
    #[test]
    fn resource_drops_are_picked_up_like_orbs_without_a_bag_slot_and_handed_over_once() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = economy(&mut run);
        let s = solo(run.snapshot());
        let feet = world(hero(&s).pos);
        let mut field = OrbField::default();
        field.update(&mut economy, &mut run.session, &s, 0.016, true, &height);
        let ticket = Loot::Ticket { hero_id: "huun#1".into(), hero_name: "Huun".into() };
        for (loot, offset) in [(Loot::Gold(25.), vec2(RADIUS - 1., 0.)), (ticket.clone(), vec2(0., 10.)), (Loot::Essence(3.), vec2(0., RADIUS + 1.))] {
            field.loot.push(Pickup { loot, pos: feet + offset, born: 0., eligible: false, flight: None });
        }
        // In reach but the subwave is still running: nothing is collected.
        for _ in 0..30 { field.update(&mut economy, &mut run.session, &s, 0.016, true, &height); }
        assert!(field.collected.is_empty() && field.loot_count() == 3);
        // The subwave completes: the two inside the circle fly, each handed over exactly once.
        run.session.subwave_completions += 1;
        field.update(&mut economy, &mut run.session, &s, 0.016, true, &height);
        assert_eq!(std::mem::take(&mut field.collected), [Loot::Gold(25.), ticket]);
        for _ in 0..60 { field.update(&mut economy, &mut run.session, &s, 0.016, true, &height); }
        assert!(field.collected.is_empty(), "never handed over twice");
        assert_eq!(field.loot_count(), 1, "the far drop waits; the flown ones are gone");
        // A Bag window is open: nothing is collected. The wave chest on a cleared field sweeps it.
        let mut cleared = s.clone();
        cleared.actors.retain(|a| a.team == Team::Hero);
        cleared.chests.push(wf_combat::ChestView { id: 1, pos: wf_combat::Vec2::new(0., 0.), state: wf_combat::ChestState::Closed, age: 0., state_age: 0., reward: None });
        field.update(&mut economy, &mut run.session, &cleared, 0.016, false, &height);
        assert!(field.collected.is_empty());
        field.update(&mut economy, &mut run.session, &cleared, 0.016, true, &height);
        assert_eq!(field.collected, [Loot::Essence(3.)]);
        // No Bag slot was used by any of it.
        assert_eq!(stored(&economy), 0.);
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
        let asked = economy.generation;
        for _ in 0..120 { field.update(&mut economy, &mut run.session, &s, 0.016, true, &height); }
        assert_eq!((stored(&economy), field.resting(), field.flying(), economy.data().unwrap().orb_count()), (20., 6, 0, 6), "a full Bag takes nothing and loses nothing");
        assert_eq!(economy.generation, asked, "upgrades a full Bag turned away are not asked about again every frame");
        // The player equips and dismantles in the equipment screen (collection holds meanwhile).
        economy.auto_equip(&mut run.session).unwrap();
        let preview = economy.disposal_preview(&mut run.session, None).unwrap();
        field.update(&mut economy, &mut run.session, &s, 0.016, false, &height);
        economy.dismantle(&mut run.session, &preview).unwrap();
        field.update(&mut economy, &mut run.session, &s, 0.016, false, &height);
        assert_eq!(field.resting(), 6, "nothing is collected while a Bag window is open");
        let free = economy.data().unwrap().free_slots();
        assert!(free >= 6);
        let essence = economy.data().unwrap().lamp.essence;
        field.update(&mut economy, &mut run.session, &s, 0.016, true, &height);
        // Room again: the six are picked up and judged against what the heroes wear now. The
        // ones that still raise a hero's CP are stored; the others are dismantled for Essence.
        let data = economy.data().unwrap();
        assert_eq!((field.resting(), data.orb_count()), (0, 0), "blocked orbs resume once there is room");
        assert_eq!(field.orbs.iter().filter(|o| o.flight.is_some()).count(), 6, "stored or dismantled, every one flies to the hero");
        assert_eq!(field.flying() as f64, data.stored_count(), "the bag count waits only for the stored ones");
        assert_eq!(data.lamp.essence > essence, field.flying() < 6, "the rest paid Essence");
        assert!(data.stored_count() <= data.capacity());
    }
    /// Owner 2026-11-05 (ORKA-63bf.34): the item is judged when a hero picks the orb up.
    #[test]
    fn once_the_party_is_equipped_orbs_that_raise_nobodys_cp_are_dismantled_at_pickup() {
        use wf_meta::lamp::salvage_value;
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = economy(&mut run);
        let s = solo(run.snapshot());
        let mut field = OrbField::default();
        field.update(&mut economy, &mut run.session, &s, 0.016, true, &height);
        // A bare party: all twelve drops raise somebody's CP and are stored.
        lay(&mut field, &mut economy, &mut run, &s, 12, vec2(10., 0.));
        run.session.subwave_completions += 1;
        field.update(&mut economy, &mut run.session, &s, 0.016, true, &height);
        assert_eq!((stored(&economy), field.flying(), economy.data().unwrap().lamp.essence), (12., 12, 0.));
        assert!(field.arrived.is_empty(), "nothing has gone into the bag while the orbs are still flying");
        for _ in 0..60 { field.update(&mut economy, &mut run.session, &s, 0.016, true, &height); }
        // Each stored orb goes into the bag once, when its flight ends (the bag bounces for it).
        assert_eq!(std::mem::take(&mut field.arrived).len(), 12);
        // The Bag is opened: Auto-Equip, then the leftovers are dismantled.
        assert!(!economy.auto_equip(&mut run.session).unwrap().is_empty());
        let preview = economy.disposal_preview(&mut run.session, None).unwrap();
        if !preview.ids.is_empty() { economy.dismantle(&mut run.session, &preview).unwrap(); }
        assert_eq!(stored(&economy), 0.);
        // Thirty more drops in reach, judged in one transaction when their subwave completes.
        lay(&mut field, &mut economy, &mut run, &s, 30, vec2(10., 0.));
        let orbs = economy.data().unwrap().orbs();
        let essence = economy.data().unwrap().lamp.essence;
        run.session.subwave_completions += 1;
        field.update(&mut economy, &mut run.session, &s, 0.016, true, &height);
        let data = economy.data().unwrap();
        let kept: Vec<&wf_meta::lamp::LampItem> = orbs.iter().filter(|o| data.item(&o.instance_id).is_some()).collect();
        let lying = data.orbs();
        let gone: Vec<&wf_meta::lamp::LampItem> = orbs.iter().filter(|o| data.item(&o.instance_id).is_none() && !lying.iter().any(|l| l.instance_id == o.instance_id)).collect();
        // Only an upgrade the full Bag could not take is left lying.
        let left = lying.len();
        assert!(!gone.is_empty() && gone.len() + kept.len() + left == 30, "{} stored, {} dismantled, {left} left", kept.len(), gone.len());
        assert!(field.resting() == left && (left == 0 || data.free_slots() == 0), "{left} left on the field");
        assert_eq!(field.orbs.iter().filter(|o| o.flight.is_some()).count(), 30 - left, "every picked-up orb flies to the hero");
        assert_eq!((field.flying(), data.stored_count()), (kept.len(), kept.len() as f64), "only upgrades use Bag slots");
        assert_eq!(data.lamp.essence, essence + gone.iter().map(|o| salvage_value(&o.rarity)).sum::<f64>(), "the others paid their salvage Essence at once");
        // Only the stored ones go into the bag; a dismantled orb's flight ends without a bounce.
        for _ in 0..90 { field.update(&mut economy, &mut run.session, &s, 0.016, false, &height); }
        assert_eq!(field.arrived.len(), kept.len());
        // What was stored is all still an upgrade: nothing in the Bag waits to be dismantled.
        assert!(economy.disposal_preview(&mut run.session, None).unwrap().ids.is_empty());
        println!("judged at pickup: {} stored, {} dismantled for {} Essence", kept.len(), gone.len(), economy.data().unwrap().lamp.essence - essence);
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
