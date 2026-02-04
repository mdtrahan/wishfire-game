// Function_Bank.js
// Full clean replacement — Construct 3–compatible
// Central gameplay + combat function library

import { GetEnemyDataSafe } from "./DataAdapter.js";

/* ───────────── UTILITIES ───────────── */

function first(runtime, name) {
    const o = runtime.objects[name];
    return o ? o.getFirstInstance() : null;
}

function all(runtime, name) {
    const o = runtime.objects[name];
    return o ? o.getAllInstances() : [];
}

/* ───────────── POSITIONING ───────────── */

export function SlotX(runtime, i) {
    const g = runtime.globalVars;
    const center = Math.floor(g.Slots / 2);
    return g.X0 + (i - center) * g.Spacing;
}

export function SlotY(runtime, i) {
    const g = runtime.globalVars;
    return g.EnemyAreaY0 + i * g.Spacing;
}

/* ───────────── TURN ORDER ───────────── */

export function BuildTurnOrder(runtime) {
    const arr = first(runtime, "TurnOrderArray");
    if (!arr) {return;}

    const actors = [];

    for (const h of all(runtime, "Heroes")) {
        if (h.instVars.HP > 0) {
            actors.push({
                uid: h.uid,
                spd: Number(h.instVars.SPD) || 0,
                type: 0
            });
        }
    }

    for (const e of all(runtime, "Enemy_Sprite")) {
        if (e.instVars.HP > 0) {
            actors.push({
                uid: e.uid,
                spd: Number(e.instVars.SPD) || 0,
                type: 1
            });
        }
    }

    actors.sort((a, b) => b.spd - a.spd);

    arr.setSize(actors.length * 3, 1, 1);
    arr.clear(0);

    for (let i = 0; i < actors.length; i++) {
        const base = i * 3;
        arr.setAt(base, 0, 0, actors[i].uid);
        arr.setAt(base + 1, 0, 0, actors[i].spd);
        arr.setAt(base + 2, 0, 0, actors[i].type);
    }
}

export function GetCurrentTurn(runtime) {
    const g = runtime.globalVars;
    const arr = first(runtime, "TurnOrderArray");
    if (!arr) {return 0;}
    return arr.getAt(g.CurrentTurnIndex * 3, 0, 0);
}

export function GetCurrentType(runtime) {
    const g = runtime.globalVars;
    const arr = first(runtime, "TurnOrderArray");
    if (!arr) {return 0;}
    return arr.getAt(g.CurrentTurnIndex * 3 + 2, 0, 0);
}

export function ProcessCurrentTurn(runtime) {
    const g = runtime.globalVars;
    const arr = first(runtime, "TurnOrderArray");
    if (!arr) {return;}

    const actorCount = arr.width / 3;
    g.CurrentTurnIndex++;

    if (g.CurrentTurnIndex >= actorCount) {
        g.CurrentTurnIndex = 0;
        BuildTurnOrder(runtime);
    }

    const type = GetCurrentType(runtime);
    g.TurnPhase = type === 0 ? 0 : 2;
}

export function AdvanceTurn(runtime) {
    ProcessCurrentTurn(runtime);
}

/* ───────────── ACTOR HELPERS ───────────── */

export function GetActorByUID(runtime, uid) {
    for (const h of all(runtime, "Heroes")) {
        if (h.uid === uid) {return h;}
    }
    for (const e of all(runtime, "Enemy_Sprite")) {
        if (e.uid === uid) {return e;}
    }
    return null;
}

export function IsHeroTurn(runtime) {
    return GetCurrentType(runtime) === 0;
}

export function IsEnemyTurn(runtime) {
    return GetCurrentType(runtime) === 1;
}

/* ───────────── STATS ───────────── */

export function GetEffectiveStat(runtime, inst, stat) {
    let base = Number(inst.instVars[stat]) || 0;
    const g = runtime.globalVars;

    if (inst.objectType.name === "Heroes") {
        if (stat === "ATK") {base += g.PartyBuff_ATK;}
        if (stat === "DEF") {base += g.PartyBuff_DEF;}
        if (stat === "SPD") {base += g.PartyBuff_SPD;}
        if (stat === "MAG") {base += g.PartyBuff_MAG;}
    }

    return Math.max(0, base);
}

