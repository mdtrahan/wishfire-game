#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ALL=false
# One verifier run per PR, against the complete diff from the pinned main base.
# Fail closed on presentation-owner changes. Vertical panel scrolling is allowed;
# horizontal overflow, blown-up controls, and legacy combat chrome are not.
# Owners: web-runner/app.js, web-runner/systems/renderRuntime.js,
# web-runner/systems/renderSkillDraughtOverlay.js, web-runner/systems/devToolingRuntime.js,
# web-runner/systems/combatPresentationScale.mjs, web-runner/systems/appShellViewport.js,
# web-runner/systems/surfaceRenderRouter.js, web-runner/systems/pointerRoutingShell.js,
# web-runner/systems/renderCombatBossControl.mjs, and web-runner/src/core/damageNumberAnimation.mjs.
UI_LOCK_OWNER_PATTERN='^(package\.json|tools/ui_presentation_lock_gate\.mjs|tests/uiPresentationLockGateContract\.test\.js|tests/bossBattleHud\.test\.mjs|tests/devBossLaunch\.test\.mjs|web-runner/index\.html|web-runner/app\.js|web-runner/src/core/damageNumberAnimation\.mjs|web-runner/systems/renderCombatBossControl\.mjs|web-runner/systems/renderBossBattleHud\.mjs|web-runner/systems/renderRuntime\.js|web-runner/systems/devToolingRuntime\.js|web-runner/systems/devToolingControls\.js|web-runner/systems/combatPresentationScale\.mjs|web-runner/systems/appShellViewport\.js|web-runner/systems/surfaceRenderRouter\.js|web-runner/systems/pointerRoutingShell\.js|web-runner/assets/images/boss-hud/.*)$'
case "${1:-}" in
  --staged) [ "$#" -eq 1 ] || exit 2; UI_LOCK_STAGED_FILES="$(git diff --cached --name-only --diff-filter=ACMRD)" ;;
  --all) [ "$#" -eq 1 ] || exit 2; UI_LOCK_STAGED_FILES=""; ALL=true ;;
  --base) [ "$#" -eq 2 ] || { echo 'Expected --base <ref>' >&2; exit 2; }; UI_LOCK_STAGED_FILES="$(git diff --name-only --diff-filter=ACMRD "$2"...HEAD)" ;;
  "") UI_LOCK_STAGED_FILES="$(git diff --name-only --diff-filter=ACMRD origin/main...HEAD)" ;;
  *) echo 'Usage: run_merge_tests.sh [--base <ref>|--staged|--all]' >&2; exit 2 ;;
esac
# Editing the tier router itself requires every routed proof.
if printf '%s\n' "$UI_LOCK_STAGED_FILES" | grep -Eq '^(tools/run_(commit|merge)_tests\.(mjs|sh)|tests/preCommitRouting(\.test)?\.mjs)$'; then ALL=true; fi
if [ "$ALL" = true ] || printf '%s\n' "$UI_LOCK_STAGED_FILES" | grep -Eq "$UI_LOCK_OWNER_PATTERN"; then
  echo "UI presentation owner changed; running rendered UI lock..."
  npm run test:ui-lock
fi

# Presentation changes keep the full browser gate; rules also need actual gameplay proof.
HERO_COOLDOWN_OWNER_PATTERN='^(web-runner/app\.js|web-runner/systems/(heroCooldownStrip|combatProgressionUI)\.mjs|web-runner/state/heroArtAssets\.mjs|src/core/buffSignalRules\.mjs|web-runner/src/core/(heroDefinitions|realtimeHeroPassives|partySkillCatalog)\.mjs|web-runner/assets/images/ui/buff-signals\.png|tests/(heroCooldownStrip(Browser)?|buffSignalRules)\.test\.mjs)$'
if [ "$ALL" = true ] || printf '%s\n' "$UI_LOCK_STAGED_FILES" | grep -Eq "$HERO_COOLDOWN_OWNER_PATTERN"; then
  echo "Hero cooldown HUD changed; running clock and five-viewport containment proof..."
  npm run test:hero-cooldowns
fi

HERO_DETAIL_OWNER_PATTERN='^(web-runner/systems/(renderHeroScreen\.js|heroSkillCopy\.mjs)|web-runner/src/core/heroDefinitions\.mjs|tests/heroScreenUILayout\.test\.mjs)$'
if [ "$ALL" = true ] || printf '%s\n' "$UI_LOCK_STAGED_FILES" | grep -Eq "$HERO_DETAIL_OWNER_PATTERN"; then
  echo "Hero skill detail owner changed; running bounded-frame and reading-state proof..."
  node --import ./tools/ensure_simulation_core.cjs --test tests/heroScreenUILayout.test.mjs
fi

LAMP_PRESENTATION_OWNER_PATTERN='^(web-runner/systems/lampEquipmentUI\.mjs|web-runner/assets/lampEquipmentUI\.css|tests/lampPresentation\.test\.mjs|web-runner/systems/modalClose\.mjs|web-runner/systems/combatProgressionUI\.mjs|web-runner/systems/bagUpgradePresentation\.mjs|web-runner/assets/bagUpgradeUI\.css|web-runner/systems/lampConveyorPresentation\.mjs|web-runner/assets/images/ui/bag-tier-medallion\.png|tests/bagUpgradePresentation\.test\.mjs)$'
LAMP_GAMEPLAY_OWNER_PATTERN='^(\.beads/hooks/pre-commit|package\.json|web-runner/app\.js|web-runner/src/core/(lampGear|lampConveyor|lampHeroRoster|equipment|heroProgression|heroDefinitions|combatPower)\.mjs|web-runner/systems/(equipmentStorage\.mjs|renderHeroScreen\.js|heroGearUI\.mjs)|tests/(lampAutoEquipGameplay|lampRoster|lampCPInvariant|lampConveyor|lampEquipment)\.test\.mjs|tests/fixtures/lampTrust\.mjs)$'
if [ "$ALL" = true ] || printf '%s\n' "$UI_LOCK_STAGED_FILES" | grep -Eq "$LAMP_PRESENTATION_OWNER_PATTERN"; then
  echo "Lamp presentation owner changed; running browser geometry and guide lock..."
  npm run test:lamp-ui
  node --import ./tools/ensure_simulation_core.cjs --test tests/lampRoster.test.mjs
elif [ "$ALL" = true ] || printf '%s\n' "$UI_LOCK_STAGED_FILES" | grep -Eq "$LAMP_GAMEPLAY_OWNER_PATTERN"; then
  echo "Lamp rules or ownership changed; running gameplay and roster proof..."
  node --import ./tools/ensure_simulation_core.cjs --test --test-concurrency=1 tests/lampAutoEquipGameplay.test.mjs tests/lampRoster.test.mjs
fi
