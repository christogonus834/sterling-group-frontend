// public/js/admin.js
// Single-page admin app: login, sidebar nav, and per-section CRUD views.
// Organized as: AUTH -> SHELL/NAV -> VIEW RENDERERS -> MODAL HELPERS.

const loginScreen = document.getElementById('loginScreen');
const adminShell = document.getElementById('adminShell');
const adminMain = document.getElementById('adminMain');
const adminModal = document.getElementById('adminModal');
const adminModalInner = document.getElementById('adminModalInner');

let currentAdmin = null;
let currentView = 'dashboard';

// ---------------------------------------------------------
// ICONS: populate static icon slots once
// ---------------------------------------------------------
function paintStaticIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const slot = el.querySelector('.icon');
    if (slot) slot.innerHTML = ICONS[el.dataset.icon] || '';
  });
}

// ---------------------------------------------------------
// AUTH
// ---------------------------------------------------------
async function checkSession() {
  try {
    const me = await api.get('/api/auth/me');
    currentAdmin = me;
    enterShell();
  } catch (e) {
    showLogin();
  }
}

function showLogin() {
  loginScreen.style.display = 'flex';
  adminShell.classList.remove('active');
}

function enterShell() {
  loginScreen.style.display = 'none';
  adminShell.classList.add('active');
  document.getElementById('sidebarAdminName').textContent = currentAdmin.full_name || 'Admin';
  document.getElementById('sidebarAdminEmail').textContent = currentAdmin.email || '';
  paintStaticIcons();
  navigateTo('dashboard');
  refreshNotifBadge();
  setInterval(refreshNotifBadge, 30000);
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginSubmitBtn');
  const errorBox = document.getElementById('loginError');
  errorBox.classList.remove('show');
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    currentAdmin = await api.post('/api/auth/login', {
      email: document.getElementById('loginEmail').value,
      password: document.getElementById('loginPassword').value,
    });
    enterShell();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api.post('/api/auth/logout');
  currentAdmin = null;
  showLogin();
});

// ---------------------------------------------------------
// SIDEBAR NAVIGATION
// ---------------------------------------------------------
document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.view));
});

function navigateTo(view) {
  currentView = view;
  document.querySelectorAll('.nav-item[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const renderers = {
    dashboard: renderDashboard,
    notifications: renderNotifications,
    branding: renderBranding,
    profile: renderProfile,
    'lv-bookings': renderLvBookings,
    'lv-rooms': renderLvRooms,
    'lv-posts': () => renderPosts('lakeview'),
    'lv-partners': () => renderPartners('lakeview'),
    'lv-content': () => renderContent('lakeview'),
    'sh-appointments': renderShAppointments,
    'sh-doctors': renderShDoctors,
    'sh-departments': renderShDepartments,
    'sh-posts': () => renderPosts('hospital'),
    'sh-partners': () => renderPartners('hospital'),
    'sh-content': () => renderContent('hospital'),
  };
  (renderers[view] || renderDashboard)();
}

