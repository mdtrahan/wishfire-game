// EnemySpawner.js
// Self-contained enemy spawning system
// No dependency on event-sheet global variables

import { ENEMY_DATA } from "./DataAdapter.js";

export class EnemySpawner {
    constructor(runtime, options = {}) {
        this.runtime = runtime;
        this.globalVars = runtime.globalVars;
        
        this.layerName = options.layerName || "Enemies";
        this.slots = options.slots || 3;
        
        this.startX = options.startX || 100;
        this.spacingX = options.spacingX || 80;
        this.y = options.y || 120;
        
        this.enemySlotsArray = null;
    }

    getSlotPosition(slotIndex) {
        return {
            x: this.startX + (slotIndex * this.spacingX),
            y: this.y
        };
    }

    spawnEnemy(enemyData, slotIndex) {
        const pos = this.getSlotPosition(slotIndex);

        const enemy = this.runtime.objects.Enemy_Sprite.createInstance(
            this.layerName,
            pos.x,
            pos.y
        );

        if (!enemy) {
            console.log("[ENEMY_SPAWNER] Failed to create enemy: " + enemyData.name);
            return null;
        }

        enemy.instVars.HP = enemyData.HP;
        enemy.instVars.maxHP = enemyData.HP;
        enemy.instVars.ATK = enemyData.ATK;
        enemy.instVars.DEF = enemyData.DEF;
        enemy.instVars.MAG = enemyData.MAG;
        enemy.instVars.RES = enemyData.RES;
        enemy.instVars.SPD = enemyData.SPD;
        enemy.instVars.name = enemyData.name;
        enemy.instVars.IsSelected = 0;
        enemy.instVars.IsBlocked = 0;
        enemy.instVars.action = "";
        enemy.instVars.hp_red = enemyData.hp_red || 0;
        enemy.instVars.hp_blue = enemyData.hp_blue || 0;
        enemy.instVars.hp_green = enemyData.hp_green || 0;

        enemy.stopAnimation();

        return enemy;
    }

    storeEnemyUID(slotIndex, enemyUID) {
        const enemySlots = this.runtime.objects.EnemySlots?.getFirstInstance();
        if (enemySlots && typeof enemySlots.setAt === "function") {
            enemySlots.setAt(slotIndex, 0, 0, enemyUID);
        }
    }

    spawnRandomWave() {
        const enemies = [];

        for (let s = 0; s < this.slots; s++) {
            let attempts = 0;
            let spawned = false;

            while (attempts < 10 && !spawned) {
                attempts++;
                const randomIndex = Math.floor(Math.random() * ENEMY_DATA.length);
                const enemyData = ENEMY_DATA[randomIndex];

                const enemy = this.spawnEnemy(enemyData, s);
                if (enemy) {
                    this.storeEnemyUID(s, enemy.uid);
                    console.log("[ENEMY_SPAWNER] Spawned " + enemyData.name + " in slot " + s);
                    spawned = true;
                }
            }

            if (!spawned) {
                console.log("[ENEMY_SPAWNER] Failed to spawn enemy in slot " + s);
            }
        }

        console.log("[ENEMY_SPAWNER] Spawned " + enemies.length + " enemies");
        return enemies;
    }

    clearAllEnemies() {
        const enemySprites = this.runtime.objects.Enemy_Sprite?.getAllInstances();
        
        for (const enemy of enemySprites) {
            enemy.destroy();
        }

        const enemySlots = this.runtime.objects.EnemySlots?.getFirstInstance();
        if (enemySlots && typeof enemySlots.clear === "function") {
            enemySlots.clear(0);
        }

        console.log("[ENEMY_SPAWNER] Cleared all enemies");
    }
}

export function SpawnEnemies(runtime, options = {}) {
    const spawner = new EnemySpawner(runtime, options);
    return spawner.spawnRandomWave();
}

export function ClearEnemies(runtime) {
    const spawner = new EnemySpawner(runtime);
    return spawner.clearAllEnemies();
}
