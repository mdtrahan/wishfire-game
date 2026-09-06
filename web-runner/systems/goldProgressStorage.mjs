const KEY = 'wishfire.gold.v1';

export function createGoldProgressStorage({ globals, storage, reportError = console.error }) {
  let loaded = false;
  let saved;
  return {
    sync() {
      try {
        if (!loaded) {
          const raw = storage.getItem(KEY);
          if (raw !== null) {
            const value = Number(raw);
            if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid saved gold balance');
            globals.goldTotal = value;
            saved = value;
          }
          loaded = true;
        }
        const gold = Number(globals.goldTotal || 0);
        if (!Number.isSafeInteger(gold) || gold < 0) throw new Error('Invalid gold balance');
        if (gold !== saved) {
          storage.setItem(KEY, String(gold));
          saved = gold;
        }
      } catch (error) { reportError('Gold save failed', error); }
    },
  };
}
