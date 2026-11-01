//! Slice tuning, in world units and seconds.
use crate::{Archetype, Vec2};

// art/arena/arena.json, half-open world-space floor. No runtime asset reads.
pub const ARENA_MIN: Vec2 = Vec2::new(96., 40.);
pub const ARENA_MAX: Vec2 = Vec2::new(864., 1592.);
pub const ARENA_CENTRE: Vec2 = Vec2::new(
    (ARENA_MIN.x + ARENA_MAX.x) * 0.5,
    (ARENA_MIN.y + ARENA_MAX.y) * 0.5,
);
pub const STAGE_ORIGIN: Vec2 = Vec2::new(ARENA_CENTRE.x, ARENA_MAX.y - 260.);
pub const TRIAL_ORIGIN: Vec2 = Vec2::new(480., 1100.);
pub const TRAVEL_SLOTS: [Vec2; 4] = [
    Vec2::new(-38., -120.),
    Vec2::new(38., -120.),
    Vec2::new(-38., 120.),
    Vec2::new(38., 120.),
];
pub const IDLE_SEPARATION: f32 = 76.;

#[derive(Clone, Copy, Debug)]
pub struct Stats {
    pub mag: f32,
    pub res: f32,
    pub hp: f32,
    pub atk: f32,
    pub def: f32,
    pub speed: f32,
    pub reach: f32,
    pub interval: f32,
    pub evade: f32,
    pub special: f32,
}
impl Stats {
    pub fn attack(self, channel: crate::DamageChannel) -> f32 {
        match channel { crate::DamageChannel::Physical => self.atk, crate::DamageChannel::Magic => self.mag }
    }
}
pub const HEROES: [Archetype; 4] = [
    Archetype::Fara,
    Archetype::Hondo,
    Archetype::Runa,
    Archetype::Kaja,
];
// Sweep baseline is the previous mage speed; spread is deliberately narrow.
pub const HERO_SPEED_FLOOR: f32 = 78.;
/// Owner method: stepped until telegraphs were reliably dodged (~2.02x), then pulled back two steps.
pub const HERO_SPEED_MULTIPLIER: f32 = 1.6698;
pub const HERO_STATS: [Stats; 4] = [
    Stats {
        hp: 420.,
        mag: 26.4,
        atk: 26.4,
        res: 28.,
        def: 28.,
        speed: HERO_SPEED_FLOOR * HERO_SPEED_MULTIPLIER * 1.0, // tank: second most agile (owner)
        reach: 100.,                                           // spear class ~2.75 bodies
        interval: 1.8,
        evade: 0.09,
        special: WARD_INTERVAL,
    },
    Stats {
        hp: 300.,
        mag: 40.8,
        atk: 40.8,
        res: 14.,
        def: 14.,
        speed: HERO_SPEED_FLOOR * HERO_SPEED_MULTIPLIER * 1.10,
        reach: 45., // claw class ~1.25 bodies
        interval: 1.2,
        evade: 0.12,
        special: 8.,
    },
    Stats {
        hp: 260.,
        mag: 36.,
        atk: 36.,
        res: 10.,
        def: 10.,
        speed: HERO_SPEED_FLOOR * HERO_SPEED_MULTIPLIER * 0.95, // mages: least agile, rely on range
        reach: 270.,                                            // staff class ~7.5 bodies
        interval: 1.4,
        evade: 0.05,
        special: 10.,
    },
    Stats {
        hp: 280.,
        mag: 21.6,
        atk: 21.6,
        res: 16.,
        def: 16.,
        speed: HERO_SPEED_FLOOR * HERO_SPEED_MULTIPLIER * 0.95,
        reach: 235., // staff class ~6.5 bodies
        interval: 1.6,
        evade: 0.05,
        special: 16.,
    },
];
pub const FODDER_STATS: [Stats; 2] = [
    Stats {
        hp: 140.,
        mag: 10.,
        atk: 10.,
        res: 0.,
        def: 0.,
        speed: 55.,
        reach: 40.,
        interval: 2.6,
        evade: 0.,
        special: 0.,
    },
    Stats {
        hp: 210.,
        mag: 11.,
        atk: 11.,
        res: 0.,
        def: 0.,
        speed: 45.,
        reach: 63., // orc sword class ~1.75 bodies
        interval: 3.0,
        evade: 0.,
        special: 0.,
    },
];
pub const SPECIAL_STATS: [Stats; 4] = [
    // Sniper: fragile to offset its huge range (owner, DQSG reference): 90 -> 54 HP.
    Stats {
        hp: 54.,
        mag: 26.,
        atk: 26.,
        res: 0.,
        def: 0.,
        speed: 35.,
        reach: 300.,
        interval: 4.5,
        evade: 0.,
        special: 0.,
    },
    Stats {
        hp: 100.,
        mag: 22.,
        atk: 22.,
        res: 0.,
        def: 0.,
        speed: 45.,
        reach: 220.,
        interval: 4.5,
        evade: 0.,
        special: 0.,
    },
    Stats {
        hp: 95.,
        mag: 60.,
        atk: 60.,
        res: 0.,
        def: 0.,
        speed: 180., // owner 2026-10-27: faster than every hero (was 90)
        reach: 55.,
        interval: 0.6,
        evade: 0.,
        special: 0.,
    },
    Stats {
        hp: BOSS_HP,
        mag: 165.,
        atk: 165.,
        res: 0.,
        def: 0.,
        speed: 40.,
        reach: 100.,
        interval: 4.5,
        evade: 0.,
        special: 0.,
    },
];
pub fn stats(k: Archetype) -> Stats {
    match k {
        Archetype::Fara => HERO_STATS[0],
        Archetype::Hondo => HERO_STATS[1],
        Archetype::Runa => HERO_STATS[2],
        Archetype::Kaja => HERO_STATS[3],
        Archetype::WfmHighGobloc => Stats {
            hp: 70.,
            mag: 14.,
            atk: 14.,
            res: 14.,
            def: 14.,
            speed: 25.2,
            reach: 46.,
            interval: 3.6,
            evade: 0.,
            special: 0.,
        },
        Archetype::WfmSkeleton => Stats {
            hp: 35.,
            mag: 8.,
            atk: 8.,
            res: 5.,
            def: 5.,
            speed: 25.2,
            reach: 46.,
            interval: 3.6,
            evade: 0.,
            special: 0.,
        },
        Archetype::WfmChimerilass => Stats {
            hp: 80.,
            mag: 8.,
            atk: 8.,
            res: 10.,
            def: 10.,
            speed: 25.2,
            reach: 146.,
            interval: 5.,
            evade: 0.,
            special: 0.,
        },
        Archetype::WfmDjinn => Stats {
            hp: 55.,
            mag: 6.,
            atk: 6.,
            res: 6.,
            def: 6.,
            speed: 25.2,
            reach: 146.,
            interval: 5.,
            evade: 0.,
            special: 0.,
        },
        Archetype::Gobloc => FODDER_STATS[0],
        Archetype::Orc => FODDER_STATS[1],
        Archetype::HighOrc => Stats {
            hp: 260.,
            mag: 30.,
            atk: 30.,
            res: 80.,
            def: 80.,
            speed: 32.,
            reach: 68.,
            interval: 4.2,
            evade: 0.,
            special: 0.,
        },
        Archetype::Marid => Stats {
            hp: 235., // Between Orc (210) and High Orc (260).
            mag: MARID_BOLT_DAMAGE,
            atk: MARID_BOLT_DAMAGE,
            res: 10.,
            def: 10.,
            speed: HERO_STATS
                .iter()
                .map(|s| s.speed)
                .fold(f32::INFINITY, f32::min),
            reach: MARID_BOLT_REACH,
            interval: MARID_BOLT_INTERVAL,
            evade: 0.,
            special: 0.,
        },
        Archetype::Gloamink => Stats {
            hp: 149.5, // ORKA-6jh1.52: previous 130 HP +15%.
            mag: 10.,
            atk: 10.,
            res: 0.,
            def: 0.,
            speed: 112.,
            reach: 40.,
            interval: 1.5,
            evade: 0.,
            special: 0.,
        },
        Archetype::Mirewing => Stats {
            hp: 145.,
            mag: 20.,
            atk: 20.,
            res: 8.,
            def: 8.,
            speed: MIREWING_SPEED,
            reach: MIREWING_MAX,
            interval: 3.,
            evade: 0.,
            special: 0.,
        },
        Archetype::Bastorto => Stats {
            hp: 350.,
            mag: 15.2,
            atk: 15.2,
            res: 14.,
            def: 14.,
            speed: 50.,
            reach: 48.,
            interval: 2.6,
            evade: 0.,
            special: 0.,
        },
        Archetype::Sniper => SPECIAL_STATS[0],
        Archetype::Lizardo => SPECIAL_STATS[1],
        Archetype::Fizzmite => SPECIAL_STATS[2],
        Archetype::Boss | Archetype::BossBomber => SPECIAL_STATS[3],
        Archetype::BossMarksman => Stats {
            hp: SPECIAL_STATS[3].hp * MARKSMAN_HP_MULTIPLIER,
            ..SPECIAL_STATS[3]
        },
    }
}
pub const DEF_BASE: f32 = 100.;
pub const CRIT_CHANCE: f32 = 0.10;
pub const CRIT_MULTIPLIER: f32 = 1.5;
pub const WARD_FRACTION: f32 = 0.30;
/// Owner: Crimson Ward stacks when reapplied while it persists, up to 3 casts (90% max HP),
/// so the tank can take boss hits without being downed in one or two.
pub const WARD_STACKS: f32 = 3.;
pub const WARD_CAP: f32 = WARD_FRACTION * WARD_STACKS;
pub const TAUNT_RADIUS: f32 = 440.; // owner: doubled from 220
pub const TAUNT_DURATION: f32 = 6.; // owner, 2026-10-25: +50%, cooldown unchanged
pub const SHADOW_MAX_LINE_ANGLE_DEGREES: f32 = 18.;
pub const SHADOW_POTENCY: f32 = 2.4;
pub const SHADOW_WARD_FRACTION: f32 = 0.20;
pub const SHADOW_WARD_SECONDS: f32 = 3.;
/// Owner (2026-10-25): Shadow can start from 2x Hondo's melee attack range (+100%).
pub const SHADOW_RANGE_SCALE: f32 = 2.;
/// 1.2 combat seconds: allow a group to form without hoarding a ready stock.
pub const MAGE_AOE_HOLD_STEPS: u32 = 36;
pub const BUBBLE_RADIUS: f32 = 140.;
pub const BUBBLE_POTENCY: f32 = 2.094; // 1.8 * (1 + baseline Chain damage / Bubble damage).
pub const BUBBLE_PUSH: f32 = 70.;
pub const ELEVATE_RADIUS: f32 = 260.;
pub const ELEVATE_DURATION: f32 = 8.;
pub const ELEVATE_BONUS: f32 = 0.25;
// Owner groove spec retains Elevate's original 15% movement bonus.
pub const ELEVATE_MOVE_BONUS: f32 = 0.15;
pub const ELEVATE_EVADE_BONUS: f32 = 0.22;
pub const ELEVATE_EVADE_CAP: f32 = 0.95;
pub const ELEVATE_RANGE_BONUS: f32 = 0.22;
pub const ELEVATE_BOOTS_MOVE_BONUS: f32 = 0.12;
pub const ELEVATE_DEF_BONUS: f32 = 0.12;
pub const AURA_RADIUS: f32 = 80.;
pub const AURA_DPS: f32 = 4.;
pub const BREATHER_DELAY: f32 = 4.;
pub const BREATHER_HP_PER_SECOND: f32 = 0.03;
pub const REVIVE_SAFE_HP: f32 = 0.35;
pub const REVIVE_INTERRUPT_HP: f32 = 0.10;
pub const REVIVE_REFUND: f32 = 0.5;
pub const BOSS_BODY_RADIUS: f32 = 66.;
// 128 px * 2.2 actor scale * 0.5 zoom / (0.5 zoom * 0.75 squash)
// gives ~375 u including transparent frame padding. A 300-u spine + 66-u cap
// covers the drawn torso. Projectile contact only; feet geometry stays unchanged.
pub const BOSS_HURT_HEIGHT: f32 = 300.;

