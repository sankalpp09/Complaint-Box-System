// ============================================================
//  pages/track.js — Public Complaint Tracker
//  Uses GET /api/complaints/track/:id  (no login needed)
//  Backend never returns identity fields on this endpoint.
// ============================================================
import { STATE, navigate, ROLE_LABELS } from '../app.js';
import { trackComplaintPublicAPI }        from '../api.js';

console.log("TRACK JS LOADED");

export function render() {
  const el = document.getElementById('page-track');
  el.innerHTML = `
    <div class="track-shell">
      <div class="track-wrap">
        <button class="back-btn" onclick="window.goTo('landing')">← Back to Home</button>
        <h2>🔍 Track Your Complaint</h2>
        <p class="submit-sub">
          Enter your Complaint ID to check the current status.
          No login required.
        </p>

        <div class="card-form">
          <div class="form-group">
            <label>Complaint ID <span class="req">*</span></label>
            <div style="display:flex; gap:10px;">
              <input type="text" id="track-id" class="form-ctrl"
                placeholder="Paste your full Complaint ID here"
                onkeydown="if(event.key==='Enter') window.doTrack()"/>
              <button class="btn btn-fire" onclick="window.doTrack()">Track →</button>
            </div>
            <div class="form-hint">
              Your Complaint ID was shown on screen and sent to your email when you submitted the complaint.
            </div>
          </div>
          <div id="track-result"></div>
        </div>

        ${STATE.user ? `
          <div style="margin-top:20px; background:#fff; border-radius:var(--radius);
            border:1px solid var(--border); padding:20px;">
            <div style="font-weight:700; font-family:var(--font-head); margin-bottom:10px;">
              📋 Or view all your complaints
            </div>
            <p style="color:var(--muted); font-size:.88rem; margin-bottom:12px;">
              You're logged in — you can see all your complaints in one place.
            </p>
            <button class="btn btn-outline btn-sm" onclick="window.goToDash()">
              Go to My Dashboard →
            </button>
          </div>
        ` : `
          <div style="margin-top:20px; background:#fff; border-radius:var(--radius);
            border:1px solid var(--border); padding:20px;">
            <div style="font-weight:700; font-family:var(--font-head); margin-bottom:8px;">
              💡 Don't have your Complaint ID?
            </div>
            <p style="color:var(--muted); font-size:.88rem; margin-bottom:12px;">
              Login to your student account to see all your complaints and their statuses.
            </p>
            <button class="btn btn-outline btn-sm" onclick="window.goTo('login')">
              Login to My Account →
            </button>
          </div>
        `}
      </div>
    </div>
  `;

  window.doTrack = async () => {
    const id    = document.getElementById('track-id').value.trim();
    const resEl = document.getElementById('track-result');

    if (!id) {
      resEl.innerHTML = `<div class="alert-err">⚠️ Please enter a Complaint ID.</div>`; return;
    }

    resEl.innerHTML = `<div style="color:var(--muted); padding:12px 0; font-size:.88rem;">⏳ Looking up…</div>`;

    try {
      const c   = await trackComplaintPublicAPI(id);
      console.log("TRACK DATA TYPE:", typeof c);
console.log("TRACK DATA VALUE:", c);

console.log("===== TRACK DATA =====");
console.log(c);

console.log("===== CREATED FIELDS =====");
console.log("createdAt:", c.createdAt);
console.log("created_at:", c.created_at);
console.log("timestamp:", c.timestamp);
console.log("date:", c.date);
console.log("submittedAt:", c.submittedAt);
      console.log("FULL OBJECT:", JSON.stringify(c, null, 2));
      console.log("CREATED FIELDS:", 
  c.createdAt,
  c.created_at,
  c.timestamp,
  c.createdOn
);
    const formatDate = (date) => {
  if (!date) return "N/A";

  try {
    // Firestore Timestamp (seconds)
    if (date?.seconds) {
      return new Date(date.seconds * 1000).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    }

    // Firestore Timestamp (_seconds)
    if (date?._seconds) {
      return new Date(date._seconds * 1000).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    }

    // If already Date object
    if (date instanceof Date) {
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    }

    // ISO String
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    }

    return "N/A";

  } catch {
    return "N/A";
  }
};

const dt = formatDate(c.createdAt);
const upd = formatDate(c.updatedAt);
      
      const filedAgainst = c.againstName
        || (c.againstRole ? ROLE_LABELS[c.againstRole] || c.againstRole : 'N/A');

      const statusCls = {
        pending:'s-pending','in-progress':'s-progress',
        resolved:'s-resolved',rejected:'s-rejected'
      };
      const statusLbl = {
        pending:'⏳ Pending','in-progress':'🔄 In Progress',
        resolved:'✅ Resolved',rejected:'❌ Rejected'
      };
      const cur = ({ pending:0,'in-progress':1,resolved:2,rejected:2 })[c.status] ?? 0;

      resEl.innerHTML = `
        <div style="border-top:1px solid var(--border); padding-top:20px; margin-top:8px;">
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
            <code class="cid-chip">${id.slice(0,8).toUpperCase()}</code>
            <span class="cc-status ${statusCls[c.status]}">${statusLbl[c.status]}</span>
            ${c.priority === 'high' ? '<span class="cc-priority">🔴 High Priority</span>' : ''}
          </div>

          <h3 style="font-weight:700; font-size:1.08rem; margin-bottom:16px;">
            ${c.title || 'Complaint Title Not Available'}
          </h3>
          <!-- Progress tracker -->
          <div class="tracker" style="margin-bottom:20px;">
            ${['Submitted','Under Review','Resolved'].map((l,i) => `
              <div class="tr-step ${i < cur ? 'done' : i === cur ? 'current' : ''}">
                <div class="tr-dot">${i < cur ? '✓' : i+1}</div>
                <div class="tr-lbl">${l}</div>
              </div>
              ${i < 2 ? `<div class="tr-line ${i < cur ? 'done' : ''}"></div>` : ''}
            `).join('')}
          </div>

          <div class="modal-grid" style="margin-bottom:16px;">
            <div>
              <span class="mg-lbl">Category</span>
              <div class="mg-val">${c.category ? c.category : 'Not Specified'}</div>
            </div>
            <div>
              <span class="mg-lbl">Department</span>
              <div class="mg-val">${c.department ? c.department : 'Not Specified'}</div>
            </div>
            <div>
              <span class="mg-lbl">Filed Against</span>
              <div class="mg-val">${filedAgainst}</div>
            </div>
            <div>
              <span class="mg-lbl">Filed On</span>
              <div class="mg-val">${dt}</div>
            </div>
            ${upd && upd !== dt ? `
              <div>
                <span class="mg-lbl">Last Updated</span>
                <div class="mg-val">${upd}</div>
              </div>` : ''}
          </div>

          ${c.resolution ? `
            <div class="alert-success">
              <strong>✅ Resolution:</strong><br/>${c.resolution}
            </div>
          ` : c.status === 'pending' ? `
            <div class="alert-info">
              ℹ️ Your complaint is pending review. The administration will look into it soon.
              You'll receive an email notification when the status changes.
            </div>
          ` : c.status === 'in-progress' ? `
            <div class="alert-info">
              🔄 Your complaint is currently being reviewed and acted upon by the administration.
            </div>
          ` : ''}
        </div>
      `;
    } catch (err) {
      resEl.innerHTML = `
        <div class="alert-err">
          ❌ Complaint not found.<br/>
          <span style="font-size:.85rem; margin-top:4px; display:block;">
            Please double-check your Complaint ID. It was shown when you submitted
            and sent to your email.
          </span>
        </div>`;
    }
  };
}
