/* ═══════════════════════════════════════════
   AgriStore AI — Booking Modal Logic
   js/booking.js
═══════════════════════════════════════════ */

let _activeWarehouse = null;

/* ─── OPEN MODAL ─────────────────────────────────────────────────────────── */
async function openBookingModal(warehouseId) {
  if (!AgriAPI.Auth.isLoggedIn()) {
    if (confirm('Please log in to book a warehouse. Go to login page?')) {
      window.location.href = `login.html?next=search.html`;
    }
    return;
  }

  const user = AgriAPI.Auth.getUser();
  if (user?.role === 'owner') {
    showToast('Warehouse owners cannot make bookings.', 'error');
    return;
  }

  // Show modal with loading state
  const overlay = document.getElementById('bookingModal');
  if (!overlay) return;
  overlay.classList.add('open');
  document.getElementById('modalWhName').textContent = 'Loading…';

  try {
    const wh = await AgriAPI.warehouses.get(warehouseId);
    _activeWarehouse = wh;
    populateModal(wh);
  } catch {
    showToast('Could not load warehouse details.', 'error');
    closeBookingModal();
  }
}

function populateModal(wh) {
  document.getElementById('modalWhName').textContent = wh.name;
  document.getElementById('modalWhLocation').textContent = `${wh.city}, ${wh.state}`;
  document.getElementById('modalRate').textContent = `₹${Number(wh.price_per_tonne).toLocaleString('en-IN')}`;
  document.getElementById('modalAvail').textContent = `${wh.available_capacity} tonnes available`;

  // Populate crop select based on compatible crops
  const cropSel = document.getElementById('bookCrop');
  if (cropSel) {
    const crops = wh.compatible_crops?.length ? wh.compatible_crops : ['general'];
    cropSel.innerHTML = crops.map(c =>
      `<option value="${c}">${capitalize(c)}</option>`
    ).join('');
  }

  // Set default dates
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(today.getMonth() + 3);
  document.getElementById('bookStart').value = formatDate(today);
  document.getElementById('bookEnd').value   = formatDate(nextMonth);

  updateBookingSummary();
}

/* ─── CLOSE MODAL ────────────────────────────────────────────────────────── */
function closeBookingModal() {
  const overlay = document.getElementById('bookingModal');
  if (overlay) overlay.classList.remove('open');
  _activeWarehouse = null;
}

// Close on overlay click
document.getElementById('bookingModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeBookingModal();
});

/* ─── LIVE COST CALCULATOR ───────────────────────────────────────────────── */
function updateBookingSummary() {
  if (!_activeWarehouse) return;
  const qty     = parseFloat(document.getElementById('bookQty')?.value) || 0;
  const start   = new Date(document.getElementById('bookStart')?.value);
  const end     = new Date(document.getElementById('bookEnd')?.value);
  const rate    = parseFloat(_activeWarehouse.price_per_tonne) || 0;

  if (isNaN(start) || isNaN(end) || end <= start) {
    document.getElementById('sumDur').textContent   = '—';
    document.getElementById('sumTotal').textContent = '—';
    return;
  }

  const months = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 30)));
  const total  = qty * rate * months;

  document.getElementById('sumQty').textContent   = qty + ' tonnes';
  document.getElementById('sumDur').textContent   = months + ' month' + (months !== 1 ? 's' : '');
  document.getElementById('sumTotal').textContent = '₹' + Math.round(total).toLocaleString('en-IN');

  // Capacity warning
  const warn = document.getElementById('capacityWarn');
  if (warn) {
    const avail = _activeWarehouse.available_capacity;
    warn.style.display = qty > avail ? 'block' : 'none';
    warn.textContent = `⚠️ Only ${avail} tonnes available.`;
  }
}

// Attach change listeners
['bookQty','bookStart','bookEnd'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updateBookingSummary);
});

/* ─── SUBMIT BOOKING ─────────────────────────────────────────────────────── */
async function confirmBooking() {
  if (!_activeWarehouse) return;

  const qty     = parseInt(document.getElementById('bookQty')?.value);
  const crop    = document.getElementById('bookCrop')?.value;
  const start   = document.getElementById('bookStart')?.value;
  const end     = document.getElementById('bookEnd')?.value;
  const special = document.getElementById('bookSpecial')?.value || '';

  // Validate
  if (!qty || qty <= 0) { showToast('Enter a valid quantity.', 'error'); return; }
  if (!start || !end)   { showToast('Select start and end dates.', 'error'); return; }
  if (qty > _activeWarehouse.available_capacity) {
    showToast(`Only ${_activeWarehouse.available_capacity} tonnes available.`, 'error');
    return;
  }

  const btn = document.getElementById('confirmBookingBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Booking…'; }

  try {
    const booking = await AgriAPI.bookings.create({
      warehouse:  _activeWarehouse.id,
      crop_type:  crop,
      quantity:   qty,
      start_date: start,
      end_date:   end,
      special_req: special,
    });

    closeBookingModal();
    showBookingSuccess(booking);
  } catch (err) {
    const msg = err?.data?.quantity?.[0]
             || err?.data?.non_field_errors?.[0]
             || err?.data?.detail
             || 'Booking failed. Please try again.';
    showToast(msg, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm Booking →'; }
  }
}

/* ─── SUCCESS SCREEN ─────────────────────────────────────────────────────── */
function showBookingSuccess(booking) {
  const refEl = document.getElementById('bookingRefNum');
  if (refEl) refEl.textContent = booking.reference_number;

  const amtEl = document.getElementById('bookingTotalAmt');
  if (amtEl) amtEl.textContent = '₹' + Number(booking.total_amount).toLocaleString('en-IN');

  const wrapEl = document.getElementById('successWrapper');
  const searchEl = document.getElementById('searchWrapper');
  if (wrapEl)  wrapEl.style.display  = 'block';
  if (searchEl) searchEl.style.display = 'none';
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function formatDate(d) {
  return d.toISOString().split('T')[0];
}
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}