// Owner pacing (2026-10-26): reinforcements follow 6 s after the current
pub const SUBWAVE_FOLLOW_SECONDS: f32 = 6.;
// Owner: active = every living Enemy (boss, summons and spawning actors included)
// plus every unresolved spawn_kind marker; all enemy entry paths share these 12 slots.
pub const ACTIVE_ENEMY_CAP: usize = 12;
pub const FORMATION_RADIUS_MIN: f32 = 170.;
pub const FORMATION_RADIUS_MAX: f32 = 220.;
pub const FORMATION_SPACING: f32 = 110.;
pub const SPAWN_CLEARANCE: f32 = 6.;
/// Minimum spawn distance from every hero, by role (owner, 2026-10-26).
pub const SPAWN_MELEE_BUFFER: f32 = 320.;
pub const SPAWN_RANGED_BUFFER: f32 = 600.;
pub const SPAWN_MARKER_RADIUS: f32 = 35.;
pub const ENEMY_FORMATION_OFFSET: f32 = 18.;
pub const BOSS_HP: f32 = 1500.; // Owner 2026-10-29: boss max HP x1.25 (was 1200).
pub const REVIVE_RANGE: f32 = 60.;
pub const REVIVE_APPROACH_RANGE: f32 = REVIVE_RANGE - BODY_RADIUS - 5.;
pub const REVIVE_CHANNEL: f32 = 5.0;
pub const REVIVE_GRACE: f32 = 6.0;
pub const REVIVE_DECAY: f32 = 0.10;
pub const REVIVE_DANGER_MARGIN: f32 = 40.;
pub const REVIVE_HP: f32 = 0.40;
pub const REVIVE_COOLDOWN: f32 = 0.;
pub const SNIPER_MIN: f32 = 300.;
pub const SNIPER_MAX: f32 = 420.;
pub const SNIPER_TRACK: f32 = 1.;
pub const SNIPER_LOCK: f32 = 1.;
pub const SNIPER_WIDTH: f32 = 36.;
/// Djinn beam grows from its original 90-u lane at the same spatial fill rate.
pub const DJINN_BEAM_WIDTH: f32 = 120.;
pub const DJINN_BEAM_REFERENCE_WIDTH: f32 = SNIPER_WIDTH * 2.5;
pub const SNIPER_LENGTH: f32 = 600.;
pub const SNIPER_WIDEN: f32 = 3.;
pub const LIZARDO_MIN: f32 = 220.;
pub const LIZARDO_MAX: f32 = 320.;
pub const MIREWING_SPEED: f32 = 110.;
pub const MIREWING_MIN: f32 = LIZARDO_MIN;
pub const MIREWING_MAX: f32 = SNIPER_MAX;
pub const MIREWING_HOVER: f32 = 1.25;
pub const MIREWING_BURST_ROUNDS: u8 = 8;
pub const MIREWING_BURST_GAP: f32 = 0.12;
pub const MIREWING_ROUND_DAMAGE: f32 = 0.35;
pub const MIREWING_REPOSITION_MIN: f32 = 0.4;
pub const MIREWING_REPOSITION_MAX: f32 = 2.;
pub const MIREWING_SIDESTEP: f32 = 0.65;
pub const MIREWING_ARRIVAL: f32 = 8.;
pub const BOMB_TIME: f32 = 4.56;
/// Bomb arc time; the bomb then rests on the ground (fuse) until the drop resolves at BOMB_TIME.
pub const BOMB_FLIGHT: f32 = 0.75;
pub const BOMB_RADIUS: f32 = 69.;
/// Chimerilass open/scatter/fortress bombs: seconds on the ground, including during enrage.
pub const CHIMERA_BOMB_FUSE: f32 = 3.0;
/// Aimed bombs retain BOMB_TIME (plus existing enrage/throw-order timing), enlarging only area.
pub const CHIMERA_TARGETED_BOMB_RADIUS: f32 = BOMB_RADIUS * 1.5;
pub const FIZZMITE_TRIGGER: f32 = 55.;
pub const FIZZMITE_FUSE: f32 = 1.0;
// Owner 2026-10-27: 3x blast (was 70). The fill keeps its original 70 u/s, so the fuse grows to
// 3 s and damage scales x3 through the shared countdown rule.
pub const FIZZMITE_RADIUS: f32 = 210.;
pub const FIZZMITE_FILL_SPEED: f32 = 70.;
/// Full blast countdown: the cast holds Fizzmite in place until it detonates.
pub const FIZZMITE_COUNTDOWN: f32 = if FIZZMITE_RADIUS / FIZZMITE_FILL_SPEED > FIZZMITE_FUSE {
    FIZZMITE_RADIUS / FIZZMITE_FILL_SPEED
} else {
    FIZZMITE_FUSE
};
pub const BOSS_SCALE: f32 = 2.2;
pub const SLAM_RADIUS: f32 = 130.;
pub const SLAM_LOCK: f32 = 1.66;
pub const CONE_LENGTH: f32 = 200.;
pub const CONE_HALF_ANGLE: f32 = 0.45;
// Owner: Djinn's wall-length cone removes ten degrees from the full opening.
pub const MARKSMAN_CONE_HALF_REDUCTION: f32 = 5. * core::f32::consts::PI / 180.;
pub const CONE_TRACK: f32 = 0.;
pub const CONE_LOCK: f32 = 1.13;
pub const SUMMON_COUNT: u32 = 2;
pub const SUMMON_INTERVAL: f32 = 14.;

