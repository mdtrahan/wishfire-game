#!/usr/bin/env bash
# Build the Rust app for the browser and stage rust/wf_app/web/ for static serving.
# Steps: pack puppets/arenas into the atlas, build wf_app for wasm32, stage art and wasm.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TC="$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin"
if [[ -x "$TC/cargo" ]]; then export RUSTC="$TC/rustc"; export PATH="$TC:$PATH"; CARGO="$TC/cargo"; else CARGO=cargo; fi
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$ROOT/rust/target}"
APP="$ROOT/rust/wf_app"
WEB="$APP/web"
cd "$ROOT/rust"
"$CARGO" build -p wf_pack --release
"$CARGO_TARGET_DIR/release/wf_pack" --src "$ROOT/web-runner/assets" --out "$APP/gen"
"$CARGO" build -p wf_app --target wasm32-unknown-unknown --profile wasm-release
mkdir -p "$WEB/gen" "$WEB/art"
rsync -a --delete "$APP/gen/" "$WEB/gen/"
# Runtime art is main's rust-combat bundle, read-only; staged by reference copy.
rsync -a --delete --exclude='PROVENANCE.md' --exclude='vfx.json' "$ROOT/web-runner/assets/rust-combat/" "$WEB/art/"
mkdir -p "$WEB/art/wishfire-skills" "$WEB/data"
cp -p "$ROOT/web-runner/assets/enemies.json" "$WEB/data/enemies.json"
cp -p "$ROOT/web-runner/assets/images/vfx_impact_g03_purple.png" "$WEB/art/wishfire-skills/vfx_impact_g03_purple.png"
# Canvas chrome art (wf_app assets::UI_ART): boss HUD icons, hero portraits, buff sheet, lamp strip.
# Canvas typography (ui/text.rs, HUD + narrative): Inter Regular, OFL; the license travels with the font.
mkdir -p "$WEB/art/fonts"
rm -f "$WEB"/art/fonts/Inter-*.ttf
cp -p "$ROOT/web-runner/assets/fonts/Inter-Regular.ttf" "$ROOT/web-runner/assets/fonts/Inter-OFL.txt" "$WEB/art/fonts/"
mkdir -p "$WEB/art/ui"
rm -f "$WEB"/art/ui/nav-*.png "$WEB"/art/ui/prog-stat-*.png "$WEB/art/ui/prog-training-scene.png" "$WEB/art/ui/story-map.png" "$WEB/art/ui/story-token.png" "$WEB/art/ui/bag-medallion.png"
IMG="$ROOT/web-runner/assets/images"
for n in boss clock inspect; do cp -p "$IMG/boss-hud/$n.png" "$WEB/art/ui/boss-$n.png"; done
for n in Fara Hondo Runa Kaja; do cp -p "$IMG/$n.png" "$WEB/art/ui/hero-$n.png"; done
cp -p "$IMG/ui/buff-signals.png" "$WEB/art/ui/buff-signals.png"
cp -p "$IMG/lamp/gear-atlas.png" "$WEB/art/ui/lamp-gear-atlas.png"
cp -p "$IMG/lamp/equipment-bag.png" "$WEB/art/ui/lamp-bag.png"
cp -p "$IMG/lamp/essence-orb.png" "$WEB/art/ui/lamp-essence.png"
for n in incense hero-tickets; do cp -p "$IMG/progression/$n.png" "$WEB/art/ui/prog-$n.png"; done
cp -p "$ROOT/web-runner/assets/gems/coin.png" "$WEB/art/ui/coin.png"
for n in hondo fara kaja runa; do cp -p "$ROOT/web-runner/assets/narrative/characters/$n.png" "$WEB/art/ui/story-$n.png"; done
# Menu art for the page elements (ui/dom.rs menus), at main's own paths under assets/.
mkdir -p "$WEB/assets/images" "$WEB/assets/gems" "$WEB/assets/narrative"
for d in navigation progression lamp ui; do rsync -a --delete --exclude='*.md' "$IMG/$d/" "$WEB/assets/images/$d/"; done
for n in Fara Hondo Runa Kaja; do cp -p "$IMG/$n.png" "$WEB/assets/images/$n.png"; done
cp -p "$ROOT/web-runner/assets/gems/coin.png" "$WEB/assets/gems/coin.png"
rsync -a --delete "$ROOT/web-runner/assets/narrative/" "$WEB/assets/narrative/"
WASM_TMP="$(mktemp "$WEB/.wf_app.wasm.XXXXXX")"
trap 'rm -f "$WASM_TMP"' EXIT
cp -p "$CARGO_TARGET_DIR/wasm32-unknown-unknown/wasm-release/wf_app.wasm" "$WASM_TMP"
mv "$WASM_TMP" "$WEB/wf_app.wasm"
ls -la "$WEB/wf_app.wasm"
