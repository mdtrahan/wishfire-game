//! Public contract between `wf_sim` and every consumer (client, bench).
//! Owned by the lead. Changing anything here requires lead review because the
//! client and bench compile against it.
//!
//! Units: world units (u) and seconds. +x is right, +y is down (screen-like
//! ground plane). The sim never sees pixels, textures or frame times.

/// Fixed simulation rate. `Sim::advance` accumulates wall time and runs whole steps.
pub const SIM_HZ: u32 = 30;
pub const SIM_DT: f32 = 1.0 / SIM_HZ as f32;

#[derive(Clone, Copy, Debug, PartialEq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}

impl Vec2 {
    pub const fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Team {
    Hero,
    Enemy,
}

/// Which body/role an actor uses. The client maps this to art; the sim maps it to stats.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "snake_case"))]
pub enum Archetype {
    // Heroes
    Fara,  // tank, Crimson Ward ring
    Hondo, // melee damage, Shadow blink strike
    Runa,  // ranged mage, Bubble Pop knockback
    Kaja,  // support, Elevate ring + damaging aura
    // Fodder (no ground telegraphs)
    Gobloc,
    Orc,
    // Special enemies (telegraphed)
    Sniper,
    Lizardo,
    Fizzmite,
    // Bosses (one per stage, rotating)
    /// Stage 1: Troll Brute — melee lanes, cones, circles.
    Boss,
    /// Stage 2: Chimerilass the Bomber — bomb barrages and a two-way nova.
    BossBomber,
    /// Stage 3: Djinn the Marksman — wide and twin full-length snipes.
    BossMarksman,
    /// Slow, heavily armored melee brute.
    HighOrc,
    /// Ranged caster with a dodgeable attack-rate curse circle.
    Marid,
    /// Fast, fragile swarmer that hunts backline mages unless physically blocked or taunted.
    Gloamink,
    /// Ranged physical-trajectory spitter; landed shots apply poison.
    Mirewing,
    /// Melee rallier whose living aura strengthens nearby enemies' defense.
    Bastorto,
    // WFM definitions retain their own identities and combat behavior (R7).
    WfmHighGobloc,
    WfmSkeleton,
    WfmChimerilass,
    WfmDjinn,
}

/// Presentation state. Maps 1:1 to puppet clips (idle, walk, basic, cast, hurt, ko, spawn).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "snake_case"))]
pub enum ActorState {
    Spawn,
    Idle,
    Walk,
    Basic,
    Cast,
    Hurt,
    Downed,
    Dead,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Facing {
    Left,
    Right,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ActorView {
    pub id: u32,
    pub team: Team,
    pub archetype: Archetype,
    pub pos: Vec2,
    pub facing: Facing,
    pub hp: f32,
    pub max_hp: f32,
    /// Damage absorption remaining from a ward.
    pub ward: f32,
    /// Fara's Warcry shield holds until depleted; survives stage clear, clears on down/wipe.
    pub warcry_shield: bool,
    pub state: ActorState,
    /// Seconds since `state` was entered (sim time). Clip playback samples this.
    pub state_age: f32,
    /// Duration the sim assigned to the current action state (0 for looping states).
    /// The client time-scales one-shot clips so the clip's impact marker lands at
    /// `impact_at` and never drives damage.
    pub state_duration: f32,
    /// Seconds into the current action when its hit resolves (0 if none).
    pub impact_at: f32,
    /// Body radius for depth sorting / selection rings.
    pub radius: f32,
    /// Visual scale hint (boss = larger).
    pub scale: f32,
    /// Debug: the utility action the AI currently commits to (heroes only).
    /// Boss telegraph energy 0..1 (1 = a ground attack is stored and ready). 0 for others.
    pub energy: f32,
    /// True once a boss phase rule (e.g. below 35% HP) has enlarged its telegraphs.
    pub enraged: bool,
    pub ai_intent: AiIntent,
    /// Movement slow currently applied (0 = none, 0.3 = 30% slower), e.g. Runa's Bubble Aura.
    pub slowed: f32,
    /// Seconds left trapped in a Bubble Aura bubble (cannot move or act). 0 = free.
    pub encased: f32,
    /// Current attack target (heroes and enemies). Bosses pick it by enmity.
    pub target: Option<u32>,
    /// Combat seconds left under Mirewing poison; one unmitigated tick per second.
    pub poisoned: f32,
    /// Covered by a living High Gobloc: effective armor divisor is 50% stronger.
    pub rallied: bool,
    /// Special meter style (heroes only; owner Groove spec 2026-10-26).
    pub groove: Option<Groove>,
    /// Meter fill in bars: 0..=3 for Super/Power, 0..=2 for Rage, 0..=1 for Combo.
    pub meter: f32,
    /// Seconds left on an active groove effect: Hondo's Combo burst (draining) or Kaja's
    /// Elevate power-up. 0 when none.
    pub groove_active: f32,
    /// True while this hero is casting a groove special (drives the cast glow). Stays true
    /// across a Combo burst's chained specials.
    pub special_casting: bool,
    /// Marid teleport countdown at 30 Hz: 60..43 departure, 42..19 invisible transit,
    /// 18..1 arrival. Untargetable/non-colliding until 0; position swaps at 42.
    pub teleport_steps: u32,
    /// Active forced-target source; None immediately on source loss or taunt expiry.
    pub taunted_by: Option<u32>,
    /// Current Elevate variant on this living hero, cleared on expiry or Kaja loss.
    pub elevate: Option<ElevateVariant>,
}

/// Exactly one party-wide Elevate effect; refreshed casts replace the previous variant.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ElevateVariant {
    Sword,
    Wings,
    WingedBoots,
}

/// Owner Groove spec (2026-10-26): how a hero's special meter fills and is spent.
/// Only usable specials spend it (never passives). Specials have no cooldown clocks.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "snake_case"))]
pub enum Groove {
    /// C (Runa): three notches; Bubble Pop and Heal cost 1 each.
    Super,
    /// A (Hondo): at 100% a burst drains the bar while specials chain back to back.
    Combo,
    /// N (Kaja): three stocks, auto-filling; Arcane Pulse 1, Elevate (power-up) 2.
    Power,
    /// K (Fara): two stocks, auto-fill plus hits taken; Warcry costs 1, Ground Pound 2.
    Rage,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum AiIntent {
    None,
    Attack,
    MoveToRange,
    Dodge,
    SeekZone,
    Regroup,
    Retreat,
    Revive,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Shape {
    Circle {
        radius: f32,
    },
    /// Safe centre inside `inner`.
    Ring {
        inner: f32,
        outer: f32,
    },
    /// Apex at origin, opening along `dir`.
    Cone {
        length: f32,
        half_angle_rad: f32,
    },
    /// From origin along `dir`.
    Line {
        length: f32,
        width: f32,
    },
}

/// ORKA-f1oq fill grammar.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum FillMode {
    /// Repeating radiation from source outward: marks WHERE.
    Loop,
    /// One-time fill reaching the edge exactly at resolution: marks WHEN.
    Countdown,
    /// Edge recedes with remaining duration (lingering zones / auras).
    Drain,
    /// One-time countdown filling outward from the centre AND inward from the rim at once.
    TwoWay,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum HazardPhase {
    /// Aim follows its target (e.g. sniper thin line). Not yet dodgeable in a meaningful way.
    Tracking,
    /// Aim locked; countdown to resolution running.
    Locked,
    /// Lingering / continuous zone (puddle, aura, arena lock).
    Active,
    /// Resolved this step (one frame flash), removed next step.
    Resolved,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "snake_case"))]
pub enum HazardKind {
    SniperLine,
    LizardoDrop,
    FizzmiteBlast,
    /// Melee boss: circle around the boss itself (point-blank stomp).
    BossSlam,
    /// Melee boss: large frontal swipe.
    BossCone,
    /// Melee boss: rush lane toward a hero before a swipe.
    BossCharge,
    /// Neutral marker where a mini-wave is about to appear (never damages).
    SpawnMarker,
    /// Bomber boss: circle centred on the boss filling two ways (centre out + rim in).
    BossNova,
    /// Marksman boss: full-length snipe line (wide variant or one of a twin pair).
    BossSnipe,
    /// Friendly: a hero channelling a resurrect over a downed ally (Countdown to revive).
    Resurrect,
    /// Kaja's Faze: a hero-placed poison pool (r = 2x bomb diameter) that damages enemies inside each second.
    FazePool,
    WardRing,
    ElevateRing,
    KajaAura,
    /// Runa's Bubble Aura (owner, 2026-10-25): always-on ring around Runa that slows enemies
    /// and can encase them in a bubble. No damage.
    BubbleAura,
    BubblePop,
    /// Kaja's Arcane Pulse: one-shot arcane burst on her target's position (enemies only).
    ArcanePulse,
    /// Fara's Ground Pound: one-shot Line from Fara toward her target; the eruption travels
    /// along it (Xenogears reference). Enemies only.
    GroundPound,
    /// Runa's Healing Spring: ground pool that heals allies standing inside (never enemies).
    HealingSpring,
    /// One circle of the Troll's Marching Stomp (owner-approved composed boss move): several are
    /// locked at once and resolve in sequence toward the target.
    BossStompStep,
    /// Non-damaging enemy defense aura that follows its living High Gobloc owner.
    RallyAura,
}

#[derive(Clone, Debug, PartialEq)]
pub struct HazardView {
    pub id: u32,
    pub kind: HazardKind,
    pub team: Team,
    /// true = hurts the opposing team; false = supports its own team.
    pub hostile: bool,
    pub shape: Shape,
    pub origin: Vec2,
    /// Unit direction for cones and lines.
    pub dir: Vec2,
    pub fill: FillMode,
    pub phase: HazardPhase,
    /// 0..1 progress of the current phase (countdown fill, drain remaining, loop phase).
    pub progress: f32,
    /// Sniper track->lock: visible width multiplier 1/3..1 while tracking/locking.
    pub width_scale: f32,
    pub owner: u32,
    /// ORKA-f1oq tier: 0 low, 1 med, 2 high, 3 lethal.
    pub tier: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ProjectileKind {
    Bolt, // sniper / ranged basic
    Bomb, // lizardo arc
    Orb,  // runa / kaja basic
}

#[derive(Clone, Debug, PartialEq)]
pub struct ProjectileView {
    pub id: u32,
    pub kind: ProjectileKind,
    pub pos: Vec2,
    /// Visual height above ground for arcs (u).
    pub height: f32,
    pub team: Team,
    /// Unit travel direction on the ground plane (for sprite rotation).
    pub dir: Vec2,
}

/// Combat event that starts a short global hit-stop outside spotlights.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HitStopCause {
    /// A living hero became downed.
    HeroDowned,
    /// A living boss died; takes priority over simultaneous hero downs.
    BossDied,
    /// Runa began casting Healing Spring; lowest-priority freeze.
    HealingSpring,
}
/// Read-only view of the deterministic combat-clock freeze.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct HitStopView {
    /// Event responsible for this freeze.
    pub cause: HitStopCause,
    /// Actor responsible for the freeze.
    pub actor: u32,
    /// Frozen simulation seconds remaining, rounded up to whole fixed steps.
    pub remaining: f32,
}
/// Player-held Phoenix Touch channel, independent of hero revive progress.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PhoenixChannelView {
    /// Downed hero receiving the player action.
    pub hero: u32,
    /// Completed fraction of the five-second combat-clock channel.
    pub progress: f32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Snapshot {
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
    /// Arena bounds (min, max) in world units.
    pub arena_min: Vec2,
    pub arena_max: Vec2,
    /// Suggested camera centre: living-party centroid.
    pub camera_focus: Vec2,
}

/// Heal provenance for recipient presentation; never changes restoration mechanics.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "snake_case", tag = "kind", content = "data"))]
pub enum HealSource {
    HealingSpring,
    Mend,
    Breather,
    Revive,
    Phoenix,
    #[cfg(feature = "reference-diagnostics")]
    FullHealReward,
    PartyRestore,
    SpringTick,
    EnemyHeal,
    EnemyRegen,
}

#[derive(Clone, Debug, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "snake_case", tag = "kind", content = "data"))]
pub enum Event {
    PhoenixBegan {
        hero: u32,
    },
    PhoenixCompleted {
        hero: u32,
    },
    PhoenixCancelled {
        hero: u32,
    },
    ReviveBurst {
        hero: u32,
        pos: Vec2,
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
    Enraged {
        id: u32,
    },
    ResurrectStarted {
        reviver: u32,
        target: u32,
    },
    ResurrectInterrupted {
        reviver: u32,
        target: u32,
    },
    Blink {
        hero: u32,
        from: Vec2,
        to: Vec2,
        target: u32,
    },
    Taunt {
        hero: u32,
        radius: f32,
        enemies: Vec<u32>,
        seconds: f32,
    },
    SkillStarted {
        id: u32,
        skill: Skill,
        target: Option<u32>,
    },
    AggroChanged {
        enemy: u32,
        from: Option<u32>,
        to: u32,
    },
    KnockbackResisted {
        id: u32,
    },
    BossStaggered {
        id: u32,
        interrupted: bool,
    },
    HazardCancelled {
        id: u32,
        kind: HazardKind,
    },
    Encased {
        id: u32,
        seconds: f32,
    },
    RegenStarted {
        id: u32,
        total: f32,
        seconds: f32,
    },
    SpotlightBegan {
        caster: u32,
        skill: Skill,
    },
    SpotlightEnded {
        caster: u32,
        cancelled: bool,
    },
    ChainHop {
        from: u32,
        to: u32,
    },
    SplitStrike {
        hero: u32,
        center: Vec2,
        targets: Vec<u32>,
    },
    EnemyHealCast {
        healer: u32,
        target: u32,
        seconds: f32,
    },
    EnemyHealed {
        healer: u32,
        target: u32,
        amount: f32,
    },
    GrooveSpent {
        hero: u32,
        skill: Skill,
        bars: f32,
    },
    GrooveActivated {
        hero: u32,
        groove: Groove,
        seconds: f32,
    },
    /// Opaque reference-host observation, never interpreted by combat.
    #[cfg(feature = "reference-diagnostics")]
    HostObservation {
        tag: u32,
        a: u32,
        b: u32,
        c: u32,
        d: u32,
    },
}

/// Impact VFX family; maps to Wishfire elemental-impact flipbooks.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "snake_case"))]
pub enum Element {
    Physical,
    Fire,
    Ice,
    Arcane,
    Nature,
    /// Faze poison ticks (purple damage-over-time numbers, purple impacts).
    Poison,
}

/// Mechanical channel, independent of the impact's visual element.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DamageChannel { Physical, Magic }
impl Element {
    pub fn damage_channel(self) -> DamageChannel {
        match self { Self::Physical => DamageChannel::Physical, _ => DamageChannel::Magic }
    }
}
impl Archetype {
    pub fn basic_channel(self) -> DamageChannel {
        match self {
            Self::Runa | Self::Kaja | Self::Lizardo | Self::Marid | Self::Mirewing => DamageChannel::Magic,
            _ => DamageChannel::Physical,
        }
    }
}
impl HazardKind {
    pub fn damage_channel(self) -> DamageChannel {
        match self {
            Self::BubblePop | Self::FazePool | Self::ArcanePulse | Self::KajaAura | Self::LizardoDrop => DamageChannel::Magic,
            _ => DamageChannel::Physical,
        }
    }
}

/// Owner rule: heroes are never tethered to each other or to downed allies.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cohesion {
    /// Free roam anywhere on the walkable floor (vertical, DQSG-style arenas).
    None,
    /// Free roam bounded to the currently visible screen width (wide Wishfire arenas).
    ScreenBound,
}

#[derive(Clone, Debug)]
pub struct SimConfig {
    pub seed: u64,
    /// Arena width/height in world units. Portrait corridor (DQ Smash Grow reference).
    pub arena_size: Vec2,
    /// Visible world area at zoom 0.5 on a 360x640 portrait screen (full-screen combat).
    pub visible_width: f32,
    pub visible_height: f32,
    /// How heroes are kept together. Vertical arenas: None (free roam). Wide arenas: ScreenBound.
    pub cohesion: Cohesion,
    /// Cinematic Skill Spotlight scheduling. Default is OFF so the sim's balance proof is unchanged.
    pub spotlight: SpotlightConfig,
}

/// Hero special skills: the only actions eligible for a Cinematic Skill Spotlight.
/// Basic attacks and resurrect channels are never skills.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "snake_case"))]
pub enum Skill {
    CrimsonWard,   // Fara special
    Taunt,         // Fara extra
    Shadow,        // Hondo special
    Split,         // Hondo extra
    BubblePop,     // Runa special
    Elevate,       // Kaja special
    Faze,          // Kaja extra
    ArcanePulse,   // Kaja offensive special (owner, 2026-10-25)
    GroundPound,   // Fara offensive special: line eruption from her fist to the target (owner)
    HealingSpring, // Runa support: healing pool for allies (owner, 2026-10-25); never spotlit
}
impl Skill {
    pub const ALL: [Skill; 10] = [
        Skill::CrimsonWard,
        Skill::Taunt,
        Skill::Shadow,
        Skill::Split,
        Skill::BubblePop,
        Skill::Elevate,
        Skill::Faze,
        Skill::ArcanePulse,
        Skill::GroundPound,
        Skill::HealingSpring,
    ];
    pub fn index(self) -> usize {
        self as usize
    }
    /// Owner: spotlights are ONLY for special attacks that deal damage to enemies with an attack
    /// shape. Never self-buffs (Ward), party buffs (Elevate), control (Taunt), healing, or ground
    /// zones (Faze). This is a hard gate in the sim: `SpotlightConfig.skills` can only exclude
    /// offensive skills, it can never make a non-offensive skill eligible.
    pub const fn offensive(self) -> bool {
        matches!(
            self,
            Skill::Shadow
                | Skill::Split
                | Skill::BubblePop
                | Skill::ArcanePulse
                | Skill::GroundPound
        )
    }
    /// Default spotlight eligibility: offensive skills only.
    pub const fn offensive_mask() -> [bool; 10] {
        let mut mask = [false; 10];
        let mut i = 0;
        while i < 10 {
            mask[i] = Self::ALL[i].offensive();
            i += 1;
        }
        mask
    }
}

/// Spotlight scheduling (owner, 2026-10-25). Event-driven: only real special activations already
/// scheduled by combat are candidates; candidates that fail the gates are skipped, never queued.
/// All gaps are COMBAT seconds (the combat clock is frozen during a spotlight).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SpotlightConfig {
    pub enabled: bool,
    /// Minimum combat seconds from the end of one spotlight to the start of the next.
    pub global_gap: f32,
    /// Minimum combat seconds between two spotlights of the same hero.
    pub hero_gap: f32,
    /// A candidate hero must have waited at least `fairness` x the longest wait among living
    /// heroes (0 = first come, 1 = strictly longest-waiting).
    pub fairness: f32,
    /// After `drought` x `global_gap` without any spotlight, the fairness gate is waived.
    pub drought: f32,
    /// Per-skill eligibility, indexed by `Skill::index()`. ANDed with `Skill::offensive()`:
    /// a `true` on a non-offensive skill is ignored.
    pub skills: [bool; 10],
    /// Charge-up beat before the attack plays (owner, Xenogears reference): the world is
    /// already frozen and the caster holds its wind-up pose while the presentation shows a
    /// power-up. Only `time` advances, so it never affects combat. 0 disables it.
    pub charge: f32,
    /// Max sim seconds the Tail phase waits for the presentation to call `release_spotlight`.
    pub tail_cap: f32,
    /// Headless runs: end at the end of the Performing phase without waiting for a release.
    pub auto_release: bool,
}
impl SpotlightConfig {
    pub const OFF: Self = Self {
        enabled: false,
        global_gap: 12.,
        hero_gap: 30.,
        fairness: 0.6,
        drought: 2.,
        charge: 1.2, // owner: Xenogears power-up runs ~1.2 s; 0.6 read as too quick
        // Owner: only special attacks with an attack shape are spotlit (see Skill::offensive).
        skills: Skill::offensive_mask(),
        tail_cap: 2.5,
        auto_release: false,
    };
    pub const CONSERVATIVE: Self = Self {
        enabled: true,
        global_gap: 20.,
        hero_gap: 45.,
        ..Self::OFF
    };
    pub const DEFAULT: Self = Self {
        enabled: true,
        ..Self::OFF
    };
    pub const AGGRESSIVE: Self = Self {
        enabled: true,
        global_gap: 6.,
        hero_gap: 15.,
        ..Self::OFF
    };
}
impl Default for SpotlightConfig {
    fn default() -> Self {
        Self::OFF
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SpotlightPhase {
    /// Charge-up beat: nothing advances except `time` (caster holds its wind-up pose).
    Charge,
    /// Combat clock frozen; only the caster's action and its one-shot skill hazards advance.
    Performing,
    /// Mechanics finished; only `time` advances while the presentation finishes the VFX package.
    Tail,
}

/// A living boss's enmity toward each hero, in hero order Fara, Hondo, Runa, Kaja
/// (0 for a missing/downed hero).
#[derive(Clone, Debug, PartialEq)]
pub struct EnmityRow {
    pub boss: u32,
    pub values: [f32; 4],
}

#[derive(Clone, Debug, PartialEq)]
pub struct SpotlightView {
    pub caster: u32,
    pub skill: Skill,
    pub phase: SpotlightPhase,
    /// Snapshot `time` when the spotlight began.
    pub started: f64,
    /// Caster first, then every actor the skill targeted or affected (damaged, healed, warded,
    /// taunted, shoved, or inside a hazard it created). Grows during Performing; never shrinks.
    pub participants: Vec<u32>,
    /// Hazards created by the skill during this spotlight (and by co-performing skills).
    pub hazards: Vec<u32>,
    /// Combo window (owner, 2026-10-25): other heroes whose OFFENSIVE special was already in
    /// motion (wind-up, cast, travelling projectile or live hazard) against a spotlight target
    /// when the spotlight began. They keep running and hold the window open until they finish.
    /// Fixed at spotlight start: never grows, so no new attack can join.
    pub co_casters: Vec<u32>,
    /// Projectiles that keep flying during the spotlight (featured and co-performing skills).
    pub projectiles: Vec<u32>,
}

impl Default for SimConfig {
    fn default() -> Self {
        Self {
            seed: 1,
            arena_size: Vec2::new(960.0, 2200.0),
            visible_width: 720.0,
            visible_height: 1700.0,
            cohesion: Cohesion::None,
            spotlight: SpotlightConfig::OFF,
        }
    }
}

/// What the sim builds on `Sim::with_scenario`.

/// Result of a finished DodgeTrial.
#[cfg(feature = "reference-diagnostics")]
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TrialOutcome {
    pub dodged: bool,
    pub reaction_delay: f32,
    pub damage_taken: f32,
}
