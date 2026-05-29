/* ═══════════════════════════════════════════
   AgriStore AI — App Navigation & Utilities
   js/app.js
═══════════════════════════════════════════ */

/* ─── ACTIVE NAV LINK ─── */
(function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && page.includes(href.replace('.html', ''))) {
      link.classList.add('active');
    }
  });
})();

/* ─── SEARCH TABS (on landing page) ─── */
document.querySelectorAll('.search-tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.search-tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

/* ─── HERO SEARCH → redirect to search page ─── */
const heroSearchBtn = document.getElementById('heroSearchBtn');
if (heroSearchBtn) {
  heroSearchBtn.addEventListener('click', () => {
    const loc   = document.getElementById('heroLocation')?.value.trim();
    const crop  = document.getElementById('heroCrop')?.value;
    const qty   = document.getElementById('heroQty')?.value;
    const params = new URLSearchParams({ loc, crop, qty });
    window.location.href = `search.html?${params}`;
  });
}

/* ─── PRE-FILL SEARCH PAGE from URL params ─── */
(function prefillSearch() {
  if (!window.location.pathname.includes('search')) return;
  const p = new URLSearchParams(window.location.search);
  const locEl  = document.getElementById('searchLocation');
  const cropEl = document.getElementById('searchCrop');
  const qtyEl  = document.getElementById('searchQty');
  if (locEl  && p.get('loc'))  locEl.value  = p.get('loc');
  if (cropEl && p.get('crop')) cropEl.value = p.get('crop');
  if (qtyEl  && p.get('qty'))  qtyEl.value  = p.get('qty');
})();

/* ─── FORMAT CURRENCY ─── */
function formatINR(amount) {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

/* ─── DEBOUNCE ─── */
function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

/* ─── TOAST NOTIFICATION ─── */
function showToast(message, type = 'success') {
  const existing = document.getElementById('agri-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'agri-toast';
  toast.textContent = message;

  const colors = {
    success: { bg: '#d4f7e5', color: '#0a6640', border: '#95d5b2' },
    error:   { bg: '#fde8e8', color: '#a93226', border: '#f5b7b1' },
    info:    { bg: '#e8f4fd', color: '#1a5276', border: '#aed6f1' },
  };
  const c = colors[type] || colors.success;

  Object.assign(toast.style, {
    position:     'fixed',
    bottom:       '2rem',
    right:        '2rem',
    background:   c.bg,
    color:        c.color,
    border:       `1px solid ${c.border}`,
    borderRadius: '8px',
    padding:      '.75rem 1.25rem',
    fontSize:     '.875rem',
    fontWeight:   '500',
    zIndex:       '9999',
    boxShadow:    '0 4px 16px rgba(0,0,0,.1)',
    animation:    'toast-in .25s ease',
    fontFamily:   'DM Sans, sans-serif',
  });

  const style = document.createElement('style');
  style.textContent = `
    @keyframes toast-in { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes toast-out { from { opacity: 1; } to { opacity: 0; } }
  `;
  document.head.appendChild(style);
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-out .25s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ─── GENERATE BOOKING REF ─── */
function generateBookingRef() {
  return 'AGR-2025-' + Math.floor(1000 + Math.random() * 9000);
}
