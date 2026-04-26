// ============================================================
//  pages/authority-dashboard.js — HOD / Principal / Director
//  Backend already filters complaints by rank and strips
//  identity where appropriate. Frontend just renders.
// ============================================================
import { STATE, navigate, ROLE_LABELS }          from '../app.js';
import { getComplaintsAPI }                       from '../api.js';
import { complaintCard, showComplaintModal }      from './student-dashboard.js';

let pollInterval = null;

export function render() {
  const u = STATE.profile;
  if (!u) { navigate('login'); return; }

  const roleLabel = ROLE_LABELS[u.role] || u.role;
  const roleColor = { hod:'var(--purple)', principal:'var(--primary)', director:'#b45309' }[u.role] || 'var(--primary)';

  document.getElementById('page-authority-dashboard').innerHTML = `
    <div class="dash-layout">
      <aside class="sidebar">
        <div class="sidebar-profile">
          <div class="sb-avatar" style="background:${roleColor};">${u.displayName[0]}</div>
          <div>
            <div class="sb-name">${u.displayName}</div>
            <div class="sb-meta">${roleLabel} · ${u.department?.split(' ')[0] || 'All Depts'}</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          <button class="sb-link active">
            <span>📋</span> Complaints
            <span class="sb-badge" id="auth-count">…</span>
          </button>
        </nav>
        <div class="sb-note">
          👁️ As <strong>${roleLabel}</strong>, you can see the identity of students
          who file complaints against people below your authority rank.
        </div>
      </aside>
      <main class="dash-main" id="authority-main">
        <div class="loading-state">⏳ Loading complaints…</div>
      </main>
    </div>
  `;

  if (pollInterval) clearInterval(pollInterval);
  loadAuthorityComplaints();
  pollInterval = setInterval(loadAuthorityComplaints, 30000);

  // Expose refresh for saveComplaintUpdate callback
  window.authorityRefresh = loadAuthorityComplaints;
}

async function loadAuthorityComplaints() {
  try {
    const res = await getComplaintsAPI();
    const complaints = Array.isArray(res?.complaints) ? res.complaints : Array.isArray(res) ? res : [];
    STATE.complaints = complaints;
    const badge = document.getElementById('auth-count');
    if (badge) badge.textContent = complaints?.length || 0;
    renderAuthorityContent(complaints);
  } catch (err) {
    const main = document.getElementById('authority-main');
    if (main) main.innerHTML = `<div class="alert-err">⚠️ ${err.message}</div>`;
  }
}

function renderAuthorityContent(list) {
  const main = document.getElementById('authority-main');
  if (!main) return;
  const u = STATE.profile;

  main.innerHTML = `
    <div class="dash-header">
      <div>
        <h2>${ROLE_LABELS[u.role]} Dashboard</h2>
        <p>Complaints within your authority scope. You can see student identities
           for complaints against people below your rank.</p>
      </div>
    </div>

    <div class="alert-info" style="margin-bottom:20px;">
      ℹ️ <strong>Authority Access:</strong> Student identities are visible to you
      for complaints you outrank. Use this responsibly to verify authenticity —
      never to target or intimidate students.
    </div>

    <div class="stats-row">
      ${[
        ['📋','Total',      list.length,  'var(--blue-light)'],
        ['⏳','Pending',    list.filter(c=>c.status==='pending').length,    '#fff3cd'],
        ['🔄','In Progress',list.filter(c=>c.status==='in-progress').length,'#cfe2ff'],
        ['✅','Resolved',   list.filter(c=>c.status==='resolved').length,   '#d1e7dd'],
      ].map(([i,l,v,bg]) => `
        <div class="stat-box" style="--sb-bg:${bg};">
          <div class="sb-icon" style="background:${bg};">${i}</div>
          <div class="sb-data"><div class="sb-val">${v}</div><div class="sb-lbl">${l}</div></div>
        </div>`).join('')}
    </div>

    <div class="filter-bar">
      <input type="text" class="form-ctrl search-ctrl" id="auth-search"
        placeholder="🔍 Search complaints…" oninput="window.filterAuth()"/>
      <select class="form-ctrl filter-ctrl" id="auth-status" onchange="window.filterAuth()">
        <option value="all">All Status</option>
        <option value="pending">⏳ Pending</option>
        <option value="in-progress">🔄 In Progress</option>
        <option value="resolved">✅ Resolved</option>
        <option value="rejected">❌ Rejected</option>
      </select>
    </div>

    <div class="complaint-list" id="auth-list">
      ${list.length
        ? list.map(c => complaintCard(c, u.role)).join('')
        : `<div class="empty-state"><div class="es-icon">✅</div><h3>No complaints in your scope</h3></div>`}
    </div>
  `;

  window.filterAuth = () => {
    const q = (document.getElementById('auth-search')?.value || '').toLowerCase();
    const s = document.getElementById('auth-status')?.value || 'all';
    let f   = STATE.complaints;
    if (s !== 'all') f = f.filter(c => c.status === s);
    if (q) f = f.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      (c._canSeeIdentity && c.submittedByName?.toLowerCase().includes(q)));
    document.getElementById('auth-list').innerHTML =
      f.length
        ? f.map(c => complaintCard(c, u.role)).join('')
        : `<div class="empty-state"><div class="es-icon">🔍</div><h3>No results</h3></div>`;
  };

  window.viewComplaint = (id) => {
    const c = STATE.complaints.find(x => x.id === id);
    if (c) showComplaintModal(c, u.role);
  };
}
