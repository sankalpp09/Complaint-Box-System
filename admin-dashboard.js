// ============================================================
//  pages/admin-dashboard.js — Full System Admin
// ============================================================
import { STATE, navigate, toast, openModal, closeModal } from '../app.js';
import { getComplaintsAPI, getAllUsersAPI,
         getAdminStatsAPI, getAdminsAPI,
         addAdminAPI, removeAdminAPI }               from '../api.js';
import { complaintCard, showComplaintModal }          from './student-dashboard.js';

let pollInterval = null;

export function render() {
  const u = STATE.profile;
  if (!u || u.role !== 'admin') { navigate('landing'); return; }
  const tab = STATE.sidebarTab || 'all-complaints';

  document.getElementById('page-admin-dashboard').innerHTML = `
    <div class="dash-layout">
      <aside class="sidebar">
        <div class="sidebar-profile">
          <div class="sb-avatar" style="background:var(--accent);">${u.displayName[0]}</div>
          <div>
            <div class="sb-name">${u.displayName}</div>
            <div class="sb-meta">⚙️ System Admin</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          <button class="sb-link ${tab==='all-complaints'?'active':''}"
            onclick="window.adminTab('all-complaints')">
            <span>📋</span> All Complaints
            <span class="sb-badge" id="adm-count">…</span>
          </button>
          <button class="sb-link ${tab==='analytics'?'active':''}"
            onclick="window.adminTab('analytics')">
            <span>📊</span> Analytics
          </button>
          <button class="sb-link ${tab==='users'?'active':''}"
            onclick="window.adminTab('users')">
            <span>👥</span> Manage Users
          </button>
          <button class="sb-link ${tab==='admins'?'active':''}"
            onclick="window.adminTab('admins')">
            <span>🛡️</span> Manage Admins
          </button>
        </nav>
      </aside>
      <main class="dash-main" id="admin-main">
        <div class="loading-state">⏳ Loading…</div>
      </main>
    </div>
  `;

  window.adminTab = (t) => { STATE.sidebarTab = t; render(); };
  window.adminRefresh = () => { if (STATE.sidebarTab === 'all-complaints') loadAllComplaints(); };

  if (tab === 'all-complaints') loadAllComplaints();
  else if (tab === 'analytics') loadAnalytics();
  else if (tab === 'users')     loadUsers();
  else if (tab === 'admins')    loadAdmins();
}

// ── All Complaints ────────────────────────────────────────────
async function loadAllComplaints() {
  if (pollInterval) clearInterval(pollInterval);
  try {
    const res = await getComplaintsAPI();
    const complaints = Array.isArray(res?.complaints) ? res.complaints : Array.isArray(res) ? res : [];
    STATE.complaints = complaints;
    const badge = document.getElementById('adm-count');
    if (badge) badge.textContent = complaints?.length || 0;
    renderAllComplaints(complaints);
  } catch (err) {
    document.getElementById('admin-main').innerHTML =
      `<div class="alert-err">❌ ${err.message}</div>`;
  }
  pollInterval = setInterval(async () => {
    if (STATE.sidebarTab !== 'all-complaints') return;
    try {
      const res = await getComplaintsAPI();
      const complaints = Array.isArray(res?.complaints) ? res.complaints : Array.isArray(res) ? res : [];
      STATE.complaints = complaints;
      const el = document.getElementById('adm-count');
      if (el) el.textContent = complaints.length;
    } catch {}
  }, 30000);
}

