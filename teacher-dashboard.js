// ============================================================
//  pages/teacher-dashboard.js
//  Teacher sees complaints filed against them.
//  Identity of student is ALWAYS hidden from teacher.
// ============================================================
import { STATE, navigate, ROLE_LABELS }             from '../app.js';
import { getComplaintsAPI }                          from '../api.js';
import { complaintCard, showComplaintModal }         from './student-dashboard.js';

let pollInterval = null;

export function render() {
  const u = STATE.profile;
  if (!u) { navigate('login'); return; }

  document.getElementById('page-teacher-dashboard').innerHTML = `
    <div class="dash-layout">
      <aside class="sidebar">
        <div class="sidebar-profile">
          <div class="sb-avatar" style="background:var(--green);">${u.displayName[0]}</div>
          <div>
            <div class="sb-name">${u.displayName}</div>
            <div class="sb-meta">${u.collegeId} · ${u.department?.split(' ')[0]}</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          <button class="sb-link active">
            <span>📋</span> Complaints Against Me
            <span class="sb-badge" id="t-count">…</span>
          </button>
        </nav>
        <div class="sb-note">
          🔒 Student identity is always hidden from you.
          If you believe a complaint is false, escalate it to your HOD.
        </div>
      </aside>
      <main class="dash-main" id="teacher-main">
        <div class="loading-state">⏳ Loading complaints…</div>
      </main>
    </div>
  `;

  if (pollInterval) clearInterval(pollInterval);
  loadTeacherComplaints();
  pollInterval = setInterval(loadTeacherComplaints, 30000);
}

async function loadTeacherComplaints() {
  try {
    const res = await getComplaintsAPI();
    const complaints = Array.isArray(res?.complaints) ? res.complaints : Array.isArray(res) ? res : [];
    STATE.complaints = complaints;
    const badge = document.getElementById('t-count');
    if (badge) badge.textContent = complaints?.length || 0;
    renderTeacherContent(complaints);
  } catch (err) {
    const main = document.getElementById('teacher-main');
    if (main) main.innerHTML = `<div class="alert-err">⚠️ ${err.message}</div>`;
  }
}

function renderTeacherContent(list) {
  const main = document.getElementById('teacher-main');
  if (!main) return;

  main.innerHTML = `
    <div class="dash-header">
      <div>
        <h2>📋 Complaints Filed Against You</h2>
        <p>You can view and respond to these complaints. Student identity is always protected.</p>
      </div>
    </div>

    <div class="identity-shield" style="margin-bottom:20px;">
      🔐 <strong>Student Protection Policy:</strong>
      All student identities are hidden from you — this is mandatory and cannot be changed.
      If you believe a complaint is false or malicious, contact your HOD
      and request a formal verification. The HOD can verify who filed the complaint.
    </div>

    <div class="stats-row">
      ${[
        ['📋','Total',     list.length,'var(--blue-light)'],
        ['⏳','Pending',   list.filter(c=>c.status==='pending').length,   '#fff3cd'],
        ['🔄','In Progress',list.filter(c=>c.status==='in-progress').length,'#cfe2ff'],
        ['✅','Resolved',  list.filter(c=>c.status==='resolved').length,  '#d1e7dd'],
      ].map(([i,l,v,bg]) => `
        <div class="stat-box" style="--sb-bg:${bg};">
          <div class="sb-icon" style="background:${bg};">${i}</div>
          <div class="sb-data"><div class="sb-val">${v}</div><div class="sb-lbl">${l}</div></div>
        </div>`).join('')}
    </div>

    ${list.length === 0 ? `
      <div class="empty-state">
        <div class="es-icon">✅</div>
        <h3>No complaints</h3>
        <p>No complaints have been filed against you.</p>
      </div>
    ` : `
      <div class="complaint-list">
        ${list.map(c => complaintCard(c, 'teacher')).join('')}
      </div>
    `}
  `;

  window.viewComplaint = (id) => {
    const c = STATE.complaints.find(x => x.id === id);
    if (c) showComplaintModal(c, 'teacher');
  };
}
