const PARTY_STAT_KEYS = Object.freeze(['ATK', 'MAG', 'DEF', 'RES', 'SPD']);
const OSD_ROOT_ATTR = 'data-party-stat-osd';
const OSD_BODY_ATTR = 'data-party-stat-osd-body';

function isEditableDomTarget(target) {
  const tag = String(target?.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function sanitizeNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function formatNumber(value) {
  const num = sanitizeNumber(value);
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 10) / 10);
}

function readBaseStat(hero, stat) {
  return sanitizeNumber(hero?.stats?.[stat] ?? hero?.[stat] ?? 0);
}

function readPartyBuff(stateGlobals, stat) {
  return sanitizeNumber(stateGlobals?.[`PartyBuff_${stat}`] || 0);
}

function sortPartyHeroes(a, b) {
  return Number(a.heroDisplaySlot ?? a.heroIndex ?? 0) - Number(b.heroDisplaySlot ?? b.heroIndex ?? 0);
}

function fallbackEffectiveStat(hero, stat, stateGlobals) {
  return Math.max(0, readBaseStat(hero, stat) + readPartyBuff(stateGlobals, stat));
}

function getHeroPowerStat(hero) {
  return String(hero?.attackType || '').toLowerCase() === 'magic' ? 'MAG' : 'ATK';
}

function readEffectiveStat(hero, stat, stateGlobals, getEffectiveStat) {
  try {
    if (typeof getEffectiveStat === 'function') {
      const value = Number(getEffectiveStat(hero, stat));
      if (Number.isFinite(value)) return Math.max(0, value);
    }
  } catch (_err) {
    return fallbackEffectiveStat(hero, stat, stateGlobals);
  }
  return fallbackEffectiveStat(hero, stat, stateGlobals);
}

function readPowerMultiplier(hero, getPowerMultiplier) {
  try {
    if (typeof getPowerMultiplier === 'function') {
      const value = Number(getPowerMultiplier(hero));
      if (Number.isFinite(value) && value > 0) return value;
    }
  } catch (_err) {
    return 1;
  }
  return 1;
}

function readDisplayEffectiveStat(hero, stat, stateGlobals, getEffectiveStat, getPowerMultiplier) {
  const effective = readEffectiveStat(hero, stat, stateGlobals, getEffectiveStat);
  if (stat !== getHeroPowerStat(hero)) return effective;
  const powerMultiplier = readPowerMultiplier(hero, getPowerMultiplier);
  if (powerMultiplier <= 1) return effective;
  return Math.max(effective, Math.ceil(effective * powerMultiplier));
}

function formatModifier(delta) {
  const value = sanitizeNumber(delta);
  if (value > 0) return ` +${formatNumber(value)}`;
  if (value < 0) return ` -${formatNumber(Math.abs(value))}`;
  return '';
}

export function isPartyStatOsdHotkey(ev) {
  if (!ev || isEditableDomTarget(ev.target)) return false;
  const key = String(ev.key || '').toLowerCase();
  const code = String(ev.code || '');
  return !!((ev.metaKey || ev.ctrlKey) && ev.shiftKey && (code === 'KeyY' || key === 'y'));
}

export function buildPartyStatRows({
  stateEntities = [],
  stateGlobals = {},
  getEffectiveStat = null,
  getPowerMultiplier = null,
} = {}) {
  return (Array.isArray(stateEntities) ? stateEntities : [])
    .filter(hero => hero && hero.kind === 'hero')
    .sort(sortPartyHeroes)
    .map((hero) => {
      const stats = PARTY_STAT_KEYS.map((stat) => {
        const base = readBaseStat(hero, stat);
        const effective = readDisplayEffectiveStat(hero, stat, stateGlobals, getEffectiveStat, getPowerMultiplier);
        const delta = effective - base;
        return { stat, base, effective, delta };
      });
      return {
        uid: Number(hero.uid || 0),
        name: String(hero.name || hero.baseHeroName || `Hero ${Number(hero.uid || 0) || '?'}`),
        stats,
      };
    });
}

export function formatPartyStatRow(row) {
  const name = String(row?.name || 'Hero');
  const stats = Array.isArray(row?.stats) ? row.stats : [];
  const statText = stats
    .map(item => `${item.stat} ${formatNumber(item.effective)}${formatModifier(item.delta)}`)
    .join(', ');
  return `${name} ${statText}`.trim();
}

export function formatPartyStatOsdText({
  stateEntities = [],
  stateGlobals = {},
  getEffectiveStat = null,
  getPowerMultiplier = null,
} = {}) {
  const rows = buildPartyStatRows({ stateEntities, stateGlobals, getEffectiveStat, getPowerMultiplier });
  if (!rows.length) return 'No party heroes';
  return rows.map(formatPartyStatRow).join('\n');
}

function stylePartyStatOsd(root) {
  root.style.cssText = [
    'position:fixed',
    'left:12px',
    'top:12px',
    'z-index:9998',
    'min-width:300px',
    'max-width:min(560px, calc(100vw - 24px))',
    'box-sizing:border-box',
    'padding:10px 12px',
    'background:rgba(8, 13, 24, 0.94)',
    'color:#f8fafc',
    'border:1px solid rgba(226, 232, 240, 0.36)',
    'box-shadow:0 10px 26px rgba(0,0,0,0.38)',
    'font:700 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    'white-space:pre',
    'pointer-events:none',
  ].join(';');
}

function ensurePartyStatOsdElement(documentRef) {
  if (!documentRef || !documentRef.body) return null;
  const existing = documentRef.querySelector(`[${OSD_ROOT_ATTR}]`);
  if (existing) return existing;
  const root = documentRef.createElement('aside');
  root.setAttribute(OSD_ROOT_ATTR, '');
  root.setAttribute('aria-label', 'Party stat overlay');
  root.hidden = true;
  root.dataset.visible = 'false';
  stylePartyStatOsd(root);

  const title = documentRef.createElement('div');
  title.textContent = 'Party Stats';
  title.style.cssText = [
    'color:#93c5fd',
    'font-weight:900',
    'margin-bottom:4px',
  ].join(';');
  root.appendChild(title);

  const body = documentRef.createElement('div');
  body.setAttribute(OSD_BODY_ATTR, '');
  root.appendChild(body);

  documentRef.body.appendChild(root);
  return root;
}

export function createPartyStatOsdRuntime({
  state,
  document: documentRef = (typeof document !== 'undefined' ? document : null),
  getEffectiveStat = null,
  getPowerMultiplier = null,
} = {}) {
  const root = ensurePartyStatOsdElement(documentRef);
  const body = root ? root.querySelector(`[${OSD_BODY_ATTR}]`) : null;
  const runtime = {
    root,
    visible: false,
    setVisible(nextVisible) {
      runtime.visible = !!nextVisible;
      if (root) {
        root.hidden = !runtime.visible;
        root.dataset.visible = runtime.visible ? 'true' : 'false';
      }
      runtime.refresh();
      return runtime.visible;
    },
    toggle() {
      return runtime.setVisible(!runtime.visible);
    },
    refresh() {
      if (!root || !body || !runtime.visible) return;
      body.textContent = formatPartyStatOsdText({
        stateEntities: state?.entities || [],
        stateGlobals: state?.globals || {},
        getEffectiveStat,
        getPowerMultiplier,
      });
    },
  };
  return runtime;
}
