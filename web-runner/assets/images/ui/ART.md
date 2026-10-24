# Bag modal controls

Bag modal close controls are CSS-drawn rounded squares with centered X labels. Reference-derived close raster art was rejected and removed from runtime.

`bag-tier-medallion.png` recreates the circular slate chest medallion from the owner's supplied menu revision. Preserve its outlined chest and double ring. Its alpha padding is presentation-only; the level strip crops the padded image to the visible circular medallion.

The medallion raster was generated from the supplied references in the 2026-10-18 design session and reduced to a 256px derivative for runtime. The original Bag artwork remains `../lamp/equipment-bag.png`; no new Bag illustration replaces it.

The owner menu PNG has an embedded Display ICC profile. Convert its unlettered pill interiors to sRGB before using CSS values: Common #666666, Uncommon #018a54, Rare #1c8fa9, Epic #d7673d, Legendary #b83241. Raw unconverted RGB samples mute the palette and do not match the displayed reference.

# Buff signals

`buff-signals.png` is the owner-approved bitmap sheet (2026-10-23, from the ORKA-x2g cooldown mockups): 6x3 grid of 48px cells. Rows 1-2 and the first two cells of row 3 are party stat icons; the next three cells are the hero Tempo, Offense and Defense group badges. Frame order is owned by `src/core/buffSignalRules.mjs`. Bitmap only; there are no debuff icons.
