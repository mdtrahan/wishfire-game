// Skill_Sheet.js
// Full clean replacement — Construct 3–compatible
// Skill execution layer (called by ResolveGemAction / EventHandlers)

/* ───────────── PARTY BUFFS ───────────── */

export function Party_DEF_UP(runtime, turns, actorUID, actorType, addAmt) {
    const g = runtime.globalVars;
    const amt = Math.trunc(addAmt);

    g.PartyBuff_DEF = Math.min(g.PartyBuffCap_DEF, g.PartyBuff_DEF + amt);
    g.BuffTurns_DEF = turns;

    runtime.callFunction("Update_Bars");
    runtime.callFunction("RefreshPartyBuffUI");
    runtime.callFunction("ProcessCurrentTurn");
}

export function Party_SPD_UP(runtime, turns, actorUID, actorType, addAmt) {
    const g = runtime.globalVars;
    const amt = Math.trunc(addAmt);

    g.PartyBuff_SPD = Math.min(g.PartyBuffCap_SPD, g.PartyBuff_SPD + amt);
    g.BuffTurns_SPD = turns;

    runtime.callFunction("Update_Bars");
    runtime.callFunction("RefreshPartyBuffUI");
    runtime.callFunction("ProcessCurrentTurn");
}

export function Party_ATK_UP(runtime, turns, actorUID, actorType, addAmt) {
    const g = runtime.globalVars;
    const amt = Math.trunc(addAmt);

    g.PartyBuff_ATK = Math.min(g.PartyBuffCap_ATK, g.PartyBuff_ATK + amt);
    g.BuffTurns_ATK = turns;

    runtime.callFunction("Update_Bars");
    runtime.callFunction("RefreshPartyBuffUI");
    runtime.callFunction("ProcessCurrentTurn");
}

export function Party_MAG_UP(runtime, turns, actorUID, actorType, addAmt) {
    const g = runtime.globalVars;
    const amt = Math.trunc(addAmt);

    g.PartyBuff_MAG = Math.min(g.PartyBuffCap_MAG, g.PartyBuff_MAG + amt);
    g.BuffTurns_MAG = turns;

    runtime.callFunction("Update_Bars");
    runtime.callFunction("RefreshPartyBuffUI");
    runtime.callFunction("ProcessCurrentTurn");
}

/* ───────────── ENEMY TARGETING HELPERS ───────────── */

function getSelectedEnemy(runtime) {
    for (const e of runtime.objects.Enemy_Sprite.getAllInstances()) {
        if (e.instVars.IsSelected === 1 && e.instVars.HP > 0) {return e;}
    }
    return null;
}

/* ───────────── SINGLE TARGET ATTACKS ───────────── */

export function Enemy_ATK_Single(runtime, targetUID, actorUID, damage) {
    const target = getSelectedEnemy(runtime);
    if (!target) {
        runtime.callFunction("ProcessCurrentTurn");
        return;
    }

    const dmg = runtime.callFunction(
        "CalculateDamage",
        actorUID,
        target.uid,
        "melee"
    );

    runtime.callFunction("ApplyDamageToTarget", target.uid, dmg);
    runtime.callFunction("ProcessCurrentTurn");
}

export function Enemy_MAG_Single(runtime, targetUID, actorUID, damage) {
    const target = getSelectedEnemy(runtime);
    if (!target) {
        runtime.callFunction("ProcessCurrentTurn");
        return;
    }

    const dmg = runtime.callFunction(
        "CalculateDamage",
        actorUID,
        target.uid,
        "magic"
    );

    runtime.callFunction("ApplyDamageToTarget", target.uid, dmg);
    runtime.callFunction("ProcessCurrentTurn");
}

/* ───────────── AOE ATTACKS ───────────── */

export function Enemy_MAG_AOE(runtime, actorUID, targetUID, damage) {
    const enemies = runtime.objects.Enemy_Sprite
        .getAllInstances()
        .filter(e => e.instVars.HP > 0);

    if (enemies.length === 0) {
        runtime.callFunction("ProcessCurrentTurn");
        return;
    }

    for (const e of enemies) {
        const dmg = runtime.callFunction(
            "CalculateDamage",
            actorUID,
            e.uid,
            "magic"
        );
        runtime.callFunction("ApplyDamageToTarget", e.uid, dmg);
    }

    runtime.callFunction("ProcessCurrentTurn");
}

/* ───────────── PARTY HEAL ───────────── */

export function ApplyPartyHeal(runtime, healAmount) {
    const g = runtime.globalVars;

    g.PartyHP = Math.min(g.PartyMaxHP, g.PartyHP + healAmount);

    runtime.callFunction("SyncPartyHPToHeroes");
    runtime.callFunction("UpdateHeroHPUI");
    runtime.callFunction("UpdatePartyHPText");
    runtime.callFunction("UpdatePartyHPBar");
}

export function DoHeal(runtime, actorUID) {
    let heal = runtime.callFunction("CalculateHeal", actorUID);

    if (runtime.globalVars.ApplyChainToNextHeal === 1) {
        heal = Math.ceil(heal * runtime.globalVars.ChainMultiplier);
        runtime.globalVars.ApplyChainToNextHeal = 0;
    }

    runtime.callFunction("ApplyPartyHeal", heal);
    runtime.callFunction("ProcessCurrentTurn");
}

/* ───────────── STUBS (JSON-DEFINED, SAFE NO-OPS) ───────────── */

export function Enemy_DEF_Down_Single() { }
export function Enemy_ATK_Down_Single() { }
export function Enemy_RES_Down_Single() { }
export function Enemy_SPD_Down_Single() { }
export function Enemy_MAG_DOT_Single() { }
export function Enemy_ATK_AOE() { }
export function ApplyPartyBuff_RES() { }
export function ApplyPartyBuff_SPD() { }
