// UI_Logic.js
// Owns startup + layout lifecycle

import { InitializeGame, InitializeChainSystem, LoadEnemiesComplete } from "./Initializer.js";

runOnStartup(runtime => {
    console.log("[UI] runOnStartup fired");

    // Handle AJAX response for Enemies.json
    runtime.addEventListener("beforeruntimeunload", () => {
        // Reserved for cleanup
    });

    let initialized = false;

    runtime.addEventListener("tick", () => {
        if (initialized || runtime.globalVars.boardCreated === 1) {return;}

        try {
            InitializeGame(runtime);
            InitializeChainSystem(runtime);
            LoadEnemiesComplete(runtime);
            initialized = true;
            console.log("[UI] Game initialized successfully");
        } catch (e) {
            console.error("[UI] Initialization FAILED:", e.message);
            console.error(e.stack);
        }
    });
});
