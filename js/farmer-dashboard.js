/* ═══════════════════════════════════════════
   AgriStore AI — Farmer Dashboard Logic
   js/farmer-dashboard.js
═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  const user = AgriAPI.Auth.getUser();
  if (user?.role === 'owner') {
    window.location.href = 'owner-dashboard.html';
    return;
  }

  renderUserInfo(user);
  await Promise.all([loadBookings(), loadRecommendations(user)]);
});

/* ─── USER INFO ──────────────────────────────────────────────────────────── */
function renderUserInfo(user) {
  const name = user?.first_name || user?.username || 'Farmer';
  const city = user?.city || '';

  const greetEl = document.getElementById('dashGreet');
  if (greetEl) greetEl.textContent = `Good morning, ${name} 🌾`;

  const avatarEl = document.getElementById('sidebarAvatar');
  if (avatarEl) avatarEl.textContent = (name[0] + (user?.last_name?.[0] || '')).toUpperCase();

  const nameEl = document.getElementById('sidebarName');
  if (nameEl) nameEl.textContent = user?.first_name + ' ' + (user?.last_name || '');

  const typeEl = document.getElementById('sidebarType');
  if (typeEl) typeEl.textContent = `Farmer${city ? ' · ' + city : ''}`;
}

/* ─── BOOKINGS ───────────────────────────────────────────────────────────── */
async function loadBookings() {
  const tbody = document.getElementById('bookingsBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text-muted)">Loading bookings…</td></tr>`;

  try {
    const data     = await AgriAPI.bookings.list();
    const bookings = data.results || data;

    updateMetrics(bookings);

    if (bookings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">
        No bookings yet. <a href="search.html" style="color:var(--green-600)">Find storage →</a>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = bookings.map(b => `
      <tr>
        <td>
          <div class="wh-cell-name">${b.warehouse_name}</div>
          <div class="wh-cell-sub">${b.warehouse_city} · ${b.reference_number}</div>
        </td>
        <td>${capitalize(b.crop_type)}</td>
        <td>${b.quantity}t</td>
        <td>${formatDateRange(b.start_date, b.end_date)}</td>
        <td>${statusBadge(b.status)}</td>
        <td>₹${Number(b.total_amount || 0).toLocaleString('en-IN')}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#c0392b;padding:1.5rem">
      Failed to load bookings. <button class="btn btn-outline btn-sm" onclick="loadBookings()">Retry</button>
    </td></tr>`;
  }
}

/* ─── METRICS from bookings data ─────────────────────────────────────────── */
function updateMetrics(bookings) {
  const active    = bookings.filter(b => b.status === 'active' || b.status === 'confirmed');
  const totalQty  = active.reduce((s, b) => s + (b.quantity || 0), 0);
  const totalCost = active.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);

  setMetric('metricBookings', active.length);
  setMetric('metricStored',   totalQty + 't');
  setMetric('metricCost',     '₹' + Math.round(totalCost).toLocaleString('en-IN'));
}

function setMetric(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ─── AI RECOMMENDATIONS ─────────────────────────────────────────────────── */
async function loadRecommendations(user) {
  const container = document.getElementById('recList');
  if (!container) return;

  container.innerHTML = `<div style="color:var(--text-muted);font-size:.85rem;text-align:center;padding:1rem">Loading recommendations…</div>`;

  try {
    const params = {
      crop:     user?.primary_crop || 'general',
      quantity: 50,
      limit:    3,
    };
    if (user?.latitude)  params.lat = user.latitude;
    if (user?.longitude) params.lng = user.longitude;
    if (user?.city)      params.city = user.city;

    const data = await AgriAPI.recommendations.get(params);
    const list = data.results || [];

    if (list.length === 0) {
      container.innerHTML = `<div style="color:var(--text-muted);font-size:.85rem;padding:.5rem">No recommendations yet.</div>`;
      return;
    }

    // Update AI alert
    const alertEl = document.getElementById('aiAlert');
    if (alertEl) alertEl.textContent =
      `✦ Based on your ${capitalize(params.crop)} crop (${params.quantity}t) storage needs`;

    container.innerHTML = list.map(wh => `
      <div class="rec-item">
        <div class="rec-icon">${storageEmoji(wh.storage_type)}</div>
        <div class="rec-info">
          <div class="rec-name">${wh.name}</div>
          <div class="rec-meta">
            ${wh.distance_km ? wh.distance_km + 'km · ' : ''}
            ₹${Number(wh.price_per_tonne).toLocaleString('en-IN')}/t ·
            ${wh.available_capacity}t free
          </div>
        </div>
        <div class="rec-score">
          <span class="score-pill">${wh.ai_score}%</span>
        </div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = `<div style="color:var(--text-muted);font-size:.85rem;padding:.5rem">Could not load recommendations.</div>`;
  }
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

function formatDateRange(start, end) {
  const fmt = d => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function statusBadge(status) {
  const map = {
    pending:   ['status-pending',   '⏳ Pending'],
    confirmed: ['status-active',    '● Confirmed'],
    active:    ['status-active',    '● Active'],
    completed: ['status-completed', '✓ Completed'],
    rejected:  ['status-rejected',  '✕ Rejected'],
    cancelled: ['status-completed', '✕ Cancelled'],
  };
  const [cls, label] = map[status] || ['status-completed', status];
  return `<span class="status-badge ${cls}">${label}</span>`;
}

function storageEmoji(type) {
  return { dry:'🏭', cold_chain:'❄️', refrigerated:'🧊', silo:'🌿', open_yard:'🏕️' }[type] || '🏬';
}
