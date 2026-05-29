/* ═══════════════════════════════════════════
   AgriStore AI — Auth Logic (Login + Register)
   js/auth.js
═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // Redirect if already logged in
  if (AgriAPI.Auth.isLoggedIn()) {
    const user = AgriAPI.Auth.getUser();
    window.location.href = user?.role === 'owner'
      ? 'owner-dashboard.html' : 'farmer-dashboard.html';
    return;
  }

  initLoginForm();
  initRegisterForm();
});

/* ─── LOGIN ──────────────────────────────────────────────────────────────── */
function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn      = document.getElementById('loginBtn');
    const errEl    = document.getElementById('loginError');

    if (!username || !password) {
      errEl.textContent = 'Please enter your username and password.';
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Logging in…';
    errEl.textContent = '';

    try {
      const data = await AgriAPI.auth.login(username, password);
      showToast(`Welcome back, ${data.user.first_name || data.user.username}!`);
      const next = new URLSearchParams(window.location.search).get('next');
      setTimeout(() => {
        window.location.href = next
          ? next
          : (data.user.role === 'owner' ? 'owner-dashboard.html' : 'farmer-dashboard.html');
      }, 600);
    } catch (err) {
      errEl.textContent = err?.data?.non_field_errors?.[0]
        || err?.data?.detail || 'Login failed. Check your credentials.';
      btn.disabled    = false;
      btn.textContent = 'Login';
    }
  });
}

/* ─── REGISTER ───────────────────────────────────────────────────────────── */
function initRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  // Role toggle: show farmer-specific fields
  document.querySelectorAll('input[name="role"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isFarmer = radio.value === 'farmer';
      const farmerSection = document.getElementById('farmerFields');
      if (farmerSection) farmerSection.style.display = isFarmer ? 'grid' : 'none';
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn   = document.getElementById('registerBtn');
    const errEl = document.getElementById('registerError');
    errEl.textContent = '';

    const payload = {
      username:   document.getElementById('regUsername').value.trim(),
      email:      document.getElementById('regEmail').value.trim(),
      first_name: document.getElementById('regFirstName').value.trim(),
      last_name:  document.getElementById('regLastName').value.trim(),
      password:   document.getElementById('regPassword').value,
      password2:  document.getElementById('regPassword2').value,
      role:       document.querySelector('input[name="role"]:checked')?.value || 'farmer',
      phone:      document.getElementById('regPhone')?.value.trim() || '',
      city:       document.getElementById('regCity')?.value.trim() || '',
      state:      document.getElementById('regState')?.value.trim() || 'Karnataka',
    };

    if (payload.role === 'farmer') {
      payload.primary_crop     = document.getElementById('regCrop')?.value || '';
      payload.land_area_acres  = parseFloat(document.getElementById('regLand')?.value) || null;
    }

    if (!payload.username || !payload.email || !payload.password) {
      errEl.textContent = 'Please fill all required fields.';
      return;
    }
    if (payload.password !== payload.password2) {
      errEl.textContent = 'Passwords do not match.';
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Creating account…';

    try {
      const data = await AgriAPI.auth.register(payload);
      showToast('Account created! Redirecting…');
      setTimeout(() => {
        window.location.href = data.user.role === 'owner'
          ? 'owner-dashboard.html' : 'farmer-dashboard.html';
      }, 700);
    } catch (err) {
      const errs = err?.data || {};
      const msg  = Object.values(errs).flat().join(' ') || 'Registration failed.';
      errEl.textContent = msg;
      btn.disabled    = false;
      btn.textContent = 'Create Account';
    }
  });
}