async function refreshNotifBadge() {
  try {
    const { count } = await api.get('/api/admin/notifications/unread-count');
    const badge = document.getElementById('navNotifBadge');
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (e) { /* non-fatal */ }
}

// ---------------------------------------------------------
// SMALL HELPERS shared across views
// ---------------------------------------------------------
function topbar(title) {
  return `
    <div class="admin-topbar">
      <h1>${title}</h1>
      <div class="admin-topbar__actions">
        <button class="bell-btn" id="topbarBell" title="Notifications">
          <span class="icon">${icon('bell')}</span>
          <span class="bell-btn__dot" id="topbarBellDot"></span>
        </button>
      </div>
    </div>
  `;
}

function wireTopbarBell() {
  const bell = document.getElementById('topbarBell');
  if (bell) bell.addEventListener('click', () => navigateTo('notifications'));
  refreshNotifBadge().then(() => {
    const dot = document.getElementById('topbarBellDot');
    const navBadge = document.getElementById('navNotifBadge');
    if (dot) dot.classList.toggle('show', !navBadge.classList.contains('hidden'));
  });
}

function statusPill(status) {
  return `<span class="pill-status ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

function emptyState(message, iconName = 'search') {
  return `<div class="empty-state"><span class="icon">${icon(iconName)}</span><p>${message}</p></div>`;
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ---------------------------------------------------------
// DASHBOARD VIEW
// ---------------------------------------------------------
async function renderDashboard() {
  adminMain.innerHTML = topbar('Dashboard') + `
    <div class="stat-grid" id="statGrid">
      ${Array.from({ length: 4 }).map(() => `<div class="stat-card"><div class="skeleton" style="height:14px;width:60%;margin-bottom:14px;"></div><div class="skeleton" style="height:30px;width:40%;"></div></div>`).join('')}
    </div>
    <div class="panel">
      <div class="panel__head"><h2>Recent notifications</h2><button class="btn btn-ghost" id="viewAllNotifsBtn" style="padding:8px 14px;font-size:13px;">View all</button></div>
      <div class="notif-list" id="dashboardNotifList"></div>
    </div>
  `;
  wireTopbarBell();
  document.getElementById('viewAllNotifsBtn').addEventListener('click', () => navigateTo('notifications'));

  try {
    const stats = await api.get('/api/admin/dashboard/stats');
    document.getElementById('statGrid').innerHTML = `
      <div class="stat-card stat-card--lv">
        <div class="stat-card__label">Pending bookings</div>
        <div class="stat-card__value">${stats.lakeview.pendingBookings}</div>
      </div>
      <div class="stat-card stat-card--lv">
        <div class="stat-card__label">Active room types</div>
        <div class="stat-card__value">${stats.lakeview.activeRooms}</div>
      </div>
      <div class="stat-card stat-card--sh">
        <div class="stat-card__label">Pending appointments</div>
        <div class="stat-card__value">${stats.hospital.pendingAppointments}</div>
      </div>
      <div class="stat-card stat-card--sh">
        <div class="stat-card__label">Today's appointments</div>
        <div class="stat-card__value">${stats.hospital.todaysAppointments}</div>
      </div>
    `;
  } catch (e) {
    document.getElementById('statGrid').innerHTML = emptyState('Could not load stats: ' + e.message);
  }

  try {
    const notifs = await api.get('/api/admin/notifications?unreadOnly=false');
    const list = document.getElementById('dashboardNotifList');
    if (!notifs.length) {
      list.innerHTML = emptyState('No notifications yet.', 'bell');
      return;
    }
    list.innerHTML = notifs.slice(0, 6).map(notifItemHtml).join('');
  } catch (e) {
    document.getElementById('dashboardNotifList').innerHTML = emptyState('Could not load notifications.');
  }
}

function notifItemHtml(n) {
  const iconName = n.type.includes('booking') ? 'bed' : n.type.includes('appointment') ? 'doctor' : 'bell';
  return `
    <div class="notif-item ${n.is_read ? '' : 'unread'}">
      <div class="notif-item__icon ${n.division}"><span class="icon">${icon(iconName)}</span></div>
      <div class="notif-item__body">
        <div class="notif-item__title">${n.title}</div>
        <div class="notif-item__text">${n.body || ''}</div>
        <div class="notif-item__time">${timeAgo(n.created_at)}</div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------
// NOTIFICATIONS VIEW
// ---------------------------------------------------------
async function renderNotifications() {
  adminMain.innerHTML = topbar('Notifications') + `
    <div class="panel">
      <div class="panel__head">
        <h2>All activity</h2>
        <button class="btn btn-ghost" id="markAllReadBtn" style="padding:8px 14px;font-size:13px;">Mark all as read</button>
      </div>
      <div class="notif-list" id="notifList"><div class="skeleton" style="height:300px;"></div></div>
    </div>
  `;
  wireTopbarBell();

  document.getElementById('markAllReadBtn').addEventListener('click', async () => {
    await api.put('/api/admin/notifications/read-all');
    showToast('All notifications marked as read.');
    renderNotifications();
    refreshNotifBadge();
  });

  try {
    const notifs = await api.get('/api/admin/notifications');
    const list = document.getElementById('notifList');
    if (!notifs.length) {
      list.innerHTML = emptyState('No notifications yet.', 'bell');
      return;
    }
    list.innerHTML = notifs.map(notifItemHtml).join('');
  } catch (e) {
    document.getElementById('notifList').innerHTML = emptyState('Could not load notifications: ' + e.message);
  }
}

// ---------------------------------------------------------
// BRANDING & LOGOS
// One screen for all three logo slots. Each falls back to the default
// inline SVG mark on the public site whenever its value is empty.
// ---------------------------------------------------------
const BRANDING_SLOTS = [
  { key: 'group_logo', label: 'Sterling Group (landing page)', hint: 'Shown on the landing page header and footer, and as the fallback for either division if it has no logo of its own.' },
  { key: 'lakeview_logo', label: 'Lakeview Apartments', hint: 'Shown on the Lakeview header and footer. Falls back to the Sterling Group logo if left empty.' },
  { key: 'hospital_logo', label: 'Specialist Hospital', hint: 'Shown on the Hospital header and footer. Falls back to the Sterling Group logo if left empty.' },
];

async function renderBranding() {
  adminMain.innerHTML = topbar('Branding & Logos') + `
    <div class="panel">
      <div class="panel__head"><h2>Logo slots</h2></div>
      <div id="brandingList" style="padding:22px;display:flex;flex-direction:column;gap:18px;">
        <div class="skeleton" style="height:120px;"></div>
      </div>
    </div>
  `;
  wireTopbarBell();

  try {
    const settings = await api.get('/api/admin/branding');
    const list = document.getElementById('brandingList');
    list.innerHTML = BRANDING_SLOTS.map((slot) => brandingRowHtml(slot, settings[slot.key])).join('');

    BRANDING_SLOTS.forEach((slot) => {
      const fileInput = document.getElementById(`logoFile-${slot.key}`);
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        try {
          await api.upload(`/api/admin/branding/${slot.key}/image`, file);
          showToast('Logo updated.');
          renderBranding();
        } catch (e) {
          showToast(e.message, 'error');
        }
      });

      const clearBtn = document.getElementById(`logoClear-${slot.key}`);
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          confirmDelete('This will remove the uploaded logo and fall back to the default Sterling mark.', async () => {
            await api.del(`/api/admin/branding/${slot.key}`);
            showToast('Logo cleared.');
            renderBranding();
          });
        });
      }
    });
  } catch (e) {
    document.getElementById('brandingList').innerHTML = emptyState('Could not load branding settings: ' + e.message);
  }
}

