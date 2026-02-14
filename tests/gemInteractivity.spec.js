const { test, expect } = require('playwright/test');

const GAME_URL = 'http://127.0.0.1:8000/web-runner/';
const ROWS = 4;
const COLS = 6;

async function waitForPlayableHeroTurn(page, timeout = 30000) {
  await page.waitForFunction(() => {
    const game = window.__codexGame;
    if (!game || !game.globals || !game.turn) return false;
    return (
      game.turn.type === 0 &&
      game.globals.CanPickGems === true &&
      !game.globals.IsPlayerBusy &&
      !game.globals.PendingSkillID &&
      !game.globals.BoardFillActive &&
      Array.isArray(game.gems) &&
      game.gems.length === 24
    );
  }, null, { timeout });
}

async function getCellCanvasPosition(page, row, col) {
  return page.evaluate(({ r, c }) => {
    const game = window.__codexGame;
    if (!game || !Array.isArray(game.gems)) return null;
    const gem = game.gems.find(g => g.cellR === r && g.cellC === c);
    if (!gem) return null;
    return { x: gem.x, y: gem.y };
  }, { r: row, c: col });
}

test('all board cells remain clickable after yellow match and refill', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('#view');
  await page.waitForFunction(() => !!window.__codexGame);
  await waitForPlayableHeroTurn(page);

  await page.evaluate(() => {
    const game = window.__codexGame;
    const globals = game.globals;

    const forcedColorAt = (r, c) => {
      if (r === 0 && c >= 0 && c <= 2) return 3;
      return ((r + c) % 2 === 0) ? 0 : 1;
    };

    for (const gem of game.gems) {
      const forced = forcedColorAt(gem.cellR, gem.cellC);
      gem.color = forced;
      gem.elementIndex = forced;
      gem.selected = false;
      gem.Selected = 0;
      gem.flashUntil = 0;
    }

    game.clearSelection();
    globals.CanPickGems = true;
    globals.IsPlayerBusy = 0;
    globals.PendingSkillID = '';
    globals.BoardFillActive = 0;
    globals.TurnPhase = 0;
    globals.DeferAdvance = 0;
    globals.ActionInProgress = 0;
    globals.ActionLockUntil = 0;
    globals.MatchedColorValue = -1;
  });

  const yellowTriplet = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
  ];

  for (const slot of yellowTriplet) {
    const pos = await getCellCanvasPosition(page, slot.row, slot.col);
    expect(pos, `Missing gem at row=${slot.row}, col=${slot.col}`).toBeTruthy();
    await page.click('#view', { position: pos });
  }

  await page.waitForFunction(() => {
    const g = window.__codexGame;
    return (
      g &&
      g.globals &&
      (g.globals.MatchedColorValue === 3 || g.globals.DeferAdvance === 1 || g.globals.ActionLockUntil > (g.globals.time || 0))
    );
  }, null, { timeout: 5000 });

  await waitForPlayableHeroTurn(page, 45000);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      await waitForPlayableHeroTurn(page, 10000);

      await page.evaluate(() => {
        const game = window.__codexGame;
        game.clearSelection();
        game.globals.CanPickGems = true;
        game.globals.IsPlayerBusy = 0;
        game.globals.PendingSkillID = '';
        game.globals.BoardFillActive = 0;
        game.globals.TurnPhase = 0;
        game.globals.MatchedColorValue = -1;
      });

      const pos = await getCellCanvasPosition(page, row, col);
      expect(pos, `Cell missing after refill row=${row}, col=${col}`).toBeTruthy();

      const before = await page.evaluate(({ r, c }) => {
        const game = window.__codexGame;
        const targetIndex = game.gems.findIndex(g => g.cellR === r && g.cellC === c);
        const targetGem = targetIndex >= 0 ? game.gems[targetIndex] : null;
        const selectedGems = Array.isArray(game.selectedGems) ? [...game.selectedGems] : [];
        const selection = Array.isArray(game.selection) ? [...game.selection] : [];

        return {
          targetIndex,
          targetUid: targetGem ? targetGem.uid : null,
          selectedLen: selectedGems.length,
          selectionLen: selection.length,
          globals: {
            CanPickGems: game.globals.CanPickGems,
            IsPlayerBusy: game.globals.IsPlayerBusy,
            PendingSkillID: game.globals.PendingSkillID,
            BoardFillActive: game.globals.BoardFillActive,
            TurnPhase: game.globals.TurnPhase,
            DeferAdvance: game.globals.DeferAdvance,
            ActionLockUntil: game.globals.ActionLockUntil,
            time: game.globals.time,
            MatchedColorValue: game.globals.MatchedColorValue,
          },
        };
      }, { r: row, c: col });

      await page.click('#view', { position: pos });

      const after = await page.evaluate(({ r, c, beforeState }) => {
        const game = window.__codexGame;
        const targetIndex = game.gems.findIndex(g => g.cellR === r && g.cellC === c);
        const targetGem = targetIndex >= 0 ? game.gems[targetIndex] : null;
        const selectedGems = Array.isArray(game.selectedGems) ? [...game.selectedGems] : [];
        const selection = Array.isArray(game.selection) ? [...game.selection] : [];

        const targetUid = targetGem ? targetGem.uid : null;
        const selectedContainsByIndex = beforeState.targetIndex >= 0 && selectedGems.includes(beforeState.targetIndex);
        const selectedContainsByUid = targetUid != null && selectedGems.includes(targetUid);
        const selectionContainsByIndex = beforeState.targetIndex >= 0 && selection.includes(beforeState.targetIndex);
        const selectionContainsByUid = targetUid != null && selection.includes(targetUid);
        const inSelection = selectedContainsByIndex || selectedContainsByUid || selectionContainsByIndex || selectionContainsByUid;

        const selectedLen = selectedGems.length;
        const selectionLen = selection.length;
        const lenBefore = Math.max(Number(beforeState.selectedLen || 0), Number(beforeState.selectionLen || 0));
        const lenAfter = Math.max(selectedLen, selectionLen);
        const lengthIncreased = lenAfter > lenBefore;

        const globals = {
          CanPickGems: game.globals.CanPickGems,
          IsPlayerBusy: game.globals.IsPlayerBusy,
          PendingSkillID: game.globals.PendingSkillID,
          BoardFillActive: game.globals.BoardFillActive,
          TurnPhase: game.globals.TurnPhase,
          DeferAdvance: game.globals.DeferAdvance,
          ActionLockUntil: game.globals.ActionLockUntil,
          time: game.globals.time,
          MatchedColorValue: game.globals.MatchedColorValue,
        };

        const inert = !inSelection && !lengthIncreased && globals.MatchedColorValue === -1;

        return {
          inSelection,
          lengthIncreased,
          inert,
          selectedLenBefore: beforeState.selectedLen,
          selectedLenAfter: selectedLen,
          selectionLenBefore: beforeState.selectionLen,
          selectionLenAfter: selectionLen,
          globals,
          turn: game.turn ? {
            uid: game.turn.uid,
            type: game.turn.type,
            actorUid: game.turn.actor ? game.turn.actor.uid : null,
            actorName: game.turn.actor ? game.turn.actor.name : null,
          } : null,
          gemSnapshot: targetGem ? {
            selected: !!targetGem.selected,
            Selected: !!targetGem.Selected,
            flashUntil: targetGem.flashUntil,
            cellR: targetGem.cellR,
            cellC: targetGem.cellC,
          } : null,
        };
      }, { r: row, c: col, beforeState: before });

      expect(after.globals.MatchedColorValue, `Unexpected match trigger on single click at row=${row}, col=${col}`).toBe(-1);
      expect(after.globals.CanPickGems, `CanPickGems changed unexpectedly at row=${row}, col=${col}`).toBe(true);
      expect(after.globals.BoardFillActive, `BoardFillActive changed unexpectedly at row=${row}, col=${col}`).toBe(0);

      if (after.inert) {
        console.error('[INERT_DIAG]', {
          row,
          col,
          selectionLengthBefore: {
            selectedGems: after.selectedLenBefore,
            selection: after.selectionLenBefore,
          },
          selectionLengthAfter: {
            selectedGems: after.selectedLenAfter,
            selection: after.selectionLenAfter,
          },
          beforeGlobals: before.globals,
          afterGlobals: after.globals,
          turn: after.turn,
          gem: after.gemSnapshot,
        });
      }

      expect(
        after.inSelection || after.lengthIncreased,
        `Inert cell row=${row}, col=${col}; selectedLenBefore=${after.selectedLenBefore}, selectedLenAfter=${after.selectedLenAfter}, selectionLenBefore=${after.selectionLenBefore}, selectionLenAfter=${after.selectionLenAfter}, CanPickGems=${after.globals.CanPickGems}, BoardFillActive=${after.globals.BoardFillActive}, TurnPhase=${after.globals.TurnPhase}, ActionLockUntil=${after.globals.ActionLockUntil}`
      ).toBeTruthy();
    }
  }
});
