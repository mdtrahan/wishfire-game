"""Shared diagram data for the editable SVGs and the PDF renderer."""

COLORS = {
    "ink": "#17232D",
    "muted": "#58646D",
    "rule": "#CBD1D0",
    "paper": "#F7F2E8",
    "paper2": "#FCFAF5",
    "cyan": "#00A8B5",
    "violet": "#7357B3",
    "orange": "#DE7A3E",
    "green": "#2E8B68",
    "rose": "#C45262",
    "gold": "#B98522",
}

DIAGRAMS = {
    "core-loop": {
        "title": "The first closed product loop",
        "desc": "Six steps reinforce stage progress around the player's build decisions.",
        "kind": "loop",
        "center": (400, 220),
        "hub": [
            "THE PLAYER’S JOB",
            "Tune the build, accept or sell gear, claim",
            "earned resources, choose a boss attempt, and",
            "improve automatic actions.",
            "COMBAT NEVER WAITS",
        ],
        "nodes": [
            (400, 48, "BOSS GATE", "Beat the boss to advance.", "rose"),
            (640, 128, "LAMP DROP", "Stage rewards produce lamps.", "gold"),
            (640, 312, "ROLL GEAR", "Reveal one item and compare.", "violet"),
            (400, 392, "EQUIP / SELL", "Power up or convert to Gold.", "green"),
            (160, 312, "GROW POWER", "Gear, levels, skills, companions.", "cyan"),
            (160, 128, "AUTO BATTLE", "Heroes fight waves continuously.", "orange"),
        ],
    },
    "combat-authority": {
        "title": "Combat authority and readable cadence",
        "desc": "Simulation resolves truth through four owners; presentation exposes one timed package.",
        "kind": "pipeline",
        "nodes": [
            (40, 55, 165, 82, "STAGE CLOCK", "Fixed-step simulation. Wave and boss state.", "cyan"),
            (225, 55, 165, 82, "ACTOR CADENCE", "Attack interval, skill cooldown, targeting.", "violet"),
            (410, 55, 165, 82, "RESOLUTION", "Damage, heal, death, rewards, next spawn.", "orange"),
            (595, 55, 165, 82, "PRESENTATION QUEUE", "Impact, number, bar, removal. One readable package.", "green"),
        ],
        "timeline": [
            (0.00, "READY"), (0.08, "STRIKE"), (0.20, "IMPACT"), (0.38, "NUMBER"),
            (0.55, "BAR"), (0.72, "DEATH"), (1.20, "READY")
        ],
    },
    "agency-shift": {
        "title": "Agency moves from turns to buildcraft",
        "desc": "Five repeated combat choices become five durable preparation choices.",
        "kind": "comparison",
        "left_title": "CURRENT TURN MODEL",
        "right_title": "TARGET IDLE-STAGE MODEL",
        "left": [
            "Choose the acting hero", "Choose attack / heal / card", "Wait through a serialized action",
            "Repeat each actor turn", "Resolve session offer interruptions"
        ],
        "right": [
            "Set three active skills per hero", "Set target and ultimate priorities", "Equip, sell, and level gear",
            "Choose companions and one relic", "Trigger boss attempts and claims"
        ],
    },
    "progression-stack": {
        "title": "Progression arrives in layers",
        "desc": "Each layer earns a combat outcome before the next layer enters scope.",
        "kind": "stack",
        "layers": [
            ("STAGE", "Waves, boss gates, chapters / first authority", "cyan"),
            ("PARTY", "Levels, roles, formation, presets / existing + adapt", "green"),
            ("GEAR", "Six slots, rarity, stats, sell value / existing + lamp", "gold"),
            ("SKILLS", "Three actives, cooldowns, ultimate / adapt current kits", "violet"),
            ("COMPANIONS", "Two passive / trigger slots / new after core", "rose"),
            ("META", "One mount or relic track / phase 4", "orange"),
            ("LIVE OPS", "Dailies, one event, seasons / last", "cyan"),
        ],
    },
    "lamp-gear-flow": {
        "title": "One lamp becomes one durable gear decision",
        "desc": "A deterministic roll ends in exactly one persisted equip or sell outcome.",
        "kind": "branch",
        "nodes": [
            (40, 90, 105, 64, "1  EARN", "Wave or boss grants lamps.", "cyan"),
            (165, 90, 105, 64, "2  OPEN", "Consume one lamp.", "gold"),
            (290, 90, 105, 64, "3  ROLL", "Rarity + slot + affixes.", "violet"),
            (415, 90, 125, 64, "4  COMPARE", "Show CP and stat delta.", "orange"),
            (610, 40, 130, 64, "5A  EQUIP", "Replace item; recalc CP.", "green"),
            (610, 145, 130, 64, "5B  SELL", "Convert to Gold", "rose"),
        ],
    },
    "offline-ledger": {
        "title": "Offline settlement behaves like a bank ledger",
        "desc": "A time window becomes one capped reward and one idempotent claim.",
        "kind": "pipeline",
        "nodes": [
            (40, 82, 165, 82, "SESSION CLOSE", "Store stage, power snapshot, server time.", "cyan"),
            (225, 82, 165, 82, "ELAPSED WINDOW", "Clamp duration; exclude paused or invalid time.", "violet"),
            (410, 82, 165, 82, "REWARD CALC", "Rate x eligible time with caps.", "gold"),
            (595, 82, 165, 82, "ATOMIC CLAIM", "One claim key; commit once.", "green"),
        ],
    },
    "module-map": {
        "title": "One owner for each rule",
        "desc": "Deterministic content and rules feed stage authority; presentation may lag without changing truth.",
        "kind": "stack",
        "layers": [
            ("CONTENT", "heroes, enemies, stages, drops / existing data + new tables", "cyan"),
            ("RULES", "cadence, targeting, damage, loot / shared deterministic core", "violet"),
            ("SESSION", "wave state, boss gate, claims / new stage authority", "gold"),
            ("PRESENTATION", "sprites, VFX, numbers, UI / adapt current queue", "green"),
            ("PERSISTENCE", "save, inventory, receipts / extend storage; add ledger", "rose"),
        ],
    },
    "roadmap": {
        "title": "Six proofs gate the migration",
        "desc": "Each phase ends with a playable proof; P2 is the first go / no-go milestone.",
        "kind": "timeline",
        "phases": [
            ("P0", "CONTRACT", "Write state model, timing rules,|reward tables, save migration.", "cyan"),
            ("P1", "STAGE PROOF", "1-1 waves > boss > 1-2;|four heroes auto-fight.", "violet"),
            ("P2", "LAMP PROOF", "Drop, roll, compare, equip/sell,|CP update, persistence.", "gold"),
            ("P3", "RETURN PROOF", "Capped offline claim, daily reset,|deterministic replay.", "green"),
            ("P4", "DEPTH PROOF", "Automatic skills, two companions,|one meta track.", "rose"),
            ("P5", "SERVICE PROOF", "One event; identity/backend/|telemetry decision.", "orange"),
        ],
    },
}