// Ordinary cycle boundaries include the preceding boss-court escort ramp.

pub const AI_INTERVAL: f32 = 1. / 8.;
pub const REACTION_MIN: f32 = 0.18;
pub const REACTION_MAX: f32 = 0.45;
pub const BEHIND_DELAY: f32 = 0.15;
pub const SEPARATION: f32 = 40.;
// Presentation/action timings and encounter cadence are slice choices, not inherited JS tuning.
pub const BODY_RADIUS: f32 = 14.;
/// Owner (2026-10-27): moat around every hero/enemy body so actors never stack (world units).
pub const ACTOR_MOAT: f32 = 8.;
pub const ACTOR_MOAT_PASSES: usize = 3;
/// Moat stretch along depth (y). Must keep 2*(BODY_RADIUS+ACTOR_MOAT)*depth below the shortest
/// melee centre reach (Gobloc 40 + 28 = 68) so attackers above/below still connect.
pub const ACTOR_MOAT_DEPTH: f32 = 1.4;
pub const BASIC_DURATION: f32 = 0.65;
pub const BASIC_IMPACT: f32 = 0.32;
pub const CAST_DURATION: f32 = 0.7;
pub const CAST_IMPACT: f32 = 0.35;
// Approved B2/A3 wind-ups; preserve the existing post-impact recovery.
pub const ELEVATE_WINDUP: f32 = 1.875;
pub const WARCRY_WINDUP: f32 = 1.5;
pub const PROJECTILE_SPEED: f32 = 420.;
pub const BOMB_HEIGHT: f32 = 100.;
pub const PREDICTION_TIME: f32 = 0.4;
pub const BOMB_SCATTER: f32 = 28.;
pub const TAU: f32 = core::f32::consts::TAU;

