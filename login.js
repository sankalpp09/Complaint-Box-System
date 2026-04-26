// ============================================================
//  pages/login.js
//  Two clear paths:
//   1. FIRST TIME?  → Sign Up with Google → set your password
//   2. RETURNING?   → Login with Email + your site password
//                     OR just click "Continue with Google" again
// ============================================================
import { auth, googleProvider, db }          from '../firebase/init.js';
import { signInWithPopup,
         signInWithEmailAndPassword }         from 'firebase/auth';
import { doc, getDoc }                        from 'firebase/firestore';
import { STATE, navigate, toast }             from '../app.js';

export function render() {
  const el = document.getElementById('page-login');
  el.innerHTML = `
    <div class="auth-shell">

      <!-- LEFT PANEL -->
      <div class="auth-left">
        <div class="auth-brand">
          <div class="auth-logo">📬</div>
          <div>
            <div class="auth-college">A.C. Patil College of Engineering</div>
            <div class="auth-college-sub">Kharghar, Navi Mumbai – 410210</div>
          </div>
        </div>
        <h2>Digital Complaint Box</h2>
        <p>A safe, anonymous, and verified platform to raise genuine concerns — without fear of retaliation.</p>
        <div class="auth-features">
          ${[
            ['🛡️','Identity hidden from the person you complain about'],
            ['✅','Verified via your Google account'],
            ['🔑','Your own site password — separate from Google'],
            ['📊','Real-time complaint status tracking'],
            ['📬','Email notifications on updates'],
          ].map(([i,t]) => `<div class="auth-feat"><span>${i}</span>${t}</div>`).join('')}
        </div>

        <!-- HOW TO LOGIN box shown on left panel -->
        <div class="login-howto">
          <div class="howto-title">🤔 How do I login?</div>
          <div class="howto-row">
            <span class="howto-num">1</span>
            <span><strong>First time?</strong> Click "Sign Up" tab → Sign Up with Google → complete your profile → set your site password.</span>
          </div>
          <div class="howto-row">
            <span class="howto-num">2</span>
            <span><strong>Already signed up?</strong> Enter your Gmail + the site password you set during signup.</span>
          </div>
          <div class="howto-row">
            <span class="howto-num">3</span>
            <span><strong>Forgot password?</strong> Click "Forgot site password?" below the login button.</span>
          </div>
        </div>
      </div>

      <!-- RIGHT PANEL -->
      <div class="auth-right">
        <div class="auth-box">

          <div class="auth-tabs" id="auth-tabs">
            <button class="auth-tab active" data-tab="login"  onclick="window.switchTab('login')">Login</button>
            <button class="auth-tab"        data-tab="signup" onclick="window.switchTab('signup')">Sign Up</button>
          </div>

          <!-- ══ LOGIN PANEL ══════════════════════════════════ -->
          <div id="panel-login">

            <div class="login-method-cards">
              <!-- Method A: Google (quickest for returning users) -->
              <div class="method-card" id="method-google-card">
                <div class="method-label">⚡ Quick Login (Recommended)</div>
                <button class="btn-google" id="btn-google-login" onclick="window.handleGoogleLogin()">
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20"/>
                  Continue with Google
                </button>
                <div class="method-note">
                  Just click and select your Google account — no password needed.<br/>
                  ✅ Works if you already signed up.
                </div>
              </div>

              <div class="auth-or"><span>or login with email + password</span></div>

              <!-- Method B: Email + site password -->
              <div class="method-card">
                <div class="method-label">🔑 Email + Site Password</div>
                <div class="form-group">
                  <label>Your Gmail Address <span class="req">*</span></label>
                  <input type="email" id="login-email" class="form-ctrl"
                    placeholder="e.g. yourname@gmail.com" autocomplete="email"/>
                  <div class="form-hint">Use the same Gmail you signed up with.</div>
                </div>
                <div class="form-group">
                  <label>
                    Site Password <span class="req">*</span>
                    <span class="label-note">— the password you set during profile setup</span>
                  </label>
                  <div class="pw-wrap">
                    <input type="password" id="login-password" class="form-ctrl"
                      placeholder="Your site password (not your Gmail password)"
                      autocomplete="current-password"/>
                    <button class="pw-toggle" type="button"
                      onclick="window.togglePw('login-password', this)">👁️</button>
                  </div>
                  <div class="form-hint pw-hint">
                    ⚠️ This is <strong>NOT your Gmail password</strong>.
                    This is the password you created on this website when you first signed up.
                  </div>
                </div>
                <div id="login-err"></div>
                <button class="btn btn-primary btn-full" onclick="window.handleEmailLogin()">
                  Login →
                </button>
                <div style="text-align:center; margin-top:10px;">
                  <a href="#" class="forgot-link" onclick="window.showForgotPassword()">
                    Forgot site password?
                  </a>
                </div>
              </div>
            </div>

            <div class="auth-link" style="margin-top:16px;">
              <a href="#" onclick="window.goTo('track')">🔍 Track a complaint without login →</a>
            </div>
          </div>

          <!-- ══ SIGNUP PANEL ══════════════════════════════════ -->
          <div id="panel-signup" style="display:none;">

            <div class="signup-flow-explain">
              <div class="sfe-title">How Signup Works — 3 Simple Steps</div>
              <div class="sfe-steps">
                <div class="sfe-step">
                  <div class="sfe-num">1</div>
                  <div>
                    <strong>Verify with Google</strong><br/>
                    <span>Click below and pick your Gmail. This verifies you're a real person.</span>
                  </div>
                </div>
                <div class="sfe-arrow">↓</div>
                <div class="sfe-step">
                  <div class="sfe-num">2</div>
                  <div>
                    <strong>Fill your college details</strong><br/>
                    <span>Enter your Student/Staff ID, department, and role.</span>
                  </div>
                </div>
                <div class="sfe-arrow">↓</div>
                <div class="sfe-step">
                  <div class="sfe-num">3</div>
                  <div>
                    <strong>Set your site password</strong><br/>
                    <span>Create a password <em>only for this website</em>. Not your Gmail password.</span>
                  </div>
                </div>
              </div>
            </div>

            <button class="btn-google" id="btn-google-signup" onclick="window.handleGoogleSignup()">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20"/>
              Sign Up with Google
            </button>

            <div class="auth-note" style="margin-top:14px;">
              After Google verification you'll be taken to a profile setup page where you'll
              enter your college ID and <strong>set a site-specific password</strong>.
              Next time you can login with your Gmail + that password.
            </div>
          </div>

          <div style="text-align:center; margin-top:18px;">
            <a href="#" onclick="window.goTo('landing')" class="back-link">← Back to Home</a>
          </div>

        </div>
      </div>
    </div>

    <!-- FORGOT PASSWORD MODAL -->
    <div id="forgot-overlay" style="display:none; position:fixed; inset:0;
      background:rgba(0,0,0,.5); z-index:600; align-items:center; justify-content:center; padding:20px;">
      <div style="background:#fff; border-radius:14px; max-width:420px; width:100%; padding:28px; box-shadow:0 20px 60px rgba(0,0,0,.25);">
        <h4 style="font-family:var(--font-head); font-weight:700; margin-bottom:8px;">🔑 Reset Site Password</h4>
        <p style="color:var(--muted); font-size:.9rem; margin-bottom:20px;">
          Enter your Gmail address and we'll send a password reset link to it.
        </p>
        <div class="form-group">
          <label>Your Gmail Address</label>
          <input type="email" id="forgot-email" class="form-ctrl" placeholder="yourname@gmail.com"/>
        </div>
        <div id="forgot-msg"></div>
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost" style="flex:1;"
            onclick="document.getElementById('forgot-overlay').style.display='none'">Cancel</button>
          <button class="btn btn-primary" style="flex:1;"
            onclick="window.sendReset()">Send Reset Link</button>
        </div>
      </div>
    </div>
  `;

  // ── Bind all functions ──────────────────────────────────────
  window.switchTab         = switchTab;
  window.handleGoogleLogin = handleGoogleLogin;
  window.handleGoogleSignup= handleGoogleSignup;
  window.handleEmailLogin  = handleEmailLogin;
  window.showForgotPassword= showForgotPassword;
  window.sendReset         = sendReset;
  window.togglePw          = togglePw;
}

