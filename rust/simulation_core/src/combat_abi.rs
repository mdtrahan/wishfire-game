//! Headless JSON transport. Only the opt-in developer shadow calls this in-game.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{cell::RefCell, collections::BTreeMap};
use wf_combat::{actors::hero_index, math::Floor, tuning::Stats, *};

const VERSION: u32 = 1 << 16;
const MAX_REQUEST: usize = 1 << 20;
const MAX_RESPONSE: usize = 8 << 20;
const MAX_EVENTS: usize = 65_536;
const MAX_ENEMIES: usize = 256;
const MAX_EFFECTS: usize = 2048;

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Version {
    major: u16,
    minor: u16,
}
const SCHEMA: Version = Version { major: 1, minor: 0 };
#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Point {
    x: f32,
    y: f32,
}
impl From<Point> for Vec2 {
    fn from(p: Point) -> Self {
        Vec2::new(p.x, p.y)
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Bounds {
    min: Point,
    max: Point,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct GeometryInput {
    floor: Bounds,
    viewport_world: Point,
    formation_origin: Point,
    screen_bound: bool,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StatInput {
    hp: f32,
    atk: f32,
    def: f32,
    speed: f32,
    reach: f32,
    interval: f32,
    evade: f32,
    special: f32,
}
impl StatInput {
    fn resolved(&self) -> Stats {
        Stats {
            hp: self.hp,
            atk: self.atk,
            def: self.def,
            speed: self.speed,
            reach: self.reach,
            interval: self.interval,
            evade: self.evade,
            special: self.special,
        }
    }
    fn valid(&self) -> bool {
        [
            self.hp,
            self.atk,
            self.def,
            self.speed,
            self.reach,
            self.interval,
            self.evade,
            self.special,
        ]
        .iter()
        .all(|x| x.is_finite() && *x >= 0. && *x <= 1_000_000.)
            && self.hp > 0.
            && self.interval >= SIM_DT
            && self.special >= 0.
            && self.evade <= 1.
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct HeroInput {
    instance_id: String,
    definition_id: String,
    slot: u8,
    formation_offset: Point,
    stats: StatInput,
    hp: f32,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EnemyInput {
    spawn_key: String,
    definition_id: String,
    position: Point,
    stats: StatInput,
    hp: f32,
    #[serde(default)]
    summon_profiles: Vec<SummonProfile>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SummonProfile {
    definition_id: String,
    stats: StatInput,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EncounterConfig {
    encounter_id: String,
    seed: String,
    geometry: GeometryInput,
    heroes: Vec<HeroInput>,
    enemies: Vec<EnemyInput>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StepRequest {
    encounter_id: String,
    expected_previous_step: String,
}
#[derive(Deserialize)]
#[serde(
    tag = "kind",
    content = "data",
    rename_all = "snake_case",
    deny_unknown_fields
)]
enum Operation {
    Describe {},
    Create {
        config: EncounterConfig,
    },
    Step {
        world: u32,
        request: StepRequest,
    },
    Inspect {
        world: u32,
        events_after: String,
    },
    Spawn {
        world: u32,
        encounter_id: String,
        enemies: Vec<EnemyInput>,
    },
    Destroy {
        world: u32,
    },
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    schema: Version,
    request_id: String,
    operation: Operation,
}

// Fixed slots and non-wrapping generations prevent stale handles from aliasing new values.
struct Slot<T> {
    generation: u16,
    value: Option<T>,
}
struct Registry<T> {
    slots: Vec<Slot<T>>,
}
impl<T> Registry<T> {
    fn new(count: usize) -> Self {
        Self {
            slots: (0..count)
                .map(|_| Slot {
                    generation: 1,
                    value: None,
                })
                .collect(),
        }
    }
    fn available(&self) -> bool {
        self.slots
            .iter()
            .any(|s| s.generation != 0 && s.value.is_none())
    }
    fn insert(&mut self, value: T) -> Option<u32> {
        let i = self
            .slots
            .iter()
            .position(|s| s.generation != 0 && s.value.is_none())?;
        let slot = &mut self.slots[i];
        slot.value = Some(value);
        Some((u32::from(slot.generation) << 16) | (i as u32 + 1))
    }
    fn get(&self, id: u32) -> Option<&T> {
        let slot = self.slots.get((id & 0xffff).checked_sub(1)? as usize)?;
        if slot.generation != (id >> 16) as u16 {
            return None;
        }
        slot.value.as_ref()
    }
    fn get_mut(&mut self, id: u32) -> Option<&mut T> {
        let slot = self.slots.get_mut((id & 0xffff).checked_sub(1)? as usize)?;
        if slot.generation != (id >> 16) as u16 {
            return None;
        }
        slot.value.as_mut()
    }
    fn remove(&mut self, id: u32) -> Option<T> {
        let slot = self.slots.get_mut((id & 0xffff).checked_sub(1)? as usize)?;
        if slot.generation != (id >> 16) as u16 {
            return None;
        }
        let value = slot.value.take()?;
        slot.generation = slot.generation.checked_add(1).unwrap_or(0);
        Some(value)
    }
    fn count(&self) -> usize {
        self.slots.iter().filter(|s| s.value.is_some()).count()
    }
}
struct World {
    sim: Sim,
    encounter_id: String,
    state: &'static str,
    events: Vec<Value>,
    identities: std::collections::BTreeSet<String>,
    host_ids: BTreeMap<u32, String>,
}
struct Transport {
    inputs: BTreeMap<u32, Box<[u8]>>,
    worlds: Registry<World>,
    responses: Registry<Box<[u8]>>,
}
impl Transport {
    fn new() -> Self {
        Self {
            inputs: BTreeMap::new(),
            worlds: Registry::new(2),
            responses: Registry::new(8),
        }
    }
    fn execute(&mut self, op: Operation) -> Result<Value, Value> {
        match op {
            Operation::Describe {} => Ok(json!({"abi_version":VERSION,"schema":SCHEMA,"hz":SIM_HZ,
                "capabilities":["headless_slice_v1","initial_enemies","events_after","spawn_enemies"],
                "limits":{"request_bytes":MAX_REQUEST,"response_bytes":MAX_RESPONSE,"worlds":2,"responses":8,"inputs":8,"heroes":4,"enemies":MAX_ENEMIES,"hazards":MAX_EFFECTS,"projectiles":MAX_EFFECTS,"retained_events":MAX_EVENTS,"event_step_reserve":MAX_EVENTS/2,"floor_min_extent":256,"floor_max_extent":16384},
                "resources":{"worlds":self.worlds.count(),"responses":self.responses.count(),"inputs":self.inputs.len()}})),
            Operation::Create { config } => {
                if !self.worlds.available() {
                    return Err(error(
                        "resource_limit",
                        "world",
                        "two live worlds already exist",
                        None,
                    ));
                }
                let world = World::create(config)?;
                let result = world.result(0);
                let handle = self
                    .worlds
                    .insert(world)
                    .ok_or_else(|| error("resource_limit", "world", "world registry full", None))?;
                Ok(json!({"world":handle,"snapshot":result["snapshot"],"events":result["events"]}))
            }
            Operation::Destroy { world } => {
                self.worlds.remove(world).ok_or_else(bad_world)?;
                Ok(json!({"destroyed":true}))
            }
            Operation::Spawn {
                world,
                encounter_id,
                enemies,
            } => {
                let w = self.worlds.get_mut(world).ok_or_else(bad_world)?;
                w.spawn(&encounter_id, enemies)
            }
            Operation::Inspect {
                world,
                events_after,
            } => {
                let w = self.worlds.get(world).ok_or_else(bad_world)?;
                let after = decimal(&events_after, "operation.data.events_after")?;
                if after > w.events.len() as u64 {
                    return Err(error(
                        "invalid_cursor",
                        "events_after",
                        "cursor is beyond the event stream",
                        Some(w.sim.step_number),
                    ));
                }
                Ok(w.result(after as usize))
            }
            Operation::Step { world, request } => {
                let w = self.worlds.get_mut(world).ok_or_else(bad_world)?;
                let previous = decimal(
                    &request.expected_previous_step,
                    "request.expected_previous_step",
                )?;
                if request.encounter_id != w.encounter_id || previous != w.sim.step_number {
                    return Err(error(
                        "step_conflict",
                        "request",
                        "encounter or previous step differs",
                        Some(w.sim.step_number),
                    ));
                }
                if w.state != "running" {
                    return Err(error(
                        "terminal",
                        "world",
                        "encounter is terminal",
                        Some(w.sim.step_number),
                    ));
                }
                // Keep room for a complete tick. No acknowledged cursor or event eviction in this bead.
                if w.events.len() >= MAX_EVENTS / 2 {
                    return Err(error(
                        "event_backpressure",
                        "events",
                        "retained event capacity requires a new encounter",
                        Some(w.sim.step_number),
                    ));
                }
                let after = w.events.len();
                w.sim.step();
                w.collect();
                w.sim.defeats.clear();
                w.sim.materialized.clear();
                w.sim.finish_requested = false;
                if w.events.len() > MAX_EVENTS
                    || w.sim
                        .actors
                        .iter()
                        .filter(|a| a.view.team == Team::Enemy && a.alive())
                        .count()
                        > MAX_ENEMIES
                    || w.sim.hazards.len() > MAX_EFFECTS
                    || w.sim.projectiles.len() > MAX_EFFECTS
                {
                    w.state = "faulted";
                    return Err(error(
                        "capacity_fault",
                        "world",
                        "encounter capacity exceeded; destroy and restart",
                        Some(w.sim.step_number),
                    ));
                }
                Ok(w.result(after))
            }
        }
    }
}
fn error(code: &str, field: &str, message: &str, step: Option<u64>) -> Value {
    json!({"code":code,"field":field,"message":message,"current_step":step.map(|s|s.to_string()),"retained_event_range":null})
}
fn bad_world() -> Value {
    error("bad_handle", "world", "invalid or stale world handle", None)
}
fn decimal(s: &str, field: &str) -> Result<u64, Value> {
    if s.is_empty() || !s.bytes().all(|c| c.is_ascii_digit()) {
        return Err(error(
            "invalid_input",
            field,
            "expected decimal u64 string",
            None,
        ));
    }
    s.parse()
        .map_err(|_| error("invalid_input", field, "u64 overflow", None))
}
fn kind(id: &str) -> Option<Archetype> {
    Some(match id {
        "slice.hero.fara" => Archetype::Fara,
        "slice.hero.hondo" => Archetype::Hondo,
        "slice.hero.runa" => Archetype::Runa,
        "slice.hero.kaja" => Archetype::Kaja,
        "slice.enemy.gobloc" => Archetype::Gobloc,
        "slice.enemy.orc" => Archetype::Orc,
        "slice.enemy.sniper" => Archetype::Sniper,
        "slice.enemy.lizardo" => Archetype::Lizardo,
        "slice.enemy.fizzmite" => Archetype::Fizzmite,
        "slice.enemy.high_orc" => Archetype::HighOrc,
        "slice.enemy.marid" => Archetype::Marid,
        "slice.enemy.gloamink" => Archetype::Gloamink,
        "slice.enemy.mirewing" => Archetype::Mirewing,
        "slice.enemy.bastorto" => Archetype::Bastorto,
        "slice.boss.troll_brute" => Archetype::Boss,
        "slice.boss.chimerilass" => Archetype::BossBomber,
        "slice.boss.djinn" => Archetype::BossMarksman,
        _ => return None,
    })
}
impl World {
    fn create(c: EncounterConfig) -> Result<Self, Value> {
        let invalid = |field: &str| error("invalid_input", field, "invalid encounter input", None);
        let seed = decimal(&c.seed, "config.seed")?;
        if c.encounter_id.is_empty() || c.encounter_id.len() > 256 {
            return Err(invalid("config.encounter_id"));
        }
        if !(1..=4).contains(&c.heroes.len()) || c.enemies.len() > MAX_ENEMIES {
            return Err(invalid("config.heroes/enemies"));
        }
        let g = &c.geometry;
        let floor = Floor {
            min: g.floor.min.into(),
            max: g.floor.max.into(),
        };
        let finite_point = |p: Point| {
            p.x.is_finite() && p.y.is_finite() && p.x.abs() <= 1_000_000. && p.y.abs() <= 1_000_000.
        };
        if ![
            g.floor.min,
            g.floor.max,
            g.viewport_world,
            g.formation_origin,
        ]
        .iter()
        .all(|p| finite_point(*p))
            || floor.max.x - floor.min.x < 256.
            || floor.max.y - floor.min.y < 256.
            || floor.max.x - floor.min.x > 16384.
            || floor.max.y - floor.min.y > 16384.
            || g.viewport_world.x <= 0.
            || g.viewport_world.y <= 0.
        {
            return Err(invalid("config.geometry"));
        }
        let mut identities = std::collections::BTreeSet::new();
        let mut slots = std::collections::BTreeSet::new();
        let mut definitions = std::collections::BTreeSet::new();
        let mut spawns = Vec::new();
        let mut heroes = c.heroes;
        heroes.sort_by_key(|h| h.slot);
        for h in &heroes {
            let k = kind(&h.definition_id)
                .filter(|k| hero_index(*k).is_some())
                .ok_or_else(|| invalid("config.heroes.definition_id"))?;
            // The slice still indexes heroes by archetype. Duplicate archetypes await the roster bead.
            if h.slot >= 4 || !slots.insert(h.slot) || !definitions.insert(h.definition_id.as_str())
            {
                return Err(invalid("config.heroes.slot/definition_id"));
            }
            spawns.push((
                k,
                h.instance_id.as_str(),
                Vec2::from(g.formation_origin) + Vec2::from(h.formation_offset),
                &h.stats,
                h.hp,
            ));
        }
        for e in &c.enemies {
            let k = kind(&e.definition_id)
                .filter(|k| hero_index(*k).is_none())
                .ok_or_else(|| invalid("config.enemies.definition_id"))?;
            spawns.push((k, e.spawn_key.as_str(), e.position.into(), &e.stats, e.hp));
        }
        for (k, id, p, stats, hp) in &spawns {
            let radius = if tuning::is_boss(*k) {
                tuning::BOSS_BODY_RADIUS
            } else {
                tuning::BODY_RADIUS
            };
            if id.is_empty()
                || id.len() > 256
                || !identities.insert((*id).to_owned())
                || !stats.valid()
                || !hp.is_finite()
                || *hp < 0.
                || *hp > stats.hp
                || !p.x.is_finite()
                || !p.y.is_finite()
                || floor.point(*p, radius) != *p
            {
                return Err(invalid("config.actors"));
            }
        }
        let mut sim = Sim::new(SimConfig {
            seed,
            arena_size: floor.max - floor.min,
            visible_width: g.viewport_world.x,
            visible_height: g.viewport_world.y,
            cohesion: if g.screen_bound {
                Cohesion::ScreenBound
            } else {
                Cohesion::None
            },
            ..SimConfig::default()
        });
        sim.floor = floor;
        sim.formation_origin = g.formation_origin.into();
        // Summon templates are final host inputs, independent of initial enemy stats.
        for e in &c.enemies {
            for profile in &e.summon_profiles {
                let k = kind(&profile.definition_id)
                    .filter(|k| hero_index(*k).is_none())
                    .ok_or_else(|| invalid("config.enemies.summon_profiles.definition_id"))?;
                if !profile.stats.valid() || sim.spawn_profiles.iter().any(|(old, _)| *old == k) {
                    return Err(invalid("config.enemies.summon_profiles"));
                }
                sim.spawn_profiles.push((k, profile.stats.resolved()));
            }
        }
        for (k, ..) in &spawns {
            let required: &[Archetype] = match k {
                Archetype::Boss => &[Archetype::Gobloc],
                Archetype::BossMarksman => &[Archetype::Sniper, Archetype::Lizardo],
                _ => &[],
            };
            if required
                .iter()
                .any(|required| !sim.spawn_profiles.iter().any(|(k, _)| k == required))
            {
                return Err(invalid("config.enemies.summon_profiles"));
            }
        }
        let mut host_ids = BTreeMap::new();
        for (k, id, p, stats, hp) in spawns {
            sim.spawn_actor(k, p, stats.resolved());
            let actor = sim.actors.last_mut().unwrap();
            actor.view.hp = hp;
            host_ids.insert(actor.view.id, id.to_owned());
        }
        for (actor, hero) in sim.actors.iter_mut().zip(&heroes) {
            actor.formation_offset = hero.formation_offset.into();
        }
        sim.deaths();
        sim.refresh_snapshot();
        let mut w = Self {
            sim,
            encounter_id: c.encounter_id,
            state: "running",
            events: Vec::new(),
            identities,
            host_ids,
        };
        w.collect();
        Ok(w)
    }
    fn spawn(&mut self, encounter_id: &str, enemies: Vec<EnemyInput>) -> Result<Value, Value> {
        let invalid = || {
            error(
                "invalid_input",
                "spawn.enemies",
                "invalid enemy spawn batch",
                Some(self.sim.step_number),
            )
        };
        if encounter_id != self.encounter_id {
            return Err(error(
                "step_conflict",
                "encounter_id",
                "encounter differs",
                Some(self.sim.step_number),
            ));
        }
        if self.state != "running" && self.state != "ended" {
            return Err(error(
                "terminal",
                "world",
                "encounter cannot accept spawns",
                Some(self.sim.step_number),
            ));
        }
        if enemies.is_empty()
            || self.sim.actors.len() + enemies.len() > MAX_ENEMIES + 4
            || self.events.len() >= MAX_EVENTS / 2
        {
            return Err(error(
                "resource_limit",
                "spawn.enemies",
                "spawn capacity exhausted",
                Some(self.sim.step_number),
            ));
        }
        // Validate the entire batch before consuming IDs or emitting events.
        let mut identities = self.identities.clone();
        let mut batch = Vec::new();
        for e in &enemies {
            let k = kind(&e.definition_id)
                .filter(|k| hero_index(*k).is_none())
                .ok_or_else(invalid)?;
            let p = Vec2::from(e.position);
            let radius = if tuning::is_boss(k) {
                tuning::BOSS_BODY_RADIUS
            } else {
                tuning::BODY_RADIUS
            };
            if e.spawn_key.is_empty()
                || e.spawn_key.len() > 256
                || !identities.insert(e.spawn_key.clone())
                || !e.stats.valid()
                || !e.hp.is_finite()
                || e.hp < 0.
                || e.hp > e.stats.hp
                || !p.x.is_finite()
                || !p.y.is_finite()
                || self.sim.floor.point(p, radius) != p
                || !e.summon_profiles.is_empty()
            {
                return Err(invalid());
            }
            let required: &[Archetype] = match k {
                Archetype::Boss => &[Archetype::Gobloc],
                Archetype::BossMarksman => &[Archetype::Sniper, Archetype::Lizardo],
                _ => &[],
            };
            if required
                .iter()
                .any(|required| !self.sim.spawn_profiles.iter().any(|(k, _)| k == required))
            {
                return Err(invalid());
            }
            batch.push((k, e.spawn_key.clone(), p, e.stats.resolved(), e.hp));
        }
        self.identities = identities;
        self.state = "running";
        self.sim.encounter.complete = false;
        let after = self.events.len();
        for (k, id, p, stats, hp) in batch {
            self.sim.spawn_actor(k, p, stats);
            let actor = self.sim.actors.last_mut().unwrap();
            actor.view.hp = hp;
            self.host_ids.insert(actor.view.id, id);
        }
        self.sim.deaths();
        self.sim.refresh_snapshot();
        self.collect();
        Ok(self.result(after))
    }
    fn event(&mut self, body: Value) {
        self.events.push(json!({"schema":SCHEMA,"encounter_id":self.encounter_id,"step":self.sim.step_number.to_string(),"combat_step":self.sim.combat_steps.to_string(),"sequence":(self.events.len() as u64+1).to_string(),"body":body}));
    }
    fn collect(&mut self) {
        for e in self.sim.drain_events() {
            let body = match e {
                Event::Hit {
                    source,
                    target,
                    amount,
                    crit,
                    element,
                    blocked,
                } => {
                    json!({"kind":"damage","data":{"source":source,"target":target,"amount":amount,"crit":crit,"element":element,"blocked":blocked}})
                }
                Event::Downed { id } => json!({"kind":"downed","data":{"hero":id}}),
                Event::Died { id } => json!({"kind":"died","data":{"actor":id}}),
                Event::Spawned { id, archetype } => {
                    json!({"kind":"spawned","data":{"actor":id,"kind":archetype}})
                }
                Event::Revived { id } => json!({"kind":"revived","data":{"hero":id}}),
                other => json!({"kind":"presentation","data":{"event":other}}),
            };
            self.event(body);
        }
        if self.state == "running" {
            if !self
                .sim
                .actors
                .iter()
                .any(|a| a.view.team == Team::Hero && a.alive())
            {
                self.state = "all_down";
                self.event(json!({"kind":"all_down","data":{"heroes":self.sim.actors.iter().filter(|a|a.view.team==Team::Hero).map(|a|a.view.id).collect::<Vec<_>>()}}));
            } else if !self
                .sim
                .actors
                .iter()
                .any(|a| a.view.team == Team::Enemy && a.alive())
            {
                self.state = "ended";
                self.sim.encounter.complete = true;
                self.event(json!({"kind":"ended","data":{"reason":"enemies_defeated"}}));
            }
        }
    }
    fn result(&self, after: usize) -> Value {
        let actors:Vec<_> = self.sim.actors.iter().map(|a|json!({"actor_id":a.view.id,"host_id":self.host_ids.get(&a.view.id),"state":format!("{:?}",a.view.state).to_lowercase(),"state_age":a.view.state_age,"state_duration":a.view.state_duration,"impact_at":a.view.impact_at,"facing":format!("{:?}",a.view.facing).to_lowercase(),"ward":a.view.ward,"warcry_shield":a.view.warcry_shield,"energy":a.view.energy,"enraged":a.view.enraged,"radius":a.view.radius,"target":a.view.target,"encased":a.view.encased,"slowed":a.view.slowed,"taunted_by":a.view.taunted_by,"groove_active":a.view.groove_active,"special_casting":a.view.special_casting,"elevate":a.view.elevate.map(|v| format!("{v:?}").to_lowercase()),"scale":a.view.scale,"kind":a.view.archetype,"team":if a.view.team==Team::Hero {"hero"} else {"enemy"},"pos":{"x":a.view.pos.x,"y":a.view.pos.y},"hp":a.view.hp,"max_hp":a.view.max_hp,"downed":a.view.state==ActorState::Downed})).collect();
        let hazards: Vec<_> = self.sim.snapshot().hazards.iter().map(|h| {
            let shape = match h.shape {
                Shape::Circle { radius } => json!({"kind":"circle","radius":radius}),
                Shape::Ring { inner, outer } => json!({"kind":"ring","inner":inner,"outer":outer}),
                Shape::Cone { length, half_angle_rad } => json!({"kind":"cone","length":length,"half_angle_rad":half_angle_rad}),
                Shape::Line { length, width } => json!({"kind":"line","length":length,"width":width}),
            };
            json!({"id":h.id,"kind":h.kind,"owner":h.owner,"team":if h.team==Team::Hero {"hero"} else {"enemy"},"phase":format!("{:?}",h.phase).to_lowercase(),"progress":h.progress,"width_scale":h.width_scale,"tier":h.tier,"fill":format!("{:?}",h.fill).to_lowercase(),"hostile":h.hostile,"origin":{"x":h.origin.x,"y":h.origin.y},"dir":{"x":h.dir.x,"y":h.dir.y},"shape":shape})
        }).collect();
        json!({"snapshot":{"time":self.sim.snapshot().time,"combat_time":self.sim.snapshot().combat_time,"hazards":hazards,"projectiles":self.sim.snapshot().projectiles.iter().map(|p|json!({"id":p.id,"kind":format!("{:?}",p.kind).to_lowercase(),"team":if p.team==Team::Hero {"hero"} else {"enemy"},"pos":{"x":p.pos.x,"y":p.pos.y},"height":p.height,"dir":{"x":p.dir.x,"y":p.dir.y}})).collect::<Vec<_>>(),"camera_focus":{"x":self.sim.snapshot().camera_focus.x,"y":self.sim.snapshot().camera_focus.y},"schema":SCHEMA,"encounter_id":self.encounter_id,"step":self.sim.step_number.to_string(),"combat_steps":self.sim.combat_steps.to_string(),"state":self.state,"actors":actors,"live_enemies":self.sim.actors.iter().filter(|a|a.view.team==Team::Enemy && a.alive()).count(),"last_event_sequence":self.events.len().to_string(),"gameplay_hash":format!("{:016x}",self.sim.state_hash()),"geometry":{"floor":{"min":{"x":self.sim.floor.min.x,"y":self.sim.floor.min.y},"max":{"x":self.sim.floor.max.x,"y":self.sim.floor.max.y}}}},"events":&self.events[after..]})
    }
}
thread_local! { static TRANSPORT: RefCell<Transport> = RefCell::new(Transport::new()); }
#[no_mangle]
pub extern "C" fn wf_combat_abi_version() -> u32 {
    VERSION
}
#[no_mangle]
pub extern "C" fn wf_input_alloc(len: u32) -> u32 {
    if len == 0 || len as usize > MAX_REQUEST {
        return 0;
    }
    TRANSPORT.with(|t| {
        let mut t = t.borrow_mut();
        if t.inputs.len() >= 8 {
            return 0;
        }
        let bytes = vec![0; len as usize].into_boxed_slice();
        let ptr = bytes.as_ptr() as usize as u32;
        t.inputs.insert(ptr, bytes);
        ptr
    })
}
#[no_mangle]
pub extern "C" fn wf_input_free(ptr: u32, len: u32) -> u32 {
    TRANSPORT.with(|t| {
        let mut t = t.borrow_mut();
        if !t.inputs.get(&ptr).is_some_and(|b| b.len() == len as usize) {
            return 0;
        }
        t.inputs.remove(&ptr);
        1
    })
}
#[no_mangle]
pub extern "C" fn wf_combat_call(ptr: u32, len: u32) -> u32 {
    TRANSPORT.with(|t| { let mut t=t.borrow_mut();
        if !t.responses.available() { return 0; }
        let mut request_id=None;
        let mut stepping=None;
        let mut created=None;
        let result=(|| {
            let bytes=t.inputs.get(&ptr).filter(|b|b.len()==len as usize).ok_or_else(||error("invalid_pointer","input","expected exact registered pointer and length",None))?;
            let utf8=std::str::from_utf8(bytes).map_err(|_|error("invalid_utf8","input","input is not UTF-8",None))?;
            let value:Value=serde_json::from_str(utf8).map_err(|_|error("invalid_json","input","input is not JSON",None))?;
            request_id=value.get("request_id").and_then(Value::as_str).map(str::to_owned);
            let envelope:Envelope=serde_json::from_value(value).map_err(|e|error("invalid_input","envelope",&e.to_string(),None))?;
            if envelope.schema.major!=1 || envelope.schema.minor!=0 { return Err(error("unsupported_schema","schema","expected version 1.0",None)); }
            request_id=Some(envelope.request_id);
            if let Operation::Step { world, .. } = &envelope.operation { stepping=Some(*world); }
            let result=t.execute(envelope.operation)?;
            if let Some(world)=result.get("world").and_then(Value::as_u64) { created=Some(world as u32); }
            Ok(result)
        })();
        let value=match result { Ok(result)=>json!({"schema":SCHEMA,"request_id":request_id,"ok":true,"result":result,"error":null}), Err(error)=>json!({"schema":SCHEMA,"request_id":request_id,"ok":false,"result":null,"error":error}) };
        let bytes=serde_json::to_vec(&value).expect("JSON values serialize");
        let bytes=if bytes.len()>MAX_RESPONSE {
            // Serialization size is checked before exposing any bytes; affected worlds become unusable.
            if let Some(id)=created { t.worlds.remove(id); }
            if let Some(w)=stepping.and_then(|id|t.worlds.get_mut(id)) { w.state="faulted"; }
            serde_json::to_vec(&json!({"schema":SCHEMA,"request_id":request_id,"ok":false,"result":null,"error":error("capacity_fault","response","response exceeds byte limit; restart encounter",None)})).expect("error serializes")
        } else { bytes };
        t.responses.insert(bytes.into_boxed_slice()).unwrap_or(0)
    })
}
#[no_mangle]
pub extern "C" fn wf_response_ptr(response: u32) -> u32 {
    TRANSPORT.with(|t| {
        t.borrow()
            .responses
            .get(response)
            .map_or(0, |b| b.as_ptr() as usize as u32)
    })
}
#[no_mangle]
pub extern "C" fn wf_response_len(response: u32) -> u32 {
    TRANSPORT.with(|t| {
        t.borrow()
            .responses
            .get(response)
            .map_or(0, |b| b.len() as u32)
    })
}
#[no_mangle]
pub extern "C" fn wf_response_free(response: u32) -> u32 {
    TRANSPORT.with(|t| u32::from(t.borrow_mut().responses.remove(response).is_some()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn generation_rejects_stale_and_double_free() {
        let mut r = Registry::new(1);
        let first = r.insert(7).unwrap();
        assert_eq!(r.remove(first), Some(7));
        let second = r.insert(8).unwrap();
        assert_ne!(first, second);
        assert!(r.get(first).is_none());
        assert!(r.remove(first).is_none());
        assert_eq!(r.get(second), Some(&8));
    }
    #[test]
    fn generation_never_wraps() {
        let mut r = Registry::new(1);
        r.slots[0].generation = u16::MAX;
        let id = r.insert(1).unwrap();
        assert_eq!(r.remove(id), Some(1));
        assert!(!r.available());
        assert!(r.insert(2).is_none());
    }
}
