pub use wf_combat::api::*;
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum StagePhase {
    Lull,
    Spike,
    Boss,
    BossEscalation,
    Victory,
}

#[derive(Clone, Debug, PartialEq)]
pub struct StageView {
    pub phase: StagePhase,
    pub wave: u32,
    /// Seconds since stage start (resets on wipe).
    pub elapsed: f32,
    /// Seconds until the boss is forced in (max wait), 0 once arrived.
    pub boss_eta: f32,
    pub escalation_level: u32,
    pub wipes: u32,
    pub kills: u32,
    /// Mini-wave counter within the stage (1-based) and how many precede the boss.
    pub mini_wave: u32,
    pub mini_waves_total: u32,
    /// Boss/reward tier of the current stage (1..=3, cycling with stage scaling after 3).
    pub tier: u8,
    pub buffs: PartyBuffs,
    /// Screen darkness 0..1 during scene changes (wipe reset or boss-defeat advance).
    pub fade: f32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Reward {
    FullHeal,
    Attack,
    Defense,
    Range,
    AttackSpeed,
    /// Base-HP gain, capped by tuning; reset on wipe.
    MaxHp,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ChestState {
    /// Dropped on a wave clear; waiting for a hero to reach it.
    Closed,
    /// A hero is opening it (short).
    Opening,
    /// Opened; reward granted; lingers briefly then disappears.
    Open,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ChestView {
    pub id: u32,
    pub pos: Vec2,
    pub state: ChestState,
    /// Seconds since `state` was entered.
    pub state_age: f32,
    pub reward: Option<Reward>,
}

/// Party-wide multipliers from chests (1.0 = none). Reset on a wipe.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PartyBuffs {
    pub attack: f32,
    pub defense: f32,
    pub range: f32,
    pub attack_speed: f32,
}
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Scenario {
    /// The full vertical slice: director timeline, fodder, specials, in-arena boss.
    Slice,
    /// One hero, one hazard of `hazard` aimed at it from a seeded position; ends after resolution.
    /// Used by wf_bench to measure dodge-rate bands (ORKA-f1oq section 4).
    DodgeTrial { hazard: HazardKind, hero: Archetype },
}
#[derive(Clone, Debug, PartialEq)]
pub enum Event {
    /// A valid player hold began channeling a downed hero.
    PhoenixBegan {
        /// Downed recipient's actor ID.
        hero: u32,
    },
    /// Player channel completed; the normal Revived event also fires.
    PhoenixCompleted {
        /// Revived recipient's actor ID.
        hero: u32,
    },
    /// Player released, changed recipient, or the recipient stopped being downed; no cooldown spent.
    PhoenixCancelled {
        /// Former recipient's actor ID.
        hero: u32,
    },
    /// Every revived hero emits a defensive push/slow burst and gains damage immunity.
    ReviveBurst {
        /// Revived hero's actor ID.
        hero: u32,
        /// Burst centre at the revived hero's floor position.
        pos: Vec2,
        /// Burst radius in world units; enemy body radius participates in contact.
        radius: f32,
    },
    Spawned {
        id: u32,
        archetype: Archetype,
    },
    ActionStarted {
        id: u32,
        target: Option<u32>,
        state: ActorState,
    },
    Hit {
        source: u32,
        target: u32,
        amount: f32,
        crit: bool,
        element: Element,
        /// At least some of this hit was absorbed by ward.
        blocked: bool,
    },
    Evaded {
        source: u32,
        target: u32,
    },
    Healed {
        target: u32,
        amount: f32,
        source: HealSource,
    },
    WardGained {
        target: u32,
        amount: f32,
    },
    HazardSpawned {
        id: u32,
        kind: HazardKind,
    },
    HazardResolved {
        id: u32,
        kind: HazardKind,
        victims: Vec<u32>,
    },
    /// Hero noticed a hazard after its reaction delay (debug "!" cue).
    Noticed {
        id: u32,
        hazard: u32,
    },
    Downed {
        id: u32,
    },
    Revived {
        id: u32,
    },
    Died {
        id: u32,
    },
    WaveReset,
    BossArrived {
        id: u32,
    },
    Escalated {
        level: u32,
    },
    StageCleared,
    /// A mini-wave's spawn markers appeared; enemies follow after the marker countdown.
    WaveIncoming {
        mini_wave: u32,
        count: u32,
    },
    /// A boss crossed its phase threshold; its telegraphs are larger from now on.
    Enraged {
        id: u32,
    },
    ChestDropped {
        id: u32,
    },
    ChestOpened {
        id: u32,
        opener: u32,
        reward: Reward,
        tier: u8,
    },
    ResurrectStarted {
        reviver: u32,
        target: u32,
    },
    ResurrectInterrupted {
        reviver: u32,
        target: u32,
    },
    /// The screen is fully dark; the scene reset happens now (client clears bodies/effects).
    SceneReset,
    /// Hondo's Shadow: blink from `from` to `to` (behind `target`) before the strike lands.
    Blink {
        hero: u32,
        from: Vec2,
        to: Vec2,
        target: u32,
    },
    /// Fara's Taunt: every listed enemy now targets `hero` for `seconds` (bosses included).
    Taunt {
        hero: u32,
        radius: f32,
        enemies: Vec<u32>,
        seconds: f32,
    },
    /// A hero special skill activation (emitted for every activation, spotlit or not).
    SkillStarted {
        id: u32,
        skill: Skill,
        target: Option<u32>,
    },
    /// A boss switched its enmity target.
    AggroChanged {
        enemy: u32,
        from: Option<u32>,
        to: u32,
    },
    /// A boss shrugged off a hero push (50% roll): it held its ground.
    KnockbackResisted {
        id: u32,
    },
    /// A boss was pushed (50% roll); `interrupted` is true when its live self-anchored telegraph
    /// or wind-up was cancelled (it re-casts later from its new floor position).
    BossStaggered {
        id: u32,
        interrupted: bool,
    },
    /// A hazard was removed before resolving (no damage); the client fades it out quickly.
    HazardCancelled {
        id: u32,
        kind: HazardKind,
    },
    /// An enemy was trapped in a Bubble Aura bubble for `seconds`.
    Encased {
        id: u32,
        seconds: f32,
    },
    /// Boss heal-over-time began (Chimerilass regeneration): `total` HP over `seconds`.
    RegenStarted {
        id: u32,
        total: f32,
        seconds: f32,
    },
    SpotlightBegan {
        caster: u32,
        skill: Skill,
    },
    /// `cancelled`: ended early (caster lost, disabled, wipe/reset) rather than completed.
    SpotlightEnded {
        caster: u32,
        cancelled: bool,
    },
    /// Runa's Chain Strike II: the attack bounced from one enemy to the next.
    ChainHop {
        from: u32,
        to: u32,
    },
    /// Hondo's Split: one strike divided across every listed enemy (centre = the struck target).
    SplitStrike {
        hero: u32,
        center: Vec2,
        targets: Vec<u32>,
    },
    /// An enemy heal cast began (Marid, Chimerilass). `seconds` = cast duration. An interrupted
    /// cast emits the usual interruption event and no `EnemyHealed`.
    EnemyHealCast {
        healer: u32,
        target: u32,
        seconds: f32,
    },
    /// An enemy burst heal landed on `target` (the client draws the healer->target link).
    EnemyHealed {
        healer: u32,
        target: u32,
        amount: f32,
    },
    /// A hero spent special meter (`bars` in meter units) on `skill`.
    GrooveSpent {
        hero: u32,
        skill: Skill,
        bars: f32,
    },
    /// A groove effect started: Combo burst or Elevate power-up, lasting `seconds`.
    GrooveActivated {
        hero: u32,
        groove: Groove,
        seconds: f32,
    },
}
impl From<Event> for wf_combat::Event {
    fn from(e: Event) -> Self {
        match e {
            Event::PhoenixBegan { hero } => wf_combat::Event::PhoenixBegan { hero },
            Event::PhoenixCompleted { hero } => wf_combat::Event::PhoenixCompleted { hero },
            Event::PhoenixCancelled { hero } => wf_combat::Event::PhoenixCancelled { hero },
            Event::ReviveBurst { hero, pos, radius } => {
                wf_combat::Event::ReviveBurst { hero, pos, radius }
            }
            Event::Spawned { id, archetype } => wf_combat::Event::Spawned { id, archetype },
            Event::ActionStarted { id, target, state } => {
                wf_combat::Event::ActionStarted { id, target, state }
            }
            Event::Hit {
                source,
                target,
                amount,
                crit,
                element,
                blocked,
            } => wf_combat::Event::Hit {
                source,
                target,
                amount,
                crit,
                element,
                blocked,
            },
            Event::Evaded { source, target } => wf_combat::Event::Evaded { source, target },
            Event::Healed {
                target,
                amount,
                source,
            } => wf_combat::Event::Healed {
                target,
                amount,
                source,
            },
            Event::WardGained { target, amount } => wf_combat::Event::WardGained { target, amount },
            Event::HazardSpawned { id, kind } => wf_combat::Event::HazardSpawned { id, kind },
            Event::HazardResolved { id, kind, victims } => {
                wf_combat::Event::HazardResolved { id, kind, victims }
            }
            Event::Noticed { id, hazard } => wf_combat::Event::Noticed { id, hazard },
            Event::Downed { id } => wf_combat::Event::Downed { id },
            Event::Revived { id } => wf_combat::Event::Revived { id },
            Event::Died { id } => wf_combat::Event::Died { id },
            Event::WaveReset => wf_combat::Event::HostObservation {
                tag: 0,
                a: 0,
                b: 0,
                c: 0,
                d: 0,
            },
            Event::BossArrived { id } => wf_combat::Event::HostObservation {
                tag: 1,
                a: id as u32,
                b: 0,
                c: 0,
                d: 0,
            },
            Event::Escalated { level } => wf_combat::Event::HostObservation {
                tag: 2,
                a: level as u32,
                b: 0,
                c: 0,
                d: 0,
            },
            Event::StageCleared => wf_combat::Event::HostObservation {
                tag: 3,
                a: 0,
                b: 0,
                c: 0,
                d: 0,
            },
            Event::WaveIncoming { mini_wave, count } => wf_combat::Event::HostObservation {
                tag: 4,
                a: mini_wave as u32,
                b: count as u32,
                c: 0,
                d: 0,
            },
            Event::Enraged { id } => wf_combat::Event::Enraged { id },
            Event::ChestDropped { id } => wf_combat::Event::HostObservation {
                tag: 5,
                a: id as u32,
                b: 0,
                c: 0,
                d: 0,
            },
            Event::ChestOpened {
                id,
                opener,
                reward,
                tier,
            } => wf_combat::Event::HostObservation {
                tag: 6,
                a: id as u32,
                b: opener as u32,
                c: reward as u32,
                d: tier as u32,
            },
            Event::ResurrectStarted { reviver, target } => {
                wf_combat::Event::ResurrectStarted { reviver, target }
            }
            Event::ResurrectInterrupted { reviver, target } => {
                wf_combat::Event::ResurrectInterrupted { reviver, target }
            }
            Event::SceneReset => wf_combat::Event::HostObservation {
                tag: 7,
                a: 0,
                b: 0,
                c: 0,
                d: 0,
            },
            Event::Blink {
                hero,
                from,
                to,
                target,
            } => wf_combat::Event::Blink {
                hero,
                from,
                to,
                target,
            },
            Event::Taunt {
                hero,
                radius,
                enemies,
                seconds,
            } => wf_combat::Event::Taunt {
                hero,
                radius,
                enemies,
                seconds,
            },
            Event::SkillStarted { id, skill, target } => {
                wf_combat::Event::SkillStarted { id, skill, target }
            }
            Event::AggroChanged { enemy, from, to } => {
                wf_combat::Event::AggroChanged { enemy, from, to }
            }
            Event::KnockbackResisted { id } => wf_combat::Event::KnockbackResisted { id },
            Event::BossStaggered { id, interrupted } => {
                wf_combat::Event::BossStaggered { id, interrupted }
            }
            Event::HazardCancelled { id, kind } => wf_combat::Event::HazardCancelled { id, kind },
            Event::Encased { id, seconds } => wf_combat::Event::Encased { id, seconds },
            Event::RegenStarted { id, total, seconds } => {
                wf_combat::Event::RegenStarted { id, total, seconds }
            }
            Event::SpotlightBegan { caster, skill } => {
                wf_combat::Event::SpotlightBegan { caster, skill }
            }
            Event::SpotlightEnded { caster, cancelled } => {
                wf_combat::Event::SpotlightEnded { caster, cancelled }
            }
            Event::ChainHop { from, to } => wf_combat::Event::ChainHop { from, to },
            Event::SplitStrike {
                hero,
                center,
                targets,
            } => wf_combat::Event::SplitStrike {
                hero,
                center,
                targets,
            },
            Event::EnemyHealCast {
                healer,
                target,
                seconds,
            } => wf_combat::Event::EnemyHealCast {
                healer,
                target,
                seconds,
            },
            Event::EnemyHealed {
                healer,
                target,
                amount,
            } => wf_combat::Event::EnemyHealed {
                healer,
                target,
                amount,
            },
            Event::GrooveSpent { hero, skill, bars } => {
                wf_combat::Event::GrooveSpent { hero, skill, bars }
            }
            Event::GrooveActivated {
                hero,
                groove,
                seconds,
            } => wf_combat::Event::GrooveActivated {
                hero,
                groove,
                seconds,
            },
        }
    }
}
impl From<wf_combat::Event> for Event {
    fn from(e: wf_combat::Event) -> Self {
        match e {
            wf_combat::Event::PhoenixBegan { hero } => Event::PhoenixBegan { hero },
            wf_combat::Event::PhoenixCompleted { hero } => Event::PhoenixCompleted { hero },
            wf_combat::Event::PhoenixCancelled { hero } => Event::PhoenixCancelled { hero },
            wf_combat::Event::ReviveBurst { hero, pos, radius } => {
                Event::ReviveBurst { hero, pos, radius }
            }
            wf_combat::Event::Spawned { id, archetype } => Event::Spawned { id, archetype },
            wf_combat::Event::ActionStarted { id, target, state } => {
                Event::ActionStarted { id, target, state }
            }
            wf_combat::Event::Hit {
                source,
                target,
                amount,
                crit,
                element,
                blocked,
            } => Event::Hit {
                source,
                target,
                amount,
                crit,
                element,
                blocked,
            },
            wf_combat::Event::Evaded { source, target } => Event::Evaded { source, target },
            wf_combat::Event::Healed {
                target,
                amount,
                source,
            } => Event::Healed {
                target,
                amount,
                source,
            },
            wf_combat::Event::WardGained { target, amount } => Event::WardGained { target, amount },
            wf_combat::Event::HazardSpawned { id, kind } => Event::HazardSpawned { id, kind },
            wf_combat::Event::HazardResolved { id, kind, victims } => {
                Event::HazardResolved { id, kind, victims }
            }
            wf_combat::Event::Noticed { id, hazard } => Event::Noticed { id, hazard },
            wf_combat::Event::Downed { id } => Event::Downed { id },
            wf_combat::Event::Revived { id } => Event::Revived { id },
            wf_combat::Event::Died { id } => Event::Died { id },
            wf_combat::Event::HostObservation {
                tag: 0,
                a: _,
                b: _,
                c: _,
                d: _,
            } => Event::WaveReset,
            wf_combat::Event::HostObservation {
                tag: 1,
                a,
                b: _,
                c: _,
                d: _,
            } => Event::BossArrived { id: a },
            wf_combat::Event::HostObservation {
                tag: 2,
                a,
                b: _,
                c: _,
                d: _,
            } => Event::Escalated { level: a },
            wf_combat::Event::HostObservation {
                tag: 3,
                a: _,
                b: _,
                c: _,
                d: _,
            } => Event::StageCleared,
            wf_combat::Event::HostObservation {
                tag: 4,
                a,
                b,
                c: _,
                d: _,
            } => Event::WaveIncoming {
                mini_wave: a,
                count: b,
            },
            wf_combat::Event::Enraged { id } => Event::Enraged { id },
            wf_combat::Event::HostObservation {
                tag: 5,
                a,
                b: _,
                c: _,
                d: _,
            } => Event::ChestDropped { id: a },
            wf_combat::Event::HostObservation { tag: 6, a, b, c, d } => Event::ChestOpened {
                id: a,
                opener: b,
                reward: match c {
                    0 => Reward::FullHeal,
                    1 => Reward::Attack,
                    2 => Reward::Defense,
                    3 => Reward::Range,
                    4 => Reward::AttackSpeed,
                    _ => Reward::MaxHp,
                },
                tier: d as u8,
            },
            wf_combat::Event::ResurrectStarted { reviver, target } => {
                Event::ResurrectStarted { reviver, target }
            }
            wf_combat::Event::ResurrectInterrupted { reviver, target } => {
                Event::ResurrectInterrupted { reviver, target }
            }
            wf_combat::Event::HostObservation {
                tag: 7,
                a: _,
                b: _,
                c: _,
                d: _,
            } => Event::SceneReset,
            wf_combat::Event::Blink {
                hero,
                from,
                to,
                target,
            } => Event::Blink {
                hero,
                from,
                to,
                target,
            },
            wf_combat::Event::Taunt {
                hero,
                radius,
                enemies,
                seconds,
            } => Event::Taunt {
                hero,
                radius,
                enemies,
                seconds,
            },
            wf_combat::Event::SkillStarted { id, skill, target } => {
                Event::SkillStarted { id, skill, target }
            }
            wf_combat::Event::AggroChanged { enemy, from, to } => {
                Event::AggroChanged { enemy, from, to }
            }
            wf_combat::Event::KnockbackResisted { id } => Event::KnockbackResisted { id },
            wf_combat::Event::BossStaggered { id, interrupted } => {
                Event::BossStaggered { id, interrupted }
            }
            wf_combat::Event::HazardCancelled { id, kind } => Event::HazardCancelled { id, kind },
            wf_combat::Event::Encased { id, seconds } => Event::Encased { id, seconds },
            wf_combat::Event::RegenStarted { id, total, seconds } => {
                Event::RegenStarted { id, total, seconds }
            }
            wf_combat::Event::SpotlightBegan { caster, skill } => {
                Event::SpotlightBegan { caster, skill }
            }
            wf_combat::Event::SpotlightEnded { caster, cancelled } => {
                Event::SpotlightEnded { caster, cancelled }
            }
            wf_combat::Event::ChainHop { from, to } => Event::ChainHop { from, to },
            wf_combat::Event::SplitStrike {
                hero,
                center,
                targets,
            } => Event::SplitStrike {
                hero,
                center,
                targets,
            },
            wf_combat::Event::EnemyHealCast {
                healer,
                target,
                seconds,
            } => Event::EnemyHealCast {
                healer,
                target,
                seconds,
            },
            wf_combat::Event::EnemyHealed {
                healer,
                target,
                amount,
            } => Event::EnemyHealed {
                healer,
                target,
                amount,
            },
            wf_combat::Event::GrooveSpent { hero, skill, bars } => {
                Event::GrooveSpent { hero, skill, bars }
            }
            wf_combat::Event::GrooveActivated {
                hero,
                groove,
                seconds,
            } => Event::GrooveActivated {
                hero,
                groove,
                seconds,
            },
            _ => panic!("unknown reference observation"),
        }
    }
}
#[derive(Clone, Debug, PartialEq)]
pub struct Snapshot {
    pub prd: Vec<(u32, wf_combat::prd::State)>,
    /// Presentation clock: advances every step, including spotlight and hit-stop steps.
    pub time: f64,
    /// Combat clock: frozen during spotlights and hit-stop.
    pub combat_time: f64,
    pub spotlight: Option<SpotlightView>,
    /// Global hit-stop; never present together with a spotlight.
    pub hit_stop: Option<HitStopView>,
    /// Combat seconds until a completed Phoenix Touch may be used again.
    pub phoenix_cooldown: f32,
    /// Active player channel; holding must be submitted for each combat step.
    pub phoenix_channel: Option<PhoenixChannelView>,
    /// Boss enmity tables (owner, 2026-10-25): one row per living boss.
    pub enmity: Vec<EnmityRow>,
    pub step: u64,
    pub actors: Vec<ActorView>,
    pub hazards: Vec<HazardView>,
    pub projectiles: Vec<ProjectileView>,
    pub chests: Vec<ChestView>,
    pub stage: StageView,
    /// Arena bounds (min, max) in world units.
    pub arena_min: Vec2,
    pub arena_max: Vec2,
    /// Suggested camera centre: living-party centroid.
    pub camera_focus: Vec2,
}