function renderAllComplaints(list) {
  const main = document.getElementById('admin-main');
  if (!main) return;

  main.innerHTML = `
    <div class="dash-header">
      <div>
        <h2>📋 All Complaints</h2>
        <p>Full system view. Student identities visible for all complaints.</p>
      </div>
    </div>

    <div class="stats-row">
      ${[
        ['📋','Total',      list.length,  'var(--blue-light)'],
        ['⏳','Pending',    list.filter(c=>c.status==='pending').length,    '#fff3cd'],
        ['🔄','In Progress',list.filter(c=>c.status==='in-progress').length,'#cfe2ff'],
        ['✅','Resolved',   list.filter(c=>c.status==='resolved').length,   '#d1e7dd'],
        ['❌','Rejected',   list.filter(c=>c.status==='rejected').length,   '#f8d7da'],
      ].map(([i,l,v,bg]) => `
        <div class="stat-box" style="--sb-bg:${bg};">
          <div class="sb-icon" style="background:${bg};">${i}</div>
          <div class="sb-data"><div class="sb-val">${v}</div><div class="sb-lbl">${l}</div></div>
        </div>`).join('')}
    </div>

    <div class="filter-bar">
      <input type="text" class="form-ctrl search-ctrl" id="adm-search"
        placeholder="🔍 Search title, student name, ID…" oninput="window.adminFilter()"/>
      <select class="form-ctrl filter-ctrl" id="adm-status" onchange="window.adminFilter()">
        <option value="all">All Status</option>
        <option value="pending">⏳ Pending</option>
        <option value="in-progress">🔄 In Progress</option>
        <option value="resolved">✅ Resolved</option>
        <option value="rejected">❌ Rejected</option>
      </select>
      <select class="form-ctrl filter-ctrl" id="adm-priority" onchange="window.adminFilter()">
        <option value="all">All Priorities</option>
        <option value="high">🔴 High</option>
        <option value="medium">🟡 Medium</option>
        <option value="low">🟢 Low</option>
      </select>
    </div>

    <div class="complaint-list" id="adm-list">
      ${list.length
        ? list.map(c => complaintCard(c, 'admin')).join('')
        : `<div class="empty-state"><div class="es-icon">📭</div><h3>No complaints yet</h3></div>`}
    </div>
  `;

  window.adminFilter = () => {
    const q  = (document.getElementById('adm-search')?.value || '').toLowerCase();
    const s  = document.getElementById('adm-status')?.value   || 'all';
    const pr = document.getElementById('adm-priority')?.value || 'all';
    let f    = STATE.complaints;
    if (s  !== 'all') f = f.filter(c => c.status   === s);
    if (pr !== 'all') f = f.filter(c => c.priority === pr);
    if (q)            f = f.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.submittedByName?.toLowerCase().includes(q) ||
      c.submittedBy?.toLowerCase().includes(q) ||
      c.id?.toLowerCase().includes(q));
    document.getElementById('adm-list').innerHTML =
      f.length ? f.map(c => complaintCard(c,'admin')).join('') :
      `<div class="empty-state"><div class="es-icon">🔍</div><h3>No results</h3></div>`;
  };

  window.viewComplaint = (id) => {
    const c = STATE.complaints.find(x => x.id === id);
    if (c) showComplaintModal(c, 'admin');
  };
}

// ── Analytics ─────────────────────────────────────────────────
async function loadAnalytics() {
  const main = document.getElementById('admin-main');
  main.innerHTML = `<div class="loading-state">⏳ Loading analytics…</div>`;
  try {
    const stats = await getAdminStatsAPI();
    renderAnalytics(stats);
  } catch (err) {
    main.innerHTML = `<div class="alert-err">❌ ${err.message}</div>`;
  }
}

function renderAnalytics(s) {
  const main = document.getElementById('admin-main');
  const total = s.totalComplaints || 1;
  main.innerHTML = `
    <div class="dash-header"><h2>📊 Analytics & Reports</h2></div>

    <div class="stats-row" style="margin-bottom:28px;">
      ${[
        ['👥','Total Users',      s.totalUsers,      'var(--blue-light)'],
        ['📋','Total Complaints', s.totalComplaints, '#e8f5e9'],
        ['⏳','Pending',          s.byStatus?.pending||0,'#fff3cd'],
        ['✅','Resolved',         s.byStatus?.resolved||0,'#d1e7dd'],
      ].map(([i,l,v,bg]) => `
        <div class="stat-box" style="--sb-bg:${bg};">
          <div class="sb-icon" style="background:${bg};">${i}</div>
          <div class="sb-data"><div class="sb-val">${v}</div><div class="sb-lbl">${l}</div></div>
        </div>`).join('')}
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;">
      ${buildBarChart('📂 By Category',   s.byCat  || {}, total)}
      ${buildBarChart('🏛️ By Department', s.byDept || {}, total)}
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      ${buildBarChart('📊 By Status',     s.byStatus || {}, total)}
      ${buildBarChart('👤 Users by Role', s.byRole   || {}, s.totalUsers||1)}
    </div>
  `;
}