// ── Tab switcher ────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.auth-tab')
    .forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('panel-login').style.display  = tab === 'login'  ? '' : 'none';
  document.getElementById('panel-signup').style.display = tab === 'signup' ? '' : 'none';
}

// ── Google login (returning user) ───────────────────────────
async function handleGoogleLogin() {
  const btn = document.getElementById('btn-google-login');
  btn.disabled = true;
  btn.innerHTML = '<span style="opacity:.6">Signing in…</span>';
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const snap   = await getDoc(doc(db, 'users', result.user.uid));
    if (!snap.exists()) {
      // First time via Google on the Login tab — send to profile setup
      navigate('complete-profile');
    }
    // onAuthStateChanged in app.js routes them to dashboard
  } catch (e) {
    document.getElementById('login-err').innerHTML =
      `<div class="alert-err">❌ ${e.message}</div>`;
    btn.disabled = false;
    btn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20"/> Continue with Google`;
  }
}

// ── Google signup (new user) ─────────────────────────────────
async function handleGoogleSignup() {
  const btn = document.getElementById('btn-google-signup');
  btn.disabled = true;
  btn.innerHTML = '<span style="opacity:.6">Opening Google…</span>';
  try {
    await signInWithPopup(auth, googleProvider);
    // onAuthStateChanged → if no profile → navigate('complete-profile')
  } catch (e) {
    toast('❌ ' + e.message, 'error');
    btn.disabled = false;
    btn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20"/> Sign Up with Google`;
  }
}

