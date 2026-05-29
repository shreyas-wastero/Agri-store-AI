/* ═══════════════════════════════════════════
   AgriStore AI — Owner Dashboard Logic
   js/owner-dashboard.js
═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  const user = AgriAPI.Auth.getUser();
  if (user?.role === 'farmer') {
    window.location.href = 'farmer-dashboard.html';
    return;
  }

  renderOwnerInfo(user);
  await Promise.all([loadMyWarehouses(), loadIncomingBookings()]);
});

/* ─── USER INFO ──────────────────────────────────────────────────────────── */
function renderOwnerInfo(user) {
  const name = user?.first_name || user?.username || 'Owner';
  const avatarEl = document.getElementById('ownerAvatar');
  if (avatarEl) avatarEl.textContent = (name[0] + (user?.last_name?.[0] || '')).toUpperCase();

  const nameEl = document.getElementById('ownerName');
  if (nameEl) nameEl.textContent = user?.first_name + ' ' + (user?.last_name || '');
}

/* ─── MY WAREHOUSES ──────────────────────────────────────────────────────── */
let _myWarehouses = [];

async function loadMyWarehouses() {
  try {
    const data = await AgriAPI.warehouses.mine();
    _myWarehouses = data.results || data;
    renderWarehouseMetrics(_myWarehouses);
    renderCapacityPanel(_myWarehouses);
  } catch {
    showToast('Could not load warehouse data.', 'error');
  }
}

function renderWarehouseMetrics(warehouses) {
  const totalCap  = warehouses.reduce((s, w) => s + w.total_capacity, 0);
  const totalAvail = warehouses.reduce((s, w) => s + w.available_capacity, 0);
  const used      = totalCap - totalAvail;
  const utilPct   = totalCap > 0 ? Math.round((used / totalCap) * 100) : 0;

  setEl('metricTotalCap',   totalCap.toLocaleString('en-IN') + 't');
  setEl('metricUtilised',   utilPct + '%');
  setEl('metricWarehouses', warehouses.length);
}

function renderCapacityPanel(warehouses) {
  const panel = document.getElementById('capacityPanel');
  if (!panel || warehouses.length === 0) return;

  panel.innerHTML = warehouses.map(wh => {
    const used = wh.total_capacity - wh.available_capacity;
    const pct  = wh.total_capacity > 0 ? Math.round((used / wh.total_capacity) * 100) : 0;
    return `
      <div style="margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:.3rem">
          <strong>${wh.name}</strong>
          <span style="color:var(--green-700)">${pct}% full</span>
        </div>
        <div class="capacity-bar">
          <div class="capacity-fill" style="width:${pct}%"></div>
        </div>
        <div style="font-size:.75rem;color:var(--text-muted)">
          ${used.toLocaleString()}t used · ${wh.available_capacity.toLocaleString()}t free of ${wh.total_capacity.toLocaleString()}t
        </div>
        <div style="margin-top:.4rem">
          ${(wh.compatible_crops || []).map(c =>
            `<span class="tag">${capitalize(c)}</span>`).join('')}
        </div>
      </div>`;
  }).join('');
}

/* ─── INCOMING BOOKINGS ───────────────────────────────────────────────────── */
async function loadIncomingBookings(filterStatus = '') {
  const tbody = document.getElementById('incomingBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text-muted)">Loading requests…</td></tr>`;

  try {
    const data     = await AgriAPI.bookings.incoming(filterStatus);
    const bookings = data.results || data;

    // Metrics
    const pending  = bookings.filter(b => b.status === 'pending');
    setEl('metricPending',  pending.length);
    setEl('metricRevenue',  calcRevenue(bookings));
    setEl('metricFarmers',  new Set(bookings.map(b => b.farmer)).size);
    updatePendingBadge(pending.length);

    if (bookings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">No booking requests yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = bookings.map(b => `
      <tr id="row-${b.id}">
        <td>
          <div class="wh-cell-name">${b.farmer_name}</div>
          <div class="wh-cell-sub">${b.reference_number}</div>
        </td>
        <td>${b.warehouse_name}</td>
        <td>${capitalize(b.crop_type)}</td>
        <td>${b.quantity}t · ${b.duration_months}mo</td>
        <td>₹${Number(b.total_amount || 0).toLocaleString('en-IN')}</td>
        <td>
          ${b.status === 'pending'
            ? `<div class="action-row">
                <button class="btn btn-primary btn-sm" onclick="updateStatus(${b.id},'confirmed')">Accept</button>
                <button class="btn btn-danger btn-sm"  onclick="updateStatus(${b.id},'rejected')">Decline</button>
               </div>`
            : statusBadge(b.status)}
        </td>
      </tr>
    `).join('');
  } catch {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#c0392b;padding:1.5rem">
      Failed to load. <button class="btn btn-outline btn-sm" onclick="loadIncomingBookings()">Retry</button>
    </td></tr>`;
  }
}

/* ─── ACCEPT / REJECT ─────────────────────────────────────────────────────── */
async function updateStatus(bookingId, newStatus) {
  try {
    await AgriAPI.bookings.updateStatus(bookingId, { status: newStatus });
    showToast(`Booking ${newStatus}.`, newStatus === 'confirmed' ? 'success' : 'info');
    await loadIncomingBookings();
    await loadMyWarehouses(); // refresh capacity
  } catch (err) {
    showToast(err?.data?.detail || 'Update failed.', 'error');
  }
}

/* ─── STATUS FILTER TABS ─────────────────────────────────────────────────── */
document.querySelectorAll('.status-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadIncomingBookings(tab.dataset.status || '');
  });
});

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

function calcRevenue(bookings) {
  const total = bookings
    .filter(b => ['confirmed','active','completed'].includes(b.status))
    .reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
  return '₹' + Math.round(total).toLocaleString('en-IN');
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

function updatePendingBadge(count) {
  const el = document.getElementById('pendingBadge');
  if (el) el.textContent = count > 0 ? count + ' Pending' : 'All caught up';
}
