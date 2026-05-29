/* ═══════════════════════════════════════════
   AgriStore AI — API Client
   js/api.js

   Base URL: http://127.0.0.1:8000/api
   All requests go through AgriAPI.request()
═══════════════════════════════════════════ */

const AgriAPI = (() => {

  const BASE = 'http://127.0.0.1:8000/api';

  // ─── TOKEN STORAGE ───────────────────────────────────────────────────────
  const Auth = {
    getAccess()  { return localStorage.getItem('agri_access'); },
    getRefresh() { return localStorage.getItem('agri_refresh'); },
    getUser()    {
      try { return JSON.parse(localStorage.getItem('agri_user')); }
      catch { return null; }
    },
    set(tokens, user) {
      localStorage.setItem('agri_access',  tokens.access);
      localStorage.setItem('agri_refresh', tokens.refresh);
      localStorage.setItem('agri_user',    JSON.stringify(user));
    },
    clear() {
      ['agri_access','agri_refresh','agri_user'].forEach(k => localStorage.removeItem(k));
    },
    isLoggedIn() { return !!this.getAccess(); },
  };

  // ─── CORE REQUEST ─────────────────────────────────────────────────────────
  async function request(method, path, body = null, retry = true) {
    const headers = { 'Content-Type': 'application/json' };
    const token = Auth.getAccess();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    let url = path.startsWith('http') ? path : `${BASE}${path}`;
    const res = await fetch(url, opts);

    // Token expired → try refresh once
    if (res.status === 401 && retry) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return request(method, path, body, false);
      Auth.clear();
      window.location.href = 'login.html';
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, data };
    return data;
  }

  async function refreshAccessToken() {
    const refresh = Auth.getRefresh();
    if (!refresh) return false;
    try {
      const res = await fetch(`${BASE}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('agri_access', data.access);
      return true;
    } catch { return false; }
  }

  // ─── CONVENIENCE METHODS ──────────────────────────────────────────────────
  const get    = (path)        => request('GET',    path);
  const post   = (path, body)  => request('POST',   path, body);
  const patch  = (path, body)  => request('PATCH',  path, body);
  const put    = (path, body)  => request('PUT',    path, body);
  const del    = (path)        => request('DELETE', path);

  // ─── AUTH ENDPOINTS ───────────────────────────────────────────────────────
  const auth = {
    async register(payload) {
      const data = await post('/auth/register/', payload);
      Auth.set(data.tokens, data.user);
      return data;
    },
    async login(username, password) {
      const data = await post('/auth/login/', { username, password });
      Auth.set(data.tokens, data.user);
      return data;
    },
    async logout() {
      try { await post('/auth/logout/', { refresh: Auth.getRefresh() }); } catch {}
      Auth.clear();
    },
    profile: () => get('/auth/profile/'),
    updateProfile: (body) => patch('/auth/profile/', body),
  };

  // ─── WAREHOUSE ENDPOINTS ──────────────────────────────────────────────────
  const warehouses = {
    list(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return get(`/warehouses/${qs ? '?' + qs : ''}`);
    },
    get: (id) => get(`/warehouses/${id}/`),
    create: (body) => post('/warehouses/', body),
    update: (id, body) => patch(`/warehouses/${id}/`, body),
    delete: (id) => del(`/warehouses/${id}/`),
    mine: () => get('/warehouses/mine/'),
    reviews: (id) => get(`/warehouses/${id}/reviews/`),
    addReview: (id, body) => post(`/warehouses/${id}/reviews/`, body),
  };

  // ─── BOOKING ENDPOINTS ────────────────────────────────────────────────────
  const bookings = {
    list: () => get('/bookings/'),
    incoming: (status) => get(`/bookings/incoming/${status ? '?status=' + status : ''}`),
    get: (id) => get(`/bookings/${id}/`),
    create: (body) => post('/bookings/', body),
    cancel: (id) => del(`/bookings/${id}/`),
    updateStatus: (id, body) => patch(`/bookings/${id}/status/`, body),
  };

  // ─── RECOMMENDATION ENDPOINT ──────────────────────────────────────────────
  const recommendations = {
    get(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return get(`/recommendations/?${qs}`);
    },
  };

  // ─── PUBLIC SURFACE ───────────────────────────────────────────────────────
  return { Auth, auth, warehouses, bookings, recommendations, request, get, post, patch };

})();

/* ─── GUARD: redirect to login if not authenticated ───────────────────────── */
function requireAuth() {
  if (!AgriAPI.Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

/* ─── GUARD: fill navbar with user info ───────────────────────────────────── */
function initNavbar() {
  const user = AgriAPI.Auth.getUser();
  const actionsEl = document.getElementById('navActions');
  if (!actionsEl) return;

  if (user) {
    const dash = user.role === 'owner' ? 'owner-dashboard.html' : 'farmer-dashboard.html';
    actionsEl.innerHTML = `
      <a href="${dash}" class="btn btn-outline">Dashboard</a>
      <button class="btn btn-primary" id="navLogoutBtn">Logout</button>
    `;
    document.getElementById('navLogoutBtn')?.addEventListener('click', async () => {
      await AgriAPI.auth.logout();
      window.location.href = 'index.html';
    });
  } else {
    actionsEl.innerHTML = `
      <a href="login.html"    class="btn btn-outline">Login</a>
      <a href="register.html" class="btn btn-primary">Get Started</a>
    `;
  }
}

document.addEventListener('DOMContentLoaded', initNavbar);