/* ───────────── DAMAGE / HEAL ───────────── */

export function CalculateDamage(runtime, attackerUID, targetUID, mode) {
    const atk = GetActorByUID(runtime, attackerUID);
    const tgt = GetActorByUID(runtime, targetUID);
    if (!atk || !tgt) {return 0;}

    let power = 0;
    let resist = 0;

    if (mode === "magic") {
        power = GetEffectiveStat(runtime, atk, "MAG");
        resist = GetEffectiveStat(runtime, tgt, "RES");
    } else {
        power = GetEffectiveStat(runtime, atk, "ATK");
        resist = GetEffectiveStat(runtime, tgt, "DEF");
    }

    let dmg = Math.max(1, power - resist);
    if (runtime.globalVars.ApplyChainToNextDamage === 1) {
        dmg = Math.ceil(dmg * runtime.globalVars.ChainMultiplier);
        runtime.globalVars.ApplyChainToNextDamage = 0;
    }

    return dmg;
}

export function ApplyDamageToTarget(runtime, uid, dmg) {
    const t = GetActorByUID(runtime, uid);
    if (!t) {return;}

    t.instVars.HP = Math.max(0, t.instVars.HP - dmg);
    UpdateEnemyHPUI(runtime);
    UpdateHeroHPUI(runtime);
}

/* ───────────── HEAL ───────────── */

export function CalculateHeal(runtime, actorUID) {
    const h = GetActorByUID(runtime, actorUID);
    if (!h) {return 0;}
    return Math.max(1, Math.floor(GetEffectiveStat(runtime, h, "MAG") * 0.75));
}

/* ───────────── UI UPDATES ───────────── */

export function UpdateEnemyHPUI(runtime) {
    for (const e of all(runtime, "Enemy_Sprite")) {
        if (e.instVars.HP <= 0) {
            e.isVisible = false;
        }
    }
}

export function UpdateHeroHPUI(runtime) {
    for (const h of all(runtime, "Heroes")) {
        h.instVars.HP = Math.min(h.instVars.HP, h.instVars.maxHP);
    }
}

export function SyncPartyHPToHeroes(runtime) {
    const g = runtime.globalVars;
    const heroes = all(runtime, "Heroes").filter(h => h.instVars.HP > 0);

    if (heroes.length === 0) {return;}

    const totalMaxHP = heroes.reduce((sum, h) => sum + h.instVars.maxHP, 0);
    if (totalMaxHP === 0) {return;}

    const ratio = g.PartyHP / g.PartyMaxHP;

    for (const h of heroes) {
        h.instVars.HP = Math.max(0, Math.min(h.instVars.maxHP, Math.floor(h.instVars.maxHP * ratio)));
    }
}

export function UpdatePartyHPText(runtime) {
    const t = first(runtime, "PartyHP_text");
    if (t) {
        t.text = `${runtime.globalVars.PartyHP}/${runtime.globalVars.PartyMaxHP}`;
    }
}

export function UpdatePartyHPBar(runtime) {
    const bar = first(runtime, "PartyHP_Bar");
    if (!bar) {return;}
    bar.maximum = runtime.globalVars.PartyMaxHP;
    bar.value = runtime.globalVars.PartyHP;
}

/* ───────────── ENERGY / GOLD ───────────── */

export function Sub_Energy(runtime) {
    runtime.globalVars.Player_Energy -= 3;
    const t = first(runtime, "Text_Energy");
    if (t) {t.text = runtime.globalVars.Player_Energy;}
}

export function Add_Energy(runtime) {
    runtime.globalVars.Player_Energy += Math.floor(runtime.random(1, 5));
    const t = first(runtime, "Text_Energy");
    if (t) {t.text = runtime.globalVars.Player_Energy;}
}

