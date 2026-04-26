// ============================================================
//  pages/submit-complaint.js
//  Uses the Express backend API (POST /api/complaints)
//  Backend handles: saving to Firestore + sending emails
// ============================================================
import { STATE, navigate, toast, CATEGORIES, DEPARTMENTS } from '../app.js';
import { submitComplaintAPI, getTeachersAPI }              from '../api.js';

export async function render() {
  const el = document.getElementById('page-submit-complaint');
  el.innerHTML = `
    <div class="submit-shell">
      <div class="submit-wrap">
        <button class="back-btn" onclick="history.back()">← Back</button>
        <h2>📝 Submit a Complaint</h2>
        <p class="submit-sub">Fill in the details below. Your identity is always protected from the person you complain about.</p>

        <div class="identity-shield" style="margin-bottom:24px;">
          🛡️ <strong>Identity Shield Active</strong> — The person you're complaining about will
          <strong>never</strong> see your name or ID. Only a higher authority can verify your identity.
        </div>

        ${!STATE.user ? `
          <div class="alert-warn" style="margin-bottom:20px;">
            ⚠️ You are not logged in.
            <a href="#" onclick="window.goTo('login')" style="font-weight:700; color:inherit;">Login here</a>
            to file a verified complaint.
          </div>` : ''}

        <div class="card-form" id="submit-form">
          <div id="submit-msg"></div>
          <div id="teachers-loading" style="color:var(--muted); font-size:.88rem; margin-bottom:12px;">
            ⏳ Loading staff list…
          </div>

          <div class="form-group">
            <label>Complaint Title <span class="req">*</span></label>
            <input type="text" id="f-title" class="form-ctrl"
              placeholder="Short summary — e.g. Unfair marking in Unit Test 2" maxlength="120"/>
            <div class="form-hint" id="f-title-count">0 / 120 characters</div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label>Category <span class="req">*</span></label>
              <select id="f-cat" class="form-ctrl">
                <option value="">Select Category</option>
                ${CATEGORIES.map(c => `<option>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Department <span class="req">*</span></label>
              <select id="f-dept" class="form-ctrl">
                <option value="">Select Department</option>
                ${DEPARTMENTS.map(d => `<option>${d}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Complaint Against</label>
            <select id="f-against" class="form-ctrl">
              <option value="">Select Person (optional)</option>
            </select>
            <div class="form-hint">
              The selected person will <strong>NOT</strong> be able to see your identity.
            </div>
          </div>

          <div class="form-group">
            <label>Detailed Description <span class="req">*</span></label>
            <textarea id="f-desc" class="form-ctrl" rows="6"
              placeholder="Describe the incident in detail. Include date, time, what happened, and any witnesses. Be specific and factual."></textarea>
            <div class="form-hint" id="f-desc-count">0 characters</div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label>Priority</label>
              <select id="f-priority" class="form-ctrl">
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div class="form-group">
              <label>Date of Incident</label>
              <input type="date" id="f-date" class="form-ctrl"/>
            </div>
          </div>

          <div class="form-group" style="margin-top:8px;">
            <label class="checkbox-row">
              <input type="checkbox" id="f-confirm"/>
              I confirm this complaint is truthful and accurate to the best of my knowledge.
              I understand that filing false complaints is a violation of college policy and
              may result in disciplinary action against me.
            </label>
          </div>

          <div class="submit-actions">
            <button class="btn btn-fire" id="btn-submit" onclick="window.doSubmit()">
              🚀 Submit Complaint
            </button>
            <button class="btn btn-ghost" onclick="history.back()">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // ── Character counters ──────────────────────────────────────
  document.getElementById('f-title').addEventListener('input', function() {
    document.getElementById('f-title-count').textContent = `${this.value.length} / 120 characters`;
  });
  document.getElementById('f-desc').addEventListener('input', function() {
    document.getElementById('f-desc-count').textContent = `${this.value.length} characters`;
  });

  // ── Load teachers from backend ──────────────────────────────
  loadTeachers();

  // ── Submit handler ──────────────────────────────────────────
function extractComplaintId(result) {
      return result?.complaintId || result?.id || result?.data?.complaintId || result?.data?.id ||
             result?.result?.complaintId || result?.payload?.complaintId || result?.payload?.id ||
             result?.complaint?.id || undefined;
    }

    window.doSubmit = async () => {
    const title    = document.getElementById('f-title').value.trim();
    const cat      = document.getElementById('f-cat').value;
    const dept     = document.getElementById('f-dept').value;
    const desc     = document.getElementById('f-desc').value.trim();
    const confirm  = document.getElementById('f-confirm').checked;
    const priority = document.getElementById('f-priority').value;
    const incDate  = document.getElementById('f-date').value;
    const against  = document.getElementById('f-against').value;
    const msgEl    = document.getElementById('submit-msg');

    // Validate
    if (!title || !cat || !dept || !desc) {
      msgEl.innerHTML = `<div class="alert-err">⚠️ Please fill in all required fields (Title, Category, Department, Description).</div>`;
      window.scrollTo(0, msgEl.offsetTop - 20);
      return;
    }
    if (desc.length < 20) {
      msgEl.innerHTML = `<div class="alert-err">⚠️ Description is too short. Please describe the issue in detail (at least 20 characters).</div>`;
      return;
    }
    if (!confirm) {
      msgEl.innerHTML = `<div class="alert-err">⚠️ Please tick the confirmation checkbox before submitting.</div>`;
      return;
    }
    if (!STATE.user) {
      msgEl.innerHTML = `<div class="alert-err">⚠️ You must be logged in to submit a complaint. <a href="#" onclick="window.goTo('login')">Login here</a></div>`;
      return;
    }

    // Parse the against field: "uid|name|cid|role"
    const [againstUid, againstName, againstCid, againstRole] = (against || '').split('|');

    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.innerHTML = '⏳ Submitting…';
    msgEl.innerHTML = '';

    try {
      const payload = {
        title, description: desc, category: cat,
        department: dept, priority, incidentDate: incDate || null,
        againstUid:  againstUid  || null,
        againstName: againstName || null,
        againstCid:  againstCid  || null,
        againstRole: againstRole || null,
      };

      console.log('Complaint submit payload:', payload);
      const result = await submitComplaintAPI(payload);
      console.log('Complaint submit result:', result);

      const cid = extractComplaintId(result) || 'UNKNOWN';

      msgEl.innerHTML = `
        <div class="alert-success">
          <div style="font-size:1.3rem; margin-bottom:8px;">🎉 Complaint Submitted Successfully!</div>
          <div style="margin-bottom:10px;">
            Your Complaint ID: <code class="cid-chip">${cid}</code>
          </div>
          <div style="font-size:.87rem; margin-bottom:12px;">
            📧 A confirmation email has been sent to <strong>${STATE.user.email}</strong><br/>
            🛡️ Your identity is protected — the accused person cannot see your name.<br/>
            📋 Save your Complaint ID to track progress anytime.
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-success btn-sm" onclick="window.goTo('track')">🔍 Track This Complaint</button>
            <button class="btn btn-ghost btn-sm" onclick="window.goTo('student-dashboard')">← My Dashboard</button>
          </div>
        </div>`;

      // Reset form
      document.getElementById('f-title').value    = '';
      document.getElementById('f-desc').value     = '';
      document.getElementById('f-confirm').checked = false;
      document.getElementById('f-cat').selectedIndex   = 0;
      document.getElementById('f-dept').selectedIndex  = 0;
      document.getElementById('f-against').selectedIndex = 0;
      document.getElementById('f-title-count').textContent = '0 / 120 characters';
      document.getElementById('f-desc-count').textContent  = '0 characters';
      window.scrollTo(0, 0);

    } catch (err) {
      console.error('Complaint submit error:', err);
      msgEl.innerHTML = `<div class="alert-err">❌ ${err.message || err || 'Unknown error'}<br/><small>${JSON.stringify(err, Object.getOwnPropertyNames(err))}</small></div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🚀 Submit Complaint';
    }
  };
}

