// main.js
// Entry point - all JS files must be imported here

import "./UI_Logic.js";
import "./EventHandlers.js";
import "./CombatLogic.js";

runOnStartup(runtime => {
    console.log("[MAIN] runOnStartup fired - JS loading confirmed");

    runtime.addEventListener("beforelayoutstart", () => {
        console.log("[MAIN] layout starting");
    });
});
