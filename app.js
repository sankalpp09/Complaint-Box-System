// ============================================================
//  src/app.js  —  App State, Router, Boot
// ============================================================
import { auth, db }                         from './firebase/init.js';
import { onAuthStateChanged }               from 'firebase/auth';
import { doc, getDoc, setDoc, collection,
         query, where, orderBy, onSnapshot,
         addDoc, updateDoc, serverTimestamp,
         getDocs, deleteDoc }               from 'firebase/firestore';

// ── Global State ─────────────────────────────────────────────
export const STATE = {
  user:       null,   // Firebase auth user
  profile:    null,   // Firestore /users/{uid} doc
  page:       'landing',
  sidebarTab: 'dashboard',
  complaints: [],
  unsubscribe: null,  // Firestore listener cleanup
};

// ── Constants ────────────────────────────────────────────────
export const ADMIN_EMAILS = ['sankalpbhosle009@gmail.com'];   // Bootstrap admin

export const DEPARTMENTS = [
  'Computer Engineering',
  'Information Technology',
  'Electronics & Telecommunication',
  'Mechanical Engineering',
  'Civil Engineering',
  'Basic Sciences & Humanities',
];

export const CATEGORIES = [
  'Academic Issue',
  'Unfair Marking / Grading',
  'Teacher Behavior / Misconduct',
  'Attendance Manipulation',
  'Teaching Quality',
  'Infrastructure / Facilities',
  'Hostel / Canteen',
  'Library',
  'Administration',
  'Ragging / Bullying',
  'Other',
];

export const ROLE_LABELS = {
  student:   '🎒 Student',
  teacher:   '👨‍🏫 Teacher',
  hod:       '🎓 HOD',
  principal: '🏛️ Principal',
  director:  '🎯 University Director',
  admin:     '⚙️ Admin',
};

// ── Role Hierarchy ────────────────────────────────────────────
// Defines which roles can SEE the identity of the complainant
// based on who the complaint is filed AGAINST.
//
//  against teacher   → hod, principal, director, admin can see identity
//  against hod       → principal, director, admin can see identity
//  against principal → director, admin can see identity
//  against director  → admin can see identity
//
export const ROLE_RANK = {
  student:  0,
  teacher:  1,
  hod:      2,
  principal:3,
  director: 4,
  admin:    99, // admin always sees everything
};

// Returns true if `viewerRole` is allowed to see the complainant's
// identity given that the complaint is filed against `againstRole`.
export function canSeeIdentity(viewerRole, againstRole) {
  if (viewerRole === 'admin') return true;                          // admin always sees
  if (viewerRole === 'student') return false;                       // students never see others
  if (!againstRole) return false;
  // Viewer must be strictly higher rank than the accused role
  return (ROLE_RANK[viewerRole] ?? 0) > (ROLE_RANK[againstRole] ?? 0);
}

// ── Router ───────────────────────────────────────────────────
const PAGE_MODULES = import.meta.glob('./pages/*.js', { eager: false });

export function navigate(page, opts = {}) {
  STATE.page = page;
  if (opts.tab) STATE.sidebarTab = opts.tab;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) { el.classList.add('active'); window.scrollTo(0, 0); }

  const moduleKey = `./pages/${page}.js`;
  const loader = PAGE_MODULES[moduleKey];
  if (!loader) {
    console.error('Page module not found:', moduleKey);
    return;
  }

  loader().then(m => m.render()).catch(console.error);
}

// ── Auth listener ────────────────────────────────────────────
export function startAuthListener() {
  onAuthStateChanged(auth, async firebaseUser => {
    if (firebaseUser) {
  STATE.user = firebaseUser;

      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (snap.exists()) {
        STATE.profile = snap.data();
        updateTopNav();
        // If profile complete → go to their dashboard
        if (STATE.page === 'landing' || STATE.page === 'login') {
          routeToDashboard();
        }
      } else {
        // New user from Google — go to complete-profile
        STATE.profile = null;
        updateTopNav();
        navigate('complete-profile');
      }
    } else {
      STATE.user = null;
      STATE.profile = null;
      updateTopNav();
      if (!['landing','login','track'].includes(STATE.page)) navigate('landing');
    }
  });
}

export function routeToDashboard() {
  const role = STATE.profile?.role;
  if (!role) { navigate('complete-profile'); return; }
  if (role === 'student')                                    navigate('student-dashboard');
  else if (role === 'teacher')                               navigate('teacher-dashboard');
  else if (['hod','principal','director'].includes(role))    navigate('authority-dashboard');
  else if (role === 'admin')                                 navigate('admin-dashboard');
}

// ── Top Nav ──────────────────────────────────────────────────
export function updateTopNav() {
  const links = document.getElementById('nav-links');
  if (!links) return;
  if (!STATE.user) {
    links.innerHTML = `
      <button class="nav-btn" onclick="window.goTo('landing')">Home</button>
      <button class="nav-btn" onclick="window.goTo('track')">Track Complaint</button>
      <button class="nav-btn highlight" onclick="window.goTo('login')">Login / Sign Up</button>`;
  } else {
    const p = STATE.profile;
    const initial = (p?.displayName || STATE.user.displayName || 'U')[0].toUpperCase();
    links.innerHTML = `
      <div class="user-pill">
        <div class="avatar" style="background:var(--accent);">${initial}</div>
        <span>${(p?.displayName || STATE.user.displayName || '').split(' ')[0]}</span>
        <span class="role-tag">${ROLE_LABELS[p?.role] || ''}</span>
      </div>
      <button class="nav-btn" onclick="window.goToDash()">Dashboard</button>
      <button class="nav-btn" onclick="window.doLogout()">Logout</button>`;
  }
}

// ── Firestore Helpers ────────────────────────────────────────
export async function createUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function submitComplaint(data) {
  const ref = await addDoc(collection(db, 'complaints'), {
    ...data,
    status:    'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateComplaint(id, data) {
  await updateDoc(doc(db, 'complaints', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export function listenComplaints(queryConstraints, callback) {
  if (STATE.unsubscribe) STATE.unsubscribe();
  const q = query(collection(db, 'complaints'), ...queryConstraints);
  STATE.unsubscribe = onSnapshot(q, snap => {
    STATE.complaints = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(STATE.complaints);
  });
}

export async function getTeachers() {
  const snap = await getDocs(query(
    collection(db, 'users'),
    where('role', 'in', ['teacher','hod','principal'])
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAllAdmins() {
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs.map(d => d.id);
}

export async function addAdmin(email) {
  await setDoc(doc(db, 'admins', email.toLowerCase()), { addedAt: serverTimestamp() });
}

export async function removeAdmin(email) {
  await deleteDoc(doc(db, 'admins', email.toLowerCase()));
}

// ── Toast ────────────────────────────────────────────────────
export function toast(msg, type = '') {
  document.getElementById('toast-el')?.remove();
  const t = document.createElement('div');
  t.id        = 'toast-el';
  t.className = 'toast ' + type;
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(() => t?.remove(), 4000);
}

// ── Modal helpers ────────────────────────────────────────────
export function openModal(html) {
  const ov = document.getElementById('modal-overlay');
  ov.innerHTML = html;
  ov.classList.add('open');
}
export function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('open');
}

// ── Global window bindings (called from HTML onclick) ────────
window.goTo       = navigate;
window.goToDash   = routeToDashboard;
window.doLogout   = async () => {
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
  toast('Logged out successfully.');
  navigate('landing');
};
window.closeModal = closeModal;