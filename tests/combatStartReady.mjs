// Observe the production START paint before clicking its Canvas hit target.
export async function observeCombatStart(page) {
  await page.addInitScript(() => {
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (text === 'START') window.__testStartPainted = true;
      return fillText.call(this, text, ...args);
    };
  });
}

export async function waitForCombatStart(page) {
  await page.waitForFunction(() => {
    if (!window.__testStartPainted || typeof window.render_game_to_text !== 'function') return false;
    const state = JSON.parse(window.render_game_to_text());
    return state.flags.layout0Ready && state.quest.phase === 'map';
  });
}
