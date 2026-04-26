// ============================================================
//  pages/student-dashboard.js
//  Uses Express backend API for all data.
//  Contains the shared complaintCard() and showComplaintModal()
//  used by ALL dashboards.
// ============================================================
import { STATE, navigate, toast, openModal,
         closeModal, canSeeIdentity, ROLE_LABELS } from '../app.js';
import { getComplaintsAPI,
         updateComplaintStatusAPI }               from '../api.js';

let pollInterval = null;

export function render() {
  const u = STATE.profile;
  if (!u) { navigate('login'); return; }
  const tab = STATE.sidebarTab || 'my-complaints';

  document.getElementById('page-student-dashboard').innerHTML = `
    <div class="dash-layout">
      <aside class="sidebar">
        <div class="sidebar-profile">
          <div class="sb-avatar">${u.displayName[0]}</div>
          <div>
            <div class="sb-name">${u.displayName}</div>
            <div class="sb-meta">${u.collegeId} · ${u.department?.split(' ')[0]}</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          <button class="sb-link ${tab==='my-complaints'?'active':''}"
            onclick="window.studentTab('my-complaints')">
            <span>📋</span> My Complaints
            <span class="sb-badge" id="sb-count">…</span>
          </button>
          <button class="sb-link" onclick="window.goTo('submit-complaint')">
            <span>📝</span> New Complaint
          </button>
          <button class="sb-link" onclick="window.goTo('track')">
            <span>🔍</span> Track Complaint
          </button>
          <button class="sb-link ${tab==='profile'?'active':''}"
            onclick="window.studentTab('profile')">
            <span>👤</span> My Profile
          </button>
        </nav>
      </aside>
      <main class="dash-main" id="student-main">
        <div class="loading-state">⏳ Loading your complaints…</div>
      </main>
    </div>
  `;

  window.studentTab = (t) => { STATE.sidebarTab = t; render(); };

  if (tab === 'profile') renderProfile();
  else                   loadAndRender();
}

async function loadAndRender() {
  // Stop any existing poll
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }

  await fetchAndShow();

  // Poll every 30 seconds so status updates appear automatically
  pollInterval = setInterval(fetchAndShow, 30000);
}