pub const SPAWN_COUNTDOWN: f32 = 1.2;
pub const CHARGE_TRACK: f32 = 0.5;
pub const CHARGE_LOCK: f32 = 0.8;
pub const CHARGE_SPEED: f32 = 540.;
pub const CHARGE_WIDTH: f32 = 100.;
pub const MEND_INTERVAL: f32 = 3.;
pub const MEND_FRACTION: f32 = 0.03;
pub const SPLASH_RADIUS: f32 = 45.;
pub const SPLASH_POTENCY: f32 = 0.6;
pub const STEER_ACCEL: f32 = 600.;
pub const STEER_TURN: f32 = 4.;
pub const GOAL_HOLD: f32 = 0.8;
pub const GOAL_REPLAN: f32 = 55.;
pub const ESCAPE_MARGIN: f32 = 6.;
/// World units, measured from the bomb rim to the nearest hero body boundary.
pub const BOMB_AVOID_BUFFER: f32 = 15.;
/// Keep new attacks and bystanders clear of a moving aim path.
pub const TRACKING_MARGIN: f32 = 20.;
pub const STANDOFF: [f32; 4] = [8., 16., 28., 28.];
/// Ranged heroes keep shooting until a target is closer than this share of their reach.
pub const RANGED_CROWDED: f32 = 0.35;