export function AddGoldToPlayer(runtime, amt) {
    runtime.globalVars.goldTotal += Math.floor(amt);
    const t = first(runtime, "Text_Gold");
    if (t) {t.text = runtime.globalVars.goldTotal + "g";}
}

/* ───────────── CHAIN ───────────── */

export function UpdateChain(runtime, color) {
    const g = runtime.globalVars;

    if (g.LastMatchColor === color) {g.ChainNumber++;}
    else {g.ChainNumber = 1;}

    g.LastMatchColor = color;
    g.ChainMultiplier = g.ChainNumber >= 3 ? 1.25 : 1;

    const t = first(runtime, "Chain_Tracker");
    if (t) {
        t.isVisible = g.ChainNumber >= 2;
        t.text = "Chain x" + g.ChainNumber;
    }
}

/* ───────────── UI FLOW ───────────── */

export function ShowAttackUI(runtime) {
    runtime.globalVars.TurnPhase = 1;
}

export function HideAttackUI(runtime) {
    runtime.globalVars.TurnPhase = 0;
}

export function DestroyGem(runtime) {
    for (const g of all(runtime, "Gem")) {
        if (g.instVars.Selected === 1) {g.destroy();}
    }
}

export function ClearMatchState(runtime) {
    for (const g of all(runtime, "Gem")) {
        g.instVars.Selected = 0;
        g.opacity = 1;
    }
    runtime.globalVars.TapIndex = 0;
}

export function RefreshSelectors(runtime) {
    for (const s of all(runtime, "Selector")) {
        s.isVisible = true;
    }
}

export function Update_Bars(runtime) {
    UpdatePartyHPBar(runtime);
    UpdatePartyHPText(runtime);
}

export function RefreshPartyBuffUI(runtime) {
    const g = runtime.globalVars;

    const buff1 = first(runtime, "buffIcon1");
    const buff2 = first(runtime, "buffIcon2");
    const buff3 = first(runtime, "buffIcon3");
    const buff4 = first(runtime, "buffIcon4");

    if (buff1) {buff1.isVisible = g.PartyBuff_ATK > 0 && g.BuffTurns_ATK > 0;}
    if (buff2) {buff2.isVisible = g.PartyBuff_DEF > 0 && g.BuffTurns_DEF > 0;}
    if (buff3) {buff3.isVisible = g.PartyBuff_SPD > 0 && g.BuffTurns_SPD > 0;}
    if (buff4) {buff4.isVisible = g.PartyBuff_MAG > 0 && g.BuffTurns_MAG > 0;}
}

/* ───────────── GEM RESOLUTION ───────────── */

export function ResolveGemAction(runtime, gemColor, actorUID) {
    if (gemColor === 2) {
        runtime.callFunction("Party_DEF_UP", 2, actorUID, 0, 2);
        return;
    }

    if (gemColor === 4 || gemColor === 6) {
        runtime.callFunction("DoHeal", actorUID);
        runtime.callFunction("ProcessCurrentTurn");
    }
}

export function DebugTest(runtime) {
    const g = runtime.globalVars;
    const gems = runtime.objects.Gem.getAllInstances();

    let info = "=== GEM DEBUG ===\n";
    info += "boardCreated: " + g.boardCreated + "\n";
    info += "Total gems: " + gems.length + "\n";
    info += "gx: " + g.gx + ", gy: " + g.gy + "\n";
    info += "cols: " + g.cols + ", rows: " + g.rows + "\n";
    info += "cellSize: " + g.cellSize + ", gap: " + g.gap + "\n\n";

    for (let i = 0; i < Math.min(5, gems.length); i++) {
        const gem = gems[i];
        info += "Gem " + i + ": frame=" + gem.animationFrame + ", visible=" + gem.isVisible + ", x=" + Math.round(gem.x) + ", y=" + Math.round(gem.y) + "\n";
    }

    if (gems.length > 5) {
        info += "... and " + (gems.length - 5) + " more\n";
    }

    alert(info);
}