// ── Email + site password login ──────────────────────────────
async function handleEmailLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-err');

  if (!email || !password) {
    errEl.innerHTML = `<div class="alert-err">⚠️ Please enter your Gmail address and site password.</div>`;
    return;
  }
  if (auth.currentUser?.providerData[0]?.providerId === "google.com") {
  document.getElementById('login-err').innerHTML =
    `<div class="alert-err">⚠️ You signed up using Google. Please click "Continue with Google".</div>`;
  return;
}
  errEl.innerHTML = `<div style="color:var(--muted); padding:8px 0; font-size:.88rem;">Logging in…</div>`;
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged handles redirect
  } catch (e) {
    const friendlyMsg =
        e.code === 'auth/user-not-found'     ? `No account found for <strong>${email}</strong>. Please sign up first.`
      : e.code === 'auth/wrong-password'     ? `Incorrect site password. Remember: this is the password you set on this website — not your Gmail password. <a href="#" onclick="window.showForgotPassword()" style="color:var(--primary);">Reset it?</a>`
      : e.code === 'auth/invalid-email'      ? `That doesn't look like a valid email address.`
      : e.code === 'auth/too-many-requests'  ? `Too many failed attempts. Please wait a few minutes or reset your password.`
      : e.code === 'auth/invalid-credential' ? `Wrong email or password. <br/><small>If you signed up with Google, try "Continue with Google" instead.</small>`
      : e.message;
    errEl.innerHTML = `<div class="alert-err">❌ ${friendlyMsg}</div>`;
  }
}

// ── Forgot password ──────────────────────────────────────────
function showForgotPassword() {
  const overlay = document.getElementById('forgot-overlay');
  overlay.style.display = 'flex';
  // Pre-fill email if already typed
  const emailInput = document.getElementById('login-email');
  if (emailInput?.value) {
    document.getElementById('forgot-email').value = emailInput.value;
  }
}

async function sendReset() {
  const email  = document.getElementById('forgot-email').value.trim();
  const msgEl  = document.getElementById('forgot-msg');
  if (!email) {
    msgEl.innerHTML = `<div class="alert-err">Please enter your email address.</div>`; return;
  }
  try {
    const { sendPasswordResetEmail } = await import('firebase/auth');
    await sendPasswordResetEmail(auth, email);
    msgEl.innerHTML = `
      <div class="alert-success" style="margin-top:10px;">
        ✅ Reset link sent to <strong>${email}</strong>.<br/>
        Check your inbox (and spam folder). Click the link in the email to set a new site password.
      </div>`;
  } catch (e) {
    const msg = e.code === 'auth/user-not-found'
      ? 'No account with that email. Are you sure you signed up?'
      : e.message;
    msgEl.innerHTML = `<div class="alert-err">❌ ${msg}</div>`;
  }
}

// ── Show/hide password toggle ────────────────────────────────
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}