// Spawn clips in gen/assets.json all hold nine frames at 12 fps.
pub const SPAWN_CLIP: f32 = 0.75;
pub const BOSS_ENTRY_ORIGIN: Vec2 = Vec2::new(ARENA_CENTRE.x, ARENA_CENTRE.y + 370.);
pub const SNIPER_BOLT_SPEED: f32 = 1400.;
pub const PROJECTILE_MARGIN: f32 = 120.;
pub const PROJECTILE_LIFETIME: f32 = 4.;

#[derive(Clone, Copy, Debug)]
pub struct PhaseRule {
    pub hp_below: f32,
    /// Infinity extends a line/cone to the first wall along its aim.
    pub length_scale: f32,
    pub width_scale: f32,
    pub radius_scale: f32,
}
pub const BOSS_PHASE: PhaseRule = PhaseRule {
    hp_below: 0.35,
    length_scale: f32::INFINITY,
    width_scale: 1.,
    radius_scale: 1.5,
};
pub const BOSS_RECHARGE: f32 = 5.;

pub const BOSS_RECHARGE_FLOOR: f32 = 3.5;
pub const ENGAGE_READ_MIN: f32 = 0.3;
pub const ENGAGE_READ_MAX: f32 = 0.6;
pub const LOW_HP_STANDOFF: f32 = 24.;
pub const ENRAGE_RECHARGE: f32 = 0.7;

