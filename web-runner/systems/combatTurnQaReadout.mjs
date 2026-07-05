function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function actorName(actor, uid = 0) {
  return String(actor?.name || actor?.baseHeroName || actor?.key || actor?.type || uid || 'Unknown');
}

function actorTypeLabel(actor, slotType = 0) {
  if (actor?.kind === 'enemy' || Number(slotType || 0) === 1) return 'Enemy';
  return 'Hero';
}

function getActorByUID(entities = [], uid = 0) {
  return entities.find(actor => Number(actor?.uid || 0) === Number(uid || 0)) || null;
}

function readBaseSpeed(actor) {
  return Number(actor?.stats?.SPD ?? actor?.SPD ?? 0);
}

function readSpeedModifier(globals = {}, actor = null) {
  if (!actor) return { amount: 0, label: 'none' };
  if (actor.kind === 'hero') {
    const amount = Number(globals.PartyBuff_SPD || 0);
    return amount > 0 ? { amount, label: `+${amount} party Speed buff` } : { amount: 0, label: 'none' };
  }
  if (actor.kind === 'enemy') {
    const amount = Number(globals.EnemyDebuffs?.[actor.uid]?.SPD || 0);
    return amount > 0 ? { amount: -amount, label: `-${amount} enemy Speed debuff` } : { amount: 0, label: 'none' };
  }
  return { amount: 0, label: 'none' };
}

function readEffectiveSpeed({
  actor,
  globals,
  callFunctionWithContext,
  fnContext,
}) {
  if (!actor) return 0;
  if (typeof callFunctionWithContext === 'function') {
    const owned = Number(callFunctionWithContext(fnContext, 'GetEffectiveStat', actor, 'SPD'));
    if (Number.isFinite(owned)) return owned;
  }
  const modifier = readSpeedModifier(globals, actor);
  return Math.max(0, readBaseSpeed(actor) + Number(modifier.amount || 0));
}

function readCurrentTurnUID({
  globals = {},
  order = [],
  callFunctionWithContext,
  fnContext,
}) {
  if (typeof callFunctionWithContext === 'function') {
    const current = Number(callFunctionWithContext(fnContext, 'GetCurrentTurn') || 0);
    if (current > 0) return current;
  }
  const initiativeUID = Number(globals.InitiativeCurrentUID || 0);
  if (initiativeUID > 0) return initiativeUID;
  const idx = Math.max(0, Number(globals.CurrentTurnIndex || 0));
  return Number(order[idx]?.uid || 0);
}

function flattenRoundGroups(groups = []) {
  const rows = [];
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const member of Array.isArray(group?.members) ? group.members : []) {
      rows.push({
        uid: Number(member?.uid || 0),
        type: Number(member?.type ?? group?.type ?? 0),
        spd: Number(member?.spd || 0),
        source: 'round group',
      });
    }
  }
  return rows.filter(row => row.uid > 0);
}

function readOrder(globals = {}, entities = []) {
  const roundRows = Number(globals.RoundActive || 0) ? flattenRoundGroups(globals.RoundGroups) : [];
  if (roundRows.length) return { source: 'round group', rows: roundRows };
  const queue = Array.isArray(globals.TurnOrderArray) ? globals.TurnOrderArray : [];
  const queueRows = queue
    .map(slot => ({
      uid: Number(slot?.uid || 0),
      type: Number(slot?.type || 0),
      spd: Number(slot?.spd || 0),
      source: 'turn order array',
    }))
    .filter(row => row.uid > 0);
  if (queueRows.length) return { source: 'turn order array', rows: queueRows };
  return {
    source: 'living actors',
    rows: entities
      .filter(actor => actor && Number(actor.hp ?? actor.HP ?? 1) > 0)
      .map(actor => ({
        uid: Number(actor.uid || 0),
        type: actor.kind === 'enemy' ? 1 : 0,
        spd: readBaseSpeed(actor),
        source: 'living actors',
      }))
      .filter(row => row.uid > 0),
  };
}

function describeCurrentTurnReason({ globals = {}, orderSource = '', currentIndex = -1, currentUID = 0 }) {
  if (!currentUID) return 'No current actor is selected.';
  if (Number(globals.RoundActive || 0)) {
    return `Round group ${Number(globals.RoundGroupIndex || 0) + 1}, member ${Number(globals.RoundMemberIndex || 0) + 1}.`;
  }
  if (Number(globals.InitiativeCurrentUID || 0) === Number(currentUID || 0)) {
    return 'Initiative current UID selected this actor.';
  }
  if (currentIndex >= 0) {
    return `${orderSource || 'Turn order'} index ${currentIndex + 1} selected this actor.`;
  }
  return 'Current actor came from runtime turn lookup.';
}

