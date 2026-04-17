const boardEl = document.getElementById('board');
const detailEl = document.getElementById('detail');
const metricsEl = document.getElementById('metrics');
const themeToggleEl = document.getElementById('themeToggle');
const THEME_KEY = 'orka-beads-board-theme';
let activeId = null;
let currentCards = new Map();

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function metric(label, value) {
  return `<div class="metric"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`;
}

function applyTheme(theme) {
  const safeTheme = theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = safeTheme;
  if (themeToggleEl) themeToggleEl.textContent = safeTheme === 'light' ? 'Dark Mode' : 'Light Mode';
  try {
    localStorage.setItem(THEME_KEY, safeTheme);
  } catch {}
}

function loadTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored;
  } catch {}
  return 'light';
}

function wireThemeToggle() {
  if (!themeToggleEl) return;
  applyTheme(loadTheme());
  themeToggleEl.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}

function renderMetrics(summary) {
  metricsEl.innerHTML = [
    metric('In Progress', summary.inProgress),
    metric('Blocked', summary.blocked),
    metric('Ready Next', summary.readyNext),
    metric('Done', summary.done),
  ].join('');
}

function renderBoard(data) {
  currentCards = new Map();
  boardEl.innerHTML = data.columns.map((col) => {
    const items = col.items.map((item) => {
      currentCards.set(item.id, item);
      const activeClass = item.id === activeId ? ' active' : '';
      return `
        <button class="card${activeClass}" data-id="${escapeHtml(item.id)}">
          <div class="card-top">
            <span class="card-id">${escapeHtml(item.id)}</span>
            <span class="priority">P${escapeHtml(item.priority ?? '?')}</span>
          </div>
          <div class="card-title">${escapeHtml(item.title)}</div>
          <div class="card-meta">
            <span class="badge">${escapeHtml(item.role)}</span>
            <span class="badge">${escapeHtml(item.issueType || 'item')}</span>
          </div>
        </button>`;
    }).join('') || '<div class="card-list"><div class="detail-empty">No beads in this lane.</div></div>';

    return `
      <section class="column">
        <div class="column-header">
          <h2>${escapeHtml(col.title)}</h2>
          <span class="column-count">${escapeHtml(col.items.length)}</span>
        </div>
        <div class="card-list">${items}</div>
      </section>`;
  }).join('');

  boardEl.querySelectorAll('.card').forEach((button) => {
    button.addEventListener('click', () => openDetail(button.dataset.id));
  });
}

function renderDetail(detail, card) {
  const description = detail.description || 'No description.';
  const acceptance = detail.acceptance_criteria || 'No explicit acceptance criteria.';
  const notes = detail.notes || 'No notes.';
  detailEl.innerHTML = `
    <div class="detail-body">
      <div class="id">${escapeHtml(detail.id || card?.id || '')}</div>
      <h3>${escapeHtml(detail.title || card?.title || '(untitled)')}</h3>
      <div class="meta-grid">
        <div class="badge">${escapeHtml(card?.role || 'Unassigned')}</div>
        <div class="badge">${escapeHtml(detail.status || card?.status || '')}</div>
        <div class="badge">Priority P${escapeHtml(detail.priority ?? card?.priority ?? '?')}</div>
        <div class="badge">${escapeHtml(detail.issue_type || card?.issueType || 'item')}</div>
      </div>
      <div class="chunk"><h4>Description</h4><div class="body">${escapeHtml(description)}</div></div>
      <div class="chunk"><h4>Acceptance</h4><div class="body">${escapeHtml(acceptance)}</div></div>
      <div class="chunk"><h4>Notes</h4><div class="body">${escapeHtml(notes)}</div></div>
    </div>`;
}

async function openDetail(id) {
  activeId = id;
  boardEl.querySelectorAll('.card').forEach((el) => el.classList.toggle('active', el.dataset.id === id));
  const card = currentCards.get(id);
  const res = await fetch(`/__beads/issue/${encodeURIComponent(id)}.json`, { cache: 'no-store' });
  const detail = await res.json();
  renderDetail(detail, card);
}

async function boot() {
  wireThemeToggle();
  const res = await fetch('/__beads/board.json', { cache: 'no-store' });
  const data = await res.json();
  renderMetrics(data.summary);
  renderBoard(data);
}

boot().catch((err) => {
  detailEl.innerHTML = `<div class="detail-empty">Failed to load board: ${escapeHtml(err.message)}</div>`;
});
