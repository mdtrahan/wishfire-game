// CombatLogic.js
// Clean, safe, Construct 3–compatible combat loop
// Full replacement file

runOnStartup(async runtime => {

    let matchProcessed = false;

    function resetMatchLock() {
        matchProcessed = false;
    }

    runtime.addEventListener("tick", async () => {

        if (runtime.globalVars.TapIndex !== 3) {return;}
        if (matchProcessed) {return;}

        const gems = runtime.objects.Gem.getAllInstances();
        const selected = gems.filter(g => g.instVars.Selected === 1);

        if (selected.length === 0) {return;}

        matchProcessed = true;

        const firstColor = selected[0].instVars.elementIndex;
        let mismatch = false;

        for (const g of selected) {
            if (g.instVars.elementIndex !== firstColor) {
                mismatch = true;
                break;
            }
        }

        // ───────────── INVALID MATCH ─────────────
        if (selected.length !== 3 || mismatch) {
            for (const g of selected) {
                g.opacity = 1;
                if (g.behaviors?.Flash) {
                    g.behaviors.Flash.flash(0.08, 0.08, 0.8);
                }
            }
            await runtime.wait(0.25);
            runtime.callFunction("ClearMatchState");
            resetMatchLock();
            return;
        }

        // ───────────── VALID MATCH ─────────────
        runtime.globalVars.matched += 1;
        const txt = runtime.objects.matchedText?.getFirstInstance();
        if (txt) {txt.text = "matched";}

        runtime.globalVars.MatchedColorValue = firstColor;
        runtime.globalVars.SuppressChainUI = false;
        runtime.callFunction("UpdateChain", firstColor);

        const actorUID = runtime.callFunction("GetCurrentTurn");

        switch (firstColor) {

            // RED / GREEN — attack
            case 0:
            case 1: {
                runtime.globalVars.IsAOEMatch = 0;
                runtime.globalVars.TurnPhase = 1;

                runtime.callFunction("ShowAttackUI");
                runtime.callFunction("RefreshSelectors");
                runtime.callFunction("DestroyGem");
                runtime.callFunction("ClearMatchState");
                runtime.callFunction("Sub_Energy");

                runtime.globalVars.ApplyChainToNextDamage =
                    runtime.globalVars.ChainNumber > 2 ? 1 : 0;
                break;
            }

            // BLUE — defensive
            case 2: {
                runtime.globalVars.IsAOEMatch = 0;

                runtime.callFunction("DestroyGem");
                runtime.callFunction("ClearMatchState");
                runtime.callFunction("Sub_Energy");
                runtime.callFunction("HideAttackUI");

                runtime.callFunction("ResolveGemAction", 2, actorUID);
                break;
            }

            // GOLD — currency
            case 3: {
                runtime.callFunction("AddGoldToPlayer", Math.floor(runtime.random(1, 45)));
                runtime.callFunction("DestroyGem");
                runtime.callFunction("ClearMatchState");
                runtime.callFunction("ProcessCurrentTurn");
                break;
            }

            // PURPLE — heal AOE
            case 4:
            case 6: {
                runtime.globalVars.IsAOEMatch = 0;

                runtime.callFunction("DestroyGem");
                runtime.callFunction("ClearMatchState");
                runtime.callFunction("Sub_Energy");

                runtime.callFunction("ResolveGemAction", firstColor, actorUID);
                break;
            }

            // ENERGY
            case 5: {
                runtime.callFunction("DestroyGem");
                runtime.callFunction("ClearMatchState");
                runtime.callFunction("Add_Energy");
                runtime.callFunction("ProcessCurrentTurn");
                break;
            }
        }

        resetMatchLock();
    });

    // ───────────── GEM SELECTION HANDLER ─────────────
    runtime.addEventListener("pointerdown", e => {
        if (e.objectType !== "Gem" || e.button !== 0) {return;}

        const g = runtime.globalVars;

        // Only allow selection during hero turn (TurnPhase = 0)
        if (g.TurnPhase !== 0) {return;}

        const gem = e.instance;
        if (!gem) {return;}

        // Don't allow deselection or re-selection
        if (gem.instVars.Selected === 1) {return;}

        // Max 3 gems can be selected
        if (g.TapIndex >= 3) {return;}

        // Mark gem as selected
        gem.instVars.Selected = 1;
        gem.opacity = 0.7;

        // Increment selection count
        g.TapIndex++;

        console.log("[COMBAT] Gem selected, TapIndex: " + g.TapIndex);
    });
});
