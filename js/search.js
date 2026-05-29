/* ═══════════════════════════════════════════
   AgriStore AI — Search Page Logic
   js/search.js
═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  prefillFromURL();
  loadWarehouses();
  initFilters();
});

/* ─── PREFILL from URL params (from landing page search) ─────────────────── */
function prefillFromURL() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('city')) document.getElementById('searchCity').value = p.get('city');
  if (p.get('crop')) document.getElementById('searchCrop').value = p.get('crop');
  if (p.get('qty'))  document.getElementById('searchQty').value  = p.get('qty');
}

/* ─── LOAD WAREHOUSES via AI recommendations API ─────────────────────────── */
async function loadWarehouses() {
  const city = document.getElementById('searchCity')?.value.trim();
  const crop = document.getElementById('searchCrop')?.value || 'general';
  const qty  = parseFloat(document.getElementById('searchQty')?.value) || 1;

  showLoading();

  try {
    // Try AI recommendations endpoint first
    const params = { crop, quantity: qty, limit: 20 };
    if (city) params.city = city;

    // Add user coords if available
    const user = AgriAPI.Auth.getUser();
    if (user?.latitude)  params.lat = user.latitude;
    if (user?.longitude) params.lng = user.longitude;

    const data = await AgriAPI.recommendations.get(params);
    renderCards(data.results, crop, qty);
    updateResultCount(data.count, city, crop);
  } catch (err) {
    // Fallback to plain warehouse list
    try {
      const params = {};
      if (city) params.city = city;
      if (crop !== 'general') params.crop = crop;
      const qty_val = parseFloat(document.getElementById('searchQty')?.value);
      if (qty_val) params.min_capacity = qty_val;

      const data = await AgriAPI.warehouses.list(params);
      const results = data.results || data;
      renderCards(results, crop, qty);
      updateResultCount(results.length, city, crop);
    } catch (e) {
      showError('Could not load warehouses. Is the backend running?');
    }
  }
}