async function loadTeachers() {
  const select  = document.getElementById('f-against');
  const loading = document.getElementById('teachers-loading');

  if (!STATE.user) {
    loading.textContent = '⏳ Waiting for login to complete...';
    await new Promise(resolve => {
      const wait = setInterval(() => {
        if (STATE.user) { clearInterval(wait); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(wait); resolve(); }, 3000);
    });
  }

  if (!STATE.user) {
    loading.textContent = '⚠️ Please login to load the staff list.';
    return;
  }

  try {
    const res = await getTeachersAPI();
    const teachers = Array.isArray(res?.teachers)
      ? res.teachers
      : Array.isArray(res)
      ? res
      : (Array.isArray(res?.data) ? res.data : []);

    console.log('Loaded teachers:', teachers);
    loading.style.display = 'none';

    if (!teachers.length) {
      loading.textContent = '⚠️ No staff entries found. You can still submit the complaint.';
    }

    teachers.forEach(t => {
      const label = t.displayName || t.name || 'Unknown';
      const opt   = document.createElement('option');
      opt.value   = `${t.uid || t.id || ''}|${label}|${t.collegeId || ''}|${t.role || 'teacher'}`;
      opt.textContent = `${label} — ${t.subject || t.role || 'Staff'} (${t.department || 'N/A'})`;
      select.appendChild(opt);
    });

    const other   = document.createElement('option');
    other.value   = `||other|teacher`;
    other.textContent = 'Other / Not Listed';
    select.appendChild(other);
  } catch (err) {
    loading.textContent = '⚠️ Could not load staff list. You can still submit.';
    console.error('Teacher load error:', err);
  }
}