function buildBarChart(title, data, total) {
  const rows = Object.entries(data).sort((a,b) => b[1]-a[1]);
  return `
    <div class="chart-card">
      <div class="chart-title">${title}</div>
      ${rows.length ? rows.map(([k,v]) => {
        const pct = Math.max(Math.round(v / total * 100), 2);
        return `
          <div class="chart-row">
            <div class="chart-lbl" title="${k}">${k}</div>
            <div class="chart-bar-wrap">
              <div class="chart-bar" style="width:${pct}%;"></div>
            </div>
            <div class="chart-val">${v}</div>
          </div>`;
      }).join('') : '<div style="color:var(--muted);font-size:.85rem;padding:8px 0;">No data yet</div>'}
    </div>`;
}

// ── Users ─────────────────────────────────────────────────────
async function loadUsers() {
  const main = document.getElementById('admin-main');
  main.innerHTML = `<div class="loading-state">⏳ Loading users…</div>`;
  try {
    const { users } = await getAllUsersAPI();
    renderUsers(users);
  } catch (err) {
    main.innerHTML = `<div class="alert-err">❌ ${err.message}</div>`;
  }
}

function renderUsers(users) {
  const main = document.getElementById('admin-main');
  const roleBg = {
    student:'#e8f0fe', teacher:'#e8f5e9', hod:'#f3e5f5',
    principal:'#fff3e0', director:'#fff8e1', admin:'#ffebee'
  };
  main.innerHTML = `
    <div class="dash-header">
      <div><h2>👥 All Users</h2><p>${users.length} registered accounts.</p></div>
    </div>
    <div class="filter-bar">
      <input type="text" class="form-ctrl search-ctrl" id="usr-search"
        placeholder="🔍 Search name, email, ID…" oninput="window.filterUsers()"/>
      <select class="form-ctrl filter-ctrl" id="usr-role" onchange="window.filterUsers()">
        <option value="all">All Roles</option>
        <option value="student">Students</option>
        <option value="teacher">Teachers</option>
        <option value="hod">HODs</option>
        <option value="principal">Principals</option>
        <option value="director">Directors</option>
        <option value="admin">Admins</option>
      </select>
    </div>
    <div class="table-wrap" id="usr-table">${buildUsersTable(users, roleBg)}</div>
  `;

  window._allUsers = users;
  window.filterUsers = () => {
    const q = (document.getElementById('usr-search')?.value || '').toLowerCase();
    const r = document.getElementById('usr-role')?.value || 'all';
    let f   = window._allUsers;
    if (r !== 'all') f = f.filter(u => u.role === r);
    if (q) f = f.filter(u =>
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.collegeId?.toLowerCase().includes(q));
    document.getElementById('usr-table').innerHTML = buildUsersTable(f, roleBg);
  };
}