/* ─── RENDER WAREHOUSE CARDS ─────────────────────────────────────────────── */
function renderCards(warehouses, crop, qty) {
  const container = document.getElementById('warehouseGrid');
  if (!container) return;

  if (!warehouses || warehouses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No warehouses found</h3>
        <p>Try adjusting your filters or search a different city.</p>
      </div>`;
    return;
  }

  const isFirst = (_, i) => i === 0;

  container.innerHTML = warehouses.map((wh, i) => {
    const aiScore   = wh.ai_score   ?? null;
    const distKm    = wh.distance_km ?? null;
    const isAiPick  = aiScore !== null && aiScore >= 85 && i === 0;
    const crops     = (wh.compatible_crops || []).map(c =>
      `<span class="tag ${['rice','wheat','maize','pulses'].includes(c) ? 'grain' : ''}">${capitalize(c)}</span>`
    ).join('');
    const facilities = (wh.facilities || []).map(f =>
      `<span class="tag">${f}</span>`
    ).join('');
    const distLabel = distKm ? `· ${distKm} km away` : '';
    const emoji = storageEmoji(wh.storage_type);

    return `
      <div class="warehouse-card ${isAiPick ? 'ai-pick' : ''}"
           onclick="openBookingModal(${wh.id})"
           data-id="${wh.id}">
        ${isAiPick ? '<span class="ai-pick-badge">★ AI Pick</span>' : ''}
        <div class="wh-img">
          ${wh.image
            ? `<img src="${wh.image}" alt="${wh.name}">`
            : `<div class="wh-img-placeholder">${emoji}</div>`}
        </div>
        <div class="wh-body">
          <div class="wh-name">${wh.name}</div>
          <div class="wh-location">📍 ${wh.city}, ${wh.state} ${distLabel}</div>
          ${aiScore !== null
            ? `<div class="ai-score">AI Score: ${aiScore}% match for ${capitalize(crop)}</div>`
            : ''}
          <div class="tags">${crops}${facilities}</div>
          <div class="wh-meta">
            <span><strong>${wh.total_capacity?.toLocaleString()}</strong> t total</span>
            <span><strong>${wh.available_capacity?.toLocaleString()}</strong> t available</span>
            <span class="stars">⭐ ${wh.rating?.toFixed(1)}</span>
            <span>(${wh.total_reviews} reviews)</span>
          </div>
        </div>
        <div class="wh-actions">
          <div class="price-big">
            <strong>₹${Number(wh.price_per_tonne).toLocaleString('en-IN')}</strong>
            <span>per tonne/month</span>
          </div>
          <button class="btn btn-primary btn-sm"
                  onclick="event.stopPropagation(); openBookingModal(${wh.id})">
            Book Now
          </button>
          <button class="btn btn-outline btn-sm"
                  onclick="event.stopPropagation(); viewDetail(${wh.id})">
            Details
          </button>
        </div>
      </div>`;
  }).join('');
}

function updateResultCount(count, city, crop) {
  const el = document.getElementById('resultCount');
  if (el) el.textContent = `${count} warehouses${city ? ' near ' + city : ''} — AI-ranked for ${capitalize(crop)} storage`;
}

function showLoading() {
  const c = document.getElementById('warehouseGrid');
  if (c) c.innerHTML = `
    <div style="text-align:center;padding:3rem;color:var(--text-muted)">
      <div style="font-size:2rem;margin-bottom:1rem">⏳</div>
      <div>Finding best warehouses…</div>
    </div>`;
}

function showError(msg) {
  const c = document.getElementById('warehouseGrid');
  if (c) c.innerHTML = `
    <div style="text-align:center;padding:3rem;color:#c0392b">
      <div style="font-size:2rem;margin-bottom:1rem">⚠️</div>
      <div>${msg}</div>
      <button class="btn btn-outline" style="margin-top:1rem" onclick="loadWarehouses()">Retry</button>
    </div>`;
}

/* ─── SEARCH BUTTON ──────────────────────────────────────────────────────── */
document.getElementById('searchBtn')?.addEventListener('click', loadWarehouses);
document.getElementById('searchCity')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') loadWarehouses();
});

/* ─── RANGE FILTER LABELS ────────────────────────────────────────────────── */
function initFilters() {
  const priceSlider = document.getElementById('priceSlider');
  const distSlider  = document.getElementById('distSlider');
  if (priceSlider) {
    priceSlider.addEventListener('input', () => {
      document.getElementById('priceVal').textContent = '₹' + priceSlider.value + '/t';
    });
  }
  if (distSlider) {
    distSlider.addEventListener('input', () => {
      document.getElementById('distVal').textContent = distSlider.value + ' km';
    });
  }
}

/* ─── SORT ───────────────────────────────────────────────────────────────── */
document.getElementById('sortSelect')?.addEventListener('change', function() {
  const cards = [...document.querySelectorAll('.warehouse-card')];
  const grid  = document.getElementById('warehouseGrid');
  if (!grid || cards.length === 0) return;

  switch (this.value) {
    case 'price_asc':
      cards.sort((a, b) => getPriceFromCard(a) - getPriceFromCard(b)); break;
    case 'price_desc':
      cards.sort((a, b) => getPriceFromCard(b) - getPriceFromCard(a)); break;
    case 'rating':
      cards.sort((a, b) => getRatingFromCard(b) - getRatingFromCard(a)); break;
    default: break; // AI ranked = default
  }
  cards.forEach(c => grid.appendChild(c));
});

function getPriceFromCard(card) {
  return parseFloat(card.querySelector('.price-big strong')?.textContent.replace(/[₹,]/g,'')) || 0;
}
function getRatingFromCard(card) {
  return parseFloat(card.querySelector('.stars')?.nextSibling?.textContent) || 0;
}

/* ─── VIEW DETAIL ────────────────────────────────────────────────────────── */
function viewDetail(id) {
  window.location.href = `warehouse-detail.html?id=${id}`;
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}
function storageEmoji(type) {
  const map = { dry: '🏭', cold_chain: '❄️', refrigerated: '🧊', silo: '🌿', open_yard: '🏕️' };
  return map[type] || '🏬';
}
