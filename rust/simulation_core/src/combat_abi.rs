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
const SCHEMA: Version = Version { major: 1, minor: 1 };
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
    #[serde(default)]
    contain_bodies: bool,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StatInput {
    #[serde(default)]
    mag: Option<f32>,
    #[serde(default)]
    res: Option<f32>,
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
            mag: self.mag.unwrap_or(self.atk),
            res: self.res.unwrap_or(self.def),
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
            self.mag.unwrap_or(self.atk),
            self.res.unwrap_or(self.def),
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
fn one() -> f32 { 1. }
#[derive(Clone, Copy, Deserialize)]
#[serde(deny_unknown_fields)]
struct SkillModifiers {
    #[serde(default = "one")]
    special_potency: f32,
    #[serde(default = "one")]
    meter_rate: f32,
}
impl Default for SkillModifiers { fn default() -> Self { Self { special_potency: 1., meter_rate: 1. } } }
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PermanentCommand {
    encounter_id: String,
    step: String,
    sequence: String,
    body: PermanentBody,
}
#[derive(Deserialize)]
#[serde(tag = "kind", content = "data", rename_all = "snake_case", deny_unknown_fields)]
enum PermanentBody {
    ReplacePermanentInputs {
        actor: u32,
        expected_revision: String,
        revision: String,
        stats: StatInput,
        host_max_hp: f32,
        #[serde(default)]
        skill_modifiers: SkillModifiers,
    },
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct HeroInput {
    #[serde(default)]
    skill_modifiers: SkillModifiers,
    instance_id: String,
    definition_id: String,
    slot: u8,
    #[serde(default)]
    host_max_hp: Option<f32>,
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
    #[serde(default)]
    wfm_magic: Option<f32>,
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
    #[serde(default)]
    continuous: bool,
    #[serde(default)]
    spawn_markers: bool,
    encounter_id: String,
    seed: String,
    geometry: GeometryInput,
    heroes: Vec<HeroInput>,
    enemies: Vec<EnemyInput>,
}
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
enum EndReason {
    HostStageTransition,
    HostTimeout,
    AllDownRouted,
}
impl EndReason {
    fn name(self) -> &'static str {
        match self {
            Self::HostStageTransition => "host_stage_transition",
            Self::HostTimeout => "host_timeout",
            Self::AllDownRouted => "all_down_routed",
        }
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StepRequest {
    #[serde(default)]
    commands: Vec<PermanentCommand>,
    #[serde(default)]
    end_encounter: Option<EndReason>,
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
    Ack { world: u32, encounter_id: String, sequence: String },
    Inspect {
        world: u32,
        events_after: String,
    },
    Spawn {
        world: u32,
        encounter_id: String,
        enemies: Vec<EnemyInput>,
    },
    WaveChest { world: u32, encounter_id: String },
    OrdinaryClear {
        world: u32,
        encounter_id: String,
        transition_id: String,
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
    command_sequence: u64,
    encounter_id: String,
    state: &'static str,
    continuous: bool,
    spawn_markers: bool,
    pending_spawns: Vec<(u32, Archetype, String, Vec2, Stats, f32, Option<f32>)>,
    host_max_hp: BTreeMap<u32, f32>,
    ordinary_clears: std::collections::BTreeSet<String>,
    events: Vec<Value>,
    acknowledged_sequence: u64,
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
                "capabilities":["headless_slice_v1","initial_enemies","events_after","ack_events_v1","spawn_enemies","end_encounter","wfm_enemies","autonomous_phoenix","wave_chest","replace_permanent_inputs_v1"],
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
            Operation::WaveChest { world, encounter_id } => {
                let w = self.worlds.get_mut(world).ok_or_else(bad_world)?;
                if encounter_id != w.encounter_id || !w.continuous || w.state != "running"
                    || !w.pending_spawns.is_empty() || w.sim.actors.iter().any(|a| a.view.team == Team::Enemy && a.alive()) {
                    return Err(error("invalid_transition", "wave_chest", "Chest requires an empty ordinary wave", Some(w.sim.step_number)));
                }
                if w.sim.chests.is_empty() { w.sim.drop_wave_chest(); }
                Ok(w.result(w.events.len()))
            }
            Operation::OrdinaryClear {
                world,
                encounter_id,
                transition_id,
            } => {
                let w = self.worlds.get_mut(world).ok_or_else(bad_world)?;
                if encounter_id != w.encounter_id
                    || !w.continuous
                    || w.state != "running"
                    || transition_id.is_empty()
                    || transition_id.len() > 256
                    || !w.pending_spawns.is_empty()
                    || w.sim
                        .actors
                        .iter()
                        .any(|a| a.view.team == Team::Enemy && a.alive())
                {
                    return Err(error(
                        "invalid_transition",
                        "ordinary_clear",
                        "WFM respite requires a cleared ordinary wave",
                        Some(w.sim.step_number),
                    ));
                }
                let after = w.events.len();
                if w.ordinary_clears.insert(transition_id) {
                    for a in w
                        .sim
                        .actors
                        .iter_mut()
                        .filter(|a| a.view.team == Team::Hero && a.alive())
                    {
                        let max = w.host_max_hp[&a.view.id];
                        let heal = ((f64::from(max) * 0.15).ceil() as f32) / max * a.view.max_hp;
                        let before = a.view.hp;
                        a.view.hp = (before + heal).min(a.view.max_hp);
                        if a.view.hp > before {
                            w.sim.events.push(Event::Healed {
                                target: a.view.id,
                                amount: a.view.hp - before,
                                source: HealSource::PartyRestore,
                            });
                        }
                    }
                    w.collect();
                    w.sim.refresh_snapshot();
                }
                Ok(w.result(after))
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
            Operation::Ack { world, encounter_id, sequence } => {
                let w = self.worlds.get_mut(world).ok_or_else(bad_world)?;
                let sequence = decimal(&sequence, "operation.data.sequence")?;
                let last = w.acknowledged_sequence + w.events.len() as u64;
                if encounter_id != w.encounter_id || sequence < w.acknowledged_sequence || sequence > last {
                    return Err(error("invalid_cursor", "sequence", "invalid acknowledgement cursor", Some(w.sim.step_number)));
                }
                w.events.drain(..(sequence - w.acknowledged_sequence) as usize);
                w.acknowledged_sequence = sequence;
                Ok(json!({"acknowledged_sequence": sequence.to_string()}))
            }
            Operation::Inspect {
                world,
                events_after,
            } => {
                let w = self.worlds.get(world).ok_or_else(bad_world)?;
                let after = decimal(&events_after, "operation.data.events_after")?;
                if after < w.acknowledged_sequence || after > w.acknowledged_sequence + w.events.len() as u64 {
                    return Err(error(
                        "invalid_cursor",
                        "events_after",
                        "cursor is beyond the event stream",
                        Some(w.sim.step_number),
                    ));
                }
                Ok(w.result((after - w.acknowledged_sequence) as usize))
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
                let revisions = w.validate_revisions(&request)?;
                if let Some(reason) = request.end_encounter {
                    if w.state == "host_ended" {
                        return Err(error(
                            "terminal",
                            "world",
                            "encounter is terminal",
                            Some(w.sim.step_number),
                        ));
                    }
                    let after = w.events.len();
                    w.sim.step_number += 1;
                    w.sim.cancel_phoenix();
                    let actors: Vec<_> = w.sim.actors.iter().map(|a| a.view.id).collect();
                    for id in actors {
                        w.event(
                            json!({"kind":"despawned","data":{"actor":id,"reason":reason.name()}}),
                        );
                    }
                    w.sim.actors.clear();
                    w.sim.hazards.clear();
                    w.sim.projectiles.clear();
                    w.sim.encounter.complete = true;
                    w.state = "host_ended";
                    w.sim.refresh_snapshot();
                    w.event(json!({"kind":"ended","data":{"reason":reason.name()}}));
                    return Ok(w.result(after));
                }
                if w.state != "running" {
                    return Err(error(
                        "terminal",
                        "world",
                        "encounter is terminal",
                        Some(w.sim.step_number),
                    ));
                }
                // Reserve a complete tick; only acknowledged events can be pruned.
                if w.events.len() >= MAX_EVENTS / 2 {
                    return Err(error(
                        "event_backpressure",
                        "events",
                        "retained event capacity requires acknowledgement",
                        Some(w.sim.step_number),
                    ));
                }
                let after = w.events.len();
                w.sim.replace_permanent_inputs(&revisions.iter().map(|r| r.0).collect::<Vec<_>>())
                    .map_err(|message| error("revision_conflict", "request.commands", message, Some(w.sim.step_number)))?;
                for (input, host_max) in &revisions { w.host_max_hp.insert(input.actor, *host_max); }
                w.command_sequence += revisions.len() as u64;
                if w.continuous {
                    // Actors were created in party-slot order, never saved formation-cell order.
                    if let Some(id) = w
                        .sim
                        .phoenix
                        .hero
                        .filter(|id| {
                            w.sim
                                .actors
                                .iter()
                                .any(|a| a.view.id == *id && a.view.state == ActorState::Downed)
                        })
                        .or_else(|| {
                            w.sim
                                .actors
                                .iter()
                                .find(|a| {
                                    a.view.team == Team::Hero && a.view.state == ActorState::Downed
                                })
                                .map(|a| a.view.id)
                        })
                    {
                        w.sim.phoenix_hold(id);
                    }
                }
                w.sim.step();
                for (index, (input, _)) in revisions.iter().enumerate() {
                    w.event(json!({"kind":"permanent_inputs_applied","data":{"actor":input.actor,
                        "revision":input.revision.to_string(),"sequence":(w.command_sequence - revisions.len() as u64 + index as u64 + 1).to_string()}}));
                }
                for (marker, kind, id, point, stats, hp, magic) in std::mem::take(&mut w.pending_spawns) {
                    if w.sim.hazards.iter().any(|h| h.view.id == marker && h.view.phase != HazardPhase::Resolved) {
                        w.pending_spawns.push((marker, kind, id, point, stats, hp, magic));
                    } else {
                        w.sim.spawn_actor(kind, point, stats);
                        let actor = w.sim.actors.last_mut().unwrap();
                        actor.begin_spawn(); actor.view.hp = hp; actor.stats.mag = magic.unwrap_or(stats.mag);
                        w.host_ids.insert(actor.view.id, id);
                    }
                }
                w.sim.refresh_snapshot();
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
        "wfm.enemy.high_gobloc" => Archetype::WfmHighGobloc,
        "wfm.enemy.skeleton" => Archetype::WfmSkeleton,
        "wfm.enemy.chimerilass" => Archetype::WfmChimerilass,
        "wfm.enemy.djinn" => Archetype::WfmDjinn,
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
            || (g.contain_bodies
                && (floor.max.x - floor.min.x < 352. || floor.max.y - floor.min.y < 410.))
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
            if h.host_max_hp
                .is_some_and(|hp| !hp.is_finite() || hp <= 0. || hp > 1_000_000.)
            {
                return Err(invalid("config.heroes.host_max_hp"));
            }
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
            if e.wfm_magic
                .is_some_and(|v| !v.is_finite() || !(0. ..=1_000_000.).contains(&v))
            {
                return Err(invalid("config.enemies.wfm_magic"));
            }
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
        sim.contain_bodies = g.contain_bodies;
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
        let mut pending_spawns = Vec::new();
        let mut host_ids = BTreeMap::new();
        for (k, id, p, stats, hp) in spawns {
            if c.spawn_markers && hero_index(k).is_none() && !wf_combat::tuning::is_boss(k) {
                sim.hazard(HazardKind::SpawnMarker, 0, None, p, Vec2::new(0., -1.));
                let marker = sim.hazards.last().unwrap().view.id;
                let magic = c.enemies.iter().find(|e| e.spawn_key == id).and_then(|e| e.wfm_magic);
                pending_spawns.push((marker, k, id.to_owned(), p, stats.resolved(), hp, magic));
                continue;
            }
            sim.spawn_actor(k, p, stats.resolved());
            let actor = sim.actors.last_mut().unwrap();
            actor.view.hp = hp;
            host_ids.insert(actor.view.id, id.to_owned());
        }
        let mut host_max_hp = BTreeMap::new();
        for (actor, hero) in sim.actors.iter_mut().zip(&heroes) {
            let modifiers = hero.skill_modifiers;
            let check = permanent::PermanentInputs { actor: actor.view.id, expected_revision: 0, revision: 1,
                stats: hero.stats.resolved(), special_potency: modifiers.special_potency, meter_rate: modifiers.meter_rate };
            if !check.valid() { return Err(invalid("config.heroes.skill_modifiers")); }
            actor.special_potency = modifiers.special_potency;
            actor.meter_rate = modifiers.meter_rate;
            host_max_hp.insert(actor.view.id, hero.host_max_hp.unwrap_or(hero.stats.hp));
            actor.formation_offset = hero.formation_offset.into();
        }
        for enemy in &c.enemies {
            if let Some(magic) = enemy.wfm_magic {
                let actor = sim
                    .actors
                    .iter_mut()
                    .find(|a| {
                        host_ids
                            .get(&a.view.id)
                            .is_some_and(|id| id == &enemy.spawn_key)
                    })
                    ;
                if let Some(actor) = actor { actor.stats.mag = magic; }
            }
        }
        sim.deaths();
        sim.refresh_snapshot();
        let mut w = Self {
            sim,
            command_sequence: 0,
            encounter_id: c.encounter_id,
            state: "running",
            continuous: c.continuous,
            spawn_markers: c.spawn_markers,
            pending_spawns,
            host_max_hp,
            ordinary_clears: std::collections::BTreeSet::new(),
            events: Vec::new(),
            acknowledged_sequence: 0,
            identities,
            host_ids,
        };
        w.collect();
        Ok(w)
    }
    fn validate_revisions(&self, request: &StepRequest) -> Result<Vec<(permanent::PermanentInputs, f32)>, Value> {
        let invalid = || error("invalid_input", "request.commands", "invalid permanent-input command batch", Some(self.sim.step_number));
        if request.commands.len() > 4 || (request.end_encounter.is_some() && !request.commands.is_empty()) { return Err(invalid()); }
        request.commands.iter().enumerate().map(|(index, command)| {
            if command.encounter_id != self.encounter_id
                || decimal(&command.step, "command.step")? != self.sim.step_number + 1
                || decimal(&command.sequence, "command.sequence")? != self.command_sequence + index as u64 + 1 { return Err(invalid()); }
            let PermanentBody::ReplacePermanentInputs { actor, expected_revision, revision, stats, host_max_hp, skill_modifiers } = &command.body;
            if !stats.valid() || !host_max_hp.is_finite() || *host_max_hp <= 0. || *host_max_hp > 1_000_000. { return Err(invalid()); }
            Ok((permanent::PermanentInputs { actor: *actor,
                expected_revision: decimal(expected_revision, "command.expected_revision")?,
                revision: decimal(revision, "command.revision")?, stats: stats.resolved(),
                special_potency: skill_modifiers.special_potency, meter_rate: skill_modifiers.meter_rate }, *host_max_hp))
        }).collect()
    }
    fn spawn(&mut self, encounter_id: &str, enemies: Vec<EnemyInput>) -> Result<Value, Value> {
        if !self.sim.chests.is_empty() && !self.sim.wave_chest_ready() {
            return Err(error("invalid_transition", "spawn.chest", "Chest pause has not finished", Some(self.sim.step_number)));
        }

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
            || self.sim.actors.len() + self.pending_spawns.len() + enemies.len() > MAX_ENEMIES + 4
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
                || e.wfm_magic
                    .is_some_and(|v| !v.is_finite() || !(0. ..=1_000_000.).contains(&v))
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
            batch.push((
                k,
                e.spawn_key.clone(),
                p,
                e.stats.resolved(),
                e.hp,
                e.wfm_magic,
            ));
        }
        self.identities = identities;
        self.state = "running";
        self.sim.encounter.complete = false;
        self.sim.chests.clear();
        self.sim.chest_opener = None; self.sim.chest_approach = None;
        let after = self.events.len();
        for (k, id, p, stats, hp, magic) in batch {
            if self.spawn_markers && !wf_combat::tuning::is_boss(k) {
                self.sim.hazard(HazardKind::SpawnMarker, 0, None, p, Vec2::new(0., -1.));
                let marker = self.sim.hazards.last().unwrap().view.id;
                self.pending_spawns.push((marker, k, id, p, stats, hp, magic));
                continue;
            }
            self.sim.spawn_actor(k, p, stats);
            let actor = self.sim.actors.last_mut().unwrap();
            actor.view.hp = hp;
            actor.stats.mag = magic.unwrap_or(stats.mag);
            self.host_ids.insert(actor.view.id, id);
        }
        self.sim.deaths();
        self.sim.refresh_snapshot();
        self.collect();
        Ok(self.result(after))
    }
    fn event(&mut self, body: Value) {
        self.events.push(json!({"schema":SCHEMA,"encounter_id":self.encounter_id,"step":self.sim.step_number.to_string(),"combat_step":self.sim.combat_steps.to_string(),"sequence":(self.acknowledged_sequence+self.events.len() as u64+1).to_string(),"body":body}));
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
                Event::Died { id } => {
                    let actor = self.sim.actors.iter().find(|a| a.view.id == id).expect("death actor retained");
                    json!({"kind":"died","data":{"actor":id,"team":if actor.view.team==Team::Enemy {"enemy"} else {"hero"},"reason":"combat","host_id":self.host_ids.get(&id)}})
                },
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
            } else if !self.continuous
                && !self
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
    fn gameplay_hash(&self) -> u64 {
        let mut hash = wf_combat::snapshot::Hash(self.sim.state_hash());
        hash.u(0x484f5354494e5055);
        hash.u(self.command_sequence);
        hash.b(self.continuous);
        for byte in self.state.bytes() { hash.u(byte as u64); }
        hash.u(self.host_max_hp.len() as u64);
        for (actor, max) in &self.host_max_hp { hash.u(*actor as u64); hash.f(*max); }
        hash.u(self.identities.len() as u64);
        for identity in &self.identities {
            hash.u(identity.len() as u64);
            for byte in identity.bytes() { hash.u(byte as u64); }
        }
        hash.u(self.ordinary_clears.len() as u64);
        for receipt in &self.ordinary_clears {
            hash.u(receipt.len() as u64);
            for byte in receipt.bytes() { hash.u(byte as u64); }
        }
        if self.spawn_markers {
            hash.u(0x454e545259);
            for (marker, kind, id, p, stats, hp, magic) in &self.pending_spawns {
                hash.u(*marker as u64); hash.u(*kind as u64); hash.v(*p);
                for byte in id.bytes() { hash.u(byte as u64); }
                for v in [stats.hp,stats.atk,stats.def,stats.mag,stats.res,stats.speed,stats.reach,stats.interval,stats.evade,stats.special,*hp,magic.unwrap_or(stats.mag)] { hash.f(v); }
            }
        }
        hash.0
    }
    fn result(&self, after: usize) -> Value {
        let actors:Vec<_> = self.sim.actors.iter().map(|a|json!({"actor_id":a.view.id,"permanent_revision":a.permanent_revision.to_string(),"host_id":self.host_ids.get(&a.view.id),"stats":{"atk":a.stats.atk,"def":a.stats.def,"mag":a.stats.mag,"res":a.stats.res},"state":format!("{:?}",a.view.state).to_lowercase(),"state_age":a.view.state_age,"state_duration":a.view.state_duration,"impact_at":a.view.impact_at,"facing":format!("{:?}",a.view.facing).to_lowercase(),"ward":a.view.ward,"warcry_shield":a.view.warcry_shield,"energy":a.view.energy,"enraged":a.view.enraged,"radius":a.view.radius,"target":a.view.target,"encased":a.view.encased,"poisoned":a.view.poisoned,"slowed":a.view.slowed,"taunted_by":a.view.taunted_by,"groove_active":a.view.groove_active,"groove":a.view.groove.map(|g|format!("{g:?}").to_lowercase()),"meter":a.view.meter,"special_casting":a.view.special_casting,"elevate":a.view.elevate.map(|v| format!("{v:?}").to_lowercase()),"scale":a.view.scale,"kind":a.view.archetype,"team":if a.view.team==Team::Hero {"hero"} else {"enemy"},"pos":{"x":a.view.pos.x,"y":a.view.pos.y},"hp":a.view.hp,"max_hp":a.view.max_hp,"downed":a.view.state==ActorState::Downed})).collect();
        let hazards: Vec<_> = self.sim.snapshot().hazards.iter().map(|h| {
            let shape = match h.shape {
                Shape::Circle { radius } => json!({"kind":"circle","radius":radius}),
                Shape::Ring { inner, outer } => json!({"kind":"ring","inner":inner,"outer":outer}),
                Shape::Cone { length, half_angle_rad } => json!({"kind":"cone","length":length,"half_angle_rad":half_angle_rad}),
                Shape::Line { length, width } => json!({"kind":"line","length":length,"width":width}),
            };
            json!({"id":h.id,"kind":h.kind,"owner":h.owner,"team":if h.team==Team::Hero {"hero"} else {"enemy"},"phase":format!("{:?}",h.phase).to_lowercase(),"progress":h.progress,"width_scale":h.width_scale,"tier":h.tier,"fill":format!("{:?}",h.fill).to_lowercase(),"hostile":h.hostile,"origin":{"x":h.origin.x,"y":h.origin.y},"dir":{"x":h.dir.x,"y":h.dir.y},"shape":shape})
        }).collect();
        json!({"snapshot":{"pending_spawns":self.pending_spawns.iter().map(|(marker,_,id,p,_,_,_)|json!({"marker":marker,"host_id":id,"pos":{"x":p.x,"y":p.y}})).collect::<Vec<_>>(),"chest":self.sim.chests.first().map(|c|json!({"id":c.id,"pos":{"x":c.pos.x,"y":c.pos.y},"state":format!("{:?}",c.state).to_lowercase(),"state_age":c.state_age,"age":c.age,"ready":self.sim.wave_chest_ready(),"rewards":[]})),"time":self.sim.snapshot().time,"combat_time":self.sim.snapshot().combat_time,"phoenix_cooldown":self.sim.snapshot().phoenix_cooldown,"phoenix_channel":self.sim.snapshot().phoenix_channel.map(|v|json!({"hero":v.hero,"progress":v.progress})),"hit_stop":self.sim.snapshot().hit_stop.map(|h|json!({"cause":format!("{:?}",h.cause).to_lowercase(),"actor":h.actor,"remaining":h.remaining})),"spotlight":self.sim.snapshot().spotlight.as_ref().map(|v|json!({"caster":v.caster,"skill":v.skill,"phase":format!("{:?}",v.phase).to_lowercase(),"started":v.started,"participants":v.participants,"co_casters":v.co_casters,"projectiles":v.projectiles,"hazards":v.hazards})),"hazards":hazards,"projectiles":self.sim.snapshot().projectiles.iter().map(|p|json!({"id":p.id,"kind":format!("{:?}",p.kind).to_lowercase(),"team":if p.team==Team::Hero {"hero"} else {"enemy"},"pos":{"x":p.pos.x,"y":p.pos.y},"height":p.height,"dir":{"x":p.dir.x,"y":p.dir.y}})).collect::<Vec<_>>(),"camera_focus":{"x":self.sim.snapshot().camera_focus.x,"y":self.sim.snapshot().camera_focus.y},"schema":SCHEMA,"encounter_id":self.encounter_id,"step":self.sim.step_number.to_string(),"combat_steps":self.sim.combat_steps.to_string(),"state":self.state,"actors":actors,"live_enemies":self.pending_spawns.len()+self.sim.actors.iter().filter(|a|a.view.team==Team::Enemy && a.alive()).count(),"last_event_sequence":(self.acknowledged_sequence+self.events.len() as u64).to_string(),"acknowledged_event_sequence":self.acknowledged_sequence.to_string(),"gameplay_hash":format!("{:016x}",self.gameplay_hash()),"geometry":{"floor":{"min":{"x":self.sim.floor.min.x,"y":self.sim.floor.min.y},"max":{"x":self.sim.floor.max.x,"y":self.sim.floor.max.y}}}},"events":&self.events[after..]})
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
            if envelope.schema.major!=1 || envelope.schema.minor>1 { return Err(error("unsupported_schema","schema","expected schema 1.0 or 1.1",None)); }
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
    fn accepted_host_maximum_and_command_receipts_affect_gameplay_hash() {
        let fixture: Value = serde_json::from_str(include_str!("../tests/permanent_revision_scenario.json")).unwrap();
        let make = || World::create(serde_json::from_value(fixture["config"].clone()).unwrap());
        let mut first = make().unwrap();
        let mut second = make().unwrap();
        assert_eq!(first.gameplay_hash(), second.gameplay_hash());
        first.host_max_hp.insert(1, 10.);
        second.host_max_hp.insert(1, 11.);
        assert_ne!(first.gameplay_hash(), second.gameplay_hash());
        second.host_max_hp.insert(1, 10.);
        assert_eq!(first.gameplay_hash(), second.gameplay_hash());
        second.command_sequence = 1;
        assert_ne!(first.gameplay_hash(), second.gameplay_hash());
        second.command_sequence = 0;
        second.ordinary_clears.insert("clear-1".into());
        assert_ne!(first.gameplay_hash(), second.gameplay_hash());
    }
    #[test]
    fn native_revision_trace() {
        let fixture: Value = serde_json::from_str(include_str!("../tests/permanent_revision_scenario.json")).unwrap();
        let mut transport = Transport::new();
        let created = transport.execute(serde_json::from_value(json!({"kind":"create","data":{"config":fixture["config"]}})).unwrap()).unwrap();
        let world = created["world"].as_u64().unwrap();
        let mut trace = vec![created];
        for step in 0..12 {
            let result = transport.execute(serde_json::from_value(json!({"kind":"step","data":{"world":world,"request":{
                "encounter_id":"permanent-parity","expected_previous_step":step.to_string(),
                "commands":if step==0 { fixture["commands"].clone() } else { json!([]) }
            }}})).unwrap()).unwrap();
            trace.push(result);
        }
        assert_eq!(trace[1]["snapshot"]["actors"][0]["max_hp"],700.);
        assert_eq!(trace[1]["snapshot"]["actors"][0]["hp"],480.);
        if let Ok(path) = std::env::var("WF_REVISION_PARITY_OUTPUT") {
            std::fs::write(path,serde_json::to_vec(&trace).unwrap()).unwrap();
        }
    }
    #[test]
    fn revision_batch_validation_is_atomic_before_step_or_rng() {
        let fixture: Value = serde_json::from_str(include_str!("../tests/permanent_revision_scenario.json")).unwrap();
        let mut t=Transport::new();
        let created=t.execute(serde_json::from_value(json!({"kind":"create","data":{"config":fixture["config"]}})).unwrap()).unwrap();
        let world=created["world"].as_u64().unwrap() as u32;
        let before=t.worlds.get(world).unwrap().result(0);
        let good=fixture["commands"][0].clone();
        for failure in ["duplicate","actor","step","sequence","host_max","revision"] {
            let mut bad=good.clone();
            match failure {
                "actor"=>bad["body"]["data"]["actor"]=json!(999),
                "step"=>bad["step"]=json!("2"),
                "sequence"=>bad["sequence"]=json!("2"),
                "host_max"=>bad["body"]["data"]["host_max_hp"]=json!(0),
                "revision"=>bad["body"]["data"]["revision"]=json!("0"),
                _=>{},
            }
            let commands=if failure=="duplicate" { json!([good,bad]) } else { json!([bad]) };
            let result=t.execute(serde_json::from_value(json!({"kind":"step","data":{"world":world,"request":{
                "encounter_id":"permanent-parity","expected_previous_step":"0","commands":commands
            }}})).unwrap());
            assert!(result.is_err(),"{failure}"); assert_eq!(t.worlds.get(world).unwrap().result(0),before,"{failure}");
        }
    }
    #[test]
    fn event_backpressure_is_atomic_and_ack_releases_capacity() {
        let fixture: Value = serde_json::from_str(include_str!("../tests/permanent_revision_scenario.json")).unwrap();
        let mut t = Transport::new();
        let created = t.execute(serde_json::from_value(json!({"kind":"create","data":{"config":fixture["config"]}})).unwrap()).unwrap();
        let world = created["world"].as_u64().unwrap() as u32;
        let w = t.worlds.get_mut(world).unwrap();
        while w.events.len() < MAX_EVENTS / 2 { w.event(json!({"kind":"presentation","data":{}})); }
        let before = w.result(0);
        let step = || Operation::Step { world, request: serde_json::from_value(json!({"encounter_id":"permanent-parity","expected_previous_step":"0"})).unwrap() };
        assert_eq!(t.execute(step()).unwrap_err()["code"], "event_backpressure");
        assert_eq!(t.worlds.get(world).unwrap().result(0), before);
        let last = (MAX_EVENTS / 2) as u64;
        assert!(t.execute(Operation::Ack { world, encounter_id:"permanent-parity".into(), sequence:(last+1).to_string() }).is_err());
        t.execute(Operation::Ack { world, encounter_id:"permanent-parity".into(), sequence:last.to_string() }).unwrap();
        let w = t.worlds.get(world).unwrap();
        assert!(w.events.is_empty());
        assert_eq!(w.result(0)["snapshot"]["gameplay_hash"], before["snapshot"]["gameplay_hash"]);
        assert!(t.execute(Operation::Inspect { world, events_after:"0".into() }).is_err());
        let after = t.execute(step()).unwrap();
        assert_eq!(after["snapshot"]["step"], "1");
        assert_eq!(after["snapshot"]["acknowledged_event_sequence"], last.to_string());
        for e in after["events"].as_array().unwrap() { assert!(e["sequence"].as_str().unwrap().parse::<u64>().unwrap() > last); }
    }
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
