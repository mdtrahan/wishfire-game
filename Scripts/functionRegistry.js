import { state } from './state.js';
import * as functionBank from './functionBank.js';
import * as skillSheet from './skillSheet.js';
import * as mainSheet from './mainSheet.js';

export const registry = {
  ...functionBank,
  ...skillSheet,
  ...mainSheet,
};

export function createContext(overrides = {}) {
  const ctx = {
    state,
    callFunction(name, ...args) {
      const fn = registry[name];
      if (!fn) {
        console.warn(`callFunction: missing ${name}`);
        return undefined;
      }
      return fn(ctx, ...args);
    },
  };
  return Object.assign(ctx, overrides);
}

export function callFunction(name, ...args) {
  const ctx = createContext();
  return ctx.callFunction(name, ...args);
}

export function callFunctionWithContext(ctx, name, ...args) {
  if (!ctx || typeof ctx.callFunction !== 'function') {
    const fallback = createContext(ctx || {});
    return fallback.callFunction(name, ...args);
  }
  return ctx.callFunction(name, ...args);
}
