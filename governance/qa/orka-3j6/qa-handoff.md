# ORKA-3j6 QA Packet

Test URL: http://127.0.0.1:8011/web-runner/
Viewport: 360x640

## Deterministic checks
1. Replacement path: Hero nav click transitions `combat -> heroLayout` with `overlayVisible=false`.
2. Arrow loop: right-click sequence wraps `Falie -> Huun -> Runa -> Kojonn -> Falie`; left-click from Falie wraps to Kojonn.
3. Runtime hero stat source and hero identity snapshots captured in `runtime-heroes.json`.
4. Visual parity screenshots captured for all four heroes.
5. First-skill title mapping target: Falie=Pummel, Huun=Swipe, Runa=Burst, Kojonn=Faze.

## Artifacts
- assertions.json
- combat-flags.json
- hero-open-flags.json
- hero-0.json .. hero-5-loop-reverse.json
- runtime-heroes.json
- hero-0-falie.png
- hero-1-huun.png
- hero-2-runa.png
- hero-3-kojonn.png
- hero-5-reverse-kojonn.png