// Charge has variable target distance; this is its tuned fallback length.
pub const CHARGE_BASE_LENGTH: f32 = 350. + BOSS_BODY_RADIUS;
/// Exponent for countdown growth with telegraph size (1.0 = owner linear fill-speed rule; r9 switches to 1.0 with a rebalance).
pub const COUNTDOWN_GROWTH: f32 = 1.0;

pub fn is_boss(k: Archetype) -> bool {
    matches!(
        k,
        Archetype::Boss | Archetype::BossBomber | Archetype::BossMarksman
    )
}
pub const NOVA_RADIUS: f32 = 230.;
pub const NOVA_LOCK: f32 = 1.8;
pub const BOSS_CAST_REACH: f32 = 600.;

/// Boss KO clip (1.0 s) plays out, then the body lies still before the scene fades.

/// Owner: double only Djinn maximum HP before tier/cycle scaling.
pub const MARKSMAN_HP_MULTIPLIER: f32 = 2.;
pub const MARKSMAN_SUMMON_SNIPERS: u32 = 1;
/// Owner caps on the Djinn's living helpers (snipers first, then lizardos; no fodder).
pub const MARKSMAN_MAX_SNIPERS: u32 = 4;
pub const MARKSMAN_MAX_LIZARDOS: u32 = 2;
/// Owner: the Djinn hits hard, so he shoots at half the shared boss basic-attack rate
/// (both the regular basic cooldown and the shot taken while relocating).
pub const MARKSMAN_BASIC_RATE: f32 = 0.5;
pub fn basic_interval_scale(k: Archetype) -> f32 {
    if k == Archetype::BossMarksman {
        1. / MARKSMAN_BASIC_RATE
    } else if k == Archetype::BossBomber {
        1. / CHIMERA_ATTACK_RATE
    } else {
        1.
    }
}

// Freeze effective boss stats while ordinary enemies gain their own progression.

// R11 offensive skills. Faze diameter is twice the bomb diameter.
pub const SPLIT_RADIUS: f32 = 140.;
pub const SPLIT_POTENCY: f32 = 3.;
pub const FAZE_RADIUS: f32 = BOMB_RADIUS * 2.;
pub const FAZE_DURATION: f32 = 5.;
// Owner Healing Spring: support-only Runa extra, independent of Bubble Pop.
pub const HEALING_SPRING_SECONDS: f32 = 10.;
pub const HEALING_SPRING_FRACTION: f32 = 0.04;
pub const HEALING_SPRING_TICK: f32 = 1.;
pub const FAZE_PULSE: f32 = 1.;
pub const FAZE_POTENCY: f32 = 0.35;

pub const DODGE_BOSS_STANDOFF_COST: f32 = 1000.;
/// Owner: Chimerilass basics use 45% power; bombs/nova stay unchanged.
pub const BOMBER_BASIC_SCALE: f32 = 0.45;

// Kaja offensive special. Fixed independent cooldown; authored countdown follows size trade-off.
pub const ARCANE_PULSE_RADIUS: f32 = 95.;
pub const ARCANE_PULSE_COUNTDOWN: f32 = 0.45;
pub const ARCANE_PULSE_POTENCY: f32 = 2.2;
pub const ARCANE_PULSE_RANGE_NEAR: f32 = 60.;
pub const ARCANE_PULSE_RANGE_FAR: f32 = 235.;
pub const ARCANE_PULSE_RANGE_MAX_MULT: f32 = 2.15;