function describeSpeedOrder(rows = []) {
  if (!rows.length) return 'Unavailable: no actors are in the visible order.';
  if (rows.length === 1) return 'Yes: only one actor is in the visible order.';
  const sorted = rows.every((row, idx) => idx === 0 || Number(rows[idx - 1].effectiveSpeed || 0) >= Number(row.effectiveSpeed || 0));
  return sorted
    ? 'Yes: visible order is descending by effective Speed.'
    : 'No: visible order is not globally descending by effective Speed.';
}

export function buildCombatTurnQaReadout({
  state,
  callFunctionWithContext = null,
  fnContext = null,
  maxRows = 8,
} = {}) {
  const globals = state?.globals || {};
  const entities = Array.isArray(state?.entities) ? state.entities : [];
  const order = readOrder(globals, entities);
  const currentUID = readCurrentTurnUID({
    globals,
    order: order.rows,
    callFunctionWithContext,
    fnContext,
  });
  const currentIndex = order.rows.findIndex(row => Number(row.uid || 0) === Number(currentUID || 0));
  const rows = order.rows.slice(0, Math.max(1, Number(maxRows || 8))).map((slot, idx) => {
    const actor = getActorByUID(entities, slot.uid);
    const modifier = readSpeedModifier(globals, actor);
    return {
      index: idx + 1,
      current: Number(slot.uid || 0) === Number(currentUID || 0),
      uid: Number(slot.uid || 0),
      name: actorName(actor, slot.uid),
      team: actorTypeLabel(actor, slot.type),
      baseSpeed: readBaseSpeed(actor),
      effectiveSpeed: readEffectiveSpeed({ actor, globals, callFunctionWithContext, fnContext }),
      modifier: modifier.label,
    };
  });
  const currentActor = getActorByUID(entities, currentUID);
  return {
    orderSource: order.source,
    currentUID,
    currentActorName: actorName(currentActor, currentUID),
    currentTurnReason: describeCurrentTurnReason({
      globals,
      orderSource: order.source,
      currentIndex,
      currentUID,
    }),
    speedOrderAnswer: describeSpeedOrder(rows),
    rows,
  };
}

export function renderCombatTurnQaReadoutHtml(args = {}) {
  const readout = buildCombatTurnQaReadout(args);
  const rowHtml = readout.rows.length
    ? readout.rows.map(row => `
      <tr data-combat-turn-qa-row="${row.index}">
        <td style="padding:4px 6px;border-top:1px solid #e2e8f0;">${row.current ? '&gt;' : ''}${row.index}</td>
        <td style="padding:4px 6px;border-top:1px solid #e2e8f0;">${escapeHtml(row.name)}</td>
        <td style="padding:4px 6px;border-top:1px solid #e2e8f0;">${escapeHtml(row.team)}</td>
        <td style="padding:4px 6px;border-top:1px solid #e2e8f0;text-align:right;">${Math.round(row.baseSpeed)}</td>
        <td style="padding:4px 6px;border-top:1px solid #e2e8f0;text-align:right;font-weight:800;">${Math.round(row.effectiveSpeed)}</td>
        <td style="padding:4px 6px;border-top:1px solid #e2e8f0;">${escapeHtml(row.modifier)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" style="padding:6px;border-top:1px solid #e2e8f0;color:#64748b;">No combat turn order available.</td></tr>';
  return `
    <section data-devtool-turn-order-qa style="display:flex;flex-direction:column;gap:8px;margin-top:14px;border-top:1px solid #cbd5e1;padding-top:12px;">
      <div style="display:flex;flex-direction:column;gap:4px;">
        <div style="font-weight:800;">Combat Turn QA</div>
        <div data-combat-turn-qa-answer style="font-weight:700;color:#0f172a;">Is combat sorted by Speed? ${escapeHtml(readout.speedOrderAnswer)}</div>
        <div data-combat-turn-qa-current style="color:#334155;">Current: ${escapeHtml(readout.currentActorName)} (${Number(readout.currentUID || 0) || 'none'})</div>
        <div data-combat-turn-qa-reason style="color:#334155;">Why: ${escapeHtml(readout.currentTurnReason)}</div>
        <div data-combat-turn-qa-source style="color:#475569;">Visible order source: ${escapeHtml(readout.orderSource)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;font-size:11px;">
        <thead>
          <tr>
            <th style="padding:4px 6px;text-align:left;">#</th>
            <th style="padding:4px 6px;text-align:left;">Actor</th>
            <th style="padding:4px 6px;text-align:left;">Team</th>
            <th style="padding:4px 6px;text-align:right;">Base SPD</th>
            <th style="padding:4px 6px;text-align:right;">Effective SPD</th>
            <th style="padding:4px 6px;text-align:left;">Modifier</th>
          </tr>
        </thead>
        <tbody>${rowHtml}</tbody>
      </table>
    </section>
  `;
}
