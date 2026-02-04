# Construct 3 JavaScript‑First Architecture (Minimal Event Sheets)

This document specifies how to build and run a game in Construct 3 where gameplay logic is written in JavaScript modules, with zero or minimal event sheet usage. The design is white‑label and does not assume any specific game theme or assets. [page:1]

---

## 1. Goals and Constraints

- Implement all gameplay logic in JavaScript ES modules, not event sheets. [page:1]
- Treat Construct 3 as:
  - A runtime host (`runtime` object, events, tick loop). [page:1]
  - A renderer and object instance manager (layouts, sprites, object types). [page:1]
  - A provider of engine APIs (input, effects, pathfinding, etc.). [page:1]
- Allow external tools (for example, a Node.js converter) to generate JS data modules from Construct JSON. [page:1]
- Keep module and symbol names neutral (for example, `Actor`, `Enemy`, `Projectile`, `GameState`) so the architecture can be reused across multiple titles. [page:1]

Event sheets may exist only for legacy reasons or a trivial bootstrapping bridge. No new gameplay logic is added to event sheets. [page:1]

---

## 2. Script File Layout in Construct 3

Create the following scripts in the Construct project’s **Scripts** folder: [page:1]

- `main.js`  
  - Purpose: **Main script** (only this file uses this purpose).  
  - Role: engine entry point and high‑level wiring. [page:1]

- `logicCore.js`  
  - Purpose: standard module.  
  - Role: per‑frame update loop, input handling, high‑level gameplay flow. [page:1]

- `entities.js`  
  - Purpose: standard module.  
  - Role: neutral entity abstractions, optional subclassing of Construct instances. [page:1]

- `runtimeAdapter.js`  
  - Purpose: standard module.  
  - Role: mapping neutral game data (for example, layouts, object definitions) to Construct’s `runtime` and object types. [page:1]

- `utils.js`  
  - Purpose: standard module.  
  - Role: reusable math and helper functions. [page:1]

Additional optional modules:

- `state.js` – neutral `GameState` definition and helpers.  
- `config.js` – configuration values and constants, potentially generated from external JSON.  

Only `main.js` should be tagged as “Main script” in Construct; all other modules are imported using ES module syntax. Construct will automatically load the single main script and that script is responsible for importing the rest. [page:1]

---

## 3. Runtime Entry (`main.js`)

### 3.1. Imports

At the top of `main.js`, import other modules and any data modules that an external tool generates:

```js
import * as LogicCore from "./logicCore.js";
import * as RuntimeAdapter from "./runtimeAdapter.js";
import * as Entities from "./entities.js";
import * as Utils from "./utils.js";
```

Imports must be declared at top level, not inside functions. This constraint follows the JavaScript modules model used by Construct. [page:1]

---

## 12. Summary

Under this architecture:

- Construct 3 is a host engine plus object and input API provider. [page:1]
- All gameplay logic runs in JS modules wired through `runOnStartup(runtime)` and a tick event listener. [page:1]
- Event sheets are minimized or eliminated for new logic. [page:1]
- External JSON‑to‑JS conversion is optional but recommended for a fully data‑driven, white‑label pipeline. [page:1]
