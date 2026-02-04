// DataAdapter.js
// Full clean replacement — Construct 3–compatible
// Safe, validated access layer for data arrays

export const ENEMY_DATA = [
    {
        name: "Gobloc",
        HP: 40,
        ATK: 10,
        DEF: 8,
        MAG: 5,
        RES: 6,
        SPD: 17,
        hp_red: 20,
        hp_blue: 30,
        hp_green: 50
    },
    {
        name: "High Gobloc",
        HP: 70,
        ATK: 14,
        DEF: 10,
        MAG: 8,
        RES: 12,
        SPD: 15,
        hp_red: 30,
        hp_blue: 50,
        hp_green: 35
    },
    {
        name: "Lizardo",
        HP: 65,
        ATK: 18,
        DEF: 10,
        MAG: 4,
        RES: 6,
        SPD: 10,
        hp_red: 50,
        hp_blue: 30,
        hp_green: 60
    },
    {
        name: "Orc",
        HP: 60,
        DEF: 14,
        ATK: 12,
        MAG: 6,
        RES: 8,
        SPD: 8,
        hp_red: 35,
        hp_blue: 70,
        hp_green: 90
    },
    {
        name: "High Orc",
        HP: 95,
        ATK: 20,
        DEF: 18,
        MAG: 8,
        RES: 15,
        ATK: 8,
        hp_red: 60,
        hp_blue: 100,
        hp_green: 70
    },
    {
        name: "Chimerilass",
        HP: 105,
        ATK: 18,
        DEF: 15,
        MAG: 8,
        RES: 6,
        SPD: 20,
        hp_red: 80,
        hp_blue: 105,
        hp_green: 35
    },
    {
        name: "Troll",
        HP: 35,
        ATK: 55,
        DEF: 22,
        hp_red: 5,
        hp_blue: 60,
        hp_green: 70
    },
    {
        name: "Skeleton",
        HP: 60,
        DEF: 18,
        ATK: 14,
        hp_red: 55,
        hp_blue: 60,
        hp_green: 100
    },
    {
        name: "Djinn",
        MAG: 6,
        DEF: 4,
        ATK: 14,
        hp_red: 70,
        hp_blue: 25,
        hp_green: 60
    },
    {
        name: "Marid",
        DEF: 22,
        ATK: 6,
        hp_red: 4,
        hp_blue: 28,
        hp_green: 18
    }
];

/* ───────────── ENEMY DATA ───────────── */

export function GetEnemyDataSafe(runtime, enemyName) {
    const arr = runtime.objects.EnemyArray?.getFirstInstance();
    if (!arr || arr.width === 0) {return null;}

    for (let x = 0; x < arr.width; x++) {
        if (arr.getAt(x, 0, 0) === enemyName) {
            return {
                name: arr.getAt(x, 0, 0),
                HP: Number(arr.getAt(x, 1, 0)) || 0,
                ATK: Number(arr.getAt(x, 2, 0)) || 0,
                DEF: Number(arr.getAt(x, 3, 0)) || 0,
                MAG: Number(arr.getAt(x, 4, 0)) || 0,
                RES: Number(arr.getAt(x, 5, 0)) || 0,
                SPD: Number(arr.getAt(x, 6, 0)) || 0
            };
        }
    }

    return null;
}

/* ───────────── VALIDATION ───────────── */

export function ValidateEnemyArray(runtime) {
    const arr = runtime.objects.EnemyArray?.getFirstInstance();
    if (!arr) {return false;}

    // Expected schema:
    // X = enemy rows
    // Y = stats
    const expectedHeight = 7;

    if (arr.height !== expectedHeight) {return false;}
    if (arr.width <= 0) {return false;}

    return true;
}