// Warcry and Ground Pound cost 1 Rage stock; Warcry refreshes a persistent self-ward.
pub const GROUND_POUND_LENGTH: f32 = 300.;
pub const GROUND_POUND_WIDTH: f32 = 80.;
/// Finale erupts once with the line, at its target endpoint.
pub const GROUND_POUND_BURST_RADIUS: f32 = 80.;
pub const GROUND_POUND_COUNTDOWN: f32 = 0.6;
pub const GROUND_POUND_POTENCY: f32 = 2.4;
pub const GROUND_POUND_PUSH: f32 = 30.;
pub const WARCRY_WARD_FRACTION: f32 = 0.30;

// Owner boss identity pass (2026-10-25); regeneration advances only with combat.
pub const MARKSMAN_BASIC_POWER: f32 = 0.5;
pub const CHIMERA_REGEN_INTERVAL: f32 = 30.;
pub const CHIMERA_REGEN_FRACTION: f32 = 0.015;
pub const CHIMERA_REGEN_SECONDS: f32 = 5.;
pub const CHIMERA_REGEN_TICK_SECONDS: f32 = 0.5;

// Owner backline behaviour: body-edge weapon band; movement/perception stay unchanged.
pub const MAGE_STANDOFF_MIN: f32 = 0.70;
pub const MAGE_STANDOFF_GOAL: f32 = 0.90;
pub const MAGE_STANDOFF_MAX: f32 = 0.95;
pub const MAGE_BOSS_MARGIN: f32 = 40.;
pub const MAGE_ENEMY_MARGIN: f32 = 20.;
pub const MAGE_KITE_BUFFER: f32 = 24.;

// Runa proximity passive, independent of Healing Spring. Combat-clock exposure rolls.
pub const BUBBLE_AURA_RADIUS: f32 = 90.;
pub const BUBBLE_AURA_SLOW: f32 = 0.30;
pub const BUBBLE_AURA_BOSS_SLOW: f32 = 0.15;
pub const BUBBLE_AURA_ENCASE_CHANCE: f32 = 0.05;
pub const BUBBLE_AURA_ENCASE_SECONDS: f32 = 1.5;

/// Owner-authored planted throw wind-up; bomb countdown starts after release.
pub const LIZARDO_WINDUP: f32 = 0.4;

// Owner-authored boss enmity (2026-10-25). Hero order Fara/Hondo/Runa/Kaja.
pub const ENMITY_DAMAGE: [f32; 4] = [3., 0.8, 1., 1.];
pub const ENMITY_HEAL: f32 = 0.5;
pub const ENMITY_WARD: f32 = 0.3;
pub const ENMITY_SPIKE_HP: f32 = 0.12;
pub const ENMITY_SPIKE_MULTIPLIER: f32 = 2.;
pub const ENMITY_DECAY: f32 = 0.02;
pub const HONDO_FADE_DECAY: f32 = 0.20;
pub const ENMITY_SWITCH_MARGIN: f32 = 0.10;
pub const ENMITY_RANGED_MARGIN: f32 = 0.30;
pub const ENMITY_SEED: f32 = 10.;
pub const ENMITY_SEED_DISTANCE: f32 = 100.;
pub const ENMITY_TAUNT_MULTIPLIER: f32 = 1.3;

// Owner-authored Troll marching stomp: locked forward circles, fixed fill speed.
pub const STOMP_COUNT: usize = 4;
pub const STOMP_MIN_COUNT: usize = 2;
pub const STOMP_RADIUS: f32 = 75.;
pub const STOMP_FIRST_GAP: f32 = 40.;
pub const STOMP_SPACING: f32 = 120.;
pub const STOMP_STAGGER: f32 = 0.25;
pub const STOMP_DAMAGE: f32 = 0.6;
pub const STOMP_FILL: f32 = STOMP_RADIUS * SLAM_LOCK / SLAM_RADIUS;

/// Freeze unfinished combo work after this much extension beyond the featured action.
pub const SPOTLIGHT_COMBO_EXTRA: f32 = 3.;

/// Owner: one-victim melee swing, fixed aim at start, same reach as before.
pub const BOSS_BASIC_HALF_ANGLE: f32 = 0.45;

