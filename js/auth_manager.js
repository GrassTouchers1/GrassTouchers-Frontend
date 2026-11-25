/**
 * Copyright 2026 GrassTouchers Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NorthStarAuth — Quan ly Xac thuc & Phan quyen RBAC phia Frontend.
 * - Luu phien dang nhap (Bearer token + thong tin vai tro) trong localStorage.
 * - Tu dong dinh kem header Authorization cho moi yeu cau toi Backend API.
 * - Xu ly 401 (het phien/chua dang nhap) va 403 (khong du quyen) dong bo UI.
 * - Ho tro Modal Dang nhap / Dang ky Dan su / Chuyen tai khoan Demo cuc bo.
 */
(function (globalScope) {
  'use strict';

  const SESSION_KEY = 'northstar_auth_session_v1';
  const DEMO_PASSWORD_KEY = 'northstar_demo_pw';
  const ROLE_LABELS = {
    guest: { label: 'Khách (Chỉ xem công khai)', short: 'KHÁCH', color: 'text-slate-300 border-slate-600 bg-slate-800/80' },
    citizen: { label: 'Người dân (Citizen)', short: 'DÂN SỰ', color: 'text-sky-300 border-sky-500/40 bg-sky-950/80' },
    rescue: { label: 'Lực lượng Cứu hộ (Rescue)', short: 'CỨU HỘ', color: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/80' },
    coordinator: { label: 'Điều phối viên (Coordinator)', short: 'ĐIỀU PHỐI', color: 'text-amber-300 border-amber-500/40 bg-amber-950/80' },
    admin: { label: 'Quản trị Hệ thống (Admin)', short: 'ADMIN', color: 'text-rose-300 border-rose-500/40 bg-rose-950/80' },
  };

  let session = null;

  function loadSession() {
    try {
      const raw = globalScope.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.access_token || !parsed.user) return null;
      if (parsed.expires_at && Date.parse(parsed.expires_at) <= Date.now()) {
        globalScope.localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function saveSession(nextSession) {
    session = nextSession;
    try {
      if (nextSession) {
        globalScope.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      } else {
        globalScope.localStorage.removeItem(SESSION_KEY);
      }
    } catch (_) {}
    renderAuthIndicators();
  }

  function getApiBase() {
    if (globalScope.GRASSTOUCHER_CONFIG && typeof globalScope.GRASSTOUCHER_CONFIG.API_BASE_URL === 'string') {
      return globalScope.GRASSTOUCHER_CONFIG.API_BASE_URL.replace(/\/+$/, '');
    }
    return '';
  }

  function isApiRequestUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const base = getApiBase();
    if (url.startsWith('/api/')) return true;
    if (base && url.startsWith(base + '/api/')) return true;
    if (!base && globalScope.location && url.startsWith(globalScope.location.origin + '/api/')) return true;
    return false;
  }

  // Wrap window.fetch cleanly to inject Bearer token & surface RBAC feedback
  const _origFetch = globalScope.fetch.bind(globalScope);
  globalScope.fetch = async function (input, init) {
    const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    const opts = Object.assign({}, init || {});

    if (isApiRequestUrl(urlStr) && session && session.access_token) {
      const headers = new Headers(opts.headers || (typeof input !== 'string' && input && input.headers ? input.headers : undefined));
      if (!headers.has('Authorization')) {
        headers.set('Authorization', 'Bearer ' + session.access_token);
      }
      opts.headers = headers;
    }

    const resp = await _origFetch(input, opts);

    if (isApiRequestUrl(urlStr) && !urlStr.includes('/api/auth/login')) {
      if (resp.status === 401 && session && session.access_token) {
        saveSession(null);
        notify('Phiên đăng nhập đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.', 'warning');
      } else if (resp.status === 403 && !urlStr.includes('/api/auth/register')) {
        notify('Truy cập bị từ chối (403): Vai trò hiện tại không có quyền thực hiện thao tác này.', 'warning');
      }
    }
    return resp;
  };

  function notify(msg, type = 'info') {
    if (globalScope.CommandUIController && typeof globalScope.CommandUIController.showToast === 'function') {
      globalScope.CommandUIController.showToast(type === 'warning' ? '⛔ PHÂN QUYỀN RBAC' : '🔐 XÁC THỰC NORTHSTAR', msg, type);
    } else if (globalScope.CitizenPortal && typeof globalScope.CitizenPortal.showToast === 'function') {
      globalScope.CitizenPortal.showToast(msg, type);
    } else {
      console.log('[NorthStarAuth]', type, msg);
    }
  }

  function getRole() {
    return (session && session.user && session.user.role) ? session.user.role : 'guest';
  }

  function getUser() {
    return (session && session.user) ? session.user : null;
  }

  function getToken() {
    return (session && session.access_token) ? session.access_token : null;
  }

  async function login(username, password) {
    const base = getApiBase();
    const res = await _origFetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'Đăng nhập thất bại.');
    }
    saveSession(data);
    await syncOperationalDataAfterAuth();
    return data;
  }

  async function registerCitizen(username, password, fullName) {
    const base = getApiBase();
    const res = await _origFetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, full_name: fullName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'Đăng ký thất bại.');
    }
    saveSession(data);
    await syncOperationalDataAfterAuth();
    return data;
  }

  async function logout() {
    const tok = getToken();
    const base = getApiBase();
    if (tok) {
      try {
        await _origFetch(`${base}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + tok },
        });
      } catch (_) {}
    }
    saveSession(null);
    renderAuthIndicators();
    notify('Đã đăng xuất an toàn về chế độ Khách (Guest).', 'info');
  }

  async function syncOperationalDataAfterAuth() {
    const role = getRole();
    try {
      if (['rescue', 'coordinator', 'admin'].includes(role)) {
        if (globalScope.NorthStarRescue && typeof globalScope.NorthStarRescue.loadSOSBeacons === 'function') {
          await globalScope.NorthStarRescue.loadSOSBeacons();
        }
        if (globalScope.CommandUIController && typeof globalScope.CommandUIController.refreshSystemData === 'function') {
          await globalScope.CommandUIController.refreshSystemData();
        }
      }
    } catch (_) {}
  }

  function ensureModalExists() {
    if (document.getElementById('northstar-auth-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'northstar-auth-modal';
    modal.className = 'hidden fixed inset-0 z-[2600] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-slate-100">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 class="text-sm font-black text-white flex items-center gap-2">🔐 Đăng nhập & Phân quyền RBAC</h3>
            <p class="text-[11px] text-slate-400">Xác thực Bearer Token phía máy chủ NorthStar</p>
          </div>
          <button type="button" id="ns-auth-close" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer text-xs font-bold">✕</button>
        </div>

        <div id="ns-auth-current-box" class="hidden p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="font-bold text-white" id="ns-auth-user-name">--</div>
              <div class="text-[11px] text-slate-400 font-mono" id="ns-auth-user-role">--</div>
            </div>
            <button type="button" id="ns-auth-logout-btn" class="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer">Đăng xuất</button>
          </div>
          <div id="ns-admin-audit-wrap" class="hidden pt-2 border-t border-slate-700/70">
            <button type="button" id="ns-admin-audit-btn" class="w-full py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 font-bold text-[11px] cursor-pointer">📜 Xem Nhật ký Audit Bảo mật (Admin)</button>
            <div id="ns-admin-audit-list" class="hidden mt-2 max-h-36 overflow-y-auto space-y-1 text-[10px] font-mono bg-slate-950 p-2 rounded-lg border border-slate-800"></div>
          </div>
        </div>

        <div class="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          <button type="button" id="ns-tab-login" class="flex-1 py-1.5 rounded-lg bg-sky-600 text-white cursor-pointer">Đăng nhập</button>
          <button type="button" id="ns-tab-register" class="flex-1 py-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer">Đăng ký Dân sự</button>
        </div>

        <form id="ns-auth-login-form" class="space-y-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Tên đăng nhập</label>
            <input id="ns-login-username" type="text" required placeholder="vd: coordinator_demo" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Mật khẩu</label>
            <input id="ns-login-password" type="password" required placeholder="Nhập mật khẩu" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500" />
          </div>
          <div id="ns-auth-error" class="hidden text-[11px] text-rose-400 bg-rose-950/60 border border-rose-500/40 rounded-lg px-2.5 py-1.5"></div>
          <button type="submit" class="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs cursor-pointer">Đăng nhập Hệ thống</button>

          <div class="pt-2 border-t border-slate-800">
            <div class="text-[10.5px] font-bold text-amber-300 mb-1.5">⚡ Tài khoản Demo cục bộ (DEMO ONLY — kiểm thử phân quyền):</div>
            <div class="grid grid-cols-2 gap-1.5 text-[11px]">
              <button type="button" data-demo-user="citizen_demo" class="ns-demo-btn px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-bold text-left cursor-pointer">👤 Dân sự</button>
              <button type="button" data-demo-user="rescue_demo" class="ns-demo-btn px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-bold text-left cursor-pointer">🚒 Cứu hộ 114</button>
              <button type="button" data-demo-user="coordinator_demo" class="ns-demo-btn px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-left cursor-pointer">🛡️ Điều phối C2</button>
              <button type="button" data-demo-user="admin_demo" class="ns-demo-btn px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-300 font-bold text-left cursor-pointer">⚙️ Quản trị Admin</button>
            </div>
          </div>
        </form>

        <form id="ns-auth-register-form" class="hidden space-y-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Họ và tên</label>
            <input id="ns-reg-fullname" type="text" required placeholder="Nguyễn Văn A" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Tên đăng nhập (tối thiểu 3 ký tự)</label>
            <input id="ns-reg-username" type="text" required minlength="3" placeholder="nguyenvana" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Mật khẩu (tối thiểu 6 ký tự)</label>
            <input id="ns-reg-password" type="password" required minlength="6" placeholder="••••••" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500" />
          </div>
          <div id="ns-reg-error" class="hidden text-[11px] text-rose-400 bg-rose-950/60 border border-rose-500/40 rounded-lg px-2.5 py-1.5"></div>
          <button type="submit" class="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer">Tạo tài khoản Dân sự</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('ns-auth-close').onclick = () => modal.classList.add('hidden');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });

    const tabLogin = document.getElementById('ns-tab-login');
    const tabReg = document.getElementById('ns-tab-register');
    const formLogin = document.getElementById('ns-auth-login-form');
    const formReg = document.getElementById('ns-auth-register-form');

    tabLogin.onclick = () => {
      tabLogin.className = 'flex-1 py-1.5 rounded-lg bg-sky-600 text-white cursor-pointer';
      tabReg.className = 'flex-1 py-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer';
      formLogin.classList.remove('hidden');
      formReg.classList.add('hidden');
    };
    tabReg.onclick = () => {
      tabReg.className = 'flex-1 py-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer';
      tabLogin.className = 'flex-1 py-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer';
      formReg.classList.remove('hidden');
      formLogin.classList.add('hidden');
    };

    document.getElementById('ns-auth-logout-btn').onclick = async () => {
      await logout();
      modal.classList.add('hidden');
    };

    document.getElementById('ns-admin-audit-btn').onclick = async () => {
      const box = document.getElementById('ns-admin-audit-list');
      box.classList.toggle('hidden');
      if (!box.classList.contains('hidden')) {
        box.innerHTML = '<div class="text-slate-400">Đang tải nhật ký...</div>';
        try {
          const r = await globalScope.fetch(`${getApiBase()}/api/admin/audit-logs?limit=20`);
          const data = await r.json();
          if (!r.ok) throw new Error(data.detail || 'Lỗi tải log');
          box.innerHTML = (data.logs || []).map(l =>
            `<div class="border-b border-slate-800/80 pb-1"><span class="text-amber-300">[${l.actor_role}]</span> <span class="text-white">${l.action}</span> → <span class="${l.outcome === 'success' ? 'text-emerald-400' : 'text-rose-400'}">${l.outcome}</span> <span class="text-slate-500">(${l.resource_type})</span></div>`
          ).join('') || '<div class="text-slate-500">Chưa có log.</div>';
        } catch (err) {
          box.innerHTML = `<div class="text-rose-400">${err.message}</div>`;
        }
      }
    };

    formLogin.onsubmit = async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('ns-auth-error');
      errEl.classList.add('hidden');
      try {
        const u = document.getElementById('ns-login-username').value.trim();
        const p = document.getElementById('ns-login-password').value;
        const data = await login(u, p);
        modal.classList.add('hidden');
        notify(`Xin chào ${data.user.full_name} [${data.user.role.toUpperCase()}]`, 'success');
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    };

    formReg.onsubmit = async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('ns-reg-error');
      errEl.classList.add('hidden');
      try {
        const fn = document.getElementById('ns-reg-fullname').value.trim();
        const u = document.getElementById('ns-reg-username').value.trim();
        const p = document.getElementById('ns-reg-password').value;
        const data = await registerCitizen(u, p, fn);
        modal.classList.add('hidden');
        notify(`Đã đăng ký tài khoản Dân sự: ${data.user.username}`, 'success');
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    };

    modal.querySelectorAll('.ns-demo-btn').forEach(btn => {
      btn.onclick = async () => {
        const demoUser = btn.getAttribute('data-demo-user');
        const pwInput = document.getElementById('ns-login-password');
        const userInput = document.getElementById('ns-login-username');
        userInput.value = demoUser;
        // Local demo helper password ONLY on localhost/127.0.0.1 for hackathon demo testing
        const isLocalHost = globalScope.location && (globalScope.location.hostname === 'localhost' || globalScope.location.hostname === '127.0.0.1');
        const localDemoPw = (globalScope.__NORTHSTAR_ENV__ && globalScope.__NORTHSTAR_ENV__.DEMO_PASSWORD)
          || globalScope.localStorage.getItem(DEMO_PASSWORD_KEY)
          || (isLocalHost ? 'NorthStarDemo@2026' : '');
        pwInput.value = localDemoPw;
        if (localDemoPw) {
          formLogin.requestSubmit();
        } else {
          pwInput.focus();
        }
      };
    });
  }

  function openLoginModal() {
    ensureModalExists();
    renderAuthIndicators();
    document.getElementById('northstar-auth-modal').classList.remove('hidden');
  }

  function renderAuthIndicators() {
    const role = getRole();
    const user = getUser();
    const meta = ROLE_LABELS[role] || ROLE_LABELS.guest;

    const btn = document.getElementById('btn-auth-account');
    if (btn) {
      btn.innerHTML = user
        ? `<span class="font-black">${meta.short}</span>`
        : `🔐 <span class="hidden sm:inline">Đăng nhập</span>`;
      btn.className = `flex px-2 py-1 rounded-lg border font-bold text-[10.5px] items-center gap-1 transition cursor-pointer shrink-0 ${meta.color}`;
      btn.title = user ? `${user.full_name} (${role}) — Nhấn để đổi tài khoản / đăng xuất` : 'Đăng nhập tài khoản (Guest / Citizen / Rescue / Coordinator / Admin)';
    }

    const sidebarBadge = document.getElementById('cmd-active-role-badge');
    if (sidebarBadge) {
      sidebarBadge.textContent = user ? `${user.full_name} [${meta.short}]` : '👤 Khách (Guest - Chỉ xem)';
    }

    const curBox = document.getElementById('ns-auth-current-box');
    const adminWrap = document.getElementById('ns-admin-audit-wrap');
    if (curBox) {
      if (user) {
        curBox.classList.remove('hidden');
        document.getElementById('ns-auth-user-name').textContent = `${user.full_name} (@${user.username})`;
        document.getElementById('ns-auth-user-role').textContent = `Vai trò xác thực: ${user.role.toUpperCase()}`;
        if (adminWrap) adminWrap.classList.toggle('hidden', user.role !== 'admin');
      } else {
        curBox.classList.add('hidden');
      }
    }
  }

  function init() {
    session = loadSession();
    renderAuthIndicators();
  }

  globalScope.NorthStarAuth = {
    init,
    login,
    registerCitizen,
    logout,
    getRole,
    getUser,
    getToken,
    openLoginModal,
    renderAuthIndicators,
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
  }
})(typeof window !== 'undefined' ? window : globalThis);