async function fetchAndShow() {
  try {
    const res = await getComplaintsAPI();
    const complaints = Array.isArray(res?.complaints)
      ? res.complaints
      : Array.isArray(res)
      ? res
      : [];
    STATE.complaints = complaints;
    const badge = document.getElementById('sb-count');
    if (badge) badge.textContent = complaints.length || 0;
    renderMyComplaints(complaints);
  } catch (err) {
    const main = document.getElementById('student-main');
    if (main) main.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">⚠️</div>
        <h3>Could not load complaints</h3>
        <p>${err.message}</p>
        <button class="btn btn-outline btn-sm" onclick="window.studentTab('my-complaints')">Retry</button>
      </div>`;
  }
}

function renderMyComplaints(list) {
  const main = document.getElementById('student-main');
  if (!main) return;

  const counts = {
    total:    list.length,
    pending:  list.filter(c => c.status === 'pending').length,
    progress: list.filter(c => c.status === 'in-progress').length,
    resolved: list.filter(c => c.status === 'resolved').length,
  };

  main.innerHTML = `
    <div class="dash-header">
      <div>
        <h2>My Complaints</h2>
        <p>All complaints you've submitted. Your identity is always protected.</p>
      </div>
      <button class="btn btn-fire btn-sm" onclick="window.goTo('submit-complaint')">+ New Complaint</button>
    </div>

    <div class="stats-row">
      ${[
        ['📋','Total',    counts.total,    'var(--blue-light)'],
        ['⏳','Pending',  counts.pending,  '#fff3cd'],
        ['🔄','In Progress',counts.progress,'#cfe2ff'],
        ['✅','Resolved', counts.resolved, '#d1e7dd'],
      ].map(([i,l,v,bg]) => `
        <div class="stat-box" style="--sb-bg:${bg};">
          <div class="sb-icon" style="background:${bg};">${i}</div>
          <div class="sb-data"><div class="sb-val">${v}</div><div class="sb-lbl">${l}</div></div>
        </div>`).join('')}
    </div>

    <div class="identity-shield">
      🛡️ <strong>Identity Shield Active</strong> — Your name and ID are hidden from
      whoever you complained about. Only a higher authority can verify your identity.
    </div>

    ${list.length === 0 ? `
      <div class="empty-state">
        <div class="es-icon">📭</div>
        <h3>No complaints yet</h3>
        <p>Submit your first complaint anonymously and securely.</p>
        <button class="btn btn-fire" onclick="window.goTo('submit-complaint')">Submit a Complaint</button>
      </div>
    ` : `
      <div class="complaint-list">
        ${list.map(c => complaintCard(c, 'student')).join('')}
      </div>
    `}
  `;
}

function renderProfile() {
  const u = STATE.profile;
  document.getElementById('student-main').innerHTML = `
    <div class="dash-header"><h2>👤 My Profile</h2><p>Your verified account details.</p></div>
    <div class="profile-card">
      <div class="profile-top">
        <div class="profile-avatar">${u.displayName[0]}</div>
        <div>
          <div class="profile-name">${u.displayName}</div>
          <div class="profile-email">${u.email}</div>
          <span class="role-chip" style="background:#e8f0fe;">🎒 Student</span>
        </div>
      </div>
      <div class="profile-fields">
        ${[
          ['🪪 Student ID',  u.collegeId],
          ['🏛️ Department',  u.department],
          ['🎓 Year',        u.year || '—'],
          ['📧 Email',       u.email],
          ['📱 Phone',       u.phone || '—'],
          ['🏫 College',     'A.C. Patil College of Engineering'],
        ].map(([l,v]) => `
          <div class="pf-row">
            <span class="pf-lbl">${l}</span>
            <span class="pf-val">${v}</span>
          </div>`).join('')}
      </div>
      <div class="identity-shield" style="margin-top:20px;">
        🔐 Your identity is <strong>never shown</strong> to whoever you file a complaint against.
        Only a higher authority can verify who filed the complaint.
      </div>
    </div>
  `;
}

// ============================================================
//  SHARED: complaintCard()  — used by ALL dashboards
// ============================================================
export function complaintCard(c, viewerRole) {
  const statusCls = {
    pending:      's-pending',
    'in-progress':'s-progress',
    resolved:     's-resolved',
    rejected:     's-rejected',
  };
  const statusLbl = {
    pending:      '⏳ Pending',
    'in-progress':'🔄 In Progress',
    resolved:     '✅ Resolved',
    rejected:     '❌ Rejected',
  };

  const accRole      = c.againstRole || 'teacher';
  const isSelf       = viewerRole === 'student';
  const showIdentity = isSelf || canSeeIdentity(viewerRole, accRole);
  const idDisplay    = showIdentity
    ? `<span class="cc-meta-item">👤 ${c.submittedByName}</span>`
    : `<span class="cc-meta-item identity-hidden">🔒 Identity Protected</span>`;

  let dt = '—';

try {
  if (c.createdAt) {
    const d = c.createdAt.seconds
      ? new Date(c.createdAt.seconds * 1000)
      : new Date(c.createdAt);

    if (!isNaN(d.getTime())) {
      dt = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  }
} catch (e) {
  console.log("Date error:", c.createdAt);
}

  return `
    <div class="complaint-card" onclick="window.viewComplaint('${c.id}','${viewerRole}')">
      <div class="cc-top">
        <span class="cc-id">${c.id?.slice(0,8) || 'NEW'}</span>
        <span class="cc-status ${statusCls[c.status]||'s-pending'}">${statusLbl[c.status]||'Pending'}</span>
        <span class="cc-cat">${c.category}</span>
        ${c.priority === 'high'
          ? '<span class="cc-priority">🔴 High</span>'
          : c.priority === 'medium'
          ? '<span class="cc-priority muted">🟡 Med</span>' : ''}
      </div>
      <div class="cc-title">${c.title}</div>
      <div class="cc-desc">${c.description}</div>
      <div class="cc-meta">
        ${idDisplay}
        <span class="cc-meta-item">🏛️ ${c.department}</span>
        ${c.againstName
          ? `<span class="cc-meta-item">Against: <strong>${c.againstName}</strong>
              <span class="role-mini">(${ROLE_LABELS[accRole]||accRole})</span>
             </span>` : ''}
        <span class="cc-meta-item">📅 ${dt}</span>
      </div>
    </div>
  `;
}

// ============================================================
//  SHARED: showComplaintModal()  — used by ALL dashboards
// ============================================================
export function showComplaintModal(c, viewerRole) {
  const statusCls = {
    pending:'s-pending','in-progress':'s-progress',
    resolved:'s-resolved',rejected:'s-rejected',
  };
  const statusLbl = {
    pending:'⏳ Pending','in-progress':'🔄 In Progress',
    resolved:'✅ Resolved',rejected:'❌ Rejected',
  };

  const accRole      = c.againstRole || 'teacher';
  const isSelf       = viewerRole === 'student';
  const showIdentity = isSelf || canSeeIdentity(viewerRole, accRole);
  const canEdit      = !isSelf && canSeeIdentity(viewerRole, accRole);

  let dt = '';

if (c.createdAt) {
  if (c.createdAt.seconds) {
    dt = new Date(c.createdAt.seconds * 1000)
      .toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
  } else {
    dt = new Date(c.createdAt)
      .toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
  }
}
  const cur = ({ pending:0,'in-progress':1,resolved:2,rejected:2 })[c.status] ?? 0;

  const whoCanSee = {
    teacher:  'HOD, Principal, Director & Admin',
    hod:      'Principal, Director & Admin',
    principal:'University Director & Admin',
    director: 'Admin only',
  }[accRole] || 'Higher Authority & Admin';

  openModal(`
    <div class="modal">
      <div class="modal-head">
        <h4>📋 Complaint Details</h4>
        <button class="modal-x" onclick="window.closeModal()">✕</button>
      </div>
      <div class="modal-body">

        <div class="cc-top" style="margin-bottom:14px; flex-wrap:wrap; gap:6px;">
          <code class="cid-chip">${c.id?.slice(0,8)}</code>
          <span class="cc-status ${statusCls[c.status]}">${statusLbl[c.status]}</span>
          ${c.againstRole
            ? `<span class="cc-cat">Against: ${ROLE_LABELS[c.againstRole]||c.againstRole}</span>`
            : ''}
          ${c.priority === 'high' ? '<span class="cc-priority">🔴 High Priority</span>' : ''}
        </div>

        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px;">${c.title}</h3>

        <!-- Progress tracker -->
        <div class="tracker">
          ${['Submitted','Under Review','Resolved'].map((l,i) => `
            <div class="tr-step ${i < cur ? 'done' : i === cur ? 'current' : ''}">
              <div class="tr-dot">${i < cur ? '✓' : i+1}</div>
              <div class="tr-lbl">${l}</div>
            </div>
            ${i < 2 ? `<div class="tr-line ${i < cur ? 'done' : ''}"></div>` : ''}
          `).join('')}
        </div>

        <div class="modal-desc">${c.description}</div>

        <div class="modal-grid">
          <div>
            <span class="mg-lbl">Category</span>
            <div class="mg-val">${c.category}</div>
          </div>
          <div>
            <span class="mg-lbl">Department</span>
            <div class="mg-val">${c.department}</div>
          </div>
          <div>
            <span class="mg-lbl">Complaint Against</span>
            <div class="mg-val">
              ${c.againstName || 'N/A'}
              ${c.againstRole
                ? `<span class="role-mini" style="margin-left:5px;">${ROLE_LABELS[c.againstRole]||''}</span>`
                : ''}
            </div>
          </div>
          <div>
            <span class="mg-lbl">Filed On</span>
            <div class="mg-val">${dt}</div>
          </div>
          <div style="grid-column:1/-1;">
            <span class="mg-lbl">Complainant Identity</span>
            <div class="mg-val" style="margin-top:5px;">
              ${showIdentity
                ? `<span style="color:var(--green);font-weight:700;">✅ Visible to you</span>
                   &nbsp;—&nbsp; <strong>${c.submittedByName}</strong>
                   ${c.submittedBy ? `<span style="color:var(--muted);font-size:.82rem;">&nbsp;(${c.submittedBy})</span>` : ''}`
                : `<span class="identity-hidden">🔒 Hidden — Protected</span>`}
            </div>
          </div>
        </div>

        <!-- Identity explanation -->
        ${!showIdentity ? `
          <div class="identity-shield">
            🔐 <strong>Why hidden?</strong> This complaint is against a
            <strong>${ROLE_LABELS[accRole]||accRole}</strong>.
            Only <strong>${whoCanSee}</strong> can see who filed it,
            to protect the student from retaliation.
          </div>
        ` : !isSelf ? `
          <div class="alert-info" style="font-size:.83rem; margin-top:4px;">
            ℹ️ You can see this identity because your authority rank is higher than
            <strong>${ROLE_LABELS[accRole]||accRole}</strong>. Handle this information responsibly.
          </div>
        ` : ''}

        <!-- Resolution (if any) -->
        ${c.resolution ? `
          <div class="alert-success" style="margin-top:14px;">
            <strong>✅ Resolution:</strong><br/>${c.resolution}
          </div>` : ''}

        <!-- Edit panel (for authority/admin) -->
        ${canEdit ? `
          <div class="modal-edit-section">
            <div style="font-weight:700; font-family:var(--font-head); margin-bottom:14px;">
              Update Complaint Status
            </div>
            <div class="form-group">
              <label>New Status</label>
              <select id="m-status" class="form-ctrl">
                <option value="pending"     ${c.status==='pending'     ?'selected':''}>⏳ Pending</option>
                <option value="in-progress" ${c.status==='in-progress' ?'selected':''}>🔄 In Progress</option>
                <option value="resolved"    ${c.status==='resolved'    ?'selected':''}>✅ Resolved</option>
                <option value="rejected"    ${c.status==='rejected'    ?'selected':''}>❌ Rejected</option>
              </select>
            </div>
            <div class="form-group">
              <label>Resolution / Action Taken</label>
              <textarea id="m-resolution" class="form-ctrl" rows="3"
                placeholder="Describe what action was taken to resolve this…">${c.resolution||''}</textarea>
            </div>
            <button class="btn btn-success btn-sm"
              onclick="window.saveComplaintUpdate('${c.id}','${viewerRole}')">
              💾 Save Update
            </button>
            <div style="font-size:.78rem; color:var(--muted); margin-top:8px;">
              📧 The student will receive an email notification about this status change.
            </div>
          </div>
        ` : ''}

      </div>
    </div>
  `);
}

// ── Global bindings ──────────────────────────────────────────
window.viewComplaint = function(id, role) {
  const c = STATE.complaints.find(x => x.id === id);
  if (!c) return;
  showComplaintModal(c, role);
};

window.saveComplaintUpdate = async function(id, viewerRole) {
  const status     = document.getElementById('m-status').value;
  const resolution = document.getElementById('m-resolution').value.trim();
  const btn = document.querySelector('.modal-edit-section .btn-success');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    // Call backend — this also sends email to the student
    await updateComplaintStatusAPI(id, status, resolution);

    // Update local state
    const c = STATE.complaints.find(x => x.id === id);
    if (c) { c.status = status; c.resolution = resolution; }

    closeModal();
    toast('✅ Complaint updated. Student notified by email.', 'success');

    // Refresh the current dashboard
    if (viewerRole === 'student')   { await fetchAndShow(); }
    else if (viewerRole === 'admin'){ window.adminRefresh?.(); }
    else                            { window.authorityRefresh?.(); }
  } catch (err) {
    toast('❌ ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Update'; }
  }
};

// Export fetchAndShow so other modules can trigger a refresh
export { fetchAndShow };
