# Lamp art provenance

Original image_gen illustrations referenced against the existing Wishfire character art. Runtime uses the lamp only; collector cells are unused.

Gear atlas: three columns (Guardian burgundy/brass, Scholar teal/ivory, Wayfarer moss/tan) by three rows (Hat, Body, Boots). Device atlas: two by two, with the runtime lamp in the upper-left cell. CSS selects original atlas cells without recoloring the illustrations.

```json
[
  {
    "file": "gear-atlas.png",
    "width": 1254,
    "height": 1254,
    "bytes": 1949363,
    "sha256": "c4dad04ac389cbf847684e011cdc0a9e46b50d8cf3815567f7ef9b66e902ff9f"
  },
  {
    "file": "device-atlas.png",
    "width": 1254,
    "height": 1254,
    "bytes": 1412484,
    "sha256": "3b33a72832fbd77ea9e20e4a1ae8ad766d1a251d4dcb011c33885c0f342e0a04"
  }
]
```

## Genie tutorial pointer
`genie-pointer.png` is original generated art referenced from the existing Hondo character: sky-blue skin, cel-shaded outline and gold cuff. The index finger points upper-left; CSS owns the bob and cyan rings. Source generation: exec-03c18890-e6b8-4548-9b9e-8d2142d6a7de.png, preserved in the Codex generated image directory.

Pointer SHA-256: `7040e2a38c56bf7285bad2661c33e530beb233397bd87fa8eea85d0a7493776d`. Generated at 1254×1254 with transparency; runtime scales the image to 48–80 CSS pixels.

## Essence reward orb
`essence-orb.png` is original built-in imagegen art generated 2026-09-30, source `exec-b54e7003-0904-4b18-aa57-21abc2dbcc2c.png`. Prompt: one turquoise magical essence orb containing a cyan wisp, small gold/brass crescent cradle, bold dark outline, clean cel shading, broad color blocks and cream highlights matching the Wishfire genie lamp; transparent background, no text or UI frame. Displayed only after saved dismantling.

## Owner-supplied strip redesign

`lamp.png` is the unchanged transparent PNG supplied from the owner Desktop, SHA-256 `a332bf8a7a8dc992077b6e5f0b9ea62d57a8fb6edffc9d537a8f62ed0d22c4b3`.
`equip-puff.png` is the unchanged transparent PNG supplied from the owner Desktop, SHA-256 `26d0b30b6926140efb1b288770c4dac8851dabfddeb1259ae7f23953ecb3a3e8`.

Auto pills, the speech counter, level disc and essence progress bar are CSS, with real accessible text. No SVG assets.