function buildUsersTable(users, roleBg) {
  if (!users.length) return `<div class="empty-state" style="padding:30px;"><div class="es-icon">👥</div><h3>No users found</h3></div>`;
  return `
    <table class="data-table">
      <thead><tr>
        <th>Name</th><th>College ID</th><th>Email</th>
        <th>Department</th><th>Role</th><th>Verified</th>
      </tr></thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td style="font-weight:600;">${u.displayName || '—'}</td>
            <td><code class="code-chip">${u.collegeId || '—'}</code></td>
            <td style="color:var(--muted); font-size:.83rem;">${u.email || '—'}</td>
            <td style="font-size:.85rem;">${u.department || '—'}</td>
            <td>
              <span class="role-chip" style="background:${roleBg[u.role]||'#eee'};">
                ${u.role || '—'}
              </span>
            </td>
            <td>${u.isVerified ? '✅' : '⏳'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── Admins ────────────────────────────────────────────────────
async function loadAdmins() {
  const main = document.getElementById('admin-main');
  main.innerHTML = `<div class="loading-state">⏳ Loading admins…</div>`;
  try {
    const { admins } = await getAdminsAPI();
    renderAdmins(admins);
  } catch (err) {
    main.innerHTML = `<div class="alert-err">❌ ${err.message}</div>`;
  }
}

function renderAdmins(admins) {
  const main = document.getElementById('admin-main');
  main.innerHTML = `
    <div class="dash-header">
      <div><h2>🛡️ Admin Accounts</h2><p>Control who has full system access.</p></div>
      <button class="btn btn-fire btn-sm" onclick="window.showAddAdmin()">+ Add Admin</button>
    </div>

    <div class="alert-warn" style="margin-bottom:20px;">
      ⚠️ Admins have full access including all student identities.
      Only add people you fully trust.
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Email</th><th>Added By</th><th>Added On</th><th>Action</th></tr></thead>
        <tbody>
          ${admins.length ? admins.map(a => `
            <tr>
              <td style="font-weight:600;">${a.email}</td>
              <td style="color:var(--muted); font-size:.83rem;">${a.addedBy || '—'}</td>
              <td style="font-size:.83rem;">
  ${a.addedAt?.seconds
    ? new Date(a.addedAt.seconds * 1000).toLocaleDateString('en-IN')
    : 'No Date'}
</td>
              <td>
                ${a.email === STATE.user?.email
                  ? `<span style="color:var(--muted);font-size:.8rem;">You (cannot remove)</span>`
                  : `<button class="btn btn-sm" style="background:#ffebee;color:var(--accent);"
                      onclick="window.removeAdminEmail('${a.email}')">Remove</button>`}
              </td>
            </tr>`).join('')
          : `<tr><td colspan="4" style="text-align:center; color:var(--muted); padding:24px;">No admins listed yet.</td></tr>`}
        </tbody>const formatDate
      </table>
    </div>
  `;

  window.showAddAdmin = () => {
    openModal(`
      <div class="modal">
        <div class="modal-head">
          <h4>🛡️ Add Admin</h4>
          <button class="modal-x" onclick="window.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <p style="color:var(--muted); font-size:.9rem; margin-bottom:16px;">
            Enter the Gmail address to grant admin access. The person should sign up on the
            website first. If they already have an account, their role will be updated immediately.
          </p>
          <div class="form-group">
            <label>Gmail Address</label>
            <input type="email" id="new-admin-email" class="form-ctrl"
              placeholder="someone@gmail.com"/>
          </div>
          <div id="add-admin-err"></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
          <button class="btn btn-fire" onclick="window.confirmAddAdmin()">Grant Access</button>
        </div>
      </div>`);
  };

  window.confirmAddAdmin = async () => {
    const email = document.getElementById('new-admin-email').value.trim();
    if (!email.includes('@')) {
      document.getElementById('add-admin-err').innerHTML =
        `<div class="alert-err">Please enter a valid email.</div>`; return;
    }
    try {
      await addAdminAPI(email);
      closeModal();
      toast(`✅ ${email} granted admin access.`, 'success');
      loadAdmins();
    } catch (err) {
      document.getElementById('add-admin-err').innerHTML =
        `<div class="alert-err">❌ ${err.message}</div>`;
    }
  };

  window.removeAdminEmail = async (email) => {
    if (!confirm(`Remove admin access from ${email}?`)) return;
    try {
      await removeAdminAPI(email);
      toast(`Removed admin: ${email}`);
      loadAdmins();
    } catch (err) {
      toast('❌ ' + err.message, 'error');
    }
  };
}
