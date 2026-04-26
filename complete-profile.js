// ============================================================
//  pages/complete-profile.js
//  Shown once after first Google login — user picks role,
//  enters college ID, sets site password
// ============================================================
import { auth, db }                         from '../firebase/init.js';
import { updatePassword, EmailAuthProvider,
         linkWithCredential }               from 'firebase/auth';
import { doc, setDoc, getDoc,
         serverTimestamp, collection,
         query, where, getDocs }            from 'firebase/firestore';
import { STATE, navigate, toast,
         ADMIN_EMAILS, DEPARTMENTS }        from '../app.js';

export function render() {
  const u   = auth.currentUser;
  const el  = document.getElementById('page-complete-profile');
  if (!u) { navigate('login'); return; }

  const isBootstrapAdmin = ADMIN_EMAILS.includes(u.email?.toLowerCase());

  el.innerHTML = `
    <div class="profile-setup-shell">
      <div class="profile-setup-card">
        <div class="setup-header">
          <div class="setup-avatar">${u.displayName?.[0] || '?'}</div>
          <div>
            <h2>Complete Your Profile</h2>
            <p>Verified as <strong>${u.email}</strong></p>
          </div>
        </div>

        <div class="setup-step-bar">
          <div class="setup-step active" id="sstep-1"><span>1</span> Your Role</div>
          <div class="setup-step-line"></div>
          <div class="setup-step" id="sstep-2"><span>2</span> College Details</div>
          <div class="setup-step-line"></div>
          <div class="setup-step" id="sstep-3"><span>3</span> Set Password</div>
        </div>

        <div id="setup-error"></div>

        <!-- STEP 1: Role -->
        <div id="step-1">
          <h3 class="step-title">What is your role at A.C. Patil College?</h3>
          ${isBootstrapAdmin ? `
            <div class="alert-info" style="margin-bottom:16px;">
              🛡️ Your email is registered as a <strong>System Admin</strong>.
            </div>` : ''}
          <div class="role-picker">
            ${[
              { val:'student',   icon:'🎒', label:'Student',          desc:'UG/PG student enrolled at the college' },
              { val:'teacher',   icon:'👨‍🏫', label:'Teacher / Staff',  desc:'Faculty or non-teaching staff' },
              { val:'hod',       icon:'🎓', label:'Head of Department',desc:'HOD of any department' },
              { val:'principal', icon:'🏛️', label:'Principal / VP',    desc:'Principal or Vice-Principal' },
              { val:'director',  icon:'🎯', label:'University Director', desc:'Director of the affiliated university' },
              ...(isBootstrapAdmin ? [{ val:'admin', icon:'⚙️', label:'System Admin', desc:'Full system administrator' }] : []),
            ].map(r => `
              <label class="role-pick-item">
                <input type="radio" name="role" value="${r.val}" />
                <div class="rpi-box">
                  <span class="rpi-icon">${r.icon}</span>
                  <div>
                    <div class="rpi-label">${r.label}</div>
                    <div class="rpi-desc">${r.desc}</div>
                  </div>
                </div>
              </label>
            `).join('')}
          </div>
          <button class="btn btn-primary btn-full" style="margin-top:20px;" onclick="setupStep1()">Next →</button>
        </div>

        <!-- STEP 2: College Details -->
        <div id="step-2" style="display:none;">
          <h3 class="step-title">Your College Details</h3>
          <div class="form-group">
            <label>Full Name <span class="req">*</span></label>
            <input type="text" id="sp-name" class="form-ctrl" value="${u.displayName || ''}" placeholder="As per college records" />
          </div>
          <div class="form-group">
            <label id="id-label">College ID <span class="req">*</span></label>
            <input type="text" id="sp-cid" class="form-ctrl" placeholder="e.g. STU2024CE001 or TCH001" />
            <div class="form-hint" id="id-hint">Your ID is shown on your college ID card / appointment letter.</div>
          </div>
          <div class="form-group">
            <label>Department <span class="req">*</span></label>
            <select id="sp-dept" class="form-ctrl">
              <option value="">Select Department</option>
              ${DEPARTMENTS.map(d => `<option>${d}</option>`).join('')}
              <option value="Administration">Administration</option>
            </select>
          </div>
          <div id="year-group" class="form-group" style="display:none;">
            <label>Year <span class="req">*</span></label>
            <select id="sp-year" class="form-ctrl">
              <option value="">Select Year</option>
              <option>First Year (FE)</option>
              <option>Second Year (SE)</option>
              <option>Third Year (TE)</option>
              <option>Final Year (BE)</option>
            </select>
          </div>
          <div id="subject-group" class="form-group" style="display:none;">
            <label>Subject / Designation</label>
            <input type="text" id="sp-subject" class="form-ctrl" placeholder="e.g. Data Structures, Lab Instructor" />
          </div>
          <div class="form-group">
            <label>Phone Number (Optional)</label>
            <input type="tel" id="sp-phone" class="form-ctrl" placeholder="+91 XXXXX XXXXX" />
          </div>
          <div style="display:flex; gap:12px;">
            <button class="btn btn-ghost" onclick="backToStep(1)">← Back</button>
            <button class="btn btn-primary" style="flex:1;" onclick="setupStep2()">Next →</button>
          </div>
        </div>

        <!-- STEP 3: Password -->
        <div id="step-3" style="display:none;">
          <h3 class="step-title">Set Your Site Password</h3>
          <div class="alert-info" style="margin-bottom:18px;">
            This password is <strong>only for this website</strong>. It is separate from your Google password.
            You'll use your email + this password to log in next time.
          </div>
          <div class="form-group">
            <label>Site Password <span class="req">*</span></label>
            <input type="password" id="sp-pw" class="form-ctrl" placeholder="Min 8 characters" />
            <div class="form-hint">Use a unique password — different from your Google/college passwords.</div>
          </div>
          <div class="form-group">
            <label>Confirm Password <span class="req">*</span></label>
            <input type="password" id="sp-pw2" class="form-ctrl" placeholder="Re-enter password" />
          </div>
          <div class="form-group">
            <label class="checkbox-row">
              <input type="checkbox" id="sp-agree" />
              I understand my identity is kept confidential from accused teachers, but may be verified by HOD / Principal / Admin.
            </label>
          </div>
          <div style="display:flex; gap:12px;">
            <button class="btn btn-ghost" onclick="backToStep(2)">← Back</button>
            <button class="btn btn-primary" style="flex:1;" id="btn-finish" onclick="finishSetup()">✅ Create Account</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Store selected role in closure
  let selectedRole = '';

  window.setupStep1 = () => {
    const picked = document.querySelector('input[name="role"]:checked');
    if (!picked) {
      document.getElementById('setup-error').innerHTML = `<div class="alert-err">Please select your role.</div>`; return;
    }
    selectedRole = picked.value;
    window._setupRole = selectedRole;
    // Show/hide year and subject fields
    if (selectedRole === 'student') {
      document.getElementById('year-group').style.display    = '';
      document.getElementById('subject-group').style.display = 'none';
      document.getElementById('id-label').textContent        = 'Student ID *';
      document.getElementById('sp-cid').placeholder         = 'e.g. STU2024CE001';
    } else {
      document.getElementById('year-group').style.display    = 'none';
      document.getElementById('subject-group').style.display = '';
      document.getElementById('id-label').textContent        = 'Staff ID *';
      document.getElementById('sp-cid').placeholder         = 'e.g. TCH001';
    }
    goToStep(2);
  };

  window.setupStep2 = async () => {
    const name  = document.getElementById('sp-name').value.trim();
    const cid   = document.getElementById('sp-cid').value.trim();
    const dept  = document.getElementById('sp-dept').value;
    if (!name || !cid || !dept) {
      document.getElementById('setup-error').innerHTML = `<div class="alert-err">⚠️ Please fill in all required fields.</div>`; return;
    }
    // Check if college ID is already taken
    const existing = await getDocs(query(collection(db,'users'), where('collegeId','==',cid)));
    if (!existing.empty) {
      document.getElementById('setup-error').innerHTML = `<div class="alert-err">❌ This college ID is already registered.</div>`; return;
    }
    document.getElementById('setup-error').innerHTML = '';
    window._setupName    = name;
    window._setupCid     = cid;
    window._setupDept    = dept;
    window._setupYear    = document.getElementById('sp-year')?.value    || '';
    window._setupSubject = document.getElementById('sp-subject')?.value || '';
    window._setupPhone   = document.getElementById('sp-phone')?.value   || '';
    goToStep(3);
  };

  window.finishSetup = async () => {
    const pw   = document.getElementById('sp-pw').value;
    const pw2  = document.getElementById('sp-pw2').value;
    const agree = document.getElementById('sp-agree').checked;
    const err  = document.getElementById('setup-error');
    if (pw.length < 8) { err.innerHTML = `<div class="alert-err">Password must be at least 8 characters.</div>`; return; }
    if (pw !== pw2)    { err.innerHTML = `<div class="alert-err">Passwords do not match.</div>`; return; }
    if (!agree)        { err.innerHTML = `<div class="alert-err">Please agree to the privacy terms.</div>`; return; }

    const btn = document.getElementById('btn-finish');
    btn.disabled = true; btn.textContent = 'Creating account…';

    try {
      const u = auth.currentUser;
      // Link email+password credential to the Google account
      const cred = EmailAuthProvider.credential(u.email, pw);
      await linkWithCredential(u, cred);

      // Check if email is in admins collection → assign admin role
      const adminSnap = await getDoc(doc(db, 'admins', u.email.toLowerCase()));
      const isAdmin = adminSnap.exists() || ADMIN_EMAILS.includes(u.email.toLowerCase());

      const role = isAdmin ? 'admin' : window._setupRole;

      // Save to Firestore
      const profile = {
        uid:         u.uid,
        email:       u.email,
        displayName: window._setupName,
        collegeId:   window._setupCid,
        department:  window._setupDept,
        role,
        year:        window._setupYear    || null,
        subject:     window._setupSubject || null,
        phone:       window._setupPhone   || null,
        photoURL:    u.photoURL           || null,
        isVerified:  true,
        createdAt:   serverTimestamp(),
      };
      await setDoc(doc(db, 'users', u.uid), profile);

      // If first admin, seed admins collection
      if (isAdmin) {
        await setDoc(doc(db, 'admins', u.email.toLowerCase()), { addedAt: serverTimestamp() });
      }

      STATE.profile = profile;
      toast('🎉 Account created! Welcome to Digital Complaint Box.', 'success');

      // Route to dashboard
      const { routeToDashboard } = await import('../app.js');
      routeToDashboard();
    } catch (e) {
      err.innerHTML = `<div class="alert-err">❌ ${e.message}</div>`;
      btn.disabled  = false;
      btn.textContent = '✅ Create Account';
    }
  };

  window.backToStep = goToStep;
}

function goToStep(n) {
  [1,2,3].forEach(i => {
    document.getElementById(`step-${i}`).style.display   = i === n ? '' : 'none';
    document.getElementById(`sstep-${i}`)?.classList.toggle('active', i <= n);
  });
  document.getElementById('setup-error').innerHTML = '';
}