// Owner-approved survival/player-action slice (2026-10-25).
pub const BOSS_BASIC_MAX_HP: f32 = 0.4;
pub const HERO_DOWN_HIT_STOP: f32 = 0.15;
pub const HEALING_SPRING_HIT_STOP: f32 = 4. / crate::SIM_HZ as f32;
pub const BOSS_DEATH_HIT_STOP: f32 = 0.4;
pub const PHOENIX_COOLDOWN: f32 = 30.;
pub const REVIVE_BURST_RADIUS: f32 = 140.;
pub const REVIVE_BURST_PUSH: f32 = 35.;
pub const REVIVE_BURST_SLOW: f32 = 0.3;
pub const REVIVE_BURST_SECONDS: f32 = 2.;

// Unused roster identities, scaled by spawn_actor like existing enemies.

pub const ENEMY_POISON_SECONDS: f32 = 5.;
/// Flat enemy poison; only explicit skill/buff potency may multiply this value.
pub const ENEMY_POISON_TICK_DAMAGE: f32 = 4.;
pub const RALLY_RADIUS: f32 = 150.;
pub const RALLY_DEF_MULTIPLIER: f32 = 1.5;

// Owner enemy-healer identity: burst support, ordinary combat-clock commitments.
pub const ENEMY_HEAL_CAST: f32 = 0.8;
pub const MARID_HEAL_MIN: f32 = 0.50;
pub const MARID_HEAL_MAX: f32 = 0.70;
pub const MARID_BOSS_HEAL_MIN: f32 = 0.08;
pub const MARID_BOSS_HEAL_MAX: f32 = 0.12;
pub const MARID_HEAL_INTERVAL: f32 = 10.;
pub const MARID_MAX_ALIVE: usize = 2;
pub const MARID_HOP_WIDTH: f32 = 0.2;
pub const MARID_TRAVEL_SCALE: f32 = 0.8;
pub const MARID_TELEPORT_STEPS: u32 = 60;
pub const MARID_FADE_STEPS: u32 = 18;
pub const MARID_VISIBLE_SECONDS: f32 = 2.5;
pub const MARID_BOLT_DAMAGE: f32 = 12.;
pub const MARID_BOLT_INTERVAL: f32 = 4.5;
pub const MARID_BOLT_REACH: f32 = 320.;
pub const CHIMERA_HEAL_FRACTION: f32 = 0.40;
pub const CHIMERA_HEAL_INTERVAL: f32 = 5.;
pub const CHIMERA_ATTACK_RATE: f32 = 0.7;

// Chimerilass rotates targeted, scatter and an eight-bomb melee fortress.
pub const CHIMERA_BARRAGE_COOLDOWN_SCALE: f32 = 0.5;
pub const CHIMERA_FORTRESS_BOMBS: usize = 8;
pub const CHIMERA_FORTRESS_GAP: f32 = 70.;
pub const BOMB_OPEN_MARGIN: f32 = 8.;

// ORKA-6jh1.39: Rage holds 3 stocks, fills 1 per 10 combat seconds plus landed HP/ward hits.
// Both skills cost 1; Warcry takes priority, Ground Pound requires no Warcry reason.
pub const WARD_INTERVAL: f32 = 30.; // Legacy Stats metadata; groove dispatch never reads it.
pub const GROOVE_START_METER: f32 = 0.;
pub const RAGE_FILL_SECONDS: f32 = 10.;
pub const RAGE_STOCK_CAP: f32 = 3.;
pub const RAGE_HIT_FLAT: f32 = 0.04;
pub const RAGE_HIT_CAP: f32 = 0.30;
// Passive fallback matches Rage; landed basics still add their existing gains.
pub const COMBO_FILL_SECONDS: f32 = 10.;
pub const SUPER_FILL_SECONDS: f32 = 10.;
pub const COMBO_BASIC_GAIN: f32 = 0.1;
pub const SUPER_BASIC_GAIN: f32 = 1. / 7.;
pub const POWER_STOCK_SECONDS: f32 = 6.5 / 1.15;
pub const COMBO_SECONDS: f32 = 4.;
pub const COMBO_RADIUS: f32 = 300.;
pub const COMBO_MIN_HOP: f32 = 80.;
pub const COMBO_TURN: f32 = 135. * core::f32::consts::PI / 180.;
pub const SUPER_HEAL_FRACTION: f32 = 0.35;
pub const SUPER_HEAL_THRESHOLD: f32 = 0.60;