function brandingRowHtml(slot, currentUrl) {
  return `
    <div class="manage-card" style="flex-direction:row;align-items:stretch;">
      <div class="manage-card__media" style="width:200px;flex-shrink:0;aspect-ratio:auto;background:#fff;display:flex;align-items:center;justify-content:center;padding:16px;">
        ${currentUrl
          ? `<img src="${currentUrl}" alt="${slot.label}" style="max-width:100%;max-height:70px;object-fit:contain;" />`
          : `<span class="icon" style="color:var(--stone);width:28px;height:28px;">${icon('image')}</span>`}
      </div>
      <div class="manage-card__body" style="flex:1;">
        <div class="manage-card__title">${slot.label}</div>
        <p style="font-size:12.5px;color:var(--stone);line-height:1.5;margin:2px 0 10px;">${slot.hint}</p>
        <div style="display:flex;gap:10px;">
          <label class="btn btn-ghost" style="padding:9px 14px;font-size:13px;cursor:pointer;">
            ${icon('upload')} ${currentUrl ? 'Replace logo' : 'Upload logo'}
            <input type="file" accept="image/*" class="sr-only" id="logoFile-${slot.key}" />
          </label>
          ${currentUrl ? `<button class="btn btn-ghost" id="logoClear-${slot.key}" style="padding:9px 14px;font-size:13px;color:#8a2e1f;">Clear</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------
// PROFILE SETTINGS
// Change password, see who's signed in, jump to Branding & Logos.
// ---------------------------------------------------------
async function renderProfile() {
  adminMain.innerHTML = topbar('Profile Settings') + `
    <div class="panel">
      <div class="panel__head"><h2>Account</h2></div>
      <div style="padding:22px;display:flex;flex-direction:column;gap:4px;">
        <p style="font-size:15px;font-weight:600;">${currentAdmin?.full_name || 'Admin'}</p>
        <p style="font-size:13.5px;color:var(--stone);">${currentAdmin?.email || ''}</p>
      </div>
    </div>

    <div class="panel">
      <div class="panel__head"><h2>Change password</h2></div>
      <form class="admin-modal-form" id="profilePasswordForm" style="padding:22px;max-height:none;">
        <div>
          <label class="admin-label">Current password</label>
          <input class="admin-input" type="password" id="currentPasswordInput" required autocomplete="current-password" />
        </div>
        <div>
          <label class="admin-label">New password</label>
          <input class="admin-input" type="password" id="newPasswordInput" required minlength="8" autocomplete="new-password" />
        </div>
        <div>
          <label class="admin-label">Confirm new password</label>
          <input class="admin-input" type="password" id="confirmPasswordInput" required minlength="8" autocomplete="new-password" />
        </div>
        <p style="font-size:12.5px;color:var(--stone);">Must be at least 8 characters.</p>
        <button type="submit" class="btn btn-save" id="profilePasswordSubmitBtn" style="align-self:flex-start;padding:11px 20px;">Update password</button>
      </form>
    </div>

    <div class="panel">
      <div class="panel__head"><h2>Site settings</h2></div>
      <div style="padding:22px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div>
          <p style="font-size:14.5px;font-weight:600;margin-bottom:4px;">Logos for Sterling Group, Lakeview, and the Hospital</p>
          <p style="font-size:13px;color:var(--stone);">Manage every logo shown across the public site from one screen.</p>
        </div>
        <button class="btn btn-ghost" id="goToBrandingBtn" style="padding:10px 18px;font-size:13.5px;">${icon('image')} Open Branding &amp; Logos</button>
      </div>
    </div>
  `;
  wireTopbarBell();

  document.getElementById('goToBrandingBtn').addEventListener('click', () => navigateTo('branding'));

  document.getElementById('profilePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPasswordInput').value;
    const newPassword = document.getElementById('newPasswordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;
    const submitBtn = document.getElementById('profilePasswordSubmitBtn');

    if (newPassword !== confirmPassword) {
      showToast('New password and confirmation do not match.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating…';
    try {
      await api.post('/api/auth/change-password', { currentPassword, newPassword });
      showToast('Password updated.');
      document.getElementById('profilePasswordForm').reset();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Update password';
    }
  });
}

// ---------------------------------------------------------
// MODAL HELPERS (shared)
// ---------------------------------------------------------
function openAdminModal(html) {
  adminModalInner.innerHTML = html;
  adminModal.classList.add('open');
}
function closeAdminModal() {
  adminModal.classList.remove('open');
  adminModalInner.innerHTML = '';
}
adminModal.addEventListener('click', (e) => { if (e.target === adminModal) closeAdminModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && adminModal.classList.contains('open')) closeAdminModal(); });

function confirmDelete(message, onConfirm) {
  openAdminModal(`
    <div class="admin-modal-form">
      <h3>Are you sure?</h3>
      <p style="color:var(--ink-soft);font-size:14px;">${message}</p>
      <div style="display:flex;gap:10px;margin-top:10px;">
        <button class="btn btn-ghost" id="cancelDeleteBtn" style="flex:1;justify-content:center;">Cancel</button>
        <button class="btn btn-save" id="confirmDeleteBtn" style="flex:1;background:#8a2e1f;">Delete</button>
      </div>
    </div>
  `);
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeAdminModal);
  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    await onConfirm();
    closeAdminModal();
  });
}

// ---------------------------------------------------------
// BOOT (placed at bottom of file, after all view renderers load)
// ---------------------------------------------------------