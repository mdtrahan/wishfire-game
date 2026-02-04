// EventHandlers.js
// Full clean replacement — Construct 3–compatible
// Registers all runtime.callFunction bridges and layout math

import * as FN from "./Function_Bank.js";
import * as SK from "./Skill_Sheet.js";
import * as FN from "./Function_Bank.js";
import { InitializeGame, InitializeChainSystem, LoadEnemiesComplete, ClearEnemies, SpawnWave: SpawnEnemies, BuildTurnOrder, GetCurrentTurn } from "./Initializer.js";

runOnStartup(runtime => {

    // Ensure function table exists
    if (!runtime.functions) {runtime.functions = {};}

    /* ───────────── ENEMY LAYOUT ───────────── */

    runtime.functions.ComputeEnemyLayout = () => {
        const g = runtime.globalVars;
        const area = runtime.objects.EnemyArea.getFirstInstance();
        if (!area) {return;}

        g.Slots = 3;
        g.MARGIN = 8;
        g.enemyGAP = 8;
        g.EnemyRowGap = g.enemyGAP;

        g.EnemyAreaLeft = area.x - area.width / 2;
        g.EnemyAreaRight = area.x + area.width / 2;
        g.EnemyAreaTop = area.y - area.height / 2;
        g.EnemyAreaBottom = area.y + area.height / 2;
        g.EnemyAreaCX = area.x;
        g.EnemyAreaCY = area.y;

        const vw = g.EnemyAreaRight - g.EnemyAreaLeft;
        const vh = g.EnemyAreaBottom - g.EnemyAreaTop;

        const sizeW = (vw - 2 * g.MARGIN - (g.Slots - 1) * g.enemyGAP) / g.Slots;
        const sizeH = (vh - 2 * g.MARGIN - 2 * g.EnemyRowGap) / 3;

        g.EnemySize = Math.floor(Math.min(sizeW, sizeH));
        g.Spacing = g.EnemySize + g.enemyGAP;
        g.X0 = g.EnemyAreaCX;
        g.EnemyAreaY0 = g.EnemyAreaTop + g.MARGIN + g.EnemySize / 2;
        g.OffscreenX = g.EnemyAreaRight + g.EnemySize;
    };

    /* ───────────── FUNCTION EXPORT ───────────── */

    Object.assign(runtime.functions, {
        SlotX: FN.SlotX,
        SlotY: FN.SlotY,
        GetCurrentTurn: FN.GetCurrentTurn,
        GetCurrentType: FN.GetCurrentType,
        Sub_Energy: FN.Sub_Energy,
        Add_Energy: FN.Add_Energy,
        UpdatePartyHPBar: FN.UpdatePartyHPBar,
        AdvanceTurn: FN.AdvanceTurn,
        BuildTurnOrder: FN.BuildTurnOrder,
        ProcessCurrentTurn: FN.ProcessCurrentTurn,
        AddGoldToPlayer: FN.AddGoldToPlayer,
        GetActorByUID: FN.GetActorByUID,
        GetEffectiveStat: FN.GetEffectiveStat,
        IsHeroTurn: FN.IsHeroTurn,
        IsEnemyTurn: FN.IsEnemyTurn,
        CalculateDamage: FN.CalculateDamage,
        CalculateHeal: FN.CalculateHeal,
        ApplyDamageToTarget: FN.ApplyDamageToTarget,
        UpdateChain: FN.UpdateChain,
        ShowAttackUI: FN.ShowAttackUI,
        HideAttackUI: FN.HideAttackUI,
        DestroyGem: FN.DestroyGem,
        ClearMatchState: FN.ClearMatchState,
        RefreshSelectors: FN.RefreshSelectors,
        Update_Bars: FN.Update_Bars,
        ResolveGemAction: FN.ResolveGemAction,
        UpdateEnemyHPUI: FN.UpdateEnemyHPUI,
        UpdateHeroHPUI: FN.UpdateHeroHPUI,
        UpdatePartyHPText: FN.UpdatePartyHPText,
        SyncPartyHPToHeroes: FN.SyncPartyHPToHeroes,
        RefreshPartyBuffUI: FN.RefreshPartyBuffUI,
        Party_DEF_UP: SK.Party_DEF_UP,
        Party_SPD_UP: SK.Party_SPD_UP,
        Party_ATK_UP: SK.Party_ATK_UP,
        Party_MAG_UP: SK.Party_MAG_UP,
        Enemy_ATK_Single: SK.Enemy_ATK_Single,
        Enemy_MAG_Single: SK.Enemy_MAG_Single,
        Enemy_MAG_AOE: SK.Enemy_MAG_AOE,
        ApplyPartyHeal: SK.ApplyPartyHeal,
        DoHeal: SK.DoHeal,
        InitPartyHPFromHeroes: (runtime) => {
            const heroes = runtime.objects.Heroes.getAllInstances();
            let totalHP = 0;
            let totalMaxHP = 0;
            for (const h of heroes) {
                totalHP += h.instVars.HP;
                totalMaxHP += h.instVars.maxHP;
            }
            const g = runtime.globalVars;
            g.PartyHP = totalHP;
            g.PartyMaxHP = totalMaxHP;
        },
        DebugTest: FN.DebugTest,
        LoadEnemiesComplete: LoadEnemiesComplete,
        PickNextEnemyID: PickNextEnemyID,
        SpawnEnemy: SpawnEnemy
    });
});
